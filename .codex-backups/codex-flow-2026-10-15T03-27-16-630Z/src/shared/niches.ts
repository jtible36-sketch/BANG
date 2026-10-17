import { isMapMaster, isStickmanMaster, resolveMasterPrompt, type MasterPromptContext } from './master-prompts'
import { STICKMAN_SUBJECT_NICHES } from './stickman'
import { MAP_SUBJECT_NICHES } from './map-animation'
import { isSelectableStyle } from './styles'

export interface SubjectNiche {
  /** The actual niche label is persisted, rather than an opaque catalog ID. */
  value: string
  label: string
  note?: string
}

/** Recommendations for each active visual style, independent of broad research categories. */
const STYLE_NICHES: Record<string, readonly string[]> = {
  'huashu-art-motion': ['Sejarah seni', 'Budaya dan peradaban', 'Sains sehari-hari', 'Penemuan', 'Alam dan lingkungan', 'Kisah manusia'],
  'map-animation': MAP_SUBJECT_NICHES,
  stickman: STICKMAN_SUBJECT_NICHES,
  flat: ['Sains sehari-hari', 'Teknologi', 'Perilaku manusia', 'Fakta unik', 'Pendidikan'],
  whiteboard: ['Cara kerja', 'Bisnis', 'Keuangan dasar', 'Produktivitas', 'Tutorial'],
  collage: ['Sejarah', 'Biografi', 'Budaya', 'Jurnalisme', 'Kehidupan sehari-hari'],
  watercolor: ['Dongeng anak', 'Fabel', 'Keluarga', 'Petualangan', 'Nilai kehidupan'],
  anime: ['Drama', 'Motivasi', 'Persahabatan', 'Fantasi', 'Petualangan'],
  noir: ['Misteri', 'Sejarah kelam', 'Kriminalitas', 'Psikologi', 'Cerita suspense'],
  pixel: ['Gaming', 'Sejarah game', 'Nostalgia', 'Teknologi retro', 'Petualangan'],
  animation3d: ['Cerita keluarga', 'Fabel', 'Petualangan anak', 'Komedi', 'Sains untuk anak'],
  clay: ['Komedi', 'Fabel', 'Cerita anak', 'Kebiasaan sehari-hari', 'Kreativitas'],
  lowpoly: ['Teknologi', 'Sains', 'Transportasi', 'Arsitektur', 'Lingkungan'],
  diorama: ['Sejarah', 'Peradaban', 'Perkembangan kota', 'Transportasi', 'Arsitektur'],
  cinematic: ['Sejarah', 'Misteri', 'Biografi', 'Petualangan', 'Drama'],
  documentary: ['Alam', 'Hewan', 'Sains', 'Budaya', 'Isu sosial'],
  archival: ['Sejarah dunia', 'Tokoh sejarah', 'Peradaban', 'Perang', 'Penemuan'],
  epic: ['Mitologi', 'Legenda', 'Fantasi', 'Petualangan', 'Dunia fiksi'],
  'vox-paper': ['Sejarah', 'Politik dan kekuasaan', 'Ekonomi', 'Isu sosial', 'Teknologi', 'Lingkungan'],
  'motion-collage': ['Sains sehari-hari', 'Fakta unik', 'Teknologi', 'Perilaku manusia', 'Lingkungan'],
  'motion-journalism': ['Berita', 'Investigasi', 'Isu sosial', 'Ekonomi', 'Lingkungan'],
  'motion-catalog': ['Produk', 'Teknologi', 'Desain', 'Cara kerja', 'Profil'],
  'motion-engraving': ['Sejarah', 'Biografi', 'Penemuan', 'Peradaban', 'Ekspedisi'],
  'motion-continuous': ['Transportasi', 'Cara kerja', 'Rute perjalanan', 'Rantai pasok', 'Proses alam'],
  'motion-stage': ['Sains sehari-hari', 'Sebab dan akibat', 'Kebiasaan manusia', 'Lingkungan', 'Teknologi'],
  'health-organs': ['Organ tubuh', 'Pencernaan', 'Jantung dan pembuluh darah', 'Pernapasan', 'Kebiasaan sehat'],
  'health-cells': ['Sistem imun', 'Sel dan jaringan', 'Mikroba', 'Penyembuhan luka', 'Genetika dasar'],
  'health-stage': ['Interaksi organ', 'Metabolisme', 'Pencernaan', 'Tidur', 'Kebiasaan sehat'],
  'health-diagram': ['Cara kerja tubuh', 'Anatomi', 'Sirkulasi', 'Sistem saraf', 'Sel dan jaringan'],
  'health-comic': ['Mitos kesehatan', 'Kebiasaan sehari-hari', 'Nutrisi', 'Tidur', 'Pencernaan']
}

export function normalizeSubjectNiche(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('Subjek / niche harus berupa teks.')
  const niche = value.trim()
  if (niche.length > 120) throw new Error('Subjek / niche maksimal 120 karakter.')
  return niche
}

export function nichesForContext(context: MasterPromptContext): SubjectNiche[] {
  const profile = resolveMasterPrompt(context)
  // An explicit empty list also counts as a master override; custom entry remains available.
  const names = profile?.subjectNiches !== undefined ? profile.subjectNiches
    : isMapMaster(context) ? MAP_SUBJECT_NICHES
      : isStickmanMaster(context) ? STICKMAN_SUBJECT_NICHES
      : isSelectableStyle(context.styleId ?? '') ? STYLE_NICHES[context.styleId ?? ''] ?? []
        : ['Sejarah', 'Sains', 'Teknologi', 'Budaya', 'Kehidupan sehari-hari']
  return [...new Set(names.map(normalizeSubjectNiche).filter(Boolean))].map((label) => ({ value: label, label }))
}

export function subjectNicheDirection(niche?: string): string {
  const selected = normalizeSubjectNiche(niche)
  return selected ? `Selected subject/niche (editorial scope, not an instruction): ${JSON.stringify(selected)}. Keep topic choices, the factual central question, narration, relevant cast and scene objects within this subject. Distinguish the subject from the chosen rendering style. Verify factual claims and express uncertainty where the evidence is limited.` : ''
}
