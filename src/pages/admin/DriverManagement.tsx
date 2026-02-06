import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
import apiClient from '@/lib/api-client';
import { getCloudClient, USE_PYTHON_API } from '@/lib/backend';
import { Profile, AppRole } from '@/types/database';
import { UserPlus, Loader2, Pencil, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, formatDate } from '@/lib/exportUtils';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

interface DriverWithRole extends Profile {
  role?: AppRole;
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState<DriverWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverWithRole | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('driver');
  const [submitting, setSubmitting] = useState(false);
  const [dialogTab, setDialogTab] = useState<'create' | 'assign'>('create');

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState<DriverWithRole | null>(null);
  const [hasRelatedData, setHasRelatedData] = useState(false);
  const [relatedDataInfo, setRelatedDataInfo] = useState({ trips: 0, expenses: 0 });
  const [deleting, setDeleting] = useState(false);

  // New driver form
  const [newDriver, setNewDriver] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    address: '',
  });

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
    data: drivers,
    searchFields: ['full_name', 'phone', 'license_number'],
  });

  // Apply role filter
  const filteredDrivers = paginatedData.filter((driver) => {
    if (filters.role && filters.role !== 'all') {
      if (filters.role === 'no_role') {
        return !driver.role;
      }
      return driver.role === filters.role;
    }
    return true;
  });

  useEffect(() => {
    fetchDrivers();
    fetchProfiles();
  }, []);

  async function fetchDrivers() {
    if (USE_PYTHON_API) {
      // In Python mode, get all profiles and roles
      const [profilesRes, rolesRes] = await Promise.all([
        apiClient.get<any[]>('/drivers'),
        apiClient.get<any[]>('/drivers/roles'),
      ]);
      
      const profilesData = profilesRes.data || [];
      const roles = rolesRes.data || [];
      
      const driversWithRoles = profilesData.map((profile: any) => {
        const userRole = roles.find((r: any) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role as AppRole | undefined,
        };
      });

      setDrivers(driversWithRoles);
      setLoading(false);
    } else {
      const supabase = await getCloudClient();
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        toast.error('Failed to fetch roles');
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        toast.error('Failed to fetch profiles');
        return;
      }

      const driversWithRoles = profilesData.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role as AppRole | undefined,
        };
      });

      setDrivers(driversWithRoles);
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    if (USE_PYTHON_API) {
      const { data } = await apiClient.get<any[]>('/drivers');
      if (data) setProfiles(data);
    } else {
      const supabase = await getCloudClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (data) {
        setProfiles(data);
      }
    }
  }

  async function handleCreateDriver(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newDriver.email || !newDriver.password || !newDriver.full_name) {
      toast.error('Email, password, and full name are required');
      return;
    }

    if (newDriver.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      if (USE_PYTHON_API) {
        // Python API mode - call the create-driver endpoint directly
        const { data, error } = await apiClient.post('/drivers/create', newDriver);
        
        if (error) {
          toast.error(error.message || 'Failed to create driver');
        } else if ((data as any)?.error) {
          toast.error((data as any).error);
        } else {
          toast.success('Driver created successfully');
          setDialogOpen(false);
          setNewDriver({
            email: '',
            password: '',
            full_name: '',
            phone: '',
            license_number: '',
            license_expiry: '',
            address: '',
          });
          fetchDrivers();
          fetchProfiles();
        }
      } else {
        const supabase = await getCloudClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await supabase.functions.invoke('create-driver', {
          body: newDriver,
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (response.error) {
          toast.error(response.error.message || 'Failed to create driver');
        } else if (response.data?.error) {
          toast.error(response.data.error);
        } else {
          toast.success('Driver created successfully');
          setDialogOpen(false);
          setNewDriver({
            email: '',
            password: '',
            full_name: '',
            phone: '',
            license_number: '',
            license_expiry: '',
            address: '',
          });
          fetchDrivers();
          fetchProfiles();
        }
      }
    } catch (error) {
      console.error('Error creating driver:', error);
      toast.error('Failed to create driver');
    }

    setSubmitting(false);
  }

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;

    setSubmitting(true);

    const profile = profiles.find(p => p.id === selectedProfile);
    if (!profile) {
      toast.error('Profile not found');
      setSubmitting(false);
      return;
    }

    if (USE_PYTHON_API) {
      const { error } = await apiClient.post('/drivers/assign-role', {
        user_id: profile.user_id,
        role: selectedRole,
      });

      if (error) {
        toast.error('Failed to assign role');
      } else {
        toast.success('Role assigned successfully');
        setDialogOpen(false);
        fetchDrivers();
      }
    } else {
      const supabase = await getCloudClient();
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', profile.user_id);

        if (error) {
          toast.error('Failed to update role');
        } else {
          toast.success('Role updated successfully');
          setDialogOpen(false);
          fetchDrivers();
        }
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: profile.user_id, role: selectedRole });

        if (error) {
          toast.error('Failed to assign role');
        } else {
          toast.success('Role assigned successfully');
          setDialogOpen(false);
          fetchDrivers();
        }
      }
    }

    setSubmitting(false);
  }

  function handleEditDriver(driver: DriverWithRole) {
    setEditingDriver(driver);
    setEditDialogOpen(true);
  }

  async function handleUpdateDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDriver) return;

    setSubmitting(true);

    const updateData = {
      full_name: editingDriver.full_name,
      phone: editingDriver.phone || null,
      license_number: editingDriver.license_number || null,
      license_expiry: editingDriver.license_expiry || null,
      address: editingDriver.address || null,
    };

    if (USE_PYTHON_API) {
      const { error } = await apiClient.put(`/drivers/${editingDriver.id}`, updateData);
      if (error) {
        toast.error('Failed to update driver');
      } else {
        toast.success('Driver updated successfully');
        setEditDialogOpen(false);
        fetchDrivers();
      }
    } else {
      const supabase = await getCloudClient();
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editingDriver.id);

      if (error) {
        toast.error('Failed to update driver');
      } else {
        toast.success('Driver updated successfully');
        setEditDialogOpen(false);
        fetchDrivers();
      }
    }

    setSubmitting(false);
  }

  async function handleDeleteDriver(driver: DriverWithRole) {
    setDeletingDriver(driver);
    
    let activeTrips = 0;
    let pendingExpenses = 0;

    if (USE_PYTHON_API) {
      // In Python mode, we'll check via API
      const { data: trips } = await apiClient.get<any[]>('/trips', { driver_id: driver.id, limit: 1000 });
      activeTrips = (trips || []).filter(t => t.status !== 'completed').length;
      
      const { data: expenses } = await apiClient.get<any[]>('/expenses', { submitted_by: driver.id, status: 'pending', limit: 1000 });
      pendingExpenses = (expenses || []).length;
    } else {
      const supabase = await getCloudClient();
      // Check if driver has active (non-completed) trips
      const { count: activeCount, error: activeError } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driver.id)
        .neq('status', 'completed');

      if (activeError) {
        toast.error('Failed to check driver dependencies');
        return;
      }

      // Check if driver has pending expenses
      const { count: expenseCount, error: expensesError } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', driver.id)
        .eq('status', 'pending');

      if (expensesError) {
        toast.error('Failed to check driver dependencies');
        return;
      }

      activeTrips = activeCount || 0;
      pendingExpenses = expenseCount || 0;
    }

    setRelatedDataInfo({ trips: activeTrips, expenses: pendingExpenses });
    setHasRelatedData(activeTrips > 0 || pendingExpenses > 0);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteDriver() {
    if (!deletingDriver) return;

    setDeleting(true);

    if (USE_PYTHON_API) {
      // Delete via Python API
      const { error } = await apiClient.delete(`/drivers/${deletingDriver.id}`);
      if (error) {
        toast.error('Failed to delete driver');
      } else {
        toast.success('Driver deleted successfully');
        fetchDrivers();
        fetchProfiles();
      }
    } else {
      const supabase = await getCloudClient();
      
      // First, update all trips with this driver to store the driver name snapshot
      const { error: snapshotError } = await supabase
        .from('trips')
        .update({ driver_name_snapshot: deletingDriver.full_name })
        .eq('driver_id', deletingDriver.id);

      if (snapshotError) {
        toast.error('Failed to preserve trip history');
        setDeleting(false);
        return;
      }

      // Delete from user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deletingDriver.user_id);

      if (roleError) {
        toast.error('Failed to delete driver role');
        setDeleting(false);
        return;
      }

      // Then, delete from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deletingDriver.id);

      if (profileError) {
        toast.error('Failed to delete driver profile');
      } else {
        toast.success('Driver deleted successfully');
        fetchDrivers();
        fetchProfiles();
      }
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingDriver(null);
  }

  function handleExportDrivers() {
    if (drivers.length === 0) return;

    exportToExcel(
      drivers,
      [
        { header: 'Name', key: 'full_name' },
        { header: 'Phone', key: 'phone', format: (v) => v || '-' },
        { header: 'License Number', key: 'license_number', format: (v) => v || '-' },
        { header: 'License Expiry', key: 'license_expiry', format: formatDate },
        { header: 'Address', key: 'address', format: (v) => v || '-' },
        { header: 'Role', key: 'role', format: (v) => v || 'No Role' },
        { header: 'Joined', key: 'created_at', format: formatDate },
      ],
      'drivers-report'
    );
  }

  const getRoleBadge = (role?: AppRole) => {
    if (!role) return <Badge variant="outline">No Role</Badge>;
    return (
      <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
        {role}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Driver Management</h1>
            <p className="text-muted-foreground">Create and manage drivers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportDrivers} disabled={drivers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Driver
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Driver</DialogTitle>
                </DialogHeader>
                <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'create' | 'assign')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="create">Create New</TabsTrigger>
                    <TabsTrigger value="assign">Assign Role</TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="space-y-4 mt-4">
                    <form onSubmit={handleCreateDriver} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newDriver.email}
                            onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                            placeholder="driver@example.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newDriver.password}
                            onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                            placeholder="Min 6 characters"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name *</Label>
                        <Input
                          id="full_name"
                          value={newDriver.full_name}
                          onChange={(e) => setNewDriver({ ...newDriver, full_name: e.target.value })}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={newDriver.phone}
                          onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          maxLength={15}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="license_number">License Number</Label>
                          <Input
                            id="license_number"
                            value={newDriver.license_number}
                            onChange={(e) => setNewDriver({ ...newDriver, license_number: e.target.value })}
                            placeholder="MH01 2020 0012345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="license_expiry">License Expiry</Label>
                          <Input
                            id="license_expiry"
                            type="date"
                            value={newDriver.license_expiry}
                            onChange={(e) => setNewDriver({ ...newDriver, license_expiry: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={newDriver.address}
                          onChange={(e) => setNewDriver({ ...newDriver, address: e.target.value })}
                          placeholder="Full address"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Create Driver
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="assign" className="space-y-4 mt-4">
                    <form onSubmit={handleAssignRole} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select User</Label>
                        <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a user" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="driver">Driver</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting || !selectedProfile}>
                          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Assign Role
                        </Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by name, phone, or license..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              key: 'role',
              label: 'Role',
              value: filters.role || 'all',
              onChange: (value) => setFilter('role', value),
              options: [
                { label: 'All Roles', value: 'all' },
                { label: 'Admin', value: 'admin' },
                { label: 'Driver', value: 'driver' },
                { label: 'No Role', value: 'no_role' },
              ],
            },
          ]}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>License Expiry</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {drivers.length === 0 ? 'No users registered yet' : 'No users match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.full_name}</TableCell>
                      <TableCell>{driver.phone || '-'}</TableCell>
                      <TableCell>{driver.license_number || '-'}</TableCell>
                      <TableCell>{driver.license_expiry || '-'}</TableCell>
                      <TableCell>{getRoleBadge(driver.role)}</TableCell>
                      <TableCell>
                        {new Date(driver.created_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditDriver(driver)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteDriver(driver)}>
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
              itemName="users"
            />
          </CardContent>
        </Card>

        {/* Edit Driver Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Driver</DialogTitle>
            </DialogHeader>
            {editingDriver && (
              <form onSubmit={handleUpdateDriver} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Full Name *</Label>
                  <Input
                    id="edit_full_name"
                    value={editingDriver.full_name}
                    onChange={(e) => setEditingDriver({ ...editingDriver, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input
                    id="edit_phone"
                    type="tel"
                    value={editingDriver.phone || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                    maxLength={15}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_license_number">License Number</Label>
                    <Input
                      id="edit_license_number"
                      value={editingDriver.license_number || ''}
                      onChange={(e) => setEditingDriver({ ...editingDriver, license_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_license_expiry">License Expiry</Label>
                    <Input
                      id="edit_license_expiry"
                      type="date"
                      value={editingDriver.license_expiry || ''}
                      onChange={(e) => setEditingDriver({ ...editingDriver, license_expiry: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_address">Address</Label>
                  <Textarea
                    id="edit_address"
                    value={editingDriver.address || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, address: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Driver
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {hasRelatedData ? 'Cannot Delete Driver' : 'Delete Driver'}
              </AlertDialogTitle>
              <AlertDialogDescription>
              {hasRelatedData ? (
                  <>
                    This driver <strong>"{deletingDriver?.full_name}"</strong> has active data 
                    and cannot be deleted:
                    <ul className="list-disc list-inside mt-2">
                      {relatedDataInfo.trips > 0 && <li>{relatedDataInfo.trips} active trip(s) (not completed)</li>}
                      {relatedDataInfo.expenses > 0 && <li>{relatedDataInfo.expenses} pending expense(s)</li>}
                    </ul>
                    <p className="mt-2">Please complete trips and approve/deny pending expenses first.</p>
                  </>
                ) : (
                  <>
                    Are you sure you want to delete driver <strong>"{deletingDriver?.full_name}"</strong>? 
                    Historical trip records and expenses will be preserved with the driver name.
                    This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {hasRelatedData ? (
                <AlertDialogAction onClick={() => setDeleteDialogOpen(false)}>
                  OK
                </AlertDialogAction>
              ) : (
                <>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDeleteDriver}
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
