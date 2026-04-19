import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Activity, AlertCircle, Copy, KeyRound, RefreshCw, Search } from 'lucide-react';
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
  const { role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'admin' || role === 'management';

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // dialog state
  const [openLink, setOpenLink] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

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

  const isPwdReset = (l: LogRow) => l.metadata?.kind === 'password_reset_request';

  const openResetDialog = async (l: LogRow) => {
    const reqId = l.metadata?.request_id;
    const email = l.metadata?.email;
    if (!reqId || !email) return;
    setActiveRequestId(reqId);
    setActiveEmail(email);
    setGeneratedLink(null);
    setExistingStatus(null);
    setOpenLink(true);

    // Cek jika sudah pernah di-generate
    const { data } = await supabase
      .from('password_reset_requests')
      .select('reset_link, status, link_expires_at')
      .eq('id', reqId)
      .maybeSingle();
    if (data) {
      setExistingStatus(data.status);
      if (data.reset_link && data.status === 'link_generated') {
        const expired = data.link_expires_at && new Date(data.link_expires_at) < new Date();
        if (!expired) setGeneratedLink(data.reset_link);
      }
    }
  };

  const generateLink = async () => {
    if (!activeRequestId || !activeEmail) return;
    setGenerating(true);
    const redirect_to = `${window.location.origin}/reset-password`;
    const { data, error } = await supabase.functions.invoke('generate-reset-link', {
      body: { request_id: activeRequestId, email: activeEmail, redirect_to },
    });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Gagal generate link',
        description: (data as any)?.error || error?.message || 'Terjadi kesalahan',
        variant: 'destructive',
      });
      return;
    }
    setGeneratedLink((data as any).reset_link);
    setExistingStatus('link_generated');
    toast({ title: 'Link berhasil dibuat', description: 'Salin & kirim ke user.' });
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    toast({ title: 'Tersalin', description: 'Link reset password disalin ke clipboard.' });
  };

  const markCompleted = async () => {
    if (!activeRequestId) return;
    await supabase.from('password_reset_requests').update({ status: 'completed' }).eq('id', activeRequestId);
    toast({ title: 'Permintaan ditandai selesai' });
    setOpenLink(false);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
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
                    <th className="p-3 font-medium text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Memuat...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada log.</td></tr>
                  ) : (
                    filtered.map((l) => {
                      const reset = isPwdReset(l);
                      return (
                        <tr
                          key={l.id}
                          className={`border-b border-border/50 transition-colors ${
                            reset ? 'bg-destructive/10 hover:bg-destructive/15' : 'hover:bg-muted/30'
                          }`}
                        >
                          <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                            {format(new Date(l.created_at), 'dd MMM yyyy HH:mm:ss', { locale: idLocale })}
                          </td>
                          <td className="p-3 font-medium">{l.user_name}</td>
                          <td className="p-3"><Badge variant={roleColor(l.user_role) as any}>{l.user_role}</Badge></td>
                          <td className="p-3">
                            {reset ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="w-3 h-3" /> {l.module}
                              </Badge>
                            ) : (
                              <Badge variant="outline">{l.module}</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {reset ? <span className="text-destructive font-semibold">{l.action}</span> : l.action}
                          </td>
                          <td className="p-3 text-muted-foreground max-w-md">{l.description}</td>
                          <td className="p-3 text-right">
                            {reset && canManage ? (
                              <Button size="sm" variant="destructive" onClick={() => openResetDialog(l)}>
                                <KeyRound className="w-3.5 h-3.5 mr-1" /> Generate Link
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Menampilkan {filtered.length} dari {logs.length} log (maksimal 500 terbaru).</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openLink} onOpenChange={setOpenLink}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Link Reset Password
            </DialogTitle>
            <DialogDescription>
              Untuk: <span className="font-semibold text-foreground">{activeEmail}</span>
              {existingStatus === 'completed' && <span className="ml-2 text-xs">(sudah selesai)</span>}
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Klik tombol di bawah untuk membuat link reset password 1x pakai. Link berlaku selama <strong>1 jam</strong>.
                Salin & kirim ke user secara manual (WhatsApp, dll).
              </p>
              <Button onClick={generateLink} disabled={generating} className="w-full">
                {generating ? 'Memproses...' : 'Generate Link Sekarang'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/40 p-3 break-all text-xs font-mono">
                {generatedLink}
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink} className="flex-1">
                  <Copy className="w-4 h-4 mr-2" /> Salin Link
                </Button>
                <Button variant="outline" onClick={generateLink} disabled={generating}>
                  {generating ? '...' : 'Generate Ulang'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Kirim link ini ke user. Saat user membuka link, ia langsung dialihkan ke halaman ganti password.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenLink(false)}>Tutup</Button>
            {generatedLink && existingStatus !== 'completed' && (
              <Button variant="secondary" onClick={markCompleted}>Tandai Selesai</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
