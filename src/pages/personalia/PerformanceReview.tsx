import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Save, Search, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Outlet { id: string; name: string }
interface Profile { user_id: string; full_name: string; job_title?: string | null; outlet_id?: string | null }

const CATEGORIES: { key: string; label: string; weight: number }[] = [
  { key: 'disiplin',   label: 'Disiplin & Kehadiran',     weight: 20 },
  { key: 'sop',        label: 'Ketaatan SOP',             weight: 20 },
  { key: 'kecepatan',  label: 'Kecepatan & Ketepatan',    weight: 15 },
  { key: 'kualitas',   label: 'Kualitas Produk',          weight: 15 },
  { key: 'kerjasama',  label: 'Kerja Sama Tim',           weight: 10 },
  { key: 'attitude',   label: 'Attitude & Etika',         weight: 10 },
  { key: 'inisiatif',  label: 'Inisiatif & Tanggung Jawab', weight: 10 },
];

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

const ALL = '__all__';

export default function PerformanceReviewPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management' || role === 'pic' || role === 'admin';

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>(ALL);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviewerName, setReviewerName] = useState('');

  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const [records, setRecords] = useState<any[]>([]);

  // Initial load: outlets, profiles, reviewer name, history
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: p }, { data: r }] = await Promise.all([
        supabase.from('outlets').select('id, name').order('name'),
        supabase.from('profiles').select('user_id, full_name, job_title, outlet_id').order('full_name'),
        supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      if (o) setOutlets(o);
      if (p) setProfiles(p);
      if (r) setRecords(r);

      if (user?.id) {
        const { data: me } = await supabase
          .from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
        setReviewerName(me?.full_name || user.email || '');
      }
    })();
  }, [user?.id]);

  // Build set of user_ids already reviewed for the current period
  const reviewedForPeriod = useMemo(() => {
    if (!month || !year) return new Set<string>();
    const period = `${month} ${year}`;
    return new Set(records.filter((r: any) => r.review_period === period).map((r: any) => r.user_id));
  }, [records, month, year]);

  // Filter employees by outlet + search + exclude already-reviewed for this period
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (outletId !== ALL && p.outlet_id !== outletId) return false;
      if (search.trim() && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (reviewedForPeriod.has(p.user_id)) return false;
      return true;
    });
  }, [profiles, outletId, search, reviewedForPeriod]);

  // Reset employee if no longer in filtered list
  useEffect(() => {
    if (employeeId && !filteredProfiles.find((p) => p.user_id === employeeId)) {
      setEmployeeId('');
    }
  }, [filteredProfiles, employeeId]);

  // Compute weighted total: each category score 1-5, weight%; total normalized to 0-100
  const totalScore = useMemo(() => {
    let total = 0;
    for (const c of CATEGORIES) {
      const s = scores[c.key];
      if (typeof s === 'number' && s >= 1 && s <= 5) {
        total += (s / 5) * c.weight;
      }
    }
    return Math.round(total);
  }, [scores]);

  const setScore = (key: string, raw: string) => {
    if (raw === '') {
      const next = { ...scores };
      delete next[key];
      setScores(next);
      return;
    }
    const n = Math.max(1, Math.min(5, parseFloat(raw)));
    if (!isNaN(n)) setScores({ ...scores, [key]: n });
  };

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employeeId || !month || !year) {
      toast({ title: 'Lengkapi data', description: 'Pilih karyawan, bulan, dan tahun.', variant: 'destructive' });
      return;
    }
    const filledCount = CATEGORIES.filter((c) => typeof scores[c.key] === 'number').length;
    if (filledCount < CATEGORIES.length) {
      toast({ title: 'Skor belum lengkap', description: 'Isi semua 7 kategori (skala 1-5).', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const period = `${month} ${year}`;
    const breakdown: Record<string, { label: string; weight: number; score: number }> = {};
    CATEGORIES.forEach((c) => {
      breakdown[c.key] = { label: c.label, weight: c.weight, score: scores[c.key] };
    });

    const { error } = await supabase.from('performance_reviews').insert({
      user_id: employeeId,
      reviewer_id: user.id,
      review_period: period,
      score: totalScore,
      categories: breakdown,
    });

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Penilaian ${period} tersimpan (skor ${totalScore}).` });
      setEmployeeId('');
      setMonth('');
      setScores({});
      const { data: r } = await supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }).limit(200);
      if (r) setRecords(r);
    }
    setSubmitting(false);
  };

  const scoreVariant = (s: number): 'default' | 'secondary' | 'destructive' => {
    if (s >= 80) return 'default';
    if (s >= 60) return 'secondary';
    return 'destructive';
  };

  // Outlet pill filter (Semua + outlets)
  const outletPills = [{ id: ALL, name: 'Semua' }, ...outlets];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pt-12 md:pt-0">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <ClipboardList className="w-7 h-7" /> Penilaian Kinerja
        </h1>

        {/* Outlet filter pills */}
        <Card className="glass-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Store className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
              {outletPills.map((o) => {
                const active = outletId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutletId(o.id)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors uppercase tracking-wide',
                      active
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-wide uppercase">Penilaian Kinerja</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Periode */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Periode Penilaian
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger><SelectValue placeholder="-- Bulan --" /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={2020}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="Tahun"
                    />
                  </div>
                </div>

                {/* Karyawan */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Karyawan
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama karyawan..."
                      className="pl-9"
                    />
                  </div>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger><SelectValue placeholder={month && year ? '-- Pilih --' : 'Pilih bulan & tahun dahulu'} /></SelectTrigger>
                    <SelectContent>
                      {filteredProfiles.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {month && year ? 'Semua karyawan sudah dinilai untuk periode ini.' : 'Tidak ada karyawan.'}
                        </div>
                      )}
                      {filteredProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name}{p.job_title ? ` — ${p.job_title}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {month && year && (
                    <p className="text-[11px] text-muted-foreground">
                      Karyawan yang sudah dinilai untuk <strong>{month} {year}</strong> otomatis disembunyikan.
                    </p>
                  )}
                </div>

                {/* Penilai */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Penilai
                  </Label>
                  <Input value={reviewerName} readOnly className="bg-muted/40" />
                </div>

                {/* Skala Skor */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Skala Skor (1 - 5)
                    </Label>
                    <Badge variant={scoreVariant(totalScore)}>Total: {totalScore}/100</Badge>
                  </div>

                  <div className="space-y-2">
                    {CATEGORIES.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{c.label}</div>
                          <div className="text-[11px] font-medium text-muted-foreground">Bobot {c.weight}%</div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          step={1}
                          inputMode="numeric"
                          value={scores[c.key] ?? ''}
                          onChange={(e) => setScore(c.key, e.target.value)}
                          className="w-20 text-center font-semibold bg-background"
                          placeholder="-"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !employeeId}
                  className="w-full h-11 font-semibold"
                >
                  <Save className="w-4 h-4 mr-2" /> Simpan Penilaian
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Riwayat */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Penilaian</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Karyawan</th>
                    <th className="p-3 font-medium">Periode</th>
                    <th className="p-3 font-medium">Skor</th>
                    <th className="p-3 font-medium">Rincian</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const prof = profileMap.get(r.user_id);
                    const cats = (r.categories || {}) as Record<string, { label: string; score: number }>;
                    const summary = Object.values(cats)
                      .map((c) => `${c.label.split(' ')[0]}:${c.score}`)
                      .join(' · ');
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{prof?.full_name || '-'}</td>
                        <td className="p-3">{r.review_period}</td>
                        <td className="p-3"><Badge variant={scoreVariant(r.score)}>{r.score}</Badge></td>
                        <td className="p-3 text-xs text-muted-foreground max-w-md truncate">{summary || r.notes || '-'}</td>
                      </tr>
                    );
                  })}
                  {records.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada data penilaian.</td></tr>
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
