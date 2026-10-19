import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import { FLOW_IMAGE_MODEL, FLOW_VIDEO_MODEL, buildFlowCharacterPrompt, buildFlowShotImagePrompt, buildFlowShotVideoPrompt } from '@shared/flow'
import { isMapMaster, resolveMasterPrompt } from '@shared/master-prompts'
import { autoSyncEnabled } from '@shared/voiceover'
import type { Character, Clip, Job, Project } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { isActive, runJob, type TaskCtx } from './jobs'
import { persistGeneratedCharacterSheet, persistGeneratedClipImage, previousVideoFrame, readManagedImageBytes } from './media-import'
import { assertMapOpeningImage, assertMapVideoFrame } from './map-continuity'
import { assetAbsPath } from './paths'
import { FlowResponseError, flowCall, flowOutputPath, flowOwnerStatus, requireFlowReady, type FlowRemoteJob } from './providers/flow-mcp'
import { activeJobFor, charactersOf, clipsOf, getAsset, getBundle, getCharacter, getClip, getJob, getJobRaw, getProject, insertAsset, insertJob, patchClip, touchProject, updateJob } from './repo'
import { probeDurationMs, probeSize } from './services/audio'
import { getSettings } from './settings'

type Target = { clipId?: string; characterId?: string; projectId: string; kind: 'image' | 'video' | 'sheet'; maxCredits?: number; detached?: boolean; promptOverride?: string; specialKey?: string; specialAction?: string }
type FlowPayload = Target & { folder: string; captured: string; prompt?: string; submissionStarted?: boolean }

function fingerprint(target: Target): string {
  const project = getProject(target.projectId)
  const clip = target.clipId ? getClip(target.clipId) : null
  const character = target.characterId ? getCharacter(target.characterId) : null
  return JSON.stringify([project.styleId, project.aspectRatio, project.skillId, project.skillVariant, project.subjectNiche, resolveMasterPrompt(project),
    clip && [clip.id, clip.sort, clip.story, clip.narration, clip.visualPrompt, clip.visualSource, clip.videoPrompt, clip.characterIds,
      clip.imageAssetId, clip.videoAssetId, clip.motionType],
    character, charactersOf(project.id).filter(c => character?.id === c.id || clip?.characterIds.includes(c.id)),
    isMapMaster(project) ? clipsOf(project.id).map(c => [c.id, c.videoPrompt]) : []])
}

function savePayload(id: string, payload: FlowPayload): void {
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify(payload), id)
}

function referencePaths(project: Project, characters: Character[], folder: string): string[] {
  const refs = characters.filter(c => c.sheetAssetId)
  if (refs.length > 3) throw new Error('Flow menerima maksimal 3 referensi karakter pada satu shot. Kurangi pemeran di adegan ini.')
  return refs.map((character, index) => {
    const path = assetAbsPath(project.id, `flow-references/${folder}-${index}.png`)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, readManagedImageBytes(character.sheetAssetId!, project.id))
    return path
  })
}

async function waitRemote(ctx: TaskCtx, remoteId: string): Promise<FlowRemoteJob> {
  for (;;) {
    ctx.signal.throwIfAborted()
    let result: { jobs: FlowRemoteJob[] }
    try { result = await flowCall('wait', { job_ids: [remoteId], timeout_seconds: 15 }, ctx.signal) }
    catch (error) { if (ctx.signal.aborted) throw error; throw new Error('Koneksi putus setelah Flow menerima shot. Klik Pulihkan hasil Flow; pekerjaan tidak akan dikirim ulang.') }
    const job = result.jobs.find(j => j.id === remoteId)
    if (!job) throw new Error('Pekerjaan Flow tidak ditemukan. Gunakan Pulihkan hasil Flow; jangan generate ulang sebelum diperiksa.')
    if (job.status === 'done') return job
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.error || 'Flow tidak menghasilkan media. Periksa antrean Flow sebelum mencoba lagi.')
    ctx.progress(job.status === 'queued' ? 0.15 : 0.55, job.progress || (job.status === 'queued' ? 'Menunggu antrean Flow' : 'Flow sedang generate'))
  }
}

