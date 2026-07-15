'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ListOrdered,
  ClipboardCheck,
  UserPlus,
  Users,
  Clock,
  Sun,
  Moon,
  Sunrise,
  ArrowUpRight,
  ArrowRight,
  Stethoscope,
  Calendar,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

interface Stats {
  pasienHariIni: number;
  antrianAktif: number;
  selesaiDiperiksa: number;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function PetugasDashboard() {
  const supabase = createClient();
  const [userName, setUserName] = React.useState('');
  const [stats, setStats] = React.useState<Stats>({ pasienHariIni: 0, antrianAktif: 0, selesaiDiperiksa: 0 });
  const [queueByPoli, setQueueByPoli] = React.useState<Record<string, any[]>>({});
  const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return { text: 'Selamat Pagi', icon: Sunrise, emoji: '' };
    if (hour < 15) return { text: 'Selamat Siang', icon: Sun, emoji: '' };
    if (hour < 18) return { text: 'Selamat Sore', icon: Sunrise, emoji: '' };
    return { text: 'Selamat Malam', icon: Moon, emoji: '' };
  };
  const greeting = getGreeting();

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
        setUserName(profile?.full_name || user.email || 'Petugas');
      }

      const today = new Date().toISOString().split('T')[0];
      const [
        { count: pasienHariIni },
        { count: antrianAktif },
        { count: selesaiDiperiksa },
      ] = await Promise.all([
        supabase.from('queues').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('queues').select('*', { count: 'exact', head: true }).in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa']),
        supabase.from('queues').select('*', { count: 'exact', head: true }).eq('status', 'selesai').gte('created_at', today),
      ]);

      setStats({ pasienHariIni: pasienHariIni || 0, antrianAktif: antrianAktif || 0, selesaiDiperiksa: selesaiDiperiksa || 0 });

      const { data: queues } = await supabase
        .from('queues')
        .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name)')
        .gte('created_at', today)
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

      const grouped: Record<string, any[]> = {};
      enrichedQueues.forEach((q: any) => {
        const poliName = q.poli?.name || 'Tidak Diketahui';
        if (!grouped[poliName]) grouped[poliName] = [];
        grouped[poliName].push(q);
      });
      setQueueByPoli(grouped);

      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, initial)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      const doctorUserIds = schedules?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      const uniqueDoctorIds = [...new Set(doctorUserIds)];
      let scheduleProfileMap: Record<string, string> = {};
      if (uniqueDoctorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueDoctorIds);
        profiles?.forEach((p: any) => { scheduleProfileMap[p.user_id] = p.full_name; });
      }

      const enrichedSchedules = schedules?.map((s: any) => ({
        ...s,
        doctor_name: scheduleProfileMap[s.doctor?.user_id] || '-',
        poli_name: s.poli?.name || '-',
        poli_initial: s.poli?.initial || '',
      })) || [];

      setTodaySchedules(enrichedSchedules);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const totalQueues = Object.values(queueByPoli).reduce((sum, q) => sum + q.length, 0);

  const statusConfig: Record<string, { label: string; class: string }> = {
    menunggu: { label: 'Menunggu', class: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
    dipanggil: { label: 'Dipanggil', class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-pulse' },
    sedang_diperiksa: { label: 'Diperiksa', class: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800' },
    selesai: { label: 'Selesai', class: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
    dibatalkan: { label: 'Dibatalkan', class: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 sm:p-8 text-white shadow-xl shadow-teal-900/20">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-400/10 to-teal-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <greeting.icon className="h-4 w-4 text-emerald-300" />
                </div>
                <span className="text-emerald-300 text-sm font-medium">{greeting.text}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{userName}</h1>
              <p className="text-white/60 mt-2 text-sm">Kelola registrasi dan antrian pasien hari ini.</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-2 text-sm text-white/70 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pasien Hari Ini', value: stats.pasienHariIni, icon: Users, gradient: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50' },
          { label: 'Antrian Aktif', value: stats.antrianAktif, icon: Activity, gradient: 'from-amber-500 to-orange-600', bgLight: 'bg-amber-50' },
          { label: 'Selesai Diperiksa', value: stats.selesaiDiperiksa, icon: ClipboardCheck, gradient: 'from-emerald-500 to-teal-600', bgLight: 'bg-emerald-50' },
        ].map((card, i) => (
          <motion.div key={card.label} custom={i + 1} initial="hidden" animate="visible" variants={fadeIn}>
            <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-white dark:bg-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{card.label}</p>
                    {loading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                    )}
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg shadow-slate-200`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/petugas/registration">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 transition-all duration-300 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
              <div className="relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 mb-4 group-hover:scale-110 transition-transform duration-300">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Registrasi Pasien</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftar pasien baru & buat antrian</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 mt-3 group-hover:gap-2 transition-all">
                  Mulai <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </Link>
          <Link href="/petugas/queue">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 transition-all duration-300 hover:shadow-lg hover:border-teal-200 dark:hover:border-teal-800 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
              <div className="relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-200 dark:shadow-teal-900/30 mb-4 group-hover:scale-110 transition-transform duration-300">
                  <ListOrdered className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Kelola Antrian</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Panggil & kelola antrian hari ini</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 mt-3 group-hover:gap-2 transition-all">
                  Buka <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Queue by Poli - Larger */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-3">
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Antrian Hari Ini</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{totalQueues} pasien terdaftar</p>
                  </div>
                </div>
                {totalQueues > 0 && (
                  <Link href="/petugas/queue" className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100">
                    Kelola <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
            <CardContent className="pt-2 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : totalQueues === 0 ? (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-4">
                    <ListOrdered className="h-7 w-7 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada antrian hari ini</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Antrian akan muncul di sini</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(queueByPoli).map(([poliName, queues]) => (
                    <div key={poliName}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" />
                        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{poliName}</h3>
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-2 text-[10px] font-bold text-blue-700">
                          {queues.length}
                        </span>
                      </div>
                      <div className="space-y-2 pl-1">
                        {queues.map((q: any) => (
                          <div key={q.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 p-3.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all duration-200">
                            <div className="flex items-center gap-3.5">
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                                {q.queue_number}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{q.patient?.full_name || '-'}</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">RM: {q.patient?.medical_record_number || '-'}</p>
                              </div>
                            </div>
                            <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${statusConfig[q.status]?.class || ''}`}>
                              {statusConfig[q.status]?.label || q.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Doctor Schedule - Smaller */}
        <motion.div custom={6} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
          <Card className="border-0 shadow-sm h-full bg-white dark:bg-slate-800">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
                  <Stethoscope className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Jadwal Dokter</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Hari ini</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-2 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : todaySchedules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-4">
                    <Calendar className="h-7 w-7 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada jadwal</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hari ini libur</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todaySchedules.slice(0, 6).map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-50/80 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 p-3.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all duration-200">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm shrink-0">
                        {s.doctor_name?.split(' ').pop()?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.doctor_name}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{s.poli_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3 w-3" />
                          {s.start_time?.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {todaySchedules.length > 6 && (
                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                      +{todaySchedules.length - 6} jadwal lainnya
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
