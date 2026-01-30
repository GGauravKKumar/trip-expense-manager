import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User as SupabaseUser, Session as SupabaseSession, SupabaseClient } from '@supabase/supabase-js';
import apiClient, { User as ApiUser } from '@/lib/api-client';
import { AppRole } from '@/types/database';

// When VITE_API_URL is set, the app runs against the Python backend (offline/self-hosted)
const VITE_API_URL = import.meta.env.VITE_API_URL;
const USE_PYTHON_API = !!VITE_API_URL;

// Lazy-load Supabase client only when needed (avoids error when VITE_SUPABASE_URL is missing)
let supabaseClient: SupabaseClient | null = null;
const getSupabase = async (): Promise<SupabaseClient> => {
  if (!supabaseClient) {
    const { supabase } = await import('@/integrations/supabase/client');
    supabaseClient = supabase;
  }
  return supabaseClient;
};

// Log backend mode on startup for debugging
if (typeof window !== 'undefined') {
  console.log(`[Auth] Backend mode: ${USE_PYTHON_API ? 'Python API' : 'Cloud'}`);
  if (USE_PYTHON_API) {
    console.log(`[Auth] Python API URL: ${VITE_API_URL}`);
  }
}

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

    // Lovable Cloud mode - lazy load Supabase
    let subscription: { unsubscribe: () => void } | null = null;

    const initSupabase = async () => {
      const supabase = await getSupabase();
      
      // Set up auth state listener FIRST
      const { data } = supabase.auth.onAuthStateChange(
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
      subscription = data.subscription;

      // THEN get initial session
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', initialSession.user.id)
          .maybeSingle();
        setUserRole((roleData?.role as AppRole) ?? null);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    initSupabase();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (USE_PYTHON_API) {
      return apiClient.signUp(email, password, fullName);
    }

    const supabase = await getSupabase();
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

    const supabase = await getSupabase();
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

    const supabase = await getSupabase();
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
