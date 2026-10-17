import { CAMERA_PRESETS, MOTION_STRENGTHS, TRANSITIONS } from '@shared/motion'
import { LANGUAGES, clipCountFor } from '@shared/models'
import { needsVisual } from '@shared/script'
import { estimateNarrationMs } from '@shared/script'
import { autoSyncEnabled } from '@shared/voiceover'
import { validateDurationSec } from '@shared/duration'
import { skillDirection } from '@shared/skills'
import { getStyle } from '@shared/styles'
import { VOICE_TAGS } from '@shared/speech'
import { closingInvitation, ensureClosingInvitation, hasShortOpening, hookWordBudget, narrationWordCount, scriptEngagementDirection } from '@shared/story-policy'
import { VOX_SCRIPT_DIRECTION, VOX_VISUAL_DIRECTION, VOX_UNIVERSAL_VIDEO_PROMPT, voxBeatCount, voxImagePrompt } from '@shared/vox'
import { isMapMaster, isStickmanMaster, isVoxMaster, masterStageDirection, resolveMasterPrompt } from '@shared/master-prompts'
import { subjectNicheDirection } from '@shared/niches'
import { STICKMAN_CHARACTER_DIRECTION, STICKMAN_VISUAL_DIRECTION } from '@shared/stickman'
import type { CameraPresetId, Clip, MotionStrength, MusicPrompt, ProjectBundle, TransitionId } from '@shared/types'
import { appendCharacters, applyVisuals, charactersOf, clipsOf, getBundle, getProject, replaceScript, type SceneVisual } from './repo'
import { generateJson } from './services/llm'
import { getSettings } from './settings'
import { generateMapVisuals } from './map-story'
import { getDb } from './db'

const CAMERA_IDS = CAMERA_PRESETS.map((c) => c.id)
const STRENGTH_IDS = MOTION_STRENGTHS.map((m) => m.id)
const TRANSITION_IDS = TRANSITIONS.map((t) => t.id)

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function languageOf(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.english ?? 'Indonesian'
}

// ---------- step 1 → 2: the script ----------

/** JSON Schema written to satisfy OpenAI strict mode (every property required, no extra keys) and Gemini. */
const SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Short catchy video title in the target language, max 60 characters.' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Short scene title in the target language.' },
          story: {
            type: 'string',
            description: 'What happens in this scene, one or two sentences in the target language, so the writer can check the plot.'
          },
          narration: {
            type: 'string',
            description:
              'Voice-over for this scene in the target language, with the spoken word budget requested in the prompt. Natural spoken rhythm. May contain one or two English vocal tags in angle brackets.'
          }
        },
        required: ['title', 'story', 'narration']
      }
    }
  },
  required: ['title', 'scenes']
}

interface ScriptPlan {
  title?: string
  scenes?: { title?: string; story?: string; narration?: string }[]
}

const VOX_SCRIPT_SCHEMA = {
  ...SCRIPT_SCHEMA,
  properties: {
    ...SCRIPT_SCHEMA.properties,
    title: { type: 'string', description: 'Concrete evidence-supported documentary title, not sensational clickbait.' },
    scenes: {
      ...SCRIPT_SCHEMA.properties.scenes,
      items: {
        ...SCRIPT_SCHEMA.properties.scenes.items,
        properties: {
          ...SCRIPT_SCHEMA.properties.scenes.items.properties,
          story: { type: 'string', description: 'Exactly one concrete visual idea for this 2-3 second editorial paper-collage beat. No invented factual detail.' },
          narration: { type: 'string', description: 'A calm documentary spoken phrase within the requested per-beat word budget, normally 5-8 words. The opening hook must fit the first 3 seconds; the final mandatory follow/subscribe invitation is exempt from the beat budget and viewer-address restriction. No delivery tags, markup or em dash. Sentence endings use a period; longer sentences can continue into the next beat at a natural clause.' }
        }
      }
    }
  }
}

function spokenWords(value: string): number {
  return narrationWordCount(value)
}

