import { CAMERA_PRESETS, MOTION_STRENGTHS, TRANSITIONS } from '@shared/motion'
import { LANGUAGES, clipCountFor } from '@shared/models'
import { needsVisual } from '@shared/script'
import { validateDurationSec } from '@shared/duration'
import { skillDirection } from '@shared/skills'
import { getStyle } from '@shared/styles'
import type { CameraPresetId, Clip, MotionStrength, MusicPrompt, ProjectBundle, TransitionId } from '@shared/types'
import { applyVisuals, charactersOf, clipsOf, getBundle, getProject, replaceScript, type SceneVisual } from './repo'
import { generateJson } from './services/llm'

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

/** Writes the scene-by-scene script (story and voice-over) that the user reviews before any visuals exist. */
export async function generateScript(projectId: string): Promise<ProjectBundle> {
  const project = getProject(projectId)
  if (!project.synopsis.trim()) throw new Error('Tulis ide cerita atau sinopsis dulu.')
  const lang = languageOf(project.language)
  const durationSec = validateDurationSec(project.durationSec)
  const count = clipCountFor(durationSec)
  const sceneSec = durationSec / count
  const words = Math.max(1, Math.round(sceneSec * 2.3))
  const health = project.skillId === 'explainer-animasi-kesehatan'
  const known = health ? charactersOf(projectId) : []

  const system = [
    'You are a scriptwriter for faceless YouTube storytelling and explainer videos.',
    'You turn an idea into a sequence of short scenes. Each scene has one line of voice-over.',
    'The first scene is a strong hook. The story has a clear beginning, rising tension and a satisfying ending. The last scene can invite viewers to subscribe.',
    'Keep facts accurate for history and science topics, and always call each character by the same name.',
    'The narration is voiced by an expressive text-to-speech model. Where it helps the delivery, add a few English vocal tags in angle brackets inside the narration, such as <short pause>, <long pause>, <chuckles>, <sigh>, <gasp> or <whispers>. Use them sparingly, at most one or two per scene, and never other markup.',
    `Write everything in ${lang}, except the vocal tags, which stay in English.`,
    skillDirection(project.skillId, project.skillVariant, 'script')
  ].join(' ')
  const scenes: NonNullable<ScriptPlan['scenes']> = []
  let title = project.title
  // Keep responses and continuity context bounded. Commit only after every batch succeeds.
  const batchSize = 32
  for (let start = 0; start < count; start += batchSize) {
    const batchCount = Math.min(batchSize, count - start)
    const prompt = [
      health && known.length
        ? 'Existing character masters; keep these exact names and identities in the story:\n' + known.map((character) => '- ' + character.name + ': ' + character.description + (character.sheetAssetId ? ' [PNG identity master available]' : ' [description only]')).join('\n')
        : '',
      health ? 'For each scene, the story field is an actionable acting brief: quote the narration phrase being shown, name the acting character, its contextual pose and gaze target, the physical action and contact, visible consequence, then reaction. The narration field contains only the final spoken line, not the acting directions. Do not invent unsupported new medical claims from expression references.' : '',
      `Idea / synopsis:\n${project.synopsis}`,
      `Target full video length: about ${durationSec} seconds in ${count} scenes. Frame format: ${project.aspectRatio}.`,
      `Write exactly ${batchCount} scenes for global scenes ${start + 1} through ${start + batchCount}. Each scene lasts approximately ${sceneSec.toFixed(1)} seconds and needs about ${words} spoken words (between ${Math.max(1, words - 3)} and ${words + 3}).`,
      start === 0 ? 'Begin with the opening hook.' : 'Continue the existing story without repeating the opening hook or restarting the explanation.',
      start + batchCount === count ? 'This is the final part. Resolve the question and conclude the story.' : 'The story continues after this part. Do not conclude or ask viewers to subscribe yet.',
      `This part covers ${Math.round(start / count * 100)}% through ${Math.round((start + batchCount) / count * 100)}% of the story.`,
      scenes.length ? `Immediately preceding scenes, for continuity:\n${scenes.slice(-4).map((c) => `${str(c.title)}: ${str(c.story)}\n${str(c.narration)}`).join('\n\n')}` : ''
    ].filter(Boolean).join('\n\n')
    const plan = await generateJson<ScriptPlan>({ system, prompt, schema: SCRIPT_SCHEMA, name: 'script' })
    const part = (plan.scenes ?? []).filter((c) => str(c.narration) && str(c.story))
    if (part.length !== batchCount) {
      throw new Error(`Naskah bagian ${Math.floor(start / batchSize) + 1} belum lengkap (${part.length}/${batchCount} adegan). Naskah sebelumnya tetap tersimpan. Coba lagi atau pilih model lain.`)
    }
    if (start === 0) title = str(plan.title) || project.title
    scenes.push(...part)
  }

  const totalMs = Math.round(durationSec * 1000)
  const baseMs = Math.floor(totalMs / scenes.length)

  replaceScript(
    projectId,
    title,
    scenes.map((c, i) => ({
      title: str(c.title) || `Adegan ${i + 1}`,
      story: str(c.story),
      narration: str(c.narration),
      // Voice generation later replaces this planned length with the actual audio duration.
      durationMs: baseMs + (i < totalMs % scenes.length ? 1 : 0)
    }))
  )
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
export async function generateVisuals(projectId: string, mode: 'missing' | 'all'): Promise<ProjectBundle> {
  const project = getProject(projectId)
  const health = project.skillId === 'explainer-animasi-kesehatan'
  const clips = clipsOf(projectId)
  if (!clips.length) throw new Error('Naskah masih kosong. Tambahkan adegan dulu.')
  const empty = clips.findIndex((c) => !c.story.trim() && !c.narration.trim())
  if (empty >= 0) throw new Error(`Adegan ${empty + 1} masih kosong. Isi alur atau narasinya dulu.`)
  const targets = clips.map((c, i) => ({ clip: c, n: i + 1 })).filter((t) => mode === 'all' || needsVisual(t.clip))
  if (!targets.length) return getBundle(projectId)

  const known = charactersOf(projectId)
  const system = [
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
    skillDirection(project.skillId, project.skillVariant, 'visual'),
    project.skillId === 'explainer-animasi-kesehatan'
      ? 'For this skill, recurring characters may be organs, tissue or cells, not only people. Name and describe their exact biological shape and single face. The rule about literal human descriptions applies only when a human is shown.'
      : '',
    health ? 'For each scene, fill the acting object completely. The narrationCue is an exact short phrase from this scene narration in its original language; all other acting directions are English. Make speaking intent, pose, gaze and contact concrete, then the visible consequence and reaction in that order. A shot may show one concise beat, but every acting field is still specific to its narration. Static bobbing or a camera zoom is not a substitute for action. Keep health imagery illustrative, not invented evidence.' : '',
    health ? 'Reuse every selected existing PNG master by its exact name and description whenever it appears; do not rename, split, merge or rewrite its identity. The image generator will receive the actual identity PNG plus optional expression/pose banks. You see metadata descriptions only: never claim you inspected PNG pixels. Expression banks guide pose and emotion only. Do not invent a human torso, new faces or contradictory anatomy for an organ master.' : ''
  ].join('\n')
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
      `Visual style of the video (for your framing choices only, do not repeat it in the descriptions): ${getStyle(project.styleId).name}.`,
      `Selected art direction, for design consistency: ${getStyle(project.styleId).prompt}`,
      `Frame format: ${project.aspectRatio === '9:16' ? 'vertical 9:16' : 'horizontal 16:9'}.`,
      `Idea of the video: ${project.synopsis}`,
      characterPlans.size ? `Existing characters (keep them exactly):\n${Array.from(characterPlans.values()).map((c) => `- ${c.name}: ${c.description}${known.some((character) => character.name === c.name && character.sheetAssetId) ? ' [PNG identity master available]' : ''}`).join('\n')}` : 'There are no existing characters yet.',
      `Script for this part and its immediate neighbors:\n${script}`,
      updates.length ? `Previous visual, for world continuity:\n${updates[updates.length - 1].visualPrompt}` : '',
      `Write visuals for these scenes only: ${batch.map((t) => t.n).join(', ')}. Use these exact global scene numbers, not numbers starting from 1.`,
      `Allowed camera values: ${CAMERA_IDS.join(', ')}. Allowed strength values: ${STRENGTH_IDS.join(', ')}. Allowed transition values: ${TRANSITION_IDS.join(', ')}.`
    ].filter(Boolean).join('\n\n')
    const plan = await generateJson<VisualPlan>({ system, prompt, schema: health ? HEALTH_VISUAL_SCHEMA : VISUAL_SCHEMA, name: 'visuals' })
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
      updates.push(toSceneVisual(target.clip, answer))
    }
    for (const character of plan.characters ?? []) {
      const name = str(character.name)
      const key = name.toLowerCase()
      if (name && !characterPlans.has(key)) characterPlans.set(key, { name, description: characterLook(character) })
    }
  }

  applyVisuals(
    projectId,
    Array.from(characterPlans.values()),
    updates
  )
  return getBundle(projectId)
}

