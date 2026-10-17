# Naraflow

_by Bang Tutorial_

Naraflow adalah nama baru Bang Story. Logo N satu garis mewakili narasi yang bergerak dari ide menuju video. Folder proyek, pengaturan, dan media tetap memakai lokasi penyimpanan sebelumnya agar tersedia setelah pembaruan.

## Koneksi Codex untuk cerita, gambar, dan prompt video

Buka **Pengaturan → Penyusun cerita (AI LLM) → Codex · akun ChatGPT → Hubungkan**. Naraflow memakai sesi native Codex yang sudah login di komputer, tanpa API key atau URL endpoint tambahan. Pilih model dari katalog akun, atau gunakan **Otomatis · default akun**. **Endpoint API** tetap tersedia dan mempertahankan pilihan model sebelumnya. Hanya sumber cerita yang dipilih yang dipakai; koneksi Codex yang diputus tidak dialihkan ke API lain.

Di **Gambar dan video**, tombol **Hubungkan / Putuskan** terpisah mengatur gambar (termasuk lembar karakter dan thumbnail) serta **prompt video Codex**. Koneksi video menyusun arahan gerak pada tiap adegan mengikuti narasi dan master prompt. Codex tidak merender video di alur ini; hasil video dibuat di akun Flow melalui browser dan diimpor. Master video universal tetap dipakai persis tanpa ditulis ulang oleh AI.

**Putuskan** menghentikan permintaan Naraflow yang berjalan pada koneksi tersebut dan memblokir permintaan baru, tanpa logout akun Codex. Pengaturan tersimpan setelah aplikasi ditutup. Koneksi riset web tetap berdiri sendiri. Suara narator memakai layanan TTS pilihan proyek.

**Batas waktu penyusunan naskah** dapat dipilih dari 30 sampai 600 detik, bawaan 120 detik. Batas berlaku untuk seluruh proses **Susun naskah**, termasuk semua bagian naskah dan percobaan format jawaban. Status menampilkan waktu berjalan, dengan tombol **Batalkan**. Gagal, diputus, atau melewati batas waktu mempertahankan naskah sebelumnya. Kecepatan jawaban tetap mengikuti model, panjang permintaan, dan ketersediaan layanan akun.

## Studio dan pustaka master prompt

Navigasi **Studio / Riset topik / Master prompt** memisahkan brief cerita, riset, dan aturan produksi. Di dalam proyek, panel **Aturan produksi** menunjukkan master aktif, versi, serta kesiapan naskah, visual, media, dan suara. Status ini membantu peninjauan; target jumlah kata tidak memblokir naskah yang lengkap.

Pustaka menyediakan **Bang Motion**, **Animasi Cutout**, **Animasi Kesehatan**, **VOX**, dan **Stickman · Dokumenter**. Pilihan **Otomatis · ikuti skill & gaya** mempertahankan alur lama. Memilih master secara eksplisit menyimpan salinan lengkap versinya pada proyek atau sesi riset. Aturan master diutamakan bila berbeda dengan gaya pilihan, kecuali aturan hook dan penutup wajib dari pengguna.

Untuk aturan sendiri, buka **Master prompt → Master baru**, tempel master atau pilih berkas `.txt`, `.md`, atau profil `.json`, lalu **Tinjau aturan**. Judul bagian digunakan untuk pemetaan awal yang dapat diperiksa dan diedit. Teks sumber tetap disimpan utuh; aplikasi tidak menganggap pemetaan otomatis selalu tepat. Tab terpisah mengatur riset, naskah, gambar, video, thumbnail, serta suara. **Ritme & kamera** mengatur sasaran kata/detik, panjang beat, durasi sumber video, kamera terkunci, dan prompt video per adegan atau universal.

Master bawaan dapat disalin untuk disesuaikan. Menyimpan master pribadi menaikkan versi pustaka, tanpa mengubah proyek lama. **Pakai di proyek ini** menerapkan versi yang dipilih dan menandai rencana visual untuk ditinjau ulang, sambil mempertahankan naskah serta media. Menghapus master dari pustaka juga mempertahankan salinan di proyek. Pekerjaan gambar/video yang sudah antre memakai aturan yang ditangkap saat diantrekan.

Prompt video universal memakai teks pada tab Video secara utuh; gunakan bersama tiap gambar di Flow. Durasi sumber video bisa berbeda dari panjang beat di editor. Semua gaya dapat mengekspor prompt gambar ke `.txt`. Panduan suara membantu penulisan dan diteruskan sebagai arahan gaya ke Gemini; ElevenLabs tetap menggunakan pengaturan layanan yang dipilih, tanpa menerjemahkan teks bebas menjadi angka pengaturan secara otomatis.

