# SOP Parkir Pelawat dan Checklist Implementasi

Tarikh: 8 September 2026

Status: Ringkasan keputusan pengguna dalam perbincangan. Dokumen ini bukan pengesahan bahawa fungsi telah dibina, diuji atau diterbitkan. Perubahan kali ini ialah dokumentasi sahaja. Terpakai kepada parkir pelawat bermalam; jangan gunakan kadar ini untuk Pelawat Khas atau kategori lain tanpa pengesahan.

## 1. Kategori unit dan kadar

Kategori ditentukan daripada tunggakan unit:

| Kategori | Amaun tunggakan | Percuma untuk kenderaan utama |
|---|---|---|
| 1 | RM1 dan ke bawah | 3 hari |
| 2 | Lebih RM1 hingga RM400, termasuk RM400 | 1 hari |
| 3 | Lebih RM400 | Tiada |

Ambang RM1 dikekalkan, bukan RM10. Semakan kod visitor.js mengesahkan ambang dan kelayakan 3/1/0 hari ini; semua laluan pengiraan lain masih perlu diaudit.

### Kenderaan utama

| Hari penggunaan | Kategori 1: caj sehari |
|---|---:|
| 1–3 | Percuma |
| 4–6 | RM5 |
| 7–9 | RM10 |
| 10–12 | RM15 |
| 13–30 | RM20 |

| Hari penggunaan | Kategori 2: caj sehari |
|---|---:|
| 1 | Percuma |
| 2–4 | RM5 |
| 5–7 | RM10 |
| 8–10 | RM15 |
| 11–13 | RM20 |
| 14–16 | RM25 |
| 17–19 | RM30 |
| 20–22 | RM35 |
| 23–25 | RM40 |
| 26–28 | RM45 |
| 29–30 | RM50 |

Kategori 2 naik RM5 setiap blok 3 hari berbayar selepas hari pertama percuma. Kategori 3 berkadar tetap RM15 sehari sejak hari pertama.

### Kenderaan tambahan

| Kategori | Caj setiap kenderaan setiap hari |
|---|---:|
| 1 | RM10 |
| 2 | RM15 |
| 3 | RM25 |

Caj tambahan bermula hari pertama mengikut tempoh kenderaan tersebut didaftarkan. Tiada hari percuma. Kadar tambahan ini dikekalkan daripada sistem sedia ada. Caj dikira bagi setiap kenderaan, bukan satu caj untuk seluruh unit.

## 2. Kiraan hari dan sambungan

- Tarikh masuk dan keluar kedua-duanya dikira: 1–3 September = 3 hari; masuk dan keluar pada tarikh sama = 1 hari.
- Gunakan tempoh berdaftar, bukan kehadiran atau waktu keluar sebenar. Keluar awal tidak mengubah kiraan secara automatik.
- Sambungan tanpa keluar meneruskan hari penggunaan, kadar dan baki kelayakan; borang baharu tidak menetapkan semula kiraan.
- Tarikh bertindih bagi kenderaan sama tidak dicaj dua kali: 1–3 September disambung 3–5 September = 5 hari keseluruhan.
- Kembali sebelum cooldown lengkap meneruskan hari penggunaan terdahulu. Hari tanpa parkir berdaftar tidak dikira atau dicaj.
- Baki hari percuma boleh digunakan: Kategori 1 guna 1 hari kemudian kembali sebelum cooldown lengkap masih berbaki 2 hari, bukan menerima 3 hari baharu.
- Setiap tempoh penggunaan, termasuk kedatangan semula, wajib didaftarkan.

## 3. Cooldown dan had tempoh

### Kategori 1 dan 2

