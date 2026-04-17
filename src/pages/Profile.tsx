import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Phone, MapPin, Briefcase, AlertTriangle, FileWarning, Clock, Banknote } from 'lucide-react';
import { Badge as StatusBadge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Profile {
  full_name: string;
  phone: string;
  address: string;
  date_of_birth: string | null;
  job_title: string;
  discipline_points: number;
  warning_letter_status: string;
  employment_status: string;
  contract_end_date: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [user]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Gagal mengajukan cuti', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Pengajuan cuti telah dikirim.' });
      setLeaveOpen(false);
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
    }
  };

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Memuat profil...</p>
        </div>
      </AppLayout>
    );
  }

  const infoItems = [
    { icon: Phone, label: 'Telepon', value: profile.phone || '-' },
    { icon: MapPin, label: 'Alamat', value: profile.address || '-' },
    { icon: CalendarDays, label: 'Tanggal Lahir', value: profile.date_of_birth ? format(new Date(profile.date_of_birth), 'dd MMM yyyy') : '-' },
    { icon: Briefcase, label: 'Jabatan', value: profile.job_title || '-' },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pt-12 md:pt-0">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Profil Karyawan</h1>
          <p className="text-muted-foreground mt-1">Informasi pribadi Anda</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-xl">{profile.full_name || 'Belum diisi'}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
            </div>
            <Badge variant={profile.employment_status === 'Permanent' ? 'default' : 'secondary'}>
              {profile.employment_status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <item.icon className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Poin Disiplin</p>
                  <p className="text-sm font-bold">{profile.discipline_points}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileWarning className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Status SP</p>
                  <p className="text-sm font-medium">{profile.warning_letter_status}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Akhir Kontrak</p>
                  <p className="text-sm font-medium">
                    {profile.contract_end_date ? format(new Date(profile.contract_end_date), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Request */}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">Pengajuan Cuti</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Pengajuan Cuti</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alasan</Label>
                <Textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Jelaskan alasan cuti..."
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
