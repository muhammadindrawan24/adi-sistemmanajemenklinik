'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, User, Activity, Save, History, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';

interface ExamForm {
  symptoms: string;
  blood_pressure: string;
  weight: string;
  height: string;
  temperature: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  notes: string;
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function ExaminationPage() {
  const supabase = createClient();
  const [currentQueue, setCurrentQueue] = React.useState<any>(null);
  const [doctorId, setDoctorId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [patientHistory, setPatientHistory] = React.useState<any[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<ExamForm>();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, user_id')
        .eq('user_id', session.user.id)
        .single();

      if (!doctor) return;
      setDoctorId(doctor.id);

      // Get doctor's poli_ids from schedules
      const { data: schedules } = await supabase.from('doctor_schedules').select('poli_id').eq('doctor_id', doctor.id);
      const poliIds = schedules?.map((s: any) => s.poli_id) || [];

      // Get current queue (being called or under examination) for this doctor's poli
      const { data: queue } = await supabase
        .from('queues')
        .select('*, patient:patients(*, user_id), poli:poli(name)')
        .in('poli_id', poliIds)
        .in('status', ['dipanggil', 'sedang_diperiksa'])
        .order('created_at')
        .limit(1)
        .single();

      if (queue) {
        // Fetch patient profile
        let patientName = '-';
        let patientPhone = '-';
        if (queue.patient?.user_id) {
          const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('user_id', queue.patient.user_id).single();
          if (profile) {
            patientName = profile.full_name || '-';
            patientPhone = profile.phone || '-';
          }
        }
        const enrichedQueue = {
          ...queue,
          patient: { ...queue.patient, full_name: patientName, phone: patientPhone },
        };
        setCurrentQueue(enrichedQueue);
        // Update status to sedang_diperiksa
        if (queue.status === 'dipanggil') {
          await supabase.from('queues').update({ status: 'sedang_diperiksa' }).eq('id', queue.id);
          setCurrentQueue({ ...enrichedQueue, status: 'sedang_diperiksa' });
        }
      }
    };

    fetchData();
  }, [supabase]);

  const loadHistory = async () => {
    if (!currentQueue?.patient_id) return;
    const { data } = await supabase
      .from('medical_records')
      .select('*')
      .eq('patient_id', currentQueue.patient_id)
      .order('created_at', { ascending: false })
      .limit(5);
    setPatientHistory(data || []);
    setShowHistory(true);
  };

