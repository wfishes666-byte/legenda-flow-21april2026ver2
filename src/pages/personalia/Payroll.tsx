import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Calculator } from 'lucide-react';

const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function PayrollPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management';
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState({
    user_id: '', period_month: String(new Date().getMonth() + 1), period_year: String(new Date().getFullYear()),
    base_salary: '', meal_allowance: '', transport_allowance: '', other_allowance: '',
    absence_deduction: '', cashbon_deduction: '', punishment_deduction: '', other_deduction: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from('payroll').select('*').order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(200);
    if (data) setRecords(data);
    const { data: p } = await supabase
      .from('profiles')
      .select('user_id, full_name, base_salary, transport_allowance, meal_allowance')
      .order('full_name');
    if (p) setProfiles(p);
  };

  useEffect(() => { fetchData(); }, [role]);

  // Auto-fill salary components when employee is selected
  const handleSelectEmployee = (userId: string) => {
    const prof: any = profiles.find((p: any) => p.user_id === userId);
    setForm({
      ...form,
      user_id: userId,
      base_salary: prof?.base_salary ? String(prof.base_salary) : form.base_salary,
      transport_allowance: prof?.transport_allowance ? String(prof.transport_allowance) : form.transport_allowance,
      meal_allowance: prof?.meal_allowance ? String(prof.meal_allowance) : form.meal_allowance,
    });
  };

  const calcNet = () => {
    const base = parseFloat(form.base_salary) || 0;
    const allowances = (parseFloat(form.meal_allowance) || 0) + (parseFloat(form.transport_allowance) || 0) + (parseFloat(form.other_allowance) || 0);
    const deductions = (parseFloat(form.absence_deduction) || 0) + (parseFloat(form.cashbon_deduction) || 0) + (parseFloat(form.punishment_deduction) || 0) + (parseFloat(form.other_deduction) || 0);
    return base + allowances - deductions;
  };

  const handleAutoCalc = async () => {
    if (!form.user_id || !form.period_month || !form.period_year) return;
    const month = parseInt(form.period_month);
    const year = parseInt(form.period_year);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Count absences
    const { data: absences } = await supabase.from('attendance').select('id').eq('user_id', form.user_id)
      .gte('attendance_date', startDate).lt('attendance_date', endDate).in('status', ['alpha', 'izin']);
    const absenceCount = absences?.length || 0;

    // Sum cashbon
    const { data: cashbons } = await supabase.from('cashbon').select('amount').eq('user_id', form.user_id)
      .eq('status', 'approved').gte('request_date', startDate).lt('request_date', endDate);
    const cashbonTotal = cashbons?.reduce((s, c) => s + (c.amount || 0), 0) || 0;

    // Sum punishment points
    const { data: punishments } = await supabase.from('punishments').select('points_added').eq('user_id', form.user_id)
      .gte('issued_date', startDate).lt('issued_date', endDate);
    const punishmentPoints = punishments?.reduce((s, p) => s + (p.points_added || 0), 0) || 0;

    const baseSalary = parseFloat(form.base_salary) || 0;
    const dailyRate = baseSalary / 26; // assume 26 working days

    setForm({
      ...form,
      absence_deduction: String(Math.round(absenceCount * dailyRate)),
      cashbon_deduction: String(cashbonTotal),
      punishment_deduction: String(punishmentPoints * 10000), // Rp10.000 per point
    });

    toast({ title: 'Kalkulasi otomatis', description: `${absenceCount} absen, Rp${cashbonTotal.toLocaleString('id-ID')} cashbon, ${punishmentPoints} poin punishment` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const { error } = await supabase.from('payroll').insert({
      user_id: form.user_id,
      period_month: parseInt(form.period_month),
      period_year: parseInt(form.period_year),
      base_salary: parseFloat(form.base_salary) || 0,
      meal_allowance: parseFloat(form.meal_allowance) || 0,
      transport_allowance: parseFloat(form.transport_allowance) || 0,
      other_allowance: parseFloat(form.other_allowance) || 0,
      absence_deduction: parseFloat(form.absence_deduction) || 0,
      cashbon_deduction: parseFloat(form.cashbon_deduction) || 0,
      punishment_deduction: parseFloat(form.punishment_deduction) || 0,
      other_deduction: parseFloat(form.other_deduction) || 0,
      net_salary: calcNet(),
      notes: form.notes,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Payroll tersimpan.' });
      fetchData();
    }
    setSubmitting(false);
  };

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
  const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <DollarSign className="w-7 h-7" /> Payroll
        </h1>

        {canManage && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Input Payroll</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Karyawan</Label>
                    <Select value={form.user_id} onValueChange={handleSelectEmployee}>
                      <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bulan</Label>
                    <Select value={form.period_month} onValueChange={(v) => setForm({ ...form, period_month: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun</Label>
                    <Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Gaji Pokok</Label><Input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Tunj. Makan</Label><Input type="number" value={form.meal_allowance} onChange={(e) => setForm({ ...form, meal_allowance: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Tunj. Transport</Label><Input type="number" value={form.transport_allowance} onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Tunj. Lainnya</Label><Input type="number" value={form.other_allowance} onChange={(e) => setForm({ ...form, other_allowance: e.target.value })} /></div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleAutoCalc} disabled={!form.user_id}>
                    <Calculator className="w-4 h-4 mr-1" /> Hitung Potongan Otomatis
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Pot. Absensi</Label><Input type="number" value={form.absence_deduction} onChange={(e) => setForm({ ...form, absence_deduction: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Pot. Cashbon</Label><Input type="number" value={form.cashbon_deduction} onChange={(e) => setForm({ ...form, cashbon_deduction: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Pot. Punishment</Label><Input type="number" value={form.punishment_deduction} onChange={(e) => setForm({ ...form, punishment_deduction: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Pot. Lainnya</Label><Input type="number" value={form.other_deduction} onChange={(e) => setForm({ ...form, other_deduction: e.target.value })} /></div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 text-center">
                  <p className="text-sm text-muted-foreground">Gaji Bersih</p>
                  <p className="text-2xl font-bold text-primary">{formatRp(calcNet())}</p>
                </div>

                <Button type="submit" disabled={submitting || !form.user_id} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> Simpan Payroll
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Payroll</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Karyawan</th>
                    <th className="p-3 font-medium">Periode</th>
                    <th className="p-3 font-medium">Gaji Pokok</th>
                    <th className="p-3 font-medium">Tunjangan</th>
                    <th className="p-3 font-medium">Potongan</th>
                    <th className="p-3 font-medium">Gaji Bersih</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const totalAllowance = (r.meal_allowance || 0) + (r.transport_allowance || 0) + (r.other_allowance || 0);
                    const totalDeduction = (r.absence_deduction || 0) + (r.cashbon_deduction || 0) + (r.punishment_deduction || 0) + (r.other_deduction || 0);
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{profileMap.get(r.user_id) || '-'}</td>
                        <td className="p-3">{months[(r.period_month || 1) - 1]} {r.period_year}</td>
                        <td className="p-3">{formatRp(r.base_salary)}</td>
                        <td className="p-3 text-primary">{formatRp(totalAllowance)}</td>
                        <td className="p-3 text-destructive">{formatRp(totalDeduction)}</td>
                        <td className="p-3 font-bold">{formatRp(r.net_salary)}</td>
                        <td className="p-3"><Badge variant={r.status === 'paid' ? 'default' : 'outline'}>{r.status}</Badge></td>
                      </tr>
                    );
                  })}
                  {records.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada data payroll.</td></tr>
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
