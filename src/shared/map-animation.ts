import { MAP_ANIMATION_SOURCE } from './map-animation-source'
import {
  LEGACY_MAP_STYLE_LOCK, LEGACY_MAP_RESEARCH_DIRECTION, LEGACY_MAP_SCRIPT_DIRECTION,
  LEGACY_MAP_IMAGE_DIRECTION, LEGACY_MAP_VIDEO_DIRECTION, LEGACY_MAP_VISUAL_DIRECTION,
  LEGACY_MAP_THUMBNAIL_DIRECTION, LEGACY_MAP_VOICE_DIRECTION
} from './map-animation-legacy'

// Saved v1 profiles continue to execute their original satellite/neon bible.
export * from './map-animation-legacy'

/** Verbatim prefix required by the supplied Territory-Highlight visual bible. */
export const MAP_STYLE_LOCK = 'Bright natural-daylight top-down satellite basemap with a subtle tilting-3D camera feel and gentle hillshade terrain relief, natural slightly muted color grade (deep navy-teal oceans, olive-green lowlands, warm tan deserts and plateaus, medium contrast), no haze, never dark, flat semi-transparent solid-color territory fills with a crisp white outline and no neon glow, glossy sticker-style icons with soft drop shadows, continuous cut-free kinetic zoom-roll-pan camera with ease-in and ease-out, clean broadcast-grade motion-graphics finish, 9:16 vertical.'

export type MapFillMode = 'generated' | 'post'
export type MapTargetColor = 'orange' | 'rose'

/** An explicitly chosen horizontal project adapts only the format clause. */
export function mapStyleLock(aspectRatio: string = '9:16', legacy = false): string {
  const lock = legacy ? LEGACY_MAP_STYLE_LOCK : MAP_STYLE_LOCK
  return aspectRatio === '16:9' ? lock.replace('9:16 vertical.', '16:9 horizontal.') : lock
}

/** Version numbers on custom masters are user-owned; inspect their actual bible. */
export function isLegacyMapProfile(profile: { id?: string; version?: number; sourceText?: string; stages?: Record<string, string> } | null | undefined): boolean {
  if (!profile) return false
  if (profile.id === 'builtin:map-animation' && profile.version === 1) return true
  const text = [profile.sourceText ?? '', ...Object.values(profile.stages ?? {})].join('\n')
  return text.includes(LEGACY_MAP_STYLE_LOCK)
    || text.includes('Fixed neon semantics: RED = danger/conflict/restricted areas')
    || text.includes('specializing in 3D satellite-map motion graphics and geo-spatial documentary Shorts')
}

export const MAP_SOURCE_VIDEO_SECONDS = 8
export const MAP_DEFAULT_SCENE_COUNT = 4
export const MAP_DEFAULT_DURATION_SEC = 32
export const MAP_DURATION_OPTIONS_SEC = [32] as const
export const MAP_SUBJECT_NICHES = [
  'Borders & Enclaves', 'Straits & Chokepoints', 'Flight Routes', 'Rivers & Changing Courses',
  'Islands & Coastlines', 'Extreme Geography', 'Maritime Boundaries', 'Trade & Shipping Routes',
  'Mountains & Terrain', 'Cities & Infrastructure', 'Historical Geography', 'Natural Hazards'
] as const

export const MAP_MASTER_SOURCE_TEXT = MAP_ANIMATION_SOURCE

const MAP_FACT_DIRECTION = 'Use only real, verifiable geographic facts and accurate territory positions, borders, terrain and routes. Never invent statistics or certainty. Use official rounded area, population and date figures; use about only for supported approximations and tag unresolved items (verify) in planning, never as established narration. Keep disputed borders and conflict wording neutral. No graphic violence or identifiable real people. Generated satellite-like basemaps are geographic illustrations, not authenticated satellite evidence.'

