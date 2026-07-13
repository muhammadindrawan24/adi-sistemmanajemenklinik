'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Search, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
    transition: { delay: i * 0.05, duration: 0.3 },
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
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manajemen Dokter</h1>
          <p className="text-slate-500 mt-1">Kelola data dokter klinik.</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Dokter
        </Button>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari nama, spesialisasi, atau SIP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </motion.div>

      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:bg-slate-900">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Jenis Kelamin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Spesialisasi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">SIP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Poli</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredDoctors.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Tidak ada data dokter</td></tr>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <tr key={doctor.id} className="border-b border-slate-100 hover:bg-slate-50 dark:bg-slate-900 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                              {doctor.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{doctor.profiles?.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{doctor.profiles?.gender === 'laki_laki' ? 'Laki-laki' : doctor.profiles?.gender === 'perempuan' ? 'Perempuan' : '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{doctor.specialty || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{doctor.license_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{doctor.poli_name || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={doctor.is_available ? 'success' : 'destructive'}>
                            {doctor.is_available ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {doctor.is_available ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditDialog(doctor)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(doctor.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 className="h-4 w-4" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editDoctor ? 'Edit Dokter' : 'Tambah Dokter Baru'}</DialogTitle>
          </DialogHeader>
          <form key={dialogOpen ? (editDoctor?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-3" autoComplete="off">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Dokter</label>
              <Input {...register('name', { required: 'Nama wajib diisi' })} placeholder="Dr. Nama Lengkap" className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Spesialisasi</label>
              <Input {...register('specialty', { required: 'Spesialisasi wajib diisi' })} placeholder="Contoh: Umum, Anak" className="mt-1" />
              {errors.specialty && <p className="text-xs text-red-500 mt-1">{errors.specialty.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">No. SIP</label>
              <Input {...register('license_number', { required: 'SIP wajib diisi' })} placeholder="Nomor Surat Izin Praktik" className="mt-1" />
              {errors.license_number && <p className="text-xs text-red-500 mt-1">{errors.license_number.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">NIP</label>
              <Input {...register('nip', { required: 'NIP wajib diisi' })} placeholder="Nomor Induk Pegawai" className="mt-1" />
              {errors.nip && <p className="text-xs text-red-500 mt-1">{errors.nip.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
              <Select {...register('gender')} className="mt-1">
                <option value="">Pilih Jenis Kelamin</option>
                <option value="laki_laki">Laki-laki</option>
                <option value="perempuan">Perempuan</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <Select {...register('is_available')} className="mt-1">
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : editDoctor ? 'Simpan Perubahan' : 'Tambah Dokter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Dokter</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-2">Apakah Anda yakin ingin menghapus data dokter ini?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
