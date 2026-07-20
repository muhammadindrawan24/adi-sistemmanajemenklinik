'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  Plus,
  Search,
  Edit,
  Trash2,
  Filter,
  AlertTriangle,
  Package,
  X,
  Save,
  History,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { logAudit } from '@/lib/audit';

const medicineSchema = z.object({
  name: z.string().min(1, 'Nama obat wajib diisi'),
  category: z.enum(['tablet', 'kapsul', 'sirup', 'salep', 'tetes', 'gel', 'krim', 'injeksi', 'sachet']),
  poli_id: z.string().optional(),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  buy_price: z.number().min(0, 'Harga beli minimal 0'),
  sell_price: z.number().min(0, 'Harga jual minimal 0'),
  stock_qty: z.number().min(0, 'Stok minimal 0'),
  min_stock: z.number().min(0, 'Stok minimum minimal 0'),
  expiry_date: z.string().optional(),
});

type MedicineFormData = z.infer<typeof medicineSchema>;

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function MedicinesPage() {
  const supabase = createClient();
  const [medicines, setMedicines] = React.useState<any[]>([]);
  const [poli, setPoli] = React.useState<any[]>([]);
  const [stockMutations, setStockMutations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [poliFilter, setPoliFilter] = React.useState('');
  const [showDialog, setShowDialog] = React.useState(false);
  const [showMutationDialog, setShowMutationDialog] = React.useState(false);
  const [editingMedicine, setEditingMedicine] = React.useState<any>(null);
  const [selectedMedicine, setSelectedMedicine] = React.useState<any>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema),
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: medicinesData }, { data: poliData }] = await Promise.all([
      supabase.from('medicines').select('*, poli:poli(name)').order('name'),
      supabase.from('poli').select('id, name').order('name'),
    ]);
    setMedicines(medicinesData || []);
    setPoli(poliData || []);
    setLoading(false);
  };

  const fetchStockMutations = async (medicineId: string) => {
    const { data } = await supabase
      .from('stock_mutations')
      .select('*, users:user_id(full_name)')
      .eq('medicine_id', medicineId)
      .order('created_at', { ascending: false })
      .limit(10);
    setStockMutations(data || []);
  };

  const filteredMedicines = medicines.filter((med) => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || med.category === categoryFilter;
    const matchesPoli = !poliFilter || med.poli_id === poliFilter;
    return matchesSearch && matchesCategory && matchesPoli;
  });

  const onSubmit = async (data: MedicineFormData) => {
    try {
      if (editingMedicine) {
        const { error } = await supabase
          .from('medicines')
          .update({
            name: data.name,
            category: data.category,
            poli_id: data.poli_id || null,
            unit: data.unit,
            buy_price: data.buy_price,
            sell_price: data.sell_price,
            stock_qty: data.stock_qty,
            min_stock: data.min_stock,
            expiry_date: data.expiry_date || null,
          })
          .eq('id', editingMedicine.id);

        if (error) throw error;
        await logAudit('UPDATE', 'medicines', editingMedicine.id, editingMedicine, data);
        showToast('Obat berhasil diperbarui');
      } else {
        const { error } = await supabase.from('medicines').insert({
          name: data.name,
          category: data.category,
          poli_id: data.poli_id || null,
          unit: data.unit,
          buy_price: data.buy_price,
          sell_price: data.sell_price,
          stock_qty: data.stock_qty,
          min_stock: data.min_stock,
          expiry_date: data.expiry_date || null,
        });

        if (error) throw error;
        await logAudit('INSERT', 'medicines', '', null, data);
        showToast('Obat berhasil ditambahkan');
      }
      setShowDialog(false);
      setEditingMedicine(null);
      reset();
      fetchData();
    } catch (error) {
      showToast('Gagal menyimpan obat', 'error');
    }
  };

  const handleEdit = (medicine: any) => {
    setEditingMedicine(medicine);
    setValue('name', medicine.name);
    setValue('category', medicine.category);
    setValue('poli_id', medicine.poli_id || '');
    setValue('unit', medicine.unit);
    setValue('buy_price', medicine.buy_price);
    setValue('sell_price', medicine.sell_price);
    setValue('stock_qty', medicine.stock_qty);
    setValue('min_stock', medicine.min_stock);
    setValue('expiry_date', medicine.expiry_date || '');
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus obat ini?')) return;
    try {
      const { error } = await supabase.from('medicines').delete().eq('id', id);
      if (error) throw error;
      await logAudit('DELETE', 'medicines', id);
      showToast('Obat berhasil dihapus');
      fetchData();
    } catch (error) {
      showToast('Gagal menghapus obat', 'error');
    }
  };

  const handleViewMutations = async (medicine: any) => {
    setSelectedMedicine(medicine);
    await fetchStockMutations(medicine.id);
    setShowMutationDialog(true);
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
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Pill className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Manajemen Stok Obat</h1>
                <p className="text-white/60 text-xs mt-0.5">Kelola data obat dan stok farmasi</p>
              </div>
            </div>
            <Button onClick={() => { setEditingMedicine(null); reset(); setShowDialog(true); }} className="bg-white/15 hover:bg-white/25 text-white border-white/20">
              <Plus className="h-4 w-4 mr-2" /> Tambah Obat
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{medicines.length}</p>
                  <p className="text-xs text-slate-500">Total Obat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{medicines.filter(m => m.stock_qty > m.min_stock).length}</p>
                  <p className="text-xs text-slate-500">Stok Aman</p>
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
                  <p className="text-2xl font-bold">{medicines.filter(m => m.stock_qty <= m.min_stock && m.stock_qty > 0).length}</p>
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
                  <p className="text-2xl font-bold">{medicines.filter(m => m.stock_qty === 0).length}</p>
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
              <Select value={poliFilter} onChange={(e) => setPoliFilter(e.target.value)} className="w-full sm:w-40">
                <option value="">Semua Poli</option>
                {poli.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Harga Jual</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Stok</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
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
                        <td className="px-4 py-3 text-sm font-medium">Rp {med.sell_price.toLocaleString('id-ID')}</td>
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
                            <button onClick={() => handleViewMutations(med)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Riwayat Stok">
                              <History className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleEdit(med)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Edit">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(med.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Hapus">
                              <Trash2 className="h-4 w-4" />
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

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">{editingMedicine ? 'Edit Obat' : 'Tambah Obat Baru'}</h2>
                <button onClick={() => setShowDialog(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Nama Obat *</label>
                  <Input {...register('name')} placeholder="Contoh: Paracetamol 500mg" className="mt-1" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Kategori *</label>
                    <Select {...register('category')} className="mt-1">
                      <option value="">Pilih Kategori</option>
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
                    {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Poli</label>
                    <Select {...register('poli_id')} className="mt-1">
                      <option value="">Semua Poli</option>
                      {poli.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Satuan *</label>
                    <Input {...register('unit')} placeholder="Contoh: strip, botol, tube" className="mt-1" />
                    {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tanggal Kadaluarsa</label>
                    <Input type="date" {...register('expiry_date')} className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Harga Beli *</label>
                    <Input type="number" {...register('buy_price', { valueAsNumber: true })} className="mt-1" />
                    {errors.buy_price && <p className="text-xs text-red-500 mt-1">{errors.buy_price.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Harga Jual *</label>
                    <Input type="number" {...register('sell_price', { valueAsNumber: true })} className="mt-1" />
                    {errors.sell_price && <p className="text-xs text-red-500 mt-1">{errors.sell_price.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Stok Saat Ini *</label>
                    <Input type="number" {...register('stock_qty', { valueAsNumber: true })} className="mt-1" />
                    {errors.stock_qty && <p className="text-xs text-red-500 mt-1">{errors.stock_qty.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Stok Minimum *</label>
                    <Input type="number" {...register('min_stock', { valueAsNumber: true })} className="mt-1" />
                    {errors.min_stock && <p className="text-xs text-red-500 mt-1">{errors.min_stock.message}</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
                  <Button type="submit" className="bg-gradient-to-r from-teal-500 to-emerald-500">
                    <Save className="h-4 w-4 mr-2" />
                    {editingMedicine ? 'Simpan Perubahan' : 'Tambah Obat'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Mutations Dialog */}
      <AnimatePresence>
        {showMutationDialog && selectedMedicine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowMutationDialog(false)}
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
                <button onClick={() => setShowMutationDialog(false)} className="p-2 rounded-lg hover:bg-slate-100">
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
                      <div>
                        <p className="text-sm font-medium">
                          {mutation.mutation_type === 'masuk' ? '+' : '-'} {mutation.quantity} {selectedMedicine.unit}
                        </p>
                        <p className="text-xs text-slate-500">{mutation.notes || '-'}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        mutation.mutation_type === 'masuk' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {mutation.mutation_type}
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
