import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Copy, FolderOpen, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { LANGUAGES, llmName } from '@shared/models'
import { getContentSkill, type SkillId } from '@shared/skills'
import { getStyle } from '@shared/styles'
import type { ApiProvider, AppSettings, AspectRatio, KeyStatus, NewProjectInput, ProjectStatus, ProjectSummary, TtsProvider } from '@shared/types'
import { Select, type SelectOption } from '../components/Select'
import { StyleSwatch } from '../components/StyleArt'
import { DurationPicker } from '../components/DurationPicker'
import { ProductionStyleStudio } from '../components/ProductionStyleStudio'
import { NichePicker } from '../components/NichePicker'
import { Badge, Button, Chip, IconButton, Menu, confirmDialog, cx } from '../components/ui'
import { errorText, mmss, relativeTime } from '../lib/format'
import { TTS_NAMES, ttsReadiness, usableTts } from '../lib/keys'
import { useApp } from '../store/app'
import { StudioNav } from '../components/StudioNav'
import { MasterPromptPicker } from '../components/MasterPromptPicker'
import type { MasterPromptProfile } from '@shared/master-prompts'

const STATUS: Record<ProjectStatus, { label: string; tone: 'draft' | 'info' | 'warn' | 'ok' }> = {
  draft: { label: 'Draf', tone: 'draft' },
  script: { label: 'Naskah', tone: 'info' },
  storyboard: { label: 'Storyboard', tone: 'info' },
  editing: { label: 'Editing', tone: 'warn' },
  exported: { label: 'Diekspor', tone: 'ok' }
}

const FILTERS: { id: 'all' | 'draft' | 'progress' | 'exported'; label: string; match: (s: ProjectStatus) => boolean }[] = [
  { id: 'all', label: 'Semua', match: () => true },
  { id: 'draft', label: 'Draf', match: (s) => s === 'draft' },
  { id: 'progress', label: 'Dalam proses', match: (s) => s === 'script' || s === 'storyboard' || s === 'editing' },
  { id: 'exported', label: 'Diekspor', match: (s) => s === 'exported' }
]

