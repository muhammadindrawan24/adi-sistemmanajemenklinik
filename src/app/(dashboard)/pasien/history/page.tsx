'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { History, Calendar, Stethoscope, Download, Eye, ChevronRight } from 'lucide-react';
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

export default function HistoryPage() {
  const supabase = createClient();
  const [records, setRecords] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRecord, setSelectedRecord] = React.useState<any>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
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

      // Fetch doctor profiles
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

      setRecords(enriched);
      setLoading(false);
    };

    fetchHistory();
  }, [supabase]);

  const exportPDF = (record: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Riwayat Pemeriksaan', 20, 20);
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
    addLine('Resep:', record.prescription || '-');

    doc.save(`riwayat-${format(new Date(record.created_at), 'yyyyMMdd')}.pdf`);
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
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Pemeriksaan</h1>
        <p className="text-slate-500 mt-1">Daftar riwayat pemeriksaan medis Anda.</p>
      </motion.div>

      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-600">Belum ada riwayat</p>
              <p className="text-sm text-slate-400 mt-1">Riwayat pemeriksaan akan muncul di sini.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((record, i) => (
              <motion.div key={record.id} custom={i} initial="hidden" animate="visible" variants={fadeIn}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedRecord(record)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
                          <Stethoscope className="h-6 w-6 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{record.doctor?.name || '-'}</p>
                          <p className="text-xs text-slate-500">{record.doctor?.specialization || '-'} &middot; {record.queue?.poli?.name || '-'}</p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(record.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); exportPDF(record); }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                          title="Export PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                    {record.diagnosis && (
                      <p className="text-xs text-slate-500 mt-2 pl-16">Diagnosa: {record.diagnosis}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Pemeriksaan</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-4">
              <div className="rounded-xl bg-teal-50 p-4">
                <p className="text-sm font-medium text-slate-900">{selectedRecord.doctor?.name}</p>
                <p className="text-xs text-slate-500">{selectedRecord.doctor?.specialization} &middot; {selectedRecord.queue?.poli?.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(selectedRecord.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                </p>
              </div>

              <div className="space-y-3">
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
                  <div key={f.label}>
                    <p className="text-xs text-slate-500">{f.label}</p>
                    <p className="text-sm text-slate-900">{f.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedRecord(null)}>Tutup</Button>
                <Button onClick={() => exportPDF(selectedRecord)} className="gap-2">
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
