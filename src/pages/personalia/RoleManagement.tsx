import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { AppRole, useAuth } from '@/hooks/useAuth';
import { MENU_GROUPS } from '@/lib/menuRegistry';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

interface UserWithRole {
  user_id: string;
  full_name: string;
  job_title: string;
  role: AppRole;
}

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Akses penuh sistem (super user)' },
  { value: 'management', label: 'Management', description: 'Akses penuh semua menu' },
  { value: 'pic', label: 'PIC', description: 'Edit semua kanal, tidak bisa hapus' },
  { value: 'stockman', label: 'Stockman', description: 'Profil sendiri + stok & inventaris' },
  { value: 'crew', label: 'Crew', description: 'Profil sendiri + laporan harian' },
  { value: 'staff', label: 'Staff', description: 'Akses dasar' },
];

export default function RoleManagement() {
  const { toast } = useToast();
  const { role: currentRole } = useAuth();
  const canManage = currentRole === 'admin' || currentRole === 'management';
  const { rows: permRows, isEnabled, refetch: refetchPerms } = useMenuPermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, job_title')
      .order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    if (profiles) {
      const merged: UserWithRole[] = profiles.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || '-',
        job_title: p.job_title || '-',
        role: (roles?.find((r) => r.user_id === p.user_id)?.role as AppRole) || 'crew',
      }));
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    if (!canManage) {
      toast({ title: 'Akses ditolak', description: 'Hanya admin/management yang dapat mengubah role.', variant: 'destructive' });
      return;
    }
    setUpdating(userId);
    const { error: delError } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (delError) {
      toast({ title: 'Gagal', description: delError.message, variant: 'destructive' });
      setUpdating(null);
      return;
    }
    const { error: insError } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
    setUpdating(null);
    if (insError) {
      toast({ title: 'Gagal mengubah role', description: insError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Role karyawan diperbarui.' });
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)));
    }
  };

  const handleTogglePerm = async (role: AppRole, menuKey: string, enabled: boolean) => {
    if (!canManage) return;
    const cellKey = `${role}::${menuKey}`;
    setSavingPerm(cellKey);
    const existing = permRows.find((r) => r.role === role && r.menu_key === menuKey);
    if (existing) {
      const { error } = await supabase
        .from('role_menu_permissions')
        .update({ enabled })
        .eq('role', role)
        .eq('menu_key', menuKey);
      if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await supabase
        .from('role_menu_permissions')
        .insert({ role, menu_key: menuKey, enabled });
      if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
    await refetchPerms();
    setSavingPerm(null);
  };

  const roleBadgeVariant = (role: AppRole) => {
    if (role === 'admin') return 'destructive';
    if (role === 'management') return 'default';
    if (role === 'pic') return 'secondary';
    return 'outline';
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pt-12 md:pt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 font-sans">
            <ShieldCheck className="w-7 h-7" /> Kelola Role & Akses
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? 'Atur role karyawan & menu yang ditampilkan untuk tiap role' : 'Lihat hak akses (hanya admin/management yang dapat mengubah)'}
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Role Karyawan</TabsTrigger>
            <TabsTrigger value="menus">Akses Menu per Role</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="glass-card">
              <CardContent className="p-4 md:p-6">
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 mb-6">
                  {ROLES.map((r) => (
                    <div key={r.value} className="rounded-lg border border-border p-3 bg-muted/20">
                      <Badge variant={roleBadgeVariant(r.value)} className="mb-2">{r.label}</Badge>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Nama Karyawan</th>
                        <th className="p-3 font-medium">Jabatan</th>
                        <th className="p-3 font-medium">Role Saat Ini</th>
                        <th className="p-3 font-medium w-56">Ubah Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Memuat...</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada karyawan.</td></tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{u.full_name}</td>
                            <td className="p-3 text-muted-foreground">{u.job_title}</td>
                            <td className="p-3">
                              <Badge variant={roleBadgeVariant(u.role)}>
                                {ROLES.find((r) => r.value === u.role)?.label || u.role}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Select
                                value={u.role}
                                onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}
                                disabled={updating === u.user_id || !canManage}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menus">
            <Card className="glass-card">
              <CardContent className="p-4 md:p-6 space-y-6">
                <p className="text-sm text-muted-foreground">
                  Centang menu yang ingin ditampilkan untuk tiap role. Perubahan langsung berlaku setelah refresh.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium min-w-[260px]">Menu</th>
                        {ROLES.map((r) => (
                          <th key={r.value} className="p-3 font-medium text-center">
                            <Badge variant={roleBadgeVariant(r.value)}>{r.label}</Badge>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MENU_GROUPS.map((group) => (
                        <>
                          <tr key={`g-${group.key}`} className="bg-muted/30">
                            <td colSpan={ROLES.length + 1} className="p-2 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                              <span className="inline-flex items-center gap-2">
                                <group.icon className="w-3.5 h-3.5" />
                                {group.label}
                              </span>
                            </td>
                          </tr>
                          {group.items.map((item) => (
                            <tr key={item.key} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="p-3 pl-6">
                                <div className="flex items-center gap-2">
                                  <item.icon className="w-4 h-4 text-muted-foreground" />
                                  <span>{item.label}</span>
                                </div>
                                <code className="text-[10px] text-muted-foreground/70">{item.key}</code>
                              </td>
                              {ROLES.map((r) => {
                                const cellKey = `${r.value}::${item.key}`;
                                const checked = isEnabled(r.value, item.key);
                                return (
                                  <td key={r.value} className="p-3 text-center">
                                    {savingPerm === cellKey ? (
                                      <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                    ) : (
                                      <Switch
                                        checked={checked}
                                        onCheckedChange={(v) => handleTogglePerm(r.value, item.key, v)}
                                        disabled={!canManage}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
