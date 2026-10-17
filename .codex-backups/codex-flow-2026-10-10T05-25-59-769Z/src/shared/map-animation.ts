import { MAP_ANIMATION_SOURCE } from './map-animation-source'

/** Verbatim prefix required by the supplied visual bible. */
export const MAP_STYLE_LOCK = 'Photorealistic high-altitude satellite imagery in bright, clear daylight, Google Earth clarity, saturated natural colors (vivid greens, warm browns, deep-to-turquoise blue oceans), subtle horizon haze, 3D terrain relief, soft cloud shadows, clean professional geo-spatial motion graphics, 9:16 vertical.'

/** An explicitly chosen horizontal project adapts only the format clause. */
export function mapStyleLock(aspectRatio: string = '9:16'): string {
  return aspectRatio === '16:9' ? MAP_STYLE_LOCK.replace('9:16 vertical.', '16:9 horizontal.') : MAP_STYLE_LOCK
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

const MAP_FACT_DIRECTION = 'Use real, verifiable geographic facts and geographically accurate positions, borders, terrain and routes. Do not invent statistics or certainty. Round only when the source supports an approximation; mark unresolved facts as (verify) in planning, never present them as established narration. Use neutral language for disputed territories and show their status without taking a side. No graphic violence or identifiable real people. Generated satellite-like frames are geographic illustrations, not authenticated satellite evidence.'

const MAP_VISUAL_BIBLE = 'Always bright, clear natural daylight; no dark, dim or nighttime maps. Keep the lighting, saturated natural palette, terrain relief and icon design consistent across all four scenes. Fixed neon semantics: RED = danger/conflict/restricted areas; YELLOW = highlights/measurements/targets; BLUE or CYAN = safe routes/water/legal paths. Neon has a crisp bright core and restrained soft bloom. Use minimalist matching airplane, ship, pin, warning and X icons with realistic soft terrain shadows. No readable text, logos, flags, watermarks or baked captions; all labels are added during editing. Keep essential graphics within horizontal 10–90% and vertical 10–80% of the frame: this intersects the central safe area with the required top 10% and bottom 20% clearance for platform UI/captions.'

const MAP_CAMERA_DIRECTION = 'Fluid cinematic 3D tracking, isometric tilts and smooth pans with natural ease-in/ease-out. One primary camera move per scene plus subtle secondary drift. No hard cuts, jump cuts, whip-pans, morphing, distorted borders, flicker or camera shake inside a scene. Scene 1 must open at a wide high-altitude continental view and plunge into the target region through a hyper-smooth kinetic zoom while its neon border materializes. Later scenes evolve the exact previous final frame; never reset the camera or invent a new opening image.'

export const MAP_RESEARCH_DIRECTION = [
  'Plan exactly ten distinct geo-spatial documentary Short concepts matching the selected subject/niche. Each concept has four eight-second source scenes: shocking HOOK, minimum CONTEXT, revealing TWIST, resolving PAYOFF. Research an accurate core fact for each, describe the hook, context, twist and payoff, and explain its editorial potential with an honest comparative score rather than a guaranteed viral outcome. Vary regions and continents; do not repeat the same region unless a selected local niche explicitly calls for it.',
  MAP_FACT_DIRECTION,
  'Return the structured research schema requested by the application. Its topic selection, duration and review controls implement the original two-phase workflow; do not stop to ask chat questions or emit a Markdown table when JSON is requested.'
].join('\n\n')

export const MAP_SCRIPT_DIRECTION = [
  'Geo-spatial documentary narration: exactly four chronological scenes, each with an eight-second source animation. Standard total is 32 seconds; an explicit edited project duration changes narration/edit targets without changing the four-scene source continuity contract. Scene 1 HOOK makes a precise, counter-intuitive claim within the first two seconds and opens a curiosity loop. Scene 2 CONTEXT adds only the background needed, with fresh geographic information. Scene 3 TWIST reframes the hook through scale, a supported surprising number or a reversal. Scene 4 PAYOFF resolves the loop and echoes the opening claim for replay. Keep the first line a short factual hook. If the project asks for a follow/subscribe invitation, place a brief invitation after the factual payoff without replacing it or omitting the echo.',
  'Use the selected narration language rather than the reference default English. Default narration budget per eight-second scene: English 16–20 words, Indonesian 14–18 words; leave about half a second before and after speech. Honor explicit per-scene word budgets supplied by the app when duration is edited. Fast, mysterious and restrained documentary delivery; concise, natural phrasing, no fabricated sensationalism.',
  MAP_FACT_DIRECTION,
  'Use the app narration/story schema. Plan map locations, overlays and camera states as visual direction; avoid human dialogue, actor casting, Markdown/code block wrappers and interactive pause commands.'
].join('\n\n')

export const MAP_IMAGE_DIRECTION = [
  MAP_STYLE_LOCK,
  'Only Scene 1 has a standalone generated image: a high-altitude wide continental or regional view, realistic 3D topography and ocean depth, centered target region, its glowing neon outline only beginning to form. This is a start frame, not a montage or contact sheet. Scenes 2–4 use the exact last frame of the previous generated video as their start frame and must not receive independent generated images.',
  MAP_VISUAL_BIBLE, MAP_FACT_DIRECTION
].join('\n\n')

export const MAP_VIDEO_DIRECTION = [
  MAP_STYLE_LOCK,
  'Each video is one continuous eight-second source scene. Put the verbatim style lock above at the very start of every copied Image Prompt and Video Prompt. Use these explicit blocks after it: START STATE; CAMERA; TIMELINE: 0–2s / 2–5s / 5–8s; END STATE; AVOID. END STATE specifies exact framing, camera orientation/scale, geography, overlay positions/colors and icons. For Scene 1, START STATE is its generated wide image. For Scenes 2–4, START STATE must restate the preceding END STATE exactly and use the actual last frame uploaded from that video. Do not claim a planned still is the actual last frame. The source video lasts eight seconds even when the edited clip target differs.',
  MAP_VISUAL_BIBLE, MAP_CAMERA_DIRECTION, MAP_FACT_DIRECTION,
  'Scene 2 adds context through a smooth pan or isometric tilt and seamlessly appearing icons/lines. Scene 3 reveals its factual twist through a motivated smooth camera change and consistent icons; the pattern interrupt changes information, not style. Scene 4 resolves with a smooth zoom-out, tilt or safe path drawing, retaining continuity. Keep narration/audio out of image generation: voiceover and music are separate production tracks; plan bass whooshes on plunges, digital scans on line reveals, radar beeps on pins, and a restrained twist impact. Do not print Audio or Publish Pack material inside the visual frame.'
].join('\n\n')

export const MAP_VISUAL_DIRECTION = [
  'Plan exactly four map scenes in order: HOOK → CONTEXT → TWIST → PAYOFF. Preserve reviewed narration verbatim. The subjects are real geographic locations, routes and overlays rather than recurring human actors; return no invented actor cast. The scene image represents its start-state geography. Only Scene 1 may be generated as an independent image; subsequent start images are captured from the preceding video final frame.',
  MAP_VIDEO_DIRECTION,
  'Describe each END STATE before planning the next START STATE. Return complete scene motion containing START STATE, CAMERA, three timed beats and END STATE. No schema shortcut, generic pan-only placeholder or promise of a reference frame that has not been imported. The app controls review/navigation; do not ask for a pasted script or a selected number.'
].join('\n\n')

export const MAP_THUMBNAIL_DIRECTION = [
  MAP_STYLE_LOCK,
  'One factual, recognizable region with one large focal neon border, route or geographic anomaly. Bright 3D satellite-style terrain, fixed neon semantics and one consistent relevant icon. High clarity at small size; no text, logo, flag, watermark, fake evidence or contradictory geography. This is a separate cover image, never a substitute for the previous scene final frame.',
  MAP_FACT_DIRECTION
].join('\n\n')

export const MAP_VOICE_DIRECTION = 'Selected-language fast, mysterious documentary voiceover, clear and restrained, about 16–20 English or 14–18 Indonesian words per eight-second source clip, with roughly half a second of silence at each edge. Follow reviewed narration verbatim. Low atmospheric drone stays ducked beneath narration and builds toward payoff. Bass whooshes follow camera plunges; digital scans follow border/line reveals; radar beeps follow pins/icons; a subtle impact underlines the twist. Audio is added in production, not generated into the visual frame. No automatic paid retakes.'
