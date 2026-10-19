# Scene Brief otomatis dan PNG masuk & getar

Perubahan 19 Oktober 2026 untuk preset `cutout-facts`. Proyek dan media pengguna tidak diubah selama pengembangan; tes memakai fixture dan provider terkontrol.

## Pemakaian

1. Buka ulang Naraflow. Di Brief, bagian **Arahan Scene Brief otomatis** menampilkan usulan yang berasal dari narasi, rencana adegan, dan brief proyek. Tidak perlu mengisi formulir tiap klip.
2. Setelah membaca tabel, klik **Setujui semua usulan Scene Brief · tanpa kredit**. Ini menerima keputusan editorial termasuk lokasi usulan yang terlihat. Izin kredit gambar tetap terpisah. Klip yang membutuhkan identitas karakter baru dilewati dengan alasan, bukan disetujui diam-diam.
3. Pilih profil **PNG masuk & getar** di Brief atau Visual/Produksi. Profil v5 tetap terpisah dan stabil. Untuk paket lama yang grupnya statis, klik **Aktifkan grup gerak pada paket tersedia · tanpa generate** di kontrol profil. Tindakan eksplisit ini menambahkan grup karakter/properti ke mover bila slot tersedia, maksimal dua grup. ID paket, aset gambar dan rentang shot dipertahankan.
4. Atur arah masuk, kekuatan, dan kamera; pratinjau lima detik, lalu jalankan edit otomatis. Aset lengkap yang tersedia digunakan kembali.

## Perilaku yang diuji

- Prefill lokal tanpa model/API: era, lokasi, waktu/cuaca, karakter yang dikenal, pakaian, properti, alasan dan bukti. Informasi di luar narasi diberi sumber `proposal`; lokasi hipotetis tidak diwarisi dari adegan sebelumnya tanpa kelanjutan eksplisit. Tahun/lokasi tanpa dasar diisi sebagai rekonstruksi netral, bukan klaim sejarah. Pemilihan karakter baru tidak diada-adakan.
- Persetujuan tidak otomatis saat panel dibuka. Persetujuan sekaligus hanya dari klik pengguna pada ringkasan yang terlihat. Perubahan narasi, storyboard, brief/defaults atau identitas membatalkan persetujuan yang tidak sesuai sumber.
- Hard cut dipertahankan. Mover karakter bebas masuk dari kiri/kanan, menetap, getar singkat dan kembali tepat ke posisi istirahat. Pose yang telah dijadwalkan tetap dipakai. Tidak menggeser rig, grup beranak, atau shot dengan kontak tangan/alat yang terdeteksi.
- Zoom properti dipicu kata objek dari rekaman, zoom masuk, hold, zoom keluar lalu hold. Tidak menebak timing kata bila words[] belum ada.
- Kamera dapat mengikuti shot, statis, Ken Burns (pan/zoom halus), push-in cepat, atau pull-out cepat. Gerak kamera dibatalkan bila parallax menyebabkan pelanggaran dua mover.
- Maksimal dua mover efektif per shot; pose, parent/IK/mask/parallax tetap ikut hitungan. Waktu bulat dan anggaran maksimum 8192 keyframe total profil. Gerak yang melewati anggaran dilewati dengan catatan.

## Status parameter

Profil `png-impact` adalah racikan editorial awal yang dapat ditinjau, **bukan hasil pengukuran video Dafiology** atau bukti kemiripan piksel. Masuk 320 ms, settle 200 ms, simpangan x 0,006/0,012/0,018 lebar frame dan rotasi 0,5/1/1,5 derajat untuk halus/sedang/tegas. Zoom objek 1,08/1,14/1,20 dengan ramp 180 ms. Kamera push/pull 300 ms; Ken Burns memakai lintasan linear pendek. Profil `comedy-jolt` berbasis parameter referensi tetap unverified dan tidak diisi dengan angka ini.

Pemeriksaan struktur dan fixture tidak memverifikasi fakta sejarah, kecocokan wajah/alpha/kontak semua gambar, maupun kemiripan hasil proyek nyata dengan referensi. Tinjau aset dan hasil preview untuk keputusan tersebut.

## Verifikasi

- `npm run typecheck` dan `npm run build` berhasil.
- `npm run test:cutout-prefill-impact`: 10 kasus, termasuk 92 klip dari enam proyek fixture; determinisme, hold, timing kata, kamera, kontak, mover dan v5 terpisah.
- `npm run test:cutout-permanent`: 13 kasus shared dan 12 kasus integrasi Electron/SQLite, termasuk penerapan profil baru lewat edit otomatis dan readiness ekspor, serta migrasi metadata tanpa regenerasi.
- `npm run test:cutout-v5`: 19 kasus.
- `npm run test:cutout-assets`: 15 kasus integrasi terkontrol termasuk render MP4 mask/IK lama.
- `npm run test:editor-automation`: 21 pemeriksaan.
- UI aktual React/Electron: 7 pemeriksaan, tanpa panggilan generasi/kredit. Ringkasan Brief, persetujuan sekaligus, blocker tokoh, pilihan profil dan preview teruji. Bukti di workspace `outputs/cutout-prefill-impact/ui-check.json`.

Belum dilakukan generasi media baru atau penilaian kemiripan hasil proyek pengguna terhadap referensi setelah perubahan ini.
