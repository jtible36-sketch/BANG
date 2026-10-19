# Cutout · Fakta & Komedi v5 — temuan dan validasi

Tanggal: 19 Oktober 2026. Cakupan: preset `cutout-facts` di E:\BANG. Media pengembangan memakai fixture, tanpa permintaan generasi gambar/video/TTS berbayar. Proyek pengguna hanya dibaca, tidak diedit atau diekspor oleh MCP.

## Fase 0 — reproduksi sebelum perubahan

Fixture berisi 24 klip bertanda `motionType: video`, tanpa videoAssetId dan tanpa komposisi aktif. Mode Edit otomatis memakai aset tersedia, provider diganti fixture. Error aktual:

```
Arahan Cutout belum terpenuhi: Shot 1
Komposisi Cutout aktif belum tersedia.
Background tanpa tokoh dan pose/properti terpisah, atau klip khusus untuk aksi kontinu.
Fixture without valid cutout
Susun kebutuhan di Cutout atau aktifkan generate aset. Edit belum diterapkan.
```

Stack yang tertangkap berasal dari `startCodexAutoEdit` pada cabang hasil komposer, dibungkus `runJob`; status job `failed`. Ini kegagalan pekerjaan yang tertangani, bukan bukti proses Electron crash. Provider media dipanggil nol kali. Error fixture direkam di `outputs/cutout-v5/baseline.json` pada workspace Codex. Penyebab terbukti: pemeriksaan kebutuhan komposisi terjadi setelah panggilan komposer, belum ada daftar kesiapan media sebelum pekerjaan. Klip video tanpa link tidak cukup untuk menyatakan video tersedia.

Peta kode terverifikasi: `CutoutVisualStep` membuka paket per adegan melalui `cutout-visual` dan `cutout-assets`; `StoryboardStep` memilih panel berdasar preset; `EditorStep` membuka `AutoEditPanel`; tombol menjalankan IPC/preload `editorAutomation.run` → `startCodexAutoEdit` → `produceAndEdit` → `composeProductionShots`/review → validate/apply. `WorkflowPanel` meringkas aset/komposisi. Typed API berada di shared/api.ts, shared/types.ts, preload/index.ts dan main/ipc.ts. Ekspor MP4 dan kit CapCut memiliki jalur terpisah.

Skill REA memeriksa build preload secara statis: parent evidence `ev_0be46b9b21488e5fc217445d64c77466dcaa22f405b0b1828f4b54dd0e5b3e21`, SHA-256 build preload `381a63768b8f789f8bedd184943b2a7f382229ce62c2a4d45c7b9cbea25a938c`. Analisis inert tidak membuktikan eksekusi IPC. Uji Electron fixture menyediakan bukti eksekusi terpisah.

Hipotesis yang tidak boleh dianggap terbukti: setiap karakter goyang disebabkan efek kamera tertentu; kesamaan visual dengan referensi; jumlah layer sumber; keberadaan SFX referensi. Laporan HTML referensi yang diberikan adalah bahan observasi terdahulu, bukan nama proyek yang harus diubah. Angka kecepatan narasi pada brief v5 dan laporan v4 tidak sama; pengembangan ini tidak mengukur ulang transkrip untuk memutuskan mana yang benar.

## Fase 1 — kesiapan media

`shared/cutout-shot-rules.ts`, `main/cutout-v5.ts` dan `CutoutV5Panel.tsx` menghasilkan ok/warning/blocked per klip. File, kepemilikan proyek dan bentuk komposisi diperiksa. Motion video tanpa link diberi blocked; komposisi berlapis valid tetap boleh memakai flag lama. Foto utuh diberi kebutuhan Cutout, bukan dianggap pose/rig. Auto-edit berhenti sebelum provider untuk media invalid dengan hasil kesiapan yang tertangani. UI menawarkan Ubah ke Cutout, Rencanakan aset di Visual, dan Siapkan klip khusus; perubahan motionType hanya lewat aksi pengguna. Missing paket pada klip camera dapat direncanakan oleh alur produksi yang diaktifkan secara eksplisit.

Terbukti dengan unit: 24 hasil blocked beserta alasan, tanpa mutasi; bypass empat preset lain; missing/foreign files dan komposisi valid. Integrasi: 24 klip berhenti sebelum Codex, nol submission media; ekspor menolak media belum lengkap. UI: 24 status tampil dan konversi hanya memengaruhi satu klip yang diklik.

## Fase 2 — sumber aturan

