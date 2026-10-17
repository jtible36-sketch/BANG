import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import type { HealthLibraryItem, HealthLibraryImport } from '@shared/health-library'
import type { Character } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { projectsRoot } from './paths'
import { charactersOf, getAsset, getBundle, getCharacter, getProject, insertAsset, setCharacterSheet, touchProject } from './repo'

interface CatalogItem extends Omit<HealthLibraryItem, 'previewUrl'> {
  path: string
  sha256: string
  width?: number
  height?: number
}

const previews = new Map<string, Buffer>()
let catalogCache: CatalogItem[] | undefined

function libraryDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'health-characters') : join(app.getAppPath(), 'resources', 'health-characters')
}

function catalog(): CatalogItem[] {
  if (catalogCache) return catalogCache
  const value = JSON.parse(readFileSync(join(libraryDir(), 'catalog.json'), 'utf8')) as CatalogItem[]
  if (!Array.isArray(value) || value.length !== 104) throw new Error('Pustaka karakter kesehatan belum lengkap.')
  const ids = new Set<string>()
  for (const row of value) {
    if (!/^(?:character-\d{1,3}|sheet-[1-4])$/.test(row.id) || ids.has(row.id) ||
      !/^(?:organ-terpisah|organ-tambahan|jaringan-sel|sheets)\/[0-9]{2,3}-[a-z0-9-]+\.png$/.test(row.path) ||
      !/^[a-f0-9]{64}$/.test(row.sha256) || typeof row.name !== 'string' || typeof row.description !== 'string' ||
      typeof row.group !== 'string' || !Array.isArray(row.tags) || !['master', 'sheet'].includes(row.kind)) {
      throw new Error('Data pustaka karakter kesehatan tidak valid.')
    }
    ids.add(row.id)
  }
  catalogCache = value
  return value
}

function itemOf(id: string): CatalogItem {
  const item = catalog().find((row) => row.id === id)
  if (!item) throw new Error('Karakter atau sheet kesehatan tidak ditemukan.')
  return item
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export function listHealthLibrary(): HealthLibraryItem[] {
  return catalog().map(({ path: _path, sha256: _sha, width: _width, height: _height, ...item }) => ({
    ...item, previewUrl: `studio://health-library/${item.id}`
  }))
}

/** The renderer can request catalog IDs only; source paths never cross IPC. */
export function readHealthLibraryImage(id: string): Buffer {
  const item = itemOf(id)
  const root = realpathSync(libraryDir())
  const path = realpathSync(join(root, item.path))
  if (!inside(root, path)) throw new Error('Lokasi karakter kesehatan tidak valid.')
  const file = statSync(path)
  if (!file.isFile() || file.size <= 0 || file.size > 32 * 1024 * 1024) throw new Error('File karakter kesehatan tidak valid.')
  const bytes = readFileSync(path)
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('File karakter kesehatan berubah dari master. Pasang ulang pustaka.')
  return bytes
}

/** Small gallery images avoid decoding 100 full-resolution masters in the renderer. */
export function readHealthLibraryPreview(id: string): Buffer {
  const cached = previews.get(id)
  if (cached) return cached
  const item = itemOf(id)
  const image = nativeImage.createFromBuffer(readHealthLibraryImage(id))
  if (image.isEmpty()) throw new Error('Pratinjau karakter tidak dapat dibaca.')
  const size = image.getSize()
  const edge = item.kind === 'sheet' ? 720 : 280
  const ratio = Math.min(1, edge / Math.max(size.width, size.height))
  const bytes = image.resize({ width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)), quality: 'better' }).toPNG()
  previews.set(id, bytes)
  return bytes
}

function masterDescription(item: CatalogItem): string {
  return `Karakter kesehatan: ${item.name}. ${item.description}\nMaster PNG kartun 2D dari pustaka. Pertahankan siluet, proporsi, warna, kontur dan posisi wajah. Satu wajah per unit karakter, termasuk organ berpasangan. Ekspresi, pandangan, pose dan gestur mengikuti narasi; jangan mendesain ulang anatomi. Gambar utuh ini belum merupakan rig.`
}

