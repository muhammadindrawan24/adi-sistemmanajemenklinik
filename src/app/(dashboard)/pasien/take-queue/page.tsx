'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ListOrdered, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';

interface QueueForm { poli_id: string; complaint: string; }

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function TakeQueuePage() {
  const supabase = createClient();
  const [poli, setPoli] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ queueNumber: number; position: number; poliName: string } | null>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { register, handleSubmit, formState: { errors }, watch } = useForm<QueueForm>();
  const selectedPoli = watch('poli_id');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchPoli = async () => {
      const { data } = await supabase.from('poli').select('*').order('name');
      setPoli(data || []);
      setLoading(false);
    };
    fetchPoli();
  }, [supabase]);

  const onSubmit = async (data: QueueForm) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Silakan login terlebih dahulu');

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!patient) throw new Error('Data pasien tidak ditemukan');

      // Check if already has active queue
      const { data: activeQueue } = await supabase
        .from('queues')
        .select('id')
        .eq('patient_id', patient.id)
        .in('status', ['menunggu', 'dipanggil', 'sedang_diperiksa'])
        .limit(1);

      if (activeQueue && activeQueue.length > 0) {
        throw new Error('Anda sudah memiliki antrian aktif');
      }

      // Get poli initial for queue number
      const selectedPoli = poli.find((p) => p.id === data.poli_id);
      if (!selectedPoli) throw new Error('Poli tidak ditemukan');

      // Get today's queue count for this poli
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('poli_id', data.poli_id)
        .gte('created_at', today);

      const queueNum = (count || 0) + 1;
      const queueNumber = `${selectedPoli.initial}${String(queueNum).padStart(3, '0')}`;

      // Find doctor schedule for this poli today
      const dayOfWeek = (new Date().getDay() + 6) % 7; // Convert: JS 0=Sun -> DB 6=Minggu
      const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('id')
        .eq('poli_id', data.poli_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!schedule) throw new Error('Tidak ada jadwal dokter untuk poli ini hari ini');

      // Create queue
      const { error } = await supabase.from('queues').insert({
        patient_id: patient.id,
        poli_id: data.poli_id,
        doctor_schedule_id: schedule.id,
        queue_number: queueNumber,
        status: 'menunggu',
      });

      if (error) throw error;

      const poliName = poli.find((p) => p.id === data.poli_id)?.name || '-';
      setResult({ queueNumber: queueNum, position: queueNum, poliName });
      showToast('Antrian berhasil diambil!');
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900">Ambil Antrian</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Antrian Berhasil!</h2>
              <p className="text-slate-500 mb-6">Anda telah terdaftar dalam antrian.</p>
              <div className="inline-flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
                <p className="text-sm text-slate-500">Nomor Antrian Anda</p>
                <p className="text-6xl font-bold text-teal-600 my-2">{result.queueNumber}</p>
                <p className="text-sm text-slate-600">{result.poliName}</p>
              </div>
              <div className="mt-6">
                <Button onClick={() => setResult(null)} className="gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Ambil Antrian Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Ambil Antrian</h1>
        <p className="text-slate-500 mt-1">Pilih poli dan ambil nomor antrian.</p>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-teal-600" />
              Ambil Antrian Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Pilih Poli</label>
                {loading ? (
                  <Skeleton className="mt-1 h-10 w-full" />
                ) : (
                  <Select {...register('poli_id', { required: 'Poli wajib dipilih' })} className="mt-1">
                    <option value="">Pilih Poli</option>
                    {poli.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} - {p.description || 'Pemeriksaan umum'}</option>
                    ))}
                  </Select>
                )}
                {errors.poli_id && <p className="text-xs text-red-500 mt-1">{errors.poli_id.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Keluhan Singkat</label>
                <textarea
                  {...register('complaint')}
                  className="mt-1 flex w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[80px]"
                  placeholder="Deskripsikan keluhan Anda secara singkat..."
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full gap-2" size="lg">
                <Send className="h-4 w-4" />
                {saving ? 'Mengambil Antrian...' : 'Ambil Antrian'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
