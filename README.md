# Naraflow

Naraflow adalah aplikasi desktop untuk mengubah ide cerita menjadi video: menyusun naskah, menjaga identitas karakter, membuat atau mengimpor visual, menghasilkan narasi, mengatur adegan pada timeline, lalu mengekspor hasilnya.

Aplikasi ini menggunakan Electron, React, TypeScript, SQLite, dan FFmpeg. Generasi AI memakai akun atau layanan yang dikonfigurasi pengguna; pengeditan dan rendering video dilakukan secara lokal.

**Versi aplikasi:** `0.1.0` · **Platform distribusi saat ini:** Windows x64 · **Dokumentasi diperbarui:** 17 Oktober 2026.

## Mulai menggunakan

### Membuka aplikasi dari folder proyek

Pada instalasi lokal ini, folder aplikasi berada di `E:\BANG`.

1. Pastikan Node.js dan npm tersedia jika menjalankan aplikasi dari source.
2. Klik dua kali **`START - WIN.bat`**.
3. Buka **Pengaturan**, lalu hubungkan layanan yang ingin dipakai.
4. Buat proyek dan ikuti tahap **Brief → Naskah → Visual → Produksi**.

Launcher menyiapkan dependensi bila diperlukan dan membangun aplikasi jika output build belum ada. Persiapan pertama membutuhkan internet. Jika source diperbarui tetapi build lama masih ada, jalankan `npm run build` sebelum membuka ulang aplikasi.

Folder `node_modules` merupakan dependensi yang dapat dipasang ulang. Launcher Windows dapat mengganti folder tersebut saat menyiapkan dependensi Windows; jangan menyimpan aset proyek di dalamnya.

### Menjalankan untuk pengembangan

Jalankan dari root aplikasi:

```powershell
cd E:\BANG
npm ci
npm run dev
```

Gunakan Node.js yang sesuai dengan kebutuhan dependensi pada `package-lock.json`. Dependensi native, terutama `better-sqlite3`, harus cocok dengan runtime Electron yang digunakan.

Untuk memeriksa dan membangun aplikasi:

```powershell
npm run typecheck
npm run build
npm run preview
```

Untuk membuat installer Windows x64:

```powershell
npm run dist
```

Installer dihasilkan di `dist/` dengan pola nama `Naraflow-Setup-<versi>.exe`. Aplikasi hasil installer membawa runtime Electron dan sumber daya yang dikemas; pengguna aplikasi hasil installer tidak perlu menjalankan npm.

## Alur produksi

| Tahap | Yang dikerjakan |
| --- | --- |
| **Brief** | Tentukan ide, tujuan, bahasa, durasi, format, niche, dan preset gaya. |
| **Naskah** | Susun dan tinjau cerita, narasi, pemeran, serta fakta yang dipakai. |
| **Visual** | Siapkan identitas karakter, prompt adegan, gambar, atau klip sesuai cerita. |
| **Produksi** | Selesaikan suara, sinkronkan timing, atur Cutout, kamera, caption, overlay, musik, dan SFX. |
| **Ekspor** | Periksa sampel pendek, perbaiki hasil, lalu ekspor MP4 dan SRT jika diperlukan. |

Narasi aktual menjadi acuan durasi ketika **Auto-Sync Images to Voiceover** aktif. Rekaman lama yang tidak cocok dengan naskah terbaru tidak boleh dianggap sebagai timing suara yang sudah valid.

Perubahan naskah, identitas, atau durasi dapat membuat rencana aset dan penyutradaraan lama tidak berlaku. Selesaikan naskah dan suara sebelum memproduksi banyak aset atau menyusun kontak yang presisi.

## Fitur utama

- **Naskah dan pemeran:** penyusunan cerita, deskripsi karakter, identitas visual, dan arahan tiap adegan.
- **Preset gaya:** antara lain Cutout · Fakta & Komedi, Huashu Art Motion, VOX, Stickman, Map Animation, dan keluarga explainer kesehatan. Pilih preset sesuai jenis cerita; kemampuan dan alurnya dapat berbeda.
- **Visual:** pembuatan gambar atau video melalui layanan yang tersambung, serta penggunaan media yang diimpor.
- **Suara:** narasi melalui Gemini TTS atau ElevenLabs, pemilihan suara, serta timing kata untuk sinkronisasi.
- **Editor timeline:** urutan klip, durasi, gerak kamera, transisi, caption, overlay teks/gambar, musik, dan beberapa cue SFX.
- **Cutout:** layer terpisah, keyframe objek, pergantian pose, kedalaman/parallax, parenting, pivot, mask, dan IK dua tulang.
- **Edit otomatis dengan Codex:** perencanaan, produksi aset yang diperlukan, penyusunan komposisi, dan penerapan edit yang diperiksa terhadap revisi proyek.
- **MCP Naraflow:** akses terstruktur ke proyek tersimpan, aset, pekerjaan, validasi, edit, dan ekspor.
- **Ekspor lokal:** MP4, caption yang dapat dibakar ke video, SRT, dan rentang In/Out untuk pemeriksaan pendek. Tersedia pula jalur paket finishing CapCut.

