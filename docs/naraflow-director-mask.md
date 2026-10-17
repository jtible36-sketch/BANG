# Produksi otomatis Naraflow mengikuti penyutradaraan referensi

Filmcraft 0.8.0 portable terpasang di `E:\Filmcraft\0.8.0\filmcraft-0.8.0-windows-x64-portable\filmcraft.exe`. ZIP cocok dengan SHA256 resmi. Source untuk audit tersimpan di folder `work/filmcraft`; source main dan binary rilis tidak diasumsikan identik. Katalog CLI dan probe video referensi berhasil dijalankan. REA memeriksa identitas dan resource executable; audit fitur memakai source terbuka serta CLI, bukan klaim dekompilasi seluruh native engine.

Di Naraflow, simpan proyek lalu tutup dan buka ulang aplikasi untuk memuat build terbaru.

1. Selesaikan dan tinjau naskah serta rekaman suara; simpan timing.
2. Pilih preset Cutout · Fakta & Komedi dan buka Produksi → Edit otomatis.
3. Aktifkan generate aset, pilih cakupan dan batas jumlah gambar yang sesuai.
4. Jalankan Generate aset & edit otomatis. Perencana menyusun shot: waktu, rentang narasi, aksi utama, fokus, lokasi, pose awal/akhir, reaksi, kamera, occlusion, kontak dan cue SFX. Kebutuhan aset ditautkan dengan ID item.
5. Naraflow membuat aset terpisah yang belum tersedia, lalu menyusun pose/layer, kamera, keyframe, mask dan IK berdasarkan rencana. PNG/WebP tetap memerlukan tinjauan alpha, identitas serta kontak. Paket lama tanpa rencana shot dapat ditingkatkan melalui pekerjaan teks terpisah tanpa mengganti ID paket atau mengulang aset selesai.
6. Di Cutout, buka Penyutradaraan untuk membaca shot dan kebutuhan klip/aset khusus. Rencana yang belum memiliki timing kata rekaman ditandai sementara. Mengubah kebutuhan manual membuang rencana shot yang tidak lagi sesuai; edit otomatis menyusunnya kembali.
7. Untuk mask bergerak, pilih layer → Masking layer → Keyframe pada playhead. Simpan mask di waktu awal/akhir, ubah posisi, ukuran, titik atau feather. Interpolasi linear/hold. Jenis bentuk, jumlah titik dan invert berubah diskret pada key. Maksimal 512 key per layer. Mask mengikuti koordinat gambar, bukan tracking otomatis.
8. Tinjau VO, pergantian pose, reaksi, occlusion, kontak tangan/kaki, caption dan SFX. Ekspor contoh 5–10 detik lalu perbaiki sebelum final.

Pola referensi: orientasi wide → satu aksi → detail mekanisme/keadaan → reaksi. Banyak tableau menggunakan hold dan pose swap; gerak tangan/permukaan yang lebih kontinu bisa memerlukan klip khusus. Pantulan merupakan komposisi aset yang disiapkan, bukan simulasi optik otomatis. Foto utuh tidak otomatis menjadi rig, layer atau semua pose.

Analisis video: seluruh 3.381 frame didekode dan diukur, 57 lembar kontak berurutan ditinjau. CSV mencakup setiap frame dengan timestamp, perubahan piksel dan anotasi tingkat shot. Peninjauan visual dilakukan pada thumbnail berurutan; pemeriksaan setiap piksel resolusi asli tidak diklaim. Buka laporan HTML untuk inspector per frame, peta aksi dan keterbatasan. Transkrip otomatis perlu koreksi, dan klaim sejarah video belum menjadi fakta terverifikasi.

Pengujian dilakukan dengan database terisolasi. Tidak ada proyek pengguna yang diedit, gambar eksternal yang digenerate, atau video final baru yang dibuat dari referensi ini. Satu panggilan teks Codex aktual memverifikasi skema sutradara; tes gambar memakai respons terkontrol. Kualitas penyutradaraan visual generatif pada proyek nyata tetap perlu ditinjau.
