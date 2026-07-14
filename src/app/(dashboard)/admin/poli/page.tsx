'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Plus, Pencil, Trash2, Stethoscope, X, Save, AlertTriangle } from 'lucide-react';
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
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const dialogOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const dialogContent = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
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

    const doctorUserIds = schedulesData?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
    const uniqueIds = [...new Set(doctorUserIds)];
    let profileMap: Record<string, string> = {};
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

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

  const colors = ['from-teal-500 to-emerald-600', 'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-green-500 to-emerald-600'];

  const iconColors = ['text-teal-500', 'text-blue-500', 'text-violet-500', 'text-amber-500', 'text-rose-500', 'text-green-500'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl backdrop-blur-sm ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25' : 'bg-gradient-to-r from-red-500 to-rose-500 shadow-red-500/25'}`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              ) : (
                <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                  <X className="h-3 w-3 text-white" />
                </div>
              )}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Manajemen Poli</h1>
                <p className="text-white/60 text-xs mt-0.5">Kelola data poli klinik dengan mudah</p>
              </div>
            </div>
            <Button onClick={openAdd} className="gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white rounded-xl">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah Poli</span>
            </Button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors duration-200" />
            <Input
              placeholder="Cari poli berdasarkan nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 text-sm"
            />
          </div>
        </motion.div>

        {/* Poli Cards Grid */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <Skeleton className="h-2.5 w-full rounded-none" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                    <Building2 className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Tidak ada data poli</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Mulai dengan menambahkan poli baru</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item, i) => (
                <motion.div key={item.id} variants={cardVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
                  <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800 rounded-2xl group">
                    <div className={`h-1.5 bg-gradient-to-r ${colors[i % colors.length]}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors[i % colors.length]} shadow-lg`}>
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</h3>
                              {item.initial && (
                                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                  {item.initial}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{item.description || 'Tidak ada deskripsi'}</p>
                          <div className="mt-4">
                            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Dokter Terdaftar</p>
                            {item.doctors.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                Belum ada dokter
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {item.doctors.map((name: string, j: number) => (
                                  <span key={j} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-100 dark:border-teal-800/30 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300">
                                    <Stethoscope className="h-3 w-3" />
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            Dibuat {format(new Date(item.created_at), 'dd MMM yyyy', { locale: id })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 ml-2">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => openEdit(item)} className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
                            <Pencil className="h-4 w-4" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDeleteConfirm(item.id)} className="rounded-xl p-2 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200">
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
            {/* Dialog Header with Gradient */}
            <div className="bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 p-6 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10 blur-lg" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  {editItem ? <Pencil className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">{editItem ? 'Edit Poli' : 'Tambah Poli Baru'}</DialogTitle>
                  <p className="text-teal-100 text-sm mt-0.5">{editItem ? 'Perbarui informasi poli' : 'Isi data poli baru'}</p>
                </div>
              </div>
              <button onClick={() => setDialogOpen(false)} className="absolute top-4 right-4 rounded-xl p-1.5 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form key={dialogOpen ? (editItem?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" autoComplete="off">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-500" />
                  Nama Poli
                </label>
                <Input
                  {...register('name', { required: 'Nama poli wajib diisi' })}
                  placeholder="Contoh: Poli Umum"
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
                />
                {errors.name && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.name.message}
                  </motion.p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-teal-100 dark:bg-teal-900/30 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                    K
                  </span>
                  Kode/Inisial
                </label>
                <Input
                  {...register('initial', { required: 'Inisial wajib diisi' })}
                  placeholder="Contoh: UMU, ANK"
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
                />
                {errors.initial && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.initial.message}
                  </motion.p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                  </span>
                  Deskripsi
                </label>
                <Input
                  {...register('description')}
                  placeholder="Deskripsi poli (opsional)"
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl px-5 h-11 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200">
                  Batal
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" disabled={saving} className="gap-2 rounded-xl px-5 h-11 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25 transition-all duration-200">
                    {saving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {editItem ? 'Simpan Perubahan' : 'Tambah Poli'}
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-sm bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-red-500 via-rose-500 to-pink-600 p-6 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">Hapus Poli</DialogTitle>
                  <p className="text-red-100 text-sm mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button onClick={() => setDeleteConfirm(null)} className="absolute top-4 right-4 rounded-xl p-1.5 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus poli ini? Semua data terkait akan ikut terhapus.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl px-5 h-11 border-slate-200 dark:border-slate-600">
                  Batal
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="gap-2 rounded-xl px-5 h-11 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25">
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                </motion.div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
