'use client';

import { useState } from 'react';
import type { SlideLayer, BackgroundLayer, TextLayer, ImageLayer, ShapeLayer } from '@/types/carousel-layers';
import type { BrandKit } from '@/types/brand';

interface PropertyPanelProps {
  layer: SlideLayer;
  brandKit: BrandKit;
  onUpdate: (updates: Partial<SlideLayer>) => void;
  onDelete: () => void;
}

export function PropertyPanel({ layer, brandKit, onUpdate, onDelete }: PropertyPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 capitalize">{layer.type} Properties</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {layer.type === 'background' && (
          <BackgroundProperties layer={layer} brandKit={brandKit} onUpdate={onUpdate} />
        )}
        {layer.type === 'text' && (
          <TextProperties layer={layer} brandKit={brandKit} onUpdate={onUpdate} />
        )}
        {layer.type === 'image' && (
          <ImageProperties layer={layer} onUpdate={onUpdate} />
        )}
        {layer.type === 'shape' && (
          <ShapeProperties layer={layer} brandKit={brandKit} onUpdate={onUpdate} />
        )}
      </div>

      {layer.type !== 'background' && (
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onDelete}
            className="w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
          >
            Delete Layer
          </button>
        </div>
      )}
    </div>
  );
}

// Background properties
function BackgroundProperties({
  layer,
  brandKit,
  onUpdate,
}: {
  layer: BackgroundLayer;
  brandKit: BrandKit;
  onUpdate: (updates: Partial<BackgroundLayer>) => void;
}) {
  return (
    <>
      {/* Background type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <select
          value={layer.backgroundType}
          onChange={(e) => onUpdate({ backgroundType: e.target.value as BackgroundLayer['backgroundType'] })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        >
          <option value="solid">Solid Color</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </div>

      {/* Solid color */}
      {layer.backgroundType === 'solid' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={layer.color || '#FFFFFF'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={layer.color || '#FFFFFF'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-mono"
            />
          </div>
          {/* Brand colors */}
          <div className="flex flex-wrap gap-1 mt-2">
            {brandKit.colors.map((color) => (
              <button
                key={color.id}
                onClick={() => onUpdate({ color: color.hex, brandColorId: color.id })}
                className="w-6 h-6 rounded border border-gray-200"
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Gradient */}
      {layer.backgroundType === 'gradient' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Gradient</label>
          <select
            value={layer.gradient?.type || 'linear'}
            onChange={(e) =>
              onUpdate({
                gradient: {
                  ...layer.gradient,
                  type: e.target.value as 'linear' | 'radial',
                  stops: layer.gradient?.stops || [
                    { color: '#101828', position: 0 },
                    { color: '#0082F3', position: 100 },
                  ],
                },
              })
            }
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
          {layer.gradient?.type === 'linear' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Angle</label>
              <input
                type="range"
                min="0"
                max="360"
                value={layer.gradient?.angle || 0}
                onChange={(e) =>
                  onUpdate({
                    gradient: { ...layer.gradient!, angle: parseInt(e.target.value) },
                  })
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">{layer.gradient?.angle || 0}°</span>
            </div>
          )}
        </div>
      )}

      {/* Image */}
      {layer.backgroundType === 'image' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Image URL</label>
          <input
            type="text"
            value={layer.imageUrl || ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fit</label>
            <select
              value={layer.imageFit || 'cover'}
              onChange={(e) => onUpdate({ imageFit: e.target.value as BackgroundLayer['imageFit'] })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Opacity</label>
            <input
              type="range"
              min="0"
              max="100"
              value={(layer.imageOpacity ?? 1) * 100}
              onChange={(e) => onUpdate({ imageOpacity: parseInt(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
          {/* Brand images */}
          {brandKit.images.filter(img => img.type === 'background').length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Brand Images</label>
              <div className="grid grid-cols-3 gap-1">
                {brandKit.images
                  .filter((img) => img.type === 'background')
                  .map((img) => (
                    <button
                      key={img.id}
                      onClick={() => onUpdate({ imageUrl: img.url, brandImageId: img.id })}
                      className="aspect-square rounded border border-gray-200 overflow-hidden hover:border-blue-500"
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Text properties
function TextProperties({
  layer,
  brandKit,
  onUpdate,
}: {
  layer: TextLayer;
  brandKit: BrandKit;
  onUpdate: (updates: Partial<TextLayer>) => void;
}) {
  return (
    <>
      {/* Content */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Text Content</label>
        <textarea
          value={layer.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm resize-none"
        />
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500">X</label>
            <input
              type="number"
              value={layer.transform.x}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, x: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={layer.transform.y}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, y: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Width</label>
            <input
              type="number"
              value={layer.transform.width}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, width: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Height</label>
            <input
              type="number"
              value={layer.transform.height}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, height: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Font */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Font</label>
        <select
          value={layer.style.fontFamily}
          onChange={(e) => onUpdate({ style: { ...layer.style, fontFamily: e.target.value } })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        >
          <option value="Inter, sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Arial, sans-serif">Arial</option>
          {brandKit.fonts.map((font) => (
            <option key={font.id} value={`${font.name}, ${font.fallback || 'sans-serif'}`}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Size: {layer.style.fontSize}px
        </label>
        <input
          type="range"
          min="12"
          max="120"
          value={layer.style.fontSize}
          onChange={(e) => onUpdate({ style: { ...layer.style, fontSize: parseInt(e.target.value) } })}
          className="w-full"
        />
      </div>

      {/* Font weight */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Weight</label>
        <select
          value={layer.style.fontWeight}
          onChange={(e) => onUpdate({ style: { ...layer.style, fontWeight: parseInt(e.target.value) } })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        >
          <option value={300}>Light</option>
          <option value={400}>Regular</option>
          <option value={500}>Medium</option>
          <option value={600}>Semibold</option>
          <option value={700}>Bold</option>
          <option value={800}>Extra Bold</option>
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={layer.style.color}
            onChange={(e) => onUpdate({ style: { ...layer.style, color: e.target.value } })}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <input
            type="text"
            value={layer.style.color}
            onChange={(e) => onUpdate({ style: { ...layer.style, color: e.target.value } })}
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-mono"
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {brandKit.colors.map((color) => (
            <button
              key={color.id}
              onClick={() =>
                onUpdate({ style: { ...layer.style, color: color.hex, brandColorId: color.id } })
              }
              className="w-6 h-6 rounded border border-gray-200"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Alignment */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Alignment</label>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => onUpdate({ style: { ...layer.style, textAlign: align } })}
              className={`flex-1 px-2 py-1.5 rounded text-sm ${
                layer.style.textAlign === align
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {align.charAt(0).toUpperCase() + align.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Text transform */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Transform</label>
        <select
          value={layer.style.textTransform || 'none'}
          onChange={(e) =>
            onUpdate({
              style: { ...layer.style, textTransform: e.target.value as TextLayer['style']['textTransform'] },
            })
          }
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        >
          <option value="none">None</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Opacity: {Math.round((layer.transform.opacity ?? 1) * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={(layer.transform.opacity ?? 1) * 100}
          onChange={(e) =>
            onUpdate({ transform: { ...layer.transform, opacity: parseInt(e.target.value) / 100 } })
          }
          className="w-full"
        />
      </div>
    </>
  );
}

// Image properties
function ImageProperties({
  layer,
  onUpdate,
}: {
  layer: ImageLayer;
  onUpdate: (updates: Partial<ImageLayer>) => void;
}) {
  return (
    <>
      {/* Image URL */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
        <input
          type="text"
          value={layer.imageUrl}
          onChange={(e) => onUpdate({ imageUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        />
      </div>

      {/* Position & Size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Position & Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500">X</label>
            <input
              type="number"
              value={layer.transform.x}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, x: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={layer.transform.y}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, y: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Width</label>
            <input
              type="number"
              value={layer.transform.width}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, width: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Height</label>
            <input
              type="number"
              value={layer.transform.height}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, height: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Border radius */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Border Radius: {layer.borderRadius || 0}px
        </label>
        <input
          type="range"
          min="0"
          max="200"
          value={layer.borderRadius || 0}
          onChange={(e) => onUpdate({ borderRadius: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Opacity: {Math.round((layer.transform.opacity ?? 1) * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={(layer.transform.opacity ?? 1) * 100}
          onChange={(e) =>
            onUpdate({ transform: { ...layer.transform, opacity: parseInt(e.target.value) / 100 } })
          }
          className="w-full"
        />
      </div>
    </>
  );
}

// Shape properties
function ShapeProperties({
  layer,
  brandKit,
  onUpdate,
}: {
  layer: ShapeLayer;
  brandKit: BrandKit;
  onUpdate: (updates: Partial<ShapeLayer>) => void;
}) {
  return (
    <>
      {/* Shape type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Shape</label>
        <select
          value={layer.shapeType}
          onChange={(e) => onUpdate({ shapeType: e.target.value as ShapeLayer['shapeType'] })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
        >
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="line">Line</option>
        </select>
      </div>

      {/* Position & Size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Position & Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500">X</label>
            <input
              type="number"
              value={layer.transform.x}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, x: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={layer.transform.y}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, y: parseInt(e.target.value) || 0 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Width</label>
            <input
              type="number"
              value={layer.transform.width}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, width: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Height</label>
            <input
              type="number"
              value={layer.transform.height}
              onChange={(e) =>
                onUpdate({ transform: { ...layer.transform, height: parseInt(e.target.value) || 100 } })
              }
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Fill */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Fill</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={layer.fill || '#000000'}
            onChange={(e) => onUpdate({ fill: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <input
            type="text"
            value={layer.fill || ''}
            onChange={(e) => onUpdate({ fill: e.target.value || undefined })}
            placeholder="No fill"
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-mono"
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {brandKit.colors.map((color) => (
            <button
              key={color.id}
              onClick={() => onUpdate({ fill: color.hex, brandColorId: color.id })}
              className="w-6 h-6 rounded border border-gray-200"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Border radius (for rectangles) */}
      {layer.shapeType === 'rectangle' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Border Radius: {layer.borderRadius || 0}px
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={layer.borderRadius || 0}
            onChange={(e) => onUpdate({ borderRadius: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      )}

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Opacity: {Math.round((layer.transform.opacity ?? 1) * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={(layer.transform.opacity ?? 1) * 100}
          onChange={(e) =>
            onUpdate({ transform: { ...layer.transform, opacity: parseInt(e.target.value) / 100 } })
          }
          className="w-full"
        />
      </div>
    </>
  );
}
