// Layer positioning and dimensions
export interface LayerTransform {
  x: number;           // X position (0-1080 for 1080x1080 canvas)
  y: number;           // Y position
  width: number;       // Width in pixels
  height: number;      // Height in pixels
  rotation?: number;   // Rotation in degrees (0-360)
  opacity?: number;    // 0-1, defaults to 1
  zIndex: number;      // Layer stacking order
}

// Gradient configuration
export interface GradientStop {
  color: string;       // Hex color
  position: number;    // 0-100
}

export interface GradientConfig {
  type: 'linear' | 'radial';
  angle?: number;      // For linear gradients (0-360)
  stops: GradientStop[];
}

// Background layer - always first, full canvas
export interface BackgroundLayer {
  id: string;
  type: 'background';
  backgroundType: 'solid' | 'gradient' | 'image';
  // Solid color
  color?: string;
  // Gradient
  gradient?: GradientConfig;
  // Image
  imageUrl?: string;
  imageFit?: 'cover' | 'contain' | 'fill' | 'tile';
  imageOpacity?: number; // 0-1 for dimming background images
  // Reference to brand asset (for AI suggestions)
  brandImageId?: string;
  brandColorId?: string;
}

// Image/overlay layer
export interface ImageLayer {
  id: string;
  type: 'image';
  transform: LayerTransform;
  imageUrl: string;
  borderRadius?: number;
  shadow?: {
    x: number;
    y: number;
    blur: number;
    color: string;
  };
  // Reference to brand asset
  brandLogoId?: string;
  brandImageId?: string;
}

// Text style configuration
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textShadow?: {
    x: number;
    y: number;
    blur: number;
    color: string;
  };
  // Reference to brand color/font
  brandColorId?: string;
  brandFontId?: string;
}

// Text layer with rich styling
export interface TextLayer {
  id: string;
  type: 'text';
  transform: LayerTransform;
  content: string;
  style: TextStyle;
  // For multi-line text handling
  maxLines?: number;
  overflow?: 'visible' | 'ellipsis' | 'clip';
}

// Shape layer for decorative elements
export interface ShapeLayer {
  id: string;
  type: 'shape';
  transform: LayerTransform;
  shapeType: 'rectangle' | 'circle' | 'line';
  fill?: string;
  stroke?: {
    color: string;
    width: number;
  };
  borderRadius?: number;
  // Reference to brand color
  brandColorId?: string;
}

// Union type for all layers
export type SlideLayer = BackgroundLayer | ImageLayer | TextLayer | ShapeLayer;

// Enhanced slide structure with layers
export interface LayeredSlide {
  id: string;
  slideNumber: number;
  slideType: 'hook' | 'content' | 'cta' | 'custom';
  layers: SlideLayer[];
  // Metadata
  name?: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

// Template structure for reusable layouts
export interface SlideTemplate {
  id: string;
  name: string;
  description?: string;
  slideType: 'hook' | 'content' | 'cta' | 'custom';
  layers: Omit<SlideLayer, 'id'>[]; // Layers without IDs (generated on use)
  thumbnail?: string;
  isDefault: boolean;
  createdAt: string;
}

// AI layout suggestion from Claude
export interface AILayoutSuggestion {
  slideType: 'hook' | 'content' | 'cta';
  reasoning: string;
  suggestedLayers: {
    type: SlideLayer['type'];
    // For background
    backgroundType?: 'solid' | 'gradient' | 'image';
    brandImageId?: string;
    color?: string;
    // For image/overlay
    brandLogoId?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    // For text
    content?: string;
    textRole?: 'headline' | 'subhead' | 'body' | 'cta';
    brandColorId?: string;
    brandFontId?: string;
  }[];
  templateId?: string; // If suggesting a base template
}

// Full AI carousel suggestion
export interface AICarouselSuggestion {
  slides: AILayoutSuggestion[];
  assetRecommendations: {
    backgroundImages: string[]; // Brand image IDs
    overlayLogos: string[];     // Brand logo IDs
    colors: string[];           // Brand color IDs
  };
  reasoning: string;
}

// Editor state types
export type EditorMode = 'select' | 'text' | 'image' | 'shape';

export interface EditorHistory {
  slides: LayeredSlide[];
  timestamp: number;
}

// Helper to create a new layer ID
export function createLayerId(type: string): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create default background layer
export function createDefaultBackground(color: string = '#FFFFFF'): BackgroundLayer {
  return {
    id: createLayerId('bg'),
    type: 'background',
    backgroundType: 'solid',
    color,
  };
}

// Options type for creating text layer
export type TextLayerOptions = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  zIndex: number;
}>;

// Helper to create default text layer
export function createDefaultTextLayer(
  content: string,
  options: TextLayerOptions = {}
): TextLayer {
  return {
    id: createLayerId('text'),
    type: 'text',
    transform: {
      x: options.x ?? 90,
      y: options.y ?? 400,
      width: options.width ?? 900,
      height: options.height ?? 200,
      zIndex: options.zIndex ?? 2,
    },
    content,
    style: {
      fontFamily: 'Inter',
      fontSize: options.fontSize ?? 48,
      fontWeight: options.fontWeight ?? 700,
      color: options.color ?? '#101828',
      textAlign: options.textAlign ?? 'center',
      lineHeight: 1.2,
    },
  };
}

// Helper to create default shape layer
export function createDefaultShapeLayer(
  shapeType: ShapeLayer['shapeType'],
  options: Partial<LayerTransform & { fill?: string; stroke?: { color: string; width: number } }> = {}
): ShapeLayer {
  return {
    id: createLayerId('shape'),
    type: 'shape',
    shapeType,
    transform: {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 100,
      height: options.height ?? 100,
      zIndex: options.zIndex ?? 1,
    },
    fill: options.fill,
    stroke: options.stroke,
  };
}

// Helper to create default image layer
export function createDefaultImageLayer(
  imageUrl: string,
  options: Partial<LayerTransform & { borderRadius?: number }> = {}
): ImageLayer {
  return {
    id: createLayerId('img'),
    type: 'image',
    transform: {
      x: options.x ?? 440,
      y: options.y ?? 440,
      width: options.width ?? 200,
      height: options.height ?? 200,
      zIndex: options.zIndex ?? 3,
      opacity: options.opacity ?? 1,
    },
    imageUrl,
    borderRadius: options.borderRadius,
  };
}
