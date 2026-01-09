'use client';

import { useEffect, useCallback } from 'react';
import type { LayeredSlide, SlideLayer } from '@/types/carousel-layers';
import type { BrandKit } from '@/types/brand';
import { useCarouselEditorStore } from '@/lib/store/carousel-editor-store';
import { SlideCanvas } from './SlideCanvas';
import { LayerPanel } from './LayerPanel';
import { PropertyPanel } from './PropertyPanel';
import { Toolbar } from './Toolbar';
import { SlideStrip } from './SlideStrip';
import { AICommandBar } from './AICommandBar';

interface SlideEditorProps {
  brandKit: BrandKit;
  topicContext?: string;
  onSave: (slides: LayeredSlide[]) => void;
  onGenerateImages: (slides: LayeredSlide[]) => Promise<string[]>;
}

export function SlideEditor({
  brandKit,
  topicContext,
  onSave,
  onGenerateImages,
}: SlideEditorProps) {
  const {
    slides,
    currentSlideIndex,
    selectedLayerId,
    zoom,
    showGrid,
    isPreviewing,
    isInitialized,
    setSlides,
    setCurrentSlide,
    selectLayer,
    updateLayer,
    addTextLayer,
    addImageLayer,
    addShapeLayer,
    deleteLayer,
    duplicateLayer,
    bringToFront,
    sendToBack,
    addSlide,
    deleteSlide,
    duplicateSlide,
    setZoom,
    toggleGrid,
    togglePreview,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentSlide,
    getSelectedLayer,
  } = useCarouselEditorStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete selected layer
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      // Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedLayerId) {
        e.preventDefault();
        duplicateLayer(selectedLayerId);
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        selectLayer(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, deleteLayer, undo, redo, duplicateLayer, selectLayer]);

  const handleLayerUpdate = useCallback(
    (layerId: string, updates: Partial<SlideLayer>) => {
      updateLayer(layerId, updates);
    },
    [updateLayer]
  );

  const handleSave = useCallback(() => {
    onSave(slides);
  }, [onSave, slides]);

  const handleGenerateImages = useCallback(async () => {
    return onGenerateImages(slides);
  }, [onGenerateImages, slides]);

  const handleAIUpdate = useCallback((updatedSlides: LayeredSlide[]) => {
    setSlides(updatedSlides);
  }, [setSlides]);

  const currentSlide = getCurrentSlide();
  const selectedLayer = getSelectedLayer();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-gray-400">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* AI Command Bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-200">
        <AICommandBar
          slides={slides}
          currentSlideIndex={currentSlideIndex}
          brandKit={brandKit}
          context={{ topic: topicContext }}
          onSlidesUpdate={handleAIUpdate}
        />
      </div>

      {/* Toolbar */}
      <Toolbar
        onAddText={() => addTextLayer('New Text', { fontSize: 48, fontWeight: 700 })}
        onAddImage={(url) => addImageLayer(url)}
        onAddShape={(type) => addShapeLayer(type)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
        zoom={zoom}
        onZoomChange={setZoom}
        showGrid={showGrid}
        onToggleGrid={toggleGrid}
        isPreviewing={isPreviewing}
        onTogglePreview={togglePreview}
        onSave={handleSave}
        onGenerateImages={handleGenerateImages}
        brandKit={brandKit}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Layer panel (left) */}
        {!isPreviewing && (
          <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
            <LayerPanel
              slide={currentSlide}
              selectedLayerId={selectedLayerId}
              onSelectLayer={selectLayer}
              onDeleteLayer={deleteLayer}
              onDuplicateLayer={duplicateLayer}
              onBringToFront={bringToFront}
              onSendToBack={sendToBack}
            />
          </div>
        )}

        {/* Canvas (center) */}
        <div className="flex-1 overflow-auto">
          <SlideCanvas
            slide={currentSlide}
            selectedLayerId={selectedLayerId}
            onLayerSelect={selectLayer}
            onLayerUpdate={handleLayerUpdate}
            zoom={zoom}
            showGrid={showGrid}
            isPreviewing={isPreviewing}
          />
        </div>

        {/* Property panel (right) */}
        {!isPreviewing && selectedLayer && (
          <div className="w-64 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <PropertyPanel
              layer={selectedLayer}
              brandKit={brandKit}
              onUpdate={(updates) => handleLayerUpdate(selectedLayer.id, updates)}
              onDelete={() => deleteLayer(selectedLayer.id)}
            />
          </div>
        )}
      </div>

      {/* Slide strip (bottom) */}
      <SlideStrip
        slides={slides}
        currentSlideIndex={currentSlideIndex}
        onSlideSelect={setCurrentSlide}
        onAddSlide={addSlide}
        onDeleteSlide={deleteSlide}
        onDuplicateSlide={duplicateSlide}
      />
    </div>
  );
}
