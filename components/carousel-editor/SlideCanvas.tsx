'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { LayeredSlide, SlideLayer } from '@/types/carousel-layers';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';

interface SlideCanvasProps {
  slide: LayeredSlide | null;
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string | null) => void;
  onLayerUpdate: (layerId: string, updates: Partial<SlideLayer>) => void;
  zoom: number;
  showGrid: boolean;
  isPreviewing: boolean;
}

type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-n' | 'resize-ne' | 'resize-e' | 'resize-se' | 'resize-s' | 'resize-sw' | 'resize-w';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  layerId: string;
  initialTransform: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const CANVAS_SIZE = 1080;
const HANDLE_SIZE = 8;

export function SlideCanvas({
  slide,
  selectedLayerId,
  onLayerSelect,
  onLayerUpdate,
  zoom,
  showGrid,
  isPreviewing,
}: SlideCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const displaySize = CANVAS_SIZE * zoom;

  const { render, getLayerAtPoint } = useCanvasRenderer(canvasRef, slide, {
    width: displaySize,
    height: displaySize,
    showGrid: showGrid && !isPreviewing,
    selectedLayerId: isPreviewing ? null : selectedLayerId,
    zoom,
  });

  // Render on changes
  useEffect(() => {
    render();
  }, [render, slide, selectedLayerId, zoom, showGrid, isPreviewing]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  // Check if point is on a resize handle
  const getResizeHandle = useCallback(
    (x: number, y: number, layer: SlideLayer): DragMode => {
      if (layer.type === 'background' || !('transform' in layer)) return 'none';

      const { transform } = layer;
      const scaledX = x / zoom;
      const scaledY = y / zoom;
      const halfHandle = HANDLE_SIZE / 2 / zoom;

      // Define handle positions
      const handles: { mode: DragMode; x: number; y: number }[] = [
        { mode: 'resize-nw', x: transform.x, y: transform.y },
        { mode: 'resize-n', x: transform.x + transform.width / 2, y: transform.y },
        { mode: 'resize-ne', x: transform.x + transform.width, y: transform.y },
        { mode: 'resize-e', x: transform.x + transform.width, y: transform.y + transform.height / 2 },
        { mode: 'resize-se', x: transform.x + transform.width, y: transform.y + transform.height },
        { mode: 'resize-s', x: transform.x + transform.width / 2, y: transform.y + transform.height },
        { mode: 'resize-sw', x: transform.x, y: transform.y + transform.height },
        { mode: 'resize-w', x: transform.x, y: transform.y + transform.height / 2 },
      ];

      for (const handle of handles) {
        if (
          scaledX >= handle.x - halfHandle * 2 &&
          scaledX <= handle.x + halfHandle * 2 &&
          scaledY >= handle.y - halfHandle * 2 &&
          scaledY <= handle.y + halfHandle * 2
        ) {
          return handle.mode;
        }
      }

      return 'none';
    },
    [zoom]
  );

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isPreviewing) return;

      const coords = getCanvasCoords(e);

      // First check if clicking on resize handle of selected layer
      if (selectedLayerId && slide) {
        const selectedLayer = slide.layers.find(l => l.id === selectedLayerId);
        if (selectedLayer && 'transform' in selectedLayer) {
          const handleMode = getResizeHandle(coords.x, coords.y, selectedLayer);
          if (handleMode !== 'none') {
            setDragState({
              mode: handleMode,
              startX: coords.x,
              startY: coords.y,
              layerId: selectedLayerId,
              initialTransform: { ...selectedLayer.transform },
            });
            return;
          }
        }
      }

      // Otherwise, check for layer click
      const clickedLayer = getLayerAtPoint(coords.x, coords.y);

      if (clickedLayer) {
        onLayerSelect(clickedLayer.id);

        // Start move drag
        if ('transform' in clickedLayer) {
          setDragState({
            mode: 'move',
            startX: coords.x,
            startY: coords.y,
            layerId: clickedLayer.id,
            initialTransform: { ...clickedLayer.transform },
          });
        }
      } else {
        onLayerSelect(null);
      }
    },
    [isPreviewing, getCanvasCoords, selectedLayerId, slide, getResizeHandle, getLayerAtPoint, onLayerSelect]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || isPreviewing) return;

      const coords = getCanvasCoords(e);
      const deltaX = (coords.x - dragState.startX) / zoom;
      const deltaY = (coords.y - dragState.startY) / zoom;

      const { mode, initialTransform, layerId } = dragState;

      let newTransform = { ...initialTransform };

      if (mode === 'move') {
        newTransform.x = initialTransform.x + deltaX;
        newTransform.y = initialTransform.y + deltaY;
      } else if (mode.startsWith('resize')) {
        // Handle resize based on which handle is being dragged
        if (mode.includes('n')) {
          newTransform.y = initialTransform.y + deltaY;
          newTransform.height = initialTransform.height - deltaY;
        }
        if (mode.includes('s')) {
          newTransform.height = initialTransform.height + deltaY;
        }
        if (mode.includes('w')) {
          newTransform.x = initialTransform.x + deltaX;
          newTransform.width = initialTransform.width - deltaX;
        }
        if (mode.includes('e')) {
          newTransform.width = initialTransform.width + deltaX;
        }

        // Enforce minimum size
        if (newTransform.width < 20) {
          newTransform.width = 20;
          if (mode.includes('w')) {
            newTransform.x = initialTransform.x + initialTransform.width - 20;
          }
        }
        if (newTransform.height < 20) {
          newTransform.height = 20;
          if (mode.includes('n')) {
            newTransform.y = initialTransform.y + initialTransform.height - 20;
          }
        }
      }

      onLayerUpdate(layerId, { transform: newTransform } as Partial<SlideLayer>);
    },
    [dragState, isPreviewing, getCanvasCoords, zoom, onLayerUpdate]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Handle double click for text editing
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPreviewing) return;

      const coords = getCanvasCoords(e);
      const clickedLayer = getLayerAtPoint(coords.x, coords.y);

      if (clickedLayer?.type === 'text') {
        // Could trigger inline text editing here
        // For now, just select the layer
        onLayerSelect(clickedLayer.id);
      }
    },
    [isPreviewing, getCanvasCoords, getLayerAtPoint, onLayerSelect]
  );

  // Get cursor style based on drag state and hover
  const getCursor = useCallback((): string => {
    if (isPreviewing) return 'default';
    if (dragState) {
      if (dragState.mode === 'move') return 'grabbing';
      if (dragState.mode.includes('n') && dragState.mode.includes('w')) return 'nwse-resize';
      if (dragState.mode.includes('n') && dragState.mode.includes('e')) return 'nesw-resize';
      if (dragState.mode.includes('s') && dragState.mode.includes('w')) return 'nesw-resize';
      if (dragState.mode.includes('s') && dragState.mode.includes('e')) return 'nwse-resize';
      if (dragState.mode.includes('n') || dragState.mode.includes('s')) return 'ns-resize';
      if (dragState.mode.includes('e') || dragState.mode.includes('w')) return 'ew-resize';
    }
    return 'default';
  }, [isPreviewing, dragState]);

  if (!slide) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No slide selected
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-start justify-center overflow-auto bg-gray-100 h-full w-full"
    >
      <div
        className="relative shadow-lg flex-shrink-0"
        style={{ width: displaySize, height: displaySize }}
      >
        <canvas
          ref={canvasRef}
          width={displaySize}
          height={displaySize}
          className="absolute inset-0 rounded-lg"
          style={{ cursor: getCursor() }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>
    </div>
  );
}
