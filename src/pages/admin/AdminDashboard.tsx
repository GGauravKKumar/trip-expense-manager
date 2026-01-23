import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bus, Users, MapPin, Receipt, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, TrendingDown, Fuel, Calendar, FileWarning 
} from 'lucide-react';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Link } from 'react-router-dom';

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

interface BusExpiry {
  id: string;
  registration_number: string;
  bus_name: string | null;
  type: 'insurance' | 'puc' | 'fitness';
  expiry_date: string;
  days_remaining: number;
}

interface ProfitData {
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  monthlyData: { month: string; revenue: number; expense: number; profit: number }[];
}

interface TopPerformer {
  id: string;
  name: string;
  profit: number;
  trips: number;
}

interface RecentActivity {
  id: string;
  type: 'trip' | 'expense' | 'approval';
  description: string;
  time: string;
  status?: string;
}

interface FuelEfficiency {
  bus: string;
  efficiency: number;
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
  const [expiringBuses, setExpiringBuses] = useState<BusExpiry[]>([]);
  const [profitData, setProfitData] = useState<ProfitData>({
    totalRevenue: 0,
    totalExpense: 0,
    profit: 0,
    monthlyData: [],
  });
  const [topBuses, setTopBuses] = useState<TopPerformer[]>([]);
  const [topDrivers, setTopDrivers] = useState<TopPerformer[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [fuelEfficiency, setFuelEfficiency] = useState<FuelEfficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    await Promise.all([
      fetchStats(),
      fetchExpiringBuses(),
      fetchProfitData(),
      fetchRecentActivity(),
    ]);
    setLoading(false);
  }

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
  }

  async function fetchExpiringBuses() {
    const { data: buses } = await supabase
      .from('buses')
      .select('id, registration_number, bus_name, insurance_expiry, puc_expiry, fitness_expiry')
      .eq('status', 'active');

    if (!buses) return;

    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const expiries: BusExpiry[] = [];

    buses.forEach((bus) => {
      const checkExpiry = (date: string | null, type: 'insurance' | 'puc' | 'fitness') => {
        if (!date) return;
        const expiryDate = parseISO(date);
        if (isWithinInterval(expiryDate, { start: today, end: thirtyDaysFromNow }) || expiryDate < today) {
          const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          expiries.push({
            id: bus.id,
            registration_number: bus.registration_number,
            bus_name: bus.bus_name,
            type,
            expiry_date: date,
            days_remaining: daysRemaining,
          });
        }
      };

      checkExpiry(bus.insurance_expiry, 'insurance');
      checkExpiry(bus.puc_expiry, 'puc');
      checkExpiry(bus.fitness_expiry, 'fitness');
    });

    setExpiringBuses(expiries.sort((a, b) => a.days_remaining - b.days_remaining));
  }

  async function fetchProfitData() {
    const { data: trips } = await supabase
      .from('trips')
      .select(`
        *,
        bus:buses(id, registration_number, bus_name),
        driver:profiles(id, full_name)
      `)
      .eq('status', 'completed');

    // Get all fuel-related categories (diesel, fuel, petrol, etc.)
    const { data: fuelCategories } = await supabase
      .from('expense_categories')
      .select('id, name')
      .or('name.ilike.%diesel%,name.ilike.%fuel%,name.ilike.%petrol%');

    const fuelCategoryIds = new Set(fuelCategories?.map(c => c.id) || []);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('trip_id, amount, category_id')
      .eq('status', 'approved');

    if (!trips) return;

    const expensesByTrip: Record<string, { total: number; fuel: number }> = {};
    expenses?.forEach((exp) => {
      if (!expensesByTrip[exp.trip_id]) {
        expensesByTrip[exp.trip_id] = { total: 0, fuel: 0 };
      }
      expensesByTrip[exp.trip_id].total += Number(exp.amount);
      if (fuelCategoryIds.has(exp.category_id)) {
        expensesByTrip[exp.trip_id].fuel += Number(exp.amount);
      }
    });

    let totalRevenue = 0;
    let totalExpense = 0;
    const monthlyMap = new Map<string, { revenue: number; expense: number }>();
    const busProfit = new Map<string, { name: string; profit: number; trips: number }>();
    const driverProfit = new Map<string, { name: string; profit: number; trips: number }>();
    const busFuel = new Map<string, { distance: number; fuel: number }>();

    trips.forEach((trip) => {
      const bus = trip.bus as any;
      const driver = trip.driver as any;
      
      const outwardRevenue = (Number(trip.revenue_cash) || 0) + (Number(trip.revenue_online) || 0) + 
        (Number(trip.revenue_paytm) || 0) + (Number(trip.revenue_others) || 0);
      const returnRevenue = (Number(trip.return_revenue_cash) || 0) + (Number(trip.return_revenue_online) || 0) + 
        (Number(trip.return_revenue_paytm) || 0) + (Number(trip.return_revenue_others) || 0);
      const tripRevenue = outwardRevenue + returnRevenue;
      const tripExpense = expensesByTrip[trip.id]?.total || 0;
      const tripFuel = expensesByTrip[trip.id]?.fuel || 0;
      const distance = (Number(trip.distance_traveled) || 0) + (Number(trip.distance_return) || 0);
      const tripProfit = tripRevenue - tripExpense;

      totalRevenue += tripRevenue;
      totalExpense += tripExpense;

      // Monthly aggregation
      const month = format(new Date(trip.start_date), 'MMM yy');
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { revenue: 0, expense: 0 });
      }
      const monthData = monthlyMap.get(month)!;
      monthData.revenue += tripRevenue;
      monthData.expense += tripExpense;

      // Bus profit
      if (bus?.id) {
        if (!busProfit.has(bus.id)) {
          busProfit.set(bus.id, { name: bus.registration_number, profit: 0, trips: 0 });
        }
        const bp = busProfit.get(bus.id)!;
        bp.profit += tripProfit;
        bp.trips += 1;

        // Fuel efficiency
        if (!busFuel.has(bus.id)) {
          busFuel.set(bus.id, { distance: 0, fuel: 0 });
        }
        const bf = busFuel.get(bus.id)!;
        bf.distance += distance;
        bf.fuel += tripFuel;
      }

      // Driver profit
      if (driver?.id) {
        if (!driverProfit.has(driver.id)) {
          driverProfit.set(driver.id, { name: driver.full_name, profit: 0, trips: 0 });
        }
        const dp = driverProfit.get(driver.id)!;
        dp.profit += tripProfit;
        dp.trips += 1;
      }
    });

    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        expense: data.expense,
        profit: data.revenue - data.expense,
      }))
      .slice(-6);

    setProfitData({
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense,
      monthlyData,
    });

    setTopBuses(
      Array.from(busProfit.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)
        .map((b, i) => ({ id: String(i), name: b.name, profit: b.profit, trips: b.trips }))
    );

    setTopDrivers(
      Array.from(driverProfit.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)
        .map((d, i) => ({ id: String(i), name: d.name, profit: d.profit, trips: d.trips }))
    );

    // Calculate fuel efficiency (₹90/liter average diesel price)
    const fuelData: FuelEfficiency[] = [];
    busFuel.forEach((data, busId) => {
      if (data.fuel > 0 && data.distance > 0) {
        const liters = data.fuel / 90; // Approximate liters based on ₹90/liter
        const efficiency = data.distance / liters;
        const busName = Array.from(busProfit.entries()).find(([id]) => id === busId)?.[1]?.name || busId;
        fuelData.push({ bus: busName, efficiency: Math.round(efficiency * 10) / 10 });
      }
    });
    setFuelEfficiency(fuelData.sort((a, b) => b.efficiency - a.efficiency).slice(0, 5));
  }

  async function fetchRecentActivity() {
    const [{ data: recentTrips }, { data: recentExpenses }] = await Promise.all([
      supabase
        .from('trips')
        .select('id, trip_number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('expenses')
        .select('id, amount, status, created_at, category:expense_categories(name)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const activities: RecentActivity[] = [];

    recentTrips?.forEach((trip) => {
      activities.push({
        id: `trip-${trip.id}`,
        type: 'trip',
        description: `Trip ${trip.trip_number} ${trip.status}`,
        time: trip.created_at,
        status: trip.status,
      });
    });

    recentExpenses?.forEach((exp) => {
      const category = (exp.category as any)?.name || 'Expense';
      activities.push({
        id: `expense-${exp.id}`,
        type: 'expense',
        description: `₹${Number(exp.amount).toLocaleString('en-IN')} ${category}`,
        time: exp.created_at,
        status: exp.status,
      });
    });

    setRecentActivity(
      activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8)
    );
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

  const statCards = [
    { title: 'Total Buses', value: stats.totalBuses, subtitle: `${stats.activeBuses} active`, icon: Bus, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Drivers', value: stats.totalDrivers, subtitle: 'Registered drivers', icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Total Trips', value: stats.totalTrips, subtitle: `${stats.activeTrips} in progress`, icon: MapPin, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { title: 'Pending Approvals', value: stats.pendingExpenses, subtitle: 'Expenses awaiting review', icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of your fleet operations</p>
        </div>

        {/* Expiry Alerts */}
        {expiringBuses.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                <FileWarning className="h-4 w-4" />
                Document Expiry Alerts ({expiringBuses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {expiringBuses.slice(0, 5).map((bus, idx) => (
                <div key={`${bus.id}-${bus.type}-${idx}`} className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bus className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{bus.registration_number}</span>
                    <Badge variant={bus.days_remaining <= 0 ? 'destructive' : bus.days_remaining <= 7 ? 'destructive' : 'secondary'}>
                      {bus.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {bus.days_remaining <= 0 ? (
                      <span className="text-red-600 font-medium">Expired!</span>
                    ) : (
                      <span className={bus.days_remaining <= 7 ? 'text-red-600' : 'text-orange-600'}>
                        {bus.days_remaining} days left
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {expiringBuses.length > 5 && (
                <Link to="/admin/buses" className="text-sm text-red-600 hover:underline">
                  View all {expiringBuses.length} alerts →
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Profit Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {loading ? '...' : formatCurrency(profitData.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                {loading ? '...' : formatCurrency(profitData.totalExpense)}
              </div>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${profitData.profit >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-red-50 to-red-100 border-red-200'}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${profitData.profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitData.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {loading ? '...' : formatCurrency(profitData.profit)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Revenue vs Expense Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue vs Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {profitData.monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={profitData.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="expense" stroke="hsl(0, 84%, 60%)" strokeWidth={2} name="Expense" />
                    <Line type="monotone" dataKey="profit" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fuel Efficiency Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Fuel Efficiency (km/L)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fuelEfficiency.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={fuelEfficiency} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis dataKey="bus" type="category" width={80} className="text-xs" />
                    <Tooltip formatter={(value: number) => `${value} km/L`} />
                    <Bar dataKey="efficiency" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No fuel data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Performers & Activity */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Top Buses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bus className="h-4 w-4" />
                Top Performing Buses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topBuses.length > 0 ? topBuses.map((bus, idx) => (
                <div key={bus.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm font-medium">{bus.name}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${bus.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(bus.profit)}
                    </div>
                    <div className="text-xs text-muted-foreground">{bus.trips} trips</div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center py-4">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Top Drivers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Performing Drivers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topDrivers.length > 0 ? topDrivers.map((driver, idx) => (
                <div key={driver.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[100px]">{driver.name}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${driver.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(driver.profit)}
                    </div>
                    <div className="text-xs text-muted-foreground">{driver.trips} trips</div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center py-4">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentActivity.length > 0 ? recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-1 border-b border-muted last:border-0">
                  <div className="flex items-center gap-2">
                    {activity.type === 'trip' ? (
                      <MapPin className="h-3 w-3 text-purple-600" />
                    ) : (
                      <Receipt className="h-3 w-3 text-blue-600" />
                    )}
                    <span className="text-xs truncate max-w-[120px]">{activity.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(activity.time), 'dd MMM')}
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center py-4">No recent activity</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Alert */}
        {stats.pendingExpenses > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-4 p-4">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <p className="font-medium text-orange-900">
                  You have {stats.pendingExpenses} expense(s) pending approval
                </p>
                <Link to="/admin/expenses" className="text-sm text-orange-700 hover:underline">
                  Go to Approve Expenses →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
