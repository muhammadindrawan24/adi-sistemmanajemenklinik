-- Migration: Add vitals columns + NIK column
-- Run this in Supabase SQL Editor

-- Add vitals columns to medical_records
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS blood_pressure TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS weight NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS height NUMERIC(5,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS chief_complaint TEXT;

-- Add NIK column to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nik TEXT;
