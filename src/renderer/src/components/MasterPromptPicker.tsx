import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react'
import { builtInMasterPrompts, resolveMasterPrompt, type MasterPromptProfile } from '@shared/master-prompts'
import { getHuashuMotionProfile } from '@shared/huashu-motion'
import type { Project } from '@shared/types'
import { Select } from './Select'
import { errorText } from '../lib/format'

export function MasterPromptPicker({ value, context, onChange, onManage, disabled = false }: {
  value?: MasterPromptProfile | null
  context: Pick<Project, 'styleId' | 'skillId' | 'skillVariant'>
  onChange: (profile: MasterPromptProfile | null) => void
  onManage: () => void
  disabled?: boolean
}) {
  const [profiles, setProfiles] = useState<MasterPromptProfile[]>(builtInMasterPrompts)
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; void window.api.masterPrompts.list().then((items) => { if (alive) setProfiles(items) }).catch((e) => { if (alive) setError(errorText(e)) }); return () => { alive = false } }, [])
  const active = resolveMasterPrompt({ ...context, masterPrompt: value })
  const motion = getHuashuMotionProfile({ ...context, masterPrompt: value }, active)
  // Keep the project's saved version selectable even after its library entry changes or is removed.
  const options = [{ value: '', label: 'Otomatis · ikuti skill & gaya', hint: 'Kompatibel dengan semua proyek lama' }, ...(value ? [value, ...profiles.filter((p) => p.id !== value.id)] : profiles).map((p) => ({ value: p.id, label: p.name, hint: `v${p.version} · ${p.description}` }))]
  return <section className="rounded-xl border border-line bg-paper p-4" data-master-picker>
    <div className="mb-2.5 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-accent" />Master prompt</label><button type="button" disabled={disabled} onClick={onManage} className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50">Kelola aturan<ChevronRight className="size-3.5" /></button></div>
    <Select label="Master prompt" value={value?.id ?? ''} options={options} onChange={(id) => onChange(id ? structuredClone(profiles.find((p) => p.id === id) ?? value!) : null)} disabled={disabled} menuWidth={460} />
    <p className="mt-2 text-xs leading-relaxed text-ink-2">{value ? `${active?.name} v${active?.version} dipakai untuk produksi ini. Aturan master diutamakan bila berbeda dengan gaya pilihan.` : `Aturan aktif: ${active?.name ?? 'Alur standar'}. Mengikuti pilihan skill dan gaya visual.`}</p>
    {(active?.subjectNiches?.length || active?.durationOptionsSec?.length) ? <p className="mt-1.5 text-xs text-muted">{active.subjectNiches?.length ? `${active.subjectNiches.length} rekomendasi niche. ` : ''}{active.durationOptionsSec?.length ? `Pilihan durasi: ${active.durationOptionsSec.map((seconds) => `${seconds / 60} menit`).join(', ')}. ` : ''}Niche dan durasi custom tetap tersedia.</p> : null}
    {motion && <details className="mt-3 border-t border-line pt-3 text-xs" data-huashu-motion data-motion-profile={motion.id}>
      <summary className="cursor-pointer rounded text-ink focus-visible:outline-2 focus-visible:outline-accent">
        <span className="ml-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle"><Sparkles className="size-3.5 shrink-0 text-accent" /><strong>Huashu Art Motion</strong><span className="text-ink-2">{motion.name}</span><span className="rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-semibold text-ok-ink">Gaya terpilih</span></span>
      </summary>
      <p className="mt-2 leading-relaxed text-ink-2">{motion.summary}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 leading-relaxed text-ink-2">
        <dt className="font-semibold text-ink">Gerak</dt><dd>{motion.action}</dd>
        <dt className="font-semibold text-ink">Kamera</dt><dd>{motion.camera}</dd>
        <dt className="font-semibold text-ink">Kesinambungan</dt><dd>{motion.continuity}</dd>
      </dl>
      <p className="mt-2 leading-relaxed text-muted">Arahan ini digunakan untuk gaya Huashu Art Motion saat menyusun naskah, karakter, gambar, dan video. Master prompt tetap diutamakan; durasi mengikuti pengaturan narasi.</p>
    </details>}
    {error && <p role="alert" className="mt-2 text-xs text-bad-ink">Pustaka belum termuat: {error}</p>}
  </section>
}
