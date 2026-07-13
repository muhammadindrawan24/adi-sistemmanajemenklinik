'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Download, Eye, User, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchRecords = async () => {
      // 1. Fetch medical records
      const { data: recordsData } = await supabase
        .from('medical_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (!recordsData || recordsData.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      // 2. Fetch patient profiles
      const patientIds = [...new Set(recordsData.map(r => r.patient_id).filter(Boolean))];
      const { data: patientsData } = await supabase.from('patients').select('id, user_id, medical_record_number').in('id', patientIds);
      const patientUserIds = patientsData?.map(p => p.user_id).filter(Boolean) || [];
      const { data: patientProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', patientUserIds);

      const patientMap: Record<string, any> = {};
      patientsData?.forEach(p => {
        const profile = patientProfiles?.find(pf => pf.user_id === p.user_id);
        patientMap[p.id] = { name: profile?.full_name || '-', rm_number: p.medical_record_number };
      });

      // 3. Fetch doctor profiles
      const doctorIds = [...new Set(recordsData.map(r => r.doctor_id).filter(Boolean))];
      const { data: doctorsData } = await supabase.from('doctors').select('id, user_id, specialty').in('id', doctorIds);
      const doctorUserIds = doctorsData?.map(d => d.user_id).filter(Boolean) || [];
      const { data: doctorProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doctorUserIds);

      const doctorMap: Record<string, any> = {};
      doctorsData?.forEach(d => {
        const profile = doctorProfiles?.find(pf => pf.user_id === d.user_id);
        doctorMap[d.id] = { name: profile?.full_name || '-', specialization: d.specialty };
      });

      // 4. Enrich records
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
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Rekam Medis</h1>
        <p className="text-slate-500 mt-1">Daftar rekam medis pasien.</p>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari berdasarkan nama pasien, No. RM, atau diagnosa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </motion.div>

      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Pasien</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No. RM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Diagnosa</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Tidak ada data rekam medis</td></tr>
                  ) : (
                    filtered.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {format(new Date(record.created_at), 'dd MMM yyyy', { locale: id })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                              {record.patient?.name?.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-slate-900">{record.patient?.name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.patient?.rm_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{record.diagnosis || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setSelectedRecord(record)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => exportRecordPDF(record)} className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-600">
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Rekam Medis</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-4">
              <div className="rounded-xl bg-teal-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-white font-bold">
                    {selectedRecord.patient?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{selectedRecord.patient?.name}</p>
                    <p className="text-sm text-slate-500">RM: {selectedRecord.patient?.rm_number}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Data Pemeriksaan</h4>
                {[
                  { label: 'Tanggal', value: format(new Date(selectedRecord.created_at), 'dd MMMM yyyy, HH:mm', { locale: id }) },
                  { label: 'Dokter', value: `${selectedRecord.doctor?.name || '-'} (${selectedRecord.doctor?.specialization || '-'})` },
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
                  <div key={f.label}>
                    <p className="text-xs text-slate-500">{f.label}</p>
                    <p className="text-sm text-slate-900">{f.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedRecord(null)}>Tutup</Button>
                <Button onClick={() => exportRecordPDF(selectedRecord)} className="gap-2">
                  <Download className="h-4 w-4" /> Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
