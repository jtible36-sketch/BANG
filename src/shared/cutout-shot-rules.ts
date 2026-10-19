import {validatePngImpactScene} from './cutout-png-impact'
import defaults from './cutout-shot-rules.json'
import type {Asset,Clip,ProjectBundle} from './types'
import {normalizeCutoutScene,cutoutAssetIds,cutoutTransformAt,cutoutPoseAt} from './cutout-timeline'
export type Severity='error'|'warning'
export type CutoutRules=typeof defaults
export const CUTOUT_V5_RULES:CutoutRules=defaults
export interface RuleFinding {rule:string;severity:Severity;message:string;shot?:number}
export interface ClipReadiness {clipId:string;title:string;status:'ok'|'warning'|'blocked';reasons:string[];missingAssets:string[];findings:RuleFinding[];assetPreparation?:{planned:number;generated:number;reviewed:number;generationNeeded:boolean;warnings:string[]}}
export interface CutoutV5Settings {rules?:CutoutRules;proposals?:Record<string,import('./cutout-shot-proposals').ShotProposalSet>;keywords?:import('./cutout-shot-proposals').KeywordRules;sfxRules?:import('./cutout-shot-proposals').SfxKeywordRule[];sfxEnabled?:boolean;poseSpacingWarningMs?:number;motionProfile?:'v5'|'comedy-jolt'|'png-impact';pngImpact?:import('./cutout-png-impact').PngImpactSettings;sceneDefaults?:import('./cutout-brief-prefill').SceneBriefDefaults;comedyCues?:import('./comedy-jolt').JoltCue[];eraRules?:import('./cutout-permanent').EraRule[];locationAliases?:Record<string,string>}
/** Overrides are data, bounded and validated; invalid persisted configuration falls back safely. */
export function cutoutRules(raw?:CutoutRules):CutoutRules {
 if(!raw)return structuredClone(defaults)
 const r=raw,d=r.shotDurationMs
 if(r.id!==defaults.id||!d||![d.typicalMin,d.typicalMax,d.explainerMax,d.montageMin,d.montageMax,d.montageMaxConsecutive,r.movers?.maxPerShot,r.camera?.reversalWindowMs,r.camera?.maxReversals,r.character?.reversalWindowMs,r.character?.maxReversals,...(r.eraLabel?.holdMs??[])].every(n=>Number.isFinite(n)&&n>0&&n<=86400000)||d.typicalMin>d.typicalMax||d.typicalMax>d.explainerMax||d.montageMin>d.montageMax||r.eraLabel.holdMs.length!==2||r.eraLabel.holdMs[0]>r.eraLabel.holdMs[1]||![r.transition,r.shotDurationMs,r.movers,r.camera,r.character].every(v=>['error','warning'].includes(v.severity))||!Array.isArray(r.camera.allowedPresets)||r.camera.allowedPresets.some(p=>!['static','zoomin','zoomout','panleft','panright','kenburns'].includes(p))||!Array.isArray(r.transition.allowed)||r.transition.allowed.some(t=>!['cut','fade','slideleft','slideright','slideup','slidedown','zoomin','zoomout'].includes(t)))throw Error('Aturan Cutout v5 tidak valid.')
 return structuredClone(r)
}
function oscillates(values:{timeMs:number;value:number;hold?:boolean}[],windowMs:number,max:number):boolean {
 let sign=0,at=values[0]?.timeMs??0,reversals=0,last=values[0]?.value??0
 for(const k of values.slice(1)){const delta=k.value-last,next=Math.abs(delta)>1e-5?Math.sign(delta):0;if(next){if(k.hold){sign=0;reversals=0}else{reversals=sign&&next!==sign&&k.timeMs-at<=windowMs?reversals+1:k.timeMs-at>windowMs?0:reversals;sign=next;if(reversals>=max)return true}at=k.timeMs}last=k.value}return false
}
/** Counts unique active tracks per shot, not keyframe count. Pose/mask changes, active IK limbs/targets,
 * parent inheritance and differential parallax count; identical held keys and a shared camera do not. */
