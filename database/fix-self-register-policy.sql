-- ============================================================
-- Fix: Allow authenticated users to register themselves
-- ============================================================
-- Masalah: RLS policy hanya mengizinkan admin insert ke tabel users
-- Sehingga user baru tidak bisa register dan role tidak terdaftar

-- Tambahkan policy agar user terotentikasi bisa insert record sendiri
CREATE POLICY "Authenticated users can insert own record"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() = id
  );

-- Verifikasi policy sudah ditambahkan
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
