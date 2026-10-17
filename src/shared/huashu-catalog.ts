import type { VisualStyle } from './styles'

/** Recipe IDs deliberately retain upstream numbering: 07 is absent; 37 is recipe 36. */
export interface HuashuStyleRecipe {
  recipeId: string
  name: string
  group: 'Material & warna' | 'Era & gerakan seni'
  summary: string
  material: string
  palette: string[]
  niches: string[]
  motion: string
  motionHint: string
  character: string
  camera?: string
}

export const HUASHU_RECIPE_SOURCE = 'https://github.com/alchaincyf/huashu-art-motion'
const MATERIAL = 'Material & warna'
const ERA = 'Era & gerakan seni'

/** Editorial adaptations of all 36 upstream recipe cards, not promises of a bundled renderer. */
export const HUASHU_STYLE_RECIPES: HuashuStyleRecipe[] = [
  {
    recipeId: '01_cave', name: 'Lukisan gua', group: ERA,
    summary: 'Arang dan oker menyatu dengan dinding batu kasar.',
    material: 'Prehistoric cave painting: porous charcoal edges and red ochre pigments embedded in a relief rock wall, chalk reserves, primitive legible silhouettes; no smooth vector finish.',
    palette: ['#CE925A', '#21150D', '#9C3520', '#F0DFBF'],
    niches: ['Ancient Humans', 'Human Evolution', 'Survival', 'Hewan prasejarah'],
    motion: 'Use deliberate alternating animal or human action poses, moving firelight across stone and restrained rising embers. Pigment remains attached to the wall.',
    motionHint: 'Pose berganti, cahaya api, dan bara memberi hidup pada batu.',
    character: 'Primitive charcoal-and-ochre silhouettes, sparse era-appropriate anatomy, distinctive costume or tool in the same pigment.'
  },
  {
    recipeId: '02_egypt', name: 'Mural Mesir kuno', group: ERA,
    summary: 'Figur profil, bidang datar, dan pigmen mineral pada plester.',
    material: 'Ancient Egyptian mural, profile faces with a frontal eye, frontal shoulders, thin dark-brown contour, flat mineral pigments and aged plaster; no modern perspective or volumetric rendering.',
    palette: ['#EADCB8', '#2A1810', '#B8322A', '#2C56B0', '#E0AB38'],
    niches: ['Ancient History', 'Civilization', 'Mesir kuno', 'Arkeologi'],
    motion: 'Animate clear ritual or working gestures in profile; small ornaments and sun-ray motifs respond to the action. Preserve flat mural geometry and consistent pigment.',
    motionHint: 'Gerak profil dan ornamen terukur dengan komposisi datar.',
    character: 'Egyptian mural proportions, profile nose and frontal almond eye, recognizable period costume and restrained dark-brown line work.'
  },
  {
    recipeId: '03_greek', name: 'Keramik Yunani hitam', group: ERA,
    summary: 'Siluet glasir hitam dengan guratan terakota dan aksen merah.',
    material: 'Attic black-figure pottery: warm black glazed silhouettes over terracotta, fine orange incised contours, burgundy bands and sparse white painted details. The image belongs to a ceramic surface.',
    palette: ['#DC6A2F', '#1B120D', '#E8904C', '#8A2A37', '#F6EAD6'],
    niches: ['Ancient History', 'Mitologi Yunani', 'Civilization', 'Pelayaran kuno'],
    motion: 'Profile actors perform one readable action; incised details move with their silhouette. Repeating border motifs may travel while vessel surface and framing stay coherent.',
    motionHint: 'Aksi siluet terbaca dan ornamen keramik bergerak terarah.',
    character: 'Black-glaze profile figure, terracotta incised anatomy and garment folds; identity retained through silhouette and burgundy or chalk accents.'
  },
  {
    recipeId: '04_roman', name: 'Mosaik Pompeii', group: MATERIAL,
    summary: 'Keping batu mengikuti kontur dengan sela nat yang nyata.',
    material: 'Roman Pompeian tessera mosaic: densely laid irregular stone tiles aligned along subject contours, fine visible grout and subtle bevel lighting. Smaller tesserae define eyes, hands and essential props.',
    palette: ['#E4DDCD', '#46322A', '#A8322A', '#D0A23C', '#6F9341'],
    niches: ['Civilization', 'Romawi kuno', 'Arsitektur', 'Gunung berapi'],
    motion: 'Convey action through coherent tile-color changes and purposeful moving mosaic inlays, retaining stone scale and grout. Decorative bands may flow only when relevant.',
    motionHint: 'Aksi tampil melalui warna keping dan bagian mosaik yang bergerak.',
    character: 'Figurative stone mosaic with contour-following tesserae, legible facial inlays and period-appropriate clothing; no modern cartoon pasted over tiles.'
  },
  {
    recipeId: '05_gothic', name: 'Manuskrip Gotik', group: ERA,
    summary: 'Perkamen, emas timbul, dan ilustrasi abad pertengahan.',
    material: 'Gothic illuminated manuscript illustration on parchment, embossed brushed gold leaf, jewel-colored flat garments and delicate ink contours, pointed-arch ornament used only where the story calls for it.',
    palette: ['#ECDFC2', '#9C6A1A', '#D9A63A', '#F8DE86', '#A8322A'],
    niches: ['Ancient History', 'Abad pertengahan', 'Legenda', 'Sejarah buku'],
    motion: 'Let a motivated highlight travel over gold leaf; animate character gestures, vines or small narrative animals with restrained hand-made motion, avoiding constant sparkle.',
    motionHint: 'Sorot emas, gestur karakter, dan ornamen perkamen.',
    character: 'Medieval manuscript figures with flat jewel-colored robes, clear ink faces and gold accents that share the parchment surface.'
  },
  {
    recipeId: '06_renaissance', name: 'Sfumato Renaisans', group: ERA,
    summary: 'Transisi lembut, volume alami, dan ruang berperspektif.',
    material: 'Renaissance sfumato oil painting with softly blended yet legible edges, warm glazes, atmospheric landscape depth, natural volume and subtle canvas texture; avoid blurring the focal face.',
    palette: ['#43321F', '#A88C64', '#5C2418', '#9FB4B8', '#ECE0CC'],
    niches: ['Sejarah seni', 'Penemuan', 'Biografi', 'Humanisme'],
    motion: 'Natural hand action, a slight head response and context-specific environmental motion such as reflected water or passing cloud light; painted volume remains stable.',
    motionHint: 'Gestur alami, pantulan air, dan perubahan cahaya yang lembut.',
    character: 'Naturally proportioned painted figure, softly modeled features, period clothing and face clarity preserved within sfumato edges.'
  },
  {
    recipeId: '08_impressionism', name: 'Impresionisme pastel', group: MATERIAL,
    summary: 'Sapuan pendek, cahaya berubah, dan warna yang saling memantul.',
    material: 'Impressionist painting with short visible pastel brushstrokes, region-specific color mixtures, colored shadows and luminous light; no heavy outline. Keep brush positions coherent rather than replacing the entire painting each frame.',
    palette: ['#D8BEDE', '#F0C8CC', '#F2E6EE', '#EDCE83', '#608C5B'],
    niches: ['Alam', 'Musim dan cuaca', 'Kehidupan sehari-hari', 'Sejarah seni'],
    motion: 'Move the actual subject, foliage, fabric and pools of sunlight while preserving brush structure; use fine strokes around eyes and hands so acting remains readable.',
    motionHint: 'Angin dan cahaya menggerakkan adegan tanpa kedipan seluruh kanvas.',
    character: 'Soft color-built figure painted with smaller strokes around the face and hands, matching the environment rather than a vector outline.'
  },
  {
    recipeId: '09_postimp', name: 'Sapuan ekspresif Van Gogh', group: MATERIAL,
    summary: 'Sapuan mengikuti bentuk, kontras warna, dan pusaran terarah.',
    material: 'Post-impressionist impasto with directional flow-field brushwork, deep blue contours, contrasting regional hues and strokes that describe the form; reserve fine brushwork for narrative props and faces.',
    palette: ['#22339A', '#5F7FD8', '#E2B74C', '#C0573C', '#8FB6EE'],
    niches: ['Sejarah seni', 'Space', 'Alam', 'Psikologi', 'Kisah manusia'],
    motion: 'Directional strokes follow a meaningful wind, star or light flow; characters act coherently, light halos expand subtly and focal props retain shape. Avoid random all-over texture boiling.',
    motionHint: 'Sapuan mengalir, pusaran terarah, dan cahaya yang bernapas.',
    character: 'Expressive painted figure with form-following impasto and deep contour accents, fine facial strokes and stable reference proportions.'
  },
  {
    recipeId: '10_nouveau', name: 'Art Nouveau', group: ERA,
    summary: 'Garis organik, bunga, dan bidang warna litografi.',
    material: 'Art Nouveau lithographic illustration with variable-width whiplash curves, thick outer contours, fine interior lines, muted botanical colors and restrained gilt ornament.',
    palette: ['#CFD3A6', '#4E3320', '#C9A24A', '#E6AAA5', '#3D7763'],
    niches: ['Sejarah seni', 'Botani', 'Budaya', 'Desain', 'Legenda'],
    motion: 'Organic curves grow from a motivated focal point; hair, leaves and fabric follow graceful secondary waves. Decorative movement supports a legible primary action.',
    motionHint: 'Kurva tumbuh, bunga bergoyang, dan kain mengikuti aksi.',
    character: 'Elegant lithographic figure with clear outer silhouette, fine face lines, organic hair shapes and costume integrated with botanical motifs.'
  },
  {
    recipeId: '11_cubism', name: 'Kubisme analitis', group: MATERIAL,
    summary: 'Bidang transparan dan banyak sudut pandang dalam satu subjek.',
    material: 'Analytical cubism built from large intersecting translucent ochre, brown and blue-gray planes, passages across boundaries, subtle hatching and multiple viewpoints; not a low-poly 3D mesh.',
    palette: ['#D6C8AC', '#3A2C1E', '#B8975F', '#6E5538', '#8E9EAB'],
    niches: ['Persepsi', 'Psikologi', 'Sejarah seni', 'Musik', 'Kehidupan kota'],
    motion: 'Slide or pivot selected planes to reveal another aspect of the same subject while retaining recognizable landmarks; avoid random fragmentation and repeated face redesign.',
    motionHint: 'Bidang bergeser membuka sudut pandang lain dari subjek yang sama.',
    character: 'An angular multi-view character built from broad tonal planes, stable identifying facial landmarks and an intentionally segmented silhouette.'
  },
  {
    recipeId: '12_bauhaus', name: 'Geometri Bauhaus', group: MATERIAL,
    summary: 'Bentuk primer, warna terbatas, dan konstruksi geometris.',
    material: 'Bauhaus geometric composition, circles, bars and triangles on warm paper, red-yellow-blue accents, precise flat shapes and subtle printed texture; use geometry to explain the subject.',
    palette: ['#EBE3CF', '#161514', '#D3262B', '#2A58B4', '#EFC12F'],
    niches: ['Desain', 'Arsitektur', 'Technology', 'Cara kerja', 'Matematika visual'],
    motion: 'Rotate functional bars about real pivots, roll circles by their travel distance and move articulated geometric figures with clear cause and consequence.',
    motionHint: 'Poros, roda, dan figur geometris bergerak dengan sebab yang jelas.',
    character: 'A geometric stage figure with circular joints, broad primitive body shapes and minimal readable facial marks; preserve reference landmarks through geometry.'
  },
  {
    recipeId: '13_pop', name: 'Pop Art cetak', group: MATERIAL,
    summary: 'Titik Ben-Day, garis hitam tebal, dan warna primer.',
    material: 'Pop-art print illustration with clean bold black contours, primary flat colors, stable Ben-Day dots, graphic shadows and restrained misregistration. One coherent story frame rather than an automatic comic grid.',
    palette: ['#F3EEDB', '#141414', '#2F5CC8', '#F7D52C', '#D8232A'],
    niches: ['Budaya pop', 'Psikologi', 'Fakta unik', 'Kebiasaan manusia', 'Produk'],
    motion: 'Clear anticipation, decisive pose change and graphic reaction lines; keep halftone dots attached to shapes. Add a bold accent only on the narrative reveal.',
    motionHint: 'Antisipasi, perubahan pose tegas, dan aksen pada momen penting.',
    character: 'Bold comic-print figure, sculpted hair masses, expressive eyes and halftone skin; no copied famous comic character.'
  },
  {
    recipeId: '14_8bit', name: 'Pixel 8-bit', group: MATERIAL,
    summary: 'Piksel tajam, palet terbatas, dan pose sprite yang terbaca.',
    material: 'Authentic 8-bit pixel art on a consistent coarse pixel grid, limited fourteen-color character palette, one-pixel internal and external contours, deliberate dithering, no blur or antialiasing.',
    palette: ['#0856EF', '#12121A', '#FBE2A6', '#F64B38', '#47C4F8'],
    niches: ['Gaming', 'Technology', 'Sejarah game', 'Survival', 'Nostalgia'],
    motion: 'Use discrete sprite poses, whole-pixel travel and clear anticipation or landing frames; background and character pixels retain the same scale.',
    motionHint: 'Pose sprite berganti dengan perpindahan piksel yang konsisten.',
    character: 'Readable 8-bit sprite with distinct costume-colored clusters, one-pixel limb separation and tiny stable facial pixels.'
  },
  {
    recipeId: '15_raytrace', name: 'CGI awal 1990-an', group: MATERIAL,
    summary: 'Plastik mengilap, krom, dan pantulan dunia komputer awal.',
    material: 'Early 1990s ray-traced CGI aesthetic, rounded plastic geometry with narrow Phong highlights, chrome environmental reflections and restrained checkerboard or wireframe surfaces tied to the story.',
    palette: ['#64A6A6', '#173C45', '#F8C070', '#9C60C8', '#D6DEDE'],
    niches: ['Technology', 'Sejarah komputer', 'Desain digital', 'Gaming', 'Penemuan'],
    motion: 'Rotate and articulate objects with stable perspective; reflections and specular highlights respond consistently to object movement rather than swimming independently.',
    motionHint: 'Putaran dan artikulasi disertai pantulan serta sorot yang mengikuti.',
    character: 'Original rounded plastic figure with coherent ball joints, readable facial planes and consistent specular lighting; avoid mask-like faces.'
  },
  {
    recipeId: '16_2026', name: 'Ilustrasi flat bertekstur', group: MATERIAL,
    summary: 'Bidang tanpa garis, grain halus, dan akting ekspresif.',
    material: 'Contemporary flat illustration with no outlines, broad solid forms, darker same-hue shape shading and controlled grain-density texture. Characters, props and background share the same flat treatment.',
    palette: ['#F4E8D0', '#292622', '#F08B7D', '#E6B54D', '#709D8B'],
    niches: ['Sains sehari-hari', 'Psikologi', 'Technology', 'Kisah manusia', 'Animals'],
    motion: 'Character anticipation, action, contact, consequence and reaction lead the shot; use foot-anchored squash/stretch and restrained damped motion on affected props.',
    motionHint: 'Aksi, kontak, akibat, dan reaksi dengan gerak lanjutan yang alami.',
    character: 'Expressive flat figure with bold silhouette, economical facial shapes and same-hue volume accents; grain stays within shapes.'
  },
  {
    recipeId: '17_ink', name: 'Tinta Tiongkok', group: MATERIAL,
    summary: 'Tekanan kuas, serat kertas, rembesan tinta, dan ruang kosong.',
    material: 'Chinese expressive ink painting on fibrous rice paper, pressure-varied dry-brush strokes with paper showing through, five tonal ink values, restrained mineral washes and intentional negative space.',
    palette: ['#EFE6D0', '#100E0C', '#6F8AA0', '#C47A3C', '#C4281E'],
    niches: ['Alam', 'Budaya Asia', 'Filosofi', 'Animals', 'Sejarah seni'],
    motion: 'A purposeful brush reveal or spreading ink wash introduces the subject; animate actual gesture, bamboo-like bending or a flowing natural motif with stable ink edges thereafter.',
    motionHint: 'Sapuan muncul, tinta meresap, dan gerak alam tetap tenang.',
    character: 'Expressive ink figure with sparse confident contours, tonal washes and paper-white reserves; identity comes from silhouette and a few precise marks.'
  },
  {
    recipeId: '18_klimt', name: 'Emas dekoratif Klimt', group: ERA,
    summary: 'Bidang emas berpola bertemu wajah dan tangan yang lembut.',
    material: 'Decorative golden-period painting with brushed gold-leaf seams, geometric and spiral garment patterns, restrained jewel accents and modeled face and hands contrasted against flattened ornament.',
    palette: ['#C49434', '#784E12', '#F6D880', '#EFE5D0', '#9D4439'],
    niches: ['Sejarah seni', 'Budaya', 'Kisah manusia', 'Simbol dan makna', 'Desain'],
    motion: 'Keep the human action clear; selected gold patterns gently turn, a motivated highlight crosses leaf and a few fragments drift. Avoid decorative effects covering faces.',
    motionHint: 'Gestur lembut dengan sorot emas dan pola yang bergerak terbatas.',
    character: 'Softly modeled face and hands, flattened patterned gold garments and consistent silhouette; keep ornament away from facial identity.'
  },
  {
    recipeId: '19_munch', name: 'Ekspresionisme bergelombang', group: ERA,
    summary: 'Sapuan panjang dan ruang yang melengkung mengikuti emosi.',
    material: 'Expressionist painting with long translucent curving strokes, a restrained burning-orange sky against deep cool land and emotionally bent perspective. Avoid short outlined impasto strokes.',
    palette: ['#A8401E', '#5A1A14', '#F08A24', '#F4C03A', '#355767'],
    niches: ['Psikologi', 'Kecemasan', 'Kisah manusia', 'Sejarah seni', 'Dark History'],
    motion: 'Broad environmental curves flow slowly with the emotional beat, while intentional facial and hand gestures remain recognizable; avoid nauseating full-frame wobble.',
    motionHint: 'Lengkung ruang mengikuti emosi sambil mempertahankan aksi utama.',
    character: 'Elongated expressive painted figure with economical face detail and emotionally readable posture, never a generic cartoon pasted onto the painting.'
  },
  {
    recipeId: '20_dunhuang', name: 'Mural Dunhuang', group: ERA,
    summary: 'Pigmen mineral, garis merah tanah, dan kain yang mengalir.',
    material: 'Dunhuang-inspired mineral mural with earth-red plaster, malachite green, azurite blue, ivory and muted gold, fine iron-wire contours and background-only age flaking.',
    palette: ['#A5452F', '#5A2414', '#3F8F6E', '#2F5F8F', '#ECDFC4'],
    niches: ['Budaya Asia', 'Jalur Sutra', 'Ancient History', 'Civilization', 'Sejarah seni'],
    motion: 'Long cloth ribbons follow a visible gesture or breeze with delayed waves; mineral-painted figures act cleanly while sparse petals and lamp flames support the scene.',
    motionHint: 'Selendang, kelopak, dan cahaya lampu mengikuti gestur tokoh.',
    character: 'Mineral-painted figure with fine contour, era-appropriate dress and coherent ribbon attachment; protect faces from decorative flaking.'
  },
  {
    recipeId: '21_kusama', name: 'Dunia polkadot', group: ERA,
    summary: 'Titik tangan berulang dengan kontras bentuk dan ritme ruang.',
    material: 'Immersive hand-painted polka-dot art with irregular round dots, strong red-white or yellow-black contrast and clearly separated focal silhouettes. Repetition follows surfaces and perspective.',
    palette: ['#E43B36', '#241C1C', '#FFF5E0', '#F4C536'],
    niches: ['Pola alam', 'Psikologi persepsi', 'Sejarah seni', 'Matematika visual', 'Budaya pop'],
    motion: 'A controlled wave of dot expansion travels from the narrative point of contact, dots remain bounded and characters remain legible; do not dissolve the scene into a blank field.',
    motionHint: 'Gelombang titik berasal dari titik aksi dan menjaga subjek terbaca.',
    character: 'An original stylized figure with dot-patterned costume and strong contrasting silhouette; keep face and reference landmarks readable.'
  },
  {
    recipeId: '22_constructivism', name: 'Konstruktivisme', group: MATERIAL,
    summary: 'Kolase monokrom, diagonal merah, dan geometri yang tegas.',
    material: 'Constructivist visual composition with grayscale photographic halftone cutouts, red wedges, black circles and cream paper, purposeful diagonals and precise hierarchy. Generated reconstruction is not archival evidence.',
    palette: ['#E9DFC4', '#151311', '#C8231C', '#8F1711', '#F4ECD6'],
    niches: ['Sejarah desain', 'Civilization', 'Industri', 'Isu sosial', 'Technology'],
    motion: 'Geometric wedges and cutouts build the argument through one visible action, contact or directional signal; use decisive landings and minimal justified camera travel.',
    motionHint: 'Kolase dan geometri masuk tegas untuk menjelaskan hubungan.',
    character: 'Original grayscale halftone portrait or figure with a cream cut edge, restrained red costume accents and coherent photographic proportions.'
  },
  {
    recipeId: '23_dali', name: 'Surealisme mimpi', group: ERA,
    summary: 'Bentuk mustahil yang terasa nyata di lanskap dengan bayangan panjang.',
    material: 'Surreal painted realism with softly modeled objects, convincing surface volume, quiet open landscapes and long coherent shadows; one story-specific impossible material or scale relationship.',
    palette: ['#D2AD70', '#7A5129', '#22407C', '#8AA6B8', '#F6EFD6'],
    niches: ['Psikologi', 'Waktu', 'Mimpi', 'Sejarah seni', 'Science'],
    motion: 'Animate only the selected surreal mechanism, such as a soft object sagging or an impossible shadow extending; preserve other objects and character identity without random morphing.',
    motionHint: 'Satu mekanisme sureal bergerak; ruang dan karakter tetap konsisten.',
    character: 'Softly modeled original painted character with stable anatomy and deliberate surreal costume or prop only when the story requires it.'
  },
  {
    recipeId: '24_hopper', name: 'Realisme cahaya Hopper', group: ERA,
    summary: 'Ruang sehari-hari dengan blok matahari dan bayangan tajam.',
    material: 'Quiet American realist painting, restrained oil texture, angular warm sunlight crossing cool green shadows, architectural clarity and human-scale everyday environments.',
    palette: ['#5D8679', '#4B6D63', '#EFCF8F', '#C98B52', '#CC4A3C'],
    niches: ['Kehidupan kota', 'Psikologi', 'Kisah manusia', 'Arsitektur', 'Sejarah sosial'],
    motion: 'Subtle purposeful human gesture and a slowly shifting hard-edged light patch; cast shadows remain synchronized with the actor and light source.',
    motionHint: 'Gestur kecil dan pergeseran blok cahaya menjaga suasana.',
    character: 'Human figure modeled in broad restrained planes with warm lit and cool shaded versions of the same costume and face.',
    camera: 'Prefer a settled observational frame; one slow reveal only when it changes the story meaning.'
  },
  {
    recipeId: '25_ghibli', name: 'Cat air anime Ghibli', group: MATERIAL,
    summary: 'Latar cat air hangat dan karakter cel yang menyatu dengan alam.',
    material: 'Hand-painted anime background aesthetic: luminous layered watercolor washes, pigment pooling at edges, natural greenery and warm cel-shaded characters with subtle paper texture; original environments and cast.',
    palette: ['#FBF3E0', '#6A4A38', '#DCC49A', '#6D9874', '#90BFD4'],
    niches: ['Alam', 'Cerita keluarga', 'Petualangan', 'Lingkungan', 'Kehidupan sehari-hari'],
    motion: 'A coherent breeze moves grass, curtains and hair with delayed follow-through while the character acts; retain stable watercolor edges and readable two-tone shadows.',
    motionHint: 'Angin menyatukan gerak rumput, kain, rambut, dan aksi karakter.',
    character: 'Original expressive hand-painted anime character with warm soft contours, two-tone cel shadows and watercolor texture matching the background.'
  },
  {
    recipeId: '26_vaporwave', name: 'Vaporwave & neon', group: MATERIAL,
    summary: 'Cahaya neon, horizon retro, dan aksen analog terkendali.',
    material: 'Vaporwave and retro cyber-neon aesthetic with dark plum surfaces, magenta and cyan tube light, warm sunset accents and restrained analog scanline texture; clear focal hierarchy over noise.',
    palette: ['#12052A', '#FF4FD8', '#3FF6FF', '#FFD84A', '#FF8A3A'],
    niches: ['Technology', 'Nostalgia', 'Musik', 'Sejarah internet', 'Budaya digital'],
    motion: 'Purposeful travel through perspective geometry or an object interaction, localized light pulses and occasional analog tracking accents; avoid constant full-frame tearing.',
    motionHint: 'Gerak perspektif dan neon terarah dengan gangguan analog secukupnya.',
    character: 'Original stylized character separated from the background by controlled cyan and magenta rim light, solid readable costume and stable anatomy.'
  },
  {
    recipeId: '27_kirby', name: 'Komik kosmik Kirby', group: ERA,
    summary: 'Tinta tegas, perspektif kuat, dan energi cetak empat warna.',
    material: 'Silver-age cosmic comic illustration with spotted black shadows, feathered hatching, four-color offset print and slight color misregistration, dramatic foreshortening and clustered ink energy dots.',
    palette: ['#F4ECD6', '#17171B', '#DC3B34', '#F3C932', '#3253A5'],
    niches: ['Space', 'Science', 'Technology', 'Petualangan', 'Sejarah komik'],
    motion: 'Anticipation leads into a forceful perspective action, with energy clusters and speed accents tied to the actual event; use one coherent shot rather than automatic comic-panel cuts.',
    motionHint: 'Aksi perspektif kuat dengan energi dan garis gerak sesuai peristiwa.',
    character: 'Original bold comic character with blocky readable hands, confident anatomy, foreshortening and strong feathered ink shadows; no existing superhero costume.'
  },
  {
    recipeId: '28_monet', name: 'Lanskap air Monet', group: ERA,
    summary: 'Pantulan air, sapuan horizontal, dan warna taman yang lembut.',
    material: 'Water-garden impressionist painting with horizontal broken-color water strokes, fine green foliage marks, warm light reflected into cool water and delicate pink accents; coherent natural landscape space.',
    palette: ['#8FA6D6', '#3F6F4A', '#9DB5E0', '#8FB8A8', '#F0A0B8'],
    niches: ['Alam', 'Air dan lingkungan', 'Botani', 'Musim', 'Sejarah seni'],
    motion: 'Actual ripples, drifting leaves and reflected light follow the scene action; maintain anchored land forms and avoid repainting the full frame as noisy boiling.',
    motionHint: 'Riak, daun, dan pantulan berubah sementara bentuk daratan tetap.',
    character: 'Painted figure with fine colored strokes, warm lit planes and cool shadow colors, integrated naturally into the landscape.'
  },
  {
    recipeId: '29_seurat', name: 'Pointilisme Seurat', group: MATERIAL,
    summary: 'Titik warna murni membentuk cahaya melalui campuran optik.',
    material: 'Pointillist painting made of similarly sized distinct colored dots, optical color mixing with restrained complementary accents and light tones, coherent tonal masses rather than a regular digital halftone screen.',
    palette: ['#F6E49A', '#1A2058', '#3F6FD0', '#2F9A5A', '#F08A2A', '#F2B8C8'],
    niches: ['Science', 'Persepsi warna', 'Kehidupan sosial', 'Alam', 'Sejarah seni'],
    motion: 'Animate subject gesture and environmental movement while dot scale stays stable; a small fraction of complementary dots may change light, without full-screen noise.',
    motionHint: 'Gerak subjek dan perubahan cahaya menjaga ukuran titik tetap stabil.',
    character: 'Pointillist figure built from the same optical color dots as its surroundings, with readable silhouette and tonal facial landmarks.'
  },
  {
    recipeId: '30_matisse', name: 'Potongan warna Matisse', group: MATERIAL,
    summary: 'Kertas berwarna jenuh, tepi gunting, dan bentuk organik.',
    material: 'Hand-cut painted-paper shapes with subtly irregular scissor edges, saturated flat gouache color, pinned-paper contact shadows and broad organic leaf or figure silhouettes; keep brush texture secondary.',
    palette: ['#1D4FB8', '#171A23', '#4F95DC', '#1F9A5A', '#F0CF28', '#E6533B'],
    niches: ['Botani', 'Desain', 'Animals', 'Musik', 'Sejarah seni'],
    motion: 'Paper shapes pivot or flutter from credible attachment points, slight edge curl and follow-through reveal material; keep subject cut shapes identifiable throughout.',
    motionHint: 'Potongan berporos, tepi melengkung, dan gerak lanjutan seperti kertas.',
    character: 'Original cut-paper figure with large organic shapes, tiny paper facial pieces and consistent scissor edges; costume and face stay in the same material.'
  },
  {
    recipeId: '31_haring', name: 'Figur ritmis Haring', group: ERA,
    summary: 'Garis hitam seragam, figur sederhana, dan energi gerak.',
    material: 'Bold rhythmic line-art figures with uniform thick rounded black contours, saturated flat colors and short radiating motion marks; simplified iconic bodies without detailed realistic faces.',
    palette: ['#FFD51C', '#151515', '#16A54A', '#EF3F37', '#3279C6'],
    niches: ['Gerak tubuh', 'Musik', 'Budaya kota', 'Isu sosial', 'Kesehatan umum'],
    motion: 'Use a small set of readable stepped full-body poses on meaningful beats, with action lines showing actual effort. Keep all line weights and silhouette identity stable.',
    motionHint: 'Pose tubuh bertahap dan garis aksi mengikuti tekanan cerita.',
    character: 'Original iconic figure with solid color body, uniform heavy outline and minimal face detail; distinguish cast through silhouette and palette.'
  },
  {
    recipeId: '32_rembrandt', name: 'Chiaroscuro Rembrandt', group: MATERIAL,
    summary: 'Cahaya terarah, bayangan kaya, dan sorot cat tebal.',
    material: 'Chiaroscuro oil painting with deep brown shadow, a motivated warm light pool, lost and found edges, fine facial modeling and bristle impasto only on lit surfaces; preserve readable forms in shadow.',
    palette: ['#24180E', '#E4C495', '#784F29', '#C88C3C', '#F4E2C2'],
    niches: ['Biografi', 'Sejarah', 'Kisah manusia', 'Misteri', 'Penemuan'],
    motion: 'Subtle deliberate gesture in a stable warm light pool, candle movement or cloud shadow changes illumination coherently; avoid texture noise substituting for character action.',
    motionHint: 'Gestur dalam cahaya terarah, dengan bayangan dan api yang koheren.',
    character: 'A volumetrically painted figure with nuanced facial anatomy, warm highlights and soft shadow edges, never a flat vector face under a dark filter.'
  },
  {
    recipeId: '33_rubberhose', name: 'Kartun rubber hose', group: ERA,
    summary: 'Kartun monokrom, lengan lentur, dan pantulan gerak klasik.',
    material: '1930s-inspired original rubber-hose cartoon, warm monochrome palette, pie-cut eyes, flexible even-width limbs, white gloves when appropriate and restrained old-film texture.',
    palette: ['#F2E8D2', '#29251F', '#A39A84', '#5E574B', '#FBF7EC'],
    niches: ['Komedi', 'Weird History', 'Kebiasaan manusia', 'Musik', 'Fabel'],
    motion: 'Pose-to-pose animation with clear anticipation, elastic limbs, foot-anchored squash/stretch and delayed accessories; body action leads, film grain remains subordinate.',
    motionHint: 'Antisipasi, lengan lentur, dan pantulan dengan pijakan yang jelas.',
    character: 'Original monochrome round-faced cartoon figure with pie-cut pupils, consistent rubber-hose limbs and a distinctive silhouette; no copied vintage mascot.'
  },
  {
    recipeId: '34_shadowpuppet', name: 'Teater wayang kulit Tiongkok', group: ERA,
    summary: 'Kulit tembus cahaya, ukiran, dan sendi yang digerakkan tongkat.',
    material: 'Chinese shadow-puppet theater with translucent dyed leather, delicate pierced patterns, visible joint rivets and warm backlit cloth. Overlap naturally darkens; clear negative spaces define faces and pale details.',
    palette: ['#FFF6D6', '#3A160A', '#C0352A', '#2F7D4C', '#D99A2E'],
    niches: ['Budaya Asia', 'Cerita rakyat', 'Ancient History', 'Legenda', 'Seni pertunjukan'],
    motion: 'Articulated leather pieces pivot at visible joints, restrained stepped rod-driven gestures, loose wrist follow-through and coherent backlight; avoid stretchy organic morphs.',
    motionHint: 'Gerak sendi bertongkat, tangan berayun, dan cahaya dari belakang.',
    character: 'Original articulated translucent-leather puppet with carved face reserves, distinctive costume patterns and visible rivet joints.',
    camera: 'Use a stable stage-facing camera so puppet articulation and silhouettes remain legible.'
  },
  {
    recipeId: '35_shinkai', name: 'Anime cahaya sinematik', group: MATERIAL,
    summary: 'Latar kaya detail, bayangan cel, awan, dan sinar atmosfer.',
    material: 'Cinematic anime light treatment with detailed painted environments, layered cumulus clouds, crisp cel-shaded characters, warm rim light against cool shadows, restrained bloom and physically motivated sunbeams.',
    palette: ['#B7C6E6', '#2C3A66', '#FFE8DC', '#F8D681', '#8297C6'],
    niches: ['Cuaca', 'Space', 'Kehidupan kota', 'Petualangan', 'Kisah manusia'],
    motion: 'Narrative gesture leads while cloud masses, hair, curtains and their shadows respond to a coherent breeze; sunbeam dust and glints remain subtle and source-motivated.',
    motionHint: 'Awan, kain, bayangan, dan sorot bergerak mengikuti cahaya serta angin.',
    character: 'Original anime figure with crisp cel-shadow bands, stable eye proportions, fine warm contours and rim light matching the environment.'
  },
  {
    recipeId: '36_picasso_blue', name: 'Lukisan periode biru', group: ERA,
    summary: 'Monokrom biru, figur memanjang, dan gestur kontemplatif.',
    material: 'Early twentieth-century blue-period painting with a strict blue and blue-gray palette, broad quiet brushstrokes, stable Prussian-blue contours and elongated melancholy figures. Distinguish identity through value, not warm accent colors.',
    palette: ['#1D3866', '#0C1830', '#2D5A94', '#6B8FB6', '#B6C8D8'],
    niches: ['Kisah manusia', 'Psikologi', 'Sejarah sosial', 'Empati', 'Sejarah seni'],
    motion: 'Slow deliberate breath, gaze and hand action convey the story; restrained moonlight reflection or drifting cloud provides support while strong blue contours remain stable.',
    motionHint: 'Napas, tatapan, dan gestur lambat dalam palet biru yang utuh.',
    character: 'Elongated painted figure, broad quiet blue tonal planes, stable dark contours and identity preserved by shape and value.'
  },
  {
    recipeId: '37_rick_morty', name: 'Kartun sci-fi flat', group: ERA,
    summary: 'Kontur tipis membulat, mata sederhana, dan dunia sci-fi yang eksentrik.',
    material: 'Original adult science-fiction flat-outline cartoon, rounded dark-gray contours, hard flat fills, simple same-hue shadows and low-contrast background mottling. Large white eyes with tiny pupils, economical eyelid and mouth curves; no glossy eyes or photorealistic light.',
    palette: ['#CDBF96', '#222323', '#9B7752', '#EFC4A0', '#A7D6EA'],
    niches: ['Science', 'Space', 'Technology', 'Weird History', 'Psikologi'],
    motion: 'Animate semantic body parts with consistent shoulder and joint anchors, purposeful gaze, blink, gesture and head response; tail or clothing follows. Do not invent unsupported walking mechanics or randomly reshape contours.',
    motionHint: 'Tatapan, kedip, dan gestur jelas dengan bentuk serta sendi konsisten.',
    character: 'Original flat-outlined science-fiction cartoon cast with rounded contours, simple white eyes and dot pupils, distinctive silhouette and original costume; never copy named franchise characters.'
  }
]

