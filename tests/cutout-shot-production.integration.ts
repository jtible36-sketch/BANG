import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {getDb,closeDb} from '../src/main/db'
import {createProject,replaceScript,getBundle,getJob,insertAsset,patchClip} from '../src/main/repo'
import {startCodexAutoEdit as startAgentComposer,resumeCodexAutoEdit,getEditingContext} from '../src/main/editor-automation'
import {cutoutAssetState} from '../src/main/cutout-assets'
import {projectDir} from '../src/main/paths'
import {getSettings} from '../src/main/settings'
import {cutoutImageSources,renderCutoutSegment} from '../src/main/cutout-renderer'
import {DEFAULT_CUTOUT_PRODUCTION,generatedForItem} from '../src/shared/cutout-production'
import {cutoutAssetIds} from '../src/shared/cutout-timeline'
import {auditCutoutDirection} from '../src/shared/cutout-direction-policy'
import {sliceShotScene} from '../src/shared/cutout-shot-motion'
import {builtInMasterPrompts} from '../src/shared/master-prompts'
const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const production={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:16,maxNewAssets:55,motion:'keyframes' as const}
let generations=0,deltaCalls=0,reviewCalls=0,planningCalls=0,conversionCalls=0,failClip='',needAsset=0,maxPrompt=0,denyReviews=0
const perClip=new Map<string,number>();g.__progress=[]
function png(alpha:boolean){const w=90,h=160,b=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;b[i]=alpha?210:80;b[i+1]=alpha?130:150;b[i+2]=alpha?65:190;b[i+3]=alpha&&(x<14||x>75||y<15||y>145)?0:255}return nativeImage.createFromBitmap(b,{width:w,height:h}).toPNG()}
g.__assetGenerate=async(o:any)=>{generations++;return {bytes:png(!o.prompt.includes('Role: background'))}}
g.__assetPlan=async(o:any)=>{
 assert.equal(o.timeoutMs,getSettings().visualTimeoutSec*1000,'Every visual call uses configured timeout')
 const p=JSON.parse(o.prompt)
 if(o.schema?.properties?.approved){reviewCalls++;assert(o.images.length>=3);assert(o.images.every((s:string)=>existsSync(s)));if(denyReviews){denyReviews--;return {approved:false,problems:['Blocking visible problem '+(4-denyReviews)],missingAssets:[]}}if(needAsset){needAsset--;return {approved:false,problems:['Engsel tambahan diperlukan untuk aksi.'],missingAssets:['Properti engsel terpisah sesuai narasi']}}return {approved:true,problems:[],missingAssets:[]}}
 if(p.requests){conversionCalls++;return {items:p.requests.map((r:any)=>({id:r.id,role:'prop',label:'Engsel',prompt:'One isolated photographic hinge with alpha.',characterId:null,timeMs:900,layerKey:'hinge-repair'}))}}
 if(o.schema?.properties?.motionPattern){
  deltaCalls++;perClip.set(p.shot.clipId,(perClip.get(p.shot.clipId)??0)+1);maxPrompt=Math.max(maxPrompt,o.prompt.length)
  assert(!o.schema.properties.layers&&!o.schema.properties.clips&&!o.schema.properties.keyframes);assert(!p.seedComposition&&!p.context)
  assert(o.system.includes('parent/IK/mask/parallax'));assert.equal(o.codex.model,'fixture-model');assert.equal(o.codex.effort,'high')
  if(p.shot.clipId===failClip)throw Error('fixture interrupted composer')
  return {summary:'Satu aksi pose yang telah direncanakan.',motionPattern:p.shot.startPose===p.shot.endPose?'hold':'pose-swap',movers:p.allowedMovers,startPose:p.shot.startPose,endPose:p.shot.endPose,overlays:p.shot.overlays}
 }
 if(o.schema?.properties?.items){planningCalls++;assert(o.system.includes('MODE SHOT DAFIOLOGY'));const items=[{id:'bg',role:'background',label:'Toko 2020 tanpa tokoh',prompt:'A realistic supermarket in 2020, empty clean plate without people or moving props.',characterId:null,timeMs:0,layerKey:'bg',motionRole:'static',locationKey:'supermarket-2020-front-aisle'},...Array.from({length:6},(_,i)=>({id:'pose-'+i,role:i===0?'character':'pose',label:'Tokoh pose '+i,prompt:'One photographic adult in a blue shirt, same face, proportions and camera registration; pointing gesture '+i+'.',characterId:null,timeMs:i*1500,layerKey:'actor',motionRole:'mover',locationKey:''}))]
  return {items,director:{timing:'recorded',shots:Array.from({length:3},(_,i)=>({startMs:i*3000,endMs:(i+1)*3000,narrationCue:i===1?'Pada 2020 engsel bergerak.':'Tokoh menunjuk troli.',action:'Tokoh menunjuk engsel.',location:'Supermarket 2020',focus:'engsel',startPose:'pose awal',endPose:'pose akhir',reaction:'penasaran',camera:i===0?'wide':'detail',occlusion:'tidak diperlukan',contact:'pose memegang sudah menyatu',sfxCue:'tidak diperlukan',assetIds:['bg','pose-'+i*2,'pose-'+(i*2+1)],movers:['actor'],beat:i===0?'hook':i===1?'kronologi':'penutup',overlays:i===0?[{type:'label',text:'Pintu pada troli'}]:i===1?[{type:'year',text:'2020'}]:[]})),specialAssets:[]}}
 }
 throw Error('Unexpected provider contract')
}
async function done(id:string){for(let i=0;i<9000;i++){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,20))}throw Error('Job timeout')}
function project(count:number){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout',masterPrompt:builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!});replaceScript(p.id,'Fixture troli',Array.from({length:count},(_,i)=>({title:'Pintu pada troli '+i,story:'Toko pada 2020. Tokoh menunjuk engsel.',narration:'Pada 2020 tokoh menunjuk troli, lalu menunjuk engsel dan bereaksi.',durationMs:9000})));for(const clip of getBundle(p.id).clips){
  const file='voice-'+clip.id+'.wav',data=Buffer.alloc(44+16000*9*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(16000,24);data.writeUInt32LE(32000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);writeFileSync(join(projectDir(p.id),file),data)
  const audio=insertAsset({projectId:p.id,clipId:clip.id,kind:'audio',localPath:file,durationMs:9000,meta:{words:Array.from({length:18},(_,i)=>({text:'fixture',start:i*.5,end:(i+1)*.5})),estimatedTimings:false}});patchClip(clip.id,{audioAssetId:audio.id})
 }return p.id}
