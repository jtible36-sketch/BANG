import type { Asset, CodexEditOptions } from './types'

export interface SpecialClipOptions {
  enabled: boolean; mode: 'auto' | 'face' | 'continuous'; source: 'existing' | 'flow-mcp'
  maxNewClips: number; maxCreditsPerClip: number
}
export const DEFAULT_SPECIAL_CLIPS: SpecialClipOptions = { enabled: false, mode: 'auto', source: 'existing', maxNewClips: 4, maxCreditsPerClip: 20 }
export interface SpecialVideo { assetId: string; startMs: number; speed: number; action: string }
export function normalizeCodexEdit(raw: unknown): CodexEditOptions | undefined {
  if (raw == null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k=>!['model','effort'].includes(k))) throw new Error('Pilihan Codex tidak valid.')
  const out: CodexEditOptions = {}
  for (const k of ['model','effort'] as const) {
    const v=(raw as CodexEditOptions)[k]
    if(v!==undefined){if(typeof v!=='string'||!v.length||v.length>128||!/^[-a-zA-Z0-9_.:]+$/.test(v))throw new Error('Model/effort Codex tidak valid.');out[k]=v}
  }
  return out
}
export function normalizeSpecialClips(raw: unknown): SpecialClipOptions | undefined {
  if(raw==null)return undefined
  if(typeof raw!=='object'||Array.isArray(raw))throw new Error('Pengaturan klip khusus tidak valid.')
  const v=raw as SpecialClipOptions
  if(Object.keys(v).some(k=>!Object.hasOwn(DEFAULT_SPECIAL_CLIPS,k))||Object.keys(DEFAULT_SPECIAL_CLIPS).some(k=>!Object.hasOwn(v,k))||typeof v.enabled!=='boolean'||!['auto','face','continuous'].includes(v.mode)||!['existing','flow-mcp'].includes(v.source)||!Number.isInteger(v.maxNewClips)||v.maxNewClips<1||v.maxNewClips>64||!Number.isInteger(v.maxCreditsPerClip)||v.maxCreditsPerClip<1||v.maxCreditsPerClip>100)throw new Error('Batas klip khusus: 1–64 video dan 1–100 kredit per video.')
  return {...v}
}
export function normalizeSpecialVideo(raw: unknown, layerCount=0): SpecialVideo {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Sumber klip khusus tidak valid.')
  const v=raw as SpecialVideo
  if(layerCount||Object.keys(v).some(k=>!['assetId','startMs','speed','action'].includes(k))||typeof v.assetId!=='string'||!/^[-a-zA-Z0-9_.:]{1,128}$/.test(v.assetId)||!Number.isInteger(v.startMs)||v.startMs<0||v.startMs>86400000||!Number.isFinite(v.speed)||v.speed<.25||v.speed>4||typeof v.action!=='string'||!v.action.trim()||v.action.length>2000)throw new Error('Klip khusus memakai satu video penuh tanpa layer Cutout; trim/rate/aksi tidak valid.')
  return {...v}
}
export function validateSpecialVideo(source: SpecialVideo, asset: Asset | undefined, projectId: string, durationMs: number): void {
  normalizeSpecialVideo(source)
  if(!asset||asset.projectId!==projectId||asset.kind!=='video'||!asset.durationMs||!asset.width||!asset.height||!Number.isFinite(asset.durationMs)||source.startMs+durationMs*source.speed>asset.durationMs+2)throw new Error('Video khusus harus milik proyek dan cukup panjang untuk trim/rate serta durasi narasi.')
}
/** Shared source clock. Transition overlap holds the final narrative frame. */
export function specialVideoTime(source: SpecialVideo, localMs: number, durationMs: number): number {
  return source.startMs+Math.max(0,Math.min(localMs,Math.max(0,durationMs-1)))*source.speed
}
export function specialVideoFilter(source: SpecialVideo, durationMs: number): string {
  return `trim=start=${(source.startMs/1000).toFixed(6)}:duration=${(durationMs*source.speed/1000).toFixed(6)},setpts=(PTS-STARTPTS)/${source.speed}`
}