export function huashuStyleId(recipeId: string): string {
  return `huashu-${recipeId.replaceAll('_', '-')}`
}

export function getHuashuRecipe(styleId?: string): HuashuStyleRecipe | undefined {
  return HUASHU_STYLE_RECIPES.find((recipe) => huashuStyleId(recipe.recipeId) === styleId)
}

export function huashuRecipePrompt(recipe: HuashuStyleRecipe): string {
  return `${recipe.material} Palette: ${recipe.palette.join(', ')}. One original coherent narrative composition with a clear subject and meaningful action. Characters, props and environment share this exact visual language. Do not copy upstream demonstration rooms, characters or layouts. No baked-in text, captions, logos or watermark.`
}

export const HUASHU_ART_STYLES: VisualStyle[] = HUASHU_STYLE_RECIPES.map((recipe) => ({
  id: huashuStyleId(recipe.recipeId), name: recipe.name,
  category: recipe.recipeId === '15_raytrace' ? '3d' : '2d',
  niche: recipe.niches.join(' · '), swatch: recipe.palette[0], ink: recipe.palette[1],
  prompt: huashuRecipePrompt(recipe), characterHint: recipe.character,
  skillIds: ['huashu-art-motion'], preview: huashuStyleId(recipe.recipeId),
  galleryGroup: recipe.group, summary: recipe.summary, motionHint: recipe.motionHint,
  palette: recipe.palette, sourceRecipe: recipe.recipeId,
  sourceUrl: `${HUASHU_RECIPE_SOURCE}/blob/main/references/${encodeURIComponent('风格配方')}/${recipe.recipeId}.md`
}))
