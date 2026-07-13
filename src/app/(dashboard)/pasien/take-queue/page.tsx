'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered, Send, CheckCircle, AlertCircle, Stethoscope, Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';

interface QueueForm { poli_id: string; complaint: string; }

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function TakeQueuePage() {
  const supabase = createClient();
  const [poli, setPoli] = React.useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ queueNumber: number; position: number; poliName: string } | null>(null);
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { register, handleSubmit, formState: { errors }, watch } = useForm<QueueForm>();
  const selectedPoli = watch('poli_id');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      // Fetch poli
      const { data: poliData } = await supabase.from('poli').select('*').eq('is_active', true).order('name');
      setPoli(poliData || []);

      // Fetch today's doctor schedules with doctor info
      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, initial)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      // Fetch all doctor profiles in one query
      const allDoctorUserIds = schedules?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      const uniqueDoctorIds = [...new Set(allDoctorUserIds)];
      
      let profileMap: Record<string, string> = {};
      if (uniqueDoctorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uniqueDoctorIds);
        
        if (profiles) {
          profiles.forEach((p: any) => { 
            profileMap[p.user_id] = p.full_name; 
          });
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
  }, [supabase]);

  const onSubmit = async (data: QueueForm) => {
    setSaving(true);
    try {
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

      const selectedPoli = poli.find((p) => p.id === data.poli_id);
      if (!selectedPoli) throw new Error('Poli tidak ditemukan');

      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('poli_id', data.poli_id)
        .gte('created_at', today);

      const queueNum = (count || 0) + 1;
      const queueNumber = `${selectedPoli.initial}${String(queueNum).padStart(3, '0')}`;

      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('id')
        .eq('poli_id', data.poli_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!schedule) throw new Error('Tidak ada jadwal dokter untuk poli ini hari ini');

      const { error } = await supabase.from('queues').insert({
        patient_id: patient.id,
        poli_id: data.poli_id,
        doctor_schedule_id: schedule.id,
        queue_number: queueNumber,
        status: 'menunggu',
      });

      if (error) throw error;

      const poliName = poli.find((p) => p.id === data.poli_id)?.name || '-';
      setResult({ queueNumber: queueNum, position: queueNum, poliName });
      showToast('Antrian berhasil diambil!');
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900">Ambil Antrian</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Antrian Berhasil!</h2>
              <p className="text-slate-500 mb-6">Anda telah terdaftar dalam antrian.</p>
              <div className="inline-flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
                <p className="text-sm text-slate-500">Nomor Antrian Anda</p>
                <p className="text-6xl font-bold text-teal-600 my-2">{result.queueNumber}</p>
                <p className="text-sm text-slate-600">{result.poliName}</p>
              </div>
              <div className="mt-6">
                <Button onClick={() => setResult(null)} className="gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Ambil Antrian Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Group schedules by poli for display
  const schedulesByPoli: Record<string, any[]> = {};
  todaySchedules.forEach((s) => {
    if (!schedulesByPoli[s.poli_name]) schedulesByPoli[s.poli_name] = [];
    schedulesByPoli[s.poli_name].push(s);
  });

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

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ambil Antrian</h1>
        <p className="text-slate-500 mt-1 text-sm">Pilih poli, cek jadwal dokter, dan ambil nomor antrian.</p>
      </motion.div>

      {/* Jadwal Dokter Hari Ini - Collapsible */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 p-4 flex items-center justify-between hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-sm shadow-emerald-200">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-emerald-800">Jadwal Dokter Hari Ini</h3>
              <p className="text-[10px] text-emerald-600 mt-0.5">{todaySchedules.length} dokter aktif</p>
            </div>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
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
              <div className="pt-3">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : todaySchedules.length === 0 ? (
                  <div className="text-center py-6 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Tidak ada jadwal dokter hari ini</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(schedulesByPoli).map(([poliName, schedules]) => (
                      <div key={poliName} className="rounded-xl bg-white border border-slate-100 p-3.5 shadow-sm">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-700">
                            {schedules[0]?.poli_initial}
                          </span>
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{poliName}</h4>
                        </div>
                        <div className="space-y-1.5">
                          {schedules.map((s: any) => (
                            <div key={s.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[9px] font-bold text-white">
                                  {s.doctor_name?.split(' ').pop()?.charAt(0) || '?'}
                                </div>
                                <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{s.doctor_name}</span>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
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
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
              <ListOrdered className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ambil Antrian Baru</h3>
              <p className="text-xs text-slate-400">Pilih poli dan isi keluhan</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Poli Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Poli <span className="text-red-500">*</span></label>
              {loading ? (
                <Skeleton className="h-11 w-full rounded-xl" />
              ) : (
                <Select {...register('poli_id', { required: 'Poli wajib dipilih' })} className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                  <option value="">Pilih Poli</option>
                  {poli.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
              {errors.poli_id && <p className="text-xs text-red-500">{errors.poli_id.message}</p>}
            </div>

            {/* Show available doctors for selected poli */}
            <AnimatePresence>
              {selectedPoli && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {todaySchedules.filter(s => s.poli_id === selectedPoli).length > 0 ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Stethoscope className="h-4 w-4 text-emerald-600" />
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Dokter Tersedia</p>
                      </div>
                      {todaySchedules.filter(s => s.poli_id === selectedPoli).map((d, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-emerald-100 last:border-0">
                          <span className="text-sm font-semibold text-slate-700">{d.doctor_name}</span>
                          <span className="text-xs text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                            {d.start_time?.slice(0, 5)} - {d.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                      <p className="text-sm text-amber-700">Tidak ada jadwal dokter di poli ini hari ini.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Complaint */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Keluhan Singkat</label>
              <textarea
                {...register('complaint')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-none min-h-[80px]"
                placeholder="Deskripsikan keluhan Anda secara singkat..."
              />
            </div>

            {/* Submit */}
            <Button type="submit" disabled={saving} className="w-full h-12 gap-2 bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] hover:from-[#0a2e28] hover:to-[#0c3b33] shadow-lg shadow-teal-900/20 text-sm font-semibold rounded-xl">
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengambil Antrian...
                </div>
              ) : (
                <><Send className="h-4 w-4" /> Ambil Antrian</>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
