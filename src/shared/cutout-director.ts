import {cutoutGroupKey,groupMotion,scheduledItem,type GroupItem} from './cutout-plan-diagnostics'
import { BEAT_KINDS, normalizeShotOverlays, type BeatKind, type ShotOverlay } from './cutout-shot-types'
/** A saved directing blueprint. Asset IDs refer to planned items, not generated files. */
export interface CutoutShotDirection {
  beat?: BeatKind; movers?: string[]; overlays?: ShotOverlay[]
  startMs: number; endMs: number; narrationCue: string; action: string; location: string; focus: string
  startPose: string; endPose: string; reaction: string; camera: 'wide'|'medium'|'detail'|'reaction'
  occlusion: string; contact: string; sfxCue: string; assetIds: string[]
}
export interface CutoutDirector { timing: 'recorded'|'provisional'; shots: CutoutShotDirection[]; specialAssets: string[] }
const text={type:'string',minLength:1,maxLength:800}
const shotProperties={beat:{type:'string',enum:BEAT_KINDS},movers:{type:'array',maxItems:2,items:{type:'string'}},overlays:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['type','text'],properties:{type:{type:'string',enum:['year','name','label']},text:{type:'string',minLength:1,maxLength:120}}}},startMs:{type:'integer',minimum:0},endMs:{type:'integer',minimum:1},narrationCue:text,action:text,location:text,focus:text,startPose:text,endPose:text,reaction:text,camera:{type:'string',enum:['wide','medium','detail','reaction']},occlusion:text,contact:text,sfxCue:text,assetIds:{type:'array',minItems:1,maxItems:256,items:{type:'string'}}}
export const CUTOUT_DIRECTOR_SCHEMA={type:'object',additionalProperties:false,required:['timing','shots','specialAssets'],properties:{timing:{type:'string',enum:['recorded','provisional']},shots:{type:'array',minItems:1,maxItems:24,items:{type:'object',additionalProperties:false,required:Object.keys(shotProperties).filter(k=>!['beat','movers','overlays'].includes(k)),properties:shotProperties}},specialAssets:{type:'array',maxItems:24,items:text}}}

/** Voice-sync durations are frame aligned (e.g. 100 frames / 30 fps), hence fractional ms.
 * Only the directing JSON uses integer milliseconds; never round the saved clip or voice. */
export function cutoutDirectorDurationMs(durationMs: number): number {
  if(!Number.isFinite(durationMs)||durationMs<1||durationMs>86_400_000)throw new Error('Durasi klip untuk penyutradaraan tidak valid.')
  // Floor keeps every planned integer key inside the exact (fractional) timeline.
  return Math.floor(durationMs)
}
export function cutoutDirectorSchema(durationMs: number, _shotBased=false) {
  const end=cutoutDirectorDurationMs(durationMs)
  return {...CUTOUT_DIRECTOR_SCHEMA,properties:{...CUTOUT_DIRECTOR_SCHEMA.properties,shots:{...CUTOUT_DIRECTOR_SCHEMA.properties.shots,items:{...CUTOUT_DIRECTOR_SCHEMA.properties.shots.items,required:Object.keys(shotProperties),properties:{...shotProperties,startMs:{type:'integer',minimum:0,maximum:end-1},endMs:{type:'integer',minimum:1,maximum:end}}}}}}
}

