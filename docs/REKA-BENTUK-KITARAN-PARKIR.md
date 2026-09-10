# Reka Bentuk Rekod Kitaran Parkir

Tarikh: 8 September 2026. Status: cadangan teknikal untuk ujian offline, bukan schema yang sudah dideploy.

Rujukan: [SOP](SOP-PARKIR-PELAWAT.md). Audit awal disimpan secara dalaman dan tidak diterbitkan.

## 1. Hubungan rekod

```text
Unit rumah (unitId kanonik daripada units)
  └─ Kitaran parkir (cycleId)
       ├─ Slot kenderaan utama dan sejarah penggantian
       ├─ Kenderaan tambahan dengan tempoh masing-masing
       ├─ Pendaftaran asal → sambungan → sambungan
       │    └─ Caj pendaftaran → bayaran 1, bayaran 2, ...
       └─ Peristiwa audit: pembatalan, semakan kategori, pelarasan
```

Unit ialah pemilik kelayakan. Slot utama ialah pemegang baki percuma dan indeks caj; nombor plat bukan pemilik kelayakan. Satu permohonan boleh mempunyai beberapa kenderaan tetapi setiap baris caj mempunyai identiti kenderaan/tempoh yang jelas. Menambah permohonan tidak mencipta kelayakan percuma baharu.

## 2. Cadangan kumpulan dokumen

Nama berikut belum dimuktamadkan untuk deploy. Data peribadi kekal di rekod pendaftaran berakses terhad; jangan letak telefon, nama atau token akses dalam ringkasan unit yang mungkin dibaca borang awam.

| Laluan cadangan | Kandungan utama | Tujuan |
|---|---|---|
| `parkingUnitState/{unitId}` | schemaVersion, revision, relevantCycleIds, updatedAt | Titik koordinasi perubahan unit; senarai kitaran relevan mesti dibatasi, bukan seluruh sejarah |
| `parkingCycles/{cycleId}` | unitId, policyVersion, originCategory, startDate, lastRegisteredEnd, nextEligibleDate, revision, reviewState | Ringkasan satu kitaran yang boleh dibina semula daripada rekod sumber |
| `parkingCycles/{cycleId}/allocations/{allocationId}` | responseId, entitlementSlotId, vehicleId, role, plateSnapshot, startDate, endDate, cancellationState | Tempoh kebenaran satu kenderaan; utama/tambahan ditentukan, bukan diambil bulat-bulat daripada pilihan pemohon |
| `parkingCharges/{responseId}` | cycleId, unitId, parentResponseId, categorySnapshot, policyVersion, lines, originalTotalSen, currentTotalSen, revision | Satu caj untuk pendaftaran/sambungan; semua baris mesti merujuk allocation dan tarikh |
| `parkingCharges/{responseId}/payments/{paymentId}` | amountSen, transactionReference, receivedAt, recordedAt, recordedBy, state | Bayaran individu; bukan jumlah terkumpul yang ditaip pengguna |
| `parkingEvents/{eventId}` | cycleId, responseId jika ada, eventType, before/after atau delta, reason, actorId, occurredAt, operationId | Audit perubahan; akses terhad dan tidak boleh dipadam/diedit sesuka hati |

`responses` sedia ada kekal sebagai rekod borang. Pada peringkat reka bentuk, gunakan ID response yang sama sebagai kunci caj; tidak perlu menambah medan pada responses sekarang. Validator `hasOnly` dalam firestore.rules akan menolak medan baharu sehingga migrasi rules dibuat secara sengaja.

Jangan simpan senarai semua bayaran, semua tarikh atau semua sambungan selama-lamanya dalam satu dokumen kitaran. Kategori 3 boleh berterusan tanpa had terkumpul. Gunakan rekod anak dan ringkasan terbitan yang boleh disahkan; saiz/query/index sebenar perlu diuji sebelum pemilihan schema akhir.

## 3. Medan dan invariants

