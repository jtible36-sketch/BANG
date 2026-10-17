import { useId } from 'react'
import { Box, Camera, Sparkles } from 'lucide-react'
import { getStyle, type StyleCategory } from '@shared/styles'
import { cx } from './ui'
import { hasStylePresetArt, StylePresetArt } from './StylePresetArt'
import { ArtRecipePreview } from './ArtRecipePreview'
import { getHuashuRecipe } from '@shared/huashu-catalog'

/** Gallery samples, including lossless Huashu panels cropped from the user's reference sheet. */
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
      <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#002637" /><stop offset="1" stopColor="#27515c" /></linearGradient>
      <linearGradient id={`${id}-terrain`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#C9986A" /><stop offset=".5" stopColor="#575C2E" /><stop offset="1" stopColor="#CDA972" /></linearGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#1e4961" floodOpacity=".32" /></filter>
    </defs>
    <path fill={`url(#${id}-sea)`} d="M0 0h360v210H0z" />
    <g filter={`url(#${id}-shadow)`}>
      <path fill={`url(#${id}-terrain)`} d="M-30 16 21 3 50 19 77 10 103 40 130 47 146 80 140 111 167 126 152 156 124 166 116 189 85 193 70 161 43 145 28 116 6 91-20 97Z" />
      <path fill={`url(#${id}-terrain)`} d="m270-9 30 17 16 26 25 6 36 33-18 42-32-5-14-29-34-16-23-41Z" />
      <path fill="#708353" d="m212 136 21-16 24 8 9 22-19 20-26-4-13-14Z" />
    </g>
    <g fill="none" stroke="#dce4b0" strokeWidth="1" opacity=".38">
      <path d="m-4 29 33 1 39 28 19 2 25 34-4 33 26 13-28 14-16-9-17-33-31-23-8-36Z" />
      <path d="m12 42 18 8 33 25 26 5 9 29-3 24-18-16-19-26-24-17Z" />
      <path d="m39 70 11 8 19 13 12 12 3 22-16-15-17-16Z" />
      <path d="m290 10 6 24 29 19 27 18-9 22-13-20-31-13-15-23Z" />
      <path d="m217 138 15-11 19 9 8 15-16 12-22-9Z" />
    </g>
    <path d="M82 67 115 87 119 116 147 135 132 151 109 148 94 117 69 97Z" fill="#D3631F" fillOpacity=".85" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    <path d="M118 116Q185 52 292 78" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 5" opacity=".65" />
    <g filter={`url(#${id}-shadow)`}>
      <path d="m179 62 22-6 21 7-3 24-19 13-19-14Z" fill="#fff" stroke="#111b24" strokeWidth="2" />
      <path d="m185 67 16-4 15 5-2 15-14 10-13-11Z" fill="#D3631F" />
      <path d="m193 78 6 6 10-13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="273" cy="82" r="21" fill="#FF4747" stroke="#fff" strokeWidth="2.5" />
      <path d="m265 74 16 16m0-16-16 16" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </g>
    <path d="m122 120 7 12h-14Z" fill="#141719" />
  </svg>
}

/** Existing sample image, illustrative preset preview, or a colored fallback tile. */
export function StyleSwatch({ styleId, className, iconSize = 26 }: { styleId: string; className?: string; iconSize?: number }) {
  const recipe = getHuashuRecipe(styleId)
  const thumb = styleThumb(styleId)
  if ((recipe && !thumb) || getStyle(styleId).galleryGroup === 'Galeri promo') return <span className={cx('block overflow-hidden', className)}><ArtRecipePreview styleId={styleId} /></span>
  if (styleId === 'map-animation') return <span className={cx('block overflow-hidden', className)}><MapPreview /></span>
  if (thumb) {
    return (
      <span className={cx('block overflow-hidden', className)} style={recipe ? { backgroundColor: getStyle(styleId).swatch } : undefined}>
        <img src={thumb} alt="" draggable={false} className={cx('size-full', recipe ? 'object-contain' : 'object-cover')} data-style-thumbnail={styleId} />
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
