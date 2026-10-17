import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Download, ExternalLink, ImagePlus, Lightbulb, RefreshCw, Search, Sparkles, Trophy } from 'lucide-react'
import { LANGUAGES } from '@shared/models'
import { SCORE_FACTORS, type ResearchSession, type ResearchTopic } from '@shared/research'
import { getContentSkill, type SkillId } from '@shared/skills'
import type { AspectRatio, TtsProvider } from '@shared/types'
import { DurationPicker } from '../components/DurationPicker'
import { Logo } from '../components/Logo'
import { Select } from '../components/Select'
import { SkillPicker } from '../components/SkillPicker'
import { Badge, Button, cx } from '../components/ui'
import { errorText, relativeTime } from '../lib/format'
import { usableTts } from '../lib/keys'
import { useCodexStatus } from '../lib/useVisualWorkflow'
import { useApp } from '../store/app'

type TopicAction = 'selection' | 'ideas' | 'idea' | 'prompt' | 'thumbnail' | 'export' | 'project'

function ScoreRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score))
  return (
    <div className="relative flex size-[76px] shrink-0 items-center justify-center" aria-label={`Skor peluang ${value} dari 100`}>
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="5" className="text-line" />
        <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${value * 2.07345} 207.345`} className={value >= 75 ? 'text-[#328247]' : 'text-accent'} />
      </svg>
      <div className="text-center"><div className="font-display text-2xl font-bold">{value}</div><div className="text-[10px] text-muted">/ 100</div></div>
    </div>
  )
}

function TopicCard({ topic, index, prompt, busy, blocked, durationValid, error, codexImages, onPrompt, onSelect, onAction, onSource }: {
  topic: ResearchTopic
  index: number
  prompt: string
  busy: TopicAction | undefined
  blocked: boolean
  durationValid: boolean
  error: string | undefined
  codexImages: boolean
  onPrompt(value: string): void
  onSelect(selected: boolean): void
  onAction(action: TopicAction, ideaId?: string): void
  onSource(url: string): void
}) {
  const selectedIdea = topic.ideas.find((idea) => idea.id === topic.selectedIdeaId)
  const canOpenProject = !!topic.projectId && (!topic.projectIdeaId || topic.projectIdeaId === topic.selectedIdeaId)
  const promptDirty = prompt !== topic.thumbnailPrompt
  return (
    <article className={cx('overflow-hidden rounded-2xl border bg-surface', topic.selected ? 'border-accent shadow-ink' : 'border-line')} data-topic-id={topic.id}>
      <div className="flex items-start gap-5 p-6">
        <label className="mt-1 flex shrink-0 cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={topic.selected} disabled={blocked} onChange={(event) => onSelect(event.target.checked)} aria-label={`Pilih topik ${topic.title}`} className="size-[18px] accent-accent" />
          <span className="flex size-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{index + 1}</span>
        </label>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={topic.evidenceLevel === 'sources' ? 'ok' : 'draft'}>{topic.evidenceLevel === 'sources' ? 'Ada sumber' : 'Ide editorial'}</Badge>
            {topic.projectId && <Badge tone="info">Sudah jadi proyek</Badge>}
          </div>
          <h2 className="font-display text-[23px] font-bold leading-tight">{topic.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{topic.summary}</p>
          <div className="mt-3 text-xs text-muted">Kata kunci: <span className="font-medium text-ink-2">{topic.keyword}</span></div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1"><ScoreRing score={topic.score} /><span className="text-xs text-muted">Peluang ide</span></div>
      </div>

      <details className="border-t border-dashed border-line px-6 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-ink-2"><ChevronDown className="size-4" /> Alasan skor & sumber</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div><p className="text-sm leading-relaxed text-ink-2">{topic.scoreReason}</p><p className="mt-2 text-xs leading-relaxed text-muted">Skor adalah perkiraan editorial, bukan data penonton atau jaminan viral.</p></div>
          <div className="flex flex-col gap-2.5">{SCORE_FACTORS.map((factor) => {
            const value = Math.max(0, Math.min(factor.max, topic.factors[factor.key]))
            return <div key={factor.key}><div className="mb-1 flex justify-between text-xs text-ink-2"><span>{factor.label}</span><span>{value} / {factor.max}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-accent" style={{ width: `${value / factor.max * 100}%` }} /></div></div>
          })}</div>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          {topic.sources.length ? topic.sources.map((source, sourceIndex) => <button key={`${source.url}-${sourceIndex}`} type="button" onClick={() => onSource(source.url)} className="flex items-center gap-2 text-left text-xs text-accent hover:underline"><ExternalLink className="size-3.5 shrink-0" /><span>{source.title}{source.publishedAt ? ` · ${source.publishedAt}` : ''}</span></button>) : <p className="text-xs text-muted">Belum ada sumber terverifikasi untuk topik ini. Periksa faktanya sebelum membuat naskah.</p>}
        </div>
      </details>

      {topic.selected && <div className="border-t border-line bg-sand/40 p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-accent" /> Pilih ide video</h3>
          <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={busy === 'ideas'} disabled={blocked} onClick={() => onAction('ideas')}>Perbarui ide</Button>
        </div>
        <div className="grid gap-2.5 md:grid-cols-3">{topic.ideas.map((idea) => <label key={idea.id} className={cx('flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5', topic.selectedIdeaId === idea.id ? 'border-accent bg-accent/5' : 'border-line bg-surface')}>
          <span className="flex items-start gap-2"><input type="radio" name={`idea-${topic.id}`} checked={topic.selectedIdeaId === idea.id} disabled={blocked} onChange={() => onAction('idea', idea.id)} aria-label={`Pilih ide ${idea.title}`} className="mt-0.5 size-4 shrink-0 accent-accent" /><span className="text-sm font-semibold leading-snug">{idea.title}</span></span>
          <span className="text-xs leading-relaxed text-accent">“{idea.hook}”</span>
          <span className="text-xs leading-relaxed text-ink-2">{idea.angle}</span>
          <span className="text-xs leading-relaxed text-muted">{idea.synopsis}</span>
        </label>)}</div>
        {!topic.ideas.length && <p className="text-sm text-muted">Belum ada ide. Klik Perbarui ide untuk mencari sudut cerita dari riset ini.</p>}

        <div className="mt-5 grid gap-4 border-t border-dashed border-line pt-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <label htmlFor={`thumbnail-${topic.id}`} className="mb-2 block text-sm font-semibold">Prompt thumbnail</label>
            <textarea id={`thumbnail-${topic.id}`} rows={4} value={prompt} onChange={(event) => onPrompt(event.target.value)} disabled={blocked} maxLength={12000} className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-accent disabled:opacity-60" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" loading={busy === 'prompt'} disabled={blocked || !promptDirty || !prompt.trim()} onClick={() => onAction('prompt')}>{promptDirty ? 'Simpan prompt' : 'Prompt tersimpan'}</Button>
              <Button size="sm" variant="primary" icon={<ImagePlus className="size-4" />} loading={busy === 'thumbnail'} disabled={blocked || !codexImages || !prompt.trim()} onClick={() => onAction('thumbnail')}>{topic.thumbnail ? 'Generate ulang thumbnail' : 'Generate thumbnail'}</Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">Gambar dibuat melalui akun Codex yang sudah masuk. Prompt yang diubah disimpan sebelum generate. Proses bisa berlangsung beberapa menit.</p>
          </div>
          <div className="flex flex-col gap-2">
            {topic.thumbnail ? <><img src={topic.thumbnail.url} alt={`Thumbnail ${topic.title}`} className="aspect-video w-full rounded-xl border border-line object-cover" />{topic.thumbnail.prompt && prompt.trim() !== topic.thumbnail.prompt.trim() && <p className="text-xs leading-relaxed text-accent">Prompt berubah. Generate ulang agar thumbnail sesuai ide terbaru.</p>}<Button size="sm" icon={<Download className="size-4" />} loading={busy === 'export'} disabled={blocked} onClick={() => onAction('export')}>Simpan PNG</Button></> : <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-3 bg-surface text-muted"><ImagePlus className="size-7" /><span className="text-xs">Thumbnail topik ini</span></div>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-4">
          <span className="text-xs text-ink-2">{selectedIdea ? `Ide terpilih: ${selectedIdea.title}` : 'Pilih satu ide untuk membuat proyek.'}</span>
          <Button variant="primary" size="sm" icon={<ArrowRight className="size-4" />} loading={busy === 'project'} disabled={blocked || (!canOpenProject && (!selectedIdea || !durationValid))} onClick={() => onAction('project')}>{canOpenProject ? 'Buka proyek' : 'Buat proyek dari ide'}</Button>
        </div>
      </div>}
      {error && <p role="alert" className="border-t border-line bg-accent/5 px-6 py-3 text-sm text-accent">{error}</p>}
    </article>
  )
}

export function TopicResearch() {
  const { go, toast } = useApp()
  const [sessions, setSessions] = useState<ResearchSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [skillId, setSkillId] = useState<SkillId>('bang-motion')
  const [skillVariant, setSkillVariant] = useState<string | undefined>('kartun-kolase')
  const [category, setCategory] = useState('Sains')
  const [language, setLanguage] = useState('id')
  const [durationSec, setDurationSec] = useState(60)
  const [durationValid, setDurationValid] = useState(true)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini')
  const [loading, setLoading] = useState(true)
  const [researching, setResearching] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, TopicAction>>({})
  const [topicErrors, setTopicErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const lockedTopics = useRef(new Set<string>())
  const researchLock = useRef(false)
  const mounted = useRef(true)
  const codex = useCodexStatus(true)
  const ready = !!codex.status?.available && !!codex.status.authenticated
  const codexImages = ready && !!codex.status?.imageGeneration
  const skill = getContentSkill(skillId)
  const session = sessions.find((item) => item.id === activeId) ?? null
  const selectedCount = session?.topics.filter((topic) => topic.selected).length ?? 0
  const bestScore = useMemo(() => session?.topics.length ? Math.max(...session.topics.map((topic) => topic.score)) : 0, [session])
  const anyBusy = Object.keys(busy).length > 0

  useEffect(() => {
    mounted.current = true
    void window.api.research.list().then((history) => {
      if (!mounted.current) return
      setSessions(history)
      if (history.length) setActiveId(history[0].id)
    }).catch((error: unknown) => {
      if (mounted.current) setPageError(errorText(error))
    }).finally(() => { if (mounted.current) setLoading(false) })
    void Promise.all([window.api.settings.get(), window.api.settings.keys()]).then(([settings, keys]) => {
      if (!mounted.current) return
      setLanguage(settings.defaultLanguage)
      setTtsProvider(usableTts(settings.defaultTtsProvider, keys))
    }).catch(() => {})
    return () => { mounted.current = false }
  }, [])

  const acceptSession = (next: ResearchSession): void => {
    if (!mounted.current) return
    setSessions((previous) => {
      const existing = previous.find((item) => item.id === next.id)
      if (existing && existing.updatedAt > next.updatedAt) return previous
      return [next, ...previous.filter((item) => item.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }

  const changeSkill = (id: SkillId, variant?: string): void => {
    setSkillId(id)
    setSkillVariant(variant)
    setCategory(getContentSkill(id).categories[0])
  }

  const run = async (): Promise<void> => {
    if (researchLock.current || !query.trim() || lockedTopics.current.size > 0) return
    researchLock.current = true
    setResearching(true)
    setPageError(null)
    try {
      const next = await window.api.research.run({ query: query.trim(), category, skillId, skillVariant, language })
      acceptSession(next)
      if (mounted.current) setActiveId(next.id)
      toast('success', 'Riset selesai. Pilih topik dan sudut cerita yang kamu suka.')
    } catch (error) {
      if (mounted.current) setPageError(errorText(error))
    } finally {
      researchLock.current = false
      if (mounted.current) setResearching(false)
    }
  }

  const action = async (topic: ResearchTopic, kind: TopicAction, ideaId?: string, selection?: boolean): Promise<void> => {
    if (!session || lockedTopics.current.size > 0) return
    const currentSession = session
    lockedTopics.current.add(topic.id)
    setBusy((previous) => ({ ...previous, [topic.id]: kind }))
    setTopicErrors((previous) => { const next = { ...previous }; delete next[topic.id]; return next })
    try {
      let next: ResearchSession | undefined
      if (kind === 'selection') next = await window.api.research.selectTopic(currentSession.id, topic.id, !!selection)
      else if (kind === 'ideas') next = await window.api.research.refreshIdeas(currentSession.id, topic.id)
      else if (kind === 'idea' && ideaId) next = await window.api.research.selectIdea(currentSession.id, topic.id, ideaId)
      else if (kind === 'prompt' || kind === 'thumbnail') {
        const prompt = (drafts[topic.id] ?? topic.thumbnailPrompt).trim()
        if (!prompt) throw new Error('Isi prompt thumbnail terlebih dahulu.')
        if (prompt !== topic.thumbnailPrompt) {
          next = await window.api.research.updateThumbnailPrompt(currentSession.id, topic.id, prompt)
          acceptSession(next)
        }
        if (kind === 'thumbnail') next = await window.api.research.generateThumbnail(currentSession.id, topic.id)
        if (mounted.current) setDrafts((previous) => { const updated = { ...previous }; delete updated[topic.id]; return updated })
        if (kind === 'thumbnail') toast('success', 'Thumbnail selesai dan tersimpan di riset ini.')
      } else if (kind === 'export') {
        const path = await window.api.research.exportThumbnail(currentSession.id, topic.id)
        if (path) toast('success', 'Thumbnail PNG sudah disimpan.')
      } else if (kind === 'project') {
        if (topic.projectId && (!topic.projectIdeaId || topic.projectIdeaId === topic.selectedIdeaId)) go({ name: 'project', id: topic.projectId })
        else {
          if (!durationValid) throw new Error('Isi durasi custom yang valid sebelum membuat proyek.')
          const idea = topic.ideas.find((item) => item.id === topic.selectedIdeaId)
          if (!idea) throw new Error('Pilih ide video terlebih dahulu.')
          const sessionSkill = getContentSkill(currentSession.skillId)
          const bundle = await window.api.research.createProject(currentSession.id, topic.id, {
            synopsis: idea.synopsis, durationSec, language: currentSession.language, aspectRatio, ttsProvider,
            styleId: sessionSkill.variants.find((variant) => variant.id === currentSession.skillVariant)?.styleId ?? sessionSkill.defaultStyleId ?? 'flat',
            skillId: currentSession.skillId, skillVariant: currentSession.skillVariant
          })
          go({ name: 'project', id: bundle.project.id })
        }
      }
      if (next) acceptSession(next)
    } catch (error) {
      if (mounted.current) setTopicErrors((previous) => ({ ...previous, [topic.id]: errorText(error) }))
    } finally {
      lockedTopics.current.delete(topic.id)
      if (mounted.current) setBusy((previous) => { const next = { ...previous }; delete next[topic.id]; return next })
    }
  }

  const openSource = async (url: string): Promise<void> => {
    try {
      if (new URL(url).protocol !== 'https:') throw new Error('Sumber harus menggunakan tautan HTTPS.')
      await window.api.app.openExternal(url)
    } catch (error) { toast('error', errorText(error)) }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[68px] shrink-0 items-center gap-5 border-b border-line bg-surface px-8">
        <Logo />
        <span className="ml-2 border-l border-line pl-5 text-sm font-semibold">Riset topik</span>
        <div className="flex-1" />
        <Button icon={<ArrowLeft className="size-4" />} disabled={anyBusy || researching} onClick={() => go({ name: 'home' })}>Proyek</Button>
      </header>
      <main className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-10 py-8">
          <div><h1 className="font-display text-[38px] font-bold tracking-[-0.025em]">Temukan cerita yang layak ditonton.</h1><p className="mt-2 text-[15px] text-ink-2">Riset topik → pilih ide → buat thumbnail → lanjutkan ke video.</p></div>

          <section className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-ink bg-surface p-5 shadow-ink">
            <label htmlFor="research-query" className="text-sm font-semibold">Apa yang ingin kamu teliti?</label>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-sand px-4 py-3"><Search className="size-5 shrink-0 text-muted" /><input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} disabled={researching} maxLength={1000} onKeyDown={(event) => { if (event.key === 'Enter' && ready) void run() }} placeholder="Contoh: kebiasaan manusia zaman dahulu atau cara sel imun bekerja" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted" /></div>
            <SkillPicker value={skillId} variant={skillVariant} onChange={changeSkill} />
            <div className="flex flex-wrap items-center gap-2">
              <Select label="Jenis topik" variant="pill" value={category} options={skill.categories.map((item) => ({ value: item, label: item }))} onChange={setCategory} disabled={researching} menuWidth={230} />
              <Select label="Bahasa riset" variant="pill" value={language} options={LANGUAGES.map((item) => ({ value: item.code, label: item.label }))} onChange={setLanguage} disabled={researching} menuWidth={210} />
              <div className="flex-1" />
              <Button variant="primary" icon={<Sparkles className="size-4" />} loading={researching} disabled={!ready || !query.trim() || anyBusy} onClick={() => void run()}>{researching ? 'Sedang meneliti…' : 'Riset topik'}</Button>
            </div>
            <div className="flex flex-wrap gap-2">{skill.suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={researching} onClick={() => setQuery(suggestion)} className="rounded-full border border-dashed border-line-3 px-3 py-1.5 text-xs text-ink-2 hover:border-accent hover:text-accent">{suggestion}</button>)}</div>
            <p className="text-xs leading-relaxed text-muted">Memakai akun Codex yang sudah masuk, tanpa kunci API. Codex mencari sumber dan menyusun peluang cerita; proses bisa berlangsung beberapa menit. Skor membantu membandingkan ide, bukan menjamin video akan viral.</p>
            {!ready && <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sand p-3 text-xs text-ink-2"><span>{codex.checking ? 'Memeriksa akun Codex…' : codex.status?.message ?? 'Codex belum tersambung.'}</span><Button size="sm" loading={codex.checking} onClick={codex.refresh}>Periksa lagi</Button></div>}
          </section>
          {pageError && <p role="alert" className="rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">{pageError}</p>}

          {sessions.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-[25px] font-bold">Hasil riset</h2><Select label="Riwayat riset" value={activeId ?? sessions[0].id} options={sessions.map((item) => ({ value: item.id, label: item.query, hint: relativeTime(item.generatedAt) }))} disabled={anyBusy || researching} onChange={(id) => { setActiveId(id); setPageError(null) }} menuWidth={430} className="max-w-[440px]" /></div>}
          {session && <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
              { icon: <Lightbulb className="size-5 text-accent" />, value: session.topics.length, label: 'Topik ditemukan' },
              { icon: <Trophy className="size-5 text-accent" />, value: bestScore, label: 'Skor ide tertinggi' },
              { icon: <Check className="size-5 text-accent" />, value: selectedCount, label: 'Topik dipilih' },
              { icon: <Clock3 className="size-5 text-accent" />, value: relativeTime(session.generatedAt), label: 'Riset dibuat' }
            ].map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">{stat.icon}<div><div className="text-xl font-bold">{stat.value}</div><div className="mt-0.5 text-xs text-muted">{stat.label}</div></div></div>)}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2"><Badge tone={session.source === 'codex-web' ? 'info' : 'draft'}>{session.source === 'codex-web' ? 'Riset dengan penelusuran web' : 'Ide editorial dari Codex'}</Badge><span>{getContentSkill(session.skillId).name} · {session.category}</span><span className="ml-auto text-muted">Pilih topik untuk membuka ide dan thumbnail.</span></div>
            {selectedCount > 0 && <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-5 py-4"><span className="mr-1 text-sm font-semibold">Dari topik ke video</span><DurationPicker value={durationSec} onChange={setDurationSec} onValidityChange={setDurationValid} /><Select label="Format video" variant="pill" value={aspectRatio} options={[{ value: '16:9', label: '16:9 · YouTube' }, { value: '9:16', label: '9:16 · Shorts' }]} onChange={setAspectRatio} menuWidth={220} /><span className="text-xs text-muted">Pilihan ini dipakai saat membuat proyek. Bahasa mengikuti riset.</span></section>}
            {selectedCount > 0 && !codexImages && <p className="text-xs text-muted">Thumbnail memerlukan fitur gambar Codex yang tersedia pada akunmu. Riset dan pemilihan ide tetap tersimpan.</p>}
            <div className="flex flex-col gap-4">{session.topics.map((topic, index) => <TopicCard key={topic.id} topic={topic} index={index} prompt={drafts[topic.id] ?? topic.thumbnailPrompt} busy={busy[topic.id]} blocked={anyBusy || researching} durationValid={durationValid} error={topicErrors[topic.id]} codexImages={codexImages} onPrompt={(value) => setDrafts((previous) => ({ ...previous, [topic.id]: value }))} onSelect={(selected) => void action(topic, 'selection', undefined, selected)} onAction={(kind, ideaId) => void action(topic, kind, ideaId)} onSource={(url) => void openSource(url)} />)}</div>
          </>}
          {!session && <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-3 py-14 text-center"><Search className="size-9 text-muted" /><p className="text-base font-semibold">{loading ? 'Memuat riwayat riset…' : researching ? 'Riset sedang berjalan' : 'Mulai dari pertanyaan yang membuat penasaran'}</p><p className="max-w-[540px] px-5 text-sm leading-relaxed text-muted">{researching ? 'Codex sedang mencari sumber dan menyiapkan topik beserta beberapa pilihan ide. Hasil akan muncul di sini.' : 'Pilih skill, tulis tema, lalu klik Riset topik. Hasil dan thumbnail tersimpan agar bisa dilanjutkan nanti.'}</p></div>}
        </div>
      </main>
    </div>
  )
}
