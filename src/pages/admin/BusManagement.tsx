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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { Bus, BusStatus, IndianState, OwnershipType } from '@/types/database';
import { Plus, Pencil, Loader2, Trash2, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

export default function BusManagement() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
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
    // Ownership fields
    ownership_type: 'owned' as OwnershipType,
    partner_name: '',
    company_profit_share: 100,
    partner_profit_share: 0,
    // Tax fields
    home_state_id: '',
    monthly_tax_amount: 0,
    tax_due_day: 1,
    last_tax_paid_date: '',
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

  // Apply status and ownership filters
  const filteredBuses = paginatedData.filter((bus) => {
    const matchesStatus = !filters.status || filters.status === 'all' || bus.status === filters.status;
    const matchesOwnership = !filters.ownership || filters.ownership === 'all' || bus.ownership_type === filters.ownership;
    return matchesStatus && matchesOwnership;
  });

  useEffect(() => {
    fetchBuses();
    fetchStates();
  }, []);

  async function fetchBuses() {
    if (USE_PYTHON_API) {
      const { data, error } = await apiClient.get<Bus[]>('/buses');
      if (error) {
        toast.error('Failed to fetch buses');
      } else {
        setBuses(data || []);
      }
    } else {
      const supabase = await getCloudClient();
      const { data, error } = await supabase
        .from('buses')
        .select('*, home_state:indian_states(*)')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to fetch buses');
      } else {
        setBuses(data as Bus[]);
      }
    }
    setLoading(false);
  }

  async function fetchStates() {
    if (USE_PYTHON_API) {
      const { data, error } = await apiClient.get<IndianState[]>('/states');
      if (error) {
        console.error('Failed to fetch states:', error);
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
        console.error('Failed to fetch states:', error);
      } else {
        setStates(data as IndianState[]);
      }
    }
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
      ownership_type: bus.ownership_type,
      partner_name: bus.partner_name || '',
      company_profit_share: bus.company_profit_share,
      partner_profit_share: bus.partner_profit_share,
      home_state_id: bus.home_state_id || '',
      monthly_tax_amount: bus.monthly_tax_amount || 0,
      tax_due_day: bus.tax_due_day || 1,
      last_tax_paid_date: bus.last_tax_paid_date || '',
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
      ownership_type: 'owned',
      partner_name: '',
      company_profit_share: 100,
      partner_profit_share: 0,
      home_state_id: '',
      monthly_tax_amount: 0,
      tax_due_day: 1,
      last_tax_paid_date: '',
    });
    setDialogOpen(true);
  }

  function handleProfitShareChange(field: 'company_profit_share' | 'partner_profit_share', value: number) {
    const otherField = field === 'company_profit_share' ? 'partner_profit_share' : 'company_profit_share';
    const otherValue = 100 - value;
    setFormData({
      ...formData,
      [field]: value,
      [otherField]: Math.max(0, otherValue),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // Validate profit shares
    if (formData.ownership_type === 'partnership') {
      if (formData.company_profit_share + formData.partner_profit_share !== 100) {
        toast.error('Profit shares must total 100%');
        setSubmitting(false);
        return;
      }
      if (!formData.partner_name.trim()) {
        toast.error('Partner name is required for partnership buses');
        setSubmitting(false);
        return;
      }
    }

    // Calculate next tax due date
    let nextTaxDueDate: string | null = null;
    if (formData.home_state_id && formData.tax_due_day) {
      const today = new Date();
      const taxDay = formData.tax_due_day;
      let nextDue = new Date(today.getFullYear(), today.getMonth(), taxDay);
      if (nextDue <= today) {
        nextDue = new Date(today.getFullYear(), today.getMonth() + 1, taxDay);
      }
      nextTaxDueDate = nextDue.toISOString().split('T')[0];
    }

    const payload = {
      registration_number: formData.registration_number,
      bus_name: formData.bus_name || null,
      capacity: formData.capacity,
      bus_type: formData.bus_type,
      status: formData.status,
      insurance_expiry: formData.insurance_expiry || null,
      puc_expiry: formData.puc_expiry || null,
      fitness_expiry: formData.fitness_expiry || null,
      ownership_type: formData.ownership_type,
      partner_name: formData.ownership_type === 'partnership' ? formData.partner_name : null,
      company_profit_share: formData.ownership_type === 'partnership' ? formData.company_profit_share : 100,
      partner_profit_share: formData.ownership_type === 'partnership' ? formData.partner_profit_share : 0,
      home_state_id: formData.home_state_id || null,
      monthly_tax_amount: formData.monthly_tax_amount || null,
      tax_due_day: formData.tax_due_day || null,
      last_tax_paid_date: formData.last_tax_paid_date || null,
      next_tax_due_date: nextTaxDueDate,
    };

    if (editingBus) {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.put(`/buses/${editingBus.id}`, payload);
        if (error) toast.error('Failed to update bus');
        else { toast.success('Bus updated successfully'); setDialogOpen(false); fetchBuses(); }
      } else {
        const supabase = await getCloudClient();
        const { error } = await supabase.from('buses').update(payload).eq('id', editingBus.id);
        if (error) toast.error('Failed to update bus');
        else { toast.success('Bus updated successfully'); setDialogOpen(false); fetchBuses(); }
      }
    } else {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.post('/buses', payload);
        if (error) toast.error(error.message || 'Failed to add bus');
        else { toast.success('Bus added successfully'); setDialogOpen(false); fetchBuses(); }
      } else {
        const supabase = await getCloudClient();
        const { error } = await supabase.from('buses').insert(payload);
        if (error) toast.error(error.message || 'Failed to add bus');
        else { toast.success('Bus added successfully'); setDialogOpen(false); fetchBuses(); }
      }
    }
    setSubmitting(false);
  }

  async function handleDeleteBus(bus: Bus) {
    setDeletingBus(bus);
    if (USE_PYTHON_API) {
      setHasRelatedTrips(false);
    } else {
      const supabase = await getCloudClient();
      const { count: activeTrips, error: activeError } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('bus_id', bus.id)
        .neq('status', 'completed');
      if (activeError) { toast.error('Failed to check bus dependencies'); return; }
      setHasRelatedTrips((activeTrips || 0) > 0);
    }
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteBus() {
    if (!deletingBus) return;
    setDeleting(true);
    
    if (USE_PYTHON_API) {
      const { error } = await apiClient.delete(`/buses/${deletingBus.id}`);
      if (error) toast.error('Failed to delete bus');
      else { toast.success('Bus deleted successfully'); fetchBuses(); }
    } else {
      const supabase = await getCloudClient();
      const busName = deletingBus.bus_name || deletingBus.registration_number;
      await supabase.from('trips').update({ bus_name_snapshot: `${busName} (${deletingBus.registration_number})` }).eq('bus_id', deletingBus.id);
      const { error } = await supabase.from('buses').delete().eq('id', deletingBus.id);
      if (error) toast.error('Failed to delete bus');
      else { toast.success('Bus deleted successfully'); fetchBuses(); }
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

  const getOwnershipBadge = (ownership: OwnershipType) => {
    if (ownership === 'partnership') {
      return <Badge variant="outline" className="border-purple-500 text-purple-700"><Users className="h-3 w-3 mr-1" />Partnership</Badge>;
    }
    return <Badge variant="outline" className="border-blue-500 text-blue-700"><Building2 className="h-3 w-3 mr-1" />Owned</Badge>;
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBus ? 'Edit Bus' : 'Add New Bus'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="ownership">Ownership</TabsTrigger>
                    <TabsTrigger value="tax">Tax & Docs</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 pt-4">
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
                  </TabsContent>

                  <TabsContent value="ownership" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="ownership_type">Ownership Type</Label>
                      <Select
                        value={formData.ownership_type}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          ownership_type: value as OwnershipType,
                          company_profit_share: value === 'owned' ? 100 : formData.company_profit_share,
                          partner_profit_share: value === 'owned' ? 0 : formData.partner_profit_share,
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owned">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Owned (100% Company)
                            </div>
                          </SelectItem>
                          <SelectItem value="partnership">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Partnership (Profit Split)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.ownership_type === 'partnership' && (
                      <div className="space-y-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="partner_name">Partner Name *</Label>
                          <Input
                            id="partner_name"
                            value={formData.partner_name}
                            onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                            placeholder="Partner Company Name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="company_profit_share">Company Share (%)</Label>
                            <Input
                              id="company_profit_share"
                              type="number"
                              min={0}
                              max={100}
                              value={formData.company_profit_share}
                              onChange={(e) => handleProfitShareChange('company_profit_share', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="partner_profit_share">Partner Share (%)</Label>
                            <Input
                              id="partner_profit_share"
                              type="number"
                              min={0}
                              max={100}
                              value={formData.partner_profit_share}
                              onChange={(e) => handleProfitShareChange('partner_profit_share', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Total: {formData.company_profit_share + formData.partner_profit_share}% 
                          {formData.company_profit_share + formData.partner_profit_share !== 100 && (
                            <span className="text-destructive ml-2">(Must equal 100%)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="tax" className="space-y-4 pt-4">
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

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Home State Tax Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="home_state_id">Home State</Label>
                          <Select
                            value={formData.home_state_id}
                            onValueChange={(value) => setFormData({ ...formData, home_state_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state.id} value={state.id}>
                                  {state.state_name} ({state.state_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="monthly_tax_amount">Monthly Tax Amount (₹)</Label>
                          <Input
                            id="monthly_tax_amount"
                            type="number"
                            value={formData.monthly_tax_amount}
                            onChange={(e) => setFormData({ ...formData, monthly_tax_amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tax_due_day">Tax Due Day (1-28)</Label>
                          <Input
                            id="tax_due_day"
                            type="number"
                            min={1}
                            max={28}
                            value={formData.tax_due_day}
                            onChange={(e) => setFormData({ ...formData, tax_due_day: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_tax_paid_date">Last Tax Paid Date</Label>
                          <Input
                            id="last_tax_paid_date"
                            type="date"
                            value={formData.last_tax_paid_date}
                            onChange={(e) => setFormData({ ...formData, last_tax_paid_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t">
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
            {
              key: 'ownership',
              label: 'Ownership',
              value: filters.ownership || 'all',
              onChange: (value) => setFilter('ownership', value),
              options: [
                { label: 'All Ownership', value: 'all' },
                { label: 'Owned', value: 'owned' },
                { label: 'Partnership', value: 'partnership' },
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
                  <TableHead>Ownership</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Home State</TableHead>
                  <TableHead>Tax Due</TableHead>
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
                      <TableCell>{getOwnershipBadge(bus.ownership_type)}</TableCell>
                      <TableCell>{getStatusBadge(bus.status)}</TableCell>
                      <TableCell>{bus.home_state?.state_code || '-'}</TableCell>
                      <TableCell>
                        {bus.next_tax_due_date ? (
                          <span className="text-sm">{bus.next_tax_due_date}</span>
                        ) : '-'}
                      </TableCell>
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
