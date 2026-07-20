# KlinikSehat - Sistem Manajemen Klinik Digital

## Deskripsi Sistem

**KlinikSehat** adalah aplikasi web sistem manajemen klinik terintegrasi yang dibangun dengan teknologi modern (Next.js 16, React 19, Supabase, Tailwind CSS). Sistem ini dirancang untuk mengotomatiskan dan mempermudah seluruh operasional klinik, mulai dari pendaftaran pasien, pengelolaan antrian, pencatatan medis, manajemen obat, hingga pembayaran dan pelaporan.

Aplikasi ini menggunakan arsitektur **Role-Based Access Control (RBAC)** dengan 4 role pengguna yang masing-masing memiliki hak akses dan dashboard tersendiri, sehingga setiap pengguna hanya dapat mengakses fitur yang sesuai dengan tanggung jawabnya.

---

## Teknologi yang Digunakan

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | Custom (shadcn-style dengan CVA) |
| Animasi | Framer Motion 12 |
| Backend/Database | Supabase (PostgreSQL + Auth + Realtime) |
| Form Handling | React Hook Form 7 + Zod 4 |
| Charts | Recharts 3 |
| PDF Export | jsPDF |
| Excel Export | xlsx (SheetJS) |
| Icons | Lucide React |
| Dark Mode | next-themes |

---

## Role Pengguna

### 1. Administrator (Admin)

Admin memiliki akses penuh ke seluruh sistem dan bertanggung jawab atas pengelolaan data master serta monitoring operasional klinik.

**Fitur yang tersedia:**
- Dashboard (statistik real-time, grafik kunjungan, aktivitas terbaru)
- Manajemen User (CRUD pengguna dengan role)
- Manajemen Pasien (data pasien, No. RM, NIK)
- Manajemen Dokter (data dokter, NIP, spesialisasi, nomor izin)
- Manajemen Poli (poliklinik, lokasi, deskripsi)
- Jadwal Dokter (jadwal praktik per hari, jam, kuota pasien)
- Manajemen Stok Obat (CRUD obat, harga beli/jual, stok, kategori)
- Tarif Poli (biaya pemeriksaan dan administrasi per poli)
- Fitur Pembayaran (riwayat semua pembayaran, filter, detail)
- Laporan Keuangan (statistik pendapatan, filter periode, export PDF/Excel)
- Laporan Kunjungan (analisis kunjungan pasien)
- Audit Log (log semua aktivitas perubahan data)

### 2. Petugas (Front Desk)

Petugas bertanggung jawab atas pendaftaran pasien, pengelolaan antrian, dan proses pembayaran di konter.

**Fitur yang tersedia:**
- Dashboard (ringkasan aktivitas hari ini)
- Registrasi Pasien (pendaftaran pasien baru dan pasien lama)
- Kelola Antrian (panggil, proses, selesaikan, batalkan antrian)
- Fitur Pembayaran (proses pembayaran pasien, pilih metode bayar)
- Stok Obat (input stok masuk dari supplier, lihat log mutasi)

### 3. Dokter

Dokter bertanggung jawab atas pemeriksaan pasien, pencatatan medis, dan pemberian resep obat.

**Fitur yang tersedia:**
- Dashboard (ringkasan jadwal dan pasien hari ini)
- Jadwal Saya (lihat jadwal praktik)
- Pemeriksaan (form pemeriksaan lengkap dengan resep obat)
- Resep Favorit (template resep tersimpan untuk penggunaan berulang)
- Rekam Medis (riwayat pemeriksaan pasien)

### 4. Pasien

Pasien dapat mengambil antrian, memantau status antrian, dan melihat riwayat pemeriksaan serta rincian biaya.

**Fitur yang tersedia:**
- Dashboard (ringkasan kunjungan)
- Ambil Antrian (pilih poli, ambil nomor antrian)
- Antrian Saya (status antrian real-time)
- Riwayat Pemeriksaan (daftar kunjungan, resep obat, rincian biaya, export PDF)

---

## Fitur Utama

### 1. Sistem Antrian Digital
- Ambil nomor antrian langsung dari aplikasi (oleh pasien atau petugas)
- Nomor antrian otomatis berdasarkan poli (contoh: U001, A001, K001)
- Status antrian real-time: Menunggu → Dipanggil → Sedang Diperiksa → Selesai / Dibatalkan
- Auto-call: Saat dokter menyelesaikan pemeriksaan, antrian berikutnya otomatis dipanggil

### 2. Rekam Medis Elektronik
- Input saat pemeriksaan: diagnosis, gejala, pengobatan, resep
- Tanda vital: tekanan darah, berat badan, tinggi badan, suhu tubuh
- Keluhan utama pasien
- Riwayat pemeriksaan sebelumnya

### 3. Manajemen Stok Obat
- Catalog obat lengkap dengan kategori (tablet, kapsul, sirup, salep, tetes, gel, krim, injeksi, sachet)
- Harga beli dan harga jual
- Stok minimum dan peringatan stok menipis
- Log mutasi stok (masuk/keluar)
- Obat per poli + vitamin untuk semua poli

### 4. Sistem Resep Obat
- Dokter cari obat dari database (tidak perlu hafal nama obat)
- Input aturan pakai: dosis, frekuensi, durasi
- Otomatis hitung subtotal per obat dan total biaya obat
- Stok obat otomatis berkurang saat resep dikonfirmasi

