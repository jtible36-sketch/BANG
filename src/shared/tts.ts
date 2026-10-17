import { GEMINI_LIBRARY_VOICES, GEMINI_VOICES } from './models'
import type { KeyStatus, TtsProvider } from './types'

export const TTS_NAMES: Record<TtsProvider, string> = { gemini: 'Gemini TTS', elevenlabs: 'ElevenLabs' }
export type TtsKeyStatus = Pick<KeyStatus, 'provider' | 'configured' | 'lastOk'>

export function ttsReadiness(keys: readonly TtsKeyStatus[]): Record<TtsProvider, { ok: boolean; reason: string | null }> {
  const one = (provider: TtsProvider) => {
    const key = keys.find(item => item.provider === provider)
    const name = TTS_NAMES[provider]
    if (!key?.configured) return { ok: false, reason: `${name} belum terhubung` }
    if (key.lastOk === false) return { ok: false, reason: `Koneksi ${name} perlu diperiksa` }
    return { ok: true, reason: null }
  }
  return { gemini: one('gemini'), elevenlabs: one('elevenlabs') }
}

/** Preserve a connected project choice; a disconnected choice can use the connected default or alternative. */
export function selectTtsProvider(preferred: TtsProvider, keys: readonly TtsKeyStatus[], defaultProvider?: TtsProvider): TtsProvider | null {
  const ready = ttsReadiness(keys)
  if (ready[preferred]?.ok) return preferred
  if (defaultProvider && ready[defaultProvider]?.ok) return defaultProvider
  return ready.elevenlabs.ok ? 'elevenlabs' : ready.gemini.ok ? 'gemini' : null
}

export function isGeminiVoice(id: string): boolean {
  return GEMINI_VOICES.some(voice => voice.id === id) || GEMINI_LIBRARY_VOICES.some(voice => voice.id === id)
}

/** An ID selected for one provider must never be sent to the other provider. */
export function ttsVoiceForProvider(provider: TtsProvider, voice: string, previousProvider: TtsProvider): string {
  const id = voice.trim()
  if (provider === 'gemini') return isGeminiVoice(id) ? id : 'Charon'
  return previousProvider === 'elevenlabs' && id && !isGeminiVoice(id) ? id : ''
}
