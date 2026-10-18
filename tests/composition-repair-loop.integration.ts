import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {closeDb} from '../src/main/db'
import {createProject,replaceScript,getBundle,getJob} from '../src/main/repo'
import {startCodexAutoEdit,getEditingContext,resumeCodexAutoEdit,recoverMissingAssets} from '../src/main/editor-automation'
import {cutoutAssetState} from '../src/main/cutout-assets'
import {cancelJob} from '../src/main/jobs'
import {builtInMasterPrompts} from '../src/shared/master-prompts'
import {DEFAULT_CUTOUT_PRODUCTION} from '../src/shared/cutout-production'
const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function done(id:string){for(let i=0;i<4000;i++){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await wait(20)}throw Error('Job timeout')}
async function check(name:string,run:()=>Promise<void>){await run();checks.push(name);console.log('PASS',name)}
function png(alpha:boolean){const bytes=Buffer.alloc(90*160*4);for(let y=0;y<160;y++)for(let x=0;x<90;x++){const n=(y*90+x)*4;bytes[n]=60;bytes[n+1]=160;bytes[n+2]=200;bytes[n+3]=alpha&&(x<8||x>81||y<8||y>151)?0:255}return nativeImage.createFromBitmap(bytes,{width:90,height:160}).toPNG()}
function project(count=1){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout',masterPrompt:builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!});replaceScript(p.id,'Loop',Array.from({length:count},(_,i)=>({title:'Klip '+(i+1),narration:'Tokoh menunjuk engsel pintu.',story:'Satu aksi menunjuk engsel.',durationMs:2000})));return p.id}
const production={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:32,maxNewAssets:10,motion:'keyframes' as const}
const approved={approved:true,problems:[],missingAssets:[]}
let reviews=0,repairs=0,compositions=0,conversions=0,images=0,scenario='problems',blocked=false
g.__progress=[]
const reset=(s:string)=>{reviews=0;repairs=0;compositions=0;conversions=0;images=0;scenario=s;blocked=false;g.__progress=[]}
g.__assetGenerate=async(o:any)=>{images++;if(scenario==='cancel'&&o.prompt.includes('Asset: Tambahan')){blocked=true;await new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('canceled fixture')),{once:true}))}return {bytes:png(!o.prompt.includes('Role: background'))}}
g.__assetPlan=async(o:any)=>{
 if(o.schema?.properties?.approved){
  reviews++;assert(o.images.every((p:string)=>existsSync(p)));await wait(280)
  if(scenario==='problems')return reviews<4?{approved:false,problems:['Pelanggaran gerak '+reviews],missingAssets:[]}:approved
  if(scenario==='mixed')return reviews===1?{approved:false,problems:['Pintu tidak tampak'],missingAssets:['Pintu samping transparan']}:reviews===2?{approved:false,problems:['Tiga layer bergerak'],missingAssets:[]}:reviews===3?{approved:false,problems:['Reaksi belum tampak'],missingAssets:['Pose reaksi transparan']}:approved
  if(scenario==='terminal')return {approved:false,problems:['Masalah terakhir '+reviews],missingAssets:[]}
  if(scenario==='global')return reviews===2?approved:{approved:false,problems:['Objek belum ada'],missingAssets:['Objek tambahan '+reviews]}
  if(scenario==='resume')return approved
  return {approved:false,problems:['Komponen hilang'],missingAssets:['Komponen transparan']}
 }
 const p=JSON.parse(o.prompt)
 if(p.requests){conversions++;return {items:p.requests.map((r:any,i:number)=>({id:r.id,role:'prop',label:'Tambahan '+conversions+'-'+i,prompt:r.description+' isolated native alpha.',characterId:null,timeMs:0,layerKey:'addition-'+conversions+'-'+i}))}}
 if(p.original){repairs++;assert(o.images?.length>=3);assert(o.system.includes('Repair ONLY the supplied composition'));assert(o.system.includes('pose')||o.system.includes('Pose'));assert(o.system.includes('parent/IK/mask/parallax'));assert(o.system.includes('anak dari parent yang bergerak ikut dihitung'));return {...p.original,summary:'Perbaikan '+repairs,editor:null}}
 if(o.schema?.properties?.items){const items=[{id:'bg',role:'background',label:'Background',prompt:'Clean realistic plate without people.',characterId:null,timeMs:0,layerKey:'background'},{id:'actor',role:'character',label:'Tokoh',prompt:'Photographic pointing character with native alpha.',characterId:null,timeMs:0,layerKey:'actor'}];return {items,director:{timing:'provisional',shots:[{startMs:0,endMs:2000,narrationCue:'menunjuk',action:'menunjuk',location:'Toko',focus:'pintu',startPose:'menunjuk',endPose:'hold',reaction:'penasaran',camera:'medium',occlusion:'tidak diperlukan',contact:'tidak diperlukan',sfxCue:'tidak diperlukan',assetIds:['bg','actor']}],specialAssets:[]}}}
 compositions++;return {summary:'Komposisi '+compositions,clips:[{clipId:p.scope.clipId,cutout:p.seedComposition,transition:null,durationMs:null}],editor:null}
}
void app.whenReady().then(async()=>{
 await check('movement repair retries three times with actual frames, audit rules and N/3 progress',async()=>{
  reset('problems');const id=project(),job=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(job.status,'done',job.error??'');assert.equal(repairs,3);assert.equal(reviews,4);assert.equal(images,2);assert.equal(conversions,0);for(let n=1;n<=3;n++)assert(g.__progress.some((message:string)=>message?.includes('percobaan '+n+'/3')));assert(getBundle(id).clips[0].cutout?.enabled)
 })
 await check('missing assets, new motion problem and another missing asset are repaired in one bounded loop',async()=>{
  reset('mixed');const id=project(),job=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(job.status,'done',job.error??'');assert.equal(reviews,4);assert.equal(conversions,2);assert.equal(repairs,1);assert.equal(images,4);assert.equal(compositions,3);const b=getBundle(id);assert.equal(b.assets.length,4);assert.equal(b.clips[0].cutout?.layers.length,4);const plan=cutoutAssetState(b.clips[0].id).plan!;assert.equal(plan.items.length,4);assert.equal(plan.director!.shots[0].assetIds.length,4)
 })
 await check('three unsuccessful repairs stop and report the latest findings without applying any edit',async()=>{
  reset('terminal');const id=project(),job=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(job.status,'failed');assert.equal(repairs,3);assert.equal(reviews,4);assert.match(job.error!,/Masalah terakhir 4/);assert(!job.error!.includes('Masalah terakhir 1'));assert.equal(getBundle(id).clips[0].cutout,null);assert.equal(getEditingContext(id).missingAssetRecovery,null)
 })
 await check('image budget counts initial generation and repairs across clips, stopping before another image request',async()=>{
  reset('global');const id=project(2),job=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production:{...production,maxNewAssets:5}}).id);assert.equal(job.status,'failed');assert.match(job.error!,/5\/5 gambar/);assert.equal(images,5);assert.equal(conversions,1);assert.equal(reviews,3);const b=getBundle(id);assert(b.clips.every(c=>c.cutout===null));assert.equal(getEditingContext(id).missingAssetRecovery?.clipId,b.clips[1].id);assert.equal(cutoutAssetState(b.clips[1].id).plan!.items.length,2)
 })
 await check('zero remaining image budget preserves findings and resume reuses every completed image',async()=>{
  reset('budget');const id=project(),first=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production:{...production,maxNewAssets:2}}).id);assert.equal(first.status,'failed');assert.equal(images,2);assert.equal(conversions,0);assert.match(first.error!,/Batas gambar per proses/);const ids=getBundle(id).assets.map(a=>a.id).sort();scenario='resume';closeDb();const next=await done(resumeCodexAutoEdit(id,first.id).id);assert.equal(next.status,'done',next.error??'');assert.equal(images,2);assert.deepEqual(getBundle(id).assets.map(a=>a.id).sort(),ids)
 })
 await check('canceling an automatic missing-asset repair aborts its child and retains completed initial assets',async()=>{
  reset('cancel');const id=project(),job=startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production});for(let i=0;i<1000&&!blocked;i++)await wait(10);assert(blocked);await cancelJob(job.id);const ended=await done(job.id);assert.equal(ended.status,'canceled');assert.equal(getBundle(id).clips[0].cutout,null);assert.equal(getBundle(id).assets.length,2);assert.equal(images,3);assert.equal(conversions,1)
 })
 await check('one-click recovery submissions also consume the same process image budget',async()=>{
  reset('budget');const id=project(),first=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production:{...production,maxNewAssets:2}}).id);assert.equal(first.status,'failed');assert.equal(images,2)
  const recovery=await recoverMissingAssets({projectId:id,jobId:first.id,provider:'codex',format:'png',maxNewAssets:1});assert.equal(recovery.kind,'started');if(recovery.kind!=='started')return
  const end=await done(recovery.job.id);assert.equal(end.status,'failed');assert.match(end.error!,/1\/1 gambar/);assert.equal(images,3);assert.equal(conversions,1);assert.equal(getBundle(id).assets.length,3)
 })
 const result={status:'passed',checks,actualElectron:true,actualSQLite:true,actualCanvas:true,providerResponses:'controlled; no external generation',userDatabaseChanged:false};writeFileSync(join(root,'composition-repair-loop-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