- Maksimum 30 hari penggunaan terkumpul dalam kitaran yang sama, termasuk sambungan dan kedatangan semula sebelum cooldown lengkap.
- Contoh: guna 20 hari, tiada parkir sehari, kemudian kembali = berbaki 10 hari, bukan 30 hari baharu.
- Cooldown ialah 3 hari penuh tanpa pendaftaran parkir bermalam aktif bagi unit.
- Bermula selepas tarikh keluar terakhir SEMUA kenderaan unit, termasuk tambahan. Ini menggantikan cadangan awal berdasarkan kenderaan utama sahaja.
- Contoh: utama tamat 3 September, tambahan tamat 5 September; cooldown 6–8 September; kelayakan baharu mulai 9 September.
- Selepas cooldown lengkap, had penggunaan dan kelayakan percuma boleh bermula semula.
- Jika kembali sebelum selesai, cooldown seterusnya berdasarkan tarikh keluar terakhir yang baharu.

### Kategori 3

- Maksimum 30 hari setiap permohonan, tetapi sambungan boleh berulang tanpa had terkumpul.
- Tiada kewajipan keluar atau cooldown untuk sambungan; pengguna bersetuju dengan caj.
- Utama RM15 sehari, tambahan RM25 sehari; tiada percuma.

### Pengecualian pertukaran daripada Kategori 3

Unit yang sudah menggunakan 30 hari atau lebih dalam Kategori 3 dan kemudian bertukar kepada Kategori 1 atau 2 boleh menyambung tanpa keluar:

- Hari penggunaan diteruskan tanpa percuma baharu.
- Kategori 1: utama RM20 sehari.
- Kategori 2: kenaikan RM5 setiap blok 3 hari diteruskan; hari 31 RM50, hari 32–34 RM55 sehari.
- Tambahan menggunakan kadar kategori baharu, RM10 atau RM15 sehari.
- Pengecualian khusus untuk kitaran parkir tersebut, bukan hak kekal unit. Unit biasa Kategori 1/2 masih tertakluk kepada had 30 hari.

## 4. Kenderaan utama dan tambahan

Pengesahan susulan: indeks hari caj utama dan had 30 hari Kategori 1/2 mengikut tarikh unik penggunaan SLOT KENDERAAN UTAMA, bukan hari unit mempunyai kenderaan tambahan sahaja. Slot diteruskan apabila penggantian utama disahkan; menukar plat tidak reset kiraan. Hari tambahan sahaja tidak menaikkan indeks utama atau mengurangkan baki 30 hari, tetapi tetap dicaj mengikut tempohnya dan tetap melambatkan cooldown unit.

Contoh: A utama 1–3 September, B tambahan 1–6 September, A kembali 7 September sebelum cooldown lengkap. Pada 7 September A ialah hari utama ke-4 (Kategori 1: RM5). Selepas 6 September baki had utama ialah 27 hari; selepas penggunaan 7 September baki 26 hari. Caj B ialah RM60. Jika A tidak kembali, tarikh layak selepas B tamat 6 September ialah 10 September.

- Hanya kenderaan utama mendapat kelayakan percuma.
- Permohonan berasingan tidak membolehkan dua kereta bagi unit sama pada tarikh bertindih masing-masing dianggap utama.
- Tambahan tidak bertukar menjadi utama secara automatik apabila utama keluar; kadar tambahan kekal hingga tarikh tamatnya.
- Penggantian utama yang sah meneruskan baki hari, caj dan cooldown, tanpa reset. Kebenaran utama lama tamat apabila penggantian berkuat kuasa.
- Jika kedua-dua kereta masih parkir, kereta yang bukan utama perlu didaftarkan sebagai tambahan.

Fungsi penggantian sendiri ditangguhkan ke fasa seterusnya: pautan Urus Pendaftaran yang disahkan dan berjangka masa, sejarah plat dan tarikh pertukaran, tiada perubahan sejarah yang sudah berlalu. Recall data terakhir untuk borang baharu bukan pengurusan rekod asal. Nombor unit sahaja bukan pengesahan akses. Expiry perlu dikuatkuasakan pada lapisan akses data, bukan UI sahaja. Keselamatan dan kesesuaian Spark belum disahkan.

### Sambungan tambahan selepas had utama dicapai

