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
  lock_key := hashtext(poli_initial);
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

GRANT EXECUTE ON FUNCTION generate_queue_number(TEXT) TO authenticated;

-- Atomic queue creation: generate number + insert in ONE transaction
CREATE OR REPLACE FUNCTION create_queue(
  p_patient_id UUID,
  p_poli_id UUID,
  p_doctor_schedule_id UUID,
  p_poli_initial TEXT
)
RETURNS JSON AS $$
DECLARE
  next_num INTEGER;
  new_queue_number TEXT;
  lock_key INTEGER;
  new_queue_id UUID;
BEGIN
  lock_key := hashtext(p_poli_initial);
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(queue_number FROM (length(p_poli_initial) + 1)) AS INTEGER)),
    0
  ) + 1
  INTO next_num
  FROM queues
  WHERE queue_number LIKE p_poli_initial || '%';

  new_queue_number := p_poli_initial || LPAD(next_num::TEXT, 3, '0');

  INSERT INTO queues (patient_id, poli_id, doctor_schedule_id, queue_number, status)
  VALUES (p_patient_id, p_poli_id, p_doctor_schedule_id, new_queue_number, 'menunggu')
  RETURNING id INTO new_queue_id;

  RETURN json_build_object(
    'id', new_queue_id,
    'queue_number', new_queue_number,
    'position', next_num
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_queue(UUID, UUID, UUID, TEXT) TO authenticated;
