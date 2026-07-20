'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Search,
  Pill,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

interface PrescriptionItem {
  medicine_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  price: number;
}

export default function FavoritePrescriptionsPage() {
  const supabase = createClient();
  const [favorites, setFavorites] = React.useState<any[]>([]);
  const [medicines, setMedicines] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [favName, setFavName] = React.useState('');
  const [items, setItems] = React.useState<PrescriptionItem[]>([]);
  const [searchMedicine, setSearchMedicine] = React.useState('');
  const [processing, setProcessing] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    fetchFavorites();
    fetchMedicines();
  }, [supabase]);

  const fetchFavorites = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', user.id).single();
    if (!doctor) return;

    const { data } = await supabase
      .from('favorite_prescriptions')
      .select('*')
      .eq('doctor_id', doctor.id)
      .order('created_at', { ascending: false });

    setFavorites(data || []);
    setLoading(false);
  };

  const fetchMedicines = async () => {
    const { data } = await supabase
      .from('medicines')
      .select('*')
      .eq('is_active', true)
      .gt('stock_qty', 0)
      .order('name');
    setMedicines(data || []);
  };

  const filteredMedicines = medicines.filter((m) =>
    m.name?.toLowerCase().includes(searchMedicine.toLowerCase())
  );

  const addItem = (medicine: any) => {
    if (items.find((i) => i.medicine_id === medicine.id)) return;
    setItems([...items, {
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      dosage: '',
      frequency: '3x1',
      duration: '5 hari',
      quantity: 1,
      price: medicine.sell_price,
    }]);
    setSearchMedicine('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    if (!favName || items.length === 0) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', user.id).single();
      if (!doctor) return;

      const payload = {
        doctor_id: doctor.id,
        name: favName,
        items: items,
      };

      if (editingId) {
        await supabase.from('favorite_prescriptions').update(payload).eq('id', editingId);
      } else {
        await supabase.from('favorite_prescriptions').insert(payload);
      }

      showToast(editingId ? 'Berhasil diupdate!' : 'Berhasil disimpan!');
      setShowDialog(false);
      resetForm();
      fetchFavorites();
    } catch (error) {
      showToast('Gagal menyimpan', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('favorite_prescriptions').delete().eq('id', id);
    showToast('Berhasil dihapus');
    fetchFavorites();
  };

  const handleEdit = (fav: any) => {
    setEditingId(fav.id);
    setFavName(fav.name);
    setItems(fav.items || []);
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFavName('');
    setItems([]);
    setSearchMedicine('');
  };

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
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Stethoscope className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Resep Favorit</h1>
                <p className="text-white/60 text-xs mt-0.5">Kelola template resep yang sering digunakan</p>
              </div>
            </div>
            <Button
              onClick={() => { resetForm(); setShowDialog(true); }}
              className="bg-white/15 hover:bg-white/25 text-white border-white/20 rounded-xl gap-2"
            >
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Favorites List */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-700">
            <CardContent className="p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mx-auto mb-4">
                <Stethoscope className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada resep favorit</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Klik "Tambah" untuk membuat template resep baru</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {favorites.map((fav) => (
              <motion.div
                key={fav.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{fav.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fav.items?.length || 0} obat</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(fav)} className="h-8 w-8 p-0 rounded-lg">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(fav.id)} className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {fav.items?.slice(0, 3).map((item: PrescriptionItem, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Pill className="h-3 w-3 text-teal-500" />
                        <span className="font-medium">{item.medicine_name}</span>
                        <span className="text-slate-400">-</span>
                        <span>{item.frequency} | {item.duration}</span>
                      </div>
                    ))}
                    {(fav.items?.length || 0) > 3 && (
                      <p className="text-xs text-slate-400">+{fav.items.length - 3} obat lainnya</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-[#0c3b33] to-[#0f4a3f] p-5 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{editingId ? 'Edit Resep Favorit' : 'Tambah Resep Favorit'}</h3>
                  <button onClick={() => setShowDialog(false)} className="rounded-lg p-1 hover:bg-white/10">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Favorit</label>
                  <Input
                    value={favName}
                    onChange={(e) => setFavName(e.target.value)}
                    placeholder="Contoh: Flu dewasa"
                    className="h-10 rounded-xl"
                  />
                </div>

                {/* Add Medicine */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tambah Obat</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchMedicine}
                      onChange={(e) => setSearchMedicine(e.target.value)}
                      placeholder="Ketik nama obat..."
                      className="pl-10 h-10 rounded-xl"
                    />
                  </div>
                  {searchMedicine && (
                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl mt-1">
                      {filteredMedicines.slice(0, 5).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => addItem(m)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100">{m.name}</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">Rp {m.sell_price.toLocaleString('id-ID')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Obat Dipilih</label>
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.medicine_name}</span>
                          <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={item.frequency}
                            onChange={(e) => updateItem(idx, 'frequency', e.target.value)}
                            placeholder="3x1"
                            className="h-8 rounded-lg text-xs"
                          />
                          <Input
                            value={item.duration}
                            onChange={(e) => updateItem(idx, 'duration', e.target.value)}
                            placeholder="5 hari"
                            className="h-8 rounded-lg text-xs"
                          />
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-8 rounded-lg text-xs"
                            min={1}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-slate-200 dark:border-slate-700">
                <Button
                  onClick={handleSave}
                  disabled={processing || !favName || items.length === 0}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25"
                >
                  {processing ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
