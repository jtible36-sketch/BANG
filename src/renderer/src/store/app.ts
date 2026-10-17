import { create } from 'zustand'
import type { ResearchInput } from '@shared/research'

export type ResearchDraft = ResearchInput & { durationSec?: number; aspectRatio?: '16:9' | '9:16' }

export type Route = { name: 'home' } | { name: 'research' } | { name: 'masters'; back?: Route } | { name: 'settings'; back?: Route } | { name: 'project'; id: string }

export interface Toast {
  id: number
  kind: 'error' | 'info' | 'success'
  text: string
  action?: { label: string; run: () => void }
}

interface AppState {
  route: Route
  toasts: Toast[]
  researchDraft: ResearchDraft | null
  setResearchDraft(draft: ResearchDraft | null): void
  go(route: Route): void
  toast(kind: Toast['kind'], text: string, action?: Toast['action']): void
  dismiss(id: number): void
}

let nextId = 1

export const useApp = create<AppState>((set, get) => ({
  route: { name: 'home' },
  toasts: [],
  researchDraft: null,
  setResearchDraft: (researchDraft) => set({ researchDraft }),
  go: (route) => set({ route }),
  toast: (kind, text, action) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, kind, text, action }].slice(-4) })
    setTimeout(() => get().dismiss(id), kind === 'error' ? 8000 : 4500)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
