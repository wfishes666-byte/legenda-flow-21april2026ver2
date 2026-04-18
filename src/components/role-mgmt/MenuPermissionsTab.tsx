import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MENU_GROUPS } from '@/lib/menuRegistry';
import type { AppRole } from '@/hooks/useAuth';
import type { CustomRole } from '@/hooks/useMenuPermissions';

interface BuiltInRole {
  value: AppRole;
  label: string;
}

type PermField = 'can_create' | 'can_edit' | 'can_delete';

interface Props {
  builtInRoles: BuiltInRole[];
  customRoles: CustomRole[];
  canManage: boolean;
  isEnabled: (role: AppRole | string, menuKey: string, isCustom?: boolean) => boolean;
  getPerm: (role: AppRole | string, menuKey: string, perm: PermField, isCustom?: boolean) => boolean;
  refetch: () => Promise<void> | void;
  roleBadgeVariant: (role: string) => any;
}

export default function MenuPermissionsTab({
  builtInRoles,
  customRoles,
  canManage,
  isEnabled,
  getPerm,
  refetch,
  roleBadgeVariant,
}: Props) {
  const { toast } = useToast();
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const allRoles: { key: string; label: string; isCustom: boolean }[] = [
    ...builtInRoles.map((r) => ({ key: r.value, label: r.label, isCustom: false })),
    ...customRoles.map((r) => ({ key: r.code, label: r.name, isCustom: true })),
  ];

  const upsertPerm = async (
    roleKey: string,
    isCustom: boolean,
    menuKey: string,
    patch: Partial<{ enabled: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>
  ) => {
    if (!canManage) return;
    const cellKey = `${isCustom ? 'c:' : ''}${roleKey}::${menuKey}`;
    setSavingCell(cellKey);

    // Build full row for upsert with current state defaults
    const currentEnabled = isEnabled(roleKey as any, menuKey, isCustom);
    const currentCreate = getPerm(roleKey as any, menuKey, 'can_create', isCustom);
    const currentEdit = getPerm(roleKey as any, menuKey, 'can_edit', isCustom);
    const currentDelete = getPerm(roleKey as any, menuKey, 'can_delete', isCustom);

    const payload: any = {
      menu_key: menuKey,
      enabled: patch.enabled ?? currentEnabled,
      can_create: patch.can_create ?? currentCreate,
      can_edit: patch.can_edit ?? currentEdit,
      can_delete: patch.can_delete ?? currentDelete,
    };
    if (isCustom) payload.role_code = roleKey;
    else payload.role = roleKey;

    // Try update, if no row affected, insert
    const matchCol = isCustom ? 'role_code' : 'role';
    const sb = supabase as any;
    const { data: existing } = await sb
      .from('role_menu_permissions')
      .select('id')
      .eq(matchCol, roleKey)
      .eq('menu_key', menuKey)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await sb.from('role_menu_permissions').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await sb.from('role_menu_permissions').insert(payload));
    }
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    await refetch();
    setSavingCell(null);
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 md:p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Toggle akses menu serta kewenangan Tambah / Ubah / Hapus untuk tiap role. Perubahan langsung berlaku setelah refresh.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium min-w-[240px] sticky left-0 bg-background">Menu</th>
                {allRoles.map((r) => (
                  <th key={r.key} className="p-3 font-medium text-center min-w-[200px]">
                    <Badge variant={r.isCustom ? 'outline' : roleBadgeVariant(r.key)}>{r.label}</Badge>
                    <div className="flex justify-center gap-3 mt-2 text-[10px] text-muted-foreground font-normal">
                      <span className="w-10">Aktif</span>
                      <span className="w-8">Tmbh</span>
                      <span className="w-8">Ubah</span>
                      <span className="w-8">Hps</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MENU_GROUPS.flatMap((group) => [
                <tr key={`g-${group.key}`} className="bg-muted/30">
                  <td colSpan={allRoles.length + 1} className="p-2 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <group.icon className="w-3.5 h-3.5" />
                      {group.label}
                    </span>
                  </td>
                </tr>,
                ...group.items.map((item) => (
                  <tr key={item.key} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 pl-6 sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground/70">{item.key}</code>
                    </td>
                    {allRoles.map((r) => {
                      const cellKey = `${r.isCustom ? 'c:' : ''}${r.key}::${item.key}`;
                      const enabled = isEnabled(r.key as any, item.key, r.isCustom);
                      const cCreate = getPerm(r.key as any, item.key, 'can_create', r.isCustom);
                      const cEdit = getPerm(r.key as any, item.key, 'can_edit', r.isCustom);
                      const cDelete = getPerm(r.key as any, item.key, 'can_delete', r.isCustom);
                      const saving = savingCell === cellKey;
                      return (
                        <td key={r.key} className="p-3 text-center">
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-10 flex justify-center">
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(v) => upsertPerm(r.key, r.isCustom, item.key, { enabled: v })}
                                  disabled={!canManage}
                                />
                              </div>
                              <div className="w-8 flex justify-center">
                                <Checkbox
                                  checked={cCreate}
                                  onCheckedChange={(v) => upsertPerm(r.key, r.isCustom, item.key, { can_create: !!v })}
                                  disabled={!canManage || !enabled}
                                />
                              </div>
                              <div className="w-8 flex justify-center">
                                <Checkbox
                                  checked={cEdit}
                                  onCheckedChange={(v) => upsertPerm(r.key, r.isCustom, item.key, { can_edit: !!v })}
                                  disabled={!canManage || !enabled}
                                />
                              </div>
                              <div className="w-8 flex justify-center">
                                <Checkbox
                                  checked={cDelete}
                                  onCheckedChange={(v) => upsertPerm(r.key, r.isCustom, item.key, { can_delete: !!v })}
                                  disabled={!canManage || !enabled}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
