import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOutlets } from '@/hooks/useOutlets';
import { useTabParam } from '@/hooks/useTabParam';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Paperclip, Camera, Trash2, Image as ImageIcon, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteArchive {
  id: string;
  outlet_id: string | null;
  note_date: string;
  note_name: string;
  amount: number;
  file_url: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

interface PendingFile {
  id: string;
  file: File;
  preview: string;
  note_name: string;
  amount: string;
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const formatDateDDMMYY = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
};

const formatDateLong = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function NoteArchivePage() {
  const { user } = useAuth();
  const { outlets, loading: outletsLoading } = useOutlets();
  const [mainTab, setMainTab] = useTabParam('upload');
  const [uploadOutletId, setUploadOutletId] = useState<string>('');
  const [uploadDate, setUploadDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [archives, setArchives] = useState<NoteArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutlet, setFilterOutlet] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  // Auto-pick first outlet when loaded
  useEffect(() => {
    if (!uploadOutletId && outlets.length > 0) setUploadOutletId(outlets[0].id);
  }, [outlets, uploadOutletId]);

  const fetchArchives = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('note_archives')
      .select('*')
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error('Gagal memuat arsip nota');
    else setArchives((data as NoteArchive[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArchives();
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr: PendingFile[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      arr.push({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        note_name: '',
        amount: '',
      });
    });
    if (arr.length === 0) {
      toast.error('Hanya file gambar yang didukung.');
      return;
    }
    setPending((prev) => [...prev, ...arr]);
    setMetaDialogOpen(true);
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const updatePending = (id: string, patch: Partial<PendingFile>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add('border-primary', 'bg-primary/5');
    };
    const onDragLeave = () => el.classList.remove('border-primary', 'bg-primary/5');
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove('border-primary', 'bg-primary/5');
      handleFiles(e.dataTransfer?.files ?? null);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, []);

  const handleSave = async () => {
    if (!user) return toast.error('Sesi tidak valid.');
    if (!uploadOutletId) return toast.error('Pilih outlet terlebih dulu.');
    if (pending.length === 0) return toast.error('Belum ada nota dipilih.');
    for (const p of pending) {
      if (!p.note_name.trim()) return toast.error('Nama nota wajib diisi semua.');
      if (!p.amount || Number(p.amount) <= 0) return toast.error('Nominal wajib diisi semua (lebih dari 0).');
    }

    setUploading(true);
    let success = 0;
    try {
      for (const p of pending) {
        const ext = p.file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${uploadDate}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('note-archives')
          .upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (upErr) {
          console.error(upErr);
          toast.error(`Gagal upload: ${p.note_name}`);
          continue;
        }
        const { data: pub } = supabase.storage.from('note-archives').getPublicUrl(path);
        const { error: insErr } = await supabase.from('note_archives').insert({
          outlet_id: uploadOutletId,
          note_date: uploadDate,
          note_name: p.note_name.trim(),
          amount: Number(p.amount),
          file_url: pub.publicUrl,
          storage_path: path,
          uploaded_by: user.id,
        });
        if (insErr) {
          console.error(insErr);
          toast.error(`Gagal menyimpan: ${p.note_name}`);
          await supabase.storage.from('note-archives').remove([path]);
          continue;
        }
        success += 1;
      }
      if (success > 0) toast.success(`${success} nota berhasil disimpan.`);
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setMetaDialogOpen(false);
      fetchArchives();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: NoteArchive) => {
    if (!confirm(`Hapus nota "${item.note_name}"?`)) return;
    const { error } = await supabase.from('note_archives').delete().eq('id', item.id);
    if (error) return toast.error('Gagal menghapus');
    if (item.storage_path) {
      await supabase.storage.from('note-archives').remove([item.storage_path]);
    }
    toast.success('Nota dihapus');
    fetchArchives();
  };

  // Filter & group
  const grouped = useMemo(() => {
    const filtered = archives.filter((a) => {
      if (filterOutlet !== 'all' && a.outlet_id !== filterOutlet) return false;
      if (filterDate && a.note_date !== filterDate) return false;
      return true;
    });
    const map = new Map<string, { outletId: string | null; outletName: string; date: string; items: NoteArchive[]; total: number }>();
    filtered.forEach((a) => {
      const key = `${a.outlet_id ?? 'none'}__${a.note_date}`;
      const outletName = outlets.find((o) => o.id === a.outlet_id)?.name ?? 'Tanpa Outlet';
      const g = map.get(key) ?? { outletId: a.outlet_id, outletName, date: a.note_date, items: [], total: 0 };
      g.items.push(a);
      g.total += Number(a.amount || 0);
      map.set(key, g);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.outletName.localeCompare(b.outletName);
    });
  }, [archives, filterOutlet, filterDate, outlets]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Arsip Nota</h1>
          <p className="text-sm text-muted-foreground mt-1">Foto dan simpan nota pembelian harian per outlet</p>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">Upload Nota</TabsTrigger>
            <TabsTrigger value="gallery">Galeri Nota</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-widest uppercase text-foreground">
                  Upload Nota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-semibold">Outlet</Label>
                    <div className="flex flex-wrap gap-2">
                      {outletsLoading ? (
                        <span className="text-sm text-muted-foreground">Memuat outlet...</span>
                      ) : (
                        outlets.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setUploadOutletId(o.id)}
                            className={cn(
                              'px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                              uploadOutletId === o.id
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-background text-foreground border-border hover:bg-muted'
                            )}
                          >
                            {o.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tanggal</Label>
                    <Input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="w-44"
                    />
                  </div>
                </div>

                {/* Dropzone */}
                <div
                  ref={dropRef}
                  className="border-2 border-dashed border-border rounded-lg bg-muted/30 px-6 py-12 flex flex-col items-center justify-center gap-3 transition-colors"
                >
                  <Paperclip className="w-7 h-7 text-foreground" />
                  <p className="text-sm text-foreground">Seret foto ke sini, atau pilih:</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-semibold"
                    >
                      Pilih File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                      className="font-semibold gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Kamera
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · Boleh pilih banyak</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      if (cameraInputRef.current) cameraInputRef.current.value = '';
                    }}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={pending.length === 0}
                    onClick={() => setMetaDialogOpen(true)}
                  >
                    {pending.length > 0 ? `Isi Detail (${pending.length})` : 'Simpan'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-lg font-bold">Arsip Tersimpan</h2>
              <div className="flex gap-2 items-center">
                <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Semua Outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Outlet</SelectItem>
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-40 h-9"
                />
                {filterDate && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Reset</Button>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                {loading ? (
                  <p className="text-center text-muted-foreground py-12">Memuat arsip...</p>
                ) : grouped.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Belum ada arsip nota yang tersimpan.</p>
                ) : (
                  <div className="space-y-8">
                    {grouped.map((g) => (
                      <div key={`${g.outletId}-${g.date}`} className="space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-border pb-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{g.outletName}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground">{formatDateLong(g.date)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{g.items.length} nota · Total: </span>
                            <span className="font-semibold text-foreground">{formatRupiah(g.total)}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {g.items.map((it) => {
                            const title = `${it.note_name} - ${formatDateDDMMYY(it.note_date)} - ${formatRupiah(it.amount)}`;
                            return (
                              <div key={it.id} className="group relative rounded-lg border border-border overflow-hidden bg-card">
                                <button
                                  type="button"
                                  className="block w-full aspect-square bg-muted overflow-hidden"
                                  onClick={() => setPreviewUrl(it.file_url)}
                                  title={title}
                                >
                                  <img
                                    src={it.file_url}
                                    alt={title}
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                                <div className="p-2 space-y-0.5">
                                  <p className="text-xs font-semibold text-foreground line-clamp-2" title={title}>
                                    {title}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(it)}
                                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-background"
                                  aria-label="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Metadata fill dialog */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Isi Detail Nota</DialogTitle>
          </DialogHeader>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Belum ada file dipilih.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((p, idx) => (
                <div key={p.id} className="flex gap-3 items-start border border-border rounded-lg p-3">
                  <img src={p.preview} alt={`Nota ${idx + 1}`} className="w-20 h-20 object-cover rounded-md border border-border flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nama Nota</Label>
                      <Input
                        placeholder="Nota Pasar Besar"
                        value={p.note_name}
                        onChange={(e) => updatePending(p.id, { note_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nominal (Rp)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="1340000"
                        value={p.amount}
                        onChange={(e) => updatePending(p.id, { amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePending(p.id)}
                    className="text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Judul akhir di galeri akan menjadi: <span className="font-mono">Nama - {formatDateDDMMYY(uploadDate)} - Rp …</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)} disabled={uploading}>
              Tutup
            </Button>
            <Button onClick={handleSave} disabled={uploading || pending.length === 0}>
              {uploading ? 'Menyimpan...' : `Simpan ${pending.length} Nota`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Pratinjau Nota
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Pratinjau nota" className="w-full max-h-[70vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
