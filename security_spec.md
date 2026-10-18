# Security Specification & Threat Model for ScheduleFlow

## Data Invariants
1. A user can only write and modify their own `/users/{userId}` profile and `/users/{userId}/settings/general`.
2. Meeting types in `/users/{userId}/meetingTypes/{typeId}` can only be created, modified, or deleted by the host (`request.auth.uid == userId`). Public users who are signed in may read active meeting types.
3. A booking in `/users/{userId}/bookings/{bookingId}` can be created by a verified Google user (`request.auth != null && request.auth.token.email_verified == true`).
4. The `guestUid` on created booking must strictly equal `request.auth.uid` to prevent identity spoofing.
5. The `hostId` must equal `{userId}`.
6. The booking duration must be between 5 minutes and 480 minutes (8 hours maximum).
7. Only the host or the verified guest can read the booking record.
8. Only the host or the verified guest can cancel the booking (`status: 'cancelled'`).
9. Document IDs must be alphanumeric strings <= 128 characters (`isValidId`).

## Dirty Dozen Attack Payloads
1. **User Profile Hijack**: Authenticated User B attempts to write or overwrite `/users/UserA`. (Expected: PERMISSION_DENIED)
2. **Ghost Field Injection**: User A adds `{ isAdmin: true, shadowRole: "superadmin" }` to their profile. (Expected: PERMISSION_DENIED)
3. **Meeting Type Tampering**: User B creates or edits a meeting type inside `/users/UserA/meetingTypes/mt1`. (Expected: PERMISSION_DENIED)
4. **Duration Overflow Attack**: Booking created with `durationMinutes: 9999` (exceeding 8-hour maximum of 480m). (Expected: PERMISSION_DENIED)
5. **Guest Impersonation**: Attacker with UID `evil_user` creates a booking on `/users/HostA/bookings/b1` with `guestUid: "innocent_user"`. (Expected: PERMISSION_DENIED)
6. **Cross-Tenant Booking Creation**: Host ID mismatch where `incoming().hostId != userId`. (Expected: PERMISSION_DENIED)
7. **Unverified Email Booking**: Unauthenticated or unverified caller tries to insert a booking. (Expected: PERMISSION_DENIED)
8. **Malicious Path Traversal / ID Poisoning**: Document ID containing 2KB junk or `/../` characters. (Expected: PERMISSION_DENIED)
9. **Settings Overwrite by Guest**: Guest attempts to disable `singleBookingPerGuest` in `/users/HostA/settings/general`. (Expected: PERMISSION_DENIED)
10. **State Corruption by Stranger**: Random User C attempts to cancel Host A's booking with Guest B. (Expected: PERMISSION_DENIED)
11. **Negative Duration Exploit**: Booking with `durationMinutes: -30` or `durationMinutes: 0`. (Expected: PERMISSION_DENIED)
12. **Blanket Query Scraping**: Malicious user attempts `collectionGroup('bookings')` without restricting to their own `guestUid` or `hostId`. (Expected: PERMISSION_DENIED)
