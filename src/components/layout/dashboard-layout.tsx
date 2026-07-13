'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar, type UserRole } from './sidebar';
import { Navbar } from './navbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  title: string;
  user?: {
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
  };
  className?: string;
}

function DashboardLayout({
  children,
  role,
  title,
  user,
  className,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className={cn('flex min-h-screen bg-slate-50', className)}>
      {/* Sidebar */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Navbar */}
        <Navbar
          title={title}
          user={user}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export { DashboardLayout };
export type { DashboardLayoutProps };