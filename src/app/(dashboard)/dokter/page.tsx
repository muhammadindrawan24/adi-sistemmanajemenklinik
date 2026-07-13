'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ListOrdered,
  ClipboardCheck,
  Clock,
  Play,
  Stethoscope,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

interface Stats {
  menunggu: number;
  sedangDiperiksa: number;
  selesaiHariIni: number;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export default function DokterDashboard() {
  const supabase = createClient();
  const [stats, setStats] = React.useState<Stats>({ menunggu: 0, sedangDiperiksa: 0, selesaiHariIni: 0 });
  const [schedule, setSchedule] = React.useState<any[]>([]);
  const [queue, setQueue] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [doctorId, setDoctorId] = React.useState<string | null>(null);

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Find doctor profile
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, user_id')
        .eq('user_id', session.user.id)
        .single();

      if (!doctor) { setLoading(false); return; }
      setDoctorId(doctor.id);

      const todayNum = (new Date().getDay() + 6) % 7; // Convert: JS 0=Sun -> DB 6=Minggu

      // Get doctor_schedules for today via doctor_id -> poli_id
      const { data: todaySchedules } = await supabase
        .from('doctor_schedules')
        .select('*, poli:poli(name)')
        .eq('doctor_id', doctor.id)
        .eq('day_of_week', todayNum);

      setSchedule(todaySchedules || []);

      // Get poli_ids from today's schedules
      const poliIds = todaySchedules?.map((s: any) => s.poli_id) || [];
      if (poliIds.length === 0) { setQueue([]); setLoading(false); return; }

      // Queue for doctor's poli today
      const { data: queues } = await supabase
        .from('queues')
        .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name)')
        .in('poli_id', poliIds)
        .gte('created_at', new Date().toISOString().split('T')[0])
        .neq('status', 'dibatalkan')
        .order('queue_number');

      // Fetch patient profile names
      const patientUserIds = queues?.map((q: any) => q.patient?.user_id).filter(Boolean) || [];
      const uniqueUserIds = [...new Set(patientUserIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enrichedQueues = queues?.map((q: any) => ({
        ...q,
        patient: q.patient ? { ...q.patient, full_name: profileMap[q.patient.user_id] || '-' } : null,
      })) || [];

      setQueue(enrichedQueues);

      const menunggu = enrichedQueues?.filter((q) => q.status === 'menunggu' || q.status === 'dipanggil').length || 0;
      const sedangDiperiksa = enrichedQueues?.filter((q) => q.status === 'sedang_diperiksa').length || 0;
      const selesaiHariIni = enrichedQueues?.filter((q) => q.status === 'selesai').length || 0;

      setStats({ menunggu, sedangDiperiksa, selesaiHariIni });
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const statCards = [
    { label: 'Menunggu', value: stats.menunggu, icon: Clock, color: 'from-amber-500 to-orange-600' },
    { label: 'Sedang Diperiksa', value: stats.sedangDiperiksa, icon: Stethoscope, color: 'from-blue-500 to-blue-600' },
    { label: 'Selesai Hari Ini', value: stats.selesaiHariIni, icon: ClipboardCheck, color: 'from-green-500 to-emerald-600' },
  ];

  const dayTranslations: Record<string, string> = {
    'senin': 'Senin',
    'selasa': 'Selasa',
    'rabu': 'Rabu',
    'kamis': 'Kamis',
    'jumat': 'Jumat',
    'sabtu': 'Sabtu',
    'minggu': 'Minggu',
  };

  const statusVariant = (status: string) => {
    const map: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'secondary'> = {
      menunggu: 'warning',
      dipanggil: 'info',
      sedang_diperiksa: 'info',
      selesai: 'success',
      dibatalkan: 'destructive',
    };
    return map[status] || 'secondary';
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Dokter</h1>
        <p className="text-slate-500 mt-1">Jadwal dan antrian pemeriksaan Anda hari ini.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{card.label}</p>
                    {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>}
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} shadow-lg`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Jadwal Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : schedule.length === 0 ? (
                <p className="text-center text-slate-400 py-6">Tidak ada jadwal</p>
              ) : (
                <div className="space-y-2">
                  {schedule.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.poli?.name || '-'}</p>
                        <p className="text-xs text-slate-500">{dayNames[s.day_of_week] || s.day_of_week} &middot; {s.start_time} - {s.end_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Queue for Doctor */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-teal-600" />
                Antrian Pemeriksaan
              </CardTitle>
              <Link href="/dokter/examination">
                <Button size="sm" className="gap-1">
                  <Play className="h-3 w-3" />
                  Mulai Pemeriksaan
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : queue.length === 0 ? (
                <p className="text-center text-slate-400 py-6">Belum ada antrian</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {queue.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-sm font-bold text-teal-700">
                          {q.queue_number}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{q.patient?.full_name || '-'}</p>
                          <p className="text-xs text-slate-500">RM: {q.patient?.medical_record_number || '-'}</p>
                        </div>
                      </div>
                      <Badge variant={statusVariant(q.status)}>
                        {q.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex flex-wrap gap-3">
          <Link href="/dokter/examination">
            <Button className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Pemeriksaan Pasien
            </Button>
          </Link>
          <Link href="/dokter/medical-records">
            <Button variant="outline" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Rekam Medis
            </Button>
          </Link>
          <Link href="/dokter/my-schedule">
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Lihat Jadwal
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
