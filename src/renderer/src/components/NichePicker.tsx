import { useId, useState } from 'react'
import { nichesForContext } from '@shared/niches'
import type { Project } from '@shared/types'
import { Select } from './Select'

/** Editorial subject is independent of the optional research category filter. */
export function NichePicker({ value, context, onChange, disabled = false }: {
  value: string
  context: Pick<Project, 'styleId' | 'skillId' | 'skillVariant' | 'masterPrompt'>
  onChange(value: string): void
  disabled?: boolean
}) {
  const id = useId()
  const [custom, setCustom] = useState(false)
  const niches = nichesForContext(context)
  const known = niches.some((niche) => niche.value === value)
  const editingCustom = custom || (!!value && !known)
  return <section className="flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent-soft/30 p-4" data-niche-picker>
    <label className="text-sm font-semibold">Subjek / niche cerita</label>
    <Select label="Subjek / niche cerita" value={editingCustom ? '__custom__' : value} disabled={disabled}
      options={[{ value: '', label: 'Pilih subjek / niche' }, ...niches.map((niche) => ({ value: niche.value, label: niche.label, hint: niche.note })), { value: '__custom__', label: 'Niche custom · tulis sendiri' }]}
      onChange={(next) => { setCustom(next === '__custom__'); onChange(next === '__custom__' ? '' : next) }} menuWidth={440} />
    {editingCustom && <div className="flex flex-col gap-1.5"><label htmlFor={id} className="text-xs font-semibold">Niche custom</label><input id={id} aria-label="Niche custom" value={value} maxLength={120} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="Contoh: teknologi pangan kuno atau perilaku kucing" className="h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm outline-none focus:border-accent disabled:opacity-60" /></div>}
    <p className="text-xs leading-relaxed text-ink-2">Pilih fokus cerita sebelum membuat 10 ide. Rekomendasi mengikuti gaya visual dan master; niche custom tetap bisa dipakai.</p>
  </section>
}
