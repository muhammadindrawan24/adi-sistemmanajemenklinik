'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, Stethoscope } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function DoctorSchedule() {
  const supabase = createClient();
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [todayQueue, setTodayQueue] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [doctorId, setDoctorId] = React.useState<string | null>(null);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
        supabase.from('doctor_schedules').select('*, poli:poli(name)').eq('doctor_id', doctor.id),
        supabase.from('queues')
          .select('*, patient:patients(id, user_id, medical_record_number)')
          .order('queue_number'),
      ]);

      // Get poli_ids from schedules
      const poliIds = schedData?.map((s: any) => s.poli_id) || [];
      const todayQueues = queueData?.filter((q: any) =>
        poliIds.includes(q.poli_id) &&
        q.created_at >= new Date().toISOString().split('T')[0] &&
        q.status !== 'dibatalkan'
      ) || [];

      // Fetch patient profile names
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

  const todayDay = format(new Date(), 'EEEE', { locale: id }).toLowerCase();
  const todayDayEn = format(new Date(), 'EEEE');

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Jadwal Saya</h1>
        <p className="text-slate-500 mt-1">Jadwal praktek mingguan Anda.</p>
      </motion.div>

      {/* Week View */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              <span className="text-sm sm:text-base">Minggu {format(weekStart, 'dd MMM yyyy', { locale: id })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: id })}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {/* Mobile: horizontal scroll */}
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex gap-2 sm:grid sm:grid-cols-7 min-w-[700px] sm:min-w-0">
                {weekDays.map((day) => {
                  const dayNameEn = format(day, 'EEEE');
                  const dayNameId = dayMap[dayNameEn.toLowerCase()] || dayNameEn;
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const daySchedules = getScheduleForDay(dayNameEn);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`rounded-xl border p-2 sm:p-3 min-h-[100px] sm:min-h-[120px] min-w-[90px] sm:min-w-0 flex-1 ${
                        isToday ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-center mb-1.5 sm:mb-2">
                        <p className="text-[10px] sm:text-xs font-medium text-slate-500">{dayNameId}</p>
                        <p className={`text-base sm:text-lg font-bold ${isToday ? 'text-teal-700' : 'text-slate-900'}`}>
                          {format(day, 'd')}
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="h-6 sm:h-8 w-full" />
                      ) : daySchedules.length === 0 ? (
                        <p className="text-center text-[10px] sm:text-xs text-slate-400 py-1 sm:py-2">Libur</p>
                      ) : (
                        <div className="space-y-1">
                          {daySchedules.map((s) => (
                            <div key={s.id} className="rounded-lg bg-teal-100 p-1 sm:p-1.5 text-center">
                              <p className="text-[9px] sm:text-[10px] font-medium text-teal-800 truncate">{s.poli?.name}</p>
                              <p className="text-[9px] sm:text-[10px] text-teal-600">{s.start_time}-{s.end_time}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Scroll hint for mobile */}
            <div className="sm:hidden text-center mt-3">
              <p className="text-[10px] text-slate-400">Geser ke samping untuk lihat semua hari</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Queue */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              Antrian Hari Ini
              <Badge variant="secondary">{todayQueue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : todayQueue.length === 0 ? (
              <p className="text-center text-slate-400 py-6">Tidak ada antrian hari ini</p>
            ) : (
              <div className="space-y-2">
                {todayQueue.map((q) => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        q.status === 'sedang_diperiksa' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {q.queue_number}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{q.patient?.full_name}</p>
                        <p className="text-xs text-slate-500">RM: {q.patient?.medical_record_number}</p>
                      </div>
                    </div>
                    <Badge variant={q.status === 'selesai' ? 'success' : q.status === 'sedang_diperiksa' ? 'default' : q.status === 'dipanggil' ? 'info' : 'warning'}>
                      {q.status === 'selesai' ? 'Selesai' : q.status === 'sedang_diperiksa' ? 'Diperiksa' : q.status === 'dipanggil' ? 'Dipanggil' : 'Menunggu'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
