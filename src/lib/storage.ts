import type { HostSettings, MeetingType, Booking, TagConstraint, WeeklySchedule } from '../types';

export const STORAGE_KEYS = {
  HOST_PROFILE: 'scheduleflow_host_profile',
  HOST_SETTINGS: 'scheduleflow_host_settings',
  MEETING_TYPES: 'scheduleflow_meeting_types',
  LOCAL_BOOKINGS: 'scheduleflow_local_bookings',
  GUEST_ACTIVE_BOOKINGS: 'scheduleflow_guest_bookings',
};

export const DEFAULT_TAG_CONSTRAINTS: Record<string, TagConstraint> = {
  interview: {
    tag: 'interview',
    label: 'Interview Meetings',
    maxPerDay: 2, // Explicit requirement: "No more than 2 interview meetings a day"
    bufferMinutes: 20,
    allowedStartHour: 9,
    allowedEndHour: 17,
    color: '#6366F1',
  },
  screening: {
    tag: 'screening',
    label: 'Quick Screening',
    maxPerDay: 4,
    bufferMinutes: 15,
    allowedStartHour: 10,
    allowedEndHour: 16,
    color: '#10B981',
  },
  consultation: {
    tag: 'consultation',
    label: 'Advisory & Strategy',
    maxPerDay: 3,
    bufferMinutes: 15,
    allowedStartHour: 9,
    allowedEndHour: 18,
    color: '#F59E0B',
  },
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '16:00' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
};

export interface LocalHostProfile {
  id: string;
  displayName: string;
  email: string;
  timezone: string;
  bio: string;
  photoURL?: string;
}

export function getLocalHostProfile(): LocalHostProfile {
  const stored = localStorage.getItem(STORAGE_KEYS.HOST_PROFILE);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }

  const defaultProfile: LocalHostProfile = {
    id: `host_${Math.random().toString(36).substring(2, 9)}`,
    displayName: 'My Availability',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    bio: 'Select a time slot to book a call with me.',
  };
  localStorage.setItem(STORAGE_KEYS.HOST_PROFILE, JSON.stringify(defaultProfile));
  return defaultProfile;
}

export function saveLocalHostProfile(profile: LocalHostProfile): void {
  localStorage.setItem(STORAGE_KEYS.HOST_PROFILE, JSON.stringify(profile));
}

export function getLocalHostSettings(): HostSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.HOST_SETTINGS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }

  const defaultSettings: HostSettings = {
    userId: 'local_host',
    singleBookingPerGuest: true, // Constraint 5: don't let a single user block more than 1 slot
    maxMeetingDurationMinutes: 480, // Constraint 5: max duration up to 8 hours
    defaultBufferMinutes: 15,
    tagConstraints: DEFAULT_TAG_CONSTRAINTS,
    weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.HOST_SETTINGS, JSON.stringify(defaultSettings));
  return defaultSettings;
}

export function saveLocalHostSettings(settings: HostSettings): void {
  localStorage.setItem(STORAGE_KEYS.HOST_SETTINGS, JSON.stringify(settings));
}

export function getLocalMeetingTypes(): MeetingType[] {
  const stored = localStorage.getItem(STORAGE_KEYS.MEETING_TYPES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }

  const defaultTypes: MeetingType[] = [
    {
      id: 'type-interview-60',
      userId: 'local_host',
      title: 'Technical Interview',
      description: 'In-depth interview session. Max 2 meetings per day constraint strictly enforced.',
      durationMinutes: 60,
      tag: 'interview',
      color: '#6366F1',
      isActive: true,
      requiresGoogleLogin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'type-screening-30',
      userId: 'local_host',
      title: 'Quick Screening Call',
      description: 'Introductory conversation and mutual fit evaluation.',
      durationMinutes: 30,
      tag: 'screening',
      color: '#10B981',
      isActive: true,
      requiresGoogleLogin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'type-workshop-240',
      userId: 'local_host',
      title: 'Deep-Dive Workshop (Half Day)',
      description: '4-hour paired coding, architecture review, or deep-dive work session.',
      durationMinutes: 240,
      tag: 'interview',
      color: '#8B5CF6',
      isActive: true,
      requiresGoogleLogin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'type-fullday-480',
      userId: 'local_host',
      title: 'Full-Day Session (8 Hours Max)',
      description: 'Full 8-hour maximum duration evaluation or onsite project day.',
      durationMinutes: 480,
      tag: 'interview',
      color: '#EC4899',
      isActive: true,
      requiresGoogleLogin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  localStorage.setItem(STORAGE_KEYS.MEETING_TYPES, JSON.stringify(defaultTypes));
  return defaultTypes;
}

export function saveLocalMeetingTypes(types: MeetingType[]): void {
  localStorage.setItem(STORAGE_KEYS.MEETING_TYPES, JSON.stringify(types));
}

export function getLocalBookings(): Booking[] {
  const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_BOOKINGS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }
  return [];
}

export function saveLocalBooking(booking: Booking): void {
  const current = getLocalBookings();
  current.push(booking);
  localStorage.setItem(STORAGE_KEYS.LOCAL_BOOKINGS, JSON.stringify(current));
}

export function updateLocalBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'rescheduled'): void {
  const current = getLocalBookings();
  const updated = current.map((b) => (b.id === bookingId ? { ...b, status, updatedAt: new Date().toISOString() } : b));
  localStorage.setItem(STORAGE_KEYS.LOCAL_BOOKINGS, JSON.stringify(updated));
}

