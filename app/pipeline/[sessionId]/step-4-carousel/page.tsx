'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { CarouselSlide } from '@/types/session';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>(session?.carousel.imageUrls || []);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update a single slide
  const handleUpdateSlide = (slideId: string, updates: Partial<CarouselSlide>) => {
    const updatedSlides = slides.map((slide) =>
      slide.id === slideId ? { ...slide, ...updates, isEdited: true } : slide
    );
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
          const ctaSlide = session?.linkedin.carousel?.cta_slide;
          ctx.fillStyle = BRAND.PRIMARY;
          ctx.font = 'bold 56px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ctaSlide?.headline || 'Read the Full Guide', 540, 440);

          ctx.fillStyle = BRAND.ACCENT;
          ctx.font = '36px Inter, system-ui, sans-serif';
          ctx.fillText(ctaSlide?.url || `withbanner.com/info/${session?.topic.slug}`, 540, 540);

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
    [slides, hook, session]
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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

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
        <h3 className="font-semibold text-brand-primary mb-4">
          Content Slides ({slides.length})
        </h3>

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
                <button
                  onClick={() =>
                    setEditingSlideId(editingSlideId === slide.id ? null : slide.id)
                  }
                  className="text-sm text-brand-accent hover:underline"
                >
                  {editingSlideId === slide.id ? 'Done' : 'Edit'}
                </button>
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
    </div>
  );
}
