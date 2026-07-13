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
  ArrowRight,
  User,
  Activity,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function DokterDashboard() {
  const supabase = createClient();
  const [stats, setStats] = React.useState<Stats>({ menunggu: 0, sedangDiperiksa: 0, selesaiHariIni: 0 });
  const [schedule, setSchedule] = React.useState<any[]>([]);
  const [queue, setQueue] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [doctorId, setDoctorId] = React.useState<string | null>(null);
  const [doctorName, setDoctorName] = React.useState('');

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch doctor name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', session.user.id)
        .single();
      setDoctorName(profile?.full_name || 'Dokter');

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, user_id, specialty')
        .eq('user_id', session.user.id)
        .single();

      if (!doctor) { setLoading(false); return; }
      setDoctorId(doctor.id);

      const todayNum = (new Date().getDay() + 6) % 7;

      const { data: todaySchedules } = await supabase
        .from('doctor_schedules')
        .select('*, poli:poli(name, initial)')
        .eq('doctor_id', doctor.id)
        .eq('day_of_week', todayNum);

      setSchedule(todaySchedules || []);

      const poliIds = todaySchedules?.map((s: any) => s.poli_id) || [];
      if (poliIds.length === 0) { setQueue([]); setLoading(false); return; }

      const { data: queues } = await supabase
        .from('queues')
        .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name)')
        .in('poli_id', poliIds)
        .gte('created_at', new Date().toISOString().split('T')[0])
        .neq('status', 'dibatalkan')
        .order('queue_number');

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

  const statusConfig: Record<string, { label: string; class: string }> = {
    menunggu: { label: 'Menunggu', class: 'bg-amber-50 text-amber-700 border border-amber-200' },
    dipanggil: { label: 'Dipanggil', class: 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse' },
    sedang_diperiksa: { label: 'Diperiksa', class: 'bg-teal-50 text-teal-700 border border-teal-200' },
    selesai: { label: 'Selesai', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    dibatalkan: { label: 'Dibatalkan', class: 'bg-red-50 text-red-700 border border-red-200' },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-400/10 to-teal-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium">Selamat bertugas,</p>
              {loading ? (
                <Skeleton className="h-6 w-40 bg-white/20 mt-1" />
              ) : (
                <h1 className="text-xl font-bold">{doctorName}</h1>
              )}
              <p className="text-white/50 text-xs mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Menunggu', value: stats.menunggu, icon: Clock, gradient: 'from-amber-500 to-orange-600' },
          { label: 'Diperiksa', value: stats.sedangDiperiksa, icon: Activity, gradient: 'from-blue-500 to-indigo-600' },
          { label: 'Selesai', value: stats.selesaiHariIni, icon: ClipboardCheck, gradient: 'from-emerald-500 to-teal-600' },
        ].map((card, i) => (
          <motion.div key={card.label} custom={i + 1} initial="hidden" animate="visible" variants={fadeIn}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-md`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    {loading ? <Skeleton className="h-6 w-8" /> : <p className="text-xl sm:text-2xl font-bold text-slate-900">{card.value}</p>}
                    <p className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Action - Mulai Pemeriksaan */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <Link href="/dokter/examination">
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-5 text-white shadow-lg shadow-teal-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Mulai Pemeriksaan</h3>
                  <p className="text-white/70 text-xs mt-0.5">Periksa pasien berikutnya</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-white/70 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Queue - Larger */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-3">
          <Card className="border-0 shadow-sm">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                    <ListOrdered className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Antrian Hari Ini</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{queue.length} pasien</p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="pt-2 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : queue.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-3">
                    <ListOrdered className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Belum ada antrian</p>
                  <p className="text-xs text-slate-400 mt-1">Antrian akan muncul di sini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 border border-slate-100 p-3.5 hover:bg-white hover:shadow-sm transition-all duration-200">
                      <div className="flex items-center gap-3.5">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold shadow-sm ${
                          q.status === 'sedang_diperiksa' ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white' :
                          q.status === 'dipanggil' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white animate-pulse' :
                          'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700'
                        }`}>
                          {q.queue_number}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{q.patient?.full_name || '-'}</p>
                          <p className="text-[11px] text-slate-400 font-medium">RM: {q.patient?.medical_record_number || '-'}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-semibold ${statusConfig[q.status]?.class || ''}`}>
                        {statusConfig[q.status]?.label || q.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Schedule - Smaller */}
        <motion.div custom={6} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
          <Card className="border-0 shadow-sm h-full">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-200">
                  <CalendarDays className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Jadwal Hari Ini</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{schedule.length} poli</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-2 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : schedule.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-3">
                    <CalendarDays className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Tidak ada jadwal</p>
                  <p className="text-xs text-slate-400 mt-1">Hari ini libur</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedule.map((s) => (
                    <div key={s.id} className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 hover:bg-white hover:shadow-sm transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white shadow-sm shrink-0">
                          {s.poli?.initial || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{s.poli?.name || '-'}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{dayNames[s.day_of_week]}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                            <Clock className="h-3 w-3" />
                            {s.start_time?.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Links */}
      <motion.div custom={7} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/dokter/examination', label: 'Pemeriksaan', icon: Stethoscope, gradient: 'from-teal-500 to-emerald-600' },
            { href: '/dokter/medical-records', label: 'Rekam Medis', icon: FileText, gradient: 'from-blue-500 to-indigo-600' },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="group rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-md`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-900">{action.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
