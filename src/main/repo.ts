import {CUTOUT_CAPTION_DEFAULTS} from '@shared/cutout-reference-profile'
import { validateSpecialVideo } from '@shared/special-clips'
import { healthDialogueEditorDefaults } from '@shared/health-dialogue'
import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Asset,
  AssetKind,
  AssetMeta,
  Character,
  Clip,
  EditorSettings,
  Job,
  JobKind,
  JobStatus,
  NewProjectInput,
  Project,
  ProjectBundle,
  ProjectSnapshot,
  ProjectSummary
} from '@shared/types'
import { visualSourceOf } from '@shared/script'
import { autoSyncEnabled, syncedVoiceDuration } from '@shared/voiceover'
import { validateDurationSec } from '@shared/duration'
import { CONTENT_SKILLS, defaultStyleForSkill, getContentSkill, getSkillVariant, type SkillId } from '@shared/skills'
import { validateMasterPrompt,builtInMasterPrompts,legacyCutoutFactsMaster } from '@shared/master-prompts'
import { normalizeSubjectNiche } from '@shared/niches'
import { cutoutAssetIds, normalizeCutoutScene, type CutoutScene } from '@shared/cutout-timeline'
import { normalizeSoundEffects, validateSoundEffectAssets } from '@shared/sfx'
import { getDb } from './db'
import { assetUrl, projectDir, projectsRoot } from './paths'
import { getSettings } from './settings'

export const DEFAULT_EDITOR: EditorSettings = {
  autoSyncVoiceover: true,
  captionStyle: 'karaoke',
  captionPosition: 'bawah',
  captionSize: 'sedang',
  musicAssetId: null,
  musicVolumeDb: -18,
  duckMusic: true,
  overlays: [],
  sfx: []
}

type Row = Record<string, any>

function projectSkill(input: { skillId?: SkillId; skillVariant?: string }): { skillId: SkillId; skillVariant: string } {
  const skillId = input.skillId ?? 'general'
  if (!CONTENT_SKILLS.some((skill) => skill.id === skillId)) throw new Error('Pilihan skill tidak dikenal.')
  const skillVariant = input.skillVariant ?? ''
  if (skillVariant && !getSkillVariant(skillId, skillVariant)) {
    throw new Error('Pilihan jenis skill tidak sesuai. Pilih ulang jenis skill.')
  }
  return { skillId, skillVariant }
}

function readEditor(raw: string): EditorSettings {
  const editor = { ...DEFAULT_EDITOR, ...JSON.parse(raw || '{}') }
  return { ...editor, sfx: normalizeSoundEffects(editor.sfx) }
}

const toProject = (r: Row): Project => ({
  id: r.id,
  title: r.title,
  synopsis: r.synopsis,
  subjectNiche: normalizeSubjectNiche(r.subject_niche),
  durationSec: r.duration_sec,
  language: r.language,
  aspectRatio: r.aspect_ratio,
  styleId: r.style_id,
  skillId: getContentSkill(r.skill_id).id,
  skillVariant: r.skill_variant ?? '',
  masterPrompt: r.master_prompt_json ? validateMasterPrompt(JSON.parse(r.master_prompt_json)) : r.style_id==='cutout-facts'?structuredClone(legacyCutoutFactsMaster):null,
  ttsProvider: r.tts_provider,
  ttsVoice: r.tts_voice,
  imageModel: r.image_model,
  videoModel: r.video_model,
  videoResolution: r.video_resolution ?? null,
  status: r.status,
  step: r.step,
  coverAssetId: r.cover_asset_id,
  editor: readEditor(r.editor_json),
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

const toCharacter = (r: Row): Character => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  description: r.description,
  sheetAssetId: r.sheet_asset_id,
  sort: r.sort
})

const toClip = (r: Row): Clip => ({
  id: r.id,
  projectId: r.project_id,
  sort: r.sort,
  title: r.title,
  story: r.story ?? '',
  visualPrompt: r.visual_prompt,
  visualSource: r.visual_source ?? null,
  narration: r.narration,
  durationMs: r.duration_ms,
  characterIds: JSON.parse(r.character_ids || '[]'),
  motionType: r.motion_type,
  cameraPreset: r.camera_preset,
  motionStrength: r.motion_strength,
  videoPrompt: r.video_prompt,
  transition: r.transition,
  imageAssetId: r.image_asset_id,
  videoAssetId: r.video_asset_id,
  audioAssetId: r.audio_asset_id,
  cutout: normalizeCutoutScene(r.cutout_json ? JSON.parse(r.cutout_json) : null)
})

