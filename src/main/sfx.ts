import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { normalizeSoundEffects, soundEffectDurationMs, soundEffectFades, validateSoundEffectAssets, type SoundEffectCue } from '@shared/sfx'
import type { ProjectBundle } from '@shared/types'
import { assetAbsPath, projectsRoot } from './paths'

export interface RenderSoundEffect { cue: SoundEffectCue; path: string; durationMs: number }

/** Resolve only managed audio belonging to this project, including for MCP-authored edits. */
export function projectSoundEffects(bundle: ProjectBundle, totalMs: number): RenderSoundEffect[] {
  const cues = normalizeSoundEffects(bundle.project.editor.sfx)
  validateSoundEffectAssets(cues, bundle.assets, bundle.project.id)
  if (!cues.length) return []
  const root = realpathSync(join(projectsRoot(), bundle.project.id))
  return cues.flatMap(cue => {
    const asset = bundle.assets.find(item => item.id === cue.assetId)!
    const durationMs = soundEffectDurationMs(cue, asset.durationMs, totalMs)
    if (durationMs <= 0) return []
    let file: string
    try { file = realpathSync(assetAbsPath(bundle.project.id, asset.localPath)) } catch { throw new Error(`File SFX ${cue.assetId} hilang. Impor ulang efek suara sebelum ekspor.`) }
    const rel = relative(root, file)
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) || !statSync(file).isFile()) throw new Error('Lokasi aset SFX tidak valid.')
    return [{ cue, path: file, durationMs }]
  })
}

/** The same trim/fade envelope used by the preview; delay is applied after source trimming. */
export function soundEffectFilter(cue: SoundEffectCue, durationMs: number, delayed = true): string {
  const sec = (ms: number): string => (ms / 1000).toFixed(6)
  const fades = soundEffectFades(cue, durationMs)
  const filters = [
    'aresample=48000', 'aformat=channel_layouts=stereo',
    `atrim=start=${sec(cue.offsetMs)}:duration=${sec(durationMs)}`, 'asetpts=PTS-STARTPTS',
    `volume=${cue.volumeDb}dB`
  ]
  if (fades.fadeInMs > 0) filters.push(`afade=t=in:st=0:d=${sec(fades.fadeInMs)}`)
  if (fades.fadeOutMs > 0) filters.push(`afade=t=out:st=${sec(durationMs - fades.fadeOutMs)}:d=${sec(fades.fadeOutMs)}`)
  if (delayed) filters.push(`adelay=${cue.startMs}|${cue.startMs}`)
  // adelay can retain an EOF timestamp gap after atrim on FFmpeg 6; rebuild continuous
  // timestamps so downstream padding/mixing ends at the actual project duration.
  filters.push('asetpts=N/SR/TB')
  return filters.join(',')
}
