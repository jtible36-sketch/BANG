import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Film, HeartPulse, Layers3, Palette, Search, Sparkles } from 'lucide-react'
import { CONTENT_SKILLS, defaultStyleForSkill, getContentSkill, variantForStyle, type SkillId } from '@shared/skills'
import { getStyle, stylesForSkill } from '@shared/styles'
import { nichesForContext } from '@shared/niches'
import { StyleSwatch } from './StyleArt'
import { Button, cx } from './ui'

export interface ProductionStyleSelection {
  skillId: SkillId
  styleId: string
  skillVariant: string
}

export interface ProductionStyleStudioProps {
  skillId: SkillId
  styleId: string
  skillVariant?: string
  onChange: (next: ProductionStyleSelection) => void
  disabled?: boolean
  compact?: boolean
  onContinue?: () => void
}

const skillIcon = (id: string) => id === 'bang-motion' ? Film : id === 'huashu-art-motion' ? Palette : id === 'animasi-cutout' ? Layers3 : id === 'explainer-animasi-kesehatan' ? HeartPulse : Sparkles

/** One selection controls the story, art direction, and character references throughout production. */
export function ProductionStyleStudio({ skillId, styleId, skillVariant, onChange, disabled = false, compact = false, onContinue }: ProductionStyleStudioProps) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('Semua')
  const [expanded, setExpanded] = useState(!compact)
  const skill = getContentSkill(skillId)
  const current = getStyle(styleId)
  const styles = useMemo(() => stylesForSkill(skillId), [skillId])
  const groups = useMemo(() => ['Semua', ...new Set(styles.map((style) => style.galleryGroup || (style.category === '2d' ? 'Animasi 2D' : style.category === '3d' ? 'Animasi 3D' : 'Fotografi')))], [styles])
  const visible = useMemo(() => styles.filter((style) => {
    const category = style.galleryGroup || (style.category === '2d' ? 'Animasi 2D' : style.category === '3d' ? 'Animasi 3D' : 'Fotografi')
    return (group === 'Semua' || group === category) && `${style.name} ${style.niche} ${style.summary || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())
  }), [styles, search, group])
  const niches = nichesForContext({ styleId, skillId, skillVariant }).slice(0, 4)
  const isCurrentInGallery = styles.some((style) => style.id === styleId)

  useEffect(() => { setSearch(''); setGroup('Semua') }, [skillId])

  const chooseSkill = (nextId: SkillId) => {
    if (disabled || nextId === skillId) return
    const nextStyle = defaultStyleForSkill(nextId)
    onChange({ skillId: nextId, styleId: nextStyle, skillVariant: variantForStyle(nextId, nextStyle) ?? '' })
    setExpanded(true)
  }
  const chooseStyle = (id: string) => {
    if (!disabled) onChange({ skillId, styleId: id, skillVariant: variantForStyle(skillId, id) ?? '' })
  }

  return <section data-production-style-studio className="overflow-hidden rounded-2xl border border-line bg-surface">
    {(!compact || expanded) && <div className={cx('border-b border-line', compact ? 'p-4' : 'p-5 lg:p-6')}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-surface">01</span>
        <div><h2 className="font-display text-lg font-bold tracking-tight">Pilih studio kreatif</h2><p className="mt-0.5 text-xs text-muted">Setiap skill punya bahasa visual dan cara bercerita sendiri.</p></div>
      </div>
      <div role="group" aria-label="Skill produksi" className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {CONTENT_SKILLS.map((item) => {
          const active = item.id === skillId
          const Icon = skillIcon(item.id)
          return <button key={item.id} type="button" data-skill-card={item.id} aria-pressed={active} disabled={disabled} onClick={() => chooseSkill(item.id)} className={cx('flex min-w-0 flex-col items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', active ? 'border-accent bg-accent-soft/40' : 'border-line bg-paper hover:border-line-3 hover:bg-sand')}>
            <span className="flex w-full items-center justify-between"><Icon className={cx('size-5', active ? 'text-accent' : 'text-ink-2')} />{active && <Check className="size-4 text-accent" />}</span>
            <span className="min-w-0"><span className={cx('block text-[13px] font-semibold leading-snug', active && 'text-accent-dark')}>{item.name}</span><span className="mt-1 block text-[11px] text-muted">{stylesForSkill(item.id).length} gaya visual</span></span>
          </button>
        })}
      </div>
      <p className="mt-3 max-w-[860px] text-xs leading-relaxed text-ink-2">{skill.description}</p>
    </div>}

    <div className={cx(compact ? 'p-4' : 'p-5 lg:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex size-7 items-center justify-center rounded-full border border-line-2 text-xs font-semibold text-ink-2">{compact && !expanded ? <Palette className="size-3.5" /> : '02'}</span><div><h3 className="font-display text-lg font-bold tracking-tight">{compact && !expanded ? 'Arah produksi' : 'Galeri gaya visual'}</h3><p className="mt-0.5 text-xs text-muted">{compact && !expanded ? skill.name : `${styles.length} pilihan untuk ${skill.name}`}</p></div></div>
        {compact && <button type="button" disabled={disabled} aria-expanded={expanded} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:bg-sand" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ringkas galeri' : 'Lihat semua gaya'}<ChevronDown className={cx('size-3.5 transition-transform', expanded && 'rotate-180')} /></button>}
      </div>

      {expanded && <>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Kelompok galeri" className="flex flex-1 flex-wrap gap-1.5">{groups.map((item) => <button key={item} type="button" aria-pressed={group === item} disabled={disabled} onClick={() => setGroup(item)} className={cx('rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors', group === item ? 'border-ink bg-ink text-surface' : 'border-line text-ink-2 hover:bg-sand')}>{item}</button>)}</div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 sm:w-[230px]"><Search className="size-3.5 text-muted" /><input aria-label="Cari gaya visual" type="search" value={search} disabled={disabled} onChange={(event) => setSearch(event.target.value)} placeholder="Cari gaya atau nuansa…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted" /></label>
        </div>
        <div role="group" aria-label={`Galeri ${skill.name}`} className={cx('scroll-thin mt-4 grid grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-3 lg:grid-cols-4', compact ? 'max-h-[390px]' : 'max-h-[540px]')}>
          {visible.map((style) => {
            const selected = style.id === styleId
            return <button key={style.id} data-gallery-style={style.id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => chooseStyle(style.id)} className={cx('group relative min-w-0 overflow-hidden rounded-xl border text-left transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', selected ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-3')}>
              <StyleSwatch styleId={style.id} className="aspect-[16/10] w-full bg-sand transition-transform duration-300 group-hover:scale-[1.025]" />
              <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">{style.category === 'realistis' ? 'Foto' : style.category}</span>
              {selected && <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-accent text-white shadow-sm"><Check className="size-3.5" /></span>}
              <span className="relative block bg-surface p-3"><span className="block text-xs font-semibold leading-snug">{style.name}</span><span className="mt-1 line-clamp-2 block text-[10px] leading-relaxed text-muted">{style.summary || style.niche}</span></span>
            </button>
          })}
        </div>
        {visible.length === 0 && <div role="status" className="mt-4 rounded-xl border border-dashed border-line-2 p-7 text-center text-sm text-ink-2">Belum ada gaya yang cocok. <button type="button" className="font-semibold text-accent underline" onClick={() => { setSearch(''); setGroup('Semua') }}>Tampilkan semua</button></div>}
        <p className="mt-2 text-[10px] text-muted">Pratinjau adalah ilustrasi arah seni. Hasil produksi mengikuti cerita dan referensi karaktermu.</p>
      </>}

      <div data-selected-art-direction className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-paper p-3.5">
        <StyleSwatch styleId={current.id} className="aspect-square w-[76px] shrink-0 overflow-hidden rounded-lg border border-line" />
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Arah visual terpilih</span>{!isCurrentInGallery && <span className="text-[10px] text-muted">Gaya proyek sebelumnya</span>}</div>
          <h4 className="mt-1 text-sm font-semibold">{current.name}</h4>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{current.motionHint || current.summary || 'Gerak, karakter, dan komposisi mengikuti narasi serta aturan master yang dipilih.'}</p>
          {niches.length > 0 && <p className="mt-1.5 text-[10px] text-muted">Cocok untuk: {niches.map((niche) => niche.label).join(' · ')}</p>}
        </div>
        {current.palette && <div aria-label="Palet gaya" className="flex -space-x-1">{current.palette.slice(0, 5).map((color, index) => <span key={`${color}-${index}`} title={color} className="size-5 rounded-full border-2 border-surface" style={{ backgroundColor: color }} />)}</div>}
        {onContinue && <Button size="sm" variant="primary" disabled={disabled} onClick={onContinue} icon={<ArrowRight className="size-4" />}>Lanjut ke riset cerita</Button>}
      </div>
    </div>
  </section>
}

export default ProductionStyleStudio
