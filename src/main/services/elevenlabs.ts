import { isTagToken, toElevenLabsText } from '@shared/speech'
import { normalizeVoiceCategory, normalizeVoiceLanguage } from '@shared/voice-catalog'
import type { KeyTestResult, ModelOption, SharedVoiceAddInput, SharedVoiceSearchInput, SharedVoiceSearchResult, VoiceOption, VoiceUseCategory, WordTiming } from '@shared/types'
import { getSecret, requireSecret } from '../secrets'
import { getSettings } from '../settings'
import { readError } from './http'

const BASE = 'https://api.elevenlabs.io'

async function el<T>(path: string, init: RequestInit & { key?: string } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'xi-api-key': init.key ?? requireSecret('elevenlabs'),
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })
  if (!res.ok) {
    const detail = await readError(res)
    if (res.status === 401) throw new Error('Kunci ElevenLabs tidak valid atau tidak punya izin ini.')
    if (res.status === 402 || /quota|credits/i.test(detail)) throw new Error('Kuota karakter ElevenLabs habis.')
    if (res.status === 404) throw new Error('Suara ElevenLabs tidak ditemukan. Pilih suara lain.')
    if (res.status === 429) throw new Error('ElevenLabs sedang sibuk. Coba lagi sebentar.')
    throw new Error(`ElevenLabs gagal: ${detail}`)
  }
  return (await res.json()) as T
}

export async function testKey(key?: string): Promise<KeyTestResult> {
  const k = key ?? getSecret('elevenlabs')
  if (!k) return { ok: false, message: 'Kunci belum diatur' }
  try {
    const s = await el<{ character_count: number; character_limit: number }>('/v1/user/subscription', { key: k })
    const left = Math.max(0, s.character_limit - s.character_count)
    return { ok: true, message: `Terhubung · sisa ${left.toLocaleString('id-ID')} karakter` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

interface ElevenVoice {
  voice_id: string
  name: string
  category?: string | null
  labels?: Record<string, unknown> | null
  description?: string | null
  preview_url?: string | null
  language?: string | null
  locale?: string | null
  accent?: string | null
  gender?: string | null
  age?: string | null
  use_case?: string | null
  descriptive?: string | null
  public_owner_id?: string | null
  verified_languages?: { language?: string | null; locale?: string | null; accent?: string | null; model_id?: string | null; preview_url?: string | null }[] | null
  sharing?: { labels?: Record<string, unknown> | null; public_owner_id?: string | null } | null
}

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const distinct = (values: string[]): string[] => [...new Set(values.filter(Boolean))]
function mapVoice(voice: ElevenVoice, source: 'account' | 'library'): VoiceOption {
  const labels = Object.fromEntries(Object.entries({ ...(voice.sharing?.labels ?? {}), ...(voice.labels ?? {}) })
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([key, value]) => [key, value.trim()]))
  const verifiedLanguages: NonNullable<VoiceOption['verifiedLanguages']> = []
  for (const verified of voice.verified_languages ?? []) {
    const language = normalizeVoiceLanguage(clean(verified.language) || clean(verified.locale))
    if (!language) continue
    verifiedLanguages.push({ language, ...(clean(verified.locale) ? { locale: clean(verified.locale) } : {}),
      ...(clean(verified.accent) ? { accent: clean(verified.accent) } : {}), ...(clean(verified.model_id) ? { modelId: clean(verified.model_id) } : {}),
      previewUrl: clean(verified.preview_url) || null })
  }
  const languageValues = [clean(voice.language), clean(voice.locale), labels.language ?? '', ...verifiedLanguages.map(item => item.language)]
  const languages = distinct(languageValues.flatMap(value => value.split(/[,;/]/)).map(normalizeVoiceLanguage).filter((value): value is string => !!value))
  const useCases = [clean(voice.use_case), clean(voice.descriptive), labels.use_case ?? '', labels.use_cases ?? '', labels.descriptive ?? '', labels.descriptives ?? '']
  const categories = distinct(useCases.flatMap(value => value.split(/[,;/]/)).map(normalizeVoiceCategory))
  const accents = distinct([clean(voice.accent), labels.accent ?? '', ...verifiedLanguages.map(item => item.accent ?? '')])
  const publicOwnerId = clean(voice.public_owner_id)
  return {
    id: voice.voice_id, name: voice.name, description: clean(voice.description) || Object.values(labels).filter(Boolean).join(', ') || clean(voice.category),
    previewUrl: clean(voice.preview_url) || verifiedLanguages.find(item => item.previewUrl)?.previewUrl || null,
    languages, verifiedLanguages, accents, categories, labels, source,
    ...(clean(voice.category) ? { category: clean(voice.category) } : {}),
    ...(clean(voice.gender) || labels.gender ? { gender: clean(voice.gender) || labels.gender } : {}),
    ...(clean(voice.age) || labels.age ? { age: clean(voice.age) || labels.age } : {}),
    ...(source === 'library' && publicOwnerId ? { sharedVoice: { publicOwnerId, voiceId: voice.voice_id } } : {})
  }
}

/** Account voices, including custom voices whose language or use-case metadata is unknown. */
export async function listVoices(): Promise<VoiceOption[]> {
  const out: VoiceOption[] = []
  const ids = new Set<string>()
  const tokens = new Set<string>()
  let token: string | undefined
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ page_size: '100', include_total_count: 'false' })
    if (token) q.set('next_page_token', token)
    const r = await el<{
      voices: ElevenVoice[]
      has_more: boolean
      next_page_token?: string
    }>(`/v2/voices?${q}`, { signal: AbortSignal.timeout(30000) })
    for (const v of r.voices) {
      if (!v.voice_id || ids.has(v.voice_id)) continue
      ids.add(v.voice_id)
      out.push(mapVoice(v, 'account'))
    }
    if (!r.has_more || !r.next_page_token || tokens.has(r.next_page_token)) break
    tokens.add(r.next_page_token)
    token = r.next_page_token
  }
  return out
}

