-- ============================================================
-- Fix: Insert existing user M Akbar ke tabel users
-- ============================================================
-- User sudah bisa login di Supabase Auth tapi belum ada di tabel users

-- UUID dari screenshot: 9e09b118-6a9b-4405-8d2a-d55cc4fc2de2
-- Email: mohammad.firmansyah23@student.uisi.ac.id

-- 1. Insert ke tabel users (role: pasien)
INSERT INTO users (id, email, role, is_active)
VALUES (
  '9e09b118-6a9b-4405-8d2a-d55cc4fc2de2',
  'mohammad.firmansyah23@student.uisi.ac.id',
  'pasien',
  true
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Insert ke tabel profiles (jika belum ada)
INSERT INTO profiles (user_id, full_name)
VALUES (
  '9e09b118-6a9b-4405-8d2a-d55cc4fc2de2',
  'M Akbar'
)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- 3. Insert ke tabel patients (jika belum ada)
-- Generate nomor RM
DO $$
DECLARE
  rm_number TEXT;
BEGIN
  rm_number := 'RM' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 999 + 1)::TEXT, 3, '0');

  INSERT INTO patients (user_id, medical_record_number, gender)
  VALUES (
    '9e09b118-6a9b-4405-8d2a-d55cc4fc2de2',
    rm_number,
    'laki_laki'
  )
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Verifikasi
SELECT u.id, u.email, u.role, u.is_active, p.full_name
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.id = '9e09b118-6a9b-4405-8d2a-d55cc4fc2de2';
