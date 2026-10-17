# Generator aset Cutout, masking, dan inverse kinematics

Fitur lokal Naraflow di `E:\BANG`, 16 Oktober 2026. Buka ulang aplikasi setelah pembaruan. Untuk Codex eksternal, muat ulang MCP Naraflow agar katalog 14 tool dan skema barunya terbaca.

## Generate sesuai narasi

1. Buka proyek dengan naskah/narasi dan pilih adegan pada langkah **Editor**.
2. Buka **Cutout → Generate aset terpisah**. Panel tetap tersedia sebelum komposisi dibuat.
3. Tekan **Susun kebutuhan dari narasi · Codex**. Penyusun visual membaca narasi, cerita, timing kata bila tersedia, gaya dan identitas proyek, lalu menyimpan kebutuhan background bersih, pose, reaksi, properti dan bagian tubuh bila diperlukan. Satu kebutuhan berarti satu file, bukan atlas gabungan. Alternatifnya, gunakan **Tambah kebutuhan manual**.
4. Buka rincian setiap kebutuhan untuk mengubah jenis, nama, karakter referensi, waktu lokal dan prompt. Simpan kebutuhan yang sudah ditinjau.
5. Pilih **Codex** atau **Flow MCP**, serta **PNG** atau **WebP lossless**. Gunakan tombol generate per item atau **Generate N aset** untuk mengantre seluruh paket.
6. Tinjau gambar hasil. **Tambah layer** menempatkan file terpisah pada komposisi; background masuk di belakang dan menutup frame. Untuk pose, pilih layer tokoh lalu tekan **Jadikan pose layer** agar gambar berganti pada waktu kebutuhan tersebut.
7. Setelah aset siap, gunakan panel **Edit otomatis** untuk mengatur gerak dan reaksi dari aset yang tersedia, atau atur keyframe secara manual.

Codex memerlukan koneksi **gambar** di Pengaturan dan sesi akun lokal yang aktif. Perencanaan kebutuhan memerlukan koneksi **penyusun visual**. Flow membutuhkan alur **Flow MCP langsung**, login Google dan proyek Flow terbuka. Pengiriman memakai satu varian, tanpa retry otomatis, serta batas kredit gambar nol seperti alur Flow yang sudah ada. Aplikasi menolak model yang memerlukan kredit melebihi batas tersebut.

Referensi identitas berasal dari character sheet proyek. Untuk hasil wajah/kostum konsisten, tetapkan referensi tokoh sebelum merencanakan paket. Generate membuat rekonstruksi visual; setiap hasil berstatus perlu ditinjau. Cocokkan wajah, kostum, arah cahaya, padding kanvas, posisi kaki, serta tepi rambut dan jari.

## Transparansi dan pemulihan

Background dibuat penuh tanpa tokoh, caption atau label. Tokoh/pose/properti/part/foreground diminta sebagai satu subjek terisolasi dengan padding. Codex diminta menghasilkan alpha asli. Jika provider menghasilkan latar magenta polos `#FF00FF`, aplikasi memisahkan area magenta yang tersambung ke tepi dan merapikan spill di batasnya. Pemisahan ini ditujukan untuk backdrop generasi yang memang diminta; foto adegan utuh tidak otomatis diurai menjadi beberapa objek.

PNG dan WebP diperiksa sebagai bitmap, bukan berdasarkan ekstensi saja. Hasil tanpa alpha atau backdrop yang dapat dipisahkan ditolak dan tidak dilabeli sebagai aset transparan. Bagian magenta yang terkurung oleh kontur atau detail tepi yang kurang bersih mungkin memerlukan mask atau generate ulang. Warna magenta pada kostum sebaiknya dihindari. WebP memakai lossless dan mendukung alpha; pembacaan referensi di Windows memiliki decoder FFmpeg bila nativeImage tidak dapat membukanya.

Narasi, karakter atau kebutuhan yang berubah saat generate membuat hasil lama ditolak sebelum diadopsi. Gambar adegan utama dan master identitas tetap dipilih secara terpisah; generate aset tidak otomatis menggantinya. Paket kebutuhan disimpan di database, file hasil disimpan di folder media proyek. Pembatalan tersedia pada pekerjaan berjalan.