/**
 * Encode host configuration into a self-contained, shareable URL string
 * (Zero database or login maintained by the app creator!)
 */
export function encodeShareableSchedule(
  profile: LocalHostProfile,
  settings: HostSettings,
  meetingTypes: MeetingType[],
  commitments: { start: string; end: string; tag?: string }[] = [],
  hostUid?: string
): string {
  const payload = {
    p: {
      n: profile.displayName,
      e: profile.email,
      z: profile.timezone,
      b: profile.bio,
      // Firebase UID of the host, so the backend can locate their calendar
      // credentials and send invites when a guest books via this link.
      uid: hostUid || '',
    },
    s: {
      s: settings.singleBookingPerGuest,
      m: settings.maxMeetingDurationMinutes,
      b: settings.defaultBufferMinutes,
      t: settings.tagConstraints,
      w: settings.weeklySchedule,
    },
    t: meetingTypes.filter((t) => t.isActive).map((t) => ({
      id: t.id,
      t: t.title,
      d: t.description,
      m: t.durationMinutes,
      g: t.tag,
      c: t.color,
    })),
    // Include busy time ranges so guest client checks commitments directly
    c: commitments.slice(0, 50),
  };

  try {
    const json = JSON.stringify(payload);
    // Base64 encode for URL hash
    return btoa(unescape(encodeURIComponent(json)));
  } catch (err) {
    console.error('Error encoding shareable schedule:', err);
    return '';
  }
}

/**
 * Decode host configuration from shareable URL string
 */
export function decodeShareableSchedule(encoded: string): {
  profile: LocalHostProfile;
  settings: HostSettings;
  meetingTypes: MeetingType[];
  commitments: { start: string; end: string; tag?: string }[];
} | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(json);

    const profile: LocalHostProfile = {
      // Prefer the host's real Firebase UID (needed for backend invites);
      // fall back to a placeholder for legacy links.
      id: payload.p?.uid || 'shared_host',
      displayName: payload.p?.n || 'Host',
      email: payload.p?.e || '',
      timezone: payload.p?.z || 'UTC',
      bio: payload.p?.b || '',
    };

    const settings: HostSettings = {
      userId: 'shared_host',
      singleBookingPerGuest: payload.s?.s ?? true,
      maxMeetingDurationMinutes: payload.s?.m ?? 480,
      defaultBufferMinutes: payload.s?.b ?? 15,
      tagConstraints: payload.s?.t ?? DEFAULT_TAG_CONSTRAINTS,
      weeklySchedule: payload.s?.w ?? DEFAULT_WEEKLY_SCHEDULE,
      updatedAt: new Date().toISOString(),
    };

    const meetingTypes: MeetingType[] = (payload.t || []).map((t: any) => ({
      id: t.id || `mt-${Math.random()}`,
      userId: 'shared_host',
      title: t.t,
      description: t.d || '',
      durationMinutes: t.m || 60,
      tag: t.g || 'interview',
      color: t.c || '#6366F1',
      isActive: true,
      requiresGoogleLogin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return {
      profile,
      settings,
      meetingTypes,
      commitments: payload.c || [],
    };
  } catch (err) {
    console.error('Error decoding shareable schedule:', err);
    return null;
  }
}
