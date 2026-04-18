import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportButtons } from '@/components/ExportButtons';
import { formatRpExport } from '@/lib/exportUtils';

export default function DailyRecapPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [reports, setReports] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const fetchData = async () => {
    let query = supabase.from('financial_reports').select('*').order('report_date', { ascending: false }).limit(200);
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data } = await query;
    if (data) setReports(data);
    const { data: p } = await supabase.from('profiles').select('user_id, full_name');
    if (p) setProfiles(p);
  };

  useEffect(() => { fetchData(); }, [role, selectedOutlet]);

  const outletMap = new Map(outlets.map(o => [o.id, o.name]));
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

  const handleExportPDF = () => {
    if (reports.length === 0) { toast({ title: 'Tidak ada data', variant: 'destructive' }); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Rekapan Laporan Harian - Dua Legenda', 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Cabang', 'Pelapor', 'Kas Awal', 'Offline', 'Online', 'Kas Fisik', 'QRIS']],
      body: reports.map((r) => [
        r.report_date, outletMap.get(r.outlet_id) || '-', profileMap.get(r.user_id) || '-',
        formatRp(r.starting_cash), formatRp(r.daily_offline_income), formatRp(r.online_delivery_sales),
        formatRp(r.ending_physical_cash), formatRp(r.ending_qris_cash),
      ]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`rekapan-harian-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <FileText className="w-7 h-7" /> Rekapan Laporan Harian
          </h1>
          <div className="flex gap-2 items-center flex-wrap">
            <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
            <ExportButtons
              filename={`rekapan-harian-${format(new Date(), 'yyyy-MM-dd')}`}
              title="Rekapan Laporan Harian"
              orientation="landscape"
              columns={[
                { header: 'Tanggal', accessor: 'report_date' },
                { header: 'Cabang', accessor: (r: any) => outletMap.get(r.outlet_id) || '-' },
                { header: 'Pelapor', accessor: (r: any) => profileMap.get(r.user_id) || '-' },
                { header: 'Kas Awal', accessor: (r: any) => formatRpExport(r.starting_cash) },
                { header: 'Offline', accessor: (r: any) => formatRpExport(r.daily_offline_income) },
                { header: 'Online', accessor: (r: any) => formatRpExport(r.online_delivery_sales) },
                { header: 'Kas Fisik', accessor: (r: any) => formatRpExport(r.ending_physical_cash) },
                { header: 'QRIS', accessor: (r: any) => formatRpExport(r.ending_qris_cash) },
                { header: 'Selisih', accessor: (r: any) => {
                  const totalIncome = (r.daily_offline_income || 0) + (r.online_delivery_sales || 0);
                  const totalCash = (r.ending_physical_cash || 0) + (r.ending_qris_cash || 0);
                  const diff = totalCash - ((r.starting_cash || 0) + totalIncome);
                  return formatRpExport(diff);
                }},
              ]}
              rows={reports}
            />
          </div>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 font-medium">Cabang</th>
                    <th className="p-3 font-medium">Pelapor</th>
                    <th className="p-3 font-medium">Kas Awal</th>
                    <th className="p-3 font-medium">Offline</th>
                    <th className="p-3 font-medium">Online</th>
                    <th className="p-3 font-medium">Kas Fisik</th>
                    <th className="p-3 font-medium">QRIS</th>
                    <th className="p-3 font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const totalIncome = (r.daily_offline_income || 0) + (r.online_delivery_sales || 0);
                    const totalCash = (r.ending_physical_cash || 0) + (r.ending_qris_cash || 0);
                    const expected = (r.starting_cash || 0) + totalIncome;
                    const diff = totalCash - expected;
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{r.report_date}</td>
                        <td className="p-3">{outletMap.get(r.outlet_id) || '-'}</td>
                        <td className="p-3">{profileMap.get(r.user_id) || '-'}</td>
                        <td className="p-3">{formatRp(r.starting_cash)}</td>
                        <td className="p-3">{formatRp(r.daily_offline_income)}</td>
                        <td className="p-3">{formatRp(r.online_delivery_sales)}</td>
                        <td className="p-3">{formatRp(r.ending_physical_cash)}</td>
                        <td className="p-3">{formatRp(r.ending_qris_cash)}</td>
                        <td className="p-3">
                          <Badge variant={diff === 0 ? 'default' : diff > 0 ? 'secondary' : 'destructive'}>
                            {diff >= 0 ? '+' : ''}{formatRp(diff)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {reports.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Belum ada laporan.</td></tr>
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
