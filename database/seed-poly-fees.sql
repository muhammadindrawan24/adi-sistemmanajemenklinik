-- ============================================================
-- SEED DATA: Tarif Poli (Biaya Pemeriksaan + Administrasi)
-- ============================================================

INSERT INTO poly_fees (poli_id, examination_fee, admin_fee) VALUES
  ((SELECT id FROM poli WHERE initial = 'U'), 50000, 5000),  -- Poli Umum
  ((SELECT id FROM poli WHERE initial = 'A'), 60000, 5000),  -- Poli Anak
  ((SELECT id FROM poli WHERE initial = 'G'), 75000, 5000),  -- Poli Gigi
  ((SELECT id FROM poli WHERE initial = 'M'), 80000, 5000),  -- Poli Mata
  ((SELECT id FROM poli WHERE initial = 'K'), 65000, 5000);  -- Poli Kulit