const MAP_VISUAL_BIBLE = 'Territory-Highlight Explainer: bright natural daylight, top-down deep-focus basemap, subtle tilt and hillshade relief, natural slightly muted navy-teal oceans, olive lowlands and warm tan terrain; no clouds, haze, night, glow, bloom, gradients or depth-of-field blur. Fix one target fill color for the whole video: flat semi-transparent orange #D3631F at about 85% opacity or rose-red #B85B54 at about 60%, with crisp white 3–8 px outline scaled with zoom and about 15% relief visible. Neighbor scale comparison uses flat red #D53028 at 85–90% and green #4A7B25 at 65%; fade in and dissolve out without covering the target. Color means territory identity, never an invented danger classification. Coral #FF4747 circle with white rounded X means wrong/contradiction only. Keep icon design consistent and use realistic soft drop shadows: glossy sticker symbols ~12% frame width, thick black line-art ~13%, contradiction badge ~38%, anonymous painted 3:4 portrait cards tilted ±5–10°, expressive flat vector personified face ~20% with thick black outline and white sclera, or small black triangular site pin. These are symbolic overlays, not a recurring actor cast or real-person likeness. No generated readable text, logos, flags, real crests or watermarks. Every label, date, stat and pin caption is added in post. Keep essentials within x=10–90% and y=10–80%, respecting top 10% and bottom 20% platform clearance.'

const MAP_CAMERA_DIRECTION = 'One continuous cut-free eight-second camera move per scene, with gentle secondary drift/roll ±5–8°. Smooth eased zoom, pan, roll 3–20° and breathing; no static hold over ~2.5 s, and new visual information at least every ~3 s. No hard cuts, jump cuts, whip-pans, morphing, distorted borders, flicker or camera shake inside the source scene. Scene 1 starts wide over the continent with target already filled at ~12–15% frame width in GENERATED mode, then kinetic ease-out plunge ~4–8× into target. In POST mode both the initial target fill and subsequent vector fills/outlines remain editing layers, never baked into generated basemap. Later scenes evolve the exact previous final frame without changing daylight, palette, fill identity or icon design. Icon entrances use 0→110%→100% spring scale; exits shrink/dissolve; cards idle-sway gently. Scene 4 returns smoothly to the Scene 1 wide framing for a visual loop.'

export const MAP_POST_OVERLAY_DIRECTION = 'Each scene requires a separate POST OVERLAY SHEET. One row per item: time | element | text | position | size | animation. Time is local 0–8 seconds, tied to a narration keyword. Primary label: bold Poppins-style geometric sans, white sentence case, black ~50% shadow (4 px right/6 px down, blur 5 px), roll-following tilt −8° to −15°, width 25–45%, letter-by-letter reveal ~0.6 s. Sub-region labels are ~60% of primary size. Stat/date slam is oversized bold italic, enters ~150% width cropped, settles at 45–60% in lower-left within the safe zone, then fades; area figures align and roll with territory long axis. Optional hand-lettered white semi-serif leader label uses thin ~3 px vertical line. Neighbor labels are italic white ~60%; pin label is a ~90% black rounded rectangle with regular white ~24 px text and small black triangle. Never generate this text inside imagery. In POST fill mode list accurately sourced target/comparison polygon fills and white outline as separate vector editing layers with timings, selected colors, opacity and camera tracking; do not claim AI frames provide precise boundary data. Add required provider attribution in editing when real third-party tiles are used; no watermark.'

export const MAP_RECIPE_DIRECTION = 'Choose a concept recipe and carry it through all four scenes. Recipe [A] SCALE/SIZE: S1 plunge plus leader label; S2 area/stat aligned with territory long axis, roll/push; S3 pull out for neighbor comparison, dissolve, punch in; S4 pin at key site with detail drift, then return to opening wide for loop. Recipe [B] REGIONS/TENSION: S1 plunge, two stickers, contradiction badge, primary label and line-art; S2 supported date/stat, anonymous portrait cards and symbolic face smug→wary; S3 smooth fast zoom into sub-region 1 and face tense→alarmed→resigned; S4 sub-region 2, face worried→drained, wide zoom-out and final post label lockup. Adapt only to verified content, avoid false implications or sensationalism.'

