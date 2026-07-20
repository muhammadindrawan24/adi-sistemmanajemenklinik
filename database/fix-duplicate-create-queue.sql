-- Fix: Hapus semua versi create_queue yang lama, lalu buat ulang yang benar
-- Jalankan di Supabase SQL Editor

-- 1. Drop semua versi lama create_queue
DROP FUNCTION IF EXISTS create_queue(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS create_queue(UUID, UUID, UUID, TEXT, DATE);

-- 2. Buat ulang create_queue yang benar (5 parameter)
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