async function adopt(ctx: TaskCtx, payload: FlowPayload, remote: FlowRemoteJob): Promise<string> {
  ctx.signal.throwIfAborted()
  const kind = payload.kind === 'video' ? 'video' : 'image'
  const source = flowOutputPath(remote.files?.[0] || '', kind)
  const duplicate = getBundle(payload.projectId).assets.find(asset => asset.provider === 'flow-mcp' && asset.remoteId === remote.id)
  if (duplicate) return duplicate.id
  if (payload.captured !== fingerprint(payload)) throw new Error('Adegan, karakter, atau aturan berubah saat Flow generate. Pilihan terbaru tetap dipakai. Hasil Flow tetap tersedia; pulihkan setelah meninjau adegan.')
  const origin = { provider: 'flow-mcp' as const, model: remote.model || (kind === 'video' ? FLOW_VIDEO_MODEL : FLOW_IMAGE_MODEL), remoteId: remote.id,
    meta: { workflow: 'flow-mcp', flowFolder: payload.folder, credits: remote.chargedCredits ?? null, quotedCredits: remote.quoteCredits ?? null } }
  if (kind === 'image') {
    const bytes = readFileSync(source)
    const asset = payload.characterId ? await persistGeneratedCharacterSheet(payload.characterId, bytes, payload.prompt, origin)
      : await persistGeneratedClipImage(payload.clipId!, bytes, payload.prompt, origin)
    if (payload.clipId) {
      const clip = getClip(payload.clipId)
      if (!autoSyncEnabled(getProject(payload.projectId)) && clip.motionType === 'camera' && !clip.audioAssetId && !isMapMaster(getProject(payload.projectId))) {
        patchClip(clip.id, { durationMs: 1500 }); emit.clip({ clipId: clip.id, patch: { durationMs: 1500 } })
      }
    }
    return asset.id
  }
  const [durationMs, size] = await Promise.all([probeDurationMs(source), probeSize(source)])
  if (!size || durationMs < 3500 || durationMs > 4500 || Math.min(size.width, size.height) !== 720) throw new Error('Hasil Flow bukan shot 4 detik 720p. File tetap di output Flow; periksa model/setelan sebelum generate ulang.')
  if (payload.captured !== fingerprint(payload)) throw new Error('Adegan berubah saat hasil diperiksa. Video Flow tetap tersedia untuk dipulihkan.')
  const clip = getClip(payload.clipId!), project = getProject(payload.projectId)
  assertMapVideoFrame(project, clip)
  const localPath = `videos/${randomUUID()}${extname(source).toLowerCase()}`, path = assetAbsPath(project.id, localPath)
  mkdirSync(dirname(path), { recursive: true }); copyFileSync(source, path)
  const asset = insertAsset({ projectId: project.id, clipId: clip.id, kind: 'video', ...origin, prompt: payload.prompt, localPath, durationMs,
    width: size.width, height: size.height, meta: { ...origin.meta, mapVideoPlan: clip.videoPrompt, flowShot: true, sourceSeconds: 4, previousAssetId: clip.videoAssetId, ...(payload.detached ? {specialClipKey:payload.specialKey,specialAction:payload.specialAction,specialClip:true} : {}) } })
  if(payload.detached){touchProject(project.id);emit.asset(asset);return asset.id}
  const patch: Partial<Clip> = { videoAssetId: asset.id, motionType: 'video', ...(!autoSyncEnabled(project) && !clip.audioAssetId ? { durationMs: 4000 } : {}) }
  patchClip(clip.id, patch); touchProject(project.id); emit.asset(asset); emit.clip({ clipId: clip.id, patch })
  return asset.id
}