Pengesahan susulan: bagi Kategori 1/2, kenderaan tambahan boleh meneruskan parkir berbayar walaupun kenderaan utama telah menggunakan 30 hari. Kadar tambahan kekal RM10/RM15 sehari mengikut kategori; ia tidak bertukar menjadi utama atau menerima percuma secara automatik. Kelayakan utama tidak reset selagi masih ada kenderaan unit berdaftar bermalam. Semua kenderaan mesti tamat parkir dan cooldown 3 hari penuh lengkap sebelum kelayakan utama baharu bermula. Ini memperincikan bahawa had terkumpul 30 hari adalah had penggunaan utama, bukan sekatan sambungan berbayar tambahan. Had setiap permohonan tambahan perlu dinyatakan sebelum integrasi; persetujuan ini tidak menetapkan tempoh satu borang tanpa had.

Pengesahan terkini (menggantikan nota had setiap permohonan belum diputuskan di atas): kenderaan tambahan maksimum 30 hari setiap permohonan, tetapi boleh menyambung berulang kali dengan bayaran tanpa had terkumpul. Kadar tetap tambahan mengikut kategori terus digunakan.

## 5. Perubahan tunggakan dan semakan admin

- Simpan kategori, amaun tunggakan dan caj ketika permohonan dibuat.
- Jangan ubah caj asal secara automatik apabila tunggakan dikemas kini.
- Admin boleh membuat pembetulan selepas semakan; sebab wajib, bersama caj asal/baharu, nama admin dan masa.
- Dalam Senarai Pendaftaran, tandakan perubahan kategori dengan teks dan warna: Perlu Semakan (oren), Telah Disemak (hijau). Jangan bergantung pada warna sahaja.
- Paparkan kategori asal → semasa dan pautan catatan. Sediakan penapis Perlu Semakan serta ringkasan selepas kemas kini tunggakan.
- Fokus amaran pada pendaftaran akan datang dan aktif; sejarah catatan dikekalkan.
- Perubahan amaun tanpa melintasi kategori tidak mencetuskan amaran kategori.
- Status semakan kategori berasingan daripada status pembayaran.
- Sambungan menggunakan kategori terkini yang disahkan, tetapi hari penggunaan diteruskan. Tiada tambahan hari percuma automatik akibat perubahan kategori; admin boleh melaraskan selepas semakan.
- Pelarasan caj tidak bermakna wang sudah dipulangkan.

### Pengesahan susulan: kategori berubah sebelum tarikh masuk

Bezakan tarikh borang dihantar daripada tarikh penggunaan bermula. Contoh: borang dihantar 1 September untuk masuk 4 September semasa Kategori 2; kemas kini admin pada 3 September menjadikan unit Kategori 1. Tandakan pendaftaran akan datang sebagai Perlu Semakan. Selepas pengesahan admin, keseluruhan pendaftaran boleh dikira semula dengan Kategori 1, termasuk kelayakan percuma jika unit layak dan cooldown lengkap. Menghantar borang sahaja tidak bermakna hari percuma telah digunakan.

Simpan snapshot kategori/caj asal, kategori/caj disemak, sebab, admin dan masa. Jangan kira semula secara automatik hanya kerana outstanding berubah. Bayaran sah sedia ada dikekalkan; lebihan selepas pelarasan ditandakan untuk tindakan admin, bukan refund automatik. Permohonan akan datang yang menyambung kitaran lama masih tertakluk kepada sejarah penggunaan dan cooldown; tarikh masuk belum tiba tidak memberi reset dengan sendirinya.

Jika tempoh parkir sudah bermula, gunakan aturan sambungan dan semakan yang dipersetujui, bukan aturan sebelum masuk. Bagi contoh Kategori 2 telah menggunakan hari pertama percuma lalu bertukar kepada Kategori 1: hari ke-2 dan ke-3 RM5 sehari kecuali pelarasan admin; hari 4–6 RM5 dan hari 7 RM10. Formula transisi lain belum disahkan sepenuhnya.

### Pengesahan susulan: kategori berubah pada tarikh masuk

