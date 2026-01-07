'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { LinkedInPost, CarouselData } from '@/types/session';

export default function Step3LinkedIn() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [posts, setPosts] = useState<LinkedInPost[]>(session?.linkedin.posts || []);
  const [carousel, setCarousel] = useState<Partial<CarouselData>>(session?.linkedin.carousel || {});
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingPostId, setRegeneratingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [postPrompts, setPostPrompts] = useState<Record<string, string>>({});

  // Generate LinkedIn content from Claude
  const handleGenerate = async () => {
    if (!session?.blog.content) {
      setError('No blog content available. Please complete Step 2 first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setErrorDetails(null);

    try {
      const res = await fetch('/api/claude/generate-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: session.topic.title,
          slug: session.topic.slug,
          content: session.blog.content,
          customPrompt: customPrompt,
        }),
      });

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        setError('Server returned an invalid response');
        setErrorDetails(responseText.substring(0, 300));
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to generate LinkedIn content');
        setErrorDetails(data.details || `Status: ${res.status}`);
        return;
      }

      setPosts(data.posts);
      setCarousel(data.carousel);

      // Save to store
      updateStepData(sessionId, 'linkedin', {
        posts: data.posts,
        carousel: data.carousel,
        regenerationCount: (session.linkedin.regenerationCount || 0) + 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
      setErrorDetails('Network error or server unavailable. Check browser console for details.');
      console.error('LinkedIn generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate a single post with feedback
  const handleRegeneratePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const feedback = postPrompts[postId];
    if (!feedback?.trim()) {
      setError('Please enter feedback for how you want to change this post');
      return;
    }

    setRegeneratingPostId(postId);
    setError(null);
    setErrorDetails(null);

    try {
      const res = await fetch('/api/claude/regenerate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPost: post.content,
          feedback: feedback,
          title: session?.topic.title,
          slug: session?.topic.slug,
          postType: post.type,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to regenerate post');
        setErrorDetails(data.details);
        return;
      }

      // Update the post
      const updatedPosts = posts.map(p =>
        p.id === postId
          ? {
              ...p,
              content: data.content,
              hook_line: data.hook_line,
              hashtags: data.hashtags,
              isEdited: true,
            }
          : p
      );

      setPosts(updatedPosts);
      updateStepData(sessionId, 'linkedin', { posts: updatedPosts });

      // Clear the prompt
      setPostPrompts(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate post');
    } finally {
      setRegeneratingPostId(null);
    }
  };

  // Update a single post
  const handleUpdatePost = (postId: string, updates: Partial<LinkedInPost>) => {
    const updatedPosts = posts.map((post) =>
      post.id === postId ? { ...post, ...updates, isEdited: true } : post
    );
    setPosts(updatedPosts);
    updateStepData(sessionId, 'linkedin', { posts: updatedPosts });
  };

  // Copy post to clipboard
  const handleCopyPost = async (post: LinkedInPost) => {
    const hashtags = post.hashtags.slice(0, 3).join(' ');
    const articleLink = `https://www.withbanner.com/info/${session?.topic.slug}`;
    const fullContent = `${post.content}\n\n${articleLink}\n\n${hashtags}`;

    await navigator.clipboard.writeText(fullContent);
    alert('Post copied to clipboard!');
  };

  // Continue to next step
  const handleContinue = () => {
    if (posts.length === 0) {
      setError('Please generate LinkedIn posts first');
      return;
    }

    // Save carousel slides to the carousel step
    if (carousel.slides && carousel.slides.length > 0) {
      updateStepData(sessionId, 'carousel', {
        slides: carousel.slides.map((slide) => ({
          ...slide,
          type: slide.slideNumber === 1 ? 'hook' : slide.slideNumber === carousel.slides?.length ? 'cta' : 'content',
        })),
      });
    }

    setCurrentStep(sessionId, 4);
    router.push(`/pipeline/${sessionId}/step-4-carousel`);
  };

  // Go back to previous step
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-2-blog`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 3: LinkedIn Posts
          </h2>
          <p className="text-gray-500">
            Generate LinkedIn posts and carousel content from your blog
          </p>
        </div>

        <div className="bg-gray-50 px-4 py-2 rounded-lg">
          <p className="text-sm text-gray-500">Topic:</p>
          <p className="font-medium text-brand-primary truncate max-w-xs">
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
          placeholder="e.g., Focus on ROI metrics, make it more technical, add a personal anecdote hook, target CFOs..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Guide the AI on tone, focus areas, or specific angles for the LinkedIn posts.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !session?.blog.content}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Generating...
            </>
          ) : posts.length > 0 ? (
            'Regenerate All'
          ) : (
            'Generate LinkedIn Content'
          )}
        </button>
      </div>

      {/* Posts Section */}
      {posts.length > 0 && (
        <div className="space-y-6 mb-8">
          <h3 className="text-lg font-semibold text-brand-primary">
            LinkedIn Posts ({posts.length})
          </h3>

          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">
                    {post.type.replace('_', ' ')}
                  </span>
                  {post.isEdited && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      Edited
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPostId(editingPostId === post.id ? null : post.id)}
                    className="text-sm text-brand-accent hover:underline"
                  >
                    {editingPostId === post.id ? 'Done' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleCopyPost(post)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="p-4">
                {editingPostId === post.id ? (
                  <textarea
                    value={post.content}
                    onChange={(e) => handleUpdatePost(post.id, { content: e.target.value })}
                    className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none text-sm"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">
                    {post.content}
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  {post.hashtags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Individual Post Regeneration */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={postPrompts[post.id] || ''}
                      onChange={(e) => setPostPrompts(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="e.g., Make it shorter, add statistics, more conversational tone..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                    />
                    <button
                      onClick={() => handleRegeneratePost(post.id)}
                      disabled={regeneratingPostId === post.id || !postPrompts[post.id]?.trim()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {regeneratingPostId === post.id ? (
                        <>
                          <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></span>
                          Regenerating...
                        </>
                      ) : (
                        'Regenerate'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Describe how you want to change this post
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carousel Preview */}
      {carousel.slides && carousel.slides.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-brand-primary mb-4">
            Carousel Preview ({carousel.slides.length} slides)
          </h3>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {/* Hook */}
            {carousel.hook && (
              <div className="mb-4 p-3 bg-brand-primary text-white rounded-lg">
                <p className="font-bold text-lg">{carousel.hook}</p>
              </div>
            )}

            {/* Slides */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {carousel.slides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <p className="text-xs text-gray-500 mb-1">Slide {idx + 1}</p>
                  <p className="font-medium text-sm text-brand-primary">
                    {slide.headline}
                  </p>
                  {slide.subhead && (
                    <p className="text-xs text-gray-600 mt-1">{slide.subhead}</p>
                  )}
                </div>
              ))}
            </div>

            {/* CTA Slide */}
            {carousel.cta_slide && (
              <div className="mt-4 p-3 bg-brand-accent text-white rounded-lg">
                <p className="font-medium">{carousel.cta_slide.headline}</p>
                <p className="text-sm opacity-80">{carousel.cta_slide.url}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {posts.length === 0 && !isGenerating && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">
            No LinkedIn content generated yet.
          </p>
          <p className="text-sm text-gray-400">
            Click &quot;Generate LinkedIn Content&quot; to create posts from your blog.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={handleBack}
          className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
        >
          <span>←</span>
          Back to Blog
        </button>

        <button
          onClick={handleContinue}
          disabled={posts.length === 0}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue to Carousel
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
