'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Stethoscope,
  Building2,
  Calendar,
  BarChart3,
  ClipboardList,
  FileText,
  Activity,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Heart,
  Menu,
  X,
  Pill,
  CreditCard,
  Wallet,
  Package,
} from 'lucide-react';

type UserRole = 'admin' | 'petugas' | 'dokter' | 'pasien';

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const navigationConfig: Record<UserRole, NavLink[]> = {
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/users', label: 'Pengguna', icon: <Users className="h-5 w-5" /> },
    { href: '/doctors', label: 'Dokter', icon: <Stethoscope className="h-5 w-5" /> },
    { href: '/poli', label: 'Poli', icon: <Building2 className="h-5 w-5" /> },
    { href: '/schedules', label: 'Jadwal', icon: <Calendar className="h-5 w-5" /> },
    { href: '/medicines', label: 'Manajemen Stok Obat', icon: <Pill className="h-5 w-5" /> },
    { href: '/poly-fees', label: 'Tarif Poli', icon: <Wallet className="h-5 w-5" /> },
    { href: '/finance', label: 'Manajemen Keuangan', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/reports', label: 'Laporan', icon: <FileText className="h-5 w-5" /> },
    { href: '/audit-log', label: 'Audit Log', icon: <ClipboardList className="h-5 w-5" /> },
  ],
  petugas: [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/registration', label: 'Pendaftaran', icon: <FileText className="h-5 w-5" /> },
    { href: '/queue-management', label: 'Manajemen Antrian', icon: <Activity className="h-5 w-5" /> },
    { href: '/waiting-room', label: 'Ruang Tunggu', icon: <Clock className="h-5 w-5" /> },
    { href: '/payment', label: 'Fitur Pembayaran', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/stock', label: 'Stok Obat', icon: <Package className="h-5 w-5" /> },
  ],
  dokter: [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/my-schedule', label: 'Jadwal Saya', icon: <Calendar className="h-5 w-5" /> },
    { href: '/patients', label: 'Pasien', icon: <Users className="h-5 w-5" /> },
    { href: '/medical-records', label: 'Rekam Medis', icon: <FileText className="h-5 w-5" /> },
    { href: '/favorite-prescriptions', label: 'Resep Favorit', icon: <Stethoscope className="h-5 w-5" /> },
  ],
  pasien: [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/take-queue', label: 'Ambil Antrian', icon: <Activity className="h-5 w-5" /> },
    { href: '/my-queue-status', label: 'Status Antrian', icon: <Clock className="h-5 w-5" /> },
    { href: '/my-medical-records', label: 'Rekam Medis', icon: <FileText className="h-5 w-5" /> },
  ],
};

function Sidebar({ role, isOpen = true, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const navLinks = navigationConfig[role];

  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log('Logout clicked');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r-2 border-slate-100 bg-white transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b-2 border-slate-100 px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Klinik Sehat</h1>
              <p className="text-xs text-slate-500">Sistem Manajemen</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <span className={cn(isActive ? 'text-white' : 'text-slate-400')}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t-2 border-slate-100 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}

export { Sidebar };
export type { SidebarProps, UserRole };