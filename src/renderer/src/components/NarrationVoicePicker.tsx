import { RefreshCw } from 'lucide-react'
import { TTS_NAMES } from '@shared/tts'
import type { TtsProvider } from '@shared/types'
import type { NarrationControls } from '../lib/useNarration'
import { useApp } from '../store/app'
import { Select } from './Select'
import { Button } from './ui'
import { VoiceCatalogPicker } from './VoiceCatalogPicker'

export function NarrationVoicePicker({ narration }: { narration: NarrationControls }) {
  const { go } = useApp()
  const providers: TtsProvider[] = ['elevenlabs', 'gemini']
  const voices = narration.voices.length ? narration.voices
    : narration.voice ? [{ id: narration.voice, name: narration.voiceName, description: '' }] : []
  return <div data-narration-voice-picker className="flex flex-col gap-2 rounded-xl border border-line bg-sand/40 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold">Layanan dan suara narasi</span>
      <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={narration.checking} disabled={narration.running} onClick={() => void narration.refresh()}>Periksa koneksi</Button>
    </div>
    <div data-narration-resolved className="text-xs text-ink-2">{narration.checking ? 'Memeriksa layanan suara…' : narration.provider ? `${narration.providerName} · ${narration.voiceName}` : 'Belum ada layanan suara tersambung'}</div>
    {narration.provider ? <>
      <div className="flex flex-col gap-2">
        <Select label="Layanan suara narasi" size="sm" value={narration.provider} disabled={narration.running || narration.checking}
          options={providers.map((provider) => ({ value: provider, label: TTS_NAMES[provider], disabled: !narration.readiness[provider].ok, hint: narration.readiness[provider].reason ?? 'Terhubung' }))}
          onChange={(provider) => void narration.chooseProvider(provider)} />
        <VoiceCatalogPicker voices={voices} provider={narration.provider} language={narration.language} value={narration.voice}
          disabled={narration.running || narration.checking} loading={narration.checking} onChange={narration.chooseVoice} onAdded={narration.adoptAddedVoice} />
      </div>
      {narration.fallback && <p className="text-xs leading-relaxed text-muted">Layanan yang tersambung akan dipakai saat membuat narasi. Suara lama tetap tersimpan.</p>}
    </> : !narration.checking && <Button size="sm" className="self-start" onClick={() => go({ name: 'settings' })}>Hubungkan layanan suara</Button>}
    {narration.routeError && <p role="alert" className="text-xs leading-relaxed text-bad-ink">{narration.routeError}</p>}
  </div>
}
