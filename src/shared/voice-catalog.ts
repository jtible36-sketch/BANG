import type { VoiceOption, VoiceUseCategory } from './types'

export const VOICE_CATEGORIES: { id: VoiceUseCategory; label: string }[] = [
  { id: 'social-media', label: 'Media sosial' },
  { id: 'narration', label: 'Narasi dan cerita' },
  { id: 'education', label: 'Edukasi' },
  { id: 'characters', label: 'Karakter dan animasi' },
  { id: 'advertising', label: 'Iklan' },
  { id: 'conversational', label: 'Percakapan' }
]

export function normalizeVoiceLanguage(value: string): string | null {
  const raw = value.trim().toLowerCase().replace(/_/g, '-')
  const aliases: Record<string, string> = { indonesia: 'id', indonesian: 'id', 'bahasa indonesia': 'id', ind: 'id', malay: 'ms', melayu: 'ms', 'bahasa melayu': 'ms', malaysian: 'ms', msa: 'ms', may: 'ms', english: 'en', eng: 'en' }
  if (Object.prototype.hasOwnProperty.call(aliases, raw)) return aliases[raw]
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(raw) ? raw.split('-')[0] : null
}

export function normalizeVoiceCategory(value: string): string {
  const raw = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  const aliases: Record<string, VoiceUseCategory> = {
    'social-media': 'social-media', 'socialmedia': 'social-media', tiktok: 'social-media', youtube: 'social-media',
    narration: 'narration', narrative: 'narration', 'narrative-story': 'narration', audiobook: 'narration', storytelling: 'narration',
    educational: 'education', education: 'education', 'informative-educational': 'education', informative: 'education',
    characters: 'characters', animation: 'characters', 'characters-animation': 'characters',
    advertising: 'advertising', advertisement: 'advertising', 'advertisement-commercial': 'advertising', commercial: 'advertising',
    conversational: 'conversational', conversation: 'conversational'
  }
  return Object.prototype.hasOwnProperty.call(aliases, raw) ? aliases[raw] : raw
}

const unique = (items: string[]): string[] => [...new Set(items.filter(Boolean))]
export function voiceLanguages(voice: VoiceOption): string[] {
  const values = [...(voice.languages ?? []), ...(voice.verifiedLanguages ?? []).map(item => item.language)]
  if (voice.labels?.language) values.push(...voice.labels.language.split(/[,;/]/))
  return unique(values.map(normalizeVoiceLanguage).filter((value): value is string => !!value))
}
export function voiceCategories(voice: VoiceOption): string[] {
  const values = [...(voice.categories ?? [])]
  for (const key of ['use_case', 'use_cases', 'descriptive', 'descriptives']) if (voice.labels?.[key]) values.push(...voice.labels[key].split(/[,;/]/))
  return unique(values.map(normalizeVoiceCategory))
}
export function voiceMatchesLanguage(voice: VoiceOption, language?: string): boolean {
  if (!language || language === 'all') return true
  const code = normalizeVoiceLanguage(language)
  return !!code && voiceLanguages(voice).includes(code)
}
export function voiceMatchesCategory(voice: VoiceOption, category?: string): boolean {
  return !category || category === 'all' || voiceCategories(voice).includes(normalizeVoiceCategory(category))
}
export function filterVoiceCatalog(voices: readonly VoiceOption[], filter: { language?: string; category?: string; query?: string }): VoiceOption[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return voices.filter(voice => voiceMatchesLanguage(voice, filter.language) && voiceMatchesCategory(voice, filter.category)
    && (!query || [voice.name, voice.description, voice.id, ...(voice.accents ?? []), ...voiceLanguages(voice).map(voiceLanguageLabel), ...voiceCategories(voice), ...Object.values(voice.labels ?? {})].join(' ').toLowerCase().includes(query)))
}
export function voiceLanguageLabel(language: string): string {
  const code = normalizeVoiceLanguage(language)
  return ({ id: 'Indonesia', ms: 'Melayu', en: 'Inggris' } as Record<string, string>)[code ?? ''] ?? language
}
export function previewForVoice(voice: VoiceOption, language?: string): string | null {
  const code = language ? normalizeVoiceLanguage(language) : null
  return voice.verifiedLanguages?.find(item => normalizeVoiceLanguage(item.language) === code && item.previewUrl)?.previewUrl ?? voice.previewUrl ?? null
}
