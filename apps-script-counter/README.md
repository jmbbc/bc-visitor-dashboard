# Deployment borang kaunter

GitHub Actions mengemas kini Counter.html dalam deployment Apps Script sedia ada apabila fail itu dipush ke main. Jalankan Deploy Counter secara manual dari tab Actions untuk ujian pertama.

1. Aktifkan Google Apps Script API dalam Google Cloud dan dalam tetapan pengguna Apps Script.
2. Guna akaun pemilik deployment untuk mendapatkan kelulusan OAuth dengan akses offline dan skop https://www.googleapis.com/auth/script.projects serta https://www.googleapis.com/auth/script.deployments.
3. Dalam GitHub Settings → Secrets and variables → Actions, tambah COUNTER_SCRIPT_ID dan COUNTER_DEPLOYMENT_ID sebagai Variables. Gunakan Script ID daripada Project Settings dan Deployment ID daripada Manage deployments.
4. Simpan OAuth client ID, client secret dan refresh token sebagai Secrets bernama COUNTER_GOOGLE_CLIENT_ID, COUNTER_GOOGLE_CLIENT_SECRET dan COUNTER_GOOGLE_REFRESH_TOKEN.
5. Jalankan workflow pada main. Selepas lulus, buka pautan /exec sedia ada dan semak paparan borang.

Skrip membaca fail projek Apps Script semasa dan menukar kandungan Counter sahaja. Ia menyemak deployment peribadi sebelum menerbitkan versi. Simpan perubahan pada Counter.html dalam repo supaya GitHub Actions menggunakan versi yang dimaksudkan.
