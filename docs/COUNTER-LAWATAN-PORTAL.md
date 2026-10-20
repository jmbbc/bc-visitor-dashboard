# Counter lawatan main page

- UI: hujung index.html, Tahun Ini / Bulan Ini / Hari Ini.
- Definisi: lawatan halaman, termasuk refresh dan buka semula. Halaman lain tidak dikira.
- Sumber: satu dokumen agregat portalStats/home, tanpa pengenal individu, nama, telefon atau IP.
- Satu transaksi per paparan: lazimnya 1 read + 1 write; retry konflik boleh menambah reads. Tidak menggunakan listener/polling. Kiraan bukan ukuran pelawat unik atau bukti manusia (trafik automatik juga boleh dikira).
- Waktu Malaysia (Asia/Kuala_Lumpur); Rules mengesahkan tarikh menggunakan request.time + 8 jam. Clock peranti yang salah boleh menyebabkan cubaan tidak direkodkan; UI menunjukkan statistik tidak tersedia dan tidak mereka angka.
- Tempoh semasa sahaja disimpan; tiada backfill lawatan sebelum pengaktifan atau arkib bulanan/tahunan dalam versi ini.
- Counter baharu dicipta oleh lawatan pertama selepas pengaktifan. Rules mengehadkan penulisan kepada tambah 1 atau reset tempoh sebenar, mengekalkan startedAt dan menolak medan tambahan/delete/list.
- Lawatan pertama / rollover yang berlumba boleh mengulang transaksi yang ditolak (maksimum 3 percubaan). Transaksi yang berjaya tidak diulang oleh aplikasi. SDK mengurus konflik biasa.
- localhost, file dan ?preview=1 menggunakan data contoh sahaja dan tidak mengimport Firebase untuk counter.
- Rules perlu diterbitkan bersama frontend. Jangan deploy firestore.rules working copy yang mengandungi perubahan lain; guna versi HEAD + blok portalStats/home yang telah diuji. Salinan diuji sesi ini: private-reports/portal-visits-staged.rules.
- 8 unit tests: node --test scripts/portal-visits.test.mjs.
- 16 emulator scenarios: jalankan Firestore emulator demo-portal-counter pada 8149, kemudian node scripts/portal-visits.emulator.mjs. PORTAL_VISITS_TEST_RULES boleh memilih fail Rules alternatif.
- Pengaktifan live memerlukan Rules dan frontend counter yang sepadan.
