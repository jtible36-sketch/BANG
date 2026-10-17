import assert from 'node:assert/strict'
import { app, nativeImage, BrowserWindow, ipcMain } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join,resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { closeDb, getDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, getJob, patchClip, insertAsset } from '../src/main/repo'
import { startCodexAutoEdit, resumeCodexAutoEdit, ensureEditorsReady, updateEditorPresence, getEditingContext, undoEditingPlan } from '../src/main/editor-automation'
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
const options={...DEFAULT_CUTOUT_PRODUCTION,maxAssetsPerClip:128,maxNewAssets:128},request=(p:{id:string;clipId:string},instruction='Buat aksi dengan banyak pose')=>({projectId:p.id,clipId:p.clipId,instruction,production:options})
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
  const bg=png(90,160,[45,75,100]),sprite=png(48,80,[30,220,50],true),calls:any[]=[]
  g.__assetGenerate=async(o:any)=>{calls.push(o);return {bytes:o.prompt.includes('Role: background')?bg:sprite}}
  g.__assetPlan=planner(3)
  await check('expired saved heartbeat asks actual renderer for a nonce reply before continuing',async()=>{
    const q=project(),win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,backgroundThrottling:false}}),originalNow=Date.now
    let requests=0;const reply=(event:any,input:any)=>{if(event.sender.id===win.webContents.id){requests++;updateEditorPresence(event.sender.id,input)}}
    ipcMain.on('fixture:presence',reply)
    await win.loadURL('data:text/html,'+encodeURIComponent('<script>const {ipcRenderer}=require("electron");ipcRenderer.on("event:editorPresenceRequest",(_,e)=>ipcRenderer.send("fixture:presence",{projectId:'+JSON.stringify(q.id)+',saveState:"saved",nonce:e.nonce}));</script>'))
    updateEditorPresence(win.webContents.id,{projectId:q.id,saveState:'saved'})
    try{Date.now=()=>originalNow()+60000;await ensureEditorsReady(q.id);assert.equal(requests,1);Date.now=originalNow;updateEditorPresence(win.webContents.id,{projectId:q.id,saveState:"saved"});Date.now=()=>originalNow()+60000;const j=await done(startCodexAutoEdit(request(q)).id);assert.equal(j.status,"done",j.error??"");assert.equal(requests,2)}finally{Date.now=originalNow;win.destroy();ipcMain.removeListener('fixture:presence',reply)}
  })
  await check('fresh dirty reply still blocks; aborting an unanswered request cleans pending work',async()=>{
    const q=project(),win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,backgroundThrottling:false}}),originalNow=Date.now
    const reply=(event:any,input:any)=>{if(event.sender.id===win.webContents.id)updateEditorPresence(event.sender.id,input)};ipcMain.on('fixture:presence',reply)
    await win.loadURL('data:text/html,'+encodeURIComponent('<script>const {ipcRenderer}=require("electron");ipcRenderer.on("event:editorPresenceRequest",(_,e)=>ipcRenderer.send("fixture:presence",{projectId:'+JSON.stringify(q.id)+',saveState:"dirty",nonce:e.nonce}));</script>'))
    updateEditorPresence(win.webContents.id,{projectId:q.id,saveState:'saved'})
    try{Date.now=()=>originalNow()+60000;await assert.rejects(ensureEditorsReady(q.id),/belum tersimpan/);Date.now=originalNow;updateEditorPresence(win.webContents.id,{projectId:q.id,saveState:'saved'});Date.now=()=>originalNow()+60000;const abort=new AbortController();abort.abort();await assert.rejects(ensureEditorsReady(q.id,abort.signal),/dibatalkan/)}finally{Date.now=originalNow;win.destroy();ipcMain.removeListener('fixture:presence',reply)}
  })
  await check('real production continues after a long image task expires the periodic heartbeat',async()=>{
    const q=project(),win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,backgroundThrottling:false}}),originalNow=Date.now,originalGenerate=g.__assetGenerate;let shift=0,requests=0
    const reply=(event:any,input:any)=>{if(event.sender.id===win.webContents.id){requests++;updateEditorPresence(event.sender.id,input)}};ipcMain.on('fixture:presence',reply)
    await win.loadURL('data:text/html,'+encodeURIComponent('<script>const {ipcRenderer}=require("electron");ipcRenderer.on("event:editorPresenceRequest",(_,e)=>ipcRenderer.send("fixture:presence",{projectId:'+JSON.stringify(q.id)+',saveState:"saved",nonce:e.nonce}));</script>'))
    updateEditorPresence(win.webContents.id,{projectId:q.id,saveState:'saved'})
    try{Date.now=()=>originalNow()+shift;g.__assetGenerate=async(o:any)=>{shift=30000;return originalGenerate(o)};const j=await done(startCodexAutoEdit(request(q)).id);assert.equal(j.status,'done',j.error??'');assert(requests>=1);assert.equal(getBundle(q.id).assets.length,3)}finally{Date.now=originalNow;g.__assetGenerate=originalGenerate;win.destroy();ipcMain.removeListener('fixture:presence',reply)}
  })
  await check('interrupted image queue resumes only missing items with exact saved settings after SQLite reopen',async()=>{
    const q=project(),original=g.__assetGenerate,prior=calls.length;let submitted=0
    g.__assetGenerate=async(o:any)=>{if(++submitted===3)throw Error('fixture interrupted provider');return original(o)}
    const first=await done(startCodexAutoEdit({...request(q,'Arahan tersimpan'),production:{...options,maxAssetsPerClip:32,maxNewAssets:10}}).id);assert.equal(first.status,'failed');assert.equal(getBundle(q.id).assets.length,2);const planId=cutoutAssetState(q.clipId).plan!.id;closeDb();g.__assetGenerate=original
    const second=await done(resumeCodexAutoEdit(q.id,first.id).id);assert.equal(second.status,'done',second.error??'');assert.equal(calls.length-prior,3);assert.equal(cutoutAssetState(q.clipId).plan!.id,planId);assert.equal(getBundle(q.id).assets.length,3);assert.equal(getEditingContext(q.id).resumeJobId,first.id)
  })
  await check('valid completed package survives changed instruction and asset limit without generating from zero',async()=>{
    const q=project();let j=await done(startCodexAutoEdit({...request(q),production:{...options,maxAssetsPerClip:32}}).id);assert.equal(j.status,'done',j.error??'');const n=calls.length,planId=cutoutAssetState(q.clipId).plan!.id;j=await done(startCodexAutoEdit({...request(q,'Perjelas reaksi saja'),production:{...options,maxAssetsPerClip:64}}).id);assert.equal(j.status,'done',j.error??'');assert.equal(calls.length,n);assert.equal(cutoutAssetState(q.clipId).plan!.id,planId)
  })
  await check('completed first-clip composition is reused after later composition fails, with atomic project apply',async()=>{
    const q=project();replaceScript(q.id,'Dua shot',[{title:'Pertama',narration:'Satu aksi',story:'Satu aksi',durationMs:2000},{title:'Kedua',narration:'Reaksi',story:'Reaksi',durationMs:2000}]);const ids=getBundle(q.id).clips.map(c=>c.id),compose:string[]=[],plan=planner(3);let fail=true
    g.__assetPlan=async(o:any)=>{if(!o.schema.properties.items&&!o.schema.properties.shots){const id=JSON.parse(o.prompt).scope.clipId;compose.push(id);if(id===ids[1]&&fail)throw Error('fixture later composition failed')}return plan(o)}
    const first=await done(startCodexAutoEdit({...request(q),clipId:undefined}).id);assert.equal(first.status,'failed');assert(getBundle(q.id).clips.every(c=>c.cutout===null));const n=calls.length;closeDb();fail=false
    const next=await done(resumeCodexAutoEdit(q.id,first.id).id);assert.equal(next.status,'done',next.error??'');assert.equal(calls.length,n);assert.equal(compose.filter(id=>id===ids[0]).length,1);assert.equal(compose.filter(id=>id===ids[1]).length,2);assert(getBundle(q.id).clips.every(c=>c.cutout?.enabled));g.__assetPlan=planner(3)
  })
  await check('resume rejects a foreign project or an active/done job',async()=>{const q=project(),other=project();const j=await done(startCodexAutoEdit(request(q)).id);assert.equal(j.status,'done');assert.throws(()=>resumeCodexAutoEdit(other.id,j.id),/proyek/);assert.throws(()=>resumeCodexAutoEdit(q.id,j.id),/dilanjutkan/)})
  writeFileSync(join(root,'result.json'),JSON.stringify({status:'passed',checks,realElectronRenderer:true,realSQLite:true,externalGeneration:'controlled responses only',userDatabaseTouched:false},null,2));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})