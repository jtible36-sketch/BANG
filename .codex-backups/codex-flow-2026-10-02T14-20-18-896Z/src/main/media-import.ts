import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { app, BrowserWindow, dialog, nativeImage, type OpenDialogOptions } from 'electron'
import { buildCodexCharacterPrompt, buildCodexImagePrompt, buildFlowVideoPrompt } from '@shared/external-prompts'
import type { Asset, Clip } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { projectsRoot } from './paths'
import { charactersOf, clipsOf, getAsset, getCharacter, getClip, getProject, insertAsset, patchClip, setCharacterSheet, touchProject } from './repo'
import { probeDurationMs, probeSize } from './services/audio'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'm4v']

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/** Only managed project paths may be read or written through asset IDs. */
function managedPath(projectId: string, localPath: string): string {
  const root = resolve(projectsRoot())
  const project = resolve(root, projectId)
  const target = resolve(project, localPath)
  if (!isInside(root, project) || !isInside(project, target)) throw new Error('Lokasi aset tidak valid')
  // Existing directory junctions must not redirect managed assets into another project or outside the asset root.
  let existing = target
  while (!existsSync(existing)) existing = dirname(existing)
  const expectedProject = resolve(realpathSync(root), relative(root, project))
  const actual = realpathSync(existing)
  if (relative(root, existing) !== '' && relative(expectedProject, actual) !== '' && !isInside(expectedProject, actual)) {
    throw new Error('Lokasi aset tidak valid')
  }
  return target
}

async function pickFile(options: OpenDialogOptions): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0] ?? null
}

function checkFile(path: string, extensions: string[], label: string): void {
  if (!isAbsolute(path) || !extensions.includes(extname(path).slice(1).toLowerCase())) {
    throw new Error(`Format ${label} tidak didukung`)
  }
  const file = statSync(path)
  if (!file.isFile() || file.size === 0) throw new Error(`File ${label} kosong atau tidak bisa dibaca`)
}

function readImage(path: string): { bytes: Buffer; width: number; height: number } {
  checkFile(path, IMAGE_EXTENSIONS, 'gambar')
  const decoded = nativeImage.createFromBuffer(readFileSync(path))
  const size = decoded.getSize()
  if (decoded.isEmpty() || size.width <= 0 || size.height <= 0) {
    throw new Error('Gambar tidak bisa dibaca. Pakai file PNG, JPG, atau WebP yang valid.')
  }
  // Persist decoded PNG bytes so the managed file's format is known and Flow can use it directly.
  return { bytes: decoded.toPNG(), width: size.width, height: size.height }
}

