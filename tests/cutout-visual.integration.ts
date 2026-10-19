import {generateVisualCutoutBatch} from '../src/main/cutout-visual'
import {planCutoutAssets} from '../src/main/cutout-assets'
import {cutoutVisualReadiness} from '../src/shared/cutout-visual'
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
let generations=0,deltaCalls=0,reviewCalls=0,planningCalls=0,conversionCalls=0,failClip='',needAsset=false,maxPrompt=0,denyReviews=0
const perClip=new Map<string,number>();g.__progress=[]
function png(alpha:boolean){const w=90,h=160,b=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;b[i]=alpha?210:80;b[i+1]=alpha?130:150;b[i+2]=alpha?65:190;b[i+3]=alpha&&(x<14||x>75||y<15||y>145)?0:255}return nativeImage.createFromBitmap(b,{width:w,height:h}).toPNG()}
g.__assetGenerate=async(o:any)=>{generations++;return {bytes:png(!o.prompt.includes('Role: background'))}}
g.__assetPlan=async(o:any)=>{
 assert.equal(o.timeoutMs,getSettings().visualTimeoutSec*1000,'Every visual call uses configured timeout')
 const p=JSON.parse(o.prompt)
 if(o.schema?.properties?.approved){reviewCalls++;assert(o.images.length>=3);assert(o.images.every((s:string)=>existsSync(s)));if(denyReviews){denyReviews--;return {approved:false,problems:['Blocking visible problem '+(4-denyReviews)],missingAssets:[]}}if(needAsset){needAsset=false;return {approved:false,problems:['Engsel tambahan diperlukan untuk aksi.'],missingAssets:['Properti engsel terpisah sesuai narasi']}}return {approved:true,problems:[],missingAssets:[]}}
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
 const p=project(2),b=getBundle(p)
 for(const c of b.clips){const j=await done(planCutoutAssets(c.id,{maxAssets:16,beatTemplate:true}).id);assert.equal(j.status,'done',j.error??'')}
 const input={projectId:p,clipIds:b.clips.map(c=>c.id),provider:'codex' as const,format:'webp' as const,maxNewAssets:13}
 await check('Visual checks the entire image budget before sending and accepts shared background reuse',async()=>{
   assert.throws(()=>generateVisualCutoutBatch({...input,maxNewAssets:12}),/melebihi batas/);assert.equal(generations,0)
 })
 let once=true;const base=g.__assetGenerate;g.__assetGenerate=async(o:any)=>{if(once&&o.prompt.includes('Asset: Tokoh pose 1.')){once=false;generations++;throw Error('fixture one image failed')}return base(o)}
 await check('one image failure does not stop remaining images; successful assets are durable',async()=>{
   const j=await done(generateVisualCutoutBatch(input).id);assert.equal(j.status,'failed');assert.match(j.error!,/13\/14 aset selesai; 1 gagal/);assert.equal(generations,13)
   const current=getBundle(p);assert.equal(current.assets.filter(a=>a.meta.cutoutAsset).length,13);assert(current.clips.every(c=>!c.cutout));assert(current.assets.filter(a=>a.meta.cutoutAsset).every(a=>a.localPath.endsWith('.webp')))
 })
 await check('retry after SQLite reopen generates only the missing item and exposes accurate readiness',async()=>{
   const previous=getBundle(p).assets.map(a=>a.id),before=generations;closeDb();const j=await done(generateVisualCutoutBatch(input).id);assert.equal(j.status,'done',j.error??'');assert.equal(generations,before+1)
   const current=getBundle(p);assert(previous.every(id=>current.assets.some(a=>a.id===id)));assert(current.clips.every(c=>cutoutVisualReadiness(cutoutAssetState(c.id),current.assets).ready))
   const nothing=await done(generateVisualCutoutBatch(input).id);assert.equal(nothing.status,'done');assert.match(nothing.message!,/tidak ada gambar/);assert.equal(generations,before+1)
 })
 await check('Production uses Visual package IDs without regenerating or replanning',async()=>{
   const before={images:generations,plans:planningCalls},ids=b.clips.map(c=>cutoutAssetState(c.id).plan!.id)
   const j=await done(startCodexAutoEdit({...request(p),production:{...production,enabled:false}}).id);assert.equal(j.status,'done',j.error??'')
   assert.equal(generations,before.images);assert.equal(planningCalls,before.plans);assert.deepEqual(b.clips.map(c=>cutoutAssetState(c.id).plan!.id),ids);assert(getBundle(p).clips.every(c=>c.cutout?.shots?.length===3))
 })
 await check('stale narration and cross-project clip IDs cannot generate from an invalid package',async()=>{
   const before=generations;patchClip(b.clips[0].id,{narration:'Narasi berubah.'});assert.throws(()=>generateVisualCutoutBatch(input),/Susun kebutuhan terbaru/);assert.equal(cutoutVisualReadiness(cutoutAssetState(b.clips[0].id),getBundle(p).assets).ready,false)
   const other=project(1);assert.throws(()=>generateVisualCutoutBatch({...input,clipIds:[getBundle(other).clips[0].id]}),/bukan bagian/);assert.equal(generations,before)
 })
 const result={status:'passed',checks,actualSQLite:true,actualElectron:true,actualWebpAlpha:true,providers:'controlled; no paid generation',liveUserDatabaseTouched:false}
 writeFileSync(join(root,'visual-production-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})

// Explicit optional-agent regression; default baseline/consent covered by cutout-permanent integration.
function startCodexAutoEdit(input:Parameters<typeof startAgentComposer>[0]){return startAgentComposer({...input,productionStrategy:'agent'})}

// Explicit fixture review of the synthetic plate, enabling approved reuse in this scenario.
g.__fixtureReviewAsset=(a:any)=>{const m=a.meta.cutoutAsset;if(m?.role==='background')getDb().prepare('UPDATE assets SET meta_json=? WHERE id=?').run(JSON.stringify({...a.meta,cutoutAsset:{...m,review:'approved'}}),a.id)}
