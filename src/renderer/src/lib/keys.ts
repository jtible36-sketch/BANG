import type { KeyStatus, TtsProvider } from '@shared/types'
import { selectTtsProvider } from '@shared/tts'
export { TTS_NAMES, ttsReadiness } from '@shared/tts'

/** The preferred provider when it is usable, otherwise another usable one, otherwise the preferred one anyway. */
export function usableTts(preferred: TtsProvider, keys: KeyStatus[]): TtsProvider {
  return selectTtsProvider(preferred, keys) ?? preferred
}
