import type { VisualStyle } from './styles'
import type { EditorSettings } from './types'

/** A single art family reconstructed from the twelve supplied short-video references. */
export const HEALTH_DIALOGUE_NAME = 'Kesehatan · Dialog 2D'
export const HEALTH_DIALOGUE_DEFAULT_STYLE = 'health-dialogue-organs'
export const HEALTH_DIALOGUE_NICHES = ['Organ dan pencernaan', 'Makanan dan mulut', 'Mikroba dan imunitas', 'Mekanisme tubuh', 'Mitos kebiasaan sehari-hari', 'Kebersihan dan pencegahan']

export const HEALTH_DIALOGUE_STYLE = `Flat 2D conversational health explainer animation. Confident near-black outlines, simple readable organ silhouettes, flat colors with at most one restrained cel-shadow tone. One expressive face per character unit: white eyes, black pupils, readable eyelids and eyebrows, one simple mouth. Use thin black gesture arms and simple hands for organ, food and microbe actors; no mandatory human torso or legs for these actors. Pink stomach with readable inlet/outlet; folded pink brain with its stem; paired lungs remain one connected unit with one face. Humans retain ordinary human anatomy and simple clothing. Food remains recognizable as that food. Microbes are explicitly cartoon symbols, not literal microscopic anatomy. Salmon/coral tissue interiors, dark pink cavities, teal mouth or everyday sets; subtle tissue texture and soft oval contact shadows. One dominant speaker, a clear listener reaction, and a relevant prop or mechanism. Economical comic acting, clean silhouettes and uncluttered staging. No glossy 3D, plush baby mascots, photorealistic organs, ornate poster rendering, multi-panel pages, baked-in subtitles, labels, watermark, creator logo or product branding.`

export const HEALTH_DIALOGUE_CHARACTER = `Create the specific actor named in the brief: an organ, tissue, food, microbe OR ordinary human. Do not turn every actor into an organ or a generic doctor. Keep recognizable organ/object silhouettes and a single face per unit, with consistent eye/mouth count, palette and facial placement. Humans alone have ordinary human body proportions, hair and clothing; nonhuman actors have simple black gesture arms as needed. Create an original identity unless the user supplies an approved identity master. An attached identity master preserves that exact character; a video/style reference guides linework and acting only and must not automatically inject the old character library. On an identity sheet show just this one actor on a neutral background, its useful speaking/listening expressions and action poses; no invented anatomical turnaround. This sheet supplies identity and performance references, not an automatic rig or phoneme-aligned lip sync.`

export const HEALTH_DIALOGUE_SCRIPT = `Explain one concrete health question through a short Indonesian comic conversation grounded in checked primary medical sources. Open with a relatable complaint, misconception or surprising encounter; let another actor ask a concise question, reveal the mechanism through a visible event, then land a relevant dry reaction and a clear answer. Choose only the cast needed by this topic: human, organ, food, tissue or symbolic microbe. Give recurring actors stable names and identities. Each beat specifies SPEAKER, LISTENER, INTENT, ACTION/TARGET, CONSEQUENCE and REACTION inside the existing story/visual/video planning fields; narration contains only the words actually spoken, without role names, parenthetical acting instructions or SFX read aloud. Prefer one speaker turn per editable clip; a listener can stay visible silently. Alternate speaker close-ups with a two-shot reaction and a mechanism cutaway when useful. Do not force an identical hook or a joke into every sentence. Time clips to the actual spoken audio; a four-second source shot is only a production default, never a fixed quota for every dialogue turn. Do not copy reference dialogue, sponsor claims, creator names or watermarks. Distinguish metaphor from biology and uncertainty from evidence. No fabricated citations, cure promises or unsupported treatment advice.`

export const HEALTH_DIALOGUE_VISUAL = `${HEALTH_DIALOGUE_STYLE}
For every reviewed narration beat, specify the speaker's intention, gaze target, contextual pose, the object touched, the visible consequence and the listener's responding pose. Start with the relevant action, not a generic portrait. Mouth-open and mouth-closed expressions, pointing, folded arms, shrugging, side-eye, hand-on-hip and surprise are performance options, selected to fit the actual words. Preserve each approved identity across these changes. Use a medium shot, speaker close-up, two-shot reaction or clear mechanism cutaway. Keep scene space around faces and props; for a vertical video reserve a quiet upper band for subtitles and keep important content away from platform controls. Images contain one composed scene with no captions; the identity-sheet request instead uses a neutral background and only the requested identity. Supporting backgrounds, props and characters should be visually separable, but a flattened generated frame is not an exported layer rig. Add bold white sentence-case captions on opaque black blocks in the upper safe area during editing. No green karaoke highlight or copied creator branding. Use original settings and character designs appropriate to the topic, not the gallery's demonstration cast in every story.`

