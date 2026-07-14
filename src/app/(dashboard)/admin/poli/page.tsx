'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';

interface PoliForm { name: string; initial: string; description: string; }

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function PoliManagement() {
  const supabase = createClient();
  const [poli, setPoli] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PoliForm>();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    const [{ data: poliData }, { data: schedulesData }] = await Promise.all([
      supabase.from('poli').select('*').order('name'),
      supabase.from('doctor_schedules').select('poli_id, doctor:doctors(id, user_id)').eq('is_active', true),
    ]);

    // Fetch doctor profile names
    const doctorUserIds = schedulesData?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
    const uniqueIds = [...new Set(doctorUserIds)];
    let profileMap: Record<string, string> = {};
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

    // Build poli_id → doctor names map
    const poliDoctorMap: Record<string, string[]> = {};
    schedulesData?.forEach((s: any) => {
      if (s.poli_id && s.doctor?.user_id) {
        const name = profileMap[s.doctor.user_id] || '-';
        if (!poliDoctorMap[s.poli_id]) poliDoctorMap[s.poli_id] = [];
        if (!poliDoctorMap[s.poli_id].includes(name)) {
          poliDoctorMap[s.poli_id].push(name);
        }
      }
    });

    // Enrich poli with doctor names
    const enriched = (poliData || []).map((p: any) => ({
      ...p,
      doctors: poliDoctorMap[p.id] || [],
    }));

    setPoli(enriched);
    setLoading(false);
  };

  React.useEffect(() => { fetchData(); }, []);

  const filtered = poli.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditItem(null); reset({ name: '', initial: '', description: '' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); reset({ name: item.name, initial: item.initial || '', description: item.description || '' }); setDialogOpen(true); };

  const onSubmit = async (data: PoliForm) => {
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase.from('poli').update(data).eq('id', editItem.id);
        if (error) throw error;
        showToast('Poli berhasil diperbarui');
      } else {
        const { error } = await supabase.from('poli').insert(data);
        if (error) throw error;
        showToast('Poli berhasil ditambahkan');
      }
      setDialogOpen(false); fetchData();
    } catch (err: any) { showToast(err.message || 'Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('poli').delete().eq('id', id);
    if (error) showToast('Gagal menghapus poli', 'error');
    else { showToast('Poli berhasil dihapus'); fetchData(); }
    setDeleteConfirm(null);
  };

  const colors = ['from-teal-500 to-emerald-600', 'from-blue-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-green-500 to-green-600'];

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manajemen Poli</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Kelola poli klinik.</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Poli
        </Button>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input placeholder="Cari poli..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </motion.div>

      {/* Poli Cards Grid */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="dark:bg-slate-800 dark:border-slate-700"><CardContent className="py-12 text-center text-slate-400 dark:text-slate-500">Tidak ada data poli</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item, i) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow dark:bg-slate-800 dark:border-slate-700">
                <div className={`h-2 bg-gradient-to-r ${colors[i % colors.length]}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{item.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.description || 'Tidak ada deskripsi'}</p>
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1.5">Dokter</p>
                        {item.doctors.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada dokter</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {item.doctors.map((name: string, j: number) => (
                              <span key={j} className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                        Dibuat {format(new Date(item.created_at), 'dd MMM yyyy', { locale: id })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteConfirm(item.id)} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Poli' : 'Tambah Poli Baru'}</DialogTitle>
          </DialogHeader>
          <form key={dialogOpen ? (editItem?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-3" autoComplete="off">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Poli</label>
              <Input {...register('name', { required: 'Nama poli wajib diisi' })} placeholder="Contoh: Poli Umum" className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kode/Inisial</label>
              <Input {...register('initial', { required: 'Inisial wajib diisi' })} placeholder="Contoh: UMU, ANK" className="mt-1" />
              {errors.initial && <p className="text-xs text-red-500 mt-1">{errors.initial.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
              <Input {...register('description')} placeholder="Deskripsi poli (opsional)" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editItem ? 'Simpan' : 'Tambah'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader><DialogTitle>Hapus Poli</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Apakah Anda yakin ingin menghapus poli ini?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