`shared/cutout-shot-rules.json` memuat ambang/severity, dengan konfigurasi per proyek di editor.cutoutV5.rules. Pemeriksaan berjalan di Visual/Produksi, review komposisi, penerapan edit dan ekspor. Warning ditampilkan; error menahan penerapan/ekspor. Jumlah mover adalah jumlah track aktif yang benar-benar berubah, termasuk pose, mask, parent inheritance, IK aktif dan parallax berbeda. Key identik dan kamera bersama tidak menambah mover. Batas dua mover adalah pilihan produksi. Kontrak generator deterministik lama tetap maksimal dua mover; mengubah ambang audit tidak menambah kapasitas kontrak model.

Tes unit mencakup transisi/kamera, rentang batas durasi, montase berurutan, pose/parent/IK, severity warning versus error, dan konfigurasi invalid. Satu aksi utama diperiksa keberadaan catatannya; kebenaran makna aksi tetap membutuhkan tinjauan visual/manusia. Tidak mengklaim validator memahami semua semantik narasi.

## Fase 3 — stabilitas dan default

`repo.replaceScript` memberi klip Cutout baru transisi cut dan kamera static. `applyVisuals` membatasi default rencana model pada cut/static atau zoomin. Penyuntingan manual tersimpan tidak dinormalisasi diam-diam. Komposer kamera push-in singkat lalu hold; tubuh karakter tidak boleh spring/back-out atau bolak-balik berulang. Komposer shot tidak mempunyai preset shake atau keyframe acak. Brief, prompt stage dan preset menjadi v5. Hasil cache shot memakai kunci versi baru agar delta lama tidak dianggap hasil v5.

Terbukti: uji pegas dan goyang linear/baked, monotonic entry, kamera berhenti sebelum akhir shot, default baru dan visual manual di empat preset lain tetap sama. Semantik satu aksi/pose tetap memerlukan aset dan penyutradaraan yang cocok.

## Fase 4 — usulan shot dari kata

`shared/cutout-shot-proposals.ts` memakai timestamp rekaman dan pemilihan batas dengan penalti akhir klausa, sasaran 8–14 kata dan ambang durasi. Shot penjelasan panjang boleh dipertahankan. Pengguna dapat mengedit JSON rentang/teks dan menerima usulan. Tanpa timing aktual, UI menawarkan jalur sinkron caption Whisper lokal yang sudah ada. Paket baru memeriksa rentang yang dikonfirmasi; rencana model yang mengubahnya ditolak sebelum disimpan. Rekaman/durasi tidak dipotong oleh fitur usulan. Perubahan input menandai usulan usang.

Terbukti unit: exact tiling, durasi sasaran, no timing, gaps dan stale rejection; UI: proposal tidak tersimpan sebelum diterima dan durasi audio tidak berubah. Pengujian ini tidak menjalankan unduhan model Whisper atau menyelaraskan audio baru secara live.

## Fase 5 — era dan caption

Kandidat tahun, abad dan SM/M berasal dari timestamp kata. Label tetap usulan sampai diterima, berupa text overlay native kuning/outline di pusat selama 1–2 detik. Label tahun dari komposer tidak otomatis dimasukkan ke editor; pengguna menyetujuinya melalui panel. Caption putih dengan sorotan hijau memakai aturan deterministik angka/nama/daftar istilah, dengan pratinjau dan ekspor yang sama. Aturan kata dapat diedit per proyek. Editor caption/overlay yang sudah ada tetap menyediakan penyesuaian posisi dan waktu.

Terbukti unit dan UI: kandidat, warna, posisi, timing absolut, persetujuan dan persistensi caption. Kualitas keterbacaan pada seluruh video proyek pengguna belum ditinjau dalam pengujian fixture.

## Fase 6 — cue SFX opsional

Peta kata/kategori/aset/volume tersimpan per proyek. Cue usulan memakai milidetik absolut proyek, maksimal -12 dB. Pengguna mengimpor sendiri, mengisi manifest, memilih aset pada aturan, menerima atau menghapus cue; cue diterima bisa digeser/dihapus pada panel SFX lama. Tidak ada downloader atau scraping. Manifest wajib mencakup source, url, license, attribution, author, downloadedAt dan SHA-256 yang dihitung aplikasi. Ekspor MP4/CapCut memeriksa manifest/hash dan menulis atribusi. Metadata pengguna tidak membuktikan kepemilikan hak; aplikasi memvalidasi kelengkapan dan integritas file.

