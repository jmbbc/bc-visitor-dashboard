# Kategori Homestay

Pengendali mendaftarkan tetamu dalam borang pelawat asal. Dua pasangan nombor petak / plat tersedia; Lot 2 pilihan, tambah baris bagi lot berikutnya. Pilihan Tiada kenderaan tidak memerlukan lot. Setiap lot yang digunakan wajib lengkap dan petak/plat tidak boleh berulang. Tarikh keluar wajib dan tidak mendahului tarikh masuk; had tiga hari parkir pelawat tidak digunakan untuk Homestay.

Simpan padanan dalam responses.vehicleRowsDetailed[].parkingLot bersama plate, visitorName, visitorPhone, startDate dan endDate. Gunakan vehicleNumbers untuk carian plat sedia ada. Rekod tanpa kenderaan menggunakan vehicleNo TIADA KENDERAAN dan dua senarai kenderaan kosong untuk keserasian Rules sedia ada. Tiada koleksi atau kebenaran baharu diperlukan.

Homestay tidak menulis overnightLocks atau parkingLedgerQueue dan tidak menggunakan counter pelawat biasa. Parkir pelawat Homestay muncul dalam laporan mingguan dan mempunyai parkingCharges tersendiri. WhatsApp menyenaraikan pengendali, tetamu, tarikh, jenis parkir dan caj jika ada. Keselamatan melihat setiap padanan dalam senarai pendaftaran. Admin boleh membetulkan pasangan di dialog Edit menggunakan satu baris NOMBOR PETAK | NOMBOR PLAT; kosongkan untuk tiada kenderaan.

Draf dan guna semula maklumat menyimpan padanan. Compatibility fallback tidak menggugurkan vehicleRowsDetailed untuk Homestay. Tiada migrasi atau pengubahan rekod lama.

Pengesahan: node --test scripts/homestay.test.mjs scripts/parking-vehicle-type.test.mjs scripts/parking-cycles.test.mjs. scripts/homestay.emulator.mjs menguji Rules HEAD di emulator 8149; sumber Rules boleh ditentukan melalui HOMESTAY_TEST_RULES.


## Parkir pelawat — 31 Oktober 2026

Setiap kenderaan memilih petak sendiri (percuma) atau parkir pelawat (RM5 sehari, termasuk tarikh mula dan akhir). Tarikh parkir boleh lebih pendek daripada penginapan; tarikh kosong mengikut tarikh penginapan. Kadar tetap tidak menggunakan kategori tunggakan, hari percuma, cooldown atau kadar kenderaan tambahan pelawat biasa.

`vehicleRowsDetailed` menyimpan `parkingType: visitor`, tarikh dan nombor plat; rekod lama tanpa parkingType kekal petak sendiri. Caj positif dan permohonan disimpan dalam transaksi yang sama, dengan `parkingQuote.policyVersion=homestay-rm5-2026-10-31`. Tiada perubahan pada overnightLocks atau parkingLedgerQueue. Dashboard mingguan hanya memasukkan kenderaan Homestay yang menggunakan parkir pelawat.

WhatsApp menyenaraikan padanan petak sendiri atau tarikh/caj parkir pelawat dan jumlah keseluruhan. Pengubahan sendiri permohonan Homestay sedia ada dirujuk kepada pengurusan. Admin boleh mengubah butiran dengan jumlah caj sama; perubahan jumlah perlu pelarasan Bayaran dahulu.

Pengesahan: ujian model dan transaksi public submission + resit melalui Firebase Emulator dengan rules yang telah dicommit; tiada penulisan data pengeluaran semasa ujian.
