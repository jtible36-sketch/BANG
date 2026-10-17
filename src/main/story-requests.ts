import { generateScript, generateStoryCharacters, generateVisuals } from './story'
import { getSettings } from './settings'
import { draftVisualNarration } from './visual-narration'

const requests = new Map<string, AbortController>()

export async function composeStory(projectId: string, stage: 'script' | 'characters' | 'visuals' = 'script', mode: 'missing' | 'all' = 'missing') {
  const label = stage === 'visuals' ? 'visual' : stage === 'characters' ? 'karakter' : 'naskah'
  if (requests.has(projectId)) throw new Error('Naskah, karakter, atau visual proyek ini sedang disusun. Batalkan atau tunggu sampai selesai.')
  const controller = new AbortController()
  const settings = getSettings()
  const seconds = stage === 'visuals' ? settings.visualTimeoutSec : settings.storyTimeoutSec
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(seconds * 1000)])
  requests.set(projectId, controller)
  try { return await (stage === 'visuals' ? generateVisuals(projectId, mode, signal) : stage === 'characters' ? generateStoryCharacters(projectId, signal) : generateScript(projectId, signal)) }
  catch (error) {
    if (signal.aborted) throw new Error(controller.signal.aborted ? `Penyusunan ${label} dibatalkan. Hasil sebelumnya tetap tersimpan.`
      : `Penyusunan ${label} melewati ${seconds} detik. Proses dihentikan; hasil sebelumnya tetap tersimpan. Pilih model lain atau tambah batas waktu di Pengaturan.`)
    throw error
  } finally { requests.delete(projectId) }
}

export async function composeVisualNarration(projectId: string) {
  if (requests.has(projectId)) throw new Error('Proyek sedang disusun. Tunggu atau batalkan proses sebelumnya.')
  const controller = new AbortController(), seconds = getSettings().visualTimeoutSec
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(seconds * 1000)])
  requests.set(projectId, controller)
  try { return await draftVisualNarration(projectId, signal) }
  catch (error) {
    if (signal.aborted) throw new Error(controller.signal.aborted ? 'Penyusunan narasi dibatalkan. Teks sebelumnya tetap tersimpan.' : 'Penyusunan narasi visual melewati batas waktu. Teks sebelumnya tetap tersimpan.')
    throw error
  } finally { requests.delete(projectId) }
}

export function cancelStory(projectId: string): void { requests.get(projectId)?.abort() }
