'use client';

import type { LayeredSlide, SlideLayer } from '@/types/carousel-layers';

interface LayerPanelProps {
  slide: LayeredSlide | null;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onBringToFront: (layerId: string) => void;
  onSendToBack: (layerId: string) => void;
}

function getLayerIcon(type: SlideLayer['type']): string {
  switch (type) {
    case 'background':
      return '🎨';
    case 'text':
      return 'T';
    case 'image':
      return '🖼';
    case 'shape':
      return '▢';
    default:
      return '?';
  }
}

function getLayerName(layer: SlideLayer): string {
  switch (layer.type) {
    case 'background':
      return 'Background';
    case 'text':
      return layer.content.slice(0, 20) + (layer.content.length > 20 ? '...' : '');
    case 'image':
      return 'Image';
    case 'shape':
      return `Shape (${layer.shapeType})`;
    default:
      return 'Layer';
  }
}

export function LayerPanel({
  slide,
  selectedLayerId,
  onSelectLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onBringToFront,
  onSendToBack,
}: LayerPanelProps) {
  if (!slide) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        No slide selected
      </div>
    );
  }

  // Sort layers by zIndex (highest first for display)
  const sortedLayers = [...slide.layers].sort((a, b) => {
    if (a.type === 'background') return 1; // Background at bottom
    if (b.type === 'background') return -1;
    const aZ = 'transform' in a ? a.transform.zIndex : 0;
    const bZ = 'transform' in b ? b.transform.zIndex : 0;
    return bZ - aZ;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Layers</h3>
        <p className="text-xs text-gray-500 mt-1">
          Click to select, drag to reorder
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedLayers.map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          const isBackground = layer.type === 'background';

          return (
            <div
              key={layer.id}
              className={`
                flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-100
                ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'}
                ${isBackground ? 'opacity-70' : ''}
              `}
              onClick={() => onSelectLayer(isBackground ? null : layer.id)}
            >
              {/* Layer icon */}
              <span className="w-6 h-6 flex items-center justify-center text-sm bg-gray-100 rounded">
                {getLayerIcon(layer.type)}
              </span>

              {/* Layer name */}
              <span className="flex-1 text-sm truncate">
                {getLayerName(layer)}
              </span>

              {/* Actions (only for non-background layers) */}
              {!isBackground && isSelected && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBringToFront(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Bring to front"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendToBack(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Send to back"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateLayer(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Duplicate"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLayer(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Visibility indicator */}
              {'transform' in layer && (
                <span className="text-xs text-gray-400">
                  z{layer.transform.zIndex}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer count */}
      <div className="p-2 border-t border-gray-200 text-xs text-gray-500 text-center">
        {slide.layers.length} layer{slide.layers.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
