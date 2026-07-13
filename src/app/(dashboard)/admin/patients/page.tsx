'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Eye, Pencil, Calendar, FileText, Activity, Stethoscope, CheckCircle, AlertCircle } from 'lucide-react';
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
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle className="inline h-4 w-4 mr-1" /> : <AlertCircle className="inline h-4 w-4 mr-1" />}
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Pasien</h1>
        <p className="text-slate-500 mt-1">Lihat data pasien, riwayat kunjungan, dan rekam medis.</p>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalPatients}</p>
                  <p className="text-xs text-slate-500">Total Pasien</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <Activity className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activePatients}</p>
                  <p className="text-xs text-slate-500">Pernah Berobat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{todayPatients}</p>
                  <p className="text-xs text-slate-500">Kunjungan Hari Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari nama, No. RM, NIK, atau telepon..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </motion.div>

      {/* Patient Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Pasien</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No. RM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">NIK</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Usia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">JK</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Gol. Darah</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Kunjungan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Terakhir</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredPatients.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Tidak ada data pasien</td></tr>
                  ) : (
                    filteredPatients.map((patient) => (
                      <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                              {patient.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm font-medium text-slate-900">{patient.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{patient.medical_record_number}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{patient.nik || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{calculateAge(patient.date_of_birth)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {patient.gender === 'laki_laki' ? 'Laki-laki' : patient.gender === 'perempuan' ? 'Perempuan' : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {patient.blood_type ? (
                            <Badge variant="info">{patient.blood_type}</Badge>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center h-6 min-w-[24px] rounded-full px-2 text-xs font-bold ${
                            patient.visit_count > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {patient.visit_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {patient.last_visit
                            ? format(new Date(patient.last_visit), 'dd MMM yyyy', { locale: id })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(patient)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Edit Pasien">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => openDetail(patient)} className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors" title="Lihat Detail">
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Pasien</DialogTitle>
          </DialogHeader>
          {editPatient && (
            <form key={editPatient.id} onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4 mt-4">
              <div className="rounded-xl bg-slate-50 p-3 mb-2">
                <p className="text-sm font-medium text-slate-900">No. RM: {editPatient.medical_record_number}</p>
                <p className="text-xs text-slate-500">Nomor rekam medis tidak dapat diubah.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                <Input {...register('full_name', { required: 'Nama wajib diisi' })} className="mt-1" />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">NIK</label>
                <Input {...register('nik')} placeholder="Nomor Induk Kependudukan" className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Telepon</label>
                  <Input {...register('phone')} placeholder="08xxxxxxxxxx" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Tanggal Lahir</label>
                  <Input {...register('date_of_birth')} type="date" className="mt-1" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Alamat</label>
                <Input {...register('address')} placeholder="Alamat lengkap" className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Jenis Kelamin</label>
                  <Select {...register('gender')} className="mt-1">
                    <option value="">Pilih</option>
                    <option value="laki_laki">Laki-laki</option>
                    <option value="perempuan">Perempuan</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Golongan Darah</label>
                  <Select {...register('blood_type')} className="mt-1">
                    <option value="">Pilih</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Alergi</label>
                <Input {...register('allergies')} placeholder="Contoh: Makanan laut, Debu" className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Kontak Darurat</label>
                <Input {...register('emergency_contact')} placeholder="Nama - Nomor HP" className="mt-1" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditPatient(null)}>Batal</Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => { setSelectedPatient(null); setPatientHistory([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Pasien</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 mt-4">
              {/* Patient Info Card */}
              <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">
                    {selectedPatient.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedPatient.full_name}</h3>
                    <p className="text-sm text-white/80">RM: {selectedPatient.medical_record_number}</p>
                  </div>
                </div>
              </div>

              {/* Identity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-600" /> Identitas
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">NIK</span>
                      <span className="font-medium text-slate-900 font-mono">{selectedPatient.nik || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telepon</span>
                      <span className="font-medium text-slate-900">{selectedPatient.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Alamat</span>
                      <span className="font-medium text-slate-900 text-right max-w-[180px]">{selectedPatient.address || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tgl Lahir</span>
                      <span className="font-medium text-slate-900">
                        {selectedPatient.date_of_birth
                          ? format(new Date(selectedPatient.date_of_birth), 'dd MMMM yyyy', { locale: id })
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Usia</span>
                      <span className="font-medium text-slate-900">{calculateAge(selectedPatient.date_of_birth)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-600" /> Data Medis
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gol. Darah</span>
                      <Badge variant="info">{selectedPatient.blood_type || '-'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jenis Kelamin</span>
                      <span className="font-medium text-slate-900">
                        {selectedPatient.gender === 'laki_laki' ? 'Laki-laki' : selectedPatient.gender === 'perempuan' ? 'Perempuan' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Alergi</span>
                      <span className="font-medium text-slate-900">{selectedPatient.allergies || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kontak Darurat</span>
                      <span className="font-medium text-slate-900">{selectedPatient.emergency_contact || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Kunjungan</span>
                      <span className="font-bold text-teal-600">{selectedPatient.visit_count}x</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-teal-600" /> Riwayat Pemeriksaan
                </h4>
                {loadingHistory ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : patientHistory.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada riwayat pemeriksaan</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {patientHistory.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 shrink-0">
                          <Stethoscope className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{record.diagnosis || 'Tanpa diagnosa'}</p>
                            <span className="text-xs text-slate-400 shrink-0">
                              {format(new Date(record.created_at), 'dd MMM yyyy', { locale: id })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {record.doctor_name} &middot; {record.poli_name}
                          </p>
                          {record.symptoms && (
                            <p className="text-xs text-slate-400 mt-1 truncate">Keluhan: {record.symptoms}</p>
                          )}
                        </div>
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