Redesign mengambil pola pemisahan perencanaan/produksi, profil terstruktur, validasi, dan salinan versi dari studi paket Director Studio. Aplikasi ini tetap menggunakan alur Codex/Flow yang sudah tersedia; paket tersebut tidak dijalankan atau dipasang sebagai layanan tambahan.

## VOX · Kolase dokumenter

Pilih **Explainer Bang Motion → VOX · Kolase dokumenter** di menu Gaya visual. Preset ini mengikuti master kolase kertas: foto halftone hitam-putih, koran dan peta tua, potongan kasar, aksen merah, serta ruang negatif luas. Naskah memakai ritme dokumenter tenang, target 2,5 kata/detik dengan toleransi 5%, satu ide visual per beat, dan durasi custom.

Pada Storyboard tersedia **Ekspor prompt gambar .txt**, **Salin prompt Flow VOX**, dan **Salin 3 prompt thumbnail**. File gambar berisi satu prompt lengkap per beat tanpa nomor, dipisahkan baris kosong. Blok gaya dan closer mengikuti lampiran; rasio gambar mengikuti proyek, sementara thumbnail 16:9.

Prompt Flow universal adalah sumber 10 detik: kertas dirakit selama 0–7 detik, kemudian komposisi akhir ditahan selama 7–10 detik. Kamera terkunci. Pilih bagian sumber yang diperlukan untuk beat narasi 2–3 detik saat mengedit. Panduan suara ElevenLabs tersedia di storyboard; narasi direkam melalui penyedia suara yang dipilih di aplikasi. Beralih dari gaya lain ke VOX menandai rencana visual untuk disusun ulang, sambil mempertahankan aset yang sudah dibuat.

## Stickman, subject niche, dan 10 ide video

Pilih gaya **Stickman** untuk memakai master **Stickman · Dokumenter** otomatis, atau pilih master itu secara eksplisit. Master mengadaptasi berkas **Ultimate Stickman Animation Content Master Prompt.md**: teks sumber lengkap tersedia di pustaka, sedangkan arahan tiap tahap disesuaikan dengan tombol dan format data Naraflow. Alur gambar tetap Codex dan video tetap Flow; tidak ada koneksi Omni Flesh tambahan.

Menu **Subjek / niche cerita** menyediakan **Ancient Humans, Human Evolution, Ancient History, Weird History, Science, Psychology, Animals, Space, Survival, Technology, Civilization**, dan **Dark History**. Gaya lain mempunyai rekomendasi niche yang sesuai, dan **Niche custom · tulis sendiri** menerima topik tambahan. Di master pribadi, tab **Niche & durasi** mengatur pilihan niche dan preset menit tanpa menghapus durasi custom. Niche berbeda dari kategori riset yang lebih luas dan dibawa ke sinopsis, naskah, karakter, visual, prompt Flow, serta thumbnail.

Klik **Buat 10 ide video** untuk mendapatkan sepuluh konsep sesuai gaya, niche, skill, dan master aktif, masing-masing dengan tiga sudut cerita dan skor editorial. Kata kunci tidak diperlukan untuk tombol contoh; perubahan gaya, niche, atau master meminta hasil diperbarui sebelum digunakan. Pilih ide lalu tentukan durasi. Master Stickman menyarankan **3, 8, 12, atau 20 menit**; waktu custom tetap tersedia. Skor menilai peluang secara editorial dan tidak menjamin viral. Fakta tanpa dukungan sumber tetap ditandai belum terverifikasi.

Di **Brief**, tombol **Susun karakter sesuai niche** membaca ide atau naskah lengkap dan menambahkan hanya peran berulang yang dibutuhkan, dengan target maksimal lima pemeran. Cast lama yang lebih besar dipertahankan tanpa menambahkan tokoh lagi. Pemeran, PNG master, tautan klip, dan media lama dipertahankan. Tombol ini menyusun deskripsi desain; gunakan **Generate lembar Codex** pada pemeran untuk membuat gambar character sheet. Ada status waktu, pembatalan, dan batas waktu yang mengikuti pengaturan penyusunan cerita. Hasil yang gagal atau dibuat sebelum niche/naskah berubah tidak mengganti data lama.

Karakter Stickman memakai kepala bulat, mata dan mulut sederhana, serta tubuh/lengan/kaki garis tipis; kostum dan properti mengikuti cerita serta niche. Prompt lembar karakter meminta latar putih murni, enam tampak, pose aksi kontekstual, dan dua belas ekspresi. PNG yang sudah disetujui menjadi referensi identitas di adegan berikutnya. Gambar adegan memakai lingkungan sederhana sesuai narasi, bukan latar putih wajib character sheet.

