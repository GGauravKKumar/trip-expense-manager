import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Trip, TripStatus, TripType, Bus, Profile, Route } from '@/types/database';
import { Plus, Pencil, Loader2, Download, Eye, FileSpreadsheet, IndianRupee, Calendar, ArrowLeftRight, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, formatCurrency, formatDate } from '@/lib/exportUtils';
import { exportTripSheet, mapTripToSheetData } from '@/lib/tripSheetExport';
import TripExpensesDialog from '@/components/TripExpensesDialog';
import TripRevenueDialog from '@/components/TripRevenueDialog';
import PeriodExportDialog from '@/components/PeriodExportDialog';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

export default function TripManagement() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [busyDriverIds, setBusyDriverIds] = useState<Set<string>>(new Set());
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [formData, setFormData] = useState({
    trip_number: '',
    bus_id: '',
    driver_id: '',
    route_id: '',
    start_date: '',
    end_date: '',
    status: 'scheduled' as TripStatus,
    trip_type: 'one_way' as TripType,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);
  const [revenueTrip, setRevenueTrip] = useState<Trip | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  // Table filters
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    showingFrom,
    showingTo,
    totalCount,
  } = useTableFilters({
    data: trips,
    searchFields: [
      'trip_number',
      (trip) => (trip.bus as any)?.registration_number,
      (trip) => (trip.driver as any)?.full_name,
      (trip) => (trip.route as any)?.route_name,
    ],
  });

  // Apply status and type filters
  const filteredTrips = paginatedData.filter((trip) => {
    const matchesStatus = !filters.status || filters.status === 'all' || trip.status === filters.status;
    const matchesType = !filters.trip_type || filters.trip_type === 'all' || trip.trip_type === filters.trip_type;
    return matchesStatus && matchesType;
  });

  function handleViewExpenses(trip: Trip) {
    setSelectedTrip(trip);
    setExpenseDialogOpen(true);
  }

  function handleAddRevenue(trip: Trip) {
    setRevenueTrip(trip);
    setRevenueDialogOpen(true);
  }

  function handleExportTrips() {
    if (trips.length === 0) return;

    exportToExcel(
      trips,
      [
        { header: 'Trip #', key: 'trip_number' },
        { header: 'Bus', key: 'bus', format: (v) => v?.registration_number || '-' },
        { header: 'Driver', key: 'driver', format: (v) => v?.full_name || '-' },
        { header: 'Route', key: 'route', format: (v) => v?.route_name || '-' },
        { header: 'Start Date', key: 'start_date', format: formatDate },
        { header: 'End Date', key: 'end_date', format: formatDate },
        { header: 'Status', key: 'status' },
        { header: 'Odometer Start', key: 'odometer_start', format: (v) => Number(v) || '-' },
        { header: 'Odometer End', key: 'odometer_end', format: (v) => Number(v) || '-' },
        { header: 'Distance (km)', key: 'distance_traveled', format: (v) => Number(v) || '-' },
        { header: 'Total Revenue', key: 'total_revenue', format: (v) => Number(v) || 0 },
        { header: 'Total Expense', key: 'total_expense', format: (v) => Number(v) || 0 },
      ],
      'trips-report'
    );
  }

  async function handleExportTripSheet() {
    if (trips.length === 0) return;
    
    toast.info('Generating Trip Sheet...');
    
    try {
      // Get all expenses for these trips
      const tripIds = trips.map(t => t.id);
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          trip_id,
          amount,
          category:expense_categories(name)
        `)
        .in('trip_id', tripIds)
        .eq('status', 'approved');
      
      if (error) throw error;

      // Group expenses by trip
      const expensesByTrip: Record<string, { category_name: string; amount: number }[]> = {};
      expenses?.forEach(exp => {
        if (!expensesByTrip[exp.trip_id]) {
          expensesByTrip[exp.trip_id] = [];
        }
        expensesByTrip[exp.trip_id].push({
          category_name: (exp.category as any)?.name || 'Other',
          amount: exp.amount
        });
      });

      // Map trips to sheet data (flatten for two-way trips that return multiple rows)
      const sheetData = trips.flatMap(trip => 
        mapTripToSheetData(
          {
            id: trip.id,
            trip_number: trip.trip_number,
            start_date: trip.start_date,
            end_date: trip.end_date,
            status: trip.status,
            notes: trip.notes,
            trip_type: trip.trip_type,
            total_expense: trip.total_expense,
            odometer_start: trip.odometer_start,
            odometer_end: trip.odometer_end,
            distance_traveled: trip.distance_traveled,
            revenue_cash: trip.revenue_cash,
            revenue_online: trip.revenue_online,
            revenue_paytm: trip.revenue_paytm,
            revenue_others: trip.revenue_others,
            revenue_agent: trip.revenue_agent,
            total_revenue: trip.total_revenue,
            odometer_return_start: trip.odometer_return_start,
            odometer_return_end: trip.odometer_return_end,
            distance_return: trip.distance_return,
            return_revenue_cash: trip.return_revenue_cash,
            return_revenue_online: trip.return_revenue_online,
            return_revenue_paytm: trip.return_revenue_paytm,
            return_revenue_others: trip.return_revenue_others,
            return_revenue_agent: trip.return_revenue_agent,
            return_total_revenue: trip.return_total_revenue,
            bus: trip.bus as any,
            route: trip.route as any,
            driver: trip.driver as any,
          },
          expensesByTrip[trip.id] || []
        )
      );

      // Get vehicle number from first trip or use 'All Vehicles'
      const vehicleNo = trips.length === 1 
        ? (trips[0].bus as any)?.registration_number || 'Unknown'
        : 'Multiple Vehicles';

      exportTripSheet(sheetData, vehicleNo, `bus-trip-sheet-${new Date().toISOString().slice(0, 10)}`);
      toast.success('Trip Sheet downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate Trip Sheet');
    }
  }

  async function handleDownloadSingleTripSheet(trip: Trip) {
    toast.info('Generating Trip Sheet...');
    
    try {
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          trip_id,
          amount,
          category:expense_categories(name)
        `)
        .eq('trip_id', trip.id)
        .eq('status', 'approved');
      
      if (error) throw error;

      const tripExpenses = expenses?.map(exp => ({
        category_name: (exp.category as any)?.name || 'Other',
        amount: exp.amount
      })) || [];

      const sheetData = mapTripToSheetData(
        {
          id: trip.id,
          trip_number: trip.trip_number,
          start_date: trip.start_date,
          end_date: trip.end_date,
          status: trip.status,
          notes: trip.notes,
          trip_type: trip.trip_type,
          total_expense: trip.total_expense,
          odometer_start: trip.odometer_start,
          odometer_end: trip.odometer_end,
          distance_traveled: trip.distance_traveled,
          revenue_cash: trip.revenue_cash,
          revenue_online: trip.revenue_online,
          revenue_paytm: trip.revenue_paytm,
          revenue_others: trip.revenue_others,
          revenue_agent: trip.revenue_agent,
          total_revenue: trip.total_revenue,
          odometer_return_start: trip.odometer_return_start,
          odometer_return_end: trip.odometer_return_end,
          distance_return: trip.distance_return,
          return_revenue_cash: trip.return_revenue_cash,
          return_revenue_online: trip.return_revenue_online,
          return_revenue_paytm: trip.return_revenue_paytm,
          return_revenue_others: trip.return_revenue_others,
          return_revenue_agent: trip.return_revenue_agent,
          return_total_revenue: trip.return_total_revenue,
          bus: trip.bus as any,
          route: trip.route as any,
          driver: trip.driver as any,
        },
        tripExpenses
      );

      const vehicleNo = (trip.bus as any)?.registration_number || 'Unknown';
      exportTripSheet(sheetData, vehicleNo, `trip-sheet-${trip.trip_number}`);
      toast.success('Trip Sheet downloaded!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate Trip Sheet');
    }
  }

  useEffect(() => {
    fetchTrips();
    fetchBuses();
    fetchDrivers();
    fetchRoutes();
    fetchBusyDrivers();
  }, []);

  async function fetchBusyDrivers() {
    // Get drivers who have in_progress trips
    const { data } = await supabase
      .from('trips')
      .select('driver_id')
      .eq('status', 'in_progress');
    
    if (data) {
      const busyIds = new Set(data.map(t => t.driver_id).filter(Boolean) as string[]);
      setBusyDriverIds(busyIds);
    }
  }

  async function fetchTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        bus:buses(registration_number, bus_name),
        driver:profiles!trips_driver_id_fkey(full_name),
        route:routes(route_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch trips');
    } else {
      setTrips((data || []) as Trip[]);
    }
    setLoading(false);
  }

  async function fetchBuses() {
    const { data } = await supabase.from('buses').select('*').eq('status', 'active');
    if (data) setBuses(data as Bus[]);
  }

  async function fetchDrivers() {
    // Get users with driver role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver');

    if (roles && roles.length > 0) {
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profiles) setDrivers(profiles as Profile[]);
    }
  }

  async function fetchRoutes() {
    const { data } = await supabase.from('routes').select('*');
    if (data) setRoutes(data as Route[]);
  }

  function generateTripNumber() {
    const date = new Date();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `TRP${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${random}`;
  }

  function handleEdit(trip: Trip) {
    setEditingTrip(trip);
    setFormData({
      trip_number: trip.trip_number,
      bus_id: trip.bus_id,
      driver_id: trip.driver_id,
      route_id: trip.route_id,
      start_date: trip.start_date.slice(0, 16),
      end_date: trip.end_date?.slice(0, 16) || '',
      status: trip.status,
      trip_type: trip.trip_type || 'one_way',
      notes: trip.notes || '',
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingTrip(null);
    setFormData({
      trip_number: generateTripNumber(),
      bus_id: '',
      driver_id: '',
      route_id: '',
      start_date: '',
      end_date: '',
      status: 'scheduled',
      trip_type: 'one_way',
      notes: '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // Check if driver is already on an in-progress trip (skip if editing the same trip or if status is not scheduled/in_progress)
    if (formData.driver_id && (formData.status === 'scheduled' || formData.status === 'in_progress')) {
      const { data: existingTrips } = await supabase
        .from('trips')
        .select('id, trip_number')
        .eq('driver_id', formData.driver_id)
        .eq('status', 'in_progress')
        .neq('id', editingTrip?.id || '');
      
      if (existingTrips && existingTrips.length > 0) {
        toast.error(`Driver is already on trip ${existingTrips[0].trip_number}. Complete that trip first before assigning a new one.`);
        setSubmitting(false);
        return;
      }
    }

    // Validate odometer readings when completing a trip
    if (formData.status === 'completed' && editingTrip) {
      // Fetch current trip data to check odometer readings
      const { data: currentTrip } = await supabase
        .from('trips')
        .select('odometer_start, odometer_end, distance_traveled, odometer_return_start, odometer_return_end, distance_return, trip_type')
        .eq('id', editingTrip.id)
        .single();

      if (currentTrip) {
        const hasOutwardOdometer = currentTrip.odometer_start !== null && 
                                    currentTrip.odometer_end !== null && 
                                    currentTrip.distance_traveled !== null;
        
        const isTwoWay = currentTrip.trip_type === 'two_way';
        const hasReturnOdometer = currentTrip.odometer_return_start !== null && 
                                   currentTrip.odometer_return_end !== null && 
                                   currentTrip.distance_return !== null;

        if (!hasOutwardOdometer) {
          toast.error('Cannot complete trip: Outward odometer readings are required. Please ask the driver to fill in odometer readings first.');
          setSubmitting(false);
          return;
        }

        if (isTwoWay && !hasReturnOdometer) {
          toast.error('Cannot complete trip: Return journey odometer readings are required for two-way trips.');
          setSubmitting(false);
          return;
        }
      }
    }

    const payload = {
      trip_number: formData.trip_number,
      bus_id: formData.bus_id,
      driver_id: formData.driver_id,
      route_id: formData.route_id,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: formData.status,
      trip_type: formData.trip_type,
      notes: formData.notes || null,
    };

    if (editingTrip) {
      const { error } = await supabase.from('trips').update(payload).eq('id', editingTrip.id);

      if (error) {
        toast.error('Failed to update trip');
      } else {
        toast.success('Trip updated successfully');
        setDialogOpen(false);
        fetchTrips();
        fetchBusyDrivers();
      }
    } else {
      const { error } = await supabase.from('trips').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add trip');
      } else {
        toast.success('Trip created successfully');
        setDialogOpen(false);
        fetchTrips();
        fetchBusyDrivers();
      }
    }
    setSubmitting(false);
  }

  const getStatusBadge = (status: TripStatus) => {
    const variants: Record<TripStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      scheduled: 'outline',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trip Management</h1>
            <p className="text-muted-foreground">Schedule and manage trips</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setPeriodDialogOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Fleet Report
            </Button>
            <Button variant="outline" onClick={handleExportTripSheet} disabled={trips.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Trip Sheet
            </Button>
            <Button variant="outline" onClick={handleExportTrips} disabled={trips.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Trip
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTrip ? 'Edit Trip' : 'Create New Trip'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="trip_number">Trip Number</Label>
                  <Input
                    id="trip_number"
                    value={formData.trip_number}
                    onChange={(e) => setFormData({ ...formData, trip_number: e.target.value })}
                    required
                    readOnly={!!editingTrip}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bus *</Label>
                    <Select
                      value={formData.bus_id}
                      onValueChange={(value) => setFormData({ ...formData, bus_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bus" />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((bus) => (
                          <SelectItem key={bus.id} value={bus.id}>
                            {bus.registration_number} {bus.bus_name && `(${bus.bus_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Driver *</Label>
                    <Select
                      value={formData.driver_id}
                      onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((driver) => {
                          const isBusy = busyDriverIds.has(driver.id) && editingTrip?.driver_id !== driver.id;
                          return (
                            <SelectItem 
                              key={driver.id} 
                              value={driver.id}
                              disabled={isBusy}
                            >
                              {driver.full_name}
                              {isBusy && <span className="text-muted-foreground ml-2">(On Trip)</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Route *</Label>
                  <Select
                    value={formData.route_id}
                    onValueChange={(value) => setFormData({ ...formData, route_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.route_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date & Time *</Label>
                    <Input
                      id="start_date"
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date & Time</Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trip Type</Label>
                    <Select
                      value={formData.trip_type}
                      onValueChange={(value) => setFormData({ ...formData, trip_type: value as TripType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_way">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" />
                            One-Way
                          </div>
                        </SelectItem>
                        <SelectItem value="two_way">
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight className="h-4 w-4" />
                            Two-Way (Round Trip)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as TripStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingTrip ? 'Update' : 'Create'} Trip
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by trip #, bus, driver, or route..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || 'all',
              onChange: (value) => setFilter('status', value),
              options: [
                { label: 'All Status', value: 'all' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
              ],
            },
            {
              key: 'trip_type',
              label: 'Type',
              value: filters.trip_type || 'all',
              onChange: (value) => setFilter('trip_type', value),
              options: [
                { label: 'All Types', value: 'all' },
                { label: 'One Way', value: 'one_way' },
                { label: 'Two Way', value: 'two_way' },
              ],
            },
          ]}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {trips.length === 0 ? 'No trips created yet' : 'No trips match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrips.map((trip) => {
                    // Use pre-calculated total_revenue which includes all sources (cash, online, paytm, others, agent)
                    // Fallback to manual calculation only for backward compatibility
                    const outwardRevenue = Number(trip.total_revenue) || (
                      Number(trip.revenue_cash || 0) + 
                      Number(trip.revenue_online || 0) + 
                      Number(trip.revenue_paytm || 0) + 
                      Number(trip.revenue_others || 0) +
                      Number(trip.revenue_agent || 0)
                    );
                    
                    // Calculate return revenue (for backward compatibility with old data)
                    const returnRevenue = Number(trip.return_total_revenue) || (
                      Number(trip.return_revenue_cash || 0) + 
                      Number(trip.return_revenue_online || 0) + 
                      Number(trip.return_revenue_paytm || 0) + 
                      Number(trip.return_revenue_others || 0) +
                      Number(trip.return_revenue_agent || 0)
                    );
                    
                    const totalRevenue = outwardRevenue + returnRevenue;
                    const totalExpense = Number(trip.total_expense || 0) + Number(trip.return_total_expense || 0);
                    
                    return (
                      <TableRow key={trip.id}>
                        <TableCell className="font-medium">{trip.trip_number}</TableCell>
                        <TableCell>
                          <Badge variant={trip.trip_type === 'two_way' ? 'default' : 'outline'}>
                            {trip.trip_type === 'two_way' ? (
                              <><ArrowLeftRight className="h-3 w-3 mr-1" />2-Way</>
                            ) : (
                              <><ArrowRight className="h-3 w-3 mr-1" />1-Way</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {trip.bus ? (trip.bus as any)?.registration_number : (
                            <span className="text-muted-foreground italic">{trip.bus_name_snapshot || 'Deleted'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {trip.driver ? (trip.driver as any)?.full_name : (
                            <span className="text-muted-foreground italic">{trip.driver_name_snapshot || 'Deleted'}</span>
                          )}
                        </TableCell>
                        <TableCell>{(trip.route as any)?.route_name}</TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div>
                              <div className="font-medium">
                                {new Date(trip.start_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-muted-foreground text-xs flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                {trip.departure_time || new Date(trip.start_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {trip.arrival_time || (trip.end_date ? new Date(trip.end_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-')}
                              </div>
                            </div>
                            {trip.trip_type === 'two_way' && (
                              <div className="text-muted-foreground text-xs flex items-center gap-1 border-t pt-1">
                                <ArrowLeft className="h-3 w-3" />
                                {trip.return_departure_time || '-'}
                                {' → '}
                                {trip.return_arrival_time || '-'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(trip.status)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(totalRevenue)}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {formatCurrency(totalExpense)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleDownloadSingleTripSheet(trip)} title="Download Trip Sheet">
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleAddRevenue(trip)} title="Add Revenue">
                              <IndianRupee className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleViewExpenses(trip)} title="View Expenses">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(trip)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              showingFrom={showingFrom}
              showingTo={showingTo}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemName="trips"
            />
          </CardContent>
        </Card>

        {selectedTrip && (
          <TripExpensesDialog
            open={expenseDialogOpen}
            onOpenChange={setExpenseDialogOpen}
            tripId={selectedTrip.id}
            tripNumber={selectedTrip.trip_number}
          />
        )}

        <TripRevenueDialog
          open={revenueDialogOpen}
          onOpenChange={setRevenueDialogOpen}
          trip={revenueTrip}
          onSuccess={fetchTrips}
        />

        <PeriodExportDialog
          open={periodDialogOpen}
          onOpenChange={setPeriodDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}
