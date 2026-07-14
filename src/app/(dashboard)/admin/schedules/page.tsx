'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Pencil, Trash2, Clock, ChevronLeft, ChevronRight, X, Stethoscope, AlertTriangle, Sparkles } from 'lucide-react';
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
  { bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-200 dark:border-teal-700', text: 'text-teal-800 dark:text-teal-300', dot: 'bg-teal-500' },
  { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-800 dark:text-blue-300', dot: 'bg-blue-500' },
  { bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-700', text: 'text-violet-800 dark:text-violet-300', dot: 'bg-violet-500' },
  { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-700', text: 'text-rose-800 dark:text-rose-300', dot: 'bg-rose-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-700', text: 'text-cyan-800 dark:text-cyan-300', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-300', dot: 'bg-orange-500' },
];

function getPoliColor(poliName: string, poliIdMap: Record<string, number>) {
  const idx = poliIdMap[poliName] ?? 0;
  return colorPalette[idx % colorPalette.length];
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
};

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
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`fixed top-4 right-4 z-[100] rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-xl ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Gradient Header Banner */}
      <motion.div
        variants={fadeInUp}
        custom={0}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Jadwal Dokter</h1>
              <p className="text-white/60 text-xs mt-0.5">{totalSchedules} jadwal aktif minggu ini</p>
            </div>
          </div>
          <Button
            onClick={() => openAdd()}
            className="gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tambah Jadwal</span>
          </Button>
        </div>
      </motion.div>

      {/* Week Navigation */}
      <motion.div variants={fadeInUp} custom={1} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 sm:gap-3 mb-4">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="rounded-xl p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm hover:shadow"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[140px] text-center bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2">
            {weekOffset === 0 ? 'Minggu Ini' : weekOffset > 0 ? `+${weekOffset} Minggu` : `${weekOffset} Minggu`}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="rounded-xl p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm hover:shadow"
          >
            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-xl px-4 py-2 text-xs font-semibold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all border border-teal-200/60 dark:border-teal-700/60"
            >
              Kembali ke Hari Ini
            </button>
          )}
        </div>
      </motion.div>

      {/* Poli Legend */}
      <motion.div variants={fadeInUp} custom={2} initial="hidden" animate="visible">
        <div className="flex flex-wrap gap-2 mb-2">
          {poli.map((p) => {
            const color = getPoliColor(p.name, poliColorMap);
            return (
              <span key={p.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color.bg} ${color.text} border ${color.border} shadow-sm`}>
                <span className={`h-2 w-2 rounded-full ${color.dot} ring-2 ring-white/50 dark:ring-slate-900/50`} />
                {p.name}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Weekly Calendar Grid */}
      <motion.div variants={fadeInUp} custom={3} initial="hidden" animate="visible">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 sm:grid sm:grid-cols-7 min-w-[700px] sm:min-w-0">
            {days.map((dayName, dayIdx) => {
              const isToday = dayIdx === todayDayOfWeek && weekOffset === 0;
              const daySchedules = schedulesByDay[dayIdx] || [];

              return (
                <div key={dayIdx} className="flex flex-col min-w-[90px] sm:min-w-0 flex-1">
                  {/* Day Header */}
                  <div className={`rounded-t-xl px-2 py-2.5 text-center border-b-2 transition-all ${
                    isToday
                      ? 'bg-gradient-to-br from-teal-600 to-emerald-500 text-white border-teal-500 shadow-lg shadow-teal-500/20'
                      : 'bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>{dayShort[dayIdx]}</p>
                    <p className={`text-sm sm:text-lg font-bold ${isToday ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{dayName}</p>
                    {isToday && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Hari Ini
                      </div>
                    )}
                  </div>

                  {/* Day Content */}
                  <div className={`flex-1 min-h-[200px] sm:min-h-[300px] rounded-b-xl border border-t-0 p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 transition-all ${
                    isToday
                      ? 'bg-gradient-to-b from-teal-50/80 to-white dark:from-teal-900/20 dark:to-slate-800 border-teal-200 dark:border-teal-700/60'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                    {loading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-12 sm:h-16 rounded-lg bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700/50 animate-pulse" />
                      ))
                    ) : daySchedules.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[60px] sm:min-h-[80px] text-slate-300 dark:text-slate-600">
                        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 opacity-40" />
                        <p className="text-[10px] sm:text-xs font-medium">Kosong</p>
                      </div>
                    ) : (
                      daySchedules.map((s) => {
                        const color = getPoliColor(s.poli?.name || '', poliColorMap);
                        return (
                          <motion.div
                            key={s.id}
                            layout
                            initial={{ opacity: 0, scale: 0.92, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            className={`relative rounded-xl border p-2 sm:p-2.5 cursor-pointer transition-shadow hover:shadow-lg ${color.bg} ${color.border}`}
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
                                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400 dark:text-slate-500" />
                                  <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{s.start_time} - {s.end_time}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}

                    {/* Add button at bottom */}
                    {!loading && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openAdd(dayIdx)}
                        className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 hover:border-teal-300 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all cursor-pointer"
                      >
                        + Tambah
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Scroll hint for mobile */}
        <div className="sm:hidden text-center mt-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Geser ke samping untuk lihat semua hari</p>
        </div>
      </motion.div>

      {/* Card Detail Popover */}
      <AnimatePresence>
        {selectedCard && (
          <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
              <motion.div variants={scaleIn} initial="hidden" animate="visible">
                {/* Dialog Gradient Header */}
                <div className={`bg-gradient-to-br ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).bg.replace('bg-', 'from-').replace('-50', '-500').replace('-900/30', '-600')} p-6 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10" />
                  <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                        <div className="rounded-lg bg-white/20 p-1.5">
                          <Stethoscope className="h-4 w-4" />
                        </div>
                        Detail Jadwal
                      </DialogTitle>
                      <button onClick={() => setSelectedCard(null)} className="rounded-lg p-1.5 hover:bg-white/20 transition-colors">
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).dot}`} />
                      <p className={`text-xl font-bold ${getPoliColor(selectedCard.poli?.name || '', poliColorMap).text}`}>{selectedCard.poli?.name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Dokter</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedCard.doctor?.full_name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Spesialisasi</span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{selectedCard.doctor?.specialty || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Hari</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{days[selectedCard.day_of_week]}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Jam</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-teal-500" />
                        {selectedCard.start_time} - {selectedCard.end_time}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => openEdit(selectedCard)} className="gap-2 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button variant="destructive" onClick={() => { setDeleteConfirm(selectedCard.id); setSelectedCard(null); }} className="gap-2 rounded-xl">
                      <Trash2 className="h-4 w-4" /> Hapus
                    </Button>
                  </div>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <motion.div variants={scaleIn} initial="hidden" animate="visible">
            {/* Dialog Header with Gradient */}
            <div className="bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 p-6 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/10" />
              <div className="relative z-10">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                  <div className="rounded-xl bg-white/20 p-2">
                    {editItem ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </div>
                  {editItem ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}
                </DialogTitle>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dokter</label>
                  <Select {...register('doctor_id', { required: 'Dokter wajib dipilih' })} className="mt-1 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500 focus:border-teal-500">
                    <option value="">Pilih Dokter</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name} - {d.specialty}</option>)}
                  </Select>
                  {errors.doctor_id && <p className="text-xs font-medium text-red-500 mt-1">{errors.doctor_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Poli</label>
                  <Select {...register('poli_id', { required: 'Poli wajib dipilih' })} className="mt-1 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500 focus:border-teal-500">
                    <option value="">Pilih Poli</option>
                    {poli.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  {errors.poli_id && <p className="text-xs font-medium text-red-500 mt-1">{errors.poli_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hari</label>
                  <Select {...register('day_of_week', { required: 'Hari wajib dipilih' })} className="mt-1 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500 focus:border-teal-500">
                    {days.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Jam Mulai</label>
                    <Input {...register('start_time', { required: 'Waktu mulai wajib diisi' })} type="time" className="mt-1 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500 focus:border-teal-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Jam Selesai</label>
                    <Input {...register('end_time', { required: 'Waktu selesai wajib diisi' })} type="time" className="mt-1 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500 focus:border-teal-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl px-5">
                    Batal
                  </Button>
                  <Button type="submit" disabled={saving} className="rounded-xl px-5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25">
                    {saving ? 'Menyimpan...' : editItem ? 'Simpan' : 'Tambah'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <motion.div variants={scaleIn} initial="hidden" animate="visible">
            {/* Danger Header */}
            <div className="bg-gradient-to-br from-red-500 to-rose-500 p-6 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />
              <div className="relative z-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-lg font-bold text-white">Hapus Jadwal</DialogTitle>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-5">
                Apakah Anda yakin ingin menghapus jadwal ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl px-5">
                  Batal
                </Button>
                <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="rounded-xl px-5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/25">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Hapus
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