  const onSubmit = async (data: ExamForm) => {
    if (!currentQueue || !doctorId) return;
    setSaving(true);

    try {
      // Create medical record
      const { error: recordError } = await supabase.from('medical_records').insert({
        patient_id: currentQueue.patient_id,
        doctor_id: doctorId,
        queue_id: currentQueue.id,
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        treatment: data.treatment,
        prescription: data.prescription,
        notes: data.notes,
        blood_pressure: data.blood_pressure || null,
        weight: data.weight ? parseFloat(data.weight) : null,
        height: data.height ? parseFloat(data.height) : null,
        temperature: data.temperature ? parseFloat(data.temperature) : null,
        chief_complaint: data.symptoms,
      });

      if (recordError) throw recordError;

      // Update queue status to selesai
      const { error: queueError } = await supabase
        .from('queues')
        .update({ status: 'selesai' })
        .eq('id', currentQueue.id);

      if (queueError) throw queueError;

      showToast('Pemeriksaan berhasil disimpan!');
      reset();
      setCurrentQueue(null);

      // Reload to get next queue
      const { data: schedules } = await supabase.from('doctor_schedules').select('poli_id').eq('doctor_id', doctorId);
      const poliIds = schedules?.map((s: any) => s.poli_id) || [];

      const { data: nextQueue } = await supabase
        .from('queues')
        .select('*, patient:patients(*, user_id), poli:poli(name)')
        .in('poli_id', poliIds)
        .in('status', ['dipanggil', 'sedang_diperiksa'])
        .order('created_at')
        .limit(1)
        .single();

      if (nextQueue) {
        // Fetch patient profile
        let patientName = '-';
        let patientPhone = '-';
        if (nextQueue.patient?.user_id) {
          const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('user_id', nextQueue.patient.user_id).single();
          if (profile) {
            patientName = profile.full_name || '-';
            patientPhone = profile.phone || '-';
          }
        }
        const enrichedNext = { ...nextQueue, patient: { ...nextQueue.patient, full_name: patientName, phone: patientPhone } };
        setCurrentQueue(enrichedNext);
        if (nextQueue.status === 'dipanggil') {
          await supabase.from('queues').update({ status: 'sedang_diperiksa' }).eq('id', nextQueue.id);
          setCurrentQueue({ ...enrichedNext, status: 'sedang_diperiksa' });
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Pemeriksaan Pasien</h1>
        <p className="text-slate-500 mt-1">Formulir pemeriksaan dan pencatatan medis.</p>
      </motion.div>

      {!currentQueue ? (
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-600">Tidak ada pasien yang sedang diperiksa</p>
              <p className="text-sm text-slate-400 mt-1">Panggil pasien berikutnya dari dashboard.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Info */}
          <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Data Pasien
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-xl font-bold text-white">
                      {currentQueue.patient?.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{currentQueue.patient?.full_name}</p>
                      <p className="text-sm text-slate-500">RM: {currentQueue.patient?.medical_record_number}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">NIK</span>
                      <span className="font-medium text-slate-900">{currentQueue.patient?.nik}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Telepon</span>
                      <span className="font-medium text-slate-900">{currentQueue.patient?.phone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Usia</span>
                      <span className="font-medium text-slate-900">
                        {currentQueue.patient?.birth_date
                          ? `${Math.floor((Date.now() - new Date(currentQueue.patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} tahun`
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant="info" className="text-xs">Antrian #{currentQueue.queue_number}</Badge>
                  </div>
                  <Button variant="outline" onClick={loadHistory} className="w-full gap-2 mt-2">
                    <History className="h-4 w-4" />
                    Lihat Riwayat
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* History */}
            {showHistory && patientHistory.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">Riwayat Pemeriksaan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientHistory.map((h) => (
                      <div key={h.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                        <p className="font-medium text-slate-700">{format(new Date(h.created_at), 'dd MMM yyyy', { locale: id })}</p>
                        <p className="text-slate-500">Diagnosa: {h.diagnosis || '-'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Examination Form */}
          <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  Formulir Pemeriksaan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Keluhan Utama</label>
                    <textarea
                      {...register('symptoms', { required: 'Keluhan wajib diisi' })}
                      className="mt-1 flex w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[80px]"
                      placeholder="Deskripsikan keluhan pasien..."
                    />
                    {errors.symptoms && <p className="text-xs text-red-500 mt-1">{errors.symptoms.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Tekanan Darah</label>
                      <Input {...register('blood_pressure')} placeholder="120/80" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Berat (kg)</label>
                      <Input {...register('weight')} type="number" step="0.1" placeholder="65" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Tinggi (cm)</label>
                      <Input {...register('height')} type="number" step="0.1" placeholder="170" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Suhu (°C)</label>
                      <Input {...register('temperature')} type="number" step="0.1" placeholder="36.5" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Diagnosa</label>
                    <textarea
                      {...register('diagnosis')}
                      className="mt-1 flex w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[60px]"
                      placeholder="Diagnosa medis..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Tindakan / Perawatan</label>
                    <textarea
                      {...register('treatment')}
                      className="mt-1 flex w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[60px]"
                      placeholder="Tindakan yang dilakukan..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Resep Obat</label>
                    <textarea
                      {...register('prescription')}
                      className="mt-1 flex w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[60px]"
                      placeholder="Obat yang diresepkan..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Catatan Dokter</label>
                    <Input {...register('notes')} placeholder="Catatan tambahan (opsional)" className="mt-1" />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => reset()}>Reset</Button>
                    <Button type="submit" disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? 'Menyimpan...' : 'Simpan Pemeriksaan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
