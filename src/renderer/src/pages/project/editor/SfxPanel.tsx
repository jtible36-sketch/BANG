import { useEffect, useState } from 'react'
import { Copy, Plus, Trash2, Upload, Volume2 } from 'lucide-react'
import { SFX_LIMITS, soundEffectDurationMs, type SoundEffectCue } from '@shared/sfx'
import type { Asset } from '@shared/types'
import { Button, cx, inputCls } from '../../../components/ui'
import { errorText } from '../../../lib/format'
import { useProject } from '../../../store/project'
import { usePlayback, useSfxUi } from './engine'

function CueNumber({ label, value, min = 0, max, step = 0.01, onChange }: { label: string; value: number; min?: number; max: number; step?: number; onChange(value: number): void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = (): void => {
    const next = Number(draft.replace(',', '.'))
    if (!draft.trim() || !Number.isFinite(next)) { setDraft(String(value)); return }
    const bounded = Math.max(min, Math.min(max, next))
    setDraft(String(bounded)); onChange(bounded)
  }
  return <label className="flex min-w-0 flex-col gap-1 text-xs">{label}<input aria-label={label} className={cx(inputCls, 'h-9 w-full text-xs')} type="number" value={draft} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
}

export function SfxPanel({ total }: { total: number }) {
  const { project, assets, updateEditor } = useProject()
  const selectedId = useSfxUi(s => s.selectedId)
  const [assetId, setAssetId] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cues = project?.editor.sfx ?? []
  const audio = Object.values(assets).filter(a => a.kind === 'music' || a.kind === 'audio')
  const selected = cues.find(c => c.id === selectedId) ?? null
  if (!project) return null
  const save = (next: SoundEffectCue[]): void => { updateEditor({ sfx: next }); setError(null) }
  const update = (patch: Partial<SoundEffectCue>): void => {
    if (!selected) return
    const next = { ...selected, ...patch }
    const maxDuration = Math.max(1, Math.min(SFX_LIMITS.timeMs - next.startMs, SFX_LIMITS.timeMs - next.offsetMs))
    next.durationMs = Math.min(next.durationMs, maxDuration)
    const fadeSum = next.fadeInMs + next.fadeOutMs
    if (fadeSum > next.durationMs) { next.fadeInMs = Math.floor(next.fadeInMs * next.durationMs / fadeSum); next.fadeOutMs = next.durationMs - next.fadeInMs }
    save(cues.map(c => c.id === next.id ? next : c))
  }
  const add = (asset: Asset): void => {
    const current = useProject.getState()
    if (current.project?.id !== project.id) return
    const currentCues = current.project.editor.sfx ?? []
    if (currentCues.length >= SFX_LIMITS.cues) { setError('Maksimal 128 efek suara per proyek.'); return }
    const totalMs = Math.min(SFX_LIMITS.timeMs, current.clips.reduce((sum, clip) => sum + clip.durationMs, 0))
    const startMs = Math.min(Math.round(usePlayback.getState().t * 1000), Math.max(0, totalMs - 1))
    const durationMs = Math.max(1, Math.min(asset.durationMs || 1000, Math.max(1, totalMs - startMs), SFX_LIMITS.timeMs - startMs))
    const cue: SoundEffectCue = { id: crypto.randomUUID(), assetId: asset.id, startMs, offsetMs: 0, durationMs, volumeDb: -9, fadeInMs: 0, fadeOutMs: Math.min(80, durationMs) }
    save([...currentCues, cue]); useSfxUi.getState().select(cue.id)
  }
  const pick = async (): Promise<void> => {
    setImporting(true); setError(null)
    try {
      const asset = await window.api.assets.pickMusic(project.id)
      if (asset) { useProject.getState().addAsset(asset); setAssetId(asset.id); add(asset) }
    } catch (err) { setError(errorText(err)) }
    finally { setImporting(false) }
  }
  const source = selected ? assets[selected.assetId] : null
  const actualMs = selected ? soundEffectDurationMs(selected, source?.durationMs, total * 1000) : 0
  return <div className="flex flex-col gap-4 p-[18px]">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="size-4" /> Efek suara terjadwal</h3><p className="mt-2 text-xs leading-relaxed text-muted">Letakkan efek pada momen aksi. Beberapa efek dapat berbunyi bersamaan dan ikut masuk ke ekspor video.</p></div>
    <Button size="sm" icon={<Upload className="size-4" />} loading={importing} disabled={cues.length >= SFX_LIMITS.cues || total <= 0} onClick={() => void pick()}>Impor efek suara</Button>
    <div className="flex gap-2"><select aria-label="Aset efek suara" className={cx(inputCls, 'min-w-0 flex-1 text-xs')} value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">Pilih audio proyek…</option>{audio.map(a => <option value={a.id} key={a.id}>{a.prompt || a.id}</option>)}</select><Button size="sm" title="Tambah efek di playhead" aria-label="Tambah efek di playhead" disabled={!assets[assetId] || cues.length >= SFX_LIMITS.cues || total <= 0} icon={<Plus className="size-4" />} onClick={() => add(assets[assetId])} /></div>
    {error && <p role="alert" className="text-xs text-bad-ink">{error}</p>}
    <div className="flex max-h-44 flex-col gap-1 overflow-y-auto" aria-label="Daftar efek suara">{[...cues].sort((a,b) => a.startMs-b.startMs).map(cue => <button key={cue.id} type="button" aria-pressed={selectedId === cue.id} className={cx('flex gap-2 rounded-lg border px-2 py-2 text-left text-xs', selectedId === cue.id ? 'border-accent bg-accent-soft' : 'border-line')} onClick={() => { useSfxUi.getState().select(cue.id); usePlayback.getState().pause(); usePlayback.getState().seek(Math.min(total, cue.startMs / 1000)) }}><span className="font-mono">{(cue.startMs / 1000).toFixed(2)}s</span><span className="min-w-0 flex-1 truncate">{assets[cue.assetId]?.prompt || 'Audio tidak tersedia'}</span></button>)}</div>
    {!cues.length && <p className="text-xs leading-relaxed text-muted">Belum ada efek suara. Posisikan playhead pada aksi, lalu impor atau tambah audio.</p>}
    {selected && <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{source?.prompt || 'SFX terpilih'}</span><Button size="sm" aria-label="Duplikat efek suara" title="Duplikat efek suara" disabled={cues.length >= SFX_LIMITS.cues} icon={<Copy className="size-3.5" />} onClick={() => { const next = { ...selected, id: crypto.randomUUID() }; save([...cues, next]); useSfxUi.getState().select(next.id) }} /><Button size="sm" aria-label="Hapus efek suara" title="Hapus efek suara" icon={<Trash2 className="size-3.5" />} onClick={() => { save(cues.filter(c => c.id !== selected.id)); useSfxUi.getState().select(null) }} /></div>
      {!source && <p role="alert" className="text-xs text-bad-ink">Aset audio tidak ditemukan. Pilih penggantinya.</p>}
      <select aria-label="Ganti sumber efek suara" className={cx(inputCls, 'text-xs')} value={selected.assetId} onChange={e => update({ assetId: e.target.value, offsetMs: 0 })}>{!source && <option value={selected.assetId}>Aset hilang</option>}{audio.map(a => <option key={a.id} value={a.id}>{a.prompt || a.id}</option>)}</select>
      <div className="grid grid-cols-2 gap-3">
        <CueNumber label="Mulai di proyek (detik)" value={selected.startMs / 1000} max={Math.max(0, Math.min(total, SFX_LIMITS.timeMs / 1000) - 0.001)} onChange={v => update({ startMs: Math.round(v * 1000) })} />
        <CueNumber label="Potong awal sumber (detik)" value={selected.offsetMs / 1000} max={Math.max(0, (source?.durationMs || SFX_LIMITS.timeMs) / 1000 - 0.001)} onChange={v => update({ offsetMs: Math.round(v * 1000) })} />
        <CueNumber label="Durasi SFX (detik)" value={selected.durationMs / 1000} min={0.001} max={Math.max(0.001, (SFX_LIMITS.timeMs - Math.max(selected.startMs, selected.offsetMs)) / 1000)} onChange={v => update({ durationMs: Math.round(v * 1000) })} />
        <CueNumber label="Volume SFX (dB)" value={selected.volumeDb} min={-60} max={0} step={1} onChange={v => update({ volumeDb: v })} />
        <CueNumber label="Fade masuk (detik)" value={selected.fadeInMs / 1000} max={Math.max(0, (selected.durationMs - selected.fadeOutMs) / 1000)} onChange={v => update({ fadeInMs: Math.round(v * 1000) })} />
        <CueNumber label="Fade keluar (detik)" value={selected.fadeOutMs / 1000} max={Math.max(0, (selected.durationMs - selected.fadeInMs) / 1000)} onChange={v => update({ fadeOutMs: Math.round(v * 1000) })} />
      </div>
      <Button size="sm" onClick={() => update({ startMs: Math.min(Math.round(usePlayback.getState().t * 1000), Math.max(0, Math.min(Math.round(total * 1000), SFX_LIMITS.timeMs) - 1)) })}>Pindahkan ke playhead</Button>
      <p className="text-xs leading-relaxed text-muted">Durasi terdengar {(actualMs / 1000).toFixed(2)} detik. Sumber yang lebih pendek atau akhir proyek memotong efek; audio tidak diulang.</p>
    </div>}
  </div>
}
