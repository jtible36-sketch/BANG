import { reviewCutoutShots } from '@shared/cutout-shot-review'
import { usePlayback } from './engine'
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Sparkles, X } from 'lucide-react'
import { CUTOUT_ASSET_ROLES, type CutoutAssetItem, type CutoutAssetProvider, type CutoutAssetState } from '@shared/cutout-assets'
import type { Asset, Clip } from '@shared/types'
import { Button, cx, inputCls } from '../../../components/ui'
import { useProject } from '../../../store/project'
import { errorText } from '../../../lib/format'
import { readCutoutGenerationPreferences, saveCutoutGenerationPreferences } from '../../../lib/cutout-generation-preferences'

export function CutoutAssetPanel({ clip, attach, pose }: { clip: Clip; attach(asset: Asset): void; pose(asset: Asset): void }) {
  const { project, clips, characters, jobs, assets, savedAt } = useProject()
  const [state, setState] = useState<CutoutAssetState | null>(null)
  const [draft, setDraft] = useState<CutoutAssetItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [reviewFps,setReviewFps]=useState<30|60>(30)
  const [maxAssets,setMaxAssets]=useState(64)
  const [provider, setProvider] = useState<CutoutAssetProvider>(()=>readCutoutGenerationPreferences().provider)
  const [format, setFormat] = useState<'png'|'webp'>(()=>readCutoutGenerationPreferences().format)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string|null>(null), [connection, setConnection] = useState('')
  const current = useRef(clip.id), dirtyRef = useRef(false), locked=useRef(false)
  current.current=clip.id;dirtyRef.current=dirty
  const refresh = async (): Promise<void> => {
    const id=clip.id,s=await window.api.cutoutAssets.state(id)
    if(current.current!==id)return
    setState(s);if(!dirtyRef.current)setDraft(s.plan?.items??[])
  }
  const stamp=Object.values(jobs).filter(j=>j.clipId===clip.id&&['cutout-plan','cutout-asset'].includes(j.kind)).map(j=>`${j.id}:${j.updatedAt}:${j.status}`).join('|')
  useEffect(()=>{setState(null);setDraft([]);setDirty(false);dirtyRef.current=false;setError(null);void refresh().catch(e=>setError(errorText(e)))},[clip.id])
  useEffect(()=>{void refresh().catch(e=>setError(errorText(e)))},[stamp,Object.keys(assets).length,savedAt])
  const edit=(items:CutoutAssetItem[]):void=>{dirtyRef.current=true;setDirty(true);setDraft(items)}
  const flush=async():Promise<void>=>{await useProject.getState().flush();if(useProject.getState().project?.id!==clip.projectId||useProject.getState().saveState!=='saved')throw new Error('Simpan perubahan proyek dahulu.');await window.api.editorAutomation.presence({projectId:clip.projectId,saveState:'saved'})}
  const work=async(task:()=>Promise<void>):Promise<void>=>{if(locked.current)return;locked.current=true;setBusy(true);setError(null);try{await flush();await task();await refresh()}catch(e){setError(errorText(e));await refresh().catch(()=>{})}finally{locked.current=false;setBusy(false)}}
  const save=async()=>{if(!draft.length)throw new Error('Tambahkan kebutuhan aset.');const p=await window.api.cutoutAssets.save(clip.id,draft);dirtyRef.current=false;setDirty(false);setState(s=>s?{...s,plan:p,stale:false}:{plan:p,stale:false,assets:[],jobs:[]});return p}
  const generate=async(ids:string[])=>work(async()=>{
    const p=dirty||!state?.plan?await save():state.plan
    if(state?.stale&&!dirty)throw new Error('Narasi berubah. Susun ulang atau simpan kebutuhan agar sesuai narasi terbaru.')
    for(const itemId of ids){const job=await window.api.cutoutAssets.generate({clipId:clip.id,planId:p.id,itemId,provider,format});useProject.getState().upsertJob(job)}
  })
  const active=Object.values(jobs).filter(j=>j.clipId===clip.id&&['cutout-plan','cutout-asset'].includes(j.kind)&&['queued','running'].includes(j.status))
  const generated=state?.assets??[]
  const shotChecks=state?.plan?reviewCutoutShots(clip,state.plan,Object.values(assets),project?.aspectRatio??'9:16',reviewFps):[]
  const clipStart=clips.slice(0,clips.findIndex(c=>c.id===clip.id)).reduce((n,c)=>n+c.durationMs,0)
  const inspect=(timeMs:number)=>{usePlayback.getState().pause();usePlayback.getState().seek((clipStart+timeMs)/1000)}
  const frame=(delta:number)=>{const at=usePlayback.getState().t*1000-clipStart,next=Math.round(at*reviewFps/1000)+delta;inspect(Math.max(0,Math.min(Math.floor((clip.durationMs-.001)*reviewFps/1000)*1000/reviewFps,next*1000/reviewFps)))}
  return <section className="flex flex-col gap-3 border-b border-line px-[18px] py-4" data-cutout-assets>
    <h3 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-4"/>Generate aset terpisah</h3>
    <p className="text-xs leading-relaxed text-muted">Susun kebutuhan dari narasi, lalu buat background bersih, pose, properti atau bagian rig. Setiap item menghasilkan satu gambar; tinjau identitas dan tepi alpha sebelum dipakai.</p>
    <Button size="sm" icon={<Sparkles className="size-3.5"/>} loading={busy} disabled={!!active.length} onClick={()=>void work(async()=>{const j=await window.api.cutoutAssets.plan(clip.id,{maxAssets});useProject.getState().upsertJob(j)})}>Susun kebutuhan dari narasi · Codex</Button>
    <label className="text-xs">Batas kebutuhan aset<select aria-label="Batas kebutuhan aset Cutout" className={cx(inputCls,'mt-1 w-full text-xs')} value={maxAssets} disabled={busy||!!active.length} onChange={e=>setMaxAssets(Number(e.target.value))}>{[12,32,64,128,256].map(n=><option value={n} key={n}>{n} gambar maksimum</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Provider<select aria-label="Provider aset Cutout" className={cx(inputCls,'mt-1 w-full text-xs')} value={provider} disabled={busy||!!active.length} onChange={e=>{setProvider(e.target.value as CutoutAssetProvider);saveCutoutGenerationPreferences({provider:e.target.value as CutoutAssetProvider});setConnection('')}}><option value="codex">Codex</option><option value="flow-mcp">Flow MCP</option></select></label><label className="text-xs">Format<select aria-label="Format aset Cutout" className={cx(inputCls,'mt-1 w-full text-xs')} value={format} onChange={e=>{setFormat(e.target.value as 'png'|'webp');saveCutoutGenerationPreferences({format:e.target.value as 'png'|'webp'})}}><option value="png">PNG</option><option value="webp">WebP lossless</option></select></label></div>
    <Button size="sm" icon={<RefreshCw className="size-3"/>} onClick={()=>void work(async()=>{const s=await window.api.cutoutAssets.status(provider);setConnection(s.message)})}>Cek koneksi {provider==='codex'?'Codex':'Flow MCP'}</Button>
    {connection&&<p className="text-xs text-muted">{connection}</p>}
    {state?.stale&&<p role="alert" className="text-xs text-amber-800">Narasi/identitas berubah. Tinjau dan simpan ulang kebutuhan sebelum generate.</p>}
    {shotChecks.length>0&&<details className="rounded-lg border border-line p-2" data-shot-review><summary className="cursor-pointer text-xs font-semibold">Periksa shot & frame · {shotChecks.length} shot</summary><div className="mt-2 flex flex-col gap-3 text-xs"><p className="text-muted">Pemeriksaan struktur pada 3 frame per shot. Tinjau wajah, alpha, pose, occlusion dan kontak secara visual; angka ini bukan jaminan kualitas gambar.</p><label>Grid frame<select aria-label="Grid frame pemeriksaan" className={cx(inputCls,'ml-2 text-xs')} value={reviewFps} onChange={e=>setReviewFps(Number(e.target.value) as 30|60)}><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label><div className="flex gap-2"><Button size="sm" onClick={()=>frame(-1)}>Frame sebelumnya</Button><Button size="sm" onClick={()=>frame(1)}>Frame berikutnya</Button></div>{shotChecks.map(check=><div key={check.index} className="border-t border-line pt-2"><p className="font-semibold">Shot {check.index+1} · {(check.startMs/1000).toFixed(2)}–{(check.endMs/1000).toFixed(2)}s</p><p>{check.available}/{check.planned} aset · {check.poseChanges} ganti pose · {check.objectKeys} key objek · {check.maskKeys} key mask · {check.ikChains} IK</p><div className="mt-1 flex gap-1">{check.frameTimes.map((time,i)=><Button size="sm" key={i} onClick={()=>inspect(time)}>{['Awal','Tengah','Akhir'][i]}</Button>)}</div>{check.warnings.map(w=><p key={w} role="status" className="mt-1 text-amber-800">{w}</p>)}</div>)}</div></details>}
    {state?.plan?.director&&<details className="rounded-lg border border-line p-2"><summary className="cursor-pointer text-xs font-semibold">Penyutradaraan · {state.plan.director.shots.length} shot · {state.plan.director.timing==='recorded'?'timing rekaman':'timing sementara'}</summary><div className="mt-2 flex flex-col gap-3 text-xs">{state.plan.director.shots.map((shot,i)=><div key={i}><p className="font-semibold">{(shot.startMs/1000).toFixed(2)}–{(shot.endMs/1000).toFixed(2)}s · {shot.camera} · {shot.action}</p><p>{shot.location} · fokus {shot.focus}</p><p>{shot.startPose} → {shot.endPose} · {shot.reaction}</p><p className="text-muted">Kontak: {shot.contact}. Tertutup: {shot.occlusion}. SFX: {shot.sfxCue}.</p></div>)}{state.plan.director.specialAssets.length>0&&<p role="status" className="text-amber-800">Perlu aset khusus: {state.plan.director.specialAssets.join('; ')}</p>}{dirty&&<p className="text-muted">Kebutuhan sedang diubah; susun ulang untuk memperbarui penyutradaraan.</p>}</div></details>}
    {draft.map((item,index)=><details key={item.id} className="rounded-lg border border-line p-2" open={draft.length===1}><summary className="cursor-pointer text-xs font-semibold">{item.label} · {(item.timeMs/1000).toFixed(2)}s</summary><div className="mt-2 flex flex-col gap-2">
      <label className="text-xs">Nama aset<input aria-label={`Nama aset ${index+1}`} className={cx(inputCls,'mt-1 w-full text-xs')} value={item.label} onChange={e=>edit(draft.map(v=>v.id===item.id?{...v,label:e.target.value}:v))}/></label>
      <select aria-label={`Jenis aset ${index+1}`} className={cx(inputCls,'text-xs')} value={item.role} onChange={e=>edit(draft.map(v=>v.id===item.id?{...v,role:e.target.value as CutoutAssetItem['role']}:v))}>{CUTOUT_ASSET_ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select>
      <select aria-label={`Karakter aset ${index+1}`} className={cx(inputCls,'text-xs')} value={item.characterId??''} onChange={e=>edit(draft.map(v=>v.id===item.id?{...v,characterId:e.target.value||null}:v))}><option value="">Tanpa referensi karakter tertentu</option>{characters.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <label className="text-xs">Momen lokal (detik)<input aria-label={`Momen aset ${index+1}`} type="number" min="0" max={(clip.durationMs-1)/1000} step="0.01" value={item.timeMs/1000} className={cx(inputCls,'mt-1 w-full text-xs')} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))edit(draft.map(v=>v.id===item.id?{...v,timeMs:Math.max(0,Math.min(clip.durationMs-1,Math.round(n*1000)))}:v))}}/></label>
      <label className="text-xs">Grup layer / pose<input aria-label={`Grup layer aset ${index+1}`} className={cx(inputCls,'mt-1 w-full text-xs')} value={item.layerKey??''} maxLength={100} onChange={e=>{const layerKey=e.target.value;if(!layerKey||/^[a-zA-Z0-9_.:-]+$/.test(layerKey))edit(draft.map(v=>v.id===item.id?{...v,layerKey:layerKey||undefined}:v))}}/></label>
      <textarea aria-label={`Arahan aset ${index+1}`} className={cx(inputCls,'min-h-28 text-xs')} maxLength={5000} value={item.prompt} onChange={e=>edit(draft.map(v=>v.id===item.id?{...v,prompt:e.target.value}:v))}/>
      <div className="flex gap-2"><Button size="sm" disabled={busy||!!active.length} onClick={()=>void generate([item.id])}>Generate · {provider==='codex'?'Codex':'Flow MCP'}</Button><Button size="sm" disabled={busy||!!active.length} onClick={()=>edit(draft.filter(v=>v.id!==item.id))}>Hapus</Button></div>
    </div></details>)}
    <Button size="sm" disabled={draft.length>=256||!!active.length} onClick={()=>edit([...draft,{id:crypto.randomUUID(),role:draft.length?'prop':'background',label:draft.length?'Properti adegan':'Background tanpa tokoh',prompt:`${clip.story||clip.narration}. ${draft.length?'One isolated prop required by this action.':'Clean plate environment without people or text.'}`,characterId:null,timeMs:0}])}>Tambah kebutuhan manual</Button>
    {draft.length>0&&<div className="flex flex-col gap-2"><Button size="sm" disabled={busy||!!active.length||(!dirty&&!state?.stale)} onClick={()=>void work(async()=>{await save()})}>Simpan kebutuhan</Button><Button size="sm" variant="primary" disabled={busy||!!active.length} onClick={()=>void generate(draft.map(i=>i.id))}>Generate {draft.length} aset · {provider==='codex'?'Codex':'Flow MCP'}</Button></div>}
    {provider==='flow-mcp'&&<><p className="text-[11px] text-muted">Pilih alur Flow MCP di Pengaturan dan buka proyek Flow. Latar magenta dipisahkan lokal menjadi alpha; pengiriman yang terputus dapat dipulihkan tanpa generate ulang.</p><Button size="sm" disabled={busy} onClick={()=>void work(async()=>{const result=await window.api.cutoutAssets.recover(clip.id);result.forEach(j=>useProject.getState().upsertJob(j))})}>Pulihkan aset Flow</Button></>}
    {active.map(j=><div key={j.id} className="rounded border border-line p-2 text-xs"><p>{j.message||'Mengantre aset…'}</p><progress max={1} value={j.progress} className="my-1 w-full"/><Button size="sm" icon={<X className="size-3"/>} onClick={()=>void window.api.generate.cancel(j.id).catch(e=>setError(errorText(e)))}>Batalkan</Button></div>)}
    {state?.jobs.filter(e=>e.job.status==='failed').slice(0,2).map(e=><p key={e.job.id} role="alert" className="text-xs text-red-700">{e.job.error}</p>)}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {generated.length>0&&<div className="grid grid-cols-2 gap-2">{generated.map(a=><div className="min-w-0 rounded-lg border border-line p-2" key={a.id}><img src={a.url} alt={a.prompt??'Aset Cutout'} className="h-24 w-full rounded bg-sand object-contain"/><p className="my-1 truncate text-[11px]">{a.prompt}</p><div className="flex flex-col gap-1"><Button size="sm" onClick={()=>attach(a)}>Tambah layer</Button>{(a.meta.cutoutAsset as {role?:string})?.role==='pose'&&<Button size="sm" onClick={()=>pose(a)}>Jadikan pose layer</Button>}</div></div>)}</div>}
  </section>
}