export const toAsset = (r: Row): Asset => ({
  id: r.id,
  projectId: r.project_id,
  clipId: r.clip_id,
  characterId: r.character_id,
  kind: r.kind,
  provider: r.provider,
  model: r.model,
  prompt: r.prompt,
  remoteId: r.remote_id,
  remoteUrl: r.remote_url,
  localPath: r.local_path,
  url: assetUrl(r.project_id, r.local_path),
  durationMs: r.duration_ms,
  width: r.width,
  height: r.height,
  meta: JSON.parse(r.meta_json || '{}'),
  createdAt: r.created_at
})

export const toJob = (r: Row): Job => ({
  id: r.id,
  projectId: r.project_id,
  clipId: r.clip_id,
  characterId: r.character_id,
  kind: r.kind,
  provider: r.provider,
  status: r.status,
  progress: r.progress,
  message: r.message,
  error: r.error,
  resultAssetId: r.result_asset_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

// ---------- projects ----------

export function listProjects(): ProjectSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM clips c WHERE c.project_id = p.id) AS clip_count,
        (SELECT COALESCE(SUM(duration_ms), 0) FROM clips c WHERE c.project_id = p.id) AS total_ms,
        (SELECT a.local_path FROM assets a WHERE a.id = p.cover_asset_id) AS cover_path
       FROM projects p ORDER BY p.updated_at DESC`
    )
    .all() as Row[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    styleId: r.style_id,
    status: r.status,
    step: r.step,
    clipCount: r.clip_count,
    totalMs: r.total_ms,
    coverUrl: r.cover_path ? assetUrl(r.id, r.cover_path) : null,
    updatedAt: r.updated_at
  }))
}

export function createProject(input: NewProjectInput): Project {
  const durationSec = validateDurationSec(input.durationSec ?? 60)
  const subjectNiche = normalizeSubjectNiche(input.subjectNiche)
  const skill = projectSkill(input)
  const styleId = input.styleId ?? defaultStyleForSkill(skill.skillId, skill.skillVariant)
  const masterPrompt = input.masterPrompt == null ? (styleId==='cutout-facts'?validateMasterPrompt(builtInMasterPrompts.find(p=>p.id==='builtin:cutout-facts')!):null) : validateMasterPrompt(input.masterPrompt)
  const s = getSettings()
  const now = Date.now()
  const id = randomUUID()
  const tts = input.ttsProvider ?? s.defaultTtsProvider
  getDb()
    .prepare(
      `INSERT INTO projects (id, title, synopsis, duration_sec, language, aspect_ratio, style_id, tts_provider, tts_voice,
        image_model, video_model, skill_id, skill_variant, master_prompt_json, subject_niche, status, step, editor_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)`
    )
    .run(
      id,
      'Proyek tanpa judul',
      input.synopsis ?? '',
      durationSec,
      input.language ?? s.defaultLanguage,
      input.aspectRatio ?? '16:9',
      styleId,
      tts,
      tts === 'gemini' ? 'Charon' : '',
      s.imageModel,
      s.videoModel,
      skill.skillId,
      skill.skillVariant,
      masterPrompt ? JSON.stringify(masterPrompt) : null,
      subjectNiche,
      JSON.stringify({ ...DEFAULT_EDITOR, ...healthDialogueEditorDefaults(styleId), ...(styleId==='cutout-facts'?{...CUTOUT_CAPTION_DEFAULTS,...(masterPrompt?.version===6?{cutoutV5:{motionProfile:'standard'}}:{})}:{}) }),
      now,
      now
    )
  projectDir(id)
  return getProject(id)
}

export function getProject(id: string): Project {
  const r = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined
  if (!r) throw new Error('Proyek tidak ditemukan')
  return toProject(r)
}

export function getBundle(id: string): ProjectBundle {
  const db = getDb()
  return {
    project: getProject(id),
    characters: (db.prepare('SELECT * FROM characters WHERE project_id = ? ORDER BY sort').all(id) as Row[]).map(toCharacter),
    clips: (db.prepare('SELECT * FROM clips WHERE project_id = ? ORDER BY sort').all(id) as Row[]).map(toClip),
    assets: (db.prepare('SELECT * FROM assets WHERE project_id = ? ORDER BY created_at').all(id) as Row[]).map(toAsset),
    jobs: (
      db
        .prepare("SELECT * FROM jobs WHERE project_id = ? AND (status IN ('queued','running') OR updated_at > ?) ORDER BY created_at")
        .all(id, Date.now() - 10 * 60 * 1000) as Row[]
    ).map(toJob)
  }
}

export function touchProject(id: string, patch: Partial<Pick<Project, 'status' | 'step' | 'coverAssetId' | 'title'>> = {}): void {
  const sets: string[] = ['updated_at = @now']
  if (patch.status) sets.push('status = @status')
  if (patch.step) sets.push('step = @step')
  if (patch.coverAssetId !== undefined) sets.push('cover_asset_id = @coverAssetId')
  if (patch.title) sets.push('title = @title')
  getDb()
    .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = @id`)
    .run({ ...patch, id, now: Date.now() })
}

