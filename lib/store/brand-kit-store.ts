'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BrandKit } from '@/types/brand';
import { DEFAULT_BRAND_KIT } from '@/types/brand';

interface BrandKitStore {
  brandKit: BrandKit;
  currentTeamId: string | null;
  isLoading: boolean;
  lastFetch: number;
  isSaving: boolean;
  saveStatus: 'idle' | 'saved' | 'error';

  // Actions
  fetchBrandKit: () => Promise<void>;
  saveBrandKit: (brandKit: BrandKit) => Promise<boolean>;
  setBrandKit: (brandKit: BrandKit) => void;
  updateBrandKit: (updates: Partial<BrandKit>) => void;
  setCurrentTeamId: (teamId: string | null) => void;
  setSaveStatus: (status: 'idle' | 'saved' | 'error') => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useBrandKitStore = create<BrandKitStore>()(
  persist(
    (set, get) => ({
      brandKit: DEFAULT_BRAND_KIT,
      currentTeamId: null,
      isLoading: false,
      lastFetch: 0,
      isSaving: false,
      saveStatus: 'idle',

      fetchBrandKit: async () => {
        const state = get();
        const now = Date.now();

        // Skip if recently fetched (unless force refresh needed)
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_DURATION &&
          state.brandKit.id !== 'default'
        ) {
          return;
        }

        set({ isLoading: true });
        try {
          const res = await fetch('/api/brand-kit');
          const data = await res.json();

          if (data.brandKit) {
            set({
              brandKit: data.brandKit,
              lastFetch: now,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Failed to fetch brand kit:', error);
          set({ isLoading: false });
        }
      },

      saveBrandKit: async (brandKit: BrandKit) => {
        set({ isSaving: true, saveStatus: 'idle' });
        try {
          const res = await fetch('/api/brand-kit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(brandKit),
          });

          if (res.ok) {
            const data = await res.json();
            set({
              brandKit: data.brandKit || brandKit,
              lastFetch: Date.now(),
              isSaving: false,
              saveStatus: 'saved',
            });

            // Reset save status after 2 seconds
            setTimeout(() => {
              set({ saveStatus: 'idle' });
            }, 2000);

            return true;
          } else {
            set({ isSaving: false, saveStatus: 'error' });
            return false;
          }
        } catch (error) {
          console.error('Failed to save brand kit:', error);
          set({ isSaving: false, saveStatus: 'error' });
          return false;
        }
      },

      setBrandKit: (brandKit: BrandKit) => {
        set({ brandKit });
      },

      updateBrandKit: (updates: Partial<BrandKit>) => {
        set(state => ({
          brandKit: { ...state.brandKit, ...updates },
        }));
      },

      setCurrentTeamId: (teamId: string | null) => {
        const state = get();
        // If team changes, invalidate cache
        if (teamId !== state.currentTeamId) {
          set({ currentTeamId: teamId, lastFetch: 0 });
        }
      },

      setSaveStatus: (status: 'idle' | 'saved' | 'error') => {
        set({ saveStatus: status });
      },
    }),
    {
      name: 'banner-brand-kit-storage',
      // Only persist the brand kit, not loading states
      partialize: (state) => ({
        brandKit: state.brandKit,
        currentTeamId: state.currentTeamId,
        lastFetch: state.lastFetch,
      }),
    }
  )
);