/** Remove delivery cues, retaining bracketed dates, citations and every spoken word. */
function normalizeVoxNarration(value: unknown): string {
  return str(value)
    .replace(/<([^<>]{1,40})>|\[([^\[\]]{1,40})\]/gu, (match, angle: string | undefined, square: string | undefined) =>
      VOICE_TAGS.includes((angle ?? square ?? '').trim().toLowerCase()) ? ' ' : match
    )
    .replace(/\s*\u2014\s*/gu, ', ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Writes the scene-by-scene script (story and voice-over) that the user reviews before any visuals exist. */
export async function generateScript(projectId: string, signal?: AbortSignal): Promise<ProjectBundle> {
  signal?.throwIfAborted()
  const project = getProject(projectId)
  if (!project.synopsis.trim()) throw new Error('Tulis ide cerita atau sinopsis dulu.')
  const captured = scriptContext(projectId)
  const lang = languageOf(project.language)
  const durationSec = validateDurationSec(project.durationSec)
  const master = resolveMasterPrompt(project)
  const vox = isVoxMaster(project)
  const stickman = isStickmanMaster(project)
  const map = isMapMaster(project)
  const skillVariant = project.masterPrompt && !vox && project.skillVariant === 'vox' ? undefined : project.skillVariant
  const wordsPerSecond = master?.timing.wordsPerSecond ?? (vox ? 2.5 : 2.3)
  const voiceLed = autoSyncEnabled(project)
  const flowMode = getSettings().visualWorkflow === 'flow-mcp' && !map
  const flowShots = flowMode && !voiceLed
  const shotSeconds = getSettings().flowShotMedia === 'image' ? 1.5 : 4
  const shotMedia = getSettings().flowShotMedia
  const count = flowShots ? Math.max(1, Math.ceil(durationSec / shotSeconds)) : master?.timing.sceneCount ?? (master?.timing.beatSeconds ? Math.max(1, Math.round(durationSec / master.timing.beatSeconds)) : vox ? voxBeatCount(durationSec) : clipCountFor(durationSec))
  if (flowShots && count > 500) throw new Error('Mode shot Flow maksimal 500 adegan per naskah. Bagi video panjang menjadi beberapa proyek.')
  const openingWords = map ? Math.max(1, Math.floor(2 * wordsPerSecond)) : hookWordBudget(wordsPerSecond)
  const sceneSec = durationSec / count
  const words = Math.max(1, Math.round(sceneSec * wordsPerSecond))
  const targetWords = Math.round(durationSec * wordsPerSecond)
  // Very short custom durations cannot contain a full 5-word beat; preserve the custom target.
  const beatMinWords = Math.min(5, Math.max(1, Math.floor(targetWords / count)))
  const beatMaxWords = Math.max(8, Math.ceil(targetWords / count))
  const health = project.skillId === 'explainer-animasi-kesehatan' && !vox && !stickman && !map
  const known = map ? [] : charactersOf(projectId)

  const system = [
    'You are a scriptwriter for faceless YouTube storytelling and explainer videos.',
    stickman ? 'You turn the selected documentary idea into narration sections with a coherent paragraph flow. Each section contains only its original spoken narration, without timestamps or headings read aloud.' : 'You turn an idea into a sequence of short scenes. Each scene has one line of voice-over.',
    vox ? VOX_SCRIPT_DIRECTION : 'The story has a clear beginning, rising tension and a satisfying ending.',
    'Keep facts accurate for history and science topics, and always call each character by the same name.',
    vox ? 'The narration is a calm, precise, deadpan documentary read. No vocal tags or dramatic delivery spikes. Never invent a date, location, quotation or action for the cold open. Use a verified precise date and named place only when the supplied source material supports them. Otherwise open with the concrete verified subject or action without manufacturing historical detail.' : 'The narration is voiced by an expressive text-to-speech model. Where it helps the delivery, add a few English vocal tags in angle brackets inside the narration, such as <short pause>, <long pause>, <chuckles>, <sigh>, <gasp> or <whispers>. Use them sparingly, at most one or two per scene, and never other markup.',
    vox ? `Write everything in ${lang}.` : `Write everything in ${lang}, except the vocal tags, which stay in English.`,
    vox || stickman || map ? '' : skillDirection(project.skillId, skillVariant, 'script'),
    masterStageDirection(project, 'script'),
    masterStageDirection(project, 'voice'),
    voiceLed ? 'VOICEOVER-LED STORY OVERRIDE: Narration and the logical story determine scene length. Do not force every line into fixed 1.5s, 4s, or 8s slots, even if a master describes source-video timings. Write complete natural thoughts that correspond precisely to the visible subjects and actions in the story field. Split at meaningful narrative changes; avoid filler and abrupt sentence fragments. The full-video length is a rough editorial target. Generated footage length is independent; editing fits it to the voiceover. Preserve the selected visual style, factual safeguards, opening hook and closing invitation.' : '',
    flowShots ? `APP SHOT TIMING OVERRIDE: Build ${count} scenes, one instantly readable visual action per ${shotSeconds}s shot. This explicit app target overrides beat length or scene count in master prose; preserve the selected style and factual rules. Keep narration concise to fit, and never add facts merely to fill shots. Opening hook and final follow/subscribe remain mandatory.` : '',
    subjectNicheDirection(project.subjectNiche),
    scriptEngagementDirection(project.language, wordsPerSecond),
    map ? `Map opening override: the first scene is a complete concrete hook within TWO seconds, at most ${openingWords} spoken words. Following scenes give context, twist, and payoff. Echo the hook in the factual payoff before the mandatory final follow/subscribe invitation. Do not invent a shocking claim.` : ''
  ].join(' ')
  const scenes: NonNullable<ScriptPlan['scenes']> = []
  let title = project.title
  // Keep responses and continuity context bounded. Commit only after every batch succeeds.
  const batchSize = 32
  for (let start = 0; start < count; start += batchSize) {
    const batchCount = Math.min(batchSize, count - start)
    const prompt = [
      known.length
        ? 'Existing character masters; keep these exact names and identities in the story:\n' + known.map((character) => '- ' + character.name + ': ' + character.description + (character.sheetAssetId ? ' [PNG identity master available]' : ' [description only]')).join('\n')
        : '',
      health ? 'For each scene, the story field is an actionable acting brief: quote the narration phrase being shown, name the acting character, its contextual pose and gaze target, the physical action and contact, visible consequence, then reaction. The narration field contains only the final spoken line, not the acting directions. Do not invent unsupported new medical claims from expression references.' : '',
      `Idea / synopsis:\n${project.synopsis}`,
      project.subjectNiche ? `Selected subject / niche: ${project.subjectNiche}. Keep this specific story within the niche; never replace it with a generic story.` : '',
      `Target full video length: about ${durationSec} seconds in ${count} scenes. Frame format: ${project.aspectRatio}.`,
      voiceLed && !map
        ? `Aim for about ${batchCount} coherent scenes in this part; you may combine or split beats to follow the story naturally. Do not enforce a fixed per-scene seconds or words budget. Full-script target is approximately ${targetWords} spoken words, with natural pacing.`
        : vox
        ? `Write exactly ${batchCount} visual beats for global beats ${start + 1} through ${start + batchCount}. Each beat contains one visual idea and ${beatMinWords}-${beatMaxWords} spoken words, approximately ${sceneSec.toFixed(1)} seconds at ${wordsPerSecond} words per second except a very short custom duration. Full script target: ${targetWords} words, allowed ${Math.ceil(targetWords * 0.95)}-${Math.floor(targetWords * 1.05)} words. This batch budget is ${Math.round((start + batchCount) / count * targetWords) - Math.round(start / count * targetWords)} words. Words already written: ${scenes.reduce((sum, scene) => sum + spokenWords(str(scene.narration)), 0)}. ${durationSec >= 15 ? 'Divide the opening 3-4 documentary sentences (30-40 words) across multiple beats without repeating them.' : 'This very short custom duration needs a concise verified cold open and conclusion within its total word budget, not a 30-40 word opening.'}`
        : `Write exactly ${batchCount} scenes for global scenes ${start + 1} through ${start + batchCount}. Each scene lasts approximately ${sceneSec.toFixed(1)} seconds and needs about ${words} spoken words (between ${Math.max(1, words - 3)} and ${words + 3}).`,
      start === 0 ? `The FIRST narration LINE is the complete opening hook: at most ${openingWords} spoken words, no delivery tags; it starts at 0:00 and fits the first ${map ? 2 : 3} seconds. ${map ? 'Continue the same first scene with concise factual context on the following line, within its full-scene spoken word budget.' : 'Explain the context in the following scenes. A single-scene draft puts any remaining narration on subsequent lines.'}` : 'Continue the existing story without repeating the opening hook or restarting the explanation.',
      map ? `Use ${count} chronological map scenes: hook → essential context → surprising factual reframe → payoff that echoes the opening. Do not add a fifth CTA scene; append the required invitation after the factual payoff. App target ${durationSec}s is edited narration length; every Flow source remains 8s.` : '',
      start + batchCount === count ? `This is the final part. ${vox ? 'Finish the factual documentary with a grounded unresolved detail or conclusion before the invitation.' : 'Resolve the question and conclude the story before the invitation.'} Reserve the LAST scene for the exact closing invitation: "${closingInvitation(project.language)}". This final line can exceed the normal per-scene word budget. Do not repeat it elsewhere.` : 'The story continues after this part. Do not conclude or ask viewers to follow/subscribe yet.',
      `This part covers ${Math.round(start / count * 100)}% through ${Math.round((start + batchCount) / count * 100)}% of the story.`,
      scenes.length ? `Immediately preceding scenes, for continuity:\n${scenes.slice(-4).map((c) => `${str(c.title)}: ${str(c.story)}\n${str(c.narration)}`).join('\n\n')}` : ''
    ].filter(Boolean).join('\n\n')
    const plan = await generateJson<ScriptPlan>({ system, prompt, schema: vox ? VOX_SCRIPT_SCHEMA : SCRIPT_SCHEMA, name: 'script', signal })
    const returned = Array.isArray(plan?.scenes) ? plan.scenes : []
    const part = returned
      .filter((c) => c && typeof c === 'object')
      .map((c) => vox ? { ...c, narration: count === 1
        ? str(c.narration).split(/\r?\n/u).map(normalizeVoxNarration).filter(Boolean).join('\n')
        : normalizeVoxNarration(c.narration) } : c)
      .filter((c) => str(c.narration) && str(c.story))
    // VOX's word budget and requested beat count guide the draft, rather than blocking review.
    // Missing fields remain a structural failure; never discard incomplete beats silently.
    if (!part.length || part.length > 64 || part.length !== returned.length || ((map || !voiceLed && (!master || flowShots)) && part.length !== batchCount)) {
      throw new Error(`Naskah bagian ${Math.floor(start / batchSize) + 1} belum lengkap (${part.length}/${batchCount} adegan). Naskah sebelumnya tetap tersimpan. Coba lagi atau pilih model lain.`)
    }
    if (start === 0) title = str(plan.title) || project.title
    scenes.push(...part)
  }

  const closer = closingInvitation(project.language)
  for (const scene of scenes.slice(0, -1)) {
    if (!str(scene.narration).includes(closer)) continue
    scene.narration = str(scene.narration).split(closer).join('').trim()
    if (!scene.narration) throw new Error('Ada ajakan follow/subscribe sebelum cerita selesai. Naskah sebelumnya tetap tersimpan. Coba susun ulang.')
  }

  // Repair only a noncompliant opener, keeping the previous saved script until the complete draft is valid.
  if (!hasShortOpening(str(scenes[0].narration), openingWords, map || scenes.length === 1)) {
    const repaired = await generateJson<ScriptPlan>({
      system,
      prompt: `Repair ONLY the opening scene below. Return exactly one scene, preserving its verified subject, title and visual meaning. ${map ? `Narration line one is a complete factual curiosity hook in ${lang}, at most ${openingWords} words, no delivery tags. Keep the original factual context on subsequent lines, within this scene's ${words} spoken-word budget.` : `Rewrite its narration as a complete factual curiosity hook in ${lang}, at most ${openingWords} words, with no delivery tags or introduction.`} Do not add an invitation here.\n\n${JSON.stringify(scenes[0])}`,
      schema: vox ? VOX_SCRIPT_SCHEMA : SCRIPT_SCHEMA,
      name: 'script_hook',
      signal
    })
    const hook = repaired?.scenes?.[0]
    if (repaired?.scenes?.length !== 1 || !str(hook?.story) || !hasShortOpening(str(hook?.narration), openingWords, map)) {
      throw new Error('Hook pembuka belum sesuai target 3 detik. Naskah sebelumnya tetap tersimpan. Coba susun ulang.')
    }
    const remaining = !map && scenes.length === 1 ? str(scenes[0].narration).split(/\r?\n/u).slice(1).join('\n').trim() : ''
    scenes[0] = { title: str(hook?.title) || scenes[0].title, story: str(hook?.story), narration: [str(hook?.narration), remaining].filter(Boolean).join('\n') }
  }
  const lastScene = scenes[scenes.length - 1]
  lastScene.narration = ensureClosingInvitation(str(lastScene.narration), project.language)

  const totalMs = Math.round(durationSec * 1000)
  const baseMs = Math.floor(totalMs / scenes.length)
  let cumulativeWords = 0

  signal?.throwIfAborted()
  if (captured !== scriptContext(projectId)) throw new Error('Niche, brief, naskah, atau pemeran berubah saat naskah disusun. Naskah sebelumnya tetap tersimpan; susun lagi untuk pilihan terbaru.')
  replaceScript(
    projectId,
    title,
    scenes.map((c, i) => {
      const startSeconds = cumulativeWords / wordsPerSecond
      const sceneWords = spokenWords(str(c.narration))
      cumulativeWords += sceneWords
      return {
        title: str(c.title) || `${vox ? 'Beat' : 'Adegan'} ${i + 1}`,
        story: vox ? `Beat ${i + 1} | ${startSeconds.toFixed(1)}s-${(cumulativeWords / wordsPerSecond).toFixed(1)}s\n${str(c.story)}` : str(c.story),
        narration: str(c.narration),
        // Voice generation later replaces this planned length with the actual audio duration.
        durationMs: voiceLed ? estimateNarrationMs(str(c.narration)) : flowShots ? Math.round(shotSeconds * 1000) : vox ? Math.max(100, Math.round(sceneWords / wordsPerSecond * 1000)) : baseMs + (i < totalMs % scenes.length ? 1 : 0)
      }
    })
  )
  if (flowMode) for (const clip of clipsOf(projectId)) {
    // Motion is only the planned medium until an asset exists; video is generated later on user request.
    getDb().prepare('UPDATE clips SET motion_type = ? WHERE id = ?').run(shotMedia === 'image' ? 'camera' : 'video', clip.id)
  }
  return getBundle(projectId)
}

const CAST_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { characters: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    properties: {
      name: { type: 'string', description: 'Distinct recurring character name/role. Reuse an existing name exactly when appropriate.' },
      description: { type: 'string', description: 'Complete independent English identity brief: narrative role and personality, head/face/body proportions, clothing, accessories, main prop and distinctive visual feature. Match the chosen niche and story. No background or separate scene directions.' }
    }, required: ['name', 'description']
  } } }, required: ['characters']
}

