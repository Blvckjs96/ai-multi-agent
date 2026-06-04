// frontend/src/store/index.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set) => ({
      // ── Auth ──────────────────────────────────────────────
      user: null,
      setUser: (user) => set({ user }),

      // ── Theme ─────────────────────────────────────────────
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // ── Models ────────────────────────────────────────────
      models: [],
      setModels: (models) => set({ models }),

      // ── Conversations ─────────────────────────────────────
      conversations: null,
      activeConversationId: null,
      setConversations: (convs) => set({ conversations: convs }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),

      // ── Knowledge ─────────────────────────────────────────
      knowledge: null,
      setKnowledge: (kb) => set({ knowledge: kb }),

      // ── Tools / Skills / Functions ────────────────────────
      tools: null,
      skills: null,
      functions: null,
      setTools: (t) => set({ tools: t }),
      setSkills: (s) => set({ skills: s }),
      setFunctions: (f) => set({ functions: f }),

      // ── Workspace ─────────────────────────────────────────
      activeWorkspaceId: null,
      workspaces: [],
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      setWorkspaces: (ws) => set({ workspaces: ws }),

      // ── Socket ────────────────────────────────────────────
      socket: null,
      socketConnected: false,
      setSocket: (socket) => set({ socket }),
      setSocketConnected: (v) => set({ socketConnected: v }),

      // ── UI ────────────────────────────────────────────────
      mobile: false,
      setMobile: (v) => set({ mobile: v }),
    }),
    {
      name: 'argo-store',
      partialize: (state) => ({
        theme:                 state.theme,
        activeWorkspaceId:     state.activeWorkspaceId,
        activeConversationId:  state.activeConversationId,
      }),
    }
  )
)
