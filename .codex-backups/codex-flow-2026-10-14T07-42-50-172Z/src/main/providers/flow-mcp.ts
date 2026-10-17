import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { app } from 'electron'
import { FLOW_IMAGE_MODEL, FLOW_VIDEO_MODEL, type FlowStatus } from '@shared/flow'
import { getSettings } from '../settings'

export interface FlowRemoteJob {
  id: string; status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  files: string[]; project?: string; model?: string; duration?: number; resolution?: string
  progress?: string; error?: string; submitted?: boolean; chargedCredits?: number; failureKind?: string
}
export class FlowResponseError extends Error {}
interface FlowOwnerStatus {
  flow?: { signedIn?: boolean; inProject?: boolean; hint?: string }
  jobs?: FlowRemoteJob[]; output_root?: string
  generationPolicy?: { videoModel?: string; imageModel?: string; duration?: number; resolution?: string; videoCap?: number; imageCap?: number }
}

const home = (): string => join(app.getPath('appData'), 'Creatorize V2', 'flow-mcp')
const base = (): string => `http://127.0.0.1:${getSettings().flowMcpPort}`

/** Attach to the existing queue owner. Never launch a second Flow controller. */
export async function flowCall<T>(method: string, args: unknown, signal?: AbortSignal): Promise<T> {
  if (!['status', 'prepare', 'generate', 'wait', 'cancel'].includes(method)) throw new Error('Operasi Flow tidak didukung.')
  const timeout = AbortSignal.timeout(method === 'wait' ? 45000 : 90000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const health = await fetch(base() + '/api/health', { signal: requestSignal, redirect: 'error' }).then(r => r.json()) as { name?: string; instance?: string }
  const expected = createHash('sha256').update(resolve(home()).toLowerCase()).digest('hex')
  if (health.name !== 'flow-mcp' || health.instance !== expected) throw new Error('Port ini bukan Flow MCP untuk profil Creatorize Anda.')
  // Token is read only in the main process; it never crosses IPC or appears in logs.
  const token = readFileSync(join(home(), 'token'), 'utf8').trim()
  const response = await fetch(base() + '/api/' + method, { method: 'POST', redirect: 'error', signal: requestSignal,
    headers: { 'content-type': 'application/json', 'x-flow-token': token }, body: JSON.stringify(args ?? {}) })
  const data = await response.json() as T & { error?: string }
  if (!response.ok || data.error) throw new FlowResponseError(data.error || `Flow MCP merespons ${response.status}.`)
  return data
}

export async function flowOwnerStatus(): Promise<FlowOwnerStatus> { return flowCall('status', { detailed: false }) }

export async function readFlowStatus(): Promise<FlowStatus> {
  try {
    const status = await flowOwnerStatus()
    const signedIn = status.flow?.signedIn === true, inProject = status.flow?.inProject === true
    return { available: true, signedIn, inProject,
      message: !signedIn ? 'Masuk ke akun Google pada jendela Flow Chrome.' : !inProject ? 'Akun sudah masuk. Buka proyek Flow atau klik Siapkan Flow.' : 'Flow terhubung. Gambar dan video akan langsung masuk ke adegan.',
      videoModel: status.generationPolicy?.videoModel || FLOW_VIDEO_MODEL, imageModel: status.generationPolicy?.imageModel || FLOW_IMAGE_MODEL,
      videoMaxCredits: getSettings().flowVideoMaxCredits, jobs: status.jobs?.filter(job => job.status === 'queued' || job.status === 'running').length ?? 0 }
  } catch {
    return { available: false, signedIn: false, inProject: false, message: 'Flow MCP belum bisa dihubungi. Buka Creatorize/Flow MCP, lalu cek koneksi. Port bawaan 8788.',
      videoModel: FLOW_VIDEO_MODEL, imageModel: FLOW_IMAGE_MODEL, videoMaxCredits: getSettings().flowVideoMaxCredits, jobs: 0 }
  }
}

export async function prepareFlow(): Promise<FlowStatus> {
  await flowCall('prepare', { inspect: true, type: 'video' })
  return readFlowStatus()
}

export async function requireFlowReady(kind: 'image' | 'video', maxCredits = 0): Promise<void> {
  if (getSettings().visualWorkflow !== 'flow-mcp') throw new Error('Pilih Flow MCP langsung pada Pengaturan gambar dan video.')
  const status = await flowOwnerStatus()
  if (!status.flow?.signedIn || !status.flow?.inProject) throw new Error('Flow belum siap. Masuk ke akun Google dan buka proyek Flow, atau klik Siapkan Flow.')
  const policy = status.generationPolicy
  if (policy && (kind === 'video' ? typeof policy.videoCap === 'number' && policy.videoCap > maxCredits : typeof policy.imageCap === 'number' && policy.imageCap > 0)) {
    throw new Error('Kebijakan Flow MCP menaikkan batas kredit di atas yang Anda konfirmasi. Samakan batas sebelum generate; tidak ada shot dikirim.')
  }
  if (policy && (policy.videoModel && policy.videoModel !== FLOW_VIDEO_MODEL || policy.duration && policy.duration !== 4 || policy.resolution && policy.resolution !== '720p')) {
    throw new Error('Kebijakan Flow MCP mengubah setelan video. Atur Omni 1.1 Flash, 4 detik, 720p di Flow MCP sebelum generate.')
  }
}

export async function cancelFlowRemote(id: string): Promise<void> {
  const job = await flowCall<FlowRemoteJob>('cancel', { job_id: id })
  if (job.status !== 'cancelled') throw new Error('Flow sudah mulai generate dan tidak bisa dibatalkan. Tunggu hasilnya; aplikasi akan menyimpannya.')
}

/** Only the verified owner's managed output may be imported, never arbitrary paths from a response. */
export function flowOutputPath(file: string, kind: 'image' | 'video'): string {
  if (!isAbsolute(file)) throw new Error('Lokasi hasil Flow tidak valid.')
  const root = realpathSync(join(home(), 'output')), target = realpathSync(file)
  const rel = relative(root, target)
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) || !statSync(target).isFile()) throw new Error('Hasil Flow berada di luar folder output.')
  if (!(kind === 'image' ? ['.png', '.jpg', '.jpeg', '.webp'] : ['.mp4', '.mov', '.webm']).includes(extname(target).toLowerCase())) throw new Error('Format hasil Flow tidak sesuai.')
  return target
}
