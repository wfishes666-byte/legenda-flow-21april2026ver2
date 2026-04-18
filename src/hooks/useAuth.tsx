import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

export type AppRole = 'staff' | 'management' | 'pic' | 'crew' | 'stockman' | 'admin';

export interface SignUpPayload {
  full_name: string;
  nickname?: string;
  address?: string;
  phone?: string;
  nik?: string;
  outlet_id?: string | null;
  join_month?: string;
  join_year?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, payload: SignUpPayload) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  session: null,
  user: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: new Error('AuthProvider not ready') }),
  signUp: async () => ({ error: new Error('AuthProvider not ready') }),
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (data?.map((row) => row.role as AppRole) || []);
    const priority: AppRole[] = ['admin', 'management', 'pic', 'stockman', 'crew', 'staff'];
    const resolvedRole = priority.find((candidate) => roles.includes(candidate)) || 'crew';
    setRole(resolvedRole);
  };

  useEffect(() => {
    const syncSession = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchRole(nextSession.user.id);
      } else {
        setRole(null);
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true);
        setTimeout(() => {
          void syncSession(nextSession);
        }, 0);
      }
    );

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void syncSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setTimeout(() => logActivity({ module: 'Auth', action: 'Login', description: `Login berhasil (${email})` }), 100);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, payload: SignUpPayload) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: payload.full_name,
          nickname: payload.nickname || '',
          address: payload.address || '',
          phone: payload.phone || '',
          nik: payload.nik || '',
          outlet_id: payload.outlet_id || '',
          join_month: payload.join_month || '',
          join_year: payload.join_year || '',
        },
      },
    });
    if (!error) {
      setTimeout(() => logActivity({ module: 'Auth', action: 'Sign Up', description: `Pendaftaran akun baru (${email})` }), 100);
    }
    return { error };
  };

  const signOut = async () => {
    await logActivity({ module: 'Auth', action: 'Logout', description: 'Pengguna keluar dari sistem' });
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
