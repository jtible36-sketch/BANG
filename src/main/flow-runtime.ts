import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'
import { binPath } from './paths'
import { getSettings } from './settings'

export interface FlowEngineHealth { name: string; instance: string; runtime: string; apiVersion: number; pid?: number; activeJobs?: number }
let child: ChildProcess | null = null
let starting: Promise<FlowEngineHealth> | null = null
let launchedPort: number | null = null
let closing = false
let heartbeat: ReturnType<typeof setInterval> | null = null

export const flowHome = (): string => join(app.getPath('userData'), 'flow-mcp')
export const flowBase = (): string => `http://127.0.0.1:${getSettings().flowMcpPort}`
export const flowInstance = (): string => createHash('sha256').update(resolve(flowHome()).toLowerCase()).digest('hex')
export const flowRuntimeFolder = (): string => app.isPackaged ? join(process.resourcesPath, 'flow-runtime') : resolve(__dirname, '../../resources/flow-runtime')

/** Verify a single owner in this profile. Unrelated ports are never used or terminated. */
export async function flowEngineHealth(): Promise<FlowEngineHealth | null> {
  let response: Response
  try { response = await fetch(flowBase() + '/api/health', { signal: AbortSignal.timeout(2000), redirect: 'error' }) }
  catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') return null
    throw new Error('Layanan Flow belum merespons. Tunggu sebentar atau periksa port internal; aplikasi tidak membuka pengendali kedua.')
  }
  if (!response.ok) throw new Error('Port internal Flow dipakai aplikasi lain. Pilih port lain di Pengaturan.')
  const health = await response.json() as FlowEngineHealth
  if (health.name !== 'flow-mcp' || health.instance !== flowInstance() || health.runtime !== 'naraflow-embedded' || health.apiVersion !== 1) {
    throw new Error('Port internal bukan layanan Flow milik Naraflow. Pilih port lain di Pengaturan.')
  }
  return health
}

export function ensureFlowRuntime(): Promise<FlowEngineHealth> {
  if (starting) return starting
  starting = boot().then(async health => {
    await lease()
    if (!heartbeat) { heartbeat = setInterval(() => { void lease().catch(() => {}) }, 4000); heartbeat.unref() }
    return health
  }).finally(() => { starting = null })
  return starting
}

async function lease(): Promise<void> {
  if (closing) return
  const token = readFileSync(join(flowHome(), 'token'), 'utf8').trim()
  const response = await fetch(flowBase() + '/api/lease', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(2000),
    headers: { 'content-type': 'application/json', 'x-flow-token': token }, body: '{}' })
  if (!response.ok) throw new Error('Layanan Flow tidak menerima koneksi Naraflow. Coba cek koneksi lagi.')
}

async function boot(): Promise<FlowEngineHealth> {
  if (closing) throw new Error('Naraflow sedang ditutup.')
  const existing = await flowEngineHealth()
  if (existing) return existing
  const settings = getSettings()
  const ownerFile = join(flowHome(), 'owner.json')
  if (existsSync(ownerFile)) {
    const owner = JSON.parse(readFileSync(ownerFile, 'utf8')) as { port?: number; pid?: number }
    if (owner.port && owner.port !== settings.flowMcpPort && Number.isInteger(owner.port) && owner.port >= 1024 && owner.port <= 65535) {
      const other = await fetch(`http://127.0.0.1:${owner.port}/api/health`, { signal: AbortSignal.timeout(2000), redirect: 'error' }).then(r => r.json(), () => null) as FlowEngineHealth | null
      if (other?.instance === flowInstance() && other.runtime === 'naraflow-embedded') throw new Error(`Layanan Flow masih aktif pada port ${owner.port}. Gunakan port tersebut sampai antrean selesai; pengendali kedua tidak dijalankan.`)
    }
  }
  if (child && child.exitCode === null && launchedPort !== settings.flowMcpPort) throw new Error('Layanan Flow masih memakai port sebelumnya. Buka ulang Naraflow setelah mengubah port.')
  const runtime = join(flowRuntimeFolder(), 'dist/runtime.mjs')
  if (!existsSync(runtime)) throw new Error('Komponen Flow bawaan belum terpasang. Pasang ulang pembaruan Naraflow.')
  if (settings.flowMcpPort === settings.flowChromePort) throw new Error('Port layanan dan browser Flow harus berbeda.')
  mkdirSync(flowHome(), { recursive: true }); mkdirSync(join(flowHome(), 'output'), { recursive: true })
  let failure = ''
  if (!child || child.exitCode !== null) {
    const owned = spawn(process.execPath, [runtime], { windowsHide: true, cwd: flowRuntimeFolder(), stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FLOW_MCP_HOME: flowHome(), FLOW_MCP_OUTPUT: join(flowHome(), 'output'),
        FLOW_MCP_PORT: String(settings.flowMcpPort), FLOW_MCP_CDP_PORT: String(settings.flowChromePort), FLOW_MCP_FFMPEG: binPath(ffmpegStatic!) } })
    child = owned; launchedPort = settings.flowMcpPort
    owned.stderr?.on('data', data => { failure = (failure + String(data)).slice(-1500) })
    owned.once('error', () => { failure = 'Layanan Flow tidak bisa dijalankan.' })
    owned.once('exit', () => { if (child === owned) child = null })
  }
  const until = Date.now() + 15000
  while (Date.now() < until) {
    if (closing) throw new Error('Naraflow sedang ditutup.')
    const health = await flowEngineHealth()
    if (health) return health
    if (!child) throw new Error(failure ? 'Layanan Flow bawaan berhenti sebelum siap. Periksa instalasi Naraflow.' : 'Layanan Flow tidak bisa dimulai.')
    await new Promise(done => setTimeout(done, 150))
  }
  throw new Error('Layanan Flow belum siap dalam 15 detik. Coba cek koneksi lagi; tidak ada generate dikirim.')
}

/** Detach, rather than kill: an already submitted shot may continue until the queue finishes. */
export function shutdownFlowRuntime(): void {
  closing = true
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
  if (!child) return
  if (child.connected) {
    child.send({ type: 'detach' }, () => { try { child?.disconnect() } catch { /* The owner may already have stopped. */ } })
  }
  child.unref()
}
