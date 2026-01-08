'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { LinkedInPost } from '@/types/session';
import { CollaborationPanel } from '@/components/collaboration';

export default function Step7Queue() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, updateSession } = usePipelineStore();
  const session = loadSession(sessionId);

  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(
    new Set(session?.queue.postsQueued || [])
  );
  const [isQueuing, setIsQueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const posts = session?.linkedin.posts || [];

  // Toggle post selection
  const togglePost = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map((p) => p.id)));
    }
  };

  // Queue selected posts to RecurPost via Zapier
  const handleQueue = async () => {
    if (selectedPosts.size === 0) {
      setError('Please select at least one post to queue');
      return;
    }

    setIsQueuing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const postsToQueue = posts.filter((p) => selectedPosts.has(p.id));

      const res = await fetch('/api/zapier/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: postsToQueue.map((post) => ({
            content: post.content,
            type: post.type,
            hook_line: post.hook_line,
            hashtags: post.hashtags,
            articleUrl: `https://www.withbanner.com/info/${session?.topic.slug}`,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to queue posts');
      }

      const data = await res.json();

      setSuccessMessage(`Successfully queued ${data.queued} posts to RecurPost!`);

      // Update store
      updateStepData(sessionId, 'queue', {
        postsQueued: Array.from(selectedPosts),
        status: 'queued',
      });

      // Mark session as completed
      updateSession(sessionId, { status: 'completed' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue posts');
    } finally {
      setIsQueuing(false);
    }
  };

  // Finish and return to dashboard
  const handleFinish = () => {
    router.push('/');
  };

  // Go back
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-6-export`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 7: Queue to RecurPost
          </h2>
          <p className="text-gray-500">
            Select posts to queue for scheduling in RecurPost
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {successMessage}
        </div>
      )}

      {/* Post Selection */}
      {posts.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-medium">
              {selectedPosts.size} of {posts.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="text-sm text-brand-accent hover:underline"
            >
              {selectedPosts.size === posts.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`p-4 cursor-pointer transition ${
                  selectedPosts.has(post.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => togglePost(post.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePost(post.id)}
                    className="mt-1 h-4 w-4 text-brand-accent rounded border-gray-300 focus:ring-brand-accent"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium uppercase text-gray-500">
                        {post.type.replace('_', ' ')}
                      </span>
                      {post.isEdited && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Edited
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 line-clamp-3">
                      {post.content}
                    </p>

                    <div className="flex gap-2 mt-2">
                      {post.hashtags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center mb-6">
          <p className="text-gray-500">No LinkedIn posts available</p>
          <p className="text-sm text-gray-400 mt-1">
            Please complete Step 3 first
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handleQueue}
          disabled={isQueuing || selectedPosts.size === 0}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isQueuing ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Queuing...
            </>
          ) : (
            `Queue ${selectedPosts.size} Post${selectedPosts.size !== 1 ? 's' : ''}`
          )}
        </button>
      </div>

      {/* Completion Status */}
      {session?.queue.status === 'queued' && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl">
              ✓
            </span>
            <div>
              <h3 className="font-semibold text-green-800">Pipeline Complete!</h3>
              <p className="text-sm text-green-700">
                All content has been created, exported, and queued for publishing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
        >
          <span>←</span>
          Back to Export
        </button>

        <button
          onClick={handleFinish}
          className="bg-brand-green text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center gap-2"
        >
          Finish
          <span>→</span>
        </button>
      </div>

      {/* Collaboration Panel */}
      <div className="mt-8">
        <CollaborationPanel
          sessionId={sessionId}
          sessionTitle={session?.topic.title || 'Untitled'}
          currentStep={7}
        />
      </div>
    </div>
  );
}
