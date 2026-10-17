import { randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { estimateWordTimings } from '@shared/captions'
import { stripVoiceTags } from '@shared/speech'
import { getImageModel, getVideoModel, imageBody, maxRefs, promptLimit, videoBody, type HfModel } from '@shared/higgsfield'
import { getStyle } from '@shared/styles'
import { voxImagePrompt } from '@shared/vox'
import { buildCodexCharacterPrompt, buildFlowImagePrompt, buildFlowVideoPrompt, mapClipImageEligible } from '@shared/external-prompts'
import { isMapMaster, isStickmanMaster, isVoxMaster, masterStageDirection, resolveMasterPrompt, type MasterPromptProfile } from '@shared/master-prompts'
import { subjectNicheDirection } from '@shared/niches'
import type { AspectRatio, Asset, Character, Clip, CreditEstimate, Job, Project, WordTiming } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { runJob, type TaskCtx } from './jobs'
import { assetAbsPath } from './paths'
import {
  activeJobFor,
  charactersOf,
  clipsOf,
  getAsset,
  getCharacter,
  getClip,
  getJob,
  getProject,
  insertAsset,
  insertJob,
  patchClip,
  setCharacterSheet,
  touchProject,
  unfinishedJobs,
  updateAssetMeta,
  updateJob
} from './repo'
import { dropCache, getSettings, readCache, writeCache } from './settings'
import { probeDurationMs, probeSize } from './services/audio'
import * as eleven from './services/elevenlabs'
import * as gemini from './services/gemini'
import * as hf from './services/higgsfield'
import { downloadTo, sleep } from './services/http'
import { chooseTtsRoute, resolveTtsRoute } from './tts-routing'
import { assertMapOpeningImage, assertMapVideoFrame } from './map-continuity'

const DAY = 24 * 60 * 60 * 1000

function extFromType(contentType: string, url: string, fallback: string): string {
  if (/png/.test(contentType)) return '.png'
  if (/jpe?g/.test(contentType)) return '.jpg'
  if (/webp/.test(contentType)) return '.webp'
  if (/mp4/.test(contentType)) return '.mp4'
  const m = /\.(png|jpe?g|webp|mp4|mov)(\?|$)/i.exec(url)
  return m ? `.${m[1].toLowerCase()}` : fallback
}

function saveFile(projectId: string, folder: string, ext: string, bytes: Buffer): string {
  const rel = `${folder}/${randomUUID()}${ext}`
  const abs = assetAbsPath(projectId, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, bytes)
  return rel
}

/** A URL Higgsfield can fetch for a stored asset: its own recent result URL, or a fresh upload. */
async function publicUrlFor(asset: Asset, signal: AbortSignal): Promise<string> {
  if (asset.remoteUrl && asset.provider === 'higgsfield' && Date.now() - asset.createdAt < 6 * DAY) return asset.remoteUrl
  const up = asset.meta.uploadedUrl as string | undefined
  const at = asset.meta.uploadedAt as number | undefined
  if (up && at && Date.now() - at < 0.5 * DAY) return up
  const url = await hf.uploadFile(assetAbsPath(asset.projectId, asset.localPath), signal)
  updateAssetMeta(asset.id, { ...asset.meta, uploadedUrl: url, uploadedAt: Date.now() })
  return url
}

function imageProgress(ctx: TaskCtx, what: string) {
  return (status: hf.HfStatus, elapsed: number): void => {
    if (status === 'queued') ctx.progress(0.12, 'Mengantre di Higgsfield')
    else ctx.progress(0.15 + 0.75 * (1 - Math.exp(-elapsed / 45_000)), what)
  }
}

// ---------- prompts ----------

function characterLine(c: Character): string {
  return `${c.name}: ${c.description}`
}

/** Splits the storyboard's "Avoid:" line off the scene, so it can be phrased as a clear instruction. */
function splitAvoid(visual: string): { scene: string; avoid: string } {
  const lines = visual.split('\n')
  const i = lines.findIndex((l) => /^\s*avoid\s*:/i.test(l))
  if (i < 0) return { scene: visual.trim(), avoid: '' }
  const avoid = lines[i].replace(/^\s*avoid\s*:\s*/i, '').replace(/\.$/, '').trim()
  lines.splice(i, 1)
  return { scene: lines.join('\n').trim(), avoid }
}

/**
 * The image prompt for a clip. The scene comes first so the model gets the content right, then who the
 * characters are, then the art style. Clothing follows the scene's Wardrobe line when it has one, so a
 * character can change out of the outfit on their reference sheet (no spacesuit indoors).
 */
function clipPrompt(project: Project, clip: Clip, chars: Character[], refNames: string[], limit: number): string {
  if (isMapMaster(project)) {
    assertMapOpeningImage(project, clip)
    const prompt = buildFlowImagePrompt(project, clip, [])
    if (prompt.length > limit) throw new Error(`Prompt Map Animation melebihi batas model (${limit} karakter). Ringkas aturan atau pilih model lain.`)
    return prompt
  }
  if (isStickmanMaster(project)) {
    const prompt = [buildFlowImagePrompt(project, clip, chars), refNames.length ? `Character identity references in this order: ${refNames.join(', ')}. Preserve the exact identities, without copying the sheet layout.` : ''].filter(Boolean).join('\n\n')
    if (prompt.length > limit) throw new Error(`Prompt Stickman lengkap melebihi batas model (${limit} karakter). Ringkas aturan atau pilih model dengan batas lebih panjang.`)
    return prompt
  }
  if (isVoxMaster(project)) {
    const prompt = voxImagePrompt(
      [masterStageDirection(project, 'visual'), subjectNicheDirection(project.subjectNiche), clip.visualPrompt.trim() || clip.story.trim() || clip.title.trim()].filter(Boolean).join('\n\n'),
      project.aspectRatio,
      chars.map(characterLine).join('\n') + (refNames.length
        ? `\nReference sheets in this order: ${refNames.join(', ')}. Use only recurring subject identity; do not copy their layout or plain background.` : '')
    )
    if (prompt.length > limit) throw new Error(`Prompt VOX lengkap melebihi batas model (${limit} karakter). Ringkas deskripsi adegan atau pilih model dengan batas prompt lebih panjang.`)
    return prompt
  }
  const style = getStyle(project.styleId)
  const { scene, avoid } = splitAvoid(clip.visualPrompt)
  const wardrobe = /^\s*wardrobe\s*:/im.test(scene)
  const parts = [`Scene:\n${scene}`, subjectNicheDirection(project.subjectNiche)].filter(Boolean)
  if (chars.length)
    parts.push(
      `Recurring characters in this scene. Keep each one's body, face, hair and skin exactly as described${refNames.length ? ' and as on their reference sheet' : ''}.` +
        (wardrobe
          ? ' Their clothing follows the Wardrobe line of the scene: the default outfit only where it says so, otherwise the custom outfit.'
          : ' They wear their default outfit.') +
        `\n${chars.map(characterLine).join('\n')}`
    )
  if (refNames.length)
    parts.push(
      `Reference images are character sheets, in this order: ${refNames.join(', ')}. Use them for each character's identity, proportions and colors. ` +
        (wardrobe ? 'Copy the costume from a sheet only for characters whose Wardrobe line says "default outfit". ' : 'Match the costume to the sheet. ') +
        'Do not copy the sheet layout, poses or plain background.'
    )
  parts.push(`Art style: ${style.prompt}`)
  if (avoid) parts.push(`Must not appear in the image: ${avoid}.`)
  parts.push(`Frame format ${project.aspectRatio}, full-bleed composition.`)
  parts.push(masterStageDirection(project, 'visual'))
  const full = parts.join('\n\n')
  if (full.length <= limit) return full
  if (project.masterPrompt) throw new Error(`Prompt lengkap melebihi batas model (${limit} karakter). Ringkas deskripsi atau aturan visual, atau pilih model dengan batas lebih panjang.`)
  // Models with short prompt limits get the scene first, so trimming only loses style detail.
  return [subjectNicheDirection(project.subjectNiche), scene, chars.map(characterLine).join('; '), avoid && `Must not appear: ${avoid}.`, style.prompt].filter(Boolean).join('\n\n')
}

function sheetPrompt(project: Project, c: Character): string {
  if (isStickmanMaster(project)) return buildCodexCharacterPrompt(project, c)
  if (isVoxMaster(project)) return voxImagePrompt(
    `${masterStageDirection(project, 'visual')}\n\nOne large black-and-white halftone photographic identity cutout of ${c.name}: ${c.description}. Preserve actual supplied reference identity and period details. A clean neutral aged-paper background, no labels, no fabricated side-view turnaround or archival provenance.`,
    project.aspectRatio
  )
  const style = getStyle(project.styleId)
  return [
    style.prompt,
    `Character reference sheet for "${c.name}": ${c.description}. The character is ${style.characterHint}.`,
    subjectNicheDirection(project.subjectNiche),
    'Show the SAME character three times side by side: front view, three-quarter view and side view, full body, neutral standing pose, evenly spaced, on a plain light neutral background (this overrides any background instruction above). Consistent proportions, costume and colors in all three views.',
    masterStageDirection(project, 'visual')
  ].join('\n\n')
}

// ---------- waiting for character sheets ----------

async function waitForSheets(characterIds: string[], signal: AbortSignal): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 15 * 60 * 1000) {
    const pending = characterIds.some((id) => activeJobFor({ characterId: id }, 'sheet'))
    if (!pending) return
    await sleep(2000, signal)
  }
}

