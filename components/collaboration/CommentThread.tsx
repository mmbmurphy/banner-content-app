'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { Comment } from '@/types/collaboration';

interface CommentThreadProps {
  sessionId: string;
  step?: number; // undefined = session-level comments
  placeholder?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CommentThread({ sessionId, step, placeholder = 'Add a comment...' }: CommentThreadProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
  }, [sessionId, step]);

  async function fetchComments() {
    try {
      const stepParam = step !== undefined ? `?step=${step}` : '';
      const res = await fetch(`/api/sessions/${sessionId}/comments${stepParam}`);
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          content: newComment.trim(),
        }),
      });

      const data = await res.json();
      if (data.comment) {
        setComments([...comments, data.comment]);
        setNewComment('');
        setExpanded(true);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;

    try {
      await fetch(`/api/sessions/${sessionId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  }

  const currentUserId = session?.user?.email; // We'll match by email since we have it

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const displayComments = expanded ? comments : comments.slice(-3);
  const hasMore = comments.length > 3 && !expanded;

  return (
    <div className="space-y-3">
      {/* Comment List */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-brand-accent hover:underline"
            >
              Show {comments.length - 3} earlier comments
            </button>
          )}

          {displayComments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3 group">
              <div className="flex-shrink-0">
                {comment.userImage ? (
                  <img
                    src={comment.userImage}
                    alt={comment.userName}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-accent text-white flex items-center justify-center text-sm font-medium">
                    {comment.userName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">
                      {comment.userName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
              {session?.user && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 transition-opacity"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      {session?.user ? (
        <form onSubmit={handleSubmit} className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ''}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-accent text-white flex items-center justify-center text-sm font-medium">
                {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={placeholder}
              rows={1}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            {newComment.trim() && (
              <button
                type="submit"
                disabled={submitting}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-accent hover:text-blue-700 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500 italic">Sign in to comment</p>
      )}
    </div>
  );
}
