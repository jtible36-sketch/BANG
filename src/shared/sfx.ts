/** Sound effects live on the absolute project timeline, in milliseconds. They never loop. */
export interface SoundEffectCue {
  id: string
  assetId: string
  startMs: number
  offsetMs: number
  durationMs: number
  volumeDb: number
  fadeInMs: number
  fadeOutMs: number
}

export const SFX_LIMITS = { cues: 128, timeMs: 86_400_000 } as const
const validId = /^[a-zA-Z0-9_.:-]{1,128}$/

/** Reject malformed edits instead of silently moving an effect to a different instant. */
export function normalizeSoundEffects(value: unknown): SoundEffectCue[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > SFX_LIMITS.cues) throw new Error('SFX harus berupa daftar dengan maksimal 128 efek suara.')
  const ids = new Set<string>()
  const numeric = (v: unknown, min: number, max: number, name: string, integer = true): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
      throw new Error(`SFX: ${name} tidak valid.`)
    }
    return v
  }
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Data cue SFX tidak valid.')
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !validId.test(row.id) || ids.has(row.id)) throw new Error('ID cue SFX harus valid dan unik.')
    if (typeof row.assetId !== 'string' || !validId.test(row.assetId)) throw new Error('ID aset SFX tidak valid.')
    ids.add(row.id)
    const cue: SoundEffectCue = {
      id: row.id, assetId: row.assetId,
      startMs: numeric(row.startMs, 0, SFX_LIMITS.timeMs, 'waktu mulai'),
      offsetMs: numeric(row.offsetMs, 0, SFX_LIMITS.timeMs, 'potongan sumber'),
      durationMs: numeric(row.durationMs, 1, SFX_LIMITS.timeMs, 'durasi'),
      volumeDb: numeric(row.volumeDb, -60, 0, 'volume', false),
      fadeInMs: numeric(row.fadeInMs, 0, SFX_LIMITS.timeMs, 'fade masuk'),
      fadeOutMs: numeric(row.fadeOutMs, 0, SFX_LIMITS.timeMs, 'fade keluar')
    }
    if (cue.startMs + cue.durationMs > SFX_LIMITS.timeMs || cue.offsetMs + cue.durationMs > SFX_LIMITS.timeMs) throw new Error('Rentang SFX melebihi 24 jam.')
    if (cue.fadeInMs + cue.fadeOutMs > cue.durationMs) throw new Error('Total fade SFX tidak boleh melebihi durasinya.')
    return cue
  }).sort((a, b) => a.startMs - b.startMs)
}

export interface SoundEffectAsset { id: string; kind: string; projectId?: string; durationMs?: number | null }

export function validateSoundEffectAssets(cues: SoundEffectCue[], assets: readonly SoundEffectAsset[], projectId?: string): void {
  const byId = new Map(assets.map(asset => [asset.id, asset]))
  for (const cue of cues) {
    const asset = byId.get(cue.assetId)
    if (!asset || (projectId && asset.projectId !== projectId)) throw new Error(`Aset SFX ${cue.assetId} tidak ditemukan dalam proyek ini.`)
    if (asset.kind !== 'audio' && asset.kind !== 'music') throw new Error('SFX harus memakai aset audio atau musik.')
    if (asset.durationMs != null && Number.isFinite(asset.durationMs) && asset.durationMs > 0 && cue.offsetMs >= asset.durationMs) {
      throw new Error('Awal potongan SFX harus berada di dalam durasi sumber audio.')
    }
  }
}

/** Short sources and the end of the film trim cues, never stretch or loop them. */
export function soundEffectDurationMs(cue: SoundEffectCue, assetDurationMs?: number | null, totalMs?: number): number {
  const source = assetDurationMs != null && Number.isFinite(assetDurationMs) && assetDurationMs > 0 ? Math.max(0, assetDurationMs - cue.offsetMs) : cue.durationMs
  const timeline = totalMs != null && Number.isFinite(totalMs) ? Math.max(0, totalMs - cue.startMs) : cue.durationMs
  return Math.max(0, Math.min(cue.durationMs, source, timeline))
}

/** Preserve fade proportions when a source or the project end cuts the requested length short. */
export function soundEffectFades(cue: SoundEffectCue, durationMs = cue.durationMs): { fadeInMs: number; fadeOutMs: number } {
  const sum = cue.fadeInMs + cue.fadeOutMs
  const scale = sum > durationMs && sum > 0 ? Math.max(0, durationMs) / sum : 1
  return { fadeInMs: cue.fadeInMs * scale, fadeOutMs: cue.fadeOutMs * scale }
}

export function soundEffectGainAt(cue: SoundEffectCue, projectTimeMs: number, effectiveDurationMs = cue.durationMs): number {
  const local = projectTimeMs - cue.startMs
  if (local < 0 || local >= effectiveDurationMs) return 0
  const { fadeInMs, fadeOutMs } = soundEffectFades(cue, effectiveDurationMs)
  const fadeIn = fadeInMs > 0 ? Math.min(1, local / fadeInMs) : 1
  const fadeOut = fadeOutMs > 0 ? Math.min(1, (effectiveDurationMs - local) / fadeOutMs) : 1
  return Math.pow(10, cue.volumeDb / 20) * fadeIn * fadeOut
}
