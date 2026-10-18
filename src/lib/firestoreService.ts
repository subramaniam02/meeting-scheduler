import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  getDocFromServer,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  UserProfile,
  HostSettings,
  MeetingType,
  Booking,
  WeeklySchedule,
  TagConstraint
} from '../types';

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '16:00' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
};

export const DEFAULT_TAG_CONSTRAINTS: Record<string, TagConstraint> = {
  interview: {
    tag: 'interview',
    label: 'Interview Meetings',
    maxPerDay: 2, // Explicit user requirement: "No more than 2 interview meetings a day"
    bufferMinutes: 20, // 20m buffer between interviews
    allowedStartHour: 9,
    allowedEndHour: 17,
    color: '#6366F1', // Indigo
  },
  screening: {
    tag: 'screening',
    label: 'Initial Screening',
    maxPerDay: 4,
    bufferMinutes: 15,
    allowedStartHour: 10,
    allowedEndHour: 16,
    color: '#10B981', // Emerald
  },
  consultation: {
    tag: 'consultation',
    label: 'Advisory & Strategy',
    maxPerDay: 3,
    bufferMinutes: 15,
    allowedStartHour: 9,
    allowedEndHour: 18,
    color: '#F59E0B', // Amber
  },
};

/**
 * Validate connection to Firestore on boot (Required by skill)
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Attempting a server read to verify connectivity
    await getDocFromServer(doc(db, 'system', 'connection-check'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
      return false;
    }
    // A permission denied on system check is normal if doc doesn't exist, but confirms connectivity
    return true;
  }
}

/**
 * Get or initialize user profile
 */
export async function getOrCreateUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Default handle from email or uid
    const baseHandle = user.email
      ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : user.uid.substring(0, 8);

    const newProfile: UserProfile = {
      id: user.uid,
      email: user.email || 'user@example.com',
      displayName: user.displayName || user.email?.split('@')[0] || 'Host',
      handle: baseHandle,
      photoURL: user.photoURL || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      bio: 'Welcome to my scheduling page. Select an available slot to book a call with me.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

/**
 * Get or initialize host settings
 */
export async function getOrCreateHostSettings(userId: string): Promise<HostSettings> {
  const settingsRef = doc(db, 'users', userId, 'settings', 'general');
  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data() as HostSettings;
    }

    const defaultSettings: HostSettings = {
      userId,
      singleBookingPerGuest: true, // User Requirement: "dont let a single use to block more than 1 slot"
      maxMeetingDurationMinutes: 480, // User Requirement: "max duration of a meeting can be 8 hours"
      defaultBufferMinutes: 15,
      tagConstraints: DEFAULT_TAG_CONSTRAINTS,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(settingsRef, defaultSettings);
    return defaultSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/settings/general`);
  }
}

/**
 * Save host settings
 */
export async function updateHostSettings(userId: string, settings: Partial<HostSettings>): Promise<void> {
  const settingsRef = doc(db, 'users', userId, 'settings', 'general');
  try {
    await setDoc(settingsRef, {
      ...settings,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/settings/general`);
  }
}

/**
 * List meeting types for a host
 */
export async function listMeetingTypes(userId: string): Promise<MeetingType[]> {
  const colRef = collection(db, 'users', userId, 'meetingTypes');
  try {
    const snap = await getDocs(colRef);
    if (snap.empty) {
      // Seed initial default meeting types for host
      const initialTypes: MeetingType[] = [
        {
          id: 'interview-tech-60',
          userId,
          title: 'Technical Interview',
          description: 'In-depth coding, architecture, and system design review. (Max 2/day constraint)',
          durationMinutes: 60,
          tag: 'interview',
          color: '#6366F1',
          isActive: true,
          requiresGoogleLogin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'screening-call-30',
          userId,
          title: 'Quick Screening Call',
          description: 'Initial introduction, role overview, and Q&A.',
          durationMinutes: 30,
          tag: 'screening',
          color: '#10B981',
          isActive: true,
          requiresGoogleLogin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'workshop-halfday-240',
          userId,
          title: 'Deep-Dive Workshop (Half Day)',
          description: 'Comprehensive 4-hour hands-on session or pair programming.',
          durationMinutes: 240,
          tag: 'interview',
          color: '#8B5CF6',
          isActive: true,
          requiresGoogleLogin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'onsite-fullday-480',
          userId,
          title: 'Full-Day Assessment (8 Hours)',
          description: 'Full-day evaluation or sprint pairing (maximum allowed 8 hour duration).',
          durationMinutes: 480,
          tag: 'interview',
          color: '#EC4899',
          isActive: true,
          requiresGoogleLogin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      for (const t of initialTypes) {
        await setDoc(doc(db, 'users', userId, 'meetingTypes', t.id), t);
      }
      return initialTypes;
    }

    return snap.docs.map((d) => d.data() as MeetingType);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/meetingTypes`);
  }
}

/**
 * Save or update a meeting type
 */
export async function saveMeetingType(userId: string, meetingType: MeetingType): Promise<void> {
  const docRef = doc(db, 'users', userId, 'meetingTypes', meetingType.id);
  try {
    await setDoc(docRef, {
      ...meetingType,
      userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/meetingTypes/${meetingType.id}`);
  }
}

/**
 * Delete a meeting type
 */
export async function deleteMeetingType(userId: string, typeId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'meetingTypes', typeId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/meetingTypes/${typeId}`);
  }
}

/**
 * Fetch all bookings for a host
 */
export async function listHostBookings(userId: string): Promise<Booking[]> {
  const colRef = collection(db, 'users', userId, 'bookings');
  try {
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as Booking);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/bookings`);
  }
}

/**
 * Fetch guest's bookings for a specific host
 */
export async function listGuestBookingsForHost(hostId: string, guestUid: string): Promise<Booking[]> {
  const colRef = collection(db, 'users', hostId, 'bookings');
  try {
    const q = query(colRef, where('guestUid', '==', guestUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Booking);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${hostId}/bookings`);
  }
}

/**
 * Create a new booking
 */
export async function createBooking(hostId: string, booking: Booking): Promise<void> {
  const docRef = doc(db, 'users', hostId, 'bookings', booking.id);
  try {
    await setDoc(docRef, booking);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${hostId}/bookings/${booking.id}`);
  }
}

/**
 * Update booking status (e.g. cancel)
 */
export async function updateBookingStatus(
  hostId: string,
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'rescheduled',
  notes?: string
): Promise<void> {
  const docRef = doc(db, 'users', hostId, 'bookings', bookingId);
  try {
    const payload: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (notes !== undefined) {
      payload.notes = notes;
    }
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${hostId}/bookings/${bookingId}`);
  }
}