async function referenceUrls(model: HfModel, chars: Character[], signal: AbortSignal): Promise<{ urls: string[]; names: string[] }> {
  const limit = maxRefs(model)
  if (limit === 0) return { urls: [], names: [] }
  await waitForSheets(
    chars.map((c) => c.id),
    signal
  )
  const urls: string[] = []
  const names: string[] = []
  for (const c of chars) {
    const fresh = getCharacter(c.id)
    const sheet = getAsset(fresh.sheetAssetId)
    if (!sheet || urls.length >= limit) continue
    urls.push(await publicUrlFor(sheet, signal))
    names.push(fresh.name)
  }
  return { urls, names }
}

// ---------- finishing a Higgsfield request (also used to resume after a restart) ----------

interface HfPayload {
  target: 'clip-image' | 'sheet' | 'clip-video'
  model: string
  prompt: string
  masterPrompt?: MasterPromptProfile | null
  /** Opening state captured before submission, retained when polling after a restart. */
  mapImageState?: string | null
}

function mapOpeningImageState(project: Project, clip: Clip): string {
  return JSON.stringify([project.id, project.styleId, project.aspectRatio, project.subjectNiche, project.language,
    project.skillId, project.skillVariant, resolveMasterPrompt(project),
    clip.id, clip.sort, clip.story, clip.narration, clip.visualSource, clip.visualPrompt, clip.videoPrompt, clip.imageAssetId])
}

