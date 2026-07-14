'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Volume2, Clock, Users, ChevronRight, Maximize, Minimize, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function WaitingRoomMonitor() {
  const supabase = createClient();
  const [currentCall, setCurrentCall] = React.useState<any>(null);
  const [waitingQueues, setWaitingQueues] = React.useState<any[]>([]);
  const [poliList, setPoliList] = React.useState<any[]>([]);
  const [activePoli, setActivePoli] = React.useState<string>('semua');
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [announcement, setAnnouncement] = React.useState('Selamat datang di KlinikSehat! Silakan tunggu nomor antrian Anda dipanggil.');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Clock
  React.useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  const fetchQueues = React.useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];

    // Get poli
    const { data: poliData } = await supabase.from('poli').select('*').order('name');
    setPoliList(poliData || []);

    // Get currently being called or examined
    const { data: calledQueues } = await supabase
      .from('queues')
      .select('*, poli:poli(name, initial)')
      .in('status', ['dipanggil', 'sedang_diperiksa'])
      .gte('created_at', today)
      .order('called_at', { ascending: false });

    // Get waiting queues
    let query = supabase
      .from('queues')
      .select('*, poli:poli(name, initial)')
      .eq('status', 'menunggu')
      .gte('created_at', today)
      .order('queue_number');

    if (activePoli !== 'semua') {
      query = query.eq('poli_id', activePoli);
    }

    const { data: waiting } = await query.limit(5);

    // Collect all patient_ids from both queries
    const allQueues = [...(calledQueues || []), ...(waiting || [])];
    const patientIds = [...new Set(allQueues.map(q => q.patient_id).filter(Boolean))];

    // Fetch patient names from profiles
    const patientNames: Record<string, string> = {};
    if (patientIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('patients')
        .select('id, user_id')
        .in('id', patientIds);

      const userIds = (profilesData || []).map(p => p.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        // Map patient_id → full_name
        const userIdToName: Record<string, string> = {};
        (profiles || []).forEach(p => {
          userIdToName[p.user_id] = p.full_name;
        });
        (profilesData || []).forEach(p => {
          if (userIdToName[p.user_id]) {
            patientNames[p.id] = userIdToName[p.user_id];
          }
        });
      }
    }

    // Get latest called
    const latestCalled = calledQueues?.[0] || null;
    if (latestCalled) {
      latestCalled.patient_name = patientNames[latestCalled.patient_id] || '-';
    }
    setCurrentCall(latestCalled);

    // Attach patient names to waiting queues
    const waitingWithNames = (waiting || []).map(q => ({
      ...q,
      patient_name: patientNames[q.patient_id] || '-',
    }));
    setWaitingQueues(waitingWithNames);
  }, [supabase, activePoli]);

  React.useEffect(() => { fetchQueues(); }, [fetchQueues]);

  // Realtime
  React.useEffect(() => {
    const channel = supabase
      .channel('monitor-queues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        fetchQueues();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchQueues]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for ESC key to exit fullscreen
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Running text announcements
  const announcements = [
    'Selamat datang di KlinikSehat! Silakan tunggu nomor antrian Anda dipanggil.',
    'Untuk kenyamanan bersama, mohon menjaga kebersihan klinik.',
    'Gunakan masker jika Anda sedang tidak enak badan.',
    'Terima kasih telah mempercayakan kesehatan Anda kepada kami.',
  ];

  const [announceIdx, setAnnounceIdx] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setAnnounceIdx((prev) => (prev + 1) % announcements.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            title="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600">
            <Monitor className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">KlinikSehat</h1>
            <p className="text-xs text-slate-400">Monitor Antrian</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-3xl font-bold font-mono">{format(currentTime, 'HH:mm:ss')}</p>
            <p className="text-sm text-slate-400">{format(currentTime, 'EEEE, dd MMMM yyyy', { locale: id })}</p>
          </div>
          <button
            onClick={toggleFullscreen}
            className="rounded-xl p-3 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Poli Tabs */}
      <div className="flex gap-2 px-8 py-4 overflow-x-auto">
        <button
          onClick={() => setActivePoli('semua')}
          className={`whitespace-nowrap rounded-xl px-5 py-2 text-sm font-medium transition-all ${
            activePoli === 'semua' ? 'bg-teal-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
          }`}
        >
          Semua Poli
        </button>
        {poliList.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePoli(p.id)}
            className={`whitespace-nowrap rounded-xl px-5 py-2 text-sm font-medium transition-all ${
              activePoli === p.id ? 'bg-teal-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 px-8 py-6">
        {/* Current Call - Big Display */}
        <div className="flex-1">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-slate-400 uppercase tracking-widest mb-2">Nomor Antrian Dipanggil</p>
            <AnimatePresence mode="wait">
              {currentCall ? (
                <motion.div
                  key={currentCall.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <div className="flex items-center justify-center gap-6 my-6">
                    <div className="flex h-36 w-36 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-2xl shadow-teal-500/30">
                      <span className="text-7xl font-bold text-white">{currentCall.queue_number}</span>
                    </div>
                    <ChevronRight className="h-12 w-12 text-teal-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-white">{currentCall.poli?.name || '-'}</p>
                    <p className="text-lg text-slate-300">{currentCall.patient_name || '-'}</p>
                    <p className="text-sm text-slate-400">
                      {currentCall.status === 'sedang_diperiksa' ? 'Sedang diperiksa' : 'Silakan menuju ruang periksa'}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex h-36 w-36 items-center justify-center rounded-3xl bg-white/10 mx-auto my-6">
                    <Users className="h-16 w-16 text-slate-500" />
                  </div>
                  <p className="text-xl text-slate-400">Menunggu antrian...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Waiting Queue List */}
        <div className="w-full lg:w-96">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-400" />
              Antrian Berikutnya
            </h2>
            <div className="space-y-2">
              {waitingQueues.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Tidak ada antrian menunggu</p>
              ) : (
                waitingQueues.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-teal-400">
                        {q.queue_number}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{q.patient_name || '-'}</p>
                        <p className="text-xs text-slate-400">{q.poli?.name || '-'}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Running Text */}
      <div className="fixed bottom-0 left-0 right-0 bg-teal-600/90 backdrop-blur-sm px-4 py-2 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee">
          <span className="inline-block text-sm font-medium text-white px-8">
            {announcements[announceIdx]}
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
