import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trip, TripStatus } from '@/types/database';
import { Loader2, Gauge, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function DriverTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [odometerData, setOdometerData] = useState({
    start: '',
    end: '',
    return_start: '',
    return_end: '',
  });

  useEffect(() => { if (user) fetchTrips(); }, [user]);

  async function fetchTrips() {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single();
    if (!profile) return;

    const { data } = await supabase
      .from('trips')
      .select(`*, bus:buses(registration_number), route:routes(route_name)`)
      .eq('driver_id', profile.id)
      .order('start_date', { ascending: false });
    
    setTrips((data || []) as Trip[]);
    setLoading(false);
  }

  function handleUpdateOdometer(trip: Trip) {
    setSelectedTrip(trip);
    setOdometerData({
      start: trip.odometer_start?.toString() || '',
      end: trip.odometer_end?.toString() || '',
      return_start: trip.odometer_return_start?.toString() || '',
      return_end: trip.odometer_return_end?.toString() || '',
    });
    setDialogOpen(true);
  }

  async function handleSubmitOdometer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrip) return;

    const start = parseFloat(odometerData.start);
    const end = odometerData.end ? parseFloat(odometerData.end) : null;

    if (isNaN(start)) {
      toast.error('Please enter a valid odometer start reading');
      return;
    }

    if (end !== null && end < start) {
      toast.error('End reading cannot be less than start reading');
      return;
    }

    // Build update data - do NOT include distance columns as they are computed/generated
    const updateData: Record<string, number | null> = {
      odometer_start: start,
      odometer_end: end,
    };

    // Handle two-way trip return journey
    if (selectedTrip.trip_type === 'two_way') {
      const returnStart = odometerData.return_start ? parseFloat(odometerData.return_start) : null;
      const returnEnd = odometerData.return_end ? parseFloat(odometerData.return_end) : null;

      if (returnStart !== null && returnEnd !== null && returnEnd < returnStart) {
        toast.error('Return end reading cannot be less than return start reading');
        return;
      }

      updateData.odometer_return_start = returnStart;
      updateData.odometer_return_end = returnEnd;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', selectedTrip.id);

    if (error) {
      toast.error('Failed to update odometer readings');
    } else {
      toast.success('Odometer readings updated');
      setDialogOpen(false);
      fetchTrips();
    }
    setSubmitting(false);
  }

  const getStatusBadge = (status: TripStatus) => {
    const v: Record<TripStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = { 
      scheduled: 'outline', 
      in_progress: 'default', 
      completed: 'secondary', 
      cancelled: 'destructive' 
    };
    return <Badge variant={v[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const canEditOdometer = (status: TripStatus) => {
    return status === 'in_progress' || status === 'scheduled';
  };

  const calculateDistance = (start: string, end: string) => {
    const s = parseFloat(start);
    const e = parseFloat(end);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      return e - s;
    }
    return null;
  };

  const isTwoWay = selectedTrip?.trip_type === 'two_way';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No trips assigned
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((t) => {
                    const outwardDistance = Number(t.distance_traveled) || 0;
                    const returnDistance = Number(t.distance_return) || 0;
                    const totalDistance = outwardDistance + returnDistance;
                    
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.trip_number}</TableCell>
                        <TableCell>
                          <Badge variant={t.trip_type === 'two_way' ? 'default' : 'outline'}>
                            {t.trip_type === 'two_way' ? 'Two-Way' : 'One-Way'}
                          </Badge>
                        </TableCell>
                        <TableCell>{(t.bus as any)?.registration_number}</TableCell>
                        <TableCell>{(t.route as any)?.route_name}</TableCell>
                        <TableCell>{new Date(t.start_date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>{getStatusBadge(t.status)}</TableCell>
                        <TableCell>
                          {t.odometer_start ? (
                            <div className="text-sm">
                              <div>{t.odometer_start} → {t.odometer_end || '...'}</div>
                              {t.trip_type === 'two_way' && (
                                <div className="text-muted-foreground">
                                  ↩ {t.odometer_return_start || '...'} → {t.odometer_return_end || '...'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {totalDistance > 0 ? (
                            <span className="font-medium">{totalDistance} km</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEditOdometer(t.status) && (
                            <Button size="sm" variant="outline" onClick={() => handleUpdateOdometer(t)}>
                              <Gauge className="h-4 w-4 mr-1" />
                              Odometer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Odometer Readings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitOdometer} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Trip: {selectedTrip?.trip_number}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedTrip?.route as any)?.route_name}
                {isTwoWay && ' (Two-Way)'}
              </p>
            </div>

            {isTwoWay ? (
              <Tabs defaultValue="outward" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="outward" className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Outward
                  </TabsTrigger>
                  <TabsTrigger value="return" className="flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Return
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="outward" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="odometer_start">Start (km)</Label>
                      <Input
                        id="odometer_start"
                        type="number"
                        value={odometerData.start}
                        onChange={(e) => setOdometerData({ ...odometerData, start: e.target.value })}
                        placeholder="e.g., 45000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="odometer_end">End (km)</Label>
                      <Input
                        id="odometer_end"
                        type="number"
                        value={odometerData.end}
                        onChange={(e) => setOdometerData({ ...odometerData, end: e.target.value })}
                        placeholder="e.g., 45350"
                      />
                    </div>
                  </div>
                  {calculateDistance(odometerData.start, odometerData.end) !== null && (
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <p className="text-sm font-medium text-green-700">
                        Outward Distance: {calculateDistance(odometerData.start, odometerData.end)} km
                      </p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="return" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="return_start">Start (km)</Label>
                      <Input
                        id="return_start"
                        type="number"
                        value={odometerData.return_start}
                        onChange={(e) => setOdometerData({ ...odometerData, return_start: e.target.value })}
                        placeholder="e.g., 45350"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_end">End (km)</Label>
                      <Input
                        id="return_end"
                        type="number"
                        value={odometerData.return_end}
                        onChange={(e) => setOdometerData({ ...odometerData, return_end: e.target.value })}
                        placeholder="e.g., 45700"
                      />
                    </div>
                  </div>
                  {calculateDistance(odometerData.return_start, odometerData.return_end) !== null && (
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">
                        Return Distance: {calculateDistance(odometerData.return_start, odometerData.return_end)} km
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="odometer_start">Start Reading (km)</Label>
                    <Input
                      id="odometer_start"
                      type="number"
                      value={odometerData.start}
                      onChange={(e) => setOdometerData({ ...odometerData, start: e.target.value })}
                      placeholder="e.g., 45000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="odometer_end">End Reading (km)</Label>
                    <Input
                      id="odometer_end"
                      type="number"
                      value={odometerData.end}
                      onChange={(e) => setOdometerData({ ...odometerData, end: e.target.value })}
                      placeholder="e.g., 45350"
                    />
                  </div>
                </div>
                {calculateDistance(odometerData.start, odometerData.end) !== null && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium">
                      Distance: {calculateDistance(odometerData.start, odometerData.end)} km
                    </p>
                  </div>
                )}
              </>
            )}

            {isTwoWay && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Total Distance: {
                    (calculateDistance(odometerData.start, odometerData.end) || 0) +
                    (calculateDistance(odometerData.return_start, odometerData.return_end) || 0)
                  } km
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Readings
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}