/** Validate image references before a composition is saved or cloned. Disk availability is checked at render time. */
function projectCutout(value: unknown, projectId: string, durationMs=100): CutoutScene | null {
  const scene = normalizeCutoutScene(value)
  if (!scene) return null
  if(scene.specialVideo)validateSpecialVideo(scene.specialVideo,getAsset(scene.specialVideo.assetId)??undefined,projectId,durationMs)
  const ids = cutoutAssetIds(scene)
  if (!ids.length) return scene
  const rows = getDb().prepare('SELECT id, kind, local_path FROM assets WHERE project_id = ?').all(projectId) as Row[]
  const assets = new Map(rows.map(asset => [asset.id, asset]))
  for (const id of ids) {
    const asset = assets.get(id)
    if (!asset) throw new Error(`Aset Cutout ${id} tidak ditemukan dalam proyek ini. Pilih ulang gambar layer atau pose.`)
    if ((asset.kind !== 'image' && asset.kind !== 'overlay') || !/\.(png|jpe?g|webp)$/i.test(asset.local_path)) {
      throw new Error(`Aset Cutout ${id} harus berupa gambar PNG, JPEG, atau WebP.`)
    }
  }
  return scene
}

function cutoutJson(scene: CutoutScene | null): string | null {
  return scene ? JSON.stringify(scene) : null
}

