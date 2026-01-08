'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { ReviewRequest, ReviewStatus } from '@/types/collaboration';
import { STEP_NAMES, STEP_SLUGS } from '@/lib/constants/dashboard';

interface ReviewWithSession extends ReviewRequest {
  sessionTitle?: string;
}

interface ReviewCounts {
  pending: number;
  completed: number;
  requested: number;
}

type FilterType = 'pending' | 'completed' | 'requested';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewWithSession[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, completed: 0, requested: 0 });
  const [filter, setFilter] = useState<FilterType>('pending');
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?filter=${filter}`);
      const data = await res.json();
      if (data.reviews) {
        setReviews(data.reviews);
      }
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleRespond(reviewId: string, sessionId: string, status: ReviewStatus) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status,
          responseNote: responseNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        setRespondingTo(null);
        setResponseNote('');
        fetchReviews();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to respond to review');
      }
    } catch (err) {
      console.error('Error responding to review:', err);
      alert('Failed to respond to review');
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Pending</span>;
      case 'approved':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Approved</span>;
      case 'changes_requested':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Changes Requested</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-brand-accent mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-brand-primary">Reviews</h1>
          <p className="text-gray-500">Manage review requests and feedback</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            filter === 'pending'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending Review
          {counts.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
              {counts.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            filter === 'completed'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Completed
          <span className="ml-2 text-xs text-gray-400">({counts.completed})</span>
        </button>
        <button
          onClick={() => setFilter('requested')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            filter === 'requested'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Requests
          <span className="ml-2 text-xs text-gray-400">({counts.requested})</span>
        </button>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 h-32 rounded-xl"></div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">
            {filter === 'pending' ? '✨' : filter === 'completed' ? '📋' : '📤'}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'pending'
              ? 'No pending reviews'
              : filter === 'completed'
              ? 'No completed reviews yet'
              : 'No review requests sent'}
          </h3>
          <p className="text-gray-500">
            {filter === 'pending'
              ? "You're all caught up! Check back later for new review requests."
              : filter === 'completed'
              ? 'Reviews you complete will appear here.'
              : 'When you request feedback on content, it will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Title and Link */}
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/pipeline/${review.sessionId}/step-${review.step || 1}-${STEP_SLUGS[(review.step || 1) - 1]}`}
                      className="font-medium text-brand-primary hover:text-brand-accent"
                    >
                      {review.sessionTitle || 'Untitled'}
                    </Link>
                    {getStatusBadge(review.status)}
                    {review.step && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {STEP_NAMES[review.step - 1]}
                      </span>
                    )}
                  </div>

                  {/* Requester Info */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    {filter === 'requested' ? (
                      <>
                        <span>Sent to</span>
                        {review.reviewerImage ? (
                          <img src={review.reviewerImage} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white">
                            {review.reviewerName?.[0] || '?'}
                          </div>
                        )}
                        <span className="font-medium text-gray-700">{review.reviewerName}</span>
                      </>
                    ) : (
                      <>
                        <span>From</span>
                        {review.requesterImage ? (
                          <img src={review.requesterImage} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white">
                            {review.requesterName?.[0] || '?'}
                          </div>
                        )}
                        <span className="font-medium text-gray-700">{review.requesterName}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formatDate(review.createdAt)}</span>
                  </div>

                  {/* Note */}
                  {review.note && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 mb-3">
                      <span className="font-medium text-gray-700">Note:</span> {review.note}
                    </div>
                  )}

                  {/* Response Note */}
                  {review.responseNote && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700 mb-3">
                      <span className="font-medium">Feedback:</span> {review.responseNote}
                    </div>
                  )}

                  {/* Respond Form (for pending reviews where user is reviewer) */}
                  {filter === 'pending' && review.status === 'pending' && (
                    respondingTo === review.id ? (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={responseNote}
                          onChange={(e) => setResponseNote(e.target.value)}
                          placeholder="Add feedback (optional)..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(review.id, review.sessionId, 'approved')}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => handleRespond(review.id, review.sessionId, 'changes_requested')}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Request Changes
                          </button>
                          <button
                            onClick={() => {
                              setRespondingTo(null);
                              setResponseNote('');
                            }}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`/pipeline/${review.sessionId}/step-${review.step || 1}-${STEP_SLUGS[(review.step || 1) - 1]}`}
                          className="px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                        >
                          View Content
                        </Link>
                        <button
                          onClick={() => setRespondingTo(review.id)}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                        >
                          Respond
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
