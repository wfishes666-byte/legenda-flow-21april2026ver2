import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { CustomRole } from '@/hooks/useMenuPermissions';

interface Props {
  customRoles: CustomRole[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export default function CustomRolesTab({ customRoles, canManage, onChanged }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!canManage) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: 'Nama role wajib diisi', variant: 'destructive' });
      return;
    }
    const code = slugify(trimmed);
    if (!code) {
      toast({ title: 'Nama tidak valid', description: 'Gunakan huruf/angka.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from('custom_roles')
      .insert({ code, name: trimmed, description: description.trim() });
    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menambah role', description: error.message, variant: 'destructive' });
      return;
    }
    setName('');
    setDescription('');
    toast({ title: 'Role baru ditambahkan', description: `${trimmed} (${code})` });
    await onChanged();
  };

  const handleDelete = async (role: CustomRole) => {
    if (!canManage) return;
    if (!confirm(`Hapus role "${role.name}"? Semua pengaturan akses untuk role ini akan ikut terhapus.`)) return;
    setDeletingId(role.id);
    // Cleanup permissions then delete role
    await (supabase as any).from('role_menu_permissions').delete().eq('role_code', role.code);
    const { error } = await (supabase as any).from('custom_roles').delete().eq('id', role.id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Role dihapus' });
    await onChanged();
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 md:p-6 space-y-6">
        {canManage && (
          <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
            <h3 className="font-semibold text-sm">Tambah Role Baru</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="role-name">Nama Role</Label>
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="contoh: Supervisor"
                  disabled={saving}
                />
                {name && (
                  <p className="text-xs text-muted-foreground">
                    Kode: <code>{slugify(name)}</code>
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="role-desc">Deskripsi (opsional)</Label>
                <Input
                  id="role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Penjelasan singkat tugas"
                  disabled={saving}
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving || !name.trim()} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Tambah Role
            </Button>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-sm mb-3">Daftar Role Kustom ({customRoles.length})</h3>
          {customRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
              Belum ada role kustom. Tambahkan di atas.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {customRoles.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3 bg-muted/20 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="mb-2">{r.name}</Badge>
                    <p className="text-xs text-muted-foreground truncate">{r.description || '-'}</p>
                    <code className="text-[10px] text-muted-foreground/70">{r.code}</code>
                  </div>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