/** Saves editable project data; Cutout's image references are checked against main-process assets. */
export function saveSnapshot(snap: ProjectSnapshot): number {
  const db = getDb()
  const now = Date.now()
  const p = { ...snap.project, ...projectSkill(snap.project), durationSec: validateDurationSec(snap.project.durationSec) }
  // An omitted field from an older client preserves the saved niche; an explicit empty value clears it.
  const subjectNiche = p.subjectNiche === undefined ? getProject(p.id).subjectNiche : normalizeSubjectNiche(p.subjectNiche)
  // Older clients omit the new field; only an explicit null resets a project's saved rules.
  const masterPrompt = p.masterPrompt === undefined ? getProject(p.id).masterPrompt
    : p.masterPrompt === null ? null : validateMasterPrompt(p.masterPrompt)
  db.transaction(() => {
    // Cutout is optional in snapshots: omitted or null means normal image/video playback.
    const sfx = normalizeSoundEffects(p.editor.sfx === undefined ? getProject(p.id).editor.sfx : p.editor.sfx)
    const audioAssets = (db.prepare('SELECT id, project_id, kind, duration_ms FROM assets WHERE project_id = ?').all(p.id) as Row[])
      .map(asset => ({ id: asset.id as string, projectId: asset.project_id as string, kind: asset.kind as string, durationMs: asset.duration_ms as number | null }))
    validateSoundEffectAssets(sfx, audioAssets, p.id)
    const editor = { ...p.editor, sfx }
    const cutouts = new Map<string, CutoutScene | null>()
    const existingClip = db.prepare('SELECT project_id FROM clips WHERE id = ?')
    for (const clip of snap.clips) {
      if (clip.projectId !== p.id) throw new Error('Klip tidak berasal dari proyek yang sedang disimpan.')
      if (cutouts.has(clip.id)) throw new Error('ID klip dalam proyek harus unik.')
      const row = existingClip.get(clip.id) as Row | undefined
      if (row && row.project_id !== p.id) throw new Error('Klip tidak berasal dari proyek yang sedang disimpan.')
      cutouts.set(clip.id, projectCutout(clip.cutout, p.id,clip.durationMs))
    }
    db.prepare(
      `UPDATE projects SET title = @title, synopsis = @synopsis, duration_sec = @durationSec, language = @language,
        aspect_ratio = @aspectRatio, style_id = @styleId, skill_id = @skillId, skill_variant = @skillVariant, tts_provider = @ttsProvider, tts_voice = @ttsVoice,
        image_model = @imageModel, video_model = @videoModel, video_resolution = @videoResolution, master_prompt_json = @masterPromptJson, subject_niche = @subjectNiche, status = @status, step = @step, editor_json = @editor, updated_at = @now
       WHERE id = @id`
    ).run({ ...p, subjectNiche, masterPromptJson: masterPrompt ? JSON.stringify(masterPrompt) : null, editor: JSON.stringify(editor), now })

    const charIds = snap.characters.map((c) => c.id)
    db.prepare(
      `DELETE FROM characters WHERE project_id = ? AND id NOT IN (${charIds.map(() => '?').join(',') || "''"})`
    ).run(p.id, ...charIds)
    const upChar = db.prepare(
      `INSERT INTO characters (id, project_id, name, description, sort) VALUES (@id, @projectId, @name, @description, @sort)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, sort = excluded.sort`
    )
    for (const c of snap.characters) upChar.run({ ...c, projectId: p.id })

    const clipIds = snap.clips.map((c) => c.id)
    db.prepare(`DELETE FROM clips WHERE project_id = ? AND id NOT IN (${clipIds.map(() => '?').join(',') || "''"})`).run(
      p.id,
      ...clipIds
    )
    const upClip = db.prepare(
      `INSERT INTO clips (id, project_id, sort, title, story, visual_prompt, visual_source, narration, duration_ms, character_ids, motion_type,
         camera_preset, motion_strength, video_prompt, transition, cutout_json)
       VALUES (@id, @projectId, @sort, @title, @story, @visualPrompt, @visualSource, @narration, @durationMs, @characterIds, @motionType,
         @cameraPreset, @motionStrength, @videoPrompt, @transition, @cutoutJson)
       ON CONFLICT(id) DO UPDATE SET sort = excluded.sort, title = excluded.title, story = excluded.story, visual_prompt = excluded.visual_prompt, visual_source = excluded.visual_source,
         narration = excluded.narration, duration_ms = excluded.duration_ms, character_ids = excluded.character_ids,
         motion_type = excluded.motion_type, camera_preset = excluded.camera_preset, motion_strength = excluded.motion_strength,
         video_prompt = excluded.video_prompt, transition = excluded.transition, cutout_json = excluded.cutout_json`
    )
    for (const c of snap.clips) {
      const row = db.prepare('SELECT audio_asset_id FROM clips WHERE id = ? AND project_id = ?').get(c.id, p.id) as { audio_asset_id: string | null } | undefined
      const voice = row?.audio_asset_id ? getAsset(row.audio_asset_id) : null
      const timing = autoSyncEnabled(p) ? syncedVoiceDuration({ ...c, projectId: p.id }, voice) : null
      upClip.run({ ...c, durationMs: timing ?? c.durationMs, visualSource: c.visualSource ?? null, projectId: p.id, characterIds: JSON.stringify(c.characterIds), cutoutJson: cutoutJson(cutouts.get(c.id) ?? null) })
    }
  })()
  return now
}

