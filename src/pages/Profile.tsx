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

interface CashbonRecord {
  id: string;
  request_date: string;
  amount: number;
  status: string;
  notes: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const [cashbonOpen, setCashbonOpen] = useState(false);
  const [cashbonForm, setCashbonForm] = useState({ amount: '', notes: '' });
  const [cashbonSubmitting, setCashbonSubmitting] = useState(false);
  const [cashbonRecords, setCashbonRecords] = useState<CashbonRecord[]>([]);

  const fetchCashbon = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cashbon')
      .select('id, request_date, amount, status, notes')
      .eq('user_id', user.id)
      .order('request_date', { ascending: false })
      .limit(20);
    if (data) setCashbonRecords(data as CashbonRecord[]);
  };

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
    fetchCashbon();
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

  const handleCashbonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amountNum = parseFloat(cashbonForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: 'Jumlah tidak valid', description: 'Masukkan jumlah cashbon lebih dari 0.', variant: 'destructive' });
      return;
    }
    setCashbonSubmitting(true);
    const { error } = await supabase.from('cashbon').insert({
      user_id: user.id,
      amount: amountNum,
      notes: cashbonForm.notes,
    });
    setCashbonSubmitting(false);
    if (error) {
      toast({ title: 'Gagal mengajukan cashbon', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Pengajuan cashbon telah dikirim.' });
      setCashbonOpen(false);
      setCashbonForm({ amount: '', notes: '' });
      fetchCashbon();
    }
  };

  const cashbonStatusVariant = (s: string) => {
    if (s === 'approved') return 'default' as const;
    if (s === 'paid') return 'secondary' as const;
    if (s === 'rejected') return 'destructive' as const;
    return 'outline' as const;
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Leave Request */}
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">Pengajuan Cuti</Button>
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

          {/* Cashbon Request */}
          <Dialog open={cashbonOpen} onOpenChange={setCashbonOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full sm:w-auto gap-2">
                <Banknote className="w-4 h-4" /> Pengajuan Cashbon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Pengajuan Cashbon</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCashbonSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1000"
                    placeholder="0"
                    value={cashbonForm.amount}
                    onChange={(e) => setCashbonForm({ ...cashbonForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan / Keperluan</Label>
                  <Textarea
                    value={cashbonForm.notes}
                    onChange={(e) => setCashbonForm({ ...cashbonForm, notes: e.target.value })}
                    placeholder="Jelaskan keperluan cashbon..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={cashbonSubmitting}>
                  {cashbonSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cashbon History */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" /> Riwayat Cashbon Saya
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 font-medium">Jumlah</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {cashbonRecords.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{format(new Date(r.request_date), 'dd MMM yyyy')}</td>
                      <td className="p-3 font-medium">Rp {(r.amount || 0).toLocaleString('id-ID')}</td>
                      <td className="p-3">
                        <StatusBadge variant={cashbonStatusVariant(r.status)}>{r.status}</StatusBadge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{r.notes || '-'}</td>
                    </tr>
                  ))}
                  {cashbonRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        Belum ada pengajuan cashbon.
                      </td>
                    </tr>
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
