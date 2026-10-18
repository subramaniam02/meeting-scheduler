import type {
  HostSettings,
  MeetingType,
  Booking,
  CalendarCommitment,
  TimeSlot,
  TagConstraint
} from '../types';

export interface AvailabilityResult {
  slots: TimeSlot[];
  dayDisabled: boolean;
  disabledReason?: string;
  tagMeetingCountToday: number;
  tagDailyLimit?: number;
}

/**
 * Checks if a guest is allowed to book with this host based on the single-slot restriction
 */
export function checkGuestBookingEligibility(
  guestUid: string | null | undefined,
  guestEmail: string | null | undefined,
  existingBookings: Booking[],
  hostSettings: HostSettings
): { allowed: boolean; activeBooking?: Booking; reason?: string } {
  if (!hostSettings.singleBookingPerGuest) {
    return { allowed: true };
  }

  if (!guestUid && !guestEmail) {
    return { allowed: true };
  }

  const now = new Date();

  // Find any active upcoming confirmed booking for this guest
  const activeBooking = existingBookings.find((b) => {
    if (b.status !== 'confirmed') return false;
    const isSameGuest =
      (guestUid && b.guestUid === guestUid) ||
      (guestEmail && b.guestEmail.toLowerCase() === guestEmail.toLowerCase());
    if (!isSameGuest) return false;

    // Check if meeting is in the future
    const end = new Date(b.endTime);
    return end > now;
  });

  if (activeBooking) {
    return {
      allowed: false,
      activeBooking,
      reason: `You already have an active scheduled meeting ("${activeBooking.meetingTitle}") on ${new Date(
        activeBooking.startTime
      ).toLocaleDateString()} at ${new Date(activeBooking.startTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}. You can only hold 1 active booking at a time.`,
    };
  }

  return { allowed: true };
}

/**
 * Calculate the number of meetings on a given day that match a specific tag
 */
export function countTagMeetingsOnDate(
  date: Date,
  tag: string,
  bookings: Booking[],
  commitments: CalendarCommitment[]
): number {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();

  const isSameDay = (d: Date) =>
    d.getFullYear() === targetYear &&
    d.getMonth() === targetMonth &&
    d.getDate() === targetDay;

  const normalizedTag = tag.toLowerCase().trim();

  // Count confirmed ScheduleFlow bookings
  let count = bookings.filter((b) => {
    if (b.status !== 'confirmed') return false;
    if (b.tag.toLowerCase().trim() !== normalizedTag) return false;
    return isSameDay(new Date(b.startTime));
  }).length;

  // Also count any Google Calendar events that have this tag (e.g. #interview)
  for (const c of commitments) {
    if (c.tag && c.tag.toLowerCase().trim() === normalizedTag && isSameDay(c.start)) {
      count++;
    }
  }

  return count;
}

/**
 * Compute valid booking slots for a selected date, respecting Google Calendar busy times,
 * buffers, host weekly schedule, tag daily limit (e.g. max 2 interviews/day), and time-of-day restrictions.
 */
