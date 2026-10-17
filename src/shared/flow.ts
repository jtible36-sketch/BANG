import { buildCodexCharacterPrompt, buildFlowImagePrompt, buildFlowVideoPrompt } from './external-prompts'
import { isMapMaster, resolveMasterPrompt } from './master-prompts'
import type { Character, Clip, Project } from './types'
import { autoSyncEnabled } from './voiceover'

export const FLOW_VIDEO_MODEL = 'Omni 1.1 Flash'
export const FLOW_IMAGE_MODEL = 'Nano Banana 2.1'
export const FLOW_VIDEO_SECONDS = 4
export const FLOW_IMAGE_SECONDS = 1.5

export interface FlowStatus {
  available: boolean
  signedIn: boolean
  inProject: boolean
  message: string
  videoModel: string
  imageModel: string
  videoMaxCredits: number
  jobs: number
}

export function buildFlowCharacterPrompt(project: Project, character: Character): string {
  return buildCodexCharacterPrompt(project, character)
    .replace(/using image generation in Codex\./g, 'in Flow.')
    .replace(/^Provide (?:one |a )?downloadable PNG[^\n]*$/gm, '')
    .trim()
}

export function buildFlowShotImagePrompt(project: Project, clip: Clip, characters: Character[]): string {
  return buildFlowImagePrompt(project, clip, characters) + '\n\nSHOT: One finished still for this narrative moment. ' + (autoSyncEnabled(project) ? 'The editor holds the image for the actual voiceover length; do not squeeze the narrative into a fixed shot duration. ' : 'Planned still duration: 1.5 seconds. ') + 'Make the narration moment clearly readable. Identity references guide only the selected characters; never reproduce a character-sheet layout.'
}

/** Post labels are kept separate; scale only their local time column for the 4s source. */
export function flowOverlaySheet(project: Project, sheet: string): string {
  if (!isMapMaster(project)) return sheet
  const ratio = 4 / (resolveMasterPrompt(project)?.timing.sourceVideoSeconds || 8)
  return sheet.replace(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)s(\s*\|)/gm,
    (_match, start: string, end: string, tail: string) => `${(Number(start) * ratio).toFixed(2)}-${(Number(end) * ratio).toFixed(2)}s${tail}`)
}

/** Adapt the reviewed motion to the explicitly requested Omni 4s source, preserving all scene facts. */
export function buildFlowShotVideoPrompt(project: Project, clip: Clip, clips: Clip[], characters: Character[] = []): string {
  let prompt = buildFlowVideoPrompt(project, clip, clips)
  const source = resolveMasterPrompt(project)?.timing.sourceVideoSeconds
  if (isMapMaster(project)) {
    prompt = prompt.replace(/TIMELINE:\s*0-2s ([\s\S]*?) \/ 2-5s ([\s\S]*?) \/ 5-8s ([\s\S]*?)(?=\n\nEND STATE:)/,
      'TIMELINE: 0-1s $1 / 1-2.5s $2 / 2.5-4s $3')
  }
  const cast = characters.filter(character => clip.characterIds.includes(character.id))
  return [prompt, cast.length ? 'RECURRING SUBJECTS: ' + cast.map(character => `${character.name}: ${character.description}`).join('\n') : '',
    `OMNI SHOT TIMING OVERRIDE: This source is exactly 4 seconds at 720p, one continuous shot. ${source && source !== 4 ? `The selected master originally describes ${source}s; compress its ordered actions proportionally into 4s without changing facts, identity, style, camera restrictions or final state. ` : ''}Distribute one clear action across 0-1s setup, 1-3s development, 3-4s resolution. No extra cuts or generated captions. Silent footage; narration and music are added separately. If a first frame is supplied, preserve the subjects in that exact frame; identity comes from the frame, not additional character references.`
  ].filter(Boolean).join('\n\n')
}
