-- ============================================================
-- Fix: Allow authenticated users to register themselves
-- ============================================================
-- Masalah: RLS policy hanya mengizinkan admin insert ke tabel users
-- Sehingga user baru tidak bisa register dan role tidak terdaftar

-- 1. Tambahkan policy agar user terotentikasi bisa insert record sendiri ke tabel users
CREATE POLICY "Authenticated users can insert own record"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() = id
  );

-- 2. Tambahkan policy agar user terotentikasi bisa insert profile sendiri
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Verifikasi policy sudah ditambahkan
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users', 'profiles')
  AND policyname LIKE '%insert%'
ORDER BY tablename, policyname;
