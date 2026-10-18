import type { Booking } from '../types';

/**
 * Client for the ScheduleFlow backend (server.ts). Calls are same-origin,
 * so in production (Cloud Run serving the SPA + API) no base URL is needed.
 * During `vite dev` the API server is usually not running; callers should
 * treat a thrown error as "backend unavailable" and degrade gracefully.
 */

export interface SubmitBookingPayload {
  hostId: string;
  hostEmail?: string;
  hostName?: string;
  guestEmail: string;
  guestName: string;
  guestUid?: string;
  idToken?: string;
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

export interface SubmitBookingResult {
  booking: Booking;
  invitesSent: boolean;
  meetLink?: string;
  hostConnected: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function submitBooking(payload: SubmitBookingPayload): Promise<SubmitBookingResult> {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Booking failed (${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function getCalendarStatus(
  idToken: string
): Promise<{ connected: boolean; configured: boolean }> {
  try {
    const res = await fetch(`/api/google/status?idToken=${encodeURIComponent(idToken)}`);
    if (!res.ok) return { connected: false, configured: false };
    return await res.json();
  } catch {
    return { connected: false, configured: false };
  }
}

/** URL that starts the host's offline calendar-connect consent flow. */
export function calendarConnectUrl(idToken: string): string {
  return `/api/google/connect?idToken=${encodeURIComponent(idToken)}`;
}
