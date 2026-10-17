import { useEffect, useRef, useState } from 'react'
import { Film, Image, RefreshCw } from 'lucide-react'
import type { Clip } from '@shared/types'
import { isMapMaster } from '@shared/master-prompts'
import { FlowConnectionPanel } from './FlowConnectionPanel'
import { Button, confirmDialog } from './ui'
import { useProject, isRunning } from '../store/project'
import { useApp } from '../store/app'
import { errorText } from '../lib/format'
import { autoSyncEnabled } from '@shared/voiceover'

export function FlowShotControls({ clip }: { clip?: Clip }) {
  const { project, clips, jobs, flush, upsertJob, updateClip } = useProject(), { toast } = useApp()
  const [busy, setBusy] = useState(false), [cap, setCap] = useState(7)
  const pending = useRef(false)
  useEffect(() => { void window.api.settings.get().then(s => setCap(s.flowVideoMaxCredits)) }, [])
  if (!project) return null
  const map = isMapMaster(project), first = !clip || clips[0]?.id === clip.id
  const active = Object.values(jobs).some(j => j.provider === 'flow-mcp' && isRunning(j) && (!clip || j.clipId === clip.id))
  const count = clip ? 1 : clips.filter(c => !c.videoAssetId).length
  const run = async (kind: 'image' | 'video' | 'recover'): Promise<void> => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      if (kind === 'video' && !await confirmDialog({ title: clip ? 'Generate shot video Flow?' : `Generate ${count} shot video Flow?`,
        body: `Omni 1.1 Flash · 4 detik · 720p. Batas ${cap} kredit per shot, maksimal ${count * cap} kredit untuk permintaan ini. Flow melewati shot jika kutipan biayanya lebih tinggi.`, confirm: 'Generate video' })) return
      await flush()
      const saved = useProject.getState()
      if (saved.saveState !== 'saved') throw new Error(saved.saveError || 'Simpan proyek sebelum generate.')
      const result = kind === 'recover' ? await window.api.flow.recover(project.id)
        : clip ? [await (kind === 'image' ? window.api.flow.clipImage(clip.id) : window.api.flow.clipVideo(clip.id, cap))]
          : await (kind === 'image' ? window.api.flow.missingImages(project.id) : window.api.flow.missingVideos(project.id, cap))
      result.forEach(upsertJob)
      toast('success', result.length ? `${result.length} pekerjaan Flow dipantau. Hasil langsung masuk ke adegan.` : 'Tidak ada pekerjaan baru. Jika hasil belum pasti, periksa antrean/output di Flow MCP.')
    } catch (e) { toast('error', errorText(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  const timing = async (): Promise<void> => {
    const eligible = clips.filter(c => !c.audioAssetId)
    if (!await confirmDialog({ title: 'Terapkan durasi shot?', body: `${eligible.length} adegan tanpa suara memakai 4 detik untuk video dan 1,5 detik untuk gambar. Adegan bersuara mempertahankan durasi narasi.`, confirm: 'Terapkan' })) return
    for (const c of eligible) updateClip(c.id, { durationMs: c.motionType === 'video' ? 4000 : 1500 })
    await flush()
  }
  return <div data-flow-shot-controls className={clip ? 'space-y-2 rounded-xl border border-line-2 bg-paper p-3' : 'border-b border-line bg-paper px-6 py-3'}>
    {!clip && <FlowConnectionPanel />}
    <div className="mt-2 flex flex-wrap gap-2">
      {(!map || first) && <Button size="sm" icon={<Image className="size-4" />} loading={busy} disabled={active} onClick={() => void run('image')}>{clip ? 'Generate gambar Flow' : map ? 'Generate gambar awal Flow' : 'Generate gambar Flow yang belum siap'}</Button>}
      <Button size="sm" variant="accent" icon={<Film className="size-4" />} loading={busy} disabled={active || !count} onClick={() => void run('video')}>{clip ? 'Generate video Flow · 4s 720p' : `Generate ${count} video Flow`}</Button>
      {!clip && <><Button size="sm" icon={<RefreshCw className="size-4" />} loading={busy} disabled={active} onClick={() => void run('recover')}>Pulihkan hasil Flow</Button>{!autoSyncEnabled(project) && <Button size="sm" disabled={active} onClick={() => void timing()}>Terapkan durasi shot</Button>}</>}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted">{map ? 'Peta tetap berantai: frame akhir video sebelumnya diambil otomatis. Urutan aksi master disesuaikan ke sumber 4 detik.' : 'Referensi karakter mengikuti pemeran yang dipilih di klip. Video dengan gambar awal menjaga identitas dari gambar tersebut.'} {autoSyncEnabled(project) ? 'Video sumber tetap 4 detik. Panjang visual di timeline mengikuti narasi.' : 'Gambar direncanakan 1,5 detik; durasi edit dapat diubah secara manual.'} {active ? 'Antrean berjalan; hasil tidak dikirim ulang otomatis.' : ''}</p>
    {clip && Object.values(jobs).filter(j => j.provider === 'flow-mcp' && j.clipId === clip.id && (j.status === 'running' || j.status === 'queued' || j.status === 'failed')).slice(-2).map(j => <p key={j.id} role={j.status === 'failed' ? 'alert' : undefined} className="text-xs text-ink-2">{j.error || j.message || 'Menunggu Flow…'}</p>)}
  </div>
}
