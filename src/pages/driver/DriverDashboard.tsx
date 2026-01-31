import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Receipt, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Trip } from '@/types/database';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import apiClient from '@/lib/api-client';
import { getCloudClient, USE_PYTHON_API } from '@/lib/backend';

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
  const [monthlyData, setMonthlyData] = useState({ trips: 0, distance: 0 });

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  async function fetchAllData() {
    setLoading(true);

    // Offline (Python API) - profile id comes from the auth payload
    if (USE_PYTHON_API) {
      const pid = (user as any)?.profile_id as string | undefined;
      if (!pid) {
        setLoading(false);
        return;
      }
      setProfileId(pid);

      await Promise.all([
        fetchStats(pid),
        fetchTrips(pid),
        fetchExpenses(pid),
        fetchMonthlyData(pid),
      ]);
      setLoading(false);
      return;
    }

    // Cloud mode - fetch profile id via database
    const supabase = await getCloudClient();
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', (user as any)!.id).single();
    if (!profile) {
      setLoading(false);
      return;
    }
    setProfileId(profile.id);

    await Promise.all([
      fetchStats(profile.id),
      fetchTrips(profile.id),
      fetchExpenses(profile.id),
      fetchMonthlyData(profile.id),
    ]);
    
    setLoading(false);
  }

  async function fetchStats(profileId: string) {
    if (USE_PYTHON_API) {
      const [{ data: allTrips }, { data: activeTrips }, { data: pendingExpenses }, { data: approvedExpenses }] = await Promise.all([
        apiClient.get<any[]>('/trips', { limit: 1000 }),
        apiClient.get<any[]>('/trips', { status: 'in_progress', limit: 1000 }),
        apiClient.get<any[]>('/expenses', { status: 'pending', limit: 1000 }),
        apiClient.get<any[]>('/expenses', { status: 'approved', limit: 1000 }),
      ]);

      setStats({
        trips: allTrips?.length || 0,
        activeTrips: activeTrips?.length || 0,
        pendingExpenses: pendingExpenses?.length || 0,
        approvedExpenses: approvedExpenses?.length || 0,
      });
      return;
    }

    const supabase = await getCloudClient();
    const [{ count: trips }, { count: activeTrips }, { count: pendingExpenses }, { count: approvedExpenses }] = await Promise.all([
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profileId),
      supabase.from('trips').select('*', { count: 'exact', head: true }).eq('driver_id', profileId).eq('status', 'in_progress'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profileId).eq('status', 'pending'),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('submitted_by', profileId).eq('status', 'approved'),
    ]);

    setStats({ trips: trips || 0, activeTrips: activeTrips || 0, pendingExpenses: pendingExpenses || 0, approvedExpenses: approvedExpenses || 0 });
  }

  async function fetchTrips(profileId: string) {
    if (USE_PYTHON_API) {
      const { data } = await apiClient.get<any[]>('/trips', { limit: 1000 });
      const filtered = (data || [])
        .filter((t) => ['scheduled', 'in_progress'].includes(t.status))
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      setTrips(filtered as Trip[]);
      return;
    }

    const supabase = await getCloudClient();
    const { data } = await supabase
      .from('trips')
      .select(`*, bus:buses(registration_number), route:routes(route_name)`)
      .eq('driver_id', profileId)
      .in('status', ['scheduled', 'in_progress'])
      .order('start_date', { ascending: true });
    
    setTrips((data || []) as Trip[]);
  }

  async function fetchExpenses(profileId: string) {
    if (USE_PYTHON_API) {
      const { data } = await apiClient.get<Expense[]>('/expenses', { limit: 10 });
      setExpenses((data || []) as Expense[]);
      return;
    }

    const supabase = await getCloudClient();
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

    if (USE_PYTHON_API) {
      const { data: monthlyTrips } = await apiClient.get<any[]>('/trips', { status: 'completed', limit: 1000 });
      const filtered = (monthlyTrips || []).filter((t) => {
        const d = new Date(t.start_date);
        return d >= new Date(monthStart) && d <= new Date(monthEnd);
      });
      const distance = filtered.reduce(
        (sum, t) => sum + (Number(t.distance_traveled) || 0) + (Number(t.distance_return) || 0),
        0
      );
      setMonthlyData({ trips: filtered.length, distance });
      return;
    }

    const supabase = await getCloudClient();
    const { data: monthlyTrips } = await supabase
      .from('trips')
      .select('id, distance_traveled, distance_return')
      .eq('driver_id', profileId)
      .eq('status', 'completed')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    if (monthlyTrips) {
      const distance = monthlyTrips.reduce((sum, t) => sum + (Number(t.distance_traveled) || 0) + (Number(t.distance_return) || 0), 0);
      setMonthlyData({
        trips: monthlyTrips.length,
        distance,
      });
    }
  }

  async function handleStartTrip(trip: Trip) {
    if (USE_PYTHON_API) {
      const { error } = await apiClient.put(`/trips/${trip.id}`, { status: 'in_progress' });
      if (error) {
        toast.error(error.message || 'Failed to start trip');
      } else {
        toast.success('Trip started successfully');
        if (profileId) {
          fetchTrips(profileId);
          fetchStats(profileId);
        }
      }
      return;
    }

    const supabase = await getCloudClient();
    const { error } = await supabase.from('trips').update({ status: 'in_progress' }).eq('id', trip.id);

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
    if (USE_PYTHON_API) {
      const { error } = await apiClient.put(`/trips/${trip.id}`, {
        status: 'completed',
        end_date: new Date().toISOString(),
      });
      if (error) {
        toast.error(error.message || 'Failed to complete trip');
      } else {
        toast.success('Trip completed successfully');
        if (profileId) {
          fetchTrips(profileId);
          fetchStats(profileId);
          fetchMonthlyData(profileId);
        }
      }
      return;
    }

    const supabase = await getCloudClient();
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
