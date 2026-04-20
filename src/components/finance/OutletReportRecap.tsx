import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ChevronDown, Store, TrendingUp } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type PeriodPreset = 'today' | '7d' | '30d' | 'this_month' | 'this_year' | 'all' | 'custom';

interface OutletReport {
  id: string;
  report_date: string;
  outlet_id: string | null;
  reporter_name: string | null;
  shift: string | null;
  starting_cash: number | null;
  dine_in_omzet: number | null;
  daily_offline_income: number | null;
  ending_physical_cash: number | null;
  ending_qris_cash: number | null;
  shopeefood_sales: number | null;
  gofood_sales: number | null;
  grabfood_sales: number | null;
  online_delivery_sales: number | null;
  notes: string | null;
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

interface Props {
  mode: 'log' | 'stats';
}

export default function OutletReportRecap({ mode }: Props) {
  const { outlets } = useOutlets();
  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [reports, setReports] = useState<OutletReport[]>([]);
  const [expensesByReport, setExpensesByReport] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => computeRange(period, { from: customFrom, to: customTo }), [period, customFrom, customTo]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let q = supabase.from('financial_reports').select('*').order('report_date', { ascending: false }).limit(500);
      if (range.from) q = q.gte('report_date', toDateStr(range.from)!);
      if (range.to) q = q.lte('report_date', toDateStr(range.to)!);
      const { data } = await q;
      const rows = (data || []) as OutletReport[];
      setReports(rows);

      // Fetch expenses for these reports
      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const { data: exp } = await supabase
          .from('expense_items')
          .select('report_id, amount')
          .in('report_id', ids);
        const map = new Map<string, number>();
        (exp || []).forEach((e: any) => {
          map.set(e.report_id, (map.get(e.report_id) || 0) + Number(e.amount || 0));
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

  // Apply outlet filter
  const filteredReports = useMemo(() => {
    if (outletFilter === 'all') return reports;
    if (outletFilter === 'unassigned') return reports.filter(r => !r.outlet_id);
    return reports.filter(r => r.outlet_id === outletFilter);
  }, [reports, outletFilter]);

  // Group by outlet
  const grouped = useMemo(() => {
    const map = new Map<string, OutletReport[]>();
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

  return (
    <div className="space-y-4">
      {/* Filter periode + outlet */}
      <Card className="glass-card">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Periode */}
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

          {/* Outlet + label periode */}
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
        <Card className="glass-card"><CardContent className="p-8 text-center text-muted-foreground">Tidak ada laporan dalam periode ini.</CardContent></Card>
      )}

      {!loading && grouped.map((g) => {
        const totalOmzet = g.rows.reduce((s, r) => s + (r.dine_in_omzet || r.daily_offline_income || 0), 0);
        const totalOnline = g.rows.reduce((s, r) =>
          s + (r.online_delivery_sales || ((r.shopeefood_sales || 0) + (r.gofood_sales || 0) + (r.grabfood_sales || 0))), 0);
        const totalCash = g.rows.reduce((s, r) => s + (r.ending_physical_cash || 0) + (r.ending_qris_cash || 0), 0);
        const totalExpense = g.rows.reduce((s, r) => s + (expensesByReport.get(r.id) || 0), 0);
        const avgExpense = g.rows.length ? totalExpense / g.rows.length : 0;

        if (mode === 'stats') {
          // Build daily trend data: aggregate per date
          const dailyMap = new Map<string, { date: string; omzet: number; pengeluaran: number }>();
          for (const r of g.rows) {
            const omzet = (r.dine_in_omzet || r.daily_offline_income || 0) +
              (r.online_delivery_sales || ((r.shopeefood_sales || 0) + (r.gofood_sales || 0) + (r.grabfood_sales || 0)));
            const exp = expensesByReport.get(r.id) || 0;
            const cur = dailyMap.get(r.report_date) || { date: r.report_date, omzet: 0, pengeluaran: 0 };
            cur.omzet += omzet;
            cur.pengeluaran += exp;
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
                  <Stat label="Total Omzet Dine-in" value={formatRp(totalOmzet)} />
                  <Stat label="Total Pengeluaran" value={formatRp(totalExpense)} />
                  <Stat label="Total Kas Diterima" value={formatRp(totalCash)} />
                  <Stat label="Rata-rata Pengeluaran" value={formatRp(avgExpense)} />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">Tren Harian: Omzet vs Pengeluaran</h4>
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
                          <Line type="monotone" dataKey="omzet" name="Omzet (Dine-in + Online)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }

        // mode === 'log'
        return (
          <Collapsible key={g.outletId} defaultOpen>
            <Card className="glass-card">
              <CollapsibleTrigger asChild>
                <div className="p-4 flex items-center gap-3 hover:bg-muted/30 transition cursor-pointer select-none" role="button" tabIndex={0}>
                  <Store className="w-4 h-4 text-primary" />
                  <h3 className="font-bold flex-1 text-left">{g.outletName}</h3>
                  <Badge variant="outline">{g.rows.length} laporan</Badge>
                  <ChevronDown className="w-4 h-4 transition-transform" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0 border-t">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground text-xs uppercase">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Shift</th>
                          <th className="p-3">Pelapor</th>
                          <th className="p-3 text-right">Omzet Dine-in</th>
                          <th className="p-3 text-right">Online</th>
                          <th className="p-3 text-right">Kas Fisik</th>
                          <th className="p-3 text-right">QRIS</th>
                          <th className="p-3 text-right">Pengeluaran</th>
                          <th className="p-3 text-right">Selisih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const online = r.online_delivery_sales || ((r.shopeefood_sales || 0) + (r.gofood_sales || 0) + (r.grabfood_sales || 0));
                          const omzet = r.dine_in_omzet || r.daily_offline_income || 0;
                          const expense = expensesByReport.get(r.id) || 0;
                          const cashIn = (r.ending_physical_cash || 0) + (r.ending_qris_cash || 0);
                          // Selisih = (omzet + online) - pengeluaran - kas masuk
                          const selisih = (omzet + online) - expense - cashIn;
                          return (
                            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="p-3 font-medium">{r.report_date}</td>
                              <td className="p-3 text-muted-foreground">{r.shift || '-'}</td>
                              <td className="p-3">{r.reporter_name || '-'}</td>
                              <td className="p-3 text-right">{formatRp(omzet)}</td>
                              <td className="p-3 text-right">{formatRp(online)}</td>
                              <td className="p-3 text-right">{formatRp(r.ending_physical_cash || 0)}</td>
                              <td className="p-3 text-right">{formatRp(r.ending_qris_cash || 0)}</td>
                              <td className="p-3 text-right text-destructive">{formatRp(expense)}</td>
                              <td className={cn('p-3 text-right font-medium', selisih < 0 ? 'text-destructive' : selisih > 0 ? 'text-primary' : '')}>
                                {formatRp(selisih)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
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
