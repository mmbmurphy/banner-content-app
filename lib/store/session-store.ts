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

// API helpers for database persistence
async function syncToApi(sessionId: string, data: Partial<PipelineSession>) {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to sync session to API:', error);
  }
}

async function createSessionInApi(session: PipelineSession) {
  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
  } catch (error) {
    console.error('Failed to create session in API:', error);
  }
}

async function deleteSessionFromApi(sessionId: string) {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete session from API:', error);
  }
}

interface PipelineStore {
  sessions: Record<string, PipelineSession>;
  currentSessionId: string | null;
  isLoading: boolean;
  apiInitialized: boolean;

  // Actions
  createSession: () => string;
  loadSession: (id: string) => PipelineSession | null;
  loadSessionFromApi: (id: string) => Promise<PipelineSession | null>;
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
  fetchSessionsFromApi: () => Promise<void>;
  setApiInitialized: (initialized: boolean) => void;
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentSessionId: null,
      isLoading: false,
      apiInitialized: false,

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

        // Sync to API in background
        createSessionInApi(newSession);

        return id;
      },

      loadSession: (id: string) => {
        const { sessions } = get();
        return sessions[id] || null;
      },

      loadSessionFromApi: async (id: string) => {
        // First check local storage
        const { sessions } = get();
        if (sessions[id]) {
          return sessions[id];
        }

        // Try to load from API
        try {
          const res = await fetch(`/api/sessions/${id}`);
          if (!res.ok) {
            return null;
          }
          const data = await res.json();
          if (data.session) {
            // Save to local store
            set(state => ({
              sessions: {
                ...state.sessions,
                [id]: data.session,
              }
            }));
            return data.session;
          }
        } catch (error) {
          console.error('Failed to load session from API:', error);
        }
        return null;
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

        // Sync to API in background
        const { sessions } = get();
        if (sessions[id]) {
          syncToApi(id, sessions[id]);
        }
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

        // Sync to API in background
        const { sessions } = get();
        if (sessions[id]) {
          syncToApi(id, sessions[id]);
        }
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

        // Sync to API in background
        const { sessions } = get();
        if (sessions[id]) {
          syncToApi(id, sessions[id]);
        }
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

        // Delete from API in background
        deleteSessionFromApi(id);
      },

      getAllSessions: () => {
        const { sessions } = get();
        return Object.values(cleanExpiredSessions(sessions)).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      fetchSessionsFromApi: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/sessions');
          if (res.ok) {
            const data = await res.json();
            if (data.sessions && Array.isArray(data.sessions)) {
              // Merge API sessions with local sessions
              const apiSessions: Record<string, PipelineSession> = {};
              for (const session of data.sessions) {
                apiSessions[session.id] = session;
              }

              set(state => ({
                sessions: {
                  ...state.sessions,
                  ...apiSessions, // API sessions take precedence
                },
                apiInitialized: !data.needsInit,
              }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch sessions from API:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      setApiInitialized: (initialized: boolean) => {
        set({ apiInitialized: initialized });
      },
    }),
    {
      name: 'banner-pipeline-storage',
    }
  )
);
