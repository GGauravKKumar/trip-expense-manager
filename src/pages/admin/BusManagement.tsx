import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { Bus, BusStatus } from '@/types/database';
import { Plus, Pencil, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

export default function BusManagement() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [formData, setFormData] = useState({
    registration_number: '',
    bus_name: '',
    capacity: 40,
    bus_type: 'AC Sleeper',
    status: 'active' as BusStatus,
    insurance_expiry: '',
    puc_expiry: '',
    fitness_expiry: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBus, setDeletingBus] = useState<Bus | null>(null);
  const [hasRelatedTrips, setHasRelatedTrips] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    data: buses,
    searchFields: ['registration_number', 'bus_name', 'bus_type'],
  });

  // Apply status filter
  const filteredBuses = paginatedData.filter((bus) => {
    if (filters.status && filters.status !== 'all') {
      return bus.status === filters.status;
    }
    return true;
  });

  useEffect(() => {
    fetchBuses();
  }, []);

  async function fetchBuses() {
    const { data, error } = await supabase
      .from('buses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch buses');
    } else {
      setBuses(data as Bus[]);
    }
    setLoading(false);
  }

  function handleEdit(bus: Bus) {
    setEditingBus(bus);
    setFormData({
      registration_number: bus.registration_number,
      bus_name: bus.bus_name || '',
      capacity: bus.capacity,
      bus_type: bus.bus_type || 'AC Sleeper',
      status: bus.status,
      insurance_expiry: bus.insurance_expiry || '',
      puc_expiry: bus.puc_expiry || '',
      fitness_expiry: bus.fitness_expiry || '',
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingBus(null);
    setFormData({
      registration_number: '',
      bus_name: '',
      capacity: 40,
      bus_type: 'AC Sleeper',
      status: 'active',
      insurance_expiry: '',
      puc_expiry: '',
      fitness_expiry: '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      registration_number: formData.registration_number,
      bus_name: formData.bus_name || null,
      capacity: formData.capacity,
      bus_type: formData.bus_type,
      status: formData.status,
      insurance_expiry: formData.insurance_expiry || null,
      puc_expiry: formData.puc_expiry || null,
      fitness_expiry: formData.fitness_expiry || null,
    };

    if (editingBus) {
      const { error } = await supabase
        .from('buses')
        .update(payload)
        .eq('id', editingBus.id);

      if (error) {
        toast.error('Failed to update bus');
      } else {
        toast.success('Bus updated successfully');
        setDialogOpen(false);
        fetchBuses();
      }
    } else {
      const { error } = await supabase.from('buses').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add bus');
      } else {
        toast.success('Bus added successfully');
        setDialogOpen(false);
        fetchBuses();
      }
    }
    setSubmitting(false);
  }

  async function handleDeleteBus(bus: Bus) {
    setDeletingBus(bus);
    
    // Check if bus has related trips that are NOT completed
    const { count: activeTrips, error: activeError } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('bus_id', bus.id)
      .neq('status', 'completed');

    if (activeError) {
      toast.error('Failed to check bus dependencies');
      return;
    }

    // If there are active (non-completed) trips, block deletion
    setHasRelatedTrips((activeTrips || 0) > 0);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteBus() {
    if (!deletingBus) return;

    setDeleting(true);
    
    // First, update all completed trips with this bus to store the bus name snapshot
    const busName = deletingBus.bus_name || deletingBus.registration_number;
    const { error: snapshotError } = await supabase
      .from('trips')
      .update({ bus_name_snapshot: `${busName} (${deletingBus.registration_number})` })
      .eq('bus_id', deletingBus.id);

    if (snapshotError) {
      toast.error('Failed to preserve trip history');
      setDeleting(false);
      return;
    }

    // Now delete the bus (FK will be set to NULL automatically)
    const { error } = await supabase
      .from('buses')
      .delete()
      .eq('id', deletingBus.id);

    if (error) {
      toast.error('Failed to delete bus');
    } else {
      toast.success('Bus deleted successfully');
      fetchBuses();
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingBus(null);
  }

  const getStatusBadge = (status: BusStatus) => {
    const variants: Record<BusStatus, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      maintenance: 'secondary',
      inactive: 'destructive',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bus Management</h1>
            <p className="text-muted-foreground">Manage your fleet of buses</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bus
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingBus ? 'Edit Bus' : 'Add New Bus'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registration_number">Registration Number *</Label>
                    <Input
                      id="registration_number"
                      value={formData.registration_number}
                      onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      placeholder="MH12AB1234"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bus_name">Bus Name</Label>
                    <Input
                      id="bus_name"
                      value={formData.bus_name}
                      onChange={(e) => setFormData({ ...formData, bus_name: e.target.value })}
                      placeholder="Express 1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bus_type">Bus Type</Label>
                    <Select
                      value={formData.bus_type}
                      onValueChange={(value) => setFormData({ ...formData, bus_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AC Sleeper">AC Sleeper</SelectItem>
                        <SelectItem value="Non-AC Sleeper">Non-AC Sleeper</SelectItem>
                        <SelectItem value="AC Seater">AC Seater</SelectItem>
                        <SelectItem value="Non-AC Seater">Non-AC Seater</SelectItem>
                        <SelectItem value="Volvo">Volvo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as BusStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
                    <Input
                      id="insurance_expiry"
                      type="date"
                      value={formData.insurance_expiry}
                      onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="puc_expiry">PUC Expiry</Label>
                    <Input
                      id="puc_expiry"
                      type="date"
                      value={formData.puc_expiry}
                      onChange={(e) => setFormData({ ...formData, puc_expiry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fitness_expiry">Fitness Expiry</Label>
                    <Input
                      id="fitness_expiry"
                      type="date"
                      value={formData.fitness_expiry}
                      onChange={(e) => setFormData({ ...formData, fitness_expiry: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingBus ? 'Update' : 'Add'} Bus
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by registration, name, or type..."
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
                { label: 'Maintenance', value: 'maintenance' },
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
                  <TableHead>Registration</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>PUC</TableHead>
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
                ) : filteredBuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {buses.length === 0 ? 'No buses added yet' : 'No buses match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBuses.map((bus) => (
                    <TableRow key={bus.id}>
                      <TableCell className="font-medium">{bus.registration_number}</TableCell>
                      <TableCell>{bus.bus_name || '-'}</TableCell>
                      <TableCell>{bus.bus_type}</TableCell>
                      <TableCell>{bus.capacity}</TableCell>
                      <TableCell>{getStatusBadge(bus.status)}</TableCell>
                      <TableCell>{bus.insurance_expiry || '-'}</TableCell>
                      <TableCell>{bus.puc_expiry || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(bus)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteBus(bus)}>
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
              itemName="buses"
            />
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {hasRelatedTrips ? 'Cannot Delete Bus' : 'Delete Bus'}
              </AlertDialogTitle>
              <AlertDialogDescription>
              {hasRelatedTrips ? (
                  <>
                    This bus <strong>"{deletingBus?.registration_number}"</strong> has active trips 
                    (scheduled, in progress, or cancelled) and cannot be deleted. 
                    Please complete or reassign those trips first.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete bus <strong>"{deletingBus?.registration_number}"</strong>? 
                    Historical trip records will be preserved with the bus name.
                    This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {hasRelatedTrips ? (
                <AlertDialogAction onClick={() => setDeleteDialogOpen(false)}>
                  OK
                </AlertDialogAction>
              ) : (
                <>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDeleteBus}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