Jika kategori berubah pada tarikh masuk berdaftar itu sendiri, tandakan Perlu Semakan. Sistem tidak menganggap pelawat sudah atau belum tiba kerana waktu ketibaan sebenar tidak direkodkan untuk menentukan caj. Jangan ubah caj atau kelayakan percuma secara automatik. Admin boleh melaraskan keseluruhan pendaftaran kepada kategori baharu selepas semakan, dengan sebab dan sejarah perubahan direkodkan serta mengambil kira kelayakan kitaran unit. Pengawal tidak perlu merekod waktu ketibaan bagi tujuan ini. Pembayaran terdahulu tetap dipelihara dan lebihan diurus berasingan.

## 6. Pembatalan

- Pembatalan sebelum tarikh masuk yang disahkan admin tidak menggunakan percuma, had 30 hari atau mencetuskan cooldown.
- Kekalkan rekod berstatus Dibatalkan, bukan padam.
- Jika tidak hadir tanpa pembatalan, kiraan tetap berdasarkan tarikh berdaftar.
- Bayaran balik diurus berasingan, tidak automatik.

## 7. SOP pembayaran

- Pengguna boleh menghantar permohonan tanpa perlu membayar terlebih dahulu. Paparkan QR dan jumlah untuk keseluruhan tempoh yang dipilih.
- Pendaftaran dan persetujuan caj bukan jaminan petak parkir tersedia. Status tunggakan mungkin memerlukan pembetulan admin.
- Pengguna menghantar resit melalui WhatsApp pengawal; tugas keselamatan diminimumkan kepada pemantauan kenderaan dan rekod bayaran berdasarkan resit.
- Pendaftaran asal dan setiap sambungan mempunyai caj dan status pembayaran sendiri, tetapi dihubungkan.
- Paparkan amaun, tempoh dan rujukan; elakkan label Sudah Bayar tanpa konteks.
- Rekod setiap transaksi secara berasingan dengan amaun diterima, rujukan transaksi, petugas dan masa pengesahan.
- Jumlah diterima = jumlah transaksi sah; jangan timpa bayaran terdahulu apabila menerima bayaran baharu.
- Caj RM30, diterima RM20: Bayaran Sebahagian, baki RM10. Tambah bayaran RM10: jumlah RM30, Sudah Bayar.
- RM30 dibayar dua kali: jumlah RM60, Lebihan Bayaran RM30 — Perlu Semakan Admin.
- Gunakan rujukan transaksi untuk mengesan kemungkinan resit sama dikira dua kali; amaran pendua bukan pengesahan bank.
- Tiada bayaran direkodkan bagi caj positif: Belum Disahkan, bukan dakwaan pengguna belum membayar.
- Pengawal menambah transaksi. Admin sahaja membatalkan transaksi tersilap dengan sebab wajib; rekod asal kekal dan bayaran betul dimasukkan sebagai rekod baharu.
- Pembatalan transaksi mengira semula baki/status tetapi tidak memulangkan wang sebenar.
- Bayaran balik dan lebihan memerlukan tindakan admin berasingan; tiada automasi refund dipersetujui.

## 8. Checklist implementasi — belum disahkan siap

