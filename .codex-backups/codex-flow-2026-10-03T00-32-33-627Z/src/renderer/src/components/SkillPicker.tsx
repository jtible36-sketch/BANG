import { CONTENT_SKILLS, getContentSkill, type SkillId } from '@shared/skills'
import { Select } from './Select'

export function SkillPicker({ value, onChange, variant = '', compact = false }: {
  value: SkillId
  onChange: (id: SkillId, variant: string) => void
  variant?: string
  compact?: boolean
}) {
  const skill = getContentSkill(value)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <span className="mb-1.5 block text-sm font-semibold">Skill / jenis konten</span>
          <Select label="Skill / jenis konten" value={skill.id} onChange={(id) => {
            const next = getContentSkill(id)
            onChange(next.id, next.variants[0]?.id ?? '')
          }} options={CONTENT_SKILLS.map((item) => ({ value: item.id, label: item.name, note: item.description }))} menuWidth={440} />
        </div>
        {skill.variants.length > 0 && (
          <div className="min-w-[180px] flex-1">
            <span className="mb-1.5 block text-sm font-semibold">Jenis tampilan</span>
            <Select label="Jenis tampilan skill" value={variant || skill.variants[0].id} onChange={(next) => onChange(skill.id, next)}
              options={skill.variants.map((item) => ({ value: item.id, label: item.name }))} />
          </div>
        )}
      </div>
      {!compact && <p className="text-[13px] leading-relaxed text-ink-2">{skill.description} Arahan skill digunakan pada naskah, gambar, karakter, dan prompt Flow.</p>}
    </div>
  )
}
