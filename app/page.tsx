'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { PipelineSession } from '@/types/session';

const STEP_NAMES = [
  'Topic',
  'Blog Draft',
  'LinkedIn Posts',
  'Carousel',
  'PDF',
  'Export',
  'Queue',
];

// URL slugs must match the actual folder names
const STEP_SLUGS = [
  'topic',
  'blog',
  'linkedin',
  'carousel',
  'pdf',
  'export',
  'queue',
];

export default function Dashboard() {
  const router = useRouter();
  const { createSession, getAllSessions, deleteSession, fetchSessionsFromApi, isLoading, apiInitialized } = usePipelineStore();
  const [sessions, setSessions] = useState<PipelineSession[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'needs_init' | 'error'>('checking');

  const refreshSessions = useCallback(() => {
    setSessions(getAllSessions());
  }, [getAllSessions]);

  useEffect(() => {
    setMounted(true);

    // Fetch from API first, then refresh local display
    async function init() {
      await fetchSessionsFromApi();
      refreshSessions();
      setDbStatus(apiInitialized ? 'ready' : 'needs_init');
    }

    init();
  }, [fetchSessionsFromApi, refreshSessions, apiInitialized]);

  // Initialize database if needed
  const handleInitDb = async () => {
    setDbStatus('checking');
    try {
      const res = await fetch('/api/sessions/init');
      if (res.ok) {
        setDbStatus('ready');
        await fetchSessionsFromApi();
        refreshSessions();
      } else {
        setDbStatus('error');
      }
    } catch {
      setDbStatus('error');
    }
  };

  const handleNewPipeline = () => {
    const sessionId = createSession();
    router.push(`/pipeline/${sessionId}/step-1-topic`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      deleteSession(id);
      refreshSessions();
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Database initialization banner */}
      {dbStatus === 'needs_init' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-800 font-medium">Database not initialized</p>
              <p className="text-yellow-700 text-sm">Click to set up persistent storage for your sessions.</p>
            </div>
            <button
              onClick={handleInitDb}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600 transition"
            >
              Initialize Database
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-accent"></div>
          <span className="text-sm">Syncing sessions...</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-brand-primary">Dashboard</h2>
        <button
          onClick={handleNewPipeline}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          New Pipeline
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No pipelines yet
          </h3>
          <p className="text-gray-500 mb-6">
            Start by creating a new content pipeline
          </p>
          <button
            onClick={handleNewPipeline}
            className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
          >
            Create First Pipeline
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Recent Sessions
          </h3>
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-accent hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-brand-primary">
                    {session.topic.title || session.topic.slug || 'Untitled'}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Step {session.currentStep} of 7 —{' '}
                    {STEP_NAMES[session.currentStep - 1]}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Created {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {STEP_NAMES.map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < session.currentStep
                            ? 'bg-brand-green'
                            : i === session.currentStep - 1
                            ? 'bg-brand-accent'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete session"
                  >
                    ×
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
