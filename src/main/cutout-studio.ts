import {availableCutoutAssets} from '@shared/cutout-orphans'
import {cutoutGroupKey,groupMotion} from '@shared/cutout-plan-diagnostics'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {canonicalLocationKey,migrateCutoutPlan,preflightCutout,type SceneBrief,type ClipPreflight} from '@shared/cutout-permanent'
import {type ComedyJoltProfile} from '@shared/comedy-jolt'
import {emit} from './events'
import {getDb} from './db'
import {getBundle,getClip,getJob} from './repo'
import {cutoutAssetState} from './cutout-assets'
import {generatedForItem} from '@shared/cutout-production'
function tables(){getDb().exec('CREATE TABLE IF NOT EXISTS cutout_scene_briefs (clip_id TEXT PRIMARY KEY,brief_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cutout_credit_consents (clip_id TEXT NOT NULL,item_id TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(clip_id,item_id)); CREATE TABLE IF NOT EXISTS cutout_clip_outcomes (project_id TEXT NOT NULL,clip_id TEXT NOT NULL,job_id TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,result_json TEXT,PRIMARY KEY(project_id,clip_id))')}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function readStudioBriefs(projectId:string):Record<string,SceneBrief>{tables();const b=getBundle(projectId),out:Record<string,SceneBrief>={};for(const c of b.clips){const r=getDb().prepare('SELECT brief_json FROM cutout_scene_briefs WHERE clip_id=?').get(c.id) as {brief_json:string}|undefined;if(r)try{out[c.id]=JSON.parse(r.brief_json)}catch{}}return out}
export function studioReport(projectId:string):ClipPreflight[]{const b=getBundle(projectId);if(b.project.styleId!=='cutout-facts')return [];return preflightCutout(b,Object.fromEntries(b.clips.map(c=>[c.id,cutoutAssetState(c.id)])),readStudioBriefs(projectId))}
export function saveSceneBrief(projectId:string,clipId:string,raw:SceneBrief):SceneBrief {
 const b=getBundle(projectId),c=b.clips.find(c=>c.id===clipId);if(!c||b.project.styleId!=='cutout-facts')throw Error('Klip bukan proyek Cutout ini.')
 const current=studioReport(projectId).find(r=>r.clipId===clipId)!.brief
 if(!raw||raw.version!==1||raw.clipId!==clipId||raw.source!==current.source||typeof raw.approved!=='boolean'||typeof raw.locationCertain!=='boolean'||![raw.era,raw.location,raw.timeWeather,raw.wardrobe,raw.reason].every(s=>typeof s==='string'&&!!s.trim()&&s.length<12000)||!Array.isArray(raw.characters)||raw.characters.some(id=>!b.characters.some(c=>c.id===id))||!Array.isArray(raw.props)||raw.props.some(s=>typeof s!=='string'||s.length>300))throw Error('Scene Brief tidak valid atau sumber narasi berubah.')
 if(raw.approved&&(!raw.locationCertain||/lokasi-tidak-pasti|belum ditetapkan/i.test(raw.location+' '+raw.era)))throw Error('Tentukan lokasi dan era secara eksplisit sebelum menyetujui; lokasi tidak diwariskan diam-diam.')
 if(raw.approved&&current.characterProposal&&!raw.characters.length)throw Error('Pilih/tambah tokoh proyek sebelum persetujuan. Identity sheet tidak dibuat otomatis.')
 const result={...raw,evidence:[...current.evidence,...(raw.location!==current.location||raw.era!==current.era?[{field:'editorial decision',quote:raw.reason,startWord:null,endWord:null,startMs:null,endMs:null,source:'proposal' as const}]:[])],warnings:current.warnings,...(raw.characters.length?{characterProposal:undefined}:{})};tables();getDb().prepare('INSERT OR REPLACE INTO cutout_scene_briefs VALUES (?,?)').run(clipId,JSON.stringify(result));return result
}
export function requireBriefApproved(clipId:string):SceneBrief {const c=getClip(clipId),row=studioReport(c.projectId).find(r=>r.clipId===clipId);if(!row?.brief.approved)throw Error('Scene Brief belum disetujui. Tinjau era, lokasi, tokoh, pakaian dan properti di Visual dahulu; belum ada kredit dipakai.');return row.brief}
/** Explicit user click after a concrete plan is shown. A new plan/item/brief invalidates consent. */
export function approveAssetCredits(projectId:string,clipId:string,planId:string,itemIds:string[]):{approved:number} {
 const c=getClip(clipId),state=cutoutAssetState(clipId);if(c.projectId!==projectId||!state.plan||state.stale||state.plan.id!==planId||!Array.isArray(itemIds)||!itemIds.length||itemIds.some(id=>!state.plan!.items.some(i=>i.id===id)))throw Error('Paket/ID persetujuan berubah; tinjau kembali.');const brief=requireBriefApproved(clipId);tables();for(const id of itemIds){const item=state.plan.items.find(i=>i.id===id)!;getDb().prepare('INSERT OR REPLACE INTO cutout_credit_consents VALUES (?,?,?)').run(clipId,id,digest([planId,item,brief.source,brief]))}return {approved:itemIds.length}
}
export function requireAssetConsent(clipId:string,planId:string,itemId:string):void {
 const c=getClip(clipId),b=getBundle(c.projectId);if(b.project.styleId!=='cutout-facts')return
 const state=cutoutAssetState(clipId),item=state.plan?.items.find(i=>i.id===itemId);if(!item||state.plan?.id!==planId||state.stale)throw Error('Rencana berubah sebelum konfirmasi.');if(generatedForItem(b.assets,state.plan,itemId))return
 const brief=requireBriefApproved(clipId);tables();const r=getDb().prepare('SELECT fingerprint FROM cutout_credit_consents WHERE clip_id=? AND item_id=?').get(clipId,itemId) as {fingerprint:string}|undefined;if(r?.fingerprint!==digest([planId,item,brief.source,brief]))throw Error('Konfirmasi kredit diperlukan untuk '+itemId+' · '+item.label+'. Tinjau Scene Brief dan daftar aset di Visual; belum ada gambar dikirim.')
}
export function upgradeStudioPlan(clipId:string,options?:{motionProfile:'png-impact'}){const c=getClip(clipId),b=getBundle(c.projectId),state=cutoutAssetState(clipId);if(b.project.styleId!=='cutout-facts'||!state.plan||state.stale)throw Error('Paket valid belum tersedia.');if(b.jobs.some(j=>['queued','running'].includes(j.status)))throw Error('Tunggu/batalkan job sebelum perbarui rencana.');const plan=migrateCutoutPlan(state.plan);
 if(options?.motionProfile==='png-impact'){
  if(b.project.editor.cutoutV5?.motionProfile!=='png-impact')throw Error('Pilih dan simpan profil PNG masuk & getar dahulu.')
  const keys=[...new Set(plan.items.map(cutoutGroupKey))],moving=new Set(keys.filter(key=>groupMotion(plan.items.find(i=>cutoutGroupKey(i)===key)!,plan.items).value==='mover'))
  if(moving.size>2)throw Error('Paket memiliki lebih dari dua grup mover; perbaiki rencana dahulu.')
  for(const roles of [['character','pose'],['prop']]){
   if(keys.some(key=>moving.has(key)&&plan.items.some(i=>cutoutGroupKey(i)===key&&roles.includes(i.role))))continue
   const next=keys.find(key=>!moving.has(key)&&plan.items.some(i=>cutoutGroupKey(i)===key&&roles.includes(i.role))&&!plan.items.some(i=>cutoutGroupKey(i)===key&&['part','background','foreground'].includes(i.role)))
   if(next&&moving.size<2){moving.add(next);for(const i of plan.items.filter(i=>cutoutGroupKey(i)===next)){i.motionRole='mover';i.motionRoleSource='plan'}}
  }
  if(plan.director)for(const shot of plan.director.shots)shot.movers=keys.filter(key=>moving.has(key)&&plan.items.some(i=>cutoutGroupKey(i)===key&&shot.assetIds.includes(i.id)))
 }
 getDb().prepare('UPDATE cutout_asset_plans SET plan_json=? WHERE clip_id=?').run(JSON.stringify(plan),clipId);return plan}
