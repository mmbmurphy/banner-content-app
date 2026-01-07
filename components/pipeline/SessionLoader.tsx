'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { PipelineSession } from '@/types/session';

interface SessionLoaderProps {
  sessionId: string;
  children: (session: PipelineSession) => React.ReactNode;
}

export function SessionLoader({ sessionId, children }: SessionLoaderProps) {
  const router = useRouter();
  const { loadSession, loadSessionFromApi } = usePipelineStore();
  const [session, setSession] = useState<PipelineSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // First try local storage
      let sessionData = loadSession(sessionId);

      // If not found locally, try API
      if (!sessionData) {
        sessionData = await loadSessionFromApi(sessionId);
      }

      if (sessionData) {
        setSession(sessionData);
      } else {
        setNotFound(true);
      }

      setLoading(false);
    }

    loadData();
  }, [sessionId, loadSession, loadSessionFromApi]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-accent"></div>
          <span className="text-gray-600">Loading session...</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">
            Session Not Found
          </h2>
          <p className="text-yellow-700 mb-6">
            This session may have expired or doesn&apos;t exist.
            Sessions are automatically deleted after 7 days.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="bg-brand-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-opacity-90 transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push('/pipeline/new')}
              className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
            >
              Start New Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(session!)}</>;
}
