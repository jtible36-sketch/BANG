import type { Character, Clip, Project } from './types'

/** The user's master prompt is a visual preset, not a chat-state instruction. */
export const VOX_STYLE_ID = 'vox-paper'

/** Verbatim visual block from the supplied documentary paper-collage master. */
export const VOX_STYLE_BLOCK = 'hand-cut documentary paper collage on aged newsprint and archival map surfaces, black and white halftone photograph cutouts with rough scissor-cut edges and offset accent strokes, torn paper edges, masking tape fragments, typewriter caption strips, rubber stamp marks, red string and brass pins where the story calls for connections, desaturated archival palette of tan, ink black, and halftone gray with ONE hot red signal accent and a restrained mustard yellow secondary, condensed bold headline lettering only where a label is specified, visible print grain and paper fiber, matte, flat even documentary lighting with soft cutout drop shadows.'

/** Verbatim closer. Other project formats only replace its 16:9 ratio. */
export const VOX_IMAGE_CLOSER = 'Every element must appear physically hand-cut and layered from real paper, with visible cutout edges, halftone print texture, and soft shadow separation between layers. The composition stays clean, minimal, and editorial with generous negative space. NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no clutter, no watermark, no logos, no text beyond the specified label. Premium documentary collage aesthetic, 16:9, ultra-detailed, 8K.'

export const VOX_THUMBNAIL_CLOSER = VOX_IMAGE_CLOSER.replace('no text beyond the specified label', 'no text beyond the specified thumbnail words')

/** Exact 10-second hand-off, intentionally independent of generic shot controls. */
export const VOX_UNIVERSAL_VIDEO_PROMPT = `Transform the provided image into a 10-second premium editorial documentary paper-collage animation. Preserve the final composition of the provided image exactly. Do not redesign, reposition, resize, or replace any element. The provided image is the FINISHED frame that the animation builds toward.
Style: hand-cut documentary paper collage in motion. Aged newsprint and archival surfaces, halftone photo cutouts, torn edges, tape, stamps, red string, typewriter strips. Every element moves as a rigid physical paper piece. Visible cutout thickness, print grain, soft layered shadows. Stop-motion cadence, stepped easing, 2-3 frame holds, the hand-made "cutting on twos" feel. Never smooth CGI motion.
CAMERA, STRICT: the camera stays completely locked for the entire clip. No zoom, no pan, no tilt, no rotation, no orbit, no dolly, no tracking, no handheld shake, no focus pulls, no reframing, no cuts, no transitions, no morphing, no object replacement, no time skips. One continuous static shot.
0 TO 7 SECONDS, BUILD-ON ASSEMBLY: the frame opens on the EMPTY background plate only. Elements enter one by one, back to front, in narrative order. Each entrance lands with a tiny handcrafted bounce and casts a real layered shadow. No element moves again after it lands. By 7 seconds the frame exactly matches the provided image.
7 TO 10 SECONDS, LIVING PAPER POSTER: everything holds position. Only subtle life remains: paper corners lift a millimeter, halftone dots shimmer faintly, string tension quivers once, shadows breathe.
AUDIO: no music, no narration, no voices. Only close-up paper ASMR: paper sliding, cardstock taps, tape press, stamp thud, string zip, pin click, soft room tone. All subtle.
FINAL RULE: the finished clip must feel like a real editorial paper collage assembling itself on a table, then holding as a living poster, matching the provided image exactly from 7 seconds to the end.`

