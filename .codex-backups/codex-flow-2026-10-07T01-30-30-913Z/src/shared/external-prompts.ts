import type { Character, Clip, Project } from './types'
import { getStyle } from './styles'
import { skillDirection } from './skills'
import { voxImagePrompt } from './vox'
import { isVoxMaster, masterStageDirection, resolveMasterPrompt } from './master-prompts'

function inheritedSkillDirection(project: Project): string {
  // Selecting a different master must not resurrect the old VOX variant's motion rules.
  const variant = project.masterPrompt && !isVoxMaster(project) && project.skillVariant === 'vox' ? undefined : project.skillVariant
  return skillDirection(project.skillId, variant, 'visual')
}

/** Prompts for local Codex generation or manual hand-off, and the Flow browser workflow. */
function buildStoryboardImagePrompt(project: Project, clip: Clip, characters: Character[], target: 'codex' | 'flow'): string {
  const cast = characters.filter((character) => clip.characterIds.includes(character.id))
  const health = project.skillId === 'explainer-animasi-kesehatan'
  const scene = clip.visualPrompt.trim() || clip.story.trim() || clip.title.trim()
  if (isVoxMaster(project)) {
    const identities = cast.map((character) => `${character.name}: ${character.description}`).join('\n')
    return [
      target === 'codex' ? 'Generate one finished editorial storyboard image using image generation in Codex.' : 'Create one finished editorial storyboard image.',
      target === 'codex' ? `Provide a downloadable PNG, suggested filename: scene-${clip.id}.png. This filename is not image text.` : '',
      voxImagePrompt([masterStageDirection(project, 'visual'), scene].filter(Boolean).join('\n\n'), project.aspectRatio, identities + (cast.some((character) => character.sheetAssetId)
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
    `Art style: ${getStyle(project.styleId).prompt}`,
    project.skillId === 'explainer-animasi-kesehatan'
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
  if (isVoxMaster(project)) return [
    'Generate one photographic paper-cutout identity reference, using attached factual source portraits when provided. No invented archival provenance or fabricated unseen views.',
    `Provide a downloadable PNG, suggested filename: character-${character.id}.png. Do not write this filename in the image.`,
    voxImagePrompt(`${masterStageDirection(project, 'visual')}\n\nOne large black-and-white halftone photographic cutout of ${character.name}: ${character.description}. Preserve supplied reference identity, period details and silhouette, with a clean neutral aged-paper background. No costume changes, no labels, no invented side-view turnaround, no props that imply unverified evidence.`, project.aspectRatio)
  ].join('\n\n')
  const style = getStyle(project.styleId)
  return [
    'Generate one character reference sheet using image generation in Codex.',
    `Character: ${character.name}\n${character.description}`,
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

export function buildFlowVideoPrompt(project: Project, clip: Clip): string {
  const profile = resolveMasterPrompt(project)
  // A universal prompt is an authored production contract, not a scene template.
  if (profile?.videoMode === 'universal') {
    if (!profile.stages.video.trim()) throw new Error('Isi prompt video universal pada master prompt terlebih dahulu.')
    return profile.stages.video
  }
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
          'Use silent expression and acting cues only. Add narration separately in Bang Story; do not assume phoneme-aligned lip sync or generate spoken dialogue.'
        ].join('\n')
      : '',
    `Selected visual style: ${getStyle(project.styleId).prompt}`,
    customVideo ? '' : inheritedSkillDirection(project),
    customVideo ? '' : 'Preserve the source image art style, character identity, clothing, proportions, lighting and setting. Use natural motion and stable anatomy. No cuts, scene changes, extra characters, text, subtitles, logos or watermark.',
    `Output aspect ratio: ${project.aspectRatio}. Fit the action to the duration selected in Flow.`,
    profile?.timing.sourceVideoSeconds ? `Source video duration: ${profile.timing.sourceVideoSeconds} seconds, independent of the edited narration beat length.` : '',
    customVideo ? '' : 'No speech, voice-over or music; narration and music will be added in Bang Story.',
    stageDirection,
    profile?.lockedCamera ? 'Camera rule: locked-off camera throughout. No zoom, pan, tilt, dolly, orbit, shake or reframing. This overrides any camera movement in scene notes.' : ''
  ].filter(Boolean).join('\n\n')
}
