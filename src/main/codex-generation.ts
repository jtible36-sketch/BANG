import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { buildCodexCharacterPrompt, buildCodexImagePrompt, mapClipImageEligible } from '@shared/external-prompts'
import { isMapMaster, isVoxMaster, resolveMasterPrompt } from '@shared/master-prompts'
import type { Character, Clip, Job, Project } from '@shared/types'
import { runJob } from './jobs'
import { persistGeneratedCharacterSheet, persistGeneratedClipImage, readManagedImageBytes } from './media-import'
import { generatePNG } from './providers/codex'
import { activeJobFor, charactersOf, clipsOf, getCharacter, getClip, getProject, insertJob } from './repo'
import { getSettings } from './settings'
import { healthExpressionReferences } from './health-library'
import { getDb } from './db'
import { requireCodexConnection, withCodexConnection } from './codex-connections'
import { assertMapOpeningImage } from './map-continuity'

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

function copyReferences(project: Project, cast: Character[], workspace: string): { paths: string[]; direction: string } {
  const masters = cast.filter((character) => character.sheetAssetId)
  if (masters.length > 8) throw new Error('Codex menerima maksimal delapan referensi karakter per adegan. Kurangi pemeran pada adegan ini.')
  const paths: string[] = []
  const descriptions: string[] = []
  for (const character of masters) {
    const path = join(workspace, `reference-${paths.length + 1}.png`)
    writeFileSync(path, readManagedImageBytes(character.sheetAssetId!, project.id))
    paths.push(path)
    descriptions.push(`${basename(path)}: identity master for ${character.name}. Preserve this character's anatomy, silhouette, palette and face.`)
  }
  if (project.skillId === 'explainer-animasi-kesehatan' && !isVoxMaster(project) && paths.length < 8) {
    for (const bank of healthExpressionReferences(project.id, masters).slice(0, 8 - paths.length)) {
      const path = join(workspace, `pose-bank-${bank.id}.png`)
      writeFileSync(path, bank.bytes)
      paths.push(path)
      descriptions.push(`${basename(path)}: supplemental expression/gesture bank (${bank.name}), not an identity master. Use only the selected characters and the pose appropriate to this narration. Do not copy the sheet layout, its background, unselected characters, old combined intestines or old liver/gallbladder details; individual master anatomy takes priority.`)
    }
  }
  return { paths, direction: descriptions.length ? `Attached PNG references:\n${descriptions.join('\n')}` : '' }
}

function requireCodexWorkflow(): void {
  requireCodexConnection('image')
  if (getSettings().visualWorkflow !== 'codex-flow') {
    throw new Error('Pilih alur Codex + Flow di Pengaturan untuk memakai akun Codex lokal.')
  }
}

function newWorkspace(): { path: string; cleanup: () => void } {
  const root = realpathSync(tmpdir())
  const path = mkdtempSync(join(root, 'bang-story-codex-'))
  const actual = realpathSync(path)
  return {
    path,
    cleanup: () => {
      // Remove only the exact private directory created for this job, never project assets.
      try {
        if (dirname(actual) === root && basename(actual).startsWith('bang-story-codex-') && realpathSync(path) === actual) {
          rmSync(path, { recursive: true, force: true })
        }
      } catch { /* A cleanup failure must not replace the generation result or error. */ }
    }
  }
}

export function generateCodexClipImage(clipId: string): Job {
  requireCodexWorkflow()
  const clip = getClip(clipId)
  const existing = activeJobFor({ clipId }, 'image')
  if (existing) return existing
  const project = getProject(clip.projectId)
  assertMapOpeningImage(project, clip)
  const mapState = isMapMaster(project) ? mapOpeningImageState(project, clip) : null
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'codex' })
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify({ masterPrompt: project.masterPrompt }), job.id)
  return runJob(job, 'codex', async (ctx) => withCodexConnection('image', async (signal) => {
    ctx.signal.throwIfAborted()
    const fresh = getClip(clipId)
    assertMapImageUnchanged(clipId, mapState)
    assertMapOpeningImage(project, fresh)
    const cast = isMapMaster(project) ? [] : charactersOf(project.id).filter((character) => fresh.characterIds.includes(character.id))
    const workspace = newWorkspace()
    try {
      const references = copyReferences(project, cast, workspace.path)
      const prompt = [buildCodexImagePrompt(project, fresh, cast), references.direction].filter(Boolean).join('\n\n')
      const image = await generatePNG({
        prompt,
        referencePaths: references.paths,
        outputDirectory: workspace.path,
        signal,
        onProgress: (progress, message) => ctx.progress(progress, message)
      })
      signal.throwIfAborted()
      assertMapImageUnchanged(clipId, mapState)
      ctx.progress(0.97, 'Menyimpan gambar ke adegan…')
      return (await persistGeneratedClipImage(clipId, image.bytes, prompt)).id
    } finally {
      workspace.cleanup()
    }
  }, ctx.signal))
}

export function generateCodexCharacterSheet(characterId: string): Job {
  requireCodexWorkflow()
  const character = getCharacter(characterId)
  const existing = activeJobFor({ characterId }, 'sheet')
  if (existing) return existing
  const project = getProject(character.projectId)
  if (isMapMaster(project)) throw new Error('Map Animation memakai peta dan ikon; character sheet tidak diperlukan.')
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: character.projectId, characterId, kind: 'sheet', provider: 'codex' })
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify({ masterPrompt: project.masterPrompt }), job.id)
  return runJob(job, 'codex', async (ctx) => withCodexConnection('image', async (signal) => {
    ctx.signal.throwIfAborted()
    const fresh = getCharacter(characterId)
    const workspace = newWorkspace()
    try {
      const references = copyReferences(project, [fresh], workspace.path)
      const prompt = [buildCodexCharacterPrompt(project, fresh), references.direction].filter(Boolean).join('\n\n')
      const image = await generatePNG({
        prompt,
        referencePaths: references.paths,
        outputDirectory: workspace.path,
        signal,
        onProgress: (progress, message) => ctx.progress(progress, message)
      })
      signal.throwIfAborted()
      if (getCharacter(characterId).sheetAssetId !== fresh.sheetAssetId) throw new Error('Referensi karakter berubah saat generate berjalan. Gambar pilihan terbaru tetap tersimpan; generate ulang untuk memakai referensi tersebut.')
      ctx.progress(0.97, 'Menyimpan lembar karakter…')
      return (await persistGeneratedCharacterSheet(characterId, image.bytes, prompt)).id
    } finally {
      workspace.cleanup()
    }
  }, ctx.signal))
}

/** Queue unfinished scenes once; existing images and active jobs are preserved. */
export function generateMissingCodexImages(projectId: string): Job[] {
  requireCodexWorkflow()
  const project = getProject(projectId)
  const ordered = clipsOf(projectId)
  const scenes = ordered.filter((clip, index) => (!isMapMaster(project) || index === 0 && mapClipImageEligible(project, clip)) && !clip.imageAssetId && !activeJobFor({ clipId: clip.id }, 'image'))
  return scenes.map((clip) => generateCodexClipImage(clip.id))
}
