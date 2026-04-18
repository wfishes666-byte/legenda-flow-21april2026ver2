import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

export type AppRole = 'staff' | 'management' | 'pic' | 'crew' | 'stockman';

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
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    setRole((data?.role as AppRole) || 'crew');
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
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

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
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
