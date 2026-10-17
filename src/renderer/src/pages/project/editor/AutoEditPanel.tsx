import { cutoutCoverage, isCutoutReference } from '@shared/cutout-reference-profile'
import { DEFAULT_SPECIAL_CLIPS, normalizeCodexEdit, type SpecialClipOptions } from '@shared/special-clips'
import type { ModelOption, CodexEditOptions } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { Copy, RefreshCw, Sparkles, Undo2, X } from 'lucide-react'
import { DEFAULT_CUTOUT_PRODUCTION, type CutoutProductionOptions } from '@shared/cutout-production'
import type { Clip } from '@shared/types'
import { Button, cx, inputCls } from '../../../components/ui'
import { errorText } from '../../../lib/format'
import { useApp } from '../../../store/app'
import { isRunning, jobFor, useProject } from '../../../store/project'
import { usePlayback } from './engine'

const DEFAULT_INSTRUCTION = 'Sutradarai mengikuti pola video referensi: framing lebar untuk orientasi, satu aksi utama per shot, detail properti saat mekanisme dijelaskan, lalu pose reaksi dan push-in singkat pada akibat/punchline. Ganti pose pada perubahan kata kerja/emosi mengikuti timing narasi aktual. Gerakkan layer seperlunya, gunakan mask untuk occlusion dan IK hanya pada bagian tubuh terpisah dengan pivot/kontak yang benar. Pertahankan cerita dan identitas proyek. Medis: anatomi semi realistis tanpa wajah organ kecuali diminta. Jika cakupan seluruh proyek, tempatkan SFX tersedia pada aksi.'

