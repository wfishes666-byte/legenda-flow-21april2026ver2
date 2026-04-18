import { supabase } from '@/integrations/supabase/client';

export type LogParams = {
  module: string;
  action: string;
  description?: string;
  metadata?: Record<string, any>;
};

/**
 * Logs an activity for the currently authenticated user.
 * Silently fails to avoid breaking user flows.
 */
export async function logActivity({ module, action, description = '', metadata = {} }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Best-effort fetch profile + role for richer logs
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);

    const roles = (roleRows?.map((row) => row.role as string) || []);
    const rolePriority = ['admin', 'management', 'pic', 'stockman', 'crew', 'staff'];
    const resolvedRole = rolePriority.find((candidate) => roles.includes(candidate)) || 'crew';

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Unknown',
      user_role: resolvedRole,
      module,
      action,
      description,
      metadata,
    });
  } catch (err) {
    // ignore logging failures
    console.warn('logActivity failed', err);
  }
}