export const HEALTH_DIALOGUE_VIDEO = `Animate one reviewed flat 2D dialogue beat from its storyboard. Use the exact actor identities and preserve the linework, organ silhouettes, palette and face count. Establish speaker intent and gaze, perform one meaningful gesture or object interaction, reveal its consequence, then hold a short listener reaction. Pose changes, eyebrow/eyelid changes and a deliberate anticipation/settle supply the motion; do not just float or bob the whole image. A restrained emphasis push-in is optional, not the only animation. Keep one shot continuous; editorial shot/reverse-shot cuts happen between clips. Respect the reviewed start and end state. Speaking intent is silent expressive acting only: no automatically synchronized mouth shapes, generated speech or voice cloning. Narration is produced separately, and precise lip sync needs separate mouth-state/rig editing. No new characters, morphing, extra faces, subtitles, watermark, logos, music or product inserts. The chosen output duration and aspect ratio control this shot.`

export const HEALTH_DIALOGUE_STAGES = {
  research: `Research one clear health question with credible primary medical/public-health sources and direct source links. Check each mechanism and any prevention/treatment statement independently; the supplied videos are creative references, not medical authority. Identify the common question, supported explanation, useful visual metaphor, limits of that metaphor and an original character interaction. Do not carry over sponsor claims or infer a diagnosis. Follow the application's requested number of ideas and output schema. ${HEALTH_DIALOGUE_SCRIPT}`,
  script: HEALTH_DIALOGUE_SCRIPT,
  visual: HEALTH_DIALOGUE_VISUAL,
  video: HEALTH_DIALOGUE_VIDEO,
  thumbnail: `${HEALTH_DIALOGUE_STYLE} One original illustrative health-comedy scene: a large speaking actor and one readable listener reaction or a single meaningful mechanism. High silhouette contrast at gallery size, restrained backdrop and a relevant prop. No dramatic medical promises, product ads, title, subtitle, creator likeness, logo or watermark. This is an illustration, not medical evidence.`,
  voice: `Use natural Indonesian conversational delivery with clear diction, short turns and audible pauses for the listener reaction. Give each character an original, consistent performance when separate voices are manually prepared; never imitate the reference creator's voice. Narration contains spoken words only. The current project TTS voice does not automatically switch speakers: render/review separate character lines externally when distinct voices are required, then import the approved audio per clip. Keep the actual recording as the edit clock. No automatic paid retakes, added music, diagnosis or invented lines.`
}

export const HEALTH_DIALOGUE_SOURCE = Object.entries(HEALTH_DIALOGUE_STAGES).map(([stage, text]) => `${stage.toUpperCase()}\n${text}`).join('\n\n')

const family = {
  category: '2d' as const, ink: '#21191B', skillIds: ['explainer-animasi-kesehatan'] as ['explainer-animasi-kesehatan'],
  galleryGroup: 'Dialog kesehatan 2D', characterHint: HEALTH_DIALOGUE_CHARACTER
}

