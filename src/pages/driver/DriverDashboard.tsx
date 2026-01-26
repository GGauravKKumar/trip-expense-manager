import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Receipt, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Trip } from '@/types/database';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';

import UpcomingTripsCard from '@/components/driver/UpcomingTripsCard';
import ActiveTripCard from '@/components/driver/ActiveTripCard';
import RecentExpensesCard from '@/components/driver/RecentExpensesCard';
import QuickActionsCard from '@/components/driver/QuickActionsCard';
import EarningsSummaryCard from '@/components/driver/EarningsSummaryCard';

interface Expense {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'denied';
  expense_date: string;
  category?: { name: string };
  trip?: { trip_number: string };
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [stats, setStats] = useState({ trips: 0, activeTrips: 0, pendingExpenses: 0, approvedExpenses: 0 });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyData, setMonthlyData] = useState({ trips: 0, revenue: 0, distance: 0 });

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  async function fetchAllData() {
    setLoading(true);
    
    // Get profile first
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single();
    if (!profile) {
      setLoading(false);
      return;
    }
    setProfileId(profile.id);

    // Fetch all data in parallel
    await Promise.all([
      fetchStats(profile.id),
      fetchTrips(profile.id),
      fetchExpenses(profile.id),
      fetchMonthlyData(profile.id),
    ]);
    
    setLoading(false);
  }

  async function fetchStats(profileId: string) {
    const [{ count: trips }, { count: activeTrips }, { count: pendingExpenses }, { count: approvedExpenses }] = await Promise.all([
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profileId),
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profileId).eq('status', 'in_progress'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profileId).eq('status', 'pending'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profileId).eq('status', 'approved'),
    ]);

    setStats({ trips: trips || 0, activeTrips: activeTrips || 0, pendingExpenses: pendingExpenses || 0, approvedExpenses: approvedExpenses || 0 });
  }

  async function fetchTrips(profileId: string) {
    const { data } = await supabase
      .from('trips')
      .select(`*, bus:buses(registration_number), route:routes(route_name)`)
      .eq('driver_id', profileId)
      .in('status', ['scheduled', 'in_progress'])
      .order('start_date', { ascending: true });
    
    setTrips((data || []) as Trip[]);
  }

  async function fetchExpenses(profileId: string) {
    const { data } = await supabase
      .from('expenses')
      .select(`id, amount, status, expense_date, category:expense_categories(name), trip:trips(trip_number)`)
      .eq('submitted_by', profileId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    setExpenses((data || []) as Expense[]);
  }

  async function fetchMonthlyData(profileId: string) {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const { data: monthlyTrips } = await supabase
      .from('trips')
      .select('id, total_revenue, return_total_revenue, distance_traveled, distance_return')
      .eq('driver_id', profileId)
      .eq('status', 'completed')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    if (monthlyTrips) {
      const revenue = monthlyTrips.reduce((sum, t) => sum + (Number(t.total_revenue) || 0) + (Number(t.return_total_revenue) || 0), 0);
      const distance = monthlyTrips.reduce((sum, t) => sum + (Number(t.distance_traveled) || 0) + (Number(t.distance_return) || 0), 0);
      setMonthlyData({
        trips: monthlyTrips.length,
        revenue,
        distance,
      });
    }
  }

  async function handleStartTrip(trip: Trip) {
    const { error } = await supabase
      .from('trips')
      .update({ status: 'in_progress' })
      .eq('id', trip.id);

    if (error) {
      toast.error('Failed to start trip');
    } else {
      toast.success('Trip started successfully');
      if (profileId) {
        fetchTrips(profileId);
        fetchStats(profileId);
      }
    }
  }

  async function handleCompleteTrip(trip: Trip) {
    const { error } = await supabase
      .from('trips')
      .update({ 
        status: 'completed',
        end_date: new Date().toISOString()
      })
      .eq('id', trip.id);

    if (error) {
      toast.error('Failed to complete trip');
    } else {
      toast.success('Trip completed successfully');
      if (profileId) {
        fetchTrips(profileId);
        fetchStats(profileId);
        fetchMonthlyData(profileId);
      }
    }
  }

  const activeTrip = trips.find(t => t.status === 'in_progress') || null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Driver Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Trips</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trips}</div>
              <p className="text-xs text-muted-foreground">Total trips assigned</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTrips}</div>
              <p className="text-xs text-muted-foreground">Currently in progress</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingExpenses}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approvedExpenses}</div>
              <p className="text-xs text-muted-foreground">Expenses approved</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <EarningsSummaryCard 
          monthlyTrips={monthlyData.trips}
          monthlyRevenue={monthlyData.revenue}
          totalDistance={monthlyData.distance}
        />

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <ActiveTripCard 
              trip={activeTrip}
              onUpdateOdometer={() => {
                // Navigate to trips page with the trip selected
                window.location.href = '/driver/trips';
              }}
              onCompleteTrip={() => {
                if (activeTrip) handleCompleteTrip(activeTrip);
              }}
            />
            <QuickActionsCard 
              hasActiveTrip={!!activeTrip}
              onUpdateOdometer={() => {
                window.location.href = '/driver/trips';
              }}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <UpcomingTripsCard 
              trips={trips}
              onStartTrip={handleStartTrip}
            />
            <RecentExpensesCard expenses={expenses} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
