-- ============================================================
-- Digital Clinic Management System - Complete Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'petugas', 'dokter', 'pasien')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES TABLE
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. PATIENTS TABLE
-- ============================================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medical_record_number TEXT UNIQUE NOT NULL,
  nik TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('laki_laki', 'perempuan')),
  blood_type TEXT CHECK (blood_type IN ('A', 'B', 'AB', 'O')),
  allergies TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. DOCTORS TABLE
-- ============================================================
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nip TEXT UNIQUE NOT NULL,
  specialty TEXT NOT NULL,
  license_number TEXT NOT NULL,
  bio TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. POLI TABLE
-- ============================================================
CREATE TABLE poli (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  initial TEXT UNIQUE NOT NULL,
  description TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. DOCTOR_SCHEDULES TABLE
-- ============================================================
CREATE TABLE doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  poli_id UUID NOT NULL REFERENCES poli(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_patients INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- ============================================================
-- 7. QUEUES TABLE
-- ============================================================
CREATE TABLE queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_number TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_schedule_id UUID NOT NULL REFERENCES doctor_schedules(id) ON DELETE CASCADE,
  poli_id UUID NOT NULL REFERENCES poli(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu', 'dipanggil', 'sedang_diperiksa', 'selesai', 'dibatalkan')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  called_at TIMESTAMPTZ,
  examination_started_at TIMESTAMPTZ,
  examination_finished_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (queue_number, visit_date)
);

-- ============================================================
-- 8. MEDICAL_RECORDS TABLE
-- ============================================================
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_id UUID UNIQUE NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  treatment TEXT NOT NULL,
  notes TEXT,
  prescription TEXT,
  blood_pressure TEXT,
  weight NUMERIC(5,1),
  height NUMERIC(5,1),
  temperature NUMERIC(4,1),
  chief_complaint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. AUDIT_LOGS TABLE
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. MEDICINES TABLE
-- ============================================================
CREATE TABLE medicines (
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

-- ============================================================
-- 11. STOCK_MUTATIONS TABLE
-- ============================================================
CREATE TABLE stock_mutations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  mutation_type TEXT NOT NULL CHECK (mutation_type IN ('masuk', 'keluar', 'penyesuaian')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. POLY_FEES TABLE
-- ============================================================
CREATE TABLE poly_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poli_id UUID UNIQUE NOT NULL REFERENCES poli(id),
  examination_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  admin_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. PRESCRIPTION_ITEMS TABLE
-- ============================================================
CREATE TABLE prescription_items (
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

-- ============================================================
-- 14. FAVORITE_PRESCRIPTIONS TABLE
-- ============================================================
CREATE TABLE favorite_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. PAYMENTS TABLE
-- ============================================================
CREATE TABLE payments (
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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_medical_record_number ON patients(medical_record_number);
CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_nip ON doctors(nip);
CREATE INDEX idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);
CREATE INDEX idx_doctor_schedules_poli_id ON doctor_schedules(poli_id);
CREATE INDEX idx_doctor_schedules_day_of_week ON doctor_schedules(day_of_week);
CREATE INDEX idx_queues_patient_id ON queues(patient_id);
CREATE INDEX idx_queues_poli_id ON queues(poli_id);
CREATE INDEX idx_queues_status ON queues(status);
CREATE INDEX idx_queues_queue_number ON queues(queue_number);
CREATE INDEX idx_queues_created_at ON queues(created_at);
CREATE INDEX idx_queues_visit_date ON queues(visit_date);
CREATE INDEX idx_medical_records_queue_id ON medical_records(queue_id);
CREATE INDEX idx_medical_records_doctor_id ON medical_records(doctor_id);
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_poli_id ON medicines(poli_id);
CREATE INDEX idx_medicines_is_active ON medicines(is_active);
CREATE INDEX idx_stock_mutations_medicine_id ON stock_mutations(medicine_id);
CREATE INDEX idx_stock_mutations_created_at ON stock_mutations(created_at);
CREATE INDEX idx_poly_fees_poli_id ON poly_fees(poli_id);
CREATE INDEX idx_prescription_items_medical_record_id ON prescription_items(medical_record_id);
CREATE INDEX idx_prescription_items_medicine_id ON prescription_items(medicine_id);
CREATE INDEX idx_favorite_prescriptions_doctor_id ON favorite_prescriptions(doctor_id);
CREATE INDEX idx_payments_queue_id ON payments(queue_id);
CREATE INDEX idx_payments_patient_id ON payments(patient_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to generate queue number: [poli_initial][3 digits]
CREATE OR REPLACE FUNCTION generate_queue_number(poli_initial TEXT)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  new_queue_number TEXT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(queue_number FROM 2) AS INTEGER)),
    0
  ) + 1
  INTO next_num
  FROM queues
  WHERE queue_number LIKE poli_initial || '%'
    AND DATE(created_at) = CURRENT_DATE;

  new_queue_number := poli_initial || LPAD(next_num::TEXT, 3, '0');
  RETURN new_queue_number;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm user email
CREATE OR REPLACE FUNCTION confirm_user_email(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET updated_at = NOW()
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-call next queue when status changes to 'selesai'
CREATE OR REPLACE FUNCTION handle_queue_selesai()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' AND OLD.status != 'selesai' THEN
    NEW.examination_finished_at = NOW();
    
    UPDATE queues
    SET status = 'dipanggil',
        called_at = NOW(),
        updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM queues
      WHERE poli_id = NEW.poli_id
        AND status = 'menunggu'
        AND id != NEW.id
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at for all tables
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_poli_updated_at
  BEFORE UPDATE ON poli
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_doctor_schedules_updated_at
  BEFORE UPDATE ON doctor_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_queues_updated_at
  BEFORE UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_poly_fees_updated_at
  BEFORE UPDATE ON poly_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-call next queue when status changes to 'selesai'
CREATE TRIGGER on_queue_selesai
  BEFORE UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION handle_queue_selesai();

-- Function to auto-create payment when queue status changes to 'selesai'
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

-- Function to auto-update medicine stock when prescription is created
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

-- Trigger for auto-create payment
CREATE TRIGGER on_queue_selesai_payment
  AFTER UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION handle_queue_payment();

-- Trigger for auto-update stock
CREATE TRIGGER on_prescription_stock
  AFTER INSERT ON prescription_items
  FOR EACH ROW EXECUTE FUNCTION handle_prescription_stock();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE poli ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE poly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS TABLE
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert own record"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() = id
  );

CREATE POLICY "Admin can update users"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete users"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- PROFILES TABLE
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'dokter'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- PATIENTS TABLE
CREATE POLICY "Pasien can view own data"
  ON patients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all patients"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all patients"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view all patients"
  ON patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'dokter'
    )
  );

CREATE POLICY "Admin can insert patients"
  ON patients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can insert patients"
  ON patients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Patients can insert own record"
  ON patients FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update patients"
  ON patients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can update patients"
  ON patients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

-- DOCTORS TABLE
CREATE POLICY "Everyone can view doctors"
  ON doctors FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert doctors"
  ON doctors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update doctors"
  ON doctors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Dokter can update own data"
  ON doctors FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admin can delete doctors"
  ON doctors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- POLI TABLE
CREATE POLICY "Everyone can view poli"
  ON poli FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert poli"
  ON poli FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update poli"
  ON poli FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete poli"
  ON poli FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DOCTOR_SCHEDULES TABLE
CREATE POLICY "Everyone can view doctor schedules"
  ON doctor_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert doctor schedules"
  ON doctor_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update doctor schedules"
  ON doctor_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Dokter can update own schedules"
  ON doctor_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete doctor schedules"
  ON doctor_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- QUEUES TABLE
CREATE POLICY "Pasien can view own queues"
  ON queues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = patient_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all queues"
  ON queues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all queues"
  ON queues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view queues in own schedules"
  ON queues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctor_schedules ds
      JOIN doctors d ON d.id = ds.doctor_id
      WHERE ds.id = doctor_schedule_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Petugas can insert queues"
  ON queues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Pasien can insert own queues"
  ON queues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = patient_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Petugas can update queues"
  ON queues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can update queues in own schedules"
  ON queues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctor_schedules ds
      JOIN doctors d ON d.id = ds.doctor_id
      WHERE ds.id = doctor_schedule_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete queues"
  ON queues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- MEDICAL_RECORDS TABLE
CREATE POLICY "Pasien can view own medical records"
  ON medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = patient_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all medical records"
  ON medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all medical records"
  ON medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view own medical records"
  ON medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can insert medical records"
  ON medical_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can update own medical records"
  ON medical_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete medical records"
  ON medical_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- AUDIT_LOGS TABLE
CREATE POLICY "Admin can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- MEDICINES TABLE
CREATE POLICY "Everyone can view active medicines"
  ON medicines FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can view all medicines"
  ON medicines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert medicines"
  ON medicines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update medicines"
  ON medicines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete medicines"
  ON medicines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all medicines"
  ON medicines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view all medicines"
  ON medicines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'dokter'
    )
  );

