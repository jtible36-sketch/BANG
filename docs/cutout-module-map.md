# Peta modul Cutout

Inventaris `src/shared/cutout-*` pada 19 Oktober 2026. Ini dokumentasi tanggung jawab, bukan perubahan perilaku atau usulan penggabungan otomatis.

| Modul | Tugas | Catatan |
|---|---|---|
| `cutout-alpha.ts` | Mendeteksi alpha asli atau memisahkan chroma magenta dari bitmap. | — |
| `cutout-assets.ts` | Skema kebutuhan aset, peran, kelompok, dan normalisasi item rencana. | tumpang tindih validasi grup dengan plan-diagnostics; skema tetap otoritas format. |
| `cutout-brief-prefill.ts` | Mengisi usulan visual per klip dari narasi, storyboard dan Brief proyek dengan sumber proposal. | tumpang tindih ekstraksi brief dengan permanent; fungsi ini hanya usulan tambahan, tidak menyetujui. |
| `cutout-direction-policy.ts` | Audit geometri komposisi, kontak, pemisahan layer, visibilitas, dan gerak efektif. | tumpang tindih audit mover dengan shot-rules; kebijakan ini memeriksa geometri sampel. |
| `cutout-direction-spec.ts` | Arahan panjang v5 yang tetap dipakai hanya untuk kompatibilitas snapshot/alur lama. | tumpang tindih kreatif historis dengan facts-v5; v6 tidak menyisipkan blok ini. |
| `cutout-director.ts` | Skema dan validasi rentang director, ID aset, timing rekaman dan registry mover. | tumpang tindih cakupan shot dengan shot-types; director memvalidasi rencana sebelum komposisi. |
| `cutout-easing.ts` | Fungsi easing deterministik serta pembatas nilai transform. | — |
| `cutout-facts-v5.ts` | Snapshot arahan dan tahapan lama agar proyek lama tetap memakai v5. | tumpang tindih kreatif historis dengan direction-spec; tidak menjadi sumber v6. |
| `cutout-facts.ts` | Metadata preset v6 dan rujukan singkat ke dokumen sumber tunggal. | — |
| `cutout-ik.ts` | Skema, urutan evaluasi dan solusi IK dua tulang untuk bagian tubuh terpisah. | — |
| `cutout-mask.ts` | Skema mask, interpolasi kontur dan hold perubahan topologi. | — |
| `cutout-master-v6.json` | Isi persis master prompt pengguna sebagai sourceText v6 tunggal. | — |
| `cutout-orphans.ts` | Deteksi aset dengan clipId lama dan penyaringan inventaris aktif tanpa I/O. | — |
| `cutout-permanent.ts` | Preflight status/tindakan, Scene Brief, normalisasi kunci, migrasi planner, dan komposer baseline lokal. | tumpang tindih perakitan layer dengan production; ini baseline deterministik yang mempertahankan batas mover. |
| `cutout-plan-diagnostics.ts` | Identitas grup, pewarisan motionRole, varian, jarak pose dan rekonsiliasi klaim aset hilang. | tumpang tindih audit rencana dengan director; diagnosis bukan pelonggaran validator. |
| `cutout-png-impact.ts` | Profil opt-in gerak masuk PNG, settle singkat, zoom objek/kamera, dan validator profil. | tumpang tindih transform dengan shot-motion; profil terpisah, v5 tidak berubah. |
| `cutout-preview.ts` | Komposisi pratinjau menggunakan aset tersedia dan placeholder virtual yang tidak masuk inventaris produksi. | tumpang tindih perakitan dengan permanent melalui reuse fungsi, bukan komposer kedua. |
| `cutout-production.ts` | Pilihan produksi, pencocokan aset per item, seed layer dan pembakingan frame. | tumpang tindih perakitan baseline dengan permanent serta gerak dengan shot-motion. |
| `cutout-reference-profile.ts` | Identifikasi preset, protokol narasi legacy, cakupan komposisi dan default caption. | tumpang tindih arahan legacy dengan facts-v5; runtime v4/v5 tidak disisipkan untuk v6. |
| `cutout-shot-motion.ts` | Menerapkan resep gerak terbatas, memotong scene per shot dan membuat overlay editor. | tumpang tindih transform dengan production; mempertahankan registry mover. |
| `cutout-shot-proposals.ts` | Usulan batas shot dari timing kata serta kandidat label, kata kunci dan cue SFX. | — |
| `cutout-shot-review.ts` | Ringkasan inspeksi struktur dan sampel frame per shot untuk panel Cutout. | tumpang tindih audit dengan direction-policy; tidak menyatakan sertifikasi piksel. |
| `cutout-shot-rules.json` | Parameter aturan stabil v5 untuk durasi, kamera, karakter dan mover. | Tidak diubah oleh tugas v6. |
| `cutout-shot-rules.ts` | Evaluator aturan gerak, hitungan mover efektif dan readiness aset/komposisi. | tumpang tindih audit mover dengan direction-policy; validator profil opt-in terpisah. |
| `cutout-shot-types.ts` | Kosakata serta skema metadata shot, placement dan overlay. | tumpang tindih metadata rentang dengan director pada tahap keluaran berbeda. |
| `cutout-timeline.ts` | Skema scene, layer, keyframe/pose, transform waktu dan evaluasi matriks preview/ekspor. | — |
| `cutout-visual.ts` | Kesiapan paket Visual dan tipe input antrean aset. | tumpang tindih readiness dengan shot-rules; ini kesiapan aset sebelum komposisi. |

Alur utama: Brief/permanent → assets/director → baseline permanent → opsional profil gerak → timeline → review/readiness → ekspor. `cutout-preview` memakai komposer yang sama tetapi menyimpan kind preview, tanpa menulis done atau aset virtual ke inventory.

Modul main terkait: `cutout-baseline-automation.ts` koordinator per klip; `cutout-assets.ts` job aset; `cutout-orphans.ts` tautkan/arsipkan terkonfirmasi; `cutout-preview.ts` penyimpanan hasil preview; `cutout-studio.ts` brief, izin kredit dan hasil; `editor-automation.ts` validasi revisi/apply/undo.
