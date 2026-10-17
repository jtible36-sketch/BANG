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
    id: 'bang-motion', name: 'Explainer Bang Motion', description: 'Penjelasan sinematik melalui objek, aksi, diagram, dan gerak yang mengikuti isi.',
    categories: ['Sains', 'Sejarah', 'Teknologi', 'Sosial', 'Produk', 'Transportasi'],
    suggestions: ['Mengapa kota terasa makin panas?', 'Bagaimana kereta melaju tanpa menyentuh rel?', 'Penemuan yang mengubah cara manusia hidup'],
    variants: [
      { id: 'kartun-kolase', name: 'Kartun kolase', styleId: 'flat', direction: 'Flat illustrated cutouts on textured paper; introduce supporting objects progressively as each phrase explains the mechanism.' },
      { id: 'jurnalisme', name: 'Jurnalisme visual', styleId: 'documentary', direction: 'Visual journalism with photographs, maps, diagrams and concise source labels. Generated illustrations must not impersonate documentary evidence.' },
      { id: 'katalog', name: 'Katalog putih', styleId: 'whiteboard', direction: 'Bright white catalog world, clean photographic cutouts, restrained annotations and purposeful object transformations.' },
      { id: 'sketsa', name: 'Sketsa vintage', styleId: 'archival', direction: 'Sepia engraving and etched illustration, paper texture, contextual historical props and restrained annotations.' },
      { id: 'aksi-kontinu', name: 'Aksi kontinu', styleId: 'flat', direction: 'A continuous visual world with a persistent subject; show state changes, routes and processes through action rather than separate title cards.' },
      { id: 'kartun-panggung', name: 'Kartun panggung', styleId: 'flat', direction: 'Bright flat cartoon stage filling the frame; characters act with contextual poses and joint motion, reacting to events. Camera follows action within the stage.' }
    ],
    scriptDirection: 'Explain one clear question with an evidence-supported argument. New information triggers a visible action or state change; several sentences may share one evolving world. Make cause, mechanism and consequence concrete. Avoid a slide presentation or repetitive feature-card structure. End by answering the opening question.',
    visualDirection: 'Cinematic explainer. Each scene has a persistent visual world, a main subject and meaningful supporting objects. Show action and changes of state driven by narration, purposeful camera framing and context-specific transitions. Do not rely on repeated pan/zoom as the only action or flatten everything into title cards.'
  },
  {
    id: 'animasi-cutout', name: 'Animasi Cutout', defaultStyleId: 'collage', description: 'Kolase fotografis berlapis dengan kedalaman 2.5D, pose kontekstual, dan reaksi humor.',
    categories: ['Sejarah', 'Biografi', 'Budaya', 'Sains', 'Sosial', 'Kehidupan sehari-hari'],
    suggestions: ['Kehidupan sehari-hari manusia zaman dahulu', 'Kisah tokoh yang mengubah sejarah', 'Mengapa kebiasaan kita terasa aneh bagi orang lain?'],
    variants: [],
    scriptDirection: 'Plan layered photographic cutout animation. For every new narrative situation specify a new contextual pose, gaze, physical action and reaction, including at least one relevant humorous response. Identify character, background, props, foreground and diagram layers separately. Preserve character identity from supplied references.',
    visualDirection: 'Layered photographic cutout collage with 2.5D depth. Far background, midground, contextual character pose, props, occluding foreground and effects are distinct. Match lighting, perspective, scale and contact shadows. Preserve identity from actual supplied references. Each scene needs an action-specific pose and visible reaction; camera movement alone is insufficient. No baked-in captions or logos.'
  },
  {
    id: 'explainer-animasi-kesehatan', name: 'Explainer Animasi Kesehatan', defaultStyleId: 'flat', description: 'Organ dan sel kartun 2D menjelaskan mekanisme tubuh melalui aksi, dialog, dan humor.',
    categories: ['Organ tubuh', 'Nutrisi', 'Tidur', 'Kebiasaan sehat', 'Sistem imun', 'Sel dan jaringan'],
    suggestions: ['Apa yang dilakukan usus setelah kita makan?', 'Mengapa tubuh butuh tidur?', 'Bagaimana sel imun mengenali penyusup?'],
    variants: [],
    scriptDirection: 'Explain one health question for a general audience using reliable primary medical sources. Clearly distinguish verified mechanisms from metaphors and uncertainty. Use 2D organ, tissue or cell characters with biological silhouettes, one face per character unit. Structure beats as speech, action, consequence and reaction. Include relevant humor and interaction, such as a question, brief pause and accurate answer. No cure promises, invented studies or medical advice unsupported by sources.',
    visualDirection: 'Consistent 2D organ, tissue and cell characters, biologically recognizable silhouettes, large white eyes with black pupils and one mouth per character unit, dark outlines and simple cel shading. Preserve master identity and use contextual poses, gaze, physical contact and visible humorous reactions. Characters interact before reacting. Specify character, props and background separately; no neutral floating PNG reused for every beat, no photorealistic organs, no text baked into character assets.'
  }
]

export function getContentSkill(id: string | undefined): ContentSkill {
  return CONTENT_SKILLS.find((s) => s.id === id) ?? CONTENT_SKILLS[0]
}

export function skillDirection(id: string | undefined, variant: string | undefined, kind: 'script' | 'visual'): string {
  const skill = getContentSkill(id)
  return [kind === 'script' ? skill.scriptDirection : skill.visualDirection, skill.variants.find((v) => v.id === variant)?.direction ?? ''].filter(Boolean).join('\n')
}
