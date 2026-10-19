import {CutoutStudioPanel,confirmCutoutCredits} from './CutoutStudioPanel'
import {scheduledItem,groupMotion} from '@shared/cutout-plan-diagnostics'
import {CutoutV5Panel} from './CutoutV5Panel'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ImagePlus, Layers, RefreshCw, Sparkles, Volume2, X } from 'lucide-react'
import type { CutoutAssetState } from '@shared/cutout-assets'
import { CUTOUT_ASSET_ROLES } from '@shared/cutout-assets'
import { generatedForItem } from '@shared/cutout-production'
import { cutoutVisualReadiness } from '@shared/cutout-visual'
import { CUTOUT_AUTO_EDIT_INSTRUCTION } from '@shared/cutout-direction-spec'
import { builtInMasterPrompts, resolveMasterPrompt } from '@shared/master-prompts'
import { Button, cx, inputCls, confirmDialog } from '../../components/ui'
import { useProject, isRunning } from '../../store/project'
import { useApp } from '../../store/app'
import { errorText } from '../../lib/format'
import { useNarration } from '../../lib/useNarration'
import { readCutoutGenerationPreferences, saveCutoutGenerationPreferences } from '../../lib/cutout-generation-preferences'
import { CharacterModal } from './CharacterModal'

const checker = {backgroundImage:'linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)',backgroundSize:'16px 16px',backgroundPosition:'0 0,0 8px,8px -8px,-8px 0px',backgroundColor:'#f4f3ef'}
const seconds=(ms:number)=>(ms/1000).toFixed(2)

