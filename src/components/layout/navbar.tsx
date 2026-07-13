'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, Bell, ChevronDown, User, KeyRound, LogOut, Clock } from 'lucide-react';

interface NavbarProps {
  title: string;
  user?: {
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
  };
  onMenuToggle?: () => void;
  className?: string;
}

function Navbar({ title, user, onMenuToggle, className }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log('Logout clicked');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-20 items-center justify-between border-b-2 border-slate-100 bg-white/80 px-6 backdrop-blur-md',
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="hidden items-center gap-2 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2 sm:flex">
          <Clock className="h-4 w-4 text-teal-600" />
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{timeStr}</p>
            <p className="text-[10px] text-slate-500">{dateStr}</p>
          </div>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
          </span>
        </Button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 rounded-xl border-2 border-slate-100 px-3 py-2 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-sm font-semibold text-white">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                getInitials(user?.name || 'U')
              )}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-500">{user?.role || 'Role'}</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform duration-200',
                isDropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border-2 border-slate-100 bg-white p-2 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500">{user?.email || 'email@example.com'}</p>
              </div>
              <div className="mt-2 space-y-1">
                <Link
                  href="/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <User className="h-4 w-4" />
                  Profil Saya
                </Link>
                <Link
                  href="/change-password"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <KeyRound className="h-4 w-4" />
                  Ubah Kata Sandi
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { Navbar };
export type { NavbarProps };