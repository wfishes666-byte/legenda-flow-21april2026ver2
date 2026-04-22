import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Store, TrendingUp } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  DEFAULT_CONFIG,
  evalSelisih,
  type OutletFinanceConfig,
} from '@/lib/financeConfig';

type PeriodPreset = 'today' | '7d' | '30d' | 'this_month' | 'this_year' | 'all' | 'custom';

interface FinanceReport {
  id: string;
  report_date: string;
  outlet_id: string | null;
  reporter_name: string | null;
  starting_cash: number | null;
  cash_on_hand_added: number | null;
  extra_fields: Record<string, number> | null;
  notes: string | null;
}

interface ExpenseRow {
  report_id: string;
  payment_type: string;
  subtotal: number;
}

const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

function computeRange(p: PeriodPreset, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  switch (p) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case '7d': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30d': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'this_year': return { from: startOfYear(now), to: endOfDay(now) };
    case 'all': return { from: undefined, to: undefined };
    case 'custom': return { from: custom.from ? startOfDay(custom.from) : undefined, to: custom.to ? endOfDay(custom.to) : undefined };
  }
}

const toDateStr = (d?: Date) => d ? format(d, 'yyyy-MM-dd') : undefined;

export default function FinanceStatsRecap() {
  const { outlets } = useOutlets();
  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [expensesByReport, setExpensesByReport] = useState<Map<string, { cash: number; transfer: number }>>(new Map());
  const [configs, setConfigs] = useState<Record<string, OutletFinanceConfig>>({});
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => computeRange(period, { from: customFrom, to: customTo }), [period, customFrom, customTo]);

  // Load outlet finance configs (for selisih formula per outlet)
  useEffect(() => {
    supabase.from('outlet_finance_configs').select('*').then(({ data }) => {
      if (!data) return;
      const map: Record<string, OutletFinanceConfig> = {};
      data.forEach((row: any) => {
        map[row.outlet_id] = {
          outlet_id: row.outlet_id,
          income_fields: row.income_fields || [],
          pair_groups: row.pair_groups || [],
          summary_groups: row.summary_groups || [],
          selisih_formula: row.selisih_formula || '',
          selisih_inline_label: row.selisih_inline_label || '',
        };
      });
      setConfigs(map);
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let q = supabase.from('finance_daily_reports').select('*').order('report_date', { ascending: false }).limit(500);
      if (range.from) q = q.gte('report_date', toDateStr(range.from)!);
      if (range.to) q = q.lte('report_date', toDateStr(range.to)!);
      const { data } = await q;
      const rows = (data || []) as FinanceReport[];
      setReports(rows);

      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const { data: exp } = await supabase
          .from('finance_expense_items')
          .select('report_id, payment_type, subtotal')
          .in('report_id', ids);
        const map = new Map<string, { cash: number; transfer: number }>();
        (exp || []).forEach((e: ExpenseRow) => {
          const cur = map.get(e.report_id) || { cash: 0, transfer: 0 };
          if (e.payment_type === 'cash') cur.cash += Number(e.subtotal || 0);
          else if (e.payment_type === 'transfer') cur.transfer += Number(e.subtotal || 0);
          map.set(e.report_id, cur);
        });
        setExpensesByReport(map);
      } else {
        setExpensesByReport(new Map());
      }
      setLoading(false);
    };
    fetchData();
  }, [range.from?.getTime(), range.to?.getTime()]);

  const outletMap = useMemo(() => new Map(outlets.map(o => [o.id, o.name])), [outlets]);

  const filteredReports = useMemo(() => {
    if (outletFilter === 'all') return reports;
    if (outletFilter === 'unassigned') return reports.filter(r => !r.outlet_id);
    return reports.filter(r => r.outlet_id === outletFilter);
  }, [reports, outletFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, FinanceReport[]>();
    for (const r of filteredReports) {
      const key = r.outlet_id || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([outletId, rows]) => ({
      outletId,
      outletName: outletMap.get(outletId) || 'Tanpa Cabang',
      rows,
    })).sort((a, b) => a.outletName.localeCompare(b.outletName));
  }, [filteredReports, outletMap]);

  const periodLabel = (() => {
    if (period === 'all') return 'Semua waktu';
    if (range.from && range.to) {
      return `${format(range.from, 'dd MMM yyyy')} – ${format(range.to, 'dd MMM yyyy')}`;
    }
    return '-';
  })();

  // Helper: compute total income from extra_fields (sum of all numeric values)
  const sumIncome = (extra: Record<string, number> | null) => {
    if (!extra) return 0;
    return Object.values(extra).reduce((s, v) => s + (Number(v) || 0), 0);
  };

  return (
    <div className="space-y-4">
      {/* Filter periode + outlet */}
      <Card className="glass-card">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Periode:</span>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
              <SelectTrigger className="w-full sm:w-[180px] flex-1 sm:flex-none min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                <SelectItem value="this_month">Bulan Ini</SelectItem>
                <SelectItem value="this_year">Tahun Ini</SelectItem>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="custom">Kustom</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 sm:flex-none sm:w-[150px] justify-start min-w-[130px]', !customFrom && 'text-muted-foreground')}>
                      <CalendarIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span className="truncate">{customFrom ? format(customFrom, 'dd MMM yyyy') : 'Dari'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 sm:flex-none sm:w-[150px] justify-start min-w-[130px]', !customTo && 'text-muted-foreground')}>
                      <CalendarIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
                      <span className="truncate">{customTo ? format(customTo, 'dd MMM yyyy') : 'Sampai'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Store className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Outlet:</span>
            </div>
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger className="w-full sm:w-[200px] flex-1 sm:flex-none min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Outlet</SelectItem>
                {outlets.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
                <SelectItem value="unassigned">Tanpa Cabang</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="sm:ml-auto text-xs whitespace-normal text-center">{periodLabel}</Badge>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card className="glass-card"><CardContent className="p-8 text-center text-muted-foreground">Memuat...</CardContent></Card>
      )}

      {!loading && grouped.length === 0 && (
        <Card className="glass-card"><CardContent className="p-8 text-center text-muted-foreground">Tidak ada laporan finance dalam periode ini.</CardContent></Card>
      )}

      {!loading && grouped.map((g) => {
        const totalIncome = g.rows.reduce((s, r) => s + sumIncome(r.extra_fields), 0);
        const totalCashExp = g.rows.reduce((s, r) => s + (expensesByReport.get(r.id)?.cash || 0), 0);
        const totalTransferExp = g.rows.reduce((s, r) => s + (expensesByReport.get(r.id)?.transfer || 0), 0);
        const totalExpense = totalCashExp + totalTransferExp;
        const avgExpense = g.rows.length ? totalExpense / g.rows.length : 0;

        const cfg = configs[g.outletId] ?? { outlet_id: g.outletId, ...DEFAULT_CONFIG };

        // Daily trend: pendapatan (sum extra_fields) vs pengeluaran
        const dailyMap = new Map<string, { date: string; pendapatan: number; pengeluaran: number; selisih: number }>();
        for (const r of g.rows) {
          const exp = expensesByReport.get(r.id);
          const cash = exp?.cash || 0;
          const transfer = exp?.transfer || 0;
          const expTotal = cash + transfer;
          const income = sumIncome(r.extra_fields);
          const selisih = evalSelisih(cfg.selisih_formula, {
            ...(r.extra_fields || {}),
            total_expense: expTotal,
            total_cash_expense: cash,
            total_transfer_expense: transfer,
          });
          const cur = dailyMap.get(r.report_date) || { date: r.report_date, pendapatan: 0, pengeluaran: 0, selisih: 0 };
          cur.pendapatan += income;
          cur.pengeluaran += expTotal;
          cur.selisih += selisih;
          dailyMap.set(r.report_date, cur);
        }
        const trendData = Array.from(dailyMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(d => ({ ...d, label: format(parseISO(d.date), 'dd MMM') }));

        return (
          <Card key={g.outletId} className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-lg">{g.outletName}</h3>
                <Badge variant="outline" className="ml-auto">{g.rows.length} laporan</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Total Pendapatan" value={formatRp(totalIncome)} />
                <Stat label="Total Pengeluaran" value={formatRp(totalExpense)} />
                <Stat label="Pengeluaran Cash" value={formatRp(totalCashExp)} />
                <Stat label="Pengeluaran Transfer" value={formatRp(totalTransferExp)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Rata-rata Pengeluaran" value={formatRp(avgExpense)} />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">Tren Harian: Pendapatan vs Pengeluaran</h4>
                </div>
                {trendData.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Tidak ada data tren.</div>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : `${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatRp(v)}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="pendapatan" name="Pendapatan" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 border">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-bold text-base mt-1">{value}</div>
    </div>
  );
}
