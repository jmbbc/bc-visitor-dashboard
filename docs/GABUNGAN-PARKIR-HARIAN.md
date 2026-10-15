# Gabungan penggunaan parkir harian

Polisi disahkan 15 Oktober 2026. Setiap unit mempunyai satu jadual harian penggunaan:

- Plat dinormalkan kepada huruf besar tanpa ruang/tanda pemisah.
- Plat dan tarikh sama dicaj sekali walaupun mempunyai beberapa permohonan.
- Pemilik caj ialah permohonan dengan createdAt paling awal; ID dan susunan kenderaan menjadi pemutus seri.
- Pada setiap tarikh, kenderaan pemilik permohonan paling awal menjadi utama. Plat lain ialah tambahan, menggunakan kadar tambahan kategori snapshot pemiliknya.
- Jika kenderaan itu sahaja masih aktif pada tarikh berikutnya, ia menjadi utama pada tarikh tersebut. Ini menggantikan andaian lama bahawa peranan tambahan kekal sepanjang kitaran.
- Hari penggunaan unit dikira sekali bagi setiap tarikh yang diliputi sekurang-kurangnya satu kenderaan. Cooldown memerlukan tiga tarikh penuh tanpa penggunaan.
- Kedua-dua rekod asal kekal. parkingDailyBreakdown menyimpan pemilik caj, plat, tarikh, peranan, kategori, hari kitaran dan amaun sen; baris perkongsian beramaun sifar.

## Pengiraan dan pembetulan

Enjin js/parking-unit-ledger.mjs menerima sejarah lengkap satu unit, kemudian mengira jadual harian dan amaun setiap permohonan. Kategori mesti datang daripada snapshot asal. Sejarah sebelum cooldown lengkap atau reset counter sifar yang sah boleh diasingkan daripada kitaran semasa. Sejarah tidak lengkap dihantar untuk semakan.

Transaksi admin membaca semula pendaftaran, counter, caj dan jurnal sebelum sebarang penulisan. Pembetulan Tidak Menggunakan Parkir mengecualikan seluruh permohonan, mengekalkan tarikh yang diliputi permohonan lain, menyusun semula utama/tambahan dan memindahkan caj belum berbayar kepada pemilik yang betul. Caj, snapshot harian, counter dan audit ditulis bersama.

Bayaran diterima dan pelarasan manual tidak ditulis semula. Rekod yang terjejas ditanda untuk semakan. Jurnal automatik boleh dikira semula apabila sebab, amaun dan cap masanya sepadan. Snapshot sebelum/selepas dan pelarasan caj disimpan untuk audit. Reset counter selepas bayaran penuh yang sah sebelum permohonan berikutnya dikekalkan; reset yang bertindih memerlukan semakan.

## Pelan Spark dan operasi

Tiada Cloud Functions baharu. Borang menyimpan permohonan dan satu permintaan parkingLedgerQueue/{unit} secara atomik. Ia menyimpan anggaran sahaja; caj rasmi belum dicipta semasa penghantaran. Suntingan kenderaan juga meminta penyelarasan semula.

Dashboard yang log masuk sebagai admin memproses queue secara automatik. Jika semua dashboard admin ditutup, pengiraan menunggu sehingga admin membuka dashboard. Panel Pengurusan Data menunjukkan unit yang memerlukan semakan dan menyediakan tindakan cuba semula. Peranti pengawal tidak memuktamadkan caj.

Bacaan terhad kepada satu unit, maksimum 100 rekod. Queue pending dipantau maksimum 10 unit sekali; senarai semakan maksimum 20 unit. Tiada imbasan global caj atau data peribadi dibuka kepada borang awam. Rekod lama tidak dimigrasi secara pukal. scripts/reconcile-unit-parking.mjs ialah dry run secara lalai; --apply memerlukan kebenaran untuk unit/pendaftaran yang dipilih.

Rules mesti diterbitkan sebelum frontend: queue hanya boleh dirujuk kepada permohonan unit yang sepadan dan baru ditulis; bacaan queue khusus admin. Snapshot harian hanya boleh dicipta admin; suntingan awam mengekalkannya sehingga penyelarasan admin selesai. Perubahan Rules tidak merangkumi prototaip notis atau pemadaman yang belum diluluskan.

## Paparan dan pengesahan

Laporan mingguan memaparkan satu plat pada tarikh bertindih. Butiran menyimpan pautan kepada semua permohonan sumber. Baki dalam laporan mingguan merujuk keseluruhan pendaftaran, bukan caj tarikh itu. Semakan Caj menggunakan baris harian yang diperuntukkan, termasuk tambahan dan baris kongsi RM0, supaya jumlah tidak berganda. Rekod tidak digunakan mengekalkan remark.

162 ujian automatik serta 19 senario emulator meliputi pertindihan plat sama, tambahan merentas borang, pemindahan pemilik caj, pembetulan berulang, reset bayaran, bayaran separa, pelarasan manual, queue awam dan larangan membaca sejarah peribadi. Pratonton browser mengesahkan satu plat dipaparkan untuk dua permohonan yang bertindih.
