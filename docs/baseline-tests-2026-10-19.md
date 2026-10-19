# Baseline dan verifikasi Cutout v6 — 19 Oktober 2026

Checkout awal `1cad6c2` bersih; branch kerja `codex/cutout-v6-clip-workflow`. Seluruh tes memakai fixture/provider terkontrol, tidak menulis proyek pengguna, tidak mengirim request media berbayar.

| Perintah | Sebelum perubahan | Durasi awal | Sesudah perubahan |
|---|---|---:|---|
| `npm install` | PASS | 5 dtk | PASS — langkah persiapan satu kali; lockfile tercatat |
| `npm run typecheck` | PASS | 16 dtk | PASS (20 dtk) |
| `npm run test:autoedit-klip1` | PASS | 7 dtk | PASS (7 dtk) |
| `npm run test:cutout-permanent` | PASS | 5 dtk | PASS (16 dtk) |
| `npm run test:editor-automation` | PASS | 2 dtk | PASS (9 dtk) |
| `npm run cutout:dry-run` | PASS | 1 dtk | PASS (5 dtk) |

Pemeriksaan tambahan:

| Perintah | Hasil | Durasi |
|---|---|---:|
| `npm run test:cutout-v6` | PASS | 32 dtk |
| `npm run test:cutout-v6-ui` | PASS | 21 dtk |
| `npm run test:cutout-v5` | PASS | 2 dtk |
| `npm run test:direction` | PASS | 13 dtk |
| `npm run test:cutout-prefill-impact` | PASS | 4 dtk |
| `npm run test:cutout` | PASS | 1 dtk |
| `npm run test:mcp` | PASS | 1 dtk |
| `npm run test:sfx` | PASS | 2 dtk |
| `npm run test:cutout-advanced` | PASS | 2 dtk |
| `npm run test:cutout-assets` | PASS | 17 dtk |
| `npm run test:cutout-production` | PASS | 18 dtk |
| `npm run test:composition-repair-loop` | PASS | 21 dtk |
| `npm run test:shot-motion` | PASS | 1 dtk |
| `npm run test:shot-production` | PASS | 42 dtk |
| `npm run test:cutout-visual` | PASS | 16 dtk |
| `npm run test:cutout-v5-integration` | PASS | 10 dtk |
| `npm run build` | PASS | 33 dtk |

Log lengkap tersedia di workspace `outputs/naraflow-v6/baseline/`, `final/`, `regression/`, dan `build-final/`. Dua regresi sempat terdeteksi dan telah diperbaiki: inventaris fixture ekspor menghilangkan projectId (ownership asing eksplisit tetap ditolak); tes arah lama mengharapkan builtin versi 5 (sekarang menguji v6 serta snapshot aturan legacy secara terpisah tanpa menghapus tes).

Tidak ada kegagalan baseline sebelum perubahan. Error provider/cancellation yang tercetak dalam beberapa tes adalah fixture yang sengaja diuji. Warning ukuran bundle/dynamic imports dari build bukan kegagalan.
