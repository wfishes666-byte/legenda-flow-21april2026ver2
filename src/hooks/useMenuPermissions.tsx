import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ALL_MENU_ITEMS } from '@/lib/menuRegistry';
import type { AppRole } from '@/hooks/useAuth';

export interface MenuPermissionRow {
  role: AppRole | null;
  role_code: string | null;
  menu_key: string;
  enabled: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CustomRole {
  id: string;
  code: string;
  name: string;
  description: string;
}

export function useMenuPermissions() {
  const [rows, setRows] = useState<MenuPermissionRow[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: perms }, { data: customs }] = await Promise.all([
      supabase.from('role_menu_permissions').select('role, role_code, menu_key, enabled, can_create, can_edit, can_delete'),
      supabase.from('custom_roles' as any).select('id, code, name, description').order('created_at'),
    ]);
    setRows(((perms as unknown) as MenuPermissionRow[]) || []);
    setCustomRoles(((customs as unknown) as CustomRole[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const findRow = useCallback(
    (role: AppRole | string, menuKey: string, isCustom: boolean) =>
      rows.find((r) =>
        isCustom ? r.role_code === role && r.menu_key === menuKey : r.role === role && r.menu_key === menuKey
      ),
    [rows]
  );

  const isEnabled = useCallback(
    (role: AppRole | string, menuKey: string, isCustom = false): boolean => {
      const row = findRow(role, menuKey, isCustom);
      if (row) return row.enabled;
      if (isCustom) return false;
      const item = ALL_MENU_ITEMS.find((i) => i.key === menuKey);
      return item ? item.defaultRoles.includes(role as AppRole) : false;
    },
    [findRow]
  );

  const getPerm = useCallback(
    (role: AppRole | string, menuKey: string, perm: 'can_create' | 'can_edit' | 'can_delete', isCustom = false): boolean => {
      const row = findRow(role, menuKey, isCustom);
      if (row) return row[perm];
      // Defaults: built-in admin/management get all CRUD; pic gets create+edit; others none
      if (!isCustom) {
        if (role === 'admin' || role === 'management') return true;
        if (role === 'pic' && perm !== 'can_delete') return true;
      }
      return false;
    },
    [findRow]
  );

  return { rows, customRoles, isEnabled, getPerm, loading, refetch: fetchAll };
}
