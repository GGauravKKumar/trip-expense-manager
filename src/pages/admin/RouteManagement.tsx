import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Route, IndianState } from '@/types/database';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
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

  useEffect(() => {
    fetchRoutes();
    fetchStates();
  }, []);

  async function fetchStates() {
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

  async function fetchRoutes() {
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
      const { error } = await supabase
        .from('routes')
        .update(payload)
        .eq('id', editingRoute.id);

      if (error) {
        toast.error('Failed to update route');
      } else {
        toast.success('Route updated successfully');
        setDialogOpen(false);
        fetchRoutes();
      }
    } else {
      const { error } = await supabase.from('routes').insert(payload);

      if (error) {
        toast.error(error.message || 'Failed to add route');
      } else {
        toast.success('Route added successfully');
        setDialogOpen(false);
        fetchRoutes();
      }
    }
    setSubmitting(false);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Route Management</h1>
            <p className="text-muted-foreground">Manage bus routes across India</p>
          </div>
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
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No routes added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
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
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(route)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