- Semua jumlah wang dalam integer sen; tarikh penggunaan `YYYY-MM-DD` dalam kalendar Asia/Kuala_Lumpur. Masa audit ialah timestamp, bukan tarikh penggunaan.
- `unitId` datang daripada pemetaan unit kanonik sedia ada. Jangan meneka identiti dengan hanya membuang tanda sempang atau ruang yang boleh menyebabkan collision.
- `vehicleId` dan `entitlementSlotId` stabil; plat mempunyai nilai asal dan nilai normalisasi yang ditentukan kemudian. Pertukaran plat tidak mencipta slot utama baharu.
- Satu slot utama sahaja bagi unit pada mana-mana tarikh. Dua permohonan bertindih tidak boleh kedua-duanya mengambil peranan utama.
- Hari bertindih untuk kenderaan sama mempunyai satu pemilik caj kanonik. Sambungan hanya mengenakan caj tarikh tambahan; paparkan pertindihan sebagai sudah termasuk, bukan hari percuma baharu.
- Simpan kategori dan versi dasar ketika caj diterima. Status unit terkini tidak menulis semula caj lama.
- Pengecualian asal Kategori 3 mesti disokong peristiwa perubahan kategori, kategori asal dan jumlah penggunaan ketika perubahan. Boolean yang dihantar pemohon tidak mengesahkan pengecualian.
- `reviewState` kategori dan `paymentState` ialah dua perkara berasingan.
- `operationId` stabil diperlukan bagi retry supaya satu klik/retry tidak mencipta pendaftaran atau bayaran berganda. Ini berbeza daripada semakan rujukan bank yang sama.

## 4. Pembentukan kitaran berdasarkan tarikh berdaftar

1. Ambil tempoh allocation parkir bermalam unit yang relevan, abaikan hanya pembatalan yang disahkan.
2. Susun mengikut tarikh mula, bukan tarikh pengguna menghantar borang.
3. Untuk Kategori 1/2 dengan dasar sama, gabungkan tempoh bertindih dan kedatangan semula sebelum lengkap 3 hari kosong. Kekalkan hujung maksimum semua kenderaan sebagai asas cooldown.
4. Jika hujung terakhir 5 September, tarikh layak baharu ialah 9 September. Kedatangan 8 September masih kitaran sama; 9 September boleh menjadi kitaran baharu jika tiada tempoh berdaftar lain yang mengisi jurang itu.
5. Simpan kiraan berasingan: tarikh unik penggunaan utama, tarikh penggunaan setiap tambahan, dan tarikh unit mempunyai sebarang parkir. Jangan jumlahkan dua kereta pada satu tarikh sebagai dua hari unit.
6. Kategori 3 tidak menggunakan cooldown percuma; sambungan berterusan boleh kekal kitaran sama. Penentuan kitaran selepas jurang/pertukaran kategori belum boleh diandaikan daripada formula Kategori 1/2.

`nextEligibleDate` ialah nilai terbitan, bukan sumber kebenaran tunggal. Jangan guna satu tarikh keluar maksimum bagi seluruh sejarah unit termasuk permohonan masa depan yang sebenarnya kitaran lain.

### Permohonan luar urutan dan pembatalan

Jika rekod baharu mengisi jurang antara dua kitaran yang telah diwujudkan, ia mungkin menyatukan kitaran dan menjejaskan percuma/caj terdahulu. Pembatalan pula boleh memisahkan kitaran. Untuk versi awal, tandakan kes ini `requiresReview`, jangan ubah caj terdahulu atau beri kelayakan secara automatik. Dasar pembetulan dan kesannya kepada permohonan yang sudah diterima perlu disahkan sebelum automasi.

## 5. Contoh lengkap (data rekaan)

Unit Kategori 1, Kereta A utama dan Kereta B tambahan:

| Rekod | Tempoh | Allocation/caj |
|---|---|---|
| R001 asal | A: 1–3 Sept; B: 1–5 Sept | A RM0; B 5 × RM10 = RM50 |
| R002 sambungan R001 | A: 3–5 Sept | 3 Sept telah termasuk R001; A hari penggunaan 4–5: RM10 |

Kedua-duanya dikaitkan kepada kitaran C001. Hujung terakhir 5 Sept, cooldown 6–8 Sept, layak baharu 9 Sept jika tiada pendaftaran lain. Contoh ini tidak memutuskan sama ada hari tambahan sahaja menggerakkan indeks utama kerana A juga menggunakan 4–5 Sept selepas sambungan.

Bayaran RM20 dan RM30 untuk R001 dikaitkan hanya dengan caj R001, menjadikannya Sudah Bayar RM50. R002 masih Belum Disahkan RM10 sehingga transaksi untuk R002 direkodkan. Tiada status Sudah Bayar di peringkat seluruh unit yang boleh menyembunyikan baki sambungan.

## 6. Penambahan dan pembetulan bayaran

- Baca caj dan revision berkaitan; tambah satu transaksi dengan operationId unik.
- Jumlah diterima ialah jumlah transaksi sah. Baki = maksimum(caj semasa − diterima, 0); lebihan = maksimum(diterima − caj semasa, 0).
- Cadangan status caj sifar: `Tiada Caj`; caj positif dengan tiada transaksi: `Belum Disahkan`; amaun kurang: `Bayaran Sebahagian`; sama: `Sudah Bayar`; lebih: `Lebihan Bayaran — Perlu Semakan`.
- Jika admin melaras caj, kira semula baki berdasarkan transaksi sah yang sama, bukan mengubah transaksi untuk memadankan caj.
- Pembatalan transaksi menyimpan sebab, actor dan masa tanpa membuang rekod asal. Tidak menjalankan refund bank.
- Transaksi yang sama tidak boleh dikira dua kali akibat retry; rujukan bank pendua ditandakan untuk semakan. Skop keunikan dan resit merangkumi beberapa pendaftaran masih belum diputuskan.

