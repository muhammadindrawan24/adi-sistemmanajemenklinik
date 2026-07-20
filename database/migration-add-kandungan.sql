-- ============================================================
-- MIGRATION: Tambah Poli Kandungan + Obat + Tarif
-- Jalankan ini di Supabase SQL Editor
-- ============================================================

-- 1. Tambah Poli Kandungan
INSERT INTO poli (name, initial, description, location)
VALUES ('Poli Kandungan', 'K', 'Pelayanan kesehatan kandungan dan kebidanan', 'Lantai 3')
ON CONFLICT (name) DO NOTHING;

-- 2. Tambah Tarif Poli Kandungan
INSERT INTO poly_fees (poli_id, examination_fee, admin_fee)
SELECT id, 75000, 5000
FROM poli WHERE name = 'Poli Kandungan'
ON CONFLICT (poli_id) DO NOTHING;

-- 3. Tambah Obat untuk Poli Kandungan
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock) VALUES
-- Obat Kandungan
('Megestrol Acetate 160mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 25000, 45000, 30, 5),
('Dydrogesterone 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 35000, 65000, 25, 5),
('Duphaston 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 40000, 75000, 20, 3),
('Provera 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 15000, 28000, 35, 5),
('Clomiphene 50mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 12000, 22000, 30, 5),
('Metformin 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 6000, 12000, 40, 5),
-- Vitamin Kehamilan
('Folic Acid 400mcg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 2000, 4000, 80, 10),
('Folic Acid 1000mcg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 3500, 6500, 50, 8),
('Iron (Fe) 200mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 2500, 5000, 60, 10),
('Calcium + Vitamin D', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 5000, 9000, 45, 8),
('Blackmores Pregnancy Gold', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'kapsul', 15000, 28000, 30, 5),
-- Obat Lainnya
('Salbutamol 4mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 3000, 6000, 35, 5),
('Paracetamol 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 1500, 2500, 100, 15),
('Omeprazole 20mg', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 4500, 8000, 40, 5),
('Cetirizine 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kandungan'), 'strip', 2500, 5000, 50, 8);
