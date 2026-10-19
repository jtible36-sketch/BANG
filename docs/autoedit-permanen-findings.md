# Edit otomatis permanen, Scene Brief dan profil Komedi getar

Tanggal: 19 Oktober 2026. Aplikasi: E:/BANG. Perluasan terhadap perbaikan klip 1 sebelumnya, dengan bukti dan fixture terpisah. Tidak ada media gambar/video/TTS berbayar dibuat atau di-regenerate selama pengembangan. Keenam revisi proyek asli dibaca ulang dan tetap sama. Tidak ada tool tulis MCP dipanggil.

## Diagnosis: terbukti dan dugaan

| Klip / tahap | Terbukti dari data, log atau tes | Batas bukti |
| --- | --- | --- |
| Klip 1 — validasi rencana / recovery | Job d1723485-b4f7-45ae-83ed-f48d6a289124 tetap menyimpan error historis tools. Perbaikan sebelumnya direproduksi ulang melalui test:autoedit-klip1: raw request recovery tools pada 1 ms ditambahkan ke grup static. Error lama bukan bukti perbaikan kode tidak terpasang; riwayat failed tidak ditulis ulang. Baseline baru berhasil pada fixture klip 1 tanpa model. | Raw request recovery tersimpan; full respons model historis tidak tersedia. Lihat autoedit-klip1-findings.md dan fixture aslinya. |
| Klip 1 — komposisi lebih baru | Job edfd3ffd-3d9c-4248-8261-f17b29625fd3 merekam reviewer melihat tools terpotong di tepi bawah. Ini konsisten dengan masalah penempatan; aset palu tersedia. | Itu temuan reviewer sampel frame, bukan pemeriksaan semua frame atau sertifikasi kontak. |
| Klip 3 — perencanaan | Job dd02881f-7c91-4f12-a5e7-11f745db38cd gagal: “Karakter aset harus berasal dari proyek ini.” characterIds kosong, visual meminta perempuan pekerja dapur 40 tahun, proyek hanya mempunyai Thomas/Edward/Clara/Maya. Preflight baru needs-character dengan usulan yang belum disetujui. | Raw JSON model yang memuat characterId salah tidak tersimpan. Hubungan karakter belum terdefinisi dengan keluaran ID model salah masuk akal, tetapi ID persisnya tidak diketahui. Jangan menyatakan model tidak pernah dipanggil. |
| Klip 4 — tidak terbukti gagal | Snapshot berisi 5/5 aset, stale false. Tidak ditemukan job failed untuk clipId ini pada seluruh riwayat proyek yang dibaca. Baseline fixture valid. | Pesan asli yang dilihat pengguna belum ada; penyebab kegagalan klip 4 tidak dikarang. |
| Klip 9 — generasi | Item opener_can belum punya aset. Job b6fa2d6b-d53a-4785-8300-2ce319e80428 failed pada progress .88, error serverOverloaded: model at capacity. Job 7015b175-6c00-4662-b099-e96d4ad43413 selanjutnya canceled. Batch 40ec8135-29e6-477a-9cf4-eb93b8ca7b6b menyimpan 24/25 selesai, satu gagal. | Canceled tidak menghapus error failed sebelumnya. Tidak ada bukti gambar opener_can sudah dihasilkan. Retry memerlukan konfirmasi kuota baru. |
| Repair planner lain — skema | Job 7ab83cf1-aa55-4561-ae0c-69160e877496 dan a13ac7f4-7191-45bd-a1fb-eac24bb70e56 menyimpan API 400: required shot properties melewatkan beat. Schema repair kini mewajibkan seluruh properti; normalizer masih bisa membaca director legacy. | Tidak ada request provider nyata dipakai untuk mengetes skema baru; struktur required diuji lokal. |
| Riwayat job | getBundle sebelumnya hanya memasukkan job aktif atau diperbarui 10 menit terakhir. cutoutAssetState mengambil dari view itu sehingga jobs:[] bukan bukti tidak pernah ada job. Kini query khusus riwayat klip mengambil job hingga 1000 entri terbaru. | Batas riwayat 1000/klip ditujukan UI; get_job tetap dapat membaca ID lama secara langsung. |
| planningKey / usage | Beberapa paket tidak memiliki usage/plannerVersion. Versi planner kini eksplisit dan upgrade metadata tersedia. | Perbedaan planningKey saja tidak membuktikan versi atau umur planner; jangan menyimpulkan kronologi hanya dari hash. |

