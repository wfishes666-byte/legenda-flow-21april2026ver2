import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useOutlets } from '@/hooks/useOutlets';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, X, Pencil, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { CsvImportButton } from '@/components/CsvImportButton';
import { ExportButtons } from '@/components/ExportButtons';
import { formatRpExport } from '@/lib/exportUtils';

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  default_price: number;
}

interface DraftLine {
  id: string;
  item_name: string;
  unit: string;
  qty: number;
  unit_price: number;
}

interface InvoiceRow {
  id: string;
  outlet_id: string | null;
  invoice_date: string;
  total: number;
  notes: string | null;
  invoice_number: string | null;
  recipient: string | null;
  status: string;
  paid_at: string | null;
  outlet_name?: string;
  items?: { item_name: string; unit: string; qty: number; unit_price: number; total: number }[];
}

const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
const newLine = (): DraftLine => ({
  id: crypto.randomUUID(), item_name: '', unit: 'kg', qty: 0, unit_price: 0,
});

export default function InvoicePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { outlets } = useOutlets();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [tab, setTab] = useState('generate');

  // Generate
  const [outletId, setOutletId] = useState<string>('');
  const [invDate, setInvDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [saving, setSaving] = useState(false);

  // Rekap
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filterOutlet, setFilterOutlet] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInv, setExpandedInv] = useState<string | null>(null);
  // Ringkasan still uses month filter
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [recipient, setRecipient] = useState('');

  // Katalog
  const [catName, setCatName] = useState('');
  const [catUnit, setCatUnit] = useState('kg');
  const [catPrice, setCatPrice] = useState<number>(0);
  const [editingCat, setEditingCat] = useState<string | null>(null);

  const fetchCatalog = async () => {
    const { data } = await supabase.from('item_catalog').select('*').order('name');
    setCatalog((data as CatalogItem[]) || []);
  };

  const fetchInvoices = async () => {
    let q = supabase
      .from('invoices')
      .select('*')
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (filterOutlet !== 'all') q = q.eq('outlet_id', filterOutlet);
    const { data } = await q;
    const rows = (data as any[]) || [];
    const ids = rows.map((r) => r.id);
    let itemsByInv: Record<string, any[]> = {};
    if (ids.length) {
      const { data: items } = await supabase.from('invoice_items').select('*').in('invoice_id', ids);
      (items || []).forEach((it: any) => { (itemsByInv[it.invoice_id] ||= []).push(it); });
    }
    const outletMap = Object.fromEntries(outlets.map((o) => [o.id, o.name]));
    setInvoices(rows.map((r) => ({
      ...r,
      outlet_name: r.outlet_id ? outletMap[r.outlet_id] || 'Tanpa Outlet' : 'Tanpa Outlet',
      items: itemsByInv[r.id] || [],
    })));
  };

  useEffect(() => { fetchCatalog(); }, []);
  useEffect(() => { if (outlets.length && !outletId) setOutletId(outlets[0].id); }, [outlets, outletId]);
  useEffect(() => { fetchInvoices(); }, [filterOutlet, outlets]);

  // ====== Generate handlers ======
  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) =>
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);

  const pickCatalog = (lineId: string, item: CatalogItem) => {
    updateLine(lineId, { item_name: item.name, unit: item.unit, unit_price: Number(item.default_price) || 0 });
  };

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );

  const handleGenerate = async () => {
    if (!outletId) { toast({ title: 'Pilih outlet dulu', variant: 'destructive' }); return; }
    const valid = lines.filter((l) => l.item_name.trim() && l.qty > 0);
    if (valid.length === 0) { toast({ title: 'Tambahkan minimal 1 item', variant: 'destructive' }); return; }
    if (!user) return;
    setSaving(true);
    try {
      const total = valid.reduce((s, l) => s + l.qty * l.unit_price, 0);
      // Generate invoice number INV-YYYYMMDD-#### (sequential per day)
      const datePrefix = invDate.replace(/-/g, '');
      const { data: existingNums } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `INV-${datePrefix}-%`);
      const maxSeq = ((existingNums as any[]) || []).reduce((m, r) => {
        const seq = parseInt((r.invoice_number || '').split('-').pop() || '0', 10);
        return Number.isFinite(seq) && seq > m ? seq : m;
      }, 0);
      const invoiceNumber = `INV-${datePrefix}-${String(maxSeq + 1).padStart(4, '0')}`;
      const { data: inv, error } = await supabase
        .from('invoices')
        .insert({
          outlet_id: outletId,
          invoice_date: invDate,
          total,
          created_by: user.id,
          notes: '',
          invoice_number: invoiceNumber,
          recipient: recipient.trim() || null,
          status: 'unpaid',
        } as any)
        .select('id').single();
      if (error) throw error;
      const itemsPayload = valid.map((l) => ({
        invoice_id: inv.id,
        item_name: l.item_name.trim(),
        unit: l.unit,
        qty: l.qty,
        unit_price: l.unit_price,
        total: l.qty * l.unit_price,
      }));
      const { error: ie } = await supabase.from('invoice_items').insert(itemsPayload);
      if (ie) throw ie;
      toast({ title: `Invoice ${invoiceNumber} dibuat`, description: `${valid.length} item, total ${formatRp(total)}` });
      setLines([newLine()]);
      setRecipient('');
      fetchInvoices();
      setTab('rekap');
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const togglePaid = async (inv: InvoiceRow) => {
    const next = inv.status === 'paid' ? 'unpaid' : 'paid';
    const { error } = await supabase
      .from('invoices')
      .update({ status: next, paid_at: next === 'paid' ? new Date().toISOString() : null } as any)
      .eq('id', inv.id);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: next === 'paid' ? 'Ditandai terbayar' : 'Dibatalkan terbayar' }); fetchInvoices(); }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('Hapus invoice ini?')) return;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Invoice dihapus' }); fetchInvoices(); }
  };

  // ====== Katalog handlers ======
  const submitCatalog = async () => {
    if (!catName.trim()) return;
    if (editingCat) {
      const { error } = await supabase.from('item_catalog').update({
        name: catName.trim(), unit: catUnit, default_price: catPrice,
      }).eq('id', editingCat);
      if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      else toast({ title: 'Item diperbarui' });
    } else {
      const { error } = await supabase.from('item_catalog').insert({
        name: catName.trim(), unit: catUnit, default_price: catPrice,
      });
      if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      else toast({ title: 'Item ditambahkan' });
    }
    setCatName(''); setCatPrice(0); setCatUnit('kg'); setEditingCat(null);
    fetchCatalog();
  };

  const editCatalog = (c: CatalogItem) => {
    setEditingCat(c.id); setCatName(c.name); setCatUnit(c.unit); setCatPrice(Number(c.default_price));
  };
  const deleteCatalog = async (id: string) => {
    if (!confirm('Hapus item katalog?')) return;
    const { error } = await supabase.from('item_catalog').delete().eq('id', id);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Item dihapus' }); fetchCatalog(); }
  };

  // ====== Ringkasan ======
  const summary = useMemo(() => {
    const perOutlet: Record<string, number> = {};
    const perItem: Record<string, { qty: number; total: number; unit: string }> = {};
    invoices.forEach((inv) => {
      perOutlet[inv.outlet_name || '—'] = (perOutlet[inv.outlet_name || '—'] || 0) + Number(inv.total || 0);
      (inv.items || []).forEach((it) => {
        const key = it.item_name;
        if (!perItem[key]) perItem[key] = { qty: 0, total: 0, unit: it.unit };
        perItem[key].qty += Number(it.qty || 0);
        perItem[key].total += Number(it.total || 0);
      });
    });
    return {
      perOutlet: Object.entries(perOutlet).sort((a, b) => b[1] - a[1]),
      perItem: Object.entries(perItem).sort((a, b) => b[1].total - a[1].total),
      grand: Object.values(perOutlet).reduce((s, v) => s + v, 0),
    };
  }, [invoices]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <FileText className="w-7 h-7" /> Invoice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola dan pantau invoice semua outlet</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="generate">Generate Invoice</TabsTrigger>
            <TabsTrigger value="rekap">Rekap Invoice</TabsTrigger>
            <TabsTrigger value="katalog">Katalog Item</TabsTrigger>
            <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          </TabsList>

          {/* ============ GENERATE ============ */}
          <TabsContent value="generate">
            <Card className="glass-card">
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <div>
                    <Label>Outlet</Label>
                    <Select value={outletId} onValueChange={setOutletId}>
                      <SelectTrigger><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tanggal</Label>
                    <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Kepada (opsional)</Label>
                    <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Nama supplier / vendor" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Daftar Item</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px] text-xs">Nama Item</TableHead>
                          <TableHead className="w-24 text-xs">Satuan</TableHead>
                          <TableHead className="w-24 text-xs">Qty</TableHead>
                          <TableHead className="w-36 text-xs">Harga Satuan</TableHead>
                          <TableHead className="w-32 text-right text-xs">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => {
                          const total = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
                          return (
                            <TableRow key={line.id}>
                              <TableCell>
                                <ItemAutocomplete
                                  value={line.item_name}
                                  catalog={catalog}
                                  onChange={(name) => updateLine(line.id, { item_name: name })}
                                  onPick={(item) => pickCatalog(line.id, item)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input className="h-9 text-sm" value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-9 text-sm" type="number" min={0} value={line.qty || ''}
                                  onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) || 0 })} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-9 text-sm" type="number" min={0} value={line.unit_price || ''}
                                  onChange={(e) => updateLine(line.id, { unit_price: Number(e.target.value) || 0 })} />
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatRp(total)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-destructive h-8 w-8">
                                  <X className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 text-xs h-8" onClick={() => setLines([...lines, newLine()])}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Baris
                  </Button>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <span className="font-bold text-base">Grand Total: {formatRp(grandTotal)}</span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground italic">
                    * Items invoice akan otomatis dimuat ke Pengeluaran Transfer di Laporan Harian {outlets.find((o) => o.id === outletId)?.name || 'Outlet'}.
                  </p>
                  <Button onClick={handleGenerate} disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Generate Invoice'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ REKAP ============ */}
          <TabsContent value="rekap" className="space-y-4">
            <Card className="glass-card">
              <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
                <div>
                  <Label>Bulan</Label>
                  <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label>Outlet</Label>
                  <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Outlet</SelectItem>
                      {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto">
                  <ExportButtons
                    filename={`rekap-invoice-${filterMonth}`}
                    title={`Rekap Invoice - ${filterMonth}`}
                    subtitle={filterOutlet === 'all' ? 'Semua Outlet' : outlets.find(o => o.id === filterOutlet)?.name}
                    orientation="landscape"
                    columns={[
                      { header: 'Tanggal', accessor: (r: any) => format(new Date(r.invoice_date), 'dd/MM/yyyy') },
                      { header: 'Outlet', accessor: 'outlet_name' as any },
                      { header: 'Item', accessor: (r: any) => (r.items || []).map((i: any) => `${i.qty}x ${i.item_name}`).join('; ') },
                      { header: 'Total', accessor: (r: any) => formatRpExport(r.total) },
                    ]}
                    rows={invoices}
                  />
                </div>
              </CardContent>
            </Card>

            {invoices.length === 0 ? (
              <Card className="glass-card"><CardContent className="py-12 text-center text-sm text-muted-foreground">
                Belum ada invoice di periode ini.
              </CardContent></Card>
            ) : invoices.map((inv) => (
              <Card key={inv.id} className="glass-card">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{inv.outlet_name} — {format(new Date(inv.invoice_date), 'dd MMM yyyy')}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{(inv.items || []).length} item · Total {formatRp(Number(inv.total))}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteInvoice(inv.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Item</TableHead><TableHead>Satuan</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(inv.items || []).map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>{it.item_name}</TableCell>
                          <TableCell>{it.unit}</TableCell>
                          <TableCell className="text-right">{it.qty}</TableCell>
                          <TableCell className="text-right">{formatRp(Number(it.unit_price))}</TableCell>
                          <TableCell className="text-right font-medium">{formatRp(Number(it.total))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============ KATALOG ============ */}
          <TabsContent value="katalog" className="space-y-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base min-w-0 break-words">{editingCat ? 'Edit Item' : 'Tambah Item Baru'}</CardTitle>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                  <CsvImportButton
                    entityLabel="Item Katalog"
                    headers={['name', 'unit', 'default_price']}
                    templateFilename="template-katalog-item"
                    sampleRows={[
                      ['Ayam Potong', 'kg', 35000],
                      ['Beras Premium', 'kg', 14000],
                      ['Minyak Goreng', 'liter', 18000],
                    ]}
                    parseRow={(r) => {
                      const name = (r.name || '').trim();
                      if (!name) throw new Error('Kolom name wajib diisi');
                      const price = Number(r.default_price);
                      if (isNaN(price) || price < 0) throw new Error('default_price harus angka >= 0');
                      return { name, unit: (r.unit || 'pcs').trim(), default_price: price };
                    }}
                    onImport={async (rows) => {
                      const { error } = await supabase.from('item_catalog').insert(rows);
                      if (error) return { success: 0, failed: rows.length, message: error.message };
                      return { success: rows.length, failed: 0 };
                    }}
                    onImported={fetchCatalog}
                    helperText="Format kolom: name, unit, default_price. Item akan ditambahkan sebagai baru."
                  />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
                <div><Label>Nama</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="cth: Ayam Potong" /></div>
                <div><Label>Satuan</Label><Input value={catUnit} onChange={(e) => setCatUnit(e.target.value)} placeholder="kg" /></div>
                <div><Label>Harga Default</Label><Input type="number" value={catPrice || ''} onChange={(e) => setCatPrice(Number(e.target.value) || 0)} /></div>
                <div className="flex gap-2">
                  <Button onClick={submitCatalog}>{editingCat ? 'Simpan' : 'Tambah'}</Button>
                  {editingCat && <Button variant="outline" onClick={() => { setEditingCat(null); setCatName(''); setCatPrice(0); setCatUnit('kg'); }}>Batal</Button>}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base min-w-0 break-words">Daftar Katalog ({catalog.length})</CardTitle>
                <ExportButtons
                  filename="katalog-item"
                  title="Katalog Item"
                  columns={[
                    { header: 'Nama', accessor: 'name' },
                    { header: 'Satuan', accessor: 'unit' },
                    { header: 'Harga Default', accessor: (r) => formatRpExport(Number(r.default_price)) },
                  ]}
                  rows={catalog}
                />
              </CardHeader>
              <CardContent className="pt-2">
                {catalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Belum ada item katalog.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nama</TableHead><TableHead>Satuan</TableHead>
                      <TableHead className="text-right">Harga Default</TableHead><TableHead className="w-24"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {catalog.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.unit}</TableCell>
                          <TableCell className="text-right">{formatRp(Number(c.default_price))}</TableCell>
                          <TableCell className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => editCatalog(c)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteCatalog(c.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ RINGKASAN ============ */}
          <TabsContent value="ringkasan" className="space-y-4">
            <Card className="glass-card">
              <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
                <div>
                  <Label>Bulan</Label>
                  <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label>Outlet</Label>
                  <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Outlet</SelectItem>
                      {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Grand Total Periode</p>
                  <p className="text-xl font-bold">{formatRp(summary.grand)}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base min-w-0 break-words">Per Outlet</CardTitle>
                  <ExportButtons
                    filename={`ringkasan-invoice-per-outlet-${filterMonth}`}
                    title={`Ringkasan Invoice per Outlet - ${filterMonth}`}
                    columns={[
                      { header: 'Outlet', accessor: (r: any) => r[0] },
                      { header: 'Total', accessor: (r: any) => formatRpExport(r[1]) },
                      { header: '%', accessor: (r: any) => (summary.grand > 0 ? ((r[1] / summary.grand) * 100).toFixed(1) + '%' : '0%') },
                    ]}
                    rows={summary.perOutlet}
                  />
                </CardHeader>
                <CardContent>
                  {summary.perOutlet.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right w-20">%</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {summary.perOutlet.map(([name, total]) => (
                          <TableRow key={name}>
                            <TableCell>{name}</TableCell>
                            <TableCell className="text-right">{formatRp(total)}</TableCell>
                            <TableCell className="text-right text-muted-foreground text-xs">
                              {summary.grand > 0 ? ((total / summary.grand) * 100).toFixed(1) : '0'}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base min-w-0 break-words">Per Item</CardTitle>
                  <ExportButtons
                    filename={`ringkasan-invoice-per-item-${filterMonth}`}
                    title={`Ringkasan Invoice per Item - ${filterMonth}`}
                    columns={[
                      { header: 'Item', accessor: (r: any) => r[0] },
                      { header: 'Qty', accessor: (r: any) => `${r[1].qty} ${r[1].unit}` },
                      { header: 'Total', accessor: (r: any) => formatRpExport(r[1].total) },
                    ]}
                    rows={summary.perItem}
                  />
                </CardHeader>
                <CardContent>
                  {summary.perItem.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data.</p>
                  ) : (
                    <div className="max-h-[480px] overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {summary.perItem.map(([name, d]) => (
                            <TableRow key={name}>
                              <TableCell>{name}</TableCell>
                              <TableCell className="text-right">{d.qty.toLocaleString('id-ID')} {d.unit}</TableCell>
                              <TableCell className="text-right">{formatRp(d.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ============ Sub-component: autocomplete ============
function ItemAutocomplete({
  value, catalog, onChange, onPick,
}: {
  value: string;
  catalog: CatalogItem[];
  onChange: (v: string) => void;
  onPick: (item: CatalogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Cari atau ketik nama item"
        />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandInput placeholder="Cari item..." value={value} onValueChange={onChange} />
          <CommandList>
            <CommandEmpty>Tidak ada di katalog. Tetap bisa diketik manual.</CommandEmpty>
            <CommandGroup>
              {catalog.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => { onPick(c); setOpen(false); }}>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.unit} · Rp {Number(c.default_price).toLocaleString('id-ID')}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
