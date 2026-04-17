import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface LogRow {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  module: string;
  action: string;
  description: string;
  metadata: any;
  created_at: string;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setLogs((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.module))).sort(), [logs]);
  const roles = useMemo(() => Array.from(new Set(logs.map((l) => l.user_role))).sort(), [logs]);

  const filtered = logs.filter((l) => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
    if (roleFilter !== 'all' && l.user_role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.user_name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const roleColor = (role: string) => {
    if (role === 'management') return 'default';
    if (role === 'pic') return 'secondary';
    return 'outline';
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 font-sans">
              <Activity className="w-7 h-7" /> Log Kegiatan
            </h1>
            <p className="text-muted-foreground mt-1">Riwayat aktivitas semua pengguna pada seluruh menu</p>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Card className="glass-card">
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari nama, aksi, deskripsi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger><SelectValue placeholder="Modul" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Modul</SelectItem>
                  {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium whitespace-nowrap">Waktu</th>
                    <th className="p-3 font-medium">Pengguna</th>
                    <th className="p-3 font-medium">Role</th>
                    <th className="p-3 font-medium">Modul</th>
                    <th className="p-3 font-medium">Aksi</th>
                    <th className="p-3 font-medium">Deskripsi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Memuat...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada log.</td></tr>
                  ) : (
                    filtered.map((l) => (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(l.created_at), 'dd MMM yyyy HH:mm:ss', { locale: idLocale })}
                        </td>
                        <td className="p-3 font-medium">{l.user_name}</td>
                        <td className="p-3"><Badge variant={roleColor(l.user_role) as any}>{l.user_role}</Badge></td>
                        <td className="p-3"><Badge variant="outline">{l.module}</Badge></td>
                        <td className="p-3">{l.action}</td>
                        <td className="p-3 text-muted-foreground max-w-md">{l.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Menampilkan {filtered.length} dari {logs.length} log (maksimal 500 terbaru).</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
