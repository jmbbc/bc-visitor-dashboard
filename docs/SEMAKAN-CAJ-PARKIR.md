# Semakan Caj Parkir

Lokasi: Dashboard > Pengurusan Data > Semakan Caj Parkir. Admin claim diperlukan sebelum setiap carian atau pemuatan caj.

Carian manual satu unit menggunakan query equality `responses.hostUnit`, dengan limit 201. Jika lebih 200 rekod ditemui, hasil dihentikan supaya laporan separa tidak digunakan. Julat tarikh masuk maksimum 93 hari ditapis dalam memori. Pilihan ini tidak memerlukan composite index baharu; jumlah reads berdasarkan sejarah unit yang dipulangkan, bukan hanya hasil dalam julat tarikh. Tiada bacaan automatik ketika kad dibuka, tiada listener.

Caj rasmi `parkingCharges/{registrationId}` dibaca hanya apabila pendaftaran dipilih. `amountSen` dan `paidSen` digunakan untuk jumlah caj dan bayaran; rekod tidak lengkap kekal belum disahkan. Cache dalam sesi mengelakkan bacaan berulang ketika menukar pilihan. Tekan Semak Caj semula untuk bayaran terkini.

Pecahan harian dibina hanya apabila versi polisi, kategori snapshot, hari mula/akhir, tarikh dan jumlah snapshot sepadan. Tidak menggunakan kategori unit semasa. Caj rasmi yang berbeza daripada jumlah snapshot ditandakan sebagai pelarasan; jadual ialah kiraan asal. Jadual hanya menerangkan caj kenderaan utama yang tersimpan; caj tambahan tidak direka. Tiada rekod kewangan ditulis.

Preview: `dashboard.html?preview=1&page=charges`. Data contoh kekal berasingan daripada Firebase. Ayat penjelasan penduduk dan butang salin belum dimuktamadkan.

Ujian: `node --test scripts/*.test.mjs` (124 lulus ketika pelaksanaan). Ujian admin dengan data live masih perlu dibuat selepas penerbitan.
## Kalendar bulanan
Kalendar menggabungkan permohonan Pelawat bermalam yang meliputi bulan dipilih, termasuk permohonan bermula bulan sebelumnya. Satu tarikh boleh mempunyai beberapa pendaftaran; setiap satu dipaparkan berasingan apabila tarikh diklik. Permohonan dibatalkan tidak dimasukkan.

Jumlah pada kalendar ialah kiraan asal kenderaan utama yang boleh disahkan daripada snapshot, bukan jumlah bayaran atau caj rasmi selepas pelarasan. Rekod tidak lengkap dan kenderaan tambahan ditanda semakan; jumlah disahkan tidak dianggap jumlah penuh. Klik tarikh membaca caj rasmi bagi setiap pendaftaran hari itu dan menunjukkan jumlah/baki seluruh pendaftaran.

Pertukaran bulan menggunakan sejarah unit yang sudah dimuat. Had carian kekal 201 rekod; tiada query semua unit atau listener automatik. Carian semula menyegarkan cache caj. Ujian kalendar merangkumi rentas bulan, beberapa pendaftaran sehari, deduplikasi, pembatalan dan pecahan yang belum disahkan.