Setiap prompt video Stickman menyertakan kutipan narasi asli dan arahan satu shot kontinu sekitar **10 detik**, aksi dan reaksi yang jelas, kamera terkunci, serta kesinambungan lokasi, kostum dan properti. Tidak ada cut, montage, atau zoom di dalam sumber video. Durasi edit tetap mengikuti suara narasi. Prompt video universal dari master pribadi tetap disalin persis. Hook tiga detik dan penutup follow/subscribe tetap berlaku. Gaya sebelumnya dan proyek lama tetap tersedia; proyek lama mendapat niche kosong hingga pengguna memilihnya.

## Map Animation

Penyusunan visual mempunyai batas waktu sendiri: **600 detik (10 menit)** secara default, dapat diubah menjadi **30–1800 detik** di Pengaturan. Batas ini berlaku untuk seluruh perencanaan visual, termasuk endpoint yang mengikuti penyusun cerita, dan tidak memakai batas naskah 120 detik. Status menampilkan waktu yang berjalan dan batas aktif; **Batalkan** menghentikan permintaan. Pembatalan atau batas waktu mempertahankan rencana visual yang sudah tersimpan.

Pilih gaya **Map Animation · Territory Highlight** atau master bawaan **versi 2**. Teks master baru disimpan lengkap dalam pustaka. Gaya ini memakai peta satelit siang hari bernuansa alami, relief medan, warna wilayah datar semi-transparan, garis putih, ikon stiker, dan gerak kamera zoom-roll-pan berkesinambungan. Tidak ada neon, glow, awan, atau kabut. Pemeran dan character sheet tidak dibuat untuk rangkaian peta; gaya dan proyek lain tetap tersedia. Proyek yang mengunci master versi 1 mempertahankan aturan lama. Untuk memakai versi baru pada proyek tersebut, pilih master versi 2 lalu susun ulang visual.

Warna target terkunci sepanjang video: **oranye #D3631F** atau **rose #B85B54**. Pada **Master prompt**, salin preset untuk mengubah **Fill wilayah** dan **Warna target**. Mode **GENERATED** membuat warna dan garis wilayah pada gambar/video, dengan target sudah terisi sejak frame pembuka. Mode **POST** membuat basemap, gerak kamera, dan ikon; warna serta garis wilayah ditambahkan sebagai lapisan vektor saat editing. Pilihan ini memberi arahan dan tidak merender lapisan vektor secara otomatis.

Default proyek baru: **9:16, 32 detik, empat adegan** (hook → konteks → twist → payoff). Sumber video setiap adegan berdurasi **8 detik**, dengan gerak 0–2, 2–5, dan 5–8 detik. Target durasi edit custom dan bahasa pilihan tetap tersedia. Narasi akhir menentukan panjang edit. Hook berada pada baris pertama sekitar dua detik, dengan konteks berikutnya masih dalam adegan pembuka; penutup follow/subscribe tetap mengikuti aturan pengguna.

Di **Riset topik**, pilih niche geografis lalu **Buat 10 ide video**. Pilih konsep sebelum menyusun naskah. Skor bersifat editorial. Arahan riset meminta sumber, fakta akurat, batas wilayah netral, dan penandaan hal yang perlu diverifikasi. Thumbnail memakai format 16:9 terpisah dari format video.

**Susun visual** merencanakan seluruh rantai sekaligus. Hanya adegan pertama memakai gambar yang dibuat lewat Codex atau diimpor. Buat video pertamanya di Flow, lalu impor ke klip pertama. Pada adegan kedua, klik **Ambil frame akhir klip sebelumnya**, simpan PNG hasilnya, dan unggah PNG itu ke Flow bersama prompt video adegan kedua. Ulangi sampai selesai. Frame diambil secara lokal dari frame terakhir video, tanpa panggilan layanan gambar. Jangan membuat gambar baru untuk adegan lanjutan.

START STATE adegan lanjutan harus sama persis dengan END STATE sebelumnya. Pada versi 2, frame akhir adegan terakhir kembali ke framing lebar pembuka untuk loop. Bila urutan, rencana, video sumber, atau frame berubah, aplikasi meminta rangkaian ditinjau dan frame diambil ulang. Aset lama tetap tersimpan.

