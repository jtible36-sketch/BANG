import {randomUUID} from 'node:crypto'
import {execFile} from 'node:child_process'
import {mkdirSync,rmSync,realpathSync,statSync} from 'node:fs'
import {dirname,relative,isAbsolute,sep} from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import {getBundle,insertAsset,insertJob,patchClip,activeProjectJob} from './repo'
import {getDb} from './db'
import {assetAbsPath,binPath,projectDir} from './paths'
import {ensureEditorsReady,getEditingContext,validateEditingPlan} from './editor-automation'
import {runJob} from './jobs'
import {probeDurationMs} from './services/audio'
import {emit} from './events'
import {voiceoverTimelineMs} from '@shared/voiceover'
import type {WordTiming} from '@shared/types'

/** Local pitch-preserving tempo conversion. Run before visual timing, never overwrite the source recordings. */
export async function retimeNarration(projectId:string,expectedRevision:string,rate:number){
  if(!Number.isFinite(rate)||rate<.8||rate>1.5||rate===1)throw new Error('Tempo narasi harus 0,8–1,5× dan berbeda dari 1×.')
  await ensureEditorsReady(projectId)
  validateEditingPlan(projectId,expectedRevision,{summary:'Memeriksa timing sebelum mengatur tempo narasi lokal',clips:[]})
  const b=getBundle(projectId)
  if(activeProjectJob(projectId,'narration'))throw new Error('Tunggu pembuatan suara selesai sebelum mengatur tempo.')
  if(b.jobs.some(j=>['queued','running'].includes(j.status)))throw new Error('Tunggu pekerjaan aset selesai agar timing paket tidak berubah di tengah produksi.')
  if(b.clips.some(c=>c.cutout?.enabled)||(b.project.editor.sfx?.length??0)||b.project.editor.overlays.length)throw new Error('Atur tempo sebelum menyusun Cutout, label dan SFX; timing yang sudah disutradarai tidak diubah diam-diam.')
  const sources=b.clips.map(c=>({clip:c,asset:b.assets.find(a=>a.id===c.audioAssetId)}))
  if(sources.some(({clip,asset})=>!asset||asset.kind!=='audio'||(asset.prompt??'').trim()!==clip.narration.trim()))throw new Error('Selesaikan rekaman narasi terkini untuk semua klip sebelum mengatur tempo.')
  const root=realpathSync(projectDir(projectId))
  for(const {asset} of sources){const source=realpathSync(assetAbsPath(projectId,asset!.localPath)),rel=relative(root,source);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||!statSync(source).isFile())throw new Error('Rekaman tidak berada di folder proyek.')}
  const job=insertJob({projectId,kind:'narration',provider:'local'})
  return runJob(job,'tts',async ctx=>{
    const files:Array<{clip:typeof b.clips[number];source:typeof b.assets[number];rel:string;durationMs:number;words:WordTiming[]}>=[],created:string[]=[]
    let committed=false
    try{
      for(let i=0;i<sources.length;i++){
        ctx.signal.throwIfAborted();const {clip,asset}=sources[i],source=asset!,rel=`audio/tempo-${randomUUID()}.wav`,file=assetAbsPath(projectId,rel);mkdirSync(dirname(file),{recursive:true})
        ctx.progress(i/sources.length,`Mengatur tempo lokal ${rate.toFixed(2)}× · ${i+1}/${sources.length}`)
        created.push(file)
        await new Promise<void>((resolve,reject)=>{
          const child=execFile(binPath(ffmpegStatic!),['-hide_banner','-loglevel','error','-n','-i',assetAbsPath(projectId,source.localPath),'-vn','-af',`atempo=${rate}`,'-c:a','pcm_s16le',file],{windowsHide:true},(err,_out,stderr)=>{ctx.signal.removeEventListener('abort',abort);err?reject(new Error(ctx.signal.aborted?'Tempo dibatalkan.':`Tempo audio gagal: ${String(stderr).slice(-500)}`)):resolve()})
          const abort=()=>child.kill('SIGKILL');ctx.signal.addEventListener('abort',abort,{once:true})
        })
        const durationMs=await probeDurationMs(file),end=durationMs/1000
        const words=Array.isArray(source.meta.words)?(source.meta.words as WordTiming[]).map(w=>({...w,start:Math.min(end,Math.max(0,w.start/rate)),end:Math.min(end,Math.max(0,w.end/rate))})):[]
        files.push({clip,source,rel,durationMs,words})
      }
      await ensureEditorsReady(projectId,ctx.signal)
      validateEditingPlan(projectId,expectedRevision,{summary:'Memeriksa revisi setelah proses tempo',clips:[]})
      ctx.signal.throwIfAborted()
      getDb().transaction(()=>{for(const f of files){const a=insertAsset({projectId,clipId:f.clip.id,kind:'audio',provider:'local',model:'ffmpeg-atempo',prompt:f.clip.narration,localPath:f.rel,durationMs:f.durationMs,meta:{...f.source.meta,words:f.words,tempo:{rate,sourceAssetId:f.source.id,pitchPreserved:true}}});patchClip(f.clip.id,{audioAssetId:a.id,durationMs:voiceoverTimelineMs(f.durationMs)})}})()
      committed=true
      const result=getBundle(projectId);for(const c of result.clips)emit.clip({clipId:c.id,patch:{audioAssetId:c.audioAssetId,durationMs:c.durationMs}})
      for(const f of files){const a=result.assets.find(a=>a.localPath===f.rel);if(a)emit.asset(a)}
      return {message:`Tempo narasi ${rate.toFixed(2)}× disimpan secara lokal; rekaman sumber tetap tersedia. Timing kata dan durasi klip disesuaikan. ${Math.round(result.clips.reduce((n,c)=>n+c.durationMs,0)/1000)} detik. Revisi ${getEditingContext(projectId).revision}`}
    }catch(e){if(!committed)for(const f of created)try{rmSync(f,{force:true})}catch{/* private generated file */}throw e}
  })
}
