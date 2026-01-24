import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Building2, Edit, Trash2, Key, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface RepairOrganization {
  id: string;
  org_code: string;
  org_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

const defaultFormData = {
  org_code: '',
  org_name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  is_active: true,
};

const defaultUserFormData = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
};

export default function RepairOrganizations() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<RepairOrganization[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; org: RepairOrganization | null }>({
    open: false,
    org: null,
  });
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<RepairOrganization | null>(null);
  const [userFormData, setUserFormData] = useState(defaultUserFormData);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    const { data, error } = await supabase
      // @ts-ignore - table exists after migration
      .from('repair_organizations')
      .select('*')
      .order('org_name');

    if (error) {
      toast.error('Failed to load organizations');
      console.error(error);
    } else {
      setOrganizations(data || []);
    }
    setLoading(false);
  }

  function generateOrgCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RO';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function handleAddNew() {
    setEditingId(null);
    setFormData({ ...defaultFormData, org_code: generateOrgCode() });
    setDialogOpen(true);
  }

  function handleEdit(org: RepairOrganization) {
    setEditingId(org.id);
    setFormData({
      org_code: org.org_code,
      org_name: org.org_name,
      contact_person: org.contact_person || '',
      phone: org.phone || '',
      email: org.email || '',
      address: org.address || '',
      is_active: org.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.org_code || !formData.org_name) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        org_code: formData.org_code.toUpperCase(),
        org_name: formData.org_name,
        contact_person: formData.contact_person || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        is_active: formData.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          // @ts-ignore - table exists after migration
          .from('repair_organizations')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Organization updated successfully');
      } else {
        const { error } = await supabase
          // @ts-ignore - table exists after migration
          .from('repair_organizations').insert(payload);
        if (error) throw error;
        toast.success('Organization created successfully');
      }

      setDialogOpen(false);
      setFormData(defaultFormData);
      setEditingId(null);
      fetchOrganizations();
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save organization';
      toast.error(errorMessage);
    }

    setSubmitting(false);
  }

  async function handleDelete() {
    if (!deleteDialog.org) return;

    try {
      const { error } = await supabase
        // @ts-ignore - table exists after migration
        .from('repair_organizations')
        .delete()
        .eq('id', deleteDialog.org.id);

      if (error) throw error;
      toast.success('Organization deleted successfully');
      fetchOrganizations();
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete organization';
      toast.error(errorMessage);
    }

    setDeleteDialog({ open: false, org: null });
  }

  function handleCreateUser(org: RepairOrganization) {
    setSelectedOrg(org);
    setUserFormData(defaultUserFormData);
    setUserDialogOpen(true);
  }

  async function handleSubmitUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg || !userFormData.email || !userFormData.password || !userFormData.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-repair-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: userFormData.email,
            password: userFormData.password,
            full_name: userFormData.full_name,
            phone: userFormData.phone || undefined,
            organization_id: selectedOrg.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast.success(`User created for ${selectedOrg.org_name}`);
      setUserDialogOpen(false);
      setUserFormData(defaultUserFormData);
      setSelectedOrg(null);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(errorMessage);
    }

    setCreatingUser(false);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Repair Organizations
            </h1>
            <p className="text-muted-foreground">
              Manage repair service providers and their access codes
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Organization' : 'Add New Organization'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="org_code">Organization Code *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="org_code"
                        value={formData.org_code}
                        onChange={(e) => setFormData((prev) => ({ ...prev, org_code: e.target.value.toUpperCase() }))}
                        placeholder="RO1234"
                        maxLength={10}
                        required
                      />
                      {!editingId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setFormData((prev) => ({ ...prev, org_code: generateOrgCode() }))}
                          title="Generate new code"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Unique identifier for this organization</p>
                  </div>

                  <div className="space-y-2 flex items-center gap-2 pt-6">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org_name">Organization Name *</Label>
                  <Input
                    id="org_name"
                    value={formData.org_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, org_name: e.target.value }))}
                    placeholder="ABC Auto Repairs"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="contact@repairs.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Industrial Area, City"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingId ? 'Update' : 'Create'} Organization
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>List of repair service providers with their access codes</CardDescription>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No organizations yet. Click "Add Organization" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Organization Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-mono font-bold">{org.org_code}</TableCell>
                      <TableCell>{org.org_name}</TableCell>
                      <TableCell>{org.contact_person || '-'}</TableCell>
                      <TableCell>{org.phone || '-'}</TableCell>
                      <TableCell>{org.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={org.is_active ? 'default' : 'secondary'}>
                          {org.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCreateUser(org)}
                            title="Create login user"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(org)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, org })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, org: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.org?.org_name}"? This action cannot be undone and
              will also delete all associated repair records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Login User for {selectedOrg?.org_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user_email">Email *</Label>
              <Input
                id="user_email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@repair-org.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_password">Password *</Label>
              <Input
                id="user_password"
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_full_name">Full Name *</Label>
              <Input
                id="user_full_name"
                value={userFormData.full_name}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_phone">Phone</Label>
              <Input
                id="user_phone"
                value={userFormData.phone}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
