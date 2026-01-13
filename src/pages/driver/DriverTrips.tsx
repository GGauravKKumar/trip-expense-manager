import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trip, TripStatus } from '@/types/database';
import { Loader2, Gauge } from 'lucide-react';
import { toast } from 'sonner';

export default function DriverTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [odometerData, setOdometerData] = useState({ start: '', end: '' });

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

    setSubmitting(true);

    const { error } = await supabase
      .from('trips')
      .update({
        odometer_start: start,
        odometer_end: end,
      })
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
                  <TableHead>Bus</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Expense</TableHead>
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
                  trips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.trip_number}</TableCell>
                      <TableCell>{(t.bus as any)?.registration_number}</TableCell>
                      <TableCell>{(t.route as any)?.route_name}</TableCell>
                      <TableCell>{new Date(t.start_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{getStatusBadge(t.status)}</TableCell>
                      <TableCell>
                        {t.odometer_start ? (
                          <span className="text-sm">
                            {t.odometer_start} → {t.odometer_end || '...'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.distance_traveled ? (
                          <span className="font-medium">{t.distance_traveled} km</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>₹{Number(t.total_expense || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        {canEditOdometer(t.status) && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateOdometer(t)}>
                            <Gauge className="h-4 w-4 mr-1" />
                            Odometer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Odometer Readings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitOdometer} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Trip: {selectedTrip?.trip_number}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedTrip?.route as any)?.route_name}
              </p>
            </div>
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
            {odometerData.start && odometerData.end && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Distance: {parseFloat(odometerData.end) - parseFloat(odometerData.start)} km
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