function castContext(project: ReturnType<typeof getProject>, clips: Clip[], known: ReturnType<typeof charactersOf>): string {
  return JSON.stringify({ synopsis: project.synopsis, subjectNiche: project.subjectNiche, language: project.language, aspectRatio: project.aspectRatio,
    styleId: project.styleId, skillId: project.skillId, skillVariant: project.skillVariant, master: resolveMasterPrompt(project),
    script: clips.map(clip => [clip.id, clip.story, clip.narration, clip.characterIds]), cast: known.map(character => [character.id, character.name, character.description]) })
}

function scriptContext(projectId: string): string {
  const project = getProject(projectId)
  return JSON.stringify([castContext(project, clipsOf(projectId), charactersOf(projectId)), project.durationSec, project.aspectRatio, project.title])
}

/** Adds only recurring roles needed by the selected story; existing identities and PNG masters survive. */
export async function generateStoryCharacters(projectId: string, signal?: AbortSignal): Promise<ProjectBundle> {
  signal?.throwIfAborted()
  const project = getProject(projectId)
  if (isMapMaster(project)) throw new Error('Map Animation memakai peta dan ikon geografis. Susun visual peta; character sheet tidak diperlukan.')
  const clips = clipsOf(projectId)
  const known = charactersOf(projectId)
  if (!project.synopsis.trim() && !clips.some(clip => clip.narration.trim() || clip.story.trim())) {
    throw new Error('Pilih ide atau isi cerita dulu sebelum menyusun karakter sesuai niche.')
  }
  const captured = castContext(project, clips, known)
  const script = clips.map(clip => `${clip.title}\n${clip.narration || clip.story}`).join('\n\n')
  // Character planning must consider the whole story, rather than silently truncating a long script.
  if (script.length > 100_000) throw new Error('Naskah terlalu panjang untuk perencanaan karakter sekaligus. Ringkas sinopsis dengan tokoh berulang yang diperlukan, lalu susun karakter sebelum naskah panjang.')
  const stickman = isStickmanMaster(project)
  const result = await generateJson<{ characters?: { name?: string; description?: string }[] }>({
    system: [
      'You are a character designer for the reviewed story. Identify only important recurring actors, not one-off background people. Return at most five useful roles, not five arbitrary characters. Never manufacture historical evidence or unrelated events.',
      `Selected visual style: ${getStyle(project.styleId).name}. ${stickman ? STICKMAN_CHARACTER_DIRECTION : getStyle(project.styleId).characterHint}`,
      stickman ? '' : skillDirection(project.skillId, project.skillVariant, 'visual'),
      masterStageDirection(project, 'visual'),
      subjectNicheDirection(project.subjectNiche),
      'Existing characters remain unchanged. Do not rename or rewrite them, and do not create duplicates with variant spellings. Include an existing name verbatim only when that role is relevant. Write complete identity briefs ready for character-sheet generation, not image bytes or a claim that an image has been generated.'
    ].filter(Boolean).join('\n\n'),
    prompt: [
      `Subject / niche: ${project.subjectNiche || 'Follow the reviewed story'}.`, `Idea / synopsis:\n${project.synopsis}`,
      script ? `Reviewed full narration (do not rewrite it):\n${script}` : 'No completed script yet: propose only roles required by the selected idea.',
      known.length ? `Existing identities, preserve exactly:\n${known.map(character => `${character.name}: ${character.description}`).join('\n')}\nYou may add at most ${Math.max(0, 5 - known.length)} new identities. Reuse existing roles where possible; preserve a larger legacy cast without adding more.` : '',
      'Match era, clothing, props and personality to this specific niche and story. Do not use generic prehistoric costumes for every history topic. Zero new actors is valid when the story needs none.'
    ].filter(Boolean).join('\n\n'), schema: CAST_SCHEMA, name: 'story_characters', signal,
    ...(getSettings().visualPlannerSource === 'codex' ? { source: 'codex', channel: 'visual' } as const : {})
  })
  const proposed = result?.characters
  if (!Array.isArray(proposed) || proposed.length > 5 || proposed.some(character => !str(character?.name) || !str(character?.description)
    || str(character.name).length > 100 || str(character.description).length > 6000)) {
    throw new Error('Rencana karakter belum lengkap. Pemeran sebelumnya tetap tersimpan; coba lagi.')
  }
  const names = proposed.map(character => str(character.name).toLocaleLowerCase())
  if (new Set(names).size !== names.length) throw new Error('Rencana karakter memuat nama ganda. Pemeran sebelumnya tetap tersimpan; coba lagi.')
  const completeCast = new Set([...known.map(character => character.name.trim().toLocaleLowerCase()), ...names])
  if (completeCast.size > Math.max(known.length, 5)) throw new Error('Rencana karakter melebihi lima pemeran berulang. Gunakan kembali tokoh yang ada; pemeran sebelumnya tetap tersimpan.')
  signal?.throwIfAborted()
  if (captured !== castContext(getProject(projectId), clipsOf(projectId), charactersOf(projectId))) {
    throw new Error('Niche, naskah, atau pemeran berubah saat karakter disusun. Hasil lama tetap tersimpan; susun lagi untuk pilihan terbaru.')
  }
  appendCharacters(projectId, proposed.map(character => ({ name: str(character.name), description: str(character.description) })))
  return getBundle(projectId)
}

