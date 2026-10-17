import { DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, getImageModel, getVideoModel } from '@shared/higgsfield'
import type { AppSettings } from '@shared/types'
import { getDb } from './db'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultTtsProvider: 'gemini',
  defaultLanguage: 'id',
  exportFolder: null,
  llmProvider: 'gemini',
  llmSource: 'api',
  visualPlannerSource: 'codex',
  codexConnections: { story: false, visual: true, image: true, video: false },
  codexModel: '',
  codexVisualModel: '',
  storyTimeoutSec: 120,
  visualTimeoutSec: 600,
  llmModels: { gemini: 'gemini-3.8-flash', openrouter: '', groq: '', custom: '' },
  customBaseUrl: '',
  geminiTtsModel: 'gemini-3.8-flash-tts',
  elevenModel: 'eleven_multilingual_v2',
  visualWorkflow: 'codex-flow',
  flowMcpPort: 8789,
  flowChromePort: 9335,
  flowRuntimeVersion: 1,
  flowVideoMaxCredits: 7,
  flowShotMedia: 'video',
  imageModel: DEFAULT_IMAGE_MODEL,
  videoModel: DEFAULT_VIDEO_MODEL,
  whisperAuto: true
}

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const out: AppSettings = { ...DEFAULT_SETTINGS, llmModels: { ...DEFAULT_SETTINGS.llmModels }, codexConnections: { ...DEFAULT_SETTINGS.codexConnections } }
  for (const r of rows) {
    if (!(r.key in out)) continue
    const value = JSON.parse(r.value)
    if (r.key === 'llmModels') out.llmModels = { ...out.llmModels, ...value }
    else if (r.key === 'codexConnections') {
      for (const channel of ['story', 'visual', 'image', 'video'] as const) {
        if (typeof value?.[channel] === 'boolean') out.codexConnections[channel] = value[channel]
      }
    }
    else (out as unknown as Record<string, unknown>)[r.key] = value
  }
  // A provider that no longer exists (e.g. from an older build) falls back to Gemini.
  if (out.theme !== 'dark' && out.theme !== 'system') out.theme = 'light'
  if (!(out.llmProvider in DEFAULT_SETTINGS.llmModels)) out.llmProvider = 'gemini'
  if (out.llmSource !== 'codex') out.llmSource = 'api'
  if (out.visualPlannerSource !== 'follow-story') out.visualPlannerSource = 'codex'
  if (typeof out.codexModel !== 'string') out.codexModel = ''
  if (typeof out.codexVisualModel !== 'string') out.codexVisualModel = ''
  out.storyTimeoutSec = Number.isFinite(out.storyTimeoutSec) ? Math.max(30, Math.min(600, Math.round(out.storyTimeoutSec))) : 120
  out.visualTimeoutSec = Number.isFinite(out.visualTimeoutSec) ? Math.max(30, Math.min(1800, Math.round(out.visualTimeoutSec))) : 600
  // Existing installs without a workflow setting use the manual Codex + Flow route.
  if (out.visualWorkflow !== 'higgsfield' && out.visualWorkflow !== 'flow-mcp') out.visualWorkflow = 'codex-flow'
  if (!rows.some(row => row.key === 'flowRuntimeVersion')) out.flowMcpPort = 8789
  out.flowMcpPort = Number.isInteger(out.flowMcpPort) && out.flowMcpPort >= 1024 && out.flowMcpPort <= 65535 ? out.flowMcpPort : 8789
  out.flowChromePort = Number.isInteger(out.flowChromePort) && out.flowChromePort >= 1024 && out.flowChromePort <= 65535 ? out.flowChromePort : 9335
  out.flowRuntimeVersion = 1
  out.flowVideoMaxCredits = Number.isFinite(out.flowVideoMaxCredits) ? Math.max(1, Math.min(100, Math.round(out.flowVideoMaxCredits))) : 7
  if (out.flowShotMedia !== 'image') out.flowShotMedia = 'video'
  // Models dropped from the Higgsfield catalog fall back to the defaults.
  out.imageModel = getImageModel(out.imageModel).id
  out.videoModel = getVideoModel(out.videoModel).id
  return out
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const stmt = getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  getDb().transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULT_SETTINGS)) continue
      const value = k === 'theme' ? v === 'dark' || v === 'system' ? v : 'light'
        : k === 'llmModels' ? { ...current.llmModels, ...(v as object) }
        : k === 'codexConnections' ? { ...current.codexConnections, ...(v as object) } : v
      stmt.run(k, JSON.stringify(value))
    }
    if ('flowMcpPort' in patch || 'flowChromePort' in patch || patch.visualWorkflow === 'flow-mcp') {
      stmt.run('flowRuntimeVersion', '1')
      if (!('flowMcpPort' in patch)) stmt.run('flowMcpPort', JSON.stringify(current.flowMcpPort))
    }
  })()
  return getSettings()
}

// ---------- small key/value cache (model lists) ----------

export function readCache<T>(key: string): { value: T; updatedAt: number } | null {
  const row = getDb().prepare('SELECT value, updated_at FROM cache WHERE key = ?').get(key) as
    | { value: string; updated_at: number }
    | undefined
  return row ? { value: JSON.parse(row.value) as T, updatedAt: row.updated_at } : null
}

export function writeCache(key: string, value: unknown): number {
  const now = Date.now()
  getDb()
    .prepare('INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(key, JSON.stringify(value), now)
  return now
}

export function dropCache(prefix: string): void {
  getDb().prepare('DELETE FROM cache WHERE key LIKE ?').run(`${prefix}%`)
}
