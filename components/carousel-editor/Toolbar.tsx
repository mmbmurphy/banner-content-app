'use client';

import { useState, useRef } from 'react';
import type { ShapeLayer } from '@/types/carousel-layers';
import type { BrandKit } from '@/types/brand';

interface ToolbarProps {
  onAddText: () => void;
  onAddImage: (url: string) => void;
  onAddShape: (type: ShapeLayer['shapeType']) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  isPreviewing: boolean;
  onTogglePreview: () => void;
  onSave: () => void;
  onGenerateImages: () => Promise<string[]>;
  brandKit: BrandKit;
}

export function Toolbar({
  onAddText,
  onAddImage,
  onAddShape,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  showGrid,
  onToggleGrid,
  isPreviewing,
  onTogglePreview,
  onSave,
  onGenerateImages,
  brandKit,
}: ToolbarProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImage = () => {
    if (imageUrl.trim()) {
      onAddImage(imageUrl.trim());
      setImageUrl('');
      setShowImagePicker(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'carousel');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        onAddImage(data.url);
        setShowImagePicker(false);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateImages = async () => {
    setIsGenerating(true);
    try {
      await onGenerateImages();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Left: Add tools */}
      <div className="flex items-center gap-2">
        {/* Add Text */}
        <button
          onClick={onAddText}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          title="Add Text"
        >
          <span className="font-bold">T</span>
          <span className="hidden sm:inline">Text</span>
        </button>

        {/* Add Image */}
        <div className="relative">
          <button
            onClick={() => setShowImagePicker(!showImagePicker)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            title="Add Image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Image</span>
          </button>

          {showImagePicker && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                    />
                    <button
                      onClick={handleAddImage}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-500"
                  >
                    Upload from computer
                  </button>
                </div>

                {/* Brand logos */}
                {brandKit.logos.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Brand Logos</label>
                    <div className="flex flex-wrap gap-2">
                      {brandKit.logos.map((logo) => (
                        <button
                          key={logo.id}
                          onClick={() => {
                            onAddImage(logo.url);
                            setShowImagePicker(false);
                          }}
                          className="w-12 h-12 border border-gray-200 rounded p-1 hover:border-blue-500"
                        >
                          <img src={logo.url} alt={logo.name} className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Shape */}
        <div className="relative">
          <button
            onClick={() => setShowShapePicker(!showShapePicker)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            title="Add Shape"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            </svg>
            <span className="hidden sm:inline">Shape</span>
          </button>

          {showShapePicker && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onAddShape('rectangle');
                    setShowShapePicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded"
                  title="Rectangle"
                >
                  <div className="w-6 h-4 border-2 border-gray-600" />
                </button>
                <button
                  onClick={() => {
                    onAddShape('circle');
                    setShowShapePicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded"
                  title="Circle"
                >
                  <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
                </button>
                <button
                  onClick={() => {
                    onAddShape('line');
                    setShowShapePicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded"
                  title="Line"
                >
                  <div className="w-6 h-0.5 bg-gray-600 transform rotate-45" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>

      {/* Center: Zoom */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(zoom - 0.1)}
          disabled={zoom <= 0.3}
          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(zoom + 0.1)}
          disabled={zoom >= 2}
          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => onZoomChange(1)}
          className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
        >
          Reset
        </button>
      </div>

      {/* Right: View options and actions */}
      <div className="flex items-center gap-2">
        {/* Grid toggle */}
        <button
          onClick={onToggleGrid}
          className={`p-1.5 rounded ${showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          title="Toggle Grid"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16M4 15h16M9 4v16M15 4v16" />
          </svg>
        </button>

        {/* Preview toggle */}
        <button
          onClick={onTogglePreview}
          className={`p-1.5 rounded ${isPreviewing ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          title="Preview Mode"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Save */}
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Save
        </button>

        {/* Generate Images */}
        <button
          onClick={handleGenerateImages}
          disabled={isGenerating}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Images'
          )}
        </button>
      </div>
    </div>
  );
}
