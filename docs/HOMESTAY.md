# Kategori Homestay

Pengendali mendaftarkan tetamu dalam borang pelawat asal. Dua pasangan nombor petak / plat tersedia; Lot 2 pilihan, tambah baris bagi lot berikutnya. Pilihan Tiada kenderaan tidak memerlukan lot. Setiap lot yang digunakan wajib lengkap dan petak/plat tidak boleh berulang. Tarikh keluar wajib dan tidak mendahului tarikh masuk; had tiga hari parkir pelawat tidak digunakan untuk Homestay.

Simpan padanan dalam responses.vehicleRowsDetailed[].parkingLot bersama plate, visitorName, visitorPhone, startDate dan endDate. Gunakan vehicleNumbers untuk carian plat sedia ada. Rekod tanpa kenderaan menggunakan vehicleNo TIADA KENDERAAN dan dua senarai kenderaan kosong untuk keserasian Rules sedia ada. Tiada koleksi atau kebenaran baharu diperlukan.

Homestay tidak menulis overnightLocks, parkingCharges atau parkingLedgerQueue dan tidak termasuk kalendar/counter parkir pelawat. WhatsApp menyenaraikan pengendali, tetamu, tarikh dan setiap padanan plat → petak; tidak memasukkan tunggakan/caj/cooldown. Keselamatan melihat setiap padanan dalam senarai pendaftaran. Admin boleh membetulkan pasangan di dialog Edit menggunakan satu baris NOMBOR PETAK | NOMBOR PLAT; kosongkan untuk tiada kenderaan.

Draf dan guna semula maklumat menyimpan padanan. Compatibility fallback tidak menggugurkan vehicleRowsDetailed untuk Homestay. Tiada migrasi atau pengubahan rekod lama.

Pengesahan: node --test scripts/homestay.test.mjs scripts/parking-vehicle-type.test.mjs scripts/parking-cycles.test.mjs. scripts/homestay.emulator.mjs menguji Rules HEAD di emulator 8149; sumber Rules boleh ditentukan melalui HOMESTAY_TEST_RULES.
