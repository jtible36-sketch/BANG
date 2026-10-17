import { useEffect, useState } from 'react'
import type { AppSettings, CodexChannel, CodexStatus, ModelList } from '@shared/types'
import { Badge, Button } from './ui'
import { ModelPicker } from './ModelPicker'
import { errorText } from '../lib/format'

const labels = { story: 'Penyusun cerita Codex', visual: 'Penyusun visual Codex', image: 'Gambar Codex', video: 'Prompt video Codex' }
const ACCOUNT_DEFAULT = '__codex_account_default__'
const descriptions = {
  story: 'Susun naskah, pemeran, dan rencana visual memakai akun ChatGPT di Codex.',
  visual: 'Susun prompt gambar, pemeran, dan gerak dari naskah yang sudah ditinjau. Koneksi ini terpisah dari penulis naskah.',
  image: 'Generate gambar dan lembar karakter langsung ke proyek dengan kuota akun Codex.',
  video: 'Susun prompt gerak sesuai narasi dan master prompt. Buat video di Flow, lalu impor hasilnya.'
}

export function CodexConnectionControl({ channel, settings, onSettings }: {
  channel: CodexChannel; settings: AppSettings; onSettings: (settings: AppSettings) => void
}) {
  const connected = settings.codexConnections?.[channel] ?? channel === 'image'
  const [status, setStatus] = useState<CodexStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState<ModelList | null>(null)
  const [modelError, setModelError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const refresh = async () => {
    setBusy(true); setError('')
    try { setStatus(await window.api.codex.status()) }
    catch (error) { setError(errorText(error)) }
    finally { setBusy(false) }
  }
  const models = async () => {
    setLoadingModels(true); setModelError('')
    try { setCatalog(await window.api.codex.models()) }
    catch (error) { setModelError(errorText(error)) }
    finally { setLoadingModels(false) }
  }
  useEffect(() => {
    if (connected) void refresh()
    if (connected && (channel === 'story' || channel === 'visual')) void models()
  }, [connected, channel])
  const toggle = async () => {
    setBusy(true); setError('')
    try { onSettings(await window.api.codex.connect(channel, !connected)) }
    catch (error) { setError(errorText(error)) }
    finally { setBusy(false) }
  }
  const accountReady = status?.available && status.authenticated && (channel !== 'image' || status.imageGeneration)
  return <div data-codex-channel={channel} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 text-[13px]">
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex-1 font-semibold text-ink">{labels[channel]}</span>
      <Badge tone={connected && accountReady ? 'ok' : 'draft'}>{connected ? busy ? 'Memeriksa…' : accountReady ? 'Terhubung' : 'Koneksi aktif · periksa akun' : 'Diputus'}</Badge>
      <Button size="sm" disabled={busy} onClick={() => void toggle()} aria-label={`${connected ? 'Putuskan' : 'Hubungkan'} ${labels[channel]}`}>
        {connected ? 'Putuskan' : 'Hubungkan'}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void refresh()}>Cek akun</Button>
    </div>
    <p className="leading-relaxed text-ink-2">{descriptions[channel]}</p>
    {error && <p role="alert" className="text-bad-ink">{error}</p>}
    {connected && status && !accountReady && <p className="text-sun-ink">{status.message}</p>}
    <p className="text-xs text-muted">Login melalui aplikasi Codex. Putuskan menghentikan permintaan Bang Story pada koneksi ini; akun Codex tetap login.</p>
    {(channel === 'story' || channel === 'visual') && connected && <div className="flex flex-col gap-2 border-t border-line pt-3">
      <span className="font-semibold">{channel === 'visual' ? 'Model penyusun visual' : 'Model penyusun cerita'}</span>
      <ModelPicker value={(channel === 'visual' ? settings.codexVisualModel : settings.codexModel) || ACCOUNT_DEFAULT} models={[{ id: ACCOUNT_DEFAULT, name: 'Otomatis · default akun', tags: [] }, ...(catalog?.models ?? [])]}
        loading={loadingModels} error={modelError || null} fetchedAt={catalog?.fetchedAt ?? null}
        onRefresh={() => void models()} placeholder="Otomatis · default akun" onChange={async (id) => {
          try { onSettings(await window.api.settings.set(channel === 'visual' ? { codexVisualModel: id === ACCOUNT_DEFAULT ? '' : id } : { codexModel: id === ACCOUNT_DEFAULT ? '' : id })) }
          catch (error) { setModelError(errorText(error)) }
        }} />
      <p className="text-xs text-muted">Daftar diambil dari akun Codex. Penyusunan memakai penalaran ringan jika model mendukungnya.</p>
    </div>}
  </div>
}
