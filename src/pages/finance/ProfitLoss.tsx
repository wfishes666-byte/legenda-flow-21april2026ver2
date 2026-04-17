import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ProfitLossPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [incomeData, setIncomeData] = useState({ offline: 0, online: 0 });
  const [expensesByCategory, setExpensesByCategory] = useState<Record<string, number>>({});
  const [totalExpenses, setTotalExpenses] = useState(0);

  const fetchData = async () => {
    const startDate = `${month}-01`;
    const endDate = format(endOfMonth(new Date(startDate)), 'yyyy-MM-dd');

    let query = supabase.from('financial_reports').select('id, daily_offline_income, online_delivery_sales').gte('report_date', startDate).lte('report_date', endDate);
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data: reports } = await query;

    let offline = 0, online = 0;
    const reportIds: string[] = [];
    reports?.forEach((r) => {
      offline += r.daily_offline_income || 0;
      online += r.online_delivery_sales || 0;
      reportIds.push(r.id);
    });
    setIncomeData({ offline, online });

    // Fetch expenses grouped by description
    if (reportIds.length > 0) {
      const { data: expenses } = await supabase.from('expense_items').select('description, amount').in('report_id', reportIds);
      const grouped: Record<string, number> = {};
      let total = 0;
      expenses?.forEach((e) => {
        const cat = e.description || 'Lainnya';
        grouped[cat] = (grouped[cat] || 0) + (e.amount || 0);
        total += e.amount || 0;
      });
      setExpensesByCategory(grouped);
      setTotalExpenses(total);
    } else {
      setExpensesByCategory({});
      setTotalExpenses(0);
    }
  };

  useEffect(() => { fetchData(); }, [month, selectedOutlet]);

  const totalIncome = incomeData.offline + incomeData.online;
  const netProfit = totalIncome - totalExpenses;
  const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

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
        ['Pendapatan Offline', formatRp(incomeData.offline)],
        ['Pendapatan Online', formatRp(incomeData.online)],
        ['Total Pendapatan', formatRp(totalIncome)],
        ['', ''],
        ...Object.entries(expensesByCategory).map(([cat, amt]) => [cat, formatRp(amt)]),
        ['Total Pengeluaran', formatRp(totalExpenses)],
        ['', ''],
        ['LABA/RUGI BERSIH', formatRp(netProfit)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`laba-rugi-${month}.pdf`);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <TrendingUp className="w-7 h-7" /> Laporan Laba Rugi
          </h1>
          <div className="flex gap-2 items-center">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
            <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="w-4 h-4 mr-1" /> PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-muted-foreground">Total Pendapatan</p>
              <p className="text-xl font-bold text-primary">{formatRp(totalIncome)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
              <p className="text-xl font-bold text-destructive">{formatRp(totalExpenses)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-muted-foreground">Laba/Rugi Bersih</p>
              <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatRp(netProfit)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Pendapatan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Penjualan Offline</span>
                <span className="font-medium">{formatRp(incomeData.offline)}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Penjualan Online</span>
                <span className="font-medium">{formatRp(incomeData.online)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="w-5 h-5 text-destructive" /> Pengeluaran per Kategori</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(expensesByCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pengeluaran.</p>
              ) : (
                Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">{cat}</span>
                    <span className="font-medium text-destructive">{formatRp(amt)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
