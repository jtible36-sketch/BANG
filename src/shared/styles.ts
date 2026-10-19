import { HEALTH_DIALOGUE_STYLES } from './health-dialogue'
import type { SkillId } from './skills'
import { SKILL_VISUAL_STYLES } from './skill-styles'
import { MAP_STYLE_LOCK } from './map-animation'
import { HUASHU_STYLE_ID, HUASHU_STYLE_PROMPT } from './huashu-motion'
import { HUASHU_ART_STYLES } from './huashu-catalog'
import { BANG_GALLERY_STYLES } from './bang-gallery'
import { CUTOUT_FACT_CHARACTER, CUTOUT_FACT_NAME, CUTOUT_FACT_STYLE, CUTOUT_FACT_STYLE_ID } from './cutout-facts'
import { HARDCUT_CHARACTER, HARDCUT_NAME, HARDCUT_STYLE, HARDCUT_STYLE_ID } from './hardcut-animation'

export type StyleCategory = '2d' | '3d' | 'realistis'

export interface VisualStyle {
  id: string
  name: string
  category: StyleCategory
  niche: string
  /** Tile colors used for the picker until a real sample image exists. */
  swatch: string
  ink: string
  /** Appended to every image prompt in the project. */
  prompt: string
  /** How characters should look on the character sheet. */
  characterHint: string
  /** Skill recommendations; general styles remain available to all projects. */
  skillIds?: SkillId[]
  /** Decorative illustrative preview preset, independent of generated assets. */
  preview?: string
  galleryGroup?: string
  summary?: string
  motionHint?: string
  palette?: string[]
  sourceRecipe?: string
  sourceUrl?: string
}

export const STYLE_CATEGORIES: { id: StyleCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: '2d', label: '2D' },
  { id: '3d', label: '3D' },
  { id: 'realistis', label: 'Realistis' }
]

const NO_TEXT = 'No text, no letters, no captions, no watermark, no logo.'

// Keep the original rendering presets in skill-styles for saved projects,
// while excluding these styles from every new choice and recommendation.
const RETIRED_STYLE_IDS = new Set([
  'cutout-photo', 'cutout-paper', 'cutout-editorial', 'cutout-vintage', 'cutout-cinematic',
  'health-organs', 'health-cells', 'health-stage', 'health-diagram', 'health-comic'
])

const LEGACY_HUASHU_STYLE: VisualStyle = {
  id: HUASHU_STYLE_ID, name: 'Huashu · Ilustrasi cat (versi awal)', category: '2d',
  niche: 'Ilustrasi seni bergerak · sains, sejarah, budaya, cerita',
  swatch: '#F4E8D0', ink: '#292622', preview: HUASHU_STYLE_ID, skillIds: ['huashu-art-motion'],
  prompt: HUASHU_STYLE_PROMPT,
  characterHint: 'an expressive painted 2D character with tactile gouache brushwork, consistent warm ivory, vermilion, muted-gold and charcoal palette; preserve approved reference identity'
}

