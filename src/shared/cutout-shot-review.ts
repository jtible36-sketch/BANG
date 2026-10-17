import type { Asset, Clip } from './types'
import type { CutoutAssetPlan } from './cutout-assets'
import { evaluateCutoutScene } from './cutout-timeline'
export interface ShotReview { index:number;startMs:number;endMs:number;frameTimes:number[];planned:number;available:number;poseChanges:number;objectKeys:number;maskKeys:number;ikChains:number;visible:number[];warnings:string[] }
/** Measurable timeline checks only. This cannot certify identity, alpha contours or medical facts. */
export function reviewCutoutShots(clip:Clip,plan:CutoutAssetPlan,assets:Asset[],aspect:string,fps:30|60=30):ShotReview[] {
  const scene=clip.cutout,[aw,ah]=aspect.split(':').map(Number),w=720,h=720*(ah/aw||16/9),sizes=Object.fromEntries(assets.map(a=>[a.id,a]))
  return (plan.director?.shots??[]).map((shot,index)=>{
    const end=Math.min(clip.durationMs,shot.endMs),start=Math.max(0,shot.startMs),last=Math.max(start,end-1000/fps)
    const frameTimes=[start,(start+last)/2,last].map(t=>Math.floor(t*fps/1000)*1000/fps)
    const relevant=plan.items.filter(i=>shot.assetIds.includes(i.id)),available=relevant.filter(i=>assets.some(a=>a.clipId===clip.id&&a.kind==='image'&&(a.meta.cutoutAsset as any)?.planId===plan.id&&(a.meta.cutoutAsset as any)?.itemId===i.id)).length
    const layers=scene?.layers??[],inShot=(t:number)=>t>=start&&t<end
    const visible=frameTimes.map(t=>scene?.enabled&&!scene.specialVideo?evaluateCutoutScene(scene,t,w,h,sizes).filter(d=>d.opacity>.01&&d.matrix.every(Number.isFinite)&&intersectsFrame(d.matrix,d.width,d.height,w,h)).length:scene?.enabled&&scene.specialVideo&&assets.some(a=>a.id===scene.specialVideo?.assetId)?1:0)
    const poseChanges=layers.reduce((n,l)=>n+l.poses.filter(p=>inShot(p.timeMs)).length,0),objectKeys=layers.reduce((n,l)=>n+l.keyframes.filter(k=>inShot(k.timeMs)).length,0),maskKeys=layers.reduce((n,l)=>n+(l.maskKeyframes??[]).filter(k=>inShot(k.timeMs)).length,0)
    const warnings:string[]=[]
    if(available<relevant.length)warnings.push(`${relevant.length-available} kebutuhan gambar belum tersedia untuk paket ini`)
    if(!scene?.enabled)warnings.push('Komposisi Cutout belum aktif')
    else if(!scene.specialVideo&&visible.some(n=>!n))warnings.push('Ada sampel frame tanpa objek terlihat')
    if(scene?.enabled&&!scene.specialVideo&&layers.some(l=>l.visible&&!l.assetId&&!l.poses.length&&!layers.some(c=>c.parentId===l.id)))warnings.push('Ada slot gambar kosong yang belum mempunyai anak')
    return {index,startMs:start,endMs:end,frameTimes,planned:relevant.length,available,poseChanges,objectKeys,maskKeys,ikChains:scene?.ik?.filter(c=>c.enabled).length??0,visible,warnings}
  })
}

function intersectsFrame(m:number[],width:number,height:number,w:number,h:number):boolean {
  const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]])
  return Math.max(...corners.map(p=>p[0]))>0&&Math.min(...corners.map(p=>p[0]))<w&&Math.max(...corners.map(p=>p[1]))>0&&Math.min(...corners.map(p=>p[1]))<h
}
