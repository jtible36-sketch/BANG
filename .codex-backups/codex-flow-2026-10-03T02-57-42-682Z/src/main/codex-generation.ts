import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { buildCodexCharacterPrompt, buildCodexImagePrompt } from '@shared/external-prompts'
import type { Job } from '@shared/types'
import { runJob } from './jobs'
import { persistGeneratedCharacterSheet, persistGeneratedClipImage, readManagedImageBytes } from './media-import'
import { generatePNG } from './providers/codex'
import { activeJobFor, charactersOf, getCharacter, getClip, getProject, insertJob } from './repo'
import { getSettings } from './settings'

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
  const job = insertJob({ projectId: clip.projectId, clipId, kind: 'image', provider: 'codex' })
  return runJob(job, 'codex', async (ctx) => {
    ctx.signal.throwIfAborted()
    const fresh = getClip(clipId)
    const project = getProject(fresh.projectId)
    const cast = charactersOf(project.id).filter((character) => fresh.characterIds.includes(character.id))
    const workspace = newWorkspace()
    try {
      const referencePaths: string[] = []
      for (const character of cast) {
        if (!character.sheetAssetId) continue
        const bytes = readManagedImageBytes(character.sheetAssetId, project.id)
        const path = join(workspace.path, `reference-${referencePaths.length + 1}.png`)
        writeFileSync(path, bytes)
        referencePaths.push(path)
      }
      const prompt = buildCodexImagePrompt(project, fresh, cast)
      const image = await generatePNG({
        prompt,
        referencePaths,
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
  const job = insertJob({ projectId: character.projectId, characterId, kind: 'sheet', provider: 'codex' })
  return runJob(job, 'codex', async (ctx) => {
    ctx.signal.throwIfAborted()
    const fresh = getCharacter(characterId)
    const project = getProject(fresh.projectId)
    const workspace = newWorkspace()
    try {
      const prompt = buildCodexCharacterPrompt(project, fresh)
      const image = await generatePNG({
        prompt,
        outputDirectory: workspace.path,
        signal: ctx.signal,
        onProgress: (progress, message) => ctx.progress(progress, message)
      })
      ctx.signal.throwIfAborted()
      ctx.progress(0.97, 'Menyimpan lembar karakter…')
      return (await persistGeneratedCharacterSheet(characterId, image.bytes, prompt)).id
    } finally {
      workspace.cleanup()
    }
  })
}
