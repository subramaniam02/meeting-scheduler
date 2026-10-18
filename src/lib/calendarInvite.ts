export interface CalendarInviteDetails {
  title: string;
  description: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizerEmail?: string;
  organizerName?: string;
  guestEmail?: string;
  guestName?: string;
}

/**
 * Format date to iCalendar ISO format YYYYMMDDTHHMMSSZ
 */
function formatToIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate a 1-click Google Calendar Add Event URL
 */
export function getGoogleCalendarUrl(details: CalendarInviteDetails): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', details.title);
  url.searchParams.set('dates', `${formatToIcsDate(details.startTime)}/${formatToIcsDate(details.endTime)}`);
  url.searchParams.set('details', details.description);
  if (details.location) {
    url.searchParams.set('location', details.location);
  }
  if (details.guestEmail) {
    url.searchParams.set('add', details.guestEmail);
  }
  return url.toString();
}

/**
 * Generate and trigger download of an .ics calendar file
 */
export function downloadIcsFile(details: CalendarInviteDetails, filename = 'meeting.ics'): void {
  const startStr = formatToIcsDate(details.startTime);
  const endStr = formatToIcsDate(details.endTime);
  const nowStr = formatToIcsDate(new Date());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleFlow Open Source//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:scheduleflow-${Date.now()}@scheduleflow.local`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${details.title}`,
    `DESCRIPTION:${details.description.replace(/\n/g, '\\n')}`,
    details.location ? `LOCATION:${details.location}` : '',
    details.organizerEmail ? `ORGANIZER;CN=${details.organizerName || 'Host'}:mailto:${details.organizerEmail}` : '',
    details.guestEmail ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${details.guestName || 'Guest'}:mailto:${details.guestEmail}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
