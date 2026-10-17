import type { VisualStyle } from './styles'
import type { SkillId } from './skills'

const NO_TEXT = 'No baked-in text, letters, captions, watermark or logo. Leave composition space for text added in editing.'
const HEALTH = '2D cartoon organ, tissue or cell characters with biologically recognizable silhouettes, dark maroon outlines and simple cel shading. Large white eyes, black pupils, separate eyebrows and one expressive mouth per character unit. Preserve identity, anatomy silhouette and palette across shots. No photorealistic organs or 3D render. Colors are artistic, not diagnostic labels.'
const CUTOUT = 'Layered photographic cutout composition with a foreground, subject, props, midground and far background. Preserve the supplied reference face and identity; vary the contextual pose and expression without redesigning the person. Match perspective, light, scale and contact shadows. Show a narrative action and visible reaction, with layers suitable for 2.5D parallax.'

function preset(id: string, name: string, skill: SkillId, category: VisualStyle['category'], niche: string, swatch: string, ink: string, prompt: string, characterHint: string): VisualStyle {
  return { id, name, category, niche, swatch, ink, skillIds: [skill], preview: id, prompt: `${prompt} ${NO_TEXT}`, characterHint }
}

/** Distinct rendering presets; the legacy general styles remain valid for saved projects. */
export const SKILL_VISUAL_STYLES: VisualStyle[] = [
  preset('motion-collage', 'Kartun kolase explainer', 'bang-motion', '2d', 'Sains, fakta unik, edukasi', '#F7EAD5', '#34281F',
    'Illustrated flat cutout collage on warm cream textured paper, teal and orange accent shapes, hand-painted grain and soft paper-layer shadows. A large readable main subject in a coherent world, with meaningful supporting props appearing progressively to explain cause and effect. Expressive friendly characters, clear object actions, never a title-card slideshow.',
    'an expressive flat illustrated cutout character with crisp dark contours, subtle paper grain and teal/orange accents'),
  preset('motion-journalism', 'Jurnalisme visual sinematik', 'bang-motion', 'realistis', 'Berita, isu sosial, investigasi', '#202C36', '#FAF7F2',
    'Cinematic visual journalism: documentary-style photographic cutouts, dark textured editorial background, maps, contextual artifacts and restrained yellow/red diagram accents. Arrange evidence and scale around one focal subject with depth and directional light. Any generated reconstruction is an illustration, never a fabricated authentic document, news photo or scientific proof.',
    'a realistic editorial photographic portrait cutout, natural human features, contextual clothing and lighting, no fabricated documentary provenance'),
  preset('motion-catalog', 'Katalog putih editorial', 'bang-motion', 'realistis', 'Produk, teknologi, profil', '#F5F4EE', '#253038',
    'Bright editorial catalog photography on warm white with a faint precise grid, real product or person cutouts, clean natural studio shadows, restrained coral and cobalt accent objects. Build a tactile explanatory arrangement with visual comparisons and purposeful object changes. Photographic surfaces and materials, not black-marker whiteboard doodles.',
    'a clean photographic character or product cutout with realistic materials and bright neutral studio lighting'),
  preset('motion-engraving', 'Ukiran vintage explainer', 'bang-motion', '2d', 'Sejarah, biografi, penemuan', '#E5CFAC', '#5D3827',
    'Vintage engraved and etched illustration, fine crosshatching, sepia textured paper, dark umber ink, muted rust accents and historical props. Use illustrated anatomy and objects with consistent directional etched shading; contextual diagrams reveal the mechanism. This is a drawn engraving, not a sepia archival photograph.',
    'an engraved illustrated character with detailed crosshatching, dark umber contours and historically contextual attire'),
  preset('motion-continuous', 'Dunia aksi kontinu', 'bang-motion', '2d', 'Rute, transportasi, proses', '#D8EFF1', '#153C47',
    'A clear flat geometric illustrated world with a persistent main subject, blue/teal scenery, coral functional accents and routes or process elements integrated into the environment. Draw a real stage filling the frame, connected foreground and background, with space for meaningful action and changes of state. Avoid isolated cards, miniature map-only compositions and a separate slide for every fact.',
    'a consistent flat geometric character or vehicle with readable silhouette, teal/coral palette and clearly separated action-ready parts'),
  preset('motion-stage', 'Kartun panggung dinamis', 'bang-motion', '2d', 'Sains, cerita, sebab–akibat', '#FFE1A3', '#382F3E',
    'Bright flat cartoon stage, sunny yellow, coral and turquoise palette, bold clean contours, lively expressive characters, contextual machines, plants or objects. One full-frame stage per scene, large main actors with physically meaningful actions, interaction, anticipation and reaction. Maintain stage continuity and coherent scale; never a tiny diorama surrounded by blank space.',
    'a bright flat cartoon stage character with expressive eyes, simple articulated limbs when needed and contextual action poses'),
  preset('cutout-photo', 'Cutout fotografis 2.5D', 'animasi-cutout', 'realistis', 'Edukasi, sejarah, presenter', '#D5E4DC', '#263C36',
    `${CUTOUT} Full-frame photographic environment with natural warm daylight, realistic material textures and subtle edge definition. Use cinematic medium framing with a large character and occluding foreground for believable depth.`,
    'a photographic person cutout preserving the supplied face, natural skin texture and matching scene lighting, with action-specific gestures'),
  preset('cutout-paper', 'Cutout kertas bertekstur', 'animasi-cutout', '2d', 'Cerita ringan, budaya, edukasi', '#EFE0C2', '#493628',
    `${CUTOUT} Photographic subjects mounted in a tactile cream paper world with torn paper borders, printed textures, tape-like visual accents and soft shadows between layers. Warm mustard, teal and rust palette; the face remains photographic rather than redrawn as a cartoon.`,
    'a real photographic character mounted as a paper cutout, visible print grain and subtly irregular paper edges while preserving the original face'),
  preset('cutout-editorial', 'Cutout editorial pop', 'animasi-cutout', '2d', 'Isu viral, sosial, opini visual', '#F9C94E', '#252B36',
    `${CUTOUT} Bold editorial photographic collage with saturated yellow/coral/cobalt color fields, crisp subject masks, restrained halftone print accents and large meaningful shapes. Energetic humorous reactions and strong readable contrast; one focal argument, not a grid of unrelated cards.`,
    'a sharply masked photographic subject with bold editorial color separation and expressive contextual reaction, preserving reference identity'),
  preset('cutout-vintage', 'Cutout arsip vintage', 'animasi-cutout', 'realistis', 'Sejarah, tokoh, biografi', '#CDB997', '#463628',
    `${CUTOUT} Historical photographic collage with restrained sepia tones, period-appropriate props, faded paper and film texture, archival-inspired framing and layered scene depth. Generated historical reconstructions must not be presented as authentic archival evidence.`,
    'a photographic period character cutout with restrained sepia print texture and historically fitting costume, preserving the supplied face'),
  preset('cutout-cinematic', 'Cutout sinematik berlapis', 'animasi-cutout', 'realistis', 'Drama sejarah, misteri, mekanisme', '#3D4D60', '#F6E5CC',
    `${CUTOUT} Dramatic cinematic cutout tableau with rich navy/amber grading, motivated rim light, atmospheric depth, grounded contact shadows and foreground occlusion. Photographic face and body, coherent perspective, meaningful physical action; avoid fake plastic 3D faces or a lone static portrait.`,
    'a photographic cinematic character cutout with motivated amber/navy lighting, grounded physical gesture and unchanged facial identity'),
  preset('health-organs', 'Organ kartun ekspresif', 'explainer-animasi-kesehatan', '2d', 'Organ tubuh, fungsi dan humor', '#F6C0BC', '#6B293E',
    `${HEALTH} Large expressive organ hero in a peach/pink biological environment, subtle tissue texture and oval contact shadow. Default floating organ without human torso or legs; add simple black-line arms only when a narrative gesture needs them. Emphasize gaze, pose and facial reaction.`,
    'a biologically recognizable 2D organ with one face, large white eyes and one expressive mouth, simple maroon contours, pink/red identity colors and optional thin black gesture arms'),
  preset('health-cells', 'Dunia sel dan imun', 'explainer-animasi-kesehatan', '2d', 'Sel, jaringan, sistem imun', '#D2DCEB', '#533958',
    `${HEALTH} A full-frame microscopic cartoon world in pink, lilac and teal, with translucent-looking flat membrane shapes, recognizable biological cell features and soft layered tissue depth. Give each individual cell one face; keep size changes and illustrative simplifications explicit in the scene plan. No photo microscopy or diagnostic imagery.`,
    'a consistent 2D cell or immune-cell character with one face per cell, recognizable membrane or biological structures, simple cel shading and lilac/pink/teal palette'),
  preset('health-stage', 'Panggung organ interaktif', 'explainer-animasi-kesehatan', '2d', 'Dialog organ, proses dan reaksi', '#F9D8B8', '#5D2D3C',
    `${HEALTH} A lively large cartoon organ stage inside the body, warm peach/pink environment, contextual props tied to the explained mechanism, and two or more anatomically distinct characters interacting. Show gaze toward the interlocutor, a visible action, consequence and humorous reaction. Simple matching gesture arms where needed; no generic human mascot replacing the organ.`,
    'a 2D organ actor with one expressive face, anatomically distinct silhouette and simple consistent gesture arms for interactions'),
  preset('health-diagram', 'Diagram tubuh berkarakter', 'explainer-animasi-kesehatan', '2d', 'Alur tubuh, organ ke sel', '#E7F1ED', '#36514E',
    `${HEALTH} Clean 2D cutaway body or tissue diagram in cream, teal and peach. Large organ or cell characters participate in the mechanism; directional paths, highlighted regions and scale changes clarify cause and effect. Use a coherent biological scene, not a crowded labeled medical slide. Leave diagram labels for editing and do not invent anatomical connections.`,
    'a readable 2D organ or cell character with one face and restrained cel shading, consistent with a simplified biological cutaway diagram'),
  preset('health-comic', 'Komik organ humor', 'explainer-animasi-kesehatan', '2d', 'Mitos tubuh, humor edukasi', '#F8CDCF', '#642F4A',
    `${HEALTH} Warm graphic cartoon with subtle comic print dots, chunky dark-maroon contours, pink/coral/cream palette and exaggerated but anatomy-preserving facial acting. One continuous scene per frame, a contextual organ pose with a visual punchline and response. No speech bubbles, baked-in dialogue or multi-panel comic page.`,
    'an expressive 2D organ character with dark maroon contours, one face, subtle comic grain and anatomy-preserving comedic gestures')
]