export function normalizeCutoutDirector(raw: unknown,durationMs: number,items: GroupItem[],hasWordTiming: boolean): CutoutDirector {
  const fail=(reason: string):never=>{
    const n=reason.match(/^shot (\d+)/),shot=n&&(raw as CutoutDirector)?.shots?.[Number(n[1])-1]
    const detail=shot&&!reason.includes('motionRole=')?items.filter(i=>shot.assetIds?.includes(i.id)).map(i=>{const m=groupMotion(i,items);return `grup ${cutoutGroupKey(i)}: ${i.id}@${i.timeMs??0} ms motionRole=${m.value??'null'} (sumber: ${m.source})`}).join('; '):''
    throw new Error(`Rencana penyutradaraan tidak valid: ${reason}.${detail?' '+detail+'. Perbaiki shot/rencana aset yang disebut sebelum melanjutkan.':''}`)
  }
  const duration=cutoutDirectorDurationMs(durationMs)
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('director harus berupa objek')
  const v=raw as CutoutDirector
  if(Object.keys(v).some(k=>!['timing','shots','specialAssets'].includes(k))||!['recorded','provisional'].includes(v.timing)||!Array.isArray(v.shots)||!v.shots.length||v.shots.length>24||!Array.isArray(v.specialAssets)||v.specialAssets.length>24)return fail('format timing, shots atau specialAssets tidak sesuai skema')
  if(v.timing==='recorded'&&!hasWordTiming)return fail('timing recorded memerlukan timestamp kata dari rekaman')
  const str=(s:unknown):s is string=>typeof s==='string'&&!!s.trim()&&s.length<=800
  if(v.specialAssets.some(s=>!str(s)))return fail('catatan klip khusus harus teks 1–800 karakter')
  const ids=new Set(items.map(i=>i.id)),used=new Set<string>();let end=0
  for(const [index,shot] of v.shots.entries()){
    const label=`shot ${index+1}`
    if(!shot||typeof shot!=='object'||Object.keys(shot).some(k=>!Object.hasOwn(shotProperties,k)))return fail(`${label} memiliki field yang tidak didukung`)
    if(!Number.isInteger(shot.startMs)||!Number.isInteger(shot.endMs))return fail(`${label}: startMs/endMs harus milidetik bulat`)
    if(shot.startMs!==end||shot.endMs<=shot.startMs||shot.endMs>duration)return fail(`${label}: rentang ${shot.startMs}–${shot.endMs} ms harus menyambung dari ${end} ms dan berakhir paling lambat ${duration} ms`)
    if(shot.beat!==undefined&&!BEAT_KINDS.includes(shot.beat))return fail(`${label}: beat tidak dikenal`)
    if(shot.movers!==undefined&&(!Array.isArray(shot.movers)||shot.movers.length>2||new Set(shot.movers).size!==shot.movers.length||shot.movers.some(id=>typeof id!=='string'||!id)))return fail(`${label}: maksimal 2 mover unik`)
    if(shot.overlays!==undefined)normalizeShotOverlays(shot.overlays)
    if(shot.movers!==undefined&&items.some(i=>i.motionRole!=null)){
      const detail=(key:string)=>items.filter(i=>cutoutGroupKey(i)===key).map(i=>{const m=groupMotion(i,items);return i.id+'@'+(i.timeMs??0)+' ms motionRole='+(m.value??'null')+' (sumber: '+m.source+')'}).join('; ')
      for(const key of shot.movers)if(!items.some(i=>cutoutGroupKey(i)===key&&groupMotion(i,items).value==='mover'))return fail(label+': grup '+key+' bukan grup mover perencana; '+(detail(key)||'assetId tidak terdaftar; motionRole=null (sumber: tidak ada pada rencana aset)')+'. Pilih mover dari rencana aset; untuk perubahan peran lakukan rencana ulang, maksimal 2 mover')
      for(const key of new Set(items.map(cutoutGroupKey))){
        const variants=items.filter(i=>cutoutGroupKey(i)===key&&shot.assetIds?.includes(i.id)&&scheduledItem(i)).sort((a,b)=>(a.timeMs??0)-(b.timeMs??0))
        // Distinct resolved asset identity; duplicate entries and holds are not motion.
        let previous:string|undefined;const changes=variants.filter(i=>{const id=i.assetId??i.id,change=previous!==undefined&&previous!==id;previous=id;return change&&(i.timeMs??0)>shot.startMs&&(i.timeMs??0)<shot.endMs})
        if(changes.length&&!shot.movers.includes(key)&&groupMotion(variants[0],items).value==='mover')return fail(label+': pergantian pose grup '+key+' harus ditandai mover pada shot ini; '+detail(key)+'. Perubahan pada '+changes.map(i=>i.timeMs+' ms').join(', ')+'. Tambahkan grup mover yang sudah direncanakan ke shot.movers (maksimal 2), atau hapus pergantian')
        if(changes.length&&groupMotion(variants[0],items).value!=='mover')return fail(label+': pergantian pose grup '+key+'; '+detail(key)+'. Perubahan pada '+changes.map(i=>i.timeMs+' ms').join(', ')+'. Pertahankan static dengan hapus pergantian/pilih satu varian, atau rencanakan ulang grup sebagai mover (maksimal 2); jangan menaikkan peran diam-diam')
      }
    }
    for(const key of ['narrationCue','action','location','focus','startPose','endPose','reaction','occlusion','contact','sfxCue'] as const)if(!str(shot[key]))return fail(`${label}.${key} harus teks 1–800 karakter`)
    if(!['wide','medium','detail','reaction'].includes(shot.camera))return fail(`${label}: kamera harus wide, medium, detail atau reaction`)
    if(!Array.isArray(shot.assetIds)||!shot.assetIds.length||shot.assetIds.length>256||new Set(shot.assetIds).size!==shot.assetIds.length)return fail(`${label}: assetIds harus memuat ID unik dari kebutuhan aset`)
    const missing=shot.assetIds.filter(id=>typeof id!=='string'||!ids.has(id));if(missing.length)return fail(`${label}: ID aset ${String(missing[0]).slice(0,128)} tidak ada dalam kebutuhan aset`)
    for(const id of shot.assetIds)used.add(id)
    end=shot.endMs
  }
  if(end!==duration)return fail(`shot terakhir berakhir ${end} ms; batas rencana untuk klip ini ${duration} ms`)
  const unused=items.filter(scheduledItem).map(i=>i.id).filter(id=>!used.has(id));if(unused.length)return fail(`ID kebutuhan belum dipakai dalam shot: ${unused.slice(0,8).join(', ')}`)
  return structuredClone(v)
}
