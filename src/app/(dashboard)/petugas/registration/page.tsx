'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Search, User, Phone, MapPin, Calendar, Droplets,
  Stethoscope, ClipboardList, CheckCircle, AlertCircle, ArrowRight,
  FileText, UserCircle2, CreditCard, Heart, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import { useForm } from 'react-hook-form';

interface PatientForm {
  name: string;
  nik: string;
  phone: string;
  address: string;
  birth_date: string;
  gender: string;
  blood_type: string;
}

interface QueueForm {
  poli_id: string;
  complaint: string;
}

// Jam operasional klinik
const CLINIC_OPEN_HOUR = 7;   // Pendaftaran antrian dibuka
const CLINIC_CLOSE_HOUR = 20; // Pendaftaran antrian ditutup
const CLINIC_CLOSE_MINUTE = 30; // Menit tutup (20:30)

function getQueueStatus(): { canQueue: boolean; message: string } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const openTime = CLINIC_OPEN_HOUR * 60; // 07:00 = 420
  const closeTime = CLINIC_CLOSE_HOUR * 60 + CLINIC_CLOSE_MINUTE; // 20:30 = 1230

  if (currentMinutes < openTime) {
    return { canQueue: false, message: `Pendaftaran antrian dibuka pukul ${CLINIC_OPEN_HOUR.toString().padStart(2, '0')}:00 WIB` };
  }

  if (currentMinutes >= closeTime) {
    return { canQueue: false, message: `Pendaftaran antrian ditutup pukul ${CLINIC_CLOSE_HOUR.toString().padStart(2, '0')}:${CLINIC_CLOSE_MINUTE.toString().padStart(2, '0')} WIB` };
  }

  return { canQueue: true, message: '' };
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function PatientRegistration() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState<any>(null);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [showQueueForm, setShowQueueForm] = React.useState(false);
  const [poliList, setPoliList] = React.useState<any[]>([]);
  const [availableDoctors, setAvailableDoctors] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [queueStatus, setQueueStatus] = React.useState(getQueueStatus());
  const [overrideTime, setOverrideTime] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PatientForm>();
  const { register: registerQueue, handleSubmit: handleSubmitQueue, reset: resetQueue, formState: { errors: queueErrors }, watch } = useForm<QueueForm>();

  const selectedPoliId = watch('poli_id');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
  };

  React.useEffect(() => {
    const fetchPoli = async () => {
      const { data } = await supabase.from('poli').select('*').eq('is_active', true).order('name');
      setPoliList(data || []);
    };
    fetchPoli();

    const fetchTodaySchedules = async () => {
      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, initial)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      const doctorUserIds = schedules?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      const uniqueIds = [...new Set(doctorUserIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enriched = schedules?.map((s: any) => ({
        ...s,
        doctor_name: profileMap[s.doctor?.user_id] || '-',
        poli_name: s.poli?.name || '-',
        poli_initial: s.poli?.initial || '',
      })) || [];

      setTodaySchedules(enriched);
    };
    fetchTodaySchedules();

    // Update queue status setiap menit
    const interval = setInterval(() => {
      setQueueStatus(getQueueStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  React.useEffect(() => {
    if (!selectedPoliId) { setAvailableDoctors([]); return; }
    const fetchDoctors = async () => {
      const today = (new Date().getDay() + 6) % 7;
      const { data } = await supabase
        .from('doctor_schedules')
        .select('doctor_id, start_time, end_time, doctor:doctors(id, user_id, specialty)')
        .eq('poli_id', selectedPoliId)
        .eq('day_of_week', today)
        .eq('is_active', true);

      const doctorUserIds = data?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      let profileMap: Record<string, string> = {};
      if (doctorUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doctorUserIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enriched = data?.map((s: any) => ({
        ...s,
        doctor_name: profileMap[s.doctor?.user_id] || '-',
      })) || [];

      setAvailableDoctors(enriched);
    };
    fetchDoctors();
  }, [selectedPoliId, supabase]);

  const searchPatient = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    const { data: patientByRM } = await supabase
      .from('patients')
      .select('*')
      .ilike('medical_record_number', `%${searchQuery}%`)
      .limit(10);

    const { data: patientByNIK } = await supabase
      .from('patients')
      .select('*')
      .ilike('nik', `%${searchQuery}%`)
      .limit(10);

    const { data: patientByName } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, address')
      .ilike('full_name', `%${searchQuery}%`)
      .limit(10);

    const allPatients: any[] = [];
    const seenIds = new Set<string>();

    const rmUserIds = patientByRM?.map((p: any) => p.user_id).filter(Boolean) || [];
    let rmProfileMap: Record<string, any> = {};
    if (rmUserIds.length > 0) {
      const { data: rmProfiles } = await supabase.from('profiles').select('user_id, full_name, phone, address').in('user_id', rmUserIds);
      rmProfiles?.forEach((p: any) => { rmProfileMap[p.user_id] = p; });
    }

    patientByRM?.forEach((p: any) => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        const prof = rmProfileMap[p.user_id] || {};
        allPatients.push({ ...p, full_name: prof.full_name || '-', phone: prof.phone, address: prof.address });
      }
    });

    patientByNIK?.forEach((p: any) => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        allPatients.push(p);
      }
    });

    const nikUserIds = allPatients.filter(p => !p.full_name || p.full_name === '-').map(p => p.user_id).filter(Boolean);
    if (nikUserIds.length > 0) {
      const { data: nikProfiles } = await supabase.from('profiles').select('user_id, full_name, phone, address').in('user_id', nikUserIds);
      nikProfiles?.forEach((p: any) => {
        const patient = allPatients.find(ap => ap.user_id === p.user_id);
        if (patient) {
          patient.full_name = p.full_name || '-';
          patient.phone = patient.phone || p.phone;
          patient.address = patient.address || p.address;
        }
      });
    }

    const nameUserIds = patientByName?.map((p: any) => p.user_id).filter(Boolean) || [];
    let namePatientMap: Record<string, any> = {};
    if (nameUserIds.length > 0) {
      const { data: namePatients } = await supabase.from('patients').select('*').in('user_id', nameUserIds);
      namePatients?.forEach((p: any) => { namePatientMap[p.user_id] = p; });
    }

    patientByName?.forEach((p: any) => {
      const pat = namePatientMap[p.user_id];
      if (pat && !seenIds.has(pat.id)) {
        seenIds.add(pat.id);
        allPatients.push({ ...pat, full_name: p.full_name, phone: p.phone, address: p.address });
      }
    });

    const userIds = allPatients.map(p => p.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      allPatients.forEach(p => { if (!p.full_name) p.full_name = nameMap[p.user_id] || '-'; });
    }

    setSearchResults(allPatients);
    setSearching(false);
  };

  const generateQueueNumber = async (initial: string): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_queue_number', { poli_initial: initial });
    if (error) throw error;
    return data;
  };

  const onSubmitNewPatient = async (data: PatientForm) => {
    setSaving(true);
    try {
      const tempEmail = `pasien.${data.nik}@kliniksehat.com`;
      const patientId = crypto.randomUUID();
      const rmNumber = `RM-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

      await supabase.from('users').insert({ id: patientId, email: tempEmail, role: 'pasien', is_active: true });
      await supabase.from('profiles').upsert({ user_id: patientId, full_name: data.name, phone: data.phone || null, address: data.address || null, gender: data.gender === 'laki-laki' ? 'laki_laki' : data.gender === 'perempuan' ? 'perempuan' : null }, { onConflict: 'user_id' });
      const { error } = await supabase.from('patients').insert({
        user_id: patientId, medical_record_number: rmNumber,
        nik: data.nik,
        date_of_birth: data.birth_date || null,
        gender: data.gender === 'laki-laki' ? 'laki_laki' : data.gender === 'perempuan' ? 'perempuan' : null,
        blood_type: data.blood_type || null,
      });
      if (error) throw error;

      const { data: newPatient } = await supabase.from('patients').select('id').eq('user_id', patientId).single();
      const actualPatientId = newPatient?.id || patientId;

      setSelectedPatient({ id: actualPatientId, user_id: patientId, full_name: data.name, medical_record_number: rmNumber, phone: data.phone, address: data.address, gender: data.gender, blood_type: data.blood_type, date_of_birth: data.birth_date, nik: data.nik });
      showToast(`Pasien berhasil didaftarkan!`);
      setShowNewForm(false);
      reset();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSubmitQueue = async (data: QueueForm) => {
    if (!selectedPatient) return;

    // Cek jam pendaftaran (kecuali override aktif)
    if (!overrideTime) {
      const status = getQueueStatus();
      if (!status.canQueue) {
        showToast(status.message, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existingQueue } = await supabase
        .from('queues')
        .select('id, queue_number, status, poli:poli(name)')
        .eq('patient_id', selectedPatient.id)
        .gte('created_at', today)
        .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa'])
        .limit(1)
        .single();

      if (existingQueue) {
        showToast(`Pasien sudah punya antrian aktif: No. ${existingQueue.queue_number}`, 'error');
        setSaving(false);
        return;
      }

      const poli = poliList.find(p => p.id === data.poli_id);
      const queueNumber = await generateQueueNumber(poli?.initial || 'Q');

      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('id')
        .eq('poli_id', data.poli_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!schedule) {
        showToast('Tidak ada jadwal dokter di poli ini hari ini', 'error');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('queues').insert({
        queue_number: queueNumber,
        patient_id: selectedPatient.id,
        doctor_schedule_id: schedule.id,
        poli_id: data.poli_id,
        status: 'menunggu',
      });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: selectedPatient.user_id || '00000000-0000-0000-0000-000000000000',
        action: 'keluhan',
        table_name: 'queues',
        record_id: schedule.id,
        new_data: { complaint: data.complaint, queue_number: queueNumber },
      });

      await logAudit('create_queue', 'queues', '', null, { queue_number: queueNumber, patient: selectedPatient.full_name, poli: poli?.name });

      showToast(`Antrian berhasil dibuat! No. ${queueNumber}`);
      setShowQueueForm(false);
      setSelectedPatient(null);
      resetQueue();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat antrian', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-xl ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-400/10 to-emerald-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Registrasi Pasien</h1>
                <p className="text-white/60 text-xs mt-0.5">Cari pasien atau daftarkan pasien baru, lalu buat antrian</p>
              </div>
            </div>
            {!selectedPatient && (
              <button onClick={() => { setShowQueueForm(false); setShowNewForm(true); }} className="hidden sm:flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg">
                <UserPlus className="h-4 w-4" />
                Pasien Baru
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Mobile Pasien Baru Button */}
      {!selectedPatient && (
        <div className="sm:hidden">
          <button onClick={() => { setShowQueueForm(false); setShowNewForm(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] hover:from-[#0a2e28] hover:via-[#0c3b33] hover:to-[#0f4a3f] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 transition-all duration-200">
            <UserPlus className="h-4 w-4" />
            Pasien Baru
          </button>
        </div>
      )}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cari Pasien</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Ketik nama, No. RM, atau NIK</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Masukkan nama, No. RM, atau NIK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPatient()}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all hover:border-slate-300 dark:hover:border-slate-500 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
              <button onClick={searchPatient} disabled={searching} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all duration-200 disabled:opacity-60">
                {searching ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cari
                  </>
                ) : 'Cari'}
              </button>
            </div>

            {/* Search Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-2"
                >
                  {searchResults.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => { setSelectedPatient(p); setSearchResults([]); setSearchQuery(''); }}
                      className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                          {p.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.full_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> {p.medical_record_number}
                            </span>
                            {p.nik && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">NIK: {p.nik}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.phone && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {searchQuery && searchResults.length === 0 && !searching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center py-6 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-dashed border-slate-200 dark:border-slate-600"
              >
                <UserCircle2 className="h-10 w-10 text-slate-300 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ditemukan</p>
                <button onClick={() => { setShowQueueForm(false); setShowNewForm(true); }} className="mt-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  Daftarkan pasien baru &rarr;
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Today's Schedule - Collapsible */}
      {todaySchedules.length > 0 && (
        <motion.div custom={1.5} initial="hidden" animate="visible" variants={fadeIn}>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full rounded-2xl border border-emerald-100 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/30 dark:to-teal-900/30 p-4 flex items-center justify-between hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Jadwal Dokter Hari Ini</h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{todaySchedules.length} dokter aktif</p>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              {showSchedule ? <ChevronUp className="h-4 w-4 text-emerald-700" /> : <ChevronDown className="h-4 w-4 text-emerald-700" />}
            </div>
          </button>

          <AnimatePresence>
            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(
                    todaySchedules.reduce((acc: Record<string, any[]>, s) => {
                      if (!acc[s.poli_name]) acc[s.poli_name] = [];
                      acc[s.poli_name].push(s);
                      return acc;
                    }, {})
                  ).map(([poliName, schedules]) => (
                    <div key={poliName} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                          {schedules[0]?.poli_initial}
                        </span>
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{poliName}</h4>
                      </div>
                      <div className="space-y-2">
                        {schedules.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                                {s.doctor_name?.split(' ').pop()?.charAt(0) || '?'}
                              </div>
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{s.doctor_name}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Selected Patient Card */}
      <AnimatePresence>
        {selectedPatient && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            custom={2}
          >
            <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                      {selectedPatient.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedPatient.full_name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <CreditCard className="h-3.5 w-3.5" /> {selectedPatient.medical_record_number}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                    <AlertCircle className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  {[
                    { icon: CreditCard, label: 'NIK', value: selectedPatient.nik || '-' },
                    { icon: Phone, label: 'Telepon', value: selectedPatient.phone || '-' },
                    { icon: MapPin, label: 'Alamat', value: selectedPatient.address || '-' },
                    { icon: Heart, label: 'Gol. Darah', value: selectedPatient.blood_type || '-', highlight: true },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <item.icon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.label}</span>
                      </div>
                      <p className={`text-sm font-semibold ${item.highlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setShowNewForm(false); setShowQueueForm(true); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all duration-200">
                    <ClipboardList className="h-4 w-4" /> Buat Antrian
                  </button>
                  <button onClick={() => setSelectedPatient(null)} className="px-4 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200">
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Patient Form Dialog */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
          {/* Dialog Header with gradient */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] px-6 py-5 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold">Registrasi Pasien Baru</DialogTitle>
                <p className="text-white/60 text-xs mt-0.5">Lengkapi data pasien di bawah ini</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmitNewPatient)} className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <Input
                {...register('name', { required: 'Nama wajib diisi' })}
                placeholder="Masukkan nama lengkap pasien"
                className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {errors.name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name.message}</p>}
            </div>

            {/* NIK */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> NIK <span className="text-red-500">*</span>
              </label>
              <Input
                {...register('nik', { required: 'NIK wajib diisi', minLength: { value: 16, message: 'NIK minimal 16 digit' } })}
                placeholder="16 digit NIK"
                className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl font-mono focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {errors.nik && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.nik.message}</p>}
            </div>

            {/* Phone & Birth Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telepon <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('phone', { required: 'Telepon wajib diisi' })}
                  placeholder="08xxxxxxxxxx"
                  className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                {errors.phone && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Tanggal Lahir <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('birth_date', { required: 'Tanggal lahir wajib diisi' })}
                  type="date"
                  className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                {errors.birth_date && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.birth_date.message}</p>}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Alamat <span className="text-red-500">*</span>
              </label>
              <Input
                {...register('address', { required: 'Alamat wajib diisi' })}
                placeholder="Alamat lengkap pasien"
                className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {errors.address && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.address.message}</p>}
            </div>

            {/* Gender & Blood Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Jenis Kelamin <span className="text-red-500">*</span>
                </label>
                <Select {...register('gender', { required: 'Jenis kelamin wajib dipilih' })} className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                  <option value="">Pilih</option>
                  <option value="laki-laki">Laki-laki</option>
                  <option value="perempuan">Perempuan</option>
                </Select>
                {errors.gender && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.gender.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" /> Golongan Darah
                </label>
                <Select {...register('blood_type')} className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                  <option value="">Pilih</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </Select>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800 shrink-0">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Informasi</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Nomor RM akan dibuatkan otomatis oleh sistem.</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowNewForm(false)} className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200">
                Batal
              </button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] hover:from-[#0a2e28] hover:via-[#0c3b33] hover:to-[#0f4a3f] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 transition-all duration-200 disabled:opacity-60">
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mendaftarkan...
                  </div>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Daftarkan Pasien</>
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Queue Form Dialog */}
      <Dialog open={showQueueForm} onOpenChange={setShowQueueForm}>
        <DialogContent className="max-w-lg p-0">
          {/* Dialog Header */}
          <div className="bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] px-6 py-5 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold">Buat Antrian</DialogTitle>
                <p className="text-white/60 text-xs mt-0.5">Pilih poli dan isi keluhan pasien</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Warning jika di luar jam pendaftaran */}
            {!queueStatus.canQueue && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{queueStatus.message}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Jam operasional klinik: {CLINIC_OPEN_HOUR.toString().padStart(2, '0')}:00 - {(CLINIC_CLOSE_HOUR + 1).toString().padStart(2, '0')}:00 WIB</p>
                </div>
              </div>
            )}

            {/* Patient Info */}
            {selectedPatient && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-sm">
                  {selectedPatient.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedPatient.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">RM: {selectedPatient.medical_record_number}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitQueue(onSubmitQueue)} className="space-y-4">
              {/* Poli */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pilih Poli</label>
                <Select {...registerQueue('poli_id', { required: 'Poli wajib dipilih' })} className="h-11 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Pilih Poli</option>
                  {poliList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                {queueErrors.poli_id && <p className="text-xs text-red-500">{queueErrors.poli_id.message}</p>}
              </div>

              {/* Available Doctors */}
              <AnimatePresence>
                {availableDoctors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Stethoscope className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Dokter Hari Ini</p>
                    </div>
                    {availableDoctors.map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-emerald-100 dark:border-emerald-800 last:border-0">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{d.doctor_name}</span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-100 dark:bg-emerald-800 px-2 py-0.5 rounded-full">
                          {d.start_time?.slice(0, 5)} - {d.end_time?.slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {selectedPoliId && availableDoctors.length === 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">Tidak ada jadwal dokter di poli ini hari ini.</p>
                </div>
              )}

              {/* Complaint */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Keluhan <span className="text-red-500">*</span></label>
                <textarea
                  {...registerQueue('complaint', { required: 'Keluhan wajib diisi' })}
                  placeholder="Tuliskan keluhan pasien..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all hover:border-slate-300 dark:hover:border-slate-500 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                />
                {queueErrors.complaint && <p className="text-xs text-red-500">{queueErrors.complaint.message}</p>}
              </div>

              {/* Override Jam - hanya muncul saat di luar jam */}
              {!queueStatus.canQueue && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideTime}
                      onChange={(e) => setOverrideTime(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Daftarkan Pasien Offline</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Centang untuk mendaftarkan pasien yang datang langsung ke klinik di luar jam operasional</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowQueueForm(false); setOverrideTime(false); }} className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200">
                  Batal
                </button>
                <button type="submit" disabled={saving || (!queueStatus.canQueue && !overrideTime)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Membuat...
                    </div>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Buat Antrian</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
