'use client';

import { useState } from 'react';
import { ActivityFeed } from './ActivityFeed';
import { CommentThread } from './CommentThread';
import { RequestReviewModal } from './RequestReviewModal';

interface CollaborationPanelProps {
  sessionId: string;
  sessionTitle: string;
  currentStep?: number;
}

type Tab = 'comments' | 'activity';

export function CollaborationPanel({ sessionId, sessionTitle, currentStep }: CollaborationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('comments');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Collaboration
          </button>

          <button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-blue-50 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Request Review
          </button>
        </div>

        {isExpanded && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === 'comments'
                    ? 'text-brand-accent border-brand-accent'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Comments
                </span>
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === 'activity'
                    ? 'text-brand-accent border-brand-accent'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Activity
                </span>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-80 overflow-y-auto">
              {activeTab === 'comments' ? (
                <CommentThread
                  sessionId={sessionId}
                  step={currentStep}
                  placeholder={currentStep ? `Comment on this step...` : 'Add a comment...'}
                />
              ) : (
                <ActivityFeed sessionId={sessionId} />
              )}
            </div>
          </>
        )}
      </div>

      <RequestReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        sessionId={sessionId}
        currentStep={currentStep}
        sessionTitle={sessionTitle}
        onSuccess={() => {
          // Could refresh activity feed here
        }}
      />
    </>
  );
}
