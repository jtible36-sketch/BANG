import {createHash} from 'node:crypto'
import {getDb} from './db'
export function productionCheckKey(value:unknown):string{return createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function table(){getDb().exec('CREATE TABLE IF NOT EXISTS cutout_production_checks (project_id TEXT NOT NULL,clip_id TEXT NOT NULL,cache_key TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,result_json TEXT,PRIMARY KEY(project_id,clip_id))')}
export function saveProductionCheck(projectId:string,clipId:string,key:string,status:'approved'|'blocked',reason:string,result?:unknown):void{table();getDb().prepare('INSERT OR REPLACE INTO cutout_production_checks VALUES (?,?,?,?,?,?)').run(projectId,clipId,key,status,reason,result?JSON.stringify(result):null)}
export function loadProductionCheck<T>(projectId:string,clipId:string,key:string):T|null{table();const r=getDb().prepare("SELECT result_json FROM cutout_production_checks WHERE project_id=? AND clip_id=? AND cache_key=? AND status='approved'").get(projectId,clipId,key) as {result_json:string}|undefined;return r?.result_json?JSON.parse(r.result_json):null}
