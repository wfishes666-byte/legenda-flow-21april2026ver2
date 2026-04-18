import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Calendar,
  Check,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

interface FinancialSummary {
  report_date: string;
  income: number;
  expenses: number;
}

interface LeaveReq {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  profile_name?: string;
}

interface LowStockItem {
  item_name: string;
  ending_stock: number;
  minimum_threshold: number;
}

interface StaffOverview {
  full_name: string;
  discipline_points: number;
  warning_letter_status: string;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [financials, setFinancials] = useState<FinancialSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReq[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [staff, setStaff] = useState<StaffOverview[]>([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpenses: 0 });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    // Financial data
    const { data: reports } = await supabase
      .from('financial_reports')
      .select('id, report_date, daily_offline_income, online_delivery_sales')
      .order('report_date', { ascending: true })
      .limit(30);

    if (reports) {
      // Fetch expenses for each report
      const reportIds = reports.map((r) => r.id);
      const { data: expenseData } = await supabase
        .from('expense_items')
        .select('report_id, amount')
        .in('report_id', reportIds.length > 0 ? reportIds : ['none']);

      const expenseByReport = new Map<string, number>();
      expenseData?.forEach((e) => {
        expenseByReport.set(e.report_id, (expenseByReport.get(e.report_id) || 0) + (e.amount || 0));
      });

      const summaries = reports.map((r) => ({
        report_date: r.report_date,
        income: (r.daily_offline_income || 0) + (r.online_delivery_sales || 0),
        expenses: expenseByReport.get(r.id) || 0,
      }));
      setFinancials(summaries);

      const totalIncome = summaries.reduce((s, r) => s + r.income, 0);
      const totalExpenses = summaries.reduce((s, r) => s + r.expenses, 0);
      setTotals({ totalIncome, totalExpenses });
    }

    // Leave requests
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (leaves) {
      // Fetch profile names
      const userIds = [...new Set(leaves.map((l) => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds.length > 0 ? userIds : ['none']);

      const nameMap = new Map<string, string>();
      profiles?.forEach((p) => nameMap.set(p.user_id, p.full_name));

      setLeaveRequests(
        leaves.map((l) => ({ ...l, profile_name: nameMap.get(l.user_id) || 'Unknown' }))
      );
    }

    // Low stock
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .order('record_date', { ascending: false });

    if (inventory) {
      const latestByItem = new Map<string, any>();
      inventory.forEach((row) => {
        if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
      });
      setLowStock(
        Array.from(latestByItem.values()).filter(
          (item) => (item.ending_stock ?? 0) <= (item.minimum_threshold ?? 5)
        )
      );
    }

    // Staff overview
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, discipline_points, warning_letter_status')
      .order('discipline_points', { ascending: false });

    if (profileData) setStaff(profileData as StaffOverview[]);
  };

  const handleLeaveAction = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Cuti ${status === 'approved' ? 'disetujui' : 'ditolak'}.` });
      setLeaveRequests((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const formatRp = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const chartData = financials.map((f) => ({
    date: format(new Date(f.report_date), 'dd/MM'),
    Pendapatan: f.income,
    Pengeluaran: f.expenses,
  }));

  return (
    <AppLayout>
      <div className="space-y-6 pt-12 md:pt-0">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">Dashboard Management</h1>
          <p className="text-muted-foreground mt-1">Ringkasan operasional Dua Legenda Grup</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                  <p className="font-heading text-xl font-bold text-primary">{formatRp(totals.totalIncome)}</p>
                </div>
                <div className="p-2 rounded-full bg-primary/10">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                  <p className="font-heading text-xl font-bold text-destructive">{formatRp(totals.totalExpenses)}</p>
                </div>
                <div className="p-2 rounded-full bg-destructive/10">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Stok Rendah</p>
                  <p className="font-heading text-xl font-bold text-warning">{lowStock.length} item</p>
                </div>
                <div className="p-2 rounded-full bg-warning/10">
                  <ShoppingCart className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cuti Pending</p>
                  <p className="font-heading text-xl font-bold text-secondary">{leaveRequests.length}</p>
                </div>
                <div className="p-2 rounded-full bg-secondary/10">
                  <Calendar className="w-5 h-5 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Tren Pendapatan vs Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="Pendapatan" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pengeluaran" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leave Requests */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Pengajuan Cuti Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada pengajuan pending.</p>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((lr) => (
                    <div key={lr.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{lr.profile_name}</span>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lr.start_date), 'dd MMM yyyy')} — {format(new Date(lr.end_date), 'dd MMM yyyy')}
                      </p>
                      <p className="text-sm">{lr.reason}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleLeaveAction(lr.id, 'approved')}>
                          <Check className="w-3 h-3 mr-1" /> Setujui
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleLeaveAction(lr.id, 'rejected')}>
                          <X className="w-3 h-3 mr-1" /> Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Daftar Belanja Besok
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">Semua stok mencukupi.</p>
              ) : (
                <div className="space-y-2">
                  {lowStock.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium">{item.item_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          Sisa: {item.ending_stock}
                        </Badge>
                        <span className="text-xs text-muted-foreground">min: {item.minimum_threshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff Overview */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Ikhtisar Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data karyawan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Nama</th>
                      <th className="pb-2 font-medium">Poin Disiplin</th>
                      <th className="pb-2 font-medium">Status SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2.5">{s.full_name || '-'}</td>
                        <td className="py-2.5">
                          <Badge variant={s.discipline_points > 3 ? 'destructive' : 'secondary'}>
                            {s.discipline_points}
                          </Badge>
                        </td>
                        <td className="py-2.5">{s.warning_letter_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
