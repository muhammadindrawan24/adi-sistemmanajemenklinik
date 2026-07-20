'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Edit, Save, X, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function PolyFeesPage() {
  const supabase = createClient();
  const [polyFees, setPolyFees] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState({ examination_fee: 0, admin_fee: 0 });
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    fetchPolyFees();
  }, [supabase]);

  const fetchPolyFees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('poly_fees')
      .select('*, poli:poli(id, name, initial)')
      .order('poli(name)');
    setPolyFees(data || []);
    setLoading(false);
  };

  const handleEdit = (fee: any) => {
    setEditingId(fee.id);
    setEditValues({
      examination_fee: fee.examination_fee,
      admin_fee: fee.admin_fee,
    });
  };

  const handleSave = async (id: string) => {
    try {
      const oldData = polyFees.find(f => f.id === id);
      const { error } = await supabase
        .from('poly_fees')
        .update({
          examination_fee: editValues.examination_fee,
          admin_fee: editValues.admin_fee,
        })
        .eq('id', id);

      if (error) throw error;
      await logAudit('UPDATE', 'poly_fees', id, oldData, editValues);
      setEditingId(null);
      showToast('Tarif poli berhasil diperbarui');
      fetchPolyFees();
    } catch (error) {
      showToast('Gagal memperbarui tarif', 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
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
              <Wallet className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Tarif Poli</h1>
              <p className="text-white/60 text-xs mt-0.5">Kelola biaya pemeriksaan dan administrasi per poli</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Poly Fees Cards */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-lg">
                <CardContent className="p-5">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))
          ) : polyFees.map((fee, i) => (
            <motion.div key={fee.id} custom={i} initial="hidden" animate="visible" variants={fadeIn}>
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-bold">
                        {fee.poli?.initial}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{fee.poli?.name}</h3>
                        <p className="text-xs text-slate-500">ID: {fee.poli_id?.slice(0, 8)}</p>
                      </div>
                    </div>
                    {editingId !== fee.id && (
                      <button
                        onClick={() => handleEdit(fee)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Biaya Pemeriksaan</span>
                      {editingId === fee.id ? (
                        <Input
                          type="number"
                          value={editValues.examination_fee}
                          onChange={(e) => setEditValues({ ...editValues, examination_fee: Number(e.target.value) })}
                          className="w-32 text-right h-8"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          Rp {fee.examination_fee.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Biaya Administrasi</span>
                      {editingId === fee.id ? (
                        <Input
                          type="number"
                          value={editValues.admin_fee}
                          onChange={(e) => setEditValues({ ...editValues, admin_fee: Number(e.target.value) })}
                          className="w-32 text-right h-8"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          Rp {fee.admin_fee.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Total</span>
                      <span className="text-lg font-bold text-teal-600">
                        Rp {(fee.examination_fee + fee.admin_fee).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {editingId === fee.id && (
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => handleSave(fee.id)} size="sm" className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Simpan
                      </Button>
                      <Button onClick={handleCancel} size="sm" variant="outline" className="flex-1">
                        <X className="h-4 w-4 mr-1" /> Batal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Summary */}
      {!loading && polyFees.length > 0 && (
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Rata-rata Biaya Pemeriksaan</p>
                  <p className="text-xl font-bold text-slate-900">
                    Rp {Math.round(polyFees.reduce((a, b) => a + b.examination_fee, 0) / polyFees.length).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Rata-rata Biaya Administrasi</p>
                  <p className="text-xl font-bold text-slate-900">
                    Rp {Math.round(polyFees.reduce((a, b) => a + b.admin_fee, 0) / polyFees.length).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