export const VOX_SCRIPT_DIRECTION = 'Write an Indonesian documentary narration following the supplied Fern writing direction: calm, precise, restrained and mostly short declarative sentences, one idea per sentence, ending every sentence with a period. Start with a 30-40 word cold open in 3-4 sentences using a verified precise date, named location and small concrete action. Do not invent dates, quotations, facts, identities or locations to satisfy the structure; when evidence is missing, state the limit and use only documented detail. No warm-up, rhetorical questions, exclamations, direct address, hype or em dash. Use temporal and causal connections. Each sentence must be visually representable. Attribute disputed details. Treat real tragedy with restraint, no gore or suffering close-ups. Target 2.5 words per second within 5 percent of the chosen custom duration. Split into 2-3 second visual beats of about 5-8 words, separating longer clauses where natural, with one visual idea per beat. Timecodes follow cumulative words divided by 2.5, rounded to one decimal. End with a factual cliffhanger of at most 12 words: an unresolved physical object, later date, missing piece, quiet contradiction or human/financial cost. Titles have a concrete date, place, person, number or event hook without deceptive clickbait. Voice direction: calm deadpan male narrator, mid-range, mild gravitas, about 155 wpm, minimal emotion spikes; ElevenLabs settings guidance only: stability around 55, similarity around 80, low style, speaker boost on. Prepare 20-25 second recording batches for a human to review; never trigger paid re-generations automatically.'

export const VOX_VISUAL_DIRECTION = 'Use the supplied VOX documentary paper-collage visual master. For each beat define one dominant halftone photographic hero (about 70 percent of the visual weight), at most 2-3 supporting paper artifacts and a restrained background (about 10 percent), with generous negative space. Repeat recurring subject descriptions identically. Default to no text; only a beat carrying an important date, name or number may specify one label of 1-4 words. No fabricated authentic archival documents, source photographs or evidence: label generated historical reconstruction in project context. Tan, ink black and halftone gray, one hot red signal accent and restrained mustard. Locked static camera, rigid physical paper pieces, stepped stop-motion timing with 2-3 frame holds. Every image is the finished composition. For its 10-second Flow clip, assemble from an empty background from 0-7 seconds, back to front in narrative order, then hold the exact finished image from 7-10 seconds with only subtle paper life. No element moves after landing. No smooth CGI, parallax camera, pan, zoom, lip sync, morphing or first-frame-preservation directions. Add narration separately, and keep generated clip audio to subtle paper ASMR. A 2-3 second narration beat is independent of the 10-second generated source clip and is trimmed/scheduled in editing.'

export function isVoxStyle(styleId: string): boolean {
  return styleId === VOX_STYLE_ID
}

/** Keep local preview and export consistent with the locked-camera source prompt. */
export function normalizeVoxClipMotion(clip: Clip): Clip {
  if (clip.cameraPreset === 'static' && clip.motionStrength === 'halus' && clip.transition === 'cut' && clip.videoPrompt === VOX_UNIVERSAL_VIDEO_PROMPT) return clip
  return { ...clip, cameraPreset: 'static', motionStrength: 'halus', transition: 'cut', videoPrompt: VOX_UNIVERSAL_VIDEO_PROMPT }
}

export function voxWordTarget(durationSec: number): number {
  return Math.max(1, Math.round((Number.isFinite(durationSec) ? Math.max(0, durationSec) : 60) * 2.5))
}

export function voxBeatCount(durationSec: number): number {
  return Math.max(1, Math.round((Number.isFinite(durationSec) ? Math.max(0, durationSec) : 60) / 2.5))
}

function closerForRatio(aspectRatio: string): string {
  const ratio = ['16:9', '9:16', '1:1'].includes(aspectRatio) ? aspectRatio : '16:9'
  return VOX_IMAGE_CLOSER.replace('16:9', ratio)
}

const VOX_COMPOSITION = 'COMPOSITION: one hero element carrying about 70% of visual weight, at most 2-3 supporting elements, restrained background around 10%, generous negative space. One visual idea. No text by default; when this scene specifies an important date, name or number, render only one explicit label of 1-4 words. Generated reconstructions are editorial illustrations, never forged authentic photographs, documents or evidence.'

function sceneWithoutStyle(scene: string): string {
  let clean = scene.split(VOX_STYLE_BLOCK).join('').split(VOX_COMPOSITION).join('')
  for (const ratio of ['16:9', '9:16', '1:1']) clean = clean.split(closerForRatio(ratio)).join('')
  return clean.replace(/^\s*(?:ART STYLE|STYLE BLOCK|CLOSER)\s*:\s*$/gim, '').trim().replace(/^SCENE:\s*/i, '')
}

