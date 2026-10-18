import React from 'react';
import {
  Calendar,
  Clock,
  Sliders,
  Layers,
  Share2,
  LogOut,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { LocalHostProfile } from '../lib/storage';
import { GoogleSignInButton } from './GoogleSignInButton';

interface NavbarProps {
  userProfile: LocalHostProfile | null;
  activeTab: 'dashboard' | 'constraints' | 'meetingTypes' | 'bookings' | 'preview';
  setActiveTab: (tab: 'dashboard' | 'constraints' | 'meetingTypes' | 'bookings' | 'preview') => void;
  onOpenShareModal: () => void;
  onLogin: () => void;
  onLogout: () => void;
  hasCalendarToken: boolean;
  onRefreshCalendar: () => void;
  isCalendarSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  userProfile,
  activeTab,
  setActiveTab,
  onOpenShareModal,
  onLogin,
  onLogout,
  hasCalendarToken,
  onRefreshCalendar,
  isCalendarSyncing,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-gray-900">
                  ScheduleFlow
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                  SaaS
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden sm:block">
                Google Calendar Sync & Smart Constraints
              </p>
            </div>
          </div>

          {/* Navigation Items (if signed in) */}
          {userProfile && (
            <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Dashboard
              </button>

              <button
                onClick={() => setActiveTab('constraints')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'constraints'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Constraints & Tags
              </button>

              <button
                onClick={() => setActiveTab('meetingTypes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'meetingTypes'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Meeting Types
              </button>

              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Booking Page
              </button>
            </nav>
          )}

          {/* Actions & Profile */}
          <div className="flex items-center gap-3">
            {userProfile ? (
              <>
                {/* Google Calendar Connection Status Badge */}
                <div
                  className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium bg-emerald-50 text-emerald-800 border-emerald-200"
                  title="Google Calendar API connected"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden xl:inline">Calendar:</span>
                  <span className="font-semibold truncate max-w-[120px]">
                    {userProfile.email}
                  </span>
                  <button
                    onClick={onRefreshCalendar}
                    disabled={isCalendarSyncing}
                    className="p-1 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-100/60 transition-colors cursor-pointer"
                    title="Refresh commitments from Google Calendar"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCalendarSyncing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Share Link Button */}
                <button
                  onClick={onOpenShareModal}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-xs shadow-indigo-200 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share Link</span>
                </button>

                {/* User Avatar & Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                  {userProfile.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt={userProfile.displayName}
                      className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      {userProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <button
                    onClick={onLogout}
                    className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <GoogleSignInButton onClick={onLogin} label="Host Sign In" />
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {userProfile && (
        <div className="flex md:hidden items-center justify-around py-2 border-t border-gray-100 bg-gray-50 px-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1 rounded-md font-medium ${
              activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('constraints')}
            className={`px-2.5 py-1 rounded-md font-medium ${
              activeTab === 'constraints' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600'
            }`}
          >
            Constraints
          </button>
          <button
            onClick={() => setActiveTab('meetingTypes')}
            className={`px-2.5 py-1 rounded-md font-medium ${
              activeTab === 'meetingTypes' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600'
            }`}
          >
            Meeting Types
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded-md font-medium ${
              activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-indigo-600'
            }`}
          >
            Booking Page
          </button>
        </div>
      )}
    </header>
  );
};
