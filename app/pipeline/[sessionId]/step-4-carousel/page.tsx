'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import { useBrandKitStore } from '@/lib/store/brand-kit-store';
import { useCarouselEditorStore } from '@/lib/store/carousel-editor-store';
import type { CarouselSlide } from '@/types/session';
import type { LayeredSlide } from '@/types/carousel-layers';
import { SlideEditor } from '@/components/carousel-editor';
import { migrateCarousel, extractCarouselContent } from '@/lib/utils/carousel-migration';
import { VersionHistory, saveVersion } from '@/components/pipeline/VersionHistory';

export default function Step4Carousel() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { loadSession, updateStepData, setCurrentStep } = usePipelineStore();
  const { brandKit, fetchBrandKit } = useBrandKitStore();
  const { resetEditor } = useCarouselEditorStore();

  const session = loadSession(sessionId);

  // Legacy state (for fallback/migration)
  const [showHistory, setShowHistory] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>(session?.carousel.imageUrls || []);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch brand kit on mount
  useEffect(() => {
    fetchBrandKit();
  }, [fetchBrandKit]);

  // Initialize editor with migrated slides (run once when session loads)
  useEffect(() => {
    if (!session || isInitialized) return;

    const oldSlides = session.carousel.slides?.length > 0
      ? session.carousel.slides
      : session.linkedin.carousel?.slides || [];

    const hook = session.linkedin.carousel?.hook || '';
    const ctaSlide = session.linkedin.carousel?.cta_slide || {
      headline: 'Read the Full Guide',
      url: `withbanner.com/info/${session.topic.slug}`,
    };

    // Check if we have layered slides stored
    const storedLayeredSlides = session.carousel.layeredSlides as LayeredSlide[] | undefined;

    if (storedLayeredSlides && storedLayeredSlides.length > 0) {
      // Use stored layered slides
      useCarouselEditorStore.getState().initializeEditor(storedLayeredSlides);
    } else if (oldSlides.length > 0 || hook) {
      // Migrate from old format
      const migratedSlides = migrateCarousel(oldSlides, hook, ctaSlide);
      useCarouselEditorStore.getState().initializeEditor(migratedSlides);
    } else {
      // No existing data - create default slides with hook, one content, and CTA
      const defaultSlides = migrateCarousel(
        [{ id: 'default_1', slideNumber: 1, type: 'content', headline: 'Your headline here', subhead: 'Add your supporting text', isEdited: false }],
        session.topic.title || 'Your Hook Here',
        ctaSlide
      );
      useCarouselEditorStore.getState().initializeEditor(defaultSlides);
    }

    setIsInitialized(true);
  }, [session, isInitialized]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      resetEditor();
    };
  }, [resetEditor]);

  // Save slides to session store
  const handleSave = useCallback((slides: LayeredSlide[]) => {
    // Extract content for backward compatibility
    const { hook, slides: oldSlides, ctaSlide } = extractCarouselContent(slides);

    // Save both formats
    updateStepData(sessionId, 'carousel', {
      slides: oldSlides,
      layeredSlides: slides,
      imageUrls: generatedImages,
    });

    // Update linkedin carousel data too
    updateStepData(sessionId, 'linkedin', {
      carousel: {
        ...session?.linkedin.carousel,
        hook,
        slides: oldSlides,
        cta_slide: ctaSlide,
      },
    });

    // Save version for history
    saveVersion(sessionId, 'carousel', {
      hook,
      slides: oldSlides,
      cta_slide: ctaSlide,
      layeredSlides: slides,
    }, 'Manual save');
  }, [sessionId, session, generatedImages, updateStepData]);

  // Generate images from layered slides
  const handleGenerateImages = useCallback(async (slides: LayeredSlide[]): Promise<string[]> => {
    if (slides.length === 0) {
      setError('No carousel slides available');
      return [];
    }

    setError(null);
    updateStepData(sessionId, 'carousel', { status: 'generating' });

    try {
      const images: string[] = [];

      // Generate image for each slide
      for (const slide of slides) {
        const dataUrl = await generateSlideImage(slide);
        images.push(dataUrl);
      }

      setGeneratedImages(images);
      updateStepData(sessionId, 'carousel', {
        imageUrls: images,
        layeredSlides: slides,
        status: 'complete',
      });

      return images;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images');
      updateStepData(sessionId, 'carousel', { status: 'pending' });
      return [];
    }
  }, [sessionId, updateStepData]);

  // Generate single slide image using canvas
  async function generateSlideImage(slide: LayeredSlide): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Sort layers by zIndex
      const sortedLayers = [...slide.layers].sort((a, b) => {
        if (a.type === 'background') return -1;
        if (b.type === 'background') return 1;
        const aZ = 'transform' in a ? a.transform.zIndex : 0;
        const bZ = 'transform' in b ? b.transform.zIndex : 0;
        return aZ - bZ;
      });

      // Render each layer
      for (const layer of sortedLayers) {
        if (layer.type === 'background') {
          if (layer.backgroundType === 'solid' && layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, 1080, 1080);
          } else if (layer.backgroundType === 'gradient' && layer.gradient) {
            const gradient = layer.gradient.type === 'linear'
              ? ctx.createLinearGradient(0, 0, 1080, 1080)
              : ctx.createRadialGradient(540, 540, 0, 540, 540, 540);
            layer.gradient.stops.forEach(stop => {
              gradient.addColorStop(stop.position / 100, stop.color);
            });
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1080, 1080);
          }
        } else if (layer.type === 'shape') {
          const { transform, shapeType, fill, borderRadius } = layer;
          ctx.save();
          ctx.globalAlpha = transform.opacity ?? 1;

          if (fill) ctx.fillStyle = fill;

          if (shapeType === 'rectangle') {
            if (borderRadius) {
              ctx.beginPath();
              ctx.roundRect(transform.x, transform.y, transform.width, transform.height, borderRadius);
              if (fill) ctx.fill();
            } else {
              if (fill) ctx.fillRect(transform.x, transform.y, transform.width, transform.height);
            }
          } else if (shapeType === 'circle') {
            const centerX = transform.x + transform.width / 2;
            const centerY = transform.y + transform.height / 2;
            const radius = Math.min(transform.width, transform.height) / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            if (fill) ctx.fill();
          }
          ctx.restore();
        } else if (layer.type === 'text') {
          const { transform, content, style } = layer;
          ctx.save();
          ctx.globalAlpha = transform.opacity ?? 1;

          const fontWeight = style.fontWeight || 400;
          const fontSize = style.fontSize || 24;
          const fontFamily = style.fontFamily || 'Inter, sans-serif';
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.fillStyle = style.color || '#000000';
          ctx.textAlign = style.textAlign || 'left';
          ctx.textBaseline = 'top';

          // Apply text transform
          let displayText = content;
          if (style.textTransform === 'uppercase') displayText = content.toUpperCase();
          else if (style.textTransform === 'lowercase') displayText = content.toLowerCase();

          // Wrap text
          const lineHeight = (style.lineHeight || 1.2) * fontSize;
          const lines = wrapText(ctx, displayText, transform.width);

          let textX = transform.x;
          if (style.textAlign === 'center') textX = transform.x + transform.width / 2;
          else if (style.textAlign === 'right') textX = transform.x + transform.width;

          const textHeight = lines.length * lineHeight;
          let startY = transform.y + (transform.height - textHeight) / 2;

          lines.forEach((line, i) => {
            ctx.fillText(line, textX, startY + i * lineHeight);
          });

          ctx.restore();
        }
      }

      resolve(canvas.toDataURL('image/png'));
    });
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Download all images
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
    // Save current slides before continuing
    const currentSlides = useCarouselEditorStore.getState().slides;
    if (currentSlides.length > 0) {
      const { hook, slides: oldSlides, ctaSlide } = extractCarouselContent(currentSlides);
      updateStepData(sessionId, 'carousel', {
        slides: oldSlides,
        layeredSlides: currentSlides,
        imageUrls: generatedImages,
        status: generatedImages.length > 0 ? 'complete' : 'pending',
      });
      updateStepData(sessionId, 'linkedin', {
        carousel: {
          ...session?.linkedin.carousel,
          hook,
          slides: oldSlides,
          cta_slide: ctaSlide,
        },
      });
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
      hook?: string;
      slides?: CarouselSlide[];
      cta_slide?: { headline: string; url: string };
      layeredSlides?: LayeredSlide[];
    };

    if (restored.layeredSlides) {
      useCarouselEditorStore.getState().initializeEditor(restored.layeredSlides);
    } else if (restored.slides) {
      const migratedSlides = migrateCarousel(
        restored.slides,
        restored.hook || '',
        restored.cta_slide || { headline: 'Read the Full Guide', url: '' }
      );
      useCarouselEditorStore.getState().initializeEditor(migratedSlides);
    }

    setGeneratedImages([]);
    updateStepData(sessionId, 'carousel', {
      imageUrls: [],
      status: 'pending',
    });
  };

  if (!session) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-500">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="px-2">
      {/* Header - constrained width */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-brand-primary">
              Step 4: Carousel Images
            </h2>
            <p className="text-gray-500 text-sm">
              Design and customize your carousel slides
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
            {generatedImages.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-600 transition"
              >
                Download All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Full-width Layer-based Editor */}
      <div className="mb-6" style={{ height: 'calc(100vh - 220px)', minHeight: '600px' }}>
        <SlideEditor
          brandKit={brandKit}
          topicContext={session.topic.title}
          onSave={handleSave}
          onGenerateImages={handleGenerateImages}
        />
      </div>

      {/* Constrained sections below editor */}
      <div className="max-w-7xl mx-auto">
        {/* Image Preview */}
        {generatedImages.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-brand-primary mb-4">
              Generated Images ({generatedImages.length})
            </h3>

            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {generatedImages.map((dataUrl, idx) => (
                <div key={idx} className="relative aspect-square">
                  <img
                    src={dataUrl}
                    alt={`Slide ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                  />
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={handleBack}
            className="text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
          >
            <span>←</span>
            Back to LinkedIn
          </button>

          <div className="flex items-center gap-3">
            {generatedImages.length === 0 && (
              <span className="text-sm text-amber-600">
                Images not generated yet
              </span>
            )}
            <button
              onClick={handleContinue}
              className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center gap-2"
            >
              {generatedImages.length > 0 ? 'Continue to PDF' : 'Skip to PDF'}
              <span>→</span>
            </button>
          </div>
        </div>
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
