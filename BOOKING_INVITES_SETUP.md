# Email & Calendar Invites — Setup (Option A: backend)

Previously, bookings made on a host's public link were saved only in the
**guest's browser** and never reached the host, and no calendar event or email
invite was ever sent. This change adds a backend (`server.ts`) that:

1. Lets a host **connect their Google Calendar once** (offline access).
2. **Persists every booking** under the host in Firestore (Admin SDK).
3. On each booking, **creates the event on the host's calendar and emails a
   calendar invite to both the host and the guest** (Google Calendar API with
   `sendUpdates: 'all'`).

The app still works without the backend (preview/local fallback), but **invites
are only sent once the steps below are complete and a host connects their
calendar.**

## How it works

```
Guest books (public link)
      │  POST /api/bookings   (hostId travels in the share link)
      ▼
server.ts ──► Firestore: users/{hostId}/bookings/{id}        (persist)
      │
      └──► host's stored refresh token ──► Google Calendar API
                 events.insert(sendUpdates:'all', attendees:[host,guest])
                        │
                        ▼
             Google emails the calendar invite to host + guest ✅
```

The host's refresh token is stored at `users/{hostId}/private/googleCalendar`,
which **no client can read** (Firestore rules deny it; only the Admin SDK on the
server can access it).

## One-time setup (you must do these)

### 1. OAuth consent + Web client
In Google Cloud Console for project `gen-lang-client-0204838209`:

- **APIs & Services → Library**: enable **Google Calendar API**.
- **OAuth consent screen**: add the scope
  `https://www.googleapis.com/auth/calendar.events`. While in "Testing", add
  host Google accounts as test users (or publish the app).
- **Credentials → the OAuth 2.0 Web client** (the one in
  `firebase-applet-config.json → oAuthClientId`): under **Authorized redirect
  URIs** add:
  ```
  https://YOUR_APP_URL/api/google/callback
  ```
  Use your real deployed `APP_URL` (and `http://localhost:3000/api/google/callback`
  for local testing). Copy the client **secret**.

### 2. Server secret
Set the client secret in the AI Studio / Cloud Run **Secrets** panel (do not
commit it):

```
GOOGLE_OAUTH_CLIENT_SECRET = <the Web client's secret>
```

Optional: `OAUTH_STATE_SIGNING_KEY` = any random string (recommended).

`APP_URL` is injected automatically on Cloud Run; set it locally if testing.

### 3. Deploy so the server runs
The backend is an Express server. Production serves the built SPA **and** the
API from one process:

```
bun run build     # produces dist/
bun run start     # tsx server.ts  (serves dist/ + /api/*, uses $PORT)
```

On Cloud Run, make the container run `bun run start` (or `tsx server.ts`) after
the build. Firebase Admin uses the service account's Application Default
Credentials automatically — no key file needed. (Locally, point
`GOOGLE_APPLICATION_CREDENTIALS` at a service-account JSON.)

### 4. Deploy the Firestore rules
`firestore.rules` now explicitly denies all client access to the
`users/{uid}/private/**` path. Deploy the rules so this is enforced.

## Host usage

1. Host signs in and clicks **Connect Calendar** (amber banner on the
   dashboard). They approve offline calendar access once.
2. Host shares their booking link (the link now embeds their UID).
3. When a guest books, both host and guest receive a Google Calendar invite
   email with a Meet link, and the booking appears on the host dashboard.

## Notes & possible hardening

- Server-side validation enforces hard caps (no past slots, 5–480 min, no
  overlapping confirmed bookings). Per-guest and per-day-tag limits use values
  sent by the client; moving host settings into Firestore would let the server
  enforce them authoritatively.
- Anti-abuse: `/api/bookings` is currently open (constraint-gated). Consider
  Firebase App Check or a server-verified captcha token before going public.
- If a host hasn't connected their calendar, the booking is still saved and the
  guest sees "add to calendar" buttons, but no invite email is sent.
