-- Migration: Add vitals columns + NIK column + RLS policies + Fix queue number race condition
-- Run this in Supabase SQL Editor

-- Add vitals columns to medical_records
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS blood_pressure TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS weight NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS height NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS chief_complaint TEXT;

-- Add NIK column to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nik TEXT;

-- RLS: Allow authenticated users to insert their own user record
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS: Allow authenticated users to insert their own patient record
CREATE POLICY "Users can insert own patient" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix queue number race condition: use advisory lock for atomic queue number generation
CREATE OR REPLACE FUNCTION generate_queue_number(poli_initial TEXT)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  new_queue_number TEXT;
  lock_key INTEGER;
BEGIN
  -- Create a unique lock key from poli initial (e.g., 'U' -> 1, 'A' -> 2, etc.)
  lock_key := hashtext(poli_initial);

  -- Acquire advisory lock to prevent race condition
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(queue_number FROM 2) AS INTEGER)),
    0
  ) + 1
  INTO next_num
  FROM queues
  WHERE queue_number LIKE poli_initial || '%'
    AND DATE(created_at) = CURRENT_DATE;

  new_queue_number := poli_initial || LPAD(next_num::TEXT, 3, '0');
  RETURN new_queue_number;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_queue_number(TEXT) TO authenticated;