/** Explicit mode/color override follows the verbatim style lock without changing it. */
export function mapFillDirection(mode: MapFillMode = 'generated', color: MapTargetColor = 'orange'): string {
  const target = color === 'rose' ? 'rose-red #B85B54 at about 60% opacity' : 'warm orange #D3631F at about 85% opacity'
  return mode === 'post'
    ? `FILL_MODE: POST. Mode override takes precedence over the fill clause in the style lock: generated image/video frames render only the natural basemap, camera motion and permitted non-text symbolic icons; absolutely no territory fill or white boundary outline. TARGET_COLOR: ${target}, fixed across this video. Put target/comparison fills and white 3–8 px outline into the separate Post Overlay Sheet as accurately sourced vector layers with timings and camera tracking, to be applied in editing.`
    : `FILL_MODE: GENERATED. TARGET_COLOR: ${target}, fixed across this video. The generator renders the flat target/comparison fills and crisp white 3–8 px outline over the basemap; the target is already filled at the Scene 1 opening, about 12–15% frame width. About 15% terrain relief shows through. All readable labels, stats, dates and pin captions remain separate Post Overlay Sheet items, never generated text. Switch to POST when borders are distorted.`
}

export const MAP_RESEARCH_DIRECTION = [
  'Plan exactly ten distinct geo-spatial documentary Short concepts for the selected subject/niche, four eight-second scenes each: precise shocking HOOK, minimum CONTEXT, supported TWIST, resolving PAYOFF. Every concept must be buildable using territory fills, stickers, supported stats, neighbor comparisons, sub-regions, symbolic faces or site pins. Vary continents, themes and regions without repetition. End the topic title with [A] or [B] for its recipe. Keep each concept component concise, ideally at most 20 words. Explain comparative editorial potential honestly; scores are not measured popularity or a promise of virality.',
  MAP_RECIPE_DIRECTION, MAP_FACT_DIRECTION,
  'Return the structured research schema requested by the app. Topic selection and review implement the original two-phase workflow; do not stop to ask chat questions or emit a Markdown table when JSON is requested.'
].join('\n\n')

export const MAP_SCRIPT_DIRECTION = [
  'Exactly four chronological scenes, eight-second source animation each, normally 32 seconds total. An explicitly edited duration changes narration/edit targets, never the source continuity contract. Scene 1 delivers a precise counter-intuitive hook within 2 seconds; contradiction/reversal lands before 2.5 s and opens a curiosity loop. Scene 2 adds minimum geographic context with fresh information. Scene 3 reframes it via verified scale/number/reversal or symbolic face reaction. Scene 4 resolves and echoes the opening claim; final framing mirrors opening wide. Keep first narration line a short factual hook. Preserve the app-required brief follow/subscribe invitation after the factual payoff/echo, without replacing it.',
  'Use the selected narration language. Per eight-second scene: English 16–20 words, Indonesian 14–18; narration is continuous, no pause over ~0.4 s, with only ~0.15 s head/tail room for clean joins. Honor explicit app per-scene budgets when duration is edited. Fast mysterious documentary delivery without fabricated sensationalism.',
  MAP_RECIPE_DIRECTION, MAP_FACT_DIRECTION,
  'Use the app story/narration schema. Describe locations, symbolic overlays and camera actions, not human dialogue or recurring actor casting. Do not return Markdown wrappers or interactive pause commands.'
].join('\n\n')

export const MAP_IMAGE_DIRECTION = [
  MAP_STYLE_LOCK,
  'Only Scene 1 has a standalone generated image: wide high-altitude continent/region, realistic ocean depth, target ~12–15% frame width, centered safe composition and no text. GENERATED mode starts with selected solid target fill and crisp white outline already visible; POST mode omits every territory fill and outline. This is a start frame, not a montage/contact sheet. Scenes 2–4 must use the exact last frame of the previous generated video, never independent generated images.',
  MAP_VISUAL_BIBLE, MAP_FACT_DIRECTION
].join('\n\n')

