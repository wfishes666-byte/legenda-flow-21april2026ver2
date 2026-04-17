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
import { Megaphone, Plus } from 'lucide-react';

const statusLabels: Record<string, string> = {
  idea: 'Ide',
  draft: 'Draft',
  in_progress: 'Proses',
  review: 'Review',
  posted: 'Posted',
};

const statusColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  idea: 'outline',
  draft: 'secondary',
  in_progress: 'default',
  review: 'secondary',
  posted: 'default',
};

export default function ContentPlanPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management';
  const canEdit = role === 'management' || role === 'pic';
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', platform: 'instagram', scheduled_date: '', status: 'idea' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from('content_plans').select('*').order('scheduled_date', { ascending: true });
    if (data) setRecords(data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('content_plans').insert({
      title: form.title,
      description: form.description,
      platform: form.platform,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
      created_by: user.id,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Content plan ditambahkan.' });
      setForm({ title: '', description: '', platform: 'instagram', scheduled_date: '', status: 'idea' });
      fetchData();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('content_plans').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <Megaphone className="w-7 h-7" /> Content Plan
        </h1>

        {canEdit && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Tambah Konten</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Judul</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul konten..." required />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="other">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Jadwal</Label>
                  <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idea">Ide</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_progress">Proses</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Deskripsi</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi konten..." />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={submitting} className="w-full"><Plus className="w-4 h-4 mr-1" /> Tambah</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Content Calendar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Jadwal</th>
                    <th className="p-3 font-medium">Judul</th>
                    <th className="p-3 font-medium">Platform</th>
                    <th className="p-3 font-medium">Status</th>
                    {canEdit && <th className="p-3 font-medium">Ubah Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{r.scheduled_date || '-'}</td>
                      <td className="p-3">
                        <p className="font-medium">{r.title}</p>
                        {r.description && <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{r.description}</p>}
                      </td>
                      <td className="p-3 capitalize">{r.platform}</td>
                      <td className="p-3"><Badge variant={statusColors[r.status] || 'outline'}>{statusLabels[r.status] || r.status}</Badge></td>
                      {canEdit && (
                        <td className="p-3">
                          <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="idea">Ide</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="in_progress">Proses</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="posted">Posted</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Belum ada content plan.</td></tr>
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
