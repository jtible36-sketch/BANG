import type { Character, Clip, Project } from './types'
import { getStyle } from './styles'
import { skillDirection } from './skills'
import { voxImagePrompt } from './vox'
import { isLegacyMapMaster, isMapMaster, isStickmanMaster, isVoxMaster, mapFillMode, mapStyleLockForContext, mapTargetColor, masterStageDirection, resolveMasterPrompt } from './master-prompts'
import { subjectNicheDirection } from './niches'
import { STICKMAN_CHARACTER_SHEET_DIRECTION, STICKMAN_STYLE_BLOCK, STICKMAN_VIDEO_DIRECTION } from './stickman'
import { LEGACY_MAP_IMAGE_DIRECTION, LEGACY_MAP_STYLE_LOCK, LEGACY_MAP_VIDEO_DIRECTION, MAP_STYLE_LOCK, MAP_VISUAL_DIRECTION, mapStyleLock } from './map-animation'
import { huashuStageDirection } from './huashu-motion'

/** A continuation uses the previous rendered video, never a separately generated still. */
export function mapClipUsesPreviousFrame(project: Project, clip: Clip): boolean {
  if (!isMapMaster(project)) return false
  const marker = /^\s*START FRAME:\s*(SCENE_IMAGE|PREVIOUS_VIDEO)\b/im.exec(clip.videoPrompt)?.[1]
  if (marker) return marker === 'PREVIOUS_VIDEO'
  return clip.sort > 0
}

export function mapClipImageEligible(project: Project, clip: Clip): boolean {
  return !mapClipUsesPreviousFrame(project, clip)
}

/** Retain the exact vertical bible and adapt only its aspect declaration for a horizontal project. */
function mapDirection(direction: string): string {
  return [MAP_STYLE_LOCK, LEGACY_MAP_STYLE_LOCK, mapStyleLock('16:9'), mapStyleLock('16:9', true)]
    .reduce((result, lock) => result.replaceAll(lock, ''), direction).trim()
}

const MAP_PLAN_FIELDS = /^(?:FILL MODE|TARGET COLOR|START FRAME|START STATE|CAMERA|TIMELINE|END STATE|AVOID|AUDIO PLAN|POST OVERLAY SHEET|PUBLISH PACK):/i

function mapPlanField(plan: string, field: string): string {
  const lines = plan.replace(/\r\n?/g, '\n').split('\n')
  const index = lines.findIndex(line => line.trimStart().toUpperCase().startsWith(`${field}:`))
  if (index < 0) return ''
  const result = [lines[index].slice(lines[index].indexOf(':') + 1).trim()]
  for (let cursor = index + 1; cursor < lines.length; cursor++) {
    if (MAP_PLAN_FIELDS.test(lines[cursor].trimStart())) break
    result.push(lines[cursor])
  }
  return result.join('\n').trim()
}

/** These are editing deliverables, never instructions sent to a visual generator. */
export function buildMapPostOverlaySheet(project: Project, clip: Clip): string {
  return isMapMaster(project) ? mapPlanField(clip.videoPrompt, 'POST OVERLAY SHEET') : ''
}

export function buildMapAudioPlan(project: Project, clip: Clip): string {
  return isMapMaster(project) ? mapPlanField(clip.videoPrompt, 'AUDIO PLAN') : ''
}

export function buildMapPublishPack(project: Project, clips: Clip[]): string {
  if (!isMapMaster(project)) return ''
  const ordered = [...clips].sort((left, right) => left.sort - right.sort)
  return ordered.length ? mapPlanField(ordered[ordered.length - 1].videoPrompt, 'PUBLISH PACK') : ''
}

