'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Users, Stethoscope, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, startOfWeek, addDays } from 'date-fns';
import { id } from 'date-fns/locale';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

const dayMap: Record<string, string> = {
  'senin': 'Senin', 'selasa': 'Selasa', 'rabu': 'Rabu', 'kamis': 'Kamis',
  'jumat': 'Jumat', 'sabtu': 'Sabtu', 'minggu': 'Minggu',
};

const dayMapReverse: Record<string, number> = {
  'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
  'Friday': 5, 'Saturday': 6, 'Sunday': 0,
};

const dayShort: Record<string, string> = {
  'Senin': 'Sen', 'Selasa': 'Sel', 'Rabu': 'Rab', 'Kamis': 'Kam',
  'Jumat': 'Jum', 'Sabtu': 'Sab', 'Minggu': 'Min',
};

export default function DoctorSchedule() {
  const supabase = createClient();
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [todayQueue, setTodayQueue] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [doctorId, setDoctorId] = React.useState<string | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<string>('');

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  React.useEffect(() => {
    setSelectedDay(format(new Date(), 'EEEE'));
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, user_id')
        .eq('user_id', session.user.id)
        .single();

      if (!doctor) { setLoading(false); return; }
      setDoctorId(doctor.id);

      const [{ data: schedData }, { data: queueData }] = await Promise.all([
        supabase.from('doctor_schedules').select('*, poli:poli(name, initial)').eq('doctor_id', doctor.id),
        supabase.from('queues')
          .select('*, patient:patients(id, user_id, medical_record_number)')
          .order('queue_number'),
      ]);

      const poliIds = schedData?.map((s: any) => s.poli_id) || [];
      const todayQueues = queueData?.filter((q: any) =>
        poliIds.includes(q.poli_id) &&
        q.created_at >= new Date().toISOString().split('T')[0] &&
        q.status !== 'dibatalkan'
      ) || [];

      const patientUserIds = todayQueues.map((q: any) => q.patient?.user_id).filter(Boolean);
      const uniqueUserIds = [...new Set(patientUserIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enrichedQueues = todayQueues.map((q: any) => ({
        ...q,
        patient: q.patient ? { ...q.patient, full_name: profileMap[q.patient.user_id] || '-' } : null,
      }));

      setSchedules(schedData || []);
      setTodayQueue(enrichedQueues);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const getScheduleForDay = (dayOfWeek: string) => {
    const dayNum = dayMapReverse[dayOfWeek];
    return schedules.filter((s) => s.day_of_week === dayNum);
  };

  const todayDayEn = format(new Date(), 'EEEE');
  const selectedDaySchedules = getScheduleForDay(selectedDay);

  const stats = {
    totalSchedules: schedules.length,
    thisWeek: weekDays.filter(day => getScheduleForDay(format(day, 'EEEE')).length > 0).length,
    todayQueues: todayQueue.length,
    nowChecking: todayQueue.filter(q => q.status === 'sedang_diperiksa').length,
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-medium text-white shadow-xl bg-gradient-to-r from-blue-500 to-indigo-500"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memuat data...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-400/10 to-emerald-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Jadwal Saya</h1>
              <p className="text-white/60 text-xs mt-0.5">Lihat jadwal praktek mingguan Anda</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Jadwal', value: stats.totalSchedules, icon: Calendar, bg: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
            { label: 'Hari Aktif', value: stats.thisWeek, icon: Clock, bg: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200' },
            { label: 'Antrian Hari Ini', value: stats.todayQueues, icon: Users, bg: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
            { label: 'Sedang Diperiksa', value: stats.nowChecking, icon: Stethoscope, bg: 'from-teal-500 to-cyan-500', shadow: 'shadow-teal-200' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.bg} shadow-md ${stat.shadow}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Day Selector */}
      <motion.div custom={1.5} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {weekDays.map((day) => {
              const dayNameEn = format(day, 'EEEE');
              const dayNameId = dayMap[dayNameEn.toLowerCase()] || dayNameEn;
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const isSelected = dayNameEn === selectedDay;
              const daySchedules = getScheduleForDay(dayNameEn);
              const hasSchedule = daySchedules.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(dayNameEn)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl min-w-[60px] transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-br from-[#0c3b33] to-[#0f4a3f] text-white shadow-lg shadow-teal-900/20' 
                      : isToday
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                    {dayShort[dayNameId] || dayNameEn.slice(0, 3)}
                  </span>
                  <span className={`text-lg font-bold ${isSelected ? 'text-white' : isToday ? 'text-teal-700' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasSchedule && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Selected Day Schedule */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c3b33] to-[#0f4a3f] shadow-md">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Jadwal {dayMap[selectedDay.toLowerCase()] || selectedDay}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedDaySchedules.length > 0 
                    ? `${selectedDaySchedules.length} jadwal aktif` 
                    : 'Tidak ada jadwal'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : selectedDaySchedules.length === 0 ? (
              <div className="text-center py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-3">
                  <Calendar className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Tidak ada jadwal hari ini</p>
                <p className="text-xs text-slate-400 mt-1">Hari libur</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDaySchedules.map((schedule) => {
                  const poliInitial = schedule.poli?.initial || '?';
                  return (
                    <div key={schedule.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-all">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c3b33] to-[#0f4a3f] text-white font-bold text-sm shadow-md">
                        {poliInitial}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{schedule.poli?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100">
                            <Clock className="h-3 w-3" />
                            {schedule.start_time?.slice(0, 5)} - {schedule.end_time?.slice(0, 5)}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                            <Users className="h-3 w-3" />
                            Max {schedule.max_patients} pasien
                          </span>
                        </div>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${schedule.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Today's Queue */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Antrian Hari Ini</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{todayQueue.length} pasien</p>
                </div>
              </div>
              {todayQueue.length > 0 && (
                <span className="flex h-8 items-center justify-center rounded-full bg-blue-100 px-3 text-xs font-bold text-blue-700">
                  {todayQueue.length}
                </span>
              )}
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : todayQueue.length === 0 ? (
              <div className="text-center py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-3">
                  <Users className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Tidak ada antrian hari ini</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayQueue.map((q) => {
                  const statusConfig = {
                    menunggu: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Menunggu' },
                    dipanggil: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400 animate-pulse', label: 'Dipanggil' },
                    sedang_diperiksa: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-400', label: 'Diperiksa' },
                    selesai: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Selesai' },
                  };
                  const sc = statusConfig[q.status as keyof typeof statusConfig] || statusConfig.menunggu;

                  return (
                    <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4 hover:bg-slate-50/50 transition-all">
                      <div className="flex items-center gap-4">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-sm ${
                          q.status === 'sedang_diperiksa' ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-200' :
                          q.status === 'dipanggil' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200 animate-pulse' :
                          q.status === 'selesai' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-200' :
                          'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700'
                        }`}>
                          {q.queue_number}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{q.patient?.full_name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">RM: {q.patient?.medical_record_number}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
