import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from '@/components/NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      {/* Top bar for mobile with notification bell */}
      <div className="fixed top-0 right-0 left-0 md:left-64 h-14 bg-background border-b z-10 flex items-center justify-end px-4">
        <NotificationBell />
      </div>
      <main className="md:ml-64 p-4 md:p-8 pt-16 md:pt-16">
        {children}
      </main>
    </div>
  );
}
