'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Search, Plus, Pencil, Trash2, CheckCircle, XCircle, User, Users, Sparkles } from 'lucide-react';
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

interface DoctorForm {
  name: string;
  nip: string;
  license_number: string;
  specialty: string;
  is_available: boolean;
  bio: string;
  gender: string;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" },
  }),
};

const slideUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const tableRow = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: 'easeOut' },
  }),
};

export default function DoctorManagement() {
  const supabase = createClient();
  const [doctors, setDoctors] = React.useState<any[]>([]);
  const [poli, setPoli] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editDoctor, setEditDoctor] = React.useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DoctorForm>();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    const [{ data: doctorsData }, { data: poliData }, { data: schedulesData }] = await Promise.all([
      supabase.from('doctors').select('*').order('created_at', { ascending: false }),
      supabase.from('poli').select('*').order('name'),
      supabase.from('doctor_schedules').select('doctor_id, poli:poli(name)').eq('is_active', true),
    ]);

    const userIds = doctorsData?.map((d: any) => d.user_id).filter(Boolean) || [];
    const uniqueIds = [...new Set(userIds)];
    let profileMap: Record<string, { full_name: string; gender: string }> = {};
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, gender').in('user_id', uniqueIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = { full_name: p.full_name, gender: p.gender || '' }; });
    }

    // Build poli map from schedules
    const poliMap: Record<string, string> = {};
    schedulesData?.forEach((s: any) => {
      if (s.poli?.name && !poliMap[s.doctor_id]) {
        poliMap[s.doctor_id] = s.poli.name;
      }
    });

    const enriched = doctorsData?.map((d: any) => ({
      ...d,
      profiles: profileMap[d.user_id] || { full_name: '-', gender: '' },
      poli_name: poliMap[d.id] || '-',
    })) || [];

    setDoctors(enriched);
    setPoli(poliData || []);
    setLoading(false);
  };

  React.useEffect(() => { fetchData(); }, []);

  const filteredDoctors = doctors.filter((d) =>
    d.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase()) ||
    d.nip?.toLowerCase().includes(search.toLowerCase())
  );

  const openAddDialog = () => {
    setEditDoctor(null);
    reset({ name: '', nip: '', license_number: '', specialty: '', is_available: true, bio: '', gender: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (doctor: any) => {
    setEditDoctor(doctor);
    reset({ name: doctor.profiles?.full_name || '', nip: doctor.nip, license_number: doctor.license_number, specialty: doctor.specialty, is_available: doctor.is_available, bio: doctor.bio || '', gender: doctor.profiles?.gender || '' });
    setDialogOpen(true);
  };

  const onSubmit = async (data: DoctorForm) => {
    setSaving(true);
    try {
      if (editDoctor) {
        const { error } = await supabase.from('doctors').update({
          nip: data.nip,
          license_number: data.license_number,
          specialty: data.specialty,
          is_available: data.is_available,
          bio: data.bio,
        }).eq('id', editDoctor.id);
        if (error) throw error;
        // Update profile name and gender
        const { error: profileError } = await supabase.from('profiles').update({ full_name: data.name, gender: data.gender || null }).eq('user_id', editDoctor.user_id);
        if (profileError) throw profileError;
        showToast('Data dokter berhasil diperbarui');
      } else {
        // Direct INSERT — no signUp, no email rate limit
        const userId = crypto.randomUUID();
        const tempEmail = `dr.${data.nip}@kliniksehat.com`;

        // 1. Insert into users
        const { error: userError } = await supabase.from('users').insert({
          id: userId,
          email: tempEmail,
          role: 'dokter',
          is_active: true,
        });
        if (userError) throw userError;

        // 2. UPSERT profile (trigger on_user_created may have created one with email, overwrite with name)
        const { error: profileError } = await supabase.from('profiles').upsert({
          user_id: userId,
          full_name: data.name,
          gender: data.gender || null,
        }, { onConflict: 'user_id' });
        if (profileError) throw profileError;

        // 3. Insert doctor record
        const { error } = await supabase.from('doctors').insert({
          user_id: userId,
          nip: data.nip,
          license_number: data.license_number,
          specialty: data.specialty,
          is_available: data.is_available,
          bio: data.bio,
        });
        if (error) throw error;

        showToast('Dokter berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) {
      showToast('Gagal menghapus dokter', 'error');
    } else {
      showToast('Dokter berhasil dihapus');
      fetchData();
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-xl backdrop-blur-sm ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {/* Header Banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Stethoscope className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Manajemen Dokter</h1>
                  <p className="text-white/60 text-xs mt-0.5">Kelola data dokter klinik dengan mudah</p>
                </div>
              </div>
              <Button
                onClick={openAddDialog}
                className="gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white rounded-xl"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Tambah Dokter</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{doctors.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Dokter</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{doctors.filter(d => d.is_available).length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Dokter Aktif</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-100 dark:border-slate-700 sm:col-span-2 lg:col-span-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{filteredDoctors.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hasil Pencarian</p>
            </div>
          </div>
        </motion.div>

        {/* Modern Search Bar */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
            <Input
              placeholder="Cari nama, spesialisasi, atau SIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-3 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md focus:shadow-lg transition-all duration-300 text-base"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Modern Table Card */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={slideUp}>
          <Card className="rounded-3xl border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/80">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Nama</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Jenis Kelamin</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Spesialisasi</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">SIP</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Poli</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-6 py-4">
                              <Skeleton className="h-4 w-24 rounded-lg" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filteredDoctors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                              <Stethoscope className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Tidak ada data dokter</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDoctors.map((doctor, index) => (
                        <motion.tr
                          key={doctor.id}
                          custom={index}
                          initial="hidden"
                          animate="visible"
                          variants={tableRow}
                          className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-all duration-200"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-bold text-white shadow-md">
                                {doctor.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{doctor.profiles?.full_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{doctor.profiles?.gender === 'laki_laki' ? 'Laki-laki' : doctor.profiles?.gender === 'perempuan' ? 'Perempuan' : '-'}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                              {doctor.specialty || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono">{doctor.license_number || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{doctor.poli_name || '-'}</td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={doctor.is_available ? 'success' : 'destructive'}
                              className="rounded-full px-3 py-1 font-semibold"
                            >
                              {doctor.is_available ? <CheckCircle className="h-3.5 w-3.5 mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                              {doctor.is_available ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditDialog(doctor)}
                                className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 dark:hover:text-teal-400 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(doctor.id)}
                                className="rounded-xl p-2.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <Trash2 className="h-4 w-4" />
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

        {/* Modern Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[480px] dark:bg-slate-800 dark:border-slate-700 rounded-3xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
                  {editDoctor ? <Pencil className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {editDoctor ? 'Edit Dokter' : 'Tambah Dokter Baru'}
                </DialogTitle>
              </div>
            </DialogHeader>
            <form key={dialogOpen ? (editDoctor?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4" autoComplete="off">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nama Dokter</label>
                <Input
                  {...register('name', { required: 'Nama wajib diisi' })}
                  placeholder="Dr. Nama Lengkap"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                />
                {errors.name && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Spesialisasi</label>
                <Input
                  {...register('specialty', { required: 'Spesialisasi wajib diisi' })}
                  placeholder="Contoh: Umum, Anak"
                  className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                />
                {errors.specialty && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{errors.specialty.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">No. SIP</label>
                  <Input
                    {...register('license_number', { required: 'SIP wajib diisi' })}
                    placeholder="Nomor Surat Izin Praktik"
                    className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                  />
                  {errors.license_number && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{errors.license_number.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">NIP</label>
                  <Input
                    {...register('nip', { required: 'NIP wajib diisi' })}
                    placeholder="Nomor Induk Pegawai"
                    className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                  />
                  {errors.nip && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{errors.nip.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
                  <Select
                    {...register('gender')}
                    className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                  >
                    <option value="">Pilih Jenis Kelamin</option>
                    <option value="laki_laki">Laki-laki</option>
                    <option value="perempuan">Perempuan</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
                  <Select
                    {...register('is_available')}
                    className="rounded-xl border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl px-6 py-2.5 font-semibold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl px-6 py-2.5 font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {saving ? 'Menyimpan...' : editDoctor ? 'Simpan Perubahan' : 'Tambah Dokter'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modern Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-[400px] dark:bg-slate-800 dark:border-slate-700 rounded-3xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 shadow-lg">
                  <Trash2 className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Hapus Dokter</DialogTitle>
              </div>
            </DialogHeader>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus data dokter ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl px-6 py-2.5 font-semibold"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="rounded-xl px-6 py-2.5 font-semibold bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
