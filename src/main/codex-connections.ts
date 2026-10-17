import type { CodexChannel, CodexStatus, AppSettings } from '@shared/types'
import { getSettings, setSettings } from './settings'
import { readCodexStatus } from './providers/codex'
import { getDb } from './db'
import { cancelJob } from './jobs'

const active = new Map<CodexChannel, Set<AbortController>>()
const labels = { story: 'penyusun cerita', visual: 'penyusun visual', image: 'gambar', video: 'prompt video' }

export function requireCodexConnection(channel: CodexChannel): void {
  if (!getSettings().codexConnections[channel]) throw new Error(`Koneksi Codex untuk ${labels[channel]} diputus. Hubungkan kembali di Pengaturan.`)
}

export async function codexConnectionStatus(): Promise<CodexStatus> {
  return { ...await readCodexStatus(), connections: getSettings().codexConnections }
}

export async function setCodexConnection(channel: CodexChannel, enabled: boolean): Promise<AppSettings> {
  if (!Object.hasOwn(labels, channel) || typeof enabled !== 'boolean') throw new Error('Pilihan koneksi Codex tidak valid.')
  if (enabled) {
    const status = await readCodexStatus()
    if (!status.available || !status.authenticated || (channel === 'image' && !status.imageGeneration)) throw new Error(status.message)
  }
  const settings = setSettings({ codexConnections: { ...getSettings().codexConnections, [channel]: enabled } })
  if (!enabled) for (const controller of active.get(channel) ?? []) controller.abort()
  if (!enabled && channel === 'image') {
    const jobs = getDb().prepare("SELECT id FROM jobs WHERE provider = 'codex' AND kind IN ('image', 'sheet') AND status IN ('queued', 'running')").all() as { id: string }[]
    await Promise.all(jobs.map((job) => cancelJob(job.id)))
  }
  return settings
}

/** Channel switches stop only Bang Story requests; they never log the account out. */
export async function withCodexConnection<T>(channel: CodexChannel, task: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  requireCodexConnection(channel)
  const controller = new AbortController()
  const requests = active.get(channel) ?? new Set<AbortController>()
  active.set(channel, requests)
  requests.add(controller)
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  try { combined.throwIfAborted(); return await task(combined) }
  catch (error) {
    if (combined.aborted && !signal?.aborted) {
      const canceled = new Error(`Koneksi Codex untuk ${labels[channel]} diputus. Permintaan dihentikan.`)
      canceled.name = 'AbortError'
      throw canceled
    }
    throw error
  }
  finally { requests.delete(controller); if (!requests.size) active.delete(channel) }
}