// ---------- step 2 → 3: visuals for the reviewed script ----------

const VISUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    world: {
      type: 'string',
      description:
        'One English sentence that fixes the world of the whole video: the place (planet, country, city), the era or year, the technology level and who the people are (for example "humans living in a pressurized colony on Mars around 2150"). Every setting below must agree with it.'
    },
    characters: {
      type: 'array',
      description: 'Every recurring character in the requested scenes, including the existing ones unchanged. Empty if there are none.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          identity: {
            type: 'string',
            description:
              'English, what the character is and looks like WITHOUT clothing: species (write "human" for people), gender, age, height and build, skin tone, face, hair, permanent body traits. No clothing, no art-style words.'
          },
          outfit: {
            type: 'string',
            description:
              'English, the default outfit the character wears in MOST of their scenes, with colors and one signature accessory. Choose what fits most scenes: everyday indoor clothes if most scenes are indoors, a spacesuit or armor only if most scenes need it.'
          }
        },
        required: ['name', 'identity', 'outfit']
      }
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scene: { type: 'integer', description: 'The scene number from the script.' },
          setting: {
            type: 'string',
            description:
              'English, self-contained: where and when, always naming the world explicitly (planet or country, era) even if the story makes it obvious, indoor or outdoor, 3 to 5 concrete props or architecture details that prove the world (for example a window showing the red Martian desert), lighting, time of day, color mood.'
          },
          action: {
            type: 'string',
            description:
              'English: the ONE moment shown. Every visible person with role, age, pose and expression, what they are doing, and the concrete visual evidence of what the narration says. Recurring characters by name plus a short role ("Leo, the colony doctor").'
          },
          wardrobe: {
            type: 'array',
            description: 'Clothing of every person visible in the image, including extras.',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', description: 'Character name, or a short label for an extra ("the teenager").' },
                source: {
                  type: 'string',
                  enum: ['reference', 'custom'],
                  description:
                    'reference = the recurring character wears their default outfit as on the reference sheet; custom = a different outfit for this scene (always custom for extras).'
                },
                outfit: { type: 'string', description: 'English. For custom: the full outfit with colors. For reference: a few words naming it.' }
              },
              required: ['name', 'source', 'outfit']
            }
          },
          framing: { type: 'string', description: 'English: shot size, camera angle and composition, e.g. "medium full shot, eye level, the height chart fully visible".' },
          avoid: {
            type: 'string',
            description:
              'English, comma-separated: 3 to 6 things an image model is likely to get wrong for THIS scene, e.g. "Earth landscape, aliens, green skin, spacesuits indoors, helmets".'
          },
          characters: { type: 'array', items: { type: 'string' }, description: 'Names of recurring characters visible in the image.' },
          camera: { type: 'string', enum: CAMERA_IDS, description: 'Camera move over the still image that fits the scene mood.' },
          strength: {
            type: 'string',
            enum: STRENGTH_IDS,
            description: 'How strong the camera move is: halus (subtle, calm or emotional), sedang (medium), kuat (strong, action or big reveals).'
          },
          motion: {
            type: 'string',
            description:
              'English direction for animating this still image into a short AI video: what each character does (gesture, expression, small action), what moves in the environment (wind, fire, water, crowd, dust) and one simple camera move. One or two sentences, no dialogue, no on-screen text, never mention music or sound.'
          },
          transition: {
            type: 'string',
            enum: TRANSITION_IDS,
            description: 'Transition into the next scene: fade for calm or time passing, cut for fast action, slideleft for a change of place, zoomin for a dramatic reveal.'
          }
        },
        required: ['scene', 'setting', 'action', 'wardrobe', 'framing', 'avoid', 'characters', 'camera', 'strength', 'motion', 'transition']
      }
    }
  },
  required: ['world', 'characters', 'scenes']
}

const STICKMAN_VISUAL_SCHEMA = {
  ...VISUAL_SCHEMA,
  properties: {
    ...VISUAL_SCHEMA.properties,
    world: { type: 'string', description: 'English: the simple illustrated documentary setting supported by the reviewed narration. Match the chosen niche; leave unsupported dates, locations or details unspecified.' },
    characters: {
      ...VISUAL_SCHEMA.properties.characters,
      items: {
        ...VISUAL_SCHEMA.properties.characters.items,
        properties: {
          ...VISUAL_SCHEMA.properties.characters.items.properties,
          identity: { type: 'string', description: 'English: this recurring true 2D stickman identity: round head, tiny eyes, simple mouth, thin stick torso/limbs, distinctive small feature and personality. Preserve existing identities exactly. No realistic anatomy or detailed cartoon body.' },
          outfit: { type: 'string', description: 'English: minimal story- and niche-specific costume pieces, accessories and main prop, consistent with the reviewed character sheet. The thin stick structure remains visible.' }
        }
      }
    },
    scenes: {
      ...VISUAL_SCHEMA.properties.scenes,
      items: {
        ...VISUAL_SCHEMA.properties.scenes.items,
        properties: {
          ...VISUAL_SCHEMA.properties.scenes.items.properties,
          setting: { type: 'string', description: 'English: a simple readable environment actually required by the narration. Only relevant supporting props, consistent location/time/weather. No arbitrary background decoration or invented documentary evidence.' },
          action: { type: 'string', description: 'English: one narration-specific still moment. Exact recurring character names, contextual physical pose, simple expression, relevant action and supporting object. This is a finished story frame, not an identity sheet.' },
          framing: { type: 'string', description: 'English: stable wide, medium or full-body framing, clear composition. Camera stays locked throughout the source shot.' },
          camera: { type: 'string', enum: ['static'], description: 'Locked camera; no pan, zoom, shake or reframing.' },
          strength: { type: 'string', enum: ['halus'], description: 'Static camera; visual movement comes from the actor.' },
          motion: { type: 'string', description: 'English: CHARACTER, ACTION, EXPRESSION, ENVIRONMENT, CAMERA, MOTION, STYLE and CONTINUITY. One main action and one supporting action, approximately 0–2 seconds establish, 2–6 continue, 6–10 complete or react. All phases in one uninterrupted locked-camera shot, no cuts or scene changes; match the exact narration.' },
          transition: { type: 'string', enum: ['cut'], description: 'Direct cut between edited narration sections; no transition inside the continuous source shot.' }
        }
      }
    }
  }
}

