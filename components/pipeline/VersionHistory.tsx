'use client';

import { useState, useEffect } from 'react';

interface Version {
  id: string;
  session_id: string;
  step: string;
  content: unknown;
  prompt_used: string | null;
  created_at: string;
  created_by: string | null;
}

interface VersionHistoryProps {
  sessionId: string;
  step: string;
  onRestore: (content: unknown) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function VersionHistory({ sessionId, step, onRestore, isOpen, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, sessionId, step]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/versions?sessionId=${sessionId}&step=${step}`);
      const data = await res.json();
      if (data.versions) {
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (version: Version) => {
    onRestore(version.content);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getContentPreview = (content: unknown): string => {
    if (typeof content === 'string') {
      return content.substring(0, 100) + (content.length > 100 ? '...' : '');
    }
    if (typeof content === 'object' && content !== null) {
      // For blog content
      if ('content' in content && typeof (content as { content: string }).content === 'string') {
        const text = (content as { content: string }).content;
        return text.substring(0, 100) + (text.length > 100 ? '...' : '');
      }
      // For posts array
      if (Array.isArray(content) && content.length > 0) {
        return `${content.length} items`;
      }
      // For carousel
      if ('slides' in content && Array.isArray((content as { slides: unknown[] }).slides)) {
        return `${(content as { slides: unknown[] }).slides.length} slides`;
      }
    }
    return 'Content saved';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-brand-primary">
            Version History
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-accent"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No versions saved yet.</p>
              <p className="text-sm mt-1">Versions are saved automatically when you generate or edit content.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`p-4 rounded-lg border cursor-pointer transition ${
                    selectedVersion?.id === version.id
                      ? 'border-brand-accent bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                  onClick={() => setSelectedVersion(version)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-brand-primary">
                        {index === 0 ? 'Latest' : `Version ${versions.length - index}`}
                      </span>
                      {index === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(version.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2">
                    {getContentPreview(version.content)}
                  </p>

                  {version.prompt_used && (
                    <p className="text-xs text-gray-400 mt-2 italic truncate">
                      Prompt: {version.prompt_used}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedVersion && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setSelectedVersion(null)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={() => handleRestore(selectedVersion)}
              className="px-4 py-2 bg-brand-accent text-white rounded-lg font-medium hover:bg-blue-600 transition"
            >
              Restore This Version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to save a version (can be called from step pages)
export async function saveVersion(
  sessionId: string,
  step: string,
  content: unknown,
  promptUsed?: string
) {
  try {
    await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        step,
        content,
        promptUsed,
      }),
    });
  } catch (error) {
    console.error('Failed to save version:', error);
  }
}
