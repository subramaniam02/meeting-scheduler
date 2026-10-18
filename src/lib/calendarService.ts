import type { CalendarCommitment } from '../types';

export interface CreateEventParams {
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  guestEmail: string;
  guestName: string;
  tag: string;
}

export interface GoogleCalendarEventResult {
  eventId: string;
  meetLink?: string;
  htmlLink?: string;
}

/**
 * Fetch existing calendar commitments from Google Calendar
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarCommitment[]> {
  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Google Calendar access token expired. Please re-authenticate.');
      }
      const errText = await res.text();
      console.warn('Google Calendar fetch warning:', res.status, errText);
      return [];
    }

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    const commitments: CalendarCommitment[] = [];

    for (const item of data.items) {
      if (item.status === 'cancelled') continue;
      
      const startStr = item.start?.dateTime || item.start?.date;
      const endStr = item.end?.dateTime || item.end?.date;
      if (!startStr || !endStr) continue;

      const startDate = new Date(startStr);
      const endDate = new Date(endStr);

      // Check if event has a tag in summary or description
      const summary = (item.summary || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      let detectedTag: string | undefined = undefined;

      if (summary.includes('#interview') || summary.includes('[interview]') || summary.includes('interview')) {
        detectedTag = 'interview';
      }

      commitments.push({
        id: item.id || `evt-${Math.random()}`,
        title: item.summary || 'Busy Commitment',
        start: startDate,
        end: endDate,
        tag: detectedTag,
      });
    }

    return commitments;
  } catch (error) {
    console.error('Error querying Google Calendar:', error);
    throw error;
  }
}

/**
 * Create a new event on Google Calendar with Google Meet
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  params: CreateEventParams
): Promise<GoogleCalendarEventResult> {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';

  const body = {
    summary: `${params.title} - ${params.guestName}`,
    description: `${params.description}\n\n🏷️ Tag: #${params.tag}\n👤 Guest: ${params.guestName} (${params.guestEmail})\n⚡ Scheduled via ScheduleFlow`,
    start: {
      dateTime: params.startTime,
    },
    end: {
      dateTime: params.endTime,
    },
    attendees: [
      { email: params.guestEmail, displayName: params.guestName },
    ],
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: true,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Failed to create calendar event:', res.status, errText);
    throw new Error(`Google Calendar error: ${res.statusText}`);
  }

  const data = await res.json();
  const meetLink =
    data.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video')?.uri ||
    data.hangoutLink;

  return {
    eventId: data.id,
    meetLink: meetLink || undefined,
    htmlLink: data.htmlLink,
  };
}

/**
 * Remove or cancel an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok || res.status === 404; // 404 means already deleted
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}
