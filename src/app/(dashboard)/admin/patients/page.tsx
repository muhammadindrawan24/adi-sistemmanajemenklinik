'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Eye, Pencil, Calendar, FileText, Activity, Stethoscope, CheckCircle, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';

interface EditForm {
  full_name: string;
  nik: string;
  phone: string;
  address: string;
  date_of_birth: string;
  gender: string;
  blood_type: string;
  allergies: string;
  emergency_contact: string;
}

interface PatientWithDetails {
  id: string;
  user_id: string;
  medical_record_number: string;
  nik: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  created_at: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  visit_count: number;
  last_visit: string | null;
  last_diagnosis: string | null;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

export default function PatientManagement() {
  const supabase = createClient();
  const [patients, setPatients] = React.useState<PatientWithDetails[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedPatient, setSelectedPatient] = React.useState<PatientWithDetails | null>(null);
  const [patientHistory, setPatientHistory] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Edit state
  const [editPatient, setEditPatient] = React.useState<PatientWithDetails | null>(null);
  const [saving, setSaving] = React.useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    // 1. Fetch all patients
    const { data: patientsData } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!patientsData || patientsData.length === 0) {
      setPatients([]);
      setLoading(false);
      return;
    }

    // 2. Fetch profiles
    const userIds = patientsData.map(p => p.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, address')
      .in('user_id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach(p => { profileMap[p.user_id] = p; });

    // 3. Fetch visit counts and last visit info
    const patientIds = patientsData.map(p => p.id);
    const { data: recordsData } = await supabase
      .from('medical_records')
      .select('patient_id, created_at, diagnosis')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false });

    const visitMap: Record<string, { count: number; lastVisit: string | null; lastDiagnosis: string | null }> = {};
    patientIds.forEach(id => {
      visitMap[id] = { count: 0, lastVisit: null, lastDiagnosis: null };
    });

    recordsData?.forEach(r => {
      if (visitMap[r.patient_id]) {
        visitMap[r.patient_id].count++;
        if (!visitMap[r.patient_id].lastVisit) {
          visitMap[r.patient_id].lastVisit = r.created_at;
          visitMap[r.patient_id].lastDiagnosis = r.diagnosis;
        }
      }
    });

    // 4. Enrich patients
    const enriched: PatientWithDetails[] = patientsData.map(p => {
      const profile = profileMap[p.user_id] || {};
      const visits = visitMap[p.id] || { count: 0, lastVisit: null, lastDiagnosis: null };
      return {
        ...p,
        full_name: profile.full_name || '-',
        phone: profile.phone,
        address: profile.address,
        visit_count: visits.count,
        last_visit: visits.lastVisit,
        last_diagnosis: visits.lastDiagnosis,
      };
    });

