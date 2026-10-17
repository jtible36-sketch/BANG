import { Copy, Download } from 'lucide-react'
import type { Project } from '@shared/types'
import { VOX_UNIVERSAL_VIDEO_PROMPT, voxThumbnailPrompts } from '@shared/vox'
import { useApp } from '../store/app'
import { errorText } from '../lib/format'
import { Button } from './ui'

export function VoxWorkflowGuide({ project, onExport, exportDisabled }: { project: Project; onExport: () => void; exportDisabled: boolean }) {
  const { toast } = useApp()
  const copy = async (text: string, message: string): Promise<void> => {
    try {
      await window.api.app.copyText(text)
      toast('success', message)
    } catch (error) {
      toast('error', errorText(error))
    }
  }
  return <div data-vox-guide className="rounded-xl border border-line-2 border-l-[3px] border-l-accent bg-paper p-3.5">
    <p className="text-sm font-semibold">VOX · Kolase dokumenter</p>
    <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
      Satu foto halftone utama, potongan koran tua, aksen merah, dan ruang kosong yang luas. Gambar adalah komposisi akhir.
      Prompt Flow yang sama dipakai untuk semua gambar: rakit kertas selama 0–7 detik, tahan poster selama 7–10 detik, kamera tetap terkunci.
      Klip sumber 10 detik berbeda dari beat narasi 2–3 detik. Pilih bagian yang diperlukan saat mengedit, misalnya bagian poster 7–10 detik.
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={exportDisabled} icon={<Download className="size-3.5" />} onClick={onExport}>Ekspor prompt gambar .txt</Button>
      <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copy(VOX_UNIVERSAL_VIDEO_PROMPT, 'Prompt universal VOX disalin. Gunakan bersama setiap gambar di Flow.')}>Salin prompt Flow VOX</Button>
      <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copy(voxThumbnailPrompts(project.title, project.synopsis).join('\n\n'), 'Tiga alternatif prompt thumbnail VOX disalin.')}>Salin 3 prompt thumbnail</Button>
    </div>
    <details className="mt-3 text-xs text-ink-2">
      <summary className="cursor-pointer font-semibold">Panduan narasi dan file prompt</summary>
      <p className="mt-2 leading-relaxed">Narator pria dengan suara tengah, tenang dan datar, sekitar 155 kata/menit. Untuk ElevenLabs: stability sekitar 55, similarity sekitar 80, style rendah, speaker boost aktif. Jika merekam bertahap, gunakan bagian 20–25 detik dan tinjau hasilnya sebelum merekam ulang.</p>
      <p className="mt-2 leading-relaxed">File .txt memuat satu prompt lengkap per beat, tanpa nomor, dipisahkan baris kosong. Format gambar mengikuti proyek {project.aspectRatio}; thumbnail tetap 16:9. Narasi ditambahkan terpisah dari klip Flow.</p>
    </details>
  </div>
}
