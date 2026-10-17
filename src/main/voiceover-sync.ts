import { autoSyncEnabled, syncedVoiceDuration, voiceoverTimelineMs } from '@shared/voiceover'
import type { ProjectBundle } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { assetAbsPath } from './paths'
import { clipsOf, getAsset, getBundle, getProject, patchClip, touchProject } from './repo'
import { probeDurationMs } from './services/audio'

/** Measure local voice files, then commit all timing changes together. No TTS or media generation. */
export async function syncVoiceover(projectId: string) {
  const project = getProject(projectId)
  if (!autoSyncEnabled(project)) return getBundle(projectId)
  const captured = clipsOf(projectId)
  const changes: { id: string; audioId: string; audioMs: number; durationMs: number }[] = []
  for (const clip of captured) {
    const audio = clip.audioAssetId ? getAsset(clip.audioAssetId) : null
    if (syncedVoiceDuration(clip, audio) == null) continue
    const measured = await probeDurationMs(assetAbsPath(projectId, audio!.localPath))
    changes.push({ id: clip.id, audioId: audio!.id, audioMs: measured, durationMs: voiceoverTimelineMs(measured) })
  }
  const fresh = clipsOf(projectId)
  if (!autoSyncEnabled(getProject(projectId)) || JSON.stringify(fresh.map(c => [c.id, c.sort, c.narration, c.audioAssetId]))
    !== JSON.stringify(captured.map(c => [c.id, c.sort, c.narration, c.audioAssetId]))) throw new Error('Narasi atau urutan adegan berubah saat sinkronisasi. Coba Auto-Sync lagi.')
  getDb().transaction(() => {
    for (const change of changes) {
      // Keep audio's measured duration separate from the frame-conformed visual duration.
      getDb().prepare('UPDATE assets SET duration_ms = ? WHERE id = ?').run(change.audioMs, change.audioId)
      patchClip(change.id, { durationMs: change.durationMs })
    }
    if (changes.length) touchProject(projectId)
  })()
  for (const change of changes) emit.clip({ clipId: change.id, patch: { durationMs: change.durationMs } })
  return getBundle(projectId)
}

export function assertCurrentVoiceover(bundle: ProjectBundle): void {
  if (!autoSyncEnabled(bundle.project)) return
  const stale = bundle.clips.find(c => c.audioAssetId && syncedVoiceDuration(c, bundle.assets.find(a => a.id === c.audioAssetId)) == null)
  if (stale) throw new Error(`Suara adegan “${stale.title}” belum sesuai narasi terbaru. Perbarui suara narasi sebelum ekspor.`)
}
