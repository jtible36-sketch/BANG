import { useEffect, useRef, useState } from 'react'
import { StoryIdeasButton } from '../../components/StoryIdeasButton'
import { Library, Sparkles } from 'lucide-react'
import { LANGUAGES, clipCountFor } from '@shared/models'
import { defaultStyleForSkill, getContentSkill, variantForStyle } from '@shared/skills'
import { getStyle } from '@shared/styles'
import { voxBeatCount } from '@shared/vox'
import { isMapMaster, isVoxMaster, resolveMasterPrompt } from '@shared/master-prompts'
import { MAP_DEFAULT_DURATION_SEC } from '@shared/map-animation'
import { MasterPromptPicker } from '../../components/MasterPromptPicker'
import { NichePicker } from '../../components/NichePicker'
import type { AppSettings, KeyStatus, TtsProvider, VoiceOption } from '@shared/types'
import { Select } from '../../components/Select'
import { StylePicker } from '../../components/StylePicker'
import { DurationPicker } from '../../components/DurationPicker'
import { SkillPicker } from '../../components/SkillPicker'
import { Button, Field, Segmented, confirmDialog, cx } from '../../components/ui'
import { errorText } from '../../lib/format'
import { VoiceCatalogPicker } from '../../components/VoiceCatalogPicker'
import { filterVoiceCatalog } from '@shared/voice-catalog'
import { ttsVoiceForProvider } from '@shared/tts'
import { TTS_NAMES, ttsReadiness, usableTts } from '../../lib/keys'
import { useApp } from '../../store/app'
import { useProject } from '../../store/project'
import { ModelSection } from './ModelSection'
import { CharacterModal } from './CharacterModal'
import { CharacterAvatar } from '../../components/CharacterAvatar'

