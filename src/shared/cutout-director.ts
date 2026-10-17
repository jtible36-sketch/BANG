/** A saved directing blueprint. Asset IDs refer to planned items, not generated files. */
export interface CutoutShotDirection {
  startMs: number; endMs: number; narrationCue: string; action: string; location: string; focus: string
  startPose: string; endPose: string; reaction: string; camera: 'wide'|'medium'|'detail'|'reaction'
  occlusion: string; contact: string; sfxCue: string; assetIds: string[]
}
export interface CutoutDirector { timing: 'recorded'|'provisional'; shots: CutoutShotDirection[]; specialAssets: string[] }
const text={type:'string',minLength:1,maxLength:800}
const shotProperties={startMs:{type:'integer',minimum:0},endMs:{type:'integer',minimum:1},narrationCue:text,action:text,location:text,focus:text,startPose:text,endPose:text,reaction:text,camera:{type:'string',enum:['wide','medium','detail','reaction']},occlusion:text,contact:text,sfxCue:text,assetIds:{type:'array',minItems:1,maxItems:256,items:{type:'string'}}}
export const CUTOUT_DIRECTOR_SCHEMA={type:'object',additionalProperties:false,required:['timing','shots','specialAssets'],properties:{timing:{type:'string',enum:['recorded','provisional']},shots:{type:'array',minItems:1,maxItems:24,items:{type:'object',additionalProperties:false,required:Object.keys(shotProperties),properties:shotProperties}},specialAssets:{type:'array',maxItems:24,items:text}}}

/** Voice-sync durations are frame aligned (e.g. 100 frames / 30 fps), hence fractional ms.
 * Only the directing JSON uses integer milliseconds; never round the saved clip or voice. */
export function cutoutDirectorDurationMs(durationMs: number): number {
  if(!Number.isFinite(durationMs)||durationMs<1||durationMs>86_400_000)throw new Error('Durasi klip untuk penyutradaraan tidak valid.')
  // Floor keeps every planned integer key inside the exact (fractional) timeline.
  return Math.floor(durationMs)
}
export function cutoutDirectorSchema(durationMs: number) {
  const end=cutoutDirectorDurationMs(durationMs)
  return {...CUTOUT_DIRECTOR_SCHEMA,properties:{...CUTOUT_DIRECTOR_SCHEMA.properties,shots:{...CUTOUT_DIRECTOR_SCHEMA.properties.shots,items:{...CUTOUT_DIRECTOR_SCHEMA.properties.shots.items,properties:{...shotProperties,startMs:{type:'integer',minimum:0,maximum:end-1},endMs:{type:'integer',minimum:1,maximum:end}}}}}}
}

export function normalizeCutoutDirector(raw: unknown,durationMs: number,items: {id:string}[],hasWordTiming: boolean): CutoutDirector {
  const fail=(reason: string):never=>{throw new Error(`Rencana penyutradaraan tidak valid: ${reason}.`)}
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
    for(const key of ['narrationCue','action','location','focus','startPose','endPose','reaction','occlusion','contact','sfxCue'] as const)if(!str(shot[key]))return fail(`${label}.${key} harus teks 1–800 karakter`)
    if(!['wide','medium','detail','reaction'].includes(shot.camera))return fail(`${label}: kamera harus wide, medium, detail atau reaction`)
    if(!Array.isArray(shot.assetIds)||!shot.assetIds.length||shot.assetIds.length>256||new Set(shot.assetIds).size!==shot.assetIds.length)return fail(`${label}: assetIds harus memuat ID unik dari kebutuhan aset`)
    const missing=shot.assetIds.filter(id=>typeof id!=='string'||!ids.has(id));if(missing.length)return fail(`${label}: ID aset ${String(missing[0]).slice(0,128)} tidak ada dalam kebutuhan aset`)
    for(const id of shot.assetIds)used.add(id)
    end=shot.endMs
  }
  if(end!==duration)return fail(`shot terakhir berakhir ${end} ms; batas rencana untuk klip ini ${duration} ms`)
  const unused=[...ids].filter(id=>!used.has(id));if(unused.length)return fail(`ID kebutuhan belum dipakai dalam shot: ${unused.slice(0,8).join(', ')}`)
  return structuredClone(v)
}