## Menghubungkan layanan

Atur koneksi pada **Pengaturan**. Tidak semua layanan wajib dipasang sekaligus.

| Kebutuhan | Jalur yang tersedia |
| --- | --- |
| Penyusunan cerita | Codex atau API penyusun cerita yang didukung: Gemini, OpenRouter, Groq, dan endpoint custom. |
| Perencanaan visual dan edit otomatis | Codex dengan koneksi penyusun visual aktif. |
| Gambar | Codex, Flow MCP, atau jalur visual lain yang tersedia pada workflow terpilih. |
| Video | Flow MCP, Higgsfield, atau media impor sesuai workflow. |
| Narasi | Gemini TTS atau ElevenLabs. |

Ketersediaan model mengikuti akun, runtime, dan layanan yang terhubung. Pilihan **model dan effort Codex** pada panel Edit otomatis berlaku untuk perencanaan serta komposisi proses tersebut; pilihan itu tidak otomatis mengganti provider gambar atau video.

Workflow Flow MCP memerlukan runtime Flow yang siap, sesi akun yang sudah masuk, dan proyek Flow yang dapat diakses. Gunakan status koneksi dalam aplikasi untuk memeriksanya.

Generasi dapat memakai kuota atau kredit layanan. Batas jumlah aset dan kredit dalam aplikasi merupakan batas maksimum, bukan jumlah yang harus dihabiskan. Proyek lokal tetap membutuhkan koneksi layanan saat menjalankan generasi AI.

## Cutout · Fakta & Komedi

Preset ini ditujukan untuk explainer kolase fotografis: lokasi realistis, karakter dan properti yang jelas, aksi mengikuti narasi, lalu reaksi atau ironi yang relevan.

Preset bawaan baru menggunakan **v4**. Protokol narasi juga diterapkan saat preset bawaan lama dijalankan, tanpa menimpa master kustom. Bagian naskah mengikuti pikiran yang utuh; shot visual dan pergantian pose direncanakan kemudian mengikuti timing suara. Bagian naskah tidak harus menjadi satu kalimat tujuh kata atau satu shot berdurasi tetap.

### Produksi yang disarankan

1. Selesaikan dan tinjau naskah beserta narasi.
2. Sinkronkan durasi visual terhadap rekaman aktual.
3. Di **Cutout**, susun kebutuhan dari narasi: background tanpa tokoh, pose karakter, properti, foreground, dan bagian tubuh bila memang memakai rig.
4. Generate PNG atau WebP per item, atau jalankan antrean produksi dengan batas yang sesuai.
5. Periksa alpha, identitas, pose, skala, perspektif, dan bagian objek yang seharusnya dipisah.
6. Tambahkan layer/pose, lalu atur keyframe, mask, dan kontak IK sesuai kebutuhan.
7. Jalankan **Edit otomatis** pada cakupan yang benar.
8. Tinjau reaksi, caption, label, musik, dan SFX bersama suara.
9. Ekspor sampel 5–10 detik sebelum membuat hasil final.

Caption referensi menggunakan teks putih, sorotan hijau pada kata aktif, outline gelap, dan ukuran ringkas dekat bawah. Nama/fakta dapat memakai label putih dengan teks hitam; tahun dapat memakai kuning bertepi kontras. Teks penting dibuat di editor agar tetap terkontrol.

### Gerak dan komposisi

Utamakan satu aksi utama per shot. Objek boleh masuk/keluar, bergeser, sedikit berputar atau membesar. Pergantian pose mengikuti perubahan kata kerja atau emosi. Gunakan framing lebar untuk orientasi dan push-in singkat untuk reaksi; semua layer tidak perlu bergerak serempak.

Mask tersedia sebagai persegi, elips, atau poligon, dengan inverse dan feather. Mask dapat mempunyai keyframe tersendiri untuk reveal atau occlusion. IK dua tulang memerlukan bagian anggota tubuh yang telah dipisah, pivot/panjang yang disetel, serta target kontak yang sesuai. Target dapat mengikuti layer properti bergerak.

