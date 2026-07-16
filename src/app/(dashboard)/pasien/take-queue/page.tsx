'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered, Send, CheckCircle, AlertCircle, Stethoscope, Clock, Calendar, ChevronDown, ChevronUp, User, FileText, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { format, addDays } from 'date-fns';
import { id } from 'date-fns/locale';

interface QueueForm { poli_id: string; complaint: string; }
interface QueueResult { queueNumber: string; position: number; poliName: string; visitDate: string; }

const CLINIC_OPEN_HOUR = 7;
const CLINIC_CLOSE_HOUR = 20;
const CLINIC_CLOSE_MINUTE = 30;
const DOCTOR_START_HOUR = 8;

function getQueueStatus(): { canQueue: boolean; message: string } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const openTime = CLINIC_OPEN_HOUR * 60;
  const closeTime = CLINIC_CLOSE_HOUR * 60 + CLINIC_CLOSE_MINUTE;

  if (currentMinutes < openTime) {
    return { canQueue: false, message: `Pendaftaran antrian dibuka pukul ${CLINIC_OPEN_HOUR.toString().padStart(2, '0')}:00 WIB` };
  }
  if (currentMinutes >= closeTime) {
    return { canQueue: false, message: `Pendaftaran antrian ditutup pukul ${CLINIC_CLOSE_HOUR.toString().padStart(2, '0')}:${CLINIC_CLOSE_MINUTE.toString().padStart(2, '0')} WIB` };
  }
  return { canQueue: true, message: '' };
}

