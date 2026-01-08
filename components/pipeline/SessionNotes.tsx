'use client';

import { useState, useEffect } from 'react';
import { usePipelineStore } from '@/lib/store/session-store';

interface SessionNotesProps {
  sessionId: string;
  compact?: boolean;
}

export function SessionNotes({ sessionId, compact = false }: SessionNotesProps) {
  const { loadSession, updateSession } = usePipelineStore();
  const session = loadSession(sessionId);
  const [notes, setNotes] = useState(session?.notes || '');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (session?.notes !== undefined) {
      setNotes(session.notes);
    }
  }, [session?.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    updateSession(sessionId, { notes: value });
  };

  // Compact mode shows notes only if they exist
  if (compact && !notes && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-xs text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Add notes
      </button>
    );
  }

  if (compact) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-yellow-800">Session Notes</span>
          {notes && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-yellow-600 hover:text-yellow-800"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
        {isExpanded || !notes ? (
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add notes..."
            rows={2}
            className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        ) : (
          <p className="text-xs text-yellow-700 line-clamp-2">{notes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
      <label className="block text-sm font-medium text-yellow-800 mb-2">
        Session Notes
      </label>
      <textarea
        value={notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Add any notes about this content piece - reminders, context, feedback from team..."
        rows={2}
        className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm bg-white"
      />
      <p className="text-xs text-yellow-700 mt-1">
        Notes are saved automatically and visible on all steps.
      </p>
    </div>
  );
}