-- STOCK_MUTATIONS TABLE
CREATE POLICY "Admin can view all stock mutations"
  ON stock_mutations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all stock mutations"
  ON stock_mutations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Admin can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "System can insert stock mutations"
  ON stock_mutations FOR INSERT
  WITH CHECK (true);

-- POLY_FEES TABLE
CREATE POLICY "Everyone can view poly fees"
  ON poly_fees FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert poly fees"
  ON poly_fees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update poly fees"
  ON poly_fees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete poly fees"
  ON poly_fees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- PRESCRIPTION_ITEMS TABLE
CREATE POLICY "Pasien can view own prescription items"
  ON prescription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_records mr
      JOIN patients p ON p.id = mr.patient_id
      WHERE mr.id = medical_record_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all prescription items"
  ON prescription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all prescription items"
  ON prescription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view own prescription items"
  ON prescription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medical_records mr
      JOIN doctors d ON d.id = mr.doctor_id
      WHERE mr.id = medical_record_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can insert prescription items"
  ON prescription_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_records mr
      JOIN doctors d ON d.id = mr.doctor_id
      WHERE mr.id = medical_record_id AND d.user_id = auth.uid()
    )
  );

-- FAVORITE_PRESCRIPTIONS TABLE
CREATE POLICY "Dokter can view own favorite prescriptions"
  ON favorite_prescriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can insert own favorite prescriptions"
  ON favorite_prescriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can update own favorite prescriptions"
  ON favorite_prescriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Dokter can delete own favorite prescriptions"
  ON favorite_prescriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE id = doctor_id AND user_id = auth.uid()
    )
  );