/** Styles available for new selections, research and thumbnails. */
export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: CUTOUT_FACT_STYLE_ID, name: CUTOUT_FACT_NAME, category: 'realistis',
    niche: 'Fakta unik, sejarah, hewan, penemuan dan teknologi medis',
    swatch: '#479AD4', ink: '#172F3C', skillIds: ['animasi-cutout'], preview: CUTOUT_FACT_STYLE_ID,
    galleryGroup: 'Fotografi', summary: 'Explainer kolase fotografis 9:16 dengan aset terpisah, pose sesuai narasi, properti penjelas dan reaksi komedi.',
    motionHint: 'Satu aksi utama per shot; pose dan keyframe mengikuti rekaman narasi. Gunakan mask saat tertutup dan IK bila bagian tubuh terpisah siap; tinjau caption serta SFX sebelum ekspor.',
    palette: ['#479AD4', '#D7B66C', '#59654B', '#EBB5AE', '#55D76A'],
    prompt: CUTOUT_FACT_STYLE, characterHint: CUTOUT_FACT_CHARACTER
  },
  {
    id: HARDCUT_STYLE_ID, name: HARDCUT_NAME, category: 'realistis',
    niche: 'Sejarah benda sehari-hari ala Dafiology: hook 3 detik, kronologi hard-cut, overlay tahun besar',
    swatch: '#E8A33D', ink: '#1F1D1A', skillIds: ['animasi-cutout'], preview: HARDCUT_STYLE_ID,
    galleryGroup: 'Fotografi', summary: 'Preset gaya Dafiology: scene AI sinematik ±4 detik, hard cut sinkron narasi, overlay tahun/nama besar, karaoke caption hijau.',
    motionHint: 'Satu aksi per shot; pola gerak hanya pose-swap, slide-linear, hold, prop-reaction, camera-push. Selalu hard cut antar shot.',
    palette: ['#E8A33D', '#2AA5A0', '#1F1D1A', '#F5EFE0', '#55D76A'],
    prompt: HARDCUT_STYLE, characterHint: HARDCUT_CHARACTER
  },
  {
    id: 'map-animation', name: 'Map Animation', category: '3d',
    niche: 'Territory Highlight · geografi, perbandingan wilayah, fakta dunia',
    swatch: '#C9986A', ink: '#002637', preview: 'map', skillIds: ['bang-motion'],
    prompt: MAP_STYLE_LOCK,
    characterHint: 'No recurring actor cast. Use accurate territory/terrain subjects with one consistent glossy sticker icon family, anonymous painted portrait cards, expressive flat vector personified map faces or black line-art site symbols. Soft drop shadows, no real-person likeness or generated readable text.'
  },
  {
    id: 'stickman',
    name: 'Stickman berwarna',
    category: '2d',
    niche: 'Sejarah, kisah nyata',
    swatch: '#F2B266',
    ink: '#1F1D1A',
    prompt:
      '2D flat vector illustration frame for a YouTube storytelling video. Colorful, detailed flat background (never plain white). ALL characters are simple STICKMAN figures: thin black line bodies, arms and legs, plain round white heads with minimal cartoon faces (dot eyes, small eyebrows, simple mouth), no realistic anatomy. Each stickman wears only small costume pieces that match their role (hat, crown, sash, headcloth, props) while the stick body stays visible. Clean bold outlines, flat colors with light soft shading, every character in the same consistent stickman style, cinematic composition with depth. ' +
      NO_TEXT,
    characterHint: 'a stickman figure with a round white head and thin black line limbs, wearing role-specific costume pieces'
  },
  {
    id: 'flat',
    name: 'Kartun flat',
    category: '2d',
    niche: 'Sains, fakta, edukasi',
    swatch: '#8CCBE3',
    ink: '#1F1D1A',
    prompt:
      'Flat vector explainer illustration, bold geometric shapes, a limited harmonious color palette, clean lines, friendly cartoon characters with simple features, soft subtle grain texture, clear readable composition. ' +
      NO_TEXT,
    characterHint: 'a friendly flat vector cartoon character with simple geometric features'
  },
  {
    id: 'whiteboard',
    name: 'Whiteboard doodle',
    category: '2d',
    niche: 'Tutorial, bisnis',
    swatch: '#FFFFFF',
    ink: '#1F1D1A',
    prompt:
      'Hand-drawn whiteboard doodle, black marker line art on a clean white board, one accent color used sparingly (red or blue), simple sketchy characters, arrows and small icons, like a whiteboard animation explainer. ' +
      NO_TEXT,
    characterHint: 'a simple hand-drawn marker doodle character'
  },
  {
    id: 'collage',
    name: 'Kolase kertas',
    category: '2d',
    niche: 'Dokumenter, jurnalisme',
    swatch: '#E9D8BA',
    ink: '#1F1D1A',
    prompt:
      'Paper cut-out collage, layered textured paper, vintage photo cutouts, halftone print textures, torn edges, soft shadows between paper layers, editorial documentary style. ' +
      NO_TEXT,
    characterHint: 'a paper cut-out collage figure with textured paper layers',
    skillIds: ['animasi-cutout']
  },
  {
    id: 'watercolor',
    name: 'Buku cerita cat air',
    category: '2d',
    niche: 'Dongeng anak, religi',
    swatch: '#CFE3B5',
    ink: '#1F1D1A',
    prompt:
      "Children's storybook watercolor illustration, soft washes on textured paper, warm pastel palette, cute expressive characters, whimsical and cozy mood. " +
      NO_TEXT,
    characterHint: 'a cute storybook watercolor character'
  },
  {
    id: 'anime',
    name: 'Anime',
    category: '2d',
    niche: 'Drama, motivasi, fiksi',
    swatch: '#F5C3CD',
    ink: '#1F1D1A',
    prompt:
      'High-quality anime film still, clean cel shading, expressive characters, detailed painted background, cinematic lighting and color. ' +
      NO_TEXT,
    characterHint: 'an anime character with clean cel shading'
  },
  {
    id: 'noir',
    name: 'Komik noir',
    category: '2d',
    niche: 'Horor, true crime',
    swatch: '#2F3240',
    ink: '#FAF7F2',
    prompt:
      'Dark graphic-novel comic panel, heavy black ink shadows, high contrast, muted palette with a single accent color, dramatic angles, halftone texture, suspenseful mood. ' +
      NO_TEXT,
    characterHint: 'a graphic-novel character drawn with heavy ink shadows'
  },
  {
    id: 'pixel',
    name: 'Pixel art',
    category: '2d',
    niche: 'Gaming, nostalgia',
    swatch: '#8FD694',
    ink: '#1F1D1A',
    prompt: 'Detailed 16-bit pixel art scene, crisp pixels, limited retro palette, video game aesthetic, no blur. ' + NO_TEXT,
    characterHint: 'a 16-bit pixel art character sprite'
  },
  {
    id: 'animation3d',
    name: 'Animasi 3D',
    category: '3d',
    niche: 'Fabel, keluarga, anak',
    swatch: '#FFD66B',
    ink: '#1F1D1A',
    prompt:
      '3D animated feature film render, stylized characters with big expressive faces, soft global illumination, subsurface scattering, vibrant colors, cinematic depth of field. ' +
      NO_TEXT,
    characterHint: 'a stylized 3D animated film character with an expressive face'
  },
  {
    id: 'clay',
    name: 'Claymation',
    category: '3d',
    niche: 'Komedi, cerita anak',
    swatch: '#F4A988',
    ink: '#1F1D1A',
    prompt:
      'Claymation stop-motion scene, handcrafted plasticine characters and miniature sets, visible fingerprints and clay texture, soft studio lighting. ' +
      NO_TEXT,
    characterHint: 'a handcrafted plasticine clay character'
  },
  {
    id: 'lowpoly',
    name: 'Low-poly 3D',
    category: '3d',
    niche: 'Teknologi, sains',
    swatch: '#A7C7E7',
    ink: '#1F1D1A',
    prompt:
      'Low-poly 3D render, faceted geometric shapes, flat-shaded polygons, clean pastel colors, soft ambient lighting. ' + NO_TEXT,
    characterHint: 'a low-poly 3D character with faceted shapes'
  },
  {
    id: 'diorama',
    name: 'Diorama miniatur',
    category: '3d',
    niche: 'Sejarah, kota, perang',
    swatch: '#C9D9A6',
    ink: '#1F1D1A',
    prompt:
      'Tilt-shift miniature diorama, tiny detailed 3D figures and buildings, shallow depth of field, soft daylight, toy-like scale. ' +
      NO_TEXT,
    characterHint: 'a tiny detailed miniature figurine'
  },
  {
    id: 'cinematic',
    name: 'Sinematik realistis',
    category: 'realistis',
    niche: 'Misteri, sejarah, drama',
    swatch: '#56607A',
    ink: '#FAF7F2',
    prompt:
      'Photorealistic cinematic film still, dramatic natural lighting, shallow depth of field, anamorphic lens look, rich color grading, subtle 35mm film grain. ' +
      NO_TEXT,
    characterHint: 'a photorealistic person, cinematic lighting'
  },
  {
    id: 'documentary',
    name: 'Foto dokumenter',
    skillIds: ['animasi-cutout'],
    category: 'realistis',
    niche: 'Fakta, berita, alam',
    swatch: '#8A9A7B',
    ink: '#FAF7F2',
    prompt:
      'Realistic documentary photograph, natural light, authentic details, candid composition, high detail, true-to-life colors. ' +
      NO_TEXT,
    characterHint: 'a realistic documentary portrait of a person'
  },
  {
    id: 'archival',
    name: 'Arsip sejarah',
    skillIds: ['animasi-cutout'],
    category: 'realistis',
    niche: 'Sejarah, perang, tokoh',
    swatch: '#B9A488',
    ink: '#1F1D1A',
    prompt:
      'Vintage archival photograph, faded sepia or black and white, film grain, light scratches and dust, historical documentary look. ' +
      NO_TEXT,
    characterHint: 'a person in a vintage archival sepia photograph'
  },
  {
    id: 'epic',
    name: 'Fantasi epik',
    category: 'realistis',
    niche: 'Mitologi, legenda',
    swatch: '#6C5B8E',
    ink: '#FAF7F2',
    prompt:
      'Epic realistic fantasy concept art, highly detailed, volumetric light, grand scale, painterly realism, cinematic composition. ' +
      NO_TEXT,
    characterHint: 'an epic realistic fantasy character, concept art'
  },
  ...HEALTH_DIALOGUE_STYLES,
  ...SKILL_VISUAL_STYLES.filter((style) => !RETIRED_STYLE_IDS.has(style.id)),
  ...BANG_GALLERY_STYLES,
  ...HUASHU_ART_STYLES
]

export function getStyle(id: string): VisualStyle {
  return VISUAL_STYLES.find((s) => s.id === id) ?? SKILL_VISUAL_STYLES.find((s) => s.id === id) ?? (id === HUASHU_STYLE_ID ? LEGACY_HUASHU_STYLE : VISUAL_STYLES[0])
}

export function isSelectableStyle(id: string): boolean {
  return VISUAL_STYLES.some((style) => style.id === id)
}

export function stylesForSkill(skillId?: string): VisualStyle[] {
  if (!skillId || skillId === 'general') return VISUAL_STYLES
  const matches = VISUAL_STYLES.filter((style) => style.skillIds?.some((id) => id === skillId))
  return matches.length ? matches : VISUAL_STYLES
}
