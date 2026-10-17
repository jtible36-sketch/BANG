import type { MasterPromptContext, MasterPromptProfile, MasterPromptStage } from './master-prompts'
import { getHuashuRecipe, huashuRecipePrompt } from './huashu-catalog'

export const HUASHU_STYLE_ID = 'huashu-art-motion'

/** Naraflow's standalone interpretation; never injected into other visual styles. */
export const HUASHU_STYLE_PROMPT = 'Huashu Art Motion: an expressive 2D painted illustration with tactile gouache brushwork and subtle paper grain, warm ivory, vermilion, muted gold and charcoal palette. One large concrete subject performs a meaningful action inside a coherent full-frame illustrated world. Purposeful silhouette, layered depth, clear negative space and cinematic focal hierarchy. Characters, props and background share the same painted material and lighting. A single finished narrative moment ready to animate; no title-card layout, multi-panel collage, generic infographic grid, readable text, captions, logo or watermark.'

export interface HuashuMotionProfile {
  id: string
  name: string
  summary: string
  action: string
  camera: string
  continuity: string
}

export function isHuashuStyle(context: Pick<MasterPromptContext, 'styleId'>): boolean {
  return context.styleId === HUASHU_STYLE_ID || !!getHuashuRecipe(context.styleId)
}

export function getHuashuMotionProfile(context: MasterPromptContext, resolvedProfile?: MasterPromptProfile | null): HuashuMotionProfile | null {
  if (!isHuashuStyle(context)) return null
  const master = resolvedProfile === undefined ? context.masterPrompt ?? null : resolvedProfile
  const recipe = getHuashuRecipe(context.styleId)
  return {
    id: context.styleId ?? HUASHU_STYLE_ID,
    name: recipe?.name ?? 'Ilustrasi seni bergerak',
    summary: recipe?.summary ?? 'Ilustrasi 2D bertekstur cat dengan palet krem, merah vermilion, emas redup, dan arang.',
    action: recipe?.motionHint ?? 'Satu aksi utama, akibat yang terlihat, dan gerak pendukung yang mengikuti cerita.',
    camera: master?.lockedCamera
      ? 'Kamera terkunci sesuai master; gerak berasal dari aksi objek atau karakter.'
      : 'Bingkai tenang saat aksi terbaca; gerak kamera membuka detail atau memberi penekanan.',
    continuity: master?.videoMode === 'universal'
      ? 'Prompt video universal disalin persis; komposisi dan identitas mengikuti master.'
      : 'Material, palet, bentuk karakter, dan ruang adegan tetap konsisten dengan gaya yang dipilih.'
  }
}

/** Stage-local direction only for the explicitly selected Huashu style. */
export function huashuStageDirection(context: MasterPromptContext, stage: MasterPromptStage, resolvedProfile?: MasterPromptProfile | null): string {
  if (!isHuashuStyle(context) || stage === 'voice') return ''
  const master = resolvedProfile === undefined ? context.masterPrompt ?? null : resolvedProfile
  const recipe = getHuashuRecipe(context.styleId)
  if (stage === 'video' && master?.videoMode === 'universal') return ''
  const rules: Record<Exclude<MasterPromptStage, 'voice'>, string> = {
    research: 'Choose concepts with one concrete showable question, a recognizable subject and a causal action suitable for the selected art material. Explain the visual opportunity without inventing trend evidence or promising virality. Return only the requested research schema.',
    script: 'Open with a specific story-relevant event or question. Connect cause and effect through a coherent example and naturally spoken narration. Use objects, actions and reactions instead of abstract title cards. Scene boundaries follow complete thoughts and story logic rather than fixed seconds. Preserve the requested hook and closing invitation.',
    visual: 'Make the subject, action and visible consequence legible in one coherent composition in the selected material. A still shows one finished narrative moment. Character sheets preserve the requested views, neutral background and reference identity; never turn them into a scene. Plan a main action and restrained supporting motion rather than repeated zooms. Keep all requested output fields.',
    video: 'Make the selected art world feel alive: one clear main action with motivated secondary motion and a visible consequence. Preserve its material, contours and texture without random boiling, melting or flicker unless intentional deformation is part of this recipe. Hold the camera when the action is readable; reserve stronger camera emphasis for a genuine reveal. Keep the supplied first frame, identity, scene and required final state. No extra cuts or generated audio.',
    thumbnail: 'Compose one large focal subject in the selected art material and one revealing action or contrast tied to the actual story. Make silhouettes readable at small size, with restrained negative space. Output one finished landscape thumbnail. Leave text for editing unless the master explicitly allows it; never imply unsupported evidence.'
  }
  return [
    'HUASHU ART-MOTION ADAPTATION — selected visual style:',
    recipe ? huashuRecipePrompt(recipe) : HUASHU_STYLE_PROMPT,
    recipe ? `CHARACTER DESIGN: ${recipe.character}\nMOTION LANGUAGE: ${recipe.motion}\n${recipe.camera ?? ''}` : '',
    'Reviewed master rules, approved reference identities and application output schemas take precedence. Retain the chosen character species, anatomy and expressive face when required by the story. Edited timing follows narration and Auto-Sync; source-media duration is a separate application setting. Do not introduce fixed per-scene length quotas or upstream renderer commands.',
    rules[stage],
    master?.lockedCamera ? 'LOCKED CAMERA: no pan, tilt, zoom, orbit, shake or reframing. Subject action supplies motion.' : '',
    master?.videoMode === 'universal' ? 'Apply the style to composition only; the authored universal video prompt is immutable.' : '',
    'Keep one visual language across characters, objects and environments. Compose original scenes for the story instead of copying demonstration characters or layouts. Preserve factual scope and return only the requested deliverable, without additional code, tool calls or chat questions.'
  ].filter(Boolean).join('\n')
}
