export type SkillId = 'general' | 'bang-motion' | 'animasi-cutout' | 'explainer-animasi-kesehatan'

export interface ContentSkill {
  id: SkillId
  name: string
  description: string
  defaultStyleId?: string
  categories: string[]
  suggestions: string[]
  variants: { id: string; name: string; styleId: string; direction: string }[]
  scriptDirection: string
  visualDirection: string
}

export const CONTENT_SKILLS: ContentSkill[] = [
  {
    id: 'general', name: 'Cerita bebas', description: 'Cerita, fakta unik, dan hiburan dengan gaya pilihanmu.',
    categories: ['Semua', 'Sejarah', 'Sains', 'Teknologi', 'Budaya', 'Kehidupan sehari-hari'],
    suggestions: ['Kebiasaan kecil yang mengubah hidup', 'Penemuan yang terjadi tanpa sengaja', 'Misteri sejarah di sekitar kita'],
    variants: [], scriptDirection: '', visualDirection: ''
  },
  {
    id: 'bang-motion', name: 'Explainer Bang Motion', defaultStyleId: 'motion-collage', description: 'Penjelasan sinematik melalui objek, aksi, diagram, dan gerak yang mengikuti isi.',
    categories: ['Sains', 'Sejarah', 'Teknologi', 'Sosial', 'Produk', 'Transportasi'],
    suggestions: ['Mengapa kota terasa makin panas?', 'Bagaimana kereta melaju tanpa menyentuh rel?', 'Penemuan yang mengubah cara manusia hidup'],
    variants: [
      { id: 'kartun-kolase', name: 'Kartun kolase', styleId: 'motion-collage', direction: 'Flat illustrated cutouts on textured paper; introduce supporting objects progressively as each phrase explains the mechanism.' },
      { id: 'jurnalisme', name: 'Jurnalisme visual', styleId: 'motion-journalism', direction: 'Visual journalism with photographs, maps, diagrams and concise source labels. Generated illustrations must not impersonate documentary evidence.' },
      { id: 'katalog', name: 'Katalog putih', styleId: 'motion-catalog', direction: 'Bright white catalog world, clean photographic cutouts, restrained annotations and purposeful object transformations.' },
      { id: 'sketsa', name: 'Sketsa vintage', styleId: 'motion-engraving', direction: 'Sepia engraving and etched illustration, paper texture, contextual historical props and restrained annotations.' },
      { id: 'aksi-kontinu', name: 'Aksi kontinu', styleId: 'motion-continuous', direction: 'A continuous visual world with a persistent subject; show state changes, routes and processes through action rather than separate title cards.' },
      { id: 'kartun-panggung', name: 'Kartun panggung', styleId: 'motion-stage', direction: 'Bright flat cartoon stage filling the frame; characters act with contextual poses and joint motion, reacting to events. Camera follows action within the stage.' }
    ],
    scriptDirection: 'Explain one clear question with an evidence-supported argument. New information triggers a visible action or state change; several sentences may share one evolving world. Make cause, mechanism and consequence concrete. Avoid a slide presentation or repetitive feature-card structure. End by answering the opening question.',
    visualDirection: 'Cinematic explainer. Each scene has a persistent visual world, a main subject and meaningful supporting objects. Show action and changes of state driven by narration, purposeful camera framing and context-specific transitions. Do not rely on repeated pan/zoom as the only action or flatten everything into title cards.'
  },
  {
    id: 'animasi-cutout', name: 'Animasi Cutout', defaultStyleId: 'cutout-photo', description: 'Kolase fotografis berlapis dengan kedalaman 2.5D, pose kontekstual, dan reaksi humor.',
    categories: ['Sejarah', 'Biografi', 'Budaya', 'Sains', 'Sosial', 'Kehidupan sehari-hari'],
    suggestions: ['Kehidupan sehari-hari manusia zaman dahulu', 'Kisah tokoh yang mengubah sejarah', 'Mengapa kebiasaan kita terasa aneh bagi orang lain?'],
    variants: [
      { id: 'fotografis', name: 'Fotografis 2.5D', styleId: 'cutout-photo', direction: 'Layered photographic sets in natural light, grounded character poses, clean foreground occlusion and 2.5D depth.' },
      { id: 'kertas', name: 'Kertas bertekstur', styleId: 'cutout-paper', direction: 'Photographic characters mounted in textured paper layers; preserve real facial features while paper props and backgrounds add depth.' },
      { id: 'editorial-pop', name: 'Editorial pop', styleId: 'cutout-editorial', direction: 'Energetic editorial photographic cutouts, bold meaningful color fields and contextual humorous reactions.' },
      { id: 'arsip', name: 'Arsip vintage', styleId: 'cutout-vintage', direction: 'Archival-inspired photographic cutouts, period props and sepia printed texture; generated reconstructions are illustrations rather than authentic records.' },
      { id: 'sinematik', name: 'Sinematik berlapis', styleId: 'cutout-cinematic', direction: 'Dramatically lit photographic cutout tableaux, motivated light, layered foreground and coherent atmospheric depth.' }
    ],
    scriptDirection: 'Plan layered photographic cutout animation. For every new narrative situation specify a new contextual pose, gaze, physical action and reaction, including at least one relevant humorous response. Identify character, background, props, foreground and diagram layers separately. Preserve character identity from supplied references.',
    visualDirection: 'Layered photographic cutout collage with 2.5D depth. Far background, midground, contextual character pose, props, occluding foreground and effects are distinct. Match lighting, perspective, scale and contact shadows. Preserve identity from actual supplied references. Each scene needs an action-specific pose and visible reaction; camera movement alone is insufficient. No baked-in captions or logos.'
  },
  {
    id: 'explainer-animasi-kesehatan', name: 'Explainer Animasi Kesehatan', defaultStyleId: 'health-organs', description: 'Organ dan sel kartun 2D menjelaskan mekanisme tubuh melalui aksi, dialog, dan humor.',
    categories: ['Organ tubuh', 'Nutrisi', 'Tidur', 'Kebiasaan sehat', 'Sistem imun', 'Sel dan jaringan'],
    suggestions: ['Apa yang dilakukan usus setelah kita makan?', 'Mengapa tubuh butuh tidur?', 'Bagaimana sel imun mengenali penyusup?'],
    variants: [
      { id: 'organ-ekspresif', name: 'Organ ekspresif', styleId: 'health-organs', direction: 'A large 2D organ with one expressive face and biological silhouette; gesture arms only when the action needs them.' },
      { id: 'sel-imun', name: 'Sel dan imun', styleId: 'health-cells', direction: 'A 2D microscopic cartoon world; each cell has one face and recognizable biological features, with consistent illustrative scale.' },
      { id: 'panggung-organ', name: 'Panggung organ', styleId: 'health-stage', direction: 'An interacting 2D organ cast on one large body stage, speech followed by physical action, consequence and humorous reaction.' },
      { id: 'diagram-tubuh', name: 'Diagram tubuh', styleId: 'health-diagram', direction: 'A simplified 2D body or tissue cutaway with organ characters and meaningful directional paths; labels are added in editing.' },
      { id: 'komik-humor', name: 'Komik humor', styleId: 'health-comic', direction: 'Expressive 2D organ comedy with dark maroon outlines and subtle print dots, one full scene rather than a multi-panel comic page.' }
    ],
    scriptDirection: 'Explain one health question for a general audience using reliable primary medical sources. Clearly distinguish verified mechanisms from metaphors and uncertainty. Use the existing named 2D organ, tissue or cell characters with their established biological silhouettes and identity; never rename a supplied master or replace it with a generic human mascot. Structure each narrative beat as speaking intent, physical action, visible consequence and reaction. Name who acts and who responds, their gaze target and the object or character they contact. Match the physical action to a particular phrase of narration; do not repeat the same neutral pose or generic bobbing. Include relevant humor and interaction, such as a question, brief pause and accurate answer. No cure promises, invented studies or medical advice unsupported by sources.',
    visualDirection: 'Consistent 2D organ, tissue and cell characters, biologically recognizable silhouettes, large white eyes with black pupils and one mouth per character unit, dark outlines and simple cel shading. Existing PNG character sheets are identity masters: preserve their exact silhouette, face placement, eye and mouth count, distinctive features, proportions and palette. Attached expression or pose banks guide performance, not a redesign of identity; do not reproduce a contact-sheet layout. For each narration beat show speaking intent, a contextual physical action, its visible consequence and the responding character’s relevant humorous reaction. Specify pose, gaze target, point of contact, supporting prop and background separately. Show interaction before reaction; keep intentional anatomy-preserving gestures and coherent contact. State changes and physical acting drive the scene; repeated bobbing, pan or zoom alone are insufficient. No neutral floating PNG reused for every beat, no photorealistic organs, no text baked into character assets. Narration audio is added separately; speaking intent and expression do not imply automatic lip sync.'
  }
]

export function getContentSkill(id: string | undefined): ContentSkill {
  return CONTENT_SKILLS.find((s) => s.id === id) ?? CONTENT_SKILLS[0]
}

export function skillDirection(id: string | undefined, variant: string | undefined, kind: 'script' | 'visual'): string {
  const skill = getContentSkill(id)
  return [kind === 'script' ? skill.scriptDirection : skill.visualDirection, skill.variants.find((v) => v.id === variant)?.direction ?? ''].filter(Boolean).join('\n')
}

export function defaultStyleForSkill(id: string | undefined, variant?: string): string {
  const skill = getContentSkill(id)
  return skill.variants.find((item) => item.id === variant)?.styleId ?? skill.defaultStyleId ?? 'stickman'
}

export function variantForStyle(id: string | undefined, styleId: string): string | undefined {
  return getContentSkill(id).variants.find((item) => item.styleId === styleId)?.id
}
