import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Globe, ShieldCheck, Sparkles } from 'lucide-react';
import type { LocalHostProfile } from '../lib/storage';
import type { HostSettings, MeetingType, CalendarCommitment } from '../types';
import { encodeShareableSchedule } from '../lib/storage';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: LocalHostProfile;
  hostSettings: HostSettings;
  meetingTypes: MeetingType[];
  calendarCommitments: CalendarCommitment[];
  onPreview: () => void;
  hostUid?: string;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  hostSettings,
  meetingTypes,
  calendarCommitments,
  onPreview,
  hostUid,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format busy commitment slices for URL
  const busySlices = calendarCommitments.slice(0, 40).map((c) => ({
    start: c.start.toISOString(),
    end: c.end.toISOString(),
    tag: c.tag,
  }));

  const encodedSchedule = encodeShareableSchedule(
    userProfile,
    hostSettings,
    meetingTypes,
    busySlices,
    hostUid
  );

  const baseUrl = window.location.origin + window.location.pathname;
  const bookingUrl = `${baseUrl}#s=${encodedSchedule}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Share Availability for {userProfile.displayName}</h3>
              <p className="text-xs text-gray-500">
                Anyone with this link can schedule a meeting with {userProfile.displayName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Your Shareable Booking Link
            </label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl">
              <input
                type="text"
                readOnly
                value={bookingUrl}
                className="flex-1 bg-transparent text-xs text-gray-800 font-mono focus:outline-none px-2 select-all truncate"
              />
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-950">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Direct Open-Source Capabilities
            </div>
            <ul className="list-disc list-inside space-y-1 text-indigo-800 pl-1">
              <li>Carries your working hours, buffers, and meeting types directly in the link.</li>
              <li>Enforces maximum 2 interview meetings per day rule.</li>
              <li>Guests verify via <strong>Captcha</strong> or <strong>Google Login</strong> without creating developer accounts.</li>
              <li>Generates instant Google Calendar invites and video meeting rooms.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            onClick={() => {
              onClose();
              onPreview();
            }}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Test Booking Page
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
