import {getDb} from './db'
import type {ClipProductionStatus} from '@shared/cutout-permanent'
/** MCP read tools must not create tables or load provider/runtime modules. */
export function readClipOutcomes(projectId:string):{clipId:string;jobId:string;status:ClipProductionStatus;reason:string}[]{
 const db=getDb();if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cutout_clip_outcomes'").get())return []
 return (db.prepare('SELECT clip_id,job_id,status,reason FROM cutout_clip_outcomes WHERE project_id=?').all(projectId) as {clip_id:string;job_id:string;status:ClipProductionStatus;reason:string}[]).map(r=>({clipId:r.clip_id,jobId:r.job_id,status:r.status,reason:r.reason}))
}
