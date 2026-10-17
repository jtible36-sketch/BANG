import { buildFlowVideoPrompt } from '@shared/external-prompts'
import { isMapMaster, resolveMasterPrompt } from '@shared/master-prompts'
import type { Clip } from '@shared/types'
import { clipsOf, getClip, getProject } from './repo'
import { getDb } from './db'
import { emit } from './events'
import { generateCodexJson } from './codex-text'
import { requireCodexConnection } from './codex-connections'
import { getSettings } from './settings'

const active = new Set<string>()
const schema = { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'], additionalProperties: false }
const fingerprint = (clip: Clip): string => JSON.stringify([clip.story, clip.narration, clip.visualPrompt, clip.videoPrompt, clip.imageAssetId, clip.cameraPreset, clip.motionStrength])

export async function generateCodexVideoPrompt(clipId: string): Promise<Clip> {
  requireCodexConnection('video')
  if (active.has(clipId)) throw new Error('Prompt video adegan ini sedang disusun.')
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  const profile = resolveMasterPrompt(project)
  if (isMapMaster(project)) {
    // The map chain is authored together; a wrapped copy must not replace its canonical plan.
    buildFlowVideoPrompt(project, clip, clipsOf(project.id))
    return clip
  }
  active.add(clipId)
  try {
    // Universal contracts are authored verbatim; never ask an LLM to rewrite them.
    const result = profile?.videoMode === 'universal' ? { prompt: buildFlowVideoPrompt(project, clip, clipsOf(project.id)) }
      : await generateCodexJson<{ prompt: string }>({
        system: 'Write one precise English image-to-video motion prompt for Google Flow. Match the reviewed narration and scene action, preserve character identity and visual style, honor every supplied master rule. Describe sequential physical acting and reactions, with no new factual claims. Return JSON containing prompt only. Do not generate or claim to generate video.',
        prompt: `Narration: ${clip.narration}\nScene: ${clip.story}\nImage plan: ${clip.visualPrompt}\nProduction direction:\n${buildFlowVideoPrompt(project, clip)}`,
        schema, signal: AbortSignal.timeout(getSettings().storyTimeoutSec * 1000)
      }, 'video')
    requireCodexConnection('video')
    if (!result || typeof result.prompt !== 'string' || !result.prompt.trim() || result.prompt.length > 30000) throw new Error('Codex belum menghasilkan prompt video yang valid. Prompt sebelumnya tetap tersimpan.')
    if (fingerprint(getClip(clipId)) !== fingerprint(clip) || JSON.stringify(getProject(project.id)) !== JSON.stringify(project)) {
      throw new Error('Adegan berubah selama penyusunan. Prompt terbaru tetap tersimpan; coba susun lagi.')
    }
    getDb().prepare('UPDATE clips SET video_prompt = ? WHERE id = ?').run(result.prompt, clipId)
    emit.clip({ clipId, patch: { videoPrompt: result.prompt } })
    return getClip(clipId)
  } catch (error) {
    if ((error as Error).name === 'TimeoutError') throw new Error('Penyusunan prompt video terlalu lama. Prompt sebelumnya tetap tersimpan.')
    if ((error as Error).name === 'AbortError') throw new Error('Penyusunan prompt video dibatalkan. Prompt sebelumnya tetap tersimpan.')
    throw error
  } finally { active.delete(clipId) }
}