export function computeAvailableSlots(
  targetDate: Date,
  meetingType: MeetingType,
  hostSettings: HostSettings,
  existingBookings: Booking[],
  calendarCommitments: CalendarCommitment[]
): AvailabilityResult {
  const duration = Math.min(meetingType.durationMinutes, hostSettings.maxMeetingDurationMinutes || 480);
  const tag = meetingType.tag.toLowerCase().trim();
  const tagConstraint: TagConstraint | undefined = hostSettings.tagConstraints?.[tag];

  // 1. Check Tag Daily Limit Constraint (e.g., Max 2 interview meetings a day)
  const tagCountToday = countTagMeetingsOnDate(targetDate, tag, existingBookings, calendarCommitments);
  const maxPerDay = tagConstraint ? tagConstraint.maxPerDay : (tag === 'interview' ? 2 : 10);

  if (tagCountToday >= maxPerDay) {
    return {
      slots: [],
      dayDisabled: true,
      disabledReason: `Daily limit reached for ${tag} calls (${tagCountToday}/${maxPerDay} booked today).`,
      tagMeetingCountToday: tagCountToday,
      tagDailyLimit: maxPerDay,
    };
  }

  // 2. Identify day of week schedule
  const dayNames: (keyof typeof hostSettings.weeklySchedule)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const dayName = dayNames[targetDate.getDay()];
  const dayConfig = hostSettings.weeklySchedule[dayName];

  if (!dayConfig || !dayConfig.enabled || !dayConfig.slots || dayConfig.slots.length === 0) {
    return {
      slots: [],
      dayDisabled: true,
      disabledReason: 'Host is not available on this day of the week.',
      tagMeetingCountToday: tagCountToday,
      tagDailyLimit: maxPerDay,
    };
  }

  // 3. Collect all busy intervals for this day (Google Calendar + ScheduleFlow bookings)
  const bufferMinutes = tagConstraint?.bufferMinutes ?? hostSettings.defaultBufferMinutes ?? 15;
  const busyIntervals: { start: number; end: number }[] = [];

  // Add Google Calendar commitments - keep exact interval
  for (const c of calendarCommitments) {
    busyIntervals.push({
      start: c.start.getTime(),
      end: c.end.getTime(),
    });
  }

  // Add confirmed ScheduleFlow bookings - keep exact interval
  for (const b of existingBookings) {
    if (b.status === 'confirmed') {
      busyIntervals.push({
        start: new Date(b.startTime).getTime(),
        end: new Date(b.endTime).getTime(),
      });
    }
  }

  // 4. Generate candidate slots based on working hours and time-of-day restrictions
  const candidateSlots: TimeSlot[] = [];
  const now = new Date();
  const minNoticeMs = 2 * 60 * 60 * 1000; // 2 hours minimum notice

  const allowedStartHour = tagConstraint?.allowedStartHour ?? 0;
  const allowedEndHour = tagConstraint?.allowedEndHour ?? 24;

  for (const window of dayConfig.slots) {
    const [startHour, startMin] = window.start.split(':').map(Number);
    const [endHour, endMin] = window.end.split(':').map(Number);

    const windowStartTime = new Date(targetDate);
    windowStartTime.setHours(startHour, startMin, 0, 0);

    const windowEndTime = new Date(targetDate);
    windowEndTime.setHours(endHour, endMin, 0, 0);

    // Slot increment: 30 minutes for short calls, 60 minutes for calls >= 2 hours
    const stepMinutes = duration >= 120 ? 60 : 30;
    const durationMs = duration * 60 * 1000;

    let currentSlotStart = new Date(windowStartTime);

    while (currentSlotStart.getTime() + durationMs <= windowEndTime.getTime()) {
      const slotEnd = new Date(currentSlotStart.getTime() + durationMs);
      const slotHour = currentSlotStart.getHours() + currentSlotStart.getMinutes() / 60;

      let isAvailable = true;
      let reason = '';

      // Check minimum notice
      if (currentSlotStart.getTime() < now.getTime() + minNoticeMs) {
        isAvailable = false;
        reason = 'Past time or inside minimum notice window';
      }

      // Check time-of-day restrictions for this tag
      if (isAvailable && (slotHour < allowedStartHour || slotHour + duration / 60 > allowedEndHour)) {
        isAvailable = false;
        reason = `Restricted hours for ${tag} (Allowed: ${allowedStartHour}:00 - ${allowedEndHour}:00)`;
      }

      // Check overlap with Google Calendar or other bookings + buffer
      if (isAvailable) {
        const slotStartMs = currentSlotStart.getTime();
        const slotEndMs = slotEnd.getTime();
        
        for (const busy of busyIntervals) {
          // Direct overlap
          if (slotStartMs < busy.end && slotEndMs > busy.start) {
            isAvailable = false;
            reason = 'Conflicts with existing commitment';
            break;
          }
          // Buffer overlap (slot starts too close to busy end)
          if (slotStartMs < busy.end + bufferMinutes * 60 * 1000 && slotStartMs >= busy.end) {
            isAvailable = false;
            reason = 'Too close to previous commitment (buffer)';
            break;
          }
          // Buffer overlap (slot ends too close to busy start)
          if (slotEndMs > busy.start - bufferMinutes * 60 * 1000 && slotEndMs <= busy.start) {
            isAvailable = false;
            reason = 'Too close to next commitment (buffer)';
            break;
          }
        }
      }

      candidateSlots.push({
        start: new Date(currentSlotStart),
        end: slotEnd,
        available: isAvailable,
        reason: isAvailable ? undefined : reason,
      });

      // Advance
      currentSlotStart = new Date(currentSlotStart.getTime() + stepMinutes * 60 * 1000);
    }
  }

  const availableCount = candidateSlots.filter((s) => s.available).length;

  return {
    slots: candidateSlots,
    dayDisabled: availableCount === 0,
    disabledReason: availableCount === 0 ? 'No available slots remaining on this day.' : undefined,
    tagMeetingCountToday: tagCountToday,
    tagDailyLimit: maxPerDay,
  };
}
