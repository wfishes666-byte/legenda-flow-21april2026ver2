import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type PaymentType = 'cash' | 'transfer';

interface ExpenseLine {
  id: string;
  payment_type: PaymentType;
  item_name: string;
  unit_price: number;
  qty: number;
}

const newLine = (payment_type: PaymentType): ExpenseLine => ({
  id: crypto.randomUUID(),
  payment_type,
  item_name: '',
  unit_price: 0,
  qty: 0,
});

const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

export default function DailyRecapPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, loading: outletsLoading } = useOutlets();
  const [activeOutlet, setActiveOutlet] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);

  const canManage = role === 'admin' || role === 'management' || role === 'pic';

  // form state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reporterName, setReporterName] = useState('');
  const [cashStart, setCashStart] = useState(0);
  const [cashAdded, setCashAdded] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ExpenseLine[]>([newLine('cash')]);
  const [expenseTab, setExpenseTab] = useState<PaymentType>('cash');

  useEffect(() => {
    if (!activeOutlet && outlets.length > 0) setActiveOutlet(outlets[0].id);
  }, [outlets, activeOutlet]);

  const fetchReports = async () => {
    if (!activeOutlet) return;
    const { data } = await supabase
      .from('finance_daily_reports')
      .select('*, finance_expense_items(*)')
      .eq('outlet_id', activeOutlet)
      .order('report_date', { ascending: false })
      .limit(100);
    if (data) setReports(data);
  };

  useEffect(() => { fetchReports(); }, [activeOutlet]);

  // computed
  const cashLines = lines.filter((l) => l.payment_type === 'cash');
  const transferLines = lines.filter((l) => l.payment_type === 'transfer');
  const totalCash = cashLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const totalTransfer = transferLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const totalExpense = totalCash + totalTransfer;
  const cashRemaining = (cashStart || 0) + (cashAdded || 0) - totalCash;

  const activeOutletName = useMemo(
    () => outlets.find((o) => o.id === activeOutlet)?.name || '',
    [outlets, activeOutlet]
  );

  const updateLine = (id: string, patch: Partial<ExpenseLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const addLine = () => setLines((prev) => [...prev, newLine(expenseTab)]);

  const resetForm = () => {
    setReportDate(new Date().toISOString().split('T')[0]);
    setReporterName('');
    setCashStart(0);
    setCashAdded(0);
    setNotes('');
    setLines([newLine('cash')]);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!activeOutlet) {
      toast({ title: 'Pilih cabang dulu', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data: report, error } = await supabase
      .from('finance_daily_reports')
      .insert({
        user_id: user.id,
        outlet_id: activeOutlet,
        report_date: reportDate,
        reporter_name: reporterName,
        starting_cash: cashStart,
        cash_on_hand_added: cashAdded,
        notes,
      })
      .select('id')
      .single();

    if (error || !report) {
      setSubmitting(false);
      toast({ title: 'Gagal simpan', description: error?.message, variant: 'destructive' });
      return;
    }

    const itemsToInsert = lines
      .filter((l) => l.item_name.trim() !== '' || l.unit_price > 0)
      .map((l) => ({
        report_id: report.id,
        payment_type: l.payment_type,
        item_name: l.item_name,
        unit_price: l.unit_price,
        qty: l.qty,
        subtotal: l.unit_price * l.qty,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemErr } = await supabase.from('finance_expense_items').insert(itemsToInsert);
      if (itemErr) {
        toast({ title: 'Item pengeluaran gagal disimpan', description: itemErr.message, variant: 'destructive' });
      }
    }

    setSubmitting(false);
    toast({ title: 'Tersimpan', description: 'Laporan harian finance ditambahkan.' });
    resetForm();
    fetchReports();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan ini?')) return;
    const { error } = await supabase.from('finance_daily_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dihapus' });
    fetchReports();
  };

  const visibleLines = lines.filter((l) => l.payment_type === expenseTab);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans">Laporan Harian</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale })}
          </p>
        </div>

        <Tabs defaultValue="input" className="w-full">
          <TabsList>
            <TabsTrigger value="input">Input Laporan</TabsTrigger>
            <TabsTrigger value="recap">Rekap Laporan</TabsTrigger>
          </TabsList>

          {/* INPUT TAB */}
          <TabsContent value="input" className="mt-4 space-y-4">
            {/* Outlet tabs (chip-like) */}
            <div className="flex gap-2 flex-wrap border-b border-border pb-3">
              {outletsLoading && <span className="text-sm text-muted-foreground">Memuat cabang…</span>}
              {outlets.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveOutlet(o.id)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                    activeOutlet === o.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  )}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Form */}
              <Card className="glass-card lg:col-span-2">
                <CardContent className="p-6 space-y-6">
                  <h2 className="text-lg font-semibold">{activeOutletName || 'Pilih cabang'}</h2>

                  {/* Tanggal & Pelapor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tanggal</Label>
                      <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Nama Pelapor</Label>
                      <Input value={reporterName} onChange={(e) => setReporterName(e.target.value)} placeholder="Opsional" />
                    </div>
                  </div>

                  {/* Cash on hand */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Cash on Hand Awal</Label>
                      <Input
                        type="number"
                        value={cashStart || ''}
                        onChange={(e) => setCashStart(Number(e.target.value))}
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <Label>Tambahan Cash on Hand</Label>
                      <Input
                        type="number"
                        value={cashAdded || ''}
                        onChange={(e) => setCashAdded(Number(e.target.value))}
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <Label>Sisa Cash on Hand</Label>
                      <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center font-semibold">
                        {formatRp(cashRemaining)}
                      </div>
                    </div>
                  </div>

                  {/* Pengeluaran */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Pengeluaran</h3>
                      <Button type="button" size="sm" onClick={addLine}>
                        <Plus className="w-4 h-4 mr-1" /> Tambah
                      </Button>
                    </div>

                    <Tabs value={expenseTab} onValueChange={(v) => setExpenseTab(v as PaymentType)}>
                      <TabsList>
                        <TabsTrigger value="cash">Cash</TabsTrigger>
                        <TabsTrigger value="transfer">Transfer</TabsTrigger>
                      </TabsList>

                      <TabsContent value={expenseTab} className="mt-3 space-y-2">
                        {/* Header row (desktop) */}
                        <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                          <div className="col-span-5">Nama Item</div>
                          <div className="col-span-3">Harga</div>
                          <div className="col-span-2">Qty</div>
                          <div className="col-span-2 text-right">Subtotal</div>
                        </div>

                        {visibleLines.length === 0 && (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Belum ada item. Klik <span className="font-medium">+ Tambah</span> untuk menambah.
                          </p>
                        )}

                        {visibleLines.map((l) => {
                          const subtotal = l.unit_price * l.qty;
                          return (
                            <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                              <Input
                                className="col-span-12 md:col-span-5"
                                placeholder="Nama Item"
                                value={l.item_name}
                                onChange={(e) => updateLine(l.id, { item_name: e.target.value })}
                              />
                              <Input
                                className="col-span-5 md:col-span-3"
                                type="number"
                                placeholder="Rp 0"
                                value={l.unit_price || ''}
                                onChange={(e) => updateLine(l.id, { unit_price: Number(e.target.value) })}
                              />
                              <Input
                                className="col-span-3 md:col-span-2"
                                type="number"
                                value={l.qty || ''}
                                onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })}
                              />
                              <div className="col-span-3 md:col-span-1 text-right font-medium text-sm">
                                {formatRp(subtotal)}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="col-span-1 md:col-span-1 h-9 w-9 text-destructive justify-self-end"
                                onClick={() => removeLine(l.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </TabsContent>
                    </Tabs>

                    {/* Totals */}
                    <div className="mt-6 space-y-2 border-t border-border pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">Total Cash</span>
                        <span className="font-semibold">{formatRp(totalCash)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-border pb-3">
                        <span className="font-semibold">Total Transfer</span>
                        <span className="font-semibold">{formatRp(totalTransfer)}</span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span className="font-bold">Total Pengeluaran</span>
                        <span className="font-bold">{formatRp(totalExpense)}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleSubmit} disabled={submitting || !canManage}>
                        <Save className="w-4 h-4 mr-2" /> {submitting ? 'Menyimpan…' : 'Simpan Laporan'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ringkasan Sidebar */}
              <Card className="glass-card h-fit">
                <CardContent className="p-0">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      Ringkasan Laporan Harian
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    <SummaryRow label="Cash on Hand Awal" value={formatRp(cashStart)} />
                    <SummaryRow label="Tambahan Cash on Hand" value={formatRp(cashAdded)} />
                    <SummaryRow label="Total Belanja (Cash on Hand)" value={formatRp(totalCash)} />
                    <SummaryRow label="Total Pengeluaran" value={formatRp(totalExpense)} highlight />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* REKAP TAB */}
          <TabsContent value="recap" className="mt-4">
            <div className="flex gap-2 flex-wrap border-b border-border pb-3 mb-4">
              {outlets.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveOutlet(o.id)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                    activeOutlet === o.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  )}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Tanggal</th>
                        <th className="p-3 font-medium">Pelapor</th>
                        <th className="p-3 font-medium">Cash Awal</th>
                        <th className="p-3 font-medium">Tambahan</th>
                        <th className="p-3 font-medium">Cash</th>
                        <th className="p-3 font-medium">Transfer</th>
                        <th className="p-3 font-medium">Total Pengeluaran</th>
                        {role === 'admin' && <th className="p-3 font-medium" />}
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r: any) => {
                        const items = (r.finance_expense_items || []) as any[];
                        const tCash = items.filter((i) => i.payment_type === 'cash').reduce((s, i) => s + Number(i.subtotal || 0), 0);
                        const tTransfer = items.filter((i) => i.payment_type === 'transfer').reduce((s, i) => s + Number(i.subtotal || 0), 0);
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-3">{r.report_date}</td>
                            <td className="p-3">{r.reporter_name || '-'}</td>
                            <td className="p-3">{formatRp(r.starting_cash || 0)}</td>
                            <td className="p-3">{formatRp(r.cash_on_hand_added || 0)}</td>
                            <td className="p-3">{formatRp(tCash)}</td>
                            <td className="p-3">{formatRp(tTransfer)}</td>
                            <td className="p-3"><Badge variant="secondary">{formatRp(tCash + tTransfer)}</Badge></td>
                            {role === 'admin' && (
                              <td className="p-3">
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {reports.length === 0 && (
                        <tr>
                          <td colSpan={role === 'admin' ? 8 : 7} className="p-8 text-center text-muted-foreground">
                            Belum ada laporan untuk cabang ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-3', highlight && 'bg-muted/60')}>
      <span className={cn('text-sm', highlight ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
