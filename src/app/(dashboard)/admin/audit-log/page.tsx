'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Search, Filter, User, Activity, Clock, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const } }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const tableRowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export default function AuditLogPage() {
  const supabase = createClient();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('semua');
  const [dateFilter, setDateFilter] = React.useState(format(new Date(), 'yyyy-MM-dd'));

  React.useEffect(() => {
    const fetchLogs = async () => {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);

      if (dateFilter) {
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('created_at', dateFilter).lt('created_at', nextDay.toISOString().split('T')[0]);
      }

      const { data } = await query;

      // Fetch profile names for user_ids
      const userIds = data?.map((l: any) => l.user_id).filter(Boolean) || [];
      const uniqueIds = [...new Set(userIds)];
      let profileMap: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }

      const enriched = data?.map((l: any) => ({
        ...l,
        user_name: profileMap[l.user_id] || 'Sistem',
        details: l.action + (l.table_name ? ` pada ${l.table_name}` : '') + (l.record_id ? ` (ID: ${l.record_id})` : ''),
      })) || [];

      setLogs(enriched);
      setLoading(false);
    };

    fetchLogs();
  }, [supabase, dateFilter]);

  const filtered = logs.filter((l) => {
    const matchSearch = l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase()) || l.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'semua' || l.action?.toLowerCase().includes(actionFilter);
    return matchSearch && matchAction;
  });

  const actionVariant = (action: string) => {
    const a = action?.toLowerCase() || '';
    if (a.includes('create') || a.includes('add') || a.includes('tambah')) return 'success';
    if (a.includes('delete') || a.includes('hapus')) return 'destructive';
    if (a.includes('update') || a.includes('edit') || a.includes('ubah')) return 'warning';
    return 'secondary';
  };

  return (
    <div className="min-h-screen space-y-6 pb-8">
      {/* Gradient Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3b33] via-[#0f4a3f] to-[#1a5c4f] p-6 text-white shadow-xl shadow-teal-900/20"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Audit Log</h1>
              <p className="text-white/60 text-xs mt-0.5">Riwayat aktivitas sistem real-time</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white/70 text-xs">
            <Activity className="h-3.5 w-3.5" />
            <span>{logs.length} log</span>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 ring-1 ring-slate-200/60 dark:ring-slate-700/60">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                <Input
                  placeholder="Cari aktivitas, pengguna, atau detail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 placeholder:text-slate-400"
                />
              </div>
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full sm:w-44 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
              >
                <option value="semua">Semua Aksi</option>
                <option value="create">Buat</option>
                <option value="update">Ubah</option>
                <option value="delete">Hapus</option>
                <option value="login">Login</option>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-44 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Log Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn}>
        <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 ring-1 ring-slate-200/60 dark:ring-slate-700/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/80">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detail</th>
                  </tr>
                </thead>
                <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-24 rounded-lg" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <ClipboardList className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data audit log</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Coba ubah filter atau kata kunci pencarian</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((log, idx) => (
                      <motion.tr
                        key={log.id}
                        variants={tableRowFade}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 dark:hover:from-indigo-950/30 dark:hover:to-purple-950/30 transition-all duration-200 group cursor-default"
                      >
                        <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                          {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: id })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 ring-2 ring-white dark:ring-slate-900 shadow-sm group-hover:scale-110 transition-transform duration-200">
                              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors duration-200">
                              {log.user_name || 'Sistem'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={actionVariant(log.action) as any}
                            className="rounded-lg px-2.5 py-0.5 text-xs font-medium"
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{log.details || '-'}</span>
                            {log.details && (
                              <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </motion.tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
