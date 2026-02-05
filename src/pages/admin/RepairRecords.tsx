import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Wrench, Eye, Check, X, Image } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  gst_amount: number;
  gst_applicable: boolean;
  gst_percentage: number;
  photo_before_url: string | null;
  photo_after_url: string | null;
  warranty_days: number;
  notes: string | null;
  status: string;
  created_at: string;
  repair_organizations?: {
    org_code: string;
    org_name: string;
  };
  buses?: {
    bus_name: string | null;
  };
}

export default function RepairRecords() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RepairRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RepairRecord | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    if (!user) return;
    if (USE_PYTHON_API) {
      // In Python API mode, the user object already has profile_id
      setProfileId((user as any).profile_id || null);
    } else {
      const supabase = await getCloudClient();
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setProfileId(data.id);
      }
    }
    fetchRecords();
  }

  async function fetchRecords() {
    if (USE_PYTHON_API) {
      const { data, error } = await apiClient.get<any[]>('/repairs');
      if (error) {
        toast.error('Failed to load repair records');
        console.error(error);
      } else {
        setRecords(data || []);
      }
    } else {
      const supabase = await getCloudClient();
      const { data, error } = await supabase
        // @ts-ignore - table exists after migration
        .from('repair_records')
        .select(`
          *,
          repair_organizations (org_code, org_name),
          buses (bus_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load repair records');
        console.error(error);
      } else {
        setRecords(data || []);
      }
    }
    setLoading(false);
  }

  async function updateStatus(recordId: string, newStatus: string) {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'approved' && profileId) {
        updateData.approved_by = profileId;
        updateData.approved_at = new Date().toISOString();
      }

    let error: Error | null = null;
    
    if (USE_PYTHON_API) {
      const res = await apiClient.put(`/repairs/${recordId}`, updateData);
      error = res.error;
    } else {
      const supabase = await getCloudClient();
      const res = await supabase
        // @ts-ignore - table exists after migration
        .from('repair_records')
        .update(updateData)
        .eq('id', recordId);
      error = res.error ? new Error(res.error.message) : null;
    }

    if (error) throw error;

      toast.success(`Record ${newStatus} successfully`);
      fetchRecords();
      setViewDialogOpen(false);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      toast.error(errorMessage);
    }
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

  const filteredRecords = statusFilter === 'all' 
    ? records 
    : records.filter(r => r.status === statusFilter);

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
              <Wrench className="h-6 w-6" />
              Repair Records
            </h1>
            <p className="text-muted-foreground">
              Review and approve repair submissions from service providers
            </p>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{records.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.total_cost || 0), 0).toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Repair Records</CardTitle>
            <CardDescription>Click on a record to view details and approve/reject</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No repair records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repair #</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.repair_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.repair_organizations?.org_name}</p>
                          <p className="text-xs text-muted-foreground">{record.repair_organizations?.org_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{record.bus_registration}</p>
                          {record.buses?.bus_name && (
                            <p className="text-xs text-muted-foreground">{record.buses.bus_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(record.repair_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="capitalize">{record.repair_type}</TableCell>
                      <TableCell className="text-right">₹{record.total_cost?.toLocaleString('en-IN')}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedRecord(record);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View/Approve Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Repair Record Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Repair Number</p>
                  <p className="font-medium">{selectedRecord.repair_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedRecord.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{selectedRecord.repair_organizations?.org_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRecord.repair_organizations?.org_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bus</p>
                  <p className="font-medium">{selectedRecord.bus_registration}</p>
                  {selectedRecord.buses?.bus_name && (
                    <p className="text-xs text-muted-foreground">{selectedRecord.buses.bus_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repair Date</p>
                  <p className="font-medium">{format(new Date(selectedRecord.repair_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repair Type</p>
                  <p className="font-medium capitalize">{selectedRecord.repair_type}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{selectedRecord.description}</p>
              </div>

              {selectedRecord.parts_changed && (
                <div>
                  <p className="text-sm text-muted-foreground">Parts Changed</p>
                  <p className="font-medium">{selectedRecord.parts_changed}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Labor Cost</p>
                  <p className="font-medium">₹{selectedRecord.labor_cost?.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parts Cost</p>
                  <p className="font-medium">₹{selectedRecord.parts_cost?.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GST Amount</p>
                  {selectedRecord.gst_applicable ? (
                    <p className="font-medium text-blue-600">₹{(selectedRecord.gst_amount || 0).toLocaleString('en-IN')}</p>
                  ) : (
                    <Badge variant="outline" className="text-xs">N/A</Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="font-bold text-lg">₹{selectedRecord.total_cost?.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Warranty</p>
                <p className="font-medium">{selectedRecord.warranty_days} days</p>
              </div>

              {/* Photos */}
              {(selectedRecord.photo_before_url || selectedRecord.photo_after_url) && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Image className="h-4 w-4" /> Photos
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedRecord.photo_before_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Before Repair</p>
                        <img
                          src={selectedRecord.photo_before_url}
                          alt="Before repair"
                          className="rounded-lg border max-h-48 w-full object-cover"
                        />
                      </div>
                    )}
                    {selectedRecord.photo_after_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">After Repair</p>
                        <img
                          src={selectedRecord.photo_after_url}
                          alt="After repair"
                          className="rounded-lg border max-h-48 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRecord.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{selectedRecord.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedRecord.status === 'submitted' && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus(selectedRecord.id, 'rejected')}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => updateStatus(selectedRecord.id, 'approved')}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}

              {selectedRecord.status === 'approved' && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button onClick={() => updateStatus(selectedRecord.id, 'completed')}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
