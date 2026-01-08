'use client';

import { useState, useEffect } from 'react';
import type { SessionUser } from '@/types/session';
import { STEP_NAMES } from '@/lib/constants/dashboard';

interface RequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  currentStep?: number;
  sessionTitle: string;
  onSuccess?: () => void;
}

export function RequestReviewModal({
  isOpen,
  onClose,
  sessionId,
  currentStep,
  sessionTitle,
  onSuccess,
}: RequestReviewModalProps) {
  const [teamMembers, setTeamMembers] = useState<SessionUser[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  async function fetchTeamMembers() {
    setLoading(true);
    try {
      const res = await fetch('/api/teams/members');
      const data = await res.json();
      if (data.members) {
        setTeamMembers(data.members);
        // Default to first member that isn't current user
        // (We don't have current user ID here, so we'll let them choose)
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReviewer || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: selectedReviewer,
          step: currentStep,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess?.();
        onClose();
        setNote('');
        setSelectedReviewer('');
      } else {
        alert(data.error || 'Failed to request review');
      }
    } catch (err) {
      console.error('Error requesting review:', err);
      alert('Failed to request review');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  const stepName = currentStep ? STEP_NAMES[currentStep - 1] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Request Review
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {stepName ? (
              <>Request feedback on <strong>{stepName}</strong> for "{sessionTitle}"</>
            ) : (
              <>Request feedback on "{sessionTitle}"</>
            )}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Reviewer Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send to
            </label>
            {loading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded-lg"></div>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-gray-500">No team members found. Invite someone to your team first.</p>
            ) : (
              <select
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
                required
              >
                <option value="">Select a reviewer...</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any specific feedback you're looking for?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedReviewer || sending}
              className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Request Review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
