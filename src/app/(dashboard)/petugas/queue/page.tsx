'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered, Phone, XCircle, RefreshCw, Clock, Users, AlertCircle, CheckCircle, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedPoli, setExpandedPoli] = React.useState<Record<string, boolean>>({});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
  };

  const fetchQueues = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('queues')
      .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name, initial), doctor_schedule:doctor_schedules(id, doctor:doctors(id, user_id, specialty))')
      .gte('created_at', today)
      .neq('status', 'dibatalkan')
      .order('queue_number');

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

  const startExamination = async (queueId: string) => {
    const { error } = await supabase
      .from('queues')
      .update({ status: 'sedang_diperiksa', examination_started_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) showToast('Gagal memulai pemeriksaan', 'error');
    else { showToast('Pemeriksaan dimulai'); fetchQueues(); }
  };

  const finishExamination = async (queueId: string) => {
    const { error } = await supabase
      .from('queues')
      .update({ status: 'selesai', examination_finished_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) showToast('Gagal menyelesaikan pemeriksaan', 'error');
    else { showToast('Pemeriksaan selesai'); fetchQueues(); }
  };

  const cancelQueue = async (queueId: string) => {
    const { error } = await supabase
      .from('queues')
      .update({ status: 'dibatalkan', cancelled_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) showToast('Gagal membatalkan antrian', 'error');
    else { showToast('Antrian dibatalkan'); fetchQueues(); }
  };

  const filtered = poliFilter === 'semua' ? queues : queues.filter((q) => q.poli?.name === poliFilter);

  const grouped: Record<string, any[]> = {};
  filtered.forEach((q) => {
    const poliName = q.poli?.name || 'Tidak Diketahui';
    if (!grouped[poliName]) grouped[poliName] = [];
    grouped[poliName].push(q);
  });

  const togglePoli = (poliName: string) => {
    setExpandedPoli(prev => ({ ...prev, [poliName]: !prev[poliName] }));
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string; dot: string }> = {
      menunggu: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Menunggu', dot: 'bg-amber-400' },
      dipanggil: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Dipanggil', dot: 'bg-blue-400 animate-pulse' },
      sedang_diperiksa: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', label: 'Diperiksa', dot: 'bg-teal-400' },
      selesai: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Selesai', dot: 'bg-emerald-400' },
      dibatalkan: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Dibatalkan', dot: 'bg-red-400' },
    };
    return map[status] || { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status, dot: 'bg-slate-400' };
  };

  const stats = {
    menunggu: queues.filter(q => q.status === 'menunggu').length,
    dipanggil: queues.filter(q => q.status === 'dipanggil').length,
    diperiksa: queues.filter(q => q.status === 'sedang_diperiksa').length,
    selesai: queues.filter(q => q.status === 'selesai').length,
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
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <ListOrdered className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Kelola Antrian</h1>
                <p className="text-white/60 text-xs mt-0.5">Panggil dan kelola antrian pasien hari ini</p>
              </div>
            </div>
            <button onClick={() => fetchQueues()} className="hidden sm:flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Menunggu', value: stats.menunggu, bg: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
            { label: 'Dipanggil', value: stats.dipanggil, bg: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
            { label: 'Diperiksa', value: stats.diperiksa, bg: 'from-teal-500 to-emerald-500', shadow: 'shadow-teal-200' },
            { label: 'Selesai', value: stats.selesai, bg: 'from-emerald-500 to-green-500', shadow: 'shadow-emerald-200' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.bg} shadow-md ${stat.shadow}`}>
                  <span className="text-white font-bold text-sm">{stat.value}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Poli Filter */}
      <motion.div custom={1.5} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Poli:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPoliFilter('semua')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                poliFilter === 'semua' 
                  ? 'bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            {poliList.map((p) => (
              <button
                key={p.id}
                onClick={() => setPoliFilter(p.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  poliFilter === p.name 
                    ? 'bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Queue Groups */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-slate-200 rounded-xl" />
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-16 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
              <ListOrdered className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">Belum ada antrian hari ini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([poliName, items]) => {
              const isExpanded = expandedPoli[poliName] !== false;
              const poliInitial = items[0]?.poli?.initial || '?';
              const waitingCount = items.filter(q => q.status === 'menunggu').length;
              const calledCount = items.filter(q => q.status === 'dipanggil').length;

              return (
                <div key={poliName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => togglePoli(poliName)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0c3b33] to-[#0f4a3f] text-white font-bold text-sm shadow-md">
                        {poliInitial}
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-bold text-slate-900">{poliName}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {items.length} antrian
                          {waitingCount > 0 && <span className="text-amber-600"> &middot; {waitingCount} menunggu</span>}
                          {calledCount > 0 && <span className="text-blue-600"> &middot; {calledCount} dipanggil</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {calledCount > 0 && (
                        <span className="flex h-6 items-center justify-center rounded-full bg-blue-100 px-2 text-[10px] font-bold text-blue-600 animate-pulse">
                          {calledCount} dipanggil
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-2">
                          {items.map((q) => {
                            const statusConfig = getStatusConfig(q.status);
                            return (
                              <div key={q.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4 hover:bg-slate-50/50 transition-all">
                                <div className="flex items-center gap-4">
                                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold shadow-sm ${
                                    q.status === 'dipanggil' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white animate-pulse shadow-blue-200' :
                                    q.status === 'sedang_diperiksa' ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-200' :
                                    q.status === 'selesai' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-200' :
                                    'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 shadow-slate-200'
                                  }`}>
                                    {q.queue_number}
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{q.patient?.full_name || '-'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[11px] text-slate-500">RM: {q.patient?.medical_record_number || '-'}</span>
                                      <span className="text-slate-300">&middot;</span>
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(new Date(q.created_at), 'HH:mm', { locale: id })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusConfig.bg} ${statusConfig.text}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                                    {statusConfig.label}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {q.status === 'menunggu' && (
                                      <button
                                        onClick={() => callNext(q.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-all"
                                      >
                                        <Phone className="h-3 w-3" /> Panggil
                                      </button>
                                    )}
                                    {q.status === 'dipanggil' && (
                                      <button
                                        onClick={() => startExamination(q.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-all"
                                      >
                                        <Stethoscope className="h-3 w-3" /> Periksa
                                      </button>
                                    )}
                                    {q.status === 'sedang_diperiksa' && (
                                      <button
                                        onClick={() => finishExamination(q.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-all"
                                      >
                                        <CheckCircle className="h-3 w-3" /> Selesai
                                      </button>
                                    )}
                                    {(q.status === 'menunggu' || q.status === 'dipanggil') && (
                                      <button
                                        onClick={() => cancelQueue(q.id)}
                                        className="flex items-center gap-1 px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
