-- Migration: Add vitals columns + NIK column + RLS policies
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
