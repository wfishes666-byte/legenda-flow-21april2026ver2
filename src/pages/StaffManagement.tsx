import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Pencil, Users, Trash2 } from 'lucide-react';
import { useOutlets } from '@/hooks/useOutlets';

interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  date_of_birth: string | null;
  job_title: string;
  discipline_points: number;
  warning_letter_status: string;
  employment_status: string;
  contract_end_date: string | null;
  outlet_id: string | null;
  base_salary: number;
  transport_allowance: number;
  meal_allowance: number;
}

const formatRupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

export default function StaffManagement() {
  const { toast } = useToast();
  const { role } = useAuth();
  const { outlets } = useOutlets();
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [editProfile, setEditProfile] = useState<StaffProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const canDelete = role === 'management';

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data as StaffProfile[]);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleSave = async () => {
    if (!editProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        phone: editProfile.phone,
        address: editProfile.address,
        job_title: editProfile.job_title,
        discipline_points: editProfile.discipline_points,
        warning_letter_status: editProfile.warning_letter_status,
        employment_status: editProfile.employment_status,
        contract_end_date: editProfile.contract_end_date,
        outlet_id: editProfile.outlet_id,
        base_salary: Math.round(editProfile.base_salary || 0),
        transport_allowance: Math.round(editProfile.transport_allowance || 0),
        meal_allowance: Math.round(editProfile.meal_allowance || 0),
      })
      .eq('id', editProfile.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Profil karyawan diperbarui.' });
      setEditProfile(null);
      fetchProfiles();
    }
  };

  const handleDelete = async (profile: StaffProfile) => {
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Profil ${profile.full_name} dihapus.` });
      fetchProfiles();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pt-12 md:pt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 font-sans">
            <Users className="w-7 h-7" /> Kelola Karyawan
          </h1>
          <p className="text-muted-foreground mt-1">Edit data profil karyawan</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-4 font-medium">Nama</th>
                    <th className="p-4 font-medium">Jabatan</th>
                    <th className="p-4 font-medium">Poin Disiplin</th>
                    <th className="p-4 font-medium">Status SP</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{p.full_name || '-'}</td>
                      <td className="p-4">{p.job_title || '-'}</td>
                      <td className="p-4">
                        <Badge variant={p.discipline_points > 3 ? 'destructive' : 'secondary'}>
                          {p.discipline_points}
                        </Badge>
                      </td>
                      <td className="p-4">{p.warning_letter_status}</td>
                      <td className="p-4">
                        <Badge variant={p.employment_status === 'Permanent' ? 'default' : 'outline'}>
                          {p.employment_status}
                        </Badge>
                      </td>
                      <td className="p-4 flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditProfile({ ...p })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Karyawan</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Yakin ingin menghapus profil <strong>{p.full_name}</strong>? Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada karyawan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!editProfile} onOpenChange={(open) => !open && setEditProfile(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Edit Profil: {editProfile?.full_name}</DialogTitle>
            </DialogHeader>
            {editProfile && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input value={editProfile.phone || ''} onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Jabatan</Label>
                    <Input value={editProfile.job_title || ''} onChange={(e) => setEditProfile({ ...editProfile, job_title: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Alamat</Label>
                  <Input value={editProfile.address || ''} onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Poin Disiplin</Label>
                    <Input type="number" value={editProfile.discipline_points} onChange={(e) => setEditProfile({ ...editProfile, discipline_points: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status SP</Label>
                    <Select value={editProfile.warning_letter_status} onValueChange={(v) => setEditProfile({ ...editProfile, warning_letter_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Non-SP">Non-SP</SelectItem>
                        <SelectItem value="SP-1">SP-1</SelectItem>
                        <SelectItem value="SP-2">SP-2</SelectItem>
                        <SelectItem value="SP-3">SP-3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status Kepegawaian</Label>
                    <Select value={editProfile.employment_status} onValueChange={(v) => setEditProfile({ ...editProfile, employment_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Contract">Kontrak</SelectItem>
                        <SelectItem value="Permanent">Tetap</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Akhir Kontrak</Label>
                    <Input type="date" value={editProfile.contract_end_date || ''} onChange={(e) => setEditProfile({ ...editProfile, contract_end_date: e.target.value || null })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Outlet / Cabang</Label>
                  <Select value={editProfile.outlet_id || ''} onValueChange={(v) => setEditProfile({ ...editProfile, outlet_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                    <SelectContent>
                      {outlets.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Komponen Gaji - terhubung ke Payroll */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Komponen Gaji (auto-isi ke Payroll)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Gaji Pokok</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.base_salary ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, base_salary: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.base_salary)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tunj. Transport</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.transport_allowance ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, transport_allowance: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.transport_allowance)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tunj. Makan</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.meal_allowance ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, meal_allowance: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.meal_allowance)}</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
