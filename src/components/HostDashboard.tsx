import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Share2,
  ExternalLink,
  ShieldAlert,
  Search,
  Filter,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { Booking, HostSettings, CalendarCommitment } from '../types';
import type { LocalHostProfile } from '../lib/storage';
import { ConfirmationModal } from './ConfirmationModal';

interface HostDashboardProps {
  userProfile: LocalHostProfile;
  hostSettings: HostSettings;
  bookings: Booking[];
  calendarCommitments: CalendarCommitment[];
  onOpenShareModal: () => void;
  onPreviewBookingPage: () => void;
  onCancelBooking: (booking: Booking) => Promise<void>;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  userProfile,
  hostSettings,
  bookings,
  calendarCommitments,
  onOpenShareModal,
  onPreviewBookingPage,
  onCancelBooking,
}) => {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled'>('confirmed');
  const [search, setSearch] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Compute Today's Interview Count vs Max Limit
  const today = new Date();
  const todayInterviewBookings = bookings.filter((b) => {
    if (b.status !== 'confirmed') return false;
    if (b.tag.toLowerCase() !== 'interview') return false;
    const bDate = new Date(b.startTime);
    return (
      bDate.getFullYear() === today.getFullYear() &&
      bDate.getMonth() === today.getMonth() &&
      bDate.getDate() === today.getDate()
    );
  });

  const todayInterviewCommitments = calendarCommitments.filter((c) => {
    if (c.tag !== 'interview') return false;
    return (
      c.start.getFullYear() === today.getFullYear() &&
      c.start.getMonth() === today.getMonth() &&
      c.start.getDate() === today.getDate()
    );
  });

  const totalInterviewsToday = todayInterviewBookings.length + todayInterviewCommitments.length;
  const maxInterviewsPerDay = hostSettings.tagConstraints?.interview?.maxPerDay ?? 2;

  // Filter bookings
  const filteredBookings = bookings
    .filter((b) => {
      if (filter === 'confirmed') return b.status === 'confirmed';
      if (filter === 'cancelled') return b.status === 'cancelled';
      return true;
    })
    .filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.guestName.toLowerCase().includes(q) ||
        b.guestEmail.toLowerCase().includes(q) ||
        b.meetingTitle.toLowerCase().includes(q) ||
        b.tag.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const upcomingConfirmed = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.endTime) > new Date()
  ).length;

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setIsCancelling(true);
    try {
      await onCancelBooking(cancellingBooking);
      setCancellingBooking(null);
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Welcome & Quick Share */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-500/30 text-indigo-200 text-xs font-semibold rounded-full border border-indigo-400/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Google Calendar Live Sync Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {userProfile.displayName}
            </h1>
            <p className="text-sm text-indigo-200 max-w-xl">
              Your scheduling rules, daily interview limits, and calendar commitments are
              actively monitored to prevent conflicts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenShareModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-900 text-xs sm:text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-indigo-600" />
              Share Booking Link
            </button>
            <button
              onClick={onPreviewBookingPage}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-700/60 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl border border-indigo-400/30 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Preview My Page
            </button>
          </div>
        </div>
      </div>

      {/* Constraints & Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Interview Constraint */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Today's Interviews
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                totalInterviewsToday >= maxInterviewsPerDay
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              Limit: {maxInterviewsPerDay}/day
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{totalInterviewsToday}</span>
            <span className="text-xs text-gray-500 font-medium">/ {maxInterviewsPerDay} max</span>
          </div>

          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                totalInterviewsToday >= maxInterviewsPerDay
                  ? 'bg-rose-500'
                  : totalInterviewsToday > 0
                  ? 'bg-indigo-500'
                  : 'bg-gray-300'
              }`}
              style={{
                width: `${Math.min(100, (totalInterviewsToday / maxInterviewsPerDay) * 100)}%`,
              }}
            ></div>
          </div>

          <p className="text-[11px] text-gray-500 leading-tight">
            {totalInterviewsToday >= maxInterviewsPerDay
              ? '⛔ Constraint enforced: No further interview slots open today.'
              : `${maxInterviewsPerDay - totalInterviewsToday} more interview slot(s) allowed today.`}
          </p>
        </div>

        {/* Metric 2: Upcoming Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Upcoming Bookings
            </span>
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-gray-900">{upcomingConfirmed}</div>
          <p className="text-[11px] text-gray-500">
            Confirmed sessions on your calendar.
          </p>
        </div>

        {/* Metric 3: Single Slot Guest Lock */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Guest Slot Lock
            </span>
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">Enforced</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-[11px] text-gray-500">
            A single user cannot hold more than 1 active slot.
          </p>
        </div>

        {/* Metric 4: Calendar Commitments Sync */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Calendar Commitments
            </span>
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-3xl font-black text-gray-900">{calendarCommitments.length}</div>
          <p className="text-[11px] text-gray-500">
            Existing events synced and blocked out.
          </p>
        </div>
      </div>

      {/* Bookings Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Scheduled Meetings</h2>
            <p className="text-xs text-gray-500">
              Meetings booked through your public link and synced to Google Calendar
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search guest or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setFilter('confirmed')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filter === 'confirmed' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setFilter('cancelled')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filter === 'cancelled' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                Cancelled
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="divide-y divide-gray-100">
          {filteredBookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">No meetings found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {search
                  ? 'No bookings match your current search criteria.'
                  : 'Share your booking link with candidates, clients, or colleagues to get started!'}
              </p>
              <button
                onClick={onOpenShareModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Booking Page
              </button>
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const start = new Date(booking.startTime);
              const end = new Date(booking.endTime);
              const isPast = end < new Date();

              return (
                <div
                  key={booking.id}
                  className="p-5 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{booking.meetingTitle}</h4>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                          booking.tag === 'interview'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : booking.tag === 'screening'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        #{booking.tag}
                      </span>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          booking.status === 'confirmed'
                            ? isPast
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {booking.status === 'confirmed' ? (isPast ? 'Completed' : 'Confirmed') : 'Cancelled'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5 font-medium text-gray-900">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {booking.guestName}
                        <span className="text-gray-400 font-normal">({booking.guestEmail})</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {start.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        •{' '}
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        ({booking.durationMinutes} min)
                      </div>
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 max-w-2xl">
                        <span className="font-semibold text-gray-700">Notes from guest:</span>{' '}
                        {booking.notes}
                      </p>
                    )}
                  </div>

                  {/* Booking Actions */}
                  <div className="flex items-center gap-2 self-start md:self-center">
                    {booking.googleMeetLink && booking.status === 'confirmed' && (
                      <a
                        href={booking.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Google Meet
                      </a>
                    )}

                    {booking.status === 'confirmed' && !isPast && (
                      <button
                        onClick={() => setCancellingBooking(booking)}
                        className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Calendar Sync Debugger */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 mt-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-600" />
          Fetched Google Calendar Events (Last Sync)
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
          {calendarCommitments.length === 0 ? (
            <p className="text-gray-500 italic">No events fetched from Google Calendar.</p>
          ) : (
            calendarCommitments.map((c) => (
              <div key={c.id} className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{c.title}</span>
                  <p className="text-gray-500">
                    {c.start.toLocaleString()} - {c.end.toLocaleString()}
                  </p>
                </div>
                {c.tag && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-bold">#{c.tag}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal for Cancelling a Booking */}
      <ConfirmationModal
        isOpen={!!cancellingBooking}
        title="Cancel Scheduled Meeting"
        message={`Are you sure you want to cancel the "${cancellingBooking?.meetingTitle}" with ${cancellingBooking?.guestName}?\n\nThis will remove the event from your Google Calendar, notify the guest, and free up this time slot.`}
        confirmLabel="Yes, Cancel Meeting"
        cancelLabel="Keep Meeting"
        isDestructive={true}
        isLoading={isCancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancellingBooking(null)}
      />
    </div>
  );
};
