'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Hash,
  ListOrdered,
  Activity,
  History,
  ClipboardCheck,
  Clock,
  ArrowRight,
  Stethoscope,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function PasienDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = React.useState<any>(null);
  const [stats, setStats] = React.useState({ totalKunjungan: 0, antrianAktif: 0 });
  const [currentQueue, setCurrentQueue] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', session.user.id)
        .single();

      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (patient) {
        setProfile({
          ...patient,
          name: profileData?.full_name || 'Pasien',
          phone: profileData?.phone,
          rm_number: patient.medical_record_number,
        });

        const [{ count: totalKunjungan }, { count: antrianAktif }] = await Promise.all([
          supabase.from('queues').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id).eq('status', 'selesai'),
          supabase.from('queues').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id).in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa']),
        ]);

        setStats({ totalKunjungan: totalKunjungan || 0, antrianAktif: antrianAktif || 0 });

        const { data: activeQueue } = await supabase
          .from('queues')
          .select('*, poli:poli(name)')
          .eq('patient_id', patient.id)
          .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setCurrentQueue(activeQueue);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const statusConfig: Record<string, { label: string; class: string }> = {
    menunggu: { label: 'Menunggu', class: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30' },
    dipanggil: { label: 'Dipanggil!', class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30 animate-pulse' },
    sedang_diperiksa: { label: 'Diperiksa', class: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/30' },
    selesai: { label: 'Selesai', class: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/30' },
    dibatalkan: { label: 'Dibatalkan', class: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/30' },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-white/60 text-xs font-medium">Selamat datang,</p>
                  {loading ? (
                    <Skeleton className="h-6 w-40 bg-white/20 mt-1" />
                  ) : (
                    <h1 className="text-xl font-bold">{profile?.name || 'Pasien'}</h1>
                  )}
                  <p className="text-white/50 text-xs mt-0.5 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> {profile?.rm_number || '-'}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-white/70">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="border-0 shadow-sm dark:bg-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                  <History className="h-5 w-5 text-white" />
                </div>
                <div>
                  {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalKunjungan}</p>}
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kunjungan</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="border-0 shadow-sm dark:bg-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-200">
                  <ListOrdered className="h-5 w-5 text-white" />
                </div>
                <div>
                  {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.antrianAktif}</p>}
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Antrian Aktif</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Current Queue Status */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800">
          <CardContent className="p-0">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : !currentQueue ? (
              <div className="text-center py-8 px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-3">
                  <ListOrdered className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Tidak ada antrian aktif</p>
                <Link href="/pasien/take-queue">
                  <Button className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-200">
                    <ListOrdered className="h-4 w-4" /> Ambil Antrian Sekarang
                  </Button>
                </Link>
              </div>
            ) : (
              <div className={`p-5 ${
                currentQueue.status === 'dipanggil' ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20' :
                currentQueue.status === 'sedang_diperiksa' ? 'bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/20' :
                'bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-900/30 dark:to-orange-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ${
                      currentQueue.status === 'dipanggil' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                      currentQueue.status === 'sedang_diperiksa' ? 'bg-gradient-to-br from-teal-500 to-emerald-600' :
                      'bg-gradient-to-br from-amber-500 to-orange-600'
                    }`}>
                      <span className="text-xl font-bold text-white">{currentQueue.queue_number}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Antrian Anda</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{currentQueue.poli?.name || '-'}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {format(new Date(currentQueue.created_at), 'dd MMM, HH:mm', { locale: id })}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${statusConfig[currentQueue.status]?.class || ''}`}>
                    {statusConfig[currentQueue.status]?.label || currentQueue.status}
                  </span>
                </div>
                {currentQueue.status === 'dipanggil' && (
                  <p className="mt-3 text-sm font-bold text-blue-700 dark:text-blue-400 text-center">Silakan menuju ruang periksa!</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/pasien/take-queue', label: 'Ambil Antrian', icon: ListOrdered, gradient: 'from-blue-500 to-indigo-600' },
            { href: '/pasien/my-queue', label: 'Cek Antrian', icon: Clock, gradient: 'from-amber-500 to-orange-600' },
            { href: '/pasien/history', label: 'Riwayat', icon: ClipboardCheck, gradient: 'from-emerald-500 to-teal-600' },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all duration-300 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-md`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{action.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
