import type { Overlay } from './types'
import { cutoutCameraAt, cutoutTransformAt, cutoutPoseAt, normalizeCutoutScene, cutoutAssetIds, type CutoutScene, type CutoutLayer, type CutoutTransform } from './cutout-timeline'
import { cutoutMaskAt } from './cutout-mask'
import { cutoutIkAt } from './cutout-ik'
import { MOTION_PATTERNS, normalizeShotMetadata, type CutoutShot } from './cutout-shot-types'

export { MOTION_PATTERNS }
export type { CutoutShot, MotionPattern, BeatKind, ShotOverlay } from './cutout-shot-types'
export interface ShotMotionContext { allowedMovers: string[]; assetIds: string[]; propLayerIds: string[]; poseCandidates?:Record<string,string[]> }
export function validateShotMotion(shot: CutoutShot, seed: CutoutScene, context: ShotMotionContext): void {
  // Metadata normalizer checks a complete tiled list; validate a single shot at local 0.
  normalizeShotMetadata([{...shot,startMs:0,endMs:shot.endMs-shot.startMs}])
  for(const p of shot.placements??[]){
    const layer=seed.layers.find(l=>l.id===p.layerId)
    if(!layer||![layer.assetId,...layer.poses.map(p=>p.assetId)].some(id=>!!id&&context.assetIds.includes(id)))throw Error('Tata letak merujuk layer di luar shot.')
    if(!p.visible&&shot.movers.includes(p.layerId))throw Error('Layer yang dikecualikan tidak boleh menjadi mover.')
  }
  if(shot.movers.some(id=>!context.allowedMovers.includes(id)||!seed.layers.some(l=>l.id===id)))throw new Error('Mover shot harus berasal dari daftar perencana, bukan pilihan layer baru.')
  if(!context.assetIds.includes(shot.startPose)||!context.assetIds.includes(shot.endPose))throw new Error('Pose awal/akhir shot harus assetId yang tersedia dalam rencana shot.')
  if(shot.movers.length){
    const primary=seed.layers.find(l=>l.id===shot.movers[0])!,ids=[primary.assetId,...primary.poses.map(p=>p.assetId),...(context.poseCandidates?.[primary.id]??[])]
    if(!ids.includes(shot.startPose)||!ids.includes(shot.endPose))throw new Error('Pose awal/akhir harus milik mover utama yang sama.')
  }
  if(['pose-swap','slide-linear','prop-reaction'].includes(shot.motionPattern)&&!shot.movers.length)throw new Error('Pola aksi memerlukan mover dari perencana.')
  if(shot.motionPattern==='prop-reaction'&&shot.movers.some(id=>!context.propLayerIds.includes(id)||seed.layers.find(l=>l.id===id)!.width>.35))throw new Error('prop-reaction hanya untuk properti kecil, bukan tokoh, background, atau sendi.')
  if(shot.motionPattern==='hold'&&shot.startPose!==shot.endPose)throw new Error('Hold harus memakai pose awal dan akhir yang sama.')
  if(shot.motionPattern!=='pose-swap'&&shot.startPose!==shot.endPose)throw new Error('Pergantian pose harus memakai pola pose-swap.')
  for(const layer of seed.layers){
    if(shot.placements?.some(p=>p.layerId===layer.id&&!p.visible))continue
    if(![layer.assetId,...layer.poses.map(p=>p.assetId)].some(id=>!!id&&context.assetIds.includes(id)))continue
    let pose=cutoutPoseAt(layer,shot.startMs)
    for(const key of layer.poses.filter(p=>p.timeMs>shot.startMs&&p.timeMs<shot.endMs)){
      if(key.assetId!==pose&&(shot.motionPattern!=='pose-swap'||!shot.movers.includes(layer.id)))throw new Error('Pergantian pose terencana di dalam shot harus memakai pose-swap pada mover yang ditetapkan; hold/kamera/slide tidak boleh menyembunyikan perubahan pose.')
      pose=key.assetId
    }
  }
}
function transformKey(layer: CutoutLayer, id: string, timeMs: number, transform: CutoutTransform, easing: 'hold'|'linear'|'back-out') {
  layer.keyframes=layer.keyframes.filter(k=>k.timeMs!==timeMs)
  layer.keyframes.push({id,timeMs,transform:{...transform},easing});layer.keyframes.sort((a,b)=>a.timeMs-b.timeMs)
}
/** The model cannot add/delete layers or author transforms, IK, masks or arbitrary easing. */
export function applyShotMotion(seed: CutoutScene, shot: CutoutShot, context: ShotMotionContext): CutoutScene {
  validateShotMotion(shot,seed,context)
  const scene=structuredClone(seed),start=shot.startMs,end=shot.endMs,span=end-start,last=Math.max(start,end-.001)
  // A review candidate is selected ONLY by this explicit shot delta. No automatic +1ms pose.
  if(shot.startPose===shot.endPose){
    const candidateLayer=scene.layers.find(l=>context.poseCandidates?.[l.id]?.includes(shot.startPose))
    if(candidateLayer){candidateLayer.poses=candidateLayer.poses.filter(p=>p.timeMs!==start);candidateLayer.poses.push({id:shot.id+'-selected-variant',timeMs:start,assetId:shot.startPose});candidateLayer.poses.sort((a,b)=>a.timeMs-b.timeMs)}
  }
  for(const id of shot.movers){
    const layer=scene.layers.find(l=>l.id===id)!,base=cutoutTransformAt(layer,start)
    if(layer.motionRole==='static')throw new Error('Layer static dari perencana tidak boleh digerakkan.')
    transformKey(layer,`${shot.id}-${id}-start`,start,base,'hold')
    if(shot.motionPattern==='slide-linear')transformKey(layer,`${shot.id}-${id}-slide`,start+span*.8,{...base,x:base.x+.07},'linear')
    if(shot.motionPattern==='prop-reaction'){
      transformKey(layer,`${shot.id}-${id}-react`,start+span*.2,{...base,rotation:base.rotation+4,scale:base.scale*1.035},'back-out')
      transformKey(layer,`${shot.id}-${id}-settle`,start+span*.55,base,'linear')
    }
    if(shot.motionPattern==='pose-swap'){
      const pose=(assetId:string,t:number,suffix:string)=>{
        // Keep all seed pose registrations; a repeated pose at this instant is harmless.
        let at=t;while(layer.poses.some(p=>p.timeMs===at&&p.assetId!==assetId)&&at<last)at+=1
        if(at>last)throw new Error('Tidak ada waktu pose kosong di dalam shot.')
        if(!layer.poses.some(p=>p.timeMs===at&&p.assetId===assetId))layer.poses.push({id:`${shot.id}-${id}-${suffix}`,assetId,timeMs:at})
      }
      if(id===shot.movers[0]){
        pose(shot.startPose,start,'start')
        const planned=layer.poses.find(p=>p.assetId===shot.endPose&&p.timeMs>start&&p.timeMs<end)?.timeMs
        if(shot.endPose!==shot.startPose)pose(shot.endPose,planned??Math.round((start+span*.55)*1000)/1000,'end')
      }
      layer.poses.sort((a,b)=>a.timeMs-b.timeMs)
    }
  }
  if(shot.motionPattern==='camera-push'){
    // Same-depth framing is a common camera move, not unintended multi-layer parallax.
    if(new Set(scene.layers.filter(l=>l.visible).map(l=>l.depth)).size>1)throw new Error('camera-push memerlukan depth bersama agar layer statis tidak ikut bergerak lewat parallax.')
    const base=cutoutCameraAt(scene.camera,start)
    scene.camera.keyframes=scene.camera.keyframes.filter(k=>k.timeMs!==start&&k.timeMs!==last)
    scene.camera.keyframes.push({id:shot.id+'-camera-start',timeMs:start,...base,easing:'hold'},{id:shot.id+'-camera-end',timeMs:start+Math.min(450,span*.25),...base,zoom:Math.min(10,base.zoom+.06),easing:'linear'})
    scene.camera.keyframes.sort((a,b)=>a.timeMs-b.timeMs)
  }
  return normalizeCutoutScene(scene)!
}

