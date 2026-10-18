import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import { config, isCalendarConfigured } from './server/config.js';
import { adminAuth } from './server/firebaseAdmin.js';
import {
  buildConsentUrl,
  verifyState,
  exchangeCodeForTokens,
  createHostCalendarEvent,
} from './server/google.js';
import {
  validateBooking,
  persistBooking,
  attachCalendarDetails,
  getHostCalendarCreds,
  saveHostCalendarCreds,
  BookingError,
  type BookingRequest,
} from './server/bookings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '64kb' }));

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Resolve a verified Firebase UID from an ID token passed by the client. */
async function uidFromIdToken(idToken: unknown): Promise<string | null> {
  if (typeof idToken !== 'string' || !idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, calendarConfigured: isCalendarConfigured() });
});

/** Whether the authenticated host has connected their calendar for invites. */
app.get(
  '/api/google/status',
  asyncHandler(async (req, res) => {
    const uid = await uidFromIdToken(req.query.idToken);
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const creds = await getHostCalendarCreds(uid);
    res.json({ connected: Boolean(creds), configured: isCalendarConfigured() });
  })
);

/** Start the offline OAuth consent flow for the authenticated host. */
app.get(
  '/api/google/connect',
  asyncHandler(async (req, res) => {
    if (!isCalendarConfigured()) {
      res.status(500).send('Google Calendar is not configured on the server.');
      return;
    }
    const uid = await uidFromIdToken(req.query.idToken);
    if (!uid) {
      res.status(401).send('Sign in before connecting your calendar.');
      return;
    }
    res.redirect(buildConsentUrl(uid));
  })
);

/** OAuth redirect target: exchange the code and store the refresh token. */
app.get(
  '/api/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      res.redirect(`${config.appUrl}/#calendar=denied`);
      return;
    }
    const verified = typeof state === 'string' ? verifyState(state) : null;
    if (!verified || typeof code !== 'string') {
      res.redirect(`${config.appUrl}/#calendar=error`);
      return;
    }
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      // No refresh token means we cannot act offline later.
      res.redirect(`${config.appUrl}/#calendar=norefresh`);
      return;
    }
    await saveHostCalendarCreds(verified.uid, {
      refreshToken: tokens.refreshToken,
      email: tokens.email,
    });
    res.redirect(`${config.appUrl}/#calendar=connected`);
  })
);

/**
 * Create a booking. Persists it under the host and, if the host has
 * connected their calendar, creates the event + sends invite emails to
 * both parties via Google (sendUpdates: 'all').
 */
app.post(
  '/api/bookings',
  asyncHandler(async (req, res) => {
    const body = req.body as BookingRequest;

    // If the guest is signed in, trust their verified UID over the body.
    const guestUid = (await uidFromIdToken((req.body as { idToken?: string }).idToken)) || body.guestUid;

    const bookingReq: BookingRequest = { ...body, guestUid };

    await validateBooking(bookingReq);
    const booking = await persistBooking(bookingReq);

    let invitesSent = false;
    let meetLink: string | undefined;
    const creds = await getHostCalendarCreds(bookingReq.hostId);
    if (creds) {
      try {
        const event = await createHostCalendarEvent(creds.refreshToken, {
          title: booking.meetingTitle,
          description: bookingReq.description || booking.meetingTitle,
          startTime: booking.startTime,
          endTime: booking.endTime,
          hostEmail: bookingReq.hostEmail || creds.email,
          guestEmail: booking.guestEmail,
          guestName: booking.guestName,
          tag: booking.tag,
        });
        await attachCalendarDetails(bookingReq.hostId, booking.id, {
          googleEventId: event.eventId,
          googleMeetLink: event.meetLink,
        });
        booking.googleEventId = event.eventId;
        booking.googleMeetLink = event.meetLink;
        meetLink = event.meetLink;
        invitesSent = true;
      } catch (err) {
        // Booking is saved; surface that invites could not be sent.
        console.error('Calendar invite failed:', err);
      }
    }

    res.json({ booking, invitesSent, meetLink, hostConnected: Boolean(creds) });
  })
);

// API 404s should not fall through to the SPA.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Serve the built SPA and fall back to index.html for client-side routing.
const distDir = path.resolve(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// Centralized error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BookingError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`ScheduleFlow server listening on port ${config.port}`);
  if (!isCalendarConfigured()) {
    console.warn(
      'WARNING: GOOGLE_OAUTH_CLIENT_SECRET is not set — calendar invites are disabled until it is configured.'
    );
  }
});