Terbukti: timing/cap volume, missing manifest, field kosong, hash mismatch dan ekspor berlisensi dengan sidecar. SFX referensi tidak terbukti dan tidak diklaim ditiru. Tidak ada unduhan Freesound/Pixabay/Mixkit yang diimplementasikan; syarat API downloader belum dievaluasi karena jalur yang dipilih impor manual.

## Fase 7 — gambar internet opsional

Jalur impor manual dan pencatatan manifest tersedia, dengan Wikimedia Commons sebagai sumber referensi/properti yang disarankan dalam UI. Tidak ada pencarian/unduhan otomatis atau API yang mengambil berkas. Gambar internet memerlukan tanggal retrievedAt dan lisensi terbuka yang didukung (CC0/domain publik/CC-BY/CC-BY-SA). Aset gambar lokal yang digunakan dalam output perlu deklarasi provenance, termasuk karya sendiri, agar asal yang belum diklasifikasikan tidak lolos diam-diam. Kewajiban ShareAlike ditulis pada atribusi. Pengguna memeriksa halaman sumber dan izin orang yang dapat dikenali.

Terbukti unit/integrasi: lisensi tak jelas, tanggal hilang dan manifest kosong ditolak. Verifikasi lisensi langsung ke Commons atau izin model orang tidak dilakukan otomatis.

## Fase 8 — studi EffectCraft

Lihat `effectcraft-notes.md`. Pemeriksaan sumber resmi menemukan koreksi penting: `crates/model` berisi model 3D; kontrak dokumen komposisi berada di `crates/project`. Ide hold, pemisahan waktu dan backend diadopsi tanpa menyalin kode. Tidak ada dependensi render baru atau klaim paritas After Effects. Skill REA mengarahkan sumber lengkap ke kajian sumber biasa; runtime EffectCraft tidak diuji.

## Pengujian akhir dan checkpoint

`test:cutout-v5`, `test:cutout-v5-integration`, tes UI React/Electron, typecheck dan regresi pipeline dijalankan. Hasil terinci disimpan di outputs/cutout-v5 pada workspace Codex; ringkasan final harus dibaca bersama hasil terakhir, bukan menganggap baseline gagal sebagai kegagalan build akhir. Tes negatif memang mencetak error yang diharapkan. Cadangan sebelum perubahan, hash pemasangan dan catatan fase berada di work/cutout-v5. E:\BANG bukan repository Git; tidak dibuat commit palsu atau repository Git baru.

Keputusan pengguna berikutnya: pilih usulan shot/era/SFX yang diterima, isi sumber/lisensi media impor, dan tinjau hasil artistik proyek. Tidak ada persetujuan generasi berbayar diminta atau diasumsikan selama pengembangan.

## Hasil akhir yang benar-benar dijalankan

| Pemeriksaan | Hasil terakhir |
| --- | --- |
| Unit v5, Fase 1–7 | 19 lolos |
| Integrasi v5: readiness, default, persetujuan shot, manifest, MP4 dan CapCut | 8 lolos |
| UI React/Electron dengan CSS build akhir | 6 lolos |
| Direction policy + integration | 14 + 5 lolos |
| Shot motion | 11 lolos |
| Visual → Produksi | 5 lolos |
| Produksi 8 klip / 24 shot | 7 lolos |
| Editor automation | 21 lolos |
| Loop perbaikan komposisi | 7 lolos |
| Produksi Cutout dan kontak | 15 lolos |
| SFX | 8 lolos |
| Full-motion per shot / resume | 7 lolos |
| Typecheck dan build | Lolos; bundler memberi peringatan impor dinamis yang juga statis |
| Restart normal dan pembacaan ulang runtime | Jendela terlihat; 15 proyek/revisi/inventaris utuh, job aktif 0 sebelum restart |

Pembacaan MCP proyek troli sebelum restart mengonfirmasi 24 klip video, 0 videoAssetId, 1 Cutout, 24 word timings, transisi cut 16 / fade 5 / slideleft 3. Tidak ada migrasi atau edit otomatis pada data proyek tersebut. Tombol Ubah ke Cutout dan persetujuan usulan memerlukan klik pengguna.

Belum diuji: kualitas artistik konten baru dengan aset realistis pengguna, generasi video/gambar/TTS live, alignment Whisper pada rekaman baru, sumber/lisensi online setiap aset pengguna, dan runtime EffectCraft. Downloader SFX/Commons sengaja tidak dibuat; jalur opsionalnya impor manual. Commit Git tidak tersedia karena folder aplikasi bukan repository Git; backup/hash disediakan. Tidak ada keputusan atau izin yang menghalangi build yang sudah terpasang.