/** Shift a review window to local time, retaining evaluated masks, FK and IK at the cut. */
export function sliceShotScene(source: CutoutScene, startMs: number, endMs: number): CutoutScene {
  const scene=structuredClone(source),duration=endMs-startMs
  delete scene.shots
  const camera=cutoutCameraAt(source.camera,startMs)
  scene.camera={...camera,keyframes:source.camera.keyframes.filter(k=>k.timeMs>startMs&&k.timeMs<endMs).map(k=>({...k,timeMs:k.timeMs-startMs}))}
  scene.layers=source.layers.map(l=>({...structuredClone(l),assetId:cutoutPoseAt(l,startMs),transform:cutoutTransformAt(l,startMs),
    visible:l.visible&&l.inMs<endMs&&(l.outMs===null||l.outMs>startMs),inMs:Math.max(0,l.inMs-startMs),outMs:Math.min(duration,(l.outMs??endMs)-startMs),
    keyframes:l.keyframes.filter(k=>k.timeMs>startMs&&k.timeMs<endMs).map(k=>({...k,timeMs:k.timeMs-startMs})),
    poses:l.poses.filter(k=>k.timeMs>startMs&&k.timeMs<endMs).map(k=>({...k,timeMs:k.timeMs-startMs})),
    ...(l.mask?{mask:cutoutMaskAt(l.mask,l.maskKeyframes,startMs)}:{}),maskKeyframes:l.maskKeyframes?.filter(k=>k.timeMs>startMs&&k.timeMs<endMs).map(k=>({...k,timeMs:k.timeMs-startMs}))
  })).map(l=>l.outMs!<=l.inMs?{...l,visible:false,inMs:0,outMs:null}:l)
  scene.ik=source.ik?.map(c=>({...structuredClone(c),...cutoutIkAt(c,startMs),keyframes:c.keyframes.filter(k=>k.timeMs>startMs&&k.timeMs<endMs).map(k=>({...k,timeMs:k.timeMs-startMs}))}))
  return normalizeCutoutScene(scene)!
}

