import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Users, MapPin, Receipt, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface DashboardStats {
  totalBuses: number;
  activeBuses: number;
  totalDrivers: number;
  totalTrips: number;
  activeTrips: number;
  pendingExpenses: number;
  approvedExpenses: number;
  totalExpenseAmount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBuses: 0,
    activeBuses: 0,
    totalDrivers: 0,
    totalTrips: 0,
    activeTrips: 0,
    pendingExpenses: 0,
    approvedExpenses: 0,
    totalExpenseAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: totalBuses },
        { count: activeBuses },
        { count: totalDrivers },
        { count: totalTrips },
        { count: activeTrips },
        { count: pendingExpenses },
        { data: expenseData },
      ] = await Promise.all([
        supabase.from('buses').select('*', { count: 'exact', head: true }),
        supabase.from('buses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
        supabase.from('trips').select('*', { count: 'exact', head: true }),
        supabase.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('expenses').select('amount, status'),
      ]);

      const approvedExpenses = expenseData?.filter(e => e.status === 'approved') || [];
      const totalExpenseAmount = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        totalBuses: totalBuses || 0,
        activeBuses: activeBuses || 0,
        totalDrivers: totalDrivers || 0,
        totalTrips: totalTrips || 0,
        activeTrips: activeTrips || 0,
        pendingExpenses: pendingExpenses || 0,
        approvedExpenses: approvedExpenses.length,
        totalExpenseAmount,
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Buses',
      value: stats.totalBuses,
      subtitle: `${stats.activeBuses} active`,
      icon: Bus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Drivers',
      value: stats.totalDrivers,
      subtitle: 'Registered drivers',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Trips',
      value: stats.totalTrips,
      subtitle: `${stats.activeTrips} in progress`,
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingExpenses,
      subtitle: 'Expenses awaiting review',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Approved Expenses',
      value: stats.approvedExpenses,
      subtitle: 'Total approved',
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Total Expense Amount',
      value: `₹${stats.totalExpenseAmount.toLocaleString('en-IN')}`,
      subtitle: 'All approved expenses',
      icon: Receipt,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of your fleet operations</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {stats.pendingExpenses > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-4 p-4">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <p className="font-medium text-orange-900">
                  You have {stats.pendingExpenses} expense(s) pending approval
                </p>
                <p className="text-sm text-orange-700">
                  Go to Approve Expenses to review and approve/deny them
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