Raw snapshot dan riwayat tersanitasi: tests/fixtures/cutout-projects-readonly.json dan cutout-jobs-readonly.json. Tidak menyertakan settings/API key. Pembacaan SQLite menggunakan mode=ro dan hanya tabel job proyek target.

## A — penyelesaian per klip, baseline, migrasi, preflight

- Default Edit otomatis cutout-facts kini komposer dasar lokal, tanpa model dan tanpa generasi media. Layer background, karakter/pose, properti/foreground, hold pada batas shot dan push singkat sesuai director. Timestamp scene bulat, durasi floor tanpa mengubah rekaman; maksimal 64 layer dan dua mover efektif. Jika static memiliki beberapa varian, baseline memakai hold dengan peringatan, tidak menaikkan motionRole.
- Status per klip: ready, needs-assets, needs-character, needs-special-clip, invalid-plan, done, failed. Coordinator dapat selesai dengan ringkasan **N done / M perlu tindakan**; status klip yang terblokir tidak disamarkan sebagai done. Hasil klip valid diterapkan sendiri melalui transaksi editor; kegagalan klip berikutnya tidak membatalkannya. Status proyek tidak diubah oleh kegagalan. Callback/revisi editor tetap dijaga.
- Penyempurnaan Codex opsional: usulan → validator → satu repair. Usulan tetap ditolak bila melanggar registry/motionRole/asset ownership/timing/mover. Baseline tetap dipakai bila usulan ditolak, dengan alasan eksplisit. Tidak ada generate gambar lewat refinement.
- Retry hanya melewati klip done yang fingerprint narasi/identitas/timing/rencana/profil dan scene-nya masih cocok. Klip berubah diperiksa ulang; tidak ada skip berdasarkan status done lama saja. Unit timing baseline tidak diveto oleh rekaman klip lain; validator jalur lama tetap memakai pemeriksaan sebelumnya.
- layerKey diturunkan oleh kode, bukan dipercayakan ke nama model. Canonical locationKey menyamakan dash/en-dash/separator/case dan alias bahasa yang bisa diedit. Reuse lintas klip hanya dari background yang pengguna tandai approved. Background lokasi/era sama yang needs-review membuat request berikutnya berhenti dengan tindakan review, tanpa membuat duplikat.
- Upgrade planner v6 mempertahankan planId, itemId, sourceHash dan file gambar. Paket lama ditandai legacy/outdated; UI menawarkan Perbarui rencana tanpa gambar baru. **Upgrade klip 1 diterapkan dan diverifikasi pada snapshot/fixture, bukan ditulis ke database pengguna selama development read-only.** Pengguna menjalankan tombol upgrade saat membuka build baru.
- Preflight menampilkan rencana, item kurang, error item lama, status karakter, kebutuhan klip khusus, review aset, versi planner dan tindakan. Kandidat review mewarisi grup/peran dan tidak menjadi pose otomatis. Kebutuhan special clip tetap jujur: baseline hold bukan bukti aksi kontinu telah diproduksi.

## B — Scene Brief dan konfirmasi kredit

