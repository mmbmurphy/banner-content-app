'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import { marked } from 'marked';

export default function Step2Blog() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [content, setContent] = useState(session?.blog.content || '');
  const [frontmatter, setFrontmatter] = useState(session?.blog.frontmatter || {});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [customPrompt, setCustomPrompt] = useState(session?.topic.outline || '');
  const [publishStatus, setPublishStatus] = useState<{
    success?: boolean;
    url?: string;
    message?: string;
  } | null>(null);

  // Generate blog content from Claude (streaming)
  const handleGenerate = async () => {
    if (!session?.topic.title) {
      setError('No topic selected');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setErrorDetails(null);
    setContent(''); // Clear existing content

    try {
      const res = await fetch('/api/claude/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: session.topic.title,
          slug: session.topic.slug,
          outline: customPrompt || session.topic.outline,
        }),
      });

      // Check if it's an error response (JSON) or streaming response
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        setError(data.error || 'Failed to generate blog');
        setErrorDetails(data.details || `Status: ${res.status}`);
        setIsGenerating(false);
        return;
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        setError('Failed to read response');
        setIsGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                streamedContent += data.text;
                setContent(streamedContent);
              }
              if (data.done && data.content) {
                streamedContent = data.content;
                setContent(streamedContent);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }

      // Parse frontmatter from final content
      const frontmatterMatch = streamedContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let parsedFrontmatter = { title: session.topic.title, slug: session.topic.slug };
      let markdownContent = streamedContent;

      if (frontmatterMatch) {
        const frontmatterYaml = frontmatterMatch[1];
        markdownContent = frontmatterMatch[2].trim();

        frontmatterYaml.split('\n').forEach((line: string) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            (parsedFrontmatter as Record<string, string>)[key] = value;
          }
        });
      }

      setFrontmatter(parsedFrontmatter);
      setContent(markdownContent);

      // Save to store
      updateStepData(sessionId, 'blog', {
        content: markdownContent,
        frontmatter: parsedFrontmatter,
        htmlContent: marked(markdownContent) as string,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate blog');
      setErrorDetails('Network error or server unavailable. Check browser console for details.');
      console.error('Blog generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Publish to Webflow
  const handlePublish = async () => {
    if (!content) {
      setError('No content to publish');
      return;
    }

    setIsPublishing(true);
    setError(null);
    setPublishStatus(null);

    try {
      const res = await fetch('/api/webflow/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter,
          content,
          existingItemId: session?.blog.webflowId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }

      const data = await res.json();

      setPublishStatus({
        success: true,
        url: data.publishedUrl,
        message: `Successfully ${data.action} and published!`,
      });

      // Update store with publish info
      updateStepData(sessionId, 'blog', {
        webflowId: data.itemId,
        publishedUrl: data.publishedUrl,
        status: 'published',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
      setPublishStatus({ success: false, message: 'Publishing failed' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Save content on change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    updateStepData(sessionId, 'blog', {
      content: newContent,
      htmlContent: marked(newContent) as string,
    });
  };

  // Continue to next step
  const handleContinue = () => {
    if (!content.trim()) {
      setError('Please generate or write blog content first');
      return;
    }

    setCurrentStep(sessionId, 3);
    router.push(`/pipeline/${sessionId}/step-3-linkedin`);
  };

  // Go back to previous step
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-1-topic`);
  };

  const htmlPreview = marked(content) as string;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 2: Blog Draft
          </h2>
          <p className="text-gray-500">
            Generate or edit your blog post, then publish to Webflow
          </p>
        </div>

        {/* Topic Info */}
        <div className="bg-gray-50 px-4 py-2 rounded-lg">
          <p className="text-sm text-gray-500">Topic:</p>
          <p className="font-medium text-brand-primary">
            {session?.topic.title || 'No topic selected'}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">{error}</p>
          {errorDetails && (
            <p className="text-sm mt-1 text-red-600">{errorDetails}</p>
          )}
        </div>
      )}

      {/* Custom Prompt */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instructions for AI (optional)
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Add specific instructions, key points to cover, target audience details, or any other guidance for the AI..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          These instructions will be sent to Claude when generating the blog post.
        </p>
      </div>

      {/* Success Display */}
      {publishStatus?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          <p>{publishStatus.message}</p>
          {publishStatus.url && (
            <a
              href={publishStatus.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 underline text-sm mt-1 block"
            >
              View published post
            </a>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Generating...
            </>
          ) : content ? (
            'Regenerate Draft'
          ) : (
            'Generate Draft'
          )}
        </button>

        {content && (
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="bg-brand-green text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Publishing...
              </>
            ) : session?.blog.status === 'published' ? (
              'Update on Webflow'
            ) : (
              'Publish to Webflow'
            )}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'edit'
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'preview'
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Editor/Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {activeTab === 'edit' ? (
          <div className="p-4">
            {/* Frontmatter Display */}
            {frontmatter && Object.keys(frontmatter).length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Frontmatter
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(frontmatter).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500">{key}:</span>{' '}
                      <span className="text-gray-700">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Markdown Editor */}
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Blog content will appear here after generation, or you can write your own markdown..."
              className="w-full h-96 px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
            />
          </div>
        ) : (
          <div className="p-6">
            {content ? (
              <article
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlPreview }}
              />
            ) : (
              <p className="text-gray-500 text-center py-12">
                No content to preview. Generate or write some content first.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Word Count */}
      {content && (
        <div className="text-sm text-gray-500 mb-6">
          {content.split(/\s+/).filter(Boolean).length} words |{' '}
          {Math.ceil(content.split(/\s+/).filter(Boolean).length / 200)} min read
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
        >
          <span>←</span>
          Back to Topic
        </button>

        <button
          onClick={handleContinue}
          disabled={!content.trim()}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue to LinkedIn
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
