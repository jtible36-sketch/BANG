# Bang Story

_by Bang Tutorial_

## Riset topik, ide, thumbnail, dan pilihan skill

Buka **Riset topik** dari halaman awal, tulis tema yang ingin diteliti, lalu pilih skill dan kategori. Riset memakai Codex lokal yang sudah login dengan akun ChatGPT, termasuk pencarian web native bila tersedia, tanpa kunci API tambahan. Hasil riset dan pilihan ide tersimpan di komputer. Sumber yang tersedia ditampilkan pada setiap topik; hasil tanpa sumber diberi penanda ide editorial.

**Skor peluang 0–100** adalah perkiraan editorial, bukan prediksi atau jaminan viral. Nilainya dijumlahkan dari rasa penasaran (25), relevansi penonton (25), kekuatan visual (20), sudut baru (15), dan momentum (15). Buka rincian skor untuk melihat alasan dan komponennya. Aplikasi tidak mengarang jumlah penonton, volume pencarian, atau tingkat persaingan.

Pilih topik, pilih salah satu ide, atau **Perbarui ide** untuk meneliti sudut baru. Setiap topik terpilih mempunyai prompt thumbnail yang dapat diedit, tombol generate melalui Codex, pratinjau, dan simpan PNG. Mulai proyek dari ide pilihan untuk membawa sinopsis, sumber, skill, dan thumbnail ke proyek.

Skill tersedia pada halaman awal, langkah Ide, dan Riset topik:

- **Explainer Bang Motion**: kartun kolase, jurnalisme visual, katalog putih, sketsa vintage, aksi kontinu, atau kartun panggung.
- **Animasi Cutout**: kolase fotografis berlapis, kedalaman 2.5D, pose kontekstual, dan reaksi humor.
- **Explainer Animasi Kesehatan**: karakter organ/sel kartun 2D, mekanisme tubuh, dialog dan humor, dengan arahan sumber medis primer.
- **Cerita bebas** untuk tema dan gaya pilihan sendiri.

Pilihan skill memberi arahan pada naskah dan prompt gambar/video. Gambar adegan tetap dibuat di Codex, video di Flow, dan penyusunan timeline di editor Bang Story. Skill ini tidak memasang alat render baru atau koneksi akun Flow.

### Gaya visual sesuai skill

Menu **Gaya visual → Sesuai skill** menampilkan 16 preset baru dengan pratinjau:

| Skill | Gaya visual |
|---|---|
| Explainer Bang Motion | Kartun kolase explainer, Jurnalisme visual sinematik, Katalog putih editorial, Ukiran vintage explainer, Dunia aksi kontinu, Kartun panggung dinamis |
| Animasi Cutout | Cutout fotografis 2.5D, Cutout kertas bertekstur, Cutout editorial pop, Cutout arsip vintage, Cutout sinematik berlapis |
| Explainer Animasi Kesehatan | Organ kartun ekspresif, Dunia sel dan imun, Panggung organ interaktif, Diagram tubuh berkarakter, Komik organ humor |

Memilih gaya menyelaraskan varian skill dan arahan visual pada gambar adegan, lembar karakter, thumbnail, serta prompt video Flow. Pratinjau merupakan ilustrasi gaya; hasil gambar dibuat saat tombol generate dijalankan. Tab **Semua** tetap menyediakan gaya sebelumnya, dan membuka proyek lama mempertahankan gaya yang tersimpan.

Gaya dapat diganti pada hasil **Riset topik** tanpa mengulang riset. Prompt thumbnail bawaan mengikuti gaya baru; prompt yang telah diedit dan gambar sebelumnya tetap tersimpan. Generate ulang thumbnail untuk menerapkan gaya baru. Proyek yang dibuat dari hasil riset memakai gaya yang dipilih pada hasil tersebut.

**Durasi khusus** dapat diisi dalam detik atau menit, dari 1 detik sampai 24 jam. Naskah panjang disusun dalam beberapa bagian. Nilai ini adalah target penulisan; durasi akhir mengikuti suara narasi dan penyesuaian klip di editor.

