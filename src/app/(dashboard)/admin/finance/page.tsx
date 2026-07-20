'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Search, Download, Eye, CheckCircle2, Clock, X, FileText,
  Wallet, TrendingUp, BarChart3,
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
import { generateFinanceReportPDF } from '@/lib/pdf-report';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function FinancePage() {
  const supabase = createClient();
  const [payments, setPayments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [showDetail, setShowDetail] = React.useState(false);
  const [selectedPayment, setSelectedPayment] = React.useState<any>(null);
  const [chartData, setChartData] = React.useState<{ name: string; pendapatan: number }[]>([]);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  // Auto-load data saat buka halaman
  React.useEffect(() => {
    fetchPayments();
  }, [supabase]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select(`
        *,
        queue:queues(queue_number, poli:poli(name)),
        patient:patients(medical_record_number, user_id)
      `)
      .order('created_at', { ascending: false });

    const patientUserIds = data?.map((p: any) => p.patient?.user_id).filter(Boolean) || [];
    const uniqueUserIds = [...new Set(patientUserIds)];
    let profileMap: Record<string, string> = {};

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
    }

    const enrichedData = data?.map((payment: any) => ({
      ...payment,
      patient_name: payment.patient?.user_id ? profileMap[payment.patient.user_id] || '-' : '-',
    })) || [];

    setPayments(enrichedData);
    updateStats(enrichedData);
    setLoading(false);
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = p.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.queue?.queue_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const paymentDate = new Date(p.created_at).toISOString().split('T')[0];
    const matchesDate = paymentDate >= dateFrom && paymentDate <= dateTo;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const [stats, setStats] = React.useState({
    total: 0, paid: 0, unpaid: 0,
    totalRevenue: 0, totalExamination: 0, totalAdmin: 0, totalMedicine: 0,
  });

  const updateStats = (data: any[]) => {
    setStats({
      total: data.length,
      paid: data.filter(p => p.status === 'dibayar').length,
      unpaid: data.filter(p => p.status === 'belum_bayar').length,
      totalRevenue: data.filter(p => p.status === 'dibayar').reduce((a, b) => a + (b.total_amount || 0), 0),
      totalExamination: data.reduce((a, b) => a + (b.examination_fee || 0), 0),
      totalAdmin: data.reduce((a, b) => a + (b.admin_fee || 0), 0),
      totalMedicine: data.reduce((a, b) => a + (b.medicine_total || 0), 0),
    });

    // Chart data
    const dateMap: Record<string, number> = {};
    data.filter(p => p.status === 'dibayar').forEach((p: any) => {
      const date = format(new Date(p.created_at), 'dd MMM', { locale: id });
      dateMap[date] = (dateMap[date] || 0) + (p.total_amount || 0);
    });
    setChartData(Object.entries(dateMap).map(([name, pendapatan]) => ({ name, pendapatan })));
  };

  // Update stats saat filter berubah
  React.useEffect(() => {
    updateStats(filteredPayments);
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  const handleViewDetail = (payment: any) => {
    setSelectedPayment(payment);
    setShowDetail(true);
  };

  const exportPDF = () => {
    generateFinanceReportPDF(
      filteredPayments,
      stats,
      dateFrom,
      dateTo
    );
    showToast('PDF berhasil diunduh');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredPayments.map((r, i) => ({
      No: i + 1,
      Tanggal: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      'No. Antrian': r.queue?.queue_number || '-',
      Pasien: r.patient_name || '-',
      Poli: r.queue?.poli?.name || '-',
      'Biaya Periksa': r.examination_fee || 0,
      'Biaya Admin': r.admin_fee || 0,
      'Biaya Obat': r.medicine_total || 0,
      Total: r.total_amount || 0,
      Status: r.status === 'dibayar' ? 'Dibayar' : 'Belum Bayar',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manajemen Keuangan');
    XLSX.writeFile(wb, `laporan-keuangan-${dateFrom}.xlsx`);
    showToast('Excel berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl backdrop-blur-sm ${
              toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <CreditCard className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Manajemen Keuangan</h1>
              <p className="text-white/60 text-xs mt-0.5">Pembayaran, laporan, dan grafik pendapatan klinik</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Transaksi', value: stats.total, icon: FileText, color: 'bg-blue-100 text-blue-600' },
            { label: 'Sudah Dibayar', value: stats.paid, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
            { label: 'Belum Dibayar', value: stats.unpaid, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
            { label: 'Total Pendapatan', value: `Rp ${stats.totalRevenue.toLocaleString('id-ID')}`, icon: CreditCard, color: 'bg-emerald-100 text-emerald-600' },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Filter & Export */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari nama pasien atau no. antrian..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-40">
                <option value="">Semua Status</option>
                <option value="dibayar">Dibayar</option>
                <option value="belum_bayar">Belum Bayar</option>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={exportPDF} variant="outline" size="sm" disabled={filteredPayments.length === 0}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" size="sm" disabled={filteredPayments.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Chart + Ringkasan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-teal-600" /> Grafik Pendapatan
              </h3>
              {loading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                      formatter={(value) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Pendapatan']} />
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
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-teal-600" /> Ringkasan
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">Biaya Pemeriksaan</span>
                  <span className="text-sm font-bold text-blue-600">Rp {stats.totalExamination.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">Biaya Administrasi</span>
                  <span className="text-sm font-bold text-violet-600">Rp {stats.totalAdmin.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">Biaya Obat</span>
                  <span className="text-sm font-bold text-amber-600">Rp {stats.totalMedicine.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Total Pendapatan</span>
                  <span className="text-lg font-bold text-teal-600">Rp {stats.totalRevenue.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabel */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No. Antrian</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Pasien</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Poli</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">Tidak ada data pembayaran</td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment, i) => (
                      <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm">{i + 1}</td>
                        <td className="px-4 py-3 text-sm">{format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</td>
                        <td className="px-4 py-3 text-sm font-medium">{payment.queue?.queue_number || '-'}</td>
                        <td className="px-4 py-3 text-sm">{payment.patient_name}</td>
                        <td className="px-4 py-3 text-sm">{payment.queue?.poli?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold">Rp {(payment.total_amount || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            payment.status === 'dibayar' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {payment.status === 'dibayar' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {payment.status === 'dibayar' ? 'Dibayar' : 'Belum Bayar'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleViewDetail(payment)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                            <Eye className="h-4 w-4" />
                          </button>
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
      <AnimatePresence>
        {showDetail && selectedPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetail(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Rincian Pembayaran</h2>
                <button onClick={() => setShowDetail(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">No. Antrian</span>
                    <span className="text-sm font-semibold">{selectedPayment.queue?.queue_number || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Pasien</span>
                    <span className="text-sm font-semibold">{selectedPayment.patient_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Poli</span>
                    <span className="text-sm font-semibold">{selectedPayment.queue?.poli?.name || '-'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Biaya Pemeriksaan</span>
                    <span className="text-sm">Rp {(selectedPayment.examination_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Biaya Administrasi</span>
                    <span className="text-sm">Rp {(selectedPayment.admin_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Biaya Obat</span>
                    <span className="text-sm">Rp {(selectedPayment.medicine_total || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-teal-600">Rp {(selectedPayment.total_amount || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Status</span>
                    <span className={`text-sm font-semibold ${selectedPayment.status === 'dibayar' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {selectedPayment.status === 'dibayar' ? 'Sudah Dibayar' : 'Belum Dibayar'}
                    </span>
                  </div>
                  {selectedPayment.payment_method && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Metode Bayar</span>
                      <span className="text-sm font-semibold capitalize">{selectedPayment.payment_method}</span>
                    </div>
                  )}
                  {selectedPayment.paid_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Dibayar Pada</span>
                      <span className="text-sm">{format(new Date(selectedPayment.paid_at), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
