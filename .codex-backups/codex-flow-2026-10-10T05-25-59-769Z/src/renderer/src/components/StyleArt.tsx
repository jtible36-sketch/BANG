import { useId } from 'react'
import { Box, Camera, Sparkles } from 'lucide-react'
import { getStyle, type StyleCategory } from '@shared/styles'
import { cx } from './ui'
import { hasStylePresetArt, StylePresetArt } from './StylePresetArt'

/**
 * Sample images for each visual style, generated with GPT Image 2.5. Each shows a different front-facing
 * character in that style, centered, so the pictures also work cropped to a square.
 */
const THUMBS = import.meta.glob('../assets/styles/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export function styleThumb(id: string): string | null {
  return THUMBS[`../assets/styles/${id}.webp`] ?? null
}

const CATEGORY_ICON: Record<StyleCategory, typeof Box> = { '2d': Sparkles, '3d': Box, realistis: Camera }

/** Illustrative daylight terrain preview; generated projects use verified geography. */
function MapPreview() {
  const id = useId().replace(/:/g, '')
  return <svg viewBox="0 0 360 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className="size-full" data-style-preview="map-animation">
    <defs>
      <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#286eaf" /><stop offset="1" stopColor="#55c5cf" /></linearGradient>
      <linearGradient id={`${id}-terrain`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9ab16c" /><stop offset=".5" stopColor="#52764c" /><stop offset="1" stopColor="#cbb582" /></linearGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#1e4961" floodOpacity=".32" /></filter>
      <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter>
    </defs>
    <path fill={`url(#${id}-sea)`} d="M0 0h360v210H0z" />
    <g filter={`url(#${id}-shadow)`}>
      <path fill={`url(#${id}-terrain)`} d="M-30 16 21 3 50 19 77 10 103 40 130 47 146 80 140 111 167 126 152 156 124 166 116 189 85 193 70 161 43 145 28 116 6 91-20 97Z" />
      <path fill={`url(#${id}-terrain)`} d="m270-9 30 17 16 26 25 6 36 33-18 42-32-5-14-29-34-16-23-41Z" />
      <path fill="#80a166" d="m212 136 21-16 24 8 9 22-19 20-26-4-13-14Z" />
    </g>
    <g fill="none" stroke="#dce4b0" strokeWidth="1" opacity=".38">
      <path d="m-4 29 33 1 39 28 19 2 25 34-4 33 26 13-28 14-16-9-17-33-31-23-8-36Z" />
      <path d="m12 42 18 8 33 25 26 5 9 29-3 24-18-16-19-26-24-17Z" />
      <path d="m39 70 11 8 19 13 12 12 3 22-16-15-17-16Z" />
      <path d="m290 10 6 24 29 19 27 18-9 22-13-20-31-13-15-23Z" />
      <path d="m217 138 15-11 19 9 8 15-16 12-22-9Z" />
    </g>
    <path d="M82 67 115 87 119 116 147 135 132 151 109 148 94 117 69 97Z" fill="#eeca42" fillOpacity=".16" stroke="#ffe15c" strokeWidth="8" filter={`url(#${id}-glow)`} />
    <path d="M82 67 115 87 119 116 147 135 132 151 109 148 94 117 69 97Z" fill="none" stroke="#fff391" strokeWidth="2.2" />
    <path d="M118 116Q185 52 292 78" fill="none" stroke="#83eaf0" strokeWidth="9" opacity=".65" filter={`url(#${id}-glow)`} />
    <path d="M118 116Q185 52 292 78" fill="none" stroke="#b4fbff" strokeWidth="2.5" strokeDasharray="5 5" />
    <g fill="#f8fbec" stroke="#ddebd7" strokeWidth="1"><path d="m184 72 15 6 18-5-1 5-12 5 1 7-4-1-4-8-14-5Z" /></g>
    <circle cx="118" cy="116" r="5" fill="#fff59b" stroke="#fff" strokeWidth="2" />
    <g fill="#fff" opacity=".2"><path d="M-10 22q44-18 94 3t96-2l17 12q-57 14-101-1T-10 39Z" /><path d="M257 165q52-21 109-3v20q-57-14-109-2Z" /></g>
  </svg>
}

/** Existing sample image, illustrative preset preview, or a colored fallback tile. */
export function StyleSwatch({ styleId, className, iconSize = 26 }: { styleId: string; className?: string; iconSize?: number }) {
  if (styleId === 'map-animation') return <span className={cx('block overflow-hidden', className)}><MapPreview /></span>
  const thumb = styleThumb(styleId)
  if (thumb) {
    return (
      <span className={cx('block overflow-hidden', className)}>
        <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
      </span>
    )
  }
  if (hasStylePresetArt(styleId)) {
    return <span className={cx('block overflow-hidden', className)}><StylePresetArt styleId={styleId} /></span>
  }
  const s = getStyle(styleId)
  const Icon = CATEGORY_ICON[s.category]
  return (
    <span className={cx('flex items-center justify-center', className)} style={{ background: s.swatch, color: s.ink }}>
      <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.6} />
    </span>
  )
}
