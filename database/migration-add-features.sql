-- ============================================================
-- MIGRATION: Tambah Tabel Baru (Stok Obat, Biaya, Resep, Pembayaran)
-- Jalankan ini di Supabase SQL Editor jika database sudah ada
-- ============================================================

-- 1. TABEL MEDICINES (Master Data Obat)
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tablet', 'kapsul', 'sirup', 'salep', 'tetes', 'gel', 'krim', 'injeksi', 'sachet')),
  poli_id UUID REFERENCES poli(id),
  unit TEXT NOT NULL,
  buy_price NUMERIC(10,2) NOT NULL,
  sell_price NUMERIC(10,2) NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  expiry_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL STOCK_MUTATIONS (Log Mutasi Stok)
CREATE TABLE IF NOT EXISTS stock_mutations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  mutation_type TEXT NOT NULL CHECK (mutation_type IN ('masuk', 'keluar', 'penyesuaian')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL POLY_FEES (Tarif Per Poli)
CREATE TABLE IF NOT EXISTS poly_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poli_id UUID UNIQUE NOT NULL REFERENCES poli(id),
  examination_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  admin_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL PRESCRIPTION_ITEMS (Item Resep Obat)
CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id),
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL FAVORITE_PRESCRIPTIONS (Resep Favorit Dokter)
CREATE TABLE IF NOT EXISTS favorite_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL PAYMENTS (Pembayaran)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID UNIQUE NOT NULL REFERENCES queues(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  examination_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  admin_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  medicine_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('tunai', 'transfer')),
  status TEXT NOT NULL DEFAULT 'belum_bayar' CHECK (status IN ('belum_bayar', 'dibayar')),
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_poli_id ON medicines(poli_id);
CREATE INDEX IF NOT EXISTS idx_medicines_is_active ON medicines(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_mutations_medicine_id ON stock_mutations(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stock_mutations_created_at ON stock_mutations(created_at);
CREATE INDEX IF NOT EXISTS idx_poly_fees_poli_id ON poly_fees(poli_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_medical_record_id ON prescription_items(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_medicine_id ON prescription_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_favorite_prescriptions_doctor_id ON favorite_prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_queue_id ON payments(queue_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================================
-- TRIGGERS (Auto-update updated_at)
-- ============================================================
CREATE TRIGGER set_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_poly_fees_updated_at
  BEFORE UPDATE ON poly_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create payment saat queue selesai
-- ============================================================
CREATE OR REPLACE FUNCTION handle_queue_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' AND OLD.status != 'selesai' THEN
    INSERT INTO payments (queue_id, patient_id, examination_fee, admin_fee, medicine_total, total_amount, status)
    SELECT
      NEW.id,
      NEW.patient_id,
      COALESCE(pf.examination_fee, 0),
      COALESCE(pf.admin_fee, 0),
      0,
      COALESCE(pf.examination_fee, 0) + COALESCE(pf.admin_fee, 0),
      'belum_bayar'
    FROM poly_fees pf
    WHERE pf.poli_id = NEW.poli_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_queue_selesai_payment
  AFTER UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION handle_queue_payment();

-- ============================================================
-- TRIGGER: Auto-update stok saat resep dibuat
-- ============================================================
CREATE OR REPLACE FUNCTION handle_prescription_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE medicines
  SET stock_qty = stock_qty - NEW.quantity
  WHERE id = NEW.medicine_id;
  
  INSERT INTO stock_mutations (medicine_id, mutation_type, quantity, notes, user_id)
  VALUES (NEW.medicine_id, 'keluar', NEW.quantity, 'Resep dokter', '00000000-0000-0000-0000-000000000000');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_prescription_stock
  AFTER INSERT ON prescription_items
  FOR EACH ROW EXECUTE FUNCTION handle_prescription_stock();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE poly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: MEDICINES
-- ============================================================
CREATE POLICY "Everyone can view active medicines"
  ON medicines FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can view all medicines"
  ON medicines FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can insert medicines"
  ON medicines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update medicines"
  ON medicines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete medicines"
  ON medicines FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Petugas can view all medicines"
  ON medicines FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "Dokter can view all medicines"
  ON medicines FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dokter'));

-- ============================================================
-- RLS POLICIES: STOCK_MUTATIONS
-- ============================================================
CREATE POLICY "Admin can view all stock mutations"
  ON stock_mutations FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Petugas can view all stock mutations"
  ON stock_mutations FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "Admin can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Petugas can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "System can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- RLS POLICIES: POLY_FEES
-- ============================================================
CREATE POLICY "Everyone can view poly fees"
  ON poly_fees FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert poly fees"
  ON poly_fees FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can update poly fees"
  ON poly_fees FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can delete poly fees"
  ON poly_fees FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- RLS POLICIES: PRESCRIPTION_ITEMS
-- ============================================================
CREATE POLICY "Pasien can view own prescription items"
  ON prescription_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM medical_records mr
    JOIN patients p ON p.id = mr.patient_id
    WHERE mr.id = medical_record_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Admin can view all prescription items"
  ON prescription_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Petugas can view all prescription items"
  ON prescription_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "Dokter can view own prescription items"
  ON prescription_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM medical_records mr
    JOIN doctors d ON d.id = mr.doctor_id
    WHERE mr.id = medical_record_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Dokter can insert prescription items"
  ON prescription_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM medical_records mr
    JOIN doctors d ON d.id = mr.doctor_id
    WHERE mr.id = medical_record_id AND d.user_id = auth.uid()
  ));

-- ============================================================
-- RLS POLICIES: FAVORITE_PRESCRIPTIONS
-- ============================================================
CREATE POLICY "Dokter can view own favorite prescriptions"
  ON favorite_prescriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctors WHERE id = doctor_id AND user_id = auth.uid()));

CREATE POLICY "Dokter can insert own favorite prescriptions"
  ON favorite_prescriptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM doctors WHERE id = doctor_id AND user_id = auth.uid()));

