'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, XCircle, RefreshCw, MapPin, AlertCircle, CheckCircle, ListOrdered, Stethoscope } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function MyQueuePage() {
  const supabase = createClient();
  const [currentQueue, setCurrentQueue] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
  };

  const fetchQueue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (!patient) { setLoading(false); return; }

    const { data: queue } = await supabase
      .from('queues')
      .select('*, poli:poli(name)')
      .eq('patient_id', patient.id)
      .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setCurrentQueue(queue);
    setLoading(false);
  };

  React.useEffect(() => { fetchQueue(); }, []);

  React.useEffect(() => {
    if (!currentQueue) return;
    const channel = supabase
      .channel('my-queue')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queues', filter: `id=eq.${currentQueue.id}` }, (payload) => {
        setCurrentQueue((prev: any) => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, currentQueue?.id]);

  const cancelQueue = async () => {
    if (!currentQueue) return;
    setCancelling(true);
    const { error } = await supabase
      .from('queues')
      .update({ status: 'dibatalkan', cancelled_at: new Date().toISOString() })
      .eq('id', currentQueue.id);
    if (error) showToast('Gagal membatalkan antrian', 'error');
    else { showToast('Antrian berhasil dibatalkan'); setCurrentQueue(null); }
    setCancelling(false);
  };

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string; gradient: string }> = {
    menunggu: { label: 'Menunggu', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', gradient: 'from-amber-500 to-orange-600' },
    dipanggil: { label: 'Dipanggil!', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400 animate-pulse', gradient: 'from-blue-500 to-indigo-600' },
    sedang_diperiksa: { label: 'Sedang Diperiksa', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-400', gradient: 'from-teal-500 to-emerald-600' },
  };

  const sc = statusConfig[currentQueue?.status] || statusConfig.menunggu;
  const isDipanggil = currentQueue?.status === 'dipanggil';

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-400/10 to-emerald-400/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <ListOrdered className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Antrian Saya</h1>
                <p className="text-white/60 text-xs mt-0.5">Status antrian Anda secara real-time</p>
              </div>
            </div>
            <button
              onClick={() => { setLoading(true); fetchQueue(); }}
              className="hidden sm:flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Refresh */}
      <div className="sm:hidden">
        <button
          onClick={() => { setLoading(true); fetchQueue(); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Queue Status */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
            <div className="flex flex-col items-center">
              <div className="h-28 w-28 bg-slate-100 rounded-3xl animate-pulse mb-4" />
              <div className="h-6 w-32 bg-slate-100 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ) : !currentQueue ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
              <Activity className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-600">Tidak ada antrian aktif</p>
            <p className="text-sm text-slate-400 mt-1">Ambil antrian baru untuk memulai</p>
          </div>
        ) : (
          <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${isDipanggil ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}>
            {/* Status Header */}
            <div className={`p-4 ${isDipanggil ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : currentQueue.status === 'sedang_diperiksa' ? 'bg-gradient-to-r from-teal-50 to-emerald-50' : 'bg-gradient-to-r from-amber-50 to-orange-50'}`}>
              <div className="flex items-center justify-center gap-2">
                <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                <span className={`text-sm font-bold ${sc.text}`}>{sc.label}</span>
              </div>
            </div>

            {/* Queue Number */}
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className={`inline-flex h-28 w-28 items-center justify-center rounded-3xl shadow-xl mb-5 bg-gradient-to-br ${sc.gradient} ${isDipanggil ? 'animate-pulse' : ''}`}
              >
                <span className="text-4xl font-bold text-white">{currentQueue.queue_number}</span>
              </motion.div>

              {isDipanggil && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-100"
                >
                  <p className="text-sm font-bold text-blue-700">Silakan menuju ruang periksa!</p>
                </motion.div>
              )}

              {/* Info Grid */}
              <div className="max-w-sm mx-auto space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">Poli</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{currentQueue.poli?.name || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">Waktu Ambil</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {format(new Date(currentQueue.created_at), 'HH:mm', { locale: id })} WIB
                  </span>
                </div>
                {currentQueue.complaint && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Keluhan</p>
                    <p className="text-sm text-slate-700">{currentQueue.complaint}</p>
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              {currentQueue.status === 'menunggu' && (
                <button
                  onClick={cancelQueue}
                  disabled={cancelling}
                  className="mt-6 flex items-center justify-center gap-2 px-6 py-3 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-all duration-200 disabled:opacity-50 mx-auto"
                >
                  <XCircle className="h-4 w-4" />
                  {cancelling ? 'Membatalkan...' : 'Batalkan Antrian'}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