export function AutoEditPanel({ clip }: { clip: Clip | null }) {
  const { project, clips, jobs, savedAt, saveState } = useProject()
  const [scope, setScope] = useState<'clip' | 'project'>(() => project && isCutoutReference(project) ? 'project' : 'clip')
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION)
  const [production,setProduction]=useState<CutoutProductionOptions>({...DEFAULT_CUTOUT_PRODUCTION,enabled:project?.styleId==='cutout-facts'})
  const [codex,setCodex]=useState<CodexEditOptions>(()=>{try{return normalizeCodexEdit(JSON.parse(localStorage.getItem('naraflow:auto-edit-codex')||'{}'))??{}}catch{return {}}})
  const [models,setModels]=useState<ModelOption[]>([])
  const [modelsBusy,setModelsBusy]=useState(false)
  const [specialClips,setSpecialClips]=useState<SpecialClipOptions>({...DEFAULT_SPECIAL_CLIPS})
  const loadModels=async()=>{setModelsBusy(true);try{const list=await window.api.codex.models();setModels(list.models);setCodex(current=>{const found=list.models.find(m=>m.id===current.model);if(current.model&&!found)return {};if(current.effort&&!found?.supportedEfforts?.includes(current.effort))return {model:current.model};return current})}catch(err){setError(errorText(err))}finally{setModelsBusy(false)}}
  const [status, setStatus] = useState<Awaited<ReturnType<typeof window.api.editorAutomation.status>> | null>(null)
  const [undoAvailable, setUndoAvailable] = useState(false)
  const [resumeJobId,setResumeJobId]=useState<string|null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const { toast } = useApp()
  const job = jobFor(jobs, 'auto-edit', {})
  const running = isRunning(job)

  useEffect(() => {
    let active = true
    void window.api.editorAutomation.status().then(value => { if (active) setStatus(value) }).catch(err => { if (active) setError(errorText(err)) })
    return () => { active = false }
  }, [project?.id])
  useEffect(() => {
    if (!project || saveState !== 'saved' || running) { setUndoAvailable(false); return }
    let active = true
    void window.api.editorAutomation.context(project.id).then(value => { if (active) {setUndoAvailable(value.undoAvailable);setResumeJobId(value.resumeJobId??null)} }).catch(() => { if (active) setUndoAvailable(false) })
    return () => { active = false }
  }, [project?.id, savedAt, saveState, job?.updatedAt, running])

  useEffect(()=>{void loadModels()},[])
  useEffect(()=>{try{localStorage.setItem('naraflow:auto-edit-codex',JSON.stringify(codex))}catch{/* preference storage may be unavailable */}},[codex])
  const selectedModel=models.find(m=>m.id===codex.model)
  const efforts=selectedModel?.supportedEfforts??[]
  if (!project) return null
  const coverage = cutoutCoverage(clips)
  const prepare = async (): Promise<void> => {
    usePlayback.getState().pause()
    await useProject.getState().flush()
    const current = useProject.getState()
    if (current.project?.id !== project.id) throw new Error('Proyek berubah. Buka kembali panel edit otomatis.')
    if (current.saveState !== 'saved') throw new Error(current.saveError || 'Perubahan belum tersimpan. Selesaikan penyimpanan sebelum edit otomatis.')
    await window.api.editorAutomation.presence({ projectId: project.id, saveState: 'saved' })
  }
  const run = async (undo = false, resume = false): Promise<void> => {
    if (lock.current || running) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await prepare()
      if (undo) {
        const context = await window.api.editorAutomation.context(project.id)
        if (!context.undoAvailable) throw new Error('Edit otomatis terakhir sudah berubah. Undo tidak lagi tersedia.')
        await window.api.editorAutomation.undo(project.id, context.revision)
        setUndoAvailable(false)
        toast('success', 'Edit otomatis terakhir dibatalkan.')
      } else {
        const next = resume&&resumeJobId?await window.api.editorAutomation.resume(project.id,resumeJobId):await window.api.editorAutomation.run({ projectId: project.id, ...(resume&&job?(job.clipId?{clipId:job.clipId}:{}):(scope === 'clip' && clip ? { clipId: clip.id } : {})), instruction: instruction.trim(), production, codex:{...codex,...(codex.model&&!codex.effort&&selectedModel?.defaultEffort?{effort:selectedModel.defaultEffort}:{})}, specialClips })
        useProject.getState().upsertJob(next)
      }
    } catch (err) { setError(errorText(err)) }
    finally { lock.current = false; setBusy(false) }
  }

  return <div className="flex flex-col gap-4 p-[18px]">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4" /> Edit otomatis dengan Codex</h3><p className="mt-2 text-xs leading-relaxed text-muted">Codex dapat menyusun kebutuhan, membuat aset terpisah, lalu mengatur komposisi, pose dan gerak mengikuti narasi.</p></div>
    <div className={cx('rounded-xl border p-3 text-xs leading-relaxed', status?.codexReady ? 'border-line bg-ok-soft text-ok-ink' : 'border-line-2 bg-paper text-ink-2')}>
      <p>{status ? status.codexMessage : 'Memeriksa koneksi Codex…'}</p>
      <button type="button" className="mt-2 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(null); void window.api.editorAutomation.status().then(setStatus).catch(err => setError(errorText(err))) }}><RefreshCw className="size-3" /> Periksa koneksi</button>
    </div>
    <section className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <p className="text-xs font-semibold">Model penyutradaraan & edit Codex</p>
      <label className="text-xs">Model<select aria-label="Model edit Codex" className={cx(inputCls,'mt-1 w-full text-xs')} value={codex.model??''} disabled={busy||running||modelsBusy} onChange={e=>setCodex(e.target.value?{model:e.target.value}:{})}><option value="">Ikuti model visual di Pengaturan</option>{models.map(m=><option key={m.id} value={m.id}>{m.name}{m.isDefault?' · default akun':''}</option>)}</select></label>
      <label className="text-xs">Effort<select aria-label="Effort edit Codex" className={cx(inputCls,'mt-1 w-full text-xs')} value={codex.effort??''} disabled={busy||running||!selectedModel} onChange={e=>setCodex({...codex,effort:e.target.value||undefined})}><option value="">{selectedModel?.defaultEffort?'Default model · '+selectedModel.defaultEffort:'Otomatis'}</option>{efforts.map(e=><option key={e} value={e}>{e}</option>)}</select></label>
      <button type="button" className="text-left text-xs font-semibold underline" disabled={busy||running||modelsBusy} onClick={()=>void loadModels()}>{modelsBusy?'Memuat katalog…':'Muat ulang model & effort'}</button>
      <p className="text-[11px] leading-relaxed text-muted">Pilihan berlaku pada perencanaan, penyutradaraan dan komposisi untuk proses ini. Effort lebih tinggi dapat memerlukan waktu lebih lama. Gambar dan video tetap memakai provider aset.</p>
    </section>
    <section className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <label className="flex items-start gap-2 text-xs font-semibold"><input aria-label="Klip khusus otomatis" type="checkbox" checked={specialClips.enabled} disabled={busy||running} onChange={e=>setSpecialClips({...specialClips,enabled:e.target.checked})}/>Klip khusus · wajah / aksi kontinu</label>
      {specialClips.enabled&&<>
        <label className="text-xs">Penyutradaraan<select aria-label="Aksi klip khusus" className={cx(inputCls,'mt-1 w-full text-xs')} value={specialClips.mode} disabled={busy||running} onChange={e=>setSpecialClips({...specialClips,mode:e.target.value as SpecialClipOptions['mode']})}><option value="auto">Otomatis sesuai narasi</option><option value="face">Gerak wajah kontinu</option><option value="continuous">Aksi kontinu / interaksi rumit</option></select></label>
        <label className="text-xs">Sumber video<select aria-label="Sumber klip khusus" className={cx(inputCls,'mt-1 w-full text-xs')} value={specialClips.source} disabled={busy||running} onChange={e=>setSpecialClips({...specialClips,source:e.target.value as SpecialClipOptions['source']})}><option value="existing">Gunakan video klip yang tersedia</option><option value="flow-mcp">Generate Flow MCP · 4 detik, 720p</option></select></label>
        {specialClips.source==='flow-mcp'&&<div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Video baru maksimum<input aria-label="Batas klip khusus" type="number" min={1} max={64} className={cx(inputCls,'mt-1 w-full text-xs')} value={specialClips.maxNewClips} disabled={busy||running} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=64)setSpecialClips({...specialClips,maxNewClips:n})}}/></label>
          <label className="text-xs">Kredit maksimum / video<input aria-label="Batas kredit klip khusus" type="number" min={1} max={100} className={cx(inputCls,'mt-1 w-full text-xs')} value={specialClips.maxCreditsPerClip} disabled={busy||running} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=100)setSpecialClips({...specialClips,maxCreditsPerClip:n})}}/></label>
        </div>}
        <p className="text-[11px] leading-relaxed text-muted">Codex memilih satu aksi per shot. Mode otomatis memakai Cutout untuk aksi sederhana. Video khusus memenuhi frame; durasi disesuaikan lewat kecepatan 0,25–4×, suara sumber dibisukan. Selesaikan gambar awal untuk generate. Impor footage melalui storyboard bila sudah tersedia. Sinkron bibir terhadap ucapan belum otomatis.</p>
        {clip?.cutout?.specialVideo&&<p className="text-xs text-ok-ink">Terpasang: {clip.cutout.specialVideo.action} · {clip.cutout.specialVideo.speed.toFixed(2)}×</p>}
      </>}
    </section>
    <label className="flex flex-col gap-1.5 text-[13px]">Cakupan edit<select aria-label="Cakupan edit otomatis" className={inputCls} value={scope} disabled={busy || running} onChange={e => setScope(e.target.value as 'clip' | 'project')}><option value="clip">Klip terpilih{clip ? ` · ${clip.title}` : ''}</option><option value="project">Seluruh proyek</option></select></label>
    <p className="text-xs leading-relaxed text-muted">{scope === 'clip' ? 'Klip terpilih: gerak Cutout, pose, transisi, dan durasi adegan. Pilih Seluruh proyek untuk mengatur SFX, caption, label, dan musik.' : 'Seluruh proyek: gerak semua adegan, SFX, caption, label, dan volume musik dapat disesuaikan.'}</p>
    {isCutoutReference(project) && <div className="rounded-xl border border-line p-3 text-xs leading-relaxed" data-cutout-coverage><strong>Komposisi Cutout: {coverage.ready}/{coverage.total} klip</strong><p className="mt-1 text-muted">{scope === 'clip' ? 'Proses ini hanya mengubah satu klip. Klip lain dan caption proyek tidak ikut diperbaiki.' : 'Seluruh proyek diproses. Gambar utuh tetap membutuhkan aset terpisah untuk aksi dan pergantian pose.'} Kepadatan keyframe bukan ukuran kemiripan referensi. Narasi yang perlu ditulis ulang diselesaikan di tahap Naskah dan Suara sebelum produksi aset.</p></div>}
    <section className="flex flex-col gap-3 rounded-xl border border-line p-3" data-cutout-production>
      <label className="flex items-start gap-2 text-xs font-semibold"><input aria-label="Generate aset otomatis" type="checkbox" checked={production.enabled} disabled={busy||running} onChange={e=>setProduction({...production,enabled:e.target.checked})}/>Generate aset yang dibutuhkan dan susun Cutout</label>
      {production.enabled&&<details>
        <summary className="cursor-pointer text-xs font-semibold">{production.provider==='codex'?'Codex':'Flow MCP'} · {production.format.toUpperCase()} · ≤{production.maxAssetsPerClip} aset/klip · {production.fps} fps</summary>
        <div className="mt-3 flex flex-col gap-3">
        <p className="text-[11px] leading-relaxed text-muted">Kebutuhan dari narasi → antrean PNG/WebP → layer dan pose → komposisi serta gerak sendi. Aset selesai tersimpan di Cutout dan dipakai kembali saat melanjutkan proses yang sama.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Provider aset<select aria-label="Provider produksi otomatis" className={cx(inputCls,'mt-1 w-full text-xs')} value={production.provider} disabled={busy||running} onChange={e=>setProduction({...production,provider:e.target.value as CutoutProductionOptions['provider']})}><option value="codex">Codex</option><option value="flow-mcp">Flow MCP</option></select></label>
          <label className="text-xs">Format<select aria-label="Format produksi otomatis" className={cx(inputCls,'mt-1 w-full text-xs')} value={production.format} disabled={busy||running} onChange={e=>setProduction({...production,format:e.target.value as 'png'|'webp'})}><option value="png">PNG alpha</option><option value="webp">WebP lossless</option></select></label>
          <label className="text-xs">Aset maksimum / klip<select aria-label="Batas aset per klip" className={cx(inputCls,'mt-1 w-full text-xs')} value={production.maxAssetsPerClip} disabled={busy||running} onChange={e=>setProduction({...production,maxAssetsPerClip:Number(e.target.value)})}>{[12,32,64,128,256].map(n=><option value={n} key={n}>{n} gambar</option>)}</select></label>
          <label className="text-xs">Gambar baru / proses<input aria-label="Batas gambar baru per proses" type="number" min={1} max={2048} className={cx(inputCls,'mt-1 w-full text-xs')} value={production.maxNewAssets} disabled={busy||running} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=2048)setProduction({...production,maxNewAssets:n})}}/></label>
        </div>
        <label className="text-xs">Kepadatan gerak<select aria-label="Kepadatan gerak otomatis" className={cx(inputCls,'mt-1 w-full text-xs')} value={production.motion} disabled={busy||running} onChange={e=>setProduction({...production,motion:e.target.value as 'frames'|'keyframes'})}><option value="frames">Keyframe setiap frame</option><option value="keyframes">Keyframe utama + interpolasi</option></select></label>
        <label className="text-xs">Grid frame<select aria-label="FPS gerak otomatis" className={cx(inputCls,'mt-1 w-full text-xs')} value={production.fps} disabled={busy||running} onChange={e=>setProduction({...production,fps:Number(e.target.value) as 30|60})}><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
        <p className="text-[11px] leading-relaxed text-muted">Batas adalah maksimum, bukan jumlah wajib. Generate memakai akun/provider terpilih. Pose baru dibuat sesuai aksi; keyframe tiap frame menyampel gerak, bukan otomatis membuat PNG pada setiap frame. Target kontak IK dapat mengikuti properti bergerak. Tinjau alpha, identitas dan titik kontak pada hasil.</p>
        </div>
      </details>}
    </section>
    <label className="flex flex-col gap-1.5 text-[13px]">Arahan untuk Codex<textarea aria-label="Arahan edit otomatis" className={cx(inputCls, 'min-h-36 resize-y text-[13px] leading-relaxed')} value={instruction} maxLength={6000} disabled={busy || running} onChange={e => setInstruction(e.target.value)} /></label>
    <p className="text-xs leading-relaxed text-muted">{production.enabled?'Aset baru dibuat sebagai layer/pose terpisah sesuai narasi. Foto utuh tidak otomatis menjadi rig. Komposisi diterapkan setelah semua tahap selesai; jika gagal atau dibatalkan, aset yang selesai tetap tersedia.':'Gunakan aset tokoh, properti, pose dan SFX yang sudah tersedia. Gambar utuh perlu aset terpisah untuk gerak per objek.'}</p>
    <Button size="sm" variant="primary" icon={<Sparkles className="size-4" />} loading={busy} disabled={running || !status?.codexReady || !instruction.trim() || (scope === 'clip' && !clip)} onClick={() => void run()}>{specialClips.enabled?'Produksi klip khusus & edit otomatis':production.enabled?'Generate aset & edit otomatis':'Edit otomatis dengan Codex'}</Button>
    {job && <div aria-live="polite" className="rounded-xl border border-line p-3 text-xs leading-relaxed">
      <p className="whitespace-pre-wrap break-words">{job.message || (running ? 'Codex sedang mengedit…' : job.status === 'done' ? 'Edit selesai. Tinjau hasil di pratinjau.' : job.status === 'canceled' ? 'Edit dibatalkan.' : 'Edit otomatis gagal.')}</p>
      {running && <><progress aria-label="Progres edit otomatis" max={1} value={Math.max(0, Math.min(1, job.progress))} className="mt-2 h-2 w-full" /><Button size="sm" className="mt-2" icon={<X className="size-3" />} onClick={() => { void window.api.generate.cancel(job.id).catch(err => setError(errorText(err))) }}>Batalkan</Button></>}
      {job.error && <p role="alert" className="mt-2 break-words text-bad-ink">{job.error}</p>}
    </div>}
    {job&&['failed','canceled'].includes(job.status)&&<div className="rounded-xl border border-line p-3 text-xs"><Button size="sm" disabled={busy||running||!status?.codexReady} onClick={()=>void run(false,true)}>Lanjutkan proses terakhir</Button><p className="mt-2 leading-relaxed text-muted">{resumeJobId?'Memakai cakupan, arahan, model dan batas produksi dari proses tersimpan. ':'Proses lama: cakupan sebelumnya, pengaturan panel saat ini. '}Paket aset valid dan komposisi tahap selesai dipakai kembali; hanya kebutuhan yang belum selesai diproses. Untuk kebutuhan baru, susun ulang paket di Cutout.</p></div>}
    {error && <p role="alert" className="text-xs leading-relaxed text-bad-ink">{error}</p>}
    <Button size="sm" icon={<Undo2 className="size-4" />} disabled={!undoAvailable || busy || running} onClick={() => void run(true)}>Batalkan edit otomatis terakhir</Button>
    <p className="text-[11px] leading-relaxed text-muted">Undo mengembalikan komposisi selama hasil belum diedit lagi. Aset gambar yang sudah dibuat tetap disimpan di Cutout.</p>
    {status?.mcp && <details className="rounded-xl border border-line p-3 text-xs"><summary className="cursor-pointer font-semibold">Koneksi MCP Naraflow</summary><p className="mt-2 leading-relaxed">{status.mcp.running ? 'MCP lokal aktif selama Naraflow terbuka.' : status.mcp.error || 'MCP lokal belum aktif.'}</p>{status.mcp.relayPath && status.mcp.descriptorPath && <Button size="sm" className="mt-2" icon={<Copy className="size-3" />} onClick={() => { void window.api.app.copyText(JSON.stringify({ mcpServers: { naraflow: { command: 'node', args: [status.mcp!.relayPath, '--connection', status.mcp!.descriptorPath] } } }, null, 2)).then(() => toast('success', 'Konfigurasi MCP disalin.')).catch(err => setError(errorText(err))) }}>Salin konfigurasi MCP</Button>}</details>}
  </div>
}