/** Text stays native to the editor. The model selects content, never font/color/layout. */
export function shotOverlays(shot: CutoutShot, projectOffsetMs: number): Overlay[] {
  return shot.overlays.map((o,i)=>({id:`shot-text-${shot.clipId}-${shot.id}-${i}`,kind:'text' as const,text:o.text,
    anchor:5,x:.5,y:o.type==='year'?.16:o.type==='name'?.25:shot.beat==='hook'?.18:.76,
    start:(projectOffsetMs+shot.startMs)/1000,end:(projectOffsetMs+Math.min(shot.endMs,shot.startMs+3000))/1000,
    size:o.type==='year'?.14:o.type==='name'?.07:shot.beat==='hook'?.09:.045,color:o.type==='year'?'#FFD84D':o.type==='name'?'#000000':'#FFFFFF',
    style:o.type==='name'?'box' as const:'outline' as const,bold:true}))
}

/** Recompile from the immutable complete seed after each delta/repair. Hard cuts
 * gate the planned layers; the model has no way to drop an asset registration. */
export function composeShotMotions(seed: CutoutScene, shots: CutoutShot[], contexts: ShotMotionContext[]): CutoutScene {
  normalizeShotMetadata(shots)
  let scene=structuredClone(seed)
  for(const l of scene.layers){l.depth=1;l.transform.opacity=0;l.inMs=0;l.outMs=null;l.keyframes=[]}
  scene.camera.keyframes=[]
  for(let index=0;index<shots.length;index++){
    const shot=shots[index],context=contexts[index]
    for(const l of scene.layers){
      const original=seed.layers.find(s=>s.id===l.id)!,registered=[l.assetId,...l.poses.map(p=>p.assetId)]
      const active=registered.some(id=>!!id&&context.assetIds.includes(id))
      const placement=shot.placements?.find(p=>p.layerId===l.id)
      const transform=placement?{...original.transform,x:placement.x,y:placement.y,scale:placement.scale,rotation:placement.rotation}:original.transform
      transformKey(l,shot.id+'-'+l.id+'-cut',shot.startMs,{...transform,opacity:active&&placement?.visible!==false?original.transform.opacity:0},'hold')
    }
    scene.camera.keyframes=scene.camera.keyframes.filter(k=>k.timeMs!==shot.startMs)
    scene.camera.keyframes.push({id:shot.id+'-cut-camera',timeMs:shot.startMs,x:seed.camera.x,y:seed.camera.y,zoom:seed.camera.zoom,easing:'hold'})
    scene=applyShotMotion(scene,shot,context)
  }
  for(const l of scene.layers){let previous=l.assetId;l.poses=l.poses.filter(p=>{if(p.assetId===previous)return false;previous=p.assetId;return true})}
  scene.shots=normalizeShotMetadata(shots)
  const used=new Set(cutoutAssetIds(scene));if(cutoutAssetIds(seed).some(id=>!used.has(id)))throw new Error('Kesalahan internal: kompilasi shot kehilangan registrasi aset seed.')
  return normalizeCutoutScene(scene)!
}
