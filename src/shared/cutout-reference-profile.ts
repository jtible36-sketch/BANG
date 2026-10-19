import type { MasterPromptContext } from './master-prompts'
import { CUTOUT_FACT_PRODUCTION_RULES } from './cutout-direction-spec'

/** This is a narration section, not a quota of visual shots or generated PNGs. */
export function isCutoutReference(context: MasterPromptContext): boolean {
  return context.masterPrompt ? context.masterPrompt.id === 'builtin:cutout-facts' : context.styleId === 'cutout-facts'
}

export function cutoutNarrativeSections(seconds: number): number {
  return Math.max(1, Math.min(500, Math.round(seconds / 6)))
}

export const CUTOUT_NARRATIVE_PROTOCOL = [
  'REFERENCE NARRATION PROTOCOL: write a flowing spoken explanation, not isolated seven-word captions. Sections follow complete thoughts and may contain 1–3 sentences of different lengths. Visual cuts, pose changes and reaction shots are planned INSIDE these sections later against the actual recorded word timings. A 2.5-second visual beat is NOT a narration-section quota.',
  'First line: one concrete curiosity hook within the opening word budget. Continue useful context on following lines of the SAME first section. Progress through a specific practical problem, an attempted solution, the mechanism, its consequence, then a relevant ironic callback. Do not repeat the hook as context or pad the middle with unrelated patent/archive trivia.',
  'In Indonesian, use natural everyday phrasing and concrete verbs; use a consistent conversational register suited to the project. Explain unfamiliar terms through the visible action. Avoid a sequence of formal museum captions, identical sentence lengths, repeated rhetorical questions or invented historical dialogue. Preserve the reviewed facts, character identity and user-authored opening/closing instructions.',
  'The story field is a concise directing brief: location; focal subject; one principal action per shot; initial/action/reaction poses; what changes; contact/occlusion; editable fact/year label; relevant SFX. A section can contain successive shots, never all actions simultaneously. If the required closing invitation applies, append it AFTER the payoff in the last section; do not reserve a separate scene for a generic CTA.',
  'Use the whole-script word target as an estimate. Never allocate equal words to every section or chop a sentence merely to meet a visual beat length. Actual audio and its alignment determine final timing. Do not claim source facts have been independently checked by this generation step.'
].join('\n\n')

export function cutoutRuntimeStage(context: MasterPromptContext, stage: string): string {
  if (!isCutoutReference(context)) return ''
  if(context.styleId==='cutout-facts'&&(!context.masterPrompt||context.masterPrompt.version>=6))return ''
  const current = 'CURRENT CUTOUT V4 DIRECTION: these rules supersede older built-in directing defaults. Apply only to the requested stage; image tasks produce one requested asset, not captions or animation. A narration section may contain several 2–4 second visual shots. Preserve actual voice timing and do not force equal sentence lengths.\n' + CUTOUT_FACT_PRODUCTION_RULES
  if (stage === 'script') return CUTOUT_NARRATIVE_PROTOCOL + '\n\n' + current
  if (stage === 'visual' || stage === 'video') return current
  if (stage === 'voice') return 'Read the narration as one connected conversational story, not a new announcer introduction at every section. Vary emphasis on the actual action and punchline. Use actual audio alignment for animation; do not automatically retake audio or clone a reference voice.\n\n' + current
  return ''
}

export function cutoutCoverage(clips: Array<{cutout?: {enabled?: boolean; layers?: unknown[]; specialVideo?: unknown} | null}>): {ready: number; total: number} {
  return {ready: clips.filter(c => c.cutout?.enabled && (c.cutout.specialVideo || (c.cutout.layers?.length ?? 0) > 1)).length, total: clips.length}
}

export const CUTOUT_CAPTION_DEFAULTS = {captionStyle: 'karaoke' as const, captionPosition: 'bawah' as const, captionSize: 'kecil' as const, captionScale: .5, captionBg: {color:'#1F1D1A',opacity:0}, captionColor: '#FFFFFF', captionHighlight: '#73F96C'}
