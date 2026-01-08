'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { BrandColor, BrandLogo, BrandFont, BrandImage, BrandSocialProfile, ContentType } from '@/types/brand';
import { useBrandKitStore } from '@/lib/store/brand-kit-store';

type TabId = 'general' | 'logos' | 'colors' | 'typography' | 'images' | 'social' | 'carousel' | 'voice' | 'content-types';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '🏢' },
  { id: 'content-types', label: 'Content Types', icon: '📂' },
  { id: 'logos', label: 'Logos', icon: '🖼️' },
  { id: 'colors', label: 'Colors', icon: '🎨' },
  { id: 'typography', label: 'Typography', icon: '📝' },
  { id: 'images', label: 'Images', icon: '📷' },
  { id: 'social', label: 'Social', icon: '🔗' },
  { id: 'carousel', label: 'Carousel', icon: '📊' },
  { id: 'voice', label: 'Brand Voice', icon: '💬' },
];

const DEFAULT_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-lime-100 text-lime-700',
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-red-100 text-red-700',
  'bg-pink-100 text-pink-700',
];

const SOCIAL_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube', 'tiktok', 'website', 'other'] as const;

export default function SettingsPage() {
  const {
    brandKit,
    setBrandKit: setStoreBrandKit,
    fetchBrandKit,
    saveBrandKit: storeSaveBrandKit,
    isLoading,
    isSaving,
    saveStatus,
  } = useBrandKitStore();

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Load brand kit on mount
  useEffect(() => {
    // Force refetch to get latest from server
    fetchBrandKit();
  }, [fetchBrandKit]);

  // Wrapper to support callback pattern for setBrandKit
  const setBrandKit = (updater: typeof brandKit | ((prev: typeof brandKit) => typeof brandKit)) => {
    if (typeof updater === 'function') {
      setStoreBrandKit(updater(brandKit));
    } else {
      setStoreBrandKit(updater);
    }
  };

  const saveBrandKit = async () => {
    await storeSaveBrandKit(brandKit);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'image') => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', type === 'logo' ? 'logos' : 'images');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.url) {
        if (type === 'logo') {
          if (uploadingFor === 'new') {
            const newLogo: BrandLogo = {
              id: `logo_${Date.now()}`,
              name: file.name.split('.')[0],
              url: data.url,
              type: 'other',
              format: file.name.split('.').pop(),
            };
            setBrandKit(prev => ({ ...prev, logos: [...prev.logos, newLogo] }));
          } else {
            setBrandKit(prev => ({
              ...prev,
              logos: prev.logos.map(l => l.id === uploadingFor ? { ...l, url: data.url } : l)
            }));
          }
        } else {
          if (uploadingFor === 'new') {
            const newImage: BrandImage = {
              id: `img_${Date.now()}`,
              name: file.name.split('.')[0],
              url: data.url,
              type: 'other',
            };
            setBrandKit(prev => ({ ...prev, images: [...prev.images, newImage] }));
          } else {
            setBrandKit(prev => ({
              ...prev,
              images: prev.images.map(i => i.id === uploadingFor ? { ...i, url: data.url } : i)
            }));
          }
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingFor(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Color helpers
  const addColor = () => {
    const newColor: BrandColor = {
      id: `color_${Date.now()}`,
      name: 'New Color',
      hex: '#000000',
      type: 'other',
    };
    setBrandKit(prev => ({ ...prev, colors: [...prev.colors, newColor] }));
  };

  const updateColor = (id: string, updates: Partial<BrandColor>) => {
    setBrandKit(prev => ({
      ...prev,
      colors: prev.colors.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const removeColor = (id: string) => {
    setBrandKit(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c.id !== id)
    }));
  };

  // Font helpers
  const addFont = () => {
    const newFont: BrandFont = {
      id: `font_${Date.now()}`,
      name: 'New Font',
      type: 'body',
    };
    setBrandKit(prev => ({ ...prev, fonts: [...prev.fonts, newFont] }));
  };

  const updateFont = (id: string, updates: Partial<BrandFont>) => {
    setBrandKit(prev => ({
      ...prev,
      fonts: prev.fonts.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const removeFont = (id: string) => {
    setBrandKit(prev => ({
      ...prev,
      fonts: prev.fonts.filter(f => f.id !== id)
    }));
  };

  // Social profile helpers
  const addSocialProfile = () => {
    const newProfile: BrandSocialProfile = {
      platform: 'website',
      url: '',
    };
    setBrandKit(prev => ({ ...prev, socialProfiles: [...prev.socialProfiles, newProfile] }));
  };

  const updateSocialProfile = (index: number, updates: Partial<BrandSocialProfile>) => {
    setBrandKit(prev => ({
      ...prev,
      socialProfiles: prev.socialProfiles.map((p, i) => i === index ? { ...p, ...updates } : p)
    }));
  };

  const removeSocialProfile = (index: number) => {
    setBrandKit(prev => ({
      ...prev,
      socialProfiles: prev.socialProfiles.filter((_, i) => i !== index)
    }));
  };

  // Content type helpers
  const addContentType = () => {
    const newType: ContentType = {
      id: `ct_${Date.now()}`,
      value: `type-${Date.now()}`,
      label: 'New Type',
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
    };
    setBrandKit(prev => ({
      ...prev,
      contentTypes: [...(prev.contentTypes || []), newType]
    }));
  };

  const updateContentType = (id: string, updates: Partial<ContentType>) => {
    setBrandKit(prev => ({
      ...prev,
      contentTypes: (prev.contentTypes || []).map(ct =>
        ct.id === id ? { ...ct, ...updates } : ct
      )
    }));
  };

  const removeContentType = (id: string) => {
    setBrandKit(prev => ({
      ...prev,
      contentTypes: (prev.contentTypes || []).filter(ct => ct.id !== id)
    }));
  };

  const moveContentType = (id: string, direction: 'up' | 'down') => {
    setBrandKit(prev => {
      const types = [...(prev.contentTypes || [])];
      const index = types.findIndex(ct => ct.id === id);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= types.length) return prev;

      [types[index], types[newIndex]] = [types[newIndex], types[index]];
      return { ...prev, contentTypes: types };
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, activeTab === 'logos' ? 'logo' : 'image')}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-brand-accent mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-brand-primary">Settings</h1>
          <p className="text-gray-500">Manage your brand kit and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-green-600 text-sm">Saved!</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm">Error saving</span>
          )}
          <button
            onClick={saveBrandKit}
            disabled={isSaving}
            className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-brand-accent text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-brand-primary">General Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand Kit Name
                  </label>
                  <input
                    type="text"
                    value={brandKit.name}
                    onChange={(e) => setBrandKit(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={brandKit.companyName || ''}
                    onChange={(e) => setBrandKit(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={brandKit.tagline || ''}
                  onChange={(e) => setBrandKit(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Your company's tagline or slogan"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={brandKit.website || ''}
                  onChange={(e) => setBrandKit(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://yourcompany.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-md font-semibold text-brand-primary mb-4">Default CTA</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CTA Headline
                    </label>
                    <input
                      type="text"
                      value={brandKit.defaultCta?.headline || ''}
                      onChange={(e) => setBrandKit(prev => ({
                        ...prev,
                        defaultCta: { ...prev.defaultCta, headline: e.target.value, url: prev.defaultCta?.url || '' }
                      }))}
                      placeholder="Read the Full Guide"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CTA URL
                    </label>
                    <input
                      type="text"
                      value={brandKit.defaultCta?.url || ''}
                      onChange={(e) => setBrandKit(prev => ({
                        ...prev,
                        defaultCta: { ...prev.defaultCta, url: e.target.value, headline: prev.defaultCta?.headline || '' }
                      }))}
                      placeholder="yoursite.com/info"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Types Tab */}
          {activeTab === 'content-types' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-brand-primary">Content Types</h2>
                  <p className="text-sm text-gray-500">Define the types of content your team creates. These appear in the dashboard for categorizing sessions.</p>
                </div>
                <button
                  onClick={addContentType}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Type
                </button>
              </div>

              <div className="space-y-3">
                {(brandKit.contentTypes || []).map((ct, index) => (
                  <div key={ct.id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-white">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveContentType(ct.id, 'up')}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveContentType(ct.id, 'down')}
                        disabled={index === (brandKit.contentTypes || []).length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Preview badge */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${ct.color}`}>
                      {ct.label}
                    </span>

                    {/* Label input */}
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={ct.label}
                        onChange={(e) => updateContentType(ct.id, { label: e.target.value })}
                        placeholder="Blog Post"
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                      />
                    </div>

                    {/* Value input */}
                    <div className="w-40">
                      <label className="block text-xs text-gray-500 mb-1">ID (URL-safe)</label>
                      <input
                        type="text"
                        value={ct.value}
                        onChange={(e) => updateContentType(ct.id, {
                          value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                        })}
                        placeholder="blog-post"
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-mono"
                      />
                    </div>

                    {/* Color select */}
                    <div className="w-48">
                      <label className="block text-xs text-gray-500 mb-1">Color</label>
                      <select
                        value={ct.color}
                        onChange={(e) => updateContentType(ct.id, { color: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                      >
                        {DEFAULT_COLORS.map((color) => (
                          <option key={color} value={color}>
                            {color.replace('bg-', '').replace('-100 text-', ' / ').replace('-700', '')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeContentType(ct.id)}
                      className="text-gray-400 hover:text-red-500 p-2 mt-4"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {(!brandKit.contentTypes || brandKit.contentTypes.length === 0) && (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <p>No content types defined</p>
                  <p className="text-sm mt-1">Add types to categorize your content pipelines</p>
                  <button
                    onClick={addContentType}
                    className="mt-4 text-brand-accent hover:underline text-sm"
                  >
                    + Add your first content type
                  </button>
                </div>
              )}

              {/* Preview section */}
              {brandKit.contentTypes && brandKit.contentTypes.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
                  <div className="flex flex-wrap gap-2">
                    {brandKit.contentTypes.map((ct) => (
                      <span key={ct.id} className={`px-3 py-1 rounded-full text-sm font-medium ${ct.color}`}>
                        {ct.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logos Tab */}
          {activeTab === 'logos' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-brand-primary">Logos</h2>
                <button
                  onClick={() => {
                    setUploadingFor('new');
                    fileInputRef.current?.click();
                  }}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Logo
                </button>
              </div>

              {brandKit.logos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No logos added yet</p>
                  <p className="text-sm mt-1">Upload your brand logos (PNG, SVG recommended)</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {brandKit.logos.map((logo) => (
                    <div key={logo.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={logo.name}
                          onChange={(e) => setBrandKit(prev => ({
                            ...prev,
                            logos: prev.logos.map(l => l.id === logo.id ? { ...l, name: e.target.value } : l)
                          }))}
                          className="w-full px-3 py-1 border border-gray-200 rounded text-sm"
                          placeholder="Logo name"
                        />
                        <select
                          value={logo.type}
                          onChange={(e) => setBrandKit(prev => ({
                            ...prev,
                            logos: prev.logos.map(l => l.id === logo.id ? { ...l, type: e.target.value as BrandLogo['type'] } : l)
                          }))}
                          className="w-full px-3 py-1 border border-gray-200 rounded text-sm"
                        >
                          <option value="primary">Primary Logo</option>
                          <option value="secondary">Secondary</option>
                          <option value="icon">Icon Only</option>
                          <option value="wordmark">Wordmark</option>
                          <option value="white">White Version</option>
                          <option value="dark">Dark Version</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setUploadingFor(logo.id);
                              fileInputRef.current?.click();
                            }}
                            className="text-xs text-brand-accent hover:underline"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => setBrandKit(prev => ({
                              ...prev,
                              logos: prev.logos.filter(l => l.id !== logo.id)
                            }))}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-brand-primary">Brand Colors</h2>
                <button
                  onClick={addColor}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Color
                </button>
              </div>

              <div className="space-y-4">
                {brandKit.colors.map((color) => (
                  <div key={color.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={color.hex}
                        onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                        className="w-12 h-12 rounded cursor-pointer border-0"
                      />
                      <div
                        className="w-12 h-12 rounded border border-gray-200"
                        style={{ backgroundColor: color.hex }}
                      />
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={color.name}
                        onChange={(e) => updateColor(color.id, { name: e.target.value })}
                        placeholder="Color name"
                        className="px-3 py-2 border border-gray-200 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={color.hex}
                        onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                        placeholder="#000000"
                        className="px-3 py-2 border border-gray-200 rounded text-sm font-mono"
                      />
                      <select
                        value={color.type}
                        onChange={(e) => updateColor(color.id, { type: e.target.value as BrandColor['type'] })}
                        className="px-3 py-2 border border-gray-200 rounded text-sm"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="accent">Accent</option>
                        <option value="background">Background</option>
                        <option value="text">Text</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        value={color.usage || ''}
                        onChange={(e) => updateColor(color.id, { usage: e.target.value })}
                        placeholder="Usage notes"
                        className="px-3 py-2 border border-gray-200 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeColor(color.id)}
                      className="text-gray-400 hover:text-red-500 p-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Color Preview */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Color Palette Preview</h3>
                <div className="flex gap-2">
                  {brandKit.colors.map((color) => (
                    <div key={color.id} className="text-center">
                      <div
                        className="w-16 h-16 rounded-lg border border-gray-200"
                        style={{ backgroundColor: color.hex }}
                      />
                      <p className="text-xs text-gray-500 mt-1">{color.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Typography Tab */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-brand-primary">Typography</h2>
                <button
                  onClick={addFont}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Font
                </button>
              </div>

              <div className="space-y-4">
                {brandKit.fonts.map((font) => (
                  <div key={font.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Font Name</label>
                        <input
                          type="text"
                          value={font.name}
                          onChange={(e) => updateFont(font.id, { name: e.target.value })}
                          placeholder="Inter"
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select
                          value={font.type}
                          onChange={(e) => updateFont(font.id, { type: e.target.value as BrandFont['type'] })}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                        >
                          <option value="heading">Heading</option>
                          <option value="body">Body</option>
                          <option value="accent">Accent</option>
                          <option value="mono">Monospace</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Weights</label>
                        <input
                          type="text"
                          value={font.weight || ''}
                          onChange={(e) => updateFont(font.id, { weight: e.target.value })}
                          placeholder="400,500,600,700"
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fallback</label>
                        <input
                          type="text"
                          value={font.fallback || ''}
                          onChange={(e) => updateFont(font.id, { fallback: e.target.value })}
                          placeholder="sans-serif"
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <input
                        type="text"
                        value={font.googleFontUrl || ''}
                        onChange={(e) => updateFont(font.id, { googleFontUrl: e.target.value })}
                        placeholder="Google Fonts URL (optional)"
                        className="flex-1 mr-4 px-3 py-2 border border-gray-200 rounded text-sm"
                      />
                      <button
                        onClick={() => removeFont(font.id)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    {/* Font Preview */}
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p style={{ fontFamily: `${font.name}, ${font.fallback || 'sans-serif'}` }} className="text-2xl">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-brand-primary">Brand Images</h2>
                <button
                  onClick={() => {
                    setUploadingFor('new');
                    fileInputRef.current?.click();
                  }}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Image
                </button>
              </div>

              {brandKit.images.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No images added yet</p>
                  <p className="text-sm mt-1">Upload backgrounds, patterns, and other brand assets</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {brandKit.images.map((image) => (
                    <div key={image.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="aspect-video bg-gray-100 rounded mb-3 overflow-hidden">
                        <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
                      </div>
                      <input
                        type="text"
                        value={image.name}
                        onChange={(e) => setBrandKit(prev => ({
                          ...prev,
                          images: prev.images.map(i => i.id === image.id ? { ...i, name: e.target.value } : i)
                        }))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2"
                      />
                      <select
                        value={image.type}
                        onChange={(e) => setBrandKit(prev => ({
                          ...prev,
                          images: prev.images.map(i => i.id === image.id ? { ...i, type: e.target.value as BrandImage['type'] } : i)
                        }))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2"
                      >
                        <option value="background">Background</option>
                        <option value="pattern">Pattern</option>
                        <option value="texture">Texture</option>
                        <option value="hero">Hero Image</option>
                        <option value="social">Social Media</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setUploadingFor(image.id);
                            fileInputRef.current?.click();
                          }}
                          className="text-xs text-brand-accent hover:underline"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => setBrandKit(prev => ({
                            ...prev,
                            images: prev.images.filter(i => i.id !== image.id)
                          }))}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Social Tab */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-brand-primary">Social Profiles</h2>
                <button
                  onClick={addSocialProfile}
                  className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  + Add Profile
                </button>
              </div>

              <div className="space-y-3">
                {brandKit.socialProfiles.map((profile, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                    <select
                      value={profile.platform}
                      onChange={(e) => updateSocialProfile(index, { platform: e.target.value as BrandSocialProfile['platform'] })}
                      className="px-3 py-2 border border-gray-200 rounded text-sm w-32"
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={profile.url}
                      onChange={(e) => updateSocialProfile(index, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm"
                    />
                    <input
                      type="text"
                      value={profile.handle || ''}
                      onChange={(e) => updateSocialProfile(index, { handle: e.target.value })}
                      placeholder="@handle"
                      className="w-32 px-3 py-2 border border-gray-200 rounded text-sm"
                    />
                    <button
                      onClick={() => removeSocialProfile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {brandKit.socialProfiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No social profiles added</p>
                </div>
              )}
            </div>
          )}

          {/* Carousel Tab */}
          {activeTab === 'carousel' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-brand-primary">Carousel Templates</h2>
              <p className="text-sm text-gray-500">Configure default styles for LinkedIn carousel slides</p>

              {brandKit.carouselTemplates.map((template, index) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => {
                        const updated = [...brandKit.carouselTemplates];
                        updated[index] = { ...template, name: e.target.value };
                        setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                      }}
                      className="text-lg font-medium px-2 py-1 border-b border-transparent hover:border-gray-200 focus:border-brand-accent focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Hook Slide */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Hook Slide</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Background</label>
                          <input
                            type="color"
                            value={template.hookSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, hookSlide: { ...template.hookSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.hookSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, hookSlide: { ...template.hookSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Text</label>
                          <input
                            type="color"
                            value={template.hookSlide.textColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, hookSlide: { ...template.hookSlide, textColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.hookSlide.textColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, hookSlide: { ...template.hookSlide, textColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                      {/* Preview */}
                      <div
                        className="aspect-square rounded-lg p-4 flex items-center justify-center"
                        style={{ backgroundColor: template.hookSlide.backgroundColor }}
                      >
                        <p style={{ color: template.hookSlide.textColor }} className="text-center font-bold text-sm">
                          Hook Preview
                        </p>
                      </div>
                    </div>

                    {/* Content Slide */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Content Slide</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Background</label>
                          <input
                            type="color"
                            value={template.contentSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, contentSlide: { ...template.contentSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.contentSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, contentSlide: { ...template.contentSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Headline</label>
                          <input
                            type="color"
                            value={template.contentSlide.headlineColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, contentSlide: { ...template.contentSlide, headlineColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.contentSlide.headlineColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, contentSlide: { ...template.contentSlide, headlineColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                      {/* Preview */}
                      <div
                        className="aspect-square rounded-lg p-4 flex flex-col items-center justify-center"
                        style={{ backgroundColor: template.contentSlide.backgroundColor }}
                      >
                        <p style={{ color: template.contentSlide.headlineColor }} className="font-bold text-sm">
                          Headline
                        </p>
                        <p style={{ color: template.contentSlide.subheadColor }} className="text-xs mt-1">
                          Subhead text
                        </p>
                      </div>
                    </div>

                    {/* CTA Slide */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">CTA Slide</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Background</label>
                          <input
                            type="color"
                            value={template.ctaSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, ctaSlide: { ...template.ctaSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.ctaSlide.backgroundColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, ctaSlide: { ...template.ctaSlide, backgroundColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-20">Button</label>
                          <input
                            type="color"
                            value={template.ctaSlide.buttonColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, ctaSlide: { ...template.ctaSlide, buttonColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="w-8 h-8 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={template.ctaSlide.buttonColor}
                            onChange={(e) => {
                              const updated = [...brandKit.carouselTemplates];
                              updated[index] = { ...template, ctaSlide: { ...template.ctaSlide, buttonColor: e.target.value } };
                              setBrandKit(prev => ({ ...prev, carouselTemplates: updated }));
                            }}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                      {/* Preview */}
                      <div
                        className="aspect-square rounded-lg p-4 flex flex-col items-center justify-center"
                        style={{ backgroundColor: template.ctaSlide.backgroundColor }}
                      >
                        <p style={{ color: template.ctaSlide.textColor }} className="font-bold text-sm mb-2">
                          Read More
                        </p>
                        <div
                          className="px-3 py-1 rounded text-xs"
                          style={{ backgroundColor: template.ctaSlide.buttonColor, color: template.ctaSlide.buttonTextColor }}
                        >
                          yoursite.com
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Brand Voice Tab */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-brand-primary">Brand Voice</h2>
              <p className="text-sm text-gray-500">Define your brand's tone and personality for AI-generated content</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone (comma-separated)
                </label>
                <input
                  type="text"
                  value={brandKit.voice?.tone?.join(', ') || ''}
                  onChange={(e) => setBrandKit(prev => ({
                    ...prev,
                    voice: {
                      ...prev.voice,
                      tone: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                      personality: prev.voice?.personality || '',
                      doList: prev.voice?.doList || [],
                      dontList: prev.voice?.dontList || [],
                    }
                  }))}
                  placeholder="Professional, Friendly, Authoritative"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personality Description
                </label>
                <textarea
                  value={brandKit.voice?.personality || ''}
                  onChange={(e) => setBrandKit(prev => ({
                    ...prev,
                    voice: {
                      ...prev.voice,
                      personality: e.target.value,
                      tone: prev.voice?.tone || [],
                      doList: prev.voice?.doList || [],
                      dontList: prev.voice?.dontList || [],
                    }
                  }))}
                  placeholder="Describe your brand's personality in a few sentences..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do's (one per line)
                  </label>
                  <textarea
                    value={brandKit.voice?.doList?.join('\n') || ''}
                    onChange={(e) => setBrandKit(prev => ({
                      ...prev,
                      voice: {
                        ...prev.voice,
                        doList: e.target.value.split('\n').filter(Boolean),
                        tone: prev.voice?.tone || [],
                        personality: prev.voice?.personality || '',
                        dontList: prev.voice?.dontList || [],
                      }
                    }))}
                    placeholder="Use clear language&#10;Provide actionable insights&#10;Back claims with data"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Don'ts (one per line)
                  </label>
                  <textarea
                    value={brandKit.voice?.dontList?.join('\n') || ''}
                    onChange={(e) => setBrandKit(prev => ({
                      ...prev,
                      voice: {
                        ...prev.voice,
                        dontList: e.target.value.split('\n').filter(Boolean),
                        tone: prev.voice?.tone || [],
                        personality: prev.voice?.personality || '',
                        doList: prev.voice?.doList || [],
                      }
                    }))}
                    placeholder="Use excessive jargon&#10;Be overly casual&#10;Make unsubstantiated claims"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
