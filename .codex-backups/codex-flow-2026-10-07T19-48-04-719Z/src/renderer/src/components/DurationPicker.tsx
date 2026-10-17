import { useEffect, useId, useRef, useState } from 'react'
import { DURATIONS } from '@shared/models'
import { parseDurationDraft } from '@shared/duration'
import { Chip } from './ui'

export function DurationPicker({ value, onChange, compact = false, onValidityChange }: {
  value: number
  onChange: (value: number) => void
  compact?: boolean
  onValidityChange?: (valid: boolean) => void
}) {
  const id = useId()
  const [unit, setUnit] = useState<'seconds' | 'minutes'>('seconds')
  const [draft, setDraft] = useState(String(value))
  const ownChange = useRef<number | null>(null)
  useEffect(() => {
    if (ownChange.current === value) { ownChange.current = null; return }
    setDraft(String(unit === 'minutes' ? Math.round(value / 60 * 10000) / 10000 : value))
  }, [value])
  const parsed = parseDurationDraft(draft, unit)
  const invalid = parsed === null
  useEffect(() => { onValidityChange?.(!invalid) }, [invalid, onValidityChange])
  return (
    <div className={`flex flex-col gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex flex-wrap gap-1.5" aria-label="Pilihan durasi">
        {DURATIONS.map((d) => (
          <Chip key={d.sec} on={value === d.sec} onClick={() => {
            ownChange.current = d.sec
            onChange(d.sec)
            setDraft(String(unit === 'minutes' ? d.sec / 60 : d.sec))
          }}>{d.label}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="font-semibold">Durasi custom</label>
        <input
          id={id} aria-label="Durasi custom" aria-invalid={invalid} aria-describedby={`${id}-hint`}
          type="text" inputMode="decimal" value={draft} placeholder="90 atau 1:30"
          onChange={(event) => {
            setDraft(event.target.value)
            const next = parseDurationDraft(event.target.value, unit)
            if (next !== null) { ownChange.current = next; onChange(next) }
          }}
          className={`h-9 w-28 rounded-lg border bg-surface px-2.5 text-sm outline-none focus:border-accent ${invalid ? 'border-accent' : 'border-line-2'}`}
        />
        <select aria-label="Satuan durasi" value={unit} onChange={(event) => {
          const next = event.target.value as 'seconds' | 'minutes'
          setUnit(next)
          setDraft(String(next === 'minutes' ? Math.round(value / 60 * 10000) / 10000 : value))
        }} className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm">
          <option value="seconds">Detik</option><option value="minutes">Menit</option>
        </select>
        <span id={`${id}-hint`} className={invalid ? 'text-accent-dark' : 'text-muted'}>
          {invalid ? 'Isi 1 detik–24 jam. Format menit:detik juga bisa.' : 'Boleh desimal atau menit:detik. Maks. 24 jam per proyek.'}
        </span>
      </div>
    </div>
  )
}
