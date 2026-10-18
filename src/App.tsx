import React, { useState, useEffect, useCallback } from 'react';
import {
  auth,
  signInWithGoogle,
  logOut,
  getCachedAccessToken,
  getCurrentIdToken,
} from './lib/firebase';
import { getCalendarStatus, calendarConnectUrl } from './lib/apiClient';
import { listHostBookings } from './lib/firestoreService';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type {
  HostSettings,
  MeetingType,
  Booking,
  CalendarCommitment,
} from './types';
import {
  getLocalHostProfile,
  saveLocalHostProfile,
  getLocalHostSettings,
  saveLocalHostSettings,
  getLocalMeetingTypes,
  saveLocalMeetingTypes,
  getLocalBookings,
  saveLocalBooking,
  updateLocalBookingStatus,
  decodeShareableSchedule,
  type LocalHostProfile,
} from './lib/storage';
import {
  fetchGoogleCalendarEvents,
  deleteGoogleCalendarEvent,
} from './lib/calendarService';
import { Navbar } from './components/Navbar';
import { HostDashboard } from './components/HostDashboard';
import { ConstraintsManager } from './components/ConstraintsManager';
import { MeetingTypesManager } from './components/MeetingTypesManager';
import { PublicBookingPage } from './components/PublicBookingPage';
import { ShareLinkModal } from './components/ShareLinkModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import {
  Calendar,
  Sparkles,
  ShieldCheck,
  Video,
  Clock,
  Eye,
  Globe,
  Share2
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hostProfile, setHostProfile] = useState<LocalHostProfile>(() => getLocalHostProfile());
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => getLocalHostSettings());
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>(() => getLocalMeetingTypes());
  const [bookings, setBookings] = useState<Booking[]>(() => getLocalBookings());
  const [calendarCommitments, setCalendarCommitments] = useState<CalendarCommitment[]>([]);

  // Open-Source Shared Schedule Detection
  const [sharedSchedule, setSharedSchedule] = useState<{
    profile: LocalHostProfile;
    settings: HostSettings;
    meetingTypes: MeetingType[];
    commitments: CalendarCommitment[];
  } | null>(null);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'constraints' | 'meetingTypes' | 'bookings' | 'preview'>('dashboard');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [calendarInviteConnected, setCalendarInviteConnected] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);

  // Check URL hash for shared schedule payload (#s=...)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#s=')) {
      const encoded = hash.substring(3);
      const decoded = decodeShareableSchedule(encoded);
      if (decoded) {
        setSharedSchedule({
          profile: decoded.profile,
          settings: decoded.settings,
          meetingTypes: decoded.meetingTypes,
          commitments: decoded.commitments.map((c) => ({
            id: `c-${Math.random()}`,
            title: 'Busy Commitment',
            start: new Date(c.start),
            end: new Date(c.end),
            tag: c.tag,
          })),
        });
        setActiveTab('preview');
      }
    }
  }, []);

  // Handle the return from the host calendar-connect OAuth flow.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('calendar=')) return;
    if (hash.includes('calendar=connected')) {
      setCalendarInviteConnected(true);
      setCalendarNotice(
        'Google Calendar connected — guests who book will now receive email invites automatically.'
      );
    } else {
      setCalendarNotice(
        'Calendar connection did not complete. Please try connecting again to enable email invites.'
      );
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Sync Google Calendar Commitments
  const syncGoogleCalendar = useCallback(async () => {
    const token = getCachedAccessToken();
    if (!token) return;

    setIsCalendarSyncing(true);
    try {
      const now = new Date();
      const timeMin = now.toISOString();
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const timeMax = thirtyDaysAhead.toISOString();

      const events = await fetchGoogleCalendarEvents(token, timeMin, timeMax);
      setCalendarCommitments(events);
    } catch (err) {
      console.warn('Google Calendar sync notice:', err);
    } finally {
      setIsCalendarSyncing(false);
    }
  }, []);

  // Auth State Listener (Client-side Google Calendar access)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // If current user is host, update local display name and email if empty
        setHostProfile((prev) => {
          const updated = {
            ...prev,
            displayName: user.displayName || prev.displayName || 'Host',
            email: user.email || prev.email,
            photoURL: user.photoURL || prev.photoURL,
          };
          saveLocalHostProfile(updated);
          return updated;
        });
        await syncGoogleCalendar();

        // Pull bookings persisted by the backend so the host sees meetings
        // booked through their public link (not just this browser).
        try {
          const remote = await listHostBookings(user.uid);
          if (remote.length) {
            setBookings((prev) => {
              const byId = new Map(prev.map((b) => [b.id, b]));
              for (const b of remote) byId.set(b.id, b);
              return Array.from(byId.values());
            });
          }
        } catch (err) {
          console.warn('Could not load remote bookings:', err);
        }

        // Check whether the host has connected their calendar for invites.
        try {
          const idToken = await user.getIdToken();
          const status = await getCalendarStatus(idToken);
          setCalendarInviteConnected(status.connected);
        } catch (err) {
          console.warn('Could not check calendar connection:', err);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, [syncGoogleCalendar]);

  // Periodic auto-sync (every 5 minutes) and window focus sync
  useEffect(() => {
    // 1. Sync on interval every 5 minutes
    const intervalId = setInterval(() => {
      if (getCachedAccessToken()) {
        syncGoogleCalendar();
      }
    }, 5 * 60 * 1000);

    // 2. Auto-sync whenever the user switches back to this browser tab
    const handleWindowFocus = () => {
      if (getCachedAccessToken()) {
        syncGoogleCalendar();
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [syncGoogleCalendar]);
  const handleLogin = async () => {
    try {
      setErrorNotice(null);
      const { user } = await signInWithGoogle();
      if (user) {
        await syncGoogleCalendar();
      }
    } catch (err: any) {
      console.error('Google Calendar connect failed:', err);
      setErrorNotice(err.message || 'Failed to connect Google Calendar.');
    }
  };

  const handleLogout = async () => {
    await logOut();
    window.location.reload();
  };

  // Save Settings
  const handleSaveSettings = async (updated: HostSettings) => {
    saveLocalHostSettings(updated);
    setHostSettings(updated);
  };

  // Save Meeting Type
  const handleSaveMeetingType = async (type: MeetingType) => {
    setMeetingTypes((prev) => {
      const index = prev.findIndex((t) => t.id === type.id);
      let next: MeetingType[];
      if (index >= 0) {
        next = [...prev];
        next[index] = type;
      } else {
        next = [...prev, type];
      }
      saveLocalMeetingTypes(next);
      return next;
    });
  };

  // Delete Meeting Type
  const handleDeleteMeetingType = async (typeId: string) => {
    setMeetingTypes((prev) => {
      const next = prev.filter((t) => t.id !== typeId);
      saveLocalMeetingTypes(next);
      return next;
    });
  };

  // Cancel Booking
  const handleCancelBooking = async (booking: Booking) => {
    const token = getCachedAccessToken();
    if (token && booking.googleEventId) {
      await deleteGoogleCalendarEvent(token, booking.googleEventId);
    }
    updateLocalBookingStatus(booking.id, 'cancelled');
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b))
    );
    await syncGoogleCalendar();
  };

  // New Booking Created
  const handleBookingCreated = (newBooking: Booking) => {
    saveLocalBooking(newBooking);
    setBookings((prev) => [...prev, newBooking]);
    syncGoogleCalendar();
  };

  const handleOpenShareModal = () => {
    syncGoogleCalendar();
    setIsShareModalOpen(true);
  };

  // Connect the host's Google Calendar for OFFLINE access so the backend can
  // create events and email invites whenever a guest books.
  const handleConnectCalendar = async () => {
    setErrorNotice(null);
    let idToken = await getCurrentIdToken();
    if (!idToken) {
      try {
        await signInWithGoogle();
        idToken = await getCurrentIdToken();
      } catch (err: any) {
        setErrorNotice(err.message || 'Please sign in to connect your calendar.');
        return;
      }
    }
    if (!idToken) {
      setErrorNotice('Please sign in to connect your calendar.');
      return;
    }
    window.location.href = calendarConnectUrl(idToken);
  };

  const isSharedLink = !!sharedSchedule;
  const activeProfile = sharedSchedule ? sharedSchedule.profile : hostProfile;
  const activeSettings = sharedSchedule ? sharedSchedule.settings : hostSettings;
  const activeMeetingTypes = sharedSchedule ? sharedSchedule.meetingTypes : meetingTypes;
  const activeCommitments = sharedSchedule ? sharedSchedule.commitments : calendarCommitments;
  // The host identity used for backend booking + invites: the shared link's
  // embedded UID for guests, or the signed-in host's own UID in preview.
  const activeHostId = sharedSchedule ? sharedSchedule.profile.id : currentUser?.uid || hostProfile.id;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        userProfile={activeProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenShareModal={handleOpenShareModal}
        onLogin={handleLogin}
        onLogout={handleLogout}
        hasCalendarToken={!!getCachedAccessToken()}
        onRefreshCalendar={syncGoogleCalendar}
        isCalendarSyncing={isCalendarSyncing}
      />

      {/* Shared Schedule Banner */}
      {isSharedLink && (
        <div className="bg-indigo-950 text-indigo-100 py-2.5 px-4 text-xs font-medium shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                Viewing open-source shared schedule for <strong>{activeProfile.displayName}</strong>. No central logins or database required.
              </span>
            </div>
            <button
              onClick={() => {
                window.location.hash = '';
                setSharedSchedule(null);
                setActiveTab('dashboard');
              }}
              className="text-xs text-indigo-300 hover:text-white underline font-semibold text-left sm:text-right cursor-pointer"
            >
              Create My Own Schedule &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Preview Mode Switcher */}
      {!isSharedLink && activeTab === 'preview' && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-2 px-4 text-xs font-semibold shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>
                Booking Page Preview. Test scheduling slots as a guest would see them.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {errorNotice && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between">
            <span>{errorNotice}</span>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {calendarNotice && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
            <span>{calendarNotice}</span>
            <button
              onClick={() => setCalendarNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Prompt the signed-in host to connect their calendar for invites. */}
        {!isSharedLink && currentUser && !calendarInviteConnected && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Connect your Google Calendar to send invites.</strong> Until you do,
                guests who book through your link won't generate a calendar event or email invite
                for you.
              </span>
            </div>
            <button
              onClick={handleConnectCalendar}
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Connect Calendar
            </button>
          </div>
        )}

        {/* View 1: Host Dashboard */}
        {activeTab === 'dashboard' && !isSharedLink && (
          <HostDashboard
            userProfile={hostProfile}
            hostSettings={hostSettings}
            bookings={bookings}
            calendarCommitments={calendarCommitments}
            onOpenShareModal={handleOpenShareModal}
            onPreviewBookingPage={() => setActiveTab('preview')}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {/* View 2: Constraints Manager */}
        {activeTab === 'constraints' && !isSharedLink && (
          <ConstraintsManager
            settings={hostSettings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {/* View 3: Meeting Types Manager */}
        {activeTab === 'meetingTypes' && !isSharedLink && (
          <MeetingTypesManager
            meetingTypes={meetingTypes}
            hostSettings={hostSettings}
            onSaveMeetingType={handleSaveMeetingType}
            onDeleteMeetingType={handleDeleteMeetingType}
          />
        )}

        {/* View 4: Public Booking Page */}
        {(activeTab === 'preview' || isSharedLink) && (
          <PublicBookingPage
            hostProfile={activeProfile}
            hostId={activeHostId}
            hostSettings={activeSettings}
            meetingTypes={activeMeetingTypes}
            existingBookings={bookings}
            calendarCommitments={activeCommitments}
            onBookingCreated={handleBookingCreated}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Share Link Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        userProfile={hostProfile}
        hostSettings={hostSettings}
        meetingTypes={meetingTypes}
        calendarCommitments={calendarCommitments}
        onPreview={() => setActiveTab('preview')}
        hostUid={currentUser?.uid}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-400">
        <p>
          ScheduleFlow • Open-Source Scheduling with Direct Google Calendar Sync & Smart Tag Constraints
        </p>
      </footer>
    </div>
  );
}