Pada panel klip, **Post Overlay Sheet** menyediakan waktu, elemen, teks, posisi, ukuran, dan animasi label/statistik untuk editing. **Audio & SFX** menyediakan narasi dan arahan suara terpisah. **Salin Publish Pack** menyalin judul, caption, lima hashtag, dan tiga caption singkat dari adegan terakhir. Prompt video yang disalin hanya membawa arahan visual; label dan audio tidak ikut diminta pada generator. Narasi tetap dibuat melalui penyedia suara pilihan. Label, SFX, musik, dan Publish Pack merupakan panduan yang dapat disalin, bukan hasil render atau publikasi otomatis. Video tetap dibuat dan diunduh melalui akun Flow pengguna.

## Riset topik, ide, thumbnail, dan pilihan skill

Buka **Riset topik** dari halaman awal, tulis tema yang ingin diteliti, lalu pilih skill dan kategori. Riset memakai Codex lokal yang sudah login dengan akun ChatGPT, termasuk pencarian web native bila tersedia, tanpa kunci API tambahan. Hasil riset dan pilihan ide tersimpan di komputer. Sumber yang tersedia ditampilkan pada setiap topik; hasil tanpa sumber diberi penanda ide editorial.

**Skor peluang 0–100** adalah perkiraan editorial, bukan prediksi atau jaminan viral. Nilainya dijumlahkan dari rasa penasaran (25), relevansi penonton (25), kekuatan visual (20), sudut baru (15), dan momentum (15). Buka rincian skor untuk melihat alasan dan komponennya. Aplikasi tidak mengarang jumlah penonton, volume pencarian, atau tingkat persaingan.

Pilih topik, pilih salah satu ide, atau **Perbarui ide** untuk meneliti sudut baru. Setiap topik terpilih mempunyai prompt thumbnail yang dapat diedit, tombol generate melalui Codex, pratinjau, dan simpan PNG. Mulai proyek dari ide pilihan untuk membawa sinopsis, sumber, skill, dan thumbnail ke proyek.

Skill tersedia pada halaman awal, langkah Ide, dan Riset topik:

- **Explainer Bang Motion**: kartun kolase, jurnalisme visual, katalog putih, sketsa vintage, aksi kontinu, atau kartun panggung.
- **Animasi Cutout**: kolase fotografis berlapis, kedalaman 2.5D, pose kontekstual, dan reaksi humor.
- **Explainer Animasi Kesehatan**: karakter organ/sel kartun 2D, mekanisme tubuh, dialog dan humor, dengan arahan sumber medis primer.
- **Cerita bebas** untuk tema dan gaya pilihan sendiri.

Pilihan skill memberi arahan pada naskah dan prompt gambar/video. Gambar adegan tetap dibuat di Codex, video di Flow, dan penyusunan timeline di editor Naraflow. Skill ini tidak memasang alat render baru atau koneksi akun Flow.

### Gaya visual sesuai skill

Menu **Gaya visual → Sesuai skill** menampilkan pilihan yang direkomendasikan dengan pratinjau:

| Skill | Gaya visual |
|---|---|
| Explainer Bang Motion | VOX · Kolase dokumenter, Kartun kolase explainer, Jurnalisme visual sinematik, Katalog putih editorial, Ukiran vintage explainer, Dunia aksi kontinu, Kartun panggung dinamis |
| Animasi Cutout | Kolase kertas |
| Explainer Animasi Kesehatan | Organ kartun ekspresif, Dunia sel dan imun, Panggung organ interaktif, Diagram tubuh berkarakter, Komik organ humor |

Memilih gaya menyelaraskan varian skill dan arahan visual pada gambar adegan, lembar karakter, thumbnail, serta prompt video Flow. Pratinjau merupakan ilustrasi gaya; hasil gambar dibuat saat tombol generate dijalankan. Tab **Semua** tetap menyediakan gaya sebelumnya, dan membuka proyek lama mempertahankan gaya yang tersimpan.

Lima gaya **Cutout fotografis 2.5D**, **Cutout kertas bertekstur**, **Cutout editorial pop**, **Cutout arsip vintage**, dan **Cutout sinematik berlapis** telah dihapus dari menu pilihan baru. Skill Animasi Cutout tetap tersedia dengan Kolase kertas sebagai pilihan awal. Gaya dan arah visual asli tetap dikenali pada proyek yang sudah memakai salah satu gaya tersebut. Membuat proyek baru dari sesi riset lama menggunakan pilihan gaya aktif.

Gaya dapat diganti pada hasil **Riset topik** tanpa mengulang riset. Prompt thumbnail bawaan mengikuti gaya baru; prompt yang telah diedit dan gambar sebelumnya tetap tersimpan. Generate ulang thumbnail untuk menerapkan gaya baru. Proyek yang dibuat dari hasil riset memakai gaya yang dipilih pada hasil tersebut.

