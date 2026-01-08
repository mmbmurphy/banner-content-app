'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { CarouselSlide } from '@/types/session';
import { VersionHistory, saveVersion } from '@/components/pipeline/VersionHistory';
import { SessionNotes } from '@/components/pipeline/SessionNotes';
import { CollaborationPanel } from '@/components/collaboration';

// Brand colors for carousel
const BRAND = {
  PRIMARY: '#101828',
  ACCENT: '#0082F3',
  CORAL: '#FF7469',
  WHITE: '#FFFFFF',
  GRAY: '#758696',
};

export default function Step4Carousel() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const session = loadSession(sessionId);

  const [slides, setSlides] = useState<CarouselSlide[]>(
    (session?.carousel.slides?.length ?? 0) > 0
      ? session!.carousel.slides
      : session?.linkedin.carousel?.slides || []
  );
  const [hook, setHook] = useState(session?.linkedin.carousel?.hook || '');
  const [ctaSlide, setCtaSlide] = useState(session?.linkedin.carousel?.cta_slide || {
    headline: 'Read the Full Guide',
    url: `withbanner.com/info/${session?.topic.slug}`,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>(session?.carousel.imageUrls || []);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [carouselPrompt, setCarouselPrompt] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Regenerate carousel content with AI
  const handleRegenerateCarousel = async () => {
    if (!carouselPrompt.trim()) {
      setError('Please enter feedback for how you want to change the carousel');
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/claude/regenerate-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook,
          slides: slides.map(s => ({ headline: s.headline, subhead: s.subhead })),
          feedback: carouselPrompt,
          title: session?.topic.title,
          slug: session?.topic.slug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to regenerate carousel');
        return;
      }

      setHook(data.hook);
      setSlides(data.slides);
      if (data.cta_slide) {
        setCtaSlide(data.cta_slide);
      }

      // Clear generated images since content changed
      setGeneratedImages([]);

      // Save to store
      updateStepData(sessionId, 'carousel', {
        slides: data.slides,
        imageUrls: [],
        status: 'pending',
      });
      updateStepData(sessionId, 'linkedin', {
        carousel: {
          ...session?.linkedin.carousel,
          hook: data.hook,
          slides: data.slides,
          cta_slide: data.cta_slide,
        },
      });

      // Save version for history
      saveVersion(sessionId, 'carousel', {
        hook: data.hook,
        slides: data.slides,
        cta_slide: data.cta_slide,
      }, carouselPrompt);

      setCarouselPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate carousel');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Update a single slide
  const handleUpdateSlide = (slideId: string, updates: Partial<CarouselSlide>) => {
    const updatedSlides = slides.map((slide) =>
      slide.id === slideId ? { ...slide, ...updates, isEdited: true } : slide
    );
    setSlides(updatedSlides);
    updateStepData(sessionId, 'carousel', { slides: updatedSlides });
  };

  // Add a new slide
  const handleAddSlide = () => {
    const newSlide: CarouselSlide = {
      id: `slide_${Date.now()}`,
      slideNumber: slides.length + 1,
      type: 'content',
      headline: 'New Slide',
      subhead: '',
      isEdited: false,
    };
    const updatedSlides = [...slides, newSlide];
    setSlides(updatedSlides);
    updateStepData(sessionId, 'carousel', { slides: updatedSlides });
    setEditingSlideId(newSlide.id);
  };

  // Remove a slide
  const handleRemoveSlide = (slideId: string) => {
    const updatedSlides = slides.filter(s => s.id !== slideId);
    setSlides(updatedSlides);
    updateStepData(sessionId, 'carousel', { slides: updatedSlides });
  };

  // Generate slide image using canvas
  const generateSlideImage = useCallback(
    async (slideIndex: number): Promise<string> => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;

        const slide = slides[slideIndex];
        const isHookSlide = slideIndex === 0;
        const isCtaSlide = slideIndex === slides.length;

        // Background
        ctx.fillStyle = isHookSlide ? BRAND.PRIMARY : BRAND.WHITE;
        ctx.fillRect(0, 0, 1080, 1080);

        // Accent bar
        ctx.fillStyle = BRAND.CORAL;
        ctx.fillRect(0, 0, 1080, 8);

        if (isHookSlide) {
          // Hook slide
          ctx.fillStyle = BRAND.WHITE;
          ctx.font = 'bold 64px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          wrapText(ctx, hook, 540, 480, 900, 80);
        } else if (isCtaSlide) {
          // CTA slide
          ctx.fillStyle = BRAND.PRIMARY;
          ctx.font = 'bold 56px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ctaSlide.headline || 'Read the Full Guide', 540, 440);

          ctx.fillStyle = BRAND.ACCENT;
          ctx.font = '36px Inter, system-ui, sans-serif';
          ctx.fillText(ctaSlide.url || `withbanner.com/info/${session?.topic.slug}`, 540, 540);

          // Logo placeholder
          ctx.fillStyle = BRAND.ACCENT;
          ctx.beginPath();
          ctx.arc(540, 720, 50, 0, Math.PI * 2);
          ctx.fill();
        } else if (slide) {
          // Content slide
          ctx.fillStyle = BRAND.PRIMARY;
          ctx.font = 'bold 48px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          wrapText(ctx, slide.headline, 540, 380, 900, 64);

          if (slide.subhead) {
            ctx.fillStyle = BRAND.GRAY;
            ctx.font = '32px Inter, system-ui, sans-serif';
            wrapText(ctx, slide.subhead, 540, 580, 900, 48);
          }

          // Slide number
          ctx.fillStyle = BRAND.ACCENT;
          ctx.font = 'bold 24px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${slideIndex}/${slides.length}`, 1000, 1000);
        }

        resolve(canvas.toDataURL('image/png'));
      });
    },
    [slides, hook, ctaSlide, session]
  );

  // Helper function to wrap text
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  // Generate all carousel images
  const handleGenerateImages = async () => {
    if (slides.length === 0) {
      setError('No carousel slides available');
      return;
    }

    setIsGenerating(true);
    setError(null);
    updateStepData(sessionId, 'carousel', { status: 'generating' });

    try {
      const images: string[] = [];

      // Generate hook slide
      images.push(await generateSlideImage(0));

      // Generate content slides
      for (let i = 0; i < slides.length; i++) {
        images.push(await generateSlideImage(i + 1));
      }

      // Generate CTA slide
      images.push(await generateSlideImage(slides.length + 1));

      setGeneratedImages(images);
      updateStepData(sessionId, 'carousel', {
        imageUrls: images,
        status: 'complete',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images');
      updateStepData(sessionId, 'carousel', { status: 'pending' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download all images as a zip (simplified - downloads each individually)
  const handleDownloadAll = () => {
    generatedImages.forEach((dataUrl, index) => {
      const link = document.createElement('a');
      link.download = `carousel-slide-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    });
  };

  // Continue to next step
  const handleContinue = () => {
    if (generatedImages.length === 0) {
      setError('Please generate carousel images first');
      return;
    }

    setCurrentStep(sessionId, 5);
    router.push(`/pipeline/${sessionId}/step-5-pdf`);
  };

  // Go back
  const handleBack = () => {
    router.push(`/pipeline/${sessionId}/step-3-linkedin`);
  };

  // Restore from version history
  const handleRestoreVersion = (versionContent: unknown) => {
    const restored = versionContent as {
      hook: string;
      slides: CarouselSlide[];
      cta_slide?: { headline: string; url: string };
    };
    setHook(restored.hook || '');
    setSlides(restored.slides || []);
    if (restored.cta_slide) {
      setCtaSlide(restored.cta_slide);
    }
    setGeneratedImages([]); // Clear images since content changed
    updateStepData(sessionId, 'carousel', {
      slides: restored.slides,
      imageUrls: [],
      status: 'pending',
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-2">
            Step 4: Carousel Images
          </h2>
          <p className="text-gray-500">
            Edit slides and generate carousel images
          </p>
        </div>
      </div>

      {/* Session Notes */}
      <div className="mb-6">
        <SessionNotes sessionId={sessionId} compact />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* AI Regeneration Prompt */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Regenerate Carousel with AI
        </label>
        <div className="flex gap-2">
          <textarea
            value={carouselPrompt}
            onChange={(e) => setCarouselPrompt(e.target.value)}
            placeholder="e.g., Make it more concise, add more statistics, focus on benefits, create urgency..."
            rows={2}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
          />
          <button
            onClick={handleRegenerateCarousel}
            disabled={isRegenerating || !carouselPrompt.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
          >
            {isRegenerating ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Regenerating...
              </>
            ) : (
              'Regenerate with AI'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Describe how you want to improve the carousel slides. AI will regenerate all slide content.
        </p>
      </div>

      {/* Hook Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hook (Slide 1)
        </label>
        <input
          type="text"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="Compelling question or statement..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
        />
      </div>

      {/* Slides Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-brand-primary">
            Content Slides ({slides.length})
          </h3>
          <button
            onClick={handleAddSlide}
            className="text-sm text-brand-accent hover:underline"
          >
            + Add Slide
          </button>
        </div>

        <div className="space-y-4">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">
                  Slide {idx + 2}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditingSlideId(editingSlideId === slide.id ? null : slide.id)
                    }
                    className="text-sm text-brand-accent hover:underline"
                  >
                    {editingSlideId === slide.id ? 'Done' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleRemoveSlide(slide.id)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {editingSlideId === slide.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={slide.headline}
                    onChange={(e) =>
                      handleUpdateSlide(slide.id, { headline: e.target.value })
                    }
                    placeholder="Headline"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={slide.subhead || ''}
                    onChange={(e) =>
                      handleUpdateSlide(slide.id, { subhead: e.target.value })
                    }
                    placeholder="Subhead"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ) : (
                <div>
                  <p className="font-medium text-brand-primary">{slide.headline}</p>
                  {slide.subhead && (
                    <p className="text-sm text-gray-600 mt-1">{slide.subhead}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA Slide Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          CTA Slide (Last Slide)
        </label>
        <div className="space-y-2">
          <input
            type="text"
            value={ctaSlide.headline}
            onChange={(e) => setCtaSlide({ ...ctaSlide, headline: e.target.value })}
            placeholder="Call to action headline"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
          />
          <input
            type="text"
            value={ctaSlide.url}
            onChange={(e) => setCtaSlide({ ...ctaSlide, url: e.target.value })}
            placeholder="URL"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleGenerateImages}
          disabled={isGenerating || slides.length === 0}
          className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Generating...
            </>
          ) : generatedImages.length > 0 ? (
            'Regenerate Images'
          ) : (
            'Generate Images'
          )}
        </button>

        {generatedImages.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="bg-brand-green text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition"
          >
            Download All
          </button>
        )}

        {slides.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
        )}
      </div>

      {/* Image Preview */}
      {generatedImages.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-brand-primary mb-4">
            Generated Images ({generatedImages.length})
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {generatedImages.map((dataUrl, idx) => (
              <div key={idx} className="relative aspect-square">
                <img
                  src={dataUrl}
                  alt={`Slide ${idx + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                />
                <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}
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
          Back to LinkedIn
        </button>

        <button
          onClick={handleContinue}
          disabled={generatedImages.length === 0}
          className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue to PDF
          <span>→</span>
        </button>
      </div>

      {/* Collaboration Panel */}
      <div className="mt-8">
        <CollaborationPanel
          sessionId={sessionId}
          sessionTitle={session?.topic.title || 'Untitled'}
          currentStep={4}
        />
      </div>

      {/* Version History Modal */}
      <VersionHistory
        sessionId={sessionId}
        step="carousel"
        onRestore={handleRestoreVersion}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}
