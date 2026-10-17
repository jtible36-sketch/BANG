import assert from 'node:assert/strict'
import { app, BrowserWindow, nativeImage } from 'electron'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { getDb, closeDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, getJob, patchClip, insertAsset, updateJob } from '../src/main/repo'
import { cutoutAssetState, generateCutoutAsset, planCutoutAssets, recoverCutoutAssets, saveCutoutAssetPlan } from '../src/main/cutout-assets'
import { cancelJob } from '../src/main/jobs'
import { readManagedImageBytes } from '../src/main/media-import'
import { createCutoutLayer, createCutoutScene } from '../src/shared/cutout-timeline'
import { createCutoutMask, cutoutMaskAt, normalizeCutoutMaskKeys } from '../src/shared/cutout-mask'
import { normalizeCutoutDirector, cutoutDirectorSchema } from '../src/shared/cutout-director'
import { renderCutoutSegment } from '../src/main/cutout-renderer'

const root=resolve(process.argv[2]),g=globalThis as any,checks:string[]=[]
mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
const check=async(name:string,fn:()=>unknown|Promise<unknown>)=>{try{await fn();checks.push(name)}catch(error){console.error('FAILED CHECK:',name);throw error}}
function png(w:number,h:number,color:[number,number,number],screen=false):Buffer {
  const bytes=Buffer.alloc(w*h*4)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4,inside=!screen||(x>w*.2&&x<w*.8&&y>h*.2&&y<h*.8),rgb=inside?color:[255,0,255];bytes[at]=rgb[2];bytes[at+1]=rgb[1];bytes[at+2]=rgb[0];bytes[at+3]=255}
  return nativeImage.createFromBitmap(bytes,{width:w,height:h}).toPNG()
}
async function done(id:string){const deadline=Date.now()+10000;while(Date.now()<deadline){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,10))}throw new Error('Job timeout')}
void app.whenReady().then(async()=>{
  const p=createProject({durationSec:60,styleId:'cutout-facts',skillId:'animasi-cutout'});replaceScript(p.id,'Fixture',[{title:'Reaction',story:'Tokoh terkejut melihat alat.',narration:'Tokoh melihat alat lalu terkejut.',durationMs:4000}])
  const clipId=getBundle(p.id).clips[0].id,item={id:'prop',role:'prop' as const,label:'Alat',prompt:'One isolated tool used in this action.',characterId:null,timeMs:500}
  const opaque=png(100,100,[20,220,20],true),rawPath=join(root,'flow.png');writeFileSync(rawPath,opaque);g.__flowImage=rawPath;g.__flowCalls=[]
  g.__assetGenerate=async()=>({bytes:opaque});g.__assetPlan=async(options:any)=>{const shot={startMs:0,endMs:4000,narrationCue:'Tokoh melihat alat',action:'memperlihatkan alat',location:'meja',focus:'alat',startPose:'netral',endPose:'menunjuk',reaction:'penasaran',camera:'detail',occlusion:'tangan di depan alat',contact:'jari pada pegangan',sfxCue:'ketuk bila tersedia',assetIds:['prop']};assert(options.schema.properties.director);return {items:[item],director:{timing:'provisional',shots:[shot],specialAssets:[]}}}
  await check('narration plan persists through real job queue and SQLite',async()=>{const job=planCutoutAssets(clipId),result=await done(job.id);assert.equal(result.status,'done',result.error??'');assert.equal(cutoutAssetState(clipId).plan?.items[0].role,'prop');assert.equal(cutoutAssetState(clipId).plan?.director?.shots[0].camera,'detail')})
  let plan=cutoutAssetState(clipId).plan!
  await check('directing blueprint rejects fake timing, foreign asset references and incomplete ranges',()=>{
    const direction=plan.director!;assert(direction)
    assert.throws(()=>normalizeCutoutDirector({...direction,timing:'recorded'},4000,plan.items,false))
    assert.throws(()=>normalizeCutoutDirector({...direction,shots:[{...direction.shots[0],assetIds:['foreign']}]},4000,plan.items,false))
    assert.throws(()=>normalizeCutoutDirector({...direction,shots:[{...direction.shots[0],endMs:3000}]},4000,plan.items,false))
    assert.throws(()=>normalizeCutoutDirector({...direction,shots:[{...direction.shots[0],startMs:100}]},4000,plan.items,false))
  })
  await check('frame-aligned fractional durations accept integer directing endpoints without relaxing coverage or asset ownership',()=>{
    const direction=plan.director!
    for(const durationMs of [3333.3333333333335,3633.3333333333335,3666.6666666666665]){
      const endMs=Math.floor(durationMs),candidate={...direction,shots:[{...direction.shots[0],endMs}]}
      assert.equal(normalizeCutoutDirector(candidate,durationMs,plan.items,false).shots[0].endMs,endMs)
      assert.equal(cutoutDirectorSchema(durationMs).properties.shots.items.properties.endMs.maximum,endMs)
      assert.throws(()=>normalizeCutoutDirector({...candidate,shots:[{...candidate.shots[0],endMs:endMs-1}]},durationMs,plan.items,false),/shot terakhir/)
      assert.throws(()=>normalizeCutoutDirector({...candidate,shots:[{...candidate.shots[0],assetIds:['foreign']}]},durationMs,plan.items,false),/foreign/)
    }
  })
  await check('mask contour tracks interpolate, hold discrete topology and reject duplicate times',()=>{
    const base=createCutoutMask(),end={...base,width:.2,x:.4,feather:.1},keys=normalizeCutoutMaskKeys([{id:'mask-key',timeMs:1000,mask:end,easing:'linear'}],base)
    assert(Math.abs(cutoutMaskAt(base,keys,500)!.width-.6)<1e-9)
    assert.equal(cutoutMaskAt(base,[{...keys[0],mask:{...end,invert:true}}],500)!.invert,false)
    assert.equal(cutoutMaskAt(base,[{...keys[0],easing:'hold'}],999)!.width,1)
    assert.equal(cutoutMaskAt(base,[{...keys[0],easing:'hold'}],1000)!.width,.2)
    assert.throws(()=>normalizeCutoutMaskKeys([keys[0],{...keys[0],id:'duplicate'}],base))
    assert.throws(()=>normalizeCutoutMaskKeys(keys,null))
  })
  await check('Codex asset is separate PNG with verified real alpha and does not replace scene image',async()=>{
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'codex',format:'png'}),result=await done(job.id);assert.equal(result.status,'done',result.error??'')
    const asset=getBundle(p.id).assets.find(a=>a.id===result.resultAssetId)!,image=nativeImage.createFromBuffer(readFileSync(join(app.getPath('userData'),'projects',p.id,asset.localPath)))
    assert.equal(image.toBitmap()[3],0);assert.equal((asset.meta.cutoutAsset as any).alpha,'chroma-matte');assert.equal(getBundle(p.id).clips[0].imageAssetId,null)
  })
  for (const mode of ['transient', 'persistent', 'provider-error'] as const) {
    await check('Windows cwd lock during cleanup: '+mode,async()=>{
      let child:ChildProcess|undefined,folder='';let exited:Promise<unknown>|undefined
      const original=g.__assetGenerate
      g.__assetGenerate=async(options:any)=>{
        folder=realpathSync(options.outputDirectory)
        const env={...process.env,ELECTRON_RUN_AS_NODE:'1'}
        child=spawn(process.execPath,['-e',mode==='transient'?'process.stdout.write("ready");setTimeout(()=>{},150)':'process.stdout.write("ready");setTimeout(()=>{},30000)'],{cwd:folder,env,windowsHide:true,stdio:['ignore','pipe','ignore']})
        exited=once(child,'exit');await once(child.stdout!,'data')
        // This exact Windows directory-lock error was reported by the user.
        if(process.platform==='win32')assert.throws(()=>rmSync(folder,{recursive:true,force:true}),{code:'EPERM'})
        if(mode==='provider-error')throw Error('original provider failure fixture')
        return {bytes:opaque}
      }
      try {
        const before=getBundle(p.id).assets.length
        const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'codex',format:'png'}),result=await done(job.id)
        if(mode==='provider-error'){assert.equal(result.status,'failed');assert.equal(result.error,'original provider failure fixture');assert.equal(getBundle(p.id).assets.length,before)}
        else {assert.equal(result.status,'done',result.error??'');assert(result.resultAssetId);assert.equal(getBundle(p.id).assets.length,before+1)}
        if(mode==='transient')assert.equal(existsSync(folder),false,'retry removes workspace after the child exits')
      } finally {
        g.__assetGenerate=original
        if(child&&child.exitCode===null&&child.signalCode===null)child.kill()
        await exited
        const tempRoot=realpathSync(tmpdir())
        if(folder&&dirname(folder)===tempRoot&&basename(folder).startsWith('naraflow-cutout-asset-')&&existsSync(folder)&&realpathSync(folder)===folder)rmSync(folder,{recursive:true,force:true})
      }
    })
  }
  await check('Flow output becomes lossless WebP alpha and one bounded submission',async()=>{
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'flow-mcp',format:'webp'}),result=await done(job.id);assert.equal(result.status,'done',result.error??'')
    const asset=getBundle(p.id).assets.find(a=>a.id===result.resultAssetId)!,file=join(app.getPath('userData'),'projects',p.id,asset.localPath)
    assert(file.endsWith('.webp'));const alpha=execFileSync(process.env.CUTOUT_FFMPEG!,['-hide_banner','-loglevel','error','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'],{windowsHide:true,maxBuffer:1024*1024});assert.equal(alpha[3],0)
    assert.equal(nativeImage.createFromBuffer(readManagedImageBytes(asset.id,p.id)).isEmpty(),false,'WebP can be read by Codex/MCP preview')
    const scene=g.__flowCalls.find((x:any)=>x.method==='generate').args.scenes[0];assert.equal(scene.variants,1);assert.equal(scene.retries,0);assert.equal(scene.max_credits,0)
  })
  await check('failed or canceled provider responses do not create usable fake transparent assets',async()=>{
    const before=getBundle(p.id).assets.length;let entered=false
    g.__assetGenerate=({signal}:any)=>new Promise((_r,reject)=>{entered=true;signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})})
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'codex',format:'png'});while(!entered)await new Promise(r=>setTimeout(r,10));await cancelJob(job.id);assert.equal((await done(job.id)).status,'canceled');assert.equal(getBundle(p.id).assets.length,before)
    g.__assetGenerate=async()=>({bytes:png(100,100,[200,200,200])});const invalid=generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'codex',format:'png'});assert.equal((await done(invalid.id)).status,'failed');assert.equal(getBundle(p.id).assets.length,before)
  })
  await check('changed narration rejects old package before generation',()=>{patchClip(clipId,{narration:'Narasi berubah.'});assert.equal(cutoutAssetState(clipId).stale,true);assert.throws(()=>generateCutoutAsset({clipId,planId:plan.id,itemId:'prop',provider:'codex',format:'png'}),/narasi terbaru/);plan=saveCutoutAssetPlan(clipId,[item])})
  await check('identity references are copied and passed to provider without changing master',async()=>{
    const db=getDb(),characterId='fixture-character';db.prepare('INSERT INTO characters (id,project_id,sort,name,description) VALUES (?,?,?,?,?)').run(characterId,p.id,0,'Pemeran','Identitas tetap')
    const imagePath=join(app.getPath('userData'),'projects',p.id,'images/master.png');mkdirSync(dirname(imagePath),{recursive:true});writeFileSync(imagePath,opaque)
    const master=insertAsset({projectId:p.id,characterId,kind:'image',localPath:'images/master.png',width:100,height:100});db.prepare('UPDATE characters SET sheet_asset_id=? WHERE id=?').run(master.id,characterId)
    patchClip(clipId,{characterIds:[characterId]});plan=saveCutoutAssetPlan(clipId,[{...item,id:'pose',role:'pose',characterId}])
    g.__assetGenerate=async(options:any)=>{assert.equal(options.referencePaths.length,1);assert.equal(nativeImage.createFromBuffer(readFileSync(options.referencePaths[0])).isEmpty(),false);assert(options.prompt.includes('identity'));return {bytes:opaque}}
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'pose',provider:'codex',format:'png'});assert.equal((await done(job.id)).status,'done');assert.equal(getBundle(p.id).characters[0].sheetAssetId,master.id)
  })
  await check('narration changes during image generation prevent stale assets from being adopted',async()=>{
    let release:((v:unknown)=>void)|undefined;const before=getBundle(p.id).assets.length
    g.__assetGenerate=()=>new Promise(resolve=>{release=resolve})
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'pose',provider:'codex',format:'png'})
    while(!release)await new Promise(r=>setTimeout(r,10))
    patchClip(clipId,{narration:'Narasi terbaru ketika provider masih bekerja.'});release!({bytes:opaque})
    assert.equal((await done(job.id)).status,'failed');assert.equal(getBundle(p.id).assets.length,before)
    plan=saveCutoutAssetPlan(clipId,[{...item,id:'pose',role:'pose',characterId:'fixture-character'}])
  })
  await check('uncertain or canceled Flow recovery adopts existing remote job without resubmission',async()=>{
    const before=g.__flowCalls.filter((x:any)=>x.method==='generate').length;g.__uncertain=true
    const job=generateCutoutAsset({clipId,planId:plan.id,itemId:'pose',provider:'flow-mcp',format:'png'});assert.equal((await done(job.id)).status,'failed');assert.throws(()=>generateCutoutAsset({clipId,planId:plan.id,itemId:'pose',provider:'flow-mcp',format:'png'}),/Pulihkan/)
    updateJob(job.id,{status:'canceled'});assert.throws(()=>generateCutoutAsset({clipId,planId:plan.id,itemId:'pose',provider:'flow-mcp',format:'png'}),/Pulihkan/)
    g.__uncertain=false;const recovered=await recoverCutoutAssets(clipId);assert.equal(recovered.length,1);assert.equal((await done(recovered[0].id)).status,'done');assert.equal(g.__flowCalls.filter((x:any)=>x.method==='generate').length,before+1)
  })
  await check('real Electron MP4 applies rect/inverse/feather masks and keyframed IK consistently',async()=>{
    const files:Record<string,string>={};for(const [id,color,w,h] of [['red',[240,20,20],100,20],['green',[20,240,20],100,20],['blue',[20,20,240],40,40],['white',[240,240,240],100,100]] as const){files[id]=join(root,id+'.png');writeFileSync(files[id],png(w,h,[...color] as [number,number,number]))}
    const scene=createCutoutScene();scene.backgroundColor='#101010'
    const upper=createCutoutLayer('u','Upper','red'),lower=createCutoutLayer('l','Lower','green'),effector=createCutoutLayer('e','End','blue'),masked=createCutoutLayer('mask','Masked','white'),inverse=createCutoutLayer('inv','Inverse','white')
    upper.width=lower.width=.2;upper.pivotX=lower.pivotX=0;upper.transform.x=.2;upper.transform.y=.6;lower.parentId='u';lower.transform.x=.2;lower.transform.y=0;effector.parentId='l';effector.transform.x=.2;effector.transform.y=0;effector.width=.03
    masked.width=.2;masked.transform.x=.2;masked.transform.y=.2;masked.mask={...createCutoutMask(),width:.5}
    inverse.width=.2;inverse.transform.x=.7;inverse.transform.y=.2;inverse.mask={...createCutoutMask(),width:.5,invert:true,feather:.015}
    scene.layers=[upper,lower,effector,masked,inverse];scene.ik=[{id:'ik',name:'IK',enabled:true,upperId:'u',lowerId:'l',endX:.2,endY:0,targetX:.45,targetY:.45,weight:1,bend:1,keyframes:[{id:'move',timeMs:1000,targetX:.55,targetY:.65,weight:1,easing:'linear'}]}]
    const output=join(root,'mask-ik-proof.mp4'),ffmpeg=process.env.CUTOUT_FFMPEG!
    await renderCutoutSegment({scene,images:Object.entries(files).map(([id,path])=>({id,path})),width:320,height:180,fps:10,durationMs:1200,outputPath:output,ffmpegPath:ffmpeg,signal:new AbortController().signal})
    const decoded=execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',output,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,maxBuffer:20*1024*1024}),frameSize=320*180*3
    const pixel=(frame:number,x:number,y:number)=>{const i=frame*frameSize+(y*320+x)*3;return [...decoded.subarray(i,i+3)]}
    assert(pixel(0,45,36)[0]>180);assert(pixel(0,80,36)[0]<40);assert(pixel(0,205,36)[0]<40);assert(pixel(0,240,36)[0]>180)
    assert(pixel(0,224,36)[0]>40&&pixel(0,224,36)[0]<220,'feather produces partial alpha at inverse-mask boundary')
    for(const [frame,tx,ty] of [[0,.45,.45],[10,.55,.65]]){let sx=0,sy=0,n=0;for(let y=65;y<175;y++)for(let x=0;x<320;x++){const c=pixel(frame,x,y);if(c[2]>150&&c[0]<90&&c[1]<90){sx+=x;sy+=y;n++}}assert(n>10);assert(Math.abs(sx/n-tx*320)<2);assert(Math.abs(sy/n-ty*180)<2)}
    assert.equal(BrowserWindow.getAllWindows().length,0)
  })
  await check('real MP4 renders independent mask reveal at actual frame times',async()=>{
    const scene=createCutoutScene(),layer=createCutoutLayer('reveal','Reflection reveal','white');scene.backgroundColor='#000000';layer.width=.5;layer.mask={...createCutoutMask(),width:.2};layer.maskKeyframes=[{id:'reveal-end',timeMs:1000,mask:{...layer.mask,width:.8},easing:'linear'}];scene.layers=[layer]
    const out=join(root,'mask-reveal.mp4'),ffmpeg=process.env.CUTOUT_FFMPEG!
    await renderCutoutSegment({scene,images:[{id:'white',path:join(root,'white.png')}],width:320,height:180,fps:10,durationMs:1200,outputPath:out,ffmpegPath:ffmpeg,signal:new AbortController().signal})
    const bytes=execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',out,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,maxBuffer:20*1024*1024}),at=(frame:number)=>bytes[frame*320*180*3+(90*320+190)*3]
    assert(at(0)<20);assert(at(5)<20);assert(at(10)>200,'expanded mask reveals source pixels by frame 10');if(process.env.CUTOUT_TEST_OUTPUT){mkdirSync(process.env.CUTOUT_TEST_OUTPUT,{recursive:true});writeFileSync(join(process.env.CUTOUT_TEST_OUTPUT,'mask-reveal.mp4'),readFileSync(out))}
  })
  closeDb();const result={status:'passed',checks,actualElectron:true,actualSQLite:true,providerCalls:'controlled responses; no external image generation',liveUserDatabaseTouched:false,proof:join(root,'mask-ik-proof.mp4')};writeFileSync(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.quit()
}).catch(error=>{console.error(error);closeDb();app.exit(1)})