const VOX_VISUAL_SCHEMA = {
  ...VISUAL_SCHEMA,
  properties: {
    ...VISUAL_SCHEMA.properties,
    world: { type: 'string', description: 'English, verified place and era or subject context supported by the reviewed narration. Unknown specifics remain unspecified. Do not invent documentary evidence.' },
    scenes: {
      ...VISUAL_SCHEMA.properties.scenes,
      items: {
        ...VISUAL_SCHEMA.properties.scenes.items,
        properties: {
          ...VISUAL_SCHEMA.properties.scenes.items.properties,
          setting: { type: 'string', description: 'English, one minimal documentary background plate such as aged newsprint or an archival map. Geographic/date details must be supported by the narration; otherwise omit them.' },
          action: { type: 'string', description: 'English, one visual idea from this beat. One hero paper cutout taking about 70% visual weight, maximum 2-3 concrete supporting elements and 10% background. Describe the finished composition only, not an entrance or animation.' },
          framing: { type: 'string', description: 'English, fixed tabletop editorial composition with generous negative space. No camera movement, reframing or montage.' },
          avoid: { type: 'string', description: 'English, specific factual/identity mistakes to avoid. Never prohibit the explicitly specified label. No invented documents, gore or suffering close-ups.' },
          label: { type: 'string', description: 'Default empty. Only when a verified important date, name or number is needed, quote one exact 1-4 word phrase from this beat narration as the sole label. No other text.' },
          camera: { type: 'string', enum: ['static'], description: 'Locked static camera throughout the source clip.' },
          strength: { type: 'string', enum: ['halus'], description: 'Static camera, no zoom/pan/shake.' },
          motion: { type: 'string', description: 'Rigid paper pieces assemble back to front, then hold the exact finished composition. Tiny handcrafted landing bounce, stepped stop-motion cadence. No camera motion, morphing or object replacement.' },
          transition: { type: 'string', enum: ['cut'], description: 'Separate narration beats are joined by a direct editorial cut. No transition inside the 10-second generated source clip.' }
        },
        required: [...VISUAL_SCHEMA.properties.scenes.items.required, 'label']
      }
    }
  }
}

interface HealthActing {
  narrationCue: string
  pose: string
  gaze: string
  contact: string
  consequence: string
  reaction: string
  layers: string
  sequence: string
}

const HEALTH_ACTING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    narrationCue: { type: 'string', description: 'Exact relevant quoted phrase from this scene narration, kept in its original language. Acting context only, never text baked into the image.' },
    pose: { type: 'string', description: 'English: exact existing character name, anatomy-preserving contextual pose and speaking intent. Which expression changes from the master, without redesigning identity.' },
    gaze: { type: 'string', description: 'English: who looks at which exact character or prop, and when the gaze shifts.' },
    contact: { type: 'string', description: 'English: the physical action and point of contact with a named prop or character; say explicitly if no contact is needed. Do not invent biological mechanisms.' },
    consequence: { type: 'string', description: 'English: visible state change caused by the physical action, tied to the narration.' },
    reaction: { type: 'string', description: 'English: the named listener or acting character reacts after the consequence, with a relevant humorous expression or gesture.' },
    layers: { type: 'string', description: 'English: distinguish character, supporting props and background/foreground for later animation. One composed scene, no contact sheet or baked labels.' },
    sequence: { type: 'string', description: 'English: relative shot sequence: first speaking intent and gaze, then action, consequence and reaction. Honor the selected shot duration; no claim of lip sync or speech generation.' }
  },
  required: ['narrationCue', 'pose', 'gaze', 'contact', 'consequence', 'reaction', 'layers', 'sequence']
}

const HEALTH_VISUAL_SCHEMA = {
  ...VISUAL_SCHEMA,
  properties: {
    ...VISUAL_SCHEMA.properties,
    world: { type: 'string', description: 'English: the illustrative biological environment, organ system, tissue or microscopic level, and whether scale is simplified. Do not require a country, planet or era for an internal body scene.' },
    characters: {
      ...VISUAL_SCHEMA.properties.characters,
      items: {
        ...VISUAL_SCHEMA.properties.characters.items,
        properties: {
          ...VISUAL_SCHEMA.properties.characters.items.properties,
          identity: { type: 'string', description: 'English: exact organ, tissue or cell identity, biological silhouette, proportions, palette, distinctive traits and face placement/count from the existing master description. No human gender, hair or torso requirements for organ/cell characters.' },
          outfit: { type: 'string', description: 'Empty for an organ or cell without clothing. Describe a costume only when the reviewed scene explicitly uses it; preserve supplied master identity.' }
        }
      }
    },
    scenes: {
      ...VISUAL_SCHEMA.properties.scenes,
      items: {
        ...VISUAL_SCHEMA.properties.scenes.items,
        properties: {
          ...VISUAL_SCHEMA.properties.scenes.items.properties,
          setting: { type: 'string', description: 'English: the self-contained illustrative body, tissue or cell environment, scale, framing, lighting and meaningful props tied to the reviewed narration. Do not invent anatomical connections or evidence.' },
          action: { type: 'string', description: 'English: the one anatomy-preserving moment shown, named organ/cell actor and responder, contextual physical pose/expression, interaction and visible evidence of the reviewed narration.' },
          wardrobe: { ...VISUAL_SCHEMA.properties.scenes.items.properties.wardrobe, description: 'Empty array for organ/cell characters without clothes. Include actual human clothing or an explicitly requested contextual costume only.' },
          acting: HEALTH_ACTING_SCHEMA
        },
        required: [...VISUAL_SCHEMA.properties.scenes.items.required, 'acting']
      }
    }
  }
}

type VisualScene = {
  scene?: number
  setting?: string
  action?: string
  wardrobe?: { name?: string; source?: string; outfit?: string }[]
  framing?: string
  avoid?: string
  label?: string
  characters?: string[]
  camera?: string
  strength?: string
  motion?: string
  transition?: string
  acting?: HealthActing
}

interface VisualPlan {
  world?: string
  characters?: { name?: string; identity?: string; outfit?: string }[]
  scenes?: VisualScene[]
}

/** A character description for image prompts: body and face first, then the outfit shown on the reference sheet. */
function characterLook(c: { identity?: string; outfit?: string }): string {
  const who = str(c.identity).replace(/\.$/, '')
  const outfit = str(c.outfit).replace(/\.$/, '')
  return [who && `${who}.`, outfit && `Default outfit: ${outfit}.`].filter(Boolean).join(' ')
}

/**
 * The scene's image prompt as labelled lines the user can read and edit in the storyboard. The image
 * generator reads the Wardrobe and Avoid lines (see clipPrompt in generation.ts).
 */
