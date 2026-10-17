import type { VisualStyle } from './styles'

/** The five promo/demo looks in Bang Motion's gallery, alongside its six existing explainers. */
export const BANG_GALLERY_STYLES: VisualStyle[] = [
  {
    id: 'motion-grainy', name: 'Grainy gradient', category: '3d', galleryGroup: 'Galeri promo',
    niche: 'Teknologi · AI · musik · peluncuran', summary: 'Bentuk bercahaya, gradasi dalam, dan butiran halus.',
    swatch: '#191528', ink: '#FBCE80', palette: ['#191528', '#EA6F47', '#FBCE80', '#AA92CA'],
    prompt: 'Layered sculptural gradient shapes with fine tactile grain, internal luminosity, deep tonal contrast and cinematic dimensional space. Derive the focal object from the story. Restrained supporting elements. No readable text, UI labels, logos or watermark.',
    characterHint: 'an original sculptural stylized character or hero object with soft dimensional shading, subtle grain and coherent gradient lighting',
    motionHint: 'Lapisan membuka dan kamera menembus bentuk untuk mengungkap ide.'
  },
  {
    id: 'motion-poster', name: 'Poster color-block', category: '2d', galleryGroup: 'Galeri promo',
    niche: 'Musik · event · budaya · kampanye', summary: 'Bidang warna tegas, siluet besar, dan komposisi poster.',
    swatch: '#FFCF36', ink: '#222326', palette: ['#FFCF36', '#222326', '#F25137', '#F8F2E7'],
    prompt: 'Bold graphic poster with large cropped geometric color fields, one expressive hero silhouette and editorial negative space. Strong scale contrast, crisp flat fills, story-specific shapes and no generic card grid. Leave typography for editing; no generated letters, logos or watermark.',
    characterHint: 'a bold original graphic silhouette with simplified expressive pose, strong costume shapes and crisp flat-color contrast',
    motionHint: 'Bidang warna berganti melalui aksi dan potongan tegas pada ketukan.'
  },
  {
    id: 'motion-product-tour', name: 'Product tour', category: '2d', galleryGroup: 'Galeri promo',
    niche: 'Produk · aplikasi · tutorial · teknologi', summary: 'Produk menjadi pusat cerita: tindakan, proses, lalu hasil.',
    swatch: '#E8ECE9', ink: '#213A32', palette: ['#E8ECE9', '#213A32', '#90B9A5', '#EFB76A'],
    prompt: 'Premium product demonstration still: one supplied or accurately described product/interface in an intentional editorial composition with generous space and believable soft shadows. Show a clear user action and visible outcome. Preserve supplied product identity; no invented UI text, false claims, logo or watermark. Interface text is added in editing.',
    characterHint: 'an optional original simplified presenter or hand interacting with the actual product, subordinate to its function and consistent with the editorial art direction',
    motionHint: 'Kamera mengikuti interaksi penting, kemudian memperlihatkan hasilnya.'
  },
  {
    id: 'motion-flat-vector', name: 'Flat vector promo', category: '2d', galleryGroup: 'Galeri promo',
    niche: 'Aplikasi · keuangan dasar · teknologi · edukasi', summary: 'Ilustrasi geometris dengan gestur dan warna yang bersih.',
    swatch: '#E5EBC9', ink: '#254E48', palette: ['#E5EBC9', '#254E48', '#F1A96B', '#8EBBA2'],
    prompt: 'Original flat-vector promotional illustration with solid color fills, expressive simplified hands and characters, purposeful asymmetry, clean bold silhouettes and story-specific objects. One readable narrative scene, no infographic grid, baked-in text, logo or watermark.',
    characterHint: 'an original flat vector character with consistent geometric proportions, expressive hands and a distinct readable silhouette',
    motionHint: 'Gestur dan transformasi objek disusul gerak susulan elastis yang halus.'
  },
  {
    id: 'motion-photo-pop', name: 'Flat pop with photos', category: 'realistis', galleryGroup: 'Galeri promo',
    niche: 'Kampanye · lifestyle · produk · aplikasi', summary: 'Potongan foto dengan stiker dan bidang warna penuh energi.',
    swatch: '#EABB75', ink: '#31291F', palette: ['#EABB75', '#31291F', '#C8593F', '#F7EBD4'],
    prompt: 'Premium flat-pop photographic composition with clean photo cutouts, bold story-derived color fields and a few meaningful graphic stickers. Coherent light, contact shadows and an energetic contextual pose. Preserve uploaded reference identity. No invented documentary evidence, generated text, logo or watermark.',
    characterHint: 'an original photographic cutout figure in a contextual action pose, preserving supplied identity and coherent lighting against bold graphic color fields',
    motionHint: 'Foto dan stiker masuk elastis; bidang warna berubah karena aksi.'
  }
].map(style => ({ ...style, category: style.category as VisualStyle['category'], skillIds: ['bang-motion'], sourceUrl: 'https://github.com/bangtutorial/bang-motion#style-gallery' }))
