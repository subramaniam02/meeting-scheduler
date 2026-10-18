import { db } from './firebaseAdmin.js';

export interface BookingDoc {
  id: string;
  hostId: string;
  guestEmail: string;
  guestName: string;
  guestUid: string;
  meetingTypeId: string;
  meetingTitle: string;
  tag: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  googleEventId?: string;
  googleMeetLink?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRequest {
  hostId: string;
  hostEmail?: string;
  guestEmail: string;
  guestName: string;
  guestUid?: string;
  meetingTypeId?: string;
  meetingTitle?: string;
  tag?: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  notes?: string;
  constraints?: {
    singleBookingPerGuest?: boolean;
    maxPerDayForTag?: number;
  };
}

export class BookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const bookingsCol = (hostId: string) => db.collection('users').doc(hostId).collection('bookings');

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Validate a booking request against hard safety caps and (where provided)
 * the host's constraints, re-checking against already-confirmed bookings in
 * Firestore so the server is the source of truth for conflicts.
 */
export async function validateBooking(req: BookingRequest): Promise<void> {
  if (!req.hostId) throw new BookingError('Missing hostId.');
  if (!req.guestEmail || !/^\S+@\S+\.\S+$/.test(req.guestEmail)) {
    throw new BookingError('A valid guest email is required.');
  }
  if (!req.guestName) throw new BookingError('Guest name is required.');

  const start = new Date(req.startTime);
  const end = new Date(req.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BookingError('Invalid start or end time.');
  }
  if (end <= start) throw new BookingError('End time must be after start time.');
  if (start.getTime() < Date.now()) throw new BookingError('Cannot book a slot in the past.');

  const durationMinutes = req.durationMinutes ?? (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < 5 || durationMinutes > 480) {
    throw new BookingError('Meeting duration must be between 5 minutes and 8 hours.');
  }

  // Re-check against already-confirmed bookings (server is the source of truth).
  const snap = await bookingsCol(req.hostId).where('status', '==', 'confirmed').get();
  const existing = snap.docs.map((d) => d.data() as BookingDoc);

  const sMs = start.getTime();
  const eMs = end.getTime();
  const tag = (req.tag || '').toLowerCase();

  let sameTagSameDay = 0;
  for (const b of existing) {
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    if (overlaps(sMs, eMs, bStart.getTime(), bEnd.getTime())) {
      throw new BookingError('That time slot is no longer available.', 409);
    }
    if (
      req.constraints?.singleBookingPerGuest &&
      b.guestEmail.toLowerCase() === req.guestEmail.toLowerCase()
    ) {
      throw new BookingError('You already have an active meeting booked with this host.', 409);
    }
    if (tag && b.tag.toLowerCase() === tag && isSameDay(bStart, start)) {
      sameTagSameDay++;
    }
  }

  const maxPerDay = req.constraints?.maxPerDayForTag;
  if (typeof maxPerDay === 'number' && maxPerDay > 0 && sameTagSameDay >= maxPerDay) {
    throw new BookingError('This host has reached their daily limit for this meeting type.', 409);
  }
}

/** Persist a confirmed booking under the host, using the Admin SDK. */
export async function persistBooking(req: BookingRequest): Promise<BookingDoc> {
  const now = new Date().toISOString();
  const id = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const start = new Date(req.startTime);
  const end = new Date(req.endTime);

  const booking: BookingDoc = {
    id,
    hostId: req.hostId,
    guestEmail: req.guestEmail,
    guestName: req.guestName,
    guestUid: req.guestUid || `guest_${Math.random().toString(36).substring(2, 9)}`,
    meetingTypeId: req.meetingTypeId || '',
    meetingTitle: req.meetingTitle || 'Meeting',
    tag: req.tag || 'general',
    startTime: req.startTime,
    endTime: req.endTime,
    durationMinutes: req.durationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60000),
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
  if (req.notes) booking.notes = req.notes;

  await bookingsCol(req.hostId).doc(id).set(booking);
  return booking;
}

/** Attach the Google Calendar event details to a stored booking. */
export async function attachCalendarDetails(
  hostId: string,
  bookingId: string,
  details: { googleEventId?: string; googleMeetLink?: string }
): Promise<void> {
  const patch: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (details.googleEventId) patch.googleEventId = details.googleEventId;
  if (details.googleMeetLink) patch.googleMeetLink = details.googleMeetLink;
  await bookingsCol(hostId).doc(bookingId).update(patch);
}

export interface HostCalendarCreds {
  refreshToken: string;
  email?: string;
}

/** Read the host's stored offline Google Calendar credentials (admin-only path). */
export async function getHostCalendarCreds(hostId: string): Promise<HostCalendarCreds | null> {
  const doc = await db
    .collection('users')
    .doc(hostId)
    .collection('private')
    .doc('googleCalendar')
    .get();
  if (!doc.exists) return null;
  const data = doc.data() as { refreshToken?: string; email?: string } | undefined;
  if (!data?.refreshToken) return null;
  return { refreshToken: data.refreshToken, email: data.email };
}

/** Store (or replace) the host's offline Google Calendar credentials. */
export async function saveHostCalendarCreds(
  hostId: string,
  creds: { refreshToken: string; email?: string }
): Promise<void> {
  await db
    .collection('users')
    .doc(hostId)
    .collection('private')
    .doc('googleCalendar')
    .set(
      {
        refreshToken: creds.refreshToken,
        email: creds.email || '',
        connectedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}