## 7. Konsistensi, akses dan Spark — pintu semakan sebelum integrasi

Cadangan aliran logik: baca state unit + unit snapshot + sejarah relevan → kira → semak revision → tulis response, allocation, caj, ringkasan dan audit secara konsisten. Dua permohonan serentak bagi unit sama perlu konflik/retry dan pengiraan semula, bukan kedua-duanya menerima hari percuma baharu.

Ini belum keputusan bahawa transaksi browser dan rules sahaja mencukupi. Formula bersejarah, pembatalan dan autorisasi perlu dibuktikan melalui ujian emulator serta semakan dokumentasi Firebase semasa sebelum pelaksanaan. Jika penguatkuasaan selamat tidak dapat dibuktikan dalam kekangan Spark, hentikan integrasi dan kemukakan pilihan kepada pengguna; jangan longgarkan rules atau bergantung pada JavaScript pelanggan.

- Pemohon: akses terhad kepada rekod sendiri melalui mekanisme yang belum dipilih. Pautan pengurusan masih fasa kemudian.
- Pengawal: baca data operasi yang diperlukan dan tambah bayaran; tidak membatalkan bayaran atau mengubah kadar/kategori.
- Admin: pembetulan dengan alasan dan jejak audit.
- Tiada akses umum kepada sejarah unit, pembayaran, identiti pengunjung atau token.
- Rules sedia ada tidak automatik melindungi schema baharu; koleksi baharu kekal tidak diwujudkan/tidak digunakan sehingga autorisasi tersedia.

Strategi mengurangkan bacaan yang dicadangkan: ringkasan unit terhad + rekod tempoh relevan; paging sejarah apabila diperlukan; elak listener berterusan dan scan seluruh responses. Bilangan reads/writes sebenar, retry, query indexes dan saiz dokumen belum diukur; tiada jaminan kos atau kuota diberikan.

## 8. Migrasi dan perkara yang belum diputuskan

Rekod lama tanpa snapshot atau identiti utama tidak boleh dianggap bebas caj atau telah dibayar. Tandakan `legacyNeedsReview`, uji pemetaan pada fixture dahulu, dan jangan jalankan backfill produksi tanpa arahan.

Keputusan SOP yang masih diperlukan sebelum enjin kitaran lengkap:

1. DISELESAIKAN: indeks caj utama dan had 30 hari berdasarkan tarikh unik penggunaan slot utama. Hari tambahan sahaja tidak dikira untuk kedua-duanya, tetapi masih dicaj untuk tambahan dan melambatkan cooldown. Rujuk contoh susulan bahagian 4 SOP. Enjin kitaran belum diimplementasi.
2. Formula penuh perubahan kategori awal kitaran apabila baki percuma lama masih ada. Kadar baharu digunakan dan tiada percuma baharu automatik ialah prinsip disahkan, tetapi semua kombinasi belum jelas.
3. Kitaran Kategori 3 selepas jurang, perubahan kategori berulang dan had setiap permohonan untuk pengecualian Kategori 3 → 1/2.
4. Pengendalian rekod masa depan yang bergabung/terpisah akibat permohonan luar urutan atau pembatalan; pembatalan selepas mula dan pelarasan refund.

### Pengesahan susulan: had utama dan sambungan tambahan

Tambahan Kategori 1/2 boleh menyambung berbayar selepas slot utama mencapai 30 hari. Jangan menolak tambahan hanya kerana kaunter utama mencapai had. Tambahan kekal tambahan; cooldown unit masih menunggu semua allocation tamat. Had satu permohonan tambahan perlu diperjelas sebelum integrasi. `quoteSameCategory` sedia ada masih mengenakan cap kitaran kepada role tambahan; prototaip itu perlu dikemas kini dan diuji sebelum digunakan sebagai enjin unit. Tiada perubahan enjin dibuat dalam pengesahan SOP ini.

Pengesahan terkini: maksimum 30 hari setiap permohonan tambahan, sambungan berbayar berulang dibenarkan tanpa had terkumpul. Nota belum diputuskan di atas sudah diselesaikan. Prototaip `quoteSameCategory` kini mengehadkan cap kitaran 30 hari kepada role utama Kategori 1/2 sahaja (kecuali pengecualian sah). Ujian tambahan mengesahkan 90 hari penggunaan tambahan melalui sambungan dan menolak permohonan tunggal 31 hari. Ini masih modul offline satu kenderaan, bukan enjin kelayakan unit atau perubahan produksi.

