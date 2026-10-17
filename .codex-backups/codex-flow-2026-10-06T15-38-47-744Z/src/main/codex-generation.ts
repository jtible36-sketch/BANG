import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { buildCodexCharacterPrompt, buildCodexImagePrompt } from '@shared/external-prompts'
import { isVoxMaster, resolveMasterPrompt } from '@shared/master-prompts'
import type { Character, Job, Project } from '@shared/types'
import { runJob } from './jobs'
import { persistGeneratedCharacterSheet, persistGeneratedClipImage, readManagedImageBytes } from './media-import'
import { generatePNG } from './providers/codex'
import { activeJobFor, charactersOf, getCharacter, getClip, getProject, insertJob } from './repo'
import { getSettings } from './settings'
import { healthExpressionReferences } from './health-library'
import { getDb } from './db'

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
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'codex' })
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify({ masterPrompt: project.masterPrompt }), job.id)
  return runJob(job, 'codex', async (ctx) => {
    ctx.signal.throwIfAborted()
    const fresh = getClip(clipId)
    const cast = charactersOf(project.id).filter((character) => fresh.characterIds.includes(character.id))
    const workspace = newWorkspace()
    try {
      const references = copyReferences(project, cast, workspace.path)
      const prompt = [buildCodexImagePrompt(project, fresh, cast), references.direction].filter(Boolean).join('\n\n')
      const image = await generatePNG({
        prompt,
        referencePaths: references.paths,
        outputDirectory: workspace.path,
        signal: ctx.signal,
        onProgress: (progress, message) => ctx.progress(progress, message)
      })
      ctx.signal.throwIfAborted()
      ctx.progress(0.97, 'Menyimpan gambar ke adegan…')
      return (await persistGeneratedClipImage(clipId, image.bytes, prompt)).id
    } finally {
      workspace.cleanup()
    }
  })
}

export function generateCodexCharacterSheet(characterId: string): Job {
  requireCodexWorkflow()
  const character = getCharacter(characterId)
  const existing = activeJobFor({ characterId }, 'sheet')
  if (existing) return existing
  const project = getProject(character.projectId)
  project.masterPrompt = resolveMasterPrompt(project)
  const job = insertJob({ projectId: character.projectId, characterId, kind: 'sheet', provider: 'codex' })
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify({ masterPrompt: project.masterPrompt }), job.id)
  return runJob(job, 'codex', async (ctx) => {
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
        signal: ctx.signal,
        onProgress: (progress, message) => ctx.progress(progress, message)
      })
      ctx.signal.throwIfAborted()
      if (getCharacter(characterId).sheetAssetId !== fresh.sheetAssetId) throw new Error('Referensi karakter berubah saat generate berjalan. Gambar pilihan terbaru tetap tersimpan; generate ulang untuk memakai referensi tersebut.')
      ctx.progress(0.97, 'Menyimpan lembar karakter…')
      return (await persistGeneratedCharacterSheet(characterId, image.bytes, prompt)).id
    } finally {
      workspace.cleanup()
    }
  })
}
