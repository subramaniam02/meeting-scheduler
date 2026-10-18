# ScheduleFlow

ScheduleFlow is a multi-user SaaS scheduling application that allows users to create personalized booking pages, sync with their Google Calendar to prevent double-booking, and define custom constraints for interview meetings.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed in the initial clarification phase:
> - **Authentication**: Google Account Login required for all users (hosts and guests).
> - **Platform Type**: Multi-user SaaS (users create their own personalized scheduling pages).
> - **Constraint Priorities**: Initial implementation will focus on daily meeting limits (e.g., 2 per day), time buffers between meetings, and time-of-day restrictions.

### 1. Overview & Core Concept

- **What It Does**: Enables professional scheduling by syncing with Google Calendar, enforcing constraints, and managing bookings for multiple users.
- **Target Audience**: Professionals, interviewers, and consultants.
- **Key Value**: Eliminates scheduling conflicts, automates availability management, and provides a polished, user-hosted booking experience.

### 2. User Experience & Visual Design

- **Key User Flows**:
    1. **Onboarding**: User signs in with Google, connects their Google Calendar via OAuth, and configures their initial booking page (e.g., meeting duration, tag-based constraints).
    2. **Dashboard**: User manages their availability, views upcoming bookings, and updates meeting settings.
    3. **Public Booking**: Guest visits the user's public URL, selects an available slot based on host constraints (and Google Calendar busy times), and books the meeting.
- **Visual Identity & Theme**:
    - *Aesthetic Direction*: Minimalist, clean, and utilitarian professional tool.
    - *Color Palette*: Slate/neutral background, vibrant primary accent (e.g., indigo or blue) for action buttons and calendar highlights.
    - *Typography*: Sans-serif, highly legible (e.g., Inter or Geist).
- **Interactive Feedback & Motion**: Subtle hover states for calendar slots, smooth transitions between steps in the booking flow, loading indicators for API calls (Calendar sync, booking creation).

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Authentication & SaaS Architecture**
    - *Chosen Approach*: Firebase Auth (Google) + Firestore for data isolation.
    - *Why*: Provides secure, robust user management and data isolation out-of-the-box, essential for a multi-user SaaS.
- **Decision 2: Calendar Integration**
    - *Chosen Approach*: Google Calendar OAuth API.
    - *Why*: Essential to meet the requirement of syncing existing commitments to block unavailable times.

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────┐      ┌───────────────────────────┐
│   Frontend (React)  │◄────►│  Firebase (Auth/DB)       │
└──────────┬──────────┘      └─────────────┬─────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐      ┌───────────────────────────┐
│ Google Calendar API │◄────►│  Google OAuth (Client)    │
└─────────────────────┘      └───────────────────────────┘
```

- **Data Model**:
    - `Users`: { userId, email, calendarId, ... }
    - `Availabilities`: { userId, tag, dailyMeetingLimit, bufferMinutes, timeOfDayRestrictions, ... }
    - `Bookings`: { bookingId, userId, guestEmail, startTime, endTime, status, ... }
- **Constraints Engine**: A server-side or secure client-side module will aggregate Google Calendar "busy" events with host-defined availability tags (buffers, daily limits) to calculate valid booking slots.
- **Key Sequences**:
    - *Availability Sync*: On dashboard load, fetch Calendar busy times and merge with constraints.
    - *Booking*: Validated against constraints before creation in Firestore and Calendar.
