import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus, FileText, History } from 'lucide-react';
import SPGeneratorDialog from '@/components/SPGeneratorDialog';
import { ShowMoreList } from '@/components/ShowMoreList';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

// Auto-determine SP status from total discipline points
// >= 10 -> SP-3, >= 7 -> SP-2, >= 5 -> SP-1, else Non-SP
const computeSpStatus = (totalPoints: number): string => {
  if (totalPoints >= 10) return 'SP-3';
  if (totalPoints >= 7) return 'SP-2';
  if (totalPoints >= 5) return 'SP-1';
  return 'Non-SP';
};

const isSpStatus = (status?: string | null) =>
  status === 'SP-1' || status === 'SP-2' || status === 'SP-3';

export default function PunishmentPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { getPerm, customRoles } = useMenuPermissions();
  const isCustom = !!role && customRoles.some((c) => c.code === role);
  const canManage =
    role === 'admin' ||
    role === 'management' ||
    role === 'pic' ||
    (role ? getPerm(role, 'personalia/punishment', 'can_create', isCustom) : false);
  const [records, setRecords] = useState<any[]>([]);
  const [spHistory, setSpHistory] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState({ user_id: '', points_added: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [spOpen, setSpOpen] = useState(false);
  const [spDefaults, setSpDefaults] = useState<{ userId: string; name: string; position: string; points: number; reason: string; status: string }>({
    userId: '', name: '', position: '', points: 0, reason: '', status: 'SP-1',
  });

  // Live preview of resulting SP status when filling the punishment form
  const previewStatus = useMemo(() => {
    const prof: any = profiles.find((p: any) => p.user_id === form.user_id);
    const current = prof?.discipline_points || 0;
    const added = parseInt(form.points_added) || 0;
    return { total: current + added, status: computeSpStatus(current + added) };
  }, [form.user_id, form.points_added, profiles]);

  const openGenerator = (overrides?: Partial<typeof spDefaults>) => {
    setSpDefaults({
      userId: overrides?.userId ?? '',
      name: overrides?.name ?? '',
      position: overrides?.position ?? '',
      points: overrides?.points ?? 0,
      reason: overrides?.reason ?? '',
      status: overrides?.status ?? 'SP-1',
    });
    setSpOpen(true);
  };

  const fetchData = async () => {
    const { data } = await supabase.from('punishments').select('*').order('issued_date', { ascending: false }).limit(200);
    if (data) setRecords(data);
    const { data: p } = await supabase.from('profiles').select('user_id, full_name, job_title, discipline_points, warning_letter_status').order('full_name');
    if (p) setProfiles(p);
    const { data: h } = await supabase.from('sp_history').select('*').order('issued_date', { ascending: false }).limit(200);
    if (h) setSpHistory(h);
  };

  useEffect(() => { fetchData(); }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const pointsToAdd = parseInt(form.points_added) || 0;

    // Get current points first to compute new SP status
    const { data: currentProfile } = await supabase.from('profiles').select('discipline_points').eq('user_id', form.user_id).maybeSingle();
    const newPoints = (currentProfile?.discipline_points || 0) + pointsToAdd;
    const newStatus = computeSpStatus(newPoints);

    // Insert punishment record
    const { error } = await supabase.from('punishments').insert({
      user_id: form.user_id,
      points_added: pointsToAdd,
      new_sp_status: newStatus,
      reason: form.reason,
      issued_by: user.id,
    });

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      await supabase.from('profiles').update({
        discipline_points: newPoints,
        warning_letter_status: newStatus,
      }).eq('user_id', form.user_id);

      toast({
        title: 'Berhasil',
        description: `Punishment tercatat. Total poin: ${newPoints} → Status: ${newStatus}`,
      });
      setForm({ user_id: '', points_added: '', reason: '' });
      fetchData();
    }
    setSubmitting(false);
  };

  const profileFullMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <AlertTriangle className="w-7 h-7" /> Punishment & SP
          </h1>
          {canManage && (
            <Button onClick={() => openGenerator()} variant="outline">
              <FileText className="w-4 h-4 mr-2" /> Generator SP
            </Button>
          )}
        </div>

        {canManage && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Input Punishment</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Karyawan</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p: any) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name} {p.discipline_points ? `(${p.discipline_points} poin)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poin Ditambahkan</Label>
                  <Input type="number" min="0" value={form.points_added} onChange={(e) => setForm({ ...form, points_added: e.target.value })} required />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Status SP Otomatis</Label>
                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 border border-border">
                    <Badge variant={isSpStatus(previewStatus.status) ? 'destructive' : 'secondary'}>
                      {previewStatus.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Total {previewStatus.total} poin · Aturan: 5+ → SP-1, 7+ → SP-2, 10+ → SP-3
                    </span>
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Alasan</Label>
                  <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Alasan punishment..." required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={submitting || !form.user_id} className="w-full">
                    <Plus className="w-4 h-4 mr-1" /> Simpan Punishment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Punishment</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 font-medium">Karyawan</th>
                    <th className="p-3 font-medium">Poin</th>
                    <th className="p-3 font-medium">Status SP</th>
                    <th className="p-3 font-medium">Alasan</th>
                    {canManage && <th className="p-3 font-medium text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreList
                    items={records}
                    initial={5}
                    emptyMessage="Belum ada data punishment."
                    renderItem={(r) => {
                      const prof: any = profileFullMap.get(r.user_id);
                      const showPrint = canManage && isSpStatus(r.new_sp_status);
                      return (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">{r.issued_date}</td>
                          <td className="p-3">{prof?.full_name || '-'}</td>
                          <td className="p-3"><Badge variant="destructive">+{r.points_added}</Badge></td>
                          <td className="p-3">
                            <Badge variant={isSpStatus(r.new_sp_status) ? 'destructive' : 'secondary'}>
                              {r.new_sp_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs max-w-xs truncate">{r.reason}</td>
                          {canManage && (
                            <td className="p-3 text-right">
                              {showPrint ? (
                                <Button size="sm" variant="ghost" onClick={() => openGenerator({
                                  userId: r.user_id,
                                  name: prof?.full_name || '',
                                  position: prof?.job_title || '',
                                  points: prof?.discipline_points || r.points_added || 0,
                                  reason: r.reason,
                                  status: r.new_sp_status,
                                })}>
                                  <FileText className="w-4 h-4 mr-1" /> Cetak SP
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    }}
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" /> Riwayat Penerbitan SP
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal Cetak</th>
                    <th className="p-3 font-medium">Karyawan</th>
                    <th className="p-3 font-medium">Level SP</th>
                    <th className="p-3 font-medium">Total Poin</th>
                    <th className="p-3 font-medium">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreList
                    items={spHistory}
                    initial={5}
                    emptyMessage="Belum ada SP yang diterbitkan."
                    renderItem={(h) => {
                      const prof: any = profileFullMap.get(h.user_id);
                      return (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">{h.issued_date}</td>
                          <td className="p-3">{prof?.full_name || '-'}</td>
                          <td className="p-3"><Badge variant="destructive">{h.sp_level}</Badge></td>
                          <td className="p-3">{h.total_points}</td>
                          <td className="p-3 text-xs max-w-xs truncate">{h.reason}</td>
                        </tr>
                      );
                    }}
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <SPGeneratorDialog
        open={spOpen}
        onOpenChange={setSpOpen}
        userId={spDefaults.userId}
        defaultName={spDefaults.name}
        defaultPosition={spDefaults.position}
        defaultPoints={spDefaults.points}
        defaultReason={spDefaults.reason}
        defaultSpStatus={spDefaults.status}
        onPrinted={fetchData}
      />
    </AppLayout>
  );
}
