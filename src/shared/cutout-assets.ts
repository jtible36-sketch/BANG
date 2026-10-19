import {cutoutGroupKey,groupMotion} from './cutout-plan-diagnostics'
import type { Asset, Job } from './types'
import type { CutoutDirector } from './cutout-director'
import { claimCutoutPoseTime } from './cutout-timeline'
export type CutoutAssetRole = 'background' | 'character' | 'pose' | 'prop' | 'part' | 'foreground'
export type CutoutAssetProvider = 'codex' | 'flow-mcp'
export interface CutoutAssetItem { id: string; role: CutoutAssetRole; label: string; prompt: string; characterId: string | null; timeMs: number; layerKey?: string; locationKey?: string; motionRole?: 'mover' | 'static'; motionRoleSource?: 'plan'|'group'; usage?: 'scheduled'|'variant' }
export interface CutoutAssetPlan { version: 1; id: string; clipId: string; sourceHash: string; items: CutoutAssetItem[]; plannerVersion?:number; planningKey?: string; director?: CutoutDirector }
export interface CutoutAssetState { plan: CutoutAssetPlan | null; stale: boolean; assets: Asset[]; jobs: { itemId: string | null; job: Job }[] }
export const CUTOUT_ASSET_ROLES: { id: CutoutAssetRole; label: string }[] = [
  { id: 'background', label: 'Background tanpa tokoh' }, { id: 'character', label: 'Tokoh transparan' }, { id: 'pose', label: 'Pose / reaksi' },
  { id: 'prop', label: 'Properti' }, { id: 'part', label: 'Bagian tubuh untuk rig' }, { id: 'foreground', label: 'Foreground penutup' }
]
export function normalizeCutoutAssetItems(raw: unknown, durationMs: number, characterIds: string[]): CutoutAssetItem[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 256) throw new Error('Paket aset berisi 1–256 kebutuhan.')
  const ids = new Set<string>()
  const items = raw.map(v => {
    if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['id','role','label','prompt','characterId','timeMs','layerKey','motionRole','locationKey','motionRoleSource','usage'].includes(k))) throw new Error('Kebutuhan aset tidak valid.')
    if (typeof v.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(v.id) || ids.has(v.id)) throw new Error('ID kebutuhan harus unik.'); ids.add(v.id)
    if (!CUTOUT_ASSET_ROLES.some(r => r.id === v.role) || typeof v.label !== 'string' || !v.label.trim() || v.label.length > 120 || typeof v.prompt !== 'string' || !v.prompt.trim() || v.prompt.length > 5000) throw new Error('Isi jenis, nama, dan arahan aset yang valid.')
    if (v.characterId !== null && !characterIds.includes(v.characterId)) throw new Error('Karakter aset harus berasal dari proyek ini.')
    if (!Number.isInteger(v.timeMs) || v.timeMs < 0 || v.timeMs >= durationMs) throw new Error('Waktu pose harus berada di dalam klip.')
    if (v.layerKey !== undefined && (typeof v.layerKey !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(v.layerKey))) throw new Error('Grup layer harus ID 1–100 karakter.');
    if(v.locationKey!==undefined&&(typeof v.locationKey!=='string'||(v.role==='background'&&!v.locationKey.trim())||v.locationKey.length>160))throw new Error('Kunci lokasi harus teks 1–160 karakter.')
    if(v.motionRole!=null&&!['mover','static'].includes(v.motionRole))throw new Error('Peran gerak harus mover atau static.')
    if(v.usage!==undefined&&!['scheduled','variant'].includes(v.usage))throw Error('Uso aset harus scheduled atau variant.');
    if(v.motionRoleSource!==undefined&&!['plan','group'].includes(v.motionRoleSource))throw Error('Sumber peran gerak tidak valid.');
    return { ...(v.usage?{usage:v.usage}:{}),...(v.motionRoleSource?{motionRoleSource:v.motionRoleSource}:{}),...(v.locationKey?{locationKey:v.locationKey}:{}), ...(v.motionRole?{motionRole:v.motionRole}:{}), ...(v.layerKey ? {layerKey:v.layerKey} : {}), id: v.id, role: v.role, label: v.label.trim(), prompt: v.prompt.trim(), characterId: v.characterId, timeMs: v.timeMs }
  })
  for(const item of items){const motion=groupMotion(item,items);if(!item.motionRole&&motion.value){item.motionRole=motion.value;item.motionRoleSource='group'}}
  const moverGroups=new Set(items.filter(i=>i.motionRole==='mover').map(i=>cutoutGroupKey(i)))
  if(moverGroups.size>2)throw new Error('Perencana menetapkan lebih dari 2 grup mover dalam klip.')
  const times=new Map<string,Set<number>>(),groups=new Set<string>()
  for(const item of items){
    const group=cutoutGroupKey(item)
    const occupied=times.get(group)??new Set<number>()
    item.timeMs=claimCutoutPoseTime(item.id,item.timeMs,occupied,durationMs)
    times.set(group,occupied);groups.add(group)
  }
  if(groups.size>64)throw new Error('Maksimal 64 grup layer; gunakan grup yang sama untuk varian pose satu objek.')
  return items
}
