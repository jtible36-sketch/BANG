import type { Character, Clip, Project } from './types'
import { getStyle } from './styles'

/** Prompts for a manual hand-off to Codex and Flow; no provider credentials are needed. */
export function buildCodexImagePrompt(project: Project, clip: Clip, characters: Character[]): string {
  const cast = characters.filter((character) => clip.characterIds.includes(character.id))
  const scene = clip.visualPrompt.trim() || clip.story.trim() || clip.title.trim()
  const hasWardrobe = /^\s*wardrobe\s*:/im.test(scene)
  return [
    'Generate one finished storyboard image using image generation in Codex.',
    `Scene: ${clip.title || 'Untitled scene'}\n${scene}`,
    cast.length
      ? 'Recurring characters:\n' + cast.map((character) => `${character.name}: ${character.description}`).join('\n') +
        '\nKeep their faces, body proportions, hair and colors consistent across scenes. ' +
        (hasWardrobe ? 'Clothing follows the Wardrobe directions in the scene.' : 'Use the default outfits described above.')
      : '',
    cast.some((character) => character.sheetAssetId)
      ? 'I can attach the character reference sheets from Bang Story. When attached, use them for character identity only; do not copy their layout, poses or plain background.'
      : '',
    `Art style: ${getStyle(project.styleId).prompt}`,
    `Frame format: ${project.aspectRatio}. Fill the frame with a single scene, without borders or a contact-sheet layout.`,
    `Provide the image as a downloadable PNG, suggested filename: scene-${clip.id}.png. This filename is for the file only; do not write it in the image.`
  ].filter(Boolean).join('\n\n')
}

export function buildCodexCharacterPrompt(project: Project, character: Character): string {
  const style = getStyle(project.styleId)
  return [
    'Generate one character reference sheet using image generation in Codex.',
    `Character: ${character.name}\n${character.description}`,
    `Character appearance: ${style.characterHint}\nArt style: ${style.prompt}`,
    'Show the same character in front, three-quarter and side views on a simple neutral background. Match face, body proportions, hair, colors and default outfit in all views. No labels, captions or watermark.',
    `Provide a downloadable PNG, suggested filename: character-${character.id}.png. Do not write the filename in the image.`
  ].join('\n\n')
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
  const motion = clip.videoPrompt.trim()
  const fallback = [
    `Scene action: ${clip.story.trim() || clip.title.trim() || 'Natural movement of the main subject.'}`,
    CAMERA_DIRECTIONS[clip.cameraPreset],
    `Movement intensity: ${{ halus: 'subtle', sedang: 'moderate', kuat: 'strong but controlled' }[clip.motionStrength]}.`
  ].join('\n')
  return [
    'Animate the uploaded storyboard image as the starting frame of a single continuous shot.',
    motion || fallback,
    'Preserve the source image art style, character identity, clothing, proportions, lighting and setting. Use natural motion and stable anatomy. No cuts, scene changes, extra characters, text, subtitles, logos or watermark.',
    `Output aspect ratio: ${project.aspectRatio}. Fit the action to the duration selected in Flow.`,
    'No speech, voice-over or music; narration and music will be added in Bang Story.'
  ].join('\n\n')
}
