# Daftar Masuk Kaunter

GitHub Pages menerbitkan counter-github.html daripada main. Borang menghantar pendaftaran ke Apps Script melalui URL /exec. Pages.gs memanggil fungsi pengesahan dan simpanan dalam projek Apps Script, kemudian menghantar pengesahan kepada borang.

Untuk perubahan pada kod Apps Script, kemas kini deployment sedia ada yang dirujuk dalam counter-github.html. Counter.html ialah salinan borang ujian untuk paparan terus melalui Apps Script.

## Rekod hari ini dalam Dashboard Keselamatan

Dalam projek Apps Script yang menerima borang GitHub Pages, tambah `CounterRead.gs` dan kemas kini `Pages.gs`. Kekalkan `Code.gs` yang menyimpan rekod. Dalam Project Settings → Script Properties, tetapkan:

- `COUNTER_FIREBASE_API_KEY` kepada nilai `apiKey` Firebase projek dashboard dalam `js/firebase-init.js`.
- `COUNTER_STAFF_UIDS` kepada UID Firebase Authentication staf yang diluluskan, dipisahkan dengan koma.

Kemas kini versi deployment /exec yang sama dan sahkan kebenaran baharu untuk panggilan luaran jika diminta. Panel dashboard menggunakan URL /exec yang sama dengan borang. Jika URL berubah, kemas kini kedua-dua rujukan sebelum menerbitkan dashboard.

Selepas diterbitkan, buka Pelawat Checked In (Hari Ini) → Daftar Masuk Kaunter dengan akaun staf. Semak rekod hari ini dan cuba dengan akaun yang UID-nya tiada dalam senarai. Uji penghantaran borang juga untuk mengesahkan laluan simpanan.
