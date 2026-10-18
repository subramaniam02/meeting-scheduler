import crypto from 'node:crypto';
import { google } from 'googleapis';
import { config, CALENDAR_SCOPE, OAUTH_REDIRECT_PATH } from './config.js';

export interface CalendarEventInput {
  title: string;
  description: string;
  startTime: string; // ISO
  endTime: string; // ISO
  hostEmail?: string;
  guestEmail: string;
  guestName: string;
  tag: string;
}

export interface CalendarEventResult {
  eventId: string;
  meetLink?: string;
  htmlLink?: string;
}

function redirectUri(): string {
  return `${config.appUrl}${OAUTH_REDIRECT_PATH}`;
}

function createOAuthClient() {
  return new google.auth.OAuth2(config.googleClientId, config.googleClientSecret, redirectUri());
}

/**
 * HMAC-sign a value so the OAuth `state` round-trip cannot be forged.
 * Format: <base64url(payload)>.<base64url(hmac)>
 */
export function signState(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, ts: Date.now() })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.stateSigningKey)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyState(state: string): { uid: string } | null {
  const [payload, sig] = (state || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac('sha256', config.stateSigningKey)
    .update(payload)
    .digest('base64url');
  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    // Reject states older than 15 minutes.
    if (typeof data.uid !== 'string' || Date.now() - data.ts > 15 * 60 * 1000) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

/**
 * Build the Google consent URL requesting OFFLINE access so we receive a
 * refresh token. `prompt=consent` forces Google to return a refresh token
 * even on repeat authorizations.
 */
export function buildConsentUrl(uid: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [CALENDAR_SCOPE],
    state: signState(uid),
    include_granted_scopes: true,
  });
}

/**
 * Exchange an authorization code for tokens. The refresh token is only
 * returned on the first consent (hence prompt=consent above).
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken?: string;
  accessToken?: string;
  email?: string;
}> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  let email: string | undefined;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.googleClientId,
    });
    email = ticket.getPayload()?.email || undefined;
  }
  return {
    refreshToken: tokens.refresh_token || undefined,
    accessToken: tokens.access_token || undefined,
    email,
  };
}

/**
 * Create an event on the host's primary calendar and invite the guest.
 * `sendUpdates: 'all'` is what makes Google email the calendar invitation
 * to the attendees — without it no invites are sent.
 */
export async function createHostCalendarEvent(
  refreshToken: string,
  input: CalendarEventInput
): Promise<CalendarEventResult> {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  const attendees: { email: string; displayName?: string; responseStatus?: string }[] = [
    { email: input.guestEmail, displayName: input.guestName },
  ];
  // Add the host explicitly so they also receive the invitation email.
  if (input.hostEmail) {
    attendees.push({ email: input.hostEmail, responseStatus: 'accepted' });
  }

  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: `${input.title} - ${input.guestName}`,
      description: `${input.description}\n\n🏷️ Tag: #${input.tag}\n👤 Guest: ${input.guestName} (${input.guestEmail})\n⚡ Scheduled via ScheduleFlow`,
      start: { dateTime: input.startTime },
      end: { dateTime: input.endTime },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: true },
    },
  });

  const data = res.data;
  const meetLink =
    data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ||
    data.hangoutLink ||
    undefined;

  return {
    eventId: data.id || '',
    meetLink: meetLink || undefined,
    htmlLink: data.htmlLink || undefined,
  };
}