- [ ] Audit semua laluan visitor, dashboard, WhatsApp, backend dan Firestore rules; selaraskan sempadan RM1/RM400 serta buang percanggahan kadar lama secara terkawal.
- [ ] Bina pengiraan caj berpusat dan ujian automatik sebelum menyambung UI.
- [ ] Modelkan kitaran unit, hari penggunaan unik, identiti utama/tambahan, sambungan serta pengecualian asal Kategori 3.
- [ ] Kuatkuasakan kelayakan dan had secara selamat merentasi permohonan serentak; validasi browser sahaja tidak mencukupi.
- [ ] Semak kesesuaian transaksi, autentikasi dan security rules untuk Spark; ukur reads/writes dan jangan janjikan kos tetap sebelum diuji.
- [ ] Hadkan query kepada rekod diperlukan; elak scan seluruh pangkalan data atau listener berlebihan.
- [ ] Kemas kini pilihan tarikh, ringkasan caj dan WhatsApp. Had tarikh membuat permohonan berbeza daripada panjang tempoh parkir.
- [ ] Audit laporan mingguan agar pendaftaran panjang yang bermula sebelum minggu dipilih tetap muncul; gunakan tarikh setiap kenderaan.
- [ ] Bezakan penggunaan berdaftar daripada kehadiran sebenar. Lebih 3 hari tidak semestinya pelanggaran jika sambungan berbayar dibenarkan.
- [ ] Tambah penandaan perubahan kategori, catatan dan audit admin.
- [ ] Tambah lejar pembayaran berbilang, amaran pendua, pembatalan transaksi dan kawalan peranan.
- [ ] Tambah pembatalan pendaftaran dan pengiraan semula kelayakan tanpa memadam sejarah.
- [ ] Uji dengan data mock/emulator terlebih dahulu, tanpa menghantar pendaftaran atau bayaran sebenar.
- [ ] Sediakan pelan migrasi rekod lama, semakan pengguna dan rollback sebelum deploy. Jangan commit/push/deploy tanpa arahan.
- [ ] Fasa kemudian: pautan pengurusan selamat, expiry dan pertukaran utama kendiri.

## 9. Perkara teknikal / kes khas yang masih terbuka

Jangan membuat keputusan berikut secara senyap semasa implementasi:

- Cara pengesahan pengguna, tempoh pautan sah, perkongsian pautan dan akses merentas peranti.
- Kaedah mengesan rekod utama lama serta migrasi rekod yang tiada kategori/caj snapshot.
- Pemetaan tepat kadar jika kategori berubah sebelum hari percuma asal habis; prinsip tiada percuma baharu automatik sudah dipersetujui, tetapi formula penuh semua transisi perlu contoh ujian/pengesahan.
- Hari tambahan sahaja tidak meningkatkan indeks tarif utama atau menggunakan had 30 hari: sudah disahkan dalam bahagian 4. Cooldown tetap menunggu semua kenderaan.
- Pengendalian perubahan kategori berulang, had setiap permohonan pengecualian, pembatalan selepas tarikh mula, serta refund separa.
- Skop unik rujukan transaksi, satu resit membayar beberapa rekod, dan tindakan jika rujukan tidak tersedia.
- Penguatkuasaan peranan sebenar admin/pengawal dan pengesahan bahawa resit bukan semakan terus transaksi bank.

## 10. Contoh ujian penerimaan

| Kes | Jangkaan |
|---|---|
| Tunggakan RM1 / RM1.01 / RM400 / RM400.01 | Kategori 1 / 2 / 2 / 3 |
| Kategori 1, utama 6 hari | RM15 |
| Kategori 2, utama 6 hari | RM35 |
| Kategori 3, utama 3 hari | RM45 |
| Kategori 1, tambahan 5 hari | RM50 |
| Permohonan 1–3 disambung 3–5, kereta sama | 5 hari unik, bukan 6 |
| Utama tamat 3 Sept, tambahan tamat 5 Sept | Cooldown 6–8; layak 9 Sept |
| Kategori 1/2 guna 20 hari, rehat sehari, kembali | Baki had 10 hari |
| Kategori 3 sambung selepas 30 hari | Dibenarkan; maksimum 30 hari tiap permohonan |
| Caj RM30; bayaran RM20 kemudian RM10 | Baki RM10 kemudian RM0; sejarah dua transaksi |
| Caj RM30; dua transaksi sebenar RM30 | Lebihan RM30 untuk semakan admin |
| Transaksi dibatalkan admin | Tidak dijumlahkan; sebab dan sejarah kekal |
| Pembatalan sebelum masuk disahkan admin | Tidak menggunakan kelayakan atau cooldown |

Semua contoh ialah data ilustrasi, bukan hasil bacaan pangkalan data sebenar.