CREATE POLICY "Dokter can update own favorite prescriptions"
  ON favorite_prescriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM doctors WHERE id = doctor_id AND user_id = auth.uid()));

CREATE POLICY "Dokter can delete own favorite prescriptions"
  ON favorite_prescriptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM doctors WHERE id = doctor_id AND user_id = auth.uid()));

-- ============================================================
-- RLS POLICIES: PAYMENTS
-- ============================================================
CREATE POLICY "Pasien can view own payments"
  ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM patients WHERE id = patient_id AND user_id = auth.uid()));

CREATE POLICY "Admin can view all payments"
  ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Petugas can view all payments"
  ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "Dokter can view payments for own patients"
  ON payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM queues q
    JOIN doctor_schedules ds ON ds.id = q.doctor_schedule_id
    JOIN doctors d ON d.id = ds.doctor_id
    WHERE q.id = queue_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "System can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Petugas can update payments"
  ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'petugas'));

CREATE POLICY "Admin can update payments"
  ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT SELECT ON medicines TO authenticated;
GRANT SELECT ON stock_mutations TO authenticated;
GRANT SELECT ON poly_fees TO authenticated;
GRANT SELECT ON prescription_items TO authenticated;
GRANT SELECT ON favorite_prescriptions TO authenticated;
GRANT SELECT ON payments TO authenticated;

GRANT INSERT, UPDATE, DELETE ON medicines TO authenticated;
GRANT INSERT, UPDATE, DELETE ON stock_mutations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON poly_fees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON prescription_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON favorite_prescriptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON payments TO authenticated;

