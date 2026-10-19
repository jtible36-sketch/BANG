# Hasil perbaikan Naraflow T0–T7

Tanggal: 19 Oktober 2026. Dasar: commit 1cad6c2. Semua temuan di bawah bertanda **terbukti** berasal dari source, tes fixture, atau log; kondisi proyek live yang tidak dibaca adalah **belum diuji**, bukan dianggap sama dengan fixture.

| Tugas | Berkas utama yang berubah | Tes / bukti | Hasil dan batasan |
|---|---|---|---|
| T0 | docs/baseline-tests-2026-10-19.md; package-lock.json | npm install, typecheck, autoedit-klip1, permanent, editor-automation, dry-run sebelum perubahan | **Terbukti:** semua baseline PASS sebelum source diedit. |
| T1 | renderer/.../editor/AutoEditPanel.tsx | test:cutout-v6-ui | **Terbukti:** default clip, label cakupan jelas, tanpa pilihan tombol run nonaktif dengan alasan. Dropdown project tetap tersedia. |
| T2 | shared/cutout-orphans.ts; main/cutout-orphans.ts; main/cutout-assets.ts; main/cutout-studio.ts; shared/cutout-permanent.ts; main/editor-automation.ts; API/IPC/preload; CutoutOrphanPanel.tsx dan dua panel Cutout | test:cutout-v6 (10 aset fixture, item cocok, konfirmasi, file hash tetap, owner asing, reuse yatim/arsip); UI banner/arsip | **Terbukti:** tidak menghapus aset atau file. Tautkan mengharuskan itemId/role sesuai, target terkini, tanpa menimpa item yang telah terisi; status needs-review. Arsip hanya meta. Auto-edit dan reuse background mengabaikan orphan/arsip. Data live tidak dimutasi. |
| T3 | main/jobs.ts; generation.ts; editor-automation.ts | test:cutout-v6 startup, worker aktif dan ownerless | **Terbukti:** startup memanggil resumeJobs; sebelumnya job non-remote ditandai failed, bukan canceled. Kini job Cutout ownerless dibatalkan dengan pesan; controller queued/running tetap dihormati. Flow recovery dan preset lain tetap jalur lama. |
| T4 | shared/cutout-preview.ts; main/cutout-preview.ts; main/exporter.ts; CutoutClipPreview.tsx; CutoutStudioPanel.tsx; API/IPC/preload | test:cutout-v6 lengkap, sebagian, kosong, nol job/outcome; UI preview | **Terbukti:** hasil kind preview tersimpan terpisah, placeholder virtual abu-abu itemId/label, tidak ada job auto-edit, tidak menulis done. startExport menolak preview placeholder yang belum diproduksi; placeholder juga tidak ada dalam inventaris untuk diterapkan. |
| T5 | shared/cutout-permanent.ts; CutoutStudioPanel.tsx | test:cutout-v6 seluruh status punya action/actionTarget | **Terbukti:** setiap status punya satu tombol tujuan; peningkatan metadata rencana legacy dikonfirmasi tanpa gambar baru. |
| T6 | shared/cutout-master-v6.json; cutout-facts.ts; cutout-facts-v5.ts; master-prompts.ts; cutout-reference-profile.ts; repo.ts; cutout-shot-rules.ts; CutoutMasterUpgrade.tsx; ProjectHeader.tsx; CutoutBriefSetup.tsx; AutoEditPanel.tsx; CutoutVisualStep.tsx; cutout-composition-review.ts | test:cutout-v6 source tunggal, 12 heading unik, enam stage; legacy null/explicit, caption none dipertahankan, tujuh preset lain; UI upgrade/cancel; test:direction legacy | **Terbukti:** sourceText sama dengan dokumen terlampir; v6 stage singkat mengacu satu sumber dan runtime tidak menambahkan blok v4/v5. Proyek baru menyimpan snapshot v6 + standard + karaoke. Proyek lama tanpa snapshot dibaca sebagai legacy v5 tanpa write, snapshot eksplisit dipertahankan; badge v5→v6 hanya mengubah setelah konfirmasi. Profil PNG masuk/getar dan comedy-jolt tetap terpisah. |
| T7 | .gitignore; docs/cutout-module-map.md; docs/codex-backups-tracked.txt; scripts/cutout-dry-run.cjs | inventaris 27 shared cutout-*; daftar Git; dry-run dengan orphan report | **Terbukti:** .codex-backups/ ditambahkan ignore; 405 file dalam 24 direktori backup sudah tracked dan tidak dihapus/untrack. Peta menandai tumpang tindih tanpa refactor perilaku. |

Tes baru terpusat di tests/cutout-v6.integration.ts dan tests/cutout-v6-ui.electron.cjs, dengan runner scripts/test-cutout-v6-integration.cjs dan scripts/test-cutout-v6-ui.cjs. Fixture UI menampilkan komponen React aplikasi yang sebenarnya di Electron terisolasi. Generator dalam tes dibuat gagal bila terpanggil secara tak diharapkan.

Lihat [baseline-tests-2026-10-19.md](baseline-tests-2026-10-19.md) untuk hasil tiap perintah, [cutout-v6-dry-run.md](cutout-v6-dry-run.md) untuk status 92 klip dan tujuh aset yatim yang terdeteksi di inventaris Porselen, serta [codex-backups-tracked.txt](codex-backups-tracked.txt) untuk semua path backup tracked. Data JSON dry-run lengkap disimpan pada workspace outputs/naraflow-v6/dry-run.json.

## Yang belum diuji / tidak dilakukan

- Tidak mengubah atau mengarsipkan aset pada proyek pengguna; aksi tautkan/arsipkan tetap keputusan pengguna di UI.
- Tidak generate gambar, suara, atau video baru, tidak memanggil API media berbayar, tidak mengirim pesan eksternal, tidak menulis proyek lewat MCP.
- Kesamaan piksel/penyutradaraan dengan referensi dan kualitas aset aktual belum diuji; pemeriksaan struktur tidak menjamin video identik. Tidak menebak parameter comedy-jolt.
- Backup tracked tidak dihapus atau git rm. Menambah ignore tidak menghapusnya dari riwayat.
- Perbaikan tidak mengubah validator cutout-director atau melonggarkan batas dua mover. Default standar v6 adalah alias stabil; profil v5 dan opt-in PNG tetap dipertahankan.
- Perubahan berada di branch lokal codex/cutout-v6-clip-workflow; tidak dipush, tidak dipublish.
