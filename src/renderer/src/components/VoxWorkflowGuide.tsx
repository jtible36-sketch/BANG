import { Copy, Download } from 'lucide-react'
import type { Project } from '@shared/types'
import { voxThumbnailPrompts } from '@shared/vox'
import { isVoxMaster, resolveMasterPrompt } from '@shared/master-prompts'
import { useApp } from '../store/app'
import { errorText } from '../lib/format'
import { Button } from './ui'

export function VoxWorkflowGuide({ project, onExport, exportDisabled }: { project: Project; onExport: () => void; exportDisabled: boolean }) {
  const { toast } = useApp()
  const profile = resolveMasterPrompt(project)
  const vox = isVoxMaster(project)
  const universal = profile?.videoMode === 'universal'
  const copy = async (text: string, message: string): Promise<void> => {
    try {
      await window.api.app.copyText(text)
      toast('success', message)
    } catch (error) {
      toast('error', errorText(error))
    }
  }
  return <div data-vox-guide className="rounded-xl border border-line-2 border-l-[3px] border-l-accent bg-paper p-3.5">
    <p className="text-sm font-semibold">{profile?.name ?? 'Panduan produksi'}{profile ? <span className="ml-2 font-mono text-[10px] text-muted">v{profile.version}</span> : null}</p>
    <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
      {vox ? 'Satu foto halftone utama, potongan koran tua, aksen merah, dan ruang kosong yang luas. Gambar adalah komposisi akhir. ' : profile?.description + ' '}
      {universal ? 'Prompt Flow yang sama dipakai untuk semua gambar. ' : 'Arahan video mengikuti masing-masing adegan. '}
      {profile?.lockedCamera ? 'Kamera tetap terkunci. ' : ''}
      {profile?.timing.sourceVideoSeconds ? `Klip sumber ${profile.timing.sourceVideoSeconds} detik berbeda dari durasi beat narasi. Pilih bagian yang diperlukan saat mengedit. ` : ''}
      Aturan lengkap mengikuti master dan versi yang terpasang pada proyek ini.
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={exportDisabled} icon={<Download className="size-3.5" />} onClick={onExport}>Ekspor prompt gambar .txt</Button>
      {universal && <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copy(profile.stages.video, 'Prompt universal master disalin. Gunakan bersama setiap gambar di Flow.')}>Salin prompt universal</Button>}
      {vox && <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copy(voxThumbnailPrompts(project.title, project.synopsis).map((prompt) => profile?.stages.thumbnail ? `${prompt}\n\nAturan thumbnail master ${profile.name}:\n${profile.stages.thumbnail}` : prompt).join('\n\n'), 'Tiga alternatif prompt thumbnail disalin.')}>Salin 3 prompt thumbnail</Button>}
    </div>
    <details className="mt-3 text-xs text-ink-2">
      <summary className="cursor-pointer font-semibold">Panduan narasi dan file prompt</summary>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{profile?.stages.voice || 'Suara dibuat dari naskah yang sudah tersimpan. Tinjau hasil narasi sebelum ekspor.'}</p>
      <p className="mt-2 leading-relaxed">File .txt memuat satu prompt lengkap per beat, tanpa nomor, dipisahkan baris kosong. Format gambar mengikuti proyek {project.aspectRatio}; thumbnail tetap 16:9. Narasi ditambahkan terpisah dari klip Flow.</p>
    </details>
  </div>
}