-- ============================================================
-- SEED DATA: 40 OBAT
-- ============================================================
INSERT INTO medicines (name, category, poli_id, unit, buy_price, sell_price, stock_qty, min_stock) VALUES
-- Poli Umum (10 obat)
('Paracetamol 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 1500, 2500, 200, 20),
('Amoxicillin 500mg', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 8000, 15000, 100, 10),
('Omeprazole 20mg', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 4500, 8000, 80, 10),
('Cetirizine 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 2500, 5000, 120, 15),
('Metformin 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 6000, 12000, 60, 10),
('Amlodipine 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 4500, 9000, 70, 10),
('Salbutamol 4mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'strip', 3000, 6000, 50, 10),
('Ambroksol 100ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'botol', 12000, 22000, 40, 5),
('Paracetamol Sirup 60ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'botol', 8000, 15000, 35, 5),
('Oralit', 'sachet', (SELECT id FROM poli WHERE name = 'Poli Umum'), 'sachet', 1000, 2000, 100, 20),

-- Poli Anak (6 obat)
('Paracetamol Anak 120mg/5ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'botol', 10000, 18000, 30, 5),
('Amoxicillin Sirup 125mg/5ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'botol', 14000, 25000, 25, 5),
('Cetirizine Anak 5mg/5ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'botol', 11000, 20000, 20, 5),
('Ambroksol Anak 100ml', 'sirup', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'botol', 12000, 22000, 25, 5),
('Vitamin A 200.000 IU', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'kapsul', 2500, 5000, 40, 10),
('Zinc 20mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Anak'), 'strip', 1500, 3000, 50, 10),

-- Poli Gigi (4 obat)
('Amoksisilin 500mg', 'kapsul', (SELECT id FROM poli WHERE name = 'Poli Gigi'), 'strip', 6000, 12000, 40, 5),
('Metronidazole 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Gigi'), 'strip', 4000, 8000, 35, 5),
('Asam Mefenamat 500mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Gigi'), 'strip', 3000, 6000, 45, 5),
('Benzocaine Gel 15g', 'gel', (SELECT id FROM poli WHERE name = 'Poli Gigi'), 'tube', 15000, 30000, 20, 3),

-- Poli Mata (4 obat)
('Cendo Aritromin', 'tetes', (SELECT id FROM poli WHERE name = 'Poli Mata'), 'botol', 22000, 45000, 15, 3),
('Cendo Xitrol', 'tetes', (SELECT id FROM poli WHERE name = 'Poli Mata'), 'botol', 18000, 38000, 18, 3),
('Visine-A', 'tetes', (SELECT id FROM poli WHERE name = 'Poli Mata'), 'botol', 16000, 32000, 20, 3),
('Minidrops', 'tetes', (SELECT id FROM poli WHERE name = 'Poli Mata'), 'botol', 12000, 25000, 22, 3),

-- Poli Kulit (5 obat)
('Hydrocortisone 1%', 'salep', (SELECT id FROM poli WHERE name = 'Poli Kulit'), 'tube', 5000, 10000, 30, 5),
('Mupirocin 2%', 'salep', (SELECT id FROM poli WHERE name = 'Poli Kulit'), 'tube', 14000, 28000, 20, 3),
('Clotrimazole 1%', 'salep', (SELECT id FROM poli WHERE name = 'Poli Kulit'), 'tube', 7500, 15000, 25, 5),
('Permethrin 5%', 'krim', (SELECT id FROM poli WHERE name = 'Poli Kulit'), 'tube', 17000, 35000, 15, 3),
('Cetirizine 10mg', 'tablet', (SELECT id FROM poli WHERE name = 'Poli Kulit'), 'strip', 2500, 5000, 60, 10),

-- Vitamin (11 obat)
('Vitamin C 500mg', 'tablet', NULL, 'strip', 1500, 3000, 150, 20),
('Vitamin B Complex', 'tablet', NULL, 'strip', 2000, 4000, 100, 15),
('Vitamin D3 1000 IU', 'kapsul', NULL, 'kapsul', 2500, 5000, 80, 10),
('Vitamin E 100 IU', 'kapsul', NULL, 'kapsul', 3000, 6000, 60, 10),
('Vitamin A 10.000 IU', 'kapsul', NULL, 'kapsul', 2000, 4500, 70, 10),
('Zinc 20mg', 'tablet', NULL, 'strip', 1500, 3000, 90, 15),
('Imboost Forte', 'tablet', NULL, 'strip', 6000, 12000, 50, 8),
('Enervon-C', 'tablet', NULL, 'strip', 4000, 8000, 60, 10),
('Blackmores Vitamin D3', 'kapsul', NULL, 'kapsul', 12000, 25000, 30, 5),
('Vitamin Sirup Anak', 'sirup', NULL, 'botol', 10000, 18000, 40, 5),
('Curcuma Plus Anak', 'sirup', NULL, 'botol', 12000, 22000, 35, 5);

-- ============================================================
-- SEED DATA: TARIF POLI
-- ============================================================
INSERT INTO poly_fees (poli_id, examination_fee, admin_fee) VALUES
((SELECT id FROM poli WHERE name = 'Poli Umum'), 50000, 5000),
((SELECT id FROM poli WHERE name = 'Poli Anak'), 60000, 5000),
((SELECT id FROM poli WHERE name = 'Poli Gigi'), 75000, 5000),
((SELECT id FROM poli WHERE name = 'Poli Mata'), 80000, 5000),
((SELECT id FROM poli WHERE name = 'Poli Kulit'), 65000, 5000);

-- ============================================================
-- SELESAI!
-- ============================================================
-- Jalankan query di atas di Supabase SQL Editor
-- Setelah itu, jalankan seed-medicines.sql dan seed-poly-fees.sql