function mapTerritoryDirection(project: Project): string {
  if (mapFillMode(project) === 'post') return 'FILL_MODE POST OVERRIDE: The style-lock wording is retained verbatim, but render ONLY the natural satellite basemap, camera movement and the reviewed non-text icons. NO territory fill, NO white territory outline and NO opaque territory overlay in any generated frame. Vector fills and outlines will be added separately during editing.'
  const color = mapTargetColor(project) === 'rose'
    ? 'rose-red #B85B54 at approximately 60% opacity'
    : 'warm orange #D3631F at approximately 85% opacity'
  return `FILL_MODE GENERATED: The target is already filled with flat semi-transparent ${color} and a crisp white outline, 3–8 px scaled with zoom, in the opening frame. Roughly 15% terrain relief remains visible. Keep this one target color throughout the whole video. Comparison areas use flat red #D53028 at 85–90% or flat green #4A7B25 at 65% without covering the target. Color means territory identity, never danger by default. The coral-red #FF4747 circle with a white X is reserved for a reviewed wrong/contradiction claim. No gradient, glow, bloom or neon.`
}

function mapImageExtraDirection(project: Project): string {
  if (isLegacyMapMaster(project)) return mapDirection(masterStageDirection(project, 'visual'))
  const profile = resolveMasterPrompt(project)
  const stage = mapDirection(profile?.stages.visual ?? '')
  const stock = mapDirection(MAP_VISUAL_DIRECTION)
  if (!stage || stage === stock) return ''
  // Keep independently authored stage changes, while removing copied stock planner prose.
  const extra = stage.replace(stock, '').trim()
  const lines = extra.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  let excluded = false
  for (const line of lines) {
    const heading = line.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*|\*\*$/g, '')
    if (/^(?:AUDIO(?: PLAN)?(?: & SFX)?|POST OVERLAY(?: SHEET| SPEC)?|PUBLISH PACK)(?:\s*:\s*.*)?$/i.test(heading)) {
      excluded = true
      continue
    }
    if (excluded && (/^\s*#{1,6}\s+/.test(line) || (/^[A-Z][A-Z0-9 /&()_-]{2,80}:$/.test(heading) && !/^(?:VOICEOVER|SFX|MUSIC)\b/.test(heading)))) excluded = false
    if (!excluded) output.push(line)
  }
  const rules = output.join('\n').trim()
  return rules ? `Additional selected master visual rules, applied only to the appearance of this one opening image:\n${rules}\nDELIVERABLE OVERRIDE: Output one finished PNG only, with no generated readable text. Do not return JSON, a blueprint, audio, editing sheets, publishing copy or multiple scenes. The selected fill-mode and territory-color constraints below take precedence.` : ''
}

function assertMapPlanVersion(project: Project, clip: Clip): void {
  if (!isLegacyMapMaster(project) && [LEGACY_MAP_STYLE_LOCK, mapStyleLock('16:9', true)].some(lock => clip.videoPrompt.includes(lock))) {
    throw new Error('Prompt visual ini masih memakai Map Animation versi lama. Susun ulang visual untuk menerapkan warna wilayah dan overlay master terbaru.')
  }
  if (!isLegacyMapMaster(project)) {
    const fill = mapPlanField(clip.videoPrompt, 'FILL MODE').toLowerCase()
    const color = mapPlanField(clip.videoPrompt, 'TARGET COLOR').toLowerCase()
    if ((fill && fill !== mapFillMode(project)) || (color && color !== mapTargetColor(project))) {
      throw new Error('Mode fill atau warna wilayah berubah setelah visual disusun. Susun ulang visual agar gambar, video, dan overlay mengikuti pilihan terbaru.')
    }
  }
}

function reviewedMapVideoPlan(project: Project, clip: Clip, orderedClips?: Clip[]): string {
  assertMapPlanVersion(project, clip)
  const plan = mapDirection(clip.videoPrompt)
  const timeline = mapPlanField(plan, 'TIMELINE').replace(/[–—]/g, '-')
  if (!['START STATE', 'CAMERA', 'END STATE'].every(field => mapPlanField(plan, field)) ||
      !['0-2s', '2-5s', '5-8s'].every(beat => timeline.replace(/\s+/g, '').includes(beat))) {
    throw new Error('Susun visual Map Animation terlebih dahulu agar prompt memiliki keadaan awal, gerak kamera, tiga beat, dan keadaan akhir.')
  }
  if (orderedClips) {
    const ordered = [...orderedClips].sort((left, right) => left.sort - right.sort)
    const index = ordered.findIndex(item => item.id === clip.id)
    if (index < 0) throw new Error('Klip ini belum ada dalam urutan proyek. Muat ulang proyek sebelum menyalin prompt video.')
    const previous = ordered[index - 1]
    if (mapClipUsesPreviousFrame(project, clip)) {
      if (!previous) throw new Error('Adegan lanjutan membutuhkan video sebelumnya. Susun ulang visual setelah mengubah urutan klip.')
      const expected = mapPlanField(previous.videoPrompt, 'END STATE')
      if (!expected || mapPlanField(plan, 'START STATE') !== expected) {
        throw new Error('Keadaan awal Map Animation tidak cocok dengan akhir adegan sebelumnya. Susun ulang visual setelah mengubah urutan atau prompt.')
      }
    } else if (index > 0) {
      throw new Error('Hanya adegan pertama Map Animation memakai gambar mandiri. Susun ulang visual setelah mengubah urutan klip.')
    }
  }
  return plan
}

function buildMapImagePrompt(project: Project, clip: Clip, target: 'codex' | 'flow'): string {
  if (!mapClipImageEligible(project, clip)) {
    throw new Error('Adegan lanjutan Map Animation memakai frame terakhir video sebelumnya. Impor video sebelumnya lalu ambil frame akhirnya; jangan generate gambar baru.')
  }
  assertMapPlanVersion(project, clip)
  const legacy = isLegacyMapMaster(project)
  return [
    mapStyleLockForContext(project),
    target === 'codex' ? 'Generate one Map Animation opening frame using image generation in Codex.' : 'Create one Map Animation opening frame.',
    `Opening scene: ${clip.title || 'Map opening'}\n${mapDirection(clip.visualPrompt.trim() || clip.story.trim())}`,
    subjectNicheDirection(project.subjectNiche),
    legacy ? mapDirection(LEGACY_MAP_IMAGE_DIRECTION) : '',
    legacy ? '' : huashuStageDirection(project, 'visual', resolveMasterPrompt(project)),
    mapImageExtraDirection(project),
    legacy
      ? 'Output exactly one bright, wide high-altitude continental starting image. The target outline is only beginning to appear. Preserve real geography and the fixed RED / YELLOW / BLUE-CYAN overlay semantics. Use consistent minimal map icons, with terrain shadows. No actors, human character sheets, contact sheets, labels, readable text, flags, logos or watermark. Do not output a written plan or multiple scenes.'
      : 'Output exactly one bright natural-daylight top-down continental starting image. The target occupies about 12–15% of frame width. Deep focus, slightly muted natural terrain, no clouds or haze. Keep key content inside x 10–90% and y 10–80%. Use consistent glossy sticker icons with soft drop shadows only when called for. No actors, character sheets, contact sheets, labels, readable text, flags, logos, real crests, watermarks or real-person likenesses. Preserve accurate geography; do not invent borders or portray generated satellite-like imagery as authenticated evidence. Keep disputed territory wording neutral. Do not output a written plan or multiple scenes.',
    legacy ? '' : mapTerritoryDirection(project),
    target === 'codex' ? `Provide one downloadable PNG, suggested filename: scene-${clip.id}.png. Do not write this filename in the image.` : ''
  ].filter(Boolean).join('\n\n')
}

function inheritedSkillDirection(project: Project): string {
  if (isStickmanMaster(project) || isMapMaster(project)) return ''
  // Selecting a different master must not resurrect the old VOX variant's motion rules.
  const variant = project.masterPrompt && !isVoxMaster(project) && project.skillVariant === 'vox' ? undefined : project.skillVariant
  return skillDirection(project.skillId, variant, 'visual')
}

/** Prompts for local Codex generation or manual hand-off, and the Flow browser workflow. */
function buildStoryboardImagePrompt(project: Project, clip: Clip, characters: Character[], target: 'codex' | 'flow'): string {
  if (isMapMaster(project)) return buildMapImagePrompt(project, clip, target)
  const cast = characters.filter((character) => clip.characterIds.includes(character.id))
  const health = project.skillId === 'explainer-animasi-kesehatan' && !isStickmanMaster(project)
  const scene = clip.visualPrompt.trim() || clip.story.trim() || clip.title.trim()
  if (isVoxMaster(project)) {
    const identities = cast.map((character) => `${character.name}: ${character.description}`).join('\n')
    return [
      target === 'codex' ? 'Generate one finished editorial storyboard image using image generation in Codex.' : 'Create one finished editorial storyboard image.',
      target === 'codex' ? `Provide a downloadable PNG, suggested filename: scene-${clip.id}.png. This filename is not image text.` : '',
      voxImagePrompt([masterStageDirection(project, 'visual'), subjectNicheDirection(project.subjectNiche), scene].filter(Boolean).join('\n\n'), project.aspectRatio, identities + (cast.some((character) => character.sheetAssetId)
        ? '\nWhen attached, reference sheets guide recurring subject identity only; do not reproduce the contact-sheet layout or neutral background.' : ''))
    ].filter(Boolean).join('\n\n')
  }
  const hasWardrobe = /^\s*wardrobe\s*:/im.test(scene)
  return [
    target === 'codex' ? 'Generate one finished storyboard image using image generation in Codex.' : 'Create one finished storyboard image.',
    `Scene: ${clip.title || 'Untitled scene'}\n${scene}`,
    cast.length
      ? 'Recurring characters:\n' + cast.map((character) => `${character.name}: ${character.description}`).join('\n') +
        (health
          ? '\nKeep the established organ or cell silhouette, palette, facial placement and exact eye/mouth count. Organs and cells have no human torso, hair or clothing unless the reviewed scene explicitly needs a contextual costume or prop.'
          : '\nKeep their faces, body proportions, hair and colors consistent across scenes. ' +
            (hasWardrobe ? 'Clothing follows the Wardrobe directions in the scene.' : 'Use the default outfits described above.'))
      : '',
    cast.some((character) => character.sheetAssetId)
      ? 'When reference sheets are attached, use them for character identity only; do not copy their layout, poses or plain background.'
      : '',
    `Art style: ${isStickmanMaster(project) ? STICKMAN_STYLE_BLOCK : getStyle(project.styleId).prompt}`,
    subjectNicheDirection(project.subjectNiche),
    health
      ? [
          'Narration cue for this exact scene (acting context only; do not render words): ' + (clip.narration.trim() || clip.story.trim()) + '.',
          'Create a new contextual 2D pose for the reviewed action, not a repeated neutral portrait. Use the attached PNG masters for exact character identity and optional expression/pose banks for performance references only. Preserve the biological silhouette, palette, face placement, distinctive traits and exact eye/mouth count; never redesign or combine two master characters.',
          'Show the relevant narration moment through pose, gaze, physical contact and visible consequence, with a responding reaction where present. Keep background and props clear, with the character, props and background visually separable for animation. This output is one finished scene, not an expression-bank sheet.'
        ].join('\n')
      : '',
    inheritedSkillDirection(project),
    `Frame format: ${project.aspectRatio}. Fill the frame with a single scene, without borders or a contact-sheet layout.`,
    target === 'codex' ? `Provide the image as a downloadable PNG, suggested filename: scene-${clip.id}.png. This filename is for the file only; do not write it in the image.` : '',
    masterStageDirection(project, 'visual')
  ].filter(Boolean).join('\n\n')
}

export function buildCodexImagePrompt(project: Project, clip: Clip, characters: Character[]): string {
  return buildStoryboardImagePrompt(project, clip, characters, 'codex')
}

/** Same reviewed image and master rules, without Codex-specific tool/file instructions. */
export function buildFlowImagePrompt(project: Project, clip: Clip, characters: Character[]): string {
  return buildStoryboardImagePrompt(project, clip, characters, 'flow')
}

export function buildCodexCharacterPrompt(project: Project, character: Character): string {
  if (isMapMaster(project)) throw new Error('Map Animation memakai lokasi, rute, dan ikon peta; gaya ini tidak membuat lembar karakter manusia. Gunakan gambar pembuka dan frame akhir video untuk menjaga kesinambungan.')
  if (isStickmanMaster(project)) return [
    'Generate one complete independent 2D stickman character reference sheet using image generation in Codex.',
    `Character: ${character.name}\n${character.description}`,
    subjectNicheDirection(project.subjectNiche),
    masterStageDirection(project, 'visual'),
    STICKMAN_CHARACTER_SHEET_DIRECTION,
    'This request outputs one PNG IDENTITY SHEET, not a cast list, JSON, script or scene plan. The pure-white background, views, poses and expression rules above apply instead of any scene-environment directions in the selected master. Show only this one recurring identity. Match its story-specific clothing, accessories, main prop and distinctive feature. Supplied identity PNGs preserve this exact identity; external style references guide line style only. No scene background, labels, captions or watermark.',
    `Provide one downloadable PNG, suggested filename: character-${character.id}.png. Do not write the filename in the image.`
  ].filter(Boolean).join('\n\n')
  if (isVoxMaster(project)) return [
    'Generate one photographic paper-cutout identity reference, using attached factual source portraits when provided. No invented archival provenance or fabricated unseen views.',
    `Provide a downloadable PNG, suggested filename: character-${character.id}.png. Do not write this filename in the image.`,
    subjectNicheDirection(project.subjectNiche),
    voxImagePrompt(`${masterStageDirection(project, 'visual')}\n\nOne large black-and-white halftone photographic cutout of ${character.name}: ${character.description}. Preserve supplied reference identity, period details and silhouette, with a clean neutral aged-paper background. No costume changes, no labels, no invented side-view turnaround, no props that imply unverified evidence.`, project.aspectRatio)
  ].join('\n\n')
  const style = getStyle(project.styleId)
  return [
    'Generate one character reference sheet using image generation in Codex.',
    `Character: ${character.name}\n${character.description}`,
    subjectNicheDirection(project.subjectNiche),
    `Character appearance: ${style.characterHint}\nArt style: ${style.prompt}`,
    project.skillId === 'explainer-animasi-kesehatan'
      ? 'Build an identity and contextual expression/pose reference for the biologically recognizable 2D organ or cell on a simple neutral background. Keep the established master view and anatomical silhouette; no mandatory human-style turnaround or invented unseen anatomy. If a PNG master is supplied, treat it as the exact identity: preserve silhouette, palette, face placement, distinctive features and eye/mouth count. Change contextual expression or pose only, without a human torso or extra faces. This sheet is an identity/performance reference, not a ready rig or a lip-sync animation. No labels, captions or watermark.'
      : 'Show the same character in front, three-quarter and side views on a simple neutral background. Match face, body proportions, hair, colors and default outfit in all views. No labels, captions or watermark.',
    inheritedSkillDirection(project),
    project.skillId && project.skillId !== 'general'
      ? 'This image is an identity reference sheet. Show only the requested character and useful contextual expression variants; scene background, props and animation layers will be generated separately.'
      : '',
    `Provide a downloadable PNG, suggested filename: character-${character.id}.png. Do not write the filename in the image.`,
    masterStageDirection(project, 'visual')
  ].filter(Boolean).join('\n\n')
}

const CAMERA_DIRECTIONS: Record<Clip['cameraPreset'], string> = {
  zoomin: 'Slow camera push-in toward the main subject.',
  zoomout: 'Slow camera pull-back to reveal the surroundings.',
  panleft: 'Smooth camera pan to the left.',
  panright: 'Smooth camera pan to the right.',
  kenburns: 'Gentle diagonal camera movement with a gradual push-in.',
  shake: 'Subtle handheld camera movement, with no abrupt shaking.',
  static: 'Locked-off camera; movement comes from the subject and environment.'
}

export function buildFlowVideoPrompt(project: Project, clip: Clip, orderedClips?: Clip[]): string {
  const profile = resolveMasterPrompt(project)
  // A universal prompt is an authored production contract, not a scene template.
  if (profile?.videoMode === 'universal') {
    if (!profile.stages.video.trim()) throw new Error('Isi prompt video universal pada master prompt terlebih dahulu.')
    return profile.stages.video
  }
  if (isMapMaster(project) && !isLegacyMapMaster(project)) {
    const plan = reviewedMapVideoPlan(project, clip, orderedClips)
    // Rebuild from visual fields: narrator, labels and publishing copy are separate artifacts.
    // Keeping the precise states untouched also preserves the chain validation above.
    return [
      mapStyleLockForContext(project),
      huashuStageDirection(project, 'video', profile),
      `START FRAME: ${mapClipUsesPreviousFrame(project, clip) ? 'PREVIOUS_VIDEO — upload the exact last decoded frame of the previous generated video; never a new still.' : 'SCENE_IMAGE — use the reviewed wide continental opening image with the target at about 12–15% of frame width.'}`,
      `START STATE: ${mapPlanField(plan, 'START STATE')}`,
      `CAMERA: ${mapPlanField(plan, 'CAMERA')} One continuous eight-second shot with ease-in/ease-out, one primary move and subtle secondary roll or sway; no still hold longer than about 2.5 seconds.`,
      `TIMELINE: ${mapPlanField(plan, 'TIMELINE')}`,
      `END STATE: ${mapPlanField(plan, 'END STATE')}`,
      `AVOID: ${mapPlanField(plan, 'AVOID')} No hard cuts, jump cuts, whip-pans, morphing, camera shake, flicker, generated readable text or labels, logos, flags, real crests, watermark, real-person likenesses, distorted borders, night lighting, clouds, haze, depth-of-field blur, gradients, neon glow or bloom. Preserve actual geography, bright natural daylight, the same fixed territory colors and icon design. Keep key content inside x 10–90% and y 10–80%. Generate silent visual footage. ${mapTerritoryDirection(project)}`
    ].join('\n\n')
  }
  if (isMapMaster(project)) return [
    mapStyleLockForContext(project),
    reviewedMapVideoPlan(project, clip, orderedClips),
    mapClipUsesPreviousFrame(project, clip)
      ? 'START FRAME REQUIREMENT: Upload the exact last decoded frame of the previous generated video as the starting image. The START STATE above must match that actual frame exactly. Do not upload a newly generated still or reset the camera, daylight, palette, overlays or icon design.'
      : 'START FRAME REQUIREMENT: Use the reviewed wide continental opening image as the starting image. Begin with the mandatory hyper-smooth kinetic zoom into the target as its border materializes.',
    mapDirection(masterStageDirection(project, 'video') || LEGACY_MAP_VIDEO_DIRECTION),
    subjectNicheDirection(project.subjectNiche),
    'Render one continuous eight-second video shot. Keep bright natural daylight and geographically accurate terrain, borders and routes. RED = danger/conflict/restricted areas; YELLOW = highlights/measurements/targets; BLUE/CYAN = safe routes/water/legal paths. One consistent map icon design with soft terrain shadows. No hard cuts, jump cuts, whip-pans, camera shake, morphing, text, labels, flags, logos or watermark.',
    'AUDIO HANDLING: AUDIO PLAN contains editing cues only, not audio to synthesize in this visual. Generate silent visual footage; narration is created separately in Naraflow. Music and timed SFX must be added during production. Do not print audio or publishing instructions inside the frame, return JSON, or ask chat questions.'
  ].filter(Boolean).join('\n\n')
  if (isStickmanMaster(project)) return [
    `SCRIPT SECTION (exact reviewed narration, for visual acting context only):\n${clip.narration}`,
    '10-SECOND CONTINUOUS STICKMAN VIDEO PROMPT:',
    masterStageDirection(project, 'video') || STICKMAN_VIDEO_DIRECTION,
    `Reviewed scene: ${clip.story.trim() || clip.title}.\n${clip.videoPrompt.trim() || clip.visualPrompt.trim()}`,
    subjectNicheDirection(project.subjectNiche),
    `Output aspect ratio: ${project.aspectRatio}. The intended source shot is approximately ${profile?.timing.sourceVideoSeconds ?? 10} seconds; edited scene duration follows narration.`,
    'Use the provided reference character sheet for the exact character design and maintain its appearance consistently throughout the entire shot. The uploaded storyboard frame establishes this scene. Do not reproduce the character-sheet layout.',
    'Render this as one continuous uninterrupted video shot, without returning a written plan, JSON or chat questions. No cuts, montage, zoom, pan, camera shake or sudden perspective changes. Character action supplies visual interest. No speech, voice-over, music, baked text or logos; narration is added separately in Naraflow.'
  ].filter(Boolean).join('\n\n')
  const motion = clip.videoPrompt.trim()
  const stageDirection = masterStageDirection(project, 'video')
  const customVideo = !!project.masterPrompt && !!stageDirection
  const fallback = [
    `Scene action: ${clip.story.trim() || clip.title.trim() || 'Natural movement of the main subject.'}`,
    CAMERA_DIRECTIONS[profile?.lockedCamera ? 'static' : clip.cameraPreset],
    `Movement intensity: ${{ halus: 'subtle', sedang: 'moderate', kuat: 'strong but controlled' }[clip.motionStrength]}.`
  ].join('\n')
  return [
    customVideo ? 'Animate the supplied storyboard image according to the selected video rules below.' : 'Animate the uploaded storyboard image as the starting frame of a single continuous shot.',
    motion || fallback,
    project.skillId === 'explainer-animasi-kesehatan' && !customVideo
      ? [
          'Narration acting cue, not audio to generate: ' + (clip.narration.trim() || clip.story.trim()) + '.',
          'Within the chosen shot duration, stage an anatomy-preserving 2D sequence: establish the speaking intent and gaze, perform the physical action on the referenced target, show its visible consequence, then the listener or acting character reacts with context-specific humor. Follow the reviewed motion direction and keep its chosen camera framing.',
          'Use deliberate pose changes, gaze shifts, gestures and contact rather than a neutral character floating, bobbing or repeated camera zoom. Preserve the uploaded master-derived identity, silhouette, palette, face placement and exact eye/mouth count. Illustrative organ deformation stays consistent and controlled.',
          'Use silent expression and acting cues only. Add narration separately in Naraflow; do not assume phoneme-aligned lip sync or generate spoken dialogue.'
        ].join('\n')
      : '',
    `Selected visual style: ${getStyle(project.styleId).prompt}`,
    subjectNicheDirection(project.subjectNiche),
    customVideo ? '' : inheritedSkillDirection(project),
    customVideo ? '' : 'Preserve the source image art style, character identity, clothing, proportions, lighting and setting. Use natural motion and stable anatomy. No cuts, scene changes, extra characters, text, subtitles, logos or watermark.',
    `Output aspect ratio: ${project.aspectRatio}. Fit the action to the duration selected in Flow.`,
    profile?.timing.sourceVideoSeconds ? `Source video duration: ${profile.timing.sourceVideoSeconds} seconds, independent of the edited narration beat length.` : '',
    customVideo ? '' : 'No speech, voice-over or music; narration and music will be added in Naraflow.',
    stageDirection,
    profile?.lockedCamera ? 'Camera rule: locked-off camera throughout. No zoom, pan, tilt, dolly, orbit, shake or reframing. This overrides any camera movement in scene notes.' : ''
  ].filter(Boolean).join('\n\n')
}
