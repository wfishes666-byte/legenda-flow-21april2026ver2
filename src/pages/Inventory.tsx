import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useOutlets } from '@/hooks/useOutlets';
import OutletSelector from '@/components/OutletSelector';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, ShoppingCart, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockRow {
  item_name: string;
  starting_stock: string;
  incoming_stock: string;
  ending_stock: string;
  minimum_threshold: string;
}

interface InventoryRecord {
  id: string;
  item_name: string;
  starting_stock: number;
  incoming_stock: number;
  ending_stock: number;
  minimum_threshold: number;
  record_date: string;
  outlet_id: string | null;
}

export default function InventoryPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [submitting, setSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<StockRow[]>([
    { item_name: '', starting_stock: '', incoming_stock: '', ending_stock: '', minimum_threshold: '5' },
  ]);
  const [toBuyList, setToBuyList] = useState<InventoryRecord[]>([]);
  const [history, setHistory] = useState<InventoryRecord[]>([]);
  const canManage = role === 'management';
  const canViewAll = role === 'management' || role === 'pic' || role === 'stockman';

  const addRow = () =>
    setRows([...rows, { item_name: '', starting_stock: '', incoming_stock: '', ending_stock: '', minimum_threshold: '5' }]);
  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: keyof StockRow, value: string) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };

  const fetchInventory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('record_date', { ascending: false });
    if (!data) return;
    const latestByItem = new Map<string, InventoryRecord>();
    data.forEach((row) => {
      if (!latestByItem.has(row.item_name)) {
        latestByItem.set(row.item_name, row as InventoryRecord);
      }
    });
    const needToBuy = Array.from(latestByItem.values()).filter(
      (item) => (item.ending_stock ?? 0) <= (item.minimum_threshold ?? 5)
    );
    setToBuyList(needToBuy);
    if (canViewAll) setHistory(data.slice(0, 100) as InventoryRecord[]);
  };

  useEffect(() => { fetchInventory(); }, [user, submitting, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOutlet) return;
    setSubmitting(true);
    const validRows = rows.filter((r) => r.item_name.trim());
    if (validRows.length === 0) {
      toast({ title: 'Tidak ada data', description: 'Isi minimal satu item.', variant: 'destructive' });
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('inventory').insert(
      validRows.map((r) => ({
        user_id: user.id,
        outlet_id: selectedOutlet,
        record_date: recordDate,
        item_name: r.item_name,
        starting_stock: parseFloat(r.starting_stock) || 0,
        incoming_stock: parseFloat(r.incoming_stock) || 0,
        ending_stock: parseFloat(r.ending_stock) || 0,
        minimum_threshold: parseFloat(r.minimum_threshold) || 5,
      }))
    );
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Data stok tersimpan.' });
      setRows([{ item_name: '', starting_stock: '', incoming_stock: '', ending_stock: '', minimum_threshold: '5' }]);
    }
    setSubmitting(false);
  };

  const handleDeleteInventory = async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Data inventaris dihapus.' });
      fetchInventory();
    }
  };

  const handleExportCSV = async () => {
    const { data } = await supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (!data || data.length === 0) { toast({ title: 'Tidak ada data', variant: 'destructive' }); return; }
    const outletMap = new Map(outlets.map(o => [o.id, o.name]));
    const headers = ['Tanggal', 'Cabang', 'Nama Item', 'Stok Awal', 'Masuk', 'Stok Akhir', 'Min Threshold'];
    const csvRows = [headers.join(',')];
    data.forEach((r) => {
      csvRows.push([r.record_date, `"${outletMap.get(r.outlet_id ?? '') || '-'}"`, `"${r.item_name}"`, r.starting_stock, r.incoming_stock, r.ending_stock, r.minimum_threshold].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaris-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { data } = await supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (!data || data.length === 0) { toast({ title: 'Tidak ada data', variant: 'destructive' }); return; }
    const outletMap = new Map(outlets.map(o => [o.id, o.name]));
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Inventaris - Dua Legenda', 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Cabang', 'Item', 'Stok Awal', 'Masuk', 'Stok Akhir', 'Threshold']],
      body: data.map((r) => [
        r.record_date,
        outletMap.get(r.outlet_id ?? '') || '-',
        r.item_name,
        r.starting_stock,
        r.incoming_stock,
        r.ending_stock,
        r.minimum_threshold,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`inventaris-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const outletMap = new Map(outlets.map(o => [o.id, o.name]));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-sans">Stok & Inventaris</h1>
            <p className="text-muted-foreground mt-1">Input stok bahan baku harian</p>
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

        {toBuyList.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-warning" />
                Daftar Belanja (Stok Rendah)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {toBuyList.map((item) => (
                  <Badge key={item.id} variant="outline" className="border-warning text-warning">
                    {item.item_name} — sisa: {item.ending_stock}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-lg">Input Stok Harian</CardTitle>
                <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Tanggal:</Label>
                  <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-40 h-8 text-sm" />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="w-4 h-4 mr-1" /> Tambah
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 text-xs text-muted-foreground font-medium px-1">
                <span>Nama Item</span><span>Stok Awal</span><span>Masuk</span><span>Stok Akhir</span><span>Min. Threshold</span><span className="w-10" />
              </div>
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 md:p-0 bg-muted/30 md:bg-transparent rounded-lg">
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs md:hidden">Nama Item</Label>
                    <Input placeholder="Contoh: Kopi Arabika" value={row.item_name} onChange={(e) => updateRow(idx, 'item_name', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs md:hidden">Stok Awal</Label>
                    <Input type="number" placeholder="0" value={row.starting_stock} onChange={(e) => updateRow(idx, 'starting_stock', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs md:hidden">Masuk</Label>
                    <Input type="number" placeholder="0" value={row.incoming_stock} onChange={(e) => updateRow(idx, 'incoming_stock', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs md:hidden">Stok Akhir</Label>
                    <Input type="number" placeholder="0" value={row.ending_stock} onChange={(e) => updateRow(idx, 'ending_stock', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <Label className="text-xs md:hidden">Threshold</Label>
                    <Input type="number" placeholder="5" value={row.minimum_threshold} onChange={(e) => updateRow(idx, 'minimum_threshold', e.target.value)} />
                  </div>
                  {rows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <Button type="submit" className="w-full" disabled={submitting}>
            <Save className="w-4 h-4 mr-2" />
            {submitting ? 'Menyimpan...' : 'Simpan Stok'}
          </Button>
        </form>

        {/* History for management/pic/stockman */}
        {canViewAll && history.length > 0 && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Riwayat Inventaris</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Tanggal</th>
                      <th className="p-3 font-medium">Cabang</th>
                      <th className="p-3 font-medium">Item</th>
                      <th className="p-3 font-medium">Stok Akhir</th>
                      {canManage && <th className="p-3 font-medium">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{r.record_date}</td>
                        <td className="p-3">{outletMap.get(r.outlet_id ?? '') || '-'}</td>
                        <td className="p-3">{r.item_name}</td>
                        <td className="p-3">{r.ending_stock}</td>
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
                                  <AlertDialogTitle>Hapus Data</AlertDialogTitle>
                                  <AlertDialogDescription>Yakin ingin menghapus data {r.item_name} tanggal {r.record_date}?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteInventory(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
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
