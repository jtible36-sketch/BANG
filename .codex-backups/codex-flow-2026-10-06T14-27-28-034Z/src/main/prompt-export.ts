import { writeFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { isVoxStyle, voxBulkImagePrompts } from '@shared/vox'
import { getBundle } from './repo'

export async function exportImagePrompts(projectId: string): Promise<string | null> {
  const { project, clips, characters } = getBundle(projectId)
  if (!isVoxStyle(project.styleId)) throw new Error('Ekspor ini untuk gaya VOX · Kolase dokumenter.')
  if (!clips.length || clips.some((clip) => !clip.visualPrompt.trim())) {
    throw new Error('Buat visual semua beat dulu sebelum mengekspor prompt gambar.')
  }
  const filename = project.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 100) || 'Bang Story'
  const options = {
    title: 'Simpan prompt gambar VOX',
    defaultPath: join(app.getPath('documents'), `${filename}-VOX-prompts.txt`),
    filters: [{ name: 'Prompt gambar TXT', extensions: ['txt'] }]
  }
  const win = BrowserWindow.getFocusedWindow()
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  if (!isAbsolute(result.filePath) || extname(result.filePath).toLowerCase() !== '.txt') {
    throw new Error('Simpan prompt dengan nama berakhiran .txt.')
  }
  writeFileSync(result.filePath, voxBulkImagePrompts(project, clips, characters), 'utf8')
  return result.filePath
}
