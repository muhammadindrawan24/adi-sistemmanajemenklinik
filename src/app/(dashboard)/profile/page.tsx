'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Lock, Save, ArrowLeft, Camera, Shield, Calendar, Droplets, Heart, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const GENDERS = [
  { value: 'laki_laki', label: 'Laki-laki' },
  { value: 'perempuan', label: 'Perempuan' },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [role, setRole] = React.useState('');
  const [userId, setUserId] = React.useState('');

  // Profile data
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [email, setEmail] = React.useState('');

  // Patient data
  const [gender, setGender] = React.useState('');
  const [bloodType, setBloodType] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [allergies, setAllergies] = React.useState('');
  const [emergencyContact, setEmergencyContact] = React.useState('');
  const [medicalRecordNumber, setMedicalRecordNumber] = React.useState('');

  // Password
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      setUserId(user.id);
      setEmail(user.email || '');

      // Fetch user role
      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
      if (userData) setRole(userData.role);

      // Fetch profile
      const { data: profileData } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (profileData) {
        setFullName(profileData.full_name || '');
        setPhone(profileData.phone || '');
        setAddress(profileData.address || '');
        setGender(profileData.gender || '');
      }

      // If pasien, fetch patient data
      if (userData?.role === 'pasien') {
        const { data: patientData } = await supabase.from('patients').select('*').eq('user_id', user.id).single();
        if (patientData) {
          setBloodType(patientData.blood_type || '');
          setBirthDate(patientData.date_of_birth || '');
          setAllergies(patientData.allergies || '');
          setEmergencyContact(patientData.emergency_contact || '');
          setMedicalRecordNumber(patientData.medical_record_number || '');
        }
      }

      setLoading(false);
    };
    fetchProfile();
  }, [supabase, router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: phone,
        address: address,
        gender: gender || null,
      }).eq('user_id', userId);
      if (error) throw error;

      // Update patient data if pasien
      if (role === 'pasien') {
        const { error: patientError } = await supabase.from('patients').update({
          blood_type: bloodType || null,
          date_of_birth: birthDate || null,
          allergies: allergies || null,
          emergency_contact: emergencyContact || null,
        }).eq('user_id', userId);
        if (patientError) throw patientError;
      }

      await logAudit('update_profile', 'profiles', userId, null, { full_name: fullName });
      showToast('Profil berhasil diperbarui');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan profil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password minimal 6 karakter', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Password tidak cocok', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await logAudit('change_password', 'auth', userId);
      showToast('Password berhasil diubah');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roleLabel = { admin: 'Administrator', petugas: 'Petugas', dokter: 'Dokter', pasien: 'Pasien' }[role] || role;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle className="inline h-4 w-4 mr-1" /> : <AlertCircle className="inline h-4 w-4 mr-1" />}
          {toast.message}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
          <p className="text-slate-500 mt-1">Kelola informasi akun Anda.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Avatar & basic info */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-3xl font-bold text-white shadow-lg">
                  {getInitials(fullName || 'U')}
                </div>
                <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-4">{fullName || 'User'}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 mt-2">
                <Shield className="h-3 w-3" /> {roleLabel}
              </span>
              <div className="mt-4 w-full space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" /> {email}
                </div>
                {phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" /> {phone}
                  </div>
                )}
                {role === 'pasien' && medicalRecordNumber && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Heart className="h-4 w-4 text-slate-400" /> RM: {medicalRecordNumber}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right — Edit form */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn} className="lg:col-span-2 space-y-6">
          {/* Profile info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-teal-600" /> Informasi Profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" className="pl-10" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={email} disabled className="pl-10 bg-slate-50" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Jenis Kelamin</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                    <option value="">Pilih</option>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Telepon</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="pl-10" />
                  </div>
                </div>
                {role === 'pasien' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">No. Rekam Medis</label>
                    <div className="relative mt-1">
                      <Heart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={medicalRecordNumber} disabled className="pl-10 bg-slate-50" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Alamat</label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap" rows={2} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none" />
                </div>
              </div>

              {/* Patient-specific fields */}
              {role === 'pasien' && (
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-teal-600" /> Data Medis
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Golongan Darah</label>
                      <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
                        <option value="">Pilih</option>
                        {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Tanggal Lahir</label>
                      <div className="relative mt-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="pl-10" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Alergi</label>
                      <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Contoh: seafood, obat tertentu" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Kontak Darurat</label>
                      <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Nama - No. Telepon" className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Profil'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Change password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-teal-600" /> Ubah Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Password Baru</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" className="pl-10" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Konfirmasi Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" className="pl-10" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} disabled={savingPassword} variant="outline" className="gap-2">
                  <Lock className="h-4 w-4" />
                  {savingPassword ? 'Menyimpan...' : 'Ubah Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