function VoicePicker({ provider, language, value, onChange }: { provider: TtsProvider; language: string; value: string; onChange: (id: string) => void }) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const currentValue = useRef(value)
  currentValue.current = value

  useEffect(() => {
    let active = true
    const id = useProject.getState().project?.id
    setVoices(null)
    setError(null)
    void window.api.settings.voices(provider).then((list) => {
      if (!active || useProject.getState().project?.id !== id || useProject.getState().project?.ttsProvider !== provider) return
      setVoices(list)
      const selected = currentValue.current
      if (!selected || !list.some(voice => voice.id === selected) && ttsVoiceForProvider(provider, selected, provider) !== selected) {
        const first = filterVoiceCatalog(list, { language, category: 'social-media' })[0] || list[0]
        if (first) onChange(first.id)
      }
    }).catch((reason) => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [provider, revision])

  const added = async (voice: VoiceOption): Promise<void> => {
    const current = useProject.getState().project
    if (!current || current.ttsProvider !== provider) return
    const list = await window.api.settings.voices(provider).catch(() => voices ?? [])
    if (useProject.getState().project?.id !== current.id || useProject.getState().project?.ttsProvider !== provider) return
    if (!voice.id || voice.source !== 'account') throw new Error('Suara belum tersedia sebagai suara akun.')
    setVoices(list.some(item => item.id === voice.id) ? list : [...list, voice])
    onChange(voice.id)
  }

  return <VoiceCatalogPicker voices={voices ?? []} provider={provider} language={language} value={value} label="Suara narator"
    loading={!voices && !error} error={error} onChange={onChange} onRetry={() => setRevision(previous => previous + 1)} onAdded={added} />
}

export function IdeaStep() {
  const { project, clips, characters, assets, updateProject, flush, load } = useProject()
  const { toast, go, setResearchDraft } = useApp()
  const [busy, setBusy] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const composing = useRef(false)
  const cancelRequested = useRef(false)
  const [durationValid, setDurationValid] = useState(true)
  const [writer, setWriter] = useState<{ codex: boolean; connected: boolean; timeout: number } | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [visualWorkflow, setVisualWorkflow] = useState<AppSettings['visualWorkflow']>('codex-flow')
  const [keys, setKeys] = useState<KeyStatus[]>([])
  const [characterModal, setCharacterModal] = useState<string | null>(null)
  const [planningCharacters, setPlanningCharacters] = useState(false)
  const [cancelingCharacters, setCancelingCharacters] = useState(false)
  const [characterPlanningError, setCharacterPlanningError] = useState('')
  const characterPlanningLock = useRef(false)
  const characterCancelRequested = useRef(false)

  useEffect(() => {
    if (!busy && !planningCharacters) return
    const startedAt = Date.now()
    setElapsedSec(0)
    const timer = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [busy, planningCharacters])

  useEffect(() => {
    void window.api.settings.get().then((s) => {
      setWriter({ codex: s.llmSource === 'codex', connected: s.codexConnections?.story === true, timeout: s.storyTimeoutSec || 120 })
      setVisualWorkflow(s.visualWorkflow)
    })
    void window.api.settings.keys().then(setKeys)
  }, [])

  // Before any narration exists, move to a narrator service that has a working key.
  const hasVoice = clips.some((c) => c.audioAssetId)
  useEffect(() => {
    if (!project || !keys.length || hasVoice) return
    const use = usableTts(project.ttsProvider, keys)
    if (use !== project.ttsProvider) updateProject({ ttsProvider: use, ttsVoice: use === 'gemini' ? 'Charon' : '' })
  }, [keys, project?.id])

  if (!project) return null
  const ready = ttsReadiness(keys)
  const blocked = keys.length ? (['gemini', 'elevenlabs'] as const).filter((p) => !ready[p].ok) : []
  const openSettings = async (): Promise<void> => {
    await flush()
    go({ name: 'settings', back: { name: 'project', id: project.id } })
  }

  const vox = isVoxMaster(project)
  const map = isMapMaster(project)
  const master = resolveMasterPrompt(project)
  const clipCount = master?.timing.sceneCount ?? (master?.timing.beatSeconds ? Math.max(1, Math.round(project.durationSec / master.timing.beatSeconds)) : vox ? voxBeatCount(project.durationSec) : clipCountFor(project.durationSec))
  const perClip = vox ? Math.round(project.durationSec / clipCount * 10) / 10 : Math.round(project.durationSec / clipCount)

  const prepareCharacters = async (): Promise<void> => {
    if (characterPlanningLock.current || busy) return
    characterPlanningLock.current = true
    characterCancelRequested.current = false
    setCharacterPlanningError('')
    setPlanningCharacters(true)
    try {
      await flush()
      if (useProject.getState().saveState === 'error') throw new Error('Simpan brief sebelum menyusun karakter.')
      if (characterCancelRequested.current) throw new Error('Penyusunan karakter dibatalkan. Karakter yang sudah ada tetap tersimpan.')
      load(await window.api.story.characters(project.id))
      toast('success', 'Peran dan prompt desain karakter siap. Buka karakter untuk meninjau atau generate lembar gambarnya.')
    } catch (error) { const message = errorText(error); setCharacterPlanningError(message); toast('error', message) }
    finally { characterPlanningLock.current = false; setPlanningCharacters(false); setCancelingCharacters(false) }
  }

  const compose = async (): Promise<void> => {
    if (composing.current) return
    if (writer?.codex && !writer.connected) { setComposeError('Koneksi penyusun cerita Codex diputus. Hubungkan di Pengaturan.'); return }
    if (!durationValid) { toast('error', 'Perbaiki durasi custom sebelum menyusun naskah.'); return }
    if (!project.synopsis.trim()) {
      toast('error', 'Tulis ide cerita atau sinopsis dulu.')
      return
    }
    composing.current = true
    cancelRequested.current = false
    setComposeError(null)
    try {
      if (clips.length) {
        const ok = await confirmDialog({
          title: 'Susun ulang naskah?',
          body: `Proyek ini sudah punya ${clips.length} adegan. Menyusun ulang akan mengganti semua adegan beserta naskahnya. Pemeran tetap ada, sedangkan gambar dan suara lama tersimpan di riwayat tapi tidak lagi terpasang.`,
          confirm: 'Susun ulang'
        })
        if (!ok) return
      }
      setBusy(true)
      await flush()
      if (cancelRequested.current) throw new Error('Penyusunan naskah dibatalkan. Naskah sebelumnya tetap tersimpan.')
      const saved = useProject.getState()
      if (saved.saveState === 'error') throw new Error(saved.saveError || 'Ide cerita belum berhasil disimpan. Coba simpan lagi sebelum menyusun naskah.')
      const bundle = await window.api.story.script(project.id)
      load(bundle)
      toast('success', `${bundle.clips.length} adegan siap. Baca dan rapikan naskahnya dulu.`)
    } catch (e) {
      const message = errorText(e)
      setComposeError(message)
      toast('error', message)
    } finally {
      composing.current = false
      setBusy(false)
      setCanceling(false)
    }
  }

  return (
    <div className="relative h-full">
      <div className="scroll-thin h-full overflow-y-auto pb-28">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_540px] gap-10 px-14 pt-8">
          <div className="flex flex-col gap-[22px]">
            <div>
              <p className="text-[13px] font-semibold text-accent">Langkah 1 dari 4</p>
              <h1 className="mt-1.5 font-display text-[40px] font-bold leading-tight tracking-[-0.02em]">Arah cerita dimulai di sini.</h1>
              <p className="mt-2 text-[15px] text-ink-2">
                Sebut tokoh, tempat, dan akhir ceritanya. Makin jelas, makin rapi susunan klip dari AI.
              </p>
            </div>

            <SkillPicker value={project.skillId ?? 'general'} variant={project.skillVariant} onChange={(id, variant) => {
              updateProject({ skillId: id, skillVariant: variant, ...((id !== (project.skillId ?? 'general') || variant) ? { styleId: defaultStyleForSkill(id, variant) } : {}) })
            }} />

            <MasterPromptPicker value={project.masterPrompt} context={project} disabled={busy || planningCharacters} onChange={(masterPrompt) => updateProject({ masterPrompt, ...(masterPrompt?.baseProfile === 'stickman' ? { styleId: 'stickman', skillId: 'general', skillVariant: undefined } : masterPrompt?.baseProfile === 'map' ? { styleId: 'map-animation', skillId: 'general', skillVariant: undefined, ...(!clips.length ? { durationSec: MAP_DEFAULT_DURATION_SEC, aspectRatio: '9:16' as const } : {}) } : {}) })} onManage={() => { void (async () => { await flush(); if (useProject.getState().saveState === 'error') { toast('error', 'Simpan perubahan proyek sebelum membuka pustaka master.'); return } go({ name: 'masters', back: { name: 'project', id: project.id } }) })() }} />

            <NichePicker value={project.subjectNiche ?? ''} context={project} onChange={(subjectNiche) => updateProject({ subjectNiche })} disabled={busy || planningCharacters} />

            <StoryIdeasButton disabled={busy || planningCharacters || !project.subjectNiche?.trim()}
              input={{ query: '', subjectNiche: project.subjectNiche, category: 'Semua', styleId: project.styleId, skillId: project.skillId ?? 'general', skillVariant: project.skillVariant, language: project.language, masterPrompt: project.masterPrompt }}
              onChoose={(synopsis, session) => { updateProject({ synopsis: synopsis.slice(0, 4000), subjectNiche: session.subjectNiche }); toast('success', 'Ide masuk ke brief. Pilih durasi, lalu susun naskahnya.') }} />

            {!map && project.skillId === 'explainer-animasi-kesehatan' && <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Pemeran kesehatan sebelum menyusun cerita</h2><p className="mt-1 text-xs leading-relaxed text-ink-2">Pilih master organ atau sel yang sudah tersedia. Naskah memakai pemeran ini untuk dialog, aksi, akibat, dan reaksi; setiap adegan merencanakan pose serta gerak 2D yang sesuai narasi.</p></div><Button size="sm" icon={<Library className="size-4" />} onClick={() => setCharacterModal('new')}>Pilih karakter kesehatan</Button></div>
              {characters.length > 0 && <div className="flex flex-wrap gap-2">{characters.map((character) => <button key={character.id} type="button" onClick={() => setCharacterModal(character.id)} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-1.5 pr-3 text-xs font-semibold hover:border-accent"><CharacterAvatar name={character.name} sheetUrl={character.sheetAssetId ? assets[character.sheetAssetId]?.url : null} size={27} />{character.name}</button>)}</div>}
            </section>}

            <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-ink bg-surface px-[18px] pb-3 pt-4 shadow-ink-md">
              <label htmlFor="sinopsis" className="text-[13px] font-semibold text-ink-2">
                Ide cerita atau sinopsis
              </label>
              <textarea
                id="sinopsis"
                rows={5}
                value={project.synopsis}
                maxLength={4000}
                onChange={(e) => updateProject({ synopsis: e.target.value })}
                placeholder="Tahun 1336 di istana Majapahit. Gajah Mada bersumpah tidak akan menikmati palapa sebelum Nusantara bersatu…"
                className="resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted/70"
              />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Tips: tulis juga suasana yang kamu mau, misalnya tegang, lucu, atau haru.</span>
                <span className="font-mono">{project.synopsis.length.toLocaleString('id-ID')} / 4.000</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {getContentSkill(project.skillId).suggestions.map((idea) => <button key={idea} type="button" onClick={() => updateProject({ synopsis: idea })} className="rounded-full border border-dashed border-line-3 px-3 py-2 text-ink-2 hover:border-ink">{idea}</button>)}
              <Button size="sm" disabled={busy || planningCharacters} onClick={async () => { await flush(); if (useProject.getState().saveState === 'error') { toast('error', 'Simpan brief sebelum membuka riset.'); return } setResearchDraft({ query: '', subjectNiche: project.subjectNiche, skillId: project.skillId ?? 'general', skillVariant: project.skillVariant, styleId: project.styleId, masterPrompt: project.masterPrompt ?? null, category: 'Semua', language: project.language, durationSec: project.durationSec, aspectRatio: project.aspectRatio }); go({ name: 'research' }) }}>Riset topik dan ide baru</Button>
            </div>

            {!map && <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" data-niche-characters>
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Pemeran sesuai niche dan cerita</h2><Button size="sm" icon={<Library className="size-4" />} loading={planningCharacters} disabled={busy || !project.subjectNiche?.trim() || (!project.synopsis.trim() && !clips.length)} onClick={() => void prepareCharacters()}>Susun karakter sesuai niche</Button></div>
              <p className="text-xs leading-relaxed text-ink-2">Menyusun peran dan prompt desain tokoh dari subjek serta cerita. Tinjau karakter, lalu generate lembar gambar melalui jendela karakter.</p>
              <div className="flex flex-wrap gap-2">{characters.map((character) => <button key={character.id} type="button" disabled={planningCharacters || busy} onClick={() => setCharacterModal(character.id)} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-1.5 pr-3 text-xs font-semibold hover:border-accent"><CharacterAvatar name={character.name} sheetUrl={character.sheetAssetId ? assets[character.sheetAssetId]?.url : null} size={27} />{character.name}</button>)}<Button size="sm" disabled={planningCharacters || busy} onClick={() => setCharacterModal('new')}>Tambah karakter</Button></div>
              {planningCharacters && <div role="status" data-character-planning="pending" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-paper p-3 text-xs text-ink-2"><span>Menyusun peran dan prompt desain karakter · {elapsedSec} / {writer?.timeout || 120} detik.</span><Button size="sm" disabled={cancelingCharacters} onClick={async () => { characterCancelRequested.current = true; setCancelingCharacters(true); try { await window.api.story.cancel(project.id) } catch (error) { setCancelingCharacters(false); toast('error', errorText(error)) } }}>{cancelingCharacters ? 'Membatalkan karakter…' : 'Batalkan penyusunan karakter'}</Button></div>}
              {characterPlanningError && <p role="alert" data-character-planning="error" className="rounded-lg bg-bad-soft p-3 text-xs leading-relaxed text-bad-ink">{characterPlanningError}</p>}
            </section>}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Durasi video</span>
              <DurationPicker value={project.durationSec} durationOptionsSec={master?.durationOptionsSec} onChange={(durationSec) => updateProject({ durationSec })} onValidityChange={setDurationValid} />
              <span className="text-[13px] text-muted">
                {map ? `${clipCount} adegan berantai, sumber video 8 detik per adegan. Target edit ${project.durationSec} detik; durasi akhir mengikuti narasi.` : <>Sekitar {clipCount} {vox ? 'beat' : 'klip'}, masing-masing kurang lebih {perClip.toLocaleString('id-ID')} detik. Durasi akhir mengikuti panjang suara narasi.</>}
              </span>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5">
              <Field label="Bahasa naskah dan suara">
                <Select
                  label="Bahasa naskah dan suara"
                  size="lg"
                  value={project.language}
                  onChange={(v) => updateProject({ language: v })}
                  options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Format</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: '16:9', label: '16:9', sub: 'YouTube', w: 26, h: 15 },
                      { id: '9:16', label: '9:16', sub: 'Shorts, Reels, TikTok', w: 13, h: 22 }
                    ] as const
                  ).map((f) => {
                    const on = project.aspectRatio === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updateProject({ aspectRatio: f.id })}
                        className={cx(
                          'flex h-12 items-center gap-2.5 rounded-xl px-3 text-left',
                          on ? 'border-2 border-accent bg-accent-soft' : 'border border-line-2 bg-surface hover:border-ink-2'
                        )}
                      >
                        <span className="flex w-[26px] justify-center">
                          <span className="rounded-[3px] border-[1.8px] border-ink" style={{ width: f.w, height: f.h }} />
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="text-sm font-semibold">{f.label}</span>
                          <span className="text-xs text-ink-2">{f.sub}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Suara narator</span>
              <div className="flex flex-col gap-2">
                <Segmented
                  value={project.ttsProvider}
                  onChange={(v) => updateProject({ ttsProvider: v, ttsVoice: v === 'gemini' ? 'Charon' : '' })}
                  options={(['gemini', 'elevenlabs'] as const).map((p) => ({
                    id: p,
                    label: TTS_NAMES[p],
                    disabled: blocked.includes(p),
                    title: ready[p].reason ?? undefined
                  }))}
                />
                <VoicePicker provider={project.ttsProvider} language={project.language} value={project.ttsVoice} onChange={(voice) => updateProject({ ttsProvider: project.ttsProvider, ttsVoice: voice })} />
              </div>
              {blocked.length > 0 && (
                <span className="text-[13px] text-muted">
                  {blocked.length === 2
                    ? 'Belum ada kunci suara narator yang valid, jadi suara belum bisa dibuat.'
                    : `${ready[blocked[0]].reason}, jadi ${TTS_NAMES[blocked[0]]} belum bisa dipilih.`}{' '}
                  <button type="button" onClick={() => void openSettings()} className="font-semibold text-accent-dark hover:underline">
                    Atur di Pengaturan
                  </button>
                </span>
              )}
            </div>

            <ModelSection
              visualWorkflow={visualWorkflow}
              project={project}
              clipCount={clipCount}
              perClip={perClip}
              onChange={(patch) => {
                updateProject(patch)
                // New projects start with the models picked last; resolution stays with this project.
                if (!('videoResolution' in patch)) void window.api.settings.set(patch)
              }}
            />
          </div>

          <aside className="flex flex-col gap-3.5 self-start rounded-[18px] border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[22px] font-bold">Gaya visual</h2>
              <span className="text-[13px] text-muted">{getStyle(project.styleId).name}</span>
            </div>
            <p className="-mt-1.5 text-[13px] text-ink-2">{map ? 'Peta satelit, overlay neon, dan ikon yang konsisten untuk seluruh rangkaian.' : 'Dipakai untuk semua gambar di proyek ini, termasuk lembar karakter.'}</p>
            <StylePicker value={project.styleId} skillId={project.skillId} onChange={(id) => updateProject({ styleId: id, skillVariant: variantForStyle(project.skillId ?? 'general', id) ?? '', ...(id === 'map-animation' && !project.masterPrompt && !clips.length ? { durationSec: MAP_DEFAULT_DURATION_SEC, aspectRatio: '9:16' as const } : {}) })}
              renderIdeas={(styleId) => <StoryIdeasButton
                className="w-full"
                disabled={busy || planningCharacters || !project.subjectNiche?.trim()}
                input={{ query: '', subjectNiche: project.subjectNiche, styleId, skillId: project.skillId ?? 'general', skillVariant: project.skillVariant, language: project.language, category: 'Semua', masterPrompt: project.masterPrompt }}
                onChoose={(synopsis) => {
                  updateProject({ synopsis: synopsis.slice(0, 4000) })
                  toast('success', 'Ide masuk ke brief. Kamu bisa merapikannya sebelum menyusun naskah.')
                }}
              />}
            />
          </aside>
        </div>
      </div>

      {(busy || composeError) && <div
        role={composeError ? 'alert' : 'status'}
        aria-live={composeError ? 'assertive' : 'polite'}
        data-script-status={composeError ? 'error' : 'pending'}
        className={cx('absolute inset-x-0 bottom-[84px] flex items-center justify-between gap-4 border-t px-14 py-3 text-sm', composeError ? 'border-bad-ink/20 bg-bad-soft text-bad-ink' : 'border-line bg-paper text-ink-2')}
      >
        <div className="min-w-0">
          <p className="font-semibold">{composeError ? 'Naskah belum bisa disusun' : 'Sedang menyusun naskah…'}</p>
          <p className="mt-0.5 max-h-24 overflow-y-auto break-words leading-relaxed">{composeError || `Menunggu jawaban penyusun cerita. ${elapsedSec} / ${writer?.timeout || 120} detik.`}</p>
        </div>
        {composeError && <Button size="sm" className="shrink-0" onClick={() => void openSettings()}>Periksa pengaturan</Button>}
        {busy && <Button size="sm" disabled={canceling} onClick={async () => {
          cancelRequested.current = true
          setCanceling(true)
          try { await window.api.story.cancel(project.id) }
          catch (error) { setCanceling(false); toast('error', errorText(error)) }
        }}>{canceling ? 'Membatalkan…' : 'Batalkan'}</Button>}
      </div>}

      <footer className="absolute inset-x-0 bottom-0 flex h-[84px] items-center gap-4 border-t border-line bg-surface px-14">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            ± {clipCount} adegan · {project.durationSec.toLocaleString('id-ID')} detik
          </span>
        </div>
        <div className="flex-1" />
        {clips.length > 0 && !busy && (
          <Button size="lg" onClick={() => updateProject({ step: 2 })}>
            Lihat naskah
          </Button>
        )}
        <Button variant="primary" size="lg" className="h-[50px]" loading={busy} disabled={!durationValid || planningCharacters} icon={!busy && <Sparkles className="size-[18px]" />} onClick={() => void compose()}>
          {busy ? 'Menyusun naskah…' : clips.length ? 'Susun ulang naskah' : 'Susun naskah'}
        </Button>
      </footer>
      {characterModal && <CharacterModal characterId={characterModal} onClose={() => setCharacterModal(null)} onCreated={(id) => setCharacterModal(id)} />}
    </div>
  )
}
