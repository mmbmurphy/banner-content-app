'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PipelineSession } from '@/types/session';
import { WORKFLOW_STATUSES, STEP_SLUGS } from '@/lib/constants/dashboard';

interface CalendarViewProps {
  sessions: PipelineSession[];
  onUpdateSession: (id: string, updates: Partial<PipelineSession>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function CalendarView({ sessions, onUpdateSession, onDelete, onDuplicate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group sessions by their target date
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, PipelineSession[]> = {};
    sessions.forEach(session => {
      if (session.targetDate) {
        const dateKey = session.targetDate.split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(session);
      }
    });
    return grouped;
  }, [sessions]);

  // Sessions without a target date
  const unscheduledSessions = sessions.filter(s => !s.targetDate);

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1));
    setSelectedDate(null);
  };

  const getDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const handleDateClick = (day: number) => {
    const dateKey = getDateKey(day);
    setSelectedDate(selectedDate === dateKey ? null : dateKey);
  };

  const handleScheduleSession = (sessionId: string, dateKey: string) => {
    onUpdateSession(sessionId, { targetDate: new Date(dateKey).toISOString() });
    setEditingSession(null);
  };

  const getStatusColor = (status?: string) => {
    const found = WORKFLOW_STATUSES.find(s => s.value === status);
    return found?.color || 'bg-gray-100 text-gray-700';
  };

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = getDateKey(day);
      const daySessions = sessionsByDate[dateKey] || [];
      const isSelected = selectedDate === dateKey;

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(day)}
          className={`h-24 border-t border-gray-200 p-1 cursor-pointer transition ${
            isToday(day) ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
          } ${isSelected ? 'ring-2 ring-brand-accent ring-inset' : ''}`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm font-medium ${isToday(day) ? 'text-brand-accent' : 'text-gray-700'}`}>
              {day}
            </span>
            {daySessions.length > 0 && (
              <span className="text-xs bg-brand-accent text-white rounded-full w-5 h-5 flex items-center justify-center">
                {daySessions.length}
              </span>
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {daySessions.slice(0, 2).map((session) => (
              <Link
                key={session.id}
                href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                onClick={(e) => e.stopPropagation()}
                className={`block text-xs px-1 py-0.5 rounded truncate ${getStatusColor(session.workflowStatus)}`}
              >
                {session.topic.title || session.topic.slug || 'Untitled'}
              </Link>
            ))}
            {daySessions.length > 2 && (
              <span className="text-xs text-gray-500">
                +{daySessions.length - 2} more
              </span>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="flex gap-6">
      {/* Calendar Grid */}
      <div className="flex-1">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-brand-primary">
            {monthNames[month]} {year}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm text-brand-accent hover:bg-blue-50 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 border border-gray-200 rounded-t-lg overflow-hidden">
          {dayNames.map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 border-l border-r border-b border-gray-200 rounded-b-lg overflow-hidden">
          {renderCalendarDays()}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-72 flex-shrink-0">
        {/* Selected Date Details */}
        {selectedDate && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h4 className="font-medium text-brand-primary mb-3">
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h4>
            {(sessionsByDate[selectedDate] || []).length > 0 ? (
              <div className="space-y-2">
                {sessionsByDate[selectedDate].map((session) => (
                  <div key={session.id} className="p-2 bg-gray-50 rounded-lg">
                    <Link
                      href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                      className="font-medium text-sm text-brand-primary hover:text-brand-accent block"
                    >
                      {session.topic.title || session.topic.slug || 'Untitled'}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(session.workflowStatus)}`}>
                        {WORKFLOW_STATUSES.find(s => s.value === session.workflowStatus)?.label || 'Backlog'}
                      </span>
                      <button
                        onClick={() => onUpdateSession(session.id, { targetDate: undefined })}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        Unschedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No items scheduled</p>
            )}

            {/* Schedule an unscheduled session */}
            {unscheduledSessions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Schedule an item:</p>
                <select
                  value={editingSession || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleScheduleSession(e.target.value, selectedDate);
                    }
                  }}
                  className="w-full text-sm px-2 py-1 border border-gray-200 rounded"
                >
                  <option value="">Select item...</option>
                  {unscheduledSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.topic.title || session.topic.slug || 'Untitled'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Unscheduled Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-medium text-brand-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Unscheduled ({unscheduledSessions.length})
          </h4>
          {unscheduledSessions.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unscheduledSessions.map((session) => (
                <div key={session.id} className="p-2 bg-gray-50 rounded-lg">
                  <Link
                    href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                    className="font-medium text-sm text-brand-primary hover:text-brand-accent block truncate"
                  >
                    {session.topic.title || session.topic.slug || 'Untitled'}
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(session.workflowStatus)}`}>
                      {WORKFLOW_STATUSES.find(s => s.value === session.workflowStatus)?.label || 'Backlog'}
                    </span>
                    <input
                      type="date"
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdateSession(session.id, { targetDate: new Date(e.target.value).toISOString() });
                        }
                      }}
                      className="text-xs px-1 py-0.5 border border-gray-200 rounded w-24"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">All items are scheduled</p>
          )}
        </div>
      </div>
    </div>
  );
}
