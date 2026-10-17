import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight } from 'lucide-react'
import { builtInMasterPrompts, resolveMasterPrompt, type MasterPromptProfile } from '@shared/master-prompts'
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
  // Keep the project's saved version selectable even after its library entry changes or is removed.
  const options = [{ value: '', label: 'Otomatis · ikuti skill & gaya', hint: 'Kompatibel dengan semua proyek lama' }, ...(value ? [value, ...profiles.filter((p) => p.id !== value.id)] : profiles).map((p) => ({ value: p.id, label: p.name, hint: `v${p.version} · ${p.description}` }))]
  return <section className="rounded-xl border border-line bg-paper p-4" data-master-picker>
    <div className="mb-2.5 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-accent" />Master prompt</label><button type="button" disabled={disabled} onClick={onManage} className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50">Kelola aturan<ChevronRight className="size-3.5" /></button></div>
    <Select label="Master prompt" value={value?.id ?? ''} options={options} onChange={(id) => onChange(id ? structuredClone(profiles.find((p) => p.id === id) ?? value!) : null)} disabled={disabled} menuWidth={460} />
    <p className="mt-2 text-xs leading-relaxed text-ink-2">{value ? `${active?.name} v${active?.version} dipakai untuk produksi ini. Aturan master diutamakan bila berbeda dengan gaya pilihan.` : `Aturan aktif: ${active?.name ?? 'Alur standar'}. Mengikuti pilihan skill dan gaya visual.`}</p>
    {(active?.subjectNiches?.length || active?.durationOptionsSec?.length) ? <p className="mt-1.5 text-xs text-muted">{active.subjectNiches?.length ? `${active.subjectNiches.length} rekomendasi niche. ` : ''}{active.durationOptionsSec?.length ? `Pilihan durasi: ${active.durationOptionsSec.map((seconds) => `${seconds / 60} menit`).join(', ')}. ` : ''}Niche dan durasi custom tetap tersedia.</p> : null}
    {error && <p role="alert" className="mt-2 text-xs text-bad-ink">Pustaka belum termuat: {error}</p>}
  </section>
}
