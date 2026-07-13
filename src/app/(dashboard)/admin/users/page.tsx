'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Plus, Pencil, Trash2, Shield, Eye, Phone, MapPin, Calendar, Droplets, AlertTriangle, Stethoscope } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { motion as m } from 'framer-motion';

const userSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  role: z.enum(['admin', 'petugas', 'dokter', 'pasien']),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});

type UserFormData = z.infer<typeof userSchema>;

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export default function UserManagement() {
  const supabase = createClient();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('semua');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [detailUser, setDetailUser] = React.useState<any>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<UserFormData>();

  const closeAllDialogs = () => {
    setDialogOpen(false);
    setDeleteConfirm(null);
    setDetailUser(null);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });

    const userIds = usersData?.map((u: any) => u.id).filter(Boolean) || [];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, gender, phone, address, avatar_url').in('user_id', userIds);
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });
    }

    const enriched = usersData?.map((u: any) => ({
      ...u,
      profiles: profileMap[u.id] || { full_name: '-', gender: null },
    })) || [];

    setUsers(enriched);
    setLoading(false);
  };

  React.useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter((u) => {
    const fullName = u.profiles?.full_name || '';
    const matchSearch = fullName.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'semua' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openAddDialog = () => {
    closeAllDialogs();
    reset({ name: '', email: '', role: 'pasien', password: '', phone: '', address: '' });
    setEditUser(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: any) => {
    closeAllDialogs();
    setEditUser(user);
    reset({ name: user.profiles?.full_name || '', email: user.email, role: user.role, password: '', phone: user.profiles?.phone || '', address: user.profiles?.address || '' });
    setDialogOpen(true);
  };

  const onSubmit = async (data: UserFormData) => {
    setSaving(true);
    try {
      if (editUser) {
        const updateData: any = { email: data.email, role: data.role };
        const { error } = await supabase.from('users').update(updateData).eq('id', editUser.id);
        if (error) throw error;
        // Update profile name, phone, and address
        const { error: profileError } = await supabase.from('profiles').update({ full_name: data.name, phone: data.phone || null, address: data.address || null }).eq('user_id', editUser.id);
        if (profileError) throw profileError;
        showToast('User berhasil diperbarui');
      } else {
        // Create auth user then insert profile
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password || 'password123',
          options: { data: { name: data.name, role: data.role } },
        });
        if (authError) throw authError;

        if (authData.user) {
          await supabase.from('users').insert({
            id: authData.user.id,
            email: data.email,
            role: data.role,
            is_active: true,
          });
          await supabase.from('profiles').insert({
            user_id: authData.user.id,
            full_name: data.name,
            phone: data.phone || null,
            address: data.address || null,
          });
        }
        showToast('User berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      showToast('Gagal menghapus user', 'error');
    } else {
      showToast('User berhasil dihapus');
      fetchUsers();
    }
    setDeleteConfirm(null);
  };

  const fetchDetailUser = async (user: any) => {
    closeAllDialogs();
    setDetailLoading(true);
    setDetailUser(user);

    // Fetch extra data based on role
    if (user.role === 'pasien') {
      const { data: patientData } = await supabase.from('patients').select('*').eq('user_id', user.id).single();
      if (patientData) {
        setDetailUser((prev: any) => ({ ...prev, patient: patientData }));
      }
    } else if (user.role === 'dokter') {
      const { data: doctorData } = await supabase.from('doctors').select('*').eq('user_id', user.id).single();
      if (doctorData) {
        setDetailUser((prev: any) => ({ ...prev, doctor: doctorData }));
      }
    }
    setDetailLoading(false);
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700',
      petugas: 'bg-blue-100 text-blue-700',
      dokter: 'bg-teal-100 text-teal-700',
      pasien: 'bg-slate-100 text-slate-700 dark:text-slate-300',
    };
    return map[role] || 'bg-slate-100 text-slate-700 dark:text-slate-300';
  };

  const roles = ['semua', 'admin', 'petugas', 'dokter', 'pasien'];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manajemen User</h1>
          <p className="text-slate-500 mt-1">Kelola semua pengguna sistem.</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah User
        </Button>
      </motion.div>

      {/* Role Tabs */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${roleFilter === r ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900'}`}
            >
              {r === 'semua' ? 'Semua' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:bg-slate-900">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Jenis Kelamin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Dibuat</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      </tr>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Tidak ada data user</td></tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 dark:bg-slate-900 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                              {user.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.profiles?.full_name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.profiles?.gender === 'laki_laki' ? 'Laki-laki' : user.profiles?.gender === 'perempuan' ? 'Perempuan' : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(user.role)}`}>
                            <Shield className="h-3 w-3" />
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {format(new Date(user.created_at), 'dd MMM yyyy', { locale: id })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => fetchDetailUser(user)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Lihat Detail">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => openEditDialog(user)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => { closeAllDialogs(); setDeleteConfirm(user.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeAllDialogs(); else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
          </DialogHeader>
          <form key={dialogOpen ? (editUser?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-3" autoComplete="off">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama</label>
              <Input {...register('name', { required: 'Nama wajib diisi' })} placeholder="Nama lengkap" className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input {...register('email', { required: 'Email wajib diisi' })} type="email" placeholder="email@contoh.com" className="mt-1" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
              <Select {...register('role')} className="mt-1">
                <option value="admin">Admin</option>
                <option value="petugas">Petugas</option>
                <option value="dokter">Dokter</option>
                <option value="pasien">Pasien</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">No. HP</label>
              <Input {...register('phone')} type="tel" placeholder="08xxxxxxxxxx" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
              <Input {...register('address')} placeholder="Alamat lengkap" className="mt-1" />
            </div>
            {!editUser && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <Input {...register('password', { minLength: { value: 6, message: 'Minimal 6 karakter' } })} type="password" placeholder="Password (default: password123)" className="mt-1" />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : editUser ? 'Simpan Perubahan' : 'Tambah User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) closeAllDialogs(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-2">Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeAllDialogs}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail User Dialog */}
      <Dialog open={!!detailUser} onOpenChange={(open) => { if (!open) closeAllDialogs(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pengguna</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : detailUser && (
            <div className="space-y-4 mt-2">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700">
                  {detailUser.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{detailUser.profiles?.full_name || '-'}</p>
                  <p className="text-sm text-slate-500">{detailUser.email}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${roleBadge(detailUser.role)}`}>
                    {detailUser.role}
                  </span>
                </div>
              </div>

              {/* Profile Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">No. HP</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.profiles?.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                  <Shield className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Jenis Kelamin</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.profiles?.gender === 'laki_laki' ? 'Laki-laki' : detailUser.profiles?.gender === 'perempuan' ? 'Perempuan' : '-'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400">Alamat</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.profiles?.address || '-'}</p>
                </div>
              </div>

              {/* Patient-specific data */}
              {detailUser.role === 'pasien' && detailUser.patient && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Data Pasien</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-xs text-blue-500">No. Rekam Medis</p>
                      <p className="text-sm font-bold text-blue-700">{detailUser.patient.medical_record_number || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-400">Tanggal Lahir</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.patient.date_of_birth || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                      <Droplets className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-400">Golongan Darah</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.patient.blood_type || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-400">Alergi</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.patient.allergies || '-'}</p>
                      </div>
                    </div>
                  </div>
                  {detailUser.patient.emergency_contact && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <Phone className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-amber-500">Kontak Darurat</p>
                        <p className="text-sm font-medium text-amber-700">{detailUser.patient.emergency_contact}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Doctor-specific data */}
              {detailUser.role === 'dokter' && detailUser.doctor && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Data Dokter</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl">
                      <p className="text-xs text-teal-500">Spesialisasi</p>
                      <p className="text-sm font-bold text-teal-700">{detailUser.doctor.specialty || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                      <Stethoscope className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-400">No. SIP</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.doctor.license_number || '-'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">NIP</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{detailUser.doctor.nip || '-'}</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">Status</p>
                      <p className={`text-sm font-bold ${detailUser.doctor.is_available ? 'text-emerald-600' : 'text-red-600'}`}>{detailUser.doctor.is_available ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                  </div>
                  {detailUser.doctor.bio && (
                    <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">Bio</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{detailUser.doctor.bio}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setDetailUser(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
