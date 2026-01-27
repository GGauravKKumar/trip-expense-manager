import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import apiClient, { User } from '@/lib/api-client';

// Check if we're using the Python API backend (offline mode)
const USE_PYTHON_API = import.meta.env.VITE_API_URL ? true : false;

// Import Supabase only if not using Python API
let supabase: any = null;
if (!USE_PYTHON_API) {
  import('@/integrations/supabase/client').then((module) => {
    supabase = module.supabase;
  });
}

// Map API user to AppRole
type AppRole = 'admin' | 'driver' | 'repair_org';

interface AuthContextType {
  user: User | null;
  session: any | null;
  userRole: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_PYTHON_API) {
      // Python API mode
      const unsubscribe = apiClient.onAuthStateChange((user) => {
        setUser(user);
        setSession(user ? { user } : null);
        setUserRole(user?.role as AppRole || null);
        setLoading(false);
      });

      // Initial session check
      apiClient.getSession().then(({ user }) => {
        setUser(user);
        setSession(user ? { user } : null);
        setUserRole(user?.role as AppRole || null);
        setLoading(false);
      });

      return unsubscribe;
    } else {
      // Supabase mode (original implementation)
      const initSupabase = async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: any, session: any) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              // Fetch user role
              setTimeout(async () => {
                const { data: roleData } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', session.user.id)
                  .maybeSingle();
                
                setUserRole(roleData?.role as AppRole ?? null);
                setLoading(false);
              }, 0);
            } else {
              setUserRole(null);
              setLoading(false);
            }
          }
        );

        // THEN get initial session
        supabase.auth.getSession().then(({ data: { session } }: any) => {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle()
              .then(({ data: roleData }: any) => {
                setUserRole(roleData?.role as AppRole ?? null);
                setLoading(false);
              });
          } else {
            setLoading(false);
          }
        });

        return () => subscription.unsubscribe();
      };

      initSupabase();
    }
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (USE_PYTHON_API) {
      return apiClient.signUp(email, password, fullName);
    } else {
      const { supabase } = await import('@/integrations/supabase/client');
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
    }
  };

  const signIn = async (email: string, password: string) => {
    if (USE_PYTHON_API) {
      return apiClient.signIn(email, password);
    } else {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    }
  };

  const signOut = async () => {
    if (USE_PYTHON_API) {
      await apiClient.signOut();
    } else {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.signOut();
    }
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