Aplikasi desktop Windows untuk mengubah ide cerita jadi video YouTube: AI menyusun klip dan naskah, tombol Generate gambar memakai Codex lokal dan video dibuat di Google Flow, Gemini atau ElevenLabs membuat suara narator, lalu semuanya dirangkai di editor timeline dan diekspor jadi MP4. Higgsfield tersedia sebagai alur API opsional.

## Gambar Codex dan video Flow tanpa API Higgsfield

Alur bawaan di **Pengaturan → Gambar dan video** adalah **Codex + Flow**. Gambar bisa dibuat langsung dari Bang Story melalui Codex yang terpasang dan sudah login dengan akun ChatGPT di komputer ini. Video dibuat melalui akun Flow di browser.

1. Susun naskah dan visual adegan seperti biasa. Penyusun cerita dan TTS tetap memakai penyedia yang Anda pilih.
2. Di Storyboard, pilih adegan lalu **Generate gambar Codex**. Hasil otomatis tersimpan dan menjadi gambar aktif di adegan. Prompt mencakup adegan, pemeran, gaya visual, dan rasio; lembar karakter yang sudah ada dilampirkan otomatis sebagai referensi. Generate satu gambar berjalan bergantian, dengan status proses dan tombol batal.
3. Jika ingin generate melalui chat Codex, **Salin prompt Codex** lalu **Impor gambar** hasilnya. PNG, JPEG, dan WebP didukung. File disalin ke penyimpanan proyek; gambar lama tetap tersedia sebagai versi sebelumnya.
4. Kolom **Prompt video untuk Flow** selalu tampil pada adegan terpilih, termasuk ketika masih menggunakan gerak kamera. Edit arah gerak, lalu salin prompt Flow. Prompt salinan mencakup rasio, kesinambungan gambar, dan arahan tanpa narasi/musik.
5. **Simpan gambar** untuk mendapatkan file frame awal, lalu **Buka Flow + salin prompt**. Browser memakai login akun Google/Flow milik Anda. Unggah gambar sebagai frame awal, tempel prompt yang sudah disalin, dan generate di Flow dengan kredit akun tersebut.
6. Unduh video hasil Flow dan **Impor video Flow** ke adegan. Video aktif di pratinjau dan editor. Durasi klip tetap mengikuti narasi; jika video lebih pendek, frame terakhir ditahan sampai klip selesai.

Dialog pemeran juga memiliki tombol **Generate lembar Codex**, salin prompt, impor, dan simpan PNG. Lembar karakter yang aktif otomatis menjadi referensi ketika gambar adegan dibuat melalui tombol Codex.

Alur ini tidak meminta kunci Higgsfield atau kunci OpenAI. Generate gambar memakai kuota akun Codex, bukan kredit Flow. Login ChatGPT dilakukan melalui Codex; Bang Story tidak menyimpan kata sandi atau token akun. Status koneksi dan tombol cek ulang tersedia di Pengaturan dan Storyboard. Jika Codex tidak ditemukan, pasang/buka Codex dan login, lalu cek lagi. Bridge menggunakan protokol lokal Codex app-server; versi Codex harus mendukung image generation.