export function voxImagePrompt(scene: string, aspectRatio: string, cast?: string): string {
  let cleanScene = sceneWithoutStyle(scene)
  const identity = cast?.trim()
  // A saved visualPrompt may already be a complete VOX prompt from story generation.
  if (identity) cleanScene = cleanScene.replace(/\n\nRecurring subject identity, repeat these descriptions identically in every appearance:\n[\s\S]*?(?=\n\n|$)/, '').trim()
  return [
    `SCENE: ${cleanScene || 'One dominant documentary subject, with a clear factual visual hook.'}`,
    identity ? `Recurring subject identity, repeat these descriptions identically in every appearance:\n${identity}` : '',
    VOX_COMPOSITION,
    VOX_STYLE_BLOCK,
    closerForRatio(aspectRatio)
  ].filter(Boolean).join('\n\n')
}

function thumbnailWords(text: string): string {
  return text.replace(/["“”\r\n]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ').toLocaleUpperCase('id-ID')
}

export function voxThumbnailPrompt(title: string, summary: string, hook?: string): string {
  const headline = thumbnailWords(title) || 'KISAH TERUNGKAP'
  const second = thumbnailWords(hook ?? '')
  return [
    `A ${summary.trim() || title.trim() || 'documentary subject'} as the single dominant hero cutout in high-contrast black and white halftone with rough scissor-cut edges and a red offset accent stroke. If the hero depicts a real person, add a black censor bar over the eyes. Use supplied real-person references accurately; any generated reconstruction remains an editorial illustration and must not impersonate authentic evidence. Set the hero on aged torn newsprint that bleeds off frame, a huge condensed all-caps torn-label headline reading "${headline}" in black on a hot red bar${second && second !== headline ? `, a second smaller mustard stamp-box label reading "${second}"` : ''}, one rough red marker circle around the key element, desaturated tan and ink palette with hot red and mustard accents, extreme contrast, poster-scale readability at 200px. At most two text elements, each at most three words. No other readable text.`,
    VOX_STYLE_BLOCK,
    VOX_THUMBNAIL_CLOSER
  ].join('\n\n')
}

/** Distinct layouts of the same sourced subject, without invented hooks or evidence. */
export function voxThumbnailPrompts(title: string, summary: string, hook?: string): string[] {
  return [
    'Place the single large hero on the left, with headline in the clear lower-right area and ample empty aged paper above.',
    'Place the single large hero centrally, with the headline as a lower torn-label banner and a small upper-corner stamp; supporting details stay subordinate.',
    'Use a tighter hero crop on the right, preserving its identity and the factual key detail; place the headline in clear paper space on the left.'
  ].map((layout) => voxThumbnailPrompt(title, `${summary.trim() || title.trim()}. ${layout}`, hook))
}

/** Custom thumbnail copy retains its content, with mandatory style exactly once. */
export function voxThumbnailRenderPrompt(prompt: string): string {
  let clean = prompt.split(VOX_STYLE_BLOCK).join('').split(VOX_THUMBNAIL_CLOSER).join('')
  for (const ratio of ['16:9', '9:16', '1:1']) clean = clean.split(closerForRatio(ratio)).join('')
  return [
    clean.trim(),
    'THUMBNAIL RULES: one dominant halftone photographic hero, at most two specified text elements of 1-3 words each in condensed all-caps, readable at 200px, one red/yellow highlight device. If a real person is depicted, use a black censor bar over the eyes. Generated reconstruction must not impersonate authentic evidence. Output ratio 16:9.',
    VOX_STYLE_BLOCK,
    VOX_THUMBNAIL_CLOSER
  ].filter(Boolean).join('\n\n')
}

/** A single plain-text bulk file: one complete image prompt per beat, no numbering. */
export function voxBulkImagePrompts(project: Project, clips: Clip[], characters: Character[]): string {
  return clips.map((clip) => voxImagePrompt(
    clip.visualPrompt.trim() || clip.story.trim() || clip.title.trim(),
    project.aspectRatio,
    characters.filter((character) => clip.characterIds.includes(character.id))
      .map((character) => `${character.name}: ${character.description}`).join('\n')
  ).replace(/\s+/g, ' ').trim()).join('\n\n')
}
