import type { SlideTemplate } from './carousel-layers';

export interface BrandLogo {
  id: string;
  name: string; // e.g., "Primary Logo", "Icon", "White Version"
  url: string;
  type: 'primary' | 'secondary' | 'icon' | 'wordmark' | 'white' | 'dark' | 'other';
  format?: string; // png, svg, etc.
}

// Carousel-specific assets (overlays, watermarks, badges)
export interface CarouselAsset {
  id: string;
  name: string;
  url: string;
  type: 'overlay' | 'icon' | 'badge' | 'watermark';
  defaultPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  description?: string;
}

export interface BrandColor {
  id: string;
  name: string; // e.g., "Primary Blue", "Accent Coral"
  hex: string; // e.g., "#0082F3"
  type: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'success' | 'warning' | 'error' | 'other';
  usage?: string; // Description of when to use
}

export interface BrandFont {
  id: string;
  name: string; // e.g., "Inter", "Playfair Display"
  type: 'heading' | 'body' | 'accent' | 'mono';
  weight?: string; // e.g., "400,500,600,700"
  googleFontUrl?: string;
  fallback?: string; // e.g., "sans-serif"
}

export interface BrandImage {
  id: string;
  name: string;
  url: string;
  type: 'background' | 'pattern' | 'texture' | 'hero' | 'social' | 'other';
  description?: string;
}

export interface BrandSocialProfile {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'website' | 'other';
  url: string;
  handle?: string;
}

export interface CarouselTemplate {
  id: string;
  name: string;
  description?: string;
  hookSlide: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  };
  contentSlide: {
    backgroundColor: string;
    headlineColor: string;
    subheadColor: string;
    accentColor: string;
  };
  ctaSlide: {
    backgroundColor: string;
    textColor: string;
    buttonColor: string;
    buttonTextColor: string;
  };
}

export interface BrandVoice {
  tone: string[]; // e.g., ["Professional", "Friendly", "Authoritative"]
  personality: string; // Brief description
  doList: string[]; // Things the brand voice should do
  dontList: string[]; // Things to avoid
}

export interface ContentType {
  id: string;
  value: string; // URL-safe identifier, e.g., "blog", "case-study"
  label: string; // Display name, e.g., "Blog Post", "Case Study"
  color: string; // Tailwind classes, e.g., "bg-purple-100 text-purple-700"
}

export interface BrandKit {
  id: string;
  name: string; // e.g., "Banner PM Brand Kit"
  updatedAt: string;

  // Logos
  logos: BrandLogo[];

  // Colors
  colors: BrandColor[];

  // Typography
  fonts: BrandFont[];

  // Images & Assets
  images: BrandImage[];

  // Social Profiles
  socialProfiles: BrandSocialProfile[];

  // Carousel Templates (color presets)
  carouselTemplates: CarouselTemplate[];

  // Carousel Assets (overlays, badges, watermarks)
  carouselAssets?: CarouselAsset[];

  // Custom Slide Templates (saved layer layouts)
  customSlideTemplates?: SlideTemplate[];

  // Brand Voice
  voice?: BrandVoice;

  // Content Types (for categorizing pipeline sessions)
  contentTypes?: ContentType[];

  // Company Info
  companyName?: string;
  tagline?: string;
  website?: string;

  // Default CTA
  defaultCta?: {
    headline: string;
    url: string;
  };
}

// Default brand kit template
export const DEFAULT_BRAND_KIT: BrandKit = {
  id: 'default',
  name: 'My Brand Kit',
  updatedAt: new Date().toISOString(),
  logos: [],
  colors: [
    { id: 'c1', name: 'Primary', hex: '#101828', type: 'primary', usage: 'Main brand color, headlines' },
    { id: 'c2', name: 'Accent', hex: '#0082F3', type: 'accent', usage: 'CTAs, links, highlights' },
    { id: 'c3', name: 'Coral', hex: '#FF7469', type: 'secondary', usage: 'Secondary accent, decorative elements' },
    { id: 'c4', name: 'Background', hex: '#FFFFFF', type: 'background', usage: 'Page backgrounds' },
    { id: 'c5', name: 'Text', hex: '#344054', type: 'text', usage: 'Body text' },
    { id: 'c6', name: 'Gray', hex: '#758696', type: 'other', usage: 'Secondary text, borders' },
  ],
  fonts: [
    { id: 'f1', name: 'Inter', type: 'body', weight: '400,500,600,700', fallback: 'sans-serif' },
  ],
  images: [],
  socialProfiles: [],
  carouselTemplates: [
    {
      id: 'default',
      name: 'Default Template',
      description: 'Standard carousel with dark hook and light content slides',
      hookSlide: {
        backgroundColor: '#101828',
        textColor: '#FFFFFF',
        accentColor: '#FF7469',
      },
      contentSlide: {
        backgroundColor: '#FFFFFF',
        headlineColor: '#101828',
        subheadColor: '#758696',
        accentColor: '#0082F3',
      },
      ctaSlide: {
        backgroundColor: '#FFFFFF',
        textColor: '#101828',
        buttonColor: '#0082F3',
        buttonTextColor: '#FFFFFF',
      },
    },
  ],
  voice: {
    tone: ['Professional', 'Knowledgeable', 'Approachable'],
    personality: 'Expert advisor who makes complex topics accessible',
    doList: ['Use clear, concise language', 'Provide actionable insights', 'Back claims with data'],
    dontList: ['Use jargon without explanation', 'Be overly casual', 'Make unsubstantiated claims'],
  },
  contentTypes: [
    { id: 'ct1', value: 'blog', label: 'Blog Post', color: 'bg-purple-100 text-purple-700' },
    { id: 'ct2', value: 'guide', label: 'Guide', color: 'bg-indigo-100 text-indigo-700' },
    { id: 'ct3', value: 'case-study', label: 'Case Study', color: 'bg-teal-100 text-teal-700' },
    { id: 'ct4', value: 'tutorial', label: 'Tutorial', color: 'bg-cyan-100 text-cyan-700' },
    { id: 'ct5', value: 'thought-leadership', label: 'Thought Leadership', color: 'bg-rose-100 text-rose-700' },
    { id: 'ct6', value: 'news', label: 'News/Update', color: 'bg-amber-100 text-amber-700' },
    { id: 'ct7', value: 'listicle', label: 'Listicle', color: 'bg-lime-100 text-lime-700' },
    { id: 'ct8', value: 'comparison', label: 'Comparison', color: 'bg-orange-100 text-orange-700' },
  ],
};