### Animasi kesehatan 2D dengan character sheet yang sudah dibuat

Pilih **Explainer Animasi Kesehatan**, lalu **Pilih karakter kesehatan** pada langkah Ide. Pustaka bawaan berisi 100 master PNG organ, struktur, darah/imun, jaringan, dan sel dari koleksi pengguna, serta empat sheet desain, ekspresi, dan gestur. Cari nama atau kategori, lalu **Tambah pemeran ini**. PNG asli yang dipilih disalin ke proyek dan menjadi referensi pemeran; memilih ulang karakter yang sudah ditambahkan tidak membuat duplikat. Pustaka juga dapat dibuka dari dialog pemeran. **Pakai sebagai referensi** mengganti master pemeran tersebut sambil mempertahankan gambar lama sebagai versi sebelumnya.

Susun naskah setelah memilih pemeran. Penyusun naskah memakai nama dan ciri master yang dipilih. Rencana visual setiap adegan memuat kutipan narasi pemicu, pose/ekspresi, arah pandang, aksi dan titik kontak, akibat yang terlihat, reaksi/humor, serta pemisahan karakter, properti dan latar. Urutan gerak mengikuti ucapan/niat → aksi → akibat → reaksi; hasil tetap dapat diedit di Storyboard. Arahan yang belum lengkap atau tidak terkait narasi ditolak tanpa mengganti rencana visual lama.

Generate gambar Codex melampirkan master PNG pemeran adegan tersebut sebagai gambar referensi nyata. Bank ekspresi/gestur yang sesuai ikut dilampirkan bila tersedia, dengan prioritas anatomi pada PNG individual. Sheet lama yang menggabungkan usus tidak menggantikan master usus halus atau usus besar. Batas total delapan referensi per generasi; master pemeran mendapat prioritas. Generate ulang lembar karakter juga memakai referensi aktif sehingga perubahan ditujukan pada ekspresi/pose, bukan desain ulang identitas.

Salin prompt Flow dari adegan untuk membuat gerak kartun 2D: pose, tatapan, gestur, aksi, dan reaksi sesuai narasi. Unggah gambar adegan, generate di akun Flow, lalu impor video hasilnya. Narasi ditambahkan terpisah di Naraflow. PNG dan sheet utuh adalah referensi, belum rig mata/mulut; aplikasi tidak menjanjikan lip-sync otomatis. Pratinjau gerak kamera di atas gambar diam tetap merupakan pratinjau gambar; gerak karakter berasal dari video yang dibuat dan diimpor. Tombol **Simpan PNG** mengekspor master atau sheet yang dipilih.

**Durasi khusus** dapat diisi dalam detik atau menit, dari 1 detik sampai 24 jam. Naskah panjang disusun dalam beberapa bagian. Nilai ini adalah target penulisan; durasi akhir mengikuti suara narasi dan penyesuaian klip di editor.

Aplikasi desktop Windows untuk mengubah ide cerita jadi video YouTube: AI menyusun klip dan naskah, tombol Generate gambar memakai Codex lokal dan video dibuat di Google Flow, Gemini atau ElevenLabs membuat suara narator, lalu semuanya dirangkai di editor timeline dan diekspor jadi MP4. Higgsfield tersedia sebagai alur API opsional.

## Gambar Codex dan video Flow tanpa API Higgsfield

Alur bawaan di **Pengaturan → Gambar dan video** adalah **Codex + Flow**. Gambar bisa dibuat langsung dari Naraflow melalui Codex yang terpasang dan sudah login dengan akun ChatGPT di komputer ini. Video dibuat melalui akun Flow di browser.

1. Susun naskah dan visual adegan seperti biasa. Penyusun cerita dan TTS tetap memakai penyedia yang Anda pilih.
2. Di Storyboard, pilih adegan lalu **Generate gambar Codex**. Hasil otomatis tersimpan dan menjadi gambar aktif di adegan. Prompt mencakup adegan, pemeran, gaya visual, dan rasio; lembar karakter yang sudah ada dilampirkan otomatis sebagai referensi. Generate satu gambar berjalan bergantian, dengan status proses dan tombol batal.
3. Jika ingin generate melalui chat Codex, **Salin prompt Codex** lalu **Impor gambar** hasilnya. PNG, JPEG, dan WebP didukung. File disalin ke penyimpanan proyek; gambar lama tetap tersedia sebagai versi sebelumnya.
4. Kolom **Prompt video untuk Flow** selalu tampil pada adegan terpilih, termasuk ketika masih menggunakan gerak kamera. Edit arah gerak, lalu salin prompt Flow. Prompt salinan mencakup rasio, kesinambungan gambar, dan arahan tanpa narasi/musik.
5. **Simpan gambar** untuk mendapatkan file frame awal, lalu **Buka Flow + salin prompt**. Browser memakai login akun Google/Flow milik Anda. Unggah gambar sebagai frame awal, tempel prompt yang sudah disalin, dan generate di Flow dengan kredit akun tersebut.
6. Unduh video hasil Flow dan **Impor video Flow** ke adegan. Video aktif di pratinjau dan editor. Durasi klip tetap mengikuti narasi; jika video lebih pendek, frame terakhir ditahan sampai klip selesai.

