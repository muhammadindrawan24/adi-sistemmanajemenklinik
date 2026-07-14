'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Search, Filter, User } from 'lucide-react';
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
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Log</h1>
        <p className="text-slate-500 dark:text-slate-300 mt-1">Riwayat semua aktivitas sistem.</p>
      </motion.div>

      {/* Filters */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-300" />
                <Input placeholder="Cari aktivitas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full sm:w-44">
                <option value="semua">Semua Aksi</option>
                <option value="create">Buat</option>
                <option value="update">Ubah</option>
                <option value="delete">Hapus</option>
                <option value="login">Login</option>
              </Select>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full sm:w-44" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Log Table */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Waktu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Aksi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700">{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400 dark:text-slate-300">Tidak ada data audit log</td></tr>
                  ) : (
                    filtered.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300 whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: id })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                              <User className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-100">{log.user_name || 'Sistem'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={actionVariant(log.action) as any}>{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">{log.details || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
