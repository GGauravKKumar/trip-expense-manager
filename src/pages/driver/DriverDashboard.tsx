import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Receipt, Clock, CheckCircle } from 'lucide-react';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ trips: 0, activeTrips: 0, pendingExpenses: 0, approvedExpenses: 0 });

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  async function fetchStats() {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single();
    if (!profile) return;

    const [{ count: trips }, { count: activeTrips }, { count: pendingExpenses }, { count: approvedExpenses }] = await Promise.all([
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profile.id),
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profile.id).eq('status', 'in_progress'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profile.id).eq('status', 'pending'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profile.id).eq('status', 'approved'),
    ]);

    setStats({ trips: trips || 0, activeTrips: activeTrips || 0, pendingExpenses: pendingExpenses || 0, approvedExpenses: approvedExpenses || 0 });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Driver Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">My Trips</CardTitle><MapPin className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.trips}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Trips</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.activeTrips}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Expenses</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pendingExpenses}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Approved</CardTitle><CheckCircle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.approvedExpenses}</div></CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
