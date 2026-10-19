import {availableCutoutAssets} from './cutout-orphans'
import {prefillSceneBrief} from './cutout-brief-prefill'
import type {Asset,Clip,ProjectBundle,WordTiming} from './types'
import type {CutoutAssetItem,CutoutAssetPlan,CutoutAssetState} from './cutout-assets'
import {createCutoutLayer,createCutoutScene,normalizeCutoutScene,cutoutPoseAt,claimCutoutPoseTime,type CutoutScene} from './cutout-timeline'
import {generatedForItem,cutoutGroupLayerId} from './cutout-production'
import {cutoutGroupKey,groupMotion,scheduledItem} from './cutout-plan-diagnostics'
import {movingLayerIds} from './cutout-shot-rules'
export const CUTOUT_PLANNER_VERSION=6
export type ClipProductionStatus='ready'|'needs-assets'|'needs-character'|'needs-special-clip'|'invalid-plan'|'done'|'failed'
export interface BriefEvidence {field:string;quote:string;startWord:number|null;endWord:number|null;startMs:number|null;endMs:number|null;source:'narration'|'proposal'|'continuity-confirmed'}
export interface SceneBrief {version:1;clipId:string;era:string;location:string;timeWeather:string;characters:string[];wardrobe:string;props:string[];locationCertain:boolean;reason:string;evidence:BriefEvidence[];warnings:string[];characterProposal?:{name:string;age:number|null;wardrobe:string;reason:string};approved:boolean;source:string}
export interface EraRule {id:string;before:number;pattern:string;warning:string}
export const DEFAULT_ERA_RULES:EraRule[]=[{id:'ring-pull',before:1962,pattern:'ring pull|cincin tarik|pull.tab',warning:'Cincin tarik berpotensi anakronistis pada era ini.'},{id:'wheel-opener',before:1870,pattern:'rotary opener|pembuka roda|wheel opener',warning:'Pembuka roda perlu ditinjau terhadap tahun yang disebut; jangan menganggap sudah tersedia pada 1860.'},{id:'steam-sail',before:1900,pattern:'steamship machinery|mesin uap',warning:'Mesin uap pada kapal layar perlu dasar narasi; tinjau jenis kapal.'}]
const slug=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[–—_:/|]+/g,'-').replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
/** Editable aliases normalize spelling/language, never infer a location from a previous shot. */
export const DEFAULT_LOCATION_ALIASES:Record<string,string>={'present-day':'modern','masa-kini':'modern','dapur-inggris':'british-kitchen','modern-british-kitchen-present-day':'modern-british-kitchen','dek-kapal-layar-ekspedisi-inggris-arktik':'british-arctic-expedition-deck','dek-kapal-ekspedisi-inggris-di-arktik':'british-arctic-expedition-deck','dek-kapal-ekspedisi-inggris-arktik':'british-arctic-expedition-deck'}
export function canonicalLocationKey(raw:string,aliases=DEFAULT_LOCATION_ALIASES):string {let value=slug(raw);for(let pass=0;pass<3;pass++)for(const [a,b] of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(slug(a),slug(b));return value.replace(/(?:modern-)+modern/g,'modern').replace(/-modern$/,'').replace(/-+/g,'-')}
export function canonicalLayerKey(i:CutoutAssetItem,items:CutoutAssetItem[]):string {
 if(i.role==='background')return 'bg'
 if(i.characterId&&['character','pose','part'].includes(i.role))return i.role==='part'?'part:'+i.characterId+':'+slug(i.layerKey??i.id):'char:'+i.characterId
 const group=items.filter(o=>cutoutGroupKey(o)===cutoutGroupKey(i)),base=group.find(o=>!o.id.startsWith('review-'))??i
 return (i.role==='foreground'?'fg:':i.role==='part'?'part:':['character','pose'].includes(i.role)?'char:unassigned:':'prop:')+slug(base.id)
}
/** Migration is metadata-only: keep item IDs, plan ID, sourceHash and finished files. */
export function migrateCutoutPlan(plan:CutoutAssetPlan):CutoutAssetPlan {
 const result=structuredClone(plan),groups=new Map<string,string>();for(const i of plan.items)groups.set(cutoutGroupKey(i),canonicalLayerKey(i,plan.items))
 result.items=plan.items.map(i=>{const m=groupMotion(i,plan.items);return {...i,layerKey:groups.get(cutoutGroupKey(i))!,...(i.locationKey?{locationKey:canonicalLocationKey(i.locationKey)}:{}),...(m.value?{motionRole:m.value,...(!i.motionRole?{motionRoleSource:'group' as const}:{})}:{}),usage:i.usage??(i.id.startsWith('review-')?'variant':'scheduled')}})
 if(result.director)for(const s of result.director.shots)if(s.movers)s.movers=[...new Set(s.movers.map(k=>groups.get(k)??k))]
 result.plannerVersion=CUTOUT_PLANNER_VERSION;return result
}
const noHuman=/\b(worker|woman|man|pekerja|perempuan|pria|wanita|orang|tokoh|pengguna)\b/i
function proof(field:string,quote:string,words:WordTiming[],source:BriefEvidence['source']='narration'):BriefEvidence {const tokens=quote.toLowerCase().split(/\s+/),start=words.findIndex(w=>w.text.toLowerCase().includes(tokens[0]));return {field,quote,startWord:start<0?null:start,endWord:start<0?null:Math.min(words.length-1,start+tokens.length-1),startMs:start<0?null:Math.floor(words[start].start*1000),endMs:start<0?null:Math.floor(words[Math.min(words.length-1,start+tokens.length-1)].end*1000),source}}
export function buildSceneBrief(clip:Clip,characters:ProjectBundle['characters'],words:WordTiming[],previous?:SceneBrief,rules=DEFAULT_ERA_RULES):SceneBrief {
 const text=clip.narration,era=text.match(/\b(?:1\d{3}|20\d{2})(?:\s*[–—-]\s*(?:1\d{3}|20\d{2}))?\b/)?.[0]??text.match(/\b(?:abad\s+(?:ke[- ]?)?\d+|masa kini|modern|sekarang)\b/i)?.[0]??'belum ditetapkan'
 const location=text.match(/\b(?:di|ke)\s+(?:[A-Z][\p{L}-]+(?:\s+[A-Z][\p{L}-]+){0,3}|dek kapal|dapur|bengkel|Arktik|Inggris)\b/u)?.[0]??text.match(/\b(Arktik|dapur|bengkel|Inggris)\b/i)?.[0]
 const hypothetical=/^\s*(bayangkan|coba bayang|andaikan|misalnya|kamu|lu|kalian)\b/i.test(text),explicit=/\b(di tempat yang sama|di dek yang sama|di dapur yang sama|kembali ke (dek|dapur|bengkel)|di sana)\b/i.test(text)
 const resolved=location??(explicit&&!hypothetical?previous?.location:undefined),evidence:BriefEvidence[]=[]
 if(era!=='belum ditetapkan')evidence.push(proof('era',era,words));if(location)evidence.push(proof('location',location,words));else if(explicit&&previous)evidence.push(proof('location',text.match(/\b(di tempat yang sama|di dek yang sama|di dapur yang sama|kembali ke (?:dek|dapur|bengkel)|di sana)\b/i)![0],words,'continuity-confirmed'))
 const cast=characters.filter(c=>clip.characterIds.includes(c.id)),props=[...new Set(text.match(/\b(palu|pahat|sendok|kaleng|roda|pembuka|wadah|makanan|mesin|kapal|pisau|peti)\b/gi)??[])];for(const p of props)evidence.push(proof('prop',p,words))
 const wardrobe=cast.map(c=>c.name+': '+c.description).join('\n')||'Belum ada tokoh/wardrobe proyek; usulan harus disetujui.'
 const missing=!cast.length&&noHuman.test(clip.visualPrompt+' '+clip.story),warnings:string[]=[]
 const avoid=clip.visualPrompt.split(/Avoid:/i)[1]??'';if(avoid)warnings.push('Avoid (larangan visual, bukan bukti benda ada): '+avoid.trim())
 const positive=clip.visualPrompt.split(/Avoid:/i)[0]+' '+props.join(' '),year=Number(era.match(/\d{4}/)?.[0]);if(year)for(const r of rules)try{if(year<r.before&&new RegExp(r.pattern,'i').test(positive))warnings.push(r.warning)}catch{warnings.push('Aturan era '+r.id+' regex tidak valid; perbaiki kamus.')}
 if(hypothetical||!resolved)warnings.push('Lokasi tidak pasti; storyboard tidak dianggap bukti narasi. Konfirmasikan lokasi, jangan warisi diam-diam.')
 if(era==='belum ditetapkan')warnings.push('Era belum disebut jelas; konfirmasikan sebelum generasi.')
 return {version:1,clipId:clip.id,era,location:resolved??'lokasi-tidak-pasti',locationCertain:!!resolved&&!hypothetical,timeWeather:'Usulan pencahayaan/waktu/cuaca perlu konfirmasi; narasi tidak selalu menyebutnya.',characters:cast.map(c=>c.id),wardrobe,props,evidence,warnings,reason:`Era ${era} dan lokasi ${resolved??'belum pasti'} berasal dari narasi${explicit?' / kelanjutan eksplisit':''}; detail visual lain adalah usulan yang memerlukan persetujuan.`,...(missing?{characterProposal:{name:'Pekerja dapur (usulan)',age:/40[- ]year|40 tahun/i.test(clip.visualPrompt)?40:null,wardrobe:'Pakaian sesuai era yang dikonfirmasi; tinjau gaun wol, apron linen dan penutup kepala bila sesuai.',reason:'Visual memerlukan orang tetapi characterIds kosong; jangan mengarang ID karakter.'}}:{}),approved:false,source:JSON.stringify([clip.narration,clip.visualPrompt,clip.characterIds,words])}
}
export type CutoutActionTarget='assets'|'characters'|'plan'|'production'|'special-clip'
export function cutoutActionForStatus(status:ClipProductionStatus):{action:string;actionTarget:CutoutActionTarget}{
 const actions:Record<ClipProductionStatus,{action:string;actionTarget:CutoutActionTarget}>={
 ready:{action:'Buka Produksi untuk menyusun klip ini',actionTarget:'production'},
 'needs-assets':{action:'Tinjau kebutuhan aset di klip ini',actionTarget:'assets'},
 'needs-character':{action:'Pilih atau tambah tokoh di Visual',actionTarget:'characters'},
 'needs-special-clip':{action:'Buka Produksi untuk menyiapkan klip khusus',actionTarget:'special-clip'},
 'invalid-plan':{action:'Tinjau atau perbarui rencana di Visual',actionTarget:'plan'},
 done:{action:'Tinjau hasil klip di Produksi',actionTarget:'production'},failed:{action:'Buka Produksi untuk mencoba ulang klip ini',actionTarget:'production'}}
 return actions[status]
}
export interface ClipPreflight {actionTarget:CutoutActionTarget;clipId:string;title:string;status:ClipProductionStatus;reason:string;action:string;legacy:boolean;plannerVersion:number|null;planId:string|null;missingItems:{id:string;label:string;error?:string|null}[];planned:number;generated:number;reviewed:number;special:string[];brief:SceneBrief;warnings:string[];result?:CutoutScene;refinement?:string}
/** No provider, DB writes or image decoding. This compiles a safe editorial baseline, not pixel certification. */
export function composeBasicCutout(clip:Clip,plan:CutoutAssetPlan,assets:Asset[],aspect:string):{scene:CutoutScene;warnings:string[]} {
 const duration=Math.floor(clip.durationMs);if(duration<1)throw Error('Durasi tidak valid.')
 const items=plan.items,scene=createCutoutScene(),warnings:string[]=[],grouped=new Map<string,CutoutAssetItem[]>()
 for(const i of items.filter(scheduledItem)){const key=cutoutGroupKey(i);grouped.set(key,[...(grouped.get(key)??[]),i])}
 if(grouped.size>64)throw Error('Maksimal 64 layer; tinjau rencana.')
 if(!items.some(i=>i.role==='background'))throw Error('Background tanpa tokoh belum direncanakan.')
 const raw=plan.director?.shots,ranges=raw?.length&&raw[0].startMs===0&&raw.at(-1)!.endMs===duration&&raw.every((s,n)=>Number.isInteger(s.startMs)&&Number.isInteger(s.endMs)&&s.endMs>s.startMs&&(!n||s.startMs===raw[n-1].endMs))?raw:[{startMs:0,endMs:duration,action:'Hold aset tersedia; rencana shot legacy perlu ditinjau.',camera:'wide',assetIds:items.map(i=>i.id)}]
 if(ranges!==raw)warnings.push('Rentang director legacy/tidak valid: baseline hold mencakup durasi bulat, tinjau ulang shot.')
 const [aw,ah]=aspect.split(':').map(Number),ratio=aw/ah||9/16
 const entries=[...grouped].sort((a,b)=>{const rank=(i:CutoutAssetItem)=>i.role==='background'?0:i.role==='foreground'?2:1;return rank(a[1][0])-rank(b[1][0])})
 for(const [key,list] of entries){list.sort((a,b)=>a.timeMs-b.timeMs);const first=list[0],a=generatedForItem(assets,plan,first.id);if(!a)throw Error('Aset belum dibuat: '+first.id+' · '+first.label)
  const bg=first.role==='background',fg=first.role==='foreground',prop=first.role==='prop',layer=createCutoutLayer(cutoutGroupLayerId(key),first.label,a.id);layer.width=bg?Math.max(1,((a.width??1)/(a.height??1))/ratio):fg?1:prop?.32:.68;layer.depth=1;layer.inMs=0;layer.outMs=duration;layer.motionRole=groupMotion(first,items).value??'static';layer.transform={x:bg?.5:prop?.72:.46,y:bg?.5:fg?.82:prop?.58:.55,scale:1,rotation:0,opacity:1}
  for(const s of ranges)layer.keyframes.push({id:'hold-'+s.startMs,timeMs:s.startMs,transform:{...layer.transform},easing:'hold'})
  if(layer.motionRole==='mover'){const times=new Set([0]);for(const i of list.slice(1)){const a=generatedForItem(assets,plan,i.id);if(!a)throw Error('Aset belum dibuat: '+i.id);const at=claimCutoutPoseTime(i.id,Math.max(0,Math.min(duration-1,Math.floor(i.timeMs))),times,duration);layer.poses.push({id:'pose-'+i.id,timeMs:at,assetId:a.id})}}
  else if(list.length>1)warnings.push('Grup static '+key+': hanya satu varian hold dipakai; kandidat lain tidak dipaksa bergerak.')
  scene.layers.push(layer)
 }
 if(scene.layers.length<2)throw Error('Baseline memerlukan background dan objek terpisah.')
 // Audit actual effective layer motion. Freeze excess pose tracks rather than promoting any static group.
 for(const s of ranges){const moving=movingLayerIds({...clip,durationMs:duration,cutout:scene},s.startMs,s.endMs);for(const id of moving.slice(2)){const l=scene.layers.find(l=>l.id===id)!;l.poses=l.poses.filter(p=>p.timeMs<=s.startMs||p.timeMs>=s.endMs);warnings.push('Shot '+s.startMs+': grup '+id+' ditahan pada baseline agar maksimal dua mover; penyempurnaan ditolak.')}}
 for(const s of ranges){scene.camera.keyframes.push({id:'camera-cut-'+s.startMs,timeMs:s.startMs,x:0,y:0,zoom:1,easing:'hold'});if(s.camera!=='reaction'&&s.camera!=='detail')continue;const t=Math.min(s.endMs-1,s.startMs+Math.min(450,Math.floor((s.endMs-s.startMs)/4)));if(t>s.startMs)scene.camera.keyframes.push({id:'camera-push-'+s.startMs,timeMs:t,x:0,y:0,zoom:1.04,easing:'linear'})}
 for(const s of ranges)if(movingLayerIds({...clip,durationMs:duration,cutout:scene},s.startMs,s.endMs).length>2)throw Error('Baseline melebihi dua mover; perbaiki rencana.')
 scene.shots=ranges.map((s,index)=>{const d=s as any,movers=movingLayerIds({...clip,durationMs:duration,cutout:scene},s.startMs,s.endMs),layer=scene.layers.find(l=>l.id===movers[0])??scene.layers.find(l=>!grouped.get(entries.find(([,items])=>items[0].label===l.name)?.[0]??'')?.some(i=>i.role==='background'))??scene.layers[0],startPose=cutoutPoseAt(layer,s.startMs)!,endPose=cutoutPoseAt(layer,s.endMs-1)!;return {id:'baseline-'+index,clipId:clip.id,startMs:s.startMs,endMs:s.endMs,beat:['hook','konteks','kronologi','penutup'].includes(d.beat)?d.beat:'konteks',action:s.action||'Hold aset tersedia',movers,startPose,endPose,motionPattern:startPose!==endPose?'pose-swap':d.camera==='detail'||d.camera==='reaction'?'camera-push':'hold',overlays:Array.isArray(d.overlays)?d.overlays:[],narrationCue:d.narrationCue||clip.narration||'Hold',sfxCue:d.sfxCue}})
 return {scene:normalizeCutoutScene(scene)!,warnings}
}
export function preflightCutout(input:ProjectBundle,states:Record<string,CutoutAssetState>,briefs:Record<string,SceneBrief>={}):ClipPreflight[]{
 const bundle={...input,assets:availableCutoutAssets(input)};let previous:SceneBrief|undefined;return bundle.clips.map(c=>{try{const state=states[c.id],plan=state?.plan,words=bundle.assets.find(a=>a.id===c.audioAssetId)?.meta.words??[],fresh=prefillSceneBrief(buildSceneBrief(c,bundle.characters,words,previous,bundle.project.editor.cutoutV5?.eraRules),c,bundle),saved=briefs[c.id],brief=saved?.source===fresh.source?saved:fresh;previous=brief;const missingItems=(plan?.items??[]).filter(i=>scheduledItem(i)&&!generatedForItem(bundle.assets,plan!,i.id)).map(i=>({id:i.id,label:i.label,error:state?.jobs.filter(j=>j.itemId===i.id&&!!j.job.error).sort((a,b)=>b.job.updatedAt-a.job.updatedAt)[0]?.job.error})),generated=(plan?.items??[]).filter(i=>!!generatedForItem(bundle.assets,plan!,i.id)).length,reviewed=(plan?.items??[]).filter(i=>(generatedForItem(bundle.assets,plan!,i.id)?.meta.cutoutAsset as any)?.review==='approved').length,special=plan?.director?.specialAssets.filter(s=>/^(klip khusus|special clip)|memerlukan klip khusus|requires? (?:a )?(?:dedicated|special) (?:video|clip)/i.test(s)&&!/tidak|not required|jika|if needed/i.test(s))??[];let status:ClipProductionStatus='ready',reason='Aset lengkap; baseline lokal tersedia. Review piksel tetap diperlukan.',result:CutoutScene|undefined,warnings=[...brief.warnings];
 if(brief.characterProposal&&!brief.characters.length||c.characterIds.some(id=>!bundle.characters.some(ch=>ch.id===id))){status='needs-character';reason='Tokoh visual belum didefinisikan atau ID bukan milik proyek.'}
 else if(!plan||state?.stale||missingItems.length){status='needs-assets';reason=!plan?'Rencana belum ada.':state?.stale?'Rencana usang karena narasi/identitas berubah.':'Aset belum dibuat: '+missingItems.map(i=>i.id).join(', ')}
 else {try{const base=composeBasicCutout(c,plan,bundle.assets,bundle.project.aspectRatio);result=base.scene;warnings.push(...base.warnings);if(special.length){status='needs-special-clip';reason='Baseline hold tersedia, tetapi aksi kontinu memerlukan klip khusus.'}}catch(e){status='invalid-plan';reason=(e as Error).message}}
 if(!result&&plan&&!state?.stale&&!missingItems.length)try{const base=composeBasicCutout(c,plan,bundle.assets,bundle.project.aspectRatio);result=base.scene;warnings.push(...base.warnings)}catch(e){warnings.push('Baseline belum tersedia: '+(e as Error).message)}
 return {clipId:c.id,title:c.title,status,reason,...cutoutActionForStatus(status),legacy:!plan?.plannerVersion||plan.plannerVersion<CUTOUT_PLANNER_VERSION,plannerVersion:plan?.plannerVersion??null,planId:plan?.id??null,missingItems,planned:plan?.items.length??0,generated,reviewed,special,brief,warnings,...(result?{result}:{})}
 }catch(e){const brief=buildSceneBrief(c,bundle.characters,[],previous);return {clipId:c.id,title:c.title,status:'invalid-plan' as const,reason:(e as Error).message,...cutoutActionForStatus('invalid-plan'),legacy:true,plannerVersion:states[c.id]?.plan?.plannerVersion??null,planId:states[c.id]?.plan?.id??null,missingItems:[],planned:states[c.id]?.plan?.items?.length??0,generated:0,reviewed:0,special:[],brief,warnings:['Data rencana perlu peningkatan.']}}})
}
