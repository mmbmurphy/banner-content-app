'use client';

import { create } from 'zustand';
import type {
  LayeredSlide,
  SlideLayer,
  BackgroundLayer,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  EditorMode,
  EditorHistory,
  AICarouselSuggestion,
  AILayoutSuggestion,
  TextLayerOptions,
} from '@/types/carousel-layers';
import {
  createLayerId,
  createDefaultBackground,
  createDefaultTextLayer,
  createDefaultShapeLayer,
  createDefaultImageLayer,
} from '@/types/carousel-layers';

const MAX_HISTORY_LENGTH = 50;

interface CarouselEditorStore {
  // Slides data
  slides: LayeredSlide[];
  currentSlideIndex: number;

  // Selection
  selectedLayerId: string | null;

  // Editor state
  editorMode: EditorMode;
  zoom: number;
  showGrid: boolean;
  isPreviewing: boolean;

  // History for undo/redo
  history: EditorHistory[];
  historyIndex: number;

  // AI suggestions
  aiSuggestion: AICarouselSuggestion | null;
  isLoadingAI: boolean;

  // Initialization
  isInitialized: boolean;

  // Actions - Initialization
  initializeEditor: (slides: LayeredSlide[]) => void;
  resetEditor: () => void;

  // Actions - Slides
  setSlides: (slides: LayeredSlide[]) => void;
  setCurrentSlide: (index: number) => void;
  addSlide: (slideType?: LayeredSlide['slideType']) => void;
  deleteSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  updateSlide: (index: number, updates: Partial<LayeredSlide>) => void;

  // Actions - Layers
  selectLayer: (layerId: string | null) => void;
  addLayer: (layer: SlideLayer) => void;
  updateLayer: (layerId: string, updates: Partial<SlideLayer>) => void;
  deleteLayer: (layerId: string) => void;
  duplicateLayer: (layerId: string) => void;
  reorderLayers: (fromZIndex: number, toZIndex: number) => void;
  bringToFront: (layerId: string) => void;
  sendToBack: (layerId: string) => void;

  // Actions - Quick add helpers
  addTextLayer: (content: string, options?: TextLayerOptions) => void;
  addImageLayer: (imageUrl: string, options?: Partial<ImageLayer>) => void;
  addShapeLayer: (shapeType: ShapeLayer['shapeType'], options?: Partial<ShapeLayer>) => void;
  setBackground: (background: Partial<BackgroundLayer>) => void;

  // Actions - Editor state
  setEditorMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  togglePreview: () => void;

  // Actions - History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - AI
  setAISuggestion: (suggestion: AICarouselSuggestion | null) => void;
  setLoadingAI: (loading: boolean) => void;
  applyAISuggestion: (slideIndex: number, suggestion: AILayoutSuggestion) => void;

  // Getters
  getCurrentSlide: () => LayeredSlide | null;
  getSelectedLayer: () => SlideLayer | null;
  getLayersByType: (type: SlideLayer['type']) => SlideLayer[];
}

