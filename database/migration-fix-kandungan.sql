-- ============================================================
-- FIX: Tambah Obat + Tarif untuk Poli Kandungan yang sudah ada
-- Jalankan ini di Supabase SQL Editor
-- ============================================================

-- 1. Tambah Tarif Poli Kandungan (jika belum ada)
INSERT INTO poly_fees (poli_id, examination_fee, admin_fee)
SELECT id, 75000, 5000
FROM poli WHERE name = 'Poli Kandungan'
ON CONFLICT (poli_id) DO NOTHING;

-- 2. Tambah Obat untuk Poli Kandungan (jika belum ada)
DO $$
DECLARE
  kandungan_id UUID;
BEGIN
  SELECT id INTO kandungan_id FROM poli WHERE name = 'Poli Kandungan';
  
  IF kandungan_id IS NOT NULL THEN
    INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock)
    SELECT * FROM (VALUES
      ('Megestrol Acetate 160mg', 'tablet', kandungan_id, 'strip', 25000, 45000, 30, 5),
      ('Dydrogesterone 10mg', 'tablet', kandungan_id, 'strip', 35000, 65000, 25, 5),
      ('Duphaston 10mg', 'tablet', kandungan_id, 'strip', 40000, 75000, 20, 3),
      ('Provera 10mg', 'tablet', kandungan_id, 'strip', 15000, 28000, 35, 5),
      ('Clomiphene 50mg', 'tablet', kandungan_id, 'strip', 12000, 22000, 30, 5),
      ('Folic Acid 400mcg', 'tablet', kandungan_id, 'strip', 2000, 4000, 80, 10),
      ('Folic Acid 1000mcg', 'tablet', kandungan_id, 'strip', 3500, 6500, 50, 8),
      ('Iron (Fe) 200mg', 'tablet', kandungan_id, 'strip', 2500, 5000, 60, 10),
      ('Calcium + Vitamin D', 'tablet', kandungan_id, 'strip', 5000, 9000, 45, 8),
      ('Blackmores Pregnancy Gold', 'kapsul', kandungan_id, 'kapsul', 15000, 28000, 30, 5),
      ('Paracetamol 500mg', 'tablet', kandungan_id, 'strip', 1500, 2500, 100, 15),
      ('Omeprazole 20mg', 'kapsul', kandungan_id, 'strip', 4500, 8000, 40, 5),
      ('Cetirizine 10mg', 'tablet', kandungan_id, 'strip', 2500, 5000, 50, 8),
      ('Salbutamol 4mg', 'tablet', kandungan_id, 'strip', 3000, 6000, 35, 5),
      ('Vitamin B6 25mg', 'tablet', kandungan_id, 'strip', 3000, 5500, 40, 5)
    ) AS v(name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock)
    WHERE NOT EXISTS (
      SELECT 1 FROM medicines m 
      WHERE m.name = v.name AND m.poli_id = v.poli_id
    );
  END IF;
END $$;
