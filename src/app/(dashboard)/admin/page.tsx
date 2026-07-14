'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Stethoscope,
  UserCheck,
  Building2,
  CalendarDays,
  ListOrdered,
  TrendingUp,
  Activity,
  FileText,
  Settings,
  Clock,
  Sun,
  Moon,
  Sunrise,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

interface Stats {
  totalPasien: number;
  totalDokter: number;
  totalPetugas: number;
  totalPoli: number;
  pasienHariIni: number;
  antrianAktif: number;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function AdminDashboard() {
  const supabase = createClient();
  const [userName, setUserName] = React.useState('');
  const [stats, setStats] = React.useState<Stats>({
    totalPasien: 0, totalDokter: 0, totalPetugas: 0, totalPoli: 0, pasienHariIni: 0, antrianAktif: 0,
  });
  const [chartData, setChartData] = React.useState<{ name: string; kunjungan: number }[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return { text: 'Selamat Pagi', icon: Sunrise, emoji: 'Pagi' };
    if (hour < 15) return { text: 'Selamat Siang', icon: Sun, emoji: 'Siang' };
    if (hour < 18) return { text: 'Selamat Sore', icon: Sunrise, emoji: 'Sore' };
    return { text: 'Selamat Malam', icon: Moon, emoji: 'Malam' };
  };

  const greeting = getGreeting();

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
        setUserName(profile?.full_name || user.email || 'Admin');
      }

      const [
        { count: pasien },
        { count: dokter },
        { count: petugas },
        { count: poli },
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('doctors').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'petugas'),
        supabase.from('poli').select('*', { count: 'exact', head: true }),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const { count: pasienHariIni } = await supabase
        .from('queues').select('*', { count: 'exact', head: true }).gte('created_at', today);

      const { count: antrianAktif } = await supabase
        .from('queues').select('*', { count: 'exact', head: true })
        .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa']);

      setStats({
        totalPasien: pasien || 0, totalDokter: dokter || 0, totalPetugas: petugas || 0,
        totalPoli: poli || 0, pasienHariIni: pasienHariIni || 0, antrianAktif: antrianAktif || 0,
      });

      // Chart data - last 7 days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      const chartResults = await Promise.all(
        days.map(async (day) => {
          const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
          const { count } = await supabase
            .from('queues').select('*', { count: 'exact', head: true })
            .gte('created_at', day).lt('created_at', nextDay.toISOString().split('T')[0]);
          return { name: format(new Date(day), 'EEE', { locale: id }), kunjungan: count || 0 };
        })
      );
      setChartData(chartResults);

      // Recent activity
      const { data: recentQueues } = await supabase
        .from('queues')
        .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name)')
        .order('created_at', { ascending: false }).limit(5);

      const patientUserIds = recentQueues?.map((q: any) => q.patient?.user_id).filter(Boolean) || [];
      const uniqueUserIds = [...new Set(patientUserIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }
      const enrichedQueues = recentQueues?.map((q: any) => ({
        ...q,
        patient: q.patient ? { ...q.patient, full_name: profileMap[q.patient.user_id] || '-' } : null,
      })) || [];

      setRecentActivity(enrichedQueues);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const statCards = [
    { label: 'Total Pasien', value: stats.totalPasien, icon: Users, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total Dokter', value: stats.totalDokter, icon: Stethoscope, color: 'from-teal-500 to-emerald-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
    { label: 'Total Petugas', value: stats.totalPetugas, icon: UserCheck, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: 'Total Poli', value: stats.totalPoli, icon: Building2, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Pasien Hari Ini', value: stats.pasienHariIni, icon: CalendarDays, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Antrian Aktif', value: stats.antrianAktif, icon: ListOrdered, color: 'from-rose-500 to-pink-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  const quickActions = [
    { label: 'Kelola User', href: '/admin/users', icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: 'Kelola Dokter', href: '/admin/doctors', icon: Stethoscope, color: 'from-teal-500 to-emerald-600' },
    { label: 'Kelola Poli', href: '/admin/poli', icon: Building2, color: 'from-amber-500 to-orange-600' },
    { label: 'Jadwal Dokter', href: '/admin/schedules', icon: CalendarDays, color: 'from-violet-500 to-purple-600' },
    { label: 'Laporan', href: '/admin/reports', icon: FileText, color: 'from-green-500 to-emerald-600' },
    { label: 'Audit Log', href: '/admin/audit-log', icon: Settings, color: 'from-slate-500 to-slate-600' },
  ];

  const queueStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      menunggu: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700/30',
      dipanggil: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-700/30',
      sedang_diperiksa: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 ring-1 ring-teal-200 dark:ring-teal-700/30',
      selesai: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-700/30',
      dibatalkan: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-700/30',
    };
    return map[status] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="space-y-6 dark:bg-slate-900 min-h-screen">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <LayoutDashboard className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <greeting.icon className="h-4 w-4 text-emerald-300" />
                  <span className="text-emerald-300 text-xs font-medium">{greeting.text}</span>
                </div>
                <h1 className="text-xl font-bold">{userName}</h1>
                <p className="text-white/60 text-xs mt-0.5">Berikut ringkasan aktivitas klinik hari ini</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/50 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-3 border border-slate-100 dark:border-slate-700`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} shadow-sm`}>
                  <card.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-12 rounded-lg" />
              ) : (
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
              )}
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <motion.div custom={6} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 shadow-sm">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kunjungan 7 Hari Terakhir</h3>
              </div>
            </div>
            <div className="px-6 pb-5 pt-0">
              {loading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="kunjungan" fill="url(#tealGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <defs>
                      <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div custom={7} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="h-full rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aksi Cepat</h3>
              </div>
            </div>
            <div className="px-6 pt-2 pb-5">
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href}>
                    <div className="group flex flex-col items-center gap-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3.5 text-center transition-all duration-200 hover:shadow-md hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} shadow-sm group-hover:shadow-md transition-shadow`}>
                        <action.icon className="h-4 w-4 text-white transition-transform group-hover:scale-110" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{action.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div custom={8} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aktivitas Terbaru</h3>
              </div>
              {recentActivity.length > 0 && (
                <Link href="/admin/audit-log" className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors">
                  Lihat semua <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
          <div className="px-6 pt-2 pb-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-3">
                  <ListOrdered className="h-5 w-5 text-slate-400 dark:text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada aktivitas hari ini</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-sm">
                        <ListOrdered className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.patient?.full_name || 'Pasien'} — <span className="text-slate-500 dark:text-slate-400 font-normal">{item.poli?.name || 'Poli'}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            No. {item.queue_number}
                          </p>
                          <span className="text-slate-300 dark:text-slate-600">&middot;</span>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${queueStatusBadge(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
