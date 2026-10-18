import assert from 'node:assert/strict'
import {app,nativeImage} from 'electron'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {closeDb} from '../src/main/db'
import {createProject,replaceScript,getBundle,getJob} from '../src/main/repo'
import {startCodexAutoEdit} from '../src/main/editor-automation'
import {builtInMasterPrompts} from '../src/shared/master-prompts'
import {DEFAULT_CUTOUT_PRODUCTION} from '../src/shared/cutout-production'
import {cutoutAssetIds} from '../src/shared/cutout-timeline'
const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
async function done(id:string){for(let i=0;i<4000;i++){const job=getJob(id)!;if(['done','failed','canceled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,20))}throw Error('timeout')}
function png(alpha:boolean){const b=Buffer.alloc(90*160*4);for(let y=0;y<160;y++)for(let x=0;x<90;x++){const n=(y*90+x)*4;b[n]=110;b[n+1]=160;b[n+2]=220;b[n+3]=alpha&&(x<8||x>81||y<8||y>151)?0:255}return nativeImage.createFromBitmap(b,{width:90,height:160}).toPNG()}
const production={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:32,maxNewAssets:10,motion:'keyframes' as const}
function project(){const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout',masterPrompt:builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!});replaceScript(p.id,'Fixture',[{title:'Engsel pintu',narration:'Tokoh menjelaskan pintu berengsel.',story:'Satu aksi menjelaskan.',durationMs:2000}]);return p.id}
let scenario='',images=0,inclusions=0,movement=0,reviews=0,conversions=0,fullScene:any,propIds:string[]=[],lastOmitted:string[]=[]
const reset=(value:string)=>{scenario=value;images=0;inclusions=0;movement=0;reviews=0;conversions=0;propIds=[];lastOmitted=[]}
function without(ids:string[]){const scene=structuredClone(fullScene);scene.layers=scene.layers.filter((layer:any)=>!ids.includes(layer.assetId));return scene}
const response=(clipId:string,scene:any)=>({summary:'Komposisi uji',clips:[{clipId,cutout:scene,transition:null,durationMs:null}],editor:null})
g.__assetGenerate=async(o:any)=>{images++;return {bytes:png(!o.prompt.includes('Role: background'))}}
g.__assetPlan=async(o:any)=>{
 if(o.schema?.properties?.approved){reviews++;assert(o.images?.every((f:string)=>existsSync(f)));const ok={approved:true,problems:[],missingAssets:[]};
  if(scenario==='movement'||scenario==='shared-budget')return movement<3?{approved:false,problems:['Pelanggaran gerak'],missingAssets:[]}:ok
  if(scenario==='drop-during-movement')return movement===0?{approved:false,problems:['Perlu hold pada penjelasan'],missingAssets:[]}:ok
  if(scenario==='new-asset'&&conversions===0)return {approved:false,problems:['Baut belum tersedia'],missingAssets:['Baut transparan tampak samping']}
  return ok
 }
 const p=JSON.parse(o.prompt)
 if(p.requests){conversions++;return {items:p.requests.map((r:any)=>({id:r.id,role:'prop',label:'Baut tambahan',prompt:r.description+' isolated alpha.',characterId:null,timeMs:0,layerKey:'new-prop'}))}}
 if(p.ignoredAssetIds){
  inclusions++;lastOmitted=p.ignoredAssetIds;assert(o.images.length>=3);assert(o.images.every((f:string)=>existsSync(f)));assert(o.system.includes('BOLEH hold/statis'));assert(o.system.includes('Batas 2 layer bergerak tetap berlaku'));for(const id of p.ignoredAssetIds)assert(o.system.includes(id));
  let scene=structuredClone(fullScene)
  if((scenario==='two'||scenario==='movement')&&inclusions===1)scene=without([propIds[1]])
  if(scenario==='terminal')scene=without([propIds[1]])
  return response(p.original.clips[0].clipId,scene)
 }
 if(p.original){movement++;assert(o.system.includes('Aset yang tidak bergerak tetap dihitung sebagai dipakai'));let scene=structuredClone(fullScene);if(scenario==='drop-during-movement')scene=without([propIds[0]]);if(scenario==='shared-budget')scene=without([propIds[(movement-1)%2]]);return response(p.original.clips[0].clipId,scene)}
 if(o.schema?.properties?.items){const items=[{id:'bg',role:'background',label:'Background',prompt:'A realistic clean plate without people.',characterId:null,timeMs:0,layerKey:'bg'},{id:'actor',role:'character',label:'Tokoh',prompt:'Photographic person isolated alpha.',characterId:null,timeMs:0,layerKey:'actor'},...['a','b'].map(name=>({id:name,role:'prop',label:'Properti '+name,prompt:'One isolated mechanical prop.',characterId:null,timeMs:0,layerKey:name}))];return {items,director:{timing:'provisional',shots:[{startMs:0,endMs:2000,narrationCue:'menjelaskan',action:'menjelaskan',location:'Toko',focus:'pintu',startPose:'menjelaskan',endPose:'hold',reaction:'penasaran',camera:'medium',occlusion:'tidak ada',contact:'tidak ada',sfxCue:'tidak ada',assetIds:items.map(i=>i.id)}],specialAssets:[]}}}
 assert(o.system.includes('Aset yang tidak bergerak tetap dihitung sebagai dipakai'));fullScene=p.seedComposition;propIds=fullScene.layers.slice(2,4).map((layer:any)=>layer.assetId)
 let scene=structuredClone(fullScene)
 if(['one','two','terminal','movement'].includes(scenario))scene=without(scenario==='one'?[propIds[1]]:propIds)
 if(scenario==='new-asset'&&p.previousComposition)scene=without([fullScene.layers.at(-1).assetId])
 return response(p.scope.clipId,scene)
}
async function check(name:string,run:()=>Promise<void>){await run();checks.push(name);console.log('PASS',name)}
void app.whenReady().then(async()=>{
 await check('initial ignored asset is restored as a static layer using actual frame evidence without regeneration',async()=>{
  reset('one');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'done',j.error??'');assert.equal(inclusions,1);assert.equal(images,4);assert.equal(conversions,0);const scene=getBundle(id).clips[0].cutout!;assert.equal(cutoutAssetIds(scene).length,4);assert(scene.layers.every(l=>!l.keyframes.length));assert.equal(reviews,2)
 })
 await check('a changing omitted ID list receives at most two additional inclusion repairs',async()=>{
  reset('two');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'done',j.error??'');assert.equal(inclusions,2);assert.equal(images,4);assert.deepEqual(lastOmitted,[propIds[1]]);assert.equal(cutoutAssetIds(getBundle(id).clips[0].cutout).length,4)
 })
 await check('two failed inclusion repairs report latest omitted IDs and apply no partial composition',async()=>{
  reset('terminal');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'failed');assert.equal(inclusions,2);assert.match(j.error!,/setelah dua percobaan/);assert(j.error!.includes(propIds[1]));assert(!j.error!.includes(propIds[0]));assert.equal(getBundle(id).clips[0].cutout,null);assert.equal(getBundle(id).assets.length,4)
 })
 await check('the three visual repairs remain available after both inclusion repairs are used',async()=>{
  reset('movement');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'done',j.error??'');assert.equal(inclusions,2);assert.equal(movement,3);assert.equal(reviews,6);assert.equal(images,4)
 })
 await check('an asset dropped by a movement repair enters inclusion repair instead of hard-throwing',async()=>{
  reset('drop-during-movement');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'done',j.error??'');assert.equal(movement,1);assert.equal(inclusions,1);assert.equal(images,4);assert.equal(cutoutAssetIds(getBundle(id).clips[0].cutout).length,4)
 })
 await check('a newly generated asset ignored by recomposition is restored from the current project inventory',async()=>{
  reset('new-asset');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'done',j.error??'');assert.equal(conversions,1);assert.equal(images,5);assert.equal(inclusions,1);assert.equal(cutoutAssetIds(getBundle(id).clips[0].cutout).length,5);assert(lastOmitted[0]===fullScene.layers.at(-1).assetId)
 })
 await check('inclusion retry allowance is shared across the clip rather than reset by each movement repair',async()=>{
  reset('shared-budget');const id=project(),j=await done(startCodexAutoEdit({projectId:id,instruction:'Satu aksi.',production}).id);assert.equal(j.status,'failed');assert.equal(inclusions,2);assert.equal(movement,3);assert.match(j.error!,/setelah dua percobaan/);assert.equal(images,4);assert.equal(getBundle(id).clips[0].cutout,null)
 })
 const result={status:'passed',checks,actualElectron:true,actualSQLite:true,actualCanvasFrames:true,providers:'controlled; no external generation',userProjectsChanged:false};writeFileSync(join(root,'asset-inclusion-repair-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