export const MAP_VIDEO_DIRECTION = [
  MAP_STYLE_LOCK,
  'Each source video is exactly eight continuous seconds. Start every copied Image/Video Prompt with the verbatim style lock. Use START STATE; CAMERA; TIMELINE 0–2s / 2–5s / 5–8s; END STATE; AVOID. END STATE precisely describes camera position, scale, roll, geography and generated fill/icon positions/colors, excluding post-only text/vector layers. Scene 1 START STATE is its generated wide image; Scenes 2–4 restate the preceding END STATE exactly and use that actual uploaded final frame. Never claim a planned still is the actual last frame. Reviewed narration and Audio/SFX and Post Overlay Sheet are separate editing plans, not content to print into imagery.',
  MAP_VISUAL_BIBLE, MAP_CAMERA_DIRECTION, MAP_RECIPE_DIRECTION, MAP_FACT_DIRECTION,
  'AVOID always includes hard cuts, generated text, logos, real crests, flags, watermark, real-person likeness, neon bloom, morphing, flicker, camera shake, dark lighting and distorted borders. Plan bass whooshes on plunges/pull-outs, pops on icon/label entrances, soft scans on fill/outline reveals and a restrained twist impact. In POST mode these reveals are editing-layer events, not baked vector overlays. Deliver a separate timed Post Overlay Sheet; it never changes the exact rendered START/END STATE chain.'
].join('\n\n')

export const MAP_VISUAL_DIRECTION = [
  'Plan four scenes in order HOOK → CONTEXT → TWIST → PAYOFF, using the concept recipe [A] or [B]. Preserve reviewed narration verbatim. Real geographic subjects and optional symbolic stickers, anonymous painted portrait cards or personified map faces need no recurring actor/character-sheet cast. Only Scene 1 has an independent start image; subsequent scenes use captured previous-video final frames.',
  MAP_VIDEO_DIRECTION, MAP_POST_OVERLAY_DIRECTION,
  'First describe each rendered END STATE, then use exactly that text as the next rendered START STATE. Return complete timed camera/visual plans and a distinct per-scene postOverlaySheet. No generic pan placeholder or promise of an unimported reference. Labels/stats are always post-only; in POST fill mode generated scene states include no fills/outlines. App controls review, schema and navigation; do not ask for a selected number or pasted script.'
].join('\n\n')

export const MAP_THUMBNAIL_DIRECTION = [
  MAP_STYLE_LOCK,
  'Separate cover image: one factual recognizable region, selected flat target fill with crisp white outline in GENERATED mode, one consistent sticker/pin/contradiction symbol or geographic comparison. In POST mode leave basemap unfilled and plan vector fill/outline for editing. Slightly muted daylight satellite terrain, no neon, haze, bloom, generated readable text, logo, flag, real crest, watermark, real likeness or fake evidence. High clarity at small size; never use this cover as a scene continuation frame.',
  MAP_FACT_DIRECTION
].join('\n\n')

export const MAP_VOICE_DIRECTION = 'Selected-language fast mysterious documentary narration, clear and restrained, 16–20 English or 14–18 Indonesian words per eight-second source clip. Follow reviewed narration verbatim, continuous flow with no pause over ~0.4 seconds, ~0.15-second head/tail room for clean joins. Low atmospheric music around −18 dB mean remains ducked under voice, builds toward payoff, fades only final ~0.4 s. Bass whooshes follow plunges/pull-outs, pop on icon/badge/post label entrances, soft scan on fill/outline reveals, subtle impact on twist, synchronized to narration keywords. These are editing plans, no automatic sound generation or paid retakes.'

export function mapPresetDirections(legacy = false): { styleLock: string; research: string; script: string; image: string; video: string; visual: string; thumbnail: string; voice: string } {
  return legacy
    ? { styleLock: LEGACY_MAP_STYLE_LOCK, research: LEGACY_MAP_RESEARCH_DIRECTION, script: LEGACY_MAP_SCRIPT_DIRECTION, image: LEGACY_MAP_IMAGE_DIRECTION, video: LEGACY_MAP_VIDEO_DIRECTION, visual: LEGACY_MAP_VISUAL_DIRECTION, thumbnail: LEGACY_MAP_THUMBNAIL_DIRECTION, voice: LEGACY_MAP_VOICE_DIRECTION }
    : { styleLock: MAP_STYLE_LOCK, research: MAP_RESEARCH_DIRECTION, script: MAP_SCRIPT_DIRECTION, image: MAP_IMAGE_DIRECTION, video: MAP_VIDEO_DIRECTION, visual: MAP_VISUAL_DIRECTION, thumbnail: MAP_THUMBNAIL_DIRECTION, voice: MAP_VOICE_DIRECTION }
}
