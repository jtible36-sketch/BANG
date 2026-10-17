import { generateScript } from './story'
import { getSettings } from './settings'

const requests = new Map<string, AbortController>()

export async function composeStory(projectId: string) {
  if (requests.has(projectId)) throw new Error('Naskah proyek ini sedang disusun. Batalkan atau tunggu sampai selesai.')
  const controller = new AbortController()
  const seconds = getSettings().storyTimeoutSec
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(seconds * 1000)])
  requests.set(projectId, controller)
  try { return await generateScript(projectId, signal) }
  catch (error) {
    if (signal.aborted) throw new Error(controller.signal.aborted ? 'Penyusunan naskah dibatalkan. Naskah sebelumnya tetap tersimpan.'
      : `Penyusunan naskah melewati ${seconds} detik. Proses dihentikan; naskah sebelumnya tetap tersimpan. Pilih model lain atau tambah batas waktu di Pengaturan.`)
    throw error
  } finally { requests.delete(projectId) }
}

export function cancelStory(projectId: string): void { requests.get(projectId)?.abort() }
