import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import type { HostSettings, TagConstraint, WeeklySchedule } from '../types';

interface ConstraintsManagerProps {
  settings: HostSettings;
  onSaveSettings: (updated: HostSettings) => Promise<void>;
}

export const ConstraintsManager: React.FC<ConstraintsManagerProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<HostSettings>(JSON.parse(JSON.stringify(settings)));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagLabel, setNewTagLabel] = useState('');

  const handleToggleSingleBooking = () => {
    setFormData((prev) => ({
      ...prev,
      singleBookingPerGuest: !prev.singleBookingPerGuest,
    }));
  };

  const handleMaxDurationChange = (val: number) => {
    setFormData((prev) => ({
      ...prev,
      maxMeetingDurationMinutes: Math.min(480, Math.max(15, val)),
    }));
  };

  const handleTagConstraintChange = (
    tagKey: string,
    field: keyof TagConstraint,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      tagConstraints: {
        ...prev.tagConstraints,
        [tagKey]: {
          ...prev.tagConstraints[tagKey],
          [field]: value,
        },
      },
    }));
  };

  const handleAddTag = () => {
    const rawTag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!rawTag) return;

    if (formData.tagConstraints[rawTag]) {
      alert(`Tag "${rawTag}" already exists!`);
      return;
    }

    const newConstraint: TagConstraint = {
      tag: rawTag,
      label: newTagLabel.trim() || rawTag.charAt(0).toUpperCase() + rawTag.slice(1),
      maxPerDay: 3,
      bufferMinutes: 15,
      allowedStartHour: 9,
      allowedEndHour: 17,
      color: '#6366F1',
    };

    setFormData((prev) => ({
      ...prev,
      tagConstraints: {
        ...prev.tagConstraints,
        [rawTag]: newConstraint,
      },
    }));

    setNewTagInput('');
    setNewTagLabel('');
  };

  const handleDeleteTag = (tagKey: string) => {
    if (tagKey === 'interview') {
      alert('The "interview" tag is required for interview constraints and cannot be deleted.');
      return;
    }

    setFormData((prev) => {
      const copy = { ...prev.tagConstraints };
      delete copy[tagKey];
      return {
        ...prev,
        tagConstraints: copy,
      };
    });
  };

  const handleScheduleDayToggle = (day: keyof WeeklySchedule) => {
    setFormData((prev) => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: {
          ...prev.weeklySchedule[day],
          enabled: !prev.weeklySchedule[day].enabled,
        },
      },
    }));
  };

  const handleScheduleTimeChange = (
    day: keyof WeeklySchedule,
    field: 'start' | 'end',
    value: string
  ) => {
    setFormData((prev) => {
      const currentSlots = prev.weeklySchedule[day].slots || [{ start: '09:00', end: '17:00' }];
      const updatedSlot = { ...currentSlots[0], [field]: value };
      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...prev.weeklySchedule[day],
            slots: [updatedSlot],
          },
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const days: { key: keyof WeeklySchedule; label: string }[] = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Constraints & Tag Rules</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Configure tag-based daily meeting limits, single-slot guest locks, and maximum durations.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved Changes!' : 'Save Constraints'}
        </button>
      </div>

      {/* Card 1: Tag-Based Meeting Constraints */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>Tag-Based Rules & Daily Limits</span>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-200 uppercase">
                Active Enforcer
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Specify maximum calls per day, required buffer time, and allowed hours for each tag.
            </p>
          </div>
        </div>

        {/* Highlighted Notice about Interview Constraint */}
        <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-950">
              Rule Enforcement: Maximum 2 Interview Meetings per Day
            </p>
            <p className="mt-0.5 text-indigo-800">
              The tag <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono text-indigo-900">#interview</code> is restricted to <strong>{formData.tagConstraints?.interview?.maxPerDay || 2} meetings per day</strong>. Once reached, candidates cannot select any interview slots on that day.
            </p>
          </div>
        </div>

        {/* Tag Constraints Grid */}
        <div className="space-y-4">
          {Object.entries(formData.tagConstraints || {}).map(([tagKey, constraint]) => (
            <div
              key={tagKey}
              className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: constraint.color || '#6366F1' }}
                  />
                  <span className="font-bold text-sm text-gray-900">
                    {constraint.label}
                  </span>
                  <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                    #{constraint.tag}
                  </span>
                </div>

                {tagKey !== 'interview' && (
                  <button
                    onClick={() => handleDeleteTag(tagKey)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    title="Delete Tag"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Max meetings per day */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Max Calls Per Day
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={constraint.maxPerDay}
                      onChange={(e) =>
                        handleTagConstraintChange(
                          tagKey,
                          'maxPerDay',
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="w-full bg-white px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                    <span className="text-xs text-gray-500 shrink-0">calls/day</span>
                  </div>
                </div>

                {/* Buffer between calls */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Buffer Time
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={5}
                      value={constraint.bufferMinutes}
                      onChange={(e) =>
                        handleTagConstraintChange(
                          tagKey,
                          'bufferMinutes',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full bg-white px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                    <span className="text-xs text-gray-500 shrink-0">minutes</span>
                  </div>
                </div>

                {/* Time of day restriction */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Allowed Hours Window
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={constraint.allowedStartHour ?? 9}
                      onChange={(e) =>
                        handleTagConstraintChange(
                          tagKey,
                          'allowedStartHour',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-16 bg-white px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-center font-mono"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={constraint.allowedEndHour ?? 17}
                      onChange={(e) =>
                        handleTagConstraintChange(
                          tagKey,
                          'allowedEndHour',
                          parseInt(e.target.value) || 24
                        )
                      }
                      className="w-16 bg-white px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-center font-mono"
                    />
                    <span className="text-gray-400">:00</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Tag Form */}
        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-3">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Add New Meeting Tag & Constraint
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Tag slug (e.g. advisory)"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="bg-white px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <input
              type="text"
              placeholder="Display label (e.g. Strategic Advisory)"
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
              className="bg-white px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTagInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Tag Rule
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Guest Booking Protection & Max Duration (Constraint 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Single Slot Guest Lock */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Single Slot Guest Protection
              </h3>
              <p className="text-xs text-gray-500">
                Prevent a single user or candidate from blocking more than 1 slot.
              </p>
            </div>

            <button
              onClick={handleToggleSingleBooking}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formData.singleBookingPerGuest ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.singleBookingPerGuest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded-xl leading-relaxed">
            When enabled, guests verified via Google account are restricted to holding at most <strong>1 active confirmed booking</strong>. They must complete or cancel their appointment before reserving another slot.
          </div>
        </div>

        {/* Max Meeting Duration Limit */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              Max Meeting Duration (Up to 8 Hours)
            </h3>
            <p className="text-xs text-gray-500">
              Maximum allowable duration for a single or multi-session booking.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-gray-900">
                {formData.maxMeetingDurationMinutes} mins
              </span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                {(formData.maxMeetingDurationMinutes / 60).toFixed(1)} Hours Max
              </span>
            </div>

            <input
              type="range"
              min={30}
              max={480}
              step={30}
              value={formData.maxMeetingDurationMinutes}
              onChange={(e) => handleMaxDurationChange(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />

            <p className="text-[11px] text-gray-500">
              Supports full-day assessments, paired programming, and multi-hour workshops up to the 8-hour cap.
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Weekly Working Hours Schedule */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Weekly Availability Schedule
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Define your regular working hours. Google Calendar commitments will automatically block slots within these hours.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {days.map(({ key, label }) => {
            const config = formData.weeklySchedule[key] || {
              enabled: false,
              slots: [{ start: '09:00', end: '17:00' }],
            };
            const slot = config.slots?.[0] || { start: '09:00', end: '17:00' };

            return (
              <div key={key} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-36">
                  <input
                    type="checkbox"
                    id={`day-${key}`}
                    checked={config.enabled}
                    onChange={() => handleScheduleDayToggle(key)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor={`day-${key}`}
                    className={`text-sm font-semibold cursor-pointer ${
                      config.enabled ? 'text-gray-900' : 'text-gray-400 line-through'
                    }`}
                  >
                    {label}
                  </label>
                </div>

                {config.enabled ? (
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => handleScheduleTimeChange(key, 'start', e.target.value)}
                      className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => handleScheduleTimeChange(key, 'end', e.target.value)}
                      className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
