'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PipelineSession } from '@/types/session';

const SESSION_EXPIRY_DAYS = 7;

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptySession(id: string): PipelineSession {
  return {
    id,
    createdAt: new Date().toISOString(),
    currentStep: 1,
    status: 'in_progress',
    topic: { source: 'custom', slug: '', title: '' },
    blog: {
      frontmatter: {},
      content: '',
      htmlContent: '',
      status: 'draft'
    },
    linkedin: {
      posts: [],
      carousel: {},
      regenerationCount: 0
    },
    carousel: {
      slides: [],
      imageUrls: [],
      status: 'pending'
    },
    pdf: { status: 'pending' },
    export: {
      sheetsExported: false,
      driveUploaded: false
    },
    queue: {
      postsQueued: [],
      status: 'pending'
    },
  };
}

function cleanExpiredSessions(sessions: Record<string, PipelineSession>): Record<string, PipelineSession> {
  const cutoff = Date.now() - (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return Object.fromEntries(
    Object.entries(sessions).filter(
      ([, session]) => new Date(session.createdAt).getTime() > cutoff
    )
  );
}

interface PipelineStore {
  sessions: Record<string, PipelineSession>;
  currentSessionId: string | null;

  // Actions
  createSession: () => string;
  loadSession: (id: string) => PipelineSession | null;
  updateSession: (id: string, updates: Partial<PipelineSession>) => void;
  updateStepData: <K extends keyof PipelineSession>(
    id: string,
    step: K,
    data: Partial<PipelineSession[K]>
  ) => void;
  setCurrentStep: (id: string, step: number) => void;
  setCurrentSessionId: (id: string | null) => void;
  deleteSession: (id: string) => void;
  getAllSessions: () => PipelineSession[];
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentSessionId: null,

      createSession: () => {
        const id = generateSessionId();
        const newSession = createEmptySession(id);
        set(state => ({
          sessions: {
            ...cleanExpiredSessions(state.sessions),
            [id]: newSession
          },
          currentSessionId: id,
        }));
        return id;
      },

      loadSession: (id: string) => {
        const { sessions } = get();
        return sessions[id] || null;
      },

      updateSession: (id: string, updates: Partial<PipelineSession>) => {
        set(state => {
          if (!state.sessions[id]) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...state.sessions[id], ...updates },
            },
          };
        });
      },

      updateStepData: (id, step, data) => {
        set(state => {
          if (!state.sessions[id]) return state;
          const session = state.sessions[id];
          const currentStepData = session[step];
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                [step]: typeof currentStepData === 'object' && currentStepData !== null
                  ? { ...currentStepData, ...data }
                  : data,
              },
            },
          };
        });
      },

      setCurrentStep: (id: string, step: number) => {
        set(state => {
          if (!state.sessions[id]) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...state.sessions[id],
                currentStep: Math.max(state.sessions[id].currentStep, step),
              },
            },
          };
        });
      },

      setCurrentSessionId: (id: string | null) => {
        set({ currentSessionId: id });
      },

      deleteSession: (id: string) => {
        set(state => {
          const { [id]: _, ...rest } = state.sessions;
          return {
            sessions: rest,
            currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
          };
        });
      },

      getAllSessions: () => {
        const { sessions } = get();
        return Object.values(cleanExpiredSessions(sessions)).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },
    }),
    {
      name: 'banner-pipeline-storage',
    }
  )
);
