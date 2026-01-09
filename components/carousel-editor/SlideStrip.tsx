'use client';

import type { LayeredSlide } from '@/types/carousel-layers';

interface SlideStripProps {
  slides: LayeredSlide[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: (type?: LayeredSlide['slideType']) => void;
  onDeleteSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
}

function getSlideTypeLabel(type: LayeredSlide['slideType']): string {
  switch (type) {
    case 'hook':
      return 'Hook';
    case 'content':
      return 'Content';
    case 'cta':
      return 'CTA';
    case 'custom':
      return 'Custom';
    default:
      return 'Slide';
  }
}

function getSlideTypeColor(type: LayeredSlide['slideType']): string {
  switch (type) {
    case 'hook':
      return 'bg-purple-500';
    case 'content':
      return 'bg-blue-500';
    case 'cta':
      return 'bg-green-500';
    case 'custom':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

export function SlideStrip({
  slides,
  currentSlideIndex,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: SlideStripProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-t border-gray-200 overflow-x-auto">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`
            relative flex-shrink-0 group cursor-pointer
            ${index === currentSlideIndex ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          `}
          onClick={() => onSlideSelect(index)}
        >
          {/* Slide thumbnail */}
          <div
            className={`
              w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center
              ${index === currentSlideIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}
            `}
          >
            {/* Slide type badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded text-white ${getSlideTypeColor(slide.slideType)}`}>
              {getSlideTypeLabel(slide.slideType)}
            </span>

            {/* Slide number */}
            <span className="text-lg font-bold text-gray-700 mt-1">{slide.slideNumber}</span>

            {/* Layer count */}
            <span className="text-xs text-gray-400">{slide.layers.length} layers</span>
          </div>

          {/* Hover actions */}
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateSlide(index);
              }}
              className="w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-100"
              title="Duplicate"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            {slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSlide(index);
                }}
                className="w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50"
                title="Delete"
              >
                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Edited indicator */}
          {slide.isEdited && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white" title="Edited" />
          )}
        </div>
      ))}

      {/* Add slide button */}
      <div className="relative flex-shrink-0 group">
        <button
          onClick={() => onAddSlide('content')}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs mt-1">Add Slide</span>
        </button>

        {/* Slide type dropdown on hover */}
        <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 whitespace-nowrap">
            <button
              onClick={() => onAddSlide('hook')}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-purple-50 text-purple-600 rounded"
            >
              Hook Slide
            </button>
            <button
              onClick={() => onAddSlide('content')}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 text-blue-600 rounded"
            >
              Content Slide
            </button>
            <button
              onClick={() => onAddSlide('cta')}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-green-50 text-green-600 rounded"
            >
              CTA Slide
            </button>
          </div>
        </div>
      </div>

      {/* Slide count */}
      <div className="flex-shrink-0 px-3 py-1 text-sm text-gray-500">
        {slides.length} slide{slides.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
