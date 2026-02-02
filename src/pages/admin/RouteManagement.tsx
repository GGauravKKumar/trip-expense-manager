import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { Route, IndianState } from '@/types/database';
import { Plus, Pencil, Loader2, Receipt, Download, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import RouteExpensesDialog from '@/components/RouteExpensesDialog';
import { exportToExcel } from '@/lib/exportUtils';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

export default function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  const [tripCount, setTripCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    route_name: '',
    from_state_id: '',
    to_state_id: '',
    from_address: '',
    to_address: '',
    distance_km: '',
    estimated_duration_hours: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Table filters
  const {
    searchQuery,
    setSearchQuery,
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
    data: routes,
    searchFields: [
      'route_name',
      'from_address',
      'to_address',
      (route) => (route.from_state as any)?.state_name,
      (route) => (route.to_state as any)?.state_name,
    ],
  });

  function handleViewExpenses(route: Route) {
    setSelectedRoute(route);
    setExpenseDialogOpen(true);
  }

  function handleExportRoutes() {
    if (routes.length === 0) return;

    exportToExcel(
      routes,
      [
        { header: 'Route Name', key: 'route_name' },
        { header: 'From State', key: 'from_state', format: (v) => v?.state_name || '-' },
        { header: 'From Address', key: 'from_address', format: (v) => v || '-' },
        { header: 'To State', key: 'to_state', format: (v) => v?.state_name || '-' },
        { header: 'To Address', key: 'to_address', format: (v) => v || '-' },
        { header: 'Distance (km)', key: 'distance_km', format: (v) => v || '-' },
        { header: 'Duration (hrs)', key: 'estimated_duration_hours', format: (v) => v || '-' },
      ],
      'routes-report'
    );
  }

  useEffect(() => {
    fetchRoutes();
    fetchStates();
  }, []);

  async function fetchStates() {
    if (USE_PYTHON_API) {
      const { data, error } = await apiClient.get<IndianState[]>('/states');
      if (error) {
        toast.error('Failed to fetch states');
      } else {
        setStates(data || []);
      }
    } else {
      const supabase = await getCloudClient();
      const { data, error } = await supabase
        .from('indian_states')
        .select('*')
        .order('state_name');

      if (error) {
        toast.error('Failed to fetch states');
      } else {
        setStates(data as IndianState[]);
      }
    }
  }

  async function fetchRoutes() {
    if (USE_PYTHON_API) {
      const { data, error } = await apiClient.get<Route[]>('/routes');
      if (error) {
        toast.error('Failed to fetch routes');
      } else {
        setRoutes(data || []);
      }
    } else {
      const supabase = await getCloudClient();
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          from_state:indian_states!routes_from_state_id_fkey(state_name, state_code),
          to_state:indian_states!routes_to_state_id_fkey(state_name, state_code)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to fetch routes');
      } else {
        setRoutes(data as Route[]);
      }
    }
    setLoading(false);
  }

  function handleEdit(route: Route) {
    setEditingRoute(route);
    setFormData({
      route_name: route.route_name,
      from_state_id: route.from_state_id,
      to_state_id: route.to_state_id,
      from_address: route.from_address || '',
      to_address: route.to_address || '',
      distance_km: route.distance_km?.toString() || '',
      estimated_duration_hours: route.estimated_duration_hours?.toString() || '',
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingRoute(null);
    setFormData({
      route_name: '',
      from_state_id: '',
      to_state_id: '',
      from_address: '',
      to_address: '',
      distance_km: '',
      estimated_duration_hours: '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      route_name: formData.route_name,
      from_state_id: formData.from_state_id,
      to_state_id: formData.to_state_id,
      from_address: formData.from_address || null,
      to_address: formData.to_address || null,
      distance_km: formData.distance_km ? parseFloat(formData.distance_km) : null,
      estimated_duration_hours: formData.estimated_duration_hours
        ? parseFloat(formData.estimated_duration_hours)
        : null,
    };

    if (editingRoute) {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.put(`/routes/${editingRoute.id}`, payload);
        if (error) toast.error('Failed to update route');
        else { toast.success('Route updated successfully'); setDialogOpen(false); fetchRoutes(); }
      } else {
        const supabase = await getCloudClient();
        const { error } = await supabase.from('routes').update(payload).eq('id', editingRoute.id);
        if (error) toast.error('Failed to update route');
        else { toast.success('Route updated successfully'); setDialogOpen(false); fetchRoutes(); }
      }
    } else {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.post('/routes', payload);
        if (error) toast.error(error.message || 'Failed to add route');
        else { toast.success('Route added successfully'); setDialogOpen(false); fetchRoutes(); }
      } else {
        const supabase = await getCloudClient();
        const { error } = await supabase.from('routes').insert(payload);
        if (error) toast.error(error.message || 'Failed to add route');
        else { toast.success('Route added successfully'); setDialogOpen(false); fetchRoutes(); }
      }
    }
    setSubmitting(false);
  }

  async function handleDeleteClick(route: Route) {
    setRouteToDelete(route);
    if (USE_PYTHON_API) {
      setTripCount(0);
    } else {
      const supabase = await getCloudClient();
      const { count } = await supabase.from('trips').select('*', { count: 'exact', head: true }).eq('route_id', route.id);
      setTripCount(count || 0);
    }
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!routeToDelete) return;
    setDeleting(true);

    if (USE_PYTHON_API) {
      const { error } = await apiClient.delete(`/routes/${routeToDelete.id}`);
      if (error) toast.error('Failed to delete route: ' + error.message);
      else { toast.success('Route deleted successfully'); fetchRoutes(); }
    } else {
      const supabase = await getCloudClient();
      const { error } = await supabase.from('routes').delete().eq('id', routeToDelete.id);
      if (error) toast.error('Failed to delete route: ' + error.message);
      else { toast.success('Route deleted successfully'); fetchRoutes(); }
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setRouteToDelete(null);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Route Management</h1>
            <p className="text-muted-foreground">Manage bus routes across India</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportRoutes} disabled={routes.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Route
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingRoute ? 'Edit Route' : 'Add New Route'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="route_name">Route Name *</Label>
                  <Input
                    id="route_name"
                    value={formData.route_name}
                    onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                    placeholder="Mumbai to Delhi Express"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From State *</Label>
                    <Select
                      value={formData.from_state_id}
                      onValueChange={(value) => setFormData({ ...formData, from_state_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.state_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To State *</Label>
                    <Select
                      value={formData.to_state_id}
                      onValueChange={(value) => setFormData({ ...formData, to_state_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.state_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_address">From Address</Label>
                    <Input
                      id="from_address"
                      value={formData.from_address}
                      onChange={(e) => setFormData({ ...formData, from_address: e.target.value })}
                      placeholder="Andheri Bus Station"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to_address">To Address</Label>
                    <Input
                      id="to_address"
                      value={formData.to_address}
                      onChange={(e) => setFormData({ ...formData, to_address: e.target.value })}
                      placeholder="ISBT Kashmere Gate"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance_km">Distance (km)</Label>
                    <Input
                      id="distance_km"
                      type="number"
                      step="0.01"
                      value={formData.distance_km}
                      onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                      placeholder="1400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimated_duration_hours">Est. Duration (hours)</Label>
                    <Input
                      id="estimated_duration_hours"
                      type="number"
                      step="0.5"
                      value={formData.estimated_duration_hours}
                      onChange={(e) =>
                        setFormData({ ...formData, estimated_duration_hours: e.target.value })
                      }
                      placeholder="24"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingRoute ? 'Update' : 'Add'} Route
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by route name, state, or address..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route Name</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {routes.length === 0 ? 'No routes added yet' : 'No routes match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">{route.route_name}</TableCell>
                      <TableCell>
                        <div>
                          <p>{(route.from_state as any)?.state_name}</p>
                          {route.from_address && (
                            <p className="text-xs text-muted-foreground">{route.from_address}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{(route.to_state as any)?.state_name}</p>
                          {route.to_address && (
                            <p className="text-xs text-muted-foreground">{route.to_address}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{route.distance_km ? `${route.distance_km} km` : '-'}</TableCell>
                      <TableCell>
                        {route.estimated_duration_hours ? `${route.estimated_duration_hours} hrs` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewExpenses(route)} title="View Expenses">
                            <Receipt className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(route)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(route)} title="Delete" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
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
              itemName="routes"
            />
          </CardContent>
        </Card>

        {selectedRoute && (
          <RouteExpensesDialog
            open={expenseDialogOpen}
            onOpenChange={setExpenseDialogOpen}
            routeId={selectedRoute.id}
            routeName={selectedRoute.route_name}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {tripCount > 0 && <AlertTriangle className="h-5 w-5 text-destructive" />}
                Delete Route
              </AlertDialogTitle>
              <AlertDialogDescription>
                {tripCount > 0 ? (
                  <div className="space-y-2">
                    <p>
                      <strong className="text-destructive">Warning:</strong> This route has{' '}
                      <strong>{tripCount}</strong> associated trip{tripCount !== 1 ? 's' : ''}.
                    </p>
                    <p>
                      Deleting this route will remove the route reference from these trips. 
                      Trip data will be preserved, but the route information will be lost.
                    </p>
                    <p className="font-medium">Are you sure you want to proceed?</p>
                  </div>
                ) : (
                  <p>
                    Are you sure you want to delete "{routeToDelete?.route_name}"? This action cannot be undone.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
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