- Brief dibangun dari narasi dan words[]: era/lokasi eksplisit, tokoh proyek, pakaian referensi, properti yang disebut, bukti kata dan waktu. Waktu/cuaca yang tidak disebut ditandai usulan. Lokasi storyboard tidak otomatis dianggap bukti narasi.
- Bayangkan/sapaan/topik baru memerlukan konfirmasi lokasi. Kontinuitas hanya dipakai pada frasa eksplisit yang mendukungnya. Klip 2 dan 6 uji terdeteksi lokasi tidak pasti.
- Kamus era/alias lokasi dan daftar Avoid ditampilkan sebagai peringatan yang dapat diedit. Larangan “Avoid: ring pull” bukan bukti cincin tarik benar-benar ada. Pemeriksaan ini bersifat editorial berbasis aturan, bukan verifikasi sejarah otomatis.
- Pekerja baru tidak dibuat sebagai karakter atau identity sheet diam-diam. Pengguna memilih/menambah tokoh, memperbaiki Brief lalu menyetujui; modal identity sheet meminta konfirmasi kuota tersendiri.
- Scene Brief yang disetujui diperlukan sebelum planner Cutout dan generasi media. Tabel menampilkan item kurang dan perkiraan jumlah gambar; dialog konfirmasi menyebut item/klip konkret. Izin terikat pada isi item + planId + Brief; dikonsumsi per pengiriman. Gagal provider memerlukan konfirmasi ulang; item selesai selalu dipakai kembali. Flow yang status pengirimannya belum pasti tetap memakai jalur recovery lama.
- Aset approved ditandai eksplisit sesudah melihat preview Visual. Ini review pengguna, bukan pemeriksaan piksel oleh parser. Label needs-review tetap jujur pada aset yang baru dibuat.

## C — profil terpisah Komedi getar

profiles/comedy-jolt.json tetap **verified:false** dengan parameter gaya null: amplitudo, frekuensi, durasi, peluruhan, sumbu, batas getar, zoom dan anggaran. Tiga referensi 8LjOuPhYO3I / AFJEO_gBYXg / 0_eDRQfEVO8 tidak dianalisis; tidak ada angka gaya yang diklaim berasal dari video tersebut.

Mesin berisi jolt, punch-zoom, hard-cut-jolt dan reaction-swap, berbasis transform/camera/pose yang sudah didukung. Seed deterministik, linear/hold, integer ms, jolt kembali tepat ke rest lalu hold, batas amplitudo/durasi/count/anggaran dan maksimum 8192 key/layer. Getaran dihitung sebagai mover; batas dua mover efektif tetap dipertahankan. Cue mengikuti indeks kata rekaman; hard-cut-jolt wajib tepat pada cut/onset kata. Reaction pose harus milik layer yang sama. Nilai uji sintetis dipisahkan dari file profil pengguna.

Pilihan profil eksplisit per proyek; v5 default stabil dan seluruh aturan/angka v5 tetap ada. Jalur getar memiliki validator sendiri dan tidak mematikan pemeriksaan v5 untuk proyek yang memakai v5. Preview lokal 5 detik tersedia setelah file profil diisi/verified; tombol dinonaktifkan saat masih unverified. Kualitas gaya referensi belum diuji.

## Hasil dry-run lintas proyek

| Proyek | Klip | Baseline valid | Status |
| --- | ---: | ---: | --- |
| Makan Siang yang Butuh Pahat | 10 | 5 | 5 ready, 1 needs-character, 4 needs-assets |
| Porselen Rapuh, Solusinya Mesin Besar | 8 | 8 | 8 ready |
| Dokter yang Tak Mau Menunggu Kiriman Es | 8 | 8 | 7 ready, 1 needs-character |
| Pintu Kecil di Balik Troli yang Bersarang | 24 | 1 | 1 ready, 22 needs-assets, 1 needs-character |
| Mengapa Sepeda Turun dari Roda Raksasa? | 24 | 5 | 5 ready, 19 needs-assets |
| Biru: Warna yang Terlambat Datang | 18 | 1 | 1 ready, 17 needs-assets |

92 klip, 0 crash tak tertangani. Seluruh **28 klip dengan paket aset lengkap** mempunyai baseline yang lolos normalizer scene dan batas mover. Satu di antaranya tetap needs-character walau baseline strukturnya tersedia; identitas tidak dianggap disetujui secara otomatis. Ini fixture metadata asli, bukan render piksel dari 92 klip asli.

Tabel per proyek DAN per klip, ID, item kurang, status dan alasan tersedia di [autoedit-permanen-dry-run.md](autoedit-permanen-dry-run.md); data lengkap di autoedit-permanen-dry-run.json.

Perintah read-only di E:/BANG:

~~~powershell
rtk npm run cutout:dry-run -- tests/fixtures/cutout-projects-readonly.json
~~~

Command hanya membaca fixture dan menjalankan modul pure; tidak mengimpor DB/provider/MCP. Menambah argumen path output menulis laporan saja.

