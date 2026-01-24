import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Plus, Wrench, FileText, Upload, Camera, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ChangePasswordCard from '@/components/ChangePasswordCard';

interface RepairRecord {
  id: string;
  repair_number: string;
  bus_registration: string;
  repair_date: string;
  repair_type: string;
  description: string;
  parts_changed: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  photo_before_url: string | null;
  photo_after_url: string | null;
  warranty_days: number;
  notes: string | null;
  status: string;
  created_at: string;
}

interface RepairOrganization {
  id: string;
  org_code: string;
  org_name: string;
}

interface Bus {
  id: string;
  registration_number: string;
  bus_name: string | null;
}

const defaultFormData = {
  bus_registration: '',
  bus_id: '',
  repair_date: new Date().toISOString().split('T')[0],
  repair_type: 'repair' as 'resole' | 'new' | 'repair',
  description: '',
  parts_changed: '',
  labor_cost: '',
  parts_cost: '',
  warranty_days: '0',
  notes: '',
};

interface ProfileWithRepairOrg {
  id: string;
  user_id: string;
  repair_org_id: string | null;
}

export default function RepairDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [organization, setOrganization] = useState<RepairOrganization | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileWithRepairOrg | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, repair_org_id')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
      fetchData(data.repair_org_id);
    } else {
      setLoading(false);
    }
  }

  async function fetchData(repairOrgId: string | null) {
    if (!repairOrgId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch organization details
      const { data: orgData } = await supabase
        .from('repair_organizations')
        // @ts-ignore - table exists after migration
        .select('id, org_code, org_name')
        .eq('id', repairOrgId)
        .single();

      if (orgData) {
        setOrganization(orgData);
      }

      // Fetch repair records for this organization
      const { data: recordsData } = await supabase
        // @ts-ignore - table exists after migration
        .from('repair_records')
        .select('*')
        .eq('organization_id', repairOrgId)
        .order('created_at', { ascending: false });

      if (recordsData) {
        setRecords(recordsData);
      }

      // Fetch buses for selection
      const { data: busesData } = await supabase
        .from('buses')
        .select('id, registration_number, bus_name')
        .eq('status', 'active')
        .order('registration_number');

      if (busesData) {
        setBuses(busesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }

    setLoading(false);
  }

  function generateRepairNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RPR${dateStr}${random}`;
  }

  function handleBusSelect(busId: string) {
    const bus = buses.find((b) => b.id === busId);
    if (bus) {
      setFormData((prev) => ({
        ...prev,
        bus_id: busId,
        bus_registration: bus.registration_number,
      }));
    }
  }

  function handlePhotoChange(type: 'before' | 'after', file: File | null) {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'before') {
          setBeforePhoto(file);
          setBeforePreview(reader.result as string);
        } else {
          setAfterPhoto(file);
          setAfterPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadPhoto(file: File, prefix: string): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile?.user_id}/${prefix}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('repair-photos')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('repair-photos').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organization || !profile) return;

    if (!formData.bus_registration || !formData.description) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);

    try {
      let photoBeforeUrl: string | null = null;
      let photoAfterUrl: string | null = null;

      // Upload photos if provided
      if (beforePhoto) {
        photoBeforeUrl = await uploadPhoto(beforePhoto, 'before');
      }
      if (afterPhoto) {
        photoAfterUrl = await uploadPhoto(afterPhoto, 'after');
      }

      const repairNumber = generateRepairNumber();

      const { error } = await supabase.from('repair_records').insert({
        repair_number: repairNumber,
        organization_id: organization.id,
        bus_id: formData.bus_id || null,
        bus_registration: formData.bus_registration,
        repair_date: formData.repair_date,
        repair_type: formData.repair_type,
        description: formData.description,
        parts_changed: formData.parts_changed || null,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        parts_cost: parseFloat(formData.parts_cost) || 0,
        warranty_days: parseInt(formData.warranty_days) || 0,
        notes: formData.notes || null,
        photo_before_url: photoBeforeUrl,
        photo_after_url: photoAfterUrl,
        submitted_by: profile.id,
      });

      if (error) throw error;

      toast.success('Repair record submitted successfully');
      setDialogOpen(false);
      setFormData(defaultFormData);
      setBeforePhoto(null);
      setAfterPhoto(null);
      setBeforePreview(null);
      setAfterPreview(null);
      fetchData(profile?.repair_org_id || null);
    } catch (error: unknown) {
      console.error('Error submitting repair:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit repair record';
      toast.error(errorMessage);
    }

    setSubmitting(false);
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      submitted: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      completed: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
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

  if (!organization) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-8 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Not Linked to Organization</h2>
            <p className="text-muted-foreground">
              Your account is not linked to any repair organization. Please contact the administrator.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Repair Portal
            </h1>
            <p className="text-muted-foreground">
              {organization.org_name} ({organization.org_code})
            </p>
          </div>
        </div>

        <Tabs defaultValue="records" className="space-y-4">
          <TabsList>
            <TabsTrigger value="records">Repair Records</TabsTrigger>
            <TabsTrigger value="profile">Profile & Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Repair Record
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit New Repair Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bus">Bus *</Label>
                    <Select value={formData.bus_id} onValueChange={handleBusSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bus" />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((bus) => (
                          <SelectItem key={bus.id} value={bus.id}>
                            {bus.registration_number} {bus.bus_name && `- ${bus.bus_name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repair_date">Repair Date *</Label>
                    <Input
                      id="repair_date"
                      type="date"
                      value={formData.repair_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, repair_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="repair_type">Repair Type *</Label>
                    <Select
                      value={formData.repair_type}
                      onValueChange={(value: 'resole' | 'new' | 'repair') =>
                        setFormData((prev) => ({ ...prev, repair_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="resole">Resole</SelectItem>
                        <SelectItem value="new">New Part</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warranty_days">Warranty (Days)</Label>
                    <Input
                      id="warranty_days"
                      type="number"
                      min="0"
                      value={formData.warranty_days}
                      onChange={(e) => setFormData((prev) => ({ ...prev, warranty_days: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the repair work done..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parts_changed">Parts Changed</Label>
                  <Textarea
                    id="parts_changed"
                    value={formData.parts_changed}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parts_changed: e.target.value }))}
                    placeholder="List parts that were replaced or repaired..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="labor_cost">Labor Cost (₹)</Label>
                    <Input
                      id="labor_cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.labor_cost}
                      onChange={(e) => setFormData((prev) => ({ ...prev, labor_cost: e.target.value }))}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parts_cost">Parts Cost (₹)</Label>
                    <Input
                      id="parts_cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.parts_cost}
                      onChange={(e) => setFormData((prev) => ({ ...prev, parts_cost: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Photo Uploads */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Photo Before Repair</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {beforePreview ? (
                        <div className="relative">
                          <img
                            src={beforePreview}
                            alt="Before"
                            className="max-h-32 mx-auto rounded"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0"
                            onClick={() => {
                              setBeforePhoto(null);
                              setBeforePreview(null);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoChange('before', e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Photo After Repair</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {afterPreview ? (
                        <div className="relative">
                          <img
                            src={afterPreview}
                            alt="After"
                            className="max-h-32 mx-auto rounded"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0"
                            onClick={() => {
                              setAfterPhoto(null);
                              setAfterPreview(null);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoChange('after', e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional information..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Record
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{records.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">
                {records.filter((r) => r.status === 'submitted').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {records.filter((r) => r.status === 'approved').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{records.reduce((sum, r) => sum + (r.total_cost || 0), 0).toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Repair Records
            </CardTitle>
            <CardDescription>View all your submitted repair records</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No repair records yet. Click "New Repair Record" to submit one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repair #</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.repair_number}</TableCell>
                      <TableCell>{record.bus_registration}</TableCell>
                      <TableCell>{format(new Date(record.repair_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="capitalize">{record.repair_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.description}</TableCell>
                      <TableCell className="text-right">₹{record.total_cost?.toLocaleString('en-IN')}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="profile" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Organization Name</Label>
                <p className="font-medium">{organization.org_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Organization Code</Label>
                <p className="font-medium">{organization.org_code}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        <ChangePasswordCard />
      </TabsContent>
    </Tabs>
      </div>
    </DashboardLayout>
  );
}