Dialog pemeran juga memiliki tombol **Generate lembar Codex**, salin prompt, impor, dan simpan PNG. Lembar karakter yang aktif otomatis menjadi referensi ketika gambar adegan dibuat melalui tombol Codex.

Alur ini tidak meminta kunci Higgsfield atau kunci OpenAI. Generate gambar memakai kuota akun Codex, bukan kredit Flow. Login ChatGPT dilakukan melalui Codex; Naraflow tidak menyimpan kata sandi atau token akun. Status koneksi dan tombol cek ulang tersedia di Pengaturan dan Storyboard. Jika Codex tidak ditemukan, pasang/buka Codex dan login, lalu cek lagi. Bridge menggunakan protokol lokal Codex app-server; versi Codex harus mendukung image generation.

Kompatibilitas yang diuji saat ini: Codex lokal 0.154.0 dengan model pengarah GPT-5.5 dari katalog akun. Naraflow memilih model ini jika masih tersedia, lalu memakai model default katalog jika tidak. OpenAI menjadwalkan penghentian GPT-5.5 untuk login ChatGPT pada 14 Oktober 2026; perbarui Codex dan gunakan model yang tersedia bila akses berubah. Lihat [model Codex](https://learn.chatgpt.com/docs/models). Model pengarah ini mengirim permintaan ke alat gambar native Codex.

Login akun Flow, unggah, generate, dan unduh tetap dilakukan di browser. Naraflow belum memiliki integrasi publik resmi untuk generate otomatis memakai kredit Flow. Tombol Buka Flow menyiapkan prompt; tombol itu tidak menjalankan generate di situs Flow. Untuk generate langsung lewat API Higgsfield, pilih alur **Higgsfield API** di Pengaturan.

## Cara membuka

Syarat: [Node.js](https://nodejs.org) versi LTS sudah terpasang, dan ada koneksi internet saat pertama kali dibuka.

- **Windows:** klik 2x `START - WIN.bat`.
- **macOS:** klik 2x `START - MAC.command`. Kalau muncul pesan tidak punya izin, buka Terminal di folder ini dan jalankan `chmod +x 'START - MAC.command'` sekali. Kalau macOS memblokirnya, klik kanan file itu › Open.

Saat pertama kali dibuka, START memasang semua kebutuhan (`npm install`) dan mengunduh Electron. Ini butuh beberapa menit. Setelah itu aplikasi langsung terbuka setiap kali START diklik. Kalau folder ini dipindah ke OS lain, START otomatis memasang ulang kebutuhannya.

Setelah membuka, pilih alur gambar/video di **Pengaturan**. Codex + Flow tidak memerlukan kunci API gambar/video. Penyusun cerita dapat memakai akun Codex atau endpoint API. Penyusun visual dari naskah memiliki koneksi dan pilihan model Codex sendiri; bisa tetap memakai Codex ketika naskah memakai endpoint lain. Atur juga penyedia suara narator. Kunci Higgsfield hanya diperlukan jika memilih alur Higgsfield API.

Catatan macOS: fitur caption akurat (Whisper lokal) baru tersedia untuk Windows. Fitur lainnya tetap berjalan.

Kalau kode di `src` diubah, hapus folder `out` (atau jalankan `npm run build`) supaya START menyusun ulang aplikasinya.

## Alur

1. **Brief**: tulis sinopsis atau mulai dari hasil Riset topik, pilih skill, subject niche, durasi custom/preset, bahasa, format (16:9 atau 9:16), suara narator, dan gaya visual. Tombol **Buat 10 ide video** di kartu gaya terpilih meriset sepuluh topik, masing-masing dengan tiga sudut cerita, hook, skor editorial, dan alasan cocok dengan gaya, niche serta master. **Pakai ide** memasukkan sinopsis dan konteks sumber ke brief. Pilihan selalu mengikuti gaya, skill, niche, dan versi master aktif, termasuk master custom yang baru ditambahkan; perubahan konteks meminta pembaruan hasil sebelum ide lama dipakai. Tidak ada riset otomatis saat memilih gaya. AI penyusun cerita (Codex, Gemini, OpenRouter, Groq, atau endpoint custom) lalu menulis naskah dengan arahan skill.
2. **Naskah**: baca dulu alurnya: berapa adegan, apa yang terjadi di tiap adegan, dan narasi (VO) masing-masing. Adegan bisa diubah, ditambah, dihapus, dan diurutkan ulang. Narasi boleh memuat tag ekspresi suara seperti `<short pause>`, `<long pause>`, `<chuckles>`, atau `<sigh>`. Setelah itu AI membuat visual dari naskah final: prompt gambar, pemeran, gerak kamera dan kekuatannya, transisi, serta arahan gerak untuk video AI. Kalau naskah diubah lagi, hanya adegan yang berubah yang disusun ulang visualnya.
3. **Visual**: setiap adegan punya gambar (generate lewat Codex, impor, atau Higgsfield opsional), suara narasi (TTS), dan gerak: gerak kamera gratis atau video AI (impor hasil Flow atau Higgsfield opsional). Kartu menampilkan gambar utuh dalam thumbnail setinggi 220 piksel, dengan tombol **Salin prompt gambar**, **Salin prompt video**, dan **Hapus klip** di bawahnya. Prompt disalin setelah perubahan disimpan, menggunakan isi terbaru serta aturan gaya/master; prompt video universal tetap disalin persis. Menghapus klip meminta konfirmasi dan menghentikan pekerjaannya yang masih aktif. **Generate semua gambar** muncul saat koneksi gambar Codex siap, mengantrekan gambar yang belum dibuat satu per satu dan melewati gambar selesai maupun antrean aktif. Antrean dapat dibatalkan. **Salin semua prompt gambar Flow** di sebelah tombol suara mengambil seluruh adegan sesuai urutan, termasuk yang sudah punya gambar, dan tetap bisa dipakai saat Codex diputus. Pengaturan koneksi ada dalam menu **Opsi visual** dan Pengaturan. Suara narasi dibuat dalam satu rekaman utuh lalu dipotong otomatis per adegan, supaya suara dan intonasinya konsisten.
4. **Produksi**: pratinjau langsung dengan gerak kamera, transisi, caption karaoke, musik latar, serta overlay logo, watermark, atau teks yang bisa digeser langsung di pratinjau. Tab **Efek** mengatur transisi tiap sambungan (cut, pudar, geser, zoom), menerapkannya ke semua, dan memutar pratinjau sambungan. Gerak kamera bisa diterapkan serentak pada gambar. Tab **Klip** mengatur durasi pecahan detik, kembali mengikuti suara, dan mengurutkan adegan. **Pas layar** menyesuaikan tampilan timeline. Aturan master tetap berlaku, termasuk cut dan kamera terkunci pada VOX. Lalu ekspor MP4 dengan FFmpeg.

## Pilihan layanan narasi

Saat ElevenLabs terhubung, pemilih suara di **Brief**, **Visual**, dan **Produksi** menyediakan bahasa **Indonesia / Melayu / Semua**, serta kategori **Media sosial**, narasi, edukasi, karakter, iklan, dan percakapan. Filter memakai metadata asli ElevenLabs; suara custom tanpa metadata tetap tersedia pada **Semua**. Pilihan tersimpan tidak diganti saat filter berubah. Tombol pratinjau memakai contoh suara yang tersedia dari penyedia.

Tab **Akun saya** berisi suara akun. Untuk mencari pilihan lain, buka **Pustaka ElevenLabs**, pilih filter lalu **Cari di pustaka**. **Tambahkan dan gunakan suara** menambahkan suara pilihan ke akun dan memakai ID akun yang dikembalikan ElevenLabs. Pencarian tidak menambahkan suara otomatis; ketersediaan dan izin penambahan mengikuti akun ElevenLabs.

Naskah baru dan **Susun ulang naskah** dimulai dengan satu hook konkret di baris narasi pertama, ditargetkan selesai dalam tiga detik tanpa salam atau jeda pembuka. Penutup mengajak penonton: **“Kalau mau konten seperti ini, jangan lupa follow dan subscribe.”** Ajakan mengikuti bahasa proyek. Aturan ini berlaku juga pada VOX dan master pribadi, dengan fakta, gaya visual serta suara tetap mengikuti master. Jika hook terlalu panjang, aplikasi mencoba satu perbaikan; draf sebelumnya tetap tersimpan bila perbaikan gagal. Durasi suara aktual bergantung pada suara dan kecepatan bicara; target sangat pendek bisa terlampaui agar hook serta penutup tetap utuh. Naskah lama tidak diubah otomatis.

Di **Visual** dan **Produksi**, pilih layanan narasi serta suara dari akun yang terhubung. Tombol **Buat suara narasi** memeriksa koneksi terbaru dan menyimpan pilihan sebelum membuat suara. Pilihan proyek tetap dipakai jika layanannya tersedia; jika tidak, layanan lain yang sudah terhubung dapat dipakai. Proyek lama yang masih memilih Gemini dapat memakai ElevenLabs ketika hanya ElevenLabs yang tersedia, tanpa meminta kunci Gemini. Suara disesuaikan dengan penyedia agar nama suara Gemini tidak dikirim sebagai ID ElevenLabs.

Penyedia, suara, dan model ditangkap saat pekerjaan dimulai. Kesalahan API ditampilkan untuk layanan yang dipakai dan tidak memicu generate ulang lewat layanan lain. Jika belum ada layanan narasi terhubung, aplikasi mengarahkan ke Pengaturan sebelum membuat pekerjaan. Mengubah pilihan tidak mengganti rekaman lama; generate ulang untuk menerapkan suara baru, dengan rekaman sebelumnya tetap tersimpan di riwayat.

## Tema dan contoh ide

Tombol **bulan/matahari** di bagian atas Studio, Riset topik, Master prompt, proyek, dan Pengaturan langsung mengganti **Terang / Gelap**. Pilihan tersimpan untuk pembukaan berikutnya. **Pengaturan → Umum → Tampilan** juga menyediakan **Ikuti sistem**, yang mengikuti perubahan tema Windows. Jika penyimpanan gagal, tampilan kembali ke pilihan sebelumnya. Tema memengaruhi antarmuka, sementara gambar, video, dan gaya visual konten tetap memakai warnanya sendiri.

Pada **Riset topik**, kartu **Jenis tampilan dan contoh cerita** menampilkan gaya terpilih, master aktif, dan tombol **Buat 10 ide video**. Tombol ini mencari sepuluh topik dengan tiga pilihan ide per topik berdasarkan gaya, niche, skill, dan master, termasuk master custom yang baru ditambahkan. Contoh tidak membutuhkan kata kunci. Kata kunci serta filter kategori digunakan oleh tombol **Riset topik** biasa. **Gunakan hasil riset** memindahkan contoh ke daftar topik agar bisa dipilih, diperbarui idenya, dibuat thumbnail, dan dilanjutkan ke proyek. Skor 0–100 adalah penilaian editorial dari faktor yang ditampilkan, bukan jumlah penonton atau jaminan viral. Sumber hanya dipasang ketika benar-benar teramati melalui riset. Untuk contoh ide, faktor momentum bernilai 0 tanpa sumber bertanggal yang mendukung; ide tanpa sumber tetap diberi label belum terverifikasi.

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
| Penyusun cerita, pilih satu: Codex, Google Gemini, OpenRouter, Groq, atau endpoint custom (OpenAI-compatible) | Menyusun klip, naskah, dan pemeran | Login Codex atau kunci/endpoint penyedia terpilih |
| Google Gemini | Suara narator Gemini TTS | Kalau memakai Gemini TTS |
| ElevenLabs | TTS dengan waktu kata presisi | Opsional |

Setelah kunci penyusun cerita disimpan, daftar modelnya diambil langsung dari penyedia (ratusan model untuk OpenRouter) dan dipilih lewat dropdown yang bisa dicari. Daftar disimpan di cache 24 jam dan bisa dimuat ulang kapan saja. Endpoint custom menerima server apa pun yang kompatibel dengan OpenAI API, misalnya Ollama (`http://localhost:11434/v1`), LM Studio, vLLM, DeepSeek, atau xAI Grok (`https://api.x.ai/v1`).

Koneksi Codex dapat dihubungkan atau diputus secara terpisah untuk naskah, rencana visual, gambar, dan prompt video. Daftar model naskah/visual berasal dari katalog akun lokal, termasuk GPT-6.1 Sol, GPT-6 Astra, GPT-6 Sol, dan GPT-6 Luna jika tersedia. Aplikasi memilih runtime Codex terpasang dengan versi terbaru sehingga instalasi PATH yang lebih lama tidak menyembunyikan model baru. Pilihan otomatis mengikuti model default akun. Gambar memakai alat gambar native Codex; aplikasi tidak memaksakan versi backend GPT Image 2.5 karena kontrak native belum menyediakan pilihan tersebut. Video Flow tetap dibuat melalui akun Flow dan diimpor ke aplikasi.

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
