import type { Asset, Clip, Project } from './types'

export const autoSyncEnabled = (project: Pick<Project, 'editor'>): boolean => project.editor.autoSyncVoiceover !== false
/** Conform upward to one 30fps frame: never cut speech, and avoid cumulative CapCut frame drift. */
export const voiceoverTimelineMs = (audioMs: number): number => Math.max(1, Math.ceil(audioMs * 30 / 1000 - 1e-8)) * 1000 / 30

/** Only the currently reviewed narration may drive timing; an older take stays available as a version. */
export function syncedVoiceDuration(clip: Pick<Clip, 'id' | 'projectId' | 'narration'>, audio: Asset | null | undefined): number | null {
  if (!audio || audio.kind !== 'audio' || audio.projectId !== clip.projectId || audio.clipId !== clip.id
    || !clip.narration.trim() || (audio.prompt ?? '').trim() !== clip.narration.trim()
    || !Number.isFinite(audio.durationMs) || audio.durationMs! <= 0) return null
  return voiceoverTimelineMs(audio.durationMs!)
}

export interface NarrationVisualDraft {
  token: string
  scenes: { id: string; title: string; before: string; narration: string; observed: boolean }[]
}
