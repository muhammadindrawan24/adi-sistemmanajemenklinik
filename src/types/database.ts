export type UserRole = 'admin' | 'petugas' | 'dokter' | 'pasien';
export type QueueStatus = 'menunggu' | 'dipanggil' | 'sedang_diperiksa' | 'selesai' | 'dibatalkan';
export type Gender = 'laki_laki' | 'perempuan';
export type BloodType = 'A' | 'B' | 'AB' | 'O';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  gender: Gender | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  medical_record_number: string;
  date_of_birth: string | null;
  gender: Gender | null;
  blood_type: BloodType | null;
  allergies: string | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  nip: string;
  specialty: string;
  license_number: string;
  bio: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Poli {
  id: string;
  name: string;
  initial: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  poli_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Queue {
  id: string;
  queue_number: string;
  patient_id: string;
  doctor_schedule_id: string;
  poli_id: string;
  status: QueueStatus;
  called_at: string | null;
  examination_started_at: string | null;
  examination_finished_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRecord {
  id: string;
  queue_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis: string;
  symptoms: string;
  treatment: string;
  notes: string | null;
  prescription: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Joined types for queries
export interface UserWithProfile extends User {
  profiles: Profile;
}

export interface PatientWithUser extends Patient {
  users: User;
  profiles: Profile;
}

export interface DoctorWithUser extends Doctor {
  users: User;
  profiles: Profile;
}

export interface QueueWithRelations extends Queue {
  patients: PatientWithUser;
  poli: Poli;
  doctor_schedules: DoctorSchedule & { doctors: Doctor };
}

export interface MedicalRecordWithRelations extends MedicalRecord {
  patients: PatientWithUser;
  doctors: DoctorWithUser;
  queues: Queue;
}

// Supabase Database interface
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      patients: {
        Row: Patient;
        Insert: Omit<Patient, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Patient, 'id' | 'created_at' | 'updated_at'>>;
      };
      doctors: {
        Row: Doctor;
        Insert: Omit<Doctor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Doctor, 'id' | 'created_at' | 'updated_at'>>;
      };
      poli: {
        Row: Poli;
        Insert: Omit<Poli, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Poli, 'id' | 'created_at' | 'updated_at'>>;
      };
      doctor_schedules: {
        Row: DoctorSchedule;
        Insert: Omit<DoctorSchedule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DoctorSchedule, 'id' | 'created_at' | 'updated_at'>>;
      };
      queues: {
        Row: Queue;
        Insert: Omit<Queue, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Queue, 'id' | 'created_at' | 'updated_at'>>;
      };
      medical_records: {
        Row: MedicalRecord;
        Insert: Omit<MedicalRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MedicalRecord, 'id' | 'created_at' | 'updated_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLog, 'id' | 'created_at'>>;
      };
    };
  };
}