export function importHealthCharacter(projectId: string, itemId: string, characterId?: string): HealthLibraryImport {
  getProject(projectId)
  const item = itemOf(itemId)
  if (item.kind !== 'master') throw new Error('Sheet berisi beberapa tokoh adalah bank referensi. Pilih PNG karakter individual untuk pemeran.')
  if (characterId && getCharacter(characterId).projectId !== projectId) throw new Error('Pemeran berasal dari proyek lain.')
  const cast = charactersOf(projectId)
  if (!characterId) {
    const prior = cast.find((character) => getAsset(character.sheetAssetId)?.meta.healthLibraryId === itemId)
    if (prior) return { bundle: getBundle(projectId), characterId: prior.id }
    characterId = cast.find((character) => !character.sheetAssetId && character.name.trim().toLocaleLowerCase() === item.name.toLocaleLowerCase())?.id
  }
  const bytes = readHealthLibraryImage(itemId)
  const image = nativeImage.createFromBuffer(bytes)
  const size = image.getSize()
  if (image.isEmpty() || size.width !== item.width || size.height !== item.height) throw new Error('Ukuran master karakter tidak sesuai katalog.')
  const localPath = `images/${randomUUID()}.png`
  const root = realpathSync(projectsRoot())
  const owner = resolve(root, projectId)
  if (!inside(root, owner)) throw new Error('Lokasi proyek tidak valid.')
  if (existsSync(owner) && realpathSync(owner) !== owner) throw new Error('Lokasi proyek diarahkan ke folder lain.')
  const images = join(owner, 'images')
  if (existsSync(images) && realpathSync(images) !== images) throw new Error('Lokasi aset diarahkan ke folder lain.')
  mkdirSync(join(owner, 'images'), { recursive: true })
  if (realpathSync(dirname(join(owner, localPath))) !== join(owner, 'images')) throw new Error('Lokasi aset diarahkan ke folder lain.')
  const path = join(owner, localPath)
  const id = characterId ?? randomUUID()
  const old = characterId ? getCharacter(characterId) : null
  let name = item.name
  if (cast.some((c) => c.id !== id && c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    let index = 2
    while (cast.some((c) => c.id !== id && c.name.trim().toLocaleLowerCase() === `${item.name} ${index}`.toLocaleLowerCase())) index++
    name = `${item.name} ${index}`
  }
  writeFileSync(path, bytes, { flag: 'wx' })
  try {
    const asset = getDb().transaction(() => {
      const db = getDb()
      if (characterId) db.prepare('UPDATE characters SET name = ?, description = ? WHERE id = ? AND project_id = ?').run(name, masterDescription(item), id, projectId)
      else db.prepare('INSERT INTO characters (id, project_id, name, description, sort) VALUES (?, ?, ?, ?, ?)').run(id, projectId, name, masterDescription(item), Math.max(-1, ...cast.map((c) => c.sort)) + 1)
      const imported = insertAsset({ projectId, characterId: id, kind: 'image', provider: 'local', localPath,
        width: size.width, height: size.height, prompt: `Existing health character master: ${item.name}. ${item.description}`,
        meta: { source: 'library', healthLibraryId: itemId, masterSha256: item.sha256, rigReady: false, previousAssetId: old?.sheetAssetId ?? null } })
      setCharacterSheet(id, imported.id)
      touchProject(projectId)
      return imported
    })()
    emit.asset(asset)
    emit.character({ characterId: id, patch: { name, description: masterDescription(item), sheetAssetId: asset.id } })
    return { bundle: getBundle(projectId), characterId: id }
  } catch (error) {
    try { unlinkSync(path) } catch { /* Keep original error. */ }
    throw error
  }
}

/** Pose banks supplement selected masters; anatomy always comes from the individual PNG. */
export function healthExpressionReferences(projectId: string, cast: Character[]): { id: string; name: string; bytes: Buffer }[] {
  const ids = new Set<string>()
  for (const character of cast) {
    const asset = getAsset(character.sheetAssetId)
    if (!asset || asset.projectId !== projectId || asset.characterId !== character.id) continue
    const master = asset.meta.healthLibraryId
    if (typeof master !== 'string') continue
    if (['character-1', 'character-2', 'character-5'].includes(master)) ids.add('sheet-2')
    if (['character-3', 'character-4', 'character-6', 'character-20'].includes(master)) ids.add('sheet-3')
    if (['character-1', 'character-2', 'character-3', 'character-4', 'character-5', 'character-6', 'character-20'].includes(master)) ids.add('sheet-4')
  }
  return [...ids].map((id) => ({ id, name: itemOf(id).name, bytes: readHealthLibraryImage(id) }))
}

export async function exportHealthLibraryImage(itemId: string): Promise<string | null> {
  const item = itemOf(itemId)
  const bytes = readHealthLibraryImage(itemId)
  const options = { title: 'Simpan PNG karakter kesehatan', defaultPath: `${item.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')}.png`, filters: [{ name: 'Gambar PNG', extensions: ['png'] }] }
  const win = BrowserWindow.getFocusedWindow()
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  const path = result.filePath.toLowerCase().endsWith('.png') ? result.filePath : `${result.filePath}.png`
  if (!isAbsolute(path)) throw new Error('Lokasi penyimpanan tidak valid.')
  writeFileSync(path, bytes)
  return path
}
