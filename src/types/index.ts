export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  handle?: string;
  photoURL?: string;
  timezone?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagConstraint {
  tag: string;
  label: string;
  maxPerDay: number; // e.g. 2 for interview
  bufferMinutes: number; // e.g. 15 mins before/after
  allowedStartHour?: number; // e.g. 9 (09:00)
  allowedEndHour?: number; // e.g. 17 (17:00)
  color?: string;
}

export interface DaySchedule {
  enabled: boolean;
  slots: { start: string; end: string }[]; // e.g. [{ start: "09:00", end: "17:00" }]
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface HostSettings {
  userId: string;
  singleBookingPerGuest: boolean; // Constraint 5: don't let a single user block more than 1 slot
  maxMeetingDurationMinutes: number; // Constraint 5: max duration up to 480 min (8 hours)
  defaultBufferMinutes: number;
  tagConstraints: Record<string, TagConstraint>;
  weeklySchedule: WeeklySchedule;
  updatedAt: string;
}

export interface MeetingType {
  id: string;
  userId: string;
  title: string;
  description: string;
  durationMinutes: number; // up to 480 (8 hours)
  tag: string; // e.g. "interview", "general", "consulting", "screening"
  color: string;
  isActive: boolean;
  requiresGoogleLogin: boolean; // default true
  multiDayAllowed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  hostId: string;
  guestEmail: string;
  guestName: string;
  guestUid: string;
  meetingTypeId: string;
  meetingTitle: string;
  tag: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  googleEventId?: string;
  googleMeetLink?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarCommitment {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isScheduleFlowBooking?: boolean;
  tag?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  reason?: string;
}
