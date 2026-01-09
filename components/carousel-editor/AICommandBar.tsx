'use client';

import { useState, useRef, useEffect } from 'react';
import type { LayeredSlide } from '@/types/carousel-layers';
import type { BrandKit } from '@/types/brand';

interface AICommandBarProps {
  slides: LayeredSlide[];
  currentSlideIndex: number;
  brandKit: BrandKit;
  context?: {
    topic?: string;
    hook?: string;
  };
  onSlidesUpdate: (slides: LayeredSlide[]) => void;
}

const EXAMPLE_COMMANDS = [
  "Make the hook text bigger and bolder",
  "Change background to a dark blue gradient",
  "Add a subheading below the main text",
  "Make slide 3 text more concise",
  "Change all backgrounds to white",
  "Increase font size on all slides",
  "Rewrite the hook to be more attention-grabbing",
  "Add slide numbers to bottom right",
];

export function AICommandBar({
  slides,
  currentSlideIndex,
  brandKit,
  context,
  onSlidesUpdate,
}: AICommandBarProps) {
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to focus (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!command.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setShowExamples(false);

    try {
      const response = await fetch('/api/claude/edit-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.trim(),
          slides,
          currentSlideIndex,
          brandKit,
          context,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process command');
      }

      if (!data.slides || !Array.isArray(data.slides)) {
        throw new Error('Invalid response from AI');
      }

      onSlidesUpdate(data.slides);
      setCommand('');
    } catch (err) {
      console.error('AI edit error:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setCommand(example);
    setShowExamples(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setError(null);
            }}
            onFocus={() => setShowExamples(true)}
            onBlur={() => setTimeout(() => setShowExamples(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && command.trim() && !isLoading) {
                handleSubmit(e);
              }
            }}
            placeholder="Ask AI to edit slides... (Cmd+K)"
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Example commands dropdown */}
          {showExamples && !command && !error && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-500">Example commands</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {EXAMPLE_COMMANDS.map((example, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!command.trim() || isLoading}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {isLoading ? 'Updating...' : 'Apply'}
        </button>
      </div>

      {/* Error message - inline, not overlapping */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
