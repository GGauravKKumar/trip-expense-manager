import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DriverWithRole extends Profile {
  role?: AppRole;
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState<DriverWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('driver');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDrivers();
    fetchProfiles();
  }, []);

  async function fetchDrivers() {
    // Get all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast.error('Failed to fetch roles');
      return;
    }

    // Get all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('Failed to fetch profiles');
      return;
    }

    // Combine profiles with roles
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

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (data) {
      setProfiles(data);
    }
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

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', profile.user_id)
      .maybeSingle();

    if (existingRole) {
      // Update existing role
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
      // Insert new role
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

    setSubmitting(false);
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
            <p className="text-muted-foreground">Manage drivers and assign roles</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
              </DialogHeader>
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
            </DialogContent>
          </Dialog>
        </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : drivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users registered yet
                    </TableCell>
                  </TableRow>
                ) : (
                  drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.full_name}</TableCell>
                      <TableCell>{driver.phone || '-'}</TableCell>
                      <TableCell>{driver.license_number || '-'}</TableCell>
                      <TableCell>{driver.license_expiry || '-'}</TableCell>
                      <TableCell>{getRoleBadge(driver.role)}</TableCell>
                      <TableCell>
                        {new Date(driver.created_at).toLocaleDateString('en-IN')}
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