function writeImage(projectId: string, bytes: Buffer): { localPath: string; path: string } {
  const localPath = `images/${randomUUID()}.png`
  const path = managedPath(projectId, localPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
  return { localPath, path }
}

function cleanFailedImport(path: string): void {
  try { unlinkSync(path) } catch { /* Keep the original validation or persistence error. */ }
}

export async function pickClipImage(clipId: string): Promise<Asset | null> {
  getClip(clipId)
  const source = await pickFile({
    title: 'Impor gambar hasil Codex',
    filters: [{ name: 'Gambar', extensions: IMAGE_EXTENSIONS }],
    properties: ['openFile']
  })
  if (!source) return null
  const image = readImage(source)
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const prompt = buildCodexImagePrompt(project, clip, charactersOf(project.id))
  const file = writeImage(project.id, image.bytes)
  let asset: Asset
  const patch: Partial<Clip> = {}
  try {
    asset = getDb().transaction(() => {
      const imported = insertAsset({
        projectId: project.id,
        clipId,
        kind: 'image',
        provider: 'local',
        prompt,
        localPath: file.localPath,
        width: image.width,
        height: image.height,
        meta: { source: 'imported', workflow: 'codex-flow', filename: basename(source), previousAssetId: clip.imageAssetId }
      })
      patch.imageAssetId = imported.id
      patchClip(clipId, patch)
      const first = clipsOf(project.id)[0]
      touchProject(project.id, !project.coverAssetId || first?.id === clipId ? { coverAssetId: imported.id } : {})
      return imported
    })()
  } catch (error) {
    cleanFailedImport(file.path)
    throw error
  }
  emit.asset(asset)
  emit.clip({ clipId, patch })
  return asset
}

export async function pickCharacterSheet(characterId: string): Promise<Asset | null> {
  getCharacter(characterId)
  const source = await pickFile({
    title: 'Impor lembar karakter hasil Codex',
    filters: [{ name: 'Gambar', extensions: IMAGE_EXTENSIONS }],
    properties: ['openFile']
  })
  if (!source) return null
  const image = readImage(source)
  const character = getCharacter(characterId)
  const project = getProject(character.projectId)
  const prompt = buildCodexCharacterPrompt(project, character)
  const file = writeImage(project.id, image.bytes)
  let asset: Asset
  try {
    asset = getDb().transaction(() => {
      const imported = insertAsset({
        projectId: project.id,
        characterId,
        kind: 'image',
        provider: 'local',
        prompt,
        localPath: file.localPath,
        width: image.width,
        height: image.height,
        meta: { source: 'imported', workflow: 'codex-flow', filename: basename(source), previousAssetId: character.sheetAssetId }
      })
      setCharacterSheet(characterId, imported.id)
      touchProject(project.id)
      return imported
    })()
  } catch (error) {
    cleanFailedImport(file.path)
    throw error
  }
  emit.asset(asset)
  emit.character({ characterId, patch: { sheetAssetId: asset.id } })
  return asset
}

export async function pickClipVideo(clipId: string): Promise<Asset | null> {
  getClip(clipId)
  const source = await pickFile({
    title: 'Impor video hasil Flow',
    filters: [{ name: 'Video', extensions: VIDEO_EXTENSIONS }],
    properties: ['openFile']
  })
  if (!source) return null
  checkFile(source, VIDEO_EXTENSIONS, 'video')
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const localPath = `videos/${randomUUID()}${extname(source).toLowerCase()}`
  const path = managedPath(project.id, localPath)
  mkdirSync(dirname(path), { recursive: true })
  let asset: Asset
  const patch: Partial<Clip> = { motionType: 'video' }
  try {
    copyFileSync(source, path)
    const [durationMs, size] = await Promise.all([probeDurationMs(path), probeSize(path)])
    if (!Number.isFinite(durationMs) || durationMs <= 0 || !size || size.width <= 0 || size.height <= 0) {
      throw new Error('Video tidak bisa dibaca. Pilih file video hasil Flow yang valid.')
    }
    // Recheck after probing in case the scene was removed while ffmpeg was running.
    const current = getClip(clipId)
    asset = getDb().transaction(() => {
      const imported = insertAsset({
        projectId: project.id,
        clipId,
        kind: 'video',
        provider: 'local',
        prompt: buildFlowVideoPrompt(getProject(project.id), current),
        localPath,
        durationMs,
        width: size.width,
        height: size.height,
        meta: { source: 'imported', workflow: 'codex-flow', filename: basename(source), previousAssetId: current.videoAssetId }
      })
      patch.videoAssetId = imported.id
      // The timeline remains timed to narration; the renderer/exporter fits the imported video to it.
      patchClip(clipId, patch)
      touchProject(project.id)
      return imported
    })()
  } catch (error) {
    cleanFailedImport(path)
    throw error
  }
  emit.asset(asset)
  emit.clip({ clipId, patch })
  return asset
}

export async function exportImage(assetId: string): Promise<string | null> {
  const asset = getAsset(assetId)
  if (!asset || asset.kind !== 'image') throw new Error('Pilih aset gambar untuk digunakan di Flow')
  const project = getProject(asset.projectId)
  const source = managedPath(asset.projectId, asset.localPath)
  const projectRoot = resolve(projectsRoot(), asset.projectId)
  if (!isInside(realpathSync(projectRoot), realpathSync(source))) throw new Error('Lokasi aset tidak valid')
  const decoded = nativeImage.createFromBuffer(readFileSync(source))
  if (decoded.isEmpty()) throw new Error('Gambar tersimpan tidak bisa dibaca')
  const name = project.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim() || 'Bang Story'
  const options = {
    title: 'Simpan gambar untuk Flow',
    defaultPath: resolve(app.getPath('pictures'), `${name}-${asset.id.slice(0, 8)}.png`),
    filters: [{ name: 'Gambar PNG', extensions: ['png'] }]
  }
  const win = BrowserWindow.getFocusedWindow()
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  if (!isAbsolute(result.filePath)) throw new Error('Lokasi ekspor tidak valid')
  if (extname(result.filePath).toLowerCase() !== '.png') throw new Error('Simpan gambar dengan nama berakhiran .png')
  // Use exactly the path reviewed by the save dialog, including its overwrite confirmation.
  writeFileSync(result.filePath, decoded.toPNG())
  return result.filePath
}