function toSceneVisual(clip: Clip, a: NonNullable<VisualPlan['scenes']>[number]): SceneVisual {
  const camera = str(a.camera) as CameraPresetId
  const strength = str(a.strength) as MotionStrength
  const transition = str(a.transition) as TransitionId
  return {
    clipId: clip.id,
    visualPrompt: visualText(a),
    characterNames: Array.isArray(a.characters) ? a.characters.filter((n): n is string => typeof n === 'string') : [],
    cameraPreset: CAMERA_IDS.includes(camera) ? camera : clip.cameraPreset,
    motionStrength: STRENGTH_IDS.includes(strength) ? strength : clip.motionStrength,
    videoPrompt: a.acting ? [
      'Narration acting cue (silent): ' + str(a.acting.narrationCue),
      'Sequence: ' + str(a.acting.sequence),
      'Pose / speaking intent: ' + str(a.acting.pose),
      'Gaze: ' + str(a.acting.gaze),
      'Physical action / contact: ' + str(a.acting.contact),
      'Visible consequence: ' + str(a.acting.consequence),
      'Reaction: ' + str(a.acting.reaction),
      str(a.motion)
    ].filter(Boolean).join('\n') : str(a.motion),
    transition: TRANSITION_IDS.includes(transition) ? transition : clip.transition
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
