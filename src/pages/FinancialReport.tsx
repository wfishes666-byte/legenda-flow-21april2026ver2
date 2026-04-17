import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Send, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpenseRow {
  description: string;
  amount: string;
}

interface ReportRecord {
  id: string;
  report_date: string;
  outlet_id: string | null;
  starting_cash: number;
  daily_offline_income: number;
  online_delivery_sales: number;
  ending_physical_cash: number;
  ending_qris_cash: number;
  notes: string | null;
  created_at: string | null;
}

export default function FinancialReport() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    starting_cash: '',
    daily_offline_income: '',
    ending_physical_cash: '',
    ending_qris_cash: '',
    online_delivery_sales: '',
    notes: '',
  });
  const [expenses, setExpenses] = useState<ExpenseRow[]>([{ description: '', amount: '' }]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const canManage = role === 'management';
  const canViewAll = role === 'management' || role === 'pic';

  const addExpenseRow = () => setExpenses([...expenses, { description: '', amount: '' }]);
  const removeExpenseRow = (idx: number) => setExpenses(expenses.filter((_, i) => i !== idx));
  const updateExpense = (idx: number, field: keyof ExpenseRow, value: string) => {
    const updated = [...expenses];
    updated[idx][field] = value;
    setExpenses(updated);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const fetchReports = async () => {
    if (!canViewAll) return;
    const { data } = await supabase
      .from('financial_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(100);
    if (data) setReports(data as ReportRecord[]);
  };

  useEffect(() => { fetchReports(); }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOutlet) return;
    setSubmitting(true);

    const { data: report, error: reportError } = await supabase
      .from('financial_reports')
      .insert({
        user_id: user.id,
        outlet_id: selectedOutlet,
        report_date: form.report_date,
        starting_cash: parseFloat(form.starting_cash) || 0,
        daily_offline_income: parseFloat(form.daily_offline_income) || 0,
        ending_physical_cash: parseFloat(form.ending_physical_cash) || 0,
        ending_qris_cash: parseFloat(form.ending_qris_cash) || 0,
        online_delivery_sales: parseFloat(form.online_delivery_sales) || 0,
        notes: form.notes,
      })
      .select('id')
      .single();

    if (reportError) {
      toast({ title: 'Gagal menyimpan', description: reportError.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    const validExpenses = expenses.filter((e) => e.description.trim() && parseFloat(e.amount) > 0);
    if (validExpenses.length > 0 && report) {
      await supabase.from('expense_items').insert(
        validExpenses.map((e) => ({
          report_id: report.id,
          description: e.description,
          amount: parseFloat(e.amount),
        }))
      );
    }

    toast({ title: 'Berhasil!', description: 'Laporan keuangan harian tersimpan.' });
    setForm({ report_date: new Date().toISOString().split('T')[0], starting_cash: '', daily_offline_income: '', ending_physical_cash: '', ending_qris_cash: '', online_delivery_sales: '', notes: '' });
    setExpenses([{ description: '', amount: '' }]);
    setSubmitting(false);
    fetchReports();
  };

  const handleDeleteReport = async (id: string) => {
    await supabase.from('expense_items').delete().eq('report_id', id);
    const { error } = await supabase.from('financial_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Laporan dihapus.' });
      fetchReports();
    }
  };

  const handleExportCSV = async () => {
    const { data } = await supabase.from('financial_reports').select('*').order('report_date', { ascending: false });
    if (!data || data.length === 0) { toast({ title: 'Tidak ada data', variant: 'destructive' }); return; }
    const outletMap = new Map(outlets.map(o => [o.id, o.name]));
    const headers = ['Tanggal', 'Cabang', 'Kas Awal', 'Pendapatan Offline', 'Penjualan Online', 'Kas Fisik Akhir', 'Kas QRIS Akhir', 'Catatan'];
    const csvRows = [headers.join(',')];
    data.forEach((r) => {
      csvRows.push([r.report_date, `"${outletMap.get(r.outlet_id ?? '') || '-'}"`, r.starting_cash, r.daily_offline_income, r.online_delivery_sales, r.ending_physical_cash, r.ending_qris_cash, `"${(r.notes || '').replace(/"/g, '""')}"`].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-keuangan-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { data } = await supabase.from('financial_reports').select('*').order('report_date', { ascending: false });
    if (!data || data.length === 0) { toast({ title: 'Tidak ada data', variant: 'destructive' }); return; }
    const outletMap = new Map(outlets.map(o => [o.id, o.name]));
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Keuangan - Dua Legenda', 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Cabang', 'Kas Awal', 'Offline', 'Online', 'Kas Fisik', 'Kas QRIS']],
      body: data.map((r) => [
        r.report_date,
        outletMap.get(r.outlet_id ?? '') || '-',
        `Rp ${(r.starting_cash ?? 0).toLocaleString('id-ID')}`,
        `Rp ${(r.daily_offline_income ?? 0).toLocaleString('id-ID')}`,
        `Rp ${(r.online_delivery_sales ?? 0).toLocaleString('id-ID')}`,
        `Rp ${(r.ending_physical_cash ?? 0).toLocaleString('id-ID')}`,
        `Rp ${(r.ending_qris_cash ?? 0).toLocaleString('id-ID')}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    doc.save(`laporan-keuangan-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const formatRp = (val: string) => {
    const num = parseFloat(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const outletMap = new Map(outlets.map(o => [o.id, o.name]));

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-sans">Laporan Keuangan Harian</h1>
            <p className="text-muted-foreground mt-1">Input data keuangan akhir hari</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Data Utama</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Kas Awal</Label>
                  <Input type="number" placeholder="0" value={form.starting_cash} onChange={(e) => setForm({ ...form, starting_cash: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Pendapatan Offline</Label>
                  <Input type="number" placeholder="0" value={form.daily_offline_income} onChange={(e) => setForm({ ...form, daily_offline_income: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Penjualan Online (Delivery)</Label>
                  <Input type="number" placeholder="0" value={form.online_delivery_sales} onChange={(e) => setForm({ ...form, online_delivery_sales: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Kas Fisik Akhir</Label>
                  <Input type="number" placeholder="0" value={form.ending_physical_cash} onChange={(e) => setForm({ ...form, ending_physical_cash: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Kas QRIS/Digital Akhir</Label>
                  <Input type="number" placeholder="0" value={form.ending_qris_cash} onChange={(e) => setForm({ ...form, ending_qris_cash: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea placeholder="Catatan tambahan..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Rincian Pengeluaran</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addExpenseRow}>
                <Plus className="w-4 h-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.map((exp, idx) => (
                <div key={idx} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    {idx === 0 && <Label className="text-xs">Keterangan</Label>}
                    <Input placeholder="Contoh: Beli bahan baku" value={exp.description} onChange={(e) => updateExpense(idx, 'description', e.target.value)} />
                  </div>
                  <div className="w-32 space-y-1">
                    {idx === 0 && <Label className="text-xs">Jumlah (Rp)</Label>}
                    <Input type="number" placeholder="0" value={exp.amount} onChange={(e) => updateExpense(idx, 'amount', e.target.value)} />
                  </div>
                  {expenses.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeExpenseRow(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-3 border-t border-border flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total Pengeluaran</span>
                <span className="font-bold text-lg">{formatRp(totalExpenses.toString())}</span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={submitting}>
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
          </Button>
        </form>

        {/* Report History for management */}
        {canViewAll && reports.length > 0 && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Riwayat Laporan</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Tanggal</th>
                      <th className="p-3 font-medium">Cabang</th>
                      <th className="p-3 font-medium">Kas Awal</th>
                      <th className="p-3 font-medium">Offline</th>
                      <th className="p-3 font-medium">Online</th>
                      {canManage && <th className="p-3 font-medium">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{r.report_date}</td>
                        <td className="p-3">{outletMap.get(r.outlet_id ?? '') || '-'}</td>
                        <td className="p-3">Rp {(r.starting_cash ?? 0).toLocaleString('id-ID')}</td>
                        <td className="p-3">Rp {(r.daily_offline_income ?? 0).toLocaleString('id-ID')}</td>
                        <td className="p-3">Rp {(r.online_delivery_sales ?? 0).toLocaleString('id-ID')}</td>
                        {canManage && (
                          <td className="p-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Laporan</AlertDialogTitle>
                                  <AlertDialogDescription>Yakin ingin menghapus laporan tanggal {r.report_date}?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteReport(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