Jika Flow menerima pengiriman tetapi koneksi putus, tekan **Pulihkan aset Flow**. Aplikasi mencari pekerjaan lama berdasarkan ID/folder dan mengambil hasil yang sama, tanpa mengirim generate baru. Pengiriman yang belum pasti harus dipulihkan sebelum diulang; pembatalan yang status remotenya belum terkonfirmasi juga diperiksa.

## Masking

Pilih layer, lalu buka **Masking layer**:

- Aktifkan mask dan pilih persegi/crop, elips, atau poligon.
- Atur koordinat dalam persen ukuran gambar. Poligon mendukung 3–64 titik yang bisa ditambah, dihapus dan disunting.
- **Balik mask** membuat area bentuk menjadi lubang.
- **Feather mask** menghaluskan batas sampai 25% sisi pendek gambar.

Mask mengikuti transform layer dan pergantian pose. Bentuk mask disimpan per layer; perubahan bentuk mask belum memiliki track keyframe tersendiri. Alpha asli gambar tetap dipertahankan. Pratinjau dan ekspor menggunakan SVG alpha mask yang sama, termasuk invert dan feather.

## IK dua tulang

1. Pada bagian **Inverse kinematics · 2 tulang**, tekan **Buat rantai IK + dua slot gambar**.
2. Pilih layer tulang atas dan bawah pada daftar layer, lalu pasang PNG bagian tubuhnya. Preset awal memakai sumbu tulang horizontal ke kanan, pivot X 0%, dan panjang awal 12% lebar frame; sesuaikan dengan gambar asli.
3. Tulang bawah harus berinduk pada tulang atas. Atur posisi anak untuk menempatkan sendi siku/lutut, serta pivot kedua gambar agar sambungannya cocok.
4. Atur **Ujung lokal X/Y** sebagai offset dari pivot tulang bawah menuju ujung tangan/kaki, dalam persen dimensi frame lokal. Aset tidak diregangkan oleh solver.
5. Ubah target X/Y, arah tekuk dan pengaruh IK. Target berada dalam koordinat scene sebelum kamera. Posisi target 50%,50% berarti tengah scene.
6. Pilih waktu lokal, ubah mode ke **Keyframe di playhead**, lalu ubah target atau tekan **Simpan target IK**. Target berinterpolasi dengan interpolasi halus; track juga dapat diedit oleh Codex/MCP melalui skema yang tersedia.

Solver mendukung sampai delapan rantai dua tulang, parenting, skala/rotasi induk, pengaruh 0–100%, dan target bergerak. Target di luar jangkauan dijepit ke panjang tulang. Ini bukan auto-rig seluruh tubuh atau simulasi otot; kualitas sambungan bergantung pada bagian tubuh, pivot dan panjang yang disetel. Hapus rantai IK untuk kembali ke rotasi FK. Menghapus layer beserta anaknya juga menghapus rantai IK yang merujuk tulang tersebut.

## MCP dan verifikasi

Codex eksternal dapat membaca paket, menyusun atau menyimpan kebutuhan, generate satu aset yang diminta pengguna, memulihkan hasil Flow, meninjau gambar, lalu memvalidasi dan menerapkan mask/IK melalui rencana edit. Tool hanya menerima ID proyek/klip/aset, bukan perintah shell atau tujuan file sembarang.

Pengujian mencakup matematika IK pada frame portrait/landscape, parenting, tekuk, target keyframe, batas jangkauan, mask dan kompatibilitas scene lama. Uji Electron + SQLite nyata memeriksa alpha PNG/WebP, referensi identitas, pembatalan, perubahan narasi saat provider bekerja, dan pemulihan Flow tanpa pengiriman ulang. Render MP4 nyata membuktikan crop, inverse mask, feather parsial, dan pergerakan endpoint IK. Uji UI menggunakan respons provider simulasi. Sesi Codex nyata menerima skema editor baru; gambar eksternal belum dibuat dalam pengujian ini.

Perintah uji:

```text
npm run typecheck
npm run test:cutout
npm run test:cutout-advanced
npm run test:cutout-assets
npm run test:editor-automation
npm run test:mcp
npm run build
```

Kemiripan referensi tetap bergantung pada aset, pose, narasi dan penyutradaraan. Fitur ini tidak menjamin video identik.
