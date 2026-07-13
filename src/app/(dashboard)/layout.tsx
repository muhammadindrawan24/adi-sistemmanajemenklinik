'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/dashboard-layout';
import { HeartPulse } from 'lucide-react';
import type { UserRole } from '@/types/database';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = React.useState(true);
  const [role, setRole] = React.useState<UserRole>('pasien');
  const [userName, setUserName] = React.useState('');
  const supabase = createClient();

  React.useEffect(() => {
    const checkAuth = async () => {
      // Force fresh auth check (not cached)
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      // Fetch user role directly from users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      // Fetch profile name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (userProfile) {
        const userRole = userProfile.role as UserRole;
        setRole(userRole);
        setUserName(profileData?.full_name || user.email || 'User');

        // If user is on wrong dashboard, redirect to correct one
        const currentBase = '/' + pathname.split('/')[1];
        const correctBase = `/${userRole}`;
        if (currentBase !== correctBase && currentBase !== '/monitor' && currentBase !== '/profile') {
          router.replace(correctBase);
          return;
        }
      } else {
        // No user row found - redirect to login
        setRole('pasien');
        setUserName(user.email || 'User');
      }
      setLoading(false);
    };

    checkAuth();
  }, [supabase, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
            <HeartPulse className="h-8 w-8 text-white animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-lg font-semibold text-slate-800">KlinikSehat</h2>
            <p className="text-sm text-slate-500">Memuat data...</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-teal-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout role={role} userName={userName}>
      {children}
    </DashboardLayout>
  );
}
