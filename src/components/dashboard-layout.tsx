'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Building2,
  Calendar,
  FileText,
  ClipboardList,
  Activity,
  UserPlus,
  ListOrdered,
  ClipboardCheck,
  History,
  LogOut,
  Menu,
  X,
  HeartPulse,
  Monitor,
  ChevronRight,
  Clock,
  Moon,
  Sun,
  BedDouble,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import type { UserRole } from '@/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Manajemen User', href: '/admin/users', icon: Users },
    { label: 'Manajemen Pasien', href: '/admin/patients', icon: BedDouble },
    { label: 'Manajemen Dokter', href: '/admin/doctors', icon: Stethoscope },
    { label: 'Manajemen Poli', href: '/admin/poli', icon: Building2 },
    { label: 'Jadwal Dokter', href: '/admin/schedules', icon: Calendar },
    { label: 'Laporan', href: '/admin/reports', icon: FileText },
    { label: 'Audit Log', href: '/admin/audit-log', icon: ClipboardList },
  ],
  petugas: [
    { label: 'Dashboard', href: '/petugas', icon: LayoutDashboard },
    { label: 'Registrasi Pasien', href: '/petugas/registration', icon: UserPlus },
    { label: 'Kelola Antrian', href: '/petugas/queue', icon: ListOrdered },
  ],
  dokter: [
    { label: 'Dashboard', href: '/dokter', icon: LayoutDashboard },
    { label: 'Jadwal Saya', href: '/dokter/my-schedule', icon: Calendar },
    { label: 'Pemeriksaan', href: '/dokter/examination', icon: ClipboardCheck },
    { label: 'Rekam Medis', href: '/dokter/medical-records', icon: FileText },
  ],
  pasien: [
    { label: 'Dashboard', href: '/pasien', icon: LayoutDashboard },
    { label: 'Ambil Antrian', href: '/pasien/take-queue', icon: ListOrdered },
    { label: 'Antrian Saya', href: '/pasien/my-queue', icon: Activity },
    { label: 'Riwayat Pemeriksaan', href: '/pasien/history', icon: History },
  ],
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  petugas: 'Petugas',
  dokter: 'Dokter',
  pasien: 'Pasien',
};

const roleBadgeColors: Record<UserRole, string> = {
  admin: 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-400/30',
  petugas: 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30',
  dokter: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30',
  pasien: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
}

export function DashboardLayout({ children, role, userName }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const navItems = navByRole[role] || [];
  const supabase = createClient();

  React.useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const handleLogout = async () => {
    await logAudit('logout', 'auth', '');
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen bg-slate-50/80 dark:bg-slate-900">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col bg-gradient-to-b from-[#0c3b33] via-[#0f4a3f] to-[#0a2e28] text-white transition-transform duration-300 lg:translate-x-0 lg:static shadow-2xl shadow-teal-900/30',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg shadow-teal-500/30">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight">KlinikSehat</h1>
            <p className="text-[10px] text-teal-300/60 font-medium uppercase tracking-wider">Sistem Manajemen Klinik</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href === '/admin' || item.href === '/petugas' || item.href === '/dokter' || item.href === '/pasien'
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-sm shadow-black/10'
                    : 'text-teal-200/70 hover:bg-white/[0.06] hover:text-white'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-r-full" />
                )}
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-teal-400 to-emerald-500 shadow-md shadow-teal-500/20'
                    : 'bg-white/[0.06] group-hover:bg-white/[0.1]'
                )}>
                  <item.icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-teal-300/70 group-hover:text-white')} />
                </div>
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-teal-300/50" />}
              </Link>
            );
          })}
        </nav>

        {/* Monitor link */}
        <div className="px-3 pb-2">
          <Link
            href="/monitor"
            target="_blank"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-teal-300/50 hover:bg-white/[0.06] hover:text-white transition-all duration-200"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] group-hover:bg-white/[0.1] transition-all">
              <Monitor className="h-4 w-4" />
            </div>
            <span>Monitor Antrian</span>
          </Link>
        </div>

        {/* Dark Mode Toggle removed from sidebar */}
        {/* User section */}
        <div className="border-t border-white/[0.06] p-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/[0.06] transition-all duration-200 group">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-xs font-bold text-white shadow-md shadow-teal-500/20">
                {getInitials(userName)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-[#0f4a3f]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate text-white/90">{userName}</p>
              <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mt-0.5', roleBadgeColors[role])}>
                {roleLabels[role]}
              </span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 mt-1 rounded-xl px-3 py-2 text-[13px] font-medium text-teal-300/50 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {/* Clock */}
            <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 shadow-sm sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/30">
                <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">{timeStr}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  {now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
            {/* Dark Mode Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="hidden sm:flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-10 w-10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-500" />}
              </button>
            )}
            <Link
              href="/monitor"
              target="_blank"
              className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              Monitor
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50/80 dark:bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}
