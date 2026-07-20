-- ============================================================
-- SEED DATA: 40 Obat untuk semua Poli
-- ============================================================

-- Poli Umum (10 obat)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Paracetamol 500mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 1500, 2500, 200, 20, '2027-12-31'),
  ('Amoxicillin 500mg', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 8000, 15000, 100, 15, '2027-06-30'),
  ('Omeprazole 20mg', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 4500, 8000, 80, 15, '2027-09-30'),
  ('Cetirizine 10mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 2500, 5000, 120, 20, '2027-11-30'),
  ('Metformin 500mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 6000, 12000, 60, 10, '2027-08-31'),
  ('Amlodipine 10mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 4500, 9000, 70, 10, '2027-10-31'),
  ('Salbutamol 4mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 3000, 6000, 50, 10, '2027-07-31'),
  ('Ambroksol 100ml', 'sirup', (SELECT id FROM poli WHERE initial = 'U'), 'botol', 12000, 22000, 40, 10, '2027-05-31'),
  ('Paracetamol Sirup 60ml', 'sirup', (SELECT id FROM poli WHERE initial = 'U'), 'botol', 8000, 15000, 35, 10, '2027-04-30'),
  ('Oralit', 'sachet', (SELECT id FROM poli WHERE initial = 'U'), 'sachet', 1000, 2000, 100, 20, '2028-01-31');

-- Poli Anak (6 obat)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Paracetamol Anak 120mg/5ml', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 10000, 18000, 30, 10, '2027-06-30'),
  ('Amoxicillin Sirup 125mg/5ml', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 14000, 25000, 25, 10, '2027-05-31'),
  ('Cetirizine Anak 5mg/5ml', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 11000, 20000, 20, 10, '2027-07-31'),
  ('Ambroksol Anak 100ml', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 12000, 22000, 25, 10, '2027-08-31'),
  ('Vitamin A 200.000 IU', 'kapsul', (SELECT id FROM poli WHERE initial = 'A'), 'kapsul', 2500, 5000, 50, 10, '2027-12-31'),
  ('Zinc 20mg', 'tablet', (SELECT id FROM poli WHERE initial = 'A'), 'strip', 1500, 3000, 60, 15, '2027-11-30');

-- Poli Gigi (4 obat)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Amoksisilin 500mg', 'kapsul', (SELECT id FROM poli WHERE initial = 'G'), 'strip', 6000, 12000, 40, 10, '2027-09-30'),
  ('Metronidazole 500mg', 'tablet', (SELECT id FROM poli WHERE initial = 'G'), 'strip', 4000, 8000, 35, 10, '2027-10-31'),
  ('Asam Mefenamat 500mg', 'tablet', (SELECT id FROM poli WHERE initial = 'G'), 'strip', 3000, 6000, 45, 10, '2027-08-31'),
  ('Benzocaine Gel 15g', 'gel', (SELECT id FROM poli WHERE initial = 'G'), 'tube', 15000, 30000, 20, 5, '2027-06-30');

-- Poli Mata (4 obat)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Cendo Aritromin', 'tetes', (SELECT id FROM poli WHERE initial = 'M'), 'botol', 25000, 45000, 15, 5, '2027-05-31'),
  ('Cendo Xitrol', 'tetes', (SELECT id FROM poli WHERE initial = 'M'), 'botol', 20000, 38000, 15, 5, '2027-06-30'),
  ('Visine-A', 'tetes', (SELECT id FROM poli WHERE initial = 'M'), 'botol', 18000, 32000, 20, 5, '2027-07-31'),
  ('Minidrops', 'tetes', (SELECT id FROM poli WHERE initial = 'M'), 'botol', 14000, 25000, 18, 5, '2027-08-31');

-- Poli Kulit (5 obat)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Hydrocortisone 1%', 'salep', (SELECT id FROM poli WHERE initial = 'K'), 'tube', 5000, 10000, 25, 5, '2027-09-30'),
  ('Mupirocin 2%', 'salep', (SELECT id FROM poli WHERE initial = 'K'), 'tube', 15000, 28000, 20, 5, '2027-07-31'),
  ('Clotrimazole 1%', 'salep', (SELECT id FROM poli WHERE initial = 'K'), 'tube', 8000, 15000, 30, 5, '2027-10-31'),
  ('Permethrin 5%', 'krim', (SELECT id FROM poli WHERE initial = 'K'), 'tube', 18000, 35000, 15, 5, '2027-08-31'),
  ('Cetirizine 10mg (Kulit)', 'tablet', (SELECT id FROM poli WHERE initial = 'K'), 'strip', 2500, 5000, 50, 10, '2027-11-30');

-- Vitamin (11 obat - untuk semua poli)
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock, expiry_date) VALUES
  ('Vitamin C 500mg', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 1500, 3000, 150, 20, '2027-12-31'),
  ('Vitamin B Complex', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 2000, 4000, 100, 15, '2027-11-30'),
  ('Vitamin D3 1000 IU', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'kapsul', 2500, 5000, 80, 10, '2027-12-31'),
  ('Vitamin E 100 IU', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'kapsul', 3000, 6000, 60, 10, '2027-10-31'),
  ('Vitamin A 10.000 IU', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'kapsul', 2000, 4500, 70, 10, '2027-12-31'),
  ('Zinc 20mg (Vitamin)', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 1500, 3000, 90, 15, '2027-11-30'),
  ('Imboost Forte', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 6000, 12000, 50, 10, '2027-09-30'),
  ('Enervon-C', 'tablet', (SELECT id FROM poli WHERE initial = 'U'), 'strip', 4000, 8000, 60, 10, '2027-10-31'),
  ('Blackmores Vitamin D3', 'kapsul', (SELECT id FROM poli WHERE initial = 'U'), 'kapsul', 14000, 25000, 30, 5, '2027-12-31'),
  ('Vitamin Sirup Anak', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 10000, 18000, 40, 10, '2027-06-30'),
  ('Curcuma Plus Anak', 'sirup', (SELECT id FROM poli WHERE initial = 'A'), 'botol', 12000, 22000, 35, 10, '2027-07-31');