const LIBRARY_USE_CASES: Record<VoiceUseCategory, string[]> = {
  'social-media': ['social_media'], narration: ['narrative_story', 'audiobook'], education: ['informative_educational'],
  characters: ['characters_animation'], advertising: ['advertisement'], conversational: ['conversational']
}

/** Explicit library searches use provider metadata and do not add voices to the user's account. */
export async function searchSharedVoices(input: SharedVoiceSearchInput = {}): Promise<SharedVoiceSearchResult> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Permintaan pustaka suara tidak valid.')
  if (input.language !== undefined && input.language !== 'id' && input.language !== 'ms') throw new Error('Pilih bahasa Indonesia atau Melayu untuk pencarian pustaka.')
  if (input.category !== undefined && !Object.prototype.hasOwnProperty.call(LIBRARY_USE_CASES, input.category)) throw new Error('Kategori suara tidak dikenal.')
  if (input.search !== undefined && (typeof input.search !== 'string' || input.search.length > 200)) throw new Error('Pencarian suara maksimal 200 karakter.')
  const page = input.page ?? 0
  const pageSize = input.pageSize ?? 30
  if (!Number.isInteger(page) || page < 0 || page > 100) throw new Error('Halaman pustaka suara tidak valid.')
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('Jumlah suara per halaman harus 1–50.')
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort: 'trending' })
  if (input.language) query.set('language', input.language)
  if (input.search?.trim()) query.set('search', input.search.trim())
  if (input.category) for (const useCase of LIBRARY_USE_CASES[input.category]) query.append('use_cases', useCase)
  const result = await el<{ voices: ElevenVoice[]; has_more: boolean; total_count?: number }>(`/v1/shared-voices?${query}`, { signal: AbortSignal.timeout(30000) })
  const voices = [...new Map((result.voices ?? []).filter(voice => !!voice.voice_id).map(voice => [voice.voice_id, mapVoice(voice, 'library')])).values()]
  return { voices, hasMore: result.has_more === true, page,
    ...(Number.isFinite(result.total_count) ? { totalCount: result.total_count } : {}) }
}

