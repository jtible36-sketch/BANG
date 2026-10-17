import { generateScript, generateStoryCharacters } from './story'
import { getSettings } from './settings'

const requests = new Map<string, AbortController>()

export async function composeStory(projectId: string, stage: 'script' | 'characters' = 'script') {
  const label = stage === 'characters' ? 'karakter' : 'naskah'
  if (requests.has(projectId)) throw new Error('Naskah atau karakter proyek ini sedang disusun. Batalkan atau tunggu sampai selesai.')
  const controller = new AbortController()
  const seconds = getSettings().storyTimeoutSec
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(seconds * 1000)])
  requests.set(projectId, controller)
  try { return await (stage === 'characters' ? generateStoryCharacters(projectId, signal) : generateScript(projectId, signal)) }
  catch (error) {
    if (signal.aborted) throw new Error(controller.signal.aborted ? `Penyusunan ${label} dibatalkan. Hasil sebelumnya tetap tersimpan.`
      : `Penyusunan ${label} melewati ${seconds} detik. Proses dihentikan; hasil sebelumnya tetap tersimpan. Pilih model lain atau tambah batas waktu di Pengaturan.`)
    throw error
  } finally { requests.delete(projectId) }
}

export function cancelStory(projectId: string): void { requests.get(projectId)?.abort() }
