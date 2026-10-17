import { isHealthDialogueStyle } from '@shared/health-dialogue'
import { useState } from 'react'
import { Copy, Download, Library, RefreshCw, Sparkles, Trash2, Upload, UserPlus } from 'lucide-react'
import { buildCodexCharacterPrompt } from '@shared/external-prompts'
import { Button, Field, Modal, Progress, confirmDialog, cx, inputCls } from '../../components/ui'
import { errorText } from '../../lib/format'
import { useCodexStatus, useVisualWorkflow } from '../../lib/useVisualWorkflow'
import { useApp } from '../../store/app'
import { isRunning, jobFor, useProject } from '../../store/project'
import { HealthCharacterLibrary } from './HealthCharacterLibrary'
import { useFlowWorkflow } from '../../lib/useFlowWorkflow'
import { isStickmanMaster, isVoxMaster } from '@shared/master-prompts'
import { getStyle } from '@shared/styles'
import { getContentSkill } from '@shared/skills'
import { StyleSwatch } from '../../components/StyleArt'

/**
 * Edits a character, or with `characterId` "new" collects a new one that is only added once it is saved,
 * so a misclick on "Tambah pemeran" leaves nothing behind.
 */
export function CharacterModal({
  characterId,
  onClose,
  onCreated
}: {
  characterId: string | null
  onClose: () => void
  /** Called with the id of a newly saved character, e.g. to keep its modal open for the sheet. */
  onCreated?: (id: string) => void
}) {
  if (characterId === 'new') return <NewCharacter onClose={onClose} onCreated={onCreated} />
  return <EditCharacter characterId={characterId} onClose={onClose} />
}

const LOOK_HINT =
  'Tulis ciri tubuh dulu, lalu "Default outfit:" untuk baju bawaan di lembar karakter. Baju bisa diganti per adegan lewat baris Wardrobe di prompt visual. Contoh: human man, 40s, short black hair, warm brown skin. Default outfit: light-blue colony medical scrubs, stethoscope.'
const HEALTH_LOOK_HINT =
  'Jelaskan organ, jaringan, atau selnya: bentuk biologis, warna, mata, mulut, dan ciri identitas. Contoh: lambung kartun 2D merah muda berbentuk kantong, dua mata putih, satu mulut, tangan pendek. Pose dan ekspresi berubah mengikuti aksi setiap adegan.'

function NewCharacter({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const { addCharacter, project, selectedClipId, clips, updateClip } = useProject()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tab, setTab] = useState<'custom' | 'library'>(project?.skillId === 'explainer-animasi-kesehatan' && !isHealthDialogueStyle(project?.styleId) ? 'library' : 'custom')
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [attach, setAttach] = useState(true)
  const typed = !!(name.trim() || description.trim())

  const save = (): void => {
    const id = addCharacter({ name, description })
    const clip = clips.find(c => c.id === selectedClipId)
    if (attach && clip) updateClip(clip.id, { characterIds: [...clip.characterIds, id] })
    if (onCreated) onCreated(id)
    else onClose()
  }

  // Closing an untouched form adds nothing; closing after typing asks instead of guessing.
  const close = async (): Promise<void> => {
    if (libraryBusy) return
    if (!typed) return onClose()
    const keep = await confirmDialog({
      title: 'Simpan pemeran ini?',
      body: 'Kamu sudah mengisi data pemeran baru. Simpan sebagai pemeran, atau buang?',
      confirm: 'Simpan',
      cancel: 'Buang'
    })
    if (keep) save()
    else onClose()
  }

  return (
    <Modal open onClose={() => void close()} title="Pemeran baru" subtitle={`Identitas mengikuti ${project ? getStyle(project.styleId).name : 'gaya proyek'} dan aksi disesuaikan dengan narasi adegan.`} width={tab === 'library' ? 1000 : 760}>
      <div className="flex gap-2"><Button size="sm" variant={tab === 'library' ? 'ink' : 'secondary'} icon={<Library className="size-4" />} disabled={libraryBusy} onClick={() => setTab('library')}>Pustaka kesehatan</Button><Button size="sm" variant={tab === 'custom' ? 'ink' : 'secondary'} icon={<UserPlus className="size-4" />} disabled={libraryBusy} onClick={() => setTab('custom')}>Buat sendiri</Button></div>
      {tab === 'library' ? <HealthCharacterLibrary onBusyChange={setLibraryBusy} onImported={(id) => { if (onCreated) onCreated(id); else onClose() }} /> : <>
      <div className="flex h-[150px] flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-3 bg-paper text-sm text-ink-2">
        <UserPlus className="size-6 text-muted" />
        Lembar karakter dibuat setelah pemeran disimpan.
      </div>
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
        <Field label="Nama">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Gajah Mada" className={cx(inputCls, 'h-11')} />
        </Field>
        <Field label="Penampilan" hint={project && isStickmanMaster(project) ? 'Jelaskan siluet stickman, ciri unik, pakaian/alat sesuai niche; tetap gambar 2D sederhana. Ekspresi dan pose mengikuti aksi narasi.' : project && isVoxMaster(project) ? 'Gunakan foto sumber yang disediakan untuk identitas nyata. Jelaskan potongan foto/halftone; jangan mengarang wajah atau bukti arsip.' : isHealthDialogueStyle(project?.styleId) ? 'Pilih pemeran sesuai cerita: organ, makanan, mikroba, atau manusia. Jelaskan siluet, warna, satu wajah dan ciri khas; ekspresi dan gestur berubah mengikuti dialog. Pustaka PNG opsional mempertahankan identitas aset yang kamu pilih.' : project?.skillId === 'explainer-animasi-kesehatan' ? HEALTH_LOOK_HINT : LOOK_HINT}>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cx(inputCls, 'resize-none py-2.5 text-sm leading-relaxed')}
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2.5">
        {selectedClipId && <label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />Pakai pada adegan aktif</label>}
        <Button onClick={() => void close()}>Batal</Button>
        <Button variant="primary" disabled={!name.trim()} onClick={save}>
          Simpan pemeran
        </Button>
      </div>
      </>}
    </Modal>
  )
}

