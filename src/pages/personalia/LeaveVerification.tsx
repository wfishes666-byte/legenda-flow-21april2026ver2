import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Check, X } from 'lucide-react';
import { format } from 'date-fns';

export default function LeaveVerificationPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management';
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const fetchData = async () => {
    const { data } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setRecords(data);
    const { data: p } = await supabase.from('profiles').select('user_id, full_name');
    if (p) setProfiles(p);
  };

  useEffect(() => { fetchData(); }, [role]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({ status, reviewed_by: user?.id }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Cuti ${status === 'approved' ? 'disetujui' : 'ditolak'}.` });
      fetchData();
    }
  };

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  const statusVariant = (s: string) => {
    if (s === 'approved') return 'default' as const;
    if (s === 'rejected') return 'destructive' as const;
    return 'outline' as const;
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <CalendarDays className="w-7 h-7" /> Verifikasi Cuti
        </h1>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Daftar Pengajuan Cuti</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Nama</th>
                    <th className="p-3 font-medium">Mulai</th>
                    <th className="p-3 font-medium">Selesai</th>
                    <th className="p-3 font-medium">Alasan</th>
                    <th className="p-3 font-medium">Status</th>
                    {canManage && <th className="p-3 font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium">{profileMap.get(r.user_id) || '-'}</td>
                      <td className="p-3">{r.start_date}</td>
                      <td className="p-3">{r.end_date}</td>
                      <td className="p-3 text-xs max-w-xs truncate">{r.reason}</td>
                      <td className="p-3"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                      {canManage && r.status === 'pending' && (
                        <td className="p-3 flex gap-1">
                          <Button size="sm" onClick={() => handleAction(r.id, 'approved')}><Check className="w-3 h-3 mr-1" /> Setujui</Button>
                          <Button size="sm" variant="outline" onClick={() => handleAction(r.id, 'rejected')}><X className="w-3 h-3 mr-1" /> Tolak</Button>
                        </td>
                      )}
                      {canManage && r.status !== 'pending' && <td className="p-3" />}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada pengajuan cuti.</td></tr>
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
