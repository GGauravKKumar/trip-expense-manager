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
import { Trip, TripStatus, Bus, Profile, Route } from '@/types/database';
import { Plus, Pencil, Loader2, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, formatCurrency, formatDate } from '@/lib/exportUtils';
import TripExpensesDialog from '@/components/TripExpensesDialog';

export default function TripManagement() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
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
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  function handleViewExpenses(trip: Trip) {
    setSelectedTrip(trip);
    setExpenseDialogOpen(true);
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
        { header: 'Total Expense', key: 'total_expense', format: (v) => Number(v) || 0 },
      ],
      'trips-report'
    );
  }

  useEffect(() => {
    fetchTrips();
    fetchBuses();
    fetchDrivers();
    fetchRoutes();
  }, []);

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
      setTrips(data as Trip[]);
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
      notes: '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      trip_number: formData.trip_number,
      bus_id: formData.bus_id,
      driver_id: formData.driver_id,
      route_id: formData.route_id,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: formData.status,
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
      }
    } else {
      const { error } = await supabase.from('trips').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add trip');
      } else {
        toast.success('Trip created successfully');
        setDialogOpen(false);
        fetchTrips();
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
          <div className="flex gap-2">
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
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.full_name}
                          </SelectItem>
                        ))}
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip #</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Expense</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No trips created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-medium">{trip.trip_number}</TableCell>
                      <TableCell>{(trip.bus as any)?.registration_number}</TableCell>
                      <TableCell>{(trip.driver as any)?.full_name}</TableCell>
                      <TableCell>{(trip.route as any)?.route_name}</TableCell>
                      <TableCell>
                        {new Date(trip.start_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(trip.status)}</TableCell>
                      <TableCell>{formatCurrency(Number(trip.total_expense))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewExpenses(trip)} title="View Expenses">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(trip)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
      </div>
    </DashboardLayout>
  );
}