| Batas produksi | Kapasitas saat ini |
| --- | --- |
| Layer | Maksimum 64 per komposisi. |
| Keyframe atau pose | Maksimum 8.192 entri pada masing-masing track yang mendukungnya. |
| Gambar unik | Maksimum 256 per klip Cutout. |
| Rantai IK | Maksimum 16 per komposisi. |
| Aset baru otomatis | Batas proses dapat diatur hingga 2.048 gambar. |
| Grid gerak | 30 atau 60 fps; dapat memakai keyframe utama atau sampling setiap frame. |

Keyframe setiap frame menyampel gerak yang direncanakan. Pengaturan ini tidak otomatis menghasilkan PNG baru pada setiap frame dan tidak menjamin kontak visual menjadi benar.

## Edit otomatis dan pemulihan proses

Panel **Produksi → Edit otomatis** menyediakan dua cakupan:

- **Seluruh proyek:** memproses klip dalam proyek dan dapat mengatur caption, label, SFX, serta volume musik. Ini merupakan pilihan awal untuk preset Cutout · Fakta & Komedi.
- **Klip terpilih:** mengatur komposisi klip tersebut; klip lain dan pengaturan editor global tidak ikut diperbaiki.

Aktifkan **Generate aset yang dibutuhkan dan susun Cutout** jika proses juga perlu membuat aset. Matikan opsi itu untuk bekerja dengan aset yang sudah tersedia. Tentukan provider, format, model/effort penyutradaraan, dan batas produksi sebelum menjalankan.

Arahan **v4** memakai hook visual dalam 3 detik pertama, shot sekitar 2–4 detik mengikuti kata rekaman, hard cut, komposisi fotografis hangat, pose kontekstual, maksimal dua layer bergerak, dan kamera tanpa shake. Semua teks penting tetap dibuat di editor. Panel Edit otomatis menampilkan arahan lengkap.

Pemeriksaan otomatis menolak komposisi foto tunggal, mendeteksi gerak efektif layer serta pegas pada rig, dan menerapkan hard cut serta caption karaoke putih-hijau. Aset atau klip khusus yang kurang dilaporkan. Penilaian era, pose, kontak, amplitudo reaksi, dan kesesuaian narasi masih memerlukan tinjauan visual; bukan semua aturan artistik dapat dibuktikan dari keyframe. Klip khusus memenuhi frame sebagai pengecualian untuk aksi kontinu.

Produksi Cutout pada preset referensi mengambil sampel frame hasil renderer untuk tinjauan visual. Kesalahan tata letak dapat mendapat satu percobaan koreksi. Bila aset atau pose belum mendukung aksi, hasil tidak otomatis dianggap benar hanya karena alpha dan keyframe valid. Sampel frame tetap bukan pemeriksaan seluruh frame atau jaminan kemiripan referensi.

Jika proses gagal atau dibatalkan:

1. Gambar yang selesai tetap disimpan di Cutout.
2. Simpan perubahan proyek, lalu gunakan **Lanjutkan proses terakhir** bila tersedia.
3. Paket aset yang masih valid dan checkpoint komposisi yang cocok dipakai kembali; kebutuhan yang belum selesai diproses.
4. Jika naskah, identitas, timing, atau isi kebutuhan berubah, tinjau kembali paket sebelum melanjutkan.
5. Bila pengiriman Flow belum pasti, gunakan pemulihan hasil terlebih dahulu agar pekerjaan yang sama tidak dikirim dua kali.

Komposisi dalam cakupan diterapkan setelah tahap yang diperlukan selesai dan revisi masih sesuai. Edit manual atau perubahan yang belum tersimpan tidak boleh ditimpa hasil otomatis lama. **Batalkan edit otomatis terakhir** tersedia selama belum ada perubahan lanjutan yang membuat backup tersebut tidak cocok; aset hasil generasi tetap disimpan.

## Klip khusus untuk aksi kontinu

Gunakan **Klip khusus · wajah / aksi kontinu** untuk aksi yang tidak memadai jika hanya menggunakan transform PNG, misalnya ekspresi kontinu atau interaksi tangan yang rumit.

Sumber dapat berupa video yang tersedia atau generasi Flow MCP dari gambar awal. Jalur Flow khusus saat ini membuat shot 4 detik pada 720p. Klip khusus memenuhi frame dan dapat diatur awal sumber serta kecepatannya pada rentang 0,25–4×.

Audio pada sumber video visual dibisukan dalam jalur ekspor yang digunakan. Narasi, musik, dan SFX disiapkan sebagai track audio tersendiri.