-- PAYMENTS TABLE
CREATE POLICY "Pasien can view own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = patient_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Petugas can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Dokter can view payments for own patients"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM queues q
      JOIN doctor_schedules ds ON ds.id = q.doctor_schedule_id
      JOIN doctors d ON d.id = ds.doctor_id
      WHERE q.id = queue_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Petugas can update payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'petugas'
    )
  );

CREATE POLICY "Admin can update payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON users TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON patients TO authenticated;
GRANT SELECT ON doctors TO authenticated;
GRANT SELECT ON poli TO authenticated;
GRANT SELECT ON doctor_schedules TO authenticated;
GRANT SELECT ON queues TO authenticated;
GRANT SELECT ON medical_records TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON medicines TO authenticated;
GRANT SELECT ON stock_mutations TO authenticated;
GRANT SELECT ON poly_fees TO authenticated;
GRANT SELECT ON prescription_items TO authenticated;
GRANT SELECT ON favorite_prescriptions TO authenticated;
GRANT SELECT ON payments TO authenticated;

GRANT INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON patients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON doctors TO authenticated;
GRANT INSERT, UPDATE, DELETE ON poli TO authenticated;
GRANT INSERT, UPDATE, DELETE ON doctor_schedules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON queues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON medical_records TO authenticated;
GRANT INSERT ON audit_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON medicines TO authenticated;
GRANT INSERT, UPDATE, DELETE ON stock_mutations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON poly_fees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON prescription_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON favorite_prescriptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON payments TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- INSERT DEFAULT DATA
-- ============================================================

INSERT INTO poli (name, initial, description, location) VALUES
  ('Poli Umum', 'U', 'Pelayanan kesehatan umum', 'Lantai 1'),
  ('Poli Anak', 'A', 'Pelayanan kesehatan anak', 'Lantai 1'),
  ('Poli Gigi', 'G', 'Pelayanan kesehatan gigi dan mulut', 'Lantai 2'),
  ('Poli Mata', 'M', 'Pelayanan kesehatan mata', 'Lantai 2'),
  ('Poli Kulit', 'K', 'Pelayanan kesehatan kulit dan kelamin', 'Lantai 3');