function queueTarget(target: Target): Job {
  if (!target.detached && getSettings().visualWorkflow !== 'flow-mcp') throw new Error('Pilih Flow MCP langsung di Pengaturan.')
  if (target.kind === 'video') {
    if (!Number.isFinite(target.maxCredits) || target.maxCredits! < 1 || target.maxCredits! > 100) throw new Error('Konfirmasi batas kredit video sebelum generate.')
    target.maxCredits = Math.min(target.maxCredits!, getSettings().flowVideoMaxCredits)
  }
  const existing = activeJobFor(target, target.kind)
  if (existing) return existing
  const project = getProject(target.projectId)
  if (target.kind === 'sheet' && isMapMaster(project)) throw new Error('Map Animation memakai peta dan ikon, tanpa character sheet.')
  if (target.kind === 'image') assertMapOpeningImage(project, getClip(target.clipId!))
  // An uncertain submission must be recovered rather than silently spending a second time.
  const unresolved = getBundle(project.id).jobs.find(j => j.provider === 'flow-mcp' && j.kind === target.kind && j.clipId === (target.clipId ?? null)
    && j.characterId === (target.characterId ?? null) && j.status === 'failed' && j.error?.includes('Pulihkan'))
  if (unresolved) throw new Error('Ada hasil Flow yang belum pasti. Klik Pulihkan hasil Flow sebelum generate ulang.')
  const job = insertJob({ ...target, provider: 'flow-mcp' })
  const payload: FlowPayload = { ...target, folder: `Naraflow_${project.id.slice(0, 8)}_${job.id}`, captured: fingerprint(target) }
  savePayload(job.id, payload)
  emit.job(job)
  return runJob(job, 'flow', async ctx => {
    await requireFlowReady(target.kind === 'video' ? 'video' : 'image', target.maxCredits, !!target.detached)
    ctx.signal.throwIfAborted()
    if (payload.captured !== fingerprint(target)) throw new Error('Adegan/karakter berubah saat mengantre. Susun arahan terbaru sebelum generate.')
    const freshProject = getProject(project.id), clip = target.clipId ? getClip(target.clipId) : null
    if (clip && target.kind === 'video' && isMapMaster(freshProject) && clipsOf(project.id).findIndex(c => c.id === clip.id) > 0) {
      await previousVideoFrame(clip.id)
      payload.captured = fingerprint(target)
    }
    const freshClip = clip ? getClip(clip.id) : null
    const cast = isMapMaster(freshProject) ? [] : charactersOf(project.id).filter(c => target.characterId === c.id || freshClip?.characterIds.includes(c.id))
    const image = target.kind === 'video' && freshClip ? getAsset(freshClip.imageAssetId) : null
    if (target.kind === 'video' && freshClip) assertMapVideoFrame(freshProject, freshClip)
    if (target.kind === 'video' && isMapMaster(freshProject) && !image) throw new Error('Buat gambar awal peta sebelum generate video berantai.')
    const references = image ? [] : referencePaths(freshProject, cast, job.id)
    payload.prompt = target.kind === 'sheet' ? buildFlowCharacterPrompt(freshProject, getCharacter(target.characterId!))
      : target.kind === 'image' ? buildFlowShotImagePrompt(freshProject, freshClip!, cast)
        : buildFlowShotVideoPrompt(freshProject, freshClip!, clipsOf(project.id), cast)
    if(target.promptOverride)payload.prompt=target.promptOverride
    const scene = { prompt: payload.prompt, type: target.kind === 'video' ? 'video' : 'image', model: target.kind === 'video' ? FLOW_VIDEO_MODEL : FLOW_IMAGE_MODEL,
      aspect_ratio: freshProject.aspectRatio, variants: 1, retries: 0, download_quality: 'original',
      max_credits: target.kind === 'video' ? target.maxCredits! : 0,
      ...(target.kind === 'video' ? { duration: 4, resolution: '720p' } : {}),
      ...(image ? { first_frame: referencePaths(freshProject, [{ id: image.id, sheetAssetId: image.id } as Character], job.id)[0] } : references.length ? { reference_images: references } : {}) }
    ctx.progress(0.08, 'Mengirim shot ke Flow')
    payload.submissionStarted = true; savePayload(job.id, payload)
    // Do not retry or abort a submission: losing its response does not mean it was not charged.
    let response: { jobs: FlowRemoteJob[] }
    try { response = await flowCall('generate', { project: payload.folder, scenes: [scene] }) }
    catch (error) {
      if (error instanceof FlowResponseError) { payload.submissionStarted = false; savePayload(job.id, payload); throw error }
      throw new Error('Status pengiriman Flow belum pasti. Klik Pulihkan hasil Flow; jangan generate ulang sebelum antrean diperiksa.')
    }
    const remote = response.jobs?.[0]
    if (!remote?.id) throw new Error('Flow belum mengembalikan nomor pekerjaan. Klik Pulihkan hasil Flow.')
    ctx.setRemote(remote.id)
    return adopt(ctx, payload, await waitRemote(ctx, remote.id))
  })
}

