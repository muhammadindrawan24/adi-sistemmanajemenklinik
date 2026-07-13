-- Fix: Update NIK for existing patients that were created before NIK column was added
-- Run this in Supabase SQL Editor

-- Sari Dewi (RM-2026-9830)
UPDATE patients SET nik = '3201234567890001' WHERE medical_record_number = 'RM-2026-9830';

-- Rizky Pratama (RM-2026-4238)
UPDATE patients SET nik = '3201234567890002' WHERE medical_record_number = 'RM-2026-4238';
