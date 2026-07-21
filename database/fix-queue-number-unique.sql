-- Fix: Ubah unique constraint queue_number dari single column ke composite (queue_number, visit_date)
-- Jalankan di Supabase SQL Editor

-- 1. Drop unique constraint lama
ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_queue_number_key;

-- 2. Tambah composite unique constraint
ALTER TABLE queues ADD CONSTRAINT queues_queue_number_visit_date_key UNIQUE (queue_number, visit_date);
