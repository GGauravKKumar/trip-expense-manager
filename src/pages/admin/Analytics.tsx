import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { 
  Loader2, TrendingUp, TrendingDown, CalendarIcon, Download, BarChart3,
  DollarSign, Percent, CheckCircle, Fuel, Bus, MapPin, Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, eachDayOfInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import ExcelJS from 'exceljs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Legend,
  Tooltip,
} from 'recharts';

interface KPIData {
  totalRevenue: number;
  totalExpense: number;
  profitMargin: number;
  tripCompletionRate: number;
  avgFuelEfficiency: number;
  previousPeriodRevenue: number;
  revenueGrowth: number;
}

interface RevenueTrend {
  date: string;
  revenue: number;
  expense: number;
  profit: number;
}

interface RevenueBySource {
  source: string;
  amount: number;
  fill: string;
}

interface TripsByStatus {
  status: string;
  count: number;
  fill: string;
}

interface BusPerformance {
  name: string;
  revenue: number;
  profit: number;
  trips: number;
  efficiency: number | null;
}

interface RoutePerformance {
  name: string;
  revenue: number;
  profit: number;
  trips: number;
}

interface DriverPerformance {
  name: string;
  revenue: number;
  trips: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  fill: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const STATUS_COLORS: Record<string, string> = {
  completed: 'hsl(142, 76%, 36%)',
  in_progress: 'hsl(47, 100%, 50%)',
  scheduled: 'hsl(221, 83%, 53%)',
  cancelled: 'hsl(0, 84%, 60%)',
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  
  const [kpi, setKpi] = useState<KPIData>({
    totalRevenue: 0,
    totalExpense: 0,
    profitMargin: 0,
    tripCompletionRate: 0,
    avgFuelEfficiency: 0,
    previousPeriodRevenue: 0,
    revenueGrowth: 0,
  });
  
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([]);
  const [revenueBySource, setRevenueBySource] = useState<RevenueBySource[]>([]);
  const [tripsByStatus, setTripsByStatus] = useState<TripsByStatus[]>([]);
  const [busPerformance, setBusPerformance] = useState<BusPerformance[]>([]);
  const [routePerformance, setRoutePerformance] = useState<RoutePerformance[]>([]);
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformance[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<ExpenseCategory[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  async function fetchAnalytics() {
    setLoading(true);
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    
    // Calculate previous period for comparison
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = subMonths(startDate, 1);
    const previousEnd = subMonths(endDate, 1);
    const prevStartStr = format(previousStart, 'yyyy-MM-dd');
    const prevEndStr = format(previousEnd, 'yyyy-MM-dd');

    let fuelPricePerLiter = 90;
    let trips: any[] = [];
    let previousTrips: any[] = [];
    let expenseCategories: any[] = [];
    let expenses: any[] = [];

    try {
      if (USE_PYTHON_API) {
        // Fetch data from Python API
        const [settingsRes, tripsRes, prevTripsRes, categoriesRes, expensesRes] = await Promise.all([
          apiClient.get<any[]>('/settings'),
          apiClient.get<any[]>(`/trips?from_date=${startDateStr}&to_date=${endDateStr}`),
          apiClient.get<any[]>(`/trips?status=completed&from_date=${prevStartStr}&to_date=${prevEndStr}`),
          apiClient.get<any[]>('/expense-categories'),
          apiClient.get<any[]>('/expenses?status=approved'),
        ]);

        const fuelSetting = settingsRes.data?.find((s: any) => s.key === 'fuel_price_per_liter');
        fuelPricePerLiter = fuelSetting?.value ? parseFloat(fuelSetting.value) : 90;
        trips = tripsRes.data || [];
        previousTrips = prevTripsRes.data || [];
        expenseCategories = categoriesRes.data || [];
        expenses = expensesRes.data || [];
      } else {
        const supabase = await getCloudClient();
        
        // Fetch fuel price
        const { data: fuelSetting } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'fuel_price_per_liter')
          .maybeSingle();
        fuelPricePerLiter = fuelSetting?.value ? parseFloat(fuelSetting.value) : 90;

        // Fetch all trips in date range
        const { data: tripsData } = await supabase
          .from('trips')
          .select(`
            *,
            bus:buses(id, registration_number, bus_name),
            driver:profiles(id, full_name),
            route:routes(id, route_name)
          `)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr + 'T23:59:59');
        trips = tripsData || [];

        // Fetch previous period trips for comparison
        const { data: prevTripsData } = await supabase
          .from('trips')
          .select('total_revenue, return_total_revenue')
          .eq('status', 'completed')
          .gte('start_date', prevStartStr)
          .lte('start_date', prevEndStr + 'T23:59:59');
        previousTrips = prevTripsData || [];

        // Fetch expense categories
        const { data: categoriesData } = await supabase
          .from('expense_categories')
          .select('id, name');
        expenseCategories = categoriesData || [];

        // Fetch approved expenses
        const { data: expensesData } = await supabase
          .from('expenses')
          .select('trip_id, amount, category_id, fuel_quantity, expense_date')
          .eq('status', 'approved');
        expenses = expensesData || [];
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setLoading(false);
      return;
    }
    
    const fuelCategoryIds = new Set(
      expenseCategories?.filter((c: any) => 
        c.name.toLowerCase().includes('diesel') || 
        c.name.toLowerCase().includes('fuel') || 
        c.name.toLowerCase().includes('petrol')
      ).map((c: any) => c.id) || []
    );

    if (!trips || trips.length === 0) {
      setLoading(false);
      return;
    }

    // Create expense lookups
    const expensesByTrip: Record<string, { total: number; fuelLiters: number }> = {};
    const expensesByCategoryMap: Record<string, number> = {};
    
    expenses?.forEach((exp) => {
      if (!expensesByTrip[exp.trip_id]) {
        expensesByTrip[exp.trip_id] = { total: 0, fuelLiters: 0 };
      }
      expensesByTrip[exp.trip_id].total += Number(exp.amount);
      
      if (fuelCategoryIds.has(exp.category_id)) {
        if (exp.fuel_quantity) {
          expensesByTrip[exp.trip_id].fuelLiters += Number(exp.fuel_quantity);
        } else {
          expensesByTrip[exp.trip_id].fuelLiters += Number(exp.amount) / fuelPricePerLiter;
        }
      }
      
      // Category aggregation
      const categoryName = expenseCategories?.find(c => c.id === exp.category_id)?.name || 'Other';
      expensesByCategoryMap[categoryName] = (expensesByCategoryMap[categoryName] || 0) + Number(exp.amount);
    });

    // Calculate KPIs
    let totalRevenue = 0;
    let totalExpense = 0;
    let completedTrips = 0;
    let scheduledOrCompletedTrips = 0;
    let totalDistance = 0;
    let totalFuelLiters = 0;

    // Revenue breakdown
    const sourceMap = { Cash: 0, Online: 0, Paytm: 0, Agent: 0, Others: 0 };
    
    // Status breakdown
    const statusMap: Record<string, number> = { completed: 0, in_progress: 0, scheduled: 0, cancelled: 0 };
    
    // Daily trend
    const dailyData: Record<string, { revenue: number; expense: number }> = {};
    
    // Performance maps
    const busMap = new Map<string, BusPerformance>();
    const routeMap = new Map<string, RoutePerformance>();
    const driverMap = new Map<string, DriverPerformance>();

    trips.forEach((trip) => {
      const bus = trip.bus as any;
      const driver = trip.driver as any;
      const route = trip.route as any;
      
      // Calculate revenue
      const outwardRevenue = 
        (Number(trip.revenue_cash) || 0) + 
        (Number(trip.revenue_online) || 0) + 
        (Number(trip.revenue_paytm) || 0) + 
        (Number(trip.revenue_agent) || 0) +
        (Number(trip.revenue_others) || 0);
      const returnRevenue = 
        (Number(trip.return_revenue_cash) || 0) + 
        (Number(trip.return_revenue_online) || 0) + 
        (Number(trip.return_revenue_paytm) || 0) + 
        (Number(trip.return_revenue_agent) || 0) +
        (Number(trip.return_revenue_others) || 0);
      const tripRevenue = outwardRevenue + returnRevenue;
      const tripExpense = expensesByTrip[trip.id]?.total || 0;
      const tripFuelLiters = expensesByTrip[trip.id]?.fuelLiters || 0;

      // Distance
      const outwardDistance = Math.max(0, (Number(trip.odometer_end) || 0) - (Number(trip.odometer_start) || 0));
      const returnDistance = trip.trip_type === 'two_way' 
        ? Math.max(0, (Number(trip.odometer_return_end) || 0) - (Number(trip.odometer_return_start) || 0))
        : 0;
      const distance = outwardDistance + returnDistance;

      if (trip.status === 'completed') {
        totalRevenue += tripRevenue;
        totalExpense += tripExpense;
        completedTrips++;
        totalDistance += distance;
        totalFuelLiters += tripFuelLiters;

        // Revenue sources
        sourceMap.Cash += (Number(trip.revenue_cash) || 0) + (Number(trip.return_revenue_cash) || 0);
        sourceMap.Online += (Number(trip.revenue_online) || 0) + (Number(trip.return_revenue_online) || 0);
        sourceMap.Paytm += (Number(trip.revenue_paytm) || 0) + (Number(trip.return_revenue_paytm) || 0);
        sourceMap.Agent += (Number(trip.revenue_agent) || 0) + (Number(trip.return_revenue_agent) || 0);
        sourceMap.Others += (Number(trip.revenue_others) || 0) + (Number(trip.return_revenue_others) || 0);

        // Daily trend
        const dateKey = format(parseISO(trip.start_date), 'yyyy-MM-dd');
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { revenue: 0, expense: 0 };
        }
        dailyData[dateKey].revenue += tripRevenue;
        dailyData[dateKey].expense += tripExpense;
      }

      // Status count
      if (trip.status in statusMap) {
        statusMap[trip.status]++;
      }
      if (trip.status === 'scheduled' || trip.status === 'completed' || trip.status === 'in_progress') {
        scheduledOrCompletedTrips++;
      }

      // Bus performance (completed trips only)
      if (trip.status === 'completed' && bus?.id) {
        const busName = bus.bus_name || bus.registration_number;
        if (!busMap.has(bus.id)) {
          busMap.set(bus.id, { name: busName, revenue: 0, profit: 0, trips: 0, efficiency: null });
        }
        const b = busMap.get(bus.id)!;
        b.revenue += tripRevenue;
        b.profit += tripRevenue - tripExpense;
        b.trips++;
        if (distance > 0 && tripFuelLiters > 0) {
          b.efficiency = (b.efficiency || 0) + (distance / tripFuelLiters);
        }
      }

      // Route performance
      if (trip.status === 'completed' && route?.id) {
        if (!routeMap.has(route.id)) {
          routeMap.set(route.id, { name: route.route_name, revenue: 0, profit: 0, trips: 0 });
        }
        const r = routeMap.get(route.id)!;
        r.revenue += tripRevenue;
        r.profit += tripRevenue - tripExpense;
        r.trips++;
      }

      // Driver performance
      if (trip.status === 'completed' && driver?.id) {
        if (!driverMap.has(driver.id)) {
          driverMap.set(driver.id, { name: driver.full_name, revenue: 0, trips: 0 });
        }
        const d = driverMap.get(driver.id)!;
        d.revenue += tripRevenue;
        d.trips++;
      }
    });

    // Calculate previous period revenue
    const prevRevenue = previousTrips?.reduce((sum, t) => 
      sum + (Number(t.total_revenue) || 0) + (Number(t.return_total_revenue) || 0), 0) || 0;

    // Calculate KPIs
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpense) / totalRevenue) * 100 : 0;
    const tripCompletionRate = scheduledOrCompletedTrips > 0 ? (completedTrips / scheduledOrCompletedTrips) * 100 : 0;
    const avgFuelEfficiency = totalFuelLiters > 0 ? totalDistance / totalFuelLiters : 0;
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    setKpi({
      totalRevenue,
      totalExpense,
      profitMargin,
      tripCompletionRate,
      avgFuelEfficiency,
      previousPeriodRevenue: prevRevenue,
      revenueGrowth,
    });

