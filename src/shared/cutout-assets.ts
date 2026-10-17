import type { Asset, Job } from './types'
import type { CutoutDirector } from './cutout-director'
export type CutoutAssetRole = 'background' | 'character' | 'pose' | 'prop' | 'part' | 'foreground'
export type CutoutAssetProvider = 'codex' | 'flow-mcp'
export interface CutoutAssetItem { id: string; role: CutoutAssetRole; label: string; prompt: string; characterId: string | null; timeMs: number; layerKey?: string }
export interface CutoutAssetPlan { version: 1; id: string; clipId: string; sourceHash: string; items: CutoutAssetItem[]; planningKey?: string; director?: CutoutDirector }
export interface CutoutAssetState { plan: CutoutAssetPlan | null; stale: boolean; assets: Asset[]; jobs: { itemId: string | null; job: Job }[] }
export const CUTOUT_ASSET_ROLES: { id: CutoutAssetRole; label: string }[] = [
  { id: 'background', label: 'Background tanpa tokoh' }, { id: 'character', label: 'Tokoh transparan' }, { id: 'pose', label: 'Pose / reaksi' },
  { id: 'prop', label: 'Properti' }, { id: 'part', label: 'Bagian tubuh untuk rig' }, { id: 'foreground', label: 'Foreground penutup' }
]
export function normalizeCutoutAssetItems(raw: unknown, durationMs: number, characterIds: string[]): CutoutAssetItem[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 256) throw new Error('Paket aset berisi 1–256 kebutuhan.')
  const ids = new Set<string>()
  const items = raw.map(v => {
    if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['id','role','label','prompt','characterId','timeMs','layerKey'].includes(k))) throw new Error('Kebutuhan aset tidak valid.')
    if (typeof v.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(v.id) || ids.has(v.id)) throw new Error('ID kebutuhan harus unik.'); ids.add(v.id)
    if (!CUTOUT_ASSET_ROLES.some(r => r.id === v.role) || typeof v.label !== 'string' || !v.label.trim() || v.label.length > 120 || typeof v.prompt !== 'string' || !v.prompt.trim() || v.prompt.length > 5000) throw new Error('Isi jenis, nama, dan arahan aset yang valid.')
    if (v.characterId !== null && !characterIds.includes(v.characterId)) throw new Error('Karakter aset harus berasal dari proyek ini.')
    if (!Number.isInteger(v.timeMs) || v.timeMs < 0 || v.timeMs >= durationMs) throw new Error('Waktu pose harus berada di dalam klip.')
    if (v.layerKey !== undefined && (typeof v.layerKey !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(v.layerKey))) throw new Error('Grup layer harus ID 1–100 karakter.');
    return { ...(v.layerKey ? {layerKey:v.layerKey} : {}), id: v.id, role: v.role, label: v.label.trim(), prompt: v.prompt.trim(), characterId: v.characterId, timeMs: v.timeMs }
  })
  const seen=new Set<string>(),groups=new Set<string>()
  for(const item of items){
    const group=item.layerKey||(item.role==='background'?'background':['character','pose'].includes(item.role)?`actor-${item.characterId??'main'}`:item.id)
    const key=JSON.stringify([group,item.timeMs]);if(seen.has(key))throw new Error('Dua pose pada grup layer dan waktu yang sama.');seen.add(key);groups.add(group)
  }
  if(groups.size>64)throw new Error('Maksimal 64 grup layer; gunakan grup yang sama untuk varian pose satu objek.')
  return items
}
