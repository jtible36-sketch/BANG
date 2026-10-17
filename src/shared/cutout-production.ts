import type { Asset, Clip, CodexEditOptions } from './types'
import type { CutoutAssetItem, CutoutAssetPlan, CutoutAssetProvider } from './cutout-assets'
import { createCutoutLayer, createCutoutScene, cutoutCameraAt, cutoutTransformAt, evaluateCutoutScene, CUTOUT_LIMITS, normalizeCutoutScene, type CutoutScene } from './cutout-timeline'
import { cutoutIkAt } from './cutout-ik'

export interface CutoutProductionOptions {
  enabled: boolean; provider: CutoutAssetProvider; format: 'png' | 'webp'
  maxAssetsPerClip: number; maxNewAssets: number; motion: 'keyframes' | 'frames'; fps: 30 | 60
}
export interface AutoEditInput { projectId: string; clipId?: string; instruction: string; production?: CutoutProductionOptions; codex?: CodexEditOptions; specialClips?: import('./special-clips').SpecialClipOptions }
export const DEFAULT_CUTOUT_PRODUCTION: CutoutProductionOptions = { enabled: true, provider: 'codex', format: 'png', maxAssetsPerClip: 64, maxNewAssets: 512, motion: 'frames', fps: 60 }
export function normalizeCutoutProduction(raw: unknown): CutoutProductionOptions | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Pengaturan produksi Cutout tidak valid.')
  const v = raw as CutoutProductionOptions
  if (Object.keys(v).some(k => !Object.hasOwn(DEFAULT_CUTOUT_PRODUCTION,k)) || Object.keys(DEFAULT_CUTOUT_PRODUCTION).some(k => !Object.hasOwn(v,k))) throw new Error('Pengaturan produksi Cutout tidak lengkap.')
  if (typeof v.enabled !== 'boolean' || !['codex','flow-mcp'].includes(v.provider) || !['png','webp'].includes(v.format) || !['keyframes','frames'].includes(v.motion) || ![30,60].includes(v.fps)) throw new Error('Provider, format atau gerak produksi tidak valid.')
  if (!Number.isInteger(v.maxAssetsPerClip) || v.maxAssetsPerClip < 1 || v.maxAssetsPerClip > 256 || !Number.isInteger(v.maxNewAssets) || v.maxNewAssets < 1 || v.maxNewAssets > 2048) throw new Error('Batas aset: 1–256 per klip dan 1–2048 gambar baru per proses.')
  return { ...v }
}
export function generatedForItem(assets: Asset[], plan: CutoutAssetPlan, itemId: string): Asset | undefined {
  return assets.find(a => { const m=a.meta.cutoutAsset as {planId?:string;itemId?:string}|undefined;return a.kind==='image' && a.clipId===plan.clipId && m?.planId===plan.id && m.itemId===itemId })
}
/** Stable layer groups let many pose PNGs share a single transform/rig track. */
export function cutoutItemGroup(item: CutoutAssetItem): string {
  return item.layerKey || (item.role==='background' ? 'background' : ['character','pose'].includes(item.role) ? `actor-${item.characterId??'main'}` : item.id)
}
export function composeCutoutAssets(clip: Clip, plan: CutoutAssetPlan, assets: Asset[], aspect: string): CutoutScene {
  const scene=clip.cutout ? structuredClone(clip.cutout) : createCutoutScene()
  const present=new Set(scene.layers.flatMap(l=>[l.assetId,...l.poses.map(p=>p.assetId)]))
  const groups=new Map<string,{item:CutoutAssetItem;asset:Asset}[]>()
  for (const item of plan.items) {
    const asset=generatedForItem(assets,plan,item.id)
    if (!asset) throw new Error(`Aset belum tersedia: ${item.label}`)
    if (present.has(asset.id)) continue
    const key=cutoutItemGroup(item);groups.set(key,[...(groups.get(key)??[]),{item,asset}])
  }
  const [fw,fh]=aspect.split(':').map(Number), ratio=fw/fh || 9/16
  const rank=(entries:{item:CutoutAssetItem}[])=>entries[0].item.role==='background'?0:entries[0].item.role==='foreground'?2:1
  for (const [key,entries] of [...groups].sort((a,b)=>rank(a[1])-rank(b[1]))) {
    entries.sort((a,b)=>a.item.timeMs-b.item.timeMs)
    const first=entries[0],isBg=first.item.role==='background'
    // Reuse an existing generated track when a resumed package adds poses.
    let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)
    const layerId=`asset-${key.slice(0,90)}-${hash>>>0}`
    let layer=scene.layers.find(l=>l.id===layerId)
    if (!layer) {
      layer=createCutoutLayer(layerId,first.item.label.slice(0,120),first.asset.id)
      layer.width=isBg ? Math.max(1,((first.asset.width??1)/(first.asset.height??1))/ratio) : first.item.role==='part' ? .18 : first.item.role==='prop' ? .3 : .6
      layer.depth=isBg?0:first.item.role==='foreground'?1.6:first.item.role==='prop'?1.15:1
      layer.inMs=isBg?0:first.item.timeMs;layer.transform.y=isBg ? .5 : .58
      if (isBg) scene.layers.unshift(layer);else scene.layers.push(layer)
    }
    const times=new Set(layer.poses.map(p=>p.timeMs))
    for (const {item,asset} of entries) if(asset.id!==layer.assetId){
      if(times.has(item.timeMs)) throw new Error(`Dua pose pada waktu yang sama untuk ${key}. Tinjau paket aset di Cutout.`)
      times.add(item.timeMs);layer.poses.push({id:`pose-${item.id}`,timeMs:item.timeMs,assetId:asset.id})
    }
  }
  if(scene.layers.length>CUTOUT_LIMITS.layers)throw new Error('Terlalu banyak grup objek. Gunakan layerKey yang sama untuk pose satu objek atau pisahkan klip.')
  scene.enabled=true
  return normalizeCutoutScene(scene)!
}
/** Sample authored interpolation at frame times, preserving pose timestamps and IK contact bindings. */
export function bakeCutoutFrames(scene: CutoutScene, durationMs: number, fps: 30|60): CutoutScene {
  const count=Math.ceil(durationMs*fps/1000)
  if(count>CUTOUT_LIMITS.keys)throw new Error(`Klip terlalu panjang untuk keyframe ${fps} fps. Pisahkan klip atau pilih keyframe utama.`)
  const times=Array.from({length:count},(_,i)=>Math.round(i*1000/fps)),result=structuredClone(scene)
  for(const layer of result.layers)if(layer.keyframes.length){
    const source=scene.layers.find(l=>l.id===layer.id)!
    layer.keyframes=times.map((timeMs,i)=>({id:`frame-${i}`,timeMs,transform:cutoutTransformAt(source,timeMs),easing:'linear'}))
  }
  if(scene.camera.keyframes.length)result.camera.keyframes=times.map((timeMs,i)=>({id:`camera-${i}`,timeMs,...cutoutCameraAt(scene.camera,timeMs),easing:'linear'}))
  result.ik=result.ik?.map((chain,index)=>chain.keyframes.length?{...chain,keyframes:times.map((timeMs,i)=>({id:`ik-${i}`,timeMs,...cutoutIkAt(scene.ik![index],timeMs),easing:'linear'}))}:chain)
  return normalizeCutoutScene(result)!
}

