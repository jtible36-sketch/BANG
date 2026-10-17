import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import type { FlowStatus } from '@shared/flow'
import { Button, Badge, inputCls } from './ui'
import { useApp } from '../store/app'
import { errorText } from '../lib/format'

export function FlowConnectionPanel({ settings, onSettings }: { settings?: AppSettings; onSettings?: (s: AppSettings) => void }) {
  const { toast } = useApp()
  const [status, setStatus] = useState<FlowStatus | null>(null), [busy, setBusy] = useState(false)
  const refresh = async (prepare = false): Promise<void> => {
    setBusy(true)
    try { setStatus(await (prepare ? window.api.flow.prepare() : window.api.flow.status())) }
    catch (e) { toast('error', errorText(e)) }
    finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  return <div data-flow-connection className="rounded-xl border border-line-2 bg-paper p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><Badge tone={status?.inProject && status.signedIn ? 'ok' : 'warn'}>Flow MCP {status?.inProject ? 'terhubung' : 'belum siap'}</Badge><span>Omni Flash · 4 detik · 720p / gambar 1,5 detik</span><Button size="sm" loading={busy} onClick={() => void refresh()}>Cek koneksi Flow</Button><Button size="sm" disabled={busy} onClick={() => void refresh(true)}>Siapkan Flow</Button></div>
    <p className="mt-2 leading-relaxed text-muted">{status?.message || 'Mengaktifkan layanan Flow bawaan…'} Naraflow mengelola layanan ini otomatis. Login Google sekali di profil khusus Naraflow dan biarkan jendela Flow terbuka selama generate. Video memakai kredit Google.</p>
    {settings && onSettings && <div className="mt-3 grid grid-cols-3 gap-3">
      <label>Media untuk naskah baru<select aria-label="Media shot Flow" className={inputCls} value={settings.flowShotMedia} onChange={async e => onSettings(await window.api.settings.set({ flowShotMedia: e.target.value as 'video' | 'image' }))}><option value="video">Video · 4 detik per shot</option><option value="image">Gambar · 1,5 detik per shot</option></select></label>
      <label>Batas kredit per video<input aria-label="Batas kredit Flow" className={inputCls} type="number" min={1} max={100} value={settings.flowVideoMaxCredits} onChange={async e => { const value = Number(e.target.value); if (value >= 1 && value <= 100) onSettings(await window.api.settings.set({ flowVideoMaxCredits: value })) }} /></label>
      <label>Port Flow MCP<input aria-label="Port Flow MCP" className={inputCls} type="number" min={1024} max={65535} defaultValue={settings.flowMcpPort} onBlur={async e => { const value = Number(e.target.value); if (value >= 1024 && value <= 65535) onSettings(await window.api.settings.set({ flowMcpPort: value })) }} /></label>
    </div>}
    {settings && onSettings && <details className="mt-2 text-muted"><summary className="cursor-pointer">Pengaturan browser Flow</summary><label className="mt-2 block">Port browser khusus<input aria-label="Port browser Flow" className={inputCls} type="number" min={1024} max={65535} defaultValue={settings.flowChromePort} onBlur={async e => { const value = Number(e.target.value); if (value >= 1024 && value <= 65535) onSettings(await window.api.settings.set({ flowChromePort: value })) }} /></label><p className="mt-1">Bawaan 9335. Setelah mengubah port layanan/browser, buka ulang Naraflow. Login hanya pada profil Flow Naraflow.</p></details>}
    {settings && <p className="mt-2 text-muted">Bawaan 7 kredit/video; Flow memeriksa kutipan biaya dan melewati permintaan di atas batas. Mode video/gambar mengatur naskah baru. Durasi edit yang sudah bersuara tetap mengikuti narasi.</p>}
  </div>
}
