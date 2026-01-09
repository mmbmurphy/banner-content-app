import type { CarouselSlide } from '@/types/session';
import type { LayeredSlide, BackgroundLayer, TextLayer, ShapeLayer } from '@/types/carousel-layers';
import { createLayerId } from '@/types/carousel-layers';

// Default colors (from brand)
const BRAND = {
  PRIMARY: '#101828',
  ACCENT: '#0082F3',
  CORAL: '#FF7469',
  WHITE: '#FFFFFF',
  GRAY: '#758696',
};

/**
 * Convert old CarouselSlide format to new LayeredSlide format
 */
export function migrateCarouselSlide(
  oldSlide: CarouselSlide,
  options?: {
    isHook?: boolean;
    isCta?: boolean;
    hookText?: string;
    ctaHeadline?: string;
    ctaUrl?: string;
  }
): LayeredSlide {
  const now = new Date().toISOString();
  const slideType = options?.isHook ? 'hook' : options?.isCta ? 'cta' : 'content';
  const isHook = options?.isHook || false;
  const isCta = options?.isCta || false;

  // Background layer
  const background: BackgroundLayer = {
    id: createLayerId('bg'),
    type: 'background',
    backgroundType: 'solid',
    color: isHook ? BRAND.PRIMARY : BRAND.WHITE,
  };

  // Accent bar at top
  const accentBar: ShapeLayer = {
    id: createLayerId('shape'),
    type: 'shape',
    shapeType: 'rectangle',
    transform: { x: 0, y: 0, width: 1080, height: 8, zIndex: 1 },
    fill: BRAND.CORAL,
  };

  const layers: (BackgroundLayer | TextLayer | ShapeLayer)[] = [background, accentBar];

  if (isHook) {
    // Hook slide - single large text
    const hookTextLayer: TextLayer = {
      id: createLayerId('text'),
      type: 'text',
      transform: { x: 90, y: 380, width: 900, height: 320, zIndex: 2 },
      content: options?.hookText || oldSlide.headline || 'Hook text here',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 64,
        fontWeight: 700,
        color: BRAND.WHITE,
        textAlign: 'center',
        lineHeight: 1.2,
      },
    };
    layers.push(hookTextLayer);
  } else if (isCta) {
    // CTA slide
    const ctaHeadline: TextLayer = {
      id: createLayerId('text'),
      type: 'text',
      transform: { x: 90, y: 340, width: 900, height: 120, zIndex: 2 },
      content: options?.ctaHeadline || 'Read the Full Guide',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 56,
        fontWeight: 700,
        color: BRAND.PRIMARY,
        textAlign: 'center',
      },
    };

    const ctaUrlLayer: TextLayer = {
      id: createLayerId('text'),
      type: 'text',
      transform: { x: 90, y: 480, width: 900, height: 60, zIndex: 3 },
      content: options?.ctaUrl || 'withbanner.com/info',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 36,
        fontWeight: 500,
        color: BRAND.ACCENT,
        textAlign: 'center',
      },
    };

    // Logo placeholder circle
    const logoCircle: ShapeLayer = {
      id: createLayerId('shape'),
      type: 'shape',
      shapeType: 'circle',
      transform: { x: 490, y: 620, width: 100, height: 100, zIndex: 4 },
      fill: BRAND.ACCENT,
    };

    layers.push(ctaHeadline, ctaUrlLayer, logoCircle);
  } else {
    // Content slide
    const headline: TextLayer = {
      id: createLayerId('text'),
      type: 'text',
      transform: { x: 90, y: 340, width: 900, height: 200, zIndex: 2 },
      content: oldSlide.headline || 'Headline',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 48,
        fontWeight: 700,
        color: BRAND.PRIMARY,
        textAlign: 'center',
        lineHeight: 1.3,
      },
    };
    layers.push(headline);

    if (oldSlide.subhead) {
      const subhead: TextLayer = {
        id: createLayerId('text'),
        type: 'text',
        transform: { x: 90, y: 560, width: 900, height: 150, zIndex: 3 },
        content: oldSlide.subhead,
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 32,
          fontWeight: 400,
          color: BRAND.GRAY,
          textAlign: 'center',
          lineHeight: 1.4,
        },
      };
      layers.push(subhead);
    }

    // Slide number
    const slideNumber: TextLayer = {
      id: createLayerId('text'),
      type: 'text',
      transform: { x: 900, y: 980, width: 100, height: 40, zIndex: 4 },
      content: `${oldSlide.slideNumber}`,
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 24,
        fontWeight: 700,
        color: BRAND.ACCENT,
        textAlign: 'right',
      },
    };
    layers.push(slideNumber);
  }

  return {
    id: oldSlide.id || createLayerId('slide'),
    slideNumber: oldSlide.slideNumber,
    slideType,
    layers,
    isEdited: oldSlide.isEdited || false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert an entire old carousel to the new layered format
 */
export function migrateCarousel(
  oldSlides: CarouselSlide[],
  hook: string,
  ctaSlide: { headline: string; url: string }
): LayeredSlide[] {
  const layeredSlides: LayeredSlide[] = [];

  // Hook slide (slide 1)
  layeredSlides.push(
    migrateCarouselSlide(
      { id: createLayerId('slide'), slideNumber: 1, type: 'hook', headline: hook, isEdited: false },
      { isHook: true, hookText: hook }
    )
  );

  // Content slides
  oldSlides.forEach((slide, idx) => {
    const migrated = migrateCarouselSlide(
      { ...slide, slideNumber: idx + 2 },
      {}
    );
    layeredSlides.push(migrated);
  });

  // CTA slide (last)
  layeredSlides.push(
    migrateCarouselSlide(
      {
        id: createLayerId('slide'),
        slideNumber: layeredSlides.length + 1,
        type: 'cta',
        headline: ctaSlide.headline,
        isEdited: false,
      },
      { isCta: true, ctaHeadline: ctaSlide.headline, ctaUrl: ctaSlide.url }
    )
  );

  return layeredSlides;
}

/**
 * Extract text content from layered slides back to old format
 * (useful for saving to the session store in compatible format)
 */
export function extractCarouselContent(layeredSlides: LayeredSlide[]): {
  hook: string;
  slides: CarouselSlide[];
  ctaSlide: { headline: string; url: string };
} {
  let hook = '';
  const slides: CarouselSlide[] = [];
  let ctaSlide = { headline: 'Read the Full Guide', url: '' };

  layeredSlides.forEach((slide) => {
    const textLayers = slide.layers.filter((l): l is TextLayer => l.type === 'text');

    if (slide.slideType === 'hook') {
      hook = textLayers[0]?.content || '';
    } else if (slide.slideType === 'cta') {
      ctaSlide.headline = textLayers[0]?.content || 'Read the Full Guide';
      ctaSlide.url = textLayers[1]?.content || '';
    } else {
      slides.push({
        id: slide.id,
        slideNumber: slide.slideNumber,
        type: slide.slideType as 'content' | 'hook' | 'cta',
        headline: textLayers[0]?.content || '',
        subhead: textLayers[1]?.content,
        isEdited: slide.isEdited,
      });
    }
  });

  return { hook, slides, ctaSlide };
}