/** Geometric diagnostic, not an image/identity quality score. Checks bound contacts on the actual frame grid. */
export function auditCutoutContacts(scene:CutoutScene,durationMs:number,fps:30|60,assets:Asset[],aspect:string):{samples:number;maxErrorPx:number;missing:number} {
  const w=720,[aw,ah]=aspect.split(':').map(Number),h=Math.round(w*(ah/aw||16/9))
  const metrics=Object.fromEntries(assets.map(a=>[a.id,{width:a.width,height:a.height}]))
  let maxErrorPx=0,samples=0,missing=0
  if(!scene.ik?.some(c=>c.enabled&&c.targetLayerId))return {samples,maxErrorPx,missing}
  const frames=Math.ceil(durationMs*fps/1000)
  if(frames>CUTOUT_LIMITS.keys)throw new Error('Klip terlalu panjang untuk audit kontak per frame. Pisahkan klip.')
  for(let frame=0;frame<frames;frame++){
    const t=frame*1000/fps,draw=evaluateCutoutScene(scene,t,w,h,metrics)
    for(const chain of scene.ik??[]){
      if(!chain.enabled||!chain.targetLayerId)continue
      const value=cutoutIkAt(chain,t);if(value.weight<.99)continue
      const lower=draw.find(d=>d.layerId===chain.lowerId),target=draw.find(d=>d.layerId===chain.targetLayerId),layer=scene.layers.find(l=>l.id===chain.lowerId)!
      if(!lower||!target){missing++;continue}
      const x=layer.pivotX*lower.width+chain.endX*w,y=layer.pivotY*lower.height+chain.endY*h,m=lower.matrix,n=target.matrix
      const tx=value.targetX*target.width,ty=value.targetY*target.height
      maxErrorPx=Math.max(maxErrorPx,Math.hypot(m[0]*x+m[2]*y+m[4]-n[0]*tx-n[2]*ty-n[4],m[1]*x+m[3]*y+m[5]-n[1]*tx-n[3]*ty-n[5]));samples++
    }
  }
  return {samples,maxErrorPx:Math.round(maxErrorPx*100)/100,missing}
}
