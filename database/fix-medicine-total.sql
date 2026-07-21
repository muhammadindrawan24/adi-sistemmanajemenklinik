-- Fix: Hitung biaya obat dari resep saat pembayaran dibuat
-- Jalankan di Supabase SQL Editor

-- 1. Update handle_queue_payment function
CREATE OR REPLACE FUNCTION handle_queue_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_medicine_total NUMERIC(10,2);
BEGIN
  IF NEW.status = 'selesai' AND OLD.status != 'selesai' THEN
    -- Hitung total biaya obat dari resep
    SELECT COALESCE(SUM(pi.subtotal), 0)
    INTO v_medicine_total
    FROM prescription_items pi
    JOIN medical_records mr ON pi.medical_record_id = mr.id
    WHERE mr.queue_id = NEW.id;

    INSERT INTO payments (queue_id, patient_id, examination_fee, admin_fee, medicine_total, total_amount, status)
    SELECT
      NEW.id,
      NEW.patient_id,
      COALESCE(pf.examination_fee, 0),
      COALESCE(pf.admin_fee, 0),
      v_medicine_total,
      COALESCE(pf.examination_fee, 0) + COALESCE(pf.admin_fee, 0) + v_medicine_total,
      'belum_bayar'
    FROM poly_fees pf
    WHERE pf.poli_id = NEW.poli_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix payment yang sudah ada tapi medicine_total = 0 (padahal ada resep)
UPDATE payments p
SET
  medicine_total = COALESCE(sub.total, 0),
  total_amount = p.examination_fee + p.admin_fee + COALESCE(sub.total, 0)
FROM (
  SELECT
    mr.queue_id,
    SUM(pi.subtotal) AS total
  FROM prescription_items pi
  JOIN medical_records mr ON pi.medical_record_id = mr.id
  GROUP BY mr.queue_id
) sub
WHERE p.queue_id = sub.queue_id
  AND (p.medicine_total = 0 OR p.medicine_total IS NULL);
