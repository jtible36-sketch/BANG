# Dry-run Cutout v6

**Terbukti melalui fixture ekspor baca-saja**, bukan audit database live. Enam proyek, 92 klip, tidak ada crash tak tertangani. Baseline berarti struktur komposisi valid; bukan sertifikasi fakta, alpha, wajah atau kualitas piksel. Satu klip needs-character memiliki baseline struktural tetapi tetap diblokir sampai karakter ditetapkan.

| Proyek | Klip | Status | Baseline valid | Aset yatim |
|---|---:|---|---:|---:|
| Makan Siang yang Butuh Pahat | 10 | ready: 5, needs-character: 1, needs-assets: 4 | 5 | 0 |
| Porselen Rapuh, Solusinya Mesin Besar | 8 | ready: 8 | 8 | 7 |
| Dokter yang Tak Mau Menunggu Kiriman Es | 8 | ready: 7, needs-character: 1 | 8 | 0 |
| Pintu Kecil di Balik Troli yang Bersarang | 24 | ready: 1, needs-assets: 22, needs-character: 1 | 1 | 0 |
| Mengapa Sepeda Turun dari Roda Raksasa? | 24 | ready: 5, needs-assets: 19 | 5 | 0 |
| Biru: Warna yang Terlambat Datang | 18 | ready: 1, needs-assets: 17 | 1 | 0 |

## Makan Siang yang Butuh Pahat

Project ID: `a2a6e08d-e5e4-48bb-a0bf-97d9132585c4`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Bekal dan Perkakas | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Sendok Belum Berguna | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 3. Mundur ke Masalah Awal | needs-character | true | false | Pilih atau tambah tokoh di Visual |
| 4. Solusi Wadah Logam | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 5. Panas dan Tutup Rapat | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 6. Membuka dengan Tenaga | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 7. Bilah Khusus | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 8. Praktis, tetapi Tajam | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 9. Roda Mengikuti Bibir | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 10. Sendok Akhirnya Menang | ready | true | true | Buka Produksi untuk menyusun klip ini |

## Porselen Rapuh, Solusinya Mesin Besar

Project ID: `0396be12-c834-4705-9c0b-20726976de2a`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Khawatir Porselen Rusak | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Mencari Cara Lain | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 3. Gagasan Masuk Bengkel | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 4. Rak Memegang Piring | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 5. Air yang Bekerja | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 6. Bukan yang Pertama | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 7. Menuju Dapur Hotel | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 8. Rapuh Bertemu Besar | ready | true | true | Buka Produksi untuk menyusun klip ini |

Aset yatim pada inventaris fixture:

| assetId | clipId lama | itemId | Arsip |
|---|---|---|---|
| `5b2c8fe5-bfdc-415b-8653-efed52ac6155` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `diningroom_1880s_plate` | false |
| `fd9d91fe-c510-4514-9c39-1ded4075b051` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `josephine_inspecting` | false |
| `76eebf22-4590-4e27-8aef-c5353b4220e9` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `josephine_worried` | false |
| `e319df94-18a9-4d73-bc5b-a581065aacfc` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `chipped_porcelain_plate` | false |
| `6b1b340b-7e13-45b3-bd72-42f471c664cd` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `dining_table_foreground` | false |
| `2aef8ad5-c4af-4653-8886-433281d89ae0` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `review-bbe7b9317bc7a0961eae388dbc07` | false |
| `06d03ddf-4724-489d-8d23-4779bbf7e6eb` | `d140b0c0-8875-4015-8bb2-6ba9092b8200` | `review-c4b7e770bcd1b8c02c4196298614` | false |

## Dokter yang Tak Mau Menunggu Kiriman Es

Project ID: `688cd93f-29a6-4593-bc43-29642221366f`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Dingin dari Jauh | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Menunggu Kapal | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 3. Mencoba Membuat Dingin | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 4. Tekan, Lalu Buang Panas | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 5. Dingin Menjadi Es | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 6. Niat Baik, Teori Berbeda | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 7. Mesin Belum Berarti Sukses | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 8. Dingin Tanpa Menunggu Kapal | needs-character | true | true | Pilih atau tambah tokoh di Visual |

## Pintu Kecil di Balik Troli yang Bersarang

Project ID: `c2026ca2-b171-49c5-adcd-d1e0d8d2da8e`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Belakangnya Mengalah | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Rahasia di Belakang | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 3. Masalah Parkir | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 4. Mundur ke Model Awal | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 5. Angkat Dahulu | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 6. Lipat Kemudian | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 7. Pekerjaan Berulang | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 8. Beres Belanja, Belum Beres Kerja | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 9. Bengkel Kansas City | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 10. Tahun Pengembangan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 11. Bukan Dilipat | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 12. Dinding yang Bergerak | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 13. Dorongan Pertama | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 14. Jalan Terbuka | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 15. Masuk Berurutan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 16. Lantai Kembali Lega | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 17. Ambil dan Pakai | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 18. Masuk Toko | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 19. Tak Semulus Rodanya | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 20. Jejak dalam Arsip | needs-character | true | false | Pilih atau tambah tokoh di Visual |
| 21. Gagasan Lain | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 22. Jawaban Sederhana | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 23. Yang Mengalah Menang | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 24. Ajakan Penutup | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |

## Mengapa Sepeda Turun dari Roda Raksasa?

Project ID: `f0ee03d9-8607-4684-b88d-0ace648808b3`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Duduk di Ketinggian | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Bukan Sekadar Gaya | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 3. Pedal Langsung | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 4. Sekali Putar | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 5. Mengejar Kecepatan | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 6. Harga Ketinggian | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 7. Naik Dulu | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 8. Rintangan Kecil | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 9. Terjungkal | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 10. Salah Tujuan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 11. Mencari Jalan Keluar | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 12. Turunkan Sadel | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 13. Roda Mengecil | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 14. Masalah Kayuhan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 15. Rantai Menghubungkan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 16. Perbandingan Gigi | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 17. Tak Perlu Raksasa | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 18. Contoh Berpengaruh | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 19. Lebih Dekat Tanah | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 20. Ban Berisi Udara | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 21. Mengendalikan Laju | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 22. Bentuk yang Bertahan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 23. Turun demi Selamat | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 24. Ajakan Penutup | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |

## Biru: Warna yang Terlambat Datang

Project ID: `ead17e0a-1ca6-4b46-8e79-d9264a168f7f`.

| Klip | Status | Legacy | Baseline | Tindakan |
|---|---|---|---|---|
| 1. Biru Tertinggal | ready | true | true | Buka Produksi untuk menyusun klip ini |
| 2. Dua Warna Mendahului | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 3. Bukan Penutup | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 4. Dari Dalam Bahan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 5. Lompatan Lebih Besar | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 6. Kandidat Sulit | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 7. Kristal Bermasalah | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 8. Hambatan Berikutnya | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 9. Tiga Peneliti | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 10. Fondasi Kristal | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 11. Membuka Jalan | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 12. Jalur Nakamura | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 13. Biru Terang | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 14. Menuju Putih | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 15. Warna Bercampur | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 16. Hemat Energi | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 17. Masalahnya di Dalam | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
| 18. Ajakan Penutup | needs-assets | true | false | Tinjau kebutuhan aset di klip ini |
