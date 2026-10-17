import { useRef, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { autoSyncEnabled, syncedVoiceDuration, type NarrationVisualDraft } from '@shared/voiceover'
import { Button, Modal } from './ui'
import { useProject, isRunning } from '../store/project'
import { useApp } from '../store/app'
import { errorText, mmss } from '../lib/format'

export function VoiceoverSyncPanel() {
  const { project, clips, assets, jobs, updateEditor, flush, load } = useProject(), { toast } = useApp()
  const [busy, setBusy] = useState<'sync' | 'draft' | 'apply' | null>(null), [draft, setDraft] = useState<NarrationVisualDraft | null>(null)
  const pending = useRef(false)
  if (!project) return null
  const enabled = autoSyncEnabled(project)
  const ready = clips.filter(c => syncedVoiceDuration(c, c.audioAssetId ? assets[c.audioAssetId] : null) != null)
  const working = Object.values(jobs).some(j => isRunning(j) && ['tts', 'narration'].includes(j.kind))
  const hasVisual = clips.some(c => c.imageAssetId || c.videoAssetId)
  const prepare = async () => { await flush(); if (useProject.getState().saveState !== 'saved') throw new Error('Simpan proyek sebelum melanjutkan.') }
  const run = async (action: 'sync' | 'draft' | 'apply') => {
    if (pending.current) return
    pending.current = true; setBusy(action)
    try {
      if (action === 'sync') updateEditor({ autoSyncVoiceover: true })
      await prepare()
      if (action === 'draft') setDraft(await window.api.story.visualNarration(project.id))
      else {
        const bundle = action === 'sync' ? await window.api.generate.syncVoiceover(project.id) : await window.api.story.applyVisualNarration(project.id, draft!.token)
        if (useProject.getState().project?.id !== project.id) return
        load(bundle)
        if (action === 'apply') setDraft(null)
        toast('success', action === 'sync' ? 'Visual mengikuti panjang suara. Urutan cerita tetap dipakai.' : 'Narasi mengikuti visual sudah diterapkan. Buat atau perbarui suara narasi untuk menyinkronkan durasi.')
      }
    } catch (error) { toast('error', errorText(error)) }
    finally { pending.current = false; setBusy(null) }
  }
  return <div data-voiceover-sync className="rounded-xl border border-line-2 bg-surface p-3">
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" aria-label="Auto-Sync Images to Voiceover" checked={enabled} disabled={!!busy || working} onChange={e => updateEditor({ autoSyncVoiceover: e.target.checked })} />Auto-Sync Images to Voiceover</label>
      <span className="text-xs text-muted">{ready.length}/{clips.length} suara terkini · {mmss(clips.reduce((n, c) => n + c.durationMs, 0))}</span>
      <Button size="sm" icon={<RefreshCw className="size-4" />} loading={busy === 'sync'} disabled={!!busy || working || !ready.length} onClick={() => void run('sync')}>Sinkronkan visual ke suara</Button>
      <Button size="sm" icon={<Sparkles className="size-4" />} loading={busy === 'draft'} disabled={!!busy || working || !hasVisual} onClick={() => void run('draft')}>Sesuaikan narasi dengan visual</Button>
      {busy === 'draft' && <Button size="sm" onClick={() => void window.api.story.cancel(project.id)}>Batalkan</Button>}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted">{enabled ? 'Panjang adegan mengikuti rekaman narasi secara otomatis. Gambar bertahan selama suara; video yang lebih pendek menahan frame terakhir. Alur cerita menentukan narasi, tanpa batas tetap per adegan.' : 'Durasi manual aktif. Aktifkan Auto-Sync untuk mengikuti panjang rekaman narasi.'} Draf AI meninjau gambar atau cuplikan awal, tengah, dan akhir video memakai penyusun cerita yang dipilih.</p>
    <Modal open={!!draft} onClose={() => { if (!busy) setDraft(null) }} title="Tinjau narasi mengikuti visual" subtitle="Narasi belum diganti. Adegan tanpa media mempertahankan teksnya. Setelah diterapkan, perbarui suara narasi." width={850}>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto">{draft?.scenes.map((scene, i) => <div key={scene.id} className="rounded-xl border border-line-2 p-3">
        <p className="mb-2 text-sm font-semibold">{i + 1}. {scene.title}{!scene.observed && ' · belum ada media'}</p>
        <p className="text-xs text-muted">Sebelumnya: {scene.before || 'Belum ada narasi'}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{scene.narration}</p>
      </div>)}</div>
      <div className="mt-4 flex justify-end gap-2"><Button disabled={!!busy} onClick={() => setDraft(null)}>Kembali</Button><Button variant="primary" loading={busy === 'apply'} disabled={!!busy} onClick={() => void run('apply')}>Gunakan narasi</Button></div>
    </Modal>
  </div>
}
