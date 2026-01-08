'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { ContentQueueItem } from '@/types/session';

export default function Step1Topic() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, updateSession, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [source, setSource] = useState<'queue' | 'custom'>(session?.topic.source || 'custom');
  const [title, setTitle] = useState(session?.topic.title || '');
  const [slug, setSlug] = useState(session?.topic.slug || '');
  const [outline, setOutline] = useState(session?.topic.outline || '');
  const [notes, setNotes] = useState(session?.notes || '');
  const [queueItems, setQueueItems] = useState<ContentQueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<ContentQueueItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Save notes when they change (debounced)
  const handleNotesChange = (value: string) => {
    setNotes(value);
    updateSession(sessionId, { notes: value });
  };

  // Load queue items on mount
  useEffect(() => {
    loadQueueItems();
  }, []);

  const loadQueueItems = async () => {
    try {
      const res = await fetch('/api/content-queue');
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  };

  const handleSelectQueueItem = (item: ContentQueueItem) => {
    setSelectedQueueItem(item);
    setTitle(item.title);
    setSlug(item.slug);
  };

  const handleContinue = () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    updateStepData(sessionId, 'topic', {
      source,
      title: title.trim(),
      slug: finalSlug,
      outline: outline.trim(),
    });

    setCurrentStep(sessionId, 2);
    router.push(`/pipeline/${sessionId}/step-2-blog`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-primary mb-2">
        Step 1: Select Topic
      </h2>
      <p className="text-gray-500 mb-8">
        Choose a topic from the queue or enter a custom topic
      </p>

      {/* Session Notes */}
      <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 mb-6">
        <label className="block text-sm font-medium text-yellow-800 mb-2">
          Session Notes (for your reference)
        </label>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add any notes about this content piece - reminders, context, feedback from team..."
          rows={2}
          className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm bg-white"
        />
        <p className="text-xs text-yellow-700 mt-1">
          These notes are saved automatically and visible on all steps.
        </p>
      </div>

      {/* Source Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSource('queue')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            source === 'queue'
              ? 'bg-brand-accent text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          From Queue
        </button>
        <button
          onClick={() => setSource('custom')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            source === 'custom'
              ? 'bg-brand-accent text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Custom Topic
        </button>
      </div>

      {source === 'queue' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-brand-primary mb-4">Content Queue</h3>

          {queueItems.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No queue items available. Use custom topic instead.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {queueItems.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectQueueItem(item)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedQueueItem?.id === item.id
                      ? 'border-brand-accent bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.pillar} • {item.funnel} • Priority {item.priority}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Topic Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-brand-primary mb-4">Topic Details</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How to Calculate ROI on Capital Improvements"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="calculate-roi-capital-improvements"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to auto-generate from title
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outline / Notes (optional)
            </label>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="Key points to cover, target audience, etc."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!title.trim() || loading}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue to Blog Draft
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