    // Format revenue trend
    const trendData: RevenueTrend[] = Object.entries(dailyData)
      .map(([date, data]) => ({
        date: format(parseISO(date), 'MMM dd'),
        revenue: data.revenue,
        expense: data.expense,
        profit: data.revenue - data.expense,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setRevenueTrend(trendData);

    // Format revenue by source
    setRevenueBySource([
      { source: 'Cash', amount: sourceMap.Cash, fill: COLORS[0] },
      { source: 'Online', amount: sourceMap.Online, fill: COLORS[1] },
      { source: 'Paytm', amount: sourceMap.Paytm, fill: COLORS[2] },
      { source: 'Agent', amount: sourceMap.Agent, fill: COLORS[3] },
      { source: 'Others', amount: sourceMap.Others, fill: COLORS[4] },
    ].filter(s => s.amount > 0));

    // Format trips by status
    setTripsByStatus(
      Object.entries(statusMap)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          status: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count,
          fill: STATUS_COLORS[status] || COLORS[0],
        }))
    );

    // Format bus performance
    const busArr = Array.from(busMap.values())
      .map(b => ({ ...b, efficiency: b.trips > 0 && b.efficiency ? b.efficiency / b.trips : null }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
    setBusPerformance(busArr);

    // Format route performance
    const routeArr = Array.from(routeMap.values()).sort((a, b) => b.profit - a.profit).slice(0, 10);
    setRoutePerformance(routeArr);

    // Format driver performance
    const driverArr = Array.from(driverMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    setDriverPerformance(driverArr);

    // Format expense by category
    const expenseCatArr = Object.entries(expensesByCategoryMap)
      .map(([category, amount], i) => ({ category, amount, fill: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
    setExpenseByCategory(expenseCatArr);

    setLoading(false);
  }

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const setQuickPeriod = (period: 'week' | 'month' | 'quarter' | 'year') => {
    const now = new Date();
    switch (period) {
      case 'week':
        setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'quarter':
        setStartDate(startOfQuarter(now));
        setEndDate(endOfQuarter(now));
        break;
      case 'year':
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const periodLabel = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['FLEET ANALYTICS REPORT']);
    summarySheet.addRow([`Period: ${periodLabel}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Key Performance Indicators']);
    summarySheet.addRow(['Total Revenue', kpi.totalRevenue]);
    summarySheet.addRow(['Total Expenses', kpi.totalExpense]);
    summarySheet.addRow(['Profit Margin (%)', kpi.profitMargin.toFixed(1)]);
    summarySheet.addRow(['Trip Completion Rate (%)', kpi.tripCompletionRate.toFixed(1)]);
    summarySheet.addRow(['Avg Fuel Efficiency (km/L)', kpi.avgFuelEfficiency.toFixed(1)]);
    summarySheet.addRow(['Revenue Growth (%)', kpi.revenueGrowth.toFixed(1)]);
    summarySheet.columns = [{ width: 25 }, { width: 15 }];

    // Revenue by Source
    const sourceSheet = workbook.addWorksheet('Revenue by Source');
    sourceSheet.addRow(['Source', 'Amount']);
    revenueBySource.forEach(s => sourceSheet.addRow([s.source, s.amount]));
    sourceSheet.columns = [{ width: 15 }, { width: 15 }];

    // Bus Performance
    const busSheet = workbook.addWorksheet('Bus Performance');
    busSheet.addRow(['Bus', 'Revenue', 'Profit', 'Trips', 'Efficiency (km/L)']);
    busPerformance.forEach(b => busSheet.addRow([b.name, b.revenue, b.profit, b.trips, b.efficiency?.toFixed(1) || '']));
    busSheet.columns = [{ width: 20 }, { width: 12 }, { width: 12 }, { width: 8 }, { width: 15 }];

    // Route Performance
    const routeSheet = workbook.addWorksheet('Route Performance');
    routeSheet.addRow(['Route', 'Revenue', 'Profit', 'Trips']);
    routePerformance.forEach(r => routeSheet.addRow([r.name, r.revenue, r.profit, r.trips]));
    routeSheet.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 8 }];

    // Driver Performance
    const driverSheet = workbook.addWorksheet('Driver Performance');
    driverSheet.addRow(['Driver', 'Revenue', 'Trips']);
    driverPerformance.forEach(d => driverSheet.addRow([d.name, d.revenue, d.trips]));
    driverSheet.columns = [{ width: 25 }, { width: 12 }, { width: 8 }];

    // Expense by Category
    const expenseSheet = workbook.addWorksheet('Expenses by Category');
    expenseSheet.addRow(['Category', 'Amount']);
    expenseByCategory.forEach(e => expenseSheet.addRow([e.category, e.amount]));
    expenseSheet.columns = [{ width: 20 }, { width: 12 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Fleet_Analytics_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const revenueChartConfig: ChartConfig = {
    revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
    expense: { label: 'Expense', color: 'hsl(var(--chart-2))' },
    profit: { label: 'Profit', color: 'hsl(var(--chart-3))' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Fleet Analytics
            </h1>
            <p className="text-muted-foreground">Comprehensive insights into fleet operations</p>
          </div>
          
          {/* Date Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd MMM yyyy") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd MMM yyyy") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setQuickPeriod('week')}>Week</Button>
              <Button variant="ghost" size="sm" onClick={() => setQuickPeriod('month')}>Month</Button>
              <Button variant="ghost" size="sm" onClick={() => setQuickPeriod('quarter')}>Quarter</Button>
              <Button variant="ghost" size="sm" onClick={() => setQuickPeriod('year')}>Year</Button>
            </div>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(kpi.totalRevenue)}</div>
                  <div className="flex items-center gap-1 text-xs">
                    {kpi.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={kpi.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {kpi.revenueGrowth >= 0 ? '+' : ''}{kpi.revenueGrowth.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.profitMargin.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Profit: {formatCurrency(kpi.totalRevenue - kpi.totalExpense)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Trip Completion</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.tripCompletionRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Completed trips rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Fuel Efficiency</CardTitle>
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.avgFuelEfficiency.toFixed(1)} km/L</div>
                  <p className="text-xs text-muted-foreground">Fleet average</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="revenue" className="space-y-4">
              <TabsList>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="trips">Trips</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Revenue Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueTrend.length > 0 ? (
                        <ChartContainer config={revenueChartConfig} className="h-[300px]">
                          <AreaChart data={revenueTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Area type="monotone" dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" stroke="hsl(var(--chart-1))" fillOpacity={0.3} />
                            <Area type="monotone" dataKey="expense" name="Expense" fill="hsl(var(--chart-2))" stroke="hsl(var(--chart-2))" fillOpacity={0.3} />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No data for selected period
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Revenue by Source */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Revenue by Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueBySource.length > 0 ? (
                        <ChartContainer config={{}} className="h-[300px]">
                          <PieChart>
                            <Pie
                              data={revenueBySource}
                              dataKey="amount"
                              nameKey="source"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                            >
                              {revenueBySource.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No data for selected period
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="trips" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Trip Status Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Trip Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tripsByStatus.length > 0 ? (
                        <ChartContainer config={{}} className="h-[300px]">
                          <PieChart>
                            <Pie
                              data={tripsByStatus}
                              dataKey="count"
                              nameKey="status"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ status, count }) => `${status}: ${count}`}
                            >
                              {tripsByStatus.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No trips in selected period
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Daily Revenue per Trip */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Profit Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueTrend.length > 0 ? (
                        <ChartContainer config={revenueChartConfig} className="h-[300px]">
                          <LineChart data={revenueTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No data for selected period
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Top Buses */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bus className="h-4 w-4" />
                        Top Buses by Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {busPerformance.length > 0 ? (
                        <div className="space-y-3">
                          {busPerformance.slice(0, 5).map((bus, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                  {i + 1}
                                </Badge>
                                <span className="text-sm font-medium truncate max-w-[120px]">{bus.name}</span>
                              </div>
                              <span className={cn("text-sm font-bold", bus.profit >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(bus.profit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No data</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Routes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Top Routes by Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {routePerformance.length > 0 ? (
                        <div className="space-y-3">
                          {routePerformance.slice(0, 5).map((route, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                  {i + 1}
                                </Badge>
                                <span className="text-sm font-medium truncate max-w-[120px]">{route.name}</span>
                              </div>
                              <span className={cn("text-sm font-bold", route.profit >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(route.profit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No data</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Drivers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Top Drivers by Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {driverPerformance.length > 0 ? (
                        <div className="space-y-3">
                          {driverPerformance.slice(0, 5).map((driver, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full text-xs">
                                  {i + 1}
                                </Badge>
                                <span className="text-sm font-medium truncate max-w-[120px]">{driver.name}</span>
                              </div>
                              <span className="text-sm font-bold text-primary">
                                {formatCurrency(driver.revenue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Bus Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bus Performance Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {busPerformance.length > 0 ? (
                      <ChartContainer config={revenueChartConfig} className="h-[300px]">
                        <BarChart data={busPerformance} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                          <YAxis dataKey="name" type="category" fontSize={12} width={100} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={4} />
                          <Bar dataKey="profit" name="Profit" fill="hsl(var(--chart-3))" radius={4} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No data for selected period
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Expense by Category */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Expense by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {expenseByCategory.length > 0 ? (
                        <ChartContainer config={{}} className="h-[300px]">
                          <PieChart>
                            <Pie
                              data={expenseByCategory}
                              dataKey="amount"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                            >
                              {expenseByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No expense data
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expense vs Revenue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Expense Categories Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {expenseByCategory.length > 0 ? (
                        <ChartContainer config={{}} className="h-[300px]">
                          <BarChart data={expenseByCategory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="amount" name="Amount" radius={4}>
                              {expenseByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          No expense data
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Expense Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expense Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Expenses</p>
                        <p className="text-xl font-bold">{formatCurrency(kpi.totalExpense)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Expense Ratio</p>
                        <p className="text-xl font-bold">
                          {kpi.totalRevenue > 0 ? ((kpi.totalExpense / kpi.totalRevenue) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Net Profit</p>
                        <p className={cn("text-xl font-bold", (kpi.totalRevenue - kpi.totalExpense) >= 0 ? "text-green-600" : "text-red-600")}>
                          {formatCurrency(kpi.totalRevenue - kpi.totalExpense)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Largest Category</p>
                        <p className="text-xl font-bold truncate">
                          {expenseByCategory[0]?.category || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
