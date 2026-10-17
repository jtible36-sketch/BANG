# Produksi Cutout dari Edit otomatis

Pada preset **Cutout · Fakta & Komedi v2**, panel **Edit otomatis** menyediakan **Generate aset yang dibutuhkan dan susun Cutout**. Pilihan ini aktif secara awal untuk gaya tersebut. Mode edit memakai aset tersedia tetap dapat dipilih dengan mematikan opsi itu.

1. Simpan proyek dan sinkronkan rekaman narasi. Pilih klip atau seluruh proyek.
2. Pilih provider gambar **Codex** atau **Flow MCP**, PNG alpha atau WebP lossless. Codex penyusun visual diperlukan untuk perencanaan serta komposisi. Provider gambar harus terhubung; Flow harus masuk dan membuka proyek.
3. Atur batas aset per klip (hingga 256) dan gambar baru per proses (hingga 2048). Nilai ini maksimum, bukan target untuk dihabiskan. Default 64 aset per klip dan 512 gambar baru per proses. Generate memakai akun/provider terpilih.
4. Pilih keyframe utama atau keyframe setiap frame, serta grid 30/60 fps. Isi arahan tindakan dan interaksi yang diinginkan, misalnya tangan di setang dan kaki mengikuti pedal. Klik **Generate aset & edit otomatis**.
5. Proses menyusun kebutuhan semua klip dalam cakupan terlebih dahulu. Bila kebutuhan baru melebihi batas proses, proses berhenti sebelum mengirim gambar; paket kebutuhan tetap tersedia di Cutout untuk ditinjau atau diedit. Naikkan batas atau gunakan cakupan satu klip.
6. Gambar yang belum tersedia dibuat berurutan. Seluruh hasil merupakan berkas terpisah dan terlihat pada **Cutout → Generate aset terpisah**. Varian pose satu objek memakai **grup layer / pose** yang sama dengan waktu berbeda. Background tidak berisi karakter yang akan digerakkan.
7. Komposisi mengelompokkan pose, melihat semua aset melalui lembar preview yang dipetakan ke ID, lalu menyusun layer, kamera, keyframe, parenting, mask dan IK yang sesuai. Semua komposisi dalam cakupan diterapkan bersama setelah tervalidasi; tidak ada ekspor otomatis.
8. Putar dan scrub hasil. Tinjau identitas, alpha, keselarasan pose, pivot, panjang anggota tubuh, kontak dan occlusion. Ekspor sampel sebelum final. Pilih FPS ekspor yang sesuai; pengaturan grid gerak tidak mengubah pilihan ekspor secara diam-diam.

## Melanjutkan proses

Jika provider gagal atau proses dibatalkan, gambar yang sudah selesai disimpan. Jalankan kembali dengan narasi, identitas, arahan, batas per klip dan mode gerak yang sama agar paket dan gambar selesai dipakai ulang. Perubahan sumber atau arahan dapat memerlukan paket baru. Batas gambar baru hanya menghitung gambar yang belum tersedia pada proses tersebut. Jika pengiriman Flow belum pasti, pulihkan di panel Cutout terlebih dahulu; jangan mengirim duplikat.

**Batalkan** menghentikan koordinator dan pekerjaan aset anak yang aktif. Komposisi belum disimpan bila tahap produksi gagal. **Batalkan edit otomatis terakhir** mengembalikan komposisi yang diterapkan, sementara aset hasil generate tetap tersedia. Edit manual saat produksi berjalan tidak ditimpa oleh hasil lama; simpan dan jalankan ulang.

## Kontak IK antarobjek

Di panel IK, **Target kontak mengikuti layer** mengikat ujung dua tulang ke titik gambar properti/layer lain. X/Y target menjadi koordinat relatif gambar target: 0% kiri/atas, 100% kanan/bawah. Titik mengikuti perpindahan, rotasi, skala dan kamera setiap frame. Weight/keyframe dapat mengurangi atau melepas kontak. Relasi target tidak boleh melingkar atau mengarah ke tulang sendiri/turunannya.

Rig membutuhkan gambar bagian atas/bawah yang terpisah, pivot dan panjang yang tepat. Target di luar jangkauan dijepit tanpa meregangkan gambar. Laporan akhir menyertakan diagnostik selisih kontak geometris pada grid frame, dengan patokan lebar 720 piksel. Ini mengukur ujung rig versus anchor yang disetel; bukan bukti bahwa anchor berada tepat di ujung jari/pedal pada gambar.

## Banyak pose dan frame

Satu komposisi mendukung 64 layer, 16 rantai IK, hingga 8192 keyframe/pose pada tiap track dan 256 gambar unik per klip. Banyak PNG pose dapat berbagi satu track. Penggantian pose mempertahankan timestamp yang direncanakan; mode setiap frame menyampel interpolasi gerak yang disusun, bukan otomatis menghasilkan satu PNG baru setiap frame. Bagi klip panjang atau naikkan kompleksitas secara bertahap sesuai kebutuhan aksi.

Renderer hanya membuka gambar yang terlihat, memakai cache bitmap berbatas, dan tetap memakai evaluator yang sama dengan preview. Foto utuh tidak otomatis dipisah atau menjadi auto-rig; tulisan tangan, deformasi rumit, lip sync dan kualitas identitas generatif tetap memerlukan aset/peninjauan khusus. Fitur ini tidak menjamin hasil identik referensi atau kontak visual sempurna tanpa penyetelan.

Uji pengembang: `npm run test:cutout-production`. Uji memakai database sementara dan respons provider terkontrol, dengan media, alpha, antrean, penyimpanan dan ekspor MP4 nyata. Tidak menggunakan database pengguna atau menyatakan kualitas artistik provider telah diuji.
