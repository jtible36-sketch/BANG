// Legacy free-scene regressions. The new default shot contract has its own eight-clip suite.
import assert from 'node:assert/strict'
import { app, nativeImage } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join,resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { closeDb, getDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, getJob, patchClip, insertAsset } from '../src/main/repo'
import { startCodexAutoEdit as startAgentComposer, getEditingContext, undoEditingPlan } from '../src/main/editor-automation'
import { cancelJob } from '../src/main/jobs'
import { createCutoutLayer, createCutoutScene, evaluateCutoutScene, normalizeCutoutScene } from '../src/shared/cutout-timeline'
import { auditCutoutContacts, bakeCutoutFrames, DEFAULT_CUTOUT_PRODUCTION } from '../src/shared/cutout-production'
import { normalizeEditorEditPlan } from '../src/shared/editor-automation'
import { renderCutoutSegment } from '../src/main/cutout-renderer'
import { cutoutAssetState, generateCutoutAsset, saveCutoutAssetPlan } from '../src/main/cutout-assets'

const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const check=async(name:string,fn:()=>unknown|Promise<unknown>)=>{try{console.log('CHECK:',name);await fn();checks.push(name);console.log('PASS:',name)}catch(e){console.error('FAILED:',name);throw e}}
function png(w:number,h:number,color:[number,number,number],transparent=false){const b=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;b[i]=color[2];b[i+1]=color[1];b[i+2]=color[0];b[i+3]=transparent&&(x<4||y<4||x>w-5||y>h-5)?0:255}return nativeImage.createFromBitmap(b,{width:w,height:h}).toPNG()}
async function done(id:string){const until=Date.now()+60000;while(Date.now()<until){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,20))}throw Error('timeout '+id)}
async function until(fn:()=>unknown){const end=Date.now()+10000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10))}throw Error('not entered')}
function project(){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout'});replaceScript(p.id,'Fixture',[{title:'Aksi',story:'Tokoh memegang benda lalu bereaksi.',narration:'Tokoh memegang benda lalu bereaksi.',durationMs:2000}]);return {id:p.id,clipId:getBundle(p.id).clips[0].id}}
const options={...DEFAULT_CUTOUT_PRODUCTION,beatTemplate:false,maxAssetsPerClip:128,maxNewAssets:128},request=(p:{id:string;clipId:string},instruction='Buat aksi dengan banyak pose')=>({projectId:p.id,clipId:p.clipId,instruction,production:options})
let planned=0,generated=0
function planner(count=34){return async(o:any)=>{
  if(o.schema?.properties?.shots){const p=JSON.parse(o.prompt);return {timing:'provisional',shots:[{startMs:0,endMs:p.durationMs,narrationCue:'Tokoh memegang',action:'memegang',location:'meja',focus:'benda',startPose:'netral',endPose:'memegang',reaction:'penasaran',camera:'medium',occlusion:'tidak diperlukan',contact:'tangan pada benda',sfxCue:'tidak diperlukan',assetIds:p.items.map((i:any)=>i.id)}],specialAssets:[]}}
  if(!!o.schema?.properties?.items){planned++;const items=Array.from({length:count},(_,i)=>({id:'item-'+i,role:i===0?'background':i===1?'prop':i===2?'character':'pose',layerKey:i===0?'bg':i===1?'prop':'actor',label:'Aset '+i,prompt:'One isolated asset required for this action.',characterId:null,timeMs:i<3?0:Math.round((i-2)*1900/(count-2))}));return {items,director:{timing:'provisional',shots:[{startMs:0,endMs:JSON.parse(o.prompt).clip.durationMs,narrationCue:'Tokoh memegang benda',action:'memegang',location:'meja',focus:'benda',startPose:'netral',endPose:'memegang',reaction:'penasaran',camera:'medium',occlusion:'tidak diperlukan',contact:'tangan pada benda',sfxCue:'tidak diperlukan',assetIds:items.map(i=>i.id)}],specialAssets:[]}}}
  const p=JSON.parse(o.prompt),scene=p.seedComposition;if(p.assetPlan.director)assert(o.system.includes('assetPlan.director'))
  const actor=scene.layers.find((l:any)=>l.name==='Aset 2');if(actor)actor.keyframes=[{id:'move',timeMs:1900,transform:{...actor.transform,x:.65},easing:'ease-in-out'}]
  return {summary:'Komposisi dengan semua pose',clips:[{clipId:p.scope.clipId,cutout:scene,transition:null,durationMs:null}],editor:null}
}}
let contactScene:ReturnType<typeof createCutoutScene>
void app.whenReady().then(async()=>{
  const bg=png(90,160,[45,75,100]),sprite=png(48,80,[30,220,50],true)
  const make=async(o:any)=>{generated++;return {bytes:o.prompt.includes('Role: background')?bg:sprite}}
  g.__assetPlan=planner();g.__assetGenerate=make
  const p=project()
  await check('one action coordinates real queued planning, 34 separate assets, automatic layer/pose adoption and dense frame keys without deadlock',async()=>{
    const j=await done(startCodexAutoEdit(request(p)).id);assert.equal(j.status,'done',j.error??'')
    const b=getBundle(p.id),c=b.clips[0];assert.equal(b.assets.filter(a=>a.meta.cutoutAsset).length,34);assert.equal(c.cutout?.layers.length,3)
    assert.equal(c.cutout?.layers.find(l=>l.poses.length)?.poses.length,31);assert.equal(c.cutout?.layers.find(l=>l.keyframes.length)?.keyframes.length,120)
    assert.equal(c.imageAssetId,null);assert.equal(c.narration,'Tokoh memegang benda lalu bereaksi.')
  })
  await check('completed images and persisted plans resume across SQLite reopen without new generations',async()=>{
    const before=generated,beforePlan=planned;closeDb();const j=await done(startCodexAutoEdit(request(p)).id);assert.equal(j.status,'done',j.error??'');assert.equal(generated,before);assert.equal(planned,beforePlan)
  })
  await check('composition undo preserves generated PNG assets',()=>{const ctx=getEditingContext(p.id);assert(ctx.undoAvailable);undoEditingPlan(p.id,ctx.revision);assert.equal(getBundle(p.id).clips[0].cutout,null);assert.equal(getBundle(p.id).assets.length,34)})
  await check('automatic production and direction-only upgrade preserve exact fractional voice-sync clip duration',async()=>{
    const original=g.__assetPlan;g.__assetPlan=planner(3)
    try{for(const durationMs of [3333.3333333333335,3633.3333333333335,3666.6666666666665]){
      const q=project();getDb().prepare('UPDATE clips SET duration_ms=? WHERE id=?').run(durationMs,q.clipId)
      const narration=getBundle(q.id).clips[0].narration
      const voice=insertAsset({projectId:q.id,clipId:q.clipId,kind:'audio',prompt:narration,localPath:'audio/reviewed-narration.wav',durationMs:Math.floor(durationMs)})
      patchClip(q.clipId,{audioAssetId:voice.id})
      const guarded=g.__assetPlan;g.__assetPlan=async(o:any)=>{if(o.schema?.properties?.items)assert.equal(JSON.parse(o.prompt).clip.durationMs,Math.floor(durationMs));if(o.schema?.properties?.shots)assert.equal(JSON.parse(o.prompt).durationMs,Math.floor(durationMs));return guarded(o)}
      const first=await done(startCodexAutoEdit(request(q)).id);assert.equal(first.status,'done',first.error??'');assert.equal(getBundle(q.id).clips[0].durationMs,durationMs);assert.equal(getBundle(q.id).clips[0].audioAssetId,voice.id)
      const plan=cutoutAssetState(q.clipId).plan!;assert.equal(plan.director!.shots.at(-1)!.endMs,Math.floor(durationMs))
      const without={...plan};delete without.director;getDb().prepare('UPDATE cutout_asset_plans SET plan_json=? WHERE clip_id=?').run(JSON.stringify(without),q.clipId)
      const before=generated;const upgrade=await done(startCodexAutoEdit(request(q)).id);assert.equal(upgrade.status,'done',upgrade.error??'');assert.equal(generated,before);assert.equal(cutoutAssetState(q.clipId).plan!.id,plan.id);assert.equal(getBundle(q.id).clips[0].durationMs,durationMs)
      g.__assetPlan=planner(3)
    }}finally{g.__assetPlan=original}
  })
  await check('budget rejection occurs before any image submission',async()=>{
    const q=project(),before=generated,j=await done(startCodexAutoEdit({...request(q),production:{...options,maxNewAssets:2}}).id)
    assert.equal(j.status,'failed');assert.match(j.error!,/melebihi batas/);assert.equal(generated,before);assert(cutoutAssetState(q.clipId).plan)
  })
  await check('Flow MCP production uses separate WebP alpha assets and one submission per item',async()=>{
    const q=project(),file=join(root,'flow-asset.png');writeFileSync(file,sprite);g.__flowImage=file;g.__flowCalls=[];g.__assetPlan=planner(3)
    const result=await done(startCodexAutoEdit({...request(q),production:{...options,provider:'flow-mcp',format:'webp'}}).id)
    assert.equal(result.status,'done',result.error??'');const b=getBundle(q.id);assert.equal(b.assets.length,3);assert(b.assets.every(a=>a.localPath.endsWith('.webp')))
    const calls=g.__flowCalls.filter((x:any)=>x.method==='generate');assert.equal(calls.length,3);assert(calls.every((x:any)=>x.args.scenes[0].variants===1&&x.args.scenes[0].retries===0));g.__assetPlan=planner()
  })
  await check('reviewed manual package is reused rather than silently replanned',async()=>{
    const q=project();g.__assetPlan=planner(3)
    const first=await done(startCodexAutoEdit(request(q)).id);assert.equal(first.status,'done',first.error??'')
    const plan=cutoutAssetState(q.clipId).plan!,before=planned
    saveCutoutAssetPlan(q.clipId,plan.items.map((item,i)=>i===1?{...item,prompt:'A revised isolated prop for this action.'}:item))
    const second=await done(startCodexAutoEdit(request(q)).id);assert.equal(second.status,'done',second.error??'');assert.equal(planned,before);g.__assetPlan=planner()
  })
  await check('prop state variants receive the previous generated prop as a continuity reference',async()=>{
    const q=project(),plan=saveCutoutAssetPlan(q.clipId,[0,1].map(i=>({id:'prop-'+i,role:'prop',layerKey:'tool',label:'Tool state '+i,prompt:'One isolated tool state.',characterId:null,timeMs:i*1000})))
    const counts:number[]=[];g.__assetGenerate=async(o:any)=>{counts.push(o.referencePaths.length);return make(o)}
    for(const item of plan.items){const result=await done(generateCutoutAsset({clipId:q.clipId,planId:plan.id,itemId:item.id,provider:'codex',format:'png'}).id);assert.equal(result.status,'done',result.error??'')}
    assert.deepEqual(counts,[0,1]);g.__assetGenerate=make
  })
  await check('failed image generation keeps completed assets and resumes only missing items',async()=>{
    const q=project();let local=0;g.__assetPlan=planner(8);g.__assetGenerate=async(o:any)=>{if(++local===4)throw Error('fixture provider interruption');return make(o)}
    const failed=await done(startCodexAutoEdit(request(q)).id);assert.equal(failed.status,'failed');assert.equal(getBundle(q.id).assets.length,3);assert.equal(getBundle(q.id).clips[0].cutout,null)
    const before=generated;g.__assetGenerate=make;const retry=await done(startCodexAutoEdit(request(q)).id);assert.equal(retry.status,'done',retry.error??'');assert.equal(generated-before,5)
  })
  await check('parent cancellation aborts its image child and never applies a partial composition',async()=>{
    const q=project();let entered=false;g.__assetGenerate=({signal}:any)=>new Promise((_r,reject)=>{entered=true;signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})})
    const job=startCodexAutoEdit(request(q));await until(()=>entered);await cancelJob(job.id);assert.equal((await done(job.id)).status,'canceled');await until(()=>getBundle(q.id).jobs.every(j=>!['queued','running'].includes(j.status)));assert.equal(getBundle(q.id).clips[0].cutout,null)
    g.__assetGenerate=make
  })
  await check('manual edits during production survive and block late automatic composition',async()=>{
    const q=project();let release:((v:unknown)=>void)|undefined;g.__assetGenerate=()=>new Promise(r=>{release=r})
    const job=startCodexAutoEdit(request(q));await until(()=>release);getDb().prepare('UPDATE clips SET title=? WHERE id=?').run('Manual edit wins',q.clipId);release!({bytes:bg});const final=await done(job.id);assert.equal(final.status,'failed');assert.match(final.error!,/Revisi proyek berubah/);assert.equal(getBundle(q.id).clips[0].title,'Manual edit wins');assert.equal(getBundle(q.id).clips[0].cutout,null);g.__assetGenerate=make
  })
  await check('project mode applies no partial compositions when a later clip plan fails',async()=>{
    const q=project();replaceScript(q.id,'Two clips',[{title:'One',story:'A',narration:'A',durationMs:2000},{title:'Two',story:'B',narration:'B',durationMs:2000}]);let compose=0;const base=planner(3)
    g.__assetPlan=async(o:any)=>{if(!!!o.schema?.properties?.items&&++compose===2)throw Error('fixture composition interruption');return base(o)}
    const result=await done(startCodexAutoEdit({projectId:q.id,instruction:'Compose all',production:options}).id);assert.equal(result.status,'failed');assert(getBundle(q.id).clips.every(c=>c.cutout===null));g.__assetPlan=planner()
  })
  await check('contact anchors track a moving rotated scaled prop through parallax on every one of 120 frames',()=>{
    const s=createCutoutScene(),u=createCutoutLayer('u','Upper','red'),l=createCutoutLayer('l','Lower','green'),target=createCutoutLayer('target','Handle','blue')
    u.pivotX=u.pivotY=l.pivotX=l.pivotY=0;u.width=l.width=.2;u.transform.x=.2;u.transform.y=.5;l.parentId='u';l.transform.x=.2;l.transform.y=0
    target.width=.08;target.depth=.7;target.transform={x:.47,y:.48,scale:1,rotation:0,opacity:1};target.keyframes=[{id:'move',timeMs:1900,transform:{...target.transform,x:.53,y:.52,scale:1.2,rotation:180},easing:'ease-in-out'}]
    s.layers=[u,l,target];s.camera.keyframes=[{id:'cam',timeMs:1900,x:.01,y:-.01,zoom:1.1,easing:'linear'}]
    s.ik=[{id:'arm',name:'Contact',enabled:true,upperId:'u',lowerId:'l',endX:.2,endY:0,targetLayerId:'target',targetX:.6,targetY:.5,weight:1,bend:1,keyframes:[]}]
    contactScene=normalizeCutoutScene(s)!
    const assets=[{id:'red',width:100,height:10},{id:'green',width:100,height:10},{id:'blue',width:20,height:20}] as any
    const report=auditCutoutContacts(contactScene,2000,60,assets,'16:9');assert.equal(report.samples,120);assert.equal(report.missing,0);assert(report.maxErrorPx<.01,JSON.stringify(report))
    const baked=bakeCutoutFrames(contactScene,2000,60);assert.equal(baked.layers[2].keyframes.length,120);assert.equal(auditCutoutContacts(baked,2000,60,assets,'16:9').maxErrorPx,0)
    assert.equal(normalizeEditorEditPlan({summary:'Contact',clips:[{clipId:'clip',cutout:baked}]}).clips[0].cutout?.ik?.[0].targetLayerId,'target')
  })
  await check('self-dependent and cyclic contact rigs reject instead of recursing',()=>{
    const s=structuredClone(contactScene);s.ik![0].targetLayerId='l';assert.throws(()=>normalizeCutoutScene(s),/tulang sendiri/)
    const a=createCutoutLayer('a','A',null),b=createCutoutLayer('b','B',null);b.parentId='a';b.transform.x=.2;b.transform.y=0;s.layers.push(a,b);s.ik![0].targetLayerId='b';s.ik!.push({...s.ik![0],id:'second',upperId:'a',lowerId:'b',targetLayerId:'l'});assert.throws(()=>normalizeCutoutScene(s),/melingkar/)
  })
  await check('real MP4 renders 140 large pose sources with bounded lazy decoding, correct swaps and moving IK contact',async()=>{
    const red=join(root,'red.png'),green=join(root,'green.png'),blue=join(root,'blue.png');writeFileSync(red,png(1024,1024,[230,20,20]));writeFileSync(green,png(1024,1024,[20,230,20]));writeFileSync(blue,png(20,20,[20,20,230]))
    const scene=structuredClone(contactScene),poses=createCutoutLayer('poses','140 poses','pose-0');poses.width=.1;poses.transform.x=.85;poses.transform.y=.2;poses.depth=0
    poses.poses=Array.from({length:139},(_,i)=>({id:'p'+i,timeMs:Math.round((i+1)*1000/60),assetId:'pose-'+(i+1)}));scene.layers.push(poses)
    const file=join(root,'contact-and-many-poses.mp4'),ffmpeg=process.env.CUTOUT_FFMPEG!
    await renderCutoutSegment({scene,images:[{id:'red',path:red},{id:'green',path:green},{id:'blue',path:blue},...Array.from({length:140},(_,i)=>({id:'pose-'+i,path:i%2?green:red}))],width:320,height:180,fps:60,durationMs:2400,outputPath:file,ffmpegPath:ffmpeg,signal:new AbortController().signal})
    const decoded=execFileSync(ffmpeg,['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,maxBuffer:30*1024*1024}),size=320*180*3
    const pixel=(frame:number)=>[...decoded.subarray(frame*size+(36*320+272)*3,frame*size+(36*320+272)*3+3)]
    assert(pixel(0)[0]>170);assert(pixel(143)[1]>170)
    // Bound-contact end point lies at the center of the blue prop in the decoded frames.
    for(const frame of [0,60,110]){const draw=evaluateCutoutScene(scene,frame*1000/60,320,180,{'red':{width:1024,height:1024},'green':{width:1024,height:1024},'blue':{width:20,height:20}}),target=draw.find(x=>x.layerId==='target')!,m=target.matrix,x=Math.round(m[0]*target.width*.6+m[2]*target.height*.5+m[4]),y=Math.round(m[1]*target.width*.6+m[3]*target.height*.5+m[5]),i=frame*size+(y*320+x)*3;assert(decoded[i+2]>130)}
  })
  const result={status:'passed',checks,actualElectron:true,actualSQLite:true,providerResponses:'controlled; no external generation',liveUserDatabaseTouched:false,proof:join(root,'contact-and-many-poses.mp4')};writeFileSync(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})

// Explicit optional-agent regression; default baseline/consent covered by cutout-permanent integration.
function startCodexAutoEdit(input:Parameters<typeof startAgentComposer>[0]){return startAgentComposer({...input,productionStrategy:'agent'})}