function assertMapImageUnchanged(clipId: string, captured: string | null): void {
  const current = getClip(clipId)
  const project = getProject(current.projectId)
  if (!captured && !isMapMaster(project)) return
  if (!captured || !isMapMaster(project) || mapOpeningImageState(project, current) !== captured) {
    throw new Error('Aturan peta, prompt, urutan, atau gambar pilihan berubah saat generate. Gambar pilihan terbaru tetap tersimpan; generate ulang untuk arahan terbaru.')
  }
  assertMapOpeningImage(project, current)
}

function assertMapImageResult(job: Job, payload: HfPayload): void {
  if (payload.target === 'clip-image' && job.clipId) assertMapImageUnchanged(job.clipId, payload.mapImageState ?? null)
}

async function finishHiggsfield(ctx: TaskCtx, job: Job, requestId: string, payload: HfPayload): Promise<string> {
  const isVideo = payload.target === 'clip-video'
  const result = await hf.waitForResult(
    requestId,
    imageProgress(ctx, isVideo ? 'Membuat video' : payload.target === 'sheet' ? 'Membuat lembar karakter' : 'Membuat gambar'),
    ctx.signal,
    isVideo ? 30 * 60 * 1000 : 15 * 60 * 1000
  )
  assertMapImageResult(job, payload)
  const url = isVideo ? result.video?.url : result.images?.[0]?.url
  if (!url) throw new Error('Higgsfield selesai tanpa file hasil')
  ctx.progress(0.93, 'Mengunduh hasil')
  const { bytes, contentType } = await downloadTo(url, ctx.signal)
  assertMapImageResult(job, payload)
  const rel = saveFile(job.projectId, isVideo ? 'videos' : 'images', extFromType(contentType, url, isVideo ? '.mp4' : '.png'), bytes)
  const abs = assetAbsPath(job.projectId, rel)
  const size = await probeSize(abs)
  const durationMs = isVideo ? await probeDurationMs(abs).catch(() => null) : null
  try {
    assertMapImageResult(job, payload)
  } catch (error) {
    // This unique managed output belongs only to this failed adoption, not an existing project asset.
    try { unlinkSync(abs) } catch { /* Preserve the stale-state error. */ }
    throw error
  }
  const asset = insertAsset({
    projectId: job.projectId,
    clipId: job.clipId,
    characterId: job.characterId,
    kind: isVideo ? 'video' : 'image',
    provider: 'higgsfield',
    model: payload.model,
    prompt: payload.prompt,
    remoteId: requestId,
    remoteUrl: url,
    localPath: rel,
    durationMs,
    width: size?.width ?? null,
    height: size?.height ?? null
  })
  emit.asset(asset)
  if (payload.target === 'sheet' && job.characterId) {
    setCharacterSheet(job.characterId, asset.id)
    emit.character({ characterId: job.characterId, patch: { sheetAssetId: asset.id } })
  } else if (payload.target === 'clip-image' && job.clipId) {
    patchClip(job.clipId, { imageAssetId: asset.id })
    emit.clip({ clipId: job.clipId, patch: { imageAssetId: asset.id } })
    const project = getProject(job.projectId)
    const first = clipsOf(job.projectId)[0]
    if (!project.coverAssetId || first?.id === job.clipId) touchProject(job.projectId, { coverAssetId: asset.id })
  } else if (payload.target === 'clip-video' && job.clipId) {
    patchClip(job.clipId, { videoAssetId: asset.id, motionType: 'video' })
    emit.clip({ clipId: job.clipId, patch: { videoAssetId: asset.id, motionType: 'video' } })
  }
  touchProject(job.projectId)
  return asset.id
}

