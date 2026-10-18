import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Clock,
  Edit2,
  Trash2,
  CheckCircle,
  Tag as TagIcon,
  X
} from 'lucide-react';
import type { MeetingType, HostSettings } from '../types';

interface MeetingTypesManagerProps {
  meetingTypes: MeetingType[];
  hostSettings: HostSettings;
  onSaveMeetingType: (meetingType: MeetingType) => Promise<void>;
  onDeleteMeetingType: (typeId: string) => Promise<void>;
}

export const MeetingTypesManager: React.FC<MeetingTypesManagerProps> = ({
  meetingTypes,
  hostSettings,
  onSaveMeetingType,
  onDeleteMeetingType,
}) => {
  const [editingType, setEditingType] = useState<MeetingType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const availableTags = Object.keys(hostSettings.tagConstraints || { interview: true });

  const handleOpenNew = () => {
    const newType: MeetingType = {
      id: `mt-${Date.now()}`,
      userId: hostSettings.userId,
      title: '',
      description: '',
      durationMinutes: 60,
      tag: 'interview',
      color: '#6366F1',
      isActive: true,
      requiresGoogleLogin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingType(newType);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: MeetingType) => {
    setEditingType({ ...type });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !editingType.title.trim()) return;

    setIsSaving(true);
    try {
      await onSaveMeetingType(editingType);
      setIsModalOpen(false);
      setEditingType(null);
    } catch (err) {
      console.error('Failed to save meeting type:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (typeId: string, title: string) => {
    if (confirm(`Are you sure you want to delete the meeting type "${title}"?`)) {
      await onDeleteMeetingType(typeId);
    }
  };

  const colorOptions = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6', '#EF4444'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Meeting Services & Types</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Create and configure booking links with specific durations, tags, and constraint rules.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Meeting Type
        </button>
      </div>

      {/* Meeting Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meetingTypes.map((type) => {
          const tagConstraint = hostSettings.tagConstraints?.[type.tag.toLowerCase()];

          return (
            <div
              key={type.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: type.color || '#6366F1' }}
                    />
                    <h3 className="text-base font-bold text-gray-900">{type.title}</h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                      type.tag === 'interview'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    #{type.tag}
                  </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed min-h-[36px]">
                  {type.description || 'No description provided.'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg font-medium">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    {type.durationMinutes >= 60
                      ? `${(type.durationMinutes / 60).toFixed(type.durationMinutes % 60 === 0 ? 0 : 1)} hrs (${type.durationMinutes}m)`
                      : `${type.durationMinutes} mins`}
                  </span>

                  {tagConstraint && (
                    <span className="px-2 py-1 bg-indigo-50/80 text-indigo-700 rounded-lg text-[11px] font-medium border border-indigo-100">
                      Rule: Max {tagConstraint.maxPerDay}/day
                    </span>
                  )}

                  <span
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                      type.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {type.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleOpenEdit(type)}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                  title="Edit Type"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(type.id, type.title)}
                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete Type"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && editingType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingType.title ? 'Edit Meeting Type' : 'New Meeting Type'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technical Interview"
                  value={editingType.title}
                  onChange={(e) =>
                    setEditingType({ ...editingType, title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What is this meeting about?"
                  value={editingType.description}
                  onChange={(e) =>
                    setEditingType({ ...editingType, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                    Duration
                  </label>
                  <select
                    value={editingType.durationMinutes}
                    onChange={(e) =>
                      setEditingType({
                        ...editingType,
                        durationMinutes: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hr)</option>
                    <option value={90}>90 minutes (1.5 hrs)</option>
                    <option value={120}>120 minutes (2 hrs)</option>
                    <option value={240}>240 minutes (4 hrs - Half day)</option>
                    <option value={480}>480 minutes (8 hrs - Full day max)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                    Tag Constraint
                  </label>
                  <select
                    value={editingType.tag}
                    onChange={(e) =>
                      setEditingType({ ...editingType, tag: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  >
                    {availableTags.map((t) => (
                      <option key={t} value={t}>
                        #{t} {t === 'interview' ? '(Max 2/day)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingType({ ...editingType, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        editingType.color === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingType.isActive}
                  onChange={(e) =>
                    setEditingType({ ...editingType, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Accept bookings for this meeting type
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Meeting Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
