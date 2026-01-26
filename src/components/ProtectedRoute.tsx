import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { AppRole } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  
  // Enable session security for all protected routes
  useSessionSecurity({
    inactivityWarningTime: 25,
    inactivityLogoutTime: 30,
    enableActivityTracking: true,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (userRole === 'repair_org') {
      return <Navigate to="/repair" replace />;
    }
    return <Navigate to="/driver" replace />;
  }

  return <>{children}</>;
}
