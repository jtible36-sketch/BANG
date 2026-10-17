import { createHash } from 'node:crypto'
import type { ProjectSnapshot } from '@shared/types'
import { isCutoutReference, CUTOUT_CAPTION_DEFAULTS } from '@shared/cutout-reference-profile'
import { builtInMasterPrompts } from '@shared/master-prompts'
import { narrationWordCount } from '@shared/story-policy'
import { getDb } from './db'
import { duplicateProject, getBundle, saveSnapshot } from './repo'
import { ensureEditorsReady, getEditingContext, validateEditingPlan } from './editor-automation'

export interface ScriptRevisionInput {projectId:string;expectedRevision:string;title:string;clips:Array<{clipId:string;title:string;story:string;narration:string}>}

/** Explicit narration rewrites create a separate project; live source audio and edits stay intact. */
export async function createScriptRevision(input:ScriptRevisionInput):Promise<{projectId:string;revision:string;reused:boolean}> {
  const {projectId,expectedRevision,title,clips}=input
  if(typeof title!=='string'||!title.trim()||title.length>160||!Array.isArray(clips)||!clips.length||clips.length>500)throw new Error('Judul atau daftar revisi naskah tidak valid.')
  for(const c of clips)if(!c||typeof c.clipId!=='string'||typeof c.title!=='string'||!c.title.trim()||c.title.length>160||typeof c.story!=='string'||!c.story.trim()||c.story.length>10000||typeof c.narration!=='string'||!c.narration.trim()||c.narration.length>20000||Object.keys(c).some(k=>!['clipId','title','story','narration'].includes(k)))throw new Error('Isi revisi naskah tidak valid.')
  await ensureEditorsReady(projectId)
  validateEditingPlan(projectId,expectedRevision,{summary:'Memeriksa sumber sebelum membuat revisi naskah terpisah',clips:[]})
  const source=getBundle(projectId)
  if(!isCutoutReference(source.project))throw new Error('Revisi referensi ini hanya untuk preset Cutout · Fakta & Komedi.')
  if(source.jobs.some(j=>['queued','running'].includes(j.status)))throw new Error('Tunggu pekerjaan proyek selesai sebelum membuat revisi naskah.')
  const byId=new Map(clips.map(c=>[c.clipId,c]))
  if(byId.size!==clips.length||clips.length!==source.clips.length||source.clips.some(c=>!byId.has(c.id)))throw new Error('Revisi harus memetakan setiap klip sumber tepat sekali. Tidak ada klip atau aset sumber yang dihapus.')
  const key=createHash('sha256').update(JSON.stringify({projectId,expectedRevision,title,clips:source.clips.map(c=>byId.get(c.id))})).digest('hex')
  const db=getDb()
  db.exec('CREATE TABLE IF NOT EXISTS script_revisions (revision_key TEXT PRIMARY KEY, source_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, target_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE)')
  const existing=db.prepare('SELECT target_project_id FROM script_revisions WHERE revision_key=?').get(key) as {target_project_id:string}|undefined
  if(existing)return {projectId:existing.target_project_id,revision:getEditingContext(existing.target_project_id).revision,reused:true}
  const copy=duplicateProject(projectId),bundle=getBundle(copy.id)
  const master=builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!
  const snapshot:ProjectSnapshot={project:{...bundle.project,title:title.trim(),masterPrompt:structuredClone(master),step:2,editor:{...bundle.project.editor,...CUTOUT_CAPTION_DEFAULTS,overlays:[],sfx:[],autoSyncVoiceover:true}},characters:bundle.characters,clips:bundle.clips.map((c,i)=>{
    const next=byId.get(source.clips[i].id)!
    return {...c,title:next.title.trim(),story:next.story.trim(),narration:next.narration.trim(),durationMs:Math.max(100,Math.round(narrationWordCount(next.narration)/2.9*1000)),cutout:null,visualSource:null,transition:'cut',motionType:'camera',cameraPreset:'static',videoPrompt:''}
  })}
  db.transaction(()=>{
    // Existing recordings belong to the old words. Keep their assets, detach their clip links.
    db.prepare('UPDATE clips SET audio_asset_id=NULL, video_asset_id=NULL WHERE project_id=?').run(copy.id)
    saveSnapshot(snapshot)
    db.prepare('INSERT INTO script_revisions(revision_key,source_project_id,target_project_id) VALUES(?,?,?)').run(key,projectId,copy.id)
  })()
  return {projectId:copy.id,revision:getEditingContext(copy.id).revision,reused:false}
}
