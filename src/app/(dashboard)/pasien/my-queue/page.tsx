'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, Clock, XCircle, RefreshCw, MapPin } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
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

  // Realtime
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
      .update({ status: 'dibatalkan' })
      .eq('id', currentQueue.id);
    if (error) showToast('Gagal membatalkan antrian', 'error');
    else { showToast('Antrian berhasil dibatalkan'); setCurrentQueue(null); }
    setCancelling(false);
  };

  const statusVariant = (status: string) => {
    const map: Record<string, 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
      menunggu: 'warning', dipanggil: 'info', sedang_diperiksa: 'warning',
    };
    return map[status] || 'secondary';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      menunggu: 'Menunggu', dipanggil: 'Dipanggil!', sedang_diperiksa: 'Sedang Diperiksa',
    };
    return map[status] || status;
  };

  const isDipanggil = currentQueue?.status === 'dipanggil';
  const isDiperiksa = currentQueue?.status === 'sedang_diperiksa';

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Antrian Saya</h1>
          <p className="text-slate-500 mt-1">Status antrian Anda secara real-time.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); fetchQueue(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : !currentQueue ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-600">Tidak ada antrian aktif</p>
              <p className="text-sm text-slate-400 mt-1">Ambil antrian baru untuk memulai.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className={`border-2 ${isDipanggil ? 'border-blue-400 bg-blue-50 animate-pulse' : isDiperiksa ? 'border-teal-400 bg-teal-50' : 'border-amber-200 bg-amber-50'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Status Badge */}
                <Badge variant={statusVariant(currentQueue.status)} className="text-sm px-4 py-1.5 mb-4">
                  <Clock className="h-4 w-4 mr-1.5" />
                  {statusLabel(currentQueue.status)}
                </Badge>

                {/* Queue Number */}
                <div className={`flex h-28 w-28 items-center justify-center rounded-3xl shadow-lg mb-4 ${
                  isDipanggil ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                  isDiperiksa ? 'bg-gradient-to-br from-teal-500 to-emerald-600' :
                  'bg-gradient-to-br from-amber-500 to-orange-600'
                }`}>
                  <span className="text-5xl font-bold text-white">{currentQueue.queue_number}</span>
                </div>

                {isDipanggil && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-4 text-blue-700 font-bold text-lg"
                  >
                    Silakan menuju ruang periksa!
                  </motion.div>
                )}

                {/* Info */}
                <div className="space-y-2 w-full max-w-sm">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Poli</span>
                    <span className="font-medium text-slate-900">{currentQueue.poli?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Waktu Ambil</span>
                    <span className="font-medium text-slate-900">
                      {format(new Date(currentQueue.created_at), 'HH:mm', { locale: id })}
                    </span>
                  </div>
                  {currentQueue.complaint && (
                    <div className="text-left mt-2">
                      <p className="text-xs text-slate-500">Keluhan</p>
                      <p className="text-sm text-slate-700">{currentQueue.complaint}</p>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {currentQueue.status === 'menunggu' && (
                  <Button
                    variant="destructive"
                    onClick={cancelQueue}
                    disabled={cancelling}
                    className="mt-6 gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {cancelling ? 'Membatalkan...' : 'Batalkan Antrian'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
