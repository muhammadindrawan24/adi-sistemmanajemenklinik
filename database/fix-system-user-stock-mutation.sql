-- Fix: Insert user sistem untuk trigger stock_mutations
-- Jalankan di Supabase SQL Editor

-- Insert user sistem (jika belum ada)
INSERT INTO users (id, email, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@kliniksehat.com', 'admin', true)
ON CONFLICT (id) DO NOTHING;
