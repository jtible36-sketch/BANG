import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Lightbulb, RefreshCw } from 'lucide-react'
import { resolveMasterPrompt } from '@shared/master-prompts'
import { SCORE_FACTORS, storyIdeaSynopsis, storyIdeasContextKey, type ResearchInput, type ResearchSession, type ResearchTopic } from '@shared/research'
import { getStyle } from '@shared/styles'
import { defaultStyleForSkill } from '@shared/skills'
import { errorText } from '../lib/format'
import { Badge, Button, Modal } from './ui'

export interface StoryIdeasButtonProps {
  input: ResearchInput
  onChoose?: (synopsis: string, session: ResearchSession, topic: ResearchTopic) => void | Promise<void>
  /** Called explicitly when the user chooses to show these results in the research workspace. */
  onSession?: (session: ResearchSession) => void | Promise<void>
  disabled?: boolean
  className?: string
  label?: string
}

/** A deliberate research action; mounting or changing a visual style never spends account quota. */
export function StoryIdeasButton({ input, onChoose, onSession, disabled = false, className, label = 'Contoh ide cerita' }: StoryIdeasButtonProps) {
  const context = storyIdeasContextKey(input)
  const currentContext = useRef(context)
  currentContext.current = context
  const alive = useRef(true)
  const inFlight = useRef(false)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState('')
  const [session, setSession] = useState<ResearchSession | null>(null)
  const [sessionContext, setSessionContext] = useState('')
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<string | null>(null)
  const stale = Boolean(session && sessionContext !== context)
  const master = resolveMasterPrompt(input)
  const style = getStyle(input.styleId ?? defaultStyleForSkill(input.skillId, input.skillVariant))

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!pending) return
    const startedAt = Date.now()
    setElapsedSec(0)
    const timer = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [pending])

  const run = async (): Promise<void> => {
    if (inFlight.current || disabled) return
    const requestContext = context
    const snapshot = structuredClone(input)
    inFlight.current = true
    setOpen(true)
    setPending(true)
    setError('')
    setSession(null)
    setChoices({})
    try {
      const result = await window.api.research.run({ ...snapshot, purpose: 'style-ideas' })
      if (!alive.current) return
      if (currentContext.current !== requestContext) throw new Error('Gaya, master, atau topik berubah saat riset berjalan. Perbarui ide untuk pilihan terbaru.')
      setSession(result)
      setSessionContext(requestContext)
    } catch (reason) {
      if (alive.current) setError(errorText(reason))
    } finally {
      inFlight.current = false
      if (alive.current) setPending(false)
    }
  }

  const choose = async (topic: ResearchTopic): Promise<void> => {
    if (!session || !onChoose || stale || applying || pending) return
    const requestContext = context
    const idea = topic.ideas.find((item) => item.id === choices[topic.id]) || topic.ideas.find((item) => item.id === topic.selectedIdeaId) || topic.ideas[0]
    if (!idea) return
    setApplying(topic.id)
    setError('')
    try {
      const selected = idea.id === topic.selectedIdeaId ? session : await window.api.research.selectIdea(session.id, topic.id, idea.id)
      if (!alive.current) return
      if (currentContext.current !== requestContext) throw new Error('Pilihan gaya atau master berubah. Perbarui ide sebelum memakai sinopsis.')
      const selectedTopic = selected.topics.find((item) => item.id === topic.id)!
      setSession(selected)
      await onChoose(storyIdeaSynopsis(selectedTopic, idea), selected, selectedTopic)
      if (alive.current) setOpen(false)
    } catch (reason) {
      if (alive.current) setError(errorText(reason))
    } finally {
      if (alive.current) setApplying(null)
    }
  }

  const useSession = async (): Promise<void> => {
    if (!session || !onSession || stale || applying || pending) return
    setApplying('session')
    setError('')
    try { await onSession(session); if (alive.current) setOpen(false) }
    catch (reason) { if (alive.current) setError(errorText(reason)) }
    finally { if (alive.current) setApplying(null) }
  }

  const topics = [...(session?.topics ?? [])].sort((a, b) => b.score - a.score).slice(0, 6)
  return <>
    <Button data-story-ideas-button className={className} size="sm" disabled={disabled} icon={<Lightbulb className="size-4" />} onClick={() => {
      setOpen(true)
      if (!pending && (!session || stale)) void run()
    }}>{label}</Button>
    {!open && pending && <span role="status" className="text-xs text-muted">Mencari contoh ide · {elapsedSec} detik</span>}
    <Modal open={open} onClose={() => setOpen(false)} title="Contoh ide cerita" width={1040}
      subtitle={`${style.name}${master ? ` · ${master.name} v${master.version}` : ''}. Ide mengikuti pilihan ini dan aturan master yang aktif.`}>
      <p className="rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink-2">Skor 0–100 adalah perkiraan editorial dari rasa penasaran, relevansi, kekuatan visual, sudut baru, dan momentum. Skor tidak menjamin viral dan bukan data penayangan atau tren. Periksa sumber sebelum memakai klaim faktual.</p>
      {pending && <div role="status" data-story-ideas-status="pending" className="rounded-xl border border-line bg-paper p-5 text-sm">
        <p className="font-semibold">Sedang meriset enam contoh ide…</p><p className="mt-1 text-ink-2">Memeriksa sumber dan kesesuaian gaya serta master. {elapsedSec} detik. Anda bisa menutup jendela ini sambil menunggu.</p>
      </div>}
      {(error || stale) && <div role="alert" data-story-ideas-status="error" className="rounded-xl border border-bad-ink/20 bg-bad-soft p-4 text-sm text-bad-ink">{error || 'Gaya, master, atau topik sudah berubah. Hasil ini belum bisa dipakai. Perbarui ide untuk pilihan terbaru.'}</div>}
      {topics.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-story-ideas-results>
        {topics.map((topic, index) => {
          const idea = topic.ideas.find((item) => item.id === choices[topic.id]) || topic.ideas.find((item) => item.id === topic.selectedIdeaId) || topic.ideas[0]
          return <article key={topic.id} data-story-idea-card className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-start justify-between gap-3"><h3 className="text-base font-semibold">{index + 1}. {topic.title}</h3><Badge tone="ok">{topic.score}/100</Badge></div>
            <div className="text-xs font-semibold text-ink-2">{topic.evidenceLevel === 'sources' ? `${topic.sources.length} sumber teramati` : 'Editorial · belum terverifikasi'}</div>
            <p className="text-xs leading-relaxed text-ink-2">{topic.scoreReason}</p>
            {topic.ideas.length > 1 && <div className="flex flex-wrap gap-1.5">{topic.ideas.map((item, i) => <button key={item.id} type="button" disabled={!!applying || stale} aria-pressed={item.id === idea?.id} className={`rounded-lg border px-2.5 py-1 text-xs ${item.id === idea?.id ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line-2 bg-surface text-ink-2'}`} onClick={() => setChoices((previous) => ({ ...previous, [topic.id]: item.id }))}>Ide {i + 1}</button>)}</div>}
            {idea && <><h4 className="text-sm font-semibold">{idea.title}</h4><p className="text-sm leading-relaxed"><strong>Hook:</strong> {idea.hook}</p><p className="text-[13px] leading-relaxed text-ink-2">{idea.synopsis}</p><p className="rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-ink-2"><strong>Kenapa cocok:</strong> {idea.fitReason || 'Tinjau kesesuaian ide dengan gaya dan aturan master sebelum produksi.'}</p></>}
            <details className="text-xs text-ink-2"><summary className="cursor-pointer font-semibold">Rincian skor dan sumber</summary><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{SCORE_FACTORS.map((factor) => <span key={factor.key}>{factor.label}: {topic.factors[factor.key]}/{factor.max}</span>)}</div><div className="mt-3 flex flex-col gap-2">{topic.sources.length ? topic.sources.map((source) => <button key={source.url} type="button" className="flex items-start gap-1.5 text-left text-accent-dark hover:underline" onClick={() => void window.api.app.openExternal(source.url).catch((reason) => setError(errorText(reason)))}><ExternalLink className="mt-0.5 size-3 shrink-0" />{source.title}{source.publishedAt ? ` · ${source.publishedAt}` : ''}</button>) : <p>Belum ada sumber teramati. Momentum diberi skor 0; fakta perlu diverifikasi.</p>}</div></details>
            {onChoose && <Button className="mt-auto" size="sm" disabled={stale || pending || !!applying || disabled} loading={applying === topic.id} onClick={() => void choose(topic)}>Pakai ide</Button>}
          </article>
        })}
      </div>}
      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        <Button size="sm" disabled={pending || !!applying || disabled} icon={<RefreshCw className="size-4" />} onClick={() => void run()}>{error && !session ? 'Coba lagi' : 'Perbarui ide'}</Button>
        {onSession && session && <Button variant="primary" size="sm" disabled={stale || pending || !!applying || disabled} loading={applying === 'session'} onClick={() => void useSession()}>Gunakan hasil riset</Button>}
        <Button size="sm" onClick={() => setOpen(false)}>Tutup</Button>
      </div>
    </Modal>
  </>
}
