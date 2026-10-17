import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {getDb,closeDb} from '../src/main/db'
import {createProject,replaceScript,getBundle,insertAsset,patchClip,getJob} from '../src/main/repo'
import {getEditingContext,startCodexAutoEdit} from '../src/main/editor-automation'
import {createScriptRevision} from '../src/main/script-revision'
import {generateScript} from '../src/main/story'
import {builtInMasterPrompts,masterStageDirection} from '../src/shared/master-prompts'
import {isCutoutReference,cutoutCoverage,cutoutNarrativeSections} from '../src/shared/cutout-reference-profile'
import {createCutoutLayer,createCutoutScene} from '../src/shared/cutout-timeline'
import {renderCutoutSegment} from '../src/main/cutout-renderer'
import {reviewProductionComposition} from '../src/main/cutout-composition-review'
import {DEFAULT_CUTOUT_PRODUCTION} from '../src/shared/cutout-production'
import {saveCutoutAssetPlan} from '../src/main/cutout-assets'
import {projectDir} from '../src/main/paths'
import {resolveCaption,captionScaleOf} from '../src/shared/captions'
import {normalizeEditorEditPlan} from '../src/shared/editor-automation'
const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const check=async(name:string,fn:()=>unknown|Promise<unknown>)=>{await fn();checks.push(name);console.log('PASS',name)}
function png(r:number,b:number,transparent=false){const bytes=Buffer.alloc(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){let i=(y*64+x)*4;bytes[i]=b;bytes[i+2]=r;bytes[i+3]=transparent&&(x<8||y<8||x>55||y>55)?0:255}return nativeImage.createFromBitmap(bytes,{width:64,height:64}).toPNG()}
const old=structuredClone(builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!);old.version=2;old.timing.beatSeconds=2.5
function project(){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout',masterPrompt:old,synopsis:'Troli punya pintu berengsel agar bisa masuk berurutan, bukan mengecil.'});replaceScript(p.id,'Fixture',[{title:'Dua troli',story:'Troli masuk dan pintu bergerak.',narration:'Troli ini bisa masuk ke troli lain.',durationMs:2000}]);return p.id}
async function done(id:string){for(let n=0;n<3000;n++){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,20))}throw Error('timeout')}
app.whenReady().then(async()=>{
 await check('compact reference captions use no box, retain contrast outline, and validate scale bounds',()=>{
   const editor={captionStyle:'karaoke' as const,captionSize:'kecil' as const,captionScale:.5,captionColor:'#FFFFFF',captionHighlight:'#73F96C',captionBg:{color:'#1F1D1A',opacity:0}}
   const resolved=resolveCaption(editor)!;assert.equal(resolved.box,null);assert(resolved.outline>0);assert.equal(resolved.highlight,'#73F96C');assert.equal(captionScaleOf(editor),.5)
   assert.equal(normalizeEditorEditPlan({summary:'Caption',clips:[],editor}).editor?.captionBg?.opacity,0)
   assert.throws(()=>normalizeEditorEditPlan({summary:'Caption',clips:[],editor:{captionScale:10}}))
 })
 await check('old built-in snapshots receive connected-narration protocol; custom masters keep their authored rules',()=>{
   assert.equal(cutoutNarrativeSections(60),10);assert.match(masterStageDirection({masterPrompt:old,styleId:'cutout-facts'},'script'),/not isolated seven-word/)
   const custom={...old,id:'custom:own',stages:{...old.stages,script:'My specific script'}};assert(!isCutoutReference({masterPrompt:custom,styleId:'cutout-facts'}));assert(!masterStageDirection({masterPrompt:custom,styleId:'cutout-facts'},'script').includes('REFERENCE NARRATION PROTOCOL'))
   assert.deepEqual(cutoutCoverage([{cutout:null},{cutout:{enabled:true,layers:[{},{}]}},{cutout:{enabled:true,layers:[{}]}},{cutout:{enabled:true,specialVideo:{}}}]),{ready:2,total:4})
 })
 await check('script generation separates narration sections from 2.5-second shots and preserves first-section context',async()=>{
   const id=project();let prompt='';g.__scriptGenerate=async(o:any)=>{prompt=o.prompt;assert.match(o.system,/REFERENCE NARRATION PROTOCOL/);return {title:'Troli',scenes:Array.from({length:10},(_,i)=>({title:'Bagian '+i,story:'Arthur menunjukkan troli lalu bereaksi.',narration:i===0?'Troli ini punya pintu rahasia.\nCoba lihat bagian belakang keranjangnya.':i===9?'Bukan sulap. Pintu itulah yang mengalah.':'Dulu petugas perlu melepas keranjang, lalu melipat rangka untuk menyimpannya.'}))}}
   const b=await generateScript(id);assert.match(prompt,/about 10 connected narration sections/);assert(!prompt.includes('Reserve the LAST scene'));assert.equal(b.clips.length,10);assert.match(b.clips[0].narration,/Coba lihat/);assert.match(b.clips[9].narration,/Pintu itulah.*\nKalau/s);assert(b.clips.some(c=>c.durationMs!==b.clips[0].durationMs));
 })
 await check('narration revisions preserve source and all copied media, clear stale audio, and retry without duplicate projects',async()=>{
   const id=project(),before=getEditingContext(id),b=getBundle(id),clip=b.clips[0];const file='kept.png';writeFileSync(join(projectDir(id),file),png(200,0));const a=insertAsset({projectId:id,clipId:clip.id,kind:'image',provider:'codex',localPath:file,width:64,height:64});patchClip(clip.id,{imageAssetId:a.id});
   const current=getEditingContext(id),input={projectId:id,expectedRevision:current.revision,title:'Troli · Revisi',clips:[{clipId:clip.id,title:'Pintu rahasia',story:'Arthur menunjuk pintu keranjang. Satu aksi, lalu reaksi.',narration:'Troli bisa masuk berurutan. Yang mengalah cuma pintunya.'}]}
   await assert.rejects(createScriptRevision({...input,expectedRevision:before.revision}),/Revisi|revisi/)
   await assert.rejects(createScriptRevision({...input,clips:[{...input.clips[0],clipId:'foreign'}]}),/memetakan/)
   const revision=await createScriptRevision(input),copy=getBundle(revision.projectId);assert.equal(getEditingContext(id).revision,current.revision);assert.equal(copy.assets.length,getBundle(id).assets.length);assert.equal(copy.clips[0].audioAssetId,null);assert.equal(copy.clips[0].cutout,null);assert.equal(copy.project.masterPrompt?.version,3);assert.equal(copy.project.editor.captionStyle,'karaoke');assert(existsSync(join(projectDir(copy.project.id),file)));assert.equal(copy.clips[0].narration,input.clips[0].narration)
   const repeated=await createScriptRevision(input);assert.equal(repeated.projectId,revision.projectId);assert.equal(repeated.reused,true)
 })
 await check('review capture draws actual animated composition without FFmpeg at selected times',async()=>{
   const red=join(root,'red.png'),blue=join(root,'blue.png');writeFileSync(red,png(240,0));writeFileSync(blue,png(0,240));const scene=createCutoutScene(),bg=createCutoutLayer('bg','bg','r'),actor=createCutoutLayer('actor','actor','b');bg.width=1;bg.depth=0;actor.width=.2;actor.transform.x=.2;actor.transform.y=.5;actor.depth=0;actor.keyframes=[{id:'move',timeMs:1000,transform:{...actor.transform,x:.8},easing:'linear'}];scene.layers=[bg,actor]
   const frames=[{timeMs:0,path:join(root,'actual-frame-0.png')},{timeMs:1000,path:join(root,'actual-frame-1.png')}];await renderCutoutSegment({scene,images:[{id:'r',path:red},{id:'b',path:blue}],width:320,height:180,fps:30,durationMs:1100,outputPath:'',ffmpegPath:'THIS MUST NOT EXECUTE',signal:new AbortController().signal,reviewFrames:frames});
   const pixel=(file:string,x:number,y:number)=>{const im=nativeImage.createFromPath(file),b=im.getBitmap();return [...b.subarray((y*320+x)*4,(y*320+x)*4+4)]};assert(pixel(frames[0].path,64,90)[0]>200);assert(pixel(frames[1].path,64,90)[2]>200);assert(pixel(frames[1].path,256,90)[0]>200)
   await assert.rejects(renderCutoutSegment({scene,images:[{id:'r',path:red},{id:'b',path:blue}],width:320,height:180,fps:30,durationMs:1100,outputPath:'',ffmpegPath:'',signal:new AbortController().signal,reviewFrames:[{timeMs:1100,path:join(root,'outside.png')}]}),/sampel/)
 })
 await check('visual review sees rendered files, rejects contradictory approval and allows safe repeated review folders',async()=>{
   const id=project(),b=getBundle(id),clip=b.clips[0],file='bg.png';writeFileSync(join(projectDir(id),file),png(200,0));const a=insertAsset({projectId:id,clipId:clip.id,kind:'image',provider:'codex',localPath:file,width:64,height:64});const scene=createCutoutScene(),l=createCutoutLayer('bg','Location',a.id);l.width=1;l.depth=0;scene.layers=[l];const bundle=getBundle(id),plan=saveCutoutAssetPlan(clip.id,[{id:'bg',role:'background',label:'Location',prompt:'A realistic location without people.',characterId:null,timeMs:0}]);let seen=0
   g.__assetPlan=async(o:any)=>{seen++;assert(o.images.length>=3);assert(o.images.every((f:string)=>existsSync(f)));assert.match(o.system,/ACTUAL COMPOSITED/);return {approved:false,problems:['Only a background is visible; the narrated cart is missing.'],missingAssets:['Cart and contextual character pose']}}
   const input={bundle,clip,scene,plan,jobId:'review-fixture',signal:new AbortController().signal},review=await reviewProductionComposition(input);assert.equal(review.approved,false);assert.equal(review.missingAssets.length,1);await reviewProductionComposition(input);assert.equal(seen,2)
   g.__assetPlan=async()=>({approved:true,problems:['still wrong'],missingAssets:[]});await assert.rejects(reviewProductionComposition(input),/belum valid/)
 })
 await check('production refuses visually wrong composition atomically, preserves completed images, and resumes without regeneration',async()=>{
   const id=project();let images=0,approved=false,plans=0;
   g.__assetGenerate=async(o:any)=>{images++;return {bytes:png(200,0,!o.prompt.includes('Role: background'))}}
   g.__assetPlan=async(o:any)=>{
     if(o.schema?.properties?.approved)return approved?{approved:true,problems:[],missingAssets:[]}:{approved:false,problems:['The actor is not a useful acting pose.'],missingAssets:['Contextual pose']}
     if(o.schema?.properties?.items){plans++;const items=[{id:'bg',role:'background',layerKey:'bg',label:'Location',prompt:'A location',characterId:null,timeMs:0},{id:'actor',role:'character',layerKey:'actor',label:'Actor',prompt:'One isolated actor.',characterId:null,timeMs:0}];return {items,director:{timing:'provisional',shots:[{startMs:0,endMs:2000,narrationCue:'Troli ini',action:'Troli masuk',location:'Toko',focus:'Troli',startPose:'mendorong',endPose:'berhenti',reaction:'penasaran',camera:'medium',occlusion:'tidak ada',contact:'roda lantai',sfxCue:'roda',assetIds:['bg','actor']}],specialAssets:[]}}}
     const p=JSON.parse(o.prompt);return {summary:'Fixture composition',clips:[{clipId:p.scope.clipId,cutout:p.seedComposition,transition:null,durationMs:null}],editor:null}
   }
   const options={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:12,maxNewAssets:12,motion:'keyframes' as const},request={projectId:id,instruction:'Follow actions.',production:options};const first=await done(startCodexAutoEdit(request).id);assert.equal(first.status,'failed');assert.match(first.error!,/tinjauan visual/);assert.equal(getBundle(id).clips[0].cutout,null);const completed=images;assert.equal(completed,2);approved=true;
   const next=await done(startCodexAutoEdit(request).id);assert.equal(next.status,'done',next.error??'');assert.equal(images,completed);assert.equal(plans,1);assert.equal(getBundle(id).project.editor.captionStyle,'karaoke')
 })
 await check('one visual layout repair is rendered and reviewed before apply without regenerating assets',async()=>{
   const id=project();let generated=0,reviews=0,repairs=0;const base=g.__assetPlan
   g.__assetGenerate=async(o:any)=>{generated++;return {bytes:png(200,0,!o.prompt.includes('Role: background'))}}
   g.__assetPlan=async(o:any)=>{
     if(o.schema?.properties?.approved)return ++reviews===1?{approved:false,problems:['The prop is partially out of frame.'],missingAssets:[]}:{approved:true,problems:[],missingAssets:[]}
     const prompt=JSON.parse(o.prompt);if(prompt.original){repairs++;assert(o.images.length>=3);return {...prompt.original,summary:'Corrected layout from actual frames',editor:null}}
     return base(o)
   }
   const job=await done(startCodexAutoEdit({projectId:id,instruction:'One action.',production:{...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:12,maxNewAssets:12,motion:'keyframes'}}).id);assert.equal(job.status,'done',job.error??'');assert.equal(reviews,2);assert.equal(repairs,1);assert.equal(generated,2);assert(getBundle(id).clips[0].cutout?.enabled)
 })
 writeFileSync(join(root,'troli-fidelity-check.json'),JSON.stringify({status:'passed',checks,actualElectron:true,actualSQLite:true,actualCanvas:true,providerResponses:'controlled',liveUserDatabaseTouched:false},null,2));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