function clipFingerprint(clipId:string):string {const c=getClip(clipId),p=cutoutAssetState(clipId).plan;return digest([c.narration,c.story,c.visualPrompt,c.durationMs,c.characterIds,p?.id,p?.items,getBundle(c.projectId).project.editor.cutoutV5])}
export function completedClipMatches(projectId:string,clipId:string):boolean {tables();const r=getDb().prepare("SELECT result_json FROM cutout_clip_outcomes WHERE project_id=? AND clip_id=? AND status='done'").get(projectId,clipId) as {result_json:string}|undefined;try{const data=JSON.parse(r?.result_json??'{}');return data.fingerprint===clipFingerprint(clipId)&&JSON.stringify(data.scene)===JSON.stringify(getClip(clipId).cutout)}catch{return false}}
export function writeClipOutcome(projectId:string,clipId:string,jobId:string,status:ClipPreflight['status'],reason:string,result?:unknown){tables();getDb().prepare('INSERT OR REPLACE INTO cutout_clip_outcomes VALUES (?,?,?,?,?,?)').run(projectId,clipId,jobId,status,reason,result?JSON.stringify({scene:result,fingerprint:clipFingerprint(clipId)}):null)}
export {readClipOutcomes} from './cutout-outcomes'
export function approvedBackgroundCandidates(projectId:string){const b=getBundle(projectId);return availableCutoutAssets(b).filter(a=>{const m=a.meta.cutoutAsset as any;return m?.role==='background'&&m.review==='approved'}).map(a=>({assetId:a.id,locationKey:canonicalLocationKey(String((a.meta.cutoutAsset as any).locationKey??''),b.project.editor.cutoutV5?.locationAliases),review:'approved'}))}
export function loadComedyProfile():ComedyJoltProfile {const profile=JSON.parse(readFileSync(join(process.cwd(),'profiles','comedy-jolt.json'),'utf8')) as ComedyJoltProfile;return profile}
export function studioJobHistory(projectId:string,clipId:string){const c=getClip(clipId);if(c.projectId!==projectId)throw Error('Klip asing.');return (getDb().prepare('SELECT id FROM jobs WHERE project_id=? AND clip_id=? ORDER BY created_at DESC LIMIT 200').all(projectId,clipId) as {id:string}[]).map(r=>getJob(r.id)).filter(Boolean)}
export function reviewStudioAsset(projectId:string,assetId:string,approved:boolean){const b=getBundle(projectId),a=b.assets.find(a=>a.id===assetId);if(b.project.styleId!=='cutout-facts'||!a?.meta.cutoutAsset||typeof approved!=='boolean')throw Error('Pilih aset Cutout proyek ini.');const next={...a,meta:{...a.meta,cutoutAsset:{...(a.meta.cutoutAsset as object),review:approved?'approved':'needs-review'}}};getDb().prepare('UPDATE assets SET meta_json=? WHERE id=? AND project_id=?').run(JSON.stringify(next.meta),assetId,projectId);emit.asset(next);return next}
export function consumeAssetConsent(clipId:string,itemId:string){tables();getDb().prepare('DELETE FROM cutout_credit_consents WHERE clip_id=? AND item_id=?').run(clipId,itemId)}
