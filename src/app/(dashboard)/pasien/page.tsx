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
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

export default function PasienDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = React.useState<any>(null);
  const [stats, setStats] = React.useState({ totalKunjungan: 0, antrianAktif: 0 });
  const [currentQueue, setCurrentQueue] = React.useState<any>(null);
  const [todaySchedules, setTodaySchedules] = React.useState<any[]>([]);
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

      // Fetch today's schedules
      const dayOfWeek = (new Date().getDay() + 6) % 7;
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*, doctor:doctors(id, user_id, specialty), poli:poli(name, initial)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      const doctorUserIds = schedules?.map((s: any) => s.doctor?.user_id).filter(Boolean) || [];
      const uniqueIds = [...new Set(doctorUserIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enriched = schedules?.map((s: any) => ({
        ...s,
        doctor_name: profileMap[s.doctor?.user_id] || '-',
        poli_name: s.poli?.name || '-',
        poli_initial: s.poli?.initial || '',
      })) || [];

      setTodaySchedules(enriched);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    menunggu: { label: 'Menunggu', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
    dipanggil: { label: 'Dipanggil!', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400 animate-pulse' },
    sedang_diperiksa: { label: 'Diperiksa', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-400' },
  };

  // Group schedules by poli
  const schedulesByPoli: Record<string, any[]> = {};
  todaySchedules.forEach((s) => {
    if (!schedulesByPoli[s.poli_name]) schedulesByPoli[s.poli_name] = [];
    schedulesByPoli[s.poli_name].push(s);
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-400/10 to-emerald-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-white/60 text-xs font-medium">Selamat datang di KlinikSehat,</p>
                  {loading ? (
                    <div className="h-6 w-40 bg-white/20 rounded animate-pulse mt-1" />
                  ) : (
                    <h1 className="text-xl font-bold">{profile?.name || 'Pasien'}</h1>
                  )}
                  <p className="text-white/50 text-[11px] mt-1">Semoga hari Anda menyenangkan dan sehat selalu</p>
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
      <div className="grid grid-cols-2 gap-3">
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                {loading ? <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" /> : <p className="text-2xl font-bold text-slate-900">{stats.totalKunjungan}</p>}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kunjungan</p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-200">
                <ListOrdered className="h-5 w-5 text-white" />
              </div>
              <div>
                {loading ? <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" /> : <p className="text-2xl font-bold text-slate-900">{stats.antrianAktif}</p>}
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Antrian Aktif</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Current Queue Status */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6">
              <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : !currentQueue ? (
            <div className="text-center py-8 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-3">
                <ListOrdered className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-3">Tidak ada antrian aktif</p>
              <Link href="/pasien/take-queue">
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] hover:from-[#0a2e28] hover:to-[#0c3b33] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 transition-all mx-auto">
                  <ListOrdered className="h-4 w-4" /> Ambil Antrian Sekarang
                </button>
              </Link>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold shadow-lg ${
                    currentQueue.status === 'dipanggil' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200 animate-pulse' :
                    currentQueue.status === 'sedang_diperiksa' ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-200' :
                    'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-200'
                  }`}>
                    {currentQueue.queue_number}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Antrian Anda</p>
                    <p className="text-lg font-bold text-slate-900">{currentQueue.poli?.name || '-'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(currentQueue.created_at), 'dd MMM, HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${statusConfig[currentQueue.status]?.bg || ''} ${statusConfig[currentQueue.status]?.text || ''}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[currentQueue.status]?.dot || ''}`} />
                  {statusConfig[currentQueue.status]?.label || currentQueue.status}
                </span>
              </div>
              {currentQueue.status === 'dipanggil' && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-sm font-bold text-blue-700">Silakan menuju ruang periksa!</p>
                </div>
              )}
            </div>
          )}
        </div>
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
              <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5">
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

      {/* Jadwal Dokter Hari Ini */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Jadwal Dokter Hari Ini</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{todaySchedules.length} dokter aktif</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : todaySchedules.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tidak ada jadwal dokter hari ini</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(schedulesByPoli).map(([poliName, schedules]) => (
                  <div key={poliName} className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[9px] font-bold text-white shadow-sm">
                        {schedules[0]?.poli_initial}
                      </span>
                      <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{poliName}</h4>
                    </div>
                    <div className="space-y-1.5">
                      {schedules.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-700 truncate max-w-[100px]">{s.doctor_name}</span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="h-2 w-2" />
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
        </div>
      </motion.div>
    </div>
  );
}
