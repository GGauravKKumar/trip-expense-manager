import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Route, Profile, BusSchedule } from '@/types/database';
import { Plus, Pencil, Loader2, Trash2, Calendar, Clock, ArrowLeftRight, Play, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';
import ScheduleTimeline from '@/components/ScheduleTimeline';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

// Helper function to detect overnight journeys
function isOvernightJourney(departureTime: string, arrivalTime: string): boolean {
  const [depHour, depMin] = departureTime.split(':').map(Number);
  const [arrHour, arrMin] = arrivalTime.split(':').map(Number);
  const depMinutes = depHour * 60 + depMin;
  const arrMinutes = arrHour * 60 + arrMin;
  return arrMinutes < depMinutes;
}

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState<BusSchedule[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BusSchedule | null>(null);
  const [formData, setFormData] = useState({
    bus_id: '',
    route_id: '',
    driver_id: '',
    departure_time: '22:00',
    arrival_time: '06:00',
    days_of_week: [] as string[],
    is_two_way: true,
    return_departure_time: '09:00',
    return_arrival_time: '22:00',
    is_active: true,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Detect overnight journeys based on form data
  const isOutwardOvernight = useMemo(() => 
    isOvernightJourney(formData.departure_time, formData.arrival_time),
    [formData.departure_time, formData.arrival_time]
  );
  
  const isReturnOvernight = useMemo(() => 
    formData.is_two_way && formData.return_departure_time && formData.return_arrival_time
      ? isOvernightJourney(formData.return_departure_time, formData.return_arrival_time)
      : false,
    [formData.is_two_way, formData.return_departure_time, formData.return_arrival_time]
  );

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<BusSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generate trips state
  const [generating, setGenerating] = useState(false);

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
    data: schedules,
    searchFields: ['notes'],
  });

  // Apply filters
  const filteredSchedules = paginatedData.filter((schedule) => {
    const matchesStatus = !filters.status || filters.status === 'all' || 
      (filters.status === 'active' ? schedule.is_active : !schedule.is_active);
    return matchesStatus;
  });

  useEffect(() => {
    Promise.all([fetchSchedules(), fetchBuses(), fetchRoutes(), fetchDrivers()]);
  }, []);

  async function fetchSchedules() {
    const { data, error } = await supabase
      .from('bus_schedules')
      .select(`
        *,
        bus:buses(*),
        route:routes(*),
        driver:profiles(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch schedules');
    } else {
      setSchedules(data as BusSchedule[]);
    }
    setLoading(false);
  }

  async function fetchBuses() {
    const { data } = await supabase
      .from('buses')
      .select('*')
      .eq('status', 'active')
      .order('registration_number');
    setBuses(data as Bus[] || []);
  }

  async function fetchRoutes() {
    const { data } = await supabase
      .from('routes')
      .select('*')
      .order('route_name');
    setRoutes(data as Route[] || []);
  }

  async function fetchDrivers() {
    // First get all user_ids with driver role
    const { data: driverRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver');
    
    if (!driverRoles || driverRoles.length === 0) {
      setDrivers([]);
      return;
    }

    // Then fetch profiles for those user_ids
    const driverUserIds = driverRoles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', driverUserIds)
      .order('full_name');
    
    setDrivers(profiles as Profile[] || []);
  }

  function handleEdit(schedule: BusSchedule) {
    setEditingSchedule(schedule);
    setFormData({
      bus_id: schedule.bus_id,
      route_id: schedule.route_id,
      driver_id: schedule.driver_id || '',
      departure_time: schedule.departure_time,
      arrival_time: schedule.arrival_time,
      days_of_week: schedule.days_of_week || [],
      is_two_way: schedule.is_two_way,
      return_departure_time: schedule.return_departure_time || '09:00',
      return_arrival_time: schedule.return_arrival_time || '22:00',
      is_active: schedule.is_active,
      notes: schedule.notes || '',
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingSchedule(null);
    setFormData({
      bus_id: '',
      route_id: '',
      driver_id: '',
      departure_time: '22:00',
      arrival_time: '06:00',
      days_of_week: [],
      is_two_way: true,
      return_departure_time: '09:00',
      return_arrival_time: '22:00',
      is_active: true,
      notes: '',
    });
    setDialogOpen(true);
  }

  function toggleDay(day: string) {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    if (!formData.bus_id || !formData.route_id) {
      toast.error('Please select a bus and route');
      setSubmitting(false);
      return;
    }

    if (formData.days_of_week.length === 0) {
      toast.error('Please select at least one day');
      setSubmitting(false);
      return;
    }

    const payload = {
      bus_id: formData.bus_id,
      route_id: formData.route_id,
      driver_id: formData.driver_id || null,
      departure_time: formData.departure_time,
      arrival_time: formData.arrival_time,
      days_of_week: formData.days_of_week,
      is_two_way: formData.is_two_way,
      return_departure_time: formData.is_two_way ? formData.return_departure_time : null,
      return_arrival_time: formData.is_two_way ? formData.return_arrival_time : null,
      is_active: formData.is_active,
      notes: formData.notes || null,
    };

    if (editingSchedule) {
      const { error } = await supabase
        .from('bus_schedules')
        .update(payload)
        .eq('id', editingSchedule.id);

      if (error) {
        toast.error('Failed to update schedule');
      } else {
        toast.success('Schedule updated successfully');
        setDialogOpen(false);
        fetchSchedules();
      }
    } else {
      const { error } = await supabase.from('bus_schedules').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add schedule');
      } else {
        toast.success('Schedule added successfully');
        setDialogOpen(false);
        fetchSchedules();
      }
    }
    setSubmitting(false);
  }

  async function handleDeleteSchedule(schedule: BusSchedule) {
    setDeletingSchedule(schedule);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteSchedule() {
    if (!deletingSchedule) return;

    setDeleting(true);
    const { error } = await supabase
      .from('bus_schedules')
      .delete()
      .eq('id', deletingSchedule.id);

    if (error) {
      toast.error('Failed to delete schedule');
    } else {
      toast.success('Schedule deleted successfully');
      fetchSchedules();
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingSchedule(null);
  }

  function formatDays(days: string[]) {
    if (!days || days.length === 0) return '-';
    if (days.length === 7) return 'Daily';
    return days.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label).join(', ');
  }

  async function handleGenerateTrips() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scheduled-trips');
      
      if (error) throw error;
      
      if (data.tripsCreated > 0) {
        toast.success(`Created ${data.tripsCreated} trips from ${data.schedulesProcessed} schedules`);
      } else if (data.schedulesProcessed === 0) {
        toast.info('No active schedules found for today');
      } else {
        toast.info('All trips for today already exist');
      }
    } catch (error) {
      console.error('Error generating trips:', error);
      toast.error('Failed to generate trips');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedule Management</h1>
            <p className="text-muted-foreground">Manage recurring bus schedules for fixed routes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateTrips} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {generating ? 'Generating...' : "Generate Today's Trips"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bus_id">Bus *</Label>
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
                  <Label htmlFor="route_id">Route *</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="driver_id">Default Driver</Label>
                  <Select
                    value={formData.driver_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default driver</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Days of Week *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={formData.days_of_week.includes(day.value) ? 'default' : 'outline'}
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure_time">Departure Time</Label>
                    <Input
                      id="departure_time"
                      type="time"
                      value={formData.departure_time}
                      onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival_time">Arrival Time</Label>
                    <Input
                      id="arrival_time"
                      type="time"
                      value={formData.arrival_time}
                      onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                  <Switch
                    id="is_two_way"
                    checked={formData.is_two_way}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_two_way: checked })}
                  />
                  <Label htmlFor="is_two_way" className="flex items-center gap-2 cursor-pointer">
                    <ArrowLeftRight className="h-4 w-4" />
                    Two-Way Schedule (Return Journey)
                  </Label>
                </div>

                {formData.is_two_way && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="return_departure_time">Return Departure</Label>
                      <Input
                        id="return_departure_time"
                        type="time"
                        value={formData.return_departure_time}
                        onChange={(e) => setFormData({ ...formData, return_departure_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_arrival_time">Return Arrival</Label>
                      <Input
                        id="return_arrival_time"
                        type="time"
                        value={formData.return_arrival_time}
                        onChange={(e) => setFormData({ ...formData, return_arrival_time: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Overnight Journey Indicator */}
                {(isOutwardOvernight || isReturnOvernight) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                      <Moon className="h-4 w-4" />
                      <span className="font-medium text-sm">Overnight Journey Detected</span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {isOutwardOvernight && 'The outward journey spans midnight (arrives next day). '}
                      {isReturnOvernight && 'The return journey spans midnight (arrives next day). '}
                      Trips will be linked automatically to prevent double-booking.
                    </p>
                  </div>
                )}

                {/* Visual Timeline Preview */}
                {formData.departure_time && formData.arrival_time && (
                  <ScheduleTimeline
                    departureTime={formData.departure_time}
                    arrivalTime={formData.arrival_time}
                    isTwoWay={formData.is_two_way}
                    returnDepartureTime={formData.return_departure_time}
                    returnArrivalTime={formData.return_arrival_time}
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Schedule Active</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSchedule ? 'Update' : 'Add'} Schedule
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by bus or route..."
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
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
            },
          ]}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredSchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {schedules.length === 0 ? 'No schedules added yet' : 'No schedules match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.bus?.registration_number || '-'}
                      </TableCell>
                      <TableCell>{schedule.route?.route_name || '-'}</TableCell>
                      <TableCell>{schedule.driver?.full_name || '-'}</TableCell>
                      <TableCell>{formatDays(schedule.days_of_week)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{schedule.departure_time}</span>
                          {isOvernightJourney(schedule.departure_time, schedule.arrival_time) && (
                            <span title="Overnight journey"><Moon className="h-3 w-3 text-blue-500 ml-1" /></span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          → {schedule.arrival_time}
                          {isOvernightJourney(schedule.departure_time, schedule.arrival_time) && (
                            <span className="text-blue-500 ml-1">(+1 day)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {schedule.is_two_way ? (
                          <Badge variant="outline" className="border-blue-500 text-blue-700">
                            <ArrowLeftRight className="h-3 w-3 mr-1" />
                            Two-Way
                          </Badge>
                        ) : (
                          <Badge variant="outline">One-Way</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(schedule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSchedule(schedule)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
              itemName="schedules"
            />
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this schedule? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteSchedule}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}