function startHiggsfield(job: Job, build: (ctx: TaskCtx) => Promise<{ endpoint: string; body: Record<string, unknown>; payload: HfPayload }>): Job {
  emit.job(job)
  return runJob(job, 'higgsfield', async (ctx) => {
    ctx.progress(0.04, 'Menyiapkan prompt')
    const { endpoint, body, payload } = await build(ctx)
    assertMapImageResult(job, payload)
    ctx.progress(0.08, 'Mengirim ke Higgsfield')
    const requestId = await hf.submit(endpoint, body, ctx.signal)
    ctx.setRemote(requestId)
    updateJobPayload(job.id, payload)
    return finishHiggsfield(ctx, job, requestId, payload)
  })
}

function updateJobPayload(jobId: string, payload: HfPayload): void {
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify(payload), jobId)
}

// ---------- public entry points ----------

function requireHiggsfieldWorkflow(): void {
  if (getSettings().visualWorkflow !== 'higgsfield') {
    throw new Error('Alur Codex + Flow aktif. Salin prompt dan impor hasilnya di Storyboard, atau pilih Higgsfield API di Pengaturan.')
  }
}

export function generateClipImage(clipId: string): Job {
  requireHiggsfieldWorkflow()
  const existing = activeJobFor({ clipId }, 'image')
  if (existing) return existing
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  assertMapOpeningImage(project, clip)
  const mapState = isMapMaster(project) ? mapOpeningImageState(project, clip) : null
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'higgsfield' })
  updateJobPayload(job.id, { target: 'clip-image', model: getImageModel(project.imageModel).id, prompt: '', masterPrompt: project.masterPrompt, mapImageState: mapState })
  return startHiggsfield(job, async (ctx) => {
    const fresh = getClip(clipId)
    assertMapImageUnchanged(clipId, mapState)
    const model = getImageModel(project.imageModel)
    const chars = isMapMaster(project) ? [] : charactersOf(project.id).filter((c) => fresh.characterIds.includes(c.id))
    const refs = await referenceUrls(model, chars, ctx.signal)
    const prompt = clipPrompt(project, fresh, chars, refs.names, promptLimit(model))
    return {
      endpoint: model.id,
      body: imageBody(model, prompt, project.aspectRatio, refs.urls),
      payload: { target: 'clip-image', model: model.id, prompt, masterPrompt: project.masterPrompt, mapImageState: mapState }
    }
  })
}

export function generateCharacterSheet(characterId: string): Job {
  requireHiggsfieldWorkflow()
  const existing = activeJobFor({ characterId }, 'sheet')
  if (existing) return existing
  const c = getCharacter(characterId)
  const project = getProject(c.projectId)
  if (isMapMaster(project)) throw new Error('Map Animation memakai peta dan ikon; character sheet tidak diperlukan.')
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: c.projectId, characterId, kind: 'sheet', provider: 'higgsfield' })
  updateJobPayload(job.id, { target: 'sheet', model: getImageModel(project.imageModel).id, prompt: '', masterPrompt: project.masterPrompt })
  return startHiggsfield(job, async () => {
    const model = getImageModel(project.imageModel)
    const prompt = sheetPrompt(project, getCharacter(characterId))
    if (project.masterPrompt && prompt.length > promptLimit(model)) throw new Error(`Prompt lengkap melebihi batas model (${promptLimit(model)} karakter). Ringkas aturan visual atau pilih model lain.`)
    return {
      endpoint: model.id,
      body: imageBody(model, prompt, '16:9', []),
      payload: { target: 'sheet', model: model.id, prompt, masterPrompt: project.masterPrompt }
    }
  })
}

export function generateClipVideo(clipId: string): Job {
  requireHiggsfieldWorkflow()
  const existing = activeJobFor({ clipId }, 'video')
  if (existing) return existing
  const clip = getClip(clipId)
  if (!clip.imageAssetId) throw new Error('Buat gambar klip ini dulu sebelum membuat video AI.')
  const project = getProject(clip.projectId)
  assertMapVideoFrame(project, clip)
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'video', provider: 'higgsfield' })
  updateJobPayload(job.id, { target: 'clip-video', model: getVideoModel(project.videoModel).id, prompt: '', masterPrompt: project.masterPrompt })
  return startHiggsfield(job, async (ctx) => {
    const fresh = getClip(clipId)
    assertMapVideoFrame(project, fresh)
    const image = getAsset(fresh.imageAssetId)
    if (!image) throw new Error('Gambar klip tidak ditemukan')
    const model = getVideoModel(project.videoModel)
    ctx.progress(0.05, 'Menyiapkan gambar awal')
    const url = await publicUrlFor(image, ctx.signal)
    const ruled = !!project.masterPrompt || isMapMaster(project)
    let prompt = ruled ? buildFlowVideoPrompt(project, fresh, clipsOf(project.id)) :
      fresh.videoPrompt.trim() ||
      `${splitAvoid(fresh.visualPrompt).scene.replace(/\.$/, '')}. Subtle natural motion of the characters and environment, the camera slowly pushes in. Keep the art style of the first frame.`
    if (!ruled && model.input.mode === 'reference')
      prompt = `Open on the exact scene of the reference image and keep its art style, characters and composition. ${prompt}`
    if (ruled && prompt.length > promptLimit(model)) throw new Error(`Prompt video lengkap melebihi batas model (${promptLimit(model)} karakter). Pilih model lain atau ringkas aturan video.`)
    const sourceSeconds = isMapMaster(project) ? 8 : project.masterPrompt?.timing.sourceVideoSeconds
    const body = videoBody(model, prompt, url, sourceSeconds ?? fresh.durationMs / 1000, project.aspectRatio, project.videoResolution)
    if (ruled) body.prompt = prompt
    if (sourceSeconds && body.duration != null && Number(body.duration) !== sourceSeconds) throw new Error(`Model ini tidak mendukung durasi sumber ${sourceSeconds} detik. Pilih model yang sesuai atau ubah durasi sumber pada master prompt.`)
    return {
      endpoint: model.id,
      body,
      payload: { target: 'clip-video', model: model.id, prompt, masterPrompt: project.masterPrompt }
    }
  })
}