## Berkas, tes, hasil dan yang belum diuji

| Bagian | Berkas utama | Bukti tes | Belum diuji / batas |
| --- | --- | --- | --- |
| A1 diagnosis/history | cutout-assets.ts; naraflow-mcp.ts; dua fixture readonly | Job lama tetap terlihat setelah 10 menit; original capacity error; raw clip data | Error asli klip 4 tidak ditemukan; raw respons model klip 3 tidak tersimpan |
| A2 baseline/isolation/refinement | shared/cutout-permanent.ts; main/cutout-baseline-automation.ts; editor-automation.ts; cutout-studio.ts | Complete/missing clip campuran; baseline tanpa model; dua usulan invalid memakai fallback; retry/fingerprint; status proyek tidak berubah | Rendering artistik produksi proyek pengguna belum dijalankan ulang |
| A3 canonical/migration/reuse | cutout-permanent.ts; cutout-assets.ts; cutout-studio.ts | Dua kunci dek dan dua kunci dapur menjadi sama; era berbeda tetap terpisah; approved-only reuse; plan/file IDs tetap | Upgrade DB pengguna belum dilakukan selama mode pengembangan baca-saja; klik Perbarui rencana di UI |
| A4/A5 status/preflight/errors | CutoutStudioPanel.tsx; CutoutVisualStep.tsx; AutoEditPanel.tsx; cutout-director.ts | Status/counter/aksi terlihat di UI; required schema memuat beat dan semua properti; tes validator klip 1 tetap lulus | Tidak membuktikan seluruh komposisi historis terlihat benar |
| A6 dry-run | scripts/cutout-dry-run.cjs; fixtures; cutout-permanent.test.ts | 6 proyek / 92 klip / 28 baseline valid / 0 crash; readonly input tidak dimutasi | Pemeriksaan file/piksel asli bukan bagian command fixture |
| B Brief/era/cast/credit | cutout-permanent.ts; cutout-studio.ts; CutoutStudioPanel.tsx; CharacterModal.tsx; ipc/preload/api | Lokasi tidak pasti; era warnings; consent nol provider sebelum approved; item selesai reuse; consent habis sesudah failed request | Heuristik ekstraksi sederhana; pengguna perlu mengedit data yang tidak eksplisit. Tidak ada identity sheet/media berbayar diuji |
| C engine/profile/preview | comedy-jolt.ts; profiles/comedy-jolt.json; CutoutStudioPanel.tsx; cutout-v5.ts | Determinisme seed; amplitudo; rest/hold; integer/schema; count/key budget; max2; invalid cue/overlap; UI unverified | Angka referensi belum tersedia. Preview gaya terkalibrasi tidak diklaim selesai; hanya engine sintetis dan gate UI |

Tes baru: 13 unit + 10 integrasi dalam test:cutout-permanent, termasuk dry-run fixtures. UI React/Electron: 7 pemeriksaan. Matriks regresi termasuk typecheck, klip1, direction, shot-production/motion, cutout-production, repair-loop, cutout-assets/visual, v5/integration, editor, SFX. Seluruh provider pada tes adalah stub/fixture; media uji yang dirender memakai gambar sintetis dan profil SQLite terisolasi.

Suite historis sekarang secara eksplisit memilih jalur agen opsional saat menguji kontrak lama. Consent fixture pada runner lama terisolasi; suite baru mengetes gerbang consent produksi yang sebenarnya tanpa bypass. Fixture reuse memberi persetujuan eksplisit pada plate sintetis; tes cleanup yang sengaja meminta gambar baru mengubah prompt fixture secara eksplisit, karena pengiriman ulang item selesai sekarang memang dilarang.

Tidak ada repository Git di E:/BANG, sehingga commit Git tidak diklaim. Snapshot sebelum edit, SHA-256, staging per bagian dan installer penjaga perubahan eksternal disimpan di work/autoedit-permanen pada workspace Codex. Data proyek pengguna dibaca saja; enam revision hash tetap sama. Aplikasi berjalan tidak ditutup paksa. Buka ulang Naraflow untuk memuat build baru.
