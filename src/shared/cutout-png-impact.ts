import type {Asset,Clip,WordTiming} from './types'
import {cutoutTransformAt,normalizeCutoutScene,type CutoutScene,type CutoutLayer,type CutoutTransform} from './cutout-timeline'
import {movingLayerIds} from './cutout-shot-rules'

export interface PngImpactSettings {side?:'alternate'|'left'|'right';strength?:'soft'|'medium'|'strong';camera?:'contextual'|'static'|'ken-burns'|'push-in'|'pull-out'}
/** Authored starting points, NOT measurements or certification of any reference channel. */
export const PNG_IMPACT_LABEL='PNG masuk & getar · racikan editorial'
const params=(settings:PngImpactSettings)=>{if(settings.side&&!['alternate','left','right'].includes(settings.side)||settings.strength&&!['soft','medium','strong'].includes(settings.strength)||settings.camera&&!['contextual','static','ken-burns','push-in','pull-out'].includes(settings.camera))throw Error('Pengaturan PNG masuk tidak valid.');return {entry:320,settle:200,amplitude:settings.strength==='soft'?.006:settings.strength==='strong'?.018:.012,rotation:settings.strength==='soft'?.5:settings.strength==='strong'?1.5:1,zoom:settings.strength==='soft'?1.08:settings.strength==='strong'?1.2:1.14,zoomMs:180}}
const actor=(l:CutoutLayer,assets:Asset[])=>[l.assetId,...l.poses.map(p=>p.assetId)].some(id=>['character','pose'].includes(String((assets.find(a=>a.id===id)?.meta.cutoutAsset as any)?.role)))
const prop=(l:CutoutLayer,assets:Asset[])=>[l.assetId,...l.poses.map(p=>p.assetId)].some(id=>(assets.find(a=>a.id===id)?.meta.cutoutAsset as any)?.role==='prop')
const same=(a:CutoutTransform,b:CutoutTransform)=>Object.keys(a).every(k=>Math.abs(a[k as keyof CutoutTransform]-b[k as keyof CutoutTransform])<1e-9)
const timeEnd=(clip:Clip)=>Math.floor(clip.durationMs)
function editable(scene:CutoutScene,l:CutoutLayer,start:number,end:number){return l.motionRole==='mover'&&l.visible&&l.inMs<=start&&(l.outMs??end)>=end&&!l.parentId&&!scene.layers.some(c=>c.parentId===l.id)&&!scene.ik?.some(c=>c.enabled&&[c.upperId,c.lowerId,c.targetLayerId].includes(l.id))&&!l.maskKeyframes?.some(k=>k.timeMs>=start&&k.timeMs<end)&&l.keyframes.filter(k=>k.timeMs>=start&&k.timeMs<end).every(k=>same(k.transform,cutoutTransformAt(l,start)))}
function put(l:CutoutLayer,id:string,t:number,transform:CutoutTransform,easing:'linear'|'hold'='linear'){l.keyframes=l.keyframes.filter(k=>k.timeMs!==t);l.keyframes.push({id,timeMs:t,transform,easing});l.keyframes.sort((a,b)=>a.timeMs-b.timeMs)}
function withinBudget(scene:CutoutScene,clip:Clip){return scene.layers.every(l=>l.keyframes.length<=8192)&&scene.camera.keyframes.length+scene.layers.reduce((n,l)=>n+l.keyframes.length+l.poses.length,0)<=8192&&(scene.shots??[{startMs:0,endMs:timeEnd(clip)}]).every(s=>movingLayerIds({...clip,cutout:scene},s.startMs,s.endMs).length<=2)}
export function applyPngImpact(base:CutoutScene,clip:Clip,assets:Asset[],words:WordTiming[],settings:PngImpactSettings={}):{scene:CutoutScene;warnings:string[]}{
 const scene=structuredClone(base),p=params(settings),warnings:string[]=[],ranges=scene.shots??[{startMs:0,endMs:timeEnd(clip),action:clip.story}]
 if(scene.specialVideo)return {scene,warnings:['Klip khusus mempertahankan gerak videonya.']}
 for(const [n,s] of ranges.entries()){
  const mode=settings.camera??'contextual',cameraBefore=structuredClone(scene.camera.keyframes)
  if(mode!=='contextual'){
   scene.camera.keyframes=scene.camera.keyframes.filter(k=>k.timeMs<s.startMs||k.timeMs>=s.endMs)
   const start=s.startMs,end=Math.min(s.endMs-1,start+(mode==='ken-burns'?Math.max(1,s.endMs-start-1):300)),zoom=mode==='pull-out'?1.12:1
   scene.camera.keyframes.push({id:'impact-camera-'+n+'-cut',timeMs:start,x:0,y:0,zoom,easing:'hold'})
   if(mode!=='static'&&end>start){scene.camera.keyframes.push({id:'impact-camera-'+n+'-end',timeMs:end,x:mode==='ken-burns'?(n%2?-.015:.015):0,y:0,zoom:mode==='pull-out'?1:mode==='ken-burns'?1.06:1.12,easing:'linear'});if(end+1<s.endMs)scene.camera.keyframes.push({id:'impact-camera-'+n+'-hold',timeMs:end+1,x:0,y:0,zoom:mode==='pull-out'?1:1.12,easing:'hold'})}
   scene.camera.keyframes.sort((a,b)=>a.timeMs-b.timeMs)
   if(!withinBudget(scene,clip)){scene.camera.keyframes=cameraBefore;warnings.push('Shot '+(n+1)+': gerak kamera dilewati agar parallax tidak menambah lebih dari dua mover.')}
  }
  const character=scene.layers.find(l=>actor(l,assets)&&editable(scene,l,s.startMs,s.endMs))
  const contact=/\b(memegang|menggenggam|menulis|merakit|menyentuh|mengayuh|holding|gripping|writing|contact)\b/i.test(s.action)
  if(character&&s.endMs-s.startMs>p.entry+p.settle+100&&!contact){
   const old=structuredClone(character.keyframes),rest=cutoutTransformAt(character,s.startMs),right=settings.side==='right'||settings.side!=='left'&&n%2===1,off=right?Math.min(9,2+character.width):Math.max(-9,-character.width-1),last=s.startMs+p.entry+p.settle,prefix='impact-entry-'+n+'-'
   character.keyframes=character.keyframes.filter(k=>k.timeMs<s.startMs||k.timeMs>last+1)
   put(character,prefix+'off',s.startMs,{...rest,x:off},'hold');put(character,prefix+'arrive',s.startMs+p.entry,{...rest})
   for(let i=1;i<=5;i++){const f=i/6,sign=i%2?1:-1;put(character,prefix+'settle-'+i,s.startMs+p.entry+Math.floor(f*p.settle),{...rest,x:rest.x+sign*p.amplitude*(1-f),rotation:rest.rotation+sign*p.rotation*(1-f)})}
   put(character,prefix+'rest',last,{...rest});put(character,prefix+'hold',last+1,{...rest},'hold')
   if(!withinBudget(scene,clip)){character.keyframes=old;warnings.push('Shot '+(n+1)+': masuk karakter dilewati agar batas dua mover/anggaran keyframe tetap berlaku.')}
  }else if(character&&contact)warnings.push('Shot '+(n+1)+': kontak tangan/alat ditahan; tidak digeser saat interaksi.')
  else if(!character)warnings.push('Shot '+(n+1)+': tidak ada karakter mover bebas; grup static/rig tidak diubah diam-diam.')
  // Emphasize a named object on the recorded word; no automatic continual zoom oscillation.
  const object=scene.layers.find(l=>prop(l,assets)&&editable(scene,l,s.startMs,s.endMs)&&words.some(w=>w.start*1000>=s.startMs&&w.start*1000<s.endMs&&l.name.toLowerCase().includes(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,''))&&w.text.length>3))
  if(object&&!contact){const word=words.find(w=>w.start*1000>=s.startMs&&w.start*1000<s.endMs&&w.text.length>3&&object.name.toLowerCase().includes(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')))!,start=Math.max(s.startMs+1,Math.floor(word.start*1000)),last=start+p.zoomMs*2+180
   if(last+1<s.endMs){const old=structuredClone(object.keyframes),rest=cutoutTransformAt(object,start),prefix='impact-object-'+n+'-';object.keyframes=object.keyframes.filter(k=>k.timeMs<start||k.timeMs>last+1);put(object,prefix+'start',start,{...rest},'hold');put(object,prefix+'in',start+p.zoomMs,{...rest,scale:rest.scale*p.zoom});put(object,prefix+'hold',start+p.zoomMs+1,{...rest,scale:rest.scale*p.zoom},'hold');put(object,prefix+'out-start',start+p.zoomMs+180,{...rest,scale:rest.scale*p.zoom},'hold');put(object,prefix+'rest',last,{...rest});put(object,prefix+'end',last+1,{...rest},'hold');if(!withinBudget(scene,clip)){object.keyframes=old;warnings.push('Shot '+(n+1)+': zoom objek dilewati karena batas mover/keyframe.')}}
  }
 }
 if(scene.shots)for(const s of scene.shots){s.movers=movingLayerIds({...clip,cutout:scene},s.startMs,s.endMs);if(s.movers.some(id=>scene.layers.find(l=>l.id===id)?.keyframes.some(k=>k.timeMs>=s.startMs&&k.timeMs<s.endMs&&k.id.startsWith('impact-entry-'))))s.motionPattern='slide-linear'}
 const normalized=normalizeCutoutScene(scene)!;validatePngImpactScene(normalized,clip,assets,settings);if(!words.length)warnings.push('Timestamp kata belum tersedia: masuk mengikuti batas shot; zoom kata objek menunggu timing rekaman.')
 return {scene:normalized,warnings}
}
/** Only short, bounded, tagged entrance-settling is exempt from stable-v5 wobble detection. */
export function validatePngImpactScene(scene:CutoutScene,clip:Clip,assets:Asset[],settings:PngImpactSettings={}):void {
 const p=params(settings);normalizeCutoutScene(scene);if(!withinBudget(scene,clip))throw Error('Profil PNG masuk melampaui dua mover atau anggaran keyframe.')
 for(const l of scene.layers){for(const s of scene.shots??[{startMs:0,endMs:timeEnd(clip)}]){
  const keys=l.keyframes.filter(k=>k.timeMs>=s.startMs&&k.timeMs<s.endMs),tagged=keys.filter(k=>k.id.startsWith('impact-entry-'))
  if(!actor(l,assets))continue
  if(tagged.length){
   if(l.motionRole!=='mover'||l.parentId||scene.layers.some(c=>c.parentId===l.id)||scene.ik?.some(c=>c.enabled&&[c.upperId,c.lowerId,c.targetLayerId].includes(l.id)))throw Error('Masuk/getar karakter memerlukan mover bebas tanpa rig/anak.')
   const rest=tagged.find(k=>k.id.endsWith('-rest')),hold=tagged.find(k=>k.id.endsWith('-hold')),arrive=tagged.find(k=>k.id.endsWith('-arrive')),off=tagged.find(k=>k.id.endsWith('-off'))
   if(!rest||!hold||!arrive||!off||off.timeMs!==s.startMs||arrive.timeMs!==s.startMs+p.entry||rest.timeMs!==s.startMs+p.entry+p.settle||hold.timeMs!==rest.timeMs+1||hold.easing!=='hold'||!same(hold.transform,rest.transform)||!same(arrive.transform,rest.transform))throw Error('Masuk/getar harus singkat, kembali tepat ke posisi istirahat dan hold.')
   for(const k of tagged){if(!['linear','hold'].includes(k.easing)||k.timeMs>hold.timeMs)throw Error('Getar PNG tidak boleh berulang sepanjang shot.');if(k!==off&&(Math.abs(k.transform.y-rest.transform.y)>1e-9||Math.abs(k.transform.scale-rest.transform.scale)>1e-9||Math.abs(k.transform.opacity-rest.transform.opacity)>1e-9||Math.abs(k.transform.x-rest.transform.x)>p.amplitude+1e-9||Math.abs(k.transform.rotation-rest.transform.rotation)>p.rotation+1e-9))throw Error('Getar PNG melampaui amplitudo atau mengubah kontak/proporsi.')}
   if(keys.filter(k=>!k.id.startsWith('impact-entry-')).some(k=>!same(k.transform,rest.transform)))throw Error('Karakter harus hold di luar satu gerak masuk/getar per shot.')
  }else if(keys.some(k=>!same(k.transform,cutoutTransformAt(l,s.startMs))))throw Error('Gerak karakter profil PNG harus memakai masuk/getar yang terukur atau hold; pose swap tetap didukung.')
 }}
}