function visualText(a: VisualScene): string {
  const wardrobe = (a.wardrobe ?? [])
    .filter((w) => str(w.name))
    .map((w) =>
      w.source === 'reference'
        ? `${str(w.name)} - default outfit as on the reference sheet${str(w.outfit) ? ` (${str(w.outfit)})` : ''}`
        : `${str(w.name)} - custom for this scene: ${str(w.outfit)}`
    )
  return [
    str(a.setting) && `Setting: ${str(a.setting)}`,
    str(a.action) && `Action: ${str(a.action)}`,
    wardrobe.length > 0 && `Wardrobe: ${wardrobe.join('; ')}`,
    str(a.framing) && `Framing: ${str(a.framing)}`,
    str(a.avoid) && `Avoid: ${str(a.avoid)}`,
    ...(a.acting ? [
      'Narration cue: ' + str(a.acting.narrationCue),
      'Pose / speaking intent: ' + str(a.acting.pose),
      'Gaze: ' + str(a.acting.gaze),
      'Contact / action: ' + str(a.acting.contact),
      'Visible consequence: ' + str(a.acting.consequence),
      'Reaction: ' + str(a.acting.reaction),
      'Animation layers: ' + str(a.acting.layers)
    ] : [])
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Designs one image per scene (plus camera move, transition and AI-video direction) from the reviewed
 * script. "missing" only covers scenes without a plan or whose story changed since; "all" redoes every scene.
 */
export async function generateVisuals(projectId: string, mode: 'missing' | 'all', signal?: AbortSignal): Promise<ProjectBundle> {
  signal?.throwIfAborted()
  const planner = getSettings().visualPlannerSource
  const project = getProject(projectId)
  if (isMapMaster(project)) return generateMapVisuals(projectId, signal)
  const master = resolveMasterPrompt(project)
  const vox = isVoxMaster(project)
  const stickman = isStickmanMaster(project)
  const skillVariant = project.masterPrompt && !vox && project.skillVariant === 'vox' ? undefined : project.skillVariant
  const sourceSeconds = master?.timing.sourceVideoSeconds ?? 10
  const health = project.skillId === 'explainer-animasi-kesehatan' && !vox && !stickman
  const clips = clipsOf(projectId)
  if (!clips.length) throw new Error('Naskah masih kosong. Tambahkan adegan dulu.')
  const empty = clips.findIndex((c) => !c.story.trim() && !c.narration.trim())
  if (empty >= 0) throw new Error(`Adegan ${empty + 1} masih kosong. Isi alur atau narasinya dulu.`)
  const targets = clips.map((c, i) => ({ clip: c, n: i + 1 })).filter((t) => mode === 'all' || needsVisual(t.clip))
  if (!targets.length) return getBundle(projectId)

  const known = charactersOf(projectId)
  const captured = castContext(project, clips, known)
  const baseSystem = stickman ? [
    'You are the storyboard director for a true 2D stickman documentary. The narration is reviewed and final; never rewrite or exaggerate its factual meaning.',
    STICKMAN_VISUAL_DIRECTION,
    'Each still is one meaningful moment in one continuous shot, not a character sheet. Give a simple story-relevant environment, a clear actor, main physical action, expression and one supporting prop if necessary. Use existing exact character names and descriptions.',
    'Describe motion as CHARACTER, ACTION, EXPRESSION, ENVIRONMENT, CAMERA, MOTION and CONTINUITY, with one main action and at most one supporting action over 0-2, 2-6 and 6-10 seconds. These are phases of ONE uninterrupted shot, not separate scenes. Preserve the exact narration section as the action cue.',
    'Required camera static, strength halus, transition cut. Keep the previous location, clothing and held props until the story actually changes them. No invented documentary details or random decorative characters.',
    'Reuse the reviewed cast. Add only an indispensable recurring role missing from the cast; aim for at most five identities across the story, and never invent background characters just to fill a quota.',
    'Write the design and direction fields in English, but keep character names unchanged.'
  ].join('\n') : vox ? [
    'You are an editorial documentary paper-collage art director. The reviewed narration is final and defines the factual scope.',
    VOX_VISUAL_DIRECTION,
    `Each scene depicts exactly one visual idea, one dominant hero cutout, at most 2-3 supporting elements and a minimal background. Describe the FINISHED still composition. This still is the end-state of a separate ${sourceSeconds}-second source animation.`,
    `The narration beat lasts about ${master?.timing.beatSeconds ?? 2.5} seconds. Its duration is separate from the Flow source clip. Follow the timing in the selected video master prompt; never shorten or speed up source assembly merely to fit the narration beat.`,
    'Keep recurring subjects by the exact same name, identity description and outfit each time. Preserve every existing description verbatim. No fabricated locations, timestamps, archival records, eyewitness detail or photographs asserted as authentic evidence.',
    'Default no text. Only an important verified date, name or number from this beat narration may appear as ONE explicit 1-4 word label. Return that exact narration phrase in label, or an empty string. Do not prohibit the specified label in avoid. No other text, logos or watermarks.',
    'The camera is locked: camera static, strength halus, transition cut. Do not add zoom, pan, tilt, dolly, orbit, shake, camera reframing, morphing, internal cuts or transitions. Animation consists of rigid paper assembly and subtle held-poster life only.',
    'Write world, identity, outfit, setting, action, wardrobe, framing, avoid and motion in English. Keep label exactly as it appears in the original-language narration. Do not use an em dash.'
  ].join('\n') : [
    'You are the storyboard artist for a faceless YouTube video. The script is final; you design the pictures.',
    'For each requested scene you describe ONE still image, choose the camera move and its strength over that image, the transition into the next scene, and write how the image would move if it is animated as an AI video.',
    'Rules for the image descriptions, which go to a text-to-image model that never sees the script:',
    health
      ? '1. Every scene is self-contained. State its illustrative body region, tissue or cell environment and level of scale. Keep the selected organ or cell as the main actor, with clear meaningful supporting props and consistent illustrative anatomy; no arbitrary planet, country or era requirement for internal body scenes.'
      : '1. Every scene is self-contained. Always name the world (planet or country, era, technology) in the setting, even when the story makes it obvious, and add background details that prove it. Without this the model falls back to present-day Earth.',
    health
      ? '2. Turn the reviewed narration into a concrete showable action, consequence and reaction. Visible teaching metaphors must remain illustrative; never invent a medical mechanism, anatomical connection, diagnostic image or factual evidence merely to make the scene dramatic.'
      : '2. Turn narration into a literal, showable moment. When the narration is a general statement ("after generations, children grow taller"), invent one concrete situation that shows it with visible evidence (a height chart, a comparison with an adult, an old photo), never a symbol or a vague mood.',
    health
      ? '3. Describe organ, tissue and cell actors by their exact existing biological master identity and recognizable silhouette. They are not human mascots. Human descriptions apply only when an actual human appears.'
      : '3. Describe people plainly as humans. Do not use words an image model may read literally or as fantasy, such as Martian, alien, native, creature, mutant, hybrid or "-born", unless they really are not human; describe the difference concretely instead ("a human teenager, about 2.1 m tall, very slender, long limbs, normal human face").',
    health
      ? '4. Use empty wardrobe arrays and empty default outfits for organ/cell actors unless the reviewed narrative explicitly uses a costume. Do not add hair, human torso, shoes or clothing by default. Actual human extras may have contextual clothing.'
      : '4. Clothing must suit the place and action: no spacesuits or helmets inside a pressurized room, a spacesuit outside on an airless surface, period clothing for history. A recurring character keeps their default outfit (source "reference") unless the scene needs something else; then use "custom" and describe the new outfit in full. Describe the clothing of every extra too.',
    health
      ? '5. Recurring actors can be organs, tissue or cells. Keep every selected existing master name, silhouette, face placement/count, proportions and palette. Only add an actor absent from the library when the narrative really needs it; preserve existing descriptions exactly.'
      : '5. Keep every recurring character visually consistent: reuse the existing characters exactly as given (same name, identity and outfit) and only add characters that are missing. Characters are only people who appear in several scenes; one-off people are extras described inside the scene.',
    '6. No readable text, signs, captions or labels in the image. Vary shot sizes, angles and camera moves across scenes so the video never feels repetitive.',
    'Write "world", "identity", "outfit", "setting", "action", "wardrobe", "framing", "avoid" and "motion" in English.',
    skillDirection(project.skillId, skillVariant, 'visual'),
    project.skillId === 'explainer-animasi-kesehatan'
      ? 'For this skill, recurring characters may be organs, tissue or cells, not only people. Name and describe their exact biological shape and single face. The rule about literal human descriptions applies only when a human is shown.'
      : '',
    health ? 'For each scene, fill the acting object completely. The narrationCue is an exact short phrase from this scene narration in its original language; all other acting directions are English. Make speaking intent, pose, gaze and contact concrete, then the visible consequence and reaction in that order. A shot may show one concise beat, but every acting field is still specific to its narration. Static bobbing or a camera zoom is not a substitute for action. Keep health imagery illustrative, not invented evidence.' : '',
    health ? 'Reuse every selected existing PNG master by its exact name and description whenever it appears; do not rename, split, merge or rewrite its identity. The image generator will receive the actual identity PNG plus optional expression/pose banks. You see metadata descriptions only: never claim you inspected PNG pixels. Expression banks guide pose and emotion only. Do not invent a human torso, new faces or contradictory anatomy for an organ master.' : ''
  ].join('\n')
  const system = [baseSystem, masterStageDirection(project, 'visual'), masterStageDirection(project, 'video'), subjectNicheDirection(project.subjectNiche),
    master?.lockedCamera ? 'Locked camera rule: every camera value must be static. No camera movement or reframing may be added in the motion field.' : ''
  ].filter(Boolean).join('\n\n')
  const characterPlans = new Map(known.map((c) => [c.name.trim().toLowerCase(), { name: c.name, description: c.description }]))
  const updates: SceneVisual[] = []
  const batchSize = 32
  for (let start = 0; start < targets.length; start += batchSize) {
    const batch = targets.slice(start, start + batchSize)
    // Include neighbors for continuity while avoiding the full long script in every request.
    const context = new Set(batch.flatMap((t) => [t.n - 1, t.n, t.n + 1]))
    const script = clips
      .map((c, i) => ({ clip: c, n: i + 1 }))
      .filter((t) => context.has(t.n))
      .map(({ clip: c, n }) => `Scene ${n}: ${c.title}\nStory: ${c.story || '(none)'}\nNarration (${languageOf(project.language)}): ${c.narration || '(none)'}`)
      .join('\n\n')
    const prompt = [
      vox ? `Visual style: ${getStyle(project.styleId).name}. Produce clean editorial documentary paper cutouts, never illustration or cartoon.` : `Visual style of the video (for your framing choices only, do not repeat it in the descriptions): ${getStyle(project.styleId).name}.`,
      stickman ? 'Use the selected Stickman master: true 2D round-head, thin-stick characters and simple readable environments.' : vox ? 'Use the selected VOX master visual rules. The separately stored visual style remains available for other workflows.' : `Selected art direction, for design consistency: ${getStyle(project.styleId).prompt}`,
      `Frame format: ${project.aspectRatio === '9:16' ? 'vertical 9:16' : 'horizontal 16:9'}.`,
      `Idea of the video: ${project.synopsis}`,
      project.subjectNiche ? `Selected subject / niche: ${project.subjectNiche}.` : '',
      characterPlans.size ? `Existing characters (keep them exactly):\n${Array.from(characterPlans.values()).map((c) => `- ${c.name}: ${c.description}${known.some((character) => character.name === c.name && character.sheetAssetId) ? ' [PNG identity master available]' : ''}`).join('\n')}` : 'There are no existing characters yet.',
      `Script for this part and its immediate neighbors:\n${script}`,
      updates.length ? `Previous visual, for world continuity:\n${updates[updates.length - 1].visualPrompt}` : '',
      `Write visuals for these scenes only: ${batch.map((t) => t.n).join(', ')}. Use these exact global scene numbers, not numbers starting from 1.`,
      stickman ? 'Required camera static, strength halus, transition cut. Motion describes one continuous 10-second source shot with clear action and reaction, never a montage.' : vox ? 'Required camera: static. Required strength: halus. Required transition: cut. Every scene is one finished composition; optional label is empty or one exact 1-4 word narration phrase.' : `Allowed camera values: ${CAMERA_IDS.join(', ')}. Allowed strength values: ${STRENGTH_IDS.join(', ')}. Allowed transition values: ${TRANSITION_IDS.join(', ')}.`
    ].filter(Boolean).join('\n\n')
    const plan = await generateJson<VisualPlan>({ system, prompt, schema: stickman ? STICKMAN_VISUAL_SCHEMA : vox ? VOX_VISUAL_SCHEMA : health ? HEALTH_VISUAL_SCHEMA : VISUAL_SCHEMA, name: 'visuals', signal, timeoutKind: 'visual', ...(planner === 'codex' ? { source: 'codex', channel: 'visual' } : {}) })
    signal?.throwIfAborted()
    if (stickman && (!Array.isArray(plan.characters) || !Array.isArray(plan.scenes))) throw new Error('Rencana Stickman belum lengkap. Visual sebelumnya tetap tersimpan; susun ulang visual.')
    const batchCast = new Map(characterPlans)
    for (const character of plan.characters ?? []) {
      const name = str(character.name)
      if (stickman && (!name || name.length > 100 || (!batchCast.has(name.toLowerCase()) && !str(character.identity)))) {
        throw new Error('Deskripsi identitas Stickman belum lengkap. Pemeran dan visual sebelumnya tetap tersimpan; susun ulang visual.')
      }
      if (name && !batchCast.has(name.toLowerCase())) batchCast.set(name.toLowerCase(), { name, description: characterLook(character) })
    }
    const answers = (plan.scenes ?? []).filter((s) => str(s.setting) || str(s.action))
    const byNumber = new Map<number, (typeof answers)[number]>()
    const loose: typeof answers = []
    for (const answer of answers) {
      const n = Number(answer.scene)
      if (Number.isInteger(n) && batch.some((t) => t.n === n) && !byNumber.has(n)) byNumber.set(n, answer)
      else if (!answer.scene) loose.push(answer)
    }
    for (const target of batch) {
      const answer = byNumber.get(target.n) ?? loose.shift()
      if (!answer) throw new Error(`Visual adegan ${target.n} belum lengkap. Visual sebelumnya tetap tersimpan. Coba lagi atau pilih model lain.`)
      if (stickman && (!str(answer.setting) || !str(answer.action) || !str(answer.framing) || !str(answer.motion))) {
        throw new Error(`Arahan Stickman adegan ${target.n} belum lengkap. Visual sebelumnya tetap tersimpan; susun ulang visual.`)
      }
      if (stickman) {
        if (!Array.isArray(answer.characters) || answer.characters.some(name => !str(name))) throw new Error(`Daftar pemeran Stickman adegan ${target.n} belum lengkap. Visual sebelumnya tetap tersimpan.`)
        const returnedCast = new Set(answer.characters.map(name => name.trim().toLowerCase()))
        const actorText = [target.clip.narration, target.clip.story, answer.action].join('\n')
        for (const character of batchCast.values()) {
          const escaped = character.name.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
          const mentioned = new RegExp('(^|[^\\p{L}\\p{N}_])' + escaped + '(?=$|[^\\p{L}\\p{N}_])', 'iu').test(actorText)
          const selected = known.some(actor => actor.name.toLowerCase() === character.name.toLowerCase() && target.clip.characterIds.includes(actor.id))
          if ((mentioned || selected) && !returnedCast.has(character.name.toLowerCase())) throw new Error(`Karakter "${character.name}" terlewat pada adegan ${target.n}. Referensi identitas harus tetap dipakai; visual sebelumnya tetap tersimpan.`)
        }
      }
      if (health) {
        const returnedCast = new Set((answer.characters ?? []).filter((name): name is string => typeof name === 'string').map((name) => name.trim().toLowerCase()))
        for (const character of known) {
          const name = character.name.trim()
          if (!name) continue
          const escaped = name.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
          const mentioned = new RegExp('(^|[^\\p{L}\\p{N}_])' + escaped + '(?=$|[^\\p{L}\\p{N}_])', 'iu').test(target.clip.narration)
          if ((target.clip.characterIds.includes(character.id) || mentioned) && !returnedCast.has(name.toLowerCase())) {
            throw new Error('Karakter "' + name + '" terlewat pada adegan ' + target.n + '. Master yang dipilih atau disebut narasi harus tetap dipakai. Visual sebelumnya tetap tersimpan.')
          }
        }
        if (!answer.acting || HEALTH_ACTING_SCHEMA.required.some((field) => !str(answer.acting?.[field as keyof HealthActing]))) {
          throw new Error(`Arahan gerak adegan ${target.n} belum lengkap. Isi pose, interaksi, akibat, dan reaksi sesuai narasi. Visual sebelumnya tetap tersimpan.`)
        }
        const cue = str(answer.acting.narrationCue).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+/g, ' ').toLowerCase()
        const narration = (target.clip.narration.trim() || target.clip.story.trim()).replace(/\s+/g, ' ').toLowerCase()
        if (!cue || !narration.includes(cue)) throw new Error(`Arahan gerak adegan ${target.n} tidak sesuai narasinya. Visual sebelumnya tetap tersimpan; coba susun ulang visual.`)
      }
      if (vox) {
        const label = str(answer.label)
        const narration = target.clip.narration.toLocaleLowerCase()
        if (label && (spokenWords(label) > 4 || !narration.includes(label.toLocaleLowerCase()))) throw new Error(`Label beat ${target.n} harus 1-4 kata dari narasinya. Visual sebelumnya tetap tersimpan.`)
        const cast = (answer.characters ?? []).map((name) => batchCast.get(name.trim().toLowerCase())).filter((character): character is { name: string; description: string } => !!character)
        if (cast.length !== (answer.characters ?? []).length) throw new Error(`Identitas subjek beat ${target.n} belum lengkap. Visual sebelumnya tetap tersimpan; coba susun ulang.`)
        updates.push(toSceneVisual(target.clip, answer, { aspectRatio: project.aspectRatio, cast: cast.map((character) => `${character.name}: ${character.description}`).join('\n') }))
      } else updates.push(toSceneVisual(target.clip, answer))
      const update = updates[updates.length - 1]
      if (master?.lockedCamera) update.cameraPreset = 'static'
      if (stickman) {
        if (batchCast.size > Math.max(known.length, 5)) throw new Error('Rencana Stickman memuat terlalu banyak karakter baru. Tinjau pemeran berulang; visual sebelumnya tetap tersimpan.')
        if (update.characterNames.some(name => !batchCast.has(name.trim().toLowerCase()))) throw new Error(`Identitas Stickman adegan ${target.n} belum lengkap. Susun karakter terlebih dahulu; visual sebelumnya tetap tersimpan.`)
        update.cameraPreset = 'static'
        update.motionStrength = 'halus'
        update.transition = 'cut'
        update.videoPrompt = `SCRIPT SECTION:\n${target.clip.narration}\n\n10-SECOND CONTINUOUS STICKMAN SHOT:\n${str(answer.motion)}`
      }
      if (master?.videoMode === 'universal') update.videoPrompt = master.stages.video
    }
    for (const character of plan.characters ?? []) {
      const name = str(character.name)
      const key = name.toLowerCase()
      if (name && !characterPlans.has(key)) characterPlans.set(key, { name, description: characterLook(character) })
    }
  }

  if (captured !== castContext(getProject(projectId), clipsOf(projectId), charactersOf(projectId))) {
    throw new Error('Niche, naskah, atau pemeran berubah saat visual disusun. Visual sebelumnya tetap tersimpan; susun lagi untuk pilihan terbaru.')
  }
  signal?.throwIfAborted()
  applyVisuals(
    projectId,
    Array.from(characterPlans.values()),
    updates
  )
  return getBundle(projectId)
}

function toSceneVisual(clip: Clip, a: NonNullable<VisualPlan['scenes']>[number], vox?: { aspectRatio: string; cast: string }): SceneVisual {
  const camera = str(a.camera) as CameraPresetId
  const strength = str(a.strength) as MotionStrength
  const transition = str(a.transition) as TransitionId
  return {
    clipId: clip.id,
    visualPrompt: vox ? voxImagePrompt([
      'Setting: ' + str(a.setting),
      'Scene: ' + str(a.action),
      'Framing: ' + str(a.framing),
      ...(a.wardrobe ?? []).map((wardrobe) => `Wardrobe: ${str(wardrobe.name)}: ${str(wardrobe.outfit)}`),
      str(a.label) ? 'Specified label: "' + str(a.label) + '".' : 'Specified label: none. No text.',
      str(a.avoid) ? 'Avoid: ' + str(a.avoid) : ''
    ].filter(Boolean).join('\n'), vox.aspectRatio, vox.cast) : visualText(a),
    characterNames: Array.isArray(a.characters) ? a.characters.filter((n): n is string => typeof n === 'string') : [],
    cameraPreset: vox ? 'static' : CAMERA_IDS.includes(camera) ? camera : clip.cameraPreset,
    motionStrength: vox ? 'halus' : STRENGTH_IDS.includes(strength) ? strength : clip.motionStrength,
    videoPrompt: vox ? VOX_UNIVERSAL_VIDEO_PROMPT : a.acting ? [
      'Narration acting cue (silent): ' + str(a.acting.narrationCue),
      'Sequence: ' + str(a.acting.sequence),
      'Pose / speaking intent: ' + str(a.acting.pose),
      'Gaze: ' + str(a.acting.gaze),
      'Physical action / contact: ' + str(a.acting.contact),
      'Visible consequence: ' + str(a.acting.consequence),
      'Reaction: ' + str(a.acting.reaction),
      str(a.motion)
    ].filter(Boolean).join('\n') : str(a.motion),
    transition: vox ? 'cut' : TRANSITION_IDS.includes(transition) ? transition : clip.transition
  }
}

// ---------- background music ----------

const MUSIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Short English track title, max 40 characters.' },
    style: {
      type: 'string',
      description:
        'Suno "Style of Music" field: 6 to 12 comma-separated English tags covering genre, mood, main instruments, tempo in BPM and "instrumental". Max 180 characters.'
    },
    exclude: { type: 'string', description: 'Suno "Exclude styles" field: comma-separated English tags to avoid, such as vocals or anything that would fight the voice-over. Max 80 characters.' },
    description: {
      type: 'string',
      description:
        'One English paragraph (50 to 90 words) for any text-to-music AI: genre, mood, instruments, tempo, how the energy moves from the opening to the ending, instrumental with no vocals, sits under a narrator, and the target length.'
    },
    reason: { type: 'string', description: 'One sentence in Indonesian telling the creator why this music suits the video.' }
  },
  required: ['title', 'style', 'exclude', 'description', 'reason']
}

