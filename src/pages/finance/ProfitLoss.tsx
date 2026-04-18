import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Download, Save, Plus, X } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  report_date: string;
}

interface PLCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export default function ProfitLossPage() {
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [incomeData, setIncomeData] = useState({ offline: 0, online: 0 });
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<PLCategory[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [balancingRows, setBalancingRows] = useState<{ id: string; label: string; amount: number }[]>([
    { id: '1', label: 'Kas Tunai Aktual', amount: 0 },
    { id: '2', label: 'Transfer Aktual', amount: 0 },
  ]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('profit_loss_categories').select('*').order('type').order('name');
    setCategories((data as PLCategory[]) || []);
  };

  const fetchData = async () => {
    const startDate = `${month}-01`;
    const endDate = format(endOfMonth(new Date(startDate)), 'yyyy-MM-dd');

    let query = supabase
      .from('financial_reports')
      .select('id, daily_offline_income, online_delivery_sales, report_date')
      .gte('report_date', startDate)
      .lte('report_date', endDate);
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data: reports } = await query;

    let offline = 0, online = 0;
    const reportMap: Record<string, string> = {};
    reports?.forEach((r) => {
      offline += r.daily_offline_income || 0;
      online += r.online_delivery_sales || 0;
      reportMap[r.id] = r.report_date;
    });
    setIncomeData({ offline, online });

    const reportIds = Object.keys(reportMap);
    if (reportIds.length > 0) {
      const { data: expenses } = await supabase
        .from('expense_items')
        .select('id, description, amount, category, report_id')
        .in('report_id', reportIds);
      const rows: ExpenseRow[] = (expenses || []).map((e: any) => ({
        id: e.id,
        description: e.description,
        amount: e.amount || 0,
        category: e.category,
        report_date: reportMap[e.report_id] || '',
      }));
      rows.sort((a, b) => a.report_date.localeCompare(b.report_date));
      setExpenseRows(rows);
    } else {
      setExpenseRows([]);
    }
    setPendingChanges({});
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchData(); }, [month, selectedOutlet]);

  const handleCategoryChange = (id: string, category: string) => {
    setPendingChanges((prev) => ({ ...prev, [id]: category }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingChanges);
    if (entries.length === 0) {
      toast({ title: 'Tidak ada perubahan' });
      return;
    }
    setSaving(true);
    try {
      for (const [id, category] of entries) {
        await supabase.from('expense_items').update({ category }).eq('id', id);
      }
      toast({ title: 'Berhasil disimpan', description: `${entries.length} item diperbarui.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase
      .from('profit_loss_categories')
      .insert({ name: newCategoryName.trim(), type: 'expense' });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun ditambahkan' });
      setNewCategoryName('');
      fetchCategories();
    }
  };

  // Aggregations for LR tab
  const totalIncome = incomeData.offline + incomeData.online;
  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  expenseRows.forEach((row) => {
    const effective = pendingChanges[row.id] ?? row.category ?? 'Belum Dikategorikan';
    expensesByCategory[effective] = (expensesByCategory[effective] || 0) + row.amount;
    totalExpenses += row.amount;
  });
  const netProfit = totalIncome - totalExpenses;
  const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Laporan Laba Rugi - ${month}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Kategori', 'Jumlah']],
      body: [
        ['PENDAPATAN USAHA', ''],
        ['  Penjualan Dine In / Offline', formatRp(incomeData.offline)],
        ['  Penjualan Online Food', formatRp(incomeData.online)],
        ['Total Pendapatan', formatRp(totalIncome)],
        ['', ''],
        ['BIAYA / PENGELUARAN', ''],
        ...Object.entries(expensesByCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => [`  ${cat}`, formatRp(amt)]),
        ['Total Pengeluaran', formatRp(totalExpenses)],
        ['', ''],
        ['LABA / RUGI BERSIH', formatRp(netProfit)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`laba-rugi-${month}.pdf`);
  };

  const uncategorizedCount = expenseRows.filter(
    (r) => !(pendingChanges[r.id] ?? r.category)
  ).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <TrendingUp className="w-7 h-7" /> Laporan Laba Rugi
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        <Tabs defaultValue="input" className="w-full">
          <TabsList className="grid w-full md:w-auto grid-cols-2">
            <TabsTrigger value="input">Input Akun {uncategorizedCount > 0 && `(${uncategorizedCount})`}</TabsTrigger>
            <TabsTrigger value="lr">Laporan L/R</TabsTrigger>
          </TabsList>

          {/* TAB 1: INPUT AKUN */}
          <TabsContent value="input" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Tambah Akun / Kategori Baru</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Nama akun (cth: Biaya Bahan Baku Ayam)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button onClick={handleAddCategory}>Tambah Akun</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Pemilahan Pengeluaran ({expenseRows.length} item)
                </CardTitle>
                <Button onClick={handleSaveAll} disabled={saving || Object.keys(pendingChanges).length === 0}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Menyimpan...' : `Simpan (${Object.keys(pendingChanges).length})`}
                </Button>
              </CardHeader>
              <CardContent>
                {expenseRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Belum ada pengeluaran pada periode ini.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Tanggal</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead className="text-right w-36">Jumlah</TableHead>
                        <TableHead className="w-64">Akun / Kategori</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseRows.map((row) => {
                        const current = pendingChanges[row.id] ?? row.category ?? '';
                        const isPending = pendingChanges[row.id] !== undefined;
                        return (
                          <TableRow key={row.id} className={isPending ? 'bg-primary/5' : ''}>
                            <TableCell className="text-xs">{row.report_date}</TableCell>
                            <TableCell className="text-sm">{row.description}</TableCell>
                            <TableCell className="text-right font-medium">{formatRp(row.amount)}</TableCell>
                            <TableCell>
                              <Select value={current} onValueChange={(v) => handleCategoryChange(row.id, v)}>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="-- Pilih Akun --" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: LAPORAN L/R */}
          <TabsContent value="lr" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tabel Laba Rugi */}
              <Card className="lg:col-span-2 overflow-hidden glass-card border-0 p-0">
                <div className="bg-destructive text-destructive-foreground py-5 text-center">
                  <h2 className="text-xl font-bold">Laporan Laba Rugi</h2>
                  <p className="text-sm opacity-90">
                    Per {format(new Date(`${month}-01`), 'MMMM yyyy', { locale: localeId })}
                  </p>
                </div>
                <div className="divide-y">
                  <div className="flex items-center justify-between px-5 py-3 font-semibold text-primary">
                    <span>Total Pendapatan</span>
                    <span>{formatRp(totalIncome)}</span>
                  </div>
                  {Object.entries(expensesByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => {
                      const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0;
                      const isUncategorized = cat === 'Belum Dikategorikan';
                      return (
                        <div
                          key={cat}
                          className={`grid grid-cols-[1fr_auto_70px] items-center px-5 py-3 gap-4 ${
                            isUncategorized ? 'bg-yellow-500/10' : ''
                          }`}
                        >
                          <span className="text-sm text-destructive/90">{cat}</span>
                          <span className="text-sm text-destructive/90 text-right">{formatRp(amt)}</span>
                          <span className="text-xs text-muted-foreground text-right">
                            {pct.toFixed(2).replace('.', ',')}%
                          </span>
                        </div>
                      );
                    })}
                  <div className="grid grid-cols-[1fr_auto_70px] items-center px-5 py-3 gap-4 font-semibold text-destructive">
                    <span>Total Pengeluaran</span>
                    <span className="text-right">{formatRp(totalExpenses)}</span>
                    <span className="text-xs text-right">
                      {(totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0).toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                  <div
                    className={`grid grid-cols-[1fr_auto_70px] items-center px-5 py-4 gap-4 font-bold ${
                      netProfit >= 0 ? 'bg-green-500/30 text-foreground' : 'bg-destructive/20 text-destructive'
                    }`}
                  >
                    <span>Laba Bersih</span>
                    <span className="text-right">{formatRp(netProfit)}</span>
                    <span className="text-sm text-right">
                      {(totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0).toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                </div>
              </Card>

              {/* Panel Balancing */}
              <Card className="glass-card h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">BALANCING</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">Laba Bersih Sistem</span>
                    <span className="font-semibold text-primary">{formatRp(netProfit)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_24px] gap-2 text-xs uppercase text-muted-foreground">
                    <span>Keterangan</span>
                    <span className="text-right pr-1">Nominal</span>
                    <span></span>
                  </div>
                  {balancingRows.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-[1fr_auto_24px] gap-2 items-center">
                      <Input
                        value={row.label}
                        onChange={(e) => {
                          const next = [...balancingRows];
                          next[idx] = { ...row, label: e.target.value };
                          setBalancingRows(next);
                        }}
                        className="h-9 text-sm"
                      />
                      <Input
                        type="number"
                        value={row.amount || ''}
                        onChange={(e) => {
                          const next = [...balancingRows];
                          next[idx] = { ...row, amount: Number(e.target.value) || 0 };
                          setBalancingRows(next);
                        }}
                        className="h-9 text-sm w-32 text-right"
                        placeholder="Rp"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setBalancingRows(balancingRows.filter((r) => r.id !== row.id))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() =>
                      setBalancingRows([
                        ...balancingRows,
                        { id: Date.now().toString(), label: '', amount: 0 },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah baris
                  </Button>

                  {(() => {
                    const totalActual = balancingRows.reduce((s, r) => s + (r.amount || 0), 0);
                    const selisih = totalActual - netProfit;
                    return (
                      <>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-semibold">Total Aktual</span>
                          <span className="font-bold">{formatRp(totalActual)}</span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-3 rounded-md ${
                            selisih === 0
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          <span className="text-sm font-semibold">Selisih</span>
                          <span className="font-bold">{formatRp(selisih)}</span>
                        </div>
                        {selisih !== 0 && (
                          <p className="text-xs text-muted-foreground text-center">
                            {selisih > 0
                              ? 'Kas aktual LEBIH dari laba sistem'
                              : 'Kas aktual KURANG dari laba sistem'}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
