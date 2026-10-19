import {normalizeCutoutScene,cutoutTransformAt,cutoutCameraAt,type CutoutScene} from './cutout-timeline'
import {movingLayerIds} from './cutout-shot-rules'
import type {Clip,WordTiming} from './types'
export interface ComedyJoltProfile {id:'comedy-jolt';label:string;verified:boolean;source:string;amplitude:number|null;frequencyHz:number|null;durationMs:number|null;decay:number|null;axis:'x'|'y'|'rotation'|null;maxJoltsPerClip:number|null;maxJoltDurationMs:number|null;zoomDelta:number|null;zoomDurationMs:number|null;allowOvershoot:boolean|null;maxKeysPerClip:number|null}
export interface JoltCue {clipId?:string;kind:'jolt'|'punch-zoom'|'hard-cut-jolt'|'reaction-swap';wordIndex:number;seed:number;layerId?:string;poseAssetId?:string;target:'layer'|'camera';direction?:'in'|'out'}
export function validateJoltProfile(p:ComedyJoltProfile):void {
 if(p.id!=='comedy-jolt'||!p.verified||!p.source?.trim())throw Error('Komedi getar belum terverifikasi: isi profiles/comedy-jolt.json dari analisis atau kalibrasi yang dicatat. Tidak ada parameter gaya yang ditebak.')
 for(const key of ['amplitude','frequencyHz','durationMs','decay','maxJoltsPerClip','maxJoltDurationMs','zoomDelta','zoomDurationMs','maxKeysPerClip'] as const)if(typeof p[key]!=='number'||!Number.isFinite(p[key]))throw Error('Parameter belum diisi: '+key)
 if(p.amplitude!<0||p.amplitude!>1||p.frequencyHz!<=0||p.frequencyHz!>500||p.durationMs!<1||!Number.isInteger(p.durationMs)||p.durationMs!>p.maxJoltDurationMs!||p.maxJoltDurationMs!>86400000||p.decay!<0||p.decay!>20||!['x','y','rotation'].includes(p.axis??'')||!Number.isInteger(p.maxJoltsPerClip)||p.maxJoltsPerClip!<1||p.maxJoltsPerClip!>1000||!Number.isInteger(p.zoomDurationMs)||p.zoomDurationMs!<1||p.zoomDelta!<0||p.zoomDelta!>1||typeof p.allowOvershoot!=='boolean'||!Number.isInteger(p.maxKeysPerClip)||p.maxKeysPerClip!<1||p.maxKeysPerClip!>8192)throw Error('Parameter komedi getar di luar batas teknis.')
}
/** Pure seeded motion. Integer-ms sampling and exact rest/hold, no randomness at render time. */
export function applyComedyJolt(seedScene:CutoutScene,clip:Clip,words:WordTiming[],cues:JoltCue[],p:ComedyJoltProfile):CutoutScene {
 validateJoltProfile(p);const scene=structuredClone(seedScene),end=Math.floor(clip.durationMs),occupied=new Map<string,[number,number][]>();let jolts=0
 const range=(track:string,start:number,last:number)=>{if(start<0||last>=end)throw Error('Cue/gerak melewati klip.');const ranges=occupied.get(track)??[];if(ranges.some(([a,b])=>start<=b&&last>=a))throw Error('Cue pada track yang sama tumpang tindih; pisahkan aksi.');ranges.push([start,last]);occupied.set(track,ranges)}
 const keyBudget=()=>{const count=scene.camera.keyframes.length+scene.layers.reduce((n,l)=>n+l.keyframes.length+l.poses.length,0);if(count>p.maxKeysPerClip!||scene.layers.some(l=>l.keyframes.length>8192))throw Error('Anggaran keyframe komedi getar terlampaui.')}
 for(const [index,cue] of cues.entries()){
  if(!Number.isInteger(cue.wordIndex)||!words[cue.wordIndex]||!Number.isInteger(cue.seed))throw Error('Cue harus mengikuti indeks kata rekaman dan seed bulat.')
  const start=Math.floor(words[cue.wordIndex].start*1000),duration=cue.kind==='punch-zoom'?p.zoomDurationMs!:p.durationMs!,last=start+duration;range(cue.target==='camera'?'camera':cue.layerId??'',start,last)
  if(cue.kind==='hard-cut-jolt'&&!scene.shots?.some(s=>s.startMs===start))throw Error('hard-cut-jolt harus tepat pada cut dan onset kata.')
  if(cue.kind!=='punch-zoom'&&++jolts>p.maxJoltsPerClip!)throw Error('Jumlah getar per klip melewati profil.')
  const layer=cue.target==='layer'?scene.layers.find(l=>l.id===cue.layerId):undefined
  if(cue.target==='layer'&&(!layer||layer.motionRole!=='mover'))throw Error('Getar hanya boleh pada grup mover yang sudah direncanakan.')
  if(cue.kind==='reaction-swap'){
   if(!layer||!cue.poseAssetId||![layer.assetId,...layer.poses.map(p=>p.assetId)].includes(cue.poseAssetId))throw Error('Pose reaksi harus terdaftar pada karakter ini.')
   layer.poses=layer.poses.filter(p=>p.timeMs!==start);layer.poses.push({id:'jolt-pose-'+index,assetId:cue.poseAssetId,timeMs:start});layer.poses.sort((a,b)=>a.timeMs-b.timeMs)
  }
  const base=layer?cutoutTransformAt(layer,start):cutoutCameraAt(scene.camera,start)
  if(layer)layer.keyframes=layer.keyframes.filter(k=>k.timeMs<start||k.timeMs>last+1)
  else scene.camera.keyframes=scene.camera.keyframes.filter(k=>k.timeMs<start||k.timeMs>last+1)
  const put=(timeMs:number,value:number,hold=false)=>{if(layer){const transform={...base} as typeof layer.transform;if(cue.kind==='punch-zoom')transform.scale*=value;else transform[p.axis!]+=value;layer.keyframes=layer.keyframes.filter(k=>k.timeMs!==timeMs);layer.keyframes.push({id:`jolt-${index}-${timeMs}`,timeMs,transform,easing:hold?'hold':'linear'})}else{const camera={...base} as {x:number;y:number;zoom:number};if(cue.kind==='punch-zoom')camera.zoom*=value;else {if(p.axis==='rotation')throw Error('Kamera tidak mendukung rotasi; pilih x/y.');camera[p.axis!]+=value}if(camera.zoom<.1||camera.zoom>10)throw Error('Zoom keluar batas skema.');scene.camera.keyframes=scene.camera.keyframes.filter(k=>k.timeMs!==timeMs);scene.camera.keyframes.push({id:`jolt-${index}-${timeMs}`,timeMs,...camera,easing:hold?'hold':'linear'})}keyBudget()}
  if(cue.kind==='punch-zoom'){const target=1+(cue.direction==='out'?-p.zoomDelta!:p.zoomDelta!);put(start,1,true);if(p.allowOvershoot){put(start+Math.max(1,Math.floor(duration*.7)),target+(target-1)*.1)}put(last,target);if(last+1<end)put(last+1,target,true)}
  else {const rate=Math.min(1000,Math.max(30,Math.ceil(p.frequencyHz!*8))),count=Math.ceil(duration*rate/1000);if(count>p.maxKeysPerClip!)throw Error('Anggaran keyframe getar terlampaui sebelum alokasi.');const phase=((cue.seed>>>0)%65536)/65536*Math.PI*2;put(start,0,true);let previous=start;for(let n=1;n<count;n++){const t=start+Math.floor(n*duration/count);if(t===previous)continue;previous=t;const u=(t-start)/duration,value=p.amplitude!*Math.sin(u*duration/1000*p.frequencyHz!*Math.PI*2+phase)*Math.pow(1-u,p.decay!);put(t,value)}put(last,0);if(last+1<end)put(last+1,0,true)}
 }
 scene.camera.keyframes.sort((a,b)=>a.timeMs-b.timeMs);for(const l of scene.layers)l.keyframes.sort((a,b)=>a.timeMs-b.timeMs)
 const ranges=scene.shots??[{startMs:0,endMs:end}];for(const s of ranges)if(movingLayerIds({...clip,cutout:scene},s.startMs,s.endMs).length>2)throw Error('Komedi getar melebihi dua layer bergerak; getaran dan parallax ikut dihitung.')
 return normalizeCutoutScene(scene)!
}
/** Profile validation is separate from stable-v5's no-shake rules. It still enforces effective mover limits. */
export function validateComedyScene(scene:CutoutScene,clip:Clip,words:WordTiming[],cues:JoltCue[],p:ComedyJoltProfile):void {
 validateJoltProfile(p);normalizeCutoutScene(scene)
 if(scene.layers.some(l=>l.keyframes.length>8192)||scene.camera.keyframes.length+scene.layers.reduce((n,l)=>n+l.keyframes.length+l.poses.length,0)>p.maxKeysPerClip!)throw Error('Anggaran keyframe komedi getar terlampaui.')
 if(cues.filter(c=>c.kind!=='punch-zoom').length>p.maxJoltsPerClip!)throw Error('Jumlah getar melebihi profil.')
 for(const cue of cues){const word=words[cue.wordIndex];if(!word)throw Error('Cue tidak tersinkron pada kata rekaman.');const start=Math.floor(word.start*1000),last=start+(cue.kind==='punch-zoom'?p.zoomDurationMs!:p.durationMs!),layer=cue.target==='layer'?scene.layers.find(l=>l.id===cue.layerId):undefined;if(last>=Math.floor(clip.durationMs))throw Error('Getar melewati klip.');if(cue.target==='layer'&&(!layer||layer.motionRole!=='mover'))throw Error('Getar pada grup selain mover tidak sah.');
  const keys=layer?layer.keyframes:scene.camera.keyframes;if(!keys.some(k=>k.timeMs===start)||!keys.some(k=>k.timeMs===last))throw Error('Onset/durasi keyframe tidak sesuai cue/profil.')
  if(cue.kind!=='punch-zoom'){const base=layer?cutoutTransformAt(layer,start):cutoutCameraAt(scene.camera,start),rest=layer?cutoutTransformAt(layer,last):cutoutCameraAt(scene.camera,last);if(JSON.stringify(base)!==JSON.stringify(rest))throw Error('Getar tidak kembali tepat ke posisi istirahat.');for(const k of keys.filter(k=>k.timeMs>=start&&k.timeMs<=last)){const value='transform' in k?k.transform:k;if(p.axis==='rotation'&&!('rotation' in value))throw Error('Rotasi kamera tidak didukung.');if(Math.abs((value as any)[p.axis!]-(base as any)[p.axis!])>p.amplitude!+1e-9)throw Error('Amplitudo melebihi profil.')}if(last+1<clip.durationMs&&!keys.some(k=>k.timeMs===last+1&&k.easing==='hold'))throw Error('Getar belum hold setelah menetap.')}
 }
 for(const s of scene.shots??[{startMs:0,endMs:Math.floor(clip.durationMs)}])if(movingLayerIds({...clip,cutout:scene},s.startMs,s.endMs).length>2)throw Error('Maksimal dua mover efektif untuk profil komedi getar.')
 if(scene.layers.some(l=>[l.inMs,l.outMs,...l.keyframes.map(k=>k.timeMs),...l.poses.map(k=>k.timeMs)].filter(n=>n!==null).some(n=>!Number.isInteger(n))))throw Error('Timestamp komedi getar harus bulat.')
}