    setPatients(enriched);
    setLoading(false);
  };

  React.useEffect(() => { fetchData(); }, []);

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.medical_record_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.nik?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = async (patient: PatientWithDetails) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);

    const { data: history } = await supabase
      .from('medical_records')
      .select('*, queue:queues(poli:poli(name))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch doctor names
    const doctorIds = [...new Set((history || []).map(r => r.doctor_id).filter(Boolean))];
    let doctorMap: Record<string, string> = {};
    if (doctorIds.length > 0) {
      const { data: doctorsData } = await supabase.from('doctors').select('id, user_id').in('id', doctorIds);
      const doctorUserIds = doctorsData?.map(d => d.user_id).filter(Boolean) || [];
      const { data: doctorProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doctorUserIds);
      doctorsData?.forEach(d => {
        const profile = doctorProfiles?.find(pf => pf.user_id === d.user_id);
        doctorMap[d.id] = profile?.full_name || '-';
      });
    }

    const enrichedHistory = (history || []).map(r => ({
      ...r,
      doctor_name: doctorMap[r.doctor_id] || '-',
      poli_name: (r.queue as any)?.poli?.name || '-',
    }));

    setPatientHistory(enrichedHistory);
    setLoadingHistory(false);
  };

  const openEdit = (patient: PatientWithDetails) => {
    setEditPatient(patient);
    reset({
      full_name: patient.full_name || '',
      nik: patient.nik || '',
      phone: patient.phone || '',
      address: patient.address || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || '',
      blood_type: patient.blood_type || '',
      allergies: patient.allergies || '',
      emergency_contact: patient.emergency_contact || '',
    });
  };

  const onSubmitEdit = async (data: EditForm) => {
    if (!editPatient) return;
    setSaving(true);

    try {
      // Update patients table
      const { error: patientError } = await supabase
        .from('patients')
        .update({
          nik: data.nik || null,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          blood_type: data.blood_type || null,
          allergies: data.allergies || null,
          emergency_contact: data.emergency_contact || null,
        })
        .eq('id', editPatient.id);

      if (patientError) throw patientError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          address: data.address || null,
        })
        .eq('user_id', editPatient.user_id);

      if (profileError) throw profileError;

      showToast('Data pasien berhasil diperbarui');
      setEditPatient(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return '-';
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} tahun`;
  };

  // Stats
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.visit_count > 0).length;
  const todayPatients = patients.filter(p => {
    if (!p.last_visit) return false;
    return new Date(p.last_visit).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
        >
          {toast.type === 'success' ? <CheckCircle className="inline h-4 w-4 mr-2" /> : <AlertCircle className="inline h-4 w-4 mr-2" />}
          {toast.message}
        </motion.div>
      )}

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <BedDouble className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Manajemen Pasien</h1>
                <p className="text-white/60 text-xs mt-0.5">Lihat data pasien, riwayat kunjungan, dan rekam medis</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md shadow-slate-200/50 dark:shadow-slate-800/50 dark:bg-slate-800 dark:border-slate-700 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalPatients}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Total Pasien</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md shadow-slate-200/50 dark:shadow-slate-800/50 dark:bg-slate-800 dark:border-slate-700 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activePatients}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Pernah Berobat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md shadow-slate-200/50 dark:shadow-slate-800/50 dark:bg-slate-800 dark:border-slate-700 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{todayPatients}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Kunjungan Hari Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 transition-colors duration-200" />
            <Input
              placeholder="Cari nama, No. RM, NIK, atau telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-3 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
            />
          </div>
        </div>
      </motion.div>

      {/* Patient Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-800/50 dark:bg-slate-800 dark:border-slate-700 rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Pasien</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">No. RM</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">NIK</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Usia</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">JK</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Gol. Darah</th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Kunjungan</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Terakhir</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                            <Users className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data pasien</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Coba ubah filter pencarian Anda</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient, index) => (
                      <motion.tr
                        key={patient.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.3 }}
                        className="border-b border-slate-100 dark:border-slate-700 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-transparent dark:hover:from-teal-900/20 dark:hover:to-transparent transition-all duration-200"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-sm font-bold text-white shadow-md shadow-teal-500/20">
                              {patient.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{patient.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono bg-slate-50/50 dark:bg-slate-700/30 rounded-l-lg">{patient.medical_record_number}</td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono">{patient.nik || '-'}</td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{calculateAge(patient.date_of_birth)}</td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {patient.gender === 'laki_laki' ? 'Laki-laki' : patient.gender === 'perempuan' ? 'Perempuan' : '-'}
                        </td>
                        <td className="px-5 py-4">
                          {patient.blood_type ? (
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                              {patient.blood_type}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center justify-center h-7 min-w-[28px] rounded-full px-2.5 text-xs font-bold shadow-sm ${
                            patient.visit_count > 0
                              ? 'bg-gradient-to-r from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 text-teal-700 dark:text-teal-300 shadow-teal-200/50 dark:shadow-teal-800/30'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                          }`}>
                            {patient.visit_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {patient.last_visit
                            ? format(new Date(patient.last_visit), 'dd MMM yyyy', { locale: id })
                            : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(patient)}
                              className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 hover:shadow-sm"
                              title="Edit Pasien"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDetail(patient)}
                              className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 dark:hover:from-teal-900/30 dark:hover:to-emerald-900/30 hover:text-teal-600 dark:hover:text-teal-400 transition-all duration-200 hover:shadow-sm"
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={!!editPatient} onOpenChange={() => setEditPatient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="dark:text-slate-100 text-lg">Edit Data Pasien</DialogTitle>
            </div>
          </DialogHeader>
          {editPatient && (
            <form key={editPatient.id} onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4 mt-4">
              <div className="rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 p-4 mb-2 border border-slate-200 dark:border-slate-600">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No. RM: {editPatient.medical_record_number}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">Nomor rekam medis tidak dapat diubah.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                <Input {...register('full_name', { required: 'Nama wajib diisi' })} className="mt-1.5 rounded-xl" />
                {errors.full_name && <p className="text-xs text-red-500 mt-1.5">{errors.full_name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">NIK</label>
                <Input {...register('nik')} placeholder="Nomor Induk Kependudukan" className="mt-1.5 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepon</label>
                  <Input {...register('phone')} placeholder="08xxxxxxxxxx" className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Lahir</label>
                  <Input {...register('date_of_birth')} type="date" className="mt-1.5 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
                <Input {...register('address')} placeholder="Alamat lengkap" className="mt-1.5 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
                  <Select {...register('gender')} className="mt-1.5 rounded-xl">
                    <option value="">Pilih</option>
                    <option value="laki_laki">Laki-laki</option>
                    <option value="perempuan">Perempuan</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Golongan Darah</label>
                  <Select {...register('blood_type')} className="mt-1.5 rounded-xl">
                    <option value="">Pilih</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alergi</label>
                <Input {...register('allergies')} placeholder="Contoh: Makanan laut, Debu" className="mt-1.5 rounded-xl" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kontak Darurat</label>
                <Input {...register('emergency_contact')} placeholder="Nama - Nomor HP" className="mt-1.5 rounded-xl" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <Button type="button" variant="outline" onClick={() => setEditPatient(null)} className="rounded-xl">
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/20">
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => { setSelectedPatient(null); setPatientHistory([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="dark:text-slate-100 text-lg">Detail Pasien</DialogTitle>
            </div>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 mt-4">
              {/* Patient Info Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-500 p-6 text-white shadow-lg shadow-teal-500/20">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10 blur-lg" />
                <div className="relative z-10 flex items-center gap-5">
                  <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-3xl font-bold shadow-xl">
                    {selectedPatient.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedPatient.full_name}</h3>
                    <p className="text-sm text-white/80 mt-0.5">RM: {selectedPatient.medical_record_number}</p>
                  </div>
                </div>
              </div>

              {/* Identity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-800 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                      <Users className="h-3.5 w-3.5 text-white" />
                    </div>
                    Identitas
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">NIK</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 font-mono">{selectedPatient.nik || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Telepon</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPatient.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Alamat</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 text-right max-w-[180px]">{selectedPatient.address || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Tgl Lahir</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {selectedPatient.date_of_birth
                          ? format(new Date(selectedPatient.date_of_birth), 'dd MMMM yyyy', { locale: id })
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Usia</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{calculateAge(selectedPatient.date_of_birth)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-800 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                      <Activity className="h-3.5 w-3.5 text-white" />
                    </div>
                    Data Medis
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Gol. Darah</span>
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                        {selectedPatient.blood_type || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Jenis Kelamin</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {selectedPatient.gender === 'laki_laki' ? 'Laki-laki' : selectedPatient.gender === 'perempuan' ? 'Perempuan' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Alergi</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPatient.allergies || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Kontak Darurat</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{selectedPatient.emergency_contact || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Total Kunjungan</span>
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 px-3 py-1 text-xs font-bold text-teal-700 dark:text-teal-300">
                        {selectedPatient.visit_count}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <FileText className="h-3.5 w-3.5 text-white" />
                  </div>
                  Riwayat Pemeriksaan
                </h4>
                {loadingHistory ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-18 w-full rounded-xl" />)}
                  </div>
                ) : patientHistory.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                      <FileText className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada riwayat pemeriksaan</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {patientHistory.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-transparent dark:hover:from-teal-900/20 dark:hover:to-transparent transition-all duration-200 group">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shrink-0 shadow-md shadow-teal-500/20 group-hover:shadow-lg group-hover:shadow-teal-500/30 transition-shadow duration-200">
                          <Stethoscope className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{record.diagnosis || 'Tanpa diagnosa'}</p>
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                              {format(new Date(record.created_at), 'dd MMM yyyy', { locale: id })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                            {record.doctor_name} &middot; {record.poli_name}
                          </p>
                          {record.symptoms && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 truncate">Keluhan: {record.symptoms}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0 mt-1 group-hover:text-teal-500 transition-colors duration-200" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
