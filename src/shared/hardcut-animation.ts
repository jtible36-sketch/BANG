// Preset "Hardcut Animation" — alur kerja gaya Dafiology (@Dafiology Shorts).
//
// Reverse-engineered dari format Dafiology: sejarah benda sehari-hari,
// ±50-60 detik, 9:16, hook visual 3 detik, ketukan kronologis dengan hard cut
// sinkron narasi (±4 detik/scene), overlay tahun/nama besar, karaoke caption
// hijau, VO Indonesia santai, musik di bawah narasi.
//
// Preset ini memakai ulang seluruh mesin Cutout (audit v4, repair loop, seed
// deterministik, forced hard-cut, karaoke caption) — hanya arah produksinya
// yang Dafiology-spesifik. Preset lain TIDAK disentuh.

export const HARDCUT_STYLE_ID = 'hardcut-animation'
export const HARDCUT_NAME = 'Hardcut Animation'

export const HARDCUT_STYLE = [
  'Cinematic AI video still, teal-and-orange color grade, dramatic warm key light with cool shadows,',
  'vertical 9:16 composition, one clear focal subject per frame, shallow depth of field,',
  'photorealistic detail with subtle film grain, high contrast hook framing.',
  'No text, no letters, no captions, no watermark, no logo.',
].join(' ')

export const HARDCUT_CHARACTER =
  'A photorealistic character appropriate to the scene era and location, natural skin texture, ' +
  'story-specific clothing. Characters MAY change between scenes (no global identity lock required); ' +
  'within one scene, keep the same face, costume, proportions and lighting across poses.'

export const HARDCUT_NICHES = [
  'Sejarah benda sehari-hari',
  'Penemuan dan teknologi',
  'Sejarah aneh',
  'Fakta unik',
  'Sains sehari-hari',
]

export const HARDCUT_DIRECTION = [
  // === STRUKTUR SHOT (Dafiology beat template) ===
  'UNIT KERJA = SATU SHOT (±2-4 detik, 1 aksi, mengikuti timing kata rekaman). ' +
    'Setiap klip disusun dari shot-shot yang mengikuti beat template: ' +
    'SHOT 1 = HOOK (0-3 detik, visual paling kontras + judul topik, tanpa intro/logo/bumper); ' +
    'SHOT 2-3 = KONTEKS (masalah lama / dunia sebelum solusi); ' +
    'SHOT 4-8 = KRONOLOGI (SATU tahun/peristiwa per shot, masing-masing dengan overlay tahun besar); ' +
    'SHOT TERAKHIR = PENUTUP (versi modern + kalimat penutup yang memuaskan rasa penasaran).',

  // === ATURAN CUT ===
  'ANTAR SHOT SELALU HARD CUT. Tidak ada dissolve, wipe, fade, atau transisi lain. ' +
    'Cut sinkron dengan ketukan narasi: setiap aksi/peristiwa narasi = 1 shot baru. ' +
    'Tidak ada shot lebih dari ±5 detik tanpa cut atau overlay baru (aturan pace).',

  // === MOTION VOCABULARY (satu-satunya gerak yang boleh ada) ===
  'Gerak per shot HANYA dari daftar ini: ' +
    'pose-swap (ganti pose tanpa interpolasi, untuk aksi diskrit); ' +
    'slide-linear (perpindahan A→B, easing SELALU linear); ' +
    'hold (diam penuh); ' +
    'prop-reaction (spring/back-out HANYA untuk properti kecil, amplitudo kecil, wajib settle time); ' +
    'camera-push (zoom/drift linear lambat ala Ken Burns, tanpa shake). ' +
    'DILARANG: ease-in, ease-out, ease-in-out, spring/back-out bebas, camera shake. ' +
    'Maksimal 2 layer bergerak per shot; pose changes serta parent/IK/mask/parallax motion ikut dihitung.',

  // === OVERLAY (Dafiology style, sebagai layer teks — bukan baked ke gambar) ===
  'Overlay TAHUN: teks BESAR kuning dengan outline kontras, muncul 2-3 detik pada kata kunci tahun. ' +
    'Overlay NAMA: kotak putih teks hitam. ' +
    'Overlay label lain: kecil di bawah. ' +
    'Semua teks penting HARUS sebagai layer teks yang bisa diedit di editor — JANGAN pernah di-baked ke gambar AI. ' +
    'Label harus sesuai isi narasi; dilarang mengarang fakta/tahun/nama.',

  // === CAPTION & AUDIO ===
  'Caption: karaoke ala TikTok, teks putih dengan highlight kata aktif HIJAU (#73F96C), outline gelap, posisi bawah, ukuran kecil. ' +
    'Naskah: Bahasa Indonesia santai ±140 kata/menit, struktur hook → masalah lama → solusi kronologis → versi modern. ' +
    'Target ±130-150 kata untuk ±60 detik. Musik: upbeat, volume ±-20dB di bawah narasi, tidak menutupi VO.',

  // === DISIPLIN ASET PER SHOT ===
  'Per shot: 1 background plate per lokasi (REUSE antar shot bila lokasi sama — jangan generate plate baru untuk lokasi yang sama); ' +
    '1-2 pose karakter (start/end); 0-1 prop. ' +
    'Karakter boleh berganti antar scene; dalam satu scene jaga identitas (wajah, kostum, proporsi, lighting). ' +
    'PNG/WebP butuh alpha asli; satu foto utuh tidak otomatis menjadi layer transparan.',

  // === STRONG ENGAGING ===
  'Satu fakta/tahun/peristiwa per shot — tidak ada shot kosong. ' +
    'Hook 3 detik pertama harus visual paling mengejutkan + judul besar, langsung masuk topik.',
].join('\n\n')

