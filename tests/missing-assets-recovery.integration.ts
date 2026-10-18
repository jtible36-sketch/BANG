import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {closeDb} from '../src/main/db'
import {createProject,replaceScript,getBundle,getJob,getJobRaw,patchClip} from '../src/main/repo'
import {recordCompositionRejection} from '../src/main/cutout-review-recovery'
import {getEditingContext,startCodexAutoEdit,recoverMissingAssets} from '../src/main/editor-automation'
import {cutoutAssetState,appendCutoutRecoveryItems} from '../src/main/cutout-assets'
import {DEFAULT_CUTOUT_PRODUCTION} from '../src/shared/cutout-production'
import {builtInMasterPrompts} from '../src/shared/master-prompts'
const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const check=async(name:string,run:()=>unknown|Promise<unknown>)=>{await run();checks.push(name);console.log('PASS',name)}
const options={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:12,maxNewAssets:2,motion:'keyframes' as const}
function png(alpha=false){const b=Buffer.alloc(90*160*4);for(let y=0;y<160;y++)for(let x=0;x<90;x++){let i=(y*90+x)*4;b[i]=100;b[i+1]=140;b[i+2]=200;b[i+3]=alpha&&(x<10||x>79||y<10||y>149)?0:255}return nativeImage.createFromBitmap(b,{width:90,height:160}).toPNG()}
async function done(id:string){for(let i=0;i<3000;i++){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,20))}throw Error('timeout')}
function project(){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout',masterPrompt:builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!});replaceScript(p.id,'Pintu troli',[{title:'Pintu',story:'Tokoh menunjuk pintu berengsel.',narration:'Pintu ini membuka ketika troli masuk.',durationMs:2000}]);return p.id}
const descriptions=['Properti pintu berengsel tampak samping dengan alpha nyata','Pose tangan menunjuk engsel dengan identitas tokoh yang sama']
let generated:string[]=[],conversions=0,reviews=0,pass=false,failOne=false,release:(()=>void)|null=null,block=false
g.__assetGenerate=async(o:any)=>{generated.push(o.prompt);if(block&&o.prompt.includes('Asset: Pintu tambahan.'))await new Promise<void>(resolve=>{release=resolve});if(failOne&&o.prompt.includes('Asset: Pintu tambahan.'))throw Error('fixture provider failure');return {bytes:png(!o.prompt.includes('Role: background'))}}
g.__assetPlan=async(o:any)=>{
 if(o.schema?.properties?.approved){reviews++;assert(o.images.every((p:string)=>existsSync(p)));return pass?{approved:true,problems:[],missingAssets:[]}:{approved:false,problems:['Pintu/pose belum mendukung penjelasan.'],missingAssets:descriptions}}
 const p=JSON.parse(o.prompt)
 if(p.requests){conversions++;return {items:p.requests.map((r:any,i:number)=>({id:r.id,role:'prop',label:i?'Tangan tambahan':'Pintu tambahan',prompt:r.description+'; isolated asset in matching light.',characterId:null,timeMs:0,layerKey:'repair-'+i}))}}
 if(o.schema?.properties?.items){const items=[{id:'bg',role:'background',label:'Toko kosong',prompt:'Historical shop clean plate without people.',characterId:null,timeMs:0,layerKey:'bg'},{id:'actor',role:'character',label:'Tokoh',prompt:'Photographic pointing character isolated with alpha.',characterId:null,timeMs:0,layerKey:'actor'}];return {items,director:{timing:'provisional',shots:[{startMs:0,endMs:2000,narrationCue:'Pintu membuka',action:'menunjuk',location:'Toko',focus:'engsel',startPose:'menunjuk',endPose:'hold',reaction:'penasaran',camera:'medium',occlusion:'tidak ada',contact:'tidak diperlukan',sfxCue:'tidak diperlukan',assetIds:['bg','actor']}],specialAssets:[]}}}
 return {summary:'Susunan uji',clips:[{clipId:p.scope.clipId,cutout:p.seedComposition,transition:null,durationMs:null}],editor:null}
}
void app.whenReady().then(async()=>{
 let id='',firstId='',failedRecoveryId='',planId='',oldAssetIds:string[]=[],confirmation:any
 await check('review rejection is structured, persisted, and recoverable after SQLite reopen',async()=>{
  id=project();const first=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production:options}).id);assert.equal(first.status,'failed');firstId=first.id;const context=getEditingContext(id);assert.deepEqual(context.missingAssetRecovery?.missingAssets,descriptions);assert.equal(context.missingAssetRecovery?.remaining,2);oldAssetIds=getBundle(id).assets.map(a=>a.id);planId=cutoutAssetState(getBundle(id).clips[0].id).plan!.id;closeDb();assert.equal(getEditingContext(id).missingAssetRecovery?.jobId,first.id)
 })
 await check('over-budget needs confirmation before planning or submitting images; wrong token does not bypass',async()=>{
  const count=generated.length;const input={projectId:id,jobId:firstId,provider:'codex' as const,format:'webp' as const,maxNewAssets:1};confirmation=await recoverMissingAssets(input);assert.equal(confirmation.kind,'confirmation-required');assert.equal(confirmation.count,2);assert.equal(conversions,0);assert.equal(generated.length,count);const wrong=await recoverMissingAssets({...input,confirmationToken:'wrong',confirmedCount:2});assert.equal(wrong.kind,'confirmation-required');assert.equal(generated.length,count)
 })
 await check('one failed asset does not stop the next; provider/format, plan ID and completed assets survive',async()=>{
  failOne=true;const started=await recoverMissingAssets({projectId:id,jobId:firstId,provider:'codex',format:'webp',maxNewAssets:1,confirmationToken:confirmation.token,confirmedCount:2});assert.equal(started.kind,'started');if(started.kind!=='started')return;const failed=await done(started.job.id);failedRecoveryId=failed.id;assert.equal(failed.status,'failed');assert.match(failed.error!,/1\/2 aset baru selesai/);assert.equal(conversions,1);assert.equal(generated.length,4);const b=getBundle(id);assert.equal(b.assets.length,3);assert(oldAssetIds.every(a=>b.assets.some(x=>x.id===a)));assert.equal(b.clips[0].cutout,null);assert(b.assets.some(a=>a.localPath.endsWith('.webp')));assert.equal(cutoutAssetState(b.clips[0].id).plan!.id,planId);assert.equal(getEditingContext(id).missingAssetRecovery?.remaining,1)
 })
 await check('retry generates only unfinished item, deduplicates double click, then recomposes and reviews automatically',async()=>{
  closeDb();failOne=false;pass=true;block=true;const input={projectId:id,jobId:failedRecoveryId,provider:'codex' as const,format:'webp' as const,maxNewAssets:1};const started=await recoverMissingAssets(input);assert.equal(started.kind,'started');if(started.kind!=='started')return;const duplicate=await recoverMissingAssets(input);assert.equal(duplicate.kind,'started');if(duplicate.kind==='started')assert.equal(duplicate.job.id,started.job.id);for(let i=0;i<300&&!release;i++)await new Promise(r=>setTimeout(r,10));assert(release);release!();const next=await done(started.job.id);assert.equal(next.status,'done',next.error??'');assert.equal(conversions,1);assert.equal(generated.length,5);assert(reviews>=2);const b=getBundle(id);assert.equal(b.assets.length,4);assert.equal(b.clips[0].cutout?.layers.length,4);assert.equal(getEditingContext(id).missingAssetRecovery,null);assert.equal(cutoutAssetState(b.clips[0].id).plan!.id,planId);assert.equal(cutoutAssetState(b.clips[0].id).plan!.items.length,4);assert(oldAssetIds.every(a=>b.assets.some(x=>x.id===a)));block=false
 })
 await check('changed narrative invalidates a saved rejection and budget confirmation before image submission',async()=>{
  pass=false;const p=project(),first=await done(startCodexAutoEdit({projectId:p,instruction:'Satu aksi.',production:options}).id);const request={projectId:p,jobId:first.id,provider:'codex' as const,format:'png' as const,maxNewAssets:1};const preflight=await recoverMissingAssets(request);assert.equal(preflight.kind,'confirmation-required');const clip=getBundle(p).clips[0];patchClip(clip.id,{narration:'Narasi berubah.'});const count=generated.length;await assert.rejects(recoverMissingAssets({...request,...(preflight.kind==='confirmation-required'?{confirmationToken:preflight.token,confirmedCount:preflight.count}:{})}),/terbaru|berubah|sesuai/);assert.equal(generated.length,count);assert.equal(getEditingContext(p).missingAssetRecovery,null)
 })
 await check('append helper is idempotent, retains all shot coverage and rejects a changed item',()=>{
  const b=getBundle(id),clip=b.clips[0],plan=cutoutAssetState(clip.id).plan!,item=plan.items[2];assert.equal(appendCutoutRecoveryItems(clip.id,plan.id,plan.sourceHash,[item]).id,plan.id);assert.equal(cutoutAssetState(clip.id).plan!.items.length,4);assert.throws(()=>appendCutoutRecoveryItems(clip.id,plan.id,plan.sourceHash,[{...item,prompt:'Changed'}]),/berbeda/);assert(plan.director!.shots[0].assetIds.includes(item.id));assert.equal(plan.director!.shots[0].endMs,2000)
 })
 await check('a later review without missing assets clears obsolete recovery details',async()=>{
  const p=project(),failed=await done(startCodexAutoEdit({projectId:p,instruction:'Tinjau komposisi.',production:options}).id)
  assert(getEditingContext(p).missingAssetRecovery)
  const rejection=JSON.parse(String(getJobRaw(failed.id)!.payload_json)).compositionRejection
  recordCompositionRejection(failed.id,{...rejection,missingAssets:[]})
  assert.equal(getEditingContext(p).missingAssetRecovery,null)
 })
 const result={status:'passed',checks,actualElectron:true,actualSQLite:true,actualCanvas:true,actualWebp:true,providers:'controlled; no external generation',userProjectsChanged:false};writeFileSync(join(root,'missing-assets-recovery-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