function EditCharacter({ characterId, onClose }: { characterId: string | null; onClose: () => void }) {
  const { project, characters, assets, jobs, updateCharacter, removeCharacter, flush, clips, upsertJob } = useProject()
  const { toast } = useApp()
  const higgsfield = useVisualWorkflow()
  const flow = useFlowWorkflow()
  const { status: codexStatus, checking: checkingCodex, refresh: refreshCodex } = useCodexStatus(!higgsfield && !flow && !!characterId)
  const [importing, setImporting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryBusy, setLibraryBusy] = useState(false)
  const c = characters.find((x) => x.id === characterId)
  if (!c || !project) return null
  const sheet = c.sheetAssetId ? assets[c.sheetAssetId] : null
  const job = jobFor(jobs, 'sheet', { characterId: c.id })
  const running = isRunning(job)
  const codexReady = !!codexStatus?.available && codexStatus.authenticated && codexStatus.imageGeneration && codexStatus.connections?.image !== false && !checkingCodex
  const usedIn = clips.filter((cl) => cl.characterIds.includes(c.id)).length
  const versions = Object.values(assets).filter(asset => asset.characterId === c.id && asset.kind === 'image').sort((a, b) => b.createdAt - a.createdAt)
  const selectReference = async (assetId: string | null): Promise<void> => {
    setImporting(true)
    try {
      await flush()
      if (useProject.getState().saveState === 'error') throw new Error('Simpan perubahan karakter sebelum memilih referensi.')
      await window.api.assets.selectCharacterReference(c.id, assetId)
      toast('success', assetId ? 'Referensi aktif diperbarui.' : 'Referensi dilepas. Gambar tetap ada di riwayat.')
    } catch (error) { toast('error', errorText(error)) }
    finally { setImporting(false) }
  }

  const generate = async (): Promise<void> => {
    setStarting(true)
    try {
      await flush()
      if (useProject.getState().saveState === 'error') throw new Error('Simpan perubahan karakter sebelum generate.')
      const next = flow ? await window.api.flow.characterSheet(c.id) : higgsfield ? await window.api.generate.characterSheet(c.id) : await window.api.codex.generateCharacterSheet(c.id)
      upsertJob(next)
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setStarting(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (!job || !running) return
    setCanceling(true)
    try { await window.api.generate.cancel(job.id) }
    catch (e) { toast('error', errorText(e)) }
    finally { setCanceling(false) }
  }

  const copyPrompt = async (): Promise<void> => {
    try {
      await flush()
      await window.api.app.copyText(buildCodexCharacterPrompt(project, c))
      toast('success', 'Prompt lembar karakter disalin. Tempel di chat Codex, lalu impor hasil gambarnya.')
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const importSheet = async (): Promise<void> => {
    setImporting(true)
    try {
      await flush()
      if (useProject.getState().saveState === 'error') throw new Error('Simpan perubahan karakter sebelum mengunggah referensi.')
      const asset = await window.api.assets.pickCharacterSheet(c.id)
      if (asset) toast('success', 'Lembar karakter diimpor sebagai referensi pemeran ini.')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setImporting(false)
    }
  }

  const saveSheet = async (): Promise<void> => {
    if (!sheet) return
    try {
      const path = await window.api.assets.exportImage(sheet.id)
      if (path) toast('success', 'Lembar karakter disimpan. Lampirkan di chat Codex saat membuat gambar adegan.')
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const remove = async (): Promise<void> => {
    const ok = await confirmDialog({
      title: `Hapus pemeran ${c.name}?`,
      body: `Pemeran ini dipakai di ${usedIn} klip. Klip tetap ada, hanya tautan pemerannya yang dilepas.`,
      confirm: 'Hapus pemeran',
      danger: true
    })
    if (!ok) return
    removeCharacter(c.id)
    onClose()
  }

  return (
    <Modal open onClose={() => { if (!libraryBusy && !importing) onClose() }} title="Studio karakter" subtitle={getContentSkill(project.skillId).name + ' · ' + getStyle(project.styleId).name + (project.subjectNiche ? ' · ' + project.subjectNiche : '')} width={1080}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="text-xs text-ink-2">Identitas → referensi → generate lembar → pakai di {usedIn} adegan</p>
        {project.skillId === 'explainer-animasi-kesehatan' && <Button size="sm" icon={<Library className="size-4" />} disabled={running || starting || importing || libraryBusy} onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? 'Kembali ke karakter' : 'Pustaka kesehatan'}</Button>}
      </div>
      {libraryOpen ? <HealthCharacterLibrary characterId={c.id} onBusyChange={setLibraryBusy} onImported={() => setLibraryOpen(false)} /> : <>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" data-character-studio>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3"><StyleSwatch styleId={project.styleId} className="aspect-square w-16 overflow-hidden rounded-lg" /><div><p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Arah karakter</p><p className="mt-1 text-sm font-semibold">{getStyle(project.styleId).name}</p><p className="mt-1 text-xs text-muted">Material dan palet mengikuti dunia cerita.</p></div></div>
          <Field label="Nama karakter"><input value={c.name} disabled={running || starting} onChange={(e) => updateCharacter(c.id, { name: e.target.value })} className={cx(inputCls, 'h-11')} /></Field>
          <Field label="Peran, kepribadian & penampilan" hint={isStickmanMaster(project) ? 'Jaga siluet stickman, kostum, ciri unik, serta properti sesuai niche.' : isVoxMaster(project) ? 'Gunakan foto sumber untuk identitas nyata. Rekonstruksi visual bukan bukti arsip.' : isHealthDialogueStyle(project?.styleId) ? 'Pilih pemeran sesuai cerita: organ, makanan, mikroba, atau manusia. Jelaskan siluet, warna, satu wajah dan ciri khas; ekspresi dan gestur berubah mengikuti dialog. Pustaka PNG opsional mempertahankan identitas aset yang kamu pilih.' : project.skillId === 'explainer-animasi-kesehatan' ? HEALTH_LOOK_HINT : 'Jelaskan peran dalam cerita, ciri yang mudah dikenali, kostum, properti, dan gestur khas.'}>
            <textarea rows={8} maxLength={6000} value={c.description} disabled={running || starting} onChange={(e) => updateCharacter(c.id, { description: e.target.value })} placeholder="Peran: ...
Kepribadian: ...
Ciri khas: ...
Default outfit: ...
Pose aksi: ..." className={cx(inputCls, 'resize-y py-3 text-sm leading-relaxed')} />
          </Field>
          <div className="rounded-xl border border-line bg-paper p-3 text-xs leading-relaxed text-ink-2"><strong className="text-ink">Referensi menjadi acuan identitas.</strong><p className="mt-1">{higgsfield && !flow ? 'Unggah foto, desain, atau character sheet untuk referensi adegan. Pembuatan lembar melalui Higgsfield memakai deskripsi karakter; pilih Codex atau Flow untuk generate lembar dari gambar aktif.' : 'Unggah foto, desain, atau character sheet. Saat generate ulang, gambar aktif dipakai sebagai referensi. Hasil baru menjadi acuan untuk adegan berikutnya.'}</p><p className="mt-2 text-muted">Pose dan ekspresi diarahkan sesuai narasi, dengan bentuk, ciri khas, dan identitas sebagai acuan.</p></div>
          <Button icon={<Copy className="size-4" />} onClick={() => void copyPrompt()}>Salin prompt karakter</Button>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between text-xs"><strong>{sheet ? 'Referensi aktif' : 'Siapkan referensi karakter'}</strong><span className="text-muted">{sheet?.provider === 'local' ? 'Diunggah' : sheet ? 'Hasil generate' : 'PNG / JPG / WebP'}</span></div>
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line-2 bg-paper">
            {sheet ? <img src={sheet.url} alt={'Referensi aktif ' + c.name} className="size-full object-contain" /> : <div className="flex max-w-[290px] flex-col items-center gap-3 p-6 text-center"><UserPlus className="size-9 text-muted" /><p className="text-sm font-semibold">Wujudkan pemeran ceritamu</p><p className="text-xs leading-relaxed text-muted">Unggah gambar sebagai acuan, atau generate dari deskripsi karakter dan gaya terpilih.</p></div>}
            {running && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/85 p-5 backdrop-blur-sm"><p role="status" className="text-sm font-semibold">{job?.message || 'Membuat karakter'} · {Math.round((job?.progress || 0) * 100)}%</p><Progress value={job?.progress || 0} className="w-3/4" /><Button size="sm" loading={canceling} onClick={() => void cancel()}>Batalkan</Button></div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button icon={<Upload className="size-4" />} loading={importing} disabled={running || starting || libraryBusy} onClick={() => void importSheet()}>Unggah referensi</Button>
            <Button variant="primary" icon={<Sparkles className="size-4" />} loading={starting} disabled={running || importing || (!flow && !higgsfield && !codexReady)} onClick={() => void generate()}>{sheet ? higgsfield && !flow ? 'Generate ulang karakter' : 'Generate dari referensi' : 'Generate karakter'}</Button>
          </div>
          {job?.status === 'failed' && <p role="alert" className="rounded-lg bg-bad-soft p-3 text-xs text-bad-ink">{job.error || 'Gambar belum berhasil dibuat. Referensi sebelumnya tetap tersedia.'}</p>}
          {!flow && !higgsfield && !codexReady && <div className="flex items-center justify-between gap-2 text-xs text-muted"><span>{checkingCodex ? 'Memeriksa koneksi…' : codexStatus?.message || 'Hubungkan pembuat gambar di Pengaturan.'}</span><Button size="sm" icon={<RefreshCw className="size-3" />} loading={checkingCodex} onClick={refreshCodex}>Periksa</Button></div>}
          <p className="text-[11px] leading-relaxed text-muted">{flow ? 'Generate memakai Flow yang terhubung. Maksimal tiga referensi per shot.' : higgsfield ? 'Generate memakai layanan gambar yang dipilih di Pengaturan.' : 'Generate memakai akun Codex yang terhubung.'} Unggah gambar tidak menjalankan generate.</p>
          {sheet && <div className="flex flex-wrap gap-2"><Button size="sm" icon={<Download className="size-3.5" />} onClick={() => void saveSheet()}>Simpan gambar</Button><Button size="sm" variant="ghost" disabled={running || starting || importing} onClick={() => void selectReference(null)}>Lepas referensi</Button></div>}
          {versions.length > 0 && <div className="border-t border-line pt-3"><p className="mb-2 text-xs font-semibold">Versi tersimpan <span className="font-normal text-muted">· pilih untuk digunakan kembali</span></p><div className="flex gap-2 overflow-x-auto pb-2">{versions.map((asset, index) => <button key={asset.id} type="button" data-character-version={asset.id} aria-pressed={sheet?.id === asset.id} disabled={running || starting || importing} onClick={() => void selectReference(asset.id)} className={cx('w-20 shrink-0 overflow-hidden rounded-lg border bg-paper text-left', sheet?.id === asset.id ? 'border-accent ring-1 ring-accent' : 'border-line')}><img src={asset.url} alt={'Versi karakter ' + (versions.length - index)} className="aspect-square w-full object-contain" /><span className="block p-1.5 text-[10px]">{sheet?.id === asset.id ? 'Aktif' : 'Versi ' + (versions.length - index)}</span></button>)}</div></div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4"><Button variant="ghost" disabled={running || starting || importing} icon={<Trash2 className="size-4" />} onClick={() => void remove()}>Hapus karakter</Button><Button variant="ink" onClick={onClose}>Selesai</Button></div>
      </>}
    </Modal>
  )
}