function createEmptySlide(slideNumber: number, slideType: LayeredSlide['slideType'] = 'content'): LayeredSlide {
  const now = new Date().toISOString();
  return {
    id: createLayerId('slide'),
    slideNumber,
    slideType,
    layers: [createDefaultBackground(slideType === 'hook' ? '#101828' : '#FFFFFF')],
    isEdited: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const useCarouselEditorStore = create<CarouselEditorStore>((set, get) => ({
  // Initial state
  slides: [],
  currentSlideIndex: 0,
  selectedLayerId: null,
  editorMode: 'select',
  zoom: 1,
  showGrid: false,
  isPreviewing: false,
  history: [],
  historyIndex: -1,
  aiSuggestion: null,
  isLoadingAI: false,
  isInitialized: false,

  // Initialization
  initializeEditor: (slides: LayeredSlide[]) => {
    set({
      slides,
      currentSlideIndex: 0,
      selectedLayerId: null,
      history: [{ slides, timestamp: Date.now() }],
      historyIndex: 0,
      isInitialized: true,
    });
  },

  resetEditor: () => {
    set({
      slides: [],
      currentSlideIndex: 0,
      selectedLayerId: null,
      editorMode: 'select',
      zoom: 1,
      showGrid: false,
      isPreviewing: false,
      history: [],
      historyIndex: -1,
      aiSuggestion: null,
      isLoadingAI: false,
      isInitialized: false,
    });
  },

  // Slides
  setSlides: (slides: LayeredSlide[]) => {
    get().pushHistory();
    set({ slides });
  },

  setCurrentSlide: (index: number) => {
    const { slides } = get();
    if (index >= 0 && index < slides.length) {
      set({ currentSlideIndex: index, selectedLayerId: null });
    }
  },

  addSlide: (slideType: LayeredSlide['slideType'] = 'content') => {
    get().pushHistory();
    const { slides, currentSlideIndex } = get();
    const newSlide = createEmptySlide(slides.length + 1, slideType);

    // Insert after current slide
    const insertIndex = currentSlideIndex + 1;
    const newSlides = [
      ...slides.slice(0, insertIndex),
      newSlide,
      ...slides.slice(insertIndex),
    ];

    // Renumber slides
    newSlides.forEach((slide, i) => {
      slide.slideNumber = i + 1;
    });

    set({
      slides: newSlides,
      currentSlideIndex: insertIndex,
      selectedLayerId: null,
    });
  },

  deleteSlide: (index: number) => {
    const { slides } = get();
    if (slides.length <= 1) return; // Keep at least one slide

    get().pushHistory();
    const newSlides = slides.filter((_, i) => i !== index);

    // Renumber slides
    newSlides.forEach((slide, i) => {
      slide.slideNumber = i + 1;
    });

    const newIndex = Math.min(index, newSlides.length - 1);
    set({
      slides: newSlides,
      currentSlideIndex: newIndex,
      selectedLayerId: null,
    });
  },

  duplicateSlide: (index: number) => {
    get().pushHistory();
    const { slides } = get();
    const slideToDuplicate = slides[index];
    if (!slideToDuplicate) return;

    const now = new Date().toISOString();
    const duplicatedSlide: LayeredSlide = {
      ...JSON.parse(JSON.stringify(slideToDuplicate)),
      id: createLayerId('slide'),
      slideNumber: index + 2,
      createdAt: now,
      updatedAt: now,
    };

    // Give new IDs to all layers
    duplicatedSlide.layers = duplicatedSlide.layers.map((layer: SlideLayer) => ({
      ...layer,
      id: createLayerId(layer.type),
    }));

    const newSlides = [
      ...slides.slice(0, index + 1),
      duplicatedSlide,
      ...slides.slice(index + 1),
    ];

    // Renumber slides
    newSlides.forEach((slide, i) => {
      slide.slideNumber = i + 1;
    });

    set({
      slides: newSlides,
      currentSlideIndex: index + 1,
    });
  },

  reorderSlides: (fromIndex: number, toIndex: number) => {
    get().pushHistory();
    const { slides } = get();
    const newSlides = [...slides];
    const [removed] = newSlides.splice(fromIndex, 1);
    newSlides.splice(toIndex, 0, removed);

    // Renumber slides
    newSlides.forEach((slide, i) => {
      slide.slideNumber = i + 1;
    });

    set({ slides: newSlides, currentSlideIndex: toIndex });
  },

  updateSlide: (index: number, updates: Partial<LayeredSlide>) => {
    const { slides } = get();
    if (!slides[index]) return;

    get().pushHistory();
    const newSlides = [...slides];
    newSlides[index] = {
      ...newSlides[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({ slides: newSlides });
  },

  // Layers
  selectLayer: (layerId: string | null) => {
    set({ selectedLayerId: layerId });
  },

  addLayer: (layer: SlideLayer) => {
    get().pushHistory();
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const newSlides = [...slides];
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      layers: [...currentSlide.layers, layer],
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({ slides: newSlides, selectedLayerId: layer.id });
  },

  updateLayer: (layerId: string, updates: Partial<SlideLayer>) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const layerIndex = currentSlide.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    get().pushHistory();
    const newSlides = [...slides];
    const newLayers = [...currentSlide.layers];
    newLayers[layerIndex] = { ...newLayers[layerIndex], ...updates } as SlideLayer;
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      layers: newLayers,
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({ slides: newSlides });
  },

  deleteLayer: (layerId: string) => {
    const { slides, currentSlideIndex, selectedLayerId } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    // Don't delete background layer
    const layer = currentSlide.layers.find(l => l.id === layerId);
    if (layer?.type === 'background') return;

    get().pushHistory();
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      layers: currentSlide.layers.filter(l => l.id !== layerId),
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({
      slides: newSlides,
      selectedLayerId: selectedLayerId === layerId ? null : selectedLayerId,
    });
  },

  duplicateLayer: (layerId: string) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const layer = currentSlide.layers.find(l => l.id === layerId);
    if (!layer || layer.type === 'background') return;

    get().pushHistory();
    const duplicatedLayer = {
      ...JSON.parse(JSON.stringify(layer)),
      id: createLayerId(layer.type),
    };

    // Offset position slightly
    if ('transform' in duplicatedLayer) {
      duplicatedLayer.transform.x += 20;
      duplicatedLayer.transform.y += 20;
    }

    const newSlides = [...slides];
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      layers: [...currentSlide.layers, duplicatedLayer],
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({ slides: newSlides, selectedLayerId: duplicatedLayer.id });
  },

  reorderLayers: (fromZIndex: number, toZIndex: number) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    get().pushHistory();
    const newLayers = currentSlide.layers.map(layer => {
      if ('transform' in layer) {
        if (layer.transform.zIndex === fromZIndex) {
          return { ...layer, transform: { ...layer.transform, zIndex: toZIndex } };
        } else if (
          fromZIndex < toZIndex &&
          layer.transform.zIndex > fromZIndex &&
          layer.transform.zIndex <= toZIndex
        ) {
          return { ...layer, transform: { ...layer.transform, zIndex: layer.transform.zIndex - 1 } };
        } else if (
          fromZIndex > toZIndex &&
          layer.transform.zIndex < fromZIndex &&
          layer.transform.zIndex >= toZIndex
        ) {
          return { ...layer, transform: { ...layer.transform, zIndex: layer.transform.zIndex + 1 } };
        }
      }
      return layer;
    });

    const newSlides = [...slides];
    newSlides[currentSlideIndex] = {
      ...currentSlide,
      layers: newLayers,
      updatedAt: new Date().toISOString(),
      isEdited: true,
    };
    set({ slides: newSlides });
  },

  bringToFront: (layerId: string) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const maxZIndex = Math.max(
      ...currentSlide.layers
        .filter((l): l is SlideLayer & { transform: { zIndex: number } } => 'transform' in l)
        .map(l => l.transform.zIndex),
      0
    );

    get().updateLayer(layerId, { transform: { zIndex: maxZIndex + 1 } } as Partial<SlideLayer>);
  },

  sendToBack: (layerId: string) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    // Find min zIndex (excluding background which has no transform)
    const minZIndex = Math.min(
      ...currentSlide.layers
        .filter((l): l is SlideLayer & { transform: { zIndex: number } } => 'transform' in l)
        .map(l => l.transform.zIndex),
      1
    );

    get().updateLayer(layerId, { transform: { zIndex: Math.max(minZIndex - 1, 1) } } as Partial<SlideLayer>);
  },

  // Quick add helpers
  addTextLayer: (content: string, options?: TextLayerOptions) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const maxZIndex = Math.max(
      ...currentSlide.layers
        .filter((l): l is SlideLayer & { transform: { zIndex: number } } => 'transform' in l)
        .map(l => l.transform.zIndex),
      0
    );

    const layer = createDefaultTextLayer(content, { zIndex: maxZIndex + 1, ...options });
    get().addLayer(layer);
  },

  addImageLayer: (imageUrl: string, options?: Partial<ImageLayer>) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const maxZIndex = Math.max(
      ...currentSlide.layers
        .filter((l): l is SlideLayer & { transform: { zIndex: number } } => 'transform' in l)
        .map(l => l.transform.zIndex),
      0
    );

    const layer = createDefaultImageLayer(imageUrl, { zIndex: maxZIndex + 1, ...options });
    get().addLayer(layer);
  },

  addShapeLayer: (shapeType: ShapeLayer['shapeType'], options?: Partial<ShapeLayer>) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const maxZIndex = Math.max(
      ...currentSlide.layers
        .filter((l): l is SlideLayer & { transform: { zIndex: number } } => 'transform' in l)
        .map(l => l.transform.zIndex),
      0
    );

    const layer = createDefaultShapeLayer(shapeType, { zIndex: maxZIndex + 1, ...options });
    get().addLayer(layer);
  },

  setBackground: (background: Partial<BackgroundLayer>) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const bgLayer = currentSlide.layers.find(l => l.type === 'background');
    if (bgLayer) {
      get().updateLayer(bgLayer.id, background);
    }
  },

  // Editor state
  setEditorMode: (mode: EditorMode) => {
    set({ editorMode: mode });
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.25, Math.min(2, zoom)) });
  },

  toggleGrid: () => {
    set(state => ({ showGrid: !state.showGrid }));
  },

  togglePreview: () => {
    set(state => ({ isPreviewing: !state.isPreviewing, selectedLayerId: null }));
  },

  // History
  pushHistory: () => {
    const { slides, history, historyIndex } = get();

    // Remove any redo history
    const newHistory = history.slice(0, historyIndex + 1);

    // Add current state
    newHistory.push({
      slides: JSON.parse(JSON.stringify(slides)),
      timestamp: Date.now(),
    });

    // Limit history size
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    set({
      slides: JSON.parse(JSON.stringify(history[newIndex].slides)),
      historyIndex: newIndex,
      selectedLayerId: null,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    set({
      slides: JSON.parse(JSON.stringify(history[newIndex].slides)),
      historyIndex: newIndex,
      selectedLayerId: null,
    });
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  // AI
  setAISuggestion: (suggestion: AICarouselSuggestion | null) => {
    set({ aiSuggestion: suggestion });
  },

  setLoadingAI: (loading: boolean) => {
    set({ isLoadingAI: loading });
  },

  applyAISuggestion: (slideIndex: number, suggestion: AILayoutSuggestion) => {
    // This will be implemented to convert AI suggestions to actual layers
    // For now, it's a placeholder
    console.log('Applying AI suggestion to slide', slideIndex, suggestion);
  },

  // Getters
  getCurrentSlide: () => {
    const { slides, currentSlideIndex } = get();
    return slides[currentSlideIndex] || null;
  },

  getSelectedLayer: () => {
    const { slides, currentSlideIndex, selectedLayerId } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide || !selectedLayerId) return null;
    return currentSlide.layers.find(l => l.id === selectedLayerId) || null;
  },

  getLayersByType: (type: SlideLayer['type']) => {
    const { slides, currentSlideIndex } = get();
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return [];
    return currentSlide.layers.filter(l => l.type === type);
  },
}));
