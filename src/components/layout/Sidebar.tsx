import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  Bus,
  LayoutDashboard,
  Users,
  Route,
  MapPin,
  Receipt,
  FileCheck,
  LogOut,
  User,
  Menu,
  X,
  TrendingUp,
  Settings,
  Calendar,
  Package,
  Building2,
  Wrench,
  FileText,
  IndianRupee,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/buses', label: 'Buses', icon: Bus },
  { href: '/admin/routes', label: 'Routes', icon: Route },
  { href: '/admin/schedules', label: 'Schedules', icon: Calendar },
  { href: '/admin/trips', label: 'Trips', icon: MapPin },
  { href: '/admin/expenses', label: 'Approve Expenses', icon: FileCheck },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/stock', label: 'Stock', icon: Package },
  { href: '/admin/repair-organizations', label: 'Repair Orgs', icon: Building2 },
  { href: '/admin/repair-records', label: 'Repair Records', icon: Wrench },
  { href: '/admin/profitability', label: 'Profitability', icon: TrendingUp },
  { href: '/admin/gst-report', label: 'GST Report', icon: IndianRupee },
  { href: '/admin/drivers', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const driverLinks = [
  { href: '/driver', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/driver/trips', label: 'My Trips', icon: MapPin },
  { href: '/driver/expenses', label: 'My Expenses', icon: Receipt },
  { href: '/driver/profile', label: 'Profile', icon: User },
];

const repairOrgLinks = [
  { href: '/repair', label: 'Dashboard', icon: Wrench },
];

export default function Sidebar() {
  const { userRole, signOut, user } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const links = userRole === 'admin' ? adminLinks : userRole === 'repair_org' ? repairOrgLinks : driverLinks;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sidebar-primary/20 rounded-lg">
                <Bus className="h-6 w-6 text-sidebar-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sidebar-foreground">BusManager</h2>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole} Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium truncate text-sidebar-foreground/80">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
