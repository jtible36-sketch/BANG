/** Closed vocabulary for the automatic Cutout workflow, independent of the manual editor. */
export const BEAT_KINDS = ['hook','konteks','kronologi','penutup'] as const
export type BeatKind = typeof BEAT_KINDS[number]
export const MOTION_PATTERNS = ['pose-swap','slide-linear','hold','prop-reaction','camera-push'] as const
export type MotionPattern = typeof MOTION_PATTERNS[number]
export interface ShotOverlay { type: 'year'|'name'|'label'; text: string }
export interface ShotPlacement { layerId:string; x:number; y:number; scale:number; rotation:number; visible:boolean; reason:string }
export const SHOT_PLACEMENT_SCHEMA={type:'array',maxItems:256,items:{type:'object',additionalProperties:false,required:['layerId','x','y','scale','rotation','visible','reason'],properties:{layerId:{type:'string'},x:{type:'number',minimum:0,maximum:1},y:{type:'number',minimum:0,maximum:1},scale:{type:'number',minimum:.05,maximum:3},rotation:{type:'number',minimum:-180,maximum:180},visible:{type:'boolean'},reason:{type:'string',minLength:1,maxLength:500}}}}
export function normalizeShotPlacements(raw:unknown):ShotPlacement[] {
 if(raw===undefined)return []
 if(!Array.isArray(raw)||raw.length>256)throw Error('Tata letak shot tidak valid.')
 const ids=new Set<string>();return raw.map(p=>{
 if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['layerId','x','y','scale','rotation','visible','reason'].includes(k))||typeof p.layerId!=='string'||!p.layerId||ids.has(p.layerId)||![p.x,p.y,p.scale,p.rotation].every(Number.isFinite)||p.x<0||p.x>1||p.y<0||p.y>1||p.scale<.05||p.scale>3||Math.abs(p.rotation)>180||typeof p.visible!=='boolean'||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>500)throw Error('Posisi/skala/pengecualian layer shot tidak valid; alasan wajib.')
 ids.add(p.layerId);return {...p}
 })
}
export interface CutoutShot {
  id: string; clipId: string; startMs: number; endMs: number; beat: BeatKind
  action: string; movers: string[]; startPose: string; endPose: string
  placements?: ShotPlacement[]; motionPattern: MotionPattern; overlays: ShotOverlay[]; narrationCue: string; sfxCue?: string
}
const text={type:'string',minLength:1,maxLength:800}
export const SHOT_OVERLAY_SCHEMA={type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['type','text'],properties:{type:{type:'string',enum:['year','name','label']},text:{type:'string',minLength:1,maxLength:120}}}}
export const CUTOUT_SHOT_SCHEMA={type:'object',additionalProperties:false,required:['id','clipId','startMs','endMs','beat','action','movers','startPose','endPose','motionPattern','overlays','narrationCue'],properties:{placements:SHOT_PLACEMENT_SCHEMA,id:text,clipId:text,startMs:{type:'number',minimum:0},endMs:{type:'number',minimum:1},beat:{type:'string',enum:BEAT_KINDS},action:text,movers:{type:'array',maxItems:2,items:text},startPose:text,endPose:text,motionPattern:{type:'string',enum:MOTION_PATTERNS},overlays:SHOT_OVERLAY_SCHEMA,narrationCue:text,sfxCue:{anyOf:[text,{type:'null'}]}}}
/** One response describes one fixed shot; no layer list, raw transforms or free keyframes. */
export const CODEX_SHOT_EDIT_PLAN_SCHEMA={type:'object',additionalProperties:false,required:['summary','motionPattern','movers','startPose','endPose','overlays','placements'],properties:{placements:SHOT_PLACEMENT_SCHEMA,summary:{type:'string',maxLength:2000},motionPattern:{type:'string',enum:MOTION_PATTERNS},movers:{type:'array',maxItems:2,items:{type:'string'}},startPose:text,endPose:text,overlays:SHOT_OVERLAY_SCHEMA}}
export function normalizeShotOverlays(raw: unknown): ShotOverlay[] {
  if(!Array.isArray(raw)||raw.length>3)throw new Error('Shot memuat maksimal 3 label teks.')
  return raw.map(v=>{
    if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['type','text'].includes(k))||!['year','name','label'].includes(v.type)||typeof v.text!=='string'||!v.text.trim()||v.text.length>120)throw new Error('Label shot tidak valid; gunakan year, name, atau label dengan teks 1–120 karakter.')
    return {type:v.type,text:v.text.trim()}
  })
}
export function normalizeShotMetadata(raw: unknown): CutoutShot[] {
  if(!Array.isArray(raw)||raw.length>24)throw new Error('Komposisi memuat maksimal 24 shot.')
  const ids=new Set<string>();let end=0
  return raw.map(v=>{
    if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['id','clipId','startMs','endMs','beat','action','movers','startPose','endPose','motionPattern','overlays','narrationCue','sfxCue','placements'].includes(k)))throw new Error('Format shot tidak valid.')
    for(const k of ['id','clipId','action','startPose','endPose','narrationCue'])if(typeof v[k]!=='string'||!v[k].trim()||v[k].length>800)throw new Error(`Shot.${k} wajib teks yang valid.`)
    if(ids.has(v.id))throw new Error('ID shot harus unik.');ids.add(v.id)
    if(!Number.isFinite(v.startMs)||!Number.isFinite(v.endMs)||v.startMs!==end||v.endMs<=v.startMs||v.endMs>86_400_000)throw new Error('Shot harus menyambung tepat dari 0 sampai akhir klip tanpa celah/tumpang tindih.')
    end=v.endMs
    if(!BEAT_KINDS.includes(v.beat)||!MOTION_PATTERNS.includes(v.motionPattern))throw new Error('Beat atau pola gerak shot tidak dikenal.')
    if(!Array.isArray(v.movers)||v.movers.length>2||new Set(v.movers).size!==v.movers.length||v.movers.some((x:unknown)=>typeof x!=='string'||!x))throw new Error('Shot maksimal 2 layer mover yang unik.')
    if(v.sfxCue===null)delete v.sfxCue
    if(v.sfxCue!==undefined&&(typeof v.sfxCue!=='string'||v.sfxCue.length>800))throw new Error('Cue SFX shot tidak valid.')
    return {...v,...(v.placements===undefined?{}:{placements:normalizeShotPlacements(v.placements)}),overlays:normalizeShotOverlays(v.overlays),movers:[...v.movers]} as CutoutShot
  })
}