/** Called only for the user's explicit 'add and use' action; speech must use the returned account ID. */
export async function addSharedVoice(input: SharedVoiceAddInput): Promise<VoiceOption> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Pilihan suara pustaka tidak valid.')
  const publicOwnerId = clean(input.publicOwnerId), voiceId = clean(input.voiceId), name = clean(input.name)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(publicOwnerId) || !/^[A-Za-z0-9_-]{1,128}$/.test(voiceId)) throw new Error('Identitas suara pustaka tidak valid.')
  if (!name || name.length > 100) throw new Error('Nama suara harus berisi 1–100 karakter.')
  const added = await el<{ voice_id: string }>(`/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`,
    { method: 'POST', body: JSON.stringify({ new_name: name }), signal: AbortSignal.timeout(30000) })
  if (!clean(added.voice_id)) throw new Error('ElevenLabs tidak mengembalikan identitas suara yang ditambahkan.')
  // Adding succeeded even if a subsequent detail request is temporarily unavailable. Do not invite a duplicate import.
  try {
    const detail = await el<ElevenVoice>(`/v1/voices/${encodeURIComponent(added.voice_id)}?with_settings=false`, { signal: AbortSignal.timeout(15000) })
    if (detail.voice_id === added.voice_id) return mapVoice(detail, 'account')
  } catch { /* The next account-catalog refresh can fill in language and preview metadata. */ }
  return { id: added.voice_id, name, description: '', source: 'account' }
}

/** Live list of ElevenLabs models that can do text-to-speech. */
export async function listModels(): Promise<ModelOption[]> {
  const r = await el<
    {
      model_id: string
      name?: string
      description?: string
      can_do_text_to_speech?: boolean
      languages?: { language_id: string; name: string }[]
      maximum_text_length_per_request?: number
    }[]
  >('/v1/models')
  return r
    .filter((m) => m.can_do_text_to_speech !== false)
    .map((m) => {
      const langs = m.languages ?? []
      const indo = langs.some((l) => /^(id|ind)$/i.test(l.language_id) || /indonesia/i.test(l.name))
      const malay = langs.some((l) => /^(ms|msa|may)$/i.test(l.language_id) || /malay|melayu/i.test(l.name))
      const limit = m.maximum_text_length_per_request
      return {
        id: m.model_id,
        name: m.name ?? m.model_id,
        description: [m.description?.slice(0, 200), limit ? `Maks ${limit.toLocaleString('id-ID')} karakter per permintaan` : '']
          .filter(Boolean)
          .join(' · '),
        contextLength: null,
        priceIn: null,
        priceOut: null,
        tags: [...(indo ? ['Indonesia'] : []), ...(malay ? ['Melayu'] : []), ...(langs.length ? [`${langs.length} bahasa`] : [])]
      }
    })
}

interface Alignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

function toWords(a: Alignment): WordTiming[] {
  const out: WordTiming[] = []
  let cur: WordTiming | null = null
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur)
      cur = null
      return
    }
    const s = a.character_start_times_seconds[i]
    const e = a.character_end_times_seconds[i]
    if (!cur) cur = { text: ch, start: s, end: e }
    else {
      cur.text += ch
      cur.end = e
    }
  })
  if (cur) out.push(cur)
  // Audio tags and <break> markup show up as characters but are not spoken words.
  return out.filter((w) => !isTagToken(w.text))
}

/**
 * Speaks narration and returns MP3 bytes plus exact word timings. `context` passes the text around this
 * part of a longer take, so ElevenLabs keeps the delivery continuous across requests.
 */
export async function speak(
  text: string,
  voiceId: string,
  languageCode: string,
  signal?: AbortSignal,
  context?: { previous?: string; next?: string },
  modelOverride?: string
): Promise<{ audio: Buffer; words: WordTiming[] }> {
  const model = modelOverride ?? getSettings().elevenModel
  const body: Record<string, unknown> = { text: toElevenLabsText(text, model), model_id: model }
  if (context?.previous) body.previous_text = toElevenLabsText(context.previous, model)
  if (context?.next) body.next_text = toElevenLabsText(context.next, model)
  // multilingual_v2 does not take a language_code; newer models do.
  if (model !== 'eleven_multilingual_v2') body.language_code = languageCode
  const r = await el<{ audio_base64: string; alignment?: Alignment }>(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    { method: 'POST', body: JSON.stringify(body), signal }
  )
  return { audio: Buffer.from(r.audio_base64, 'base64'), words: r.alignment ? toWords(r.alignment) : [] }
}
