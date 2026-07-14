'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Calendar, Filter, TrendingUp, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
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
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
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

  const statCards = [
    { label: 'Total Kunjungan', value: stats.totalKunjungan, icon: BarChart3, color: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50 dark:bg-blue-950/40', textColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Selesai', value: stats.totalSelesai, icon: CheckCircle2, color: 'from-emerald-500 to-green-600', bgLight: 'bg-emerald-50 dark:bg-emerald-950/40', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Dibatalkan', value: stats.totalDibatalkan, icon: XCircle, color: 'from-red-500 to-rose-600', bgLight: 'bg-red-50 dark:bg-red-950/40', textColor: 'text-red-600 dark:text-red-400' },
    { label: 'Rata-rata/Hari', value: stats.rataHarian, icon: TrendingUp, color: 'from-teal-500 to-cyan-600', bgLight: 'bg-teal-50 dark:bg-teal-950/40', textColor: 'text-teal-600 dark:text-teal-400' },
  ];

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl backdrop-blur-sm ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-500 p-8 text-white shadow-2xl shadow-teal-500/20"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0djItSDI0di0yaDEyem0wIDZWMjBIMjR2LTJoMTJ6TTQ4IDE0djJoLTEydjJoMTJ6bTAgNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Laporan</h1>
          </div>
          <p className="text-teal-100 text-sm max-w-md">Analisis dan export data kunjungan klinik. Gunakan filter untuk melihat data sesuai kebutuhan Anda.</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/25">
                <Filter className="h-4 w-4 text-white" />
              </div>
              Filter Laporan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Periode</label>
                <Select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="mt-0.5 h-10 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                  <option value="tahunan">Tahunan</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dari Tanggal</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-0.5 h-10 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sampai Tanggal</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-0.5 h-10 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dokter</label>
                <Select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="mt-0.5 h-10 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                  <option value="">Semua Dokter</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Poli</label>
                <Select value={poliFilter} onChange={(e) => setPoliFilter(e.target.value)} className="mt-0.5 h-10 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                  <option value="">Semua Poli</option>
                  {poli.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={generateReport} disabled={loading} className="h-10 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Memuat...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Generate Laporan
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Stats */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                className="group"
              >
                <Card className="relative overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800 transition-all duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardContent className="relative p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.label}</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2 tabular-nums">{s.value.toLocaleString('id-ID')}</p>
                      </div>
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bgLight} ${s.textColor} transition-all duration-300 group-hover:bg-white/20 group-hover:text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Export Buttons */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={exportPDF} disabled={reportData.length === 0} className="h-10 px-5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={reportData.length === 0} className="h-10 px-5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-800 dark:hover:text-emerald-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </motion.div>

      {/* Report Table */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tanggal</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasien</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Poli</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dokter</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 animate-pulse">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <Skeleton className="h-4 w-20 rounded-lg" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : reportData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            <FileText className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Klik &quot;Generate Laporan&quot; untuk melihat data</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reportData.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:hover:from-slate-800/50 dark:hover:to-transparent transition-colors duration-150"
                      >
                        <td className="px-5 py-3.5 text-sm text-slate-400 dark:text-slate-500 font-medium tabular-nums">{i + 1}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">{format(new Date(row.created_at), 'dd MMM yyyy', { locale: id })}</span>
                          <span className="text-slate-400 dark:text-slate-500 ml-1.5">{format(new Date(row.created_at), 'HH:mm')}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.patient_name || '-'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">{row.poli?.name || '-'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">{row.doctor_name || '-'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                            row.status === 'selesai' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50' :
                            row.status === 'dibatalkan' ? 'bg-red-50 text-red-700 ring-1 ring-red-200/50 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800/50' :
                            'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/50'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              row.status === 'selesai' ? 'bg-emerald-500' :
                              row.status === 'dibatalkan' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            {row.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {reportData.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 px-5 py-3">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Menampilkan {reportData.length} data
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
