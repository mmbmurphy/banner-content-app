'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PipelineSession } from '@/types/session';

const SESSION_EXPIRY_DAYS = 7;

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptySession(id: string, teamId?: string): PipelineSession {
  return {
    id,
    createdAt: new Date().toISOString(),
    currentStep: 1,
    status: 'in_progress',
    teamId,
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
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error('Failed to sync session to API:', await res.text());
    }
  } catch (error) {
    console.error('Failed to sync session to API:', error);
  }
}

async function createSessionInApi(session: PipelineSession): Promise<PipelineSession | null> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (res.ok) {
      const data = await res.json();
      return data.session;
    }
    console.error('Failed to create session in API:', await res.text());
  } catch (error) {
    console.error('Failed to create session in API:', error);
  }
  return null;
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
  currentTeamId: string | null;
  isLoading: boolean;
  apiInitialized: boolean;

  // Actions
  createSession: () => Promise<string>;
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
  setCurrentTeamId: (teamId: string | null) => void;
  deleteSession: (id: string) => void;
  duplicateSession: (id: string) => Promise<string | null>;
  getAllSessions: () => PipelineSession[];
  getTeamSessions: () => PipelineSession[];
  fetchSessionsFromApi: (teamId?: string | null) => Promise<void>;
  setApiInitialized: (initialized: boolean) => void;
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentSessionId: null,
      currentTeamId: null,
      isLoading: false,
      apiInitialized: false,

      createSession: async () => {
        const id = generateSessionId();
        const { currentTeamId } = get();
        const newSession = createEmptySession(id, currentTeamId || undefined);

        // Create in API first to get proper team assignment
        const apiSession = await createSessionInApi(newSession);

        // Use API response if available (has proper team info)
        const sessionToStore = apiSession || newSession;

        set(state => ({
          sessions: {
            ...cleanExpiredSessions(state.sessions),
            [id]: sessionToStore
          },
          currentSessionId: id,
        }));

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

      setCurrentTeamId: (teamId: string | null) => {
        set({ currentTeamId: teamId });
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

      duplicateSession: async (id: string) => {
        try {
          const res = await fetch(`/api/sessions/${id}/duplicate`, {
            method: 'POST',
          });
          if (!res.ok) {
            console.error('Failed to duplicate session');
            return null;
          }
          const data = await res.json();
          if (data.session) {
            // Add to local store
            set(state => ({
              sessions: {
                ...state.sessions,
                [data.newId]: data.session,
              },
            }));
            return data.newId;
          }
        } catch (error) {
          console.error('Failed to duplicate session:', error);
        }
        return null;
      },

      getAllSessions: () => {
        const { sessions } = get();
        return Object.values(cleanExpiredSessions(sessions)).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      // Get sessions filtered by current team
      getTeamSessions: () => {
        const { sessions, currentTeamId } = get();
        const cleaned = cleanExpiredSessions(sessions);

        // If no team context, return empty array (safer than showing all)
        if (!currentTeamId) {
          return [];
        }

        return Object.values(cleaned)
          .filter(s => s.teamId === currentTeamId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      fetchSessionsFromApi: async (teamId?: string | null) => {
        set({ isLoading: true });
        try {
          // Use passed teamId if provided, otherwise fall back to state
          // This fixes the race condition where state may not be updated yet
          const effectiveTeamId = teamId !== undefined ? teamId : get().currentTeamId;
          const url = new URL('/api/sessions', window.location.origin);
          if (effectiveTeamId) {
            url.searchParams.set('teamId', effectiveTeamId);
          }

          const res = await fetch(url.toString());
          if (res.ok) {
            const data = await res.json();
            if (data.sessions && Array.isArray(data.sessions)) {
              // IMPORTANT: Replace local sessions with API sessions for the current team
              // This ensures team members see the same sessions
              const apiSessions: Record<string, PipelineSession> = {};
              for (const session of data.sessions) {
                apiSessions[session.id] = session;
              }

              set(state => {
                // Keep local sessions that are NOT in the current team
                // (they might be from a different team or offline sessions)
                const localOnlySessions: Record<string, PipelineSession> = {};
                for (const [id, session] of Object.entries(state.sessions)) {
                  // Keep if not in API response AND not in current team
                  // (to preserve any pending offline sessions from other teams)
                  if (!apiSessions[id] && session.teamId !== effectiveTeamId) {
                    localOnlySessions[id] = session;
                  }
                }

                return {
                  sessions: {
                    ...localOnlySessions,
                    ...apiSessions, // API sessions take precedence
                  },
                  apiInitialized: !data.needsInit,
                };
              });
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