/** A prompt for background music that suits the story, to paste into Suno or another music AI. */
export async function generateMusicPrompt(projectId: string): Promise<MusicPrompt> {
  const b = getBundle(projectId)
  const p = b.project
  const clips = b.clips
  if (!clips.some((c) => c.narration.trim() || c.story.trim()) && !p.synopsis.trim()) throw new Error('Naskah masih kosong.')
  const durationSec = Math.max(10, Math.round(clips.reduce((n, c) => n + c.durationMs, 0) / 1000) || p.durationSec)
  const style = getStyle(p.styleId)
  const system = [
    'You are a music supervisor for faceless YouTube storytelling videos.',
    'You pick background music that supports a voice-over without competing with it: instrumental, no vocals or choirs with words, clear space in the mid range where the voice sits.',
    'Match the setting and era of the story (for example gamelan or kendang colours for an old Javanese kingdom, orchestral for epic history, lo-fi for a calm explainer) and follow its emotional arc from the hook to the ending.',
    'Write the music fields in English, because music AIs understand English best. Never name real artists or copyrighted songs.'
  ].join(' ')
  const scenes = clips
    .map((c, i) => `${i + 1}. ${c.title}: ${c.story || c.narration}`.slice(0, 260))
    .join('\n')
  const prompt = [
    `Video title: ${p.title || '(untitled)'}`,
    `Idea: ${p.synopsis}`,
    `Visual style: ${style.name}.`,
    `Video length: about ${durationSec} seconds.`,
    `Scenes:\n${scenes}`
  ].join('\n\n')
  const r = await generateJson<Partial<MusicPrompt>>({ system, prompt, schema: MUSIC_SCHEMA, name: 'music' })
  const out: MusicPrompt = {
    title: str(r.title),
    style: str(r.style),
    exclude: str(r.exclude),
    description: str(r.description),
    reason: str(r.reason),
    durationSec
  }
  if (!out.style && !out.description) throw new Error('Model tidak menghasilkan prompt musik. Coba lagi.')
  return out
}
