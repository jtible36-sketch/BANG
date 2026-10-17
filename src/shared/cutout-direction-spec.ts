/** User-authored direction. Keep this separate from project snapshots and asset hashes. */
export const CUTOUT_FACT_PRODUCTION_RULES = `ARAH PRODUKSI V4 — CUTOUT · FAKTA & KOMEDI

GAYA VISUAL: tiru ritme dan bahasa visual channel Dafiology (shorts sejarah benda sehari-hari): sinematik fotografis, era dan lokasi yang jelas, teks tahun/nama besar di layar, caption karaoke, komedi reaksi. Tapi pakai CERITA, TOKOH, dan IDENTITAS proyek ini — jangan meniru presenter atau identitas video referensi.

RITME & STRUKTUR (diturunkan dari narasi, bukan template kaku):
- 3 detik pertama = hook: visual paling mengejutkan dari tema + teks judul besar langsung muncul.
- Potongan mengikuti pergantian topik/kata kunci narasi (pakai timestamp kata dari rekaman aktual), tiap shot ±2–4 detik, hard cut tanpa transisi.
- Alur: masalah lama → solusi → masalah baru → solusi baru → versi modern → punchline/penutup yang relevan.
- Satu aksi utama per shot. Mulai framing lebar untuk orientasi era/lokasi, lalu detail mekanisme, lalu reaksi.

VISUAL PER SHOT (wajib sesuai tema naskah):
- Era, lokasi, kostum, dan properti HARUS sesuai periode yang disebut narasi. Jangan campur era dalam satu shot.
- Tokoh: jaga identitas wajah, kostum, dan proporsi konsisten di semua shot; variasikan pose dan ekspresi (netral menjelaskan, memegang/menunjuk properti, satu reaksi kocak yang relevan situasi).
- Tiap klip wajib >1 layer: background TANPA tokoh + pose karakter + properti + foreground bila relevan. Jangan animasikan foto utuh satu layer.
- Grade sinematik hangat, pencahayaan dramatis, komposisi vertikal 9:16 penuh.
- Semua teks penting dibuat di editor, JANGAN dibakar ke gambar: tahun = kuning bertepi kontras, nama/fakta = label putih teks hitam, tampil 2–3 detik di momen kunci. Caption karaoke putih sorotan hijau di bawah.

KOMEDI:
- Sisipkan reaksi/ekspresi kocak yang relevan situasi tepat di punchline, lalu push-in singkat. Humor dari situasi, bukan dari fakta karangan.

BATASAN GERAK (wajib dipatuhi):
- Ganti pose di tiap perubahan kata kerja/emosi (startPose → endPose → reaction). Dilarang mengganti pose dengan zoom/bobbing berulang pada pose netral.
- Easing: linear/hold untuk SEMUA kontak tangan/alat dan pose yang ditahan; back-out/spring HANYA untuk properti/reaksi kecil, amplitudo kecil, dan beri waktu menetap. Dilarang memberi pegas ke semua sendi atau membuat kontak melayang.
- Maksimal 2 layer bergerak dalam satu klip; background lebih lambat dari foreground (parallax). Dilarang menggerakkan semua layer serempak.
- Dilarang memakai kamera shake/goyang.
- Tahan pose (hold) saat istilah atau hubungan sebab-akibat perlu dibaca.

AUDIO:
- SFX relevan tepat di momen aksi (mis. pop saat pergantian pose), volume di bawah narasi. Musik upbeat di bawah voiceover.

KEJUJURAN ASET:
- Shot harus men-tile durasi klip persis dari 0 sampai akhir; setiap assetId yang direncanakan harus dipakai.
- Jika aset kurang (background terpisah, pose, atau properti belum ada), tulis kebutuhannya di summary — jangan mengarang assetId dan jangan berpura-pura memisahkan foto utuh menjadi layer transparan.
- Untuk aksi kontinu yang tidak bisa diwakili pose (ekspresi wajah berubah terus, interaksi tangan rumit, tulisan tangan), catat sebagai kebutuhan "klip khusus", jangan dipaksakan lewat keyframe.`

export const CUTOUT_AUTO_EDIT_INSTRUCTION = 'Ikuti arahan Cutout · Fakta & Komedi v4: hook visual dan judul editor sejak 0 detik, shot sekitar 2–4 detik mengikuti kata rekaman, hard cut. Gunakan era/lokasi yang benar, identitas proyek, background bersih dan aset pose/properti terpisah. Satu aksi utama, wide → detail mekanisme → reaksi/push-in. Ganti pose pada perubahan kata kerja/emosi. Maksimal dua layer bergerak, tanpa shake; kontak tangan/alat dan sendi linear/hold. Pegas kecil hanya pada properti/reaksi, lalu menetap. Caption karaoke putih-hijau, label tahun kuning/nama putih-hitam; SFX tersedia dan musik upbeat di bawah narasi. Semua aset rencana dipakai, rentang shot menyambung penuh. Laporkan aset atau klip khusus yang kurang dalam summary.'
