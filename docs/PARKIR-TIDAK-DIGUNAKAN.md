# Admin: Tidak Menggunakan Parkir — 15 Oktober 2026

Versi pertama membetulkan seluruh permohonan Pelawat bermalam yang tidak digunakan. Admin memilih tindakan dalam Senarai Pendaftaran, memasukkan remark 3–400 aksara dan menaip ID pendaftaran tepat. Rekod asal dikekalkan; status operasi dibatalkan dan medan parkingUnused serta identiti/tarikh admin disimpan.

Rekod checked-in/checked-out, bayaran diterima, resit berkaitan, lock tiada, queue sedia ada pending atau lebih 100 rekod sejarah ditolak. Caj belum berbayar menjadi RM0 melalui event pelarasan; amaun lama dan sebab kekal dalam audit. Tiada refund automatik.

Sejarah unit dibaca secara terhad dan setiap rekod dibaca semula dalam transaksi. Counter serta tarikh cooldown dibina semula menggunakan kategori snapshot dan permohonan lain yang masih sah. Permohonan selepasnya yang mempunyai kiraan berbeza ditanda untuk semakan caj; amaun/resitnya tidak diubah. Jika sejarah tidak lengkap, lock ditanda pending dan queue semakan dibuat. Permohonan visitor baharu tidak menggunakan counter pending itu untuk memberi caj automatik.

Laporan mingguan dan kalendar bulanan mengecualikan rekod dibatalkan. Status senarai memaparkan Tidak menggunakan parkir. Kenderaan/tarikh/check-in yang hanya sebahagiannya digunakan tidak termasuk versi pertama.

148 ujian automatik lulus. Enam senario emulator Firestore pada projek demo-parking-unused lulus: pemulihan terbaru, audit/zero-charge, resit baharu ditolak, bayaran separa ditolak, pengawal ditolak, pembetulan sejarah dan queue incomplete. (Senario pemulihan serta audit diuji bersama.)

Perubahan melibatkan Firebase Rules. Rules baharu dan frontend perlu diterbitkan bersama; kod sahaja tidak mengaktifkan tindakan pada live. Tiada data live diubah semasa pelaksanaan. Polisi kategori 1 ke 2 dan ujian cooldown yang masih tempatan perlu dipilih secara berasingan ketika commit.