### 5. Resep Favorit
- Simpan resep yang sering dipakai sebagai template
- Klik satu kali untuk gunakan ulang resep favorit
- Kelola (tambah, edit, hapus) resep favorit

### 6. Sistem Pembayaran & Biaya
- Tarif pemeriksaan dan administrasi per poli (diatur admin)
- Total biaya otomatis terhitung: Biaya Periksa + Biaya Admin + Biaya Obat
- Metode pembayaran: Tunai / Transfer
- Struk pembayaran otomatis

### 7. Laporan & Analisis
- Laporan kunjungan (filter periode, dokter, poli)
- Laporan keuangan (statistik pendapatan, biaya periksa, biaya obat)
- Grafik kunjungan 7 hari terakhir
- Export PDF dan Excel

### 8. Keamanan Data
- Row Level Security (RLS) untuk semua tabel
- Autentikasi via Supabase Auth
- Audit log untuk setiap perubahan data

---

## Keunggulan Sistem

### 1. Terintegrasi
Satu aplikasi melayani seluruh operasional klinik, mulai dari pendaftaran hingga pembayaran, tanpa perlu beberapa aplikasi terpisah.

### 2. Real-Time
Status antrian diperbarui secara real-time menggunakan Supabase Realtime, sehingga semua pengguna melihat data terkini.

### 3. User-Friendly
Interface modern dengan desain yang intuitif, dark mode, animasi halus, dan responsive (bisa diakses dari mobile maupun desktop).

### 4. Otomatisasi
- Auto-create pembayaran saat antrian selesai
- Auto-kurangi stok saat resep dibuat
- Auto-call antrian berikutnya
- Nomor antrian otomatis

### 5. Keamanan
- Row Level Security (RLS) memastikan setiap role hanya mengakses data yang diizinkan
- Audit log mencatat semua perubahan data
- Autentikasi dan otorisasi terintegrasi

### 6. Export Data
Laporan bisa diunduh dalam format PDF dan Excel untuk keperluan administrasi dan arsip.

### 7. Skalabilitas
Dibangun dengan teknologi modern (Next.js, Supabase) yang mudah dikembangkan dan di-deploy.

---

## Struktur Database

| Tabel | Fungsi |
|-------|--------|
| `users` | Akun pengguna (4 role) |
| `profiles` | Profil lengkap pengguna |
| `patients` | Data pasien (No. RM, NIK, golongan darah, alergi) |
| `doctors` | Data dokter (NIP, spesialisasi, nomor izin) |
| `poli` | Poliklinik (Umum, Anak, Gigi, Mata, Kulit, Kandungan) |
| `doctor_schedules` | Jadwal dokter per hari dan jam |
| `queues` | Antrian pasien |
| `medical_records` | Rekam medis |
| `medicines` | Master data obat |
| `stock_mutations` | Log mutasi stok obat |
| `poly_fees` | Tarif per poli |
| `prescription_items` | Item obat di resep medis |
| `favorite_prescriptions` | Resep favorit dokter |
| `payments` | Data pembayaran |
| `audit_logs` | Log audit sistem |

---

## Alur Operasional

```
1. PENDAFTARAN
   Pasien/Petugas → Daftar → Input data → Ambil nomor antrian

2. PENUNGGUAN
   Pasien menunggu → Status: Menunggu → Dipanggil

3. PEMERIKSAAN
   Dokter periksa → Input diagnosis, gejala, tanda vital
   → Tulis resep obat → Submit → Status: Selesai

4. PEMBAYARAN
   Petugas proses → Lihat rincian biaya
   → Pilih metode bayar → Konfirmasi → Status: Dibayar

5. SELESAI
   Pasien terima bukti → Lihat riwayat di aplikasi
```

---

## Poliklinik yang Tersedia

| Poli | Inisial | Tarif Periksa | Tarif Admin | Total |
|------|---------|---------------|-------------|-------|
| Poli Umum | U | Rp 50.000 | Rp 5.000 | Rp 55.000 |
| Poli Anak | A | Rp 60.000 | Rp 5.000 | Rp 65.000 |
| Poli Gigi | G | Rp 75.000 | Rp 5.000 | Rp 80.000 |
| Poli Mata | M | Rp 80.000 | Rp 5.000 | Rp 85.000 |
| Poli Kulit | K | Rp 65.000 | Rp 5.000 | Rp 70.000 |
| Poli Kandungan | KDG | Rp 75.000 | Rp 5.000 | Rp 80.000 |

---

## Stok Obat

Sistem menyediakan **55 obat** yang sudah terisi, terdiri dari:

| Kategori | Jumlah | Contoh |
|----------|--------|--------|
| Poli Umum | 10 | Paracetamol, Amoxicillin, Omeprazole |
| Poli Anak | 6 | Paracetamol Sirup Anak, Amoxicillin Sirup |
| Poli Gigi | 4 | Amoksisilin, Metronidazole |
| Poli Mata | 4 | Cendo Aritromin, Visine-A |
| Poli Kulit | 5 | Hydrocortisone, Mupirocin |
| Poli Kandungan | 15 | Duphaston, Folic Acid, Blackmores |
| Vitamin | 11 | Vitamin C, B Complex, Imboost |

---

## Kesimpulan

KlinikSehat adalah solusi digital lengkap untuk manajemen klinik modern. Dengan fitur yang komprehensif, keamanan data yang kuat, dan antarmuka yang user-friendly, sistem ini membantu klinik mengoptimalkan operasional, meningkatkan pelayanan pasien, dan memudahkan pengelolaan data secara terintegrasi.
