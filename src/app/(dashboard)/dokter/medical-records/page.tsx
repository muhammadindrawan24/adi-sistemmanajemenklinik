'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, Download, Eye, User, Calendar, AlertCircle, CheckCircle, Clock, Stethoscope } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function MedicalRecordsPage() {
  const supabase = createClient();
  const [records, setRecords] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedRecord, setSelectedRecord] = React.useState<any>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 4000);
  };

  React.useEffect(() => {
    const fetchRecords = async () => {
      const { data: recordsData } = await supabase
        .from('medical_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (!recordsData || recordsData.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const patientIds = [...new Set(recordsData.map(r => r.patient_id).filter(Boolean))];
      const { data: patientsData } = await supabase.from('patients').select('id, user_id, medical_record_number').in('id', patientIds);
      const patientUserIds = patientsData?.map(p => p.user_id).filter(Boolean) || [];
      const { data: patientProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', patientUserIds);

      const patientMap: Record<string, any> = {};
      patientsData?.forEach(p => {
        const profile = patientProfiles?.find(pf => pf.user_id === p.user_id);
        patientMap[p.id] = { name: profile?.full_name || '-', rm_number: p.medical_record_number };
      });

      const doctorIds = [...new Set(recordsData.map(r => r.doctor_id).filter(Boolean))];
      const { data: doctorsData } = await supabase.from('doctors').select('id, user_id, specialty').in('id', doctorIds);
      const doctorUserIds = doctorsData?.map(d => d.user_id).filter(Boolean) || [];
      const { data: doctorProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doctorUserIds);

      const doctorMap: Record<string, any> = {};
      doctorsData?.forEach(d => {
        const profile = doctorProfiles?.find(pf => pf.user_id === d.user_id);
        doctorMap[d.id] = { name: profile?.full_name || '-', specialization: d.specialty };
      });

      const enriched = recordsData.map(r => ({
        ...r,
        patient: patientMap[r.patient_id] || { name: '-', rm_number: '-' },
        doctor: doctorMap[r.doctor_id] || { name: '-', specialization: '-' },
      }));

      setRecords(enriched);
      setLoading(false);
    };
    fetchRecords();
  }, [supabase]);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return r.patient?.name?.toLowerCase().includes(q) ||
      r.patient?.rm_number?.toLowerCase().includes(q) ||
      r.diagnosis?.toLowerCase().includes(q) ||
      r.symptoms?.toLowerCase().includes(q);
  });

  const exportRecordPDF = (record: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Rekam Medis - KlinikSehat', 20, 20);
    doc.setFontSize(10);
    doc.text(`Tanggal: ${format(new Date(record.created_at), 'dd MMMM yyyy', { locale: id })}`, 20, 30);

    let y = 45;
    const addLine = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '-', 60, y);
      y += 8;
    };

    doc.setFontSize(12);
    doc.text('Data Pasien', 20, y); y += 10;
    addLine('Nama:', record.patient?.name || '-');
    addLine('No. RM:', record.patient?.rm_number || '-');

    y += 5;
    doc.setFontSize(12);
    doc.text('Pemeriksaan', 20, y); y += 10;
    addLine('Dokter:', record.doctor?.name || '-');
    addLine('Spesialisasi:', record.doctor?.specialization || '-');
    addLine('Keluhan:', record.symptoms || '-');
    addLine('Tekanan Darah:', record.blood_pressure || '-');
    addLine('Berat:', record.weight ? `${record.weight} kg` : '-');
    addLine('Tinggi:', record.height ? `${record.height} cm` : '-');
    addLine('Suhu:', record.temperature ? `${record.temperature}°C` : '-');
    addLine('Diagnosa:', record.diagnosis || '-');
    addLine('Tindakan:', record.treatment || '-');
    addLine('Resep:', record.prescription || '-');
    addLine('Catatan:', record.notes || '-');

    doc.save(`rekam-medis-${record.patient?.rm_number || 'unknown'}-${format(new Date(record.created_at), 'yyyyMMdd')}.pdf`);
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
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Rekam Medis</h1>
              <p className="text-white/60 text-xs mt-0.5">Daftar rekam medis pasien yang telah diperiksa</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            placeholder="Cari berdasarkan nama pasien, No. RM, atau diagnosa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-sm"
          />
        </div>
      </motion.div>

      {/* Records List */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">Tidak ada data rekam medis</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-sm shadow-blue-200">
                      {record.patient?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{record.patient?.name || '-'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">RM: {record.patient?.rm_number || '-'}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(record.created_at), 'dd MMM yyyy', { locale: id })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:block text-xs text-slate-500 max-w-[200px] truncate">{record.diagnosis || '-'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detail
                      </button>
                      <button
                        onClick={() => exportRecordPDF(record)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all text-xs font-semibold shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                    </div>
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            >
              {/* Dialog Header */}
              <div className="bg-gradient-to-r from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-bold">Detail Rekam Medis</h3>
                      <p className="text-white/60 text-xs mt-0.5">Informasi lengkap pemeriksaan</p>
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
                {/* Patient Info */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-sm">
                    {selectedRecord.patient?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedRecord.patient?.name}</p>
                    <p className="text-xs text-slate-500">RM: {selectedRecord.patient?.rm_number}</p>
                  </div>
                </div>

                {/* Examination Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" /> Data Pemeriksaan
                  </h4>
                  {[
                    { label: 'Tanggal', value: format(new Date(selectedRecord.created_at), 'dd MMMM yyyy, HH:mm', { locale: id }), icon: Calendar },
                    { label: 'Dokter', value: `${selectedRecord.doctor?.name || '-'} (${selectedRecord.doctor?.specialization || '-'})`, icon: User },
                    { label: 'Keluhan', value: selectedRecord.symptoms },
                    { label: 'Tekanan Darah', value: selectedRecord.blood_pressure },
                    { label: 'Berat', value: selectedRecord.weight ? `${selectedRecord.weight} kg` : null },
                    { label: 'Tinggi', value: selectedRecord.height ? `${selectedRecord.height} cm` : null },
                    { label: 'Suhu', value: selectedRecord.temperature ? `${selectedRecord.temperature}°C` : null },
                    { label: 'Diagnosa', value: selectedRecord.diagnosis },
                    { label: 'Tindakan', value: selectedRecord.treatment },
                    { label: 'Resep', value: selectedRecord.prescription },
                    { label: 'Catatan', value: selectedRecord.notes },
                  ].filter(f => f.value).map((f) => (
                    <div key={f.label} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500">{f.label}</span>
                      <span className="font-medium text-slate-900 text-right max-w-[60%]">{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-5">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => exportRecordPDF(selectedRecord)}
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
