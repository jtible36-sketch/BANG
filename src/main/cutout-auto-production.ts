import { nativeImage } from 'electron'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import type { Asset, Clip } from '@shared/types'
import type { CutoutAssetPlan } from '@shared/cutout-assets'
import type { CutoutProductionOptions, AutoEditInput } from '@shared/cutout-production'
import { generatedForItem } from '@shared/cutout-production'
import { cutoutAssetState, cutoutProviderStatus, generateCutoutAsset, planCutoutAssets, directCutoutAssets } from './cutout-assets'
import { getBundle, getJob } from './repo'
import { cancelJob, type TaskCtx } from './jobs'
import { readManagedImageBytes } from './media-import'

export function productionPlanningKey(options:{maxAssets?:number;motion?:string;instruction?:string}):string {
  return createHash('sha256').update(JSON.stringify([options.maxAssets,options.motion,options.instruction])).digest('hex')
}
export async function waitChild(id:string,signal:AbortSignal):Promise<void> {
  const abort=():void=>{void cancelJob(id).catch(()=>{})}
  signal.addEventListener('abort',abort,{once:true})
  try {
    for(;;){
      if(signal.aborted){abort();signal.throwIfAborted()}
      const job=getJob(id)
      if(!job)throw new Error('Pekerjaan aset tidak ditemukan.')
      if(job.status==='done')return
      if(['failed','canceled'].includes(job.status))throw new Error(job.error||'Pembuatan aset dibatalkan. Aset selesai tetap tersedia di Cutout.')
      await new Promise<void>(resolve=>{const timer=setTimeout(done,100);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve()}signal.addEventListener('abort',done,{once:true})})
    }
  } finally {signal.removeEventListener('abort',abort)}
}
/** The coordinator owns a separate queue: it can await serialized Codex children without deadlocking. */
export async function prepareProductionAssets(input:AutoEditInput,options:CutoutProductionOptions,clips:Clip[],ctx:TaskCtx,guard:()=>void|Promise<void>):Promise<Map<string,CutoutAssetPlan>> {
  // A fresh saved package is a durable checkpoint. Explicit replanning stays in Cutout.
  const plans=new Map<string,CutoutAssetPlan>(),planOptions={maxAssets:options.maxAssetsPerClip,motion:options.motion,instruction:input.instruction,codex:input.codex}
  for(let i=0;i<clips.length;i++){
    ctx.signal.throwIfAborted();await guard();let state=cutoutAssetState(clips[i].id)
    if(state.stale||!state.plan){
      ctx.progress(.03+.12*i/clips.length,`Menyusun kebutuhan ${i+1}/${clips.length}: ${clips[i].title}`)
      await waitChild(planCutoutAssets(clips[i].id,planOptions).id,ctx.signal);await guard();state=cutoutAssetState(clips[i].id)
    }
    if(state.plan&&!state.stale&&!state.plan.director){
      await waitChild(directCutoutAssets(clips[i].id,input.codex).id,ctx.signal);await guard();state=cutoutAssetState(clips[i].id)
    }
    if(!state.plan||state.stale)throw new Error('Kebutuhan aset belum siap atau narasi berubah.')
    if(state.plan.items.length>options.maxAssetsPerClip)throw new Error('Paket kebutuhan melebihi batas aset per klip. Naikkan batas atau tinjau paket di Cutout sebelum generate.')
    plans.set(clips[i].id,state.plan)
  }
  const missing=[...plans.values()].flatMap(plan=>plan.items.filter(item=>!generatedForItem(getBundle(input.projectId).assets,plan,item.id)).map(item=>({plan,item})))
  const total=[...plans.values()].reduce((n,p)=>n+p.items.length,0)
  ctx.progress(.15,`Memakai ${total-missing.length} aset tersimpan; ${missing.length} kebutuhan belum selesai.`)
  if(missing.length>options.maxNewAssets)throw new Error(`Perlu ${missing.length} gambar baru, melebihi batas proses ${options.maxNewAssets}. Kebutuhan sudah disimpan di Cutout; naikkan batas proses atau pilih satu klip. Belum ada gambar baru dikirim.`)
  if(missing.length){const status=await cutoutProviderStatus(options.provider);if(!status.ready)throw new Error(status.message)}
  for(let i=0;i<missing.length;i++){
    ctx.signal.throwIfAborted();await guard();const {plan,item}=missing[i]
    ctx.progress(.16+.54*i/Math.max(1,missing.length),`Generate aset tersisa ${i+1}/${missing.length} · ${item.label}`)
    await waitChild(generateCutoutAsset({clipId:plan.clipId,planId:plan.id,itemId:item.id,provider:options.provider,format:options.format}).id,ctx.signal)
    await guard()
  }
  return plans
}

/** Up to 256 images fit eight contact sheets. Cell coordinates explicitly map pixels to asset IDs. */
export function productionContactSheets(projectId:string,assets:Asset[],ids:string[],folder:string):{images:string[];previewAssets:{assetId:string;page:number;row:number;column:number}[];detailAssets:{assetId:string;image:number}[]} {
  const images:string[]=[],previewAssets:{assetId:string;page:number;row:number;column:number}[]=[]
  const columns=8,rows=4,cell=160,width=columns*cell,height=rows*cell
  for(let start=0;start<ids.length;start+=columns*rows){
    const pixels=Buffer.alloc(width*height*4,225),page=images.length+1
    for(let j=0;j<columns*rows&&start+j<ids.length;j++){
      const id=ids[start+j]
      if(!assets.some(a=>a.id===id))throw new Error('Aset komposisi tidak ditemukan.')
      let im=nativeImage.createFromBuffer(readManagedImageBytes(id,projectId,true));if(im.isEmpty())throw new Error('Preview aset tidak dapat dibaca: '+id)
      const size=im.getSize(),scale=Math.min(1,(cell-8)/Math.max(size.width,size.height))
      im=im.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))})
      const w=im.getSize().width,h=im.getSize().height,buf=im.toBitmap(),ox=(j%columns)*cell+Math.floor((cell-w)/2),oy=Math.floor(j/columns)*cell+Math.floor((cell-h)/2)
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=(y*w+x)*4,b=((oy+y)*width+ox+x)*4,alpha=buf[a+3]/255;for(let c=0;c<3;c++)pixels[b+c]=Math.round(buf[a+c]*alpha+225*(1-alpha));pixels[b+3]=255}
      previewAssets.push({assetId:id,page,row:Math.floor(j/columns)+1,column:j%columns+1})
    }
    // Set opaque alpha also on unused cells.
    for(let i=3;i<pixels.length;i+=4)pixels[i]=255
    const file=join(folder,`assets-${page}.png`);writeFileSync(file,nativeImage.createFromBitmap(pixels,{width,height}).toPNG());images.push(file)
  }
  const detailAssets:{assetId:string;image:number}[]=[]
  const detailIds=ids.filter(id=>['part','prop'].includes(String((assets.find(a=>a.id===id)?.meta.cutoutAsset as {role?:string})?.role)))
  for(const id of detailIds){
    if(images.length>=12)break
    let im=nativeImage.createFromBuffer(readManagedImageBytes(id,projectId,true)),size=im.getSize(),scale=Math.min(1,1024/Math.max(size.width,size.height))
    if(scale<1)im=im.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))})
    const file=join(folder,`detail-${detailAssets.length}.png`);writeFileSync(file,im.toPNG());images.push(file);detailAssets.push({assetId:id,image:images.length})
  }
  return {images,previewAssets,detailAssets}
}
