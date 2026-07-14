'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function ReportsPage() {
  const supabase = createClient();
  const [dateFrom, setDateFrom] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodType, setPeriodType] = React.useState('harian');
  const [doctorFilter, setDoctorFilter] = React.useState('');
  const [poliFilter, setPoliFilter] = React.useState('');
  const [doctors, setDoctors] = React.useState<any[]>([]);
  const [poli, setPoli] = React.useState<any[]>([]);
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({ totalKunjungan: 0, totalSelesai: 0, totalDibatalkan: 0, rataHarian: 0 });
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchFilters = async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from('doctors').select('id, user_id, specialty').order('created_at'),
        supabase.from('poli').select('id, name').order('name'),
      ]);
      // Fetch doctor profile names
      const userIds = d?.map((doc: any) => doc.user_id).filter(Boolean) || [];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }
      setDoctors(d?.map((doc: any) => ({ ...doc, full_name: profileMap[doc.user_id] || '-' })) || []);
      setPoli(p || []);
    };
    fetchFilters();
  }, [supabase]);

  const generateReport = async () => {
    setLoading(true);
    let query = supabase
      .from('queues')
      .select('*, patient:patients(id, user_id, medical_record_number), poli:poli(name), doctor_schedule:doctor_schedules(id, doctor_id, doctor:doctors(id, user_id))')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59');

    if (doctorFilter) {
      // Filter by doctor via doctor_schedules
      const { data: scheduleIds } = await supabase.from('doctor_schedules').select('id').eq('doctor_id', doctorFilter);
      const ids = scheduleIds?.map((s: any) => s.id) || [];
      if (ids.length > 0) {
        query = query.in('doctor_schedule_id', ids);
      } else {
        setReportData([]);
        setStats({ totalKunjungan: 0, totalSelesai: 0, totalDibatalkan: 0, rataHarian: 0 });
        setLoading(false);
        return;
      }
    }
    if (poliFilter) query = query.eq('poli_id', poliFilter);

    const { data } = await query.order('created_at', { ascending: false });

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

    const enrichedData = data?.map((q: any) => ({
      ...q,
      patient_name: q.patient ? profileMap[q.patient.user_id] || '-' : '-',
      doctor_name: q.doctor_schedule?.doctor ? profileMap[q.doctor_schedule.doctor.user_id] || '-' : '-',
    })) || [];

    setReportData(enrichedData);

    const totalKunjungan = enrichedData.length || 0;
    const totalSelesai = enrichedData.filter((q) => q.status === 'selesai').length || 0;
    const totalDibatalkan = enrichedData.filter((q) => q.status === 'dibatalkan').length || 0;
    const days = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1);

    setStats({ totalKunjungan, totalSelesai, totalDibatalkan, rataHarian: Math.round(totalKunjungan / days) });
    setLoading(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Kunjungan Klinik', 20, 20);
    doc.setFontSize(10);
    doc.text(`Periode: ${dateFrom} s/d ${dateTo}`, 20, 30);
    doc.text(`Total Kunjungan: ${stats.totalKunjungan}`, 20, 38);
    doc.text(`Selesai: ${stats.totalSelesai} | Dibatalkan: ${stats.totalDibatalkan}`, 20, 46);
    doc.text(`Rata-rata/Hari: ${stats.rataHarian}`, 20, 54);

    let y = 70;
    doc.setFontSize(9);
    doc.text('No', 20, y);
    doc.text('Tanggal', 35, y);
    doc.text('Pasien', 70, y);
    doc.text('Poli', 115, y);
    doc.text('Status', 155, y);
    y += 8;

    reportData.slice(0, 30).forEach((row, i) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(String(i + 1), 20, y);
      doc.text(format(new Date(row.created_at), 'dd/MM/yyyy'), 35, y);
      doc.text(row.patient_name?.substring(0, 20) || '-', 70, y);
      doc.text(row.poli?.name?.substring(0, 15) || '-', 115, y);
      doc.text(row.status, 155, y);
      y += 7;
    });

    doc.save(`laporan-klinik-${dateFrom}.pdf`);
    showToast('PDF berhasil diunduh');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData.map((r, i) => ({
      No: i + 1,
      Tanggal: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      'No. RM': r.patient?.medical_record_number || '-',
      Pasien: r.patient_name || '-',
      Poli: r.poli?.name || '-',
      Dokter: r.doctor_name || '-',
      Status: r.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `laporan-klinik-${dateFrom}.xlsx`);
    showToast('Excel berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Laporan</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Analisis dan export data kunjungan klinik.</p>
      </motion.div>

      {/* Filters */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Filter Laporan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Periode</label>
                <Select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="mt-1">
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                  <option value="tahunan">Tahunan</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dari Tanggal</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sampai Tanggal</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dokter</label>
                <Select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="mt-1">
                  <option value="">Semua Dokter</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Poli</label>
                <Select value={poliFilter} onChange={(e) => setPoliFilter(e.target.value)} className="mt-1">
                  <option value="">Semua Poli</option>
                  {poli.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={generateReport} disabled={loading} className="gap-2">
                <Filter className="h-4 w-4" />
                {loading ? 'Memuat...' : 'Generate Laporan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Stats */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Kunjungan', value: stats.totalKunjungan, color: 'from-blue-500 to-blue-600' },
            { label: 'Selesai', value: stats.totalSelesai, color: 'from-green-500 to-emerald-600' },
            { label: 'Dibatalkan', value: stats.totalDibatalkan, color: 'from-red-500 to-rose-600' },
            { label: 'Rata-rata/Hari', value: stats.rataHarian, color: 'from-teal-500 to-emerald-600' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Export Buttons */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPDF} disabled={reportData.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={reportData.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </motion.div>

      {/* Report Table */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pasien</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Poli</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Dokter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}</tr>
                    ))
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">Klik &quot;Generate Laporan&quot; untuk melihat data</td></tr>
                  ) : (
                    reportData.map((row, i) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-900">
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{format(new Date(row.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{row.patient_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{row.poli?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{row.doctor_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${row.status === 'selesai' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : row.status === 'dibatalkan' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {row.status}
                          </span>
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
    </div>
  );
}
