import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Bus, Users, MapPin, Handshake, Building2 } from 'lucide-react';

interface BusProfitability {
  id: string;
  registration_number: string;
  bus_name: string | null;
  ownership_type: 'owned' | 'partnership';
  partner_name: string | null;
  company_profit_share: number;
  partner_profit_share: number;
  totalRevenue: number;
  totalExpense: number;
  grossProfit: number;
  companyProfit: number;
  partnerProfit: number;
  tripCount: number;
  totalDistance: number;
  totalDiesel: number;
  fuelEfficiency: number | null;
}

interface DriverProfitability {
  id: string;
  full_name: string;
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  tripCount: number;
  totalDistance: number;
}

interface RouteProfitability {
  id: string;
  route_name: string;
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  tripCount: number;
  avgProfit: number;
}

export default function ProfitabilityReport() {
  const [loading, setLoading] = useState(true);
  const [busProfitability, setBusProfitability] = useState<BusProfitability[]>([]);
  const [driverProfitability, setDriverProfitability] = useState<DriverProfitability[]>([]);
  const [routeProfitability, setRouteProfitability] = useState<RouteProfitability[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, expense: 0, profit: 0, companyProfit: 0 });

  useEffect(() => {
    fetchProfitabilityData();
  }, []);

  async function fetchProfitabilityData() {
    setLoading(true);

    // Fetch fuel price from settings
    const { data: fuelSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'fuel_price_per_liter')
      .single();
    
    const fuelPricePerLiter = fuelSetting?.value ? parseFloat(fuelSetting.value) : 90;

    // Fetch trips with related data including bus ownership details
    const { data: trips } = await supabase
      .from('trips')
      .select(`
        *,
        bus:buses(id, registration_number, bus_name, ownership_type, partner_name, company_profit_share, partner_profit_share),
        driver:profiles(id, full_name),
        route:routes(id, route_name)
      `)
      .eq('status', 'completed');

    // Fetch fuel expense categories (diesel, fuel, petrol)
    const { data: fuelCategories } = await supabase
      .from('expense_categories')
      .select('id, name')
      .or('name.ilike.%diesel%,name.ilike.%fuel%,name.ilike.%petrol%');

    const fuelCategoryIds = new Set(fuelCategories?.map(c => c.id) || []);

    // Fetch approved expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('trip_id, amount, category_id')
      .eq('status', 'approved');

    if (!trips) {
      setLoading(false);
      return;
    }

    // Create expense lookup by trip
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

    // Calculate by bus
    const busMap = new Map<string, BusProfitability>();
    const driverMap = new Map<string, DriverProfitability>();
    const routeMap = new Map<string, RouteProfitability>();

    let totalRevenue = 0;
    let totalExpense = 0;
    let totalCompanyProfit = 0;

    trips.forEach((trip) => {
      const bus = trip.bus as any;
      const driver = trip.driver as any;
      const route = trip.route as any;
      
      if (!bus?.id || !driver?.id || !route?.id) return;

      // Calculate trip totals including agent revenue
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
      const tripFuel = expensesByTrip[trip.id]?.fuel || 0;
      const distance = (Number(trip.distance_traveled) || 0) + (Number(trip.distance_return) || 0);
      const tripProfit = tripRevenue - tripExpense;

      // Calculate company share based on ownership
      const companyShare = bus.ownership_type === 'partnership' 
        ? (bus.company_profit_share || 100) / 100 
        : 1;
      const partnerShare = bus.ownership_type === 'partnership' 
        ? (bus.partner_profit_share || 0) / 100 
        : 0;
      const tripCompanyProfit = tripProfit * companyShare;
      const tripPartnerProfit = tripProfit * partnerShare;

      totalRevenue += tripRevenue;
      totalExpense += tripExpense;
      totalCompanyProfit += tripCompanyProfit;

      // Bus aggregation
      if (!busMap.has(bus.id)) {
        busMap.set(bus.id, {
          id: bus.id,
          registration_number: bus.registration_number,
          bus_name: bus.bus_name,
          ownership_type: bus.ownership_type || 'owned',
          partner_name: bus.partner_name,
          company_profit_share: bus.company_profit_share || 100,
          partner_profit_share: bus.partner_profit_share || 0,
          totalRevenue: 0,
          totalExpense: 0,
          grossProfit: 0,
          companyProfit: 0,
          partnerProfit: 0,
          tripCount: 0,
          totalDistance: 0,
          totalDiesel: 0,
          fuelEfficiency: null,
        });
      }
      const busData = busMap.get(bus.id)!;
      busData.totalRevenue += tripRevenue;
      busData.totalExpense += tripExpense;
      busData.grossProfit = busData.totalRevenue - busData.totalExpense;
      busData.companyProfit += tripCompanyProfit;
      busData.partnerProfit += tripPartnerProfit;
      busData.tripCount += 1;
      busData.totalDistance += distance;
      busData.totalDiesel += tripFuel;

      // Driver aggregation
      if (!driverMap.has(driver.id)) {
        driverMap.set(driver.id, {
          id: driver.id,
          full_name: driver.full_name,
          totalRevenue: 0,
          totalExpense: 0,
          profit: 0,
          tripCount: 0,
          totalDistance: 0,
        });
      }
      const driverData = driverMap.get(driver.id)!;
      driverData.totalRevenue += tripRevenue;
      driverData.totalExpense += tripExpense;
      driverData.profit = driverData.totalRevenue - driverData.totalExpense;
      driverData.tripCount += 1;
      driverData.totalDistance += distance;

      // Route aggregation
      if (!routeMap.has(route.id)) {
        routeMap.set(route.id, {
          id: route.id,
          route_name: route.route_name,
          totalRevenue: 0,
          totalExpense: 0,
          profit: 0,
          tripCount: 0,
          avgProfit: 0,
        });
      }
      const routeData = routeMap.get(route.id)!;
      routeData.totalRevenue += tripRevenue;
      routeData.totalExpense += tripExpense;
      routeData.profit = routeData.totalRevenue - routeData.totalExpense;
      routeData.tripCount += 1;
      routeData.avgProfit = routeData.profit / routeData.tripCount;
    });

    // Calculate fuel efficiency for each bus after all trips are processed
    busMap.forEach((busData) => {
      if (busData.totalDiesel > 0 && busData.totalDistance > 0) {
        const totalLiters = busData.totalDiesel / fuelPricePerLiter;
        busData.fuelEfficiency = busData.totalDistance / totalLiters;
      }
    });

    setBusProfitability(Array.from(busMap.values()).sort((a, b) => b.companyProfit - a.companyProfit));
    setDriverProfitability(Array.from(driverMap.values()).sort((a, b) => b.profit - a.profit));
    setRouteProfitability(Array.from(routeMap.values()).sort((a, b) => b.profit - a.profit));
    setTotals({ 
      revenue: totalRevenue, 
      expense: totalExpense, 
      profit: totalRevenue - totalExpense,
      companyProfit: totalCompanyProfit 
    });
    setLoading(false);
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const getProfitBadge = (profit: number) => {
    if (profit > 0) {
      return (
        <Badge className="bg-green-100 text-green-800 gap-1">
          <TrendingUp className="h-3 w-3" />
          {formatCurrency(profit)}
        </Badge>
      );
    } else if (profit < 0) {
      return (
        <Badge className="bg-red-100 text-red-800 gap-1">
          <TrendingDown className="h-3 w-3" />
          {formatCurrency(profit)}
        </Badge>
      );
    }
    return <Badge variant="secondary">{formatCurrency(profit)}</Badge>;
  };

  const getOwnershipBadge = (type: 'owned' | 'partnership', partnerName?: string | null) => {
    if (type === 'partnership') {
      return (
        <Badge variant="outline" className="gap-1 text-purple-700 border-purple-300">
          <Handshake className="h-3 w-3" />
          {partnerName || 'Partner'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300">
        <Building2 className="h-3 w-3" />
        Owned
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profitability Report</h1>
          <p className="text-muted-foreground">Analyze profit by bus, driver, and route</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? '...' : formatCurrency(totals.revenue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loading ? '...' : formatCurrency(totals.expense)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {loading ? '...' : formatCurrency(totals.profit)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Company Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.companyProfit >= 0 ? 'text-primary' : 'text-red-600'}`}>
                {loading ? '...' : formatCurrency(totals.companyProfit)}
              </div>
              <p className="text-xs text-muted-foreground">After partner shares</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <Tabs defaultValue="buses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="buses" className="gap-2">
              <Bus className="h-4 w-4" />
              By Bus
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <Users className="h-4 w-4" />
              By Driver
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <MapPin className="h-4 w-4" />
              By Route
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buses">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bus</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expense</TableHead>
                      <TableHead className="text-right">Fuel Eff.</TableHead>
                      <TableHead className="text-right">Gross Profit</TableHead>
                      <TableHead className="text-right">Company Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : busProfitability.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No completed trips found
                        </TableCell>
                      </TableRow>
                    ) : (
                      busProfitability.map((bus) => (
                        <TableRow key={bus.id}>
                          <TableCell>
                            <div className="font-medium">{bus.registration_number}</div>
                            {bus.bus_name && <div className="text-sm text-muted-foreground">{bus.bus_name}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getOwnershipBadge(bus.ownership_type, bus.partner_name)}
                              {bus.ownership_type === 'partnership' && (
                                <div className="text-xs text-muted-foreground">
                                  {bus.company_profit_share}% / {bus.partner_profit_share}%
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{bus.tripCount}</TableCell>
                          <TableCell className="text-right">{bus.totalDistance.toLocaleString()} km</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(bus.totalRevenue)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(bus.totalExpense)}</TableCell>
                          <TableCell className="text-right">
                            {bus.fuelEfficiency ? `${bus.fuelEfficiency.toFixed(1)} km/L` : '-'}
                          </TableCell>
                          <TableCell className="text-right">{getProfitBadge(bus.grossProfit)}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold text-primary">
                              {formatCurrency(bus.companyProfit)}
                            </div>
                            {bus.ownership_type === 'partnership' && bus.partnerProfit !== 0 && (
                              <div className="text-xs text-muted-foreground">
                                Partner: {formatCurrency(bus.partnerProfit)}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expense</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : driverProfitability.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No completed trips found
                        </TableCell>
                      </TableRow>
                    ) : (
                      driverProfitability.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">{driver.full_name}</TableCell>
                          <TableCell className="text-right">{driver.tripCount}</TableCell>
                          <TableCell className="text-right">{driver.totalDistance.toLocaleString()} km</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(driver.totalRevenue)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(driver.totalExpense)}</TableCell>
                          <TableCell className="text-right">{getProfitBadge(driver.profit)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expense</TableHead>
                      <TableHead className="text-right">Avg Profit/Trip</TableHead>
                      <TableHead className="text-right">Total Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : routeProfitability.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No completed trips found
                        </TableCell>
                      </TableRow>
                    ) : (
                      routeProfitability.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-medium">{route.route_name}</TableCell>
                          <TableCell className="text-right">{route.tripCount}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(route.totalRevenue)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(route.totalExpense)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(route.avgProfit)}</TableCell>
                          <TableCell className="text-right">{getProfitBadge(route.profit)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