## MCP Naraflow

Naraflow menyediakan relay MCP berbasis **stdio**. Relay berkomunikasi dengan bridge lokal aplikasi; Naraflow harus tetap terbuka untuk operasi proyek. Setelah pembaruan, muat ulang koneksi MCP agar katalog tool dan schema terbaru terbaca.

Contoh konfigurasi client MCP untuk source lokal ini:

```json
{
  "mcpServers": {
    "naraflow": {
      "command": "node",
      "args": [
        "E:/BANG/resources/naraflow-mcp/server.cjs",
        "--connection",
        "C:/Users/NAMA_PENGGUNA/AppData/Roaming/Bang Story/naraflow-mcp.json"
      ]
    }
  }
}
```

Ganti `NAMA_PENGGUNA` dan lokasi aplikasi sesuai instalasi. Untuk aplikasi hasil installer, relay berada di resources instalasi, bukan selalu `E:/BANG`. Format pembungkus konfigurasi dapat berbeda antarclient; gunakan `command` dan `args` yang sama sesuai format client.

Bridge membuat descriptor koneksi lokal saat aplikasi berjalan. Client tidak perlu menyalin token dari descriptor ke README atau prompt.

| Kelompok | Tool |
| --- | --- |
| Status dan proyek | `naraflow_status`, `naraflow_list_projects`, `naraflow_get_project` |
| Pemeriksaan aset | `naraflow_preview_asset`, `naraflow_get_asset_plan` |
| Rencana dan generasi aset | `naraflow_plan_cutout_assets`, `naraflow_save_asset_plan`, `naraflow_generate_cutout_asset`, `naraflow_recover_cutout_assets` |
| Edit | `naraflow_validate_edit`, `naraflow_apply_edit`, `naraflow_undo_edit` |
| Narasi dan revisi | `naraflow_create_script_revision`, `naraflow_generate_narration`, `naraflow_retime_narration` |
| Pekerjaan dan ekspor | `naraflow_get_job`, `naraflow_export_project` |

Alur edit MCP: baca proyek → tinjau aset → susun rencana → validasi → terapkan dengan `expectedRevision` yang tepat. Aset harus berasal dari proyek yang sesuai. Pembuatan media dan ekspor dilakukan hanya ketika diminta pengguna.

Revisi naskah Cutout melalui MCP dibuat sebagai proyek terpisah agar sumber tetap tersimpan. Rekaman lama tidak dipasang pada kata-kata baru. Pengaturan tempo lokal memakai audio yang tersedia, menjaga pitch, serta menyesuaikan timing kata dan durasi; jalankan sebelum menyusun timing Cutout, label, atau SFX.

## Penyimpanan data

Pada Windows, data pengguna disimpan di:

```text
%APPDATA%\Bang Story\
├── studio.db
├── projects\
│   └── <project-id>\
└── naraflow-mcp.json
```

Nama folder `Bang Story` dipertahankan untuk kompatibilitas data lama meskipun nama aplikasi sekarang Naraflow. Aplikasi juga mempunyai jalur migrasi dari folder `Studio Cerita` lama.

Untuk backup, tutup aplikasi secara normal lalu salin seluruh folder data pengguna, termasuk berkas pendamping database yang masih ada dan folder aset. Aset proyek tidak disimpan di dalam `node_modules` atau folder build.

Koneksi layanan memakai penyimpanan lokal aplikasi. API key menggunakan fasilitas `safeStorage` Electron saat tersedia; jangan mengasumsikan semua lingkungan memiliki enkripsi yang sama. Setelah memindahkan data ke akun/komputer lain, koneksi dapat memerlukan autentikasi ulang.

## Batas kemampuan

- Foto utuh tidak otomatis menjadi layer transparan, pose bank, rig, atau mesh yang dapat ditekuk.
- Banyak keyframe tidak menggantikan aset yang benar, akting, atau penyutradaraan.
- Mask belum melakukan rotoscoping otomatis; IK bukan auto-rig tubuh dari satu foto.
- Video khusus merupakan klip satu frame penuh; bukan sekumpulan video transparan per layer.
- Tidak tersedia jaminan lip sync otomatis, kloning suara referensi, atau hasil identik dengan video contoh.
- Generasi AI tetap memerlukan pemeriksaan identitas, anatomi, perspektif, alpha, kontinuitas, serta kontak objek.
- Ilustrasi sejarah atau medis merupakan rekonstruksi. Fakta dan diagram perlu diperiksa sebelum publikasi.
- Render dan pengeditan lokal tidak berarti semua proses generasi berjalan offline.

