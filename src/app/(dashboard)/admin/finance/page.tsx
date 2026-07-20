'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function FinancePage() {
  const supabase = createClient();
  const [dateFrom, setDateFrom] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodType, setPeriodType] = React.useState('harian');
  const [payments, setPayments] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({
    totalRevenue: 0,
    totalExamination: 0,
    totalAdmin: 0,
    totalMedicine: 0,
    totalPaid: 0,
    totalUnpaid: 0,
  });
  const [chartData, setChartData] = React.useState<{ name: string; pendapatan: number }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateReport = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*, patient:patients(id, user_id, medical_record_number), queue:queues(queue_number, poli:poli(name))')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false });

    const userIds = data?.map((p: any) => p.patient?.user_id).filter(Boolean) || [];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', [...new Set(userIds)]);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

    const enriched = data?.map((p: any) => ({
      ...p,
      patient_name: p.patient ? profileMap[p.patient.user_id] || '-' : '-',
    })) || [];

    setPayments(enriched);

    const totalRevenue = enriched.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);
    const totalExamination = enriched.reduce((sum: number, p: any) => sum + (p.examination_fee || 0), 0);
    const totalAdmin = enriched.reduce((sum: number, p: any) => sum + (p.admin_fee || 0), 0);
    const totalMedicine = enriched.reduce((sum: number, p: any) => sum + (p.medicine_total || 0), 0);
    const totalPaid = enriched.filter((p: any) => p.status === 'dibayar').length;
    const totalUnpaid = enriched.filter((p: any) => p.status === 'belum_bayar').length;

    setStats({ totalRevenue, totalExamination, totalAdmin, totalMedicine, totalPaid, totalUnpaid });

    // Chart data - group by date
    const dateMap: Record<string, number> = {};
    enriched.forEach((p: any) => {
      const date = format(new Date(p.created_at), 'dd MMM', { locale: id });
      dateMap[date] = (dateMap[date] || 0) + (p.total_amount || 0);
    });
    const chart = Object.entries(dateMap).map(([name, pendapatan]) => ({ name, pendapatan }));
    setChartData(chart);

    setLoading(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Keuangan Klinik', 20, 20);
    doc.setFontSize(10);
    doc.text(`Periode: ${dateFrom} s/d ${dateTo}`, 20, 30);
    doc.text(`Total Pendapatan: Rp ${stats.totalRevenue.toLocaleString('id-ID')}`, 20, 38);
    doc.text(`Pemeriksaan: Rp ${stats.totalExamination.toLocaleString('id-ID')} | Admin: Rp ${stats.totalAdmin.toLocaleString('id-ID')} | Obat: Rp ${stats.totalMedicine.toLocaleString('id-ID')}`, 20, 46);

    let y = 60;
    doc.setFontSize(9);
    doc.text('No', 20, y);
    doc.text('Tanggal', 35, y);
    doc.text('Pasien', 70, y);
    doc.text('Poli', 115, y);
    doc.text('Total', 150, y);
    doc.text('Status', 175, y);
    y += 8;

    payments.slice(0, 30).forEach((row, i) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(String(i + 1), 20, y);
      doc.text(format(new Date(row.created_at), 'dd/MM/yyyy'), 35, y);
      doc.text(row.patient_name?.substring(0, 20) || '-', 70, y);
      doc.text(row.queue?.poli?.name?.substring(0, 15) || '-', 115, y);
      doc.text(`Rp ${(row.total_amount || 0).toLocaleString('id-ID')}`, 150, y);
      doc.text(row.status, 175, y);
      y += 7;
    });

    doc.save(`laporan-keuangan-${dateFrom}.pdf`);
    showToast('PDF berhasil diunduh');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(payments.map((r, i) => ({
      No: i + 1,
      Tanggal: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      'No. RM': r.patient?.medical_record_number || '-',
      Pasien: r.patient_name || '-',
      Poli: r.queue?.poli?.name || '-',
      'Biaya Periksa': r.examination_fee || 0,
      'Biaya Admin': r.admin_fee || 0,
      'Biaya Obat': r.medicine_total || 0,
      Total: r.total_amount || 0,
      Status: r.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan');
    XLSX.writeFile(wb, `laporan-keuangan-${dateFrom}.xlsx`);
    showToast('Excel berhasil diunduh');
  };

  const statCards = [
    { label: 'Total Pendapatan', value: `Rp ${stats.totalRevenue.toLocaleString('id-ID')}`, icon: Wallet, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Pemeriksaan', value: `Rp ${stats.totalExamination.toLocaleString('id-ID')}`, icon: CreditCard, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
    { label: 'Administrasi', value: `Rp ${stats.totalAdmin.toLocaleString('id-ID')}`, icon: CheckCircle2, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
    { label: 'Obat', value: `Rp ${stats.totalMedicine.toLocaleString('id-ID')}`, icon: TrendingUp, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  ];

  return (
    <div className="space-y-6 dark:bg-slate-900 min-h-screen">
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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Laporan Keuangan</h1>
              <p className="text-white/60 text-xs mt-0.5">Analisis pendapatan klinik</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Periode</label>
                <Select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="mt-0.5 h-10 rounded-xl">
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dari Tanggal</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-0.5 h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sampai Tanggal</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-0.5 h-10 rounded-xl" />
              </div>
              <div className="flex items-end">
                <Button onClick={generateReport} disabled={loading} className="h-10 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25 w-full">
                  {loading ? 'Memuat...' : 'Generate'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">{s.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-sm`}>
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Chart + Export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Grafik Pendapatan</h3>
              {loading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                      formatter={(value) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan']}
                    />
                    <Bar dataKey="pendapatan" fill="url(#financeGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <defs>
                      <linearGradient id="financeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Ringkasan</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sudah Bayar</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.totalPaid}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Belum Bayar</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">{stats.totalUnpaid}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Total Transaksi</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.totalPaid + stats.totalUnpaid}</span>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <Button variant="outline" onClick={exportPDF} disabled={payments.length === 0} className="w-full rounded-xl gap-2">
                  <Download className="h-4 w-4" /> Export PDF
                </Button>
                <Button variant="outline" onClick={exportExcel} disabled={payments.length === 0} className="w-full rounded-xl gap-2">
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Table */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tanggal</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasien</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Poli</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20 rounded-lg" /></td>
                        ))}
                      </tr>
                    ))
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada data</p>
                      </td>
                    </tr>
                  ) : (
                    payments.map((row, i) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">{format(new Date(row.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{row.patient_name || '-'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">{row.queue?.poli?.name || '-'}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100">Rp {(row.total_amount || 0).toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            row.status === 'dibayar' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400' :
                            'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'dibayar' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {row.status === 'dibayar' ? 'Dibayar' : 'Belum Bayar'}
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
