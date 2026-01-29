import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import apiClient, { User as ApiUser } from '@/lib/api-client';
import { AppRole } from '@/types/database';

// When VITE_API_URL is set, the app runs against the Python backend (offline/self-hosted)
const USE_PYTHON_API = !!import.meta.env.VITE_API_URL;

interface AuthContextType {
  user: SupabaseUser | ApiUser | null;
  session: SupabaseSession | { user: ApiUser; access_token: string | null } | null;
  userRole: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | ApiUser | null>(null);
  const [session, setSession] = useState<SupabaseSession | { user: ApiUser; access_token: string | null } | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_PYTHON_API) {
      // Python backend mode
      const unsubscribe = apiClient.onAuthStateChange((apiUser) => {
        setUser(apiUser);
        setSession(apiUser ? { user: apiUser, access_token: apiClient.getToken() } : null);
        setUserRole((apiUser?.role as AppRole) ?? null);
        setLoading(false);
      });

      apiClient.getSession().then(({ user: apiUser }) => {
        setUser(apiUser);
        setSession(apiUser ? { user: apiUser, access_token: apiClient.getToken() } : null);
        setUserRole((apiUser?.role as AppRole) ?? null);
        setLoading(false);
      });

      return unsubscribe;
    }

    // Lovable Cloud mode
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Fetch user role
          setTimeout(async () => {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', newSession.user.id)
              .maybeSingle();

            setUserRole((roleData?.role as AppRole) ?? null);
            setLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', initialSession.user.id)
          .maybeSingle()
          .then(({ data: roleData }) => {
            setUserRole((roleData?.role as AppRole) ?? null);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (USE_PYTHON_API) {
      return apiClient.signUp(email, password, fullName);
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (USE_PYTHON_API) {
      return apiClient.signIn(email, password);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (USE_PYTHON_API) {
      await apiClient.signOut();
      return;
    }

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