export const HEALTH_DIALOGUE_STYLES: VisualStyle[] = [
  {
    ...family, id: HEALTH_DIALOGUE_DEFAULT_STYLE, name: 'Organ · Dialog & Reaksi',
    swatch: '#D76C68', palette: ['#F0908C', '#B94F53', '#71383D', '#F9EEE0', '#21191B'],
    niche: 'Organ, pencernaan, otak, paru-paru',
    summary: 'Organ beradu pendapat, saling menunjuk, lalu bereaksi saat mekanismenya terungkap.',
    motionHint: 'Ganti giliran bicara lewat close-up; jeda singkat untuk lirikan, gestur dan reaksi lawan bicara.',
    prompt: `${HEALTH_DIALOGUE_STYLE} Organ dialogue variant: a recognizable organ is the lead actor, with another organ listening when the scene requires it. Pink/coral tissue stage, simple dark contour, strong speaking and skeptical listening expressions. Do not turn a paired organ into two separate talking faces.`
  },
  {
    ...family, id: 'health-dialogue-mouth', name: 'Mulut · Makanan Bicara',
    swatch: '#3AABB8', palette: ['#41AEBB', '#F0959B', '#78371C', '#F6EFE1', '#21191B'],
    niche: 'Makanan, lidah, gigi, perjalanan pencernaan',
    summary: 'Lidah, gigi dan makanan menjadi pemeran di panggung mulut yang sederhana.',
    motionHint: 'Makanan masuk, lidah bertanya, tokoh menunjuk atau melirik; aksi dan reaksi mengikuti isi dialog.',
    prompt: `${HEALTH_DIALOGUE_STYLE} Mouth/food variant: teeth frame a clear teal oral space and pink tongue stage. Food characters retain their natural silhouette; a tongue actor remains a broad elongated muscular tongue, not a kidney or a stomach. One face per actor and only the cast in the reviewed scene.`
  },
  {
    ...family, id: 'health-dialogue-microbes', name: 'Mikroba · Konflik di Tubuh',
    swatch: '#9B3D50', palette: ['#41AE3B', '#BD91DF', '#9B3D50', '#E57A86', '#21191B'],
    niche: 'Infeksi, mikroba, imunitas, kebersihan',
    summary: 'Penyusup menyombongkan diri, sel merespons, lalu proses penyebaran terlihat.',
    motionHint: 'Masuk melalui jalur yang jelas, berinteraksi, lalu tunjukkan penggandaan atau respons sel secara bertahap.',
    prompt: `${HEALTH_DIALOGUE_STYLE} Microbe-conflict variant: a sparse tissue or intestinal tunnel, one symbolic microbe actor and a relevant cell/organ listener. Sparse duplicate silhouettes can show multiplication. Comic microbe spikes and faces are metaphors, not factual microscopic morphology. Keep scale and direction coherent.`
  },
  {
    ...family, id: 'health-dialogue-anatomy', name: 'Anatomi · Mekanisme Hidup',
    swatch: '#C77073', palette: ['#EF9493', '#853941', '#4EACBF', '#F7B24E', '#21191B'],
    niche: 'Cara kerja organ, saluran napas, jaringan',
    summary: 'Tokoh organ mengantar penjelasan ke potongan anatomi atau proses yang diperbesar.',
    motionHint: 'Tunjuk bagian tubuh, masuk ke detail, gerakkan zat atau jalur sesuai mekanisme, lalu kembali ke reaksi tokoh.',
    prompt: `${HEALTH_DIALOGUE_STYLE} Anatomy mechanism variant: one organ actor introduces one readable anatomical cutaway or magnified mechanism. Use a few meaningful paths/arrows and anatomically appropriate connections. Distinguish symbolic particles from real structures. No decorative arrows or unverified biological interactions. Labels are added in editing.`
  },
  {
    ...family, id: 'health-dialogue-human', name: 'Manusia · Kebiasaan & Tubuh',
    swatch: '#4EAAA7', palette: ['#4EAAA7', '#F2A269', '#E9878C', '#F5EEE1', '#21191B'],
    niche: 'Mitos sehari-hari, tidur, makan, kebiasaan',
    summary: 'Kebiasaan manusia membuka pertanyaan, lalu organ menanggapi dengan ekspresi datar yang lucu.',
    motionHint: 'Mulai dari tindakan sehari-hari; potong ke tanggapan organ, perlihatkan penjelasan, dan akhiri reaksi manusia.',
    prompt: `${HEALTH_DIALOGUE_STYLE} Human-habit variant: ordinary adult humans with natural human proportions, simple clothing and an everyday setting. An organ character may respond in a cutaway or as an explicitly illustrative companion if the reviewed scene calls for it. Do not add human hair, clothing or torsos to the organ. Avoid a generic doctor lecture.`
  }
]

export function isHealthDialogueStyle(id: string | undefined): boolean {
  return HEALTH_DIALOGUE_STYLES.some(style => style.id === id)
}

/** Only new projects get this default; saved editor choices remain authoritative. */
export function healthDialogueEditorDefaults(styleId: string): Partial<EditorSettings> {
  return isHealthDialogueStyle(styleId) ? {
    captionStyle: 'karaoke', captionPosition: 'atas', captionSize: 'sedang', captionFont: 'poppins',
    captionColor: '#FFFFFF', captionHighlight: '#FFFFFF', captionBg: { color: '#000000', opacity: 1 }
  } : {}
}
