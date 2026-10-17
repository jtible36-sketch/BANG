import { selectTtsProvider, ttsVoiceForProvider } from '@shared/tts'
import type { Project, TtsProvider } from '@shared/types'
import { getDb } from './db'
import { emit } from './events'
import { getJob, getProject } from './repo'
import { keyStatuses } from './secrets'
import { getSettings } from './settings'
import * as eleven from './services/elevenlabs'

export interface TtsRoute {
  provider: TtsProvider
  voice: string
  model: string
}

/** Decide from connection metadata before queuing; never retry an API failure using a different account. */
export function chooseTtsRoute(project: Project): TtsRoute {
  const settings = getSettings()
  const provider = selectTtsProvider(project.ttsProvider, keyStatuses(), settings.defaultTtsProvider)
  if (!provider) throw new Error('Hubungkan ElevenLabs atau Gemini TTS di Pengaturan sebelum membuat suara narasi.')
  return {
    provider,
    voice: ttsVoiceForProvider(provider, project.ttsVoice, project.ttsProvider),
    model: provider === 'elevenlabs' ? settings.elevenModel : settings.geminiTtsModel
  }
}

/** Resolve a missing ElevenLabs voice only against ElevenLabs, then persist the selected pair atomically. */
export async function resolveTtsRoute(project: Project, selected: TtsRoute, jobId: string, signal: AbortSignal): Promise<TtsRoute> {
  signal.throwIfAborted()
  let voice = selected.voice
  if (selected.provider === 'elevenlabs' && !voice) {
    const voices = await eleven.listVoices()
    signal.throwIfAborted()
    voice = voices[0]?.id ?? ''
    if (!voice) throw new Error('Akun ElevenLabs belum menyediakan suara. Tambahkan atau pilih suara di Pengaturan.')
  }
  signal.throwIfAborted()
  const route = { ...selected, voice }
  const current = getProject(project.id)
  // A queued request must not overwrite a newer provider or voice selected while it was waiting.
  if (current.ttsProvider === project.ttsProvider && current.ttsVoice === project.ttsVoice) {
    getDb().prepare('UPDATE projects SET tts_provider = ?, tts_voice = ?, updated_at = ? WHERE id = ?')
      .run(route.provider, route.voice, Date.now(), project.id)
  }
  const raw = getDb().prepare('SELECT payload_json FROM jobs WHERE id = ?').get(jobId) as { payload_json: string } | undefined
  const payload = raw ? JSON.parse(raw.payload_json) : {}
  getDb().prepare('UPDATE jobs SET payload_json = ? WHERE id = ?').run(JSON.stringify({ ...payload, tts: route }), jobId)
  const job = getJob(jobId)
  if (job) emit.job(job)
  return route
}
