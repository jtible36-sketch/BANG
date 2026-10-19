# Baseline dan verifikasi Cutout v6 — 19 Oktober 2026

Checkout awal: `1cad6c2`, bersih sebelum npm install. Semua perintah memakai fixture, bukan API media berbayar atau proyek pengguna.

| Perintah | Sebelum | Durasi | Sesudah |
|---|---|---:|---|
| `npm install` | PASS | 5 dtk | menunggu verifikasi akhir |
| `npm run typecheck` | PASS | 16 dtk | menunggu verifikasi akhir |
| `npm run test:autoedit-klip1` | PASS | 7 dtk | menunggu verifikasi akhir |
| `npm run test:cutout-permanent` | PASS | 5 dtk | menunggu verifikasi akhir |
| `npm run test:editor-automation` | PASS | 2 dtk | menunggu verifikasi akhir |
| `npm run cutout:dry-run` | PASS | 1 dtk | menunggu verifikasi akhir |

Log baseline lengkap disimpan di workspace `outputs/naraflow-v6/baseline/`. `npm install` memperbarui package-lock.json; tidak ada source yang diubah sebelum seluruh baseline selesai.

Temuan awal **terbukti**: UI memilih scope project untuk Cutout; jalur UI baseline sudah memisahkan hasil per klip. Status gagal seluruh proyek pada jalur agent bukan jalur default UI. Detail penyelesaian T0–T7 dicatat pada laporan akhir.
