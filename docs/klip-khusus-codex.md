# Klip khusus dan model Codex — Naraflow

Simpan proyek lalu buka kembali Naraflow untuk memuat build terbaru di E:\BANG.

1. Buka Produksi → Edit otomatis. Pilih model penyutradaraan/edit dan effort dari katalog Codex lokal. Pilihan ini diteruskan ke penyusunan kebutuhan Cutout, penyutradaraan dan komposisi, tanpa mengubah model global atau provider gambar/video. Effort lebih tinggi dapat lebih lama; pilihan divalidasi sebelum mengirim media.
2. Aktifkan **Klip khusus · wajah / aksi kontinu**. Pilih otomatis sesuai narasi, wajah kontinu, atau interaksi/aksi kontinu. Mode wajah/aksi memproses semua klip dalam cakupan sebagai klip khusus; gunakan cakupan Klip terpilih untuk satu beat saja.
3. Sumber **Gunakan video klip yang tersedia** memakai video yang telah diimpor melalui storyboard. **Generate Flow MCP** membuat satu shot 4 detik, 720p dari gambar awal klip. Siapkan gambar awal yang sesuai identitas, framing dan konteks. Naraflow memakai koneksi Flow yang sudah dikonfigurasi.
4. Atur maksimum video baru dan kredit per video. Batas kredit global Pengaturan tetap berlaku jika lebih rendah. Setiap shot satu varian, tanpa retry generate otomatis. Pada mode otomatis, aksi sederhana tetap masuk jalur Cutout bila generate aset diaktifkan.
5. Jalankan produksi. Codex merencanakan satu aksi utama, pose awal/akhir, ekspresi, framing dan kontinuitas dari narasi. Hasil video disimpan sebagai aset terpisah sebelum komposisi diterapkan; hasil yang selesai dipakai ulang saat proses yang sama dilanjutkan. Sumber gambar/video asli dan narasi tidak diganti oleh pemasangan komposisi.
6. Tinjau hasil. Panel Cutout menampilkan **Klip khusus · aksi kontinu** untuk video tersebut: atur awal sumber dan kecepatan, pasangkan seluruh sumber ke durasi narasi, atau kembali ke layer Cutout. Edit melalui MCP memakai cutout.specialVideo {assetId,startMs,speed,action} dengan revisi proyek terbaru; sumber wajib aset video milik proyek dan cukup panjang.

Video khusus memenuhi satu frame/shot, bukan video transparan yang dapat dirig sebagai beberapa layer. Trim/kecepatan berlaku sama pada preview dan ekspor; kecepatan 0,25–4× dan durasi narasi dipertahankan. Shot Flow 4 detik sesuai narasi 1–16 detik pada rentang ini; pisahkan narasi yang lebih panjang. Audio sumber dibisukan; narasi, musik, caption/label dan SFX tetap track terpisah. Saat transisi, frame terakhir narasi ditahan.

Jika pengiriman Flow tidak pasti, gunakan **Pulihkan hasil Flow** pada storyboard sebelum menjalankan ulang. Pemulihan mengadopsi pekerjaan yang sama; tidak mengirim generate kedua. Pembatalan/perubahan manual mencegah penerapan komposisi terlambat. Undo mengembalikan komposisi, sementara video/gambar hasil produksi tetap tersedia.

Perubahan wajah generatif bergantung pada model video, gambar awal dan arah aksi; identitas, kontak objek dan kualitas gerak perlu ditinjau. Tidak ada auto-rig dari foto utuh, sinkron bibir terhadap narasi, atau jaminan video identik referensi. Aksi yang tidak sesuai hasil generator dapat memakai footage khusus yang diimpor.

## Verifikasi

Pengujian memakai Electron, SQLite, antrean dan ekspor FFmpeg nyata pada data terisolasi. Respons pembuatan media disimulasikan, tanpa kredit Flow; belum ada penilaian kualitas wajah hasil generasi Flow nyata. Katalog Codex dibaca dari runtime lokal, tanpa inferensi media.

- 15 pemeriksaan klip khusus, termasuk budget, recovery tanpa submit ulang, pembatalan, edit bersamaan, duplikasi, undo, model/effort sampai planner dan komposisi, ekspor dengan rate/trim serta audio sumber senyap.
- 7 pemeriksaan katalog/model/effort, termasuk effort eksplisit, pasangan tidak didukung dan katalog lokal aktual.
- Regresi: 14 produksi Cutout, 21 editor, 10 mask/IK dan 15 aset; transport/katalog MCP 14 tool; typecheck dan build berhasil.
- UI terisolasi: pilihan model/effort diteruskan ke job, model lain mereset effort, kontrol terkunci saat job berjalan; trim 1 detik dan rate 0,25× tampil pada elemen video dengan audio muted. Pola merah/biru adalah fixture pengujian, bukan hasil generasi wajah.

Dokumentasi protokol Codex: https://learn.chatgpt.com/docs/app-server
