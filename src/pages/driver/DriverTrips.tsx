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
import { Trip, TripStatus, StockItem } from '@/types/database';
import { Loader2, Gauge, ArrowRight, ArrowLeft, Droplets, Play, CheckCircle, Link } from 'lucide-react';
import TripChainIndicator from '@/components/TripChainIndicator';
import { toast } from 'sonner';

export default function DriverTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waterStock, setWaterStock] = useState<(StockItem & { unit_price?: number }) | null>(null);
  const [waterCategoryId, setWaterCategoryId] = useState<string | null>(null);
  const [waterQuantity, setWaterQuantity] = useState('');
  const [odometerData, setOdometerData] = useState({
    start: '',
    end: '',
    return_start: '',
    return_end: '',
  });

  useEffect(() => { 
    if (user) {
      fetchTrips();
      fetchWaterStock();
      fetchWaterCategory();
    }
  }, [user]);

  async function fetchWaterCategory() {
    const { data } = await supabase
      .from('expense_categories')
      .select('id')
      .ilike('name', 'water')
      .limit(1)
      .single();
    
    if (data) {
      setWaterCategoryId(data.id);
    }
  }

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

  async function fetchWaterStock() {
    // Fetch water stock item (case-insensitive search for "water")
    const { data } = await supabase
      .from('stock_items')
      .select('*')
      .ilike('item_name', '%water%')
      .limit(1)
      .single();
    
    if (data) {
      setWaterStock(data as StockItem & { unit_price?: number });
    }
  }

  function handleUpdateOdometer(trip: Trip) {
    setSelectedTrip(trip);
    setOdometerData({
      start: trip.odometer_start?.toString() || '',
      end: trip.odometer_end?.toString() || '',
      return_start: trip.odometer_return_start?.toString() || '',
      return_end: trip.odometer_return_end?.toString() || '',
    });
    // Pre-fill with existing water taken
    setWaterQuantity(trip.water_taken?.toString() || '0');
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
      // Use odometer_end as default for return_start if not explicitly set
      const returnStart = odometerData.return_start 
        ? parseFloat(odometerData.return_start) 
        : (odometerData.end ? parseFloat(odometerData.end) : null);
      const returnEnd = odometerData.return_end ? parseFloat(odometerData.return_end) : null;

      if (returnStart !== null && returnEnd !== null && returnEnd < returnStart) {
        toast.error('Return end reading cannot be less than return start reading');
        return;
      }

      updateData.odometer_return_start = returnStart;
      updateData.odometer_return_end = returnEnd;
    }

    setSubmitting(true);

    // Handle water stock - only deduct the DIFFERENCE from previous amount
    const newWaterQty = parseInt(waterQuantity) || 0;
    const previousWaterQty = selectedTrip.water_taken || 0;
    const waterDifference = newWaterQty - previousWaterQty;

    if (waterStock && waterDifference > 0) {
      // Taking more water
      if (waterDifference > waterStock.quantity) {
        toast.error(`Not enough water in stock. Available: ${waterStock.quantity} ${waterStock.unit}`);
        setSubmitting(false);
        return;
      }

      // Get current user's profile for transaction record
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      // Create stock transaction for the difference
      const { error: txError } = await supabase.from('stock_transactions').insert({
        stock_item_id: waterStock.id,
        transaction_type: 'remove' as const,
        quantity_change: waterDifference,
        previous_quantity: waterStock.quantity,
        new_quantity: waterStock.quantity - waterDifference,
        notes: `Trip ${selectedTrip.trip_number} - Driver pickup${previousWaterQty > 0 ? ' (additional)' : ''}`,
        created_by: profile?.id,
      });

      if (txError) {
        toast.error('Failed to record water pickup');
        setSubmitting(false);
        return;
      }

      // Update stock quantity
      const { error: stockError } = await supabase
        .from('stock_items')
        .update({ 
          quantity: waterStock.quantity - waterDifference,
          last_updated_by: profile?.id,
        })
        .eq('id', waterStock.id);

      if (stockError) {
        toast.error('Failed to update water stock');
        setSubmitting(false);
        return;
      }

      // Create expense for water taken
      if (waterCategoryId && waterStock.unit_price && waterStock.unit_price > 0) {
        const waterCost = waterDifference * waterStock.unit_price;
        const { error: expenseError } = await supabase.from('expenses').insert({
          trip_id: selectedTrip.id,
          category_id: waterCategoryId,
          submitted_by: profile?.id,
          amount: waterCost,
          expense_date: new Date().toISOString().split('T')[0],
          description: `Water: ${waterDifference} ${waterStock.unit} @ ₹${waterStock.unit_price}/${waterStock.unit}`,
          status: 'approved', // Auto-approve water expenses from stock
        });

        if (expenseError) {
          console.error('Failed to create water expense:', expenseError);
          // Don't block the flow, just log the error
        }
      }
    } else if (waterStock && waterDifference < 0) {
      // Returning water (reduced quantity) - add back to stock
      const returnQty = Math.abs(waterDifference);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      const { error: txError } = await supabase.from('stock_transactions').insert({
        stock_item_id: waterStock.id,
        transaction_type: 'add' as const,
        quantity_change: returnQty,
        previous_quantity: waterStock.quantity,
        new_quantity: waterStock.quantity + returnQty,
        notes: `Trip ${selectedTrip.trip_number} - Driver returned water`,
        created_by: profile?.id,
      });

      if (txError) {
        toast.error('Failed to record water return');
        setSubmitting(false);
        return;
      }

      const { error: stockError } = await supabase
        .from('stock_items')
        .update({ 
          quantity: waterStock.quantity + returnQty,
          last_updated_by: profile?.id,
        })
        .eq('id', waterStock.id);

      if (stockError) {
        toast.error('Failed to update water stock');
        setSubmitting(false);
        return;
      }
    }

    // Update trip with odometer and water_taken
    const tripUpdateData: Record<string, number | null> = {
      ...updateData,
      water_taken: newWaterQty,
    };

    const { error } = await supabase
      .from('trips')
      .update(tripUpdateData)
      .eq('id', selectedTrip.id);

    if (error) {
      toast.error('Failed to update odometer readings');
    } else {
      const waterMsg = waterDifference !== 0 
        ? ` | Water: ${waterDifference > 0 ? '+' : ''}${waterDifference}` 
        : '';
      toast.success(`Odometer readings updated${waterMsg}`);
      setDialogOpen(false);
      fetchTrips();
      fetchWaterStock(); // Refresh stock
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

  const canStartTrip = (trip: Trip) => {
    return trip.status === 'scheduled';
  };

  const canCompleteTrip = (trip: Trip) => {
    if (trip.status !== 'in_progress') return false;
    
    // Check if odometer readings are complete
    const hasOutwardReadings = trip.odometer_start && trip.odometer_end;
    if (!hasOutwardReadings) return false;
    
    // For two-way trips, also check return readings
    if (trip.trip_type === 'two_way') {
      return trip.odometer_return_start && trip.odometer_return_end;
    }
    
    return true;
  };

  async function handleStartTrip(trip: Trip) {
    const { error } = await supabase
      .from('trips')
      .update({ status: 'in_progress' })
      .eq('id', trip.id);

    if (error) {
      toast.error('Failed to start trip');
    } else {
      toast.success('Trip started successfully');
      fetchTrips();
    }
  }

  async function handleCompleteTrip(trip: Trip) {
    // Validate odometer readings before completing
    if (!trip.odometer_start || !trip.odometer_end) {
      toast.error('Please enter odometer readings before completing the trip');
      return;
    }

    if (trip.trip_type === 'two_way' && (!trip.odometer_return_start || !trip.odometer_return_end)) {
      toast.error('Please enter return journey odometer readings before completing the trip');
      return;
    }

    const { error } = await supabase
      .from('trips')
      .update({ 
        status: 'completed',
        end_date: new Date().toISOString()
      })
      .eq('id', trip.id);

    if (error) {
      toast.error('Failed to complete trip');
    } else {
      toast.success('Trip completed successfully');
      fetchTrips();
    }
  }

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
                  <TableHead>Date & Time</TableHead>
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
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            {t.trip_number}
                            {((t as any).previous_trip_id || (t as any).next_trip_id) && (
                              <TripChainIndicator
                                previousTripId={(t as any).previous_trip_id}
                                nextTripId={(t as any).next_trip_id}
                                cyclePosition={(t as any).cycle_position || 1}
                                compact
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.trip_type === 'two_way' ? 'default' : 'outline'}>
                            {t.trip_type === 'two_way' ? 'Two-Way' : 'One-Way'}
                          </Badge>
                        </TableCell>
                        <TableCell>{(t.bus as any)?.registration_number}</TableCell>
                        <TableCell>{(t.route as any)?.route_name}</TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div>
                              <div className="font-medium">
                                {new Date(t.start_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-muted-foreground text-xs flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                {t.departure_time || new Date(t.start_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {t.arrival_time || '-'}
                              </div>
                            </div>
                            {t.trip_type === 'two_way' && (
                              <div className="text-muted-foreground text-xs flex items-center gap-1 border-t pt-1">
                                <ArrowLeft className="h-3 w-3" />
                                {t.return_departure_time || '-'}
                                {' → '}
                                {t.return_arrival_time || '-'}
                              </div>
                            )}
                          </div>
                        </TableCell>
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
                          <div className="flex items-center gap-2">
                            {canStartTrip(t) && (
                              <Button size="sm" variant="default" onClick={() => handleStartTrip(t)}>
                                <Play className="h-4 w-4 mr-1" />
                                Start
                              </Button>
                            )}
                            {canEditOdometer(t.status) && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateOdometer(t)}>
                                <Gauge className="h-4 w-4 mr-1" />
                                Odometer
                              </Button>
                            )}
                            {t.status === 'in_progress' && (
                              <Button 
                                size="sm" 
                                variant={canCompleteTrip(t) ? "default" : "outline"}
                                onClick={() => handleCompleteTrip(t)}
                                disabled={!canCompleteTrip(t)}
                                title={!canCompleteTrip(t) ? "Complete all odometer readings first" : "Mark trip as completed"}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            )}
                          </div>
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
                  {odometerData.end && !odometerData.return_start && (
                    <div className="p-2 bg-muted rounded-lg text-sm text-muted-foreground">
                      Return start auto-filled from outward end reading. You can edit if needed.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="return_start">Start (km)</Label>
                      <Input
                        id="return_start"
                        type="number"
                        value={odometerData.return_start || odometerData.end}
                        onChange={(e) => setOdometerData({ ...odometerData, return_start: e.target.value })}
                        placeholder="e.g., 45350"
                      />
                      {odometerData.end && !odometerData.return_start && (
                        <p className="text-xs text-muted-foreground">
                          Same as outward end ({odometerData.end} km)
                        </p>
                      )}
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
                  {calculateDistance(odometerData.return_start || odometerData.end, odometerData.return_end) !== null && (
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">
                        Return Distance: {calculateDistance(odometerData.return_start || odometerData.end, odometerData.return_end)} km
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
                    (calculateDistance(odometerData.return_start || odometerData.end, odometerData.return_end) || 0)
                  } km
                </p>
              </div>
            )}

            {/* Water Stock Section */}
            {waterStock && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Water Boxes</span>
                  <Badge variant="outline" className="ml-auto">
                    Available: {waterStock.quantity} {waterStock.unit}
                  </Badge>
                </div>
                {(selectedTrip?.water_taken ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Previously taken: {selectedTrip?.water_taken} {waterStock.unit}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Total to take:</Label>
                  <Input
                    type="number"
                    min="0"
                    max={(selectedTrip?.water_taken ?? 0) + waterStock.quantity}
                    placeholder="0"
                    value={waterQuantity}
                    onChange={(e) => setWaterQuantity(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">{waterStock.unit}</span>
                </div>
                {(() => {
                  const newQty = parseInt(waterQuantity) || 0;
                  const prevQty = selectedTrip?.water_taken ?? 0;
                  const diff = newQty - prevQty;
                  if (diff > 0 && diff > waterStock.quantity) {
                    return <p className="text-sm text-destructive">Not enough stock available (need {diff} more)</p>;
                  }
                  if (diff !== 0) {
                    return (
                      <p className={`text-sm ${diff > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {diff > 0 ? `Will deduct ${diff} from stock` : `Will return ${Math.abs(diff)} to stock`}
                      </p>
                    );
                  }
                  return null;
                })()}
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