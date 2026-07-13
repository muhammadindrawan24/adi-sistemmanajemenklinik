'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ListOrdered, Phone, XCircle, RefreshCw, Clock, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function QueueManagement() {
  const supabase = createClient();
  const [queues, setQueues] = React.useState<any[]>([]);
  const [poliFilter, setPoliFilter] = React.useState('semua');
  const [poliList, setPoliList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  const fetchQueues = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('queues')
      .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name), doctor_schedule:doctor_schedules(id, doctor:doctors(id, user_id, specialty))')
      .gte('created_at', today)
      .neq('status', 'dibatalkan')
      .order('queue_number');

    // Fetch profile names for patients and doctors
    const allUserIds = new Set<string>();
    data?.forEach((q: any) => {
      if (q.patient?.user_id) allUserIds.add(q.patient.user_id);
      if (q.doctor_schedule?.doctor?.user_id) allUserIds.add(q.doctor_schedule.doctor.user_id);
    });
    let profileMap: Record<string, string> = {};
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', [...allUserIds]);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

    const enriched = data?.map((q: any) => ({
      ...q,
      patient: q.patient ? { ...q.patient, full_name: profileMap[q.patient.user_id] || '-' } : null,
      doctor_name: q.doctor_schedule?.doctor ? profileMap[q.doctor_schedule.doctor.user_id] || '-' : '-',
    })) || [];

    setQueues(enriched);

    const { data: poliData } = await supabase.from('poli').select('*').order('name');
    setPoliList(poliData || []);
    setLoading(false);
  };

  React.useEffect(() => { fetchQueues(); }, []);

  // Realtime subscription
  React.useEffect(() => {
    const channel = supabase
      .channel('queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        fetchQueues();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const callNext = async (queueId: string) => {
    const { error } = await supabase
      .from('queues')
      .update({ status: 'dipanggil', called_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) showToast('Gagal memanggil antrian', 'error');
    else { showToast('Pasien dipanggil!'); fetchQueues(); }
  };

  const cancelQueue = async (queueId: string) => {
    const { error } = await supabase
      .from('queues')
      .update({ status: 'dibatalkan' })
      .eq('id', queueId);
    if (error) showToast('Gagal membatalkan antrian', 'error');
    else { showToast('Antrian dibatalkan'); fetchQueues(); }
  };

  const filtered = poliFilter === 'semua' ? queues : queues.filter((q) => q.poli?.name === poliFilter);

  // Group by poli
  const grouped: Record<string, any[]> = {};
  filtered.forEach((q) => {
    const poliName = q.poli?.name || 'Tidak Diketahui';
    if (!grouped[poliName]) grouped[poliName] = [];
    grouped[poliName].push(q);
  });

  const statusVariant = (status: string) => {
    const map: Record<string, 'warning' | 'info' | 'default' | 'success' | 'destructive' | 'secondary'> = {
      menunggu: 'warning', dipanggil: 'info', sedang_diperiksa: 'default', selesai: 'success', dibatalkan: 'destructive',
    };
    return map[status] || 'secondary';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      menunggu: 'Menunggu', dipanggil: 'Dipanggil', sedang_diperiksa: 'Sedang Diperiksa', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Antrian</h1>
          <p className="text-slate-500 mt-1">Antrian pasien hari ini.</p>
        </div>
        <Button onClick={() => fetchQueues()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </motion.div>

      {/* Poli Filter */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Filter Poli:</span>
          <Select value={poliFilter} onChange={(e) => setPoliFilter(e.target.value)} className="w-48">
            <option value="semua">Semua Poli</option>
            {poliList.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </Select>
        </div>
      </motion.div>

      {/* Queue Groups */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-400">Belum ada antrian hari ini</CardContent></Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([poliName, items]) => (
              <Card key={poliName}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-teal-500" />
                    {poliName}
                    <Badge variant="secondary">{items.length} antrian</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {items.map((q) => (
                      <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                            q.status === 'dipanggil' ? 'bg-blue-500 text-white animate-pulse' :
                            q.status === 'sedang_diperiksa' ? 'bg-teal-500 text-white' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {q.queue_number}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{q.patient?.full_name || '-'}</p>
                            <p className="text-xs text-slate-500">RM: {q.patient?.medical_record_number || '-'} &middot; {format(new Date(q.created_at), 'HH:mm', { locale: id })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(q.status)}>
                            <Clock className="h-3 w-3 mr-1" />
                            {statusLabel(q.status)}
                          </Badge>
                          {q.status === 'menunggu' && (
                            <Button size="sm" onClick={() => callNext(q.id)} className="gap-1">
                              <Phone className="h-3 w-3" /> Panggil
                            </Button>
                          )}
                          {(q.status === 'menunggu' || q.status === 'dipanggil') && (
                            <Button size="sm" variant="destructive" onClick={() => cancelQueue(q.id)} className="gap-1">
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