## Struktur source

```text
src/
├── main/          # Database, proyek, job, provider, MCP, dan exporter
├── preload/       # API terkontrol antara Electron dan UI
├── renderer/      # Antarmuka React dan editor timeline
└── shared/        # Tipe, schema, preset, dan evaluator animasi bersama
resources/        # Font, branding, runtime, pustaka aset, dan relay MCP
scripts/          # Build MCP dan runner pengujian
tests/            # Pengujian editor, produksi, audio, dan rendering
docs/             # Panduan fitur lebih rinci
```

## Pengujian

Perintah utama tersedia pada `package.json`:

```powershell
npm run typecheck
npm run build
npm run test:cutout
npm run test:cutout-advanced
npm run test:cutout-assets
npm run test:cutout-production
npm run test:editor-automation
npm run test:sfx
npm run test:mcp
```

Runner tambahan mencakup resume proses, klip khusus, ekspor rentang, kesesuaian produksi referensi, dan tempo narasi. Beberapa runner memerlukan argumen folder output; lihat script terkait sebelum menjalankannya.

Pengujian integrasi memakai data terisolasi. Respons provider generatif pada fixture dapat bersifat terkontrol; kelulusan pengujian alur tidak membuktikan kualitas gambar, suara, atau video yang dihasilkan layanan. Untuk menilai produksi, tetap tinjau hasil nyata dan render sampel pendek dengan suara.

## Pemecahan masalah

| Gejala | Langkah pemeriksaan |
| --- | --- |
| Codex belum terhubung | Periksa sesi akun lokal dan koneksi penyusun visual/gambar pada Pengaturan. Muat ulang katalog model bila perlu. |
| Kredit atau kuota habis | Hentikan pengiriman ulang. Aset selesai tetap disimpan; lanjutkan kebutuhan yang belum selesai setelah layanan siap. |
| Editor belum tersimpan atau belum merespons | Buka editor proyek, simpan, tunggu status tersimpan, lalu coba kembali. Jangan menimpa database secara langsung. |
| Revisi proyek berubah | Baca revisi terbaru dan susun ulang edit yang sesuai. Hasil lama tidak diterapkan pada revisi berbeda. |
| Timing suara belum sinkron | Pastikan narasi cocok dengan rekaman aktif, sinkronkan visual ke suara, lalu simpan proyek. |
| Aset transparan gagal | Periksa alpha nyata, kontur, atau latar magenta yang diminta jalur generasi; gambar dengan kotak-kotak yang dibakar bukan PNG transparan. |
| Komposisi belum lolos tinjauan visual | Tinjau frame dan kebutuhan yang disebutkan. Perbaiki aset/pose atau tata letak; menambah keyframe saja tidak selalu menyelesaikan masalah. |
| Hasil hanya berubah pada satu klip | Periksa cakupan Edit otomatis. Gunakan Seluruh proyek untuk memproses klip lain dan pengaturan global. |
| Hasil masih terasa seperti slideshow | Periksa apakah aset masih berupa foto utuh dan apakah perubahan aksi benar-benar mempunyai pose atau klip khusus. |
| Source berubah tetapi tampilan masih lama | Tutup aplikasi, jalankan `npm run build`, kemudian buka kembali. |

## Dokumentasi lanjutan

- [Edit otomatis, MCP, dan SFX](docs/naraflow-edit-otomatis.md)
- [Aset Cutout, masking, dan IK](docs/naraflow-cutout-assets.md)
- [Produksi Cutout otomatis](docs/naraflow-cutout-production.md)
- [Penyutradaraan dan mask](docs/naraflow-director-mask.md)
- [Klip khusus dan pilihan model Codex](docs/klip-khusus-codex.md)
- [Peningkatan produksi berdasarkan referensi](docs/reference-production-upgrade.md)

Sebagian panduan lama mencatat versi implementasi atau hasil uji pada saat dibuat. Untuk ketersediaan operasi, gunakan katalog tool, UI, dan source pada build yang sedang dijalankan.

## Komponen pihak ketiga

Konfigurasi paket menandai aplikasi sebagai `private`. README ini tidak menetapkan lisensi baru untuk keseluruhan Naraflow. Periksa lisensi masing-masing dependensi sebelum mendistribusikan build.

Adaptasi komponen motion dari Filmcraft menyertakan [pemberitahuan lisensi MIT](docs/licenses/filmcraft-MIT.txt). Resource lisensi dan FFmpeg yang relevan disertakan melalui konfigurasi packaging.