export const HARDCUT_STAGES = {
  research:
    'Untuk brief, tentukan: benda sehari-hari yang punya kronologi jelas, masalah praktis yang dipecahkan, ' +
    'periode/lokasi tiap milestone, dan callback ironis ke masa kini. Setiap milestone sejarah harus menjelaskan ' +
    'keterbatasan apa yang dipecahkan dan keterbatasan apa yang tersisa. Verifikasi fakta dari sumber tepercaya; ' +
    'bedakan temuan mapan dari hipotesis. Jangan mengarang sumber, dialog historis, atau hasil ilmiah.',
  script:
    'Tulis naskah Bahasa Indonesia santai (±140 kata/menit, ±130-150 kata untuk ±60 detik). ' +
    'Struktur: hook fakta mengejutkan (3 detik pertama) → konteks/masalah lama → rantai sebab-akibat kronologis ' +
    '(satu peristiwa per shot) → versi modern + penutup. Kalimat pendek, kata kerja konkret yang bisa divisualkan. ' +
    'Batas scene mengikuti aksi narasi yang utuh, bukan kuota durasi tetap. Tahun adalah navigasi, bukan pengganti penjelasan.',
  visual: [
    HARDCUT_STYLE,
    HARDCUT_DIRECTION,
    'Arah produksi default: vertikal 9:16 full-color sinematik; rasio aspek proyek yang dipilih eksplisit diutamakan. ' +
      'Untuk setiap shot catat: rentang narasi, lokasi, SATU aksi utama, objek fokus, pose awal/akhir, target tatapan/kontak, ' +
      'hasil yang terlihat, reaksi, properti, bagian tertutup, framing kamera, label tahun/nama yang bisa diedit, dan cue SFX. ' +
      'Gunakan timing kata rekaman aktual bila tersedia.',
    'Jaga teal-orange grade konsisten antar scene. Ubah pose/state saat kata kerja atau emosi berubah; ' +
      'satu potret netral dengan zoom kamera berulang tidak cukup. Gunakan framing wide untuk orientasi spasial, ' +
      'detail/close-up singkat untuk reaksi penting.',
    'Sisakan area caption bawah yang bersih. Semua teks penting sebagai layer teks editor, bukan baked ke gambar; ' +
      'cek ukuran dan penempatan di layar ponsel.',
  ].join('\n\n'),
  video: [
    'Referensi: scene AI ±4 detik dengan gerak Ken Burns halus (drift/zoom linear lambat), hard cut antar scene. ' +
      'Animasikan sebagai SATU shot kontinu dengan SATU aksi narasi utama dan akibat/reaksi yang terbaca.',
    HARDCUT_DIRECTION,
    'Pilih gerak sederhana yang jelas: pose-swap pada perubahan kata kerja/emosi, slide linear, atau push-in singkat ' +
      'untuk penekanan. Jangan gerakkan semua layer bersamaan. Hindari bobbing seluruh gambar, wajah karet, ' +
      'perubahan kostum acak, dan montase dalam satu shot.',
    'Urutan produksi: naskah final + voice → sinkron timing → rencanakan kebutuhan per shot dari narasi → ' +
      'generate aset terpisah per shot → inspeksi → auto-edit per shot → review reaksi/caption/SFX → ekspor sampel 5-10 detik → final. ' +
      'Preset ini tidak menjanjikan hasil identik dengan video referensi.',
  ].join('\n\n'),
  thumbnail:
    `${HARDCUT_STYLE}\nSatu subjek sinematik besar melakukan aksi sentral yang mengejutkan, satu prop relevan, ` +
    `dan lingkungan cerita yang jelas. Kontras tinggi agar terbaca di ukuran kecil; tanpa bukti dokumenter palsu. ` +
    `Ikuti format thumbnail yang diminta (bisa berbeda dari video vertikal). Semua teks penting untuk editor.`,
  voice:
    'Narasi Bahasa Indonesia santai ±140 kata/menit, jelas dan ringan. Target ±130-150 kata untuk ±60 detik. ' +
    'Kalimat pendek, penekanan bervariasi, jeda singkat untuk reveal dan payoff. Ikuti naskah faktual yang sudah direview. ' +
    'Musik di bawah narasi; rencanakan SFX pada aksi. Jangan generate suara tambahan atau retake berbayar otomatis.',
}

export const HARDCUT_SOURCE = HARDCUT_DIRECTION
