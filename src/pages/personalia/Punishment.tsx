import { useEffect, useState } from 'react';
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
import { AlertTriangle, Plus, FileText } from 'lucide-react';
import SPGeneratorDialog from '@/components/SPGeneratorDialog';

export default function PunishmentPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management' || role === 'pic';
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState({ user_id: '', points_added: '', new_sp_status: 'Non-SP', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [spOpen, setSpOpen] = useState(false);
  const [spDefaults, setSpDefaults] = useState<{ name: string; position: string; points: number; reason: string; status: string }>({
    name: '', position: '', points: 0, reason: '', status: 'SP-1',
  });

  const openGenerator = (overrides?: Partial<typeof spDefaults>) => {
    setSpDefaults({
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
  };

  useEffect(() => { fetchData(); }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const pointsToAdd = parseInt(form.points_added) || 0;

    // Insert punishment record
    const { error } = await supabase.from('punishments').insert({
      user_id: form.user_id,
      points_added: pointsToAdd,
      new_sp_status: form.new_sp_status,
      reason: form.reason,
      issued_by: user.id,
    });

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      // Update profile discipline_points and SP status
      const { data: currentProfile } = await supabase.from('profiles').select('discipline_points').eq('user_id', form.user_id).maybeSingle();
      const newPoints = (currentProfile?.discipline_points || 0) + pointsToAdd;
      await supabase.from('profiles').update({
        discipline_points: newPoints,
        warning_letter_status: form.new_sp_status,
      }).eq('user_id', form.user_id);

      toast({ title: 'Berhasil', description: 'Punishment tercatat dan profil diperbarui.' });
      setForm({ user_id: '', points_added: '', new_sp_status: 'Non-SP', reason: '' });
      fetchData();
    }
    setSubmitting(false);
  };

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
  const profileFullMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
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
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poin Ditambahkan</Label>
                  <Input type="number" min="0" value={form.points_added} onChange={(e) => setForm({ ...form, points_added: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Status SP Baru</Label>
                  <Select value={form.new_sp_status} onValueChange={(v) => setForm({ ...form, new_sp_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Non-SP">Non-SP</SelectItem>
                      <SelectItem value="SP-1">SP-1</SelectItem>
                      <SelectItem value="SP-2">SP-2</SelectItem>
                      <SelectItem value="SP-3">SP-3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
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
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{r.issued_date}</td>
                      <td className="p-3">{profileMap.get(r.user_id) || '-'}</td>
                      <td className="p-3"><Badge variant="destructive">+{r.points_added}</Badge></td>
                      <td className="p-3">{r.new_sp_status}</td>
                      <td className="p-3 text-xs max-w-xs truncate">{r.reason}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Belum ada data punishment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
