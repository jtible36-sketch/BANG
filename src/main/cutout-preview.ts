import {composeCutoutPreview,assertNoPreviewPlaceholders,type CutoutClipPreview} from '@shared/cutout-preview'
import type {ProjectBundle} from '@shared/types'
import {getBundle} from './repo'
import {getDb} from './db'
import {cutoutAssetState} from './cutout-assets'
function table(){getDb().exec('CREATE TABLE IF NOT EXISTS cutout_clip_previews (project_id TEXT NOT NULL,clip_id TEXT NOT NULL,kind TEXT NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(project_id,clip_id))')}
export function previewCutoutClip(projectId:string,clipId:string):CutoutClipPreview {const b=getBundle(projectId);if(b.project.styleId!=='cutout-facts'||!b.clips.some(c=>c.id===clipId))throw Error('Pilih klip Cutout yang ada di proyek ini.');const result=composeCutoutPreview(b,clipId,cutoutAssetState(clipId));table();getDb().prepare('INSERT OR REPLACE INTO cutout_clip_previews VALUES (?,?,?,?)').run(projectId,clipId,'preview',JSON.stringify(result));return result}
export function assertFinalCutoutPreviewReady(bundle:ProjectBundle):void {
 if(bundle.project.styleId!=='cutout-facts')return;assertNoPreviewPlaceholders(bundle)
 // Inspect only, never create tables or turn a preview into a completed production outcome.
 if(!getDb().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cutout_clip_previews'").get())return
 for(const c of bundle.clips.filter(c=>!c.cutout?.enabled&&!c.videoAssetId)){const row=getDb().prepare('SELECT result_json FROM cutout_clip_previews WHERE project_id=? AND clip_id=?').get(bundle.project.id,c.id) as {result_json:string}|undefined;if(row&&JSON.parse(row.result_json).placeholders?.length)throw Error('Klip '+c.title+' masih berupa pratinjau berplaceholder. Lengkapi aset dan jalankan edit otomatis klip ini sebelum ekspor final.')}
}
