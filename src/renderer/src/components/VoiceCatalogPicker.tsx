import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Play, Search, Square } from 'lucide-react'
import { VOICE_CATEGORIES, filterVoiceCatalog, previewForVoice, voiceCategories, voiceLanguages, voiceLanguageLabel } from '@shared/voice-catalog'
import type { SharedVoiceSearchResult, TtsProvider, VoiceOption } from '@shared/types'
import { errorText } from '../lib/format'
import { geminiPreview } from '../lib/voicePreviews'
import { Select } from './Select'
import { Button, cx } from './ui'

type LanguageFilter = 'id' | 'ms' | 'all'
type CategoryFilter = typeof VOICE_CATEGORIES[number]['id'] | 'all'
const initialLanguage = (language: string): LanguageFilter => language === 'ms' ? 'ms' : language === 'id' ? 'id' : 'all'

export function VoiceCatalogPicker({ voices, provider, language, value, onChange, disabled = false, loading = false, error, onRetry, onAdded, label = 'Pilihan suara narasi' }: {
  voices: VoiceOption[]
  provider: TtsProvider
  language: string
  value: string
  onChange(id: string): void
  disabled?: boolean
  loading?: boolean
  error?: string | null
  onRetry?(): void
  /** Refresh the account catalogue and choose the actual account ID returned by an explicit add. */
  onAdded?(voice: VoiceOption): Promise<void> | void
  label?: string
}) {
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>(() => provider === 'elevenlabs' ? initialLanguage(language) : 'all')
  const [category, setCategory] = useState<CategoryFilter>(provider === 'elevenlabs' ? 'social-media' : 'all')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'account' | 'library'>('account')
  const [library, setLibrary] = useState<SharedVoiceSearchResult | null>(null)
  const [librarySelection, setLibrarySelection] = useState('')
  const [libraryContext, setLibraryContext] = useState('')
  const [imported, setImported] = useState<Record<string, VoiceOption>>({})
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const revision = useRef(0)
  const pending = useRef(false)
  const mounted = useRef(true)
  const context = JSON.stringify([provider, languageFilter, category, query.trim()])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; revision.current++; audio.current?.pause() }
  }, [])
  useEffect(() => {
    revision.current++
    audio.current?.pause()
    setPlaying(null)
    setPreviewError(null)
    setLanguageFilter(provider === 'elevenlabs' ? initialLanguage(language) : 'all')
    setCategory(provider === 'elevenlabs' ? 'social-media' : 'all')
    setSource('account')
    setLibrary(null)
    setLibrarySelection('')
    setCatalogError(null)
  }, [provider, language])
  useEffect(() => {
    revision.current++
    audio.current?.pause()
    setPlaying(null)
    setPreviewError(null)
  }, [context, source])

  const current = voices.find(voice => voice.id === value)
  const matching = useMemo(() => filterVoiceCatalog(voices, { language: languageFilter, category, query }), [voices, languageFilter, category, query])
  const selectedOutsideFilter = !!current && !matching.some(voice => voice.id === value)
  const available = source === 'account' ? matching : libraryContext === context ? library?.voices ?? [] : []
  const selectedLibrary = available.find(voice => voice.id === librarySelection)
  const importKey = (voice: VoiceOption): string => voice.sharedVoice ? `${voice.sharedVoice.publicOwnerId}:${voice.sharedVoice.voiceId}` : voice.id
  const alreadyImported = selectedLibrary ? !!imported[importKey(selectedLibrary)] : false
  const unknownLanguages = voices.filter(voice => !voiceLanguages(voice).length).length
  const unknownCategories = voices.filter(voice => !voiceCategories(voice).length).length
  const busy = disabled || loading || searching || adding

  const metadata = (voice: VoiceOption): string => {
    const languages = voiceLanguages(voice)
    const categories = voiceCategories(voice)
    const languageLabel = languages.length ? languages.map(voiceLanguageLabel).join(', ') : 'Bahasa belum dicatat'
    const categoryLabel = categories.length ? categories.map(id => VOICE_CATEGORIES.find(item => item.id === id)?.label ?? id).join(', ') : 'Kategori belum dicatat'
    return languageLabel + ' · ' + categoryLabel
  }
  const urlOf = (voice: VoiceOption): string | null => previewForVoice(voice, languageFilter === 'all' ? language : languageFilter)
    || (provider === 'gemini' ? geminiPreview(voice.id, voice.name) : null)
  const play = (voice: VoiceOption): void => {
    audio.current?.pause()
    setPreviewError(null)
    if (playing === voice.id) { setPlaying(null); return }
    const url = urlOf(voice)
    if (!url) return
    const next = new Audio(url)
    audio.current = next
    const stop = (): void => { if (audio.current === next && mounted.current) setPlaying(null) }
    const failed = (): void => {
      if (audio.current !== next || !mounted.current) return
      setPlaying(null); setPreviewError('Contoh suara belum bisa diputar. Coba lagi atau pilih suara lain.')
    }
    next.onended = stop
    next.onerror = failed
    setPlaying(voice.id)
    void next.play().catch(failed)
  }
  const previewButton = (voice: VoiceOption, field = false) => urlOf(voice) ? <button
    type="button" disabled={disabled || adding}
    aria-label={playing === voice.id ? 'Hentikan contoh suara' : 'Dengarkan contoh suara'}
    title={playing === voice.id ? 'Hentikan contoh' : 'Dengarkan contoh'}
    onClick={() => play(voice)}
    className={cx('flex shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50', field ? 'size-10' : 'size-7', playing === voice.id ? 'border-accent bg-accent text-white' : 'border-line-2 bg-surface text-ink hover:border-ink-2')}
  >{playing === voice.id ? <Square className="size-3.5" fill="currentColor" /> : <Play className="ml-px size-3.5" fill="currentColor" />}</button> : null

  const searchLibrary = async (page = 0): Promise<void> => {
    if (pending.current || provider !== 'elevenlabs') return
    pending.current = true
    setSearching(true)
    setCatalogError(null)
    const before = revision.current
    const requestContext = context
    try {
      const result = await window.api.settings.sharedVoices({
        language: languageFilter === 'all' ? undefined : languageFilter,
        category: category === 'all' ? undefined : category,
        search: query.trim() || undefined, page, pageSize: 30
      })
      if (!mounted.current || revision.current !== before) return
      setLibrary(result)
      setLibraryContext(requestContext)
      setLibrarySelection('')
    } catch (error) { if (mounted.current && revision.current === before) setCatalogError(errorText(error)) }
    finally { pending.current = false; if (mounted.current) setSearching(false) }
  }
  const add = async (): Promise<void> => {
    if (pending.current || !selectedLibrary?.sharedVoice || provider !== 'elevenlabs' || disabled || alreadyImported) return
    pending.current = true
    setAdding(true)
    setCatalogError(null)
    const before = revision.current
    const chosen = selectedLibrary
    try {
      const voice = await window.api.settings.addSharedVoice({
        publicOwnerId: chosen.sharedVoice!.publicOwnerId, voiceId: chosen.sharedVoice!.voiceId, name: chosen.name
      })
      if (!mounted.current || revision.current !== before) return
      if (!voice.id || voice.source === 'library') throw new Error('Suara belum tersedia di akun. Periksa katalog akun lalu coba lagi.')
      setImported(previous => ({ ...previous, [importKey(chosen)]: voice }))
      setSource('account')
      setLibrarySelection('')
      try {
        if (onAdded) await onAdded(voice)
        else onChange(voice.id)
      } catch (reason) {
        if (mounted.current) setCatalogError('Suara sudah ditambahkan ke akun. Muat ulang katalog akun untuk memilihnya. ' + errorText(reason))
      }
    } catch (error) { if (mounted.current && revision.current === before) setCatalogError(errorText(error)) }
    finally { pending.current = false; if (mounted.current) setAdding(false) }
  }

  const accountOptions = matching.map(voice => ({ value: voice.id, label: voice.name, note: voice.description || undefined, hint: metadata(voice) }))
  if (selectedOutsideFilter) accountOptions.unshift({ value: current!.id, label: current!.name + ' · pilihan tersimpan', note: 'Suara ini berada di luar filter saat ini.', hint: metadata(current!) })
  if (value && !current) accountOptions.unshift({ value, label: 'Suara tersimpan', note: 'ID tersimpan belum ditemukan dalam katalog akun.', hint: 'Periksa koneksi atau daftar suara' })

  return <div data-voice-catalog className="flex min-w-0 flex-col gap-2">
    {provider === 'elevenlabs' && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sumber daftar suara">
      <Button size="sm" variant={source === 'account' ? 'accent' : 'secondary'} disabled={busy} onClick={() => setSource('account')}>Akun saya</Button>
      <Button size="sm" variant={source === 'library' ? 'accent' : 'secondary'} disabled={busy} onClick={() => setSource('library')}>Pustaka ElevenLabs</Button>
    </div>}
    {provider === 'elevenlabs' && <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
      <Select label="Bahasa suara" size="sm" value={languageFilter} disabled={busy} onChange={setLanguageFilter}
        options={[{ value: 'id', label: 'Indonesia' }, { value: 'ms', label: 'Melayu' }, { value: 'all', label: 'Semua bahasa' }]} />
      <Select label="Kategori suara" size="sm" value={category} disabled={busy} onChange={setCategory}
        options={[{ value: 'all', label: 'Semua kategori' }, ...VOICE_CATEGORIES.map(item => ({ value: item.id, label: item.label }))]} />
    </div>}
    <label className="flex items-center gap-2 rounded-xl border border-line-2 bg-surface px-3">
      <Search className="size-3.5 shrink-0 text-muted" />
      <input aria-label="Cari nama atau ciri suara" value={query} onChange={event => setQuery(event.target.value)} disabled={busy}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Cari nama atau ciri suara…" />
    </label>
    {source === 'library' ? <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Suara pustaka harus ditambahkan ke akun sebelum digunakan.</p>
        <Button size="sm" icon={<Search className="size-3.5" />} loading={searching} disabled={disabled || adding} onClick={() => void searchLibrary()}>Cari di pustaka</Button>
      </div>
      {libraryContext !== context ? <p data-voice-empty className="text-xs leading-relaxed text-muted">Klik Cari di pustaka untuk melihat suara sesuai filter ini.</p>
        : !available.length && !searching ? <p data-voice-empty className="text-xs leading-relaxed text-muted">Tidak ada suara pustaka yang cocok dengan filter. Coba Semua bahasa atau Semua kategori.</p> : null}
      {!!available.length && <div className="flex gap-2">
        <Select label="Suara pustaka ElevenLabs" size="sm" searchable value={librarySelection} disabled={busy}
          options={[{ value: '', label: 'Pilih suara pustaka', disabled: true }, ...available.map(voice => ({ value: voice.id, label: voice.name, note: voice.description || undefined, hint: metadata(voice) }))]}
          menuWidth={460} onChange={setLibrarySelection} renderAction={option => { const voice = available.find(voice => voice.id === option.value); return voice ? previewButton(voice) : null }} />
        {selectedLibrary && previewButton(selectedLibrary, true)}
      </div>}
      {selectedLibrary && <Button size="sm" className="self-start" variant="accent" icon={<Download className="size-3.5" />} loading={adding}
        disabled={disabled || searching || alreadyImported || !selectedLibrary.sharedVoice} onClick={() => void add()}>{alreadyImported ? 'Sudah ditambahkan ke akun' : 'Tambahkan dan gunakan suara'}</Button>}
      {libraryContext === context && library?.hasMore && <Button size="sm" className="self-start" disabled={busy} onClick={() => void searchLibrary(library.page + 1)}>Halaman berikutnya</Button>}
    </> : <>
      <div className="flex gap-2">
        <Select label={label} size="sm" searchable value={value} disabled={busy || !accountOptions.length}
          options={loading ? [{ value, label: 'Memuat daftar suara…' }] : accountOptions.length ? accountOptions : [{ value, label: 'Tidak ada suara yang cocok' }]}
          onChange={onChange} menuWidth={460} renderAction={option => { const voice = voices.find(voice => voice.id === option.value); return voice ? previewButton(voice) : null }} />
        {current && previewButton(current, true)}
      </div>
      <p data-voice-count className="text-xs text-muted">{loading ? 'Memuat katalog akun…' : `${matching.length} dari ${voices.length} suara akun cocok dengan filter.`}</p>
      {selectedOutsideFilter && <p className="text-xs leading-relaxed text-muted">Pilihan tersimpan tetap dipakai meski berada di luar filter ini.</p>}
      {!matching.length && !loading && <p data-voice-empty className="text-xs leading-relaxed text-muted">{voices.length ? 'Belum ada suara dengan metadata yang cocok. Coba Semua bahasa dan Semua kategori.' : 'Katalog akun belum berisi suara. Cari dan tambahkan suara dari pustaka.'}</p>}
      {provider === 'elevenlabs' && (unknownLanguages > 0 || unknownCategories > 0) && <p className="text-xs leading-relaxed text-muted">Metadata belum lengkap: {unknownLanguages} suara tanpa bahasa, {unknownCategories} tanpa kategori. Suara ini tersedia pada filter Semua.</p>}
    </>}
    {(error || catalogError || previewError) && <p role="alert" className="text-xs leading-relaxed text-bad-ink">{error || catalogError || previewError}</p>}
    {error && onRetry && <Button size="sm" className="self-start" disabled={busy} onClick={onRetry}>Muat ulang daftar suara</Button>}
  </div>
}