export function removeProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  const dir = join(projectsRoot(), id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function duplicateProject(id: string): ProjectSummary {
  const db = getDb()
  const src = getBundle(id)
  const cutouts = new Map(src.clips.map(clip => [clip.id, projectCutout(clip.cutout, id,clip.durationMs)]))
  const sfx = normalizeSoundEffects(src.project.editor.sfx)
  validateSoundEffectAssets(sfx, src.assets, id)
  const newId = randomUUID()
  const now = Date.now()
  const idMap = new Map<string, string>()
  const mapId = (old: string | null): string | null => {
    if (!old) return null
    if (!idMap.has(old)) idMap.set(old, randomUUID())
    return idMap.get(old)!
  }
  db.transaction(() => {
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row
    db.prepare(
      `INSERT INTO projects (id, title, synopsis, duration_sec, language, aspect_ratio, style_id, tts_provider, tts_voice,
         image_model, video_model, video_resolution, skill_id, skill_variant, master_prompt_json, subject_niche, status, step, cover_asset_id, editor_json, created_at, updated_at)
       SELECT @newId, @title, synopsis, duration_sec, language, aspect_ratio, style_id, tts_provider, tts_voice,
         image_model, video_model, video_resolution, skill_id, skill_variant, master_prompt_json, subject_niche, status, step, @cover, editor_json, @now, @now FROM projects WHERE id = @id`
    ).run({ newId, id, title: `${p.title} (salinan)`, cover: mapId(p.cover_asset_id), now })
    for (const a of src.assets) {
      db.prepare(
        `INSERT INTO assets (id, project_id, clip_id, character_id, kind, provider, model, prompt, remote_id, remote_url, local_path,
           duration_ms, width, height, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        mapId(a.id),
        newId,
        mapId(a.clipId),
        mapId(a.characterId),
        a.kind,
        a.provider,
        a.model,
        a.prompt,
        a.remoteId,
        a.remoteUrl,
        a.localPath,
        a.durationMs,
        a.width,
        a.height,
        JSON.stringify(a.meta),
        a.createdAt
      )
    }
    // All editor references must point at the cloned asset rows, including repeated SFX cues.
    const editor: EditorSettings = {
      ...src.project.editor,
      musicAssetId: mapId(src.project.editor.musicAssetId),
      overlays: src.project.editor.overlays.map(overlay => overlay.kind === 'image' ? { ...overlay, assetId: mapId(overlay.assetId)! } : overlay),
      sfx: sfx.map(cue => ({ ...cue, id: randomUUID(), assetId: mapId(cue.assetId)! }))
    }
    db.prepare('UPDATE projects SET editor_json = ? WHERE id = ?').run(JSON.stringify(editor), newId)
    for (const c of src.characters) {
      db.prepare('INSERT INTO characters (id, project_id, name, description, sheet_asset_id, sort) VALUES (?, ?, ?, ?, ?, ?)').run(
        mapId(c.id),
        newId,
        c.name,
        c.description,
        mapId(c.sheetAssetId),
        c.sort
      )
    }
    for (const c of src.clips) {
      const scene = cutouts.get(c.id)
      const cutout = scene ? {
        ...scene,
        ...(scene.specialVideo ? {specialVideo: {...scene.specialVideo, assetId: mapId(scene.specialVideo.assetId)!}} : {}),
        layers: scene.layers.map(layer => ({
          ...layer,
          assetId: mapId(layer.assetId),
          poses: layer.poses.map(pose => ({ ...pose, assetId: mapId(pose.assetId)! }))
        }))
      } : null
      db.prepare(
        `INSERT INTO clips (id, project_id, sort, title, story, visual_prompt, visual_source, narration, duration_ms, character_ids,
           motion_type, camera_preset, motion_strength, video_prompt, transition, image_asset_id, video_asset_id, audio_asset_id, cutout_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        mapId(c.id),
        newId,
        c.sort,
        c.title,
        c.story,
        c.visualPrompt,
        c.visualSource,
        c.narration,
        c.durationMs,
        JSON.stringify(c.characterIds.map((x) => mapId(x))),
        c.motionType,
        c.cameraPreset,
        c.motionStrength,
        c.videoPrompt,
        c.transition,
        mapId(c.imageAssetId),
        mapId(c.videoAssetId),
        mapId(c.audioAssetId),
        cutoutJson(cutout)
      )
    }
  })()
  const srcDir = join(projectsRoot(), id)
  if (existsSync(srcDir)) cpSync(srcDir, projectDir(newId), { recursive: true })
  return listProjects().find((p) => p.id === newId)!
}

// ---------- story ----------

export type StoryClip = Omit<
  Clip,
  'id' | 'projectId' | 'sort' | 'imageAssetId' | 'videoAssetId' | 'audioAssetId' | 'characterIds' | 'visualSource'
> & {
  characterNames: string[]
}

/** A complete storyboard in one go (script and visuals); used by the development harness. */
export function replaceStory(
  projectId: string,
  title: string,
  characters: { name: string; description: string }[],
  clips: StoryClip[]
): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM clips WHERE project_id = ?').run(projectId)
    db.prepare('DELETE FROM characters WHERE project_id = ?').run(projectId)
    const byName = new Map<string, string>()
    characters.forEach((c, i) => {
      const id = randomUUID()
      byName.set(c.name.trim().toLowerCase(), id)
      db.prepare('INSERT INTO characters (id, project_id, name, description, sort) VALUES (?, ?, ?, ?, ?)').run(
        id,
        projectId,
        c.name,
        c.description,
        i
      )
    })
    clips.forEach((c, i) => {
      const ids = c.characterNames.map((n) => byName.get(n.trim().toLowerCase())).filter((x): x is string => !!x)
      db.prepare(
        `INSERT INTO clips (id, project_id, sort, title, story, visual_prompt, visual_source, narration, duration_ms, character_ids,
           motion_type, camera_preset, motion_strength, video_prompt, transition)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        projectId,
        i,
        c.title,
        c.story,
        c.visualPrompt,
        visualSourceOf(c),
        c.narration,
        c.durationMs,
        JSON.stringify(ids),
        c.motionType,
        c.cameraPreset,
        c.motionStrength,
        c.videoPrompt,
        c.transition
      )
    })
    db.prepare("UPDATE projects SET title = ?, status = 'storyboard', step = 3, updated_at = ? WHERE id = ?").run(
      title,
      Date.now(),
      projectId
    )
  })()
}

export interface ScriptScene {
  title: string
  story: string
  narration: string
  durationMs: number
}

/** Adds a planned cast without replacing saved characters, their sheets or any scenes. */
export function appendCharacters(projectId: string, characters: { name: string; description: string }[]): void {
  if (!Array.isArray(characters) || characters.length > 5) throw new Error('Rencana karakter maksimal lima karakter.')
  const planned = characters.map((character) => {
    if (!character || typeof character.name !== 'string' || typeof character.description !== 'string') throw new Error('Rencana karakter tidak valid.')
    const name = character.name.trim()
    const description = character.description.trim()
    if (!name || name.length > 200 || !description || description.length > 10000) throw new Error('Nama atau deskripsi karakter tidak valid.')
    return { name, description }
  })
  const db = getDb()
  db.transaction(() => {
    getProject(projectId)
    const existing = db.prepare('SELECT name, sort FROM characters WHERE project_id = ?').all(projectId) as { name: string; sort: number }[]
    const names = new Set(existing.map((character) => character.name.trim().toLocaleLowerCase()))
    let sort = existing.reduce((maximum, character) => Math.max(maximum, character.sort), -1) + 1
    const insert = db.prepare('INSERT INTO characters (id, project_id, name, description, sort) VALUES (?, ?, ?, ?, ?)')
    let added = false
    for (const character of planned) {
      const key = character.name.toLocaleLowerCase()
      if (names.has(key)) continue
      insert.run(randomUUID(), projectId, character.name, character.description, sort++)
      names.add(key)
      added = true
    }
    if (added) touchProject(projectId)
  })()
}

/**
 * Replaces all scenes with a freshly written script. Characters stay: the visual step reuses the ones
 * whose names come back, so their character sheets survive a rewrite.
 */
export function replaceScript(projectId: string, title: string, scenes: ScriptScene[]): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM clips WHERE project_id = ?').run(projectId)
    const insert = db.prepare(
      `INSERT INTO clips (id, project_id, sort, title, story, narration, duration_ms, character_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`
    )
    scenes.forEach((c, i) => insert.run(randomUUID(), projectId, i, c.title, c.story, c.narration, c.durationMs))
      if(getProject(projectId).styleId==='cutout-facts')db.prepare("UPDATE clips SET transition='cut',camera_preset='static' WHERE project_id=?").run(projectId)
    db.prepare("UPDATE projects SET title = ?, status = 'script', step = 2, updated_at = ? WHERE id = ?").run(title, Date.now(), projectId)
  })()
}

export interface SceneVisual {
  clipId: string
  visualPrompt: string
  characterNames: string[]
  cameraPreset: Clip['cameraPreset']
  motionStrength: Clip['motionStrength']
  videoPrompt: string
  transition: Clip['transition']
}

/**
 * Stores a visual plan for some scenes. Characters are matched by name: known ones keep their look and
 * sheet, new ones are added. Each updated scene remembers the story it was planned from.
 */
export function applyVisuals(projectId: string, characters: { name: string; description: string }[], scenes: SceneVisual[]): void {
  const db = getDb()
  db.transaction(() => {
    const existing = db.prepare('SELECT id, name FROM characters WHERE project_id = ? ORDER BY sort').all(projectId) as Row[]
    const byName = new Map<string, string>(existing.map((c) => [String(c.name).trim().toLowerCase(), c.id as string]))
    let sort = existing.length
    for (const c of characters) {
      const key = c.name.trim().toLowerCase()
      if (!key || byName.has(key)) continue
      const id = randomUUID()
      db.prepare('INSERT INTO characters (id, project_id, name, description, sort) VALUES (?, ?, ?, ?, ?)').run(
        id,
        projectId,
        c.name.trim(),
        c.description,
        sort++
      )
      byName.set(key, id)
    }
    const update = db.prepare(
      `UPDATE clips SET visual_prompt = @visualPrompt, visual_source = @visualSource, character_ids = @characterIds,
         camera_preset = @cameraPreset, motion_strength = @motionStrength, video_prompt = @videoPrompt, transition = @transition
       WHERE id = @clipId AND project_id = @projectId`
    )
    for (const v of scenes) {
      const clip = getClip(v.clipId)
      const ids = [...new Set(v.characterNames.map((n) => byName.get(n.trim().toLowerCase())).filter((x): x is string => !!x))]
      update.run({ ...v, ...(getProject(projectId).styleId==='cutout-facts'?{transition:'cut',cameraPreset:['static','zoomin'].includes(v.cameraPreset)?v.cameraPreset:'static'}:{}), projectId, visualSource: visualSourceOf(clip), characterIds: JSON.stringify(ids) })
    }
    db.prepare(
      "UPDATE projects SET status = CASE WHEN status IN ('draft', 'script') THEN 'storyboard' ELSE status END, step = 3, updated_at = ? WHERE id = ?"
    ).run(Date.now(), projectId)
  })()
}

// ---------- clips, characters, assets ----------

export function getClip(id: string): Clip {
  const r = getDb().prepare('SELECT * FROM clips WHERE id = ?').get(id) as Row | undefined
  if (!r) throw new Error('Klip tidak ditemukan')
  return toClip(r)
}

export function getCharacter(id: string): Character {
  const r = getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id) as Row | undefined
  if (!r) throw new Error('Pemeran tidak ditemukan')
  return toCharacter(r)
}

export function charactersOf(projectId: string): Character[] {
  return (getDb().prepare('SELECT * FROM characters WHERE project_id = ? ORDER BY sort').all(projectId) as Row[]).map(toCharacter)
}

export function clipsOf(projectId: string): Clip[] {
  return (getDb().prepare('SELECT * FROM clips WHERE project_id = ? ORDER BY sort').all(projectId) as Row[]).map(toClip)
}

const CLIP_COLS: Partial<Record<keyof Clip, string>> = {
  narration: 'narration',
  imageAssetId: 'image_asset_id',
  videoAssetId: 'video_asset_id',
  audioAssetId: 'audio_asset_id',
  durationMs: 'duration_ms',
  motionType: 'motion_type',
  cutout: 'cutout_json'
}

export function patchClip(id: string, patch: Partial<Clip>): void {
  const entries = Object.entries(patch).filter(([k, value]) => k in CLIP_COLS && (k !== 'cutout' || value !== undefined))
  if (!entries.length) return
  let projectId: string | null = null
  if (patch.cutout !== undefined) {
    // A replacement/clear must also be able to recover a malformed saved composition.
    const row = getDb().prepare('SELECT project_id FROM clips WHERE id = ?').get(id) as Row | undefined
    if (!row) throw new Error('Klip tidak ditemukan')
    projectId = row.project_id
  }
  const values = entries.map(([key, value]) => key === 'cutout' ? cutoutJson(projectCutout(value, projectId!,patch.durationMs??getClip(id).durationMs)) : value)
  const sets = entries.map(([k]) => `${CLIP_COLS[k as keyof Clip]} = ?`).join(', ')
  getDb()
    .prepare(`UPDATE clips SET ${sets} WHERE id = ?`)
    .run(...values, id)
}

export function setCharacterSheet(id: string, assetId: string | null): void {
  getDb().prepare('UPDATE characters SET sheet_asset_id = ? WHERE id = ?').run(assetId, id)
}

export function getAsset(id: string | null): Asset | null {
  if (!id) return null
  const r = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id) as Row | undefined
  return r ? toAsset(r) : null
}

export function insertAsset(a: {
  id?: string
  projectId: string
  clipId?: string | null
  characterId?: string | null
  kind: AssetKind
  provider?: string | null
  model?: string | null
  prompt?: string | null
  remoteId?: string | null
  remoteUrl?: string | null
  localPath: string
  durationMs?: number | null
  width?: number | null
  height?: number | null
  meta?: AssetMeta
}): Asset {
  const id = a.id ?? randomUUID()
  getDb()
    .prepare(
      `INSERT INTO assets (id, project_id, clip_id, character_id, kind, provider, model, prompt, remote_id, remote_url, local_path,
        duration_ms, width, height, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      a.projectId,
      a.clipId ?? null,
      a.characterId ?? null,
      a.kind,
      a.provider ?? null,
      a.model ?? null,
      a.prompt ?? null,
      a.remoteId ?? null,
      a.remoteUrl ?? null,
      a.localPath,
      a.durationMs ?? null,
      a.width ?? null,
      a.height ?? null,
      JSON.stringify(a.meta ?? {}),
      Date.now()
    )
  return getAsset(id)!
}

export function updateAssetMeta(id: string, meta: AssetMeta): void {
  getDb().prepare('UPDATE assets SET meta_json = ? WHERE id = ?').run(JSON.stringify(meta), id)
}

// ---------- jobs ----------

export function insertJob(j: {
  projectId: string
  clipId?: string | null
  characterId?: string | null
  kind: JobKind
  provider: string
  payload?: Record<string, unknown>
}): Job {
  const id = randomUUID()
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO jobs (id, project_id, clip_id, character_id, kind, provider, status, progress, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`
    )
    .run(id, j.projectId, j.clipId ?? null, j.characterId ?? null, j.kind, j.provider, JSON.stringify(j.payload ?? {}), now, now)
  return getJob(id)!
}

export function getJob(id: string): Job | null {
  const r = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined
  return r ? toJob(r) : null
}

export function getJobRaw(id: string): Row | undefined {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined
}

export function updateJob(
  id: string,
  patch: Partial<{ status: JobStatus; progress: number; message: string | null; error: string | null; remoteId: string; resultAssetId: string }>
): Job {
  const cols: Record<string, string> = {
    status: 'status',
    progress: 'progress',
    message: 'message',
    error: 'error',
    remoteId: 'remote_id',
    resultAssetId: 'result_asset_id'
  }
  const entries = Object.entries(patch).filter(([k]) => k in cols)
  const sets = [...entries.map(([k]) => `${cols[k]} = ?`), 'updated_at = ?'].join(', ')
  getDb()
    .prepare(`UPDATE jobs SET ${sets} WHERE id = ?`)
    .run(...entries.map(([, v]) => v), Date.now(), id)
  return getJob(id)!
}

export function unfinishedJobs(): Row[] {
  return getDb().prepare("SELECT * FROM jobs WHERE status IN ('queued','running')").all() as Row[]
}

/** A queued or running project-wide job of this kind, such as a narration take. */
export function activeProjectJob(projectId: string, kind: JobKind): Job | null {
  const r = getDb()
    .prepare("SELECT * FROM jobs WHERE project_id = ? AND kind = ? AND status IN ('queued','running') LIMIT 1")
    .get(projectId, kind) as Row | undefined
  return r ? toJob(r) : null
}

export function activeJobFor(target: { clipId?: string; characterId?: string }, kind: JobKind): Job | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM jobs WHERE kind = ? AND status IN ('queued','running') AND ${target.clipId ? 'clip_id' : 'character_id'} = ? LIMIT 1`
    )
    .get(kind, target.clipId ?? target.characterId) as Row | undefined
  return r ? toJob(r) : null
}