export function movingLayerIds(clip:Clip,startMs=0,endMs=clip.durationMs):string[]{
 const s=clip.cutout;if(!s?.enabled||s.specialVideo)return []
 const active=s.layers.filter(l=>l.visible&&l.inMs<endMs&&(l.outMs??endMs)>startMs),moving=new Set<string>()
 for(const l of active){const keys=l.keyframes.filter(k=>k.timeMs>startMs&&k.timeMs<endMs);let last=cutoutTransformAt(l,startMs);for(const k of keys){if(['x','y','scale','rotation','opacity'].some(a=>Math.abs(last[a as keyof typeof last]-k.transform[a as keyof typeof last])>1e-5))moving.add(l.id);last=k.transform}const next=l.keyframes.find(k=>k.timeMs>=endMs);if(next&&next.easing!=='hold'&&['x','y','scale','rotation','opacity'].some(a=>Math.abs(last[a as keyof typeof last]-next.transform[a as keyof typeof last])>1e-5))moving.add(l.id);let pose=cutoutPoseAt(l,startMs);for(const p of l.poses.filter(p=>p.timeMs>startMs&&p.timeMs<endMs)){if(p.assetId!==pose)moving.add(l.id);pose=p.assetId}if(l.maskKeyframes?.some(k=>k.timeMs>startMs&&k.timeMs<endMs))moving.add(l.id)}
 for(const ik of s.ik??[])if(ik.enabled&&(ik.weight>0||ik.keyframes.some(k=>k.timeMs<endMs&&k.weight>0)))for(const id of [ik.upperId,ik.lowerId,ik.targetLayerId])if(id)moving.add(id)
 const camera=s.camera.keyframes.some(k=>k.timeMs>startMs&&k.timeMs<endMs||k.timeMs>=endMs&&k.easing!=='hold');if(camera&&new Set(active.filter(l=>!l.parentId).map(l=>l.depth)).size>1)active.forEach(l=>moving.add(l.id))
 for(let n=0;n<active.length;n++)for(const l of active)if(l.parentId&&moving.has(l.parentId))moving.add(l.id)
 return active.filter(l=>moving.has(l.id)).map(l=>l.id)
}
export function evaluateShotRules(clip:Clip,assets:Asset[],raw?:CutoutRules):RuleFinding[]{
 let r:CutoutRules;try{r=cutoutRules(raw)}catch(e){return [{rule:'configuration',severity:'error',message:String(e)}]}
 const out:RuleFinding[]=[],add=(rule:string,severity:string,message:string,shot?:number)=>out.push({rule,severity:severity as Severity,message,...(shot===undefined?{}:{shot})})
 if(!r.transition.allowed.includes(clip.transition))add('transition',r.transition.severity,'Transisi manual '+clip.transition+' berbeda dari hard cut yang disarankan.')
 if(!r.camera.allowedPresets.includes(clip.cameraPreset))add('camera-preset',r.camera.severity,'Kamera manual '+clip.cameraPreset+'; static atau push-in lalu hold disarankan.')
 const ranges=clip.cutout?.shots?.length?clip.cutout.shots:[{startMs:0,endMs:clip.durationMs,action:clip.story}],d=r.shotDurationMs;let montage=0
 for(let i=0;i<ranges.length;i++){const shot=ranges[i],span=shot.endMs-shot.startMs;montage=span>=d.montageMin&&span<=d.montageMax?montage+1:0;if(span<d.montageMin||span>d.explainerMax||span>d.montageMax&&span<d.typicalMin||montage>d.montageMaxConsecutive)add('shot-duration',d.severity,'Durasi shot '+(span/1000).toFixed(2)+'s di luar rentang yang disarankan.',i);else if(span>d.typicalMax)add('shot-duration',d.severity,'Shot penjelasan panjang: tinjau satu gagasan dan hold keterbacaan.',i);const movers=movingLayerIds(clip,shot.startMs,shot.endMs);if(movers.length>r.movers.maxPerShot)add('movers',r.movers.severity,`${movers.length} layer bergerak; batas ${r.movers.maxPerShot} (${r.movers.note}).`,i);if(r.oneActionPerShot&&!shot.action?.trim())add('one-action','warning','Satu aksi utama belum dicatat untuk shot.',i)
 const scene=clip.cutout;if(!scene)continue
 for(const axis of ['x','y','zoom'] as const){const keys=[{timeMs:shot.startMs,value:scene.camera[axis]},...scene.camera.keyframes.filter(k=>k.timeMs>=shot.startMs&&k.timeMs<shot.endMs).map(k=>({timeMs:k.timeMs,value:k[axis],hold:k.easing==='hold'}))];if(!r.camera.shake&&oscillates(keys,r.camera.reversalWindowMs,r.camera.maxReversals))add('camera-shake',r.camera.severity,'Kamera bolak-balik dalam satu shot; gunakan framing stabil.',i)}
 const actorIds=new Set(scene.layers.filter(l=>[l.assetId,...l.poses.map(p=>p.assetId)].some(id=>['character','pose','part'].includes(String((assets.find(a=>a.id===id)?.meta.cutoutAsset as {role?:string})?.role)))).map(l=>l.id));for(let n=0;n<scene.layers.length;n++)for(const l of scene.layers)if(l.parentId&&actorIds.has(l.id))actorIds.add(l.parentId)
 for(const l of scene.layers.filter(l=>actorIds.has(l.id))){const keys=l.keyframes.filter(k=>k.timeMs>shot.startMs&&k.timeMs<=shot.endMs);if(!r.character.elastic&&keys.some(k=>['spring','back-out'].includes(k.easing)))add('character-elastic',r.character.severity,`Karakter “${l.name}” tidak boleh memakai pegas saat masuk atau idle.`,i);for(const axis of ['x','y','scale','rotation'] as const){const base=cutoutTransformAt(l,shot.startMs);if(oscillates([{timeMs:shot.startMs,value:base[axis]},...keys.map(k=>({timeMs:k.timeMs,value:k.transform[axis],hold:k.easing==='hold'}))],r.character.reversalWindowMs,r.character.maxReversals))add('character-wobble',r.character.severity,`Karakter “${l.name}” bergoyang berulang; tahan pose setelah aksi.`,i)}}
 }return out
}
export function profileShotFindings(clip:Clip,assets:Asset[],settings?:CutoutV5Settings):RuleFinding[]{
 const findings=evaluateShotRules(clip,assets,settings?.rules)
 if(settings?.motionProfile!=='png-impact'||!clip.cutout)return findings
 try{validatePngImpactScene(clip.cutout,clip,assets,settings.pngImpact);return findings.filter(f=>f.rule!=='character-wobble')}
 catch(e){return [...findings,{rule:'png-impact',severity:'error',message:(e as Error).message}]}
}
/** Read-only readiness. Explicit invalid video links remain blocked even if a flat image exists. */
export function cutoutReadiness(bundle:Pick<ProjectBundle,'project'|'clips'|'assets'>,readable:(a:Asset)=>boolean=()=>true):ClipReadiness[]{
 if(bundle.project.styleId!=='cutout-facts')return []
 const assets=bundle.assets,valid=(id:string|null|undefined,kinds:string[])=>{const a=assets.find(a=>a.id===id&&a.projectId===bundle.project.id&&kinds.includes(a.kind));return !!a&&readable(a)}
 return bundle.clips.map(c=>{const missing:string[]=[],reasons:string[]=[],findings=profileShotFindings(c,assets,bundle.project.editor.cutoutV5);let ready=false
 if(c.cutout?.enabled){try{const s=normalizeCutoutScene(c.cutout)!;if(s.specialVideo){ready=valid(s.specialVideo.assetId,['video']);if(!ready)missing.push('Video klip khusus yang terbaca.')}else{const ids=cutoutAssetIds(s);ready=ids.length>1&&s.layers.filter(l=>l.visible&&l.assetId).length>1&&ids.every(id=>valid(id,['image','overlay']));if(!ready)missing.push('Background dan pose/properti terpisah yang terbaca.')}}catch(e){missing.push('Komposisi/rig valid: '+String(e))}}
 else if(c.videoAssetId){ready=valid(c.videoAssetId,['video']);if(!ready)missing.push('File video milik proyek yang dapat dibaca.')}
 else if(c.motionType==='video')missing.push('motionType video tetapi videoAssetId kosong; pilih Ubah ke Cutout atau siapkan klip khusus.')
 else missing.push('Paket background, pose dan properti untuk menyusun komposisi; foto utuh belum menjadi Cutout.')
 reasons.push(...missing,...findings.map(f=>f.message));return {clipId:c.id,title:c.title,status:!ready?(c.motionType==='video'||!!c.cutout||!!c.videoAssetId?'blocked':'warning'):findings.some(f=>f.severity==='error')?'blocked':findings.length?'warning':'ok',reasons,missingAssets:missing,findings}
 })
}
