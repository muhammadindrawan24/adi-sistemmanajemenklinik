# Panduan Migrasi Database

## Langkah-langkah Migrasi

### 1. Buka Supabase Dashboard
- Login ke https://supabase.com
- Pilih project **klinik-app**
- Klik **SQL Editor** di sidebar

### 2. Jalankan Migration SQL
- Copy seluruh isi file `migration-add-features.sql`
- Paste ke SQL Editor
- Klik **Run** atau tekan `Ctrl + Enter`

### 3. Verifikasi
Setelah migrasi berhasil, cek:
- Buka **Table Editor** → pastikan tabel baru muncul:
  - `medicines`
  - `stock_mutations`
  - `poly_fees`
  - `prescription_items`
  - `favorite_prescriptions`
  - `payments`

### 4. Cek Seed Data
- Buka tabel `medicines` → pastikan ada 40 obat
- Buka tabel `poly_fees` → pastikan ada 5 tarif poli

## Yang Ditambahkan

### Tabel Baru (6)
| Tabel | Fungsi |
|-------|--------|
| `medicines` | Master data obat (40 obat seed) |
| `stock_mutations` | Log mutasi stok masuk/keluar |
| `poly_fees` | Tarif per poli |
| `prescription_items` | Item obat di resep medis |
| `favorite_prescriptions` | Resep favorit dokter |
| `payments` | Data pembayaran pasien |

### Trigger Baru (2)
1. **on_queue_selesai_payment** → Auto buat record pembayaran saat antrian selesai
2. **on_prescription_stock** → Auto kurangi stok saat resep dibuat

### RLS Policies
- Semua tabel memiliki RLS yang sesuai dengan role pengguna
- Admin: akses penuh
- Petugas: input stok, proses pembayaran
- Dokter: lihat obat, buat resep, kelola resep favorit
- Pasien: lihat riwayat + rincian biaya

## Troubleshooting

### Error: "relation already exists"
- Tabel sudah ada, migrasi bisa dilewati untuk tabel tersebut
- Atau gunakan `CREATE TABLE IF NOT EXISTS` (sudah ada di migration file)

### Error: "function already exists"
- Fungsi sudah ada, bisa di-drop dulu atau gunakan `CREATE OR REPLACE FUNCTION`

### Error: "policy already exists"
- Policy sudah ada, bisa di-drop dulu:
  ```sql
  DROP POLICY IF EXISTS "policy_name" ON table_name;
  ```

### Error: "trigger already exists"
- Trigger sudah ada, bisa di-drop dulu:
  ```sql
  DROP TRIGGER IF EXISTS trigger_name ON table_name;
  ```

## Rollback (Jika Perlu)

Jika ingin menghapus semua tabel baru:
```sql
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS favorite_prescriptions CASCADE;
DROP TABLE IF EXISTS prescription_items CASCADE;
DROP TABLE IF EXISTS poly_fees CASCADE;
DROP TABLE IF EXISTS stock_mutations CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
```
