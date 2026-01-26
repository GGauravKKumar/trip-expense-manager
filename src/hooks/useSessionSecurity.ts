import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SessionSecurityOptions {
  // Time in minutes before showing inactivity warning
  inactivityWarningTime?: number;
  // Time in minutes before automatic logout due to inactivity
  inactivityLogoutTime?: number;
  // Enable session activity tracking
  enableActivityTracking?: boolean;
}

const DEFAULT_OPTIONS: SessionSecurityOptions = {
  inactivityWarningTime: 25, // Warn at 25 minutes
  inactivityLogoutTime: 30, // Logout at 30 minutes
  enableActivityTracking: true,
};

export function useSessionSecurity(options: SessionSecurityOptions = {}) {
  const navigate = useNavigate();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
  }, []);

  // Check session validity
  const checkSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      // Session is invalid, log out
      await supabase.auth.signOut();
      navigate('/login');
      return false;
    }

    // Check token expiration
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      toast.error('Your session has expired. Please log in again.');
      await supabase.auth.signOut();
      navigate('/login');
      return false;
    }

    return true;
  }, [navigate]);

  // Handle inactivity check
  const checkInactivity = useCallback(async () => {
    const inactiveMinutes = (Date.now() - lastActivityRef.current) / 1000 / 60;

    if (inactiveMinutes >= opts.inactivityLogoutTime!) {
      // Log out due to inactivity
      toast.error('You have been logged out due to inactivity.');
      await supabase.auth.signOut();
      navigate('/login');
      return;
    }

    if (inactiveMinutes >= opts.inactivityWarningTime! && !warningShownRef.current) {
      // Show warning
      const remainingMinutes = Math.ceil(opts.inactivityLogoutTime! - inactiveMinutes);
      toast.warning(
        `You will be logged out in ${remainingMinutes} minute(s) due to inactivity.`,
        { duration: 10000 }
      );
      warningShownRef.current = true;
    }
  }, [navigate, opts.inactivityLogoutTime, opts.inactivityWarningTime]);

  // Force logout
  const forceLogout = useCallback(async (message?: string) => {
    if (message) {
      toast.error(message);
    }
    await supabase.auth.signOut();
    navigate('/login');
  }, [navigate]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
    updateActivity();
    return true;
  }, [updateActivity]);

  useEffect(() => {
    if (!opts.enableActivityTracking) return;

    // Activity event listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up periodic checks
    checkIntervalRef.current = setInterval(() => {
      checkInactivity();
      checkSession();
    }, 60000); // Check every minute

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        updateActivity();
      } else if (event === 'USER_UPDATED') {
        updateActivity();
      }
    });

    // Initial session check
    checkSession();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      subscription.unsubscribe();
    };
  }, [opts.enableActivityTracking, updateActivity, checkInactivity, checkSession, navigate]);

  return {
    updateActivity,
    checkSession,
    forceLogout,
    refreshSession,
  };
}

// Hook to track failed login attempts (use on login page)
export function useLoginAttemptTracking() {
  const attemptsRef = useRef<{ count: number; lastAttempt: number }>({
    count: 0,
    lastAttempt: 0,
  });

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  const recordFailedAttempt = useCallback(() => {
    const now = Date.now();
    
    // Reset if lockout has expired
    if (now - attemptsRef.current.lastAttempt > LOCKOUT_DURATION) {
      attemptsRef.current = { count: 0, lastAttempt: 0 };
    }

    attemptsRef.current.count++;
    attemptsRef.current.lastAttempt = now;

    return attemptsRef.current.count;
  }, []);

  const isLockedOut = useCallback(() => {
    const now = Date.now();
    
    // Reset if lockout has expired
    if (now - attemptsRef.current.lastAttempt > LOCKOUT_DURATION) {
      attemptsRef.current = { count: 0, lastAttempt: 0 };
      return false;
    }

    return attemptsRef.current.count >= MAX_ATTEMPTS;
  }, []);

  const getRemainingLockoutTime = useCallback(() => {
    if (!isLockedOut()) return 0;
    
    const elapsed = Date.now() - attemptsRef.current.lastAttempt;
    return Math.ceil((LOCKOUT_DURATION - elapsed) / 1000 / 60); // Minutes
  }, [isLockedOut]);

  const resetAttempts = useCallback(() => {
    attemptsRef.current = { count: 0, lastAttempt: 0 };
  }, []);

  return {
    recordFailedAttempt,
    isLockedOut,
    getRemainingLockoutTime,
    resetAttempts,
    attemptsRemaining: MAX_ATTEMPTS - attemptsRef.current.count,
  };
}
