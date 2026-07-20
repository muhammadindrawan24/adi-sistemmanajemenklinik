'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  Plus,
  History,
  X,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { logAudit } from '@/lib/audit';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function PetugasStockPage() {
  const supabase = createClient();
  const [medicines, setMedicines] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [showStockDialog, setShowStockDialog] = React.useState(false);
  const [selectedMedicine, setSelectedMedicine] = React.useState<any>(null);
  const [stockQuantity, setStockQuantity] = React.useState(1);
  const [stockNotes, setStockNotes] = React.useState('');
  const [showHistoryDialog, setShowHistoryDialog] = React.useState(false);
  const [stockMutations, setStockMutations] = React.useState<any[]>([]);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    fetchMedicines();
  }, [supabase]);

  const fetchMedicines = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('medicines')
      .select('*, poli:poli(name)')
      .eq('is_active', true)
      .order('name');
    setMedicines(data || []);
    setLoading(false);
  };

  const filteredMedicines = medicines.filter((med) => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || med.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: medicines.length,
    lowStock: medicines.filter(m => m.stock_qty <= m.min_stock && m.stock_qty > 0).length,
    outOfStock: medicines.filter(m => m.stock_qty === 0).length,
  };

  const handleOpenStockDialog = (medicine: any) => {
    setSelectedMedicine(medicine);
    setStockQuantity(1);
    setStockNotes('');
    setShowStockDialog(true);
  };

  const handleAddStock = async () => {
    if (!selectedMedicine || stockQuantity < 1) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert stock mutation
      const { error: mutationError } = await supabase.from('stock_mutations').insert({
        medicine_id: selectedMedicine.id,
        mutation_type: 'masuk',
        quantity: stockQuantity,
        notes: stockNotes || 'Stok masuk dari petugas',
        user_id: user?.id,
      });

      if (mutationError) throw mutationError;

      // Update medicine stock
      const { error: updateError } = await supabase
        .from('medicines')
        .update({ stock_qty: selectedMedicine.stock_qty + stockQuantity })
        .eq('id', selectedMedicine.id);

      if (updateError) throw updateError;

      await logAudit('UPDATE', 'medicines', selectedMedicine.id, { stock_qty: selectedMedicine.stock_qty }, { stock_qty: selectedMedicine.stock_qty + stockQuantity });

      showToast('Stok obat berhasil ditambahkan');
      setShowStockDialog(false);
      fetchMedicines();
    } catch (error) {
      showToast('Gagal menambahkan stok', 'error');
    }
  };

  const handleViewHistory = async (medicine: any) => {
    setSelectedMedicine(medicine);
    const { data } = await supabase
      .from('stock_mutations')
      .select('*')
      .eq('medicine_id', medicine.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setStockMutations(data || []);
    setShowHistoryDialog(true);
  };

  const categoryBadge = (category: string) => {
    const map: Record<string, string> = {
      tablet: 'bg-blue-100 text-blue-700',
      kapsul: 'bg-purple-100 text-purple-700',
      sirup: 'bg-orange-100 text-orange-700',
      salep: 'bg-green-100 text-green-700',
      tetes: 'bg-cyan-100 text-cyan-700',
      gel: 'bg-teal-100 text-teal-700',
      krim: 'bg-pink-100 text-pink-700',
      injeksi: 'bg-red-100 text-red-700',
      sachet: 'bg-yellow-100 text-yellow-700',
    };
    return map[category] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[100] rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl backdrop-blur-sm ${
              toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}
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
              <Package className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Stok Obat</h1>
              <p className="text-white/60 text-xs mt-0.5">Input stok masuk dan lihat riwayat mutasi</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total Obat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lowStock}</p>
                  <p className="text-xs text-slate-500">Stok Menipis</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.outOfStock}</p>
                  <p className="text-xs text-slate-500">Stok Habis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama obat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full sm:w-40">
                <option value="">Semua Kategori</option>
                <option value="tablet">Tablet</option>
                <option value="kapsul">Kapsul</option>
                <option value="sirup">Sirup</option>
                <option value="salep">Salep</option>
                <option value="tetes">Tetes</option>
                <option value="gel">Gel</option>
                <option value="krim">Krim</option>
                <option value="injeksi">Injeksi</option>
                <option value="sachet">Sachet</option>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama Obat</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kategori</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Poli</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Stok</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        Tidak ada data obat
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med, i) => (
                      <tr key={med.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{med.name}</div>
                          <div className="text-xs text-slate-500">{med.unit}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadge(med.category)}`}>
                            {med.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{med.poli?.name || 'Semua Poli'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${med.stock_qty <= med.min_stock ? 'text-red-600' : 'text-slate-900'}`}>
                            {med.stock_qty} {med.unit}
                          </span>
                          {med.stock_qty <= med.min_stock && med.stock_qty > 0 && (
                            <span className="ml-2 text-xs text-yellow-600">(Menipis)</span>
                          )}
                          {med.stock_qty === 0 && (
                            <span className="ml-2 text-xs text-red-600">(Habis)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenStockDialog(med)}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"
                              title="Tambah Stok"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleViewHistory(med)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                              title="Riwayat"
                            >
                              <History className="h-4 w-4" />
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

      {/* Add Stock Dialog */}
      <AnimatePresence>
        {showStockDialog && selectedMedicine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowStockDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Tambah Stok</h2>
                <button onClick={() => setShowStockDialog(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium">{selectedMedicine.name}</p>
                <p className="text-xs text-slate-500">Stok saat ini: {selectedMedicine.stock_qty} {selectedMedicine.unit}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Jumlah Stok Masuk *</label>
                  <Input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)}
                    min={1}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Catatan</label>
                  <Input
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                    placeholder="Contoh: Stok dari supplier"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => setShowStockDialog(false)} variant="outline" className="flex-1">
                    Batal
                  </Button>
                  <Button onClick={handleAddStock} className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500">
                    <ArrowDown className="h-4 w-4 mr-2" /> Tambah Stok
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Dialog */}
      <AnimatePresence>
        {showHistoryDialog && selectedMedicine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowHistoryDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Riwayat Stok</h2>
                <button onClick={() => setShowHistoryDialog(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium">{selectedMedicine.name}</p>
                <p className="text-xs text-slate-500">Stok saat ini: {selectedMedicine.stock_qty} {selectedMedicine.unit}</p>
              </div>

              {stockMutations.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Belum ada riwayat mutasi stok</p>
              ) : (
                <div className="space-y-3">
                  {stockMutations.map((mutation) => (
                    <div key={mutation.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          mutation.mutation_type === 'masuk' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {mutation.mutation_type === 'masuk' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {mutation.mutation_type === 'masuk' ? '+' : '-'} {mutation.quantity} {selectedMedicine.unit}
                          </p>
                          <p className="text-xs text-slate-500">{mutation.notes || '-'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(new Date(mutation.created_at), 'dd MMM, HH:mm', { locale: id })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
