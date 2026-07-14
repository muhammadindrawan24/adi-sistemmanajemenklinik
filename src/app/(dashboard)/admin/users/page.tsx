'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Plus, Pencil, Trash2, Shield, Eye, Phone, MapPin, 
  Calendar, Droplets, AlertTriangle, Stethoscope, UserPlus, 
  CheckCircle, X, Filter, MoreVertical, Mail, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';

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
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
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

  // Stats
  const stats = React.useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    petugas: users.filter(u => u.role === 'petugas').length,
    dokter: users.filter(u => u.role === 'dokter').length,
    pasien: users.filter(u => u.role === 'pasien').length,
  }), [users]);

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
        const { error: profileError } = await supabase.from('profiles').update({ full_name: data.name, phone: data.phone || null, address: data.address || null }).eq('user_id', editUser.id);
        if (profileError) throw profileError;
        showToast('User berhasil diperbarui');
      } else {
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
      admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      petugas: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      dokter: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      pasien: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    };
    return map[role] || 'bg-slate-100 text-slate-700';
  };

  const roleIcon = (role: string) => {
    const map: Record<string, { icon: any; color: string }> = {
      admin: { icon: Shield, color: 'from-purple-500 to-purple-600' },
      petugas: { icon: Users, color: 'from-blue-500 to-blue-600' },
      dokter: { icon: Stethoscope, color: 'from-emerald-500 to-teal-600' },
      pasien: { icon: UserPlus, color: 'from-slate-500 to-slate-600' },
    };
    return map[role] || map.pasien;
  };

  const roles = [
    { value: 'semua', label: 'Semua', count: stats.total },
    { value: 'admin', label: 'Admin', count: stats.admin },
    { value: 'petugas', label: 'Petugas', count: stats.petugas },
    { value: 'dokter', label: 'Dokter', count: stats.dokter },
    { value: 'pasien', label: 'Pasien', count: stats.pasien },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-[100]"
          >
            <div className={`flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-xl ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
              {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {toast.message}
            </div>
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
                <Users className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Manajemen User</h1>
                <p className="text-white/60 text-xs mt-0.5">Kelola semua pengguna sistem</p>
              </div>
            </div>
            <Button 
              onClick={openAddDialog} 
              className="gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah User</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'from-slate-500 to-slate-600', bg: 'bg-slate-50 dark:bg-slate-800' },
            { label: 'Admin', value: stats.admin, icon: Shield, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Petugas', value: stats.petugas, icon: Users, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Dokter', value: stats.dokter, icon: Stethoscope, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Pasien', value: stats.pasien, icon: UserPlus, color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
          ].map((stat, i) => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-3 border border-slate-100 dark:border-slate-700`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} shadow-sm`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Role Tabs & Search */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn} className="flex flex-col sm:flex-row gap-4">
        {/* Role Tabs */}
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.value}
              onClick={() => setRoleFilter(r.value)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                roleFilter === r.value 
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/25' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {r.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                roleFilter === r.value ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'
              }`}>
                {r.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari nama atau email..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl" 
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50">
                  <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kontak</th>
                  <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bergabung</th>
                  <th className="px-5 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50">
                      <td className="px-5 py-4"><Skeleton className="h-10 w-40" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-8 w-20" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mb-3">
                          <Users className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data user</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const roleData = roleIcon(user.role);
                    const RoleIcon = roleData.icon;
                    return (
                      <motion.tr 
                        key={user.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${roleData.color} shadow-md`}>
                              <span className="text-sm font-bold text-white">
                                {user.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.profiles?.full_name || '-'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[150px]">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${roleBadge(user.role)}`}>
                            <RoleIcon className="h-3 w-3" />
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(user.created_at), 'dd MMM yyyy', { locale: id })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => fetchDetailUser(user)} 
                              className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all" 
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => openEditDialog(user)} 
                              className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => { closeAllDialogs(); setDeleteConfirm(user.id); }} 
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeAllDialogs(); else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md">
                {editUser ? <Pencil className="h-5 w-5 text-white" /> : <UserPlus className="h-5 w-5 text-white" />}
              </div>
              <DialogTitle className="text-lg font-bold">{editUser ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
            </div>
          </DialogHeader>
          <form key={dialogOpen ? (editUser?.id || 'add') : 'closed'} onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4" autoComplete="off">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
              <Input {...register('name', { required: 'Nama wajib diisi' })} placeholder="Masukkan nama lengkap" className="mt-1.5 h-11 rounded-xl" />
              {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <Input {...register('email', { required: 'Email wajib diisi' })} type="email" placeholder="email@contoh.com" className="mt-1.5 h-11 rounded-xl" />
              {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
              <Select {...register('role')} className="mt-1.5 h-11 rounded-xl">
                <option value="admin">Admin</option>
                <option value="petugas">Petugas</option>
                <option value="dokter">Dokter</option>
                <option value="pasien">Pasien</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">No. HP</label>
                <Input {...register('phone')} type="tel" placeholder="08xxxxxxxxxx" className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat</label>
                <Input {...register('address')} placeholder="Alamat lengkap" className="mt-1.5 h-11 rounded-xl" />
              </div>
            </div>
            {!editUser && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <Input {...register('password', { minLength: { value: 6, message: 'Minimal 6 karakter' } })} type="password" placeholder="Default: password123" className="mt-1.5 h-11 rounded-xl" />
                {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password.message}</p>}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Batal</Button>
              <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
                {saving ? 'Menyimpan...' : editUser ? 'Simpan Perubahan' : 'Tambah User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) closeAllDialogs(); }}>
        <DialogContent className="rounded-2xl">
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-lg font-bold mb-2">Hapus User?</DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tindakan ini tidak dapat dibatalkan. Semua data user akan dihapus permanen.</p>
          </div>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={closeAllDialogs} className="rounded-xl flex-1">Batal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="rounded-xl flex-1">Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail User Dialog */}
      <Dialog open={!!detailUser} onOpenChange={(open) => { if (!open) closeAllDialogs(); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-bold">Detail Pengguna</DialogTitle>
            </div>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : detailUser && (
            <div className="space-y-4 mt-4">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-xl font-bold text-white shadow-lg shadow-teal-500/25">
                  {detailUser.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{detailUser.profiles?.full_name || '-'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{detailUser.email}</p>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mt-1 ${roleBadge(detailUser.role)}`}>
                    {detailUser.role}
                  </span>
                </div>
              </div>

              {/* Profile Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">No. HP</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.profiles?.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/30">
                    <Shield className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Jenis Kelamin</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.profiles?.gender === 'laki_laki' ? 'Laki-laki' : detailUser.profiles?.gender === 'perempuan' ? 'Perempuan' : '-'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Alamat</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.profiles?.address || '-'}</p>
                </div>
              </div>

              {/* Patient-specific data */}
              {detailUser.role === 'pasien' && detailUser.patient && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Data Pasien</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider">No. Rekam Medis</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mt-1">{detailUser.patient.medical_record_number || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tgl Lahir</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.patient.date_of_birth || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <Droplets className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gol. Darah</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.patient.blood_type || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Alergi</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.patient.allergies || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor-specific data */}
              {detailUser.role === 'dokter' && detailUser.doctor && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Data Dokter</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-100/50 dark:from-emerald-900/20 dark:to-teal-800/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Spesialisasi</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">{detailUser.doctor.specialty || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <Stethoscope className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">No. SIP</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detailUser.doctor.license_number || '-'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">NIP</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">{detailUser.doctor.nip || '-'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Status</p>
                      <p className={`text-sm font-bold mt-1 ${detailUser.doctor.is_available ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {detailUser.doctor.is_available ? 'Aktif' : 'Nonaktif'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setDetailUser(null)} className="rounded-xl">Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