export const generateFlowImage = (clipId: string): Job => queueTarget({ clipId, projectId: getClip(clipId).projectId, kind: 'image' })
export const generateFlowVideo = (clipId: string, maxCredits: number): Job => queueTarget({ clipId, projectId: getClip(clipId).projectId, kind: 'video', maxCredits })
export const generateFlowSpecialVideo = (clipId:string,promptOverride:string,maxCredits:number,specialKey:string,specialAction:string):Job => queueTarget({clipId,projectId:getClip(clipId).projectId,kind:'video',maxCredits,detached:true,promptOverride,specialKey,specialAction})
export const generateFlowCharacter = (characterId: string): Job => queueTarget({ characterId, projectId: getCharacter(characterId).projectId, kind: 'sheet' })
export function missingFlowImages(projectId: string): Job[] {
  const project = getProject(projectId)
  return clipsOf(projectId).filter((clip, i) => !clip.imageAssetId && (!isMapMaster(project) || i === 0)).map(clip => generateFlowImage(clip.id))
}
export function missingFlowVideos(projectId: string, maxCredits: number): Job[] { return clipsOf(projectId).filter(clip => !clip.videoAssetId).map(clip => generateFlowVideo(clip.id, maxCredits)) }

/** Resume only existing remote jobs; recovery never submits a generation. */
export async function recoverFlowJobs(projectId: string): Promise<Job[]> {
  const status = await flowOwnerStatus(), recovered: Job[] = []
  for (const job of getBundle(projectId).jobs.filter(j => j.provider === 'flow-mcp' && ['image', 'video', 'sheet'].includes(j.kind) && j.status !== 'done' && !isActive(j.id))) {
    const raw = getJobRaw(job.id), payload = JSON.parse(String(raw?.payload_json || '{}')) as FlowPayload
    if (!payload.folder || !payload.captured) continue
    const matches = (status.jobs ?? []).filter(remote => remote.id === raw?.remote_id || remote.project?.split(/[\\/]/).pop() === payload.folder)
    if (matches.length !== 1) continue
    const remote = matches[0]
    if (remote.status === 'failed' || remote.status === 'cancelled') {
      if (remote.failureKind === 'not_submitted' || remote.status === 'cancelled') emit.job(updateJob(job.id, { status: 'failed', error: 'Antrean Flow berhenti sebelum submit. Tidak ada generate; Anda bisa mencoba lagi.', message: null }))
      continue
    }
    recovered.push(runJob(getJob(job.id)!, 'flow', async ctx => { ctx.setRemote(remote.id); return adopt(ctx, payload, await waitRemote(ctx, remote.id)) }))
  }
  return recovered
}