Kompatibilitas yang diuji saat ini: Codex lokal 0.154.0 dengan model pengarah GPT-5.5 dari katalog akun. Bang Story memilih model ini jika masih tersedia, lalu memakai model default katalog jika tidak. OpenAI menjadwalkan penghentian GPT-5.5 untuk login ChatGPT pada 14 Oktober 2026; perbarui Codex dan gunakan model yang tersedia bila akses berubah. Lihat [model Codex](https://learn.chatgpt.com/docs/models). Model pengarah ini mengirim permintaan ke alat gambar native Codex.

Login akun Flow, unggah, generate, dan unduh tetap dilakukan di browser. Bang Story belum memiliki integrasi publik resmi untuk generate otomatis memakai kredit Flow. Tombol Buka Flow menyiapkan prompt; tombol itu tidak menjalankan generate di situs Flow. Untuk generate langsung lewat API Higgsfield, pilih alur **Higgsfield API** di Pengaturan.

## Cara membuka

Syarat: [Node.js](https://nodejs.org) versi LTS sudah terpasang, dan ada koneksi internet saat pertama kali dibuka.

- **Windows:** klik 2x `START - WIN.bat`.
- **macOS:** klik 2x `START - MAC.command`. Kalau muncul pesan tidak punya izin, buka Terminal di folder ini dan jalankan `chmod +x 'START - MAC.command'` sekali. Kalau macOS memblokirnya, klik kanan file itu › Open.

Saat pertama kali dibuka, START memasang semua kebutuhan (`npm install`) dan mengunduh Electron. Ini butuh beberapa menit. Setelah itu aplikasi langsung terbuka setiap kali START diklik. Kalau folder ini dipindah ke OS lain, START otomatis memasang ulang kebutuhannya.

Setelah membuka, pilih alur gambar/video di **Pengaturan**. Codex + Flow tidak memerlukan kunci API gambar/video. Atur penyusun cerita (misalnya Gemini atau endpoint lokal) serta penyedia suara narator. Kunci Higgsfield hanya diperlukan jika memilih alur Higgsfield API.

Catatan macOS: fitur caption akurat (Whisper lokal) baru tersedia untuk Windows. Fitur lainnya tetap berjalan.

Kalau kode di `src` diubah, hapus folder `out` (atau jalankan `npm run build`) supaya START menyusun ulang aplikasinya.

## Alur

1. **Ide cerita**: tulis sinopsis atau mulai dari hasil Riset topik, pilih skill, durasi custom/preset, bahasa, format (16:9 atau 9:16), suara narator, dan gaya visual. AI penyusun cerita (Gemini, OpenRouter, Groq, atau endpoint custom) lalu menulis naskah dengan arahan skill. Model Higgsfield dipilih ketika memakai alur API opsional tersebut.
2. **Naskah**: baca dulu alurnya: berapa adegan, apa yang terjadi di tiap adegan, dan narasi (VO) masing-masing. Adegan bisa diubah, ditambah, dihapus, dan diurutkan ulang. Narasi boleh memuat tag ekspresi suara seperti `<short pause>`, `<long pause>`, `<chuckles>`, atau `<sigh>`. Setelah itu AI membuat visual dari naskah final: prompt gambar, pemeran, gerak kamera dan kekuatannya, transisi, serta arahan gerak untuk video AI. Kalau naskah diubah lagi, hanya adegan yang berubah yang disusun ulang visualnya.
3. **Storyboard**: setiap adegan punya gambar (generate lewat Codex, impor, atau Higgsfield opsional), suara narasi (TTS), dan gerak: gerak kamera gratis atau video AI (impor hasil Flow atau Higgsfield opsional). Prompt Flow bisa diedit dan disalin dari setiap adegan. Suara narasi dibuat dalam satu rekaman utuh lalu dipotong otomatis per adegan, supaya suara dan intonasinya konsisten. Pratinjau gerak kamera berputar otomatis dan tetap terlihat saat panel digulir.
4. **Editor**: pratinjau langsung dengan gerak kamera, transisi, caption karaoke, musik latar, serta overlay logo, watermark, atau teks yang bisa digeser langsung di pratinjau. Lalu ekspor MP4 dengan FFmpeg.

## Durasi dan suara

Panjang tiap klip mengikuti panjang suara narasinya. Sebelum suara dibuat, naskah baru membagi target durasi ke seluruh adegan dan memakai anggaran kata sesuai waktu tersebut. Naskah serta rencana visual panjang diproses per bagian berisi maksimal 32 adegan; hasil lama baru diganti setelah semua bagian selesai. Video AI meminta durasi terpendek yang menutup panjang klip; kalau model tidak bisa sepanjang itu, frame terakhir ditahan sampai klip selesai.

Narasi utuh dibuat per bagian sampai sekitar 4 menit (Gemini) atau 2.400 karakter (ElevenLabs, dengan konteks teks sebelum dan sesudahnya). Untuk Gemini, antar-adegan disisipi `<long pause>`, lalu jeda itu dideteksi dengan FFmpeg dan dicocokkan ke posisi tiap adegan. Untuk ElevenLabs, batas adegan diambil dari waktu tiap kata yang dikirim API-nya. Potongan-potongannya diputar berurutan persis seperti rekaman utuh.

## Caption akurat (Whisper lokal)

Gemini TTS tidak mengirim waktu per kata. Kalau model **Whisper Small** sudah diunduh (Pengaturan › Caption akurat, 488 MB, disimpan di `%APPDATA%\Bang Story\models\whisper` dan dicek SHA-256-nya), aplikasi menjalankan `whisper-cli` (whisper.cpp, ikut terpasang di `resources/whisper`) di komputer ini untuk mencari kapan tiap kata diucapkan. Kata-kata naskah lalu dicocokkan ke hasil dengar Whisper, jadi ejaan caption tetap mengikuti naskah sedangkan waktunya mengikuti suara asli. Ini berjalan otomatis setelah narasi Gemini dibuat, dan titik potong antar-adegan ikut memakai posisi kata. Klip lama bisa disinkronkan dari tab Caption di Editor. Unduhan bisa dibatalkan dan dilanjutkan; di mode dev, `STUDIO_WHISPER_URL` bisa mengarahkannya ke salinan lokal.

Proyek tersimpan otomatis (juga lewat tombol Simpan atau Ctrl+S) di SQLite, di folder `%APPDATA%\Bang Story`. Data dari nama lama (`%APPDATA%\Studio Cerita`) dipindahkan otomatis saat aplikasi pertama kali dibuka.

## Kunci API

Pengguna memasukkan kuncinya sendiri di **Pengaturan › Layanan AI dan kunci**. Setiap bagian (penyusun cerita, suara narator) punya satu dropdown penyedia, dan hanya konfigurasi penyedia yang dipilih yang tampil dan dipakai. Kunci dienkripsi dengan Windows DPAPI (`safeStorage`).

| Layanan | Dipakai untuk | Wajib |
|---|---|---|
| Higgsfield (satu API key dari tombol **Copy API key** di console, format `KEY_ID:KEY_SECRET`) | Gambar, lembar karakter, video AI langsung dari aplikasi | Hanya untuk alur Higgsfield API |
| Codex + Google Flow | Tombol generate gambar melalui Codex lokal; video melalui Flow di browser | Login ChatGPT di Codex; akun Flow; tidak perlu kunci API gambar/video |
| Penyusun cerita, pilih satu: Google Gemini, OpenRouter, Groq, atau endpoint custom (OpenAI-compatible) | Menyusun klip, naskah, dan pemeran | Ya, salah satu |
| Google Gemini | Suara narator Gemini TTS | Kalau memakai Gemini TTS |
| ElevenLabs | TTS dengan waktu kata presisi | Opsional |

Setelah kunci penyusun cerita disimpan, daftar modelnya diambil langsung dari penyedia (ratusan model untuk OpenRouter) dan dipilih lewat dropdown yang bisa dicari. Daftar disimpan di cache 24 jam dan bisa dimuat ulang kapan saja. Endpoint custom menerima server apa pun yang kompatibel dengan OpenAI API, misalnya Ollama (`http://localhost:11434/v1`), LM Studio, vLLM, DeepSeek, atau xAI Grok (`https://api.x.ai/v1`).

## Model Higgsfield

Semua model Higgsfield yang bisa membuat gambar dari teks (14 model) dan menganimasikan gambar klip (34 model) tersedia. Modelnya dipilih per proyek di bagian **Model AI** pada langkah Ide cerita, lengkap dengan pencarian, filter, dan perkiraan kredit dari endpoint `estimate`. Pilihan terakhir jadi bawaan proyek berikutnya.

API Higgsfield tidak punya daftar harga. Biaya tiap model diambil dari endpoint `estimate` (gratis, tidak memakai kredit) untuk akun pengguna, ditampilkan di tiap baris dropdown (kredit dan US$) dan bisa diurutkan dari yang termurah. Hasilnya disimpan sehari dan dihapus saat kunci Higgsfield diganti.

Daftarnya ada di `src/shared/higgsfield-catalog.json`, disusun dari dokumentasi API (docs.higgsfield.ai) beserta skema input tiap model. `src/shared/higgsfield.ts` membentuk isi request dari skema itu: rasio frame, resolusi 2K untuk gambar dan 1080p untuk video (atau yang terdekat), durasi yang menutup panjang klip, lembar karakter sebagai referensi bila model menerimanya, serta audio bawaan model dimatikan. Model yang butuh video masukan (edit video, motion control) atau hanya teks-ke-video tidak dimasukkan karena tidak bisa menganimasikan gambar klip.

Untuk output JSON, aplikasi mencoba `json_schema` dulu, lalu `json_object`, lalu teks biasa dengan parser yang toleran (tag `<think>` dan code fence dibuang). Jadi model yang tidak mendukung structured output tetap bisa dipakai.

## Menjalankan

Butuh Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

## Membuat installer .exe

```bash
npm run dist
```

Hasilnya ada di `dist/BangStory-Setup-<versi>.exe`. Untuk folder siap jalan tanpa installer: `npx electron-builder --win --dir`.

## Struktur

```
src/
  main/        proses utama (backend lokal)
    db/          skema SQLite + migrasi
    services/    higgsfield, llm (Gemini/OpenRouter/Groq/custom), gemini, elevenlabs, audio
    generation.ts  job gambar, lembar karakter, video, TTS
    exporter.ts    render MP4 dengan FFmpeg (zoompan, xfade, caption ASS, mix audio)
    jobs.ts        antrean dengan batas proses bersamaan
  preload/     jembatan aman window.api
  shared/      tipe, preset gaya visual, gerak kamera, caption, katalog model
  renderer/    tampilan React + Tailwind
resources/fonts  15 font caption (Google Fonts, lisensi di resources/licenses/fonts), dipakai pratinjau dan FFmpeg
```

`shared/motion.ts` dan `shared/captions.ts` dipakai oleh pratinjau di editor dan oleh ekspor FFmpeg, jadi hasil MP4 sama dengan yang terlihat di editor.

## Catatan

- Seedream tidak tersedia di API Higgsfield, jadi model gambar bawaannya GPT Image 2.5 Sunburst dan model video bawaannya Kling 3.0 Standard.
- API Higgsfield tidak punya endpoint saldo. Aplikasi menampilkan perkiraan biaya dari endpoint `estimate`.
- Tanpa model Whisper, waktu caption untuk suara Gemini diperkirakan dari panjang kata. ElevenLabs selalu memberi waktu yang presisi.
- Harness uji khusus mode dev ada di `src/main/devharness.ts` (variabel `STUDIO_CAPTURE_PLAN`, `STUDIO_USER_DATA`, `STUDIO_LOG`) dan tidak aktif di aplikasi terpasang. Di mode dev, `STUDIO_HF_BASE` bisa mengarahkan panggilan Higgsfield ke server tiruan lokal supaya tampilan bisa diuji tanpa memakai kredit.
- Lisensi: FFmpeg (GPL), whisper.cpp (MIT), Poppins (OFL), dan LobeHub Icons (MIT, untuk logo penyedia) ikut terpasang di folder `resources`. Model Whisper Small (MIT) diunduh terpisah. Logo penyedia adalah merek milik pemiliknya masing-masing.
