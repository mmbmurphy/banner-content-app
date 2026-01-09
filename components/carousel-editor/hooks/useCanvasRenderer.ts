'use client';

import { useCallback, useRef, useEffect } from 'react';
import type {
  LayeredSlide,
  SlideLayer,
  BackgroundLayer,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  GradientConfig,
} from '@/types/carousel-layers';

interface CanvasRendererOptions {
  width: number;
  height: number;
  showGrid: boolean;
  selectedLayerId: string | null;
  zoom: number;
}

interface CanvasRendererResult {
  render: () => void;
  getLayerAtPoint: (x: number, y: number) => SlideLayer | null;
  exportToDataUrl: () => string;
}

// Image cache to avoid reloading
const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  slide: LayeredSlide | null,
  options: CanvasRendererOptions
): CanvasRendererResult {
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Pre-load all images in the slide
  useEffect(() => {
    if (!slide) return;

    const imageUrls: string[] = [];

    slide.layers.forEach(layer => {
      if (layer.type === 'background' && layer.backgroundType === 'image' && layer.imageUrl) {
        imageUrls.push(layer.imageUrl);
      }
      if (layer.type === 'image' && layer.imageUrl) {
        imageUrls.push(layer.imageUrl);
      }
    });

    Promise.all(imageUrls.map(url => loadImage(url).catch(() => null)))
      .then(images => {
        images.forEach((img, i) => {
          if (img) {
            loadedImagesRef.current.set(imageUrls[i], img);
          }
        });
      });
  }, [slide]);

  // Render a gradient
  const renderGradient = useCallback(
    (ctx: CanvasRenderingContext2D, gradient: GradientConfig, width: number, height: number) => {
      let canvasGradient: CanvasGradient;

      if (gradient.type === 'linear') {
        const angle = ((gradient.angle || 0) * Math.PI) / 180;
        const x1 = width / 2 - Math.cos(angle) * width;
        const y1 = height / 2 - Math.sin(angle) * height;
        const x2 = width / 2 + Math.cos(angle) * width;
        const y2 = height / 2 + Math.sin(angle) * height;
        canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      } else {
        canvasGradient = ctx.createRadialGradient(
          width / 2, height / 2, 0,
          width / 2, height / 2, Math.max(width, height) / 2
        );
      }

      gradient.stops.forEach(stop => {
        canvasGradient.addColorStop(stop.position / 100, stop.color);
      });

      return canvasGradient;
    },
    []
  );

  // Render background layer
  const renderBackgroundLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: BackgroundLayer, width: number, height: number) => {
      ctx.save();

      if (layer.backgroundType === 'solid' && layer.color) {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, width, height);
      } else if (layer.backgroundType === 'gradient' && layer.gradient) {
        ctx.fillStyle = renderGradient(ctx, layer.gradient, width, height);
        ctx.fillRect(0, 0, width, height);
      } else if (layer.backgroundType === 'image' && layer.imageUrl) {
        const img = loadedImagesRef.current.get(layer.imageUrl);
        if (img) {
          ctx.globalAlpha = layer.imageOpacity ?? 1;

          const fit = layer.imageFit || 'cover';
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          let dx = 0, dy = 0, dw = width, dh = height;

          if (fit === 'cover') {
            const scale = Math.max(width / img.width, height / img.height);
            sw = width / scale;
            sh = height / scale;
            sx = (img.width - sw) / 2;
            sy = (img.height - sh) / 2;
          } else if (fit === 'contain') {
            const scale = Math.min(width / img.width, height / img.height);
            dw = img.width * scale;
            dh = img.height * scale;
            dx = (width - dw) / 2;
            dy = (height - dh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    },
    [renderGradient]
  );

  // Render shape layer
  const renderShapeLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: ShapeLayer) => {
      const { transform, shapeType, fill, stroke, borderRadius } = layer;
      ctx.save();

      if (transform.rotation) {
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      ctx.globalAlpha = transform.opacity ?? 1;

      if (shapeType === 'rectangle') {
        if (borderRadius) {
          ctx.beginPath();
          ctx.roundRect(transform.x, transform.y, transform.width, transform.height, borderRadius);
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          if (stroke) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.stroke();
          }
        } else {
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(transform.x, transform.y, transform.width, transform.height);
          }
          if (stroke) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.strokeRect(transform.x, transform.y, transform.width, transform.height);
          }
        }
      } else if (shapeType === 'circle') {
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const radius = Math.min(transform.width, transform.height) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.stroke();
        }
      } else if (shapeType === 'line') {
        ctx.beginPath();
        ctx.moveTo(transform.x, transform.y);
        ctx.lineTo(transform.x + transform.width, transform.y + transform.height);
        if (stroke) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.stroke();
        }
      }

      ctx.restore();
    },
    []
  );

  // Render image layer
  const renderImageLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: ImageLayer) => {
      const img = loadedImagesRef.current.get(layer.imageUrl);
      if (!img) return;

      const { transform, borderRadius, shadow } = layer;
      ctx.save();

      if (transform.rotation) {
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      ctx.globalAlpha = transform.opacity ?? 1;

      if (shadow) {
        ctx.shadowOffsetX = shadow.x;
        ctx.shadowOffsetY = shadow.y;
        ctx.shadowBlur = shadow.blur;
        ctx.shadowColor = shadow.color;
      }

      if (borderRadius) {
        ctx.beginPath();
        ctx.roundRect(transform.x, transform.y, transform.width, transform.height, borderRadius);
        ctx.clip();
      }

      ctx.drawImage(img, transform.x, transform.y, transform.width, transform.height);

      ctx.restore();
    },
    []
  );

  // Wrap text helper
  const wrapText = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
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

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    },
    []
  );

  // Render text layer
  const renderTextLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
      const { transform, content, style, maxLines, overflow } = layer;
      ctx.save();

      if (transform.rotation) {
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      ctx.globalAlpha = transform.opacity ?? 1;

      // Set font
      const fontWeight = style.fontWeight || 400;
      const fontSize = style.fontSize || 24;
      const fontFamily = style.fontFamily || 'Inter, sans-serif';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = style.color || '#000000';
      ctx.textAlign = style.textAlign || 'left';
      ctx.textBaseline = 'top';

      // Apply text transform
      let displayText = content;
      if (style.textTransform === 'uppercase') {
        displayText = content.toUpperCase();
      } else if (style.textTransform === 'lowercase') {
        displayText = content.toLowerCase();
      } else if (style.textTransform === 'capitalize') {
        displayText = content.replace(/\b\w/g, c => c.toUpperCase());
      }

      // Text shadow
      if (style.textShadow) {
        ctx.shadowOffsetX = style.textShadow.x;
        ctx.shadowOffsetY = style.textShadow.y;
        ctx.shadowBlur = style.textShadow.blur;
        ctx.shadowColor = style.textShadow.color;
      }

      // Letter spacing (approximate - canvas doesn't support it directly)
      if (style.letterSpacing) {
        // For now, just use normal rendering
        // Could implement character-by-character for precise spacing
      }

      const lineHeight = (style.lineHeight || 1.2) * fontSize;
      const lines = wrapText(ctx, displayText, transform.width);

      // Apply max lines limit
      let displayLines = lines;
      if (maxLines && lines.length > maxLines) {
        displayLines = lines.slice(0, maxLines);
        if (overflow === 'ellipsis') {
          displayLines[maxLines - 1] = displayLines[maxLines - 1].slice(0, -3) + '...';
        }
      }

      // Calculate starting Y based on alignment
      let startY = transform.y;
      const textHeight = displayLines.length * lineHeight;

      // Vertical centering within the transform box
      startY = transform.y + (transform.height - textHeight) / 2;

      // Calculate X based on text align
      let textX = transform.x;
      if (style.textAlign === 'center') {
        textX = transform.x + transform.width / 2;
      } else if (style.textAlign === 'right') {
        textX = transform.x + transform.width;
      }

      displayLines.forEach((line, i) => {
        ctx.fillText(line, textX, startY + i * lineHeight);
      });

      ctx.restore();
    },
    [wrapText]
  );

  // Render selection handles
  const renderSelectionHandles = useCallback(
    (ctx: CanvasRenderingContext2D, layer: SlideLayer) => {
      if (layer.type === 'background') return;
      if (!('transform' in layer)) return;

      const { transform } = layer;
      const handleSize = 8;
      const halfHandle = handleSize / 2;

      ctx.save();

      // Selection border
      ctx.strokeStyle = '#0082F3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(transform.x, transform.y, transform.width, transform.height);
      ctx.setLineDash([]);

      // Resize handles
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0082F3';
      ctx.lineWidth = 1;

      const handles = [
        { x: transform.x - halfHandle, y: transform.y - halfHandle }, // top-left
        { x: transform.x + transform.width / 2 - halfHandle, y: transform.y - halfHandle }, // top-center
        { x: transform.x + transform.width - halfHandle, y: transform.y - halfHandle }, // top-right
        { x: transform.x + transform.width - halfHandle, y: transform.y + transform.height / 2 - halfHandle }, // right-center
        { x: transform.x + transform.width - halfHandle, y: transform.y + transform.height - halfHandle }, // bottom-right
        { x: transform.x + transform.width / 2 - halfHandle, y: transform.y + transform.height - halfHandle }, // bottom-center
        { x: transform.x - halfHandle, y: transform.y + transform.height - halfHandle }, // bottom-left
        { x: transform.x - halfHandle, y: transform.y + transform.height / 2 - halfHandle }, // left-center
      ];

      handles.forEach(handle => {
        ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
      });

      ctx.restore();
    },
    []
  );

  // Render grid
  const renderGrid = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 130, 243, 0.2)';
      ctx.lineWidth = 1;

      const gridSize = 54; // 1080 / 20 = 54px grid

      for (let x = gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center lines (more prominent)
      ctx.strokeStyle = 'rgba(0, 130, 243, 0.4)';
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      ctx.restore();
    },
    []
  );

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !slide) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, showGrid, selectedLayerId, zoom } = options;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Apply zoom
    ctx.scale(zoom, zoom);

    // Clear canvas
    ctx.clearRect(0, 0, width / zoom, height / zoom);

    // Sort layers by zIndex (background always first, then by zIndex)
    const sortedLayers = [...slide.layers].sort((a, b) => {
      if (a.type === 'background') return -1;
      if (b.type === 'background') return 1;
      const aZ = 'transform' in a ? a.transform.zIndex : 0;
      const bZ = 'transform' in b ? b.transform.zIndex : 0;
      return aZ - bZ;
    });

    // Render each layer
    sortedLayers.forEach(layer => {
      switch (layer.type) {
        case 'background':
          renderBackgroundLayer(ctx, layer, width / zoom, height / zoom);
          break;
        case 'shape':
          renderShapeLayer(ctx, layer);
          break;
        case 'image':
          renderImageLayer(ctx, layer);
          break;
        case 'text':
          renderTextLayer(ctx, layer);
          break;
      }
    });

    // Render selection handles
    if (selectedLayerId) {
      const selectedLayer = slide.layers.find(l => l.id === selectedLayerId);
      if (selectedLayer) {
        renderSelectionHandles(ctx, selectedLayer);
      }
    }

    // Render grid
    if (showGrid) {
      renderGrid(ctx, width / zoom, height / zoom);
    }
  }, [
    canvasRef,
    slide,
    options,
    renderBackgroundLayer,
    renderShapeLayer,
    renderImageLayer,
    renderTextLayer,
    renderSelectionHandles,
    renderGrid,
  ]);

  // Get layer at point (for click detection)
  const getLayerAtPoint = useCallback(
    (x: number, y: number): SlideLayer | null => {
      if (!slide) return null;

      const { zoom } = options;
      const adjustedX = x / zoom;
      const adjustedY = y / zoom;

      // Check layers in reverse order (top to bottom)
      const sortedLayers = [...slide.layers]
        .filter(l => l.type !== 'background')
        .sort((a, b) => {
          const aZ = 'transform' in a ? a.transform.zIndex : 0;
          const bZ = 'transform' in b ? b.transform.zIndex : 0;
          return bZ - aZ; // Reverse order for hit testing
        });

      for (const layer of sortedLayers) {
        if ('transform' in layer) {
          const { transform } = layer;
          if (
            adjustedX >= transform.x &&
            adjustedX <= transform.x + transform.width &&
            adjustedY >= transform.y &&
            adjustedY <= transform.y + transform.height
          ) {
            return layer;
          }
        }
      }

      return null;
    },
    [slide, options]
  );

  // Export to data URL
  const exportToDataUrl = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    // Create a new canvas at full resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1080;
    exportCanvas.height = 1080;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx || !slide) return '';

    // Render without selection or grid
    const sortedLayers = [...slide.layers].sort((a, b) => {
      if (a.type === 'background') return -1;
      if (b.type === 'background') return 1;
      const aZ = 'transform' in a ? a.transform.zIndex : 0;
      const bZ = 'transform' in b ? b.transform.zIndex : 0;
      return aZ - bZ;
    });

    sortedLayers.forEach(layer => {
      switch (layer.type) {
        case 'background':
          renderBackgroundLayer(ctx, layer, 1080, 1080);
          break;
        case 'shape':
          renderShapeLayer(ctx, layer);
          break;
        case 'image':
          renderImageLayer(ctx, layer);
          break;
        case 'text':
          renderTextLayer(ctx, layer);
          break;
      }
    });

    return exportCanvas.toDataURL('image/png');
  }, [canvasRef, slide, renderBackgroundLayer, renderShapeLayer, renderImageLayer, renderTextLayer]);

  return {
    render,
    getLayerAtPoint,
    exportToDataUrl,
  };
}
