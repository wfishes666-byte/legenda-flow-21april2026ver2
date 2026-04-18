import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck } from 'lucide-react';
import { AppRole, useAuth } from '@/hooks/useAuth';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import CustomRolesTab from '@/components/role-mgmt/CustomRolesTab';
import MenuPermissionsTab from '@/components/role-mgmt/MenuPermissionsTab';

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

const roleBadgeVariant = (role: string): any => {
  if (role === 'admin') return 'destructive';
  if (role === 'management') return 'default';
  if (role === 'pic') return 'secondary';
  return 'outline';
};

export default function RoleManagement() {
  const { toast } = useToast();
  const { role: currentRole } = useAuth();
  const canManage = currentRole === 'admin';
  const { customRoles, isEnabled, getPerm, refetch: refetchPerms } = useMenuPermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
      toast({ title: 'Akses ditolak', description: 'Hanya admin yang dapat mengubah role.', variant: 'destructive' });
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 font-sans">
            <ShieldCheck className="w-7 h-7" /> Kelola Role & Akses
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? 'Atur role karyawan, role kustom, & menu yang ditampilkan untuk tiap role' : 'Lihat hak akses (hanya admin yang dapat mengubah)'}
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Role Karyawan</TabsTrigger>
            <TabsTrigger value="custom">Role Kustom</TabsTrigger>
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
                <p className="text-xs text-muted-foreground mt-4">
                  Catatan: penugasan role kustom ke karyawan akan tersedia di pembaruan selanjutnya. Saat ini role kustom dipakai untuk mengatur template akses menu.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom">
            <CustomRolesTab customRoles={customRoles} canManage={canManage} onChanged={refetchPerms} />
          </TabsContent>

          <TabsContent value="menus">
            <MenuPermissionsTab
              builtInRoles={ROLES.map(({ value, label }) => ({ value, label }))}
              customRoles={customRoles}
              canManage={canManage}
              isEnabled={isEnabled}
              getPerm={getPerm}
              refetch={refetchPerms}
              roleBadgeVariant={roleBadgeVariant}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
