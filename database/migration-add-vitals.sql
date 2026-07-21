-- Migration: Add vitals columns + NIK column + RLS policies + Fix queue + H-1 booking
-- Run this in Supabase SQL Editor

-- Add vitals columns to medical_records
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS blood_pressure TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS weight NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS height NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS chief_complaint TEXT;

-- Add NIK column to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nik TEXT;

-- Add visit_date column to queues for H-1 booking
ALTER TABLE queues ADD COLUMN IF NOT EXISTS visit_date DATE DEFAULT CURRENT_DATE;

-- Backfill: set visit_date = DATE(created_at) for existing rows
UPDATE queues SET visit_date = DATE(created_at) WHERE visit_date IS NULL;

-- Make visit_date NOT NULL after backfill
ALTER TABLE queues ALTER COLUMN visit_date SET NOT NULL;

-- Add index for visit_date filtering
CREATE INDEX IF NOT EXISTS idx_queues_visit_date ON queues(visit_date);

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
  p_poli_initial TEXT,
  p_visit_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  next_num INTEGER;
  new_queue_number TEXT;
  lock_key INTEGER;
  new_queue_id UUID;
BEGIN
  lock_key := hashtext(p_poli_initial || p_visit_date::TEXT);
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(queue_number FROM (length(p_poli_initial) + 1)) AS INTEGER)),
    0
  ) + 1
  INTO next_num
  FROM queues
  WHERE queue_number LIKE p_poli_initial || '%'
    AND visit_date = p_visit_date;

  new_queue_number := p_poli_initial || LPAD(next_num::TEXT, 3, '0');

  INSERT INTO queues (patient_id, poli_id, doctor_schedule_id, queue_number, status, visit_date)
  VALUES (p_patient_id, p_poli_id, p_doctor_schedule_id, new_queue_number, 'menunggu', p_visit_date)
  RETURNING id INTO new_queue_id;

  RETURN json_build_object(
    'id', new_queue_id,
    'queue_number', new_queue_number,
    'position', next_num
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_queue(UUID, UUID, UUID, TEXT, DATE) TO authenticated;

-- Update trigger: auto-call next queue respects visit_date
CREATE OR REPLACE FUNCTION handle_queue_selesai()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' AND OLD.status != 'selesai' THEN
    NEW.examination_finished_at = NOW();

    UPDATE queues
    SET status = 'dipanggil',
        called_at = NOW(),
        updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM queues
      WHERE poli_id = NEW.poli_id
        AND status = 'menunggu'
        AND visit_date = CURRENT_DATE
        AND id != NEW.id
      ORDER BY queue_number ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix: Ubah unique constraint queue_number dari single column ke composite (queue_number, visit_date)
ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_queue_number_key;
ALTER TABLE queues ADD CONSTRAINT queues_queue_number_visit_date_key UNIQUE (queue_number, visit_date);
