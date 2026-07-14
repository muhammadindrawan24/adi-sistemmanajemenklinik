'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, User, Activity, Save, History, ArrowRight, AlertCircle, CheckCircle, Stethoscope, Clock, ChevronDown, ChevronUp } from 'lucide-react';
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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExamForm>();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
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

      const { data: schedules } = await supabase.from('doctor_schedules').select('poli_id').eq('doctor_id', doctor.id);
      const poliIds = schedules?.map((s: any) => s.poli_id) || [];

      const { data: queue } = await supabase
        .from('queues')
        .select('*, patient:patients(*, user_id), poli:poli(name)')
        .in('poli_id', poliIds)
        .in('status', ['dipanggil', 'sedang_diperiksa'])
        .order('created_at')
        .limit(1)
        .single();

      if (queue) {
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

      const { error: queueError } = await supabase
        .from('queues')
        .update({ status: 'selesai' })
        .eq('id', currentQueue.id);

      if (queueError) throw queueError;

      showToast('Pemeriksaan berhasil disimpan!');
      reset();
      setCurrentQueue(null);

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

  const calculateAge = (dob: string | null) => {
    if (!dob) return '-';
    return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} tahun`;
  };

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
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pemeriksaan Pasien</h1>
              <p className="text-white/60 text-xs mt-0.5">Formulir pemeriksaan dan pencatatan medis</p>
            </div>
          </div>
        </div>
      </motion.div>

      {!currentQueue ? (
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
              <Activity className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-600">Tidak ada pasien yang sedang diperiksa</p>
            <p className="text-sm text-slate-400 mt-1">Panggil pasien berikutnya dari dashboard.</p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Info */}
          <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Data Pasien</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Informasi pasien yang diperiksa</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-200">
                    {currentQueue.patient?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{currentQueue.patient?.full_name}</p>
                    <p className="text-sm text-slate-500">RM: {currentQueue.patient?.medical_record_number}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'NIK', value: currentQueue.patient?.nik || '-' },
                    { label: 'Telepon', value: currentQueue.patient?.phone || '-' },
                    { label: 'Usia', value: calculateAge(currentQueue.patient?.birth_date) },
                    { label: 'Jenis Kelamin', value: currentQueue.patient?.gender === 'laki_laki' ? 'Laki-laki' : currentQueue.patient?.gender === 'perempuan' ? 'Perempuan' : '-' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-medium text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                    <Clock className="h-3 w-3" />
                    Antrian #{currentQueue.queue_number}
                  </span>
                </div>

                <button
                  onClick={loadHistory}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200"
                >
                  <History className="h-4 w-4" />
                  Lihat Riwayat
                </button>
              </div>
            </div>

            {/* History */}
            <AnimatePresence>
              {showHistory && patientHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-slate-500" />
                        <h4 className="text-sm font-bold text-slate-900">Riwayat Pemeriksaan</h4>
                      </div>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-5 space-y-2">
                    {patientHistory.map((h) => (
                      <div key={h.id} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/50 transition-all">
                        <p className="text-xs font-semibold text-slate-700">{format(new Date(h.created_at), 'dd MMM yyyy', { locale: id })}</p>
                        <p className="text-[11px] text-slate-500 mt-1">Diagnosa: {h.diagnosis || '-'}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Examination Form */}
          <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c3b33] to-[#0f4a3f] shadow-md">
                    <ClipboardCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Formulir Pemeriksaan</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Isi data pemeriksaan pasien</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Keluhan Utama */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Keluhan Utama <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      {...register('symptoms', { required: 'Keluhan wajib diisi' })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none min-h-[80px]"
                      placeholder="Deskripsikan keluhan pasien..."
                    />
                    {errors.symptoms && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.symptoms.message}</p>}
                  </div>

                  {/* Vital Signs */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5" /> Tanda Vital
                    </label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tekanan Darah</label>
                        <input
                          {...register('blood_pressure')}
                          placeholder="120/80"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Berat (kg)</label>
                        <input
                          {...register('weight')}
                          type="number"
                          step="0.1"
                          placeholder="65"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tinggi (cm)</label>
                        <input
                          {...register('height')}
                          type="number"
                          step="0.1"
                          placeholder="170"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Suhu (°C)</label>
                        <input
                          {...register('temperature')}
                          type="number"
                          step="0.1"
                          placeholder="36.5"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagnosa */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardCheck className="h-3.5 w-3.5" /> Diagnosa
                    </label>
                    <textarea
                      {...register('diagnosis')}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none min-h-[60px]"
                      placeholder="Diagnosa medis..."
                    />
                  </div>

                  {/* Tindakan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" /> Tindakan / Perawatan
                    </label>
                    <textarea
                      {...register('treatment')}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none min-h-[60px]"
                      placeholder="Tindakan yang dilakukan..."
                    />
                  </div>

                  {/* Resep */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Resep Obat
                    </label>
                    <textarea
                      {...register('prescription')}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none min-h-[60px]"
                      placeholder="Obat yang diresepkan..."
                    />
                  </div>

                  {/* Catatan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Dokter</label>
                    <input
                      {...register('notes')}
                      placeholder="Catatan tambahan (opsional)"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => reset()}
                      className="px-4 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] hover:from-[#0a2e28] hover:via-[#0c3b33] hover:to-[#0f4a3f] text-white text-sm font-semibold rounded-xl shadow-lg shadow-teal-900/20 transition-all duration-200 disabled:opacity-60"
                    >
                      {saving ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Menyimpan...
                        </div>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Simpan Pemeriksaan
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
