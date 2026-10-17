import { VOICE_TAGS } from './speech'

/** These project defaults take precedence over a master's opening/closing instructions. */
const CLOSERS: Record<string, string> = {
  id: 'Kalau mau konten seperti ini, jangan lupa follow dan subscribe.',
  ms: 'Kalau mahu kandungan seperti ini, jangan lupa follow dan subscribe.',
  en: 'For more content like this, remember to follow and subscribe.',
  jv: 'Yen pengin konten kaya iki, aja lali follow lan subscribe.',
  su: 'Upami hoyong konten sapertos kieu, ulah hilap follow sareng subscribe.',
  es: 'Para más contenido como este, recuerda seguirnos y suscribirte.',
  ar: 'للمزيد من المحتوى مثل هذا، لا تنسَ المتابعة والاشتراك.'
}

export function closingInvitation(language: string): string {
  return CLOSERS[language] ?? CLOSERS.id
}

export function withoutDeliveryTags(value: string): string {
  return value.replace(/<([^<>]{1,40})>|\[([^\[\]]{1,40})\]/gu, (match, angle: string | undefined, square: string | undefined) =>
    VOICE_TAGS.includes((angle ?? square ?? '').trim().toLowerCase()) ? ' ' : match
  ).trim()
}

export function narrationWordCount(value: string): number {
  return withoutDeliveryTags(value).split(/\s+/u).filter(Boolean).length
}

export function hookWordBudget(wordsPerSecond: number): number {
  return Math.max(1, Math.floor(3 * wordsPerSecond))
}

/** A one-scene draft may put its closer on subsequent lines. The hook is always line one. */
export function hasShortOpening(value: string, maxWords: number, singleScene = false): boolean {
  const opening = singleScene ? value.trim().split(/\r?\n/u)[0] : value.trim()
  return Boolean(opening) && !/[<>]/u.test(opening) && opening === withoutDeliveryTags(opening) && narrationWordCount(opening) <= maxWords
}

export function scriptEngagementDirection(language: string, wordsPerSecond: number): string {
  return [
    'MANDATORY USER OPENING AND CLOSING RULES: these override any conflicting master prompt instruction about the cold open, viewer address or prohibition of a subscription request only. Keep all other factual, visual and voice rules.',
    `Start at time zero with a concrete, accurate curiosity hook in the FIRST narration line, at most ${hookWordBudget(wordsPerSecond)} spoken words (target within the first 3 seconds at ${wordsPerSecond} words/second). No greeting, title, intro or pause/delivery tag before or within the hook. Never invent a shocking claim.`,
    `Resolve the factual story before the final invitation. End the LAST narration with this exact spoken sentence: "${closingInvitation(language)}". Use the invitation only once, at the end; the first line must never be the invitation.`,
    'Include the hook and invitation in the total spoken-word budget. The final invitation is exempt from the normal per-beat word maximum and from a master rule against addressing the viewer. A single-scene draft puts the short hook on line one and the ending on subsequent lines. For a target too short for both, retain both and allow the actual voice duration to exceed the target.'
  ].join(' ')
}

/** Preserve the factual ending if a model omits the required CTA; never discard it for a sales line. */
export function ensureClosingInvitation(narration: string, language: string): string {
  const closer = closingInvitation(language)
  const clean = narration.trim()
  if (withoutDeliveryTags(clean).endsWith(closer)) return clean
  // A model may vary the requested CTA. Replace just a trailing invitation sentence, not the facts before it.
  const sentences = clean.split(/(?<=[.!?])\s+/u)
  const tail = sentences.at(-1) ?? ''
  const isInvitation = /(?:follow|subscribe|seguirnos|suscribirte|المتابعة|الاشتراك)/iu.test(tail) &&
    /(?:jangan lupa|remember|aja lali|ulah hilap|recuerda|لا تنس)/iu.test(tail)
  if (isInvitation) sentences.pop()
  return [...sentences.filter(Boolean), closer].join('\n')
}