/** "a, b dan c" */
function joinList(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`
}

const ASPECTS: SelectOption<AspectRatio>[] = [
  { value: '16:9', label: '16:9 · YouTube', icon: <span className="block h-[10px] w-[17px] rounded-[2px] border-[1.5px] border-ink" /> },
  { value: '9:16', label: '9:16 · Shorts', icon: <span className="mx-[3px] block h-[16px] w-[10px] rounded-[2px] border-[1.5px] border-ink" /> }
]

// Keep an unfinished brief while visiting the master library or research within this session.
let homeDraft: NewProjectInput | null = null

export function Home() {
  const { go, toast, setResearchDraft } = useApp()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [keys, setKeys] = useState<KeyStatus[]>([])
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [query, setQuery] = useState('')
  const [synopsis, setSynopsis] = useState(homeDraft?.synopsis ?? '')
  const [durationSec, setDurationSec] = useState(homeDraft?.durationSec ?? 60)
  const [durationValid, setDurationValid] = useState(true)
  const [language, setLanguage] = useState(homeDraft?.language ?? 'id')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(homeDraft?.aspectRatio ?? '16:9')
  const [styleId, setStyleId] = useState(homeDraft?.styleId ?? 'motion-collage')
  const [skillId, setSkillId] = useState<SkillId>(homeDraft?.skillId ?? 'bang-motion')
  const [skillVariant, setSkillVariant] = useState(homeDraft?.skillVariant ?? 'kartun-kolase')
  const [subjectNiche, setSubjectNiche] = useState(homeDraft?.subjectNiche ?? '')
  const [tts, setTts] = useState<TtsProvider>(homeDraft?.ttsProvider ?? 'gemini')
  const [creating, setCreating] = useState(false)
  const [masterPrompt, setMasterPrompt] = useState<MasterPromptProfile | null>(homeDraft?.masterPrompt ?? null)
  useEffect(() => { homeDraft = { synopsis, subjectNiche, durationSec, language, aspectRatio, styleId, skillId, skillVariant, ttsProvider: tts, masterPrompt } }, [synopsis, subjectNiche, durationSec, language, aspectRatio, styleId, skillId, skillVariant, tts, masterPrompt])

  const refresh = (): void => {
    window.api.projects
      .list()
      .then(setProjects)
      .catch((e) => toast('error', errorText(e)))
  }

  useEffect(() => {
    refresh()
    void window.api.settings.keys().then(setKeys)
    void window.api.settings.get().then((s) => {
      setAppSettings(s)
      if (!homeDraft?.synopsis) { setTts(s.defaultTtsProvider); setLanguage(s.defaultLanguage) }
    })
  }, [])

  // Start on a narrator service that has a working key.
  useEffect(() => {
    if (appSettings && keys.length) setTts(usableTts(appSettings.defaultTtsProvider, keys))
  }, [appSettings, keys])

  const ttsOptions = useMemo((): SelectOption<TtsProvider>[] => {
    const ready = ttsReadiness(keys)
    return (['gemini', 'elevenlabs'] as const).map((p) => {
      const blocked = keys.length > 0 && !ready[p].ok
      return { value: p, label: TTS_NAMES[p], disabled: blocked, note: blocked ? `${ready[p].reason}. Atur di Pengaturan.` : undefined }
    })
  }, [keys])

  const setupIssues = useMemo(() => {
    if (!appSettings || !keys.length) return []
    // A key counts once it is saved and did not fail its last check.
    const ok = (p: ApiProvider): boolean => {
      const k = keys.find((x) => x.provider === p)
      return !!k?.configured && k.lastOk !== false
    }
    const issues: { what: string; blocks: string }[] = []
    if (appSettings.visualWorkflow === 'higgsfield' && !ok('higgsfield')) issues.push({ what: 'kunci Higgsfield', blocks: 'gambar dan video' })
    const llm = appSettings.llmProvider
    if (appSettings.llmSource === 'codex') {
      if (!appSettings.codexConnections.story) issues.push({ what: 'koneksi Codex', blocks: 'cerita' })
    } else {
      if (!ok(llm)) issues.push({ what: `kunci ${llmName(llm)}`, blocks: 'cerita' })
      else if (!appSettings.llmModels[llm]) issues.push({ what: `model ${llmName(llm)}`, blocks: 'cerita' })
    }
    // Narration needs just one working voice service; every project can pick either one.
    const tts = ttsReadiness(keys)
    if (!tts.gemini.ok && !tts.elevenlabs.ok) issues.push({ what: 'kunci Gemini atau ElevenLabs', blocks: 'suara narator' })
    return issues
  }, [keys, appSettings])

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    const q = query.trim().toLowerCase()
    return (projects ?? []).filter((p) => f.match(p.status) && (!q || p.title.toLowerCase().includes(q)))
  }, [projects, filter, query])

  const start = async (): Promise<void> => {
    if (!durationValid) { toast('error', 'Perbaiki durasi custom sebelum membuat proyek.'); return }
    setCreating(true)
    try {
      const b = await window.api.projects.create({ synopsis, subjectNiche, durationSec, language, aspectRatio, styleId, skillId, skillVariant, ttsProvider: tts, masterPrompt })
      homeDraft = null
      go({ name: 'project', id: b.project.id })
    } catch (e) {
      toast('error', errorText(e))
      setCreating(false)
    }
  }

  const remove = async (p: ProjectSummary): Promise<void> => {
    const ok = await confirmDialog({
      title: 'Hapus proyek?',
      body: `“${p.title}” beserta semua gambar, video, dan suaranya akan dihapus dari komputer ini. Tindakan ini tidak bisa dibatalkan.`,
      confirm: 'Hapus proyek',
      danger: true
    })
    if (!ok) return
    await window.api.projects.remove(p.id)
    refresh()
  }

  const duplicate = async (p: ProjectSummary): Promise<void> => {
    try {
      await window.api.projects.duplicate(p.id)
      refresh()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <StudioNav active="home" right={
        <label className="flex h-10 w-[230px] items-center gap-2 rounded-full border border-line bg-sand px-3.5 text-muted">
          <Search className="size-[18px]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari proyek"
            aria-label="Cari proyek"
            className="flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </label>
      } />

      <main className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-6 pt-10 lg:px-12">
          <div className="flex items-end justify-between gap-6">
            <div><p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-accent">NARAFLOW / STUDIO PRODUKSI</p>
            <h1 className="max-w-[800px] font-display text-[clamp(32px,3.2vw,48px)] font-bold leading-[1.08] tracking-[-0.035em]">Temukan ceritanya.<br /><span className="text-accent">Tentukan dunianya.</span></h1>
            <p className="mt-4 max-w-[740px] text-base leading-relaxed text-ink-2">Pilih keahlian dan gaya visual. Temukan cerita yang layak diproduksi, bangun karakternya, lalu arahkan setiap adegan.</p></div>
            <div className="mb-1 shrink-0 border-l border-line-3 pl-5 text-sm"><span className="font-display text-3xl font-bold">{projects?.length ?? '—'}</span><p className="mt-1 text-xs text-muted">cerita di studio</p></div>
          </div>
          <ol className="grid grid-cols-2 gap-4 border-y border-line py-5 lg:grid-cols-4" aria-label="Alur produksi">{[
            ['01', 'Skill & galeri', 'Pilih bahasa visual ceritamu.'],
            ['02', 'Winning story', 'Bandingkan ide, alasan skor, dan sumber.'],
            ['03', 'Karakter & narasi', 'Desain pemeran dengan referensimu.'],
            ['04', 'Produksi & editing', 'Arahkan shot, suara, dan hasil akhir.']
          ].map(([number, title, detail]) => <li key={number} className="flex gap-3"><span className="pt-0.5 font-mono text-xs text-accent">{number}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p></div></li>)}</ol>
          <ProductionStyleStudio skillId={skillId} styleId={styleId} skillVariant={skillVariant} disabled={creating}
            onChange={(next) => { setSkillId(next.skillId); setStyleId(next.styleId); setSkillVariant(next.skillVariant) }}
            onContinue={() => {
              setResearchDraft({ query: '', subjectNiche, category: 'Semua', skillId, skillVariant, styleId, language, masterPrompt, durationSec, aspectRatio })
              go({ name: 'research' })
            }} />
          <details className="group rounded-2xl border border-line bg-surface" data-direct-brief>
            <summary className="cursor-pointer px-6 py-5 text-sm font-semibold focus-visible:outline-accent">Sudah punya cerita? Mulai dari brief <span className="ml-2 font-normal text-muted">Ide, format, dan suara narator</span></summary>
          <div className="flex flex-col gap-4 border-t border-line px-6 py-5">
            <MasterPromptPicker value={masterPrompt} context={{ styleId, skillId, skillVariant }} onChange={setMasterPrompt} onManage={() => go({ name: 'masters', back: { name: 'home' } })} />
            <NichePicker value={subjectNiche} context={{ styleId, skillId, skillVariant, masterPrompt }} onChange={setSubjectNiche} />
            <label htmlFor="ide" className="text-[13px] font-semibold text-ink-2">
              Ide cerita atau sinopsis
            </label>
            <textarea
              id="ide"
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Contoh: Gajah Mada bersumpah tidak akan menikmati palapa sebelum Nusantara bersatu. Para menteri menertawakannya, tapi dia membuktikannya…"
              className="resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-muted/70"
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3.5">
              <Select
                variant="pill"
                label="Bahasa"
                value={language}
                onChange={setLanguage}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                menuWidth={200}
              />
              <Select variant="pill" label="Format" value={aspectRatio} onChange={setAspectRatio} options={ASPECTS} menuWidth={200} />
              <Select variant="pill" label="Suara narator" value={tts} onChange={setTts} options={ttsOptions} menuWidth={280} />
              <div className="flex-1" />
              <Button variant="primary" size="lg" loading={creating} disabled={!durationValid} onClick={() => void start()}>
                Buat brief
                <ArrowRight className="size-[18px]" />
              </Button>
            </div>
            <DurationPicker value={durationSec} onChange={setDurationSec} onValidityChange={setDurationValid} compact />
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <span>Coba ide ini:</span>
            {getContentSkill(skillId).suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSynopsis(s)}
                className="h-9 rounded-full border border-dashed border-line-3 px-3.5 text-[13px] text-ink-2 hover:border-ink-2 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
          </div>
          </details>
          {setupIssues.length > 0 && <details className="rounded-xl border border-line px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink-2"><AlertTriangle className="mr-2 inline size-4 text-accent" />Kesiapan layanan produksi</summary>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>Atur {joinList(setupIssues.map((i) => i.what))} untuk membuat {joinList([...new Set(setupIssues.map((i) => i.blocks))])}.</span><Button size="sm" onClick={() => go({ name: 'settings', back: { name: 'home' } })}>Pengaturan layanan</Button></div>
          </details>}
        </div>

        <section className="mx-auto flex max-w-[1440px] flex-col gap-[18px] px-6 pb-12 pt-11 lg:px-12">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-[27px] font-bold tracking-[-0.015em]">Proyek kamu</h2>
            <div className="ml-2 flex gap-1.5">
              {FILTERS.map((f) => {
                const count = (projects ?? []).filter((p) => f.match(p.status)).length
                return (
                  <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                    <span className={cx('text-xs', filter === f.id ? 'text-line-2' : 'text-muted')}>{count}</span>
                  </Chip>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
            <button
              type="button"
              disabled={!durationValid || creating}
              onClick={() => void start()}
              className="flex min-h-[262px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-line-3 text-ink-2 hover:border-ink-2 hover:bg-surface"
            >
              <span className="flex size-[54px] items-center justify-center rounded-full border-[1.5px] border-ink bg-accent text-white shadow-ink">
                <Plus className="size-6" strokeWidth={2.2} />
              </span>
              <span className="text-base font-semibold text-ink">Proyek baru</span>
              <span className="text-[13px]">Mulai dari ide atau sinopsis</span>
            </button>

            {visible.map((p) => {
              const st = STATUS[p.status]
              return (
                <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                  <button type="button" onClick={() => go({ name: 'project', id: p.id })} className="text-left">
                    <div className="relative aspect-video w-full overflow-hidden border-b border-line">
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <StyleSwatch styleId={p.styleId} className="size-full" iconSize={40} />
                      )}
                      <span className="absolute left-2.5 top-2.5 rounded-full border border-ink bg-surface px-2.5 py-[3px] text-xs font-semibold">
                        {getStyle(p.styleId).name}
                      </span>
                      {p.totalMs > 0 && (
                        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-ink px-2 py-[3px] font-mono text-xs text-paper">
                          {mmss(p.totalMs)}
                        </span>
                      )}
                    </div>
                    <div className="line-clamp-2 min-h-[46px] px-4 pb-0.5 pt-3.5 text-base font-semibold leading-snug">{p.title}</div>
                  </button>
                  <div className="flex items-center gap-2 py-2 pl-4 pr-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="truncate text-[13px] text-muted">{relativeTime(p.updatedAt)}</span>
                    <div className="flex-1" />
                    <Menu
                      trigger={(open) => (
                        <IconButton label="Opsi proyek" onClick={open} className="border-transparent" size={36}>
                          <MoreHorizontal className="size-[18px]" />
                        </IconButton>
                      )}
                      items={[
                        { label: 'Buka', icon: <FolderOpen className="size-4" />, run: () => go({ name: 'project', id: p.id }) },
                        { label: 'Duplikat', icon: <Copy className="size-4" />, run: () => void duplicate(p) },
                        { label: 'Hapus', icon: <Trash2 className="size-4" />, danger: true, run: () => void remove(p) }
                      ]}
                    />
                  </div>
                </article>
              )
            })}
          </div>
          {projects && projects.length === 0 && (
            <p className="text-sm text-muted">Belum ada proyek. Tulis ide di atas lalu klik Mulai.</p>
          )}
        </section>
      </main>
    </div>
  )
}