export default function TakeQueuePage() {
  const supabase = createClient();
  const [poli, setPoli] = React.useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<QueueResult | null>(null);
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [queueStatus, setQueueStatus] = React.useState(getQueueStatus());
  const [visitDate, setVisitDate] = React.useState<'today' | 'tomorrow'>('today');
  const { register, handleSubmit, formState: { errors }, watch } = useForm<QueueForm>();
  const selectedPoli = watch('poli_id');

  const isToday = visitDate === 'today';
  const targetDate = isToday ? new Date() : addDays(new Date(), 1);
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isToday) setQueueStatus(getQueueStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: poliData } = await supabase.from('poli').select('*').eq('is_active', true).order('name');
      setPoli(poliData || []);

      const dayOfWeek = (targetDate.getDay() + 6) % 7;
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, initial)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      const allDoctorUserIds = schedules?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      const uniqueDoctorIds = [...new Set(allDoctorUserIds)];

      let profileMap: Record<string, string> = {};
      if (uniqueDoctorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uniqueDoctorIds);
        if (profiles) {
          profiles.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
        }
      }

      const enriched = schedules?.map((s: any) => ({
        ...s,
        doctor_name: profileMap[s.doctor?.user_id] || s.doctor?.specialty || '-',
        poli_name: s.poli?.name || '-',
        poli_initial: s.poli?.initial || '',
      })) || [];

      setTodaySchedules(enriched);
      setLoading(false);
    };
    fetchData();
  }, [supabase, targetDateStr]);

  const onSubmit = async (data: QueueForm) => {
    setSaving(true);
    try {
      if (isToday) {
        const status = getQueueStatus();
        if (!status.canQueue) throw new Error(status.message);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Silakan login terlebih dahulu');

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!patient) throw new Error('Data pasien tidak ditemukan');

      const { data: activeQueue } = await supabase
        .from('queues')
        .select('id')
        .eq('patient_id', patient.id)
        .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa'])
        .limit(1);

      if (activeQueue && activeQueue.length > 0) {
        throw new Error('Anda sudah memiliki antrian aktif');
      }

      const selectedPoliData = poli.find((p) => p.id === data.poli_id);
      if (!selectedPoliData) throw new Error('Poli tidak ditemukan');

      const dayOfWeek = (targetDate.getDay() + 6) % 7;
      const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('id')
        .eq('poli_id', data.poli_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!schedule) throw new Error('Tidak ada jadwal dokter untuk poli ini');

      const { data: queueResult, error: queueError } = await supabase
        .rpc('create_queue', {
          p_patient_id: patient.id,
          p_poli_id: data.poli_id,
          p_doctor_schedule_id: schedule.id,
          p_poli_initial: selectedPoliData.initial,
          p_visit_date: targetDateStr,
        });

      if (queueError) throw queueError;

      const queueNumber = queueResult.queue_number;
      const queueNum = queueResult.position;
      const poliName = poli.find((p) => p.id === data.poli_id)?.name || '-';
      setResult({ queueNumber, position: queueNum, poliName, visitDate: targetDateStr });
      showToast('Antrian berhasil diambil!');
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Success Result
  if (result) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Ambil Antrian</h1>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-cyan-900/20 border border-emerald-100 dark:border-emerald-800/30 p-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-teal-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-400/20 to-emerald-400/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 mx-auto mb-5 shadow-xl shadow-emerald-500/30">
                <CheckCircle className="h-10 w-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Antrian Berhasil!</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Anda telah terdaftar dalam antrian</p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="inline-flex flex-col items-center rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-xl shadow-emerald-100/50 dark:shadow-emerald-900/30 border border-emerald-50 dark:border-emerald-800/30">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Nomor Antrian Anda</p>
                <p className="text-7xl font-bold bg-gradient-to-r from-teal-500 to-emerald-600 bg-clip-text text-transparent my-3">{result.queueNumber}</p>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm font-semibold">{format(new Date(result.visitDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: id })}</span>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-2">Poli {result.poliName}</p>
              </motion.div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Clock className="h-3 w-3" />
                <span>Silakan datang sesuai tanggal kunjungan</span>
              </div>
              <div className="mt-6">
                <Button onClick={() => setResult(null)} className="gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-lg shadow-teal-500/25 rounded-xl">
                  <ListOrdered className="h-4 w-4" />
                  Ambil Antrian Lain
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const schedulesByPoli: Record<string, any[]> = {};
  todaySchedules.forEach((s) => {
    if (!schedulesByPoli[s.poli_name]) schedulesByPoli[s.poli_name] = [];
    schedulesByPoli[s.poli_name].push(s);
  });

  const tomorrow = addDays(new Date(), 1);

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-xl ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
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
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <ListOrdered className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Ambil Antrian</h1>
                <p className="text-white/60 text-xs">Pilih tanggal, poli, dan daftar antrian</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Date Picker: Hari Ini / Besok */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            <CalendarDays className="h-3 w-3" />
            Pilih Tanggal Kunjungan <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setVisitDate('today')}
              className={`flex flex-col items-center rounded-xl border-2 p-4 transition-all duration-200 ${
                isToday
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md shadow-teal-200 dark:shadow-teal-900/30'
                  : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
              }`}>
              <Calendar className={`h-6 w-6 mb-2 ${isToday ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${isToday ? 'text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'}`}>Hari Ini</span>
              <span className={`text-xs mt-0.5 ${isToday ? 'text-teal-500 dark:text-teal-400' : 'text-slate-400'}`}>
                {format(new Date(), 'EEEE, dd MMM', { locale: id })}
              </span>
            </button>
            <button type="button" onClick={() => setVisitDate('tomorrow')}
              className={`flex flex-col items-center rounded-xl border-2 p-4 transition-all duration-200 ${
                !isToday
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md shadow-teal-200 dark:shadow-teal-900/30'
                  : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
              }`}>
              <CalendarDays className={`h-6 w-6 mb-2 ${!isToday ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${!isToday ? 'text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'}`}>Besok</span>
              <span className={`text-xs mt-0.5 ${!isToday ? 'text-teal-500 dark:text-teal-400' : 'text-slate-400'}`}>
                {format(tomorrow, 'EEEE, dd MMM', { locale: id })}
              </span>
            </button>
          </div>
          {!isToday && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400">Pesan antrian untuk besok — bisa dilakukan kapan saja, tanpa batas jam operasional</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Warning Jam - hanya tampil jika pilih Hari Ini */}
      {isToday && !queueStatus.canQueue && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/30 p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-800/50">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{queueStatus.message}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Pilih &quot;Besok&quot; untuk pesan antrian tanpa batas jam</p>
          </div>
        </motion.div>
      )}

      {/* Jadwal Dokter */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <button onClick={() => setShowSchedule(!showSchedule)}
          className="w-full rounded-2xl border border-emerald-100 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/10 p-4 flex items-center justify-between hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Jadwal Dokter {isToday ? 'Hari Ini' : 'Besok'}</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{todaySchedules.length} dokter aktif</p>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-800/50">
            {showSchedule ? <ChevronUp className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /> : <ChevronDown className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />}
          </div>
        </button>

        <AnimatePresence>
          {showSchedule && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="pt-3">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                  </div>
                ) : todaySchedules.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
                    <Calendar className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal dokter {isToday ? 'hari ini' : 'besok'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(schedulesByPoli).map(([poliName, schedules]) => (
                      <div key={poliName} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                            {schedules[0]?.poli_initial}
                          </span>
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{poliName}</h4>
                        </div>
                        <div className="space-y-2">
                          {schedules.map((s: any) => (
                            <div key={s.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-bold text-white shadow-sm">
                                  {s.doctor_name?.split(' ').pop()?.charAt(0) || '?'}
                                </div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{s.doctor_name}</span>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Form Ambil Antrian */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/25">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Formulir Antrian</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Lengkapi data di bawah ini</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Poli Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Stethoscope className="h-3 w-3" />
                Pilih Poli <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <Skeleton className="h-12 w-full rounded-xl" />
              ) : (
                <Select {...register('poli_id', { required: 'Poli wajib dipilih' })} className="h-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-sm">
                  <option value="">Pilih poli yang tersedia</option>
                  {poli.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
              {errors.poli_id && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.poli_id.message}
                </p>
              )}
            </div>

            {/* Show available doctors for selected poli */}
            <AnimatePresence>
              {selectedPoli && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  {todaySchedules.filter(s => s.poli_id === selectedPoli).length > 0 ? (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-800/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-sm">
                          <Stethoscope className="h-3.5 w-3.5 text-white" />
                        </div>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Dokter Tersedia {isToday ? 'Hari Ini' : 'Besok'}</p>
                      </div>
                      <div className="space-y-2">
                        {todaySchedules.filter(s => s.poli_id === selectedPoli).map((d, i) => (
                          <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[9px] font-bold text-white">
                                {d.doctor_name?.split(' ').pop()?.charAt(0) || '?'}
                              </div>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{d.doctor_name}</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {d.start_time?.slice(0, 5)} - {d.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">Tidak ada jadwal dokter di poli ini {isToday ? 'hari ini' : 'besok'}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Complaint */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <FileText className="h-3 w-3" />
                Keluhan Singkat
              </label>
              <textarea {...register('complaint')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all hover:border-slate-300 dark:hover:border-slate-500 focus:bg-white dark:focus:bg-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-none min-h-[100px]"
                placeholder="Deskripsikan keluhan Anda secara singkat..."
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={saving || (isToday && !queueStatus.canQueue)}
              className="w-full h-13 gap-2.5 bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] hover:from-[#0a2e28] hover:to-[#0c3b33] shadow-lg shadow-teal-900/25 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengambil Antrian...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {isToday ? 'Ambil Antrian Sekarang' : 'Pesan Antrian Besok'}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