### Pengesahan susulan: perubahan kategori sebelum penggunaan

Pemilihan aliran semakan mesti membandingkan tarikh semakan dengan tarikh masuk berdaftar, bukan tarikh borang dihantar. Perubahan sebelum masuk membolehkan admin mengira semula keseluruhan permohonan berdasarkan kategori baharu dan kelayakan kitaran sebenar. Contoh 1 Sept submit, 3 Sept kategori berubah 2 → 1, 4 Sept masuk: layak kadar Kategori 1 selepas semakan jika cooldown/kelayakan unit membenarkan. Simpan snapshot lama dan event pelarasan; pembayaran kekal dan lebihan tidak dipulangkan automatik. Perubahan pada tarikh masuk sendiri, tanpa rekod waktu ketibaan, masih memerlukan aturan eksplisit sebelum automasi.

Pengesahan aturan tarikh masuk sendiri: sudah diputuskan sebagai Perlu Semakan, tanpa pelarasan caj atau percuma automatik. Admin boleh melaraskan keseluruhan pendaftaran kepada kategori baharu dengan sebab dan semakan kelayakan kitaran. Nota aturan tarikh sama masih terbuka dalam perenggan terdahulu digantikan oleh keputusan ini. Tidak memerlukan pengawal merekod waktu ketibaan.

## Prototaip susulan: analisis sejarah unit offline

`js/parking-cycles.mjs` kini menyediakan `analyseUnitCycles` dengan input `unitId`, `cat` dan senarai allocation lengkap yang telah disahkan. Setiap allocation memerlukan ID unik, unitId, vehicleId kanonik, role, cat, start/end serta state registered atau cancelled_before_entry. State pembatalan dan peranan ialah input dipercayai daripada adapter masa depan, bukan pilihan awam yang dianggap sah.

Ia mengumpulkan kitaran mengikut tempoh berdaftar, membilang hari unik slot utama, menangguhkan cooldown mengikut semua kenderaan dan mengelakkan caj berganda untuk tarikh/kenderaan sama. Output mempunyai lejar hari, sourceIds, jumlah sen, baki utama dan baki percuma. SourceIds menyimpan semua sumber pertindihan; prototaip belum memperuntukkan pemilik invois antara rekod bertindih. Output jumlah ialah pengiraan semula fixture sahaja, tidak boleh digunakan untuk menulis semula caj sejarah atau bayaran.

Had: kategori bercampur, peranan bercanggah, lebih satu identiti utama (termasuk penggantian belum disahkan), sejarah tambahan tanpa utama dan jurang panjang Kategori 3 menghasilkan requires_review; jumlah, kadar dan kelayakan disembunyikan (null). Pengecualian perubahan Kategori 3 belum diautomasi. Modul belum mengesahkan keselamatan, permohonan serentak, perubahan terhadap sejarah yang sudah diinvois atau had satu borang berbilang allocation. Ia bukan enjin produksi atau API kelulusan. Tidak membaca Firebase dan tidak disambungkan kepada UI.

Ujian: `node --test scripts/parking-policy.test.mjs scripts/parking-cycles.test.mjs` — 23 lulus, 0 gagal. Lapan ujian sejarah unit ditambah kepada 15 ujian dasar sedia ada. Contoh tambahan sahaja 4–6 Sept tidak menggunakan hari utama; utama kembali 7 Sept menjadi hari utama ke-4, RM5 dalam Kategori 1.

## 9. Pelan ujian sebelum UI/Firebase

- [ ] Fixture satu unit dengan utama dan tambahan berlainan tempoh.
- [ ] Dua permohonan berasingan bertindih: hanya satu utama.
- [ ] Sambungan bertindih tidak dicaj dua kali; retry tidak menggandakan rekod.
- [ ] Kedatangan sebelum/selepas tarikh layak cooldown, termasuk hujung bulan/tahun.
- [ ] Kategori 3 sambungan panjang tanpa array sejarah yang berkembang dalam satu dokumen.
- [ ] Pembatalan dan input luar urutan mengesan kes review tanpa menulis semula caj.
- [ ] Pembayaran asal berasingan daripada sambungan, pembatalan transaksi dan lebihan.
- [ ] Ujian hak pengawal/admin/pemohon serta serentak melalui emulator sebelum integrasi.

Dokumen ini sahaja ditambah. Modul pengiraan offline sedia ada belum ditukar menjadi enjin kitaran unit, dan tiada perubahan Firebase, UI atau deploy dibuat.
