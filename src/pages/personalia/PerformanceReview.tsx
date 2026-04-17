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
import { ClipboardList, Plus } from 'lucide-react';

export default function PerformanceReviewPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management' || role === 'pic';
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState({ user_id: '', review_period: '', score: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setRecords(data);
    if (canManage) {
      const { data: p } = await supabase.from('profiles').select('user_id, full_name').order('full_name');
      if (p) setProfiles(p);
    }
  };

  useEffect(() => { fetchData(); }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('performance_reviews').insert({
      user_id: form.user_id,
      reviewer_id: user.id,
      review_period: form.review_period,
      score: parseInt(form.score) || 0,
      notes: form.notes,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Penilaian tersimpan.' });
      setForm({ user_id: '', review_period: '', score: '', notes: '' });
      fetchData();
    }
    setSubmitting(false);
  };

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  const scoreColor = (s: number) => {
    if (s >= 80) return 'default';
    if (s >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <ClipboardList className="w-7 h-7" /> Penilaian Kinerja
        </h1>

        {canManage && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Input Penilaian</CardTitle></CardHeader>
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
                  <Label>Periode</Label>
                  <Input placeholder="Contoh: Q1 2026" value={form.review_period} onChange={(e) => setForm({ ...form, review_period: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Skor (0-100)</Label>
                  <Input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Evaluasi kinerja..." />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={submitting || !form.user_id} className="w-full">
                    <Plus className="w-4 h-4 mr-1" /> Simpan Penilaian
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Penilaian</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Karyawan</th>
                    <th className="p-3 font-medium">Periode</th>
                    <th className="p-3 font-medium">Skor</th>
                    <th className="p-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{profileMap.get(r.user_id) || '-'}</td>
                      <td className="p-3">{r.review_period}</td>
                      <td className="p-3"><Badge variant={scoreColor(r.score)}>{r.score}</Badge></td>
                      <td className="p-3 text-xs max-w-xs truncate">{r.notes || '-'}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada data penilaian.</td></tr>
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
