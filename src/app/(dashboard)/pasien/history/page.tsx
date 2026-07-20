'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Calendar, Stethoscope, Download, Eye, AlertCircle, CheckCircle, Clock, Wallet, CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function HistoryPage() {
  const supabase = createClient();
  const [records, setRecords] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRecord, setSelectedRecord] = React.useState<any>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
  };

  React.useEffect(() => {
    const fetchHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!patient) { setLoading(false); return; }

      const { data } = await supabase
        .from('medical_records')
        .select('*, queue:queues(poli:poli(name))')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      const doctorIds = [...new Set((data || []).map(r => r.doctor_id).filter(Boolean))];
      let doctorMap: Record<string, any> = {};
      if (doctorIds.length > 0) {
        const { data: doctorsData } = await supabase.from('doctors').select('id, user_id, specialty').in('id', doctorIds);
        const doctorUserIds = doctorsData?.map(d => d.user_id).filter(Boolean) || [];
        const { data: doctorProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doctorUserIds);
        doctorsData?.forEach(d => {
          const profile = doctorProfiles?.find(pf => pf.user_id === d.user_id);
          doctorMap[d.id] = { name: profile?.full_name || '-', specialization: d.specialty };
        });
      }

      const enriched = (data || []).map(r => ({
        ...r,
        doctor: doctorMap[r.doctor_id] || { name: '-', specialization: '-' },
      }));

      // Fetch payment data for each record
      const queueIds = enriched.map(r => r.queue_id).filter(Boolean);
      let paymentMap: Record<string, any> = {};
      if (queueIds.length > 0) {
        const { data: payments } = await supabase.from('payments').select('*').in('queue_id', queueIds);
        payments?.forEach((p: any) => { paymentMap[p.queue_id] = p; });
      }

      // Fetch prescription items for each record
      const recordIds = enriched.map(r => r.id).filter(Boolean);
      let prescriptionMap: Record<string, any[]> = {};
      if (recordIds.length > 0) {
        const { data: prescriptions } = await supabase.from('prescription_items').select('*, medicine:medicines(name)').in('medical_record_id', recordIds);
        prescriptions?.forEach((p: any) => {
          if (!prescriptionMap[p.medical_record_id]) prescriptionMap[p.medical_record_id] = [];
          prescriptionMap[p.medical_record_id].push(p);
        });
      }

      const enrichedWithPayments = enriched.map(r => ({
        ...r,
        payment: paymentMap[r.queue_id] || null,
        prescription_items: prescriptionMap[r.id] || [],
      }));

      setRecords(enrichedWithPayments);
      setLoading(false);
    };

    fetchHistory();
  }, [supabase]);

  const exportPDF = (record: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Riwayat Pemeriksaan - KlinikSehat', 20, 20);
    doc.setFontSize(10);
    doc.text(`Tanggal: ${format(new Date(record.created_at), 'dd MMMM yyyy', { locale: id })}`, 20, 30);

    let y = 45;
    const addLine = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '-', 65, y);
      y += 8;
    };

    addLine('Dokter:', `${record.doctor?.name || '-'} (${record.doctor?.specialization || '-'})`);
    addLine('Poli:', record.queue?.poli?.name || '-');
    addLine('Keluhan:', record.chief_complaint || '-');
    addLine('Diagnosa:', record.diagnosis || '-');
    addLine('Tekanan Darah:', record.blood_pressure || '-');
    addLine('Berat:', record.weight ? `${record.weight} kg` : '-');
    addLine('Tinggi:', record.height ? `${record.height} cm` : '-');
    addLine('Suhu:', record.temperature ? `${record.temperature}°C` : '-');
    addLine('Tindakan:', record.treatment || '-');

    // Resep obat dari prescription_items
    if (record.prescription_items && record.prescription_items.length > 0) {
      const resepList = record.prescription_items.map((p: any) => {
        const medName = p.medicine?.name || p.medicine_name || '-';
        return `${medName} ${p.dosage || ''} ${p.frequency || ''} ${p.duration || ''} (${p.quantity} ${p.unit || ''})`;
      }).join('\n');
      doc.setFont('helvetica', 'bold');
      doc.text('Resep:', 20, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(resepList, 120);
      doc.text(lines, 65, y);
      y += lines.length * 8;
    } else {
      addLine('Resep:', record.prescription || '-');
    }

    doc.save(`riwayat-${format(new Date(record.created_at), 'yyyyMMdd')}.pdf`);
    showToast('PDF berhasil diunduh');
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
              <History className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Riwayat Pemeriksaan</h1>
              <p className="text-white/60 text-xs mt-0.5">Daftar riwayat pemeriksaan medis Anda</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Records List */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-4">
                <History className="h-8 w-8 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada riwayat</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Riwayat pemeriksaan akan muncul di sini</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200">
                      <Stethoscope className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{record.doctor?.name || '-'}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{record.doctor?.specialization || '-'} &middot; {record.queue?.poli?.name || '-'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(record.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.diagnosis && (
                      <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{record.diagnosis}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); exportPDF(record); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-[10px] font-semibold"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Detail Dialog */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            >
              {/* Dialog Header */}
              <div className="bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                      <Stethoscope className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-bold">Detail Pemeriksaan</h3>
                      <p className="text-white/60 text-xs mt-0.5">{format(new Date(selectedRecord.created_at), 'dd MMMM yyyy', { locale: id })}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedRecord(null)} className="text-white/60 hover:text-white transition-colors">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Doctor Info */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold shadow-sm">
                    {selectedRecord.doctor?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedRecord.doctor?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedRecord.doctor?.specialization} &middot; {selectedRecord.queue?.poli?.name}</p>
                  </div>
                </div>

                {/* Examination Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" /> Hasil Pemeriksaan
                  </h4>
                  {[
                    { label: 'Keluhan', value: selectedRecord.chief_complaint },
                    { label: 'Tekanan Darah', value: selectedRecord.blood_pressure },
                    { label: 'Berat', value: selectedRecord.weight ? `${selectedRecord.weight} kg` : null },
                    { label: 'Tinggi', value: selectedRecord.height ? `${selectedRecord.height} cm` : null },
                    { label: 'Suhu', value: selectedRecord.temperature ? `${selectedRecord.temperature}°C` : null },
                    { label: 'Diagnosa', value: selectedRecord.diagnosis },
                    { label: 'Tindakan', value: selectedRecord.treatment },
                    { label: 'Resep', value: selectedRecord.prescription },
                    { label: 'Catatan', value: selectedRecord.notes },
                  ].filter(f => f.value).map((f) => (
                    <div key={f.label} className="flex justify-between text-sm py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
                      <span className="text-slate-500 dark:text-slate-400">{f.label}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 text-right max-w-[60%]">{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* Prescription Items */}
                {selectedRecord.prescription_items && selectedRecord.prescription_items.length > 0 && (
                  <div className="space-y-3 mt-5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5" /> Resep Obat
                    </h4>
                    <div className="space-y-2">
                      {selectedRecord.prescription_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.medicine?.name || '-'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.frequency} | {item.duration}</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rp {(item.subtotal || 0).toLocaleString('id-ID')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Info */}
                {selectedRecord.payment && (
                  <div className="space-y-3 mt-5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" /> Rincian Biaya
                    </h4>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Biaya Pemeriksaan</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">Rp {(selectedRecord.payment.examination_fee || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Biaya Administrasi</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">Rp {(selectedRecord.payment.admin_fee || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Biaya Obat</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">Rp {(selectedRecord.payment.medicine_total || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Rp {(selectedRecord.payment.total_amount || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Status</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedRecord.payment.status === 'dibayar'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedRecord.payment.status === 'dibayar' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {selectedRecord.payment.status === 'dibayar' ? 'Sudah Dibayar' : 'Belum Dibayar'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-5">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => exportPDF(selectedRecord)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all duration-200"
                  >
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
