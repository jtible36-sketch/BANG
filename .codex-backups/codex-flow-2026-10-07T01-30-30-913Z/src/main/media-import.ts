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

interface DecodedImage {
  bytes: Buffer
  width: number
  height: number
}

interface ImageOrigin {
  provider: 'local' | 'codex'
  source: 'imported' | 'generated'
  filename?: string
  prompt?: string
}

function decodeImage(bytes: Uint8Array | Buffer): DecodedImage {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error('Gambar hasil Codex kosong atau tidak valid')
  const decoded = nativeImage.createFromBuffer(Buffer.from(bytes))
  const size = decoded.getSize()
  if (decoded.isEmpty() || size.width <= 0 || size.height <= 0) {
    throw new Error('Gambar tidak bisa dibaca. Pakai file PNG, JPG, atau WebP yang valid.')
  }
  // Persist decoded PNG bytes so the managed file's format is known and Flow can use it directly.
  return { bytes: decoded.toPNG(), width: size.width, height: size.height }
}

function readImage(path: string): DecodedImage {
  checkFile(path, IMAGE_EXTENSIONS, 'gambar')
  return decodeImage(readFileSync(path))
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

function persistClipImage(clipId: string, image: DecodedImage, origin: ImageOrigin): Asset {
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const file = writeImage(project.id, image.bytes)
  let asset: Asset
  const patch: Partial<Clip> = {}
  try {
    asset = getDb().transaction(() => {
      const current = getClip(clipId)
      if (current.projectId !== project.id) throw new Error('Adegan sudah berpindah proyek')
      const currentProject = getProject(project.id)
      const imported = insertAsset({
        projectId: project.id,
        clipId,
        kind: 'image',
        provider: origin.provider,
        prompt: origin.prompt ?? buildCodexImagePrompt(currentProject, current, charactersOf(project.id)),
        localPath: file.localPath,
        width: image.width,
        height: image.height,
        meta: {
          source: origin.source,
          workflow: 'codex-flow',
          ...(origin.filename ? { filename: origin.filename } : {}),
          previousAssetId: current.imageAssetId
        }
      })
      patch.imageAssetId = imported.id
      patchClip(clipId, patch)
      const first = clipsOf(project.id)[0]
      touchProject(project.id, !currentProject.coverAssetId || first?.id === clipId ? { coverAssetId: imported.id } : {})
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

function persistCharacterImage(characterId: string, image: DecodedImage, origin: ImageOrigin): Asset {
  const character = getCharacter(characterId)
  const project = getProject(character.projectId)
  const file = writeImage(project.id, image.bytes)
  let asset: Asset
  try {
    asset = getDb().transaction(() => {
      const current = getCharacter(characterId)
      if (current.projectId !== project.id) throw new Error('Karakter sudah berpindah proyek')
      const previous = getAsset(current.sheetAssetId)
      const imported = insertAsset({
        projectId: project.id,
        characterId,
        kind: 'image',
        provider: origin.provider,
        prompt: origin.prompt ?? buildCodexCharacterPrompt(getProject(project.id), current),
        localPath: file.localPath,
        width: image.width,
        height: image.height,
        meta: {
          source: origin.source,
          workflow: 'codex-flow',
          ...(origin.filename ? { filename: origin.filename } : {}),
          ...(origin.source === 'generated' && typeof previous?.meta.healthLibraryId === 'string' ? {
            healthLibraryId: previous.meta.healthLibraryId,
            masterSha256: previous.meta.masterSha256,
            rigReady: false
          } : {}),
          previousAssetId: current.sheetAssetId
        }
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

export async function pickClipImage(clipId: string): Promise<Asset | null> {
  getClip(clipId)
  const source = await pickFile({
    title: 'Impor gambar hasil Codex',
    filters: [{ name: 'Gambar', extensions: IMAGE_EXTENSIONS }],
    properties: ['openFile']
  })
  if (!source) return null
  return persistClipImage(clipId, readImage(source), { provider: 'local', source: 'imported', filename: basename(source) })
}

export async function pickCharacterSheet(characterId: string): Promise<Asset | null> {
  getCharacter(characterId)
  const source = await pickFile({
    title: 'Impor lembar karakter hasil Codex',
    filters: [{ name: 'Gambar', extensions: IMAGE_EXTENSIONS }],
    properties: ['openFile']
  })
  if (!source) return null
  return persistCharacterImage(characterId, readImage(source), { provider: 'local', source: 'imported', filename: basename(source) })
}

/** Adopts authenticated local Codex output without a file dialog or an API credential. */
export async function persistGeneratedClipImage(clipId: string, bytes: Uint8Array | Buffer, prompt?: string): Promise<Asset> {
  return persistClipImage(clipId, decodeImage(bytes), { provider: 'codex', source: 'generated', prompt })
}

export async function persistGeneratedCharacterSheet(characterId: string, bytes: Uint8Array | Buffer, prompt?: string): Promise<Asset> {
  return persistCharacterImage(characterId, decodeImage(bytes), { provider: 'codex', source: 'generated', prompt })
}

/** Returns a validated PNG reference from this project's managed assets only. */
export function readManagedImageBytes(assetId: string, projectId: string): Buffer {
  const asset = getAsset(assetId)
  if (!asset || asset.kind !== 'image') throw new Error('Referensi karakter harus berupa aset gambar')
  if (asset.projectId !== projectId) throw new Error('Referensi gambar berasal dari proyek lain')
  getProject(projectId)
  const path = managedPath(projectId, asset.localPath)
  if (!statSync(path).isFile()) throw new Error('File referensi gambar tidak valid')
  return decodeImage(readFileSync(path)).bytes
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
    // Let both ffmpeg readers close before a validation error can remove the copied file on Windows.
    const [durationResult, sizeResult] = await Promise.allSettled([probeDurationMs(path), probeSize(path)])
    if (durationResult.status === 'rejected') throw durationResult.reason
    if (sizeResult.status === 'rejected') throw sizeResult.reason
    const durationMs = durationResult.value
    const size = sizeResult.value
    if (!Number.isFinite(durationMs) || durationMs <= 0 || !size || size.width <= 0 || size.height <= 0) {
      throw new Error('Video tidak bisa dibaca. Pilih file video hasil Flow yang valid.')
    }
    // Recheck after probing in case the scene was removed while ffmpeg was running.
    const current = getClip(clipId)
    if (current.projectId !== project.id) throw new Error('Adegan sudah berpindah proyek')
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
  const bytes = readManagedImageBytes(assetId, asset.projectId)
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
  writeFileSync(result.filePath, bytes)
  return result.filePath
}
