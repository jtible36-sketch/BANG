# Naraflow: edit otomatis, MCP, dan SFX

Implementasi lokal di `E:\BANG`, 16 Oktober 2026. Melanjutkan sistem Cutout · Fakta & Komedi dan analisis kolase fotografis pengguna.

## Memakai tombol Codex

1. Buka ulang Naraflow melalui `START - WIN.bat`.
2. Buka proyek, masuk langkah **Editor**, lalu panel **Edit otomatis** di bilah kiri. Pada layar pendek, gulir bilah alat.
3. Pilih **Klip terpilih** untuk komposisi, keyframe, pose, kamera, transisi, atau timing klip. Pilih **Seluruh proyek** untuk menyertakan caption, label, volume musik, dan SFX.
4. Tulis arahan lalu klik **Edit otomatis dengan Codex**. Panel menyimpan perubahan terlebih dahulu, membaca aset dan rekaman narasi, meminta rencana terstruktur dari Codex, memeriksa rencana, lalu menerapkannya.
5. Putar pratinjau dan sesuaikan hasil. **Batalkan** menghentikan pekerjaan berjalan. **Batalkan edit otomatis terakhir** mengembalikan satu hasil otomatis terakhir selama belum ada perubahan lanjutan.

Koneksi menggunakan akun ChatGPT yang sudah masuk di Codex lokal dan pilihan model penyusun visual Naraflow. Jika panel menyatakan belum terhubung, aktifkan koneksi Codex **penyusun visual** di Pengaturan. Tombol ini tidak memerlukan API key baru.

Contoh arahan:

> Pertahankan narasi dan durasi rekaman. Tokoh masuk dari kiri, ganti ke pose terkejut ketika kata kunci diucapkan, lalu kamera mendekat singkat. Gerakkan background lebih lambat daripada foreground. Gunakan SFX pop yang sudah diimpor tepat pada pergantian pose. Caption putih di bawah dengan sorotan hijau. Sebutkan aset yang masih kurang.

## Layer dan suara

Panel Cutout sebelumnya tetap menyediakan keyframe setiap objek, jadwal ganti gambar pose, rig induk-anak dengan pivot, dan parallax berdasarkan kedalaman. Transform dan pose menggunakan waktu lokal klip dalam milidetik. Rig merupakan forward kinematics, bukan pemisahan gambar atau rig tulang otomatis.

Panel **SFX** menambah audio impor pada playhead. Setiap cue memiliki waktu mulai proyek, potongan awal sumber, durasi, volume, fade masuk dan keluar. Beberapa cue dapat berbunyi bersamaan dan tampil pada baris terpisah. Waktu SFX menggunakan posisi absolut proyek. Audio berhenti pada akhir sumber atau proyek, tanpa loop. Hasil ikut ke MP4; paket CapCut menyertakan audio olahan, sumber asli, dan metadata timing.

Panel **Cutout → Generate aset terpisah** kini dapat menyusun kebutuhan dari narasi dan membuat PNG/WebP melalui Codex atau Flow MCP. Background tanpa tokoh, pose, properti, foreground, dan bagian tubuh dibuat satu per satu. Codex dapat memakai dan mengatur aset yang tersedia; foto utuh tidak otomatis menjadi beberapa layer transparan. Masking persegi/elips/poligon dengan invert/feather serta IK dua tulang dengan target keyframe tersedia dalam panel Cutout dan ekspor. Baca [panduan aset, masking, dan IK](naraflow-cutout-assets.md). Kualitas kemiripan referensi bergantung pada aset, pose, narasi dan penyutradaraan; fitur ini tidak menjamin video identik.

## MCP untuk Codex

MCP bernama **naraflow** telah didaftarkan pada konfigurasi Codex pengguna. Naraflow harus terbuka untuk membaca atau mengubah proyek. Katalog tool tetap dapat ditemukan ketika aplikasi tertutup; relay membaca koneksi baru setelah Naraflow dibuka kembali.

Tool editor:

- `naraflow_status`: status aplikasi dan koneksi editor.
- `naraflow_list_projects`: daftar proyek.
- `naraflow_get_project`: revisi, adegan, timing, inventaris aset dan skema edit.
- `naraflow_preview_asset`: pratinjau gambar milik proyek.
- `naraflow_validate_edit`: periksa rencana tanpa menerapkan.
- `naraflow_apply_edit`: terapkan rencana pada revisi yang dibaca.
- `naraflow_undo_edit`: urungkan hasil otomatis terakhir.
- `naraflow_get_job`: status pekerjaan.
- `naraflow_export_project`: ekspor MP4 lokal ke nama file baru ketika pengguna meminta ekspor.

Tool tambahan untuk aset: `naraflow_get_asset_plan`, `naraflow_plan_cutout_assets`, `naraflow_save_asset_plan`, `naraflow_generate_cutout_asset`, dan `naraflow_recover_cutout_assets`. Muat ulang koneksi MCP setelah pembaruan aplikasi agar katalog dan skema mask/IK terbaru terbaca.

Contoh permintaan di Codex:

> Gunakan MCP Naraflow, baca proyek saya yang berjudul [judul], lihat gambar layer dan pose, lalu atur reaksi komedi sesuai narasi pada adegan kedua. Validasi dan terapkan perubahan. Pertahankan cerita dan identitas tokoh.

Koneksi STDIO menggunakan `resources/naraflow-mcp/server.cjs`. Aplikasi menjalankan bridge pada loopback dengan port dan token acak. Descriptor disimpan di `%APPDATA%\Bang Story\naraflow-mcp.json`; token tidak perlu disalin ke chat. Tool tidak membuka akses shell atau penulisan file sembarang.

## Perlindungan perubahan dan batas pengujian

Edit otomatis ditolak saat editor belum tersimpan, revisi berubah, timing narasi belum sinkron, aset berasal dari proyek lain, atau rig/timing tidak valid. Jika pengguna mengedit saat Codex bekerja, hasil lama tidak menimpa edit baru. Narasi, identitas dan tautan media tidak termasuk field yang dapat diubah rencana otomatis. Proses menerapkan edit secara atomik dan menyimpan satu checkpoint undo.

Pengujian menggunakan database terpisah: typecheck dan build, interpolasi Cutout, SQLite/revisi/undo/cancel, protokol MCP termasuk discovery offline dan reconnect, kontrol UI, preview WAV nyata, waveform FFmpeg, ekspor Electron Cutout+SFX ke MP4, dan paket CapCut. Respons nyata Codex melalui akun lokal berhasil menghasilkan rencana JSON tervalidasi. Startup build final berhasil memuat preload IPC, status Codex dan bridge MCP. Uji ini memverifikasi alur teknis, bukan kualitas artistik untuk semua topik.

Perintah pengembang:

```text
npm run typecheck
npm run test:cutout
npm run test:editor-automation
npm run test:mcp
npm run test:sfx
npm run build
```

Build memperbarui katalog `resources/naraflow-mcp/tools.json` dari skema bersama. Perubahan source harus di-build sebelum memakai launcher yang membuka folder `out`.
