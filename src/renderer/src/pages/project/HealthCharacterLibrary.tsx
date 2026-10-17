import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Library, Plus, Search } from 'lucide-react'
import type { HealthLibraryItem } from '@shared/health-library'
import { Button, Chip, cx } from '../../components/ui'
import { errorText } from '../../lib/format'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'

const TRANSPARENT_PREVIEW = {
  backgroundColor: '#fbfaf7',
  backgroundImage: 'linear-gradient(45deg,#e8e5dc 25%,transparent 25%),linear-gradient(-45deg,#e8e5dc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8e5dc 75%),linear-gradient(-45deg,transparent 75%,#e8e5dc 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0,0 10px,10px -10px,-10px 0'
}

/** Existing PNGs from the user's health character bank; importing does not run image generation. */
export function HealthCharacterLibrary({ characterId, onImported, onBusyChange }: {
  characterId?: string
  onImported?: (id: string) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { project, flush, load } = useProject()
  const { toast } = useApp()
  const [items, setItems] = useState<HealthLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<'master' | 'sheet'>('master')
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<'import' | 'export' | null>(null)
  const lock = useRef(false)
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    void window.api.healthLibrary.list().then((result) => {
      if (active.current) setItems(result)
    }).catch((reason: unknown) => {
      if (active.current) setError(errorText(reason))
    }).finally(() => { if (active.current) setLoading(false) })
    return () => { active.current = false }
  }, [])

  const groups = useMemo(() => [...new Set(items.filter((item) => item.kind === kind).map((item) => item.group))], [items, kind])
  const visible = useMemo(() => {
    const words = query.toLocaleLowerCase('id-ID').trim().split(/\s+/).filter(Boolean)
    return items.filter((item) => item.kind === kind && (group === 'all' || item.group === group) && words.every((word) => `${item.name} ${item.description} ${item.group} ${item.tags.join(' ')}`.toLocaleLowerCase('id-ID').includes(word)))
  }, [items, kind, group, query])
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0]

  const useCharacter = async (): Promise<void> => {
    if (!project || !selected || selected.kind !== 'master' || lock.current) return
    lock.current = true
    setBusy('import')
    onBusyChange?.(true)
    setError(null)
    try {
      await flush()
      const result = await window.api.healthLibrary.import(project.id, selected.id, characterId)
      load(result.bundle)
      toast('success', `${selected.name} dipakai sebagai referensi pemeran. Gambar berasal dari pustaka yang sudah tersedia.`)
      onImported?.(result.characterId)
    } catch (reason) {
      if (active.current) setError(errorText(reason))
    } finally {
      lock.current = false
      if (active.current) setBusy(null)
      onBusyChange?.(false)
    }
  }

  const savePng = async (): Promise<void> => {
    if (!selected || lock.current) return
    lock.current = true
    setBusy('export')
    onBusyChange?.(true)
    setError(null)
    try {
      const path = await window.api.healthLibrary.export(selected.id)
      if (path) toast('success', 'PNG pustaka sudah disimpan.')
    } catch (reason) {
      if (active.current) setError(errorText(reason))
    } finally {
      lock.current = false
      if (active.current) setBusy(null)
      onBusyChange?.(false)
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Pustaka karakter kesehatan">
      <div className="rounded-xl border border-line bg-paper px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Library className="size-4 text-accent" /> Karakter kesehatan yang sudah tersedia</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-2">Pilih master PNG organ, jaringan, atau sel sebagai identitas pemeran. Adegan berikutnya memakai pose, ekspresi, aksi, dan interaksi yang mengikuti narasi. Prompt Flow mengarahkan gerak kartun 2D; hasil video tetap dibuat di Flow.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={kind === 'master'} onClick={() => { setKind('master'); setGroup('all'); setSelectedId(null) }} disabled={!!busy}>Master karakter ({items.filter((item) => item.kind === 'master').length})</Chip>
        <Chip on={kind === 'sheet'} onClick={() => { setKind('sheet'); setGroup('all'); setSelectedId(null) }} disabled={!!busy}>Lembar referensi ({items.filter((item) => item.kind === 'sheet').length})</Chip>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5"><Search className="size-4 shrink-0 text-muted" /><input aria-label="Cari karakter kesehatan" value={query} disabled={!!busy} onChange={(event) => setQuery(event.target.value)} placeholder="Cari organ, jaringan, sel, atau nama…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {groups.length > 1 && <div className="flex flex-wrap gap-1.5"><Chip on={group === 'all'} onClick={() => setGroup('all')} disabled={!!busy}>Semua</Chip>{groups.map((name) => <Chip key={name} on={group === name} onClick={() => setGroup(name)} disabled={!!busy}>{name}</Chip>)}</div>}
      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad-ink">{error}</p>}
      {loading ? <p className="py-6 text-center text-sm text-muted">Memuat pustaka PNG…</p> : !visible.length ? <p className="py-6 text-center text-sm text-muted">Tidak ada karakter yang cocok. Coba kata lain atau pilih Semua.</p> : <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="scroll-thin grid max-h-[410px] grid-cols-3 gap-2 overflow-y-auto pr-1" role="group" aria-label="Pilihan PNG pustaka">{visible.map((item) => <button key={item.id} type="button" disabled={!!busy} aria-pressed={selected?.id === item.id} aria-label={`Lihat ${item.name}`} data-health-library-id={item.id} onClick={() => setSelectedId(item.id)} className={cx('overflow-hidden rounded-xl border bg-surface text-left disabled:opacity-60', selected?.id === item.id ? 'border-2 border-accent' : 'border-line hover:border-ink-2')}>
          <span className="block aspect-square overflow-hidden" style={TRANSPARENT_PREVIEW}><img src={item.previewUrl} alt={item.name} loading="lazy" className="size-full object-contain p-2" /></span>
          <span className="block px-2.5 py-2 text-xs font-semibold leading-snug">{item.name}</span>
        </button>)}</div>
        {selected && <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
          <div className="aspect-square overflow-hidden rounded-lg border border-line" style={TRANSPARENT_PREVIEW}><img src={selected.previewUrl} alt={`Pratinjau ${selected.name}`} className="size-full object-contain p-2" /></div>
          <h3 className="text-sm font-semibold">{selected.name}</h3>
          <p className="text-xs leading-relaxed text-ink-2">{selected.description}</p>
          <span className="text-[11px] text-muted">{selected.group} · PNG dari pustaka</span>
          {selected.members?.length ? <p className="text-xs leading-relaxed text-muted">Isi lembar: {selected.members.join(', ')}.</p> : null}
          {selected.kind === 'master' ? <Button size="sm" variant="primary" icon={<Plus className="size-4" />} loading={busy === 'import'} disabled={!!busy} onClick={() => void useCharacter()}>{characterId ? 'Pakai sebagai referensi' : 'Tambah pemeran ini'}</Button> : <p className="text-xs leading-relaxed text-muted">Lembar berisi beberapa karakter. Tambahkan pemeran lewat tab Master karakter agar setiap identitas tetap jelas.</p>}
          <Button size="sm" icon={<Download className="size-4" />} loading={busy === 'export'} disabled={!!busy} onClick={() => void savePng()}>Simpan PNG</Button>
        </div>}
      </div>}
    </section>
  )
}
