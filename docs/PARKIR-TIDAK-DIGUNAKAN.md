# Admin: Tidak Menggunakan Parkir — 15 Oktober 2026

Admin membetulkan seluruh permohonan Pelawat bermalam dengan remark dan pengesahan ID. Rekod dan sebab dikekalkan untuk audit. Rekod sudah masuk/keluar, mempunyai bayaran/resit, lock tiada atau sejarah melebihi 100 rekod tidak diproses automatik.

Caj permohonan tidak digunakan menjadi RM0. Sistem membina semula kitaran menggunakan kategori snapshot dan cooldown tiga hari penuh. Sejarah lama sebelum kitaran baharu yang mempunyai cooldown lengkap tidak menghalang pembetulan kitaran semasa.

Permohonan susulan dengan satu kenderaan dan caj belum berbayar dikira semula bersama caj rasmi, snapshot harian dan snapshot kitaran terdahulu dalam transaksi yang sama. Amaun sebelum/selepas disimpan dalam jurnal caj; snapshot sebelum/selepas disimpan dalam audit. Status Pending Payment menjadi Pending jika tiada caj. Rekod berbayar, pelarasan manual, kenderaan tambahan atau sebab semakan lain kekal untuk semakan admin. Tiada refund automatik.

Jika sejarah tidak lengkap, queue dan counter ditanda untuk semakan. Queue pembetulan penggunaan sedia ada boleh diselesaikan apabila pengiraan semula lengkap; queue atas sebab lain tidak dipintas.

Kalendar bulanan mengekalkan remark tidak digunakan pada setiap tarikh check-in hingga check-out tetapi mengecualikannya daripada jumlah caj/penggunaan. Kalendar dimuat semula selepas tindakan berjaya. Laporan mingguan mengecualikan permohonan tidak digunakan.

150 ujian automatik dan 10 senario emulator menguji pemulihan counter, audit, caj susulan, perlindungan bayaran/pelarasan/kenderaan tambahan, akses pengawal dan pembetulan terdahulu yang mempunyai queue.

Kes B3-2-5 disahkan pada live: pembetulan 4–6 Oktober diikuti caj 8–9 Oktober RM0, 11–12 Oktober RM5, 13–15 Oktober RM20. Skrip scripts/repair-unused-charges.mjs ialah dry run secara lalai; --apply menjalankan pembetulan yang telah disahkan dan mesti digunakan hanya dengan kebenaran admin. Peraturan Firebase yang diperlukan telah diterbitkan.

Pembetulan berulang: jurnal automatik dikenal pasti melalui sebab sistem, amaun jurnal yang sama dengan snapshot, serta cap masa jurnal yang sepadan dengan calculatedAt. Ia boleh dikira semula; pelarasan manual kekal dilindungi. Senario emulator ke-11 mengesahkan pembatalan 11–12 Oktober selepas pembatalan 4–6 Oktober memberi 13–15 Oktober RM0. Rekod live B3-2-5 telah dipulihkan dengan audit.