/** Visual owns the saved asset packages; Production consumes those same IDs. */
export function CutoutVisualStep() {
  const {project,clips,characters,assets,jobs,selectedClipId,savedAt,select,updateProject} = useProject()
  const {toast}=useApp(), narration=useNarration()
  const [states,setStates]=useState<Record<string,CutoutAssetState>>({})
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[connection,setConnection]=useState('')
  const [prefs,setPrefs]=useState(readCutoutGenerationPreferences)
  const [maxAssets,setMaxAssets]=useState(32),[limit,setLimit]=useState(128)
  const [openChar,setOpenChar]=useState<string|null>(null),[selectedItem,setSelectedItem]=useState<string|null>(null)
  const lock=useRef(false),epoch=useRef(0),mounted=useRef(true)
  const projectId=project?.id
  const stamp=Object.values(jobs).filter(j=>['cutout-plan','cutout-asset','cutout-batch','auto-edit'].includes(j.kind)).map(j=>`${j.id}:${j.status}:${j.updatedAt}`).join('|')
  const refresh=async()=>{
    const request=++epoch.current, ids=useProject.getState().clips.map(c=>c.id)
    const entries=await Promise.all(ids.map(async id=>[id,await window.api.cutoutAssets.state(id)] as const))
    if(mounted.current&&request===epoch.current&&useProject.getState().project?.id===projectId)setStates(Object.fromEntries(entries))
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++}},[])
  useEffect(()=>{setStates({});setError('');void refresh().catch(e=>setError(errorText(e)))},[projectId])
  useEffect(()=>{void refresh().catch(e=>{if(mounted.current)setError(errorText(e))})},[stamp,savedAt,clips.map(c=>c.id).join('|'),Object.keys(assets).length])
  useEffect(()=>setSelectedItem(null),[selectedClipId])
  if(!project)return null
  const clip=clips.find(c=>c.id===selectedClipId)??clips[0],state=clip?states[clip.id]:undefined,plan=state?.plan
  const images=Object.values(assets), readiness=cutoutVisualReadiness(state,images)
  const active=Object.values(jobs).filter(j=>j.projectId===project.id&&['cutout-plan','cutout-asset','cutout-batch','auto-edit'].includes(j.kind)&&isRunning(j))
  const lastBatch=Object.values(jobs).filter(j=>j.kind==='cutout-batch').sort((a,b)=>b.createdAt-a.createdAt)[0]
  const readyClips=clips.filter(c=>cutoutVisualReadiness(states[c.id],images).ready).length
  const selected=plan?.items.find(i=>i.id===selectedItem)
  const selectedAsset=selected&&plan?generatedForItem(images,plan,selected.id):null
  const work=async(fn:()=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('')
    try{await useProject.getState().flush();const current=useProject.getState();if(current.project?.id!==project.id||current.saveState!=='saved')throw Error(current.saveError||'Simpan perubahan proyek dahulu.');await fn();await refresh()}
    catch(e){if(mounted.current)setError(errorText(e))}finally{lock.current=false;if(mounted.current)setBusy(false)}
  }
  const generate=(ids:string[])=>void work(async()=>{
    if(!await confirmCutoutCredits(project.id,ids))return
    const job=await window.api.cutoutAssets.generateBatch({projectId:project.id,clipIds:ids,provider:prefs.provider,format:prefs.format,maxNewAssets:limit})
    useProject.getState().upsertJob(job)
  })
  const planClip=()=>void work(async()=>{
    if(!clip)return
    if(plan?.items.length&&!await confirmDialog({title:'Susun ulang kebutuhan adegan?',body:'Paket baru mengikuti narasi terkini. Aset lama tetap tersimpan, tetapi paket baru memerlukan generasi sendiri. Untuk melanjutkan paket ini, gunakan Generate aset yang kurang.',confirm:'Susun ulang'}))return
    const job=await window.api.cutoutAssets.plan(clip.id,{maxAssets,beatTemplate:true,instruction:(resolveMasterPrompt(project)?.version??5)>=6?'Ikuti masterPrompt.sourceText v6 dan narasi aktual; gunakan skema kebutuhan aset yang disediakan.':CUTOUT_AUTO_EDIT_INSTRUCTION})
    useProject.getState().upsertJob(job)
  })
  const goProduction=()=>void work(async()=>{
    if(readyClips!==clips.length)throw Error('Selesaikan paket aset tiap adegan sebelum melanjutkan. Anda tetap dapat membuka Produksi dari navigasi atas.')
    updateProject({step:4});await useProject.getState().flush()
    toast('success','Aset tersimpan siap dipakai. Buka Edit otomatis; gambar yang sudah selesai dipakai kembali.')
  })
  return <div data-cutout-visual className="flex h-full min-h-0 flex-col bg-paper">
    <div className="max-h-[45vh] shrink-0 overflow-auto"><CutoutStudioPanel clipId={clip?.id}/></div>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-accent-dark">Cutout · Fakta & Komedi v5</p><h2 className="font-display text-2xl font-bold">Studio aset adegan</h2><p className="mt-1 text-xs text-muted">Narasi → rencana shot → aset terpisah → animasi di Produksi</p></div>
      <div className="flex flex-wrap gap-2"><Button icon={<Volume2 className="size-4"/>} loading={narration.running} disabled={busy||!!active.length||narration.checking||!clips.some(c=>c.narration.trim())} onClick={()=>void narration.start()}>{narration.voiced?'Perbarui suara':'Buat suara narasi'}</Button><Button variant="primary" icon={<ArrowRight className="size-4"/>} disabled={busy||active.length>0||!clips.length||readyClips!==clips.length} onClick={goProduction}>Lanjut Produksi · {readyClips}/{clips.length}</Button></div>
    </header>
    {project.masterPrompt&&resolveMasterPrompt(project)?.version!==5&&<div className="flex items-center gap-3 border-b border-line bg-sun-soft px-6 py-2 text-xs">Proyek masih menyimpan preset v{resolveMasterPrompt(project)?.version}.<Button size="sm" onClick={()=>void work(async()=>{updateProject({masterPrompt:structuredClone(builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!)});await useProject.getState().flush()})}>Gunakan arahan v5</Button></div>}
    <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_310px]">
      <nav aria-label="Adegan Cutout" className="scroll-thin overflow-y-auto border-r border-line p-3">
        <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">Daftar adegan · {clips.length}</p>
        {clips.map((c,index)=>{const r=cutoutVisualReadiness(states[c.id],images);return <button key={c.id} type="button" onClick={()=>select(c.id)} aria-current={clip?.id===c.id?'true':undefined} className={cx('mb-2 w-full rounded-xl border p-3 text-left transition-colors',clip?.id===c.id?'border-accent bg-accent-soft':'border-line bg-surface hover:border-ink-2')}><span className="flex items-center justify-between text-[10px] font-mono text-muted"><span>{String(index+1).padStart(2,'0')} · {seconds(c.durationMs)}s</span>{r.ready?<Check className="size-3 text-ok-ink"/>:<Layers className="size-3"/>}</span><span className="mt-1 block text-xs font-semibold">{c.title||'Adegan tanpa judul'}</span><span className="mt-2 block text-[10px] text-muted">{states[c.id]?.stale?'Narasi berubah':r.total?`${r.available}/${r.total} aset tersedia`:'Belum ada paket aset'}</span></button>})}
        {!clips.length&&<p className="p-2 text-xs text-muted">Tulis naskah terlebih dahulu.</p>}
      </nav>
      <main className="scroll-thin min-w-0 overflow-y-auto p-5">
        {clip?<><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl font-semibold">{clip.title}</h3><p className="mt-1 text-xs text-muted">{plan?.director?.shots.length??0} shot · {plan?.director?.timing==='recorded'?'Timing rekaman':'Timing sementara — finalkan suara sebelum merencanakan'}</p></div><Button size="sm" icon={<Sparkles className="size-4"/>} loading={busy} disabled={active.length>0||!clip.narration.trim()} onClick={planClip}>{plan?'Susun ulang kebutuhan':'Susun kebutuhan dari narasi'}</Button></div>
          <div className="mt-3 flex flex-wrap gap-2 xl:hidden">{characters.map(c=><Button size="sm" key={c.id} onClick={()=>setOpenChar(c.id)}>{c.name}</Button>)}<Button size="sm" onClick={()=>setOpenChar('new')}>Tambah pemeran</Button></div>
          <CutoutV5Panel clipId={clip.id}/><blockquote className="my-4 rounded-xl border-l-4 border-accent bg-surface p-4 text-sm leading-relaxed">{clip.narration||'Narasi adegan masih kosong.'}</blockquote>
          {!clip.audioAssetId&&<p className="mb-4 text-xs text-sun-ink">Buat suara sebelum generate aset agar pergantian pose mengikuti rekaman. Rencana tanpa suara memakai timing sementara.</p>}
          {state?.stale&&<p role="alert" className="mb-4 rounded-lg bg-sun-soft p-3 text-xs text-sun-ink">Narasi, durasi atau identitas berubah. Susun kebutuhan terbaru sebelum generate; gambar lama tetap tersimpan.</p>}
          {!!plan?.director?.shots.length&&<section aria-label="Rencana shot" className="mb-5 flex flex-col gap-2">{plan.director.shots.map((s,i)=><details key={i} className="rounded-lg border border-line bg-surface p-3"><summary className="cursor-pointer text-xs font-semibold"><span className="mr-2 font-mono text-accent-dark">{seconds(s.startMs)}–{seconds(s.endMs)}</span>{s.camera} · {s.action}</summary><p className="mt-2 text-xs leading-relaxed text-muted">{s.location} · Fokus: {s.focus}<br/>{s.startPose} → {s.endPose} · Reaksi: {s.reaction}<br/>Kontak: {s.contact} · Tertutup: {s.occlusion}<br/>SFX: {s.sfxCue}</p></details>)}</section>}
          {plan?.director?.specialAssets?.length? <p className="mb-4 rounded-lg bg-sun-soft p-3 text-xs">Klip/aset khusus yang masih diperlukan: {plan.director.specialAssets.join('; ')}</p>:null}
          <div className="mb-3 flex items-center justify-between"><h4 className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4"/>Paket aset · {readiness.available}/{readiness.total}</h4><span className="text-[10px] text-muted">Klik aset untuk melihat detail</span></div>
          <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">{plan?.items.map(item=>{const a=generatedForItem(images,plan,item.id),entry=state?.jobs.filter(e=>e.itemId===item.id).sort((a,b)=>b.job.createdAt-a.job.createdAt)[0];return <button data-asset-card key={item.id} type="button" onClick={()=>setSelectedItem(item.id)} className={cx('overflow-hidden rounded-xl border bg-surface text-left',selectedItem===item.id?'border-accent ring-1 ring-accent':'border-line hover:border-ink-2')}><div className="relative flex h-44 items-center justify-center" style={checker}>{a?<img src={a.url} alt={item.label} className="size-full object-contain"/>:<ImagePlus className="size-8 text-muted"/>}<span className="absolute left-2 top-2 rounded bg-paper px-2 py-1 text-[10px] font-semibold">{CUTOUT_ASSET_ROLES.find(r=>r.id===item.role)?.label??item.role}</span></div><div className="p-3"><p className="text-xs font-semibold">{item.label}</p><p className="mt-1 text-[10px] text-muted">{!scheduledItem(item)?'Varian pengganti · belum dijadwalkan':seconds(item.timeMs)+'s'} · {groupMotion(item,plan.items).value==='mover'?'Objek bergerak':groupMotion(item,plan.items).value==='static'?'Hold / statis':'Peran gerak belum ditetapkan'}</p><p className={cx('mt-2 text-[10px]',a?'text-ok-ink':entry?.job.status==='failed'?'text-red-700':'text-muted')}>{a?'Tersedia · tinjau visual':entry?.job.status==='failed'?'Gagal · bisa dilanjutkan':entry&&isRunning(entry.job)?entry.job.message||'Dalam antrean':'Belum dibuat'}</p></div></button>})}</div>
          {!plan&&<div className="rounded-xl border border-dashed border-line-3 p-10 text-center text-sm text-muted">Susun kebutuhan untuk menyiapkan background tanpa tokoh, pose, properti dan foreground sesuai narasi.</div>}
          {selected&&<details open className="mt-4 rounded-xl border border-line p-4 xl:hidden"><summary className="text-sm font-semibold">{selected.label}</summary><p className="mt-2 text-xs leading-relaxed">{selected.prompt}</p>{selectedAsset&&<img src={selectedAsset.url} alt={selected.label} className="mt-2 max-h-80 w-full object-contain" style={checker}/>}</details>}
        </>:<Button onClick={()=>updateProject({step:2})}>Ke Naskah</Button>}
      </main>
      <aside className="scroll-thin hidden overflow-y-auto border-l border-line bg-surface p-4 xl:block">
        <h3 className="mb-3 text-sm font-semibold">Identitas & detail aset</h3><div className="mb-4 flex flex-wrap gap-2">{characters.map(c=><Button size="sm" key={c.id} onClick={()=>setOpenChar(c.id)}>{c.name}</Button>)}<Button size="sm" onClick={()=>setOpenChar('new')}>Tambah pemeran</Button></div>
        {selected?<><h4 className="text-sm font-semibold">{selected.label}</h4>{selectedAsset&&<img src={selectedAsset.url} alt={selected.label} className="my-3 max-h-72 w-full rounded object-contain" style={checker}/>}<p className="my-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-2">{selected.prompt}</p><p className="text-[10px] text-muted">Grup: {selected.layerKey??selected.id} · {groupMotion(selected,plan?.items??[selected]).value??'belum ditetapkan'} ({groupMotion(selected,plan?.items??[selected]).source})</p>{selectedAsset&&<Button size="sm" disabled={busy} onClick={()=>void work(async()=>{if(!await confirmDialog({title:'Setujui aset yang terlihat?',body:'Saya telah meninjau era, identitas, alpha dan kontak. Background dengan lokasi/era kanonis yang sama dapat dipakai ulang.',confirm:'Tandai lolos review'}))return;const a=await window.api.cutoutStudio.reviewAsset(project.id,selectedAsset.id,true);useProject.getState().addAsset(a)})}>Tandai aset lolos review</Button>}{selectedAsset&&<p className="mt-2 text-xs text-muted">Alpha: {String((selectedAsset.meta.cutoutAsset as {alpha?:string})?.alpha??'perlu ditinjau')}. Periksa tepi, pose, skala dan kontak sebelum animasi.</p>}</>:<p className="text-xs leading-relaxed text-muted">Pilih kartu aset untuk meninjau prompt dan gambar. Foto utuh tidak otomatis berubah menjadi beberapa PNG transparan.</p>}
        <div className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted"><p className="font-semibold text-ink">Urutan penyutradaraan</p><p className="mt-2">Orientasi era/lokasi → detail mekanisme → akibat/reaksi. Satu aksi per shot; pose berubah pada kata kerja. Teks tahun/nama dan caption dibuat di editor.</p><p className="mt-2">Aksi tangan/wajah kontinu memerlukan klip khusus. Maksimal dua layer bergerak; kontak tangan/alat tetap linear/hold.</p></div>
      </aside>
    </div>
    <footer className="max-h-[40%] shrink-0 overflow-y-auto border-t border-line bg-surface px-5 py-3">
      <div className="flex flex-wrap items-end gap-3"><label className="text-[10px] font-semibold">Provider<select aria-label="Provider aset Visual" className={cx(inputCls,'mt-1 block text-xs')} value={prefs.provider} disabled={busy||!!active.length} onChange={e=>{const provider=e.target.value as typeof prefs.provider;setPrefs(p=>({...p,provider}));saveCutoutGenerationPreferences({provider})}}><option value="codex">Codex</option><option value="flow-mcp">Flow MCP</option></select></label><label className="text-[10px] font-semibold">Format<select aria-label="Format aset Visual" className={cx(inputCls,'mt-1 block text-xs')} value={prefs.format} disabled={busy||!!active.length} onChange={e=>{const format=e.target.value as typeof prefs.format;setPrefs(p=>({...p,format}));saveCutoutGenerationPreferences({format})}}><option value="png">PNG alpha</option><option value="webp">WebP lossless</option></select></label><label className="text-[10px] font-semibold">Maks. aset/adegan<select aria-label="Batas rencana Visual" className={cx(inputCls,'mt-1 block text-xs')} value={maxAssets} onChange={e=>setMaxAssets(+e.target.value)}>{[12,32,64,128,256].map(v=><option key={v}>{v}</option>)}</select></label><label className="text-[10px] font-semibold">Batas gambar/proses<select aria-label="Batas generate Visual" className={cx(inputCls,'mt-1 block text-xs')} value={limit} disabled={busy||!!active.length} onChange={e=>setLimit(+e.target.value)}>{[32,64,128,256,512,1024,2048].map(v=><option key={v}>{v}</option>)}</select></label><Button size="sm" icon={<RefreshCw className="size-3"/>} onClick={()=>void work(async()=>{setConnection((await window.api.cutoutAssets.status(prefs.provider)).message)})}>Cek koneksi</Button><div className="flex-1"/><Button size="sm" disabled={busy||!!active.length||!clips.some(c=>states[c.id]?.plan&&!states[c.id].stale&&cutoutVisualReadiness(states[c.id],images).missing)} onClick={()=>generate(clips.filter(c=>states[c.id]?.plan&&!states[c.id].stale).map(c=>c.id))}>Generate paket siap</Button><Button variant="primary" icon={<Sparkles className="size-4"/>} disabled={busy||!!active.length||!plan||state?.stale||!readiness.missing} onClick={()=>clip&&generate([clip.id])}>Generate aset yang kurang · {readiness.missing}</Button></div>
      {active.filter(j=>j.kind==='cutout-batch'||j.kind==='cutout-plan').map(j=><div key={j.id} className="mt-3 flex items-center gap-3 text-xs"><progress max={1} value={j.progress} className="w-32"/><span className="flex-1">{j.message||'Menyiapkan antrean…'}</span><Button size="sm" icon={<X className="size-3"/>} onClick={()=>void window.api.generate.cancel(j.id).catch(e=>setError(errorText(e)))}>Batalkan</Button></div>)}
      {prefs.provider==='flow-mcp'&&clip&&<div className="mt-2 flex items-center gap-3 text-xs text-muted"><Button size="sm" disabled={busy||!!active.length} onClick={()=>void work(async()=>{const recovered=await window.api.cutoutAssets.recover(clip.id);recovered.forEach(j=>useProject.getState().upsertJob(j))})}>Pulihkan aset Flow</Button><span>Jika pengiriman terputus, pulihkan hasil sebelum mengirim ulang.</span></div>}
      {connection&&<p className="mt-2 text-xs text-muted">{connection}</p>}{error&&<p role="alert" className="mt-2 whitespace-pre-line text-xs text-red-700">{error}</p>}{!active.length&&lastBatch&&<p role="status" className={cx('mt-2 whitespace-pre-line text-xs',lastBatch.status==='failed'?'text-red-700':'text-muted')}>{lastBatch.error||lastBatch.message}</p>}
    </footer>
    {openChar&&<CharacterModal characterId={openChar} onClose={()=>setOpenChar(null)} onCreated={setOpenChar}/>}
  </div>
}