const request=(projectId:string)=>({projectId,instruction:'Satu aksi per shot mengikuti narasi dan timing rekaman; gunakan beat template.',production,codex:{model:'fixture-model',effort:'high'}})
async function check(name:string,fn:()=>unknown|Promise<unknown>){await fn();checks.push(name);console.log('PASS',name)}
void app.whenReady().then(async()=>{
 let id=''
 await check('eight-clip full production completes with 24 small shot deltas and actual per-shot rendered reviews',async()=>{
  id=project(8);const j=await done(startCodexAutoEdit(request(id)).id);assert.equal(j.status,'done',j.error??'');const b=getBundle(id);assert.equal(b.clips.length,8);assert.equal(planningCalls,8);assert.equal(deltaCalls,24);assert.equal(reviewCalls,24);assert.equal(generations,49,'One generated plate reused across all eight clips');assert(maxPrompt<12000)
  for(const clip of b.clips){assert.equal(clip.transition,'cut');assert.equal(clip.cutout?.shots?.length,3);assert.deepEqual(clip.cutout!.shots!.map(s=>s.beat),['hook','kronologi','penutup']);const plan=cutoutAssetState(clip.id).plan!,used=new Set(cutoutAssetIds(clip.cutout));assert(plan.items.every(i=>used.has(generatedForItem(b.assets,plan,i.id)!.id)));for(const s of clip.cutout!.shots!){assert.equal(s.movers.length,1);const audit=auditCutoutDirection(sliceShotScene(clip.cutout!,s.startMs,s.endMs),b.assets,s.endMs-s.startMs);assert.deepEqual(audit.problems,[]);assert.deepEqual(audit.missingAssets,[])}}
  assert.equal(b.project.editor.captionStyle,'karaoke');assert.equal(b.project.editor.captionHighlight,'#73F96C');assert.equal(b.project.editor.overlays.filter(o=>o.id.startsWith('shot-text-')).length,8);assert.equal(b.assets.filter(a=>a.meta.source==='reused').length,7)
 })
 await check('finished assets and shot checkpoints survive SQLite reopen; repeat/resume makes no new images or composition calls',async()=>{
  const before={generations,deltaCalls},assetIds=getBundle(id).assets.map(a=>a.id).sort();closeDb();const j=await done(startCodexAutoEdit(request(id)).id);assert.equal(j.status,'done',j.error??'');assert.equal(generations,before.generations);assert.equal(deltaCalls,before.deltaCalls);assert.deepEqual(getBundle(id).assets.map(a=>a.id).sort(),assetIds);assert.equal(getBundle(id).project.editor.overlays.length,8)
 })
 await check('image generation disabled still uses the shot contract with existing assets and refuses missing plans before generation',async()=>{
  const before={images:generations,deltas:deltaCalls},j=await done(startCodexAutoEdit({...request(id),production:{...production,enabled:false}}).id)
  assert.equal(j.status,'done',j.error??'');assert.equal(generations,before.images);assert.equal(deltaCalls,before.deltas)
  const p=project(1),plans=planningCalls,missing=await done(startCodexAutoEdit({...request(p),production:{...production,enabled:false}}).id);assert.equal(missing.status,'failed');assert.match(missing.error!,/Susun kebutuhan/);assert.equal(planningCalls,plans);assert.equal(generations,before.images)
 })
 await check('an interrupted later clip applies no partial project edit and resumes accepted earlier shots without regeneration',async()=>{
  const p=project(3),clip=getBundle(p).clips;failClip=clip[1].id;const failed=await done(startCodexAutoEdit(request(p)).id);assert.equal(failed.status,'failed');assert.match(failed.error!,/fixture interrupted/);assert(getBundle(p).clips.every(c=>c.cutout===null));const before=generations,accepted=perClip.get(clip[0].id);failClip='';closeDb();const resumed=await done(resumeCodexAutoEdit(p,failed.id).id);assert.equal(resumed.status,'done',resumed.error??'');assert.equal(generations,before);assert.equal(perClip.get(clip[0].id),accepted);assert(getBundle(p).clips.every(c=>c.cutout?.shots?.length===3))
 })
 await check('a missing asset is generated once and repairs only the rejected shot with the same immutable registry',async()=>{
  const p=project(1),before=generations;needAsset=2;const j=await done(startCodexAutoEdit(request(p)).id);assert.equal(j.status,'done',j.error??'');assert.equal(conversionCalls,1);assert.equal(generations-before,8);const b=getBundle(p),plan=cutoutAssetState(b.clips[0].id).plan!;assert.equal(plan.items.length,8);assert.equal(cutoutAssetIds(b.clips[0].cutout).length,8);assert(g.__progress.some((s:unknown)=>typeof s==='string'&&s.includes('Perbaikan otomatis shot (percobaan 1/3)')))
 })
 await check('the image limit is checked before any provider image submission',async()=>{
  const p=project(1),before=generations,j=await done(startCodexAutoEdit({...request(p),production:{...production,maxNewAssets:1}}).id);assert.equal(j.status,'failed');assert.match(j.error!,/melebihi batas/);assert.equal(generations,before);assert(getBundle(p).clips.every(c=>!c.cutout))
 })
 await check('a valid visual rejection stops after three shot repairs with latest problems and retains images for resume',async()=>{
  const p=project(1),before={reviews:reviewCalls,deltas:deltaCalls,images:generations};denyReviews=4
  const j=await done(startCodexAutoEdit(request(p)).id);assert.equal(j.status,'failed');assert.match(j.error!,/Blocking visible problem 4/);assert.equal(reviewCalls-before.reviews,4);assert.equal(deltaCalls-before.deltas,4);assert.equal(generations-before.images,7);assert.equal(getEditingContext(p).missingAssetRecovery,null);assert(getBundle(p).clips.every(c=>!c.cutout));const imageCount=generations
  const next=await done(resumeCodexAutoEdit(p,j.id).id);assert.equal(next.status,'done',next.error??'');assert.equal(generations,imageCount)
 })
 const b=getBundle(id),clip=b.clips[0],proof=join(root,'shot-proof.mp4')
 await renderCutoutSegment({scene:clip.cutout!,images:cutoutImageSources(b,clip.cutout!),width:180,height:320,fps:30,durationMs:9000,outputPath:proof,ffmpegPath:process.env.CUTOUT_FFMPEG!,signal:new AbortController().signal})
 const result={status:'passed',checks,actualElectron:true,actualSQLite:true,actualCanvasFrames:true,actualMp4:true,fullRun:{clips:8,shots:24,initialImageSubmissions:49,backgroundReuses:7},maximumShotPromptChars:maxPrompt,providers:'controlled responses and fixture images; no paid generation or reference-style visual certification',liveUserDatabaseTouched:false,proof}
 writeFileSync(join(root,'shot-production-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})

// Explicit optional-agent regression; default baseline/consent covered by cutout-permanent integration.
function startCodexAutoEdit(input:Parameters<typeof startAgentComposer>[0]){return startAgentComposer({...input,productionStrategy:'agent'})}

// Explicit fixture review of the synthetic plate, enabling approved reuse in this scenario.
g.__fixtureReviewAsset=(a:any)=>{const m=a.meta.cutoutAsset;if(m?.role==='background')getDb().prepare('UPDATE assets SET meta_json=? WHERE id=?').run(JSON.stringify({...a.meta,cutoutAsset:{...m,review:'approved'}}),a.id)}
