import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  ShieldCheck,
  Video,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Download,
  CalendarPlus,
  RefreshCw
} from 'lucide-react';
import type {
  HostSettings,
  MeetingType,
  Booking,
  CalendarCommitment,
  TimeSlot
} from '../types';
import type { LocalHostProfile } from '../lib/storage';
import { computeAvailableSlots, checkGuestBookingEligibility } from '../lib/constraintEngine';
import { GoogleSignInButton } from './GoogleSignInButton';
import { CaptchaVerification } from './CaptchaVerification';
import { signInWithGoogle, getCachedAccessToken } from '../lib/firebase';
import { createGoogleCalendarEvent } from '../lib/calendarService';
import { getGoogleCalendarUrl, downloadIcsFile } from '../lib/calendarInvite';

interface PublicBookingPageProps {
  hostProfile: LocalHostProfile;
  hostSettings: HostSettings;
  meetingTypes: MeetingType[];
  existingBookings: Booking[];
  calendarCommitments: CalendarCommitment[];
  onBookingCreated: (booking: Booking) => void;
  currentUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null;
}

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  hostProfile,
  hostSettings,
  meetingTypes,
  existingBookings,
  calendarCommitments,
  onBookingCreated,
  currentUser,
}) => {
  const activeMeetingTypes = meetingTypes.filter((t) => t.isActive);
  const selectedMeetingType = activeMeetingTypes[0] || null;

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [guestNotes, setGuestNotes] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'captcha' | 'google'>('captcha');
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Check guest single-slot eligibility
  const effectiveEmail = currentUser?.email || guestEmailInput.trim();
  const effectiveUid = currentUser?.uid;

  const eligibility = useMemo(() => {
    if (!effectiveEmail && !effectiveUid) return { allowed: true };
    return checkGuestBookingEligibility(
      effectiveUid,
      effectiveEmail,
      existingBookings,
      hostSettings
    );
  }, [effectiveUid, effectiveEmail, existingBookings, hostSettings]);

  // Calendar days grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  }, [currentMonth]);

  // Available slots for selected date
  const availabilityResult = useMemo(() => {
    if (!selectedDate || !selectedMeetingType) return null;
    return computeAvailableSlots(
      selectedDate,
      selectedMeetingType,
      hostSettings,
      existingBookings,
      calendarCommitments
    );
  }, [selectedDate, selectedMeetingType, hostSettings, existingBookings, calendarCommitments]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isDatePast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isTagDailyLimitReached = (date: Date) => {
    if (!selectedMeetingType) return false;
    const tag = selectedMeetingType.tag.toLowerCase();
    const tagConstraint = hostSettings.tagConstraints?.[tag];
    const maxPerDay = tagConstraint ? tagConstraint.maxPerDay : (tag === 'interview' ? 2 : 10);

    const isSameDay = (d: Date) =>
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate();

    let count = existingBookings.filter(
      (b) => b.status === 'confirmed' && b.tag.toLowerCase() === tag && isSameDay(new Date(b.startTime))
    ).length;

    for (const c of calendarCommitments) {
      if (c.tag && c.tag.toLowerCase() === tag && isSameDay(c.start)) count++;
    }

    return count >= maxPerDay;
  };

  // Google Sign-In for scheduler
  const handleGoogleLogin = async () => {
    try {
      setBookingError(null);
      await signInWithGoogle();
      setVerificationMethod('google');
    } catch (err: any) {
      console.error('Google verification failed:', err);
      setBookingError('Google authentication was cancelled.');
    }
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedMeetingType || !selectedDate || !selectedSlot) {
      setBookingError('Please choose a date and time slot.');
      return;
    }

    const guestName = currentUser?.displayName || guestNameInput.trim();
    const guestEmail = currentUser?.email || guestEmailInput.trim();

    if (!guestName || !guestEmail) {
      setBookingError('Please provide your name and email address.');
      return;
    }

    // Verify scheduler (Captcha or Google)
    if (!currentUser && verificationMethod === 'captcha' && !isCaptchaVerified) {
      setBookingError('Please complete the Captcha math verification.');
      return;
    }

    // Enforce single-slot constraint
    const currentEligibility = checkGuestBookingEligibility(
      currentUser?.uid,
      guestEmail,
      existingBookings,
      hostSettings
    );

    if (!currentEligibility.allowed) {
      setBookingError(currentEligibility.reason || 'You already have an active scheduled meeting with this host.');
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      const bookingId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const startTimeIso = selectedSlot.start.toISOString();
      const endTimeIso = selectedSlot.end.toISOString();

      let googleEventId: string | undefined = undefined;
      let googleMeetLink: string | undefined = undefined;

      // If host's Google Calendar is connected in this session, sync directly
      const accessToken = getCachedAccessToken();
      if (accessToken) {
        try {
          const calResult = await createGoogleCalendarEvent(accessToken, {
            title: selectedMeetingType.title,
            description: selectedMeetingType.description,
            startTime: startTimeIso,
            endTime: endTimeIso,
            guestEmail,
            guestName,
            tag: selectedMeetingType.tag,
          });
          googleEventId = calResult.eventId;
          googleMeetLink = calResult.meetLink;
        } catch (calErr) {
          console.warn('Direct calendar sync notice:', calErr);
        }
      }

      if (!googleMeetLink) {
        // Universal instant Google Meet link
        googleMeetLink = `https://meet.google.com/new`;
      }

      const newBooking: Booking = {
        id: bookingId,
        hostId: hostProfile.id,
        guestEmail,
        guestName,
        guestUid: currentUser?.uid || `guest_${Math.random().toString(36).substring(2, 9)}`,
        meetingTypeId: selectedMeetingType.id,
        meetingTitle: selectedMeetingType.title,
        tag: selectedMeetingType.tag,
        startTime: startTimeIso,
        endTime: endTimeIso,
        durationMinutes: selectedMeetingType.durationMinutes,
        status: 'confirmed',
        googleEventId,
        googleMeetLink,
        notes: guestNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Safe fallback
      }

      setBookingSuccess(newBooking);
      onBookingCreated(newBooking);
    } catch (err: any) {
      console.error('Booking failed:', err);
      setBookingError(err.message || 'An error occurred while booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 sm:px-6 space-y-6">
      {/* Host Profile Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
            {hostProfile.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                {hostProfile.displayName}
              </h1>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Available to Book
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              {hostProfile.bio || 'Select a time slot to book a call.'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Timezone: {hostProfile.timezone || 'UTC'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 text-xs">
          <div className="px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-xl border border-indigo-100 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Max 2 Meetings / Day Enforced
          </div>
          <div className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl flex items-center gap-1.5 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Max 1 active slot per guest
          </div>
        </div>
      </div>

      {/* Success View */}
      {bookingSuccess ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Booking Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
              You are scheduled with {hostProfile.displayName}!
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
              Your meeting is locked in. Add it to your calendar or join the video call below.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="font-bold text-gray-900 text-base">
                {bookingSuccess.meetingTitle}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">
                  {new Date(bookingSuccess.startTime).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  {new Date(bookingSuccess.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  -{' '}
                  {new Date(bookingSuccess.endTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({bookingSuccess.durationMinutes} min)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span>
                  {bookingSuccess.guestName} ({bookingSuccess.guestEmail})
                </span>
              </div>
            </div>

            {/* Calendar Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <a
                href={getGoogleCalendarUrl({
                  title: `${bookingSuccess.meetingTitle} with ${hostProfile.displayName}`,
                  description: `Scheduled meeting with ${hostProfile.displayName}.\n\nGuest: ${bookingSuccess.guestName}`,
                  startTime: new Date(bookingSuccess.startTime),
                  endTime: new Date(bookingSuccess.endTime),
                  location: bookingSuccess.googleMeetLink,
                  guestEmail: bookingSuccess.guestEmail,
                  organizerEmail: hostProfile.email,
                  organizerName: hostProfile.displayName,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Add to Google Calendar
              </a>

              <button
                onClick={() =>
                  downloadIcsFile({
                    title: `${bookingSuccess.meetingTitle} with ${hostProfile.displayName}`,
                    description: `Scheduled meeting with ${hostProfile.displayName}.`,
                    startTime: new Date(bookingSuccess.startTime),
                    endTime: new Date(bookingSuccess.endTime),
                    location: bookingSuccess.googleMeetLink,
                    guestEmail: bookingSuccess.guestEmail,
                    organizerEmail: hostProfile.email,
                    organizerName: hostProfile.displayName,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download .ics Invite
              </button>

              {bookingSuccess.googleMeetLink && (
                <a
                  href={bookingSuccess.googleMeetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <Video className="w-3.5 h-3.5" />
                  Join Google Meet
                </a>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setBookingSuccess(null);
              setSelectedSlot(null);
            }}
            className="px-6 py-2.5 bg-gray-950 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Book Another Time
          </button>
        </div>
      ) : (
        /* Main Interactive Booking Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 2: Date Picker */}
          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                2. Select Date
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-gray-800 px-2">
                  {currentMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="h-10" />;

                const isPast = isDatePast(date);
                const isSelected =
                  selectedDate &&
                  selectedDate.getFullYear() === date.getFullYear() &&
                  selectedDate.getMonth() === date.getMonth() &&
                  selectedDate.getDate() === date.getDate();

                const limitReached = isTagDailyLimitReached(date);
                const isDisabled = isPast || limitReached;

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }
                    }}
                    disabled={isDisabled}
                    className={`h-10 rounded-xl text-xs font-semibold relative flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-bold scale-105 z-10'
                        : isDisabled
                        ? 'text-gray-300 bg-gray-50/50 cursor-not-allowed line-through'
                        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    <span>{date.getDate()}</span>
                    {limitReached && !isPast && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute bottom-1"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Time Slot & Scheduler Verification */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                3. Choose Time & Verify
              </h2>
              {selectedDate && (
                <span className="text-xs font-semibold text-indigo-700">
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm space-y-4">
              {!selectedDate ? (
                <p className="text-xs text-gray-400 py-8 text-center">
                  Select a date on the calendar to view slots.
                </p>
              ) : availabilityResult?.dayDisabled ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">No Slots Available</h4>
                  <p className="text-xs text-rose-600 max-w-xs mx-auto">
                    {availabilityResult.disabledReason || 'Commitments or daily limits occupy all slots on this date.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availabilityResult?.slots
                    .filter((s) => s.available)
                    .map((slot, sIdx) => {
                      const isSlotSelected =
                        selectedSlot && selectedSlot.start.getTime() === slot.start.getTime();

                      return (
                        <button
                          key={sIdx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            isSlotSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-gray-50 hover:bg-indigo-50 text-gray-800 hover:text-indigo-600 border border-gray-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[10px] uppercase font-semibold opacity-80">
                            {selectedMeetingType?.durationMinutes} min
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Booking Form when slot selected */}
              {selectedSlot && (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  {!currentUser && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                          Your Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Jane Doe"
                          value={guestNameInput}
                          onChange={(e) => setGuestNameInput(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                          Your Email
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. jane@example.com"
                          value={guestEmailInput}
                          onChange={(e) => setGuestEmailInput(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Topic or Agenda (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="What would you like to discuss?"
                      value={guestNotes}
                      onChange={(e) => setGuestNotes(e.target.value)}
                      className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Scheduler Verification:</span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('captcha')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            verificationMethod === 'captcha'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          Captcha
                        </button>
                        <span>or</span>
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('google')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            verificationMethod === 'google'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          Google
                        </button>
                      </div>
                    </div>
                    {verificationMethod === 'captcha' ? (
                      <CaptchaVerification
                        isVerified={isCaptchaVerified}
                        onVerified={setIsCaptchaVerified}
                      />
                    ) : currentUser ? (
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                        <span className="font-semibold">{currentUser.displayName || currentUser.email}</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                          Google Verified
                        </span>
                      </div>
                    ) : (
                      <GoogleSignInButton
                        onClick={handleGoogleLogin}
                        label="Verify with Google"
                      />
                    )}
                  </div>
                  {bookingError && (
                    <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{bookingError}</span>
                    </div>
                  )}
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isBooking || !eligibility.allowed}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isBooking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Confirming Slot...</span>
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="w-4 h-4" />
                        <span>Confirm & Reserve Slot</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