export function generateClipTts(clipId: string): Job {
  const existing = activeJobFor({ clipId }, 'tts')
  if (existing) return existing
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  project.masterPrompt = resolveMasterPrompt(project)
  const selected = chooseTtsRoute(project)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'tts', provider: selected.provider, payload: { tts: selected } })
  emit.job(job)
  return runJob(job, 'tts', async (ctx) => {
    const fresh = getClip(clipId)
    const text = fresh.narration.trim()
    if (!text) throw new Error('Naskah klip ini masih kosong')
    const route = await resolveTtsRoute(project, selected, ctx.jobId, ctx.signal)
    const p = { ...project, ttsProvider: route.provider, ttsVoice: route.voice }
    ctx.progress(0.2, 'Membuat suara')
    let rel: string
    let words: WordTiming[] | undefined
    let estimated = false
    const voice = route.voice
    if (p.ttsProvider === 'elevenlabs') {
      const out = await eleven.speak(text, voice, p.language, ctx.signal, undefined, route.model)
      rel = saveFile(p.id, 'audio', '.mp3', out.audio)
      words = out.words
    } else {
      const wav = await gemini.speak(text, voice, p.language, ctx.signal, masterStageDirection(p, 'voice'), route.model)
      rel = saveFile(p.id, 'audio', '.wav', wav)
    }
    ctx.progress(0.85, 'Mengukur durasi')
    const audioMs = await probeDurationMs(assetAbsPath(p.id, rel))
    if (!words?.length) {
      words = estimateWordTimings(stripVoiceTags(text), audioMs / 1000)
      estimated = true
    }
    const asset = insertAsset({
      projectId: p.id,
      clipId,
      kind: 'audio',
      provider: p.ttsProvider,
      model: route.model,
      prompt: text,
      localPath: rel,
      durationMs: audioMs,
      meta: { words, estimatedTimings: estimated, voice, masterPrompt: p.masterPrompt, voiceDirection: masterStageDirection(p, 'voice') }
    })
    emit.asset(asset)
    const durationMs = Math.max(1500, audioMs + 400)
    patchClip(clipId, { audioAssetId: asset.id, durationMs })
    emit.clip({ clipId, patch: { audioAssetId: asset.id, durationMs } })
    touchProject(p.id)
    return asset.id
  })
}

export function generateMissingImages(projectId: string): Job[] {
  const jobs: Job[] = []
  const project = getProject(projectId)
  if (isMapMaster(project)) {
    const opening = clipsOf(projectId)[0]
    return opening && mapClipImageEligible(project, opening) && !opening.imageAssetId ? [generateClipImage(opening.id)] : []
  }
  const model = getImageModel(project.imageModel)
  if (maxRefs(model) > 0) {
    const needed = new Set(clipsOf(projectId).flatMap((c) => c.characterIds))
    for (const c of charactersOf(projectId)) {
      if (needed.has(c.id) && !c.sheetAssetId) jobs.push(generateCharacterSheet(c.id))
    }
  }
  for (const clip of clipsOf(projectId)) {
    if (!clip.imageAssetId) jobs.push(generateClipImage(clip.id))
  }
  return jobs
}

/** Turns every clip that has an image but no AI video yet into a video. */
export function generateMissingVideos(projectId: string): Job[] {
  if (isMapMaster(getProject(projectId))) throw new Error('Map Animation dibuat berurutan: generate video klip pertama di Flow, impor hasilnya, lalu ambil frame akhir untuk klip berikutnya. Video peta tidak dibuat sekaligus.')
  const clips = clipsOf(projectId)
  if (clips.some((c) => !c.imageAssetId)) throw new Error('Buat gambar semua klip dulu sebelum menjadikannya video.')
  return clips.filter((c) => !c.videoAssetId).map((c) => generateClipVideo(c.id))
}

