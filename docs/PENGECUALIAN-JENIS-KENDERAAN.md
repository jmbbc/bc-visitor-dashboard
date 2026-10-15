# Pengecualian jenis kenderaan daripada parkir kereta

Polisi disahkan 15 Oktober 2026: caj Pelawat bermalam hanya untuk Kereta / 4x4 (termasuk label lama Kereta) dan Lori. Motosikal dan Pejalan Kaki dikecualikan daripada caj, counter hari percuma, cooldown dan pengelasan tambahan. Jenis kenderaan borang sekarang terpakai kepada semua plat dalam borang yang sama. Deposit kontraktor bukan caj parkir ini dan tidak dikecualikan oleh perubahan ini.

js/parking-vehicle-type.mjs menjadi pengelasan bersama. Jenis tidak diketahui atau kosong dalam sejarah memerlukan semakan dan tidak dianggap kereta secara automatik. Pendaftaran baharu Pelawat bermalam memerlukan jenis yang dikenali.

Borang memaparkan RM0 bagi jenis dikecualikan walaupun kategori tunggakan 2/3 atau mempunyai beberapa plat. Pendaftaran dikecualikan tidak mencipta caj rasmi atau queue caj dan tidak menggantikan lock/counter kereta yang sedia ada. Jika unit hanya mempunyai pendaftaran dikecualikan, metadata pengurusan menggunakan stayOver No tanpa counter parkir. Rekod pendaftaran masih menyimpan pilihan bermalam sebenar pengguna. Ini tidak memperluaskan hak edit sedia ada; pengurusan yang memerlukan lock unit kekal tertakluk kepada sekatan pengurusan sedia ada.

Enjin harian tidak menambah tarikh atau pemilik caj daripada motosikal/pejalan kaki. Oleh itu motosikal yang berada di unit sepanjang cooldown kereta tidak menangguhkan kelayakan percuma kereta. Laporan mingguan dan Semakan Caj mengecualikannya daripada penggunaan parkir kereta.

Sejarah caj lama tidak ditulis semula secara pukal. Panel bayaran masih menunjukkan caj/resit lama untuk semakan admin dan menyekat kutipan baharu bagi jenis dikecualikan. Admin boleh melaras caj lama kepada RM0 dengan jurnal. Caj positif baharu dan resit baharu bagi jenis dikecualikan turut disekat dalam Firestore Rules; Rules tidak menambah akses pengguna.

172 ujian automatik dan 21 senario emulator menguji kategori 1/2/3, dua jenis dikecualikan, laporan, cooldown, slot tambahan, counter sedia ada, transaksi borang awam, larangan caj positif/resit dan pelarasan admin kepada RM0. Terbitkan Rules yang diuji sebelum versi frontend baharu. Isu edit merentas peranti dan pembatalan pemohon kekal ditangguhkan.
