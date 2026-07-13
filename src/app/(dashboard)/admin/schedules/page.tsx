'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, Pencil, Trash2, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';

interface ScheduleForm { doctor_id: string; poli_id: string; day_of_week: string; start_time: string; end_time: string; }

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayToNumber: Record<string, number> = { 'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5, 'Minggu': 6 };
const dayShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Color palette for poli
const poliColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {};
const colorPalette = [
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', dot: 'bg-teal-500' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' },
];

function getPoliColor(poliName: string, poliIdMap: Record<string, number>) {
  const idx = poliIdMap[poliName] ?? 0;
  return colorPalette[idx % colorPalette.length];
}

export default function ScheduleManagement() {
  const supabase = createClient();
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [doctors, setDoctors] = React.useState<any[]>([]);
  const [poli, setPoli] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCard, setSelectedCard] = React.useState<any>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ScheduleForm>();

  // Current week offset (0 = this week)
  const [weekOffset, setWeekOffset] = React.useState(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  // Get today's day (JS: 0=Sun → convert to 0=Mon)
  const todayDayOfWeek = (new Date().getDay() + 6) % 7;

  const fetchData = async () => {
    const [{ data: schedulesData }, { data: doctorsData }, { data: poliData }] = await Promise.all([
      supabase.from('doctor_schedules').select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, id)').order('day_of_week'),
      supabase.from('doctors').select('*').eq('is_available', true).order('created_at'),
      supabase.from('poli').select('*').order('name'),
    ]);

    const doctorUserIds = schedulesData?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
    const doctorUserIds2 = doctorsData?.map((d: any) => d.user_id).filter(Boolean) || [];
    const allUserIds = [...new Set([...doctorUserIds, ...doctorUserIds2])];
    let profileMap: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allUserIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

    const enrichedSchedules = schedulesData?.map((s: any) => ({
      ...s,
      doctor: s.doctor ? { ...s.doctor, full_name: profileMap[s.doctor.user_id] || '-' } : null,
    })) || [];
    const enrichedDoctors = doctorsData?.map((d: any) => ({
      ...d,
      full_name: profileMap[d.user_id] || '-',
    })) || [];

    setSchedules(enrichedSchedules);
    setDoctors(enrichedDoctors);
    setPoli(poliData || []);
    setLoading(false);
  };

  React.useEffect(() => { fetchData(); }, []);

  // Build poli color map
  const poliColorMap: Record<string, number> = {};
  poli.forEach((p, i) => { poliColorMap[p.name] = i; });

  // Group schedules by day
  const schedulesByDay: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  schedules.forEach((s) => {
    const day = s.day_of_week;
    if (schedulesByDay[day]) {
      schedulesByDay[day].push(s);
    }
  });
  // Sort each day by start_time
  Object.keys(schedulesByDay).forEach((day) => {
    schedulesByDay[Number(day)].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  const openAdd = (dayNum?: number) => {
    setEditItem(null);
    reset({
      doctor_id: '',
      poli_id: '',
      day_of_week: String(dayNum ?? 0),
      start_time: '08:00',
      end_time: '12:00',
    });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    reset({
      doctor_id: item.doctor_id,
      poli_id: item.poli_id,
      day_of_week: String(item.day_of_week),
      start_time: item.start_time,
      end_time: item.end_time,
    });
    setDialogOpen(true);
    setSelectedCard(null);
  };

  const onSubmit = async (data: ScheduleForm) => {
    setSaving(true);
    try {
      const submitData = {
        doctor_id: data.doctor_id,
        poli_id: data.poli_id,
        day_of_week: parseInt(data.day_of_week),
        start_time: data.start_time,
        end_time: data.end_time,
        is_active: true,
        max_patients: 20,
      };
      if (editItem) {
        const { error } = await supabase.from('doctor_schedules').update(submitData).eq('id', editItem.id);
        if (error) throw error;
        showToast('Jadwal berhasil diperbarui');
      } else {
        const { error } = await supabase.from('doctor_schedules').insert(submitData);
        if (error) throw error;
        showToast('Jadwal berhasil ditambahkan');
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
    const { error } = await supabase.from('doctor_schedules').delete().eq('id', id);
    if (error) showToast('Gagal menghapus jadwal', 'error');
    else { showToast('Jadwal berhasil dihapus'); fetchData(); }
    setDeleteConfirm(null);
    setSelectedCard(null);
  };

  // Total schedules count
  const totalSchedules = schedules.length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jadwal Dokter</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{totalSchedules} jadwal aktif minggu ini</p>
        </div>
        <Button onClick={() => openAdd()} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Jadwal
        </Button>
      </motion.div>

      {/* Week Navigation */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.05 } } }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="rounded-xl p-2 bg-white dark:bg-slate-800 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
            {weekOffset === 0 ? 'Minggu Ini' : weekOffset > 0 ? `+${weekOffset} Minggu` : `${weekOffset} Minggu`}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="rounded-xl p-2 bg-white dark:bg-slate-800 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
            >
              Kembali ke Hari Ini
            </button>
          )}
        </div>
      </motion.div>

      {/* Poli Legend */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.1 } } }}>
        <div className="flex flex-wrap gap-2 mb-2">
          {poli.map((p) => {
            const color = getPoliColor(p.name, poliColorMap);
            return (
              <span key={p.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${color.bg} ${color.text}`}>
                <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                {p.name}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Weekly Calendar Grid */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.15 } } }}>
        {/* Mobile: horizontal scroll */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 sm:grid sm:grid-cols-7 min-w-[700px] sm:min-w-0">
            {days.map((dayName, dayIdx) => {
              const isToday = dayIdx === todayDayOfWeek && weekOffset === 0;
              const daySchedules = schedulesByDay[dayIdx] || [];

              return (
                <div key={dayIdx} className="flex flex-col min-w-[90px] sm:min-w-0 flex-1">
                  {/* Day Header */}
                  <div className={`rounded-t-xl px-2 py-2 text-center border-b-2 transition-colors ${
                    isToday
                      ? 'bg-teal-600 text-white border-teal-700'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                  }`}>
                    <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{dayShort[dayIdx]}</p>
                    <p className={`text-sm sm:text-lg font-bold ${isToday ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{dayName}</p>
                  </div>

                  {/* Day Content */}
                  <div className={`flex-1 min-h-[200px] sm:min-h-[300px] rounded-b-xl border border-t-0 p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 ${
                    isToday
                      ? 'bg-teal-50/50 border-teal-200'
                      : 'bg-white dark:bg-slate-800 border-slate-200'
                  }`}>
                    {loading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-12 sm:h-16 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse" />
                      ))
                    ) : daySchedules.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[60px] sm:min-h-[80px] text-slate-400">
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mb-1 opacity-50" />
                        <p className="text-[10px] sm:text-xs">Kosong</p>
                      </div>
                    ) : (
                      daySchedules.map((s) => {
                        const color = getPoliColor(s.poli?.name || '', poliColorMap);
                        return (
                          <motion.div
                            key={s.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`relative rounded-lg border p-2 sm:p-2.5 cursor-pointer transition-all hover:shadow-md ${color.bg} ${color.border}`}
                            onClick={() => setSelectedCard(s)}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                                  <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full flex-shrink-0 ${color.dot}`} />
                                  <p className={`text-[10px] sm:text-xs font-bold truncate ${color.text}`}>{s.poli?.name || '-'}</p>
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 truncate font-medium">{s.doctor?.full_name || '-'}</p>
                                <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400" />
                                  <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium">{s.start_time} - {s.end_time}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}

                    {/* Add button at bottom */}
                    {!loading && (
                      <button
                        onClick={() => openAdd(dayIdx)}
                        className="w-full rounded-lg border-2 border-dashed border-slate-200 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all"
                      >
                        + Tambah
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Scroll hint for mobile */}
        <div className="sm:hidden text-center mt-2">
          <p className="text-[10px] text-slate-400">Geser ke samping untuk lihat semua hari</p>
        </div>
      </motion.div>

      {/* Card Detail Popover */}
      {selectedCard && (
        <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Detail Jadwal</span>
                <button onClick={() => setSelectedCard(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:bg-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className={`rounded-xl p-4 border ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).bg} ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).border}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-3 w-3 rounded-full ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).dot}`} />
                  <p className={`text-lg font-bold ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).text}`}>{selectedCard.poli?.name || '-'}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dokter:</span>
                    <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{selectedCard.doctor?.full_name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Spesialisasi:</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{selectedCard.doctor?.specialty || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hari:</span>
                    <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{days[selectedCard.day_of_week]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Jam:</span>
                    <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{selectedCard.start_time} - {selectedCard.end_time}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => openEdit(selectedCard)} className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" onClick={() => { setDeleteConfirm(selectedCard.id); setSelectedCard(null); }} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Hapus
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dokter</label>
              <Select {...register('doctor_id', { required: 'Dokter wajib dipilih' })} className="mt-1">
                <option value="">Pilih Dokter</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name} - {d.specialty}</option>)}
              </Select>
              {errors.doctor_id && <p className="text-xs text-red-500 mt-1">{errors.doctor_id.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Poli</label>
              <Select {...register('poli_id', { required: 'Poli wajib dipilih' })} className="mt-1">
                <option value="">Pilih Poli</option>
                {poli.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              {errors.poli_id && <p className="text-xs text-red-500 mt-1">{errors.poli_id.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hari</label>
              <Select {...register('day_of_week', { required: 'Hari wajib dipilih' })} className="mt-1">
                {days.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jam Mulai</label>
                <Input {...register('start_time', { required: 'Waktu mulai wajib diisi' })} type="time" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jam Selesai</label>
                <Input {...register('end_time', { required: 'Waktu selesai wajib diisi' })} type="time" className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editItem ? 'Simpan' : 'Tambah'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Jadwal</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Apakah Anda yakin ingin menghapus jadwal ini?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
