import { useEffect, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { STYLE_CATEGORIES, VISUAL_STYLES, getStyle, isSelectableStyle, stylesForSkill, type StyleCategory } from '@shared/styles'
import { getContentSkill, type SkillId } from '@shared/skills'
import { StyleSwatch } from './StyleArt'
import { Segmented, cx } from './ui'

const CATEGORY_LABEL: Record<StyleCategory, string> = { '2d': '2D', '3d': '3D', realistis: 'Realistis' }

export function StylePicker({ value, onChange, skillId, renderIdeas }: { value: string; onChange: (id: string) => void; skillId?: SkillId; renderIdeas?: (id: string) => ReactNode }) {
  const current = getStyle(value)
  const hasSkill = !!skillId && skillId !== 'general'
  const [cat, setCat] = useState<StyleCategory | 'all' | 'recommended'>(hasSkill ? 'recommended' : 'all')
  useEffect(() => { setCat(hasSkill ? 'recommended' : 'all') }, [skillId])
  const recommended = stylesForSkill(skillId)
  const list = cat === 'recommended' ? recommended : VISUAL_STYLES.filter((s) => cat === 'all' || s.category === cat)
  const outside = !list.some((s) => s.id === value)
  const visible = outside && isSelectableStyle(value) ? [current, ...list] : list
  return (
    <div className="flex flex-col gap-3">
      <Segmented value={cat} onChange={setCat} options={[...(hasSkill ? [{ id: 'recommended' as const, label: 'Sesuai skill' }] : []), ...STYLE_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]} size="sm" className="self-start" />
      {cat === 'recommended' && <p className="text-xs leading-relaxed text-ink-2">Pilihan visual untuk {getContentSkill(skillId).name}. Kamu tetap bisa memilih gaya lain lewat Semua.</p>}
      {outside && <p className="rounded-lg border border-line bg-sand px-3 py-2 text-xs leading-relaxed text-ink-2">Gaya terpilih: <strong>{current?.name}</strong>. Pilihan ini tetap dipakai sampai kamu memilih gaya baru.</p>}
      <div className="grid grid-cols-2 gap-3">
        {visible.map((s) => {
          const on = s.id === value
          return (
            <div
              key={s.id}
              className={cx('group relative flex flex-col overflow-hidden rounded-[14px] bg-surface text-left transition-shadow', on ? 'border-2 border-accent shadow-ink-md' : 'border border-line hover:border-line-3')}
            >
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChange(s.id)}
              className="flex w-full flex-col text-left"
            >
              <span className="relative block aspect-video w-full overflow-hidden border-b border-line bg-sand">
                <StyleSwatch
                  styleId={s.id}
                  className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  iconSize={30}
                />
                <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-paper">
                  {CATEGORY_LABEL[s.category]}
                </span>
                {on && (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-[1.5px] border-ink bg-accent text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-0.5 px-3 pb-2.5 pt-2">
                <span className="text-sm font-semibold leading-tight">{s.name}</span>
                <span className="text-xs leading-snug text-ink-2">{s.niche}</span>
              </span>
            </button>
            {on && renderIdeas && <div className="border-t border-line p-2">{renderIdeas(s.id)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
