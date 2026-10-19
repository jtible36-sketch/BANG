# Studi EffectCraft untuk Cutout v5

Diperiksa pada 19 Oktober 2026 dari sumber resmi GitHub. Ini studi sumber, tanpa menjalankan EffectCraft, tanpa menambahkan dependensi Rust/render dan tanpa menyalin implementasinya ke Naraflow. Instruksi skill reverse-engineer-anything dipakai untuk pemilihan jalur: sumber lengkap dianalisis langsung; tidak diperlukan dekompilasi atau klaim perilaku runtime.

## Keyframe dan hold

[`crates/keyframe/src/lib.rs`](https://github.com/storytold/effectcraft/blob/main/crates/keyframe/src/lib.rs) memisahkan interpolasi temporal linear/Bezier/hold, ease masuk/keluar dan informasi lintasan spasial. Ide yang relevan: hold adalah keadaan diskret yang perlu dipertahankan saat sampling, bukan curve lain yang harus dilunakkan. Naraflow tetap menggunakan kontrak keyframe yang sudah ada; kamera otomatis menyelesaikan push-in dalam paling lama 450 ms atau seperempat shot, lalu menahan nilai akhir. Tidak ada kebutuhan pegas untuk tubuh karakter.

## Waktu

[`crates/time/src/lib.rs`](https://github.com/storytold/effectcraft/blob/main/crates/time/src/lib.rs) menggunakan satuan tick integer dan konversi rasional untuk media. Ide yang dipakai adalah membedakan waktu sumber, durasi rekaman dan tampilan timeline. Naraflow tidak mengadopsi format tick tersebut: timestamp kata tetap detik rekaman, usulan shot memakai milidetik, durasi rekaman tidak diubah, dan batas terakhir tetap tepat. Pemeriksaan usang mencakup narasi, audio, durasi dan seluruh timestamp kata.

## Kontrak komposisi: koreksi lokasi dari brief

Sumber saat diperiksa menunjukkan [`crates/model`](https://github.com/storytold/effectcraft/blob/main/crates/model/src/lib.rs) adalah model 3D dan importer material/geometri, bukan kontrak dokumen komposisi. Kontrak dokumen ada pada [`crates/project`](https://github.com/storytold/effectcraft/blob/main/crates/project/src/lib.rs): proyek, item, komposisi, layer dan properti. Pemisahan dokumen dan engine layak dijadikan acuan arsitektur. Naraflow mempertahankan CutoutScene, aset milik proyek, dan editor overlay sendiri; format EffectCraft tidak dijanjikan kompatibel.

## Otomasi

[`crates/automation/src/lib.rs`](https://github.com/storytold/effectcraft/blob/main/crates/automation/src/lib.rs) membedakan backend headless dengan bridge aplikasi, dan katalog tool yang digunakan bersama. Ide yang relevan: inspeksi dan validasi terpisah dari mutasi serta pekerjaan media. IPC v5 menambahkan kesiapan read-only dan aksi pencatatan manifest eksplisit; usulan shot/era/SFX tidak menjalankan model atau media generator. Tidak ada ketergantungan pada bridge EffectCraft.

## Lisensi, batas dan hal yang tidak diadopsi

[`Cargo.toml`](https://github.com/storytold/effectcraft/blob/main/Cargo.toml) menyatakan MIT OR Apache-2.0. Studi ini memakai gagasan arsitektur dan menyertakan tautan sumber; tidak ada kode yang disalin sehingga tidak menambahkan atribusi kode baru ke ATTRIBUTION.md. Tidak mengadopsi renderer 3D, puppet/mesh, ekspresi arbitrer, atau format proyek EffectCraft. Tidak mengklaim paritas After Effects. Hasil studi sumber tidak membuktikan performa, kestabilan, atau tampilan runtime EffectCraft.