export function generateMissingTts(projectId: string): Job[] {
  return clipsOf(projectId)
    .filter((c) => !c.audioAssetId && c.narration.trim())
    .map((c) => generateClipTts(c.id))
}

/** After a restart, keep polling Higgsfield requests that were already submitted; fail the rest. */
export function resumeJobs(): void {
  const flowProjects = new Set<string>()
  for (const row of unfinishedJobs()) {
    if (row.provider === 'flow-mcp') {
      const flowPayload = JSON.parse(String(row.payload_json || '{}')) as { submissionStarted?: boolean }
      const submitted = !!row.remote_id || flowPayload.submissionStarted === true
      if (submitted) flowProjects.add(String(row.project_id))
      emit.job(updateJob(row.id, { status: 'failed', error: submitted ? 'Aplikasi dibuka ulang. Klik Pulihkan hasil Flow untuk mengambil pekerjaan yang sudah dikirim.' : 'Antrean terhenti sebelum dikirim ke Flow. Belum ada generate; Anda bisa mencoba lagi.', message: null }))
      continue
    }
    const payload = JSON.parse(row.payload_json || '{}') as Partial<HfPayload>
    if (row.provider === 'higgsfield' && row.remote_id && payload.target) {
      const job = getJob(row.id)!
      runJob(job, 'higgsfield', (ctx) => finishHiggsfield(ctx, job, row.remote_id, payload as HfPayload))
    } else {
      emit.job(updateJob(row.id, { status: 'failed', error: 'Terhenti karena aplikasi ditutup. Coba lagi.', message: null }))
    }
  }
  for (const projectId of flowProjects) void import('./flow-generation').then(m => m.recoverFlowJobs(projectId)).catch(() => {})
}

export async function setActiveAsset(clipId: string, assetId: string): Promise<void> {
  const asset = getAsset(assetId)
  if (!asset || asset.clipId !== clipId) throw new Error('Aset tidak cocok dengan klip ini')
  const patch: Partial<Clip> =
    asset.kind === 'image'
      ? { imageAssetId: asset.id }
      : asset.kind === 'video'
        ? { videoAssetId: asset.id }
        : asset.kind === 'audio'
          ? { audioAssetId: asset.id, durationMs: Math.max(1500, (asset.durationMs ?? 0) + 400) }
          : {}
  patchClip(clipId, patch)
  emit.clip({ clipId, patch })
}

/** Estimates that failed recently (no key, or a model the account cannot use), so pickers do not keep asking. */
const failedEstimates = new Map<string, number>()

/**
 * Credits for one image, or one clip video of about `seconds`. The model pickers ask for every model,
 * so answers are kept for a day and failures for ten minutes.
 */
export async function estimateCredits(
  kind: 'image' | 'video',
  modelId: string,
  aspect: AspectRatio,
  seconds = 5,
  resolution?: string | null
): Promise<CreditEstimate | null> {
  const model = kind === 'image' ? getImageModel(modelId) : getVideoModel(modelId)
  const body =
    kind === 'image'
      ? imageBody(model, 'estimate', aspect, [])
      : videoBody(model, 'estimate', 'https://example.com/frame.png', seconds, aspect, resolution)
  const key = `estimate:${model.id}:${JSON.stringify(body)}`
  const hit = readCache<CreditEstimate>(key)
  if (hit && Date.now() - hit.updatedAt < DAY) return hit.value
  const failedAt = failedEstimates.get(key)
  if (failedAt && Date.now() - failedAt < 10 * 60 * 1000) return null
  const value = await hf.estimate(model.id, body)
  if (value) writeCache(key, value)
  else failedEstimates.set(key, Date.now())
  return value
}

/** Prices can differ per account, so a new Higgsfield key starts from fresh estimates. */
export function forgetEstimates(): void {
  failedEstimates.clear()
  dropCache('estimate:')
}
