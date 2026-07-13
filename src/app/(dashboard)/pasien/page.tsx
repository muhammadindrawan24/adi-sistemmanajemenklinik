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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
    transition: { delay: i * 0.05, duration: 0.3 },
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

      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (patient) {
        setProfile(patient);

        const [{ count: totalKunjungan }, { count: antrianAktif }] = await Promise.all([
          supabase.from('queues').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id).eq('status', 'selesai'),
          supabase.from('queues').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id).in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa']),
        ]);

        setStats({ totalKunjungan: totalKunjungan || 0, antrianAktif: antrianAktif || 0 });

        // Current active queue
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

  const statusVariant = (status: string) => {
    const map: Record<string, 'warning' | 'info' | 'default' | 'success' | 'destructive' | 'secondary'> = {
      menunggu: 'warning',
      dipanggil: 'info',
      sedang_diperiksa: 'default',
      selesai: 'success',
      dibatalkan: 'destructive',
    };
    return map[status] || 'secondary';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      menunggu: 'Menunggu',
      dipanggil: 'Dipanggil',
      sedang_diperiksa: 'Sedang Diperiksa',
      selesai: 'Selesai',
      dibatalkan: 'Dibatalkan',
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Pasien</h1>
        <p className="text-slate-500 mt-1">Selamat datang! Kelola antrian dan lihat riwayat Anda.</p>
      </motion.div>

      {/* Profile Summary */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0">
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-40 bg-white/20" />
                <Skeleton className="h-4 w-60 bg-white/20" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{profile?.name || 'Pasien'}</h2>
                  <p className="text-teal-100 flex items-center gap-1.5 mt-0.5">
                    <Hash className="h-3.5 w-3.5" />
                    {profile?.rm_number || '-'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Kunjungan</p>
                  {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalKunjungan}</p>}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <History className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Antrian Aktif</p>
                  {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-3xl font-bold text-slate-900 mt-1">{stats.antrianAktif}</p>}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                  <ListOrdered className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Current Queue Status */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-600" />
              Status Antrian Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : !currentQueue ? (
              <div className="text-center py-6">
                <p className="text-slate-400 mb-3">Tidak ada antrian aktif</p>
                <Link href="/pasien/take-queue">
                  <Button className="gap-2">
                    <ListOrdered className="h-4 w-4" />
                    Ambil Antrian Sekarang
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
                      <span className="text-2xl font-bold text-white">{currentQueue.queue_number}</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Antrian Anda</p>
                      <p className="text-lg font-bold text-slate-900">{currentQueue.poli?.name || '-'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(currentQueue.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(currentQueue.status)} className="text-sm px-3 py-1">
                    {statusLabel(currentQueue.status)}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex flex-wrap gap-3">
          <Link href="/pasien/take-queue">
            <Button className="gap-2">
              <ListOrdered className="h-4 w-4" />
              Ambil Antrian
            </Button>
          </Link>
          <Link href="/pasien/my-queue">
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              Cek Antrian
            </Button>
          </Link>
          <Link href="/pasien/history">
            <Button variant="outline" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Riwayat Pemeriksaan
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
