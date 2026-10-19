import {insertJob} from '../src/main/repo'
import {runJob,cancelAbandonedCutoutJobs,isActive} from '../src/main/jobs'
import {resumeJobs} from '../src/main/generation'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {cutoutOrphans,availableCutoutAssets} from '../src/shared/cutout-orphans'
import {orphanAssetReport,linkOrphanAsset,archiveOrphanAsset} from '../src/main/cutout-orphans'
import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {createProject,replaceScript,getBundle,getJob,insertAsset,patchClip} from '../src/main/repo'
import {getDb,closeDb} from '../src/main/db'
import {saveCutoutAssetPlan,cutoutAssetState,generateCutoutAsset,reusableCutoutBackground} from '../src/main/cutout-assets'
import {startCodexAutoEdit} from '../src/main/editor-automation'
import {studioReport,saveSceneBrief,approveAssetCredits,requireAssetConsent,upgradeStudioPlan,readClipOutcomes,completedClipMatches} from '../src/main/cutout-studio'
import {assetAbsPath} from '../src/main/paths'
import {generateVisualCutoutBatch} from '../src/main/cutout-visual'
const out=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[];mkdirSync(out,{recursive:true});app.setPath('userData',join(out,'isolated'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
async function done(id:string){for(let n=0;n<2400;n++){const j=getJob(id)!;if(!['queued','running'].includes(j.status))return j;await new Promise(r=>setTimeout(r,25))}throw Error('Job timeout')}
async function test(name:string,fn:()=>unknown|Promise<unknown>){await fn();checks.push(name);console.log('PASS '+name)}
function make(count=1){const p=createProject({styleId:'cutout-facts',aspectRatio:'9:16'});replaceScript(p.id,'Fixture',Array.from({length:count},(_,i)=>({title:'Klip '+i,narration:'Pada 1824 di Arktik, palu diam.',story:'One held tool, no character required.',visualPrompt:'A hammer and empty deck.',durationMs:3033.333333})));getDb().prepare('UPDATE projects SET editor_json=? WHERE id=?').run(JSON.stringify({...p.editor,autoSyncVoiceover:false,captionStyle:'none'}),p.id);return getBundle(p.id)}
function seed(projectId:string,clipId:string,omit?:string){const plan=saveCutoutAssetPlan(clipId,[{id:'bg',role:'background',layerKey:'old_bg',motionRole:'static',locationKey:'1824-1825_dek-kapal-layar-ekspedisi-inggris_arktik',label:'Plate deck',prompt:'Empty deck fixture',characterId:null,timeMs:0},{id:'hammer',role:'prop',layerKey:'old_tools',motionRole:'static',label:'Palu',prompt:'Fixture hammer alpha',characterId:null,timeMs:0}]);plan.director={timing:'provisional',shots:[{startMs:0,endMs:3033,narrationCue:'Palu diam.',action:'Hold tool',location:'Arktik 1824',focus:'Palu',startPose:'Hold',endPose:'Hold',reaction:'None',camera:'wide',occlusion:'None',contact:'None',sfxCue:'None',movers:[],assetIds:['bg','hammer']}],specialAssets:[]};getDb().prepare('UPDATE cutout_asset_plans SET plan_json=? WHERE clip_id=?').run(JSON.stringify(plan),clipId);for(const i of plan.items){if(i.id===omit)continue;const localPath='fixture/'+clipId+'-'+i.id+'.png',file=assetAbsPath(projectId,localPath),bytes=Buffer.alloc(90*160*4,255);if(i.role!=='background')for(let n=0;n<bytes.length;n+=4)if(n/4%90<20||n/4%90>70)bytes[n+3]=0;mkdirSync(dirname(file),{recursive:true});writeFileSync(file,nativeImage.createFromBitmap(bytes,{width:90,height:160}).toPNG());insertAsset({projectId,clipId,kind:'image',localPath,width:90,height:160,meta:{cutoutAsset:{version:1,planId:plan.id,itemId:i.id,role:i.role,layerKey:i.layerKey,locationKey:i.locationKey,review:'needs-review',alpha:i.role==='background'?'opaque-background':'native'}}})}return plan}
function approveBrief(projectId:string,clipId:string){const r=studioReport(projectId).find(r=>r.clipId===clipId)!;return saveSceneBrief(projectId,clipId,{...r.brief,era:'1824–1825',location:'Arktik',locationCertain:true,reason:'User confirms period/place for this fixture.',approved:true})}
app.whenReady().then(async()=>{
 g.__assetGenerate=async()=>{throw Error('Paid generator forbidden')};g.__assetPlan=async()=>{throw Error('Model forbidden')}
 await test('T2 ten orphans counted by old clip; baseline does not adopt matching orphan item IDs',async()=>{
 const b=make(),c=b.clips[0],plan=seed(b.project.id,c.id,'hammer'),file=getBundle(b.project.id).assets[0],hash=createHash('sha256').update(readFileSync(assetAbsPath(b.project.id,file.localPath))).digest('hex');
 const orphanIds=[];for(let n=0;n<10;n++)orphanIds.push(insertAsset({projectId:b.project.id,clipId:n<6?'deleted-a':'deleted-b',kind:'image',localPath:file.localPath,width:90,height:160,meta:{cutoutAsset:{planId:plan.id,itemId:'hammer',role:'prop'}}}).id);
 const report=orphanAssetReport(b.project.id);assert.equal(report.orphanAssetCount,10);assert.deepEqual(report.groups.map(g=>g.count).sort(),[4,6]);assert.equal(cutoutAssetState(c.id).assets.length,1);assert.equal(studioReport(b.project.id)[0].status,'needs-assets');assert.equal(availableCutoutAssets(getBundle(b.project.id)).length,1);
 assert.throws(()=>linkOrphanAsset(b.project.id,orphanIds[0],c.id,false),/konfirmasikan/);assert.throws(()=>linkOrphanAsset(b.project.id,orphanIds[0],'foreign',true),/tujuan/);const linked=linkOrphanAsset(b.project.id,orphanIds[0],c.id,true);assert.equal(linked.clipId,c.id);assert.equal((linked.meta.cutoutAsset as any).planId,plan.id);assert.equal((linked.meta.cutoutAsset as any).review,'needs-review');assert.throws(()=>linkOrphanAsset(b.project.id,orphanIds[1],c.id,true),/sudah memiliki/);
 assert.throws(()=>archiveOrphanAsset(b.project.id,orphanIds[1],false),/konfirmasikan/);archiveOrphanAsset(b.project.id,orphanIds[1],true);assert.equal(orphanAssetReport(b.project.id).orphanAssetCount,8);assert.equal(orphanAssetReport(b.project.id).archivedCount,1);assert.equal(getBundle(b.project.id).assets.length,11);assert.equal(createHash('sha256').update(readFileSync(assetAbsPath(b.project.id,file.localPath))).digest('hex'),hash);assert.equal(studioReport(b.project.id)[0].status,'ready');const j=await done(startCodexAutoEdit({projectId:b.project.id,clipId:c.id,instruction:'Fixture only'}).id);assert.equal(j.status,'done');assert(getBundle(b.project.id).clips[0].cutout)
 })
 await test('T3 startup cancels ownerless Cutout work and run recovers stale gate while live worker still blocks',async()=>{
  const b=make(),c=b.clips[0];seed(b.project.id,c.id);const old=insertJob({projectId:b.project.id,clipId:c.id,kind:'auto-edit',provider:'local'});getDb().prepare("UPDATE jobs SET status='running' WHERE id=?").run(old.id);resumeJobs();assert.equal(getJob(old.id)!.status,'canceled');assert.match(getJob(old.id)!.message!,/sesi sebelumnya/);
  const abandoned=insertJob({projectId:b.project.id,kind:'auto-edit',provider:'local'});getDb().prepare("UPDATE jobs SET status='running' WHERE id=?").run(abandoned.id);const next=startCodexAutoEdit({projectId:b.project.id,clipId:c.id,instruction:'Local retry'});assert.equal(getJob(abandoned.id)!.status,'canceled');await done(next.id);
  let finish!:()=>void;const live=insertJob({projectId:b.project.id,kind:'auto-edit',provider:'local'});runJob(live,'automation',async()=>{await new Promise<void>(r=>finish=r)});await new Promise(r=>setTimeout(r,30));assert(isActive(live.id));assert.deepEqual(cancelAbandonedCutoutJobs(b.project.id),[]);assert.throws(()=>startCodexAutoEdit({projectId:b.project.id,instruction:'Do not overlap'}),/masih berjalan/);finish();assert.equal((await done(live.id)).status,'done')
 })
 writeFileSync(join(out,'result.json'),JSON.stringify({status:'passed',checks,paidCalls:0,actualSQLite:true,liveUserDatabaseTouched:false},null,2));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
