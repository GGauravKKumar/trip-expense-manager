import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportPeriodTripSheet, mapTripToPeriodData } from '@/lib/periodTripSheetExport';

interface PeriodExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PeriodExportDialog({ open, onOpenChange }: PeriodExportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  function getDateRange(): { start: Date; end: Date; label: string } {
    const now = new Date();
    
    if (periodType === 'weekly') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return {
        start,
        end: now,
        label: `Week of ${start.toLocaleDateString('en-IN')} - ${now.toLocaleDateString('en-IN')}`,
      };
    } else if (periodType === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start,
        end,
        label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      };
    } else {
      return {
        start: new Date(customStart),
        end: new Date(customEnd),
        label: `${new Date(customStart).toLocaleDateString('en-IN')} - ${new Date(customEnd).toLocaleDateString('en-IN')}`,
      };
    }
  }

  async function handleExport() {
    if (periodType === 'custom' && (!customStart || !customEnd)) {
      toast.error('Please select both start and end dates');
      return;
    }

    setLoading(true);

    try {
      const { start, end, label } = getDateRange();

      // Fetch all trips in the date range with bus and driver info
      const { data: trips, error: tripError } = await supabase
        .from('trips')
        .select(`
          *,
          bus:buses(registration_number, bus_name),
          driver:profiles!trips_driver_id_fkey(full_name),
          route:routes(route_name, from_address, to_address)
        `)
        .gte('start_date', start.toISOString())
        .lte('start_date', end.toISOString())
        .order('start_date', { ascending: true });

      if (tripError) throw tripError;

      if (!trips || trips.length === 0) {
        toast.error('No trips found for the selected period');
        setLoading(false);
        return;
      }

      // Fetch all expenses for these trips
      const tripIds = trips.map((t) => t.id);
      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select(`trip_id, amount, category:expense_categories(name)`)
        .in('trip_id', tripIds)
        .eq('status', 'approved');

      if (expError) throw expError;

      // Group expenses by trip
      const expensesByTrip: Record<string, { category_name: string; amount: number }[]> = {};
      expenses?.forEach((exp) => {
        if (!expensesByTrip[exp.trip_id]) {
          expensesByTrip[exp.trip_id] = [];
        }
        expensesByTrip[exp.trip_id].push({
          category_name: (exp.category as any)?.name || 'Other',
          amount: exp.amount,
        });
      });

      // Group trips by bus
      const tripsByBus: Record<string, typeof trips> = {};
      trips.forEach((trip) => {
        const busNo = (trip.bus as any)?.registration_number || 'Unknown';
        if (!tripsByBus[busNo]) {
          tripsByBus[busNo] = [];
        }
        tripsByBus[busNo].push(trip);
      });

      // Map to export format - flatten the array since mapTripToPeriodData returns an array
      const busData = Object.entries(tripsByBus).map(([vehicleNo, busTrips]) => ({
        vehicleNo,
        trips: busTrips.flatMap((trip) =>
          mapTripToPeriodData(
            {
              id: trip.id,
              trip_number: trip.trip_number,
              start_date: trip.start_date,
              end_date: trip.end_date,
              notes: trip.notes,
              trip_type: trip.trip_type,
              odometer_start: trip.odometer_start,
              odometer_end: trip.odometer_end,
              distance_traveled: trip.distance_traveled,
              revenue_cash: trip.revenue_cash,
              revenue_online: trip.revenue_online,
              revenue_paytm: trip.revenue_paytm,
              revenue_others: trip.revenue_others,
              total_revenue: trip.total_revenue,
              odometer_return_start: trip.odometer_return_start,
              odometer_return_end: trip.odometer_return_end,
              distance_return: trip.distance_return,
              return_revenue_cash: trip.return_revenue_cash,
              return_revenue_online: trip.return_revenue_online,
              return_revenue_paytm: trip.return_revenue_paytm,
              return_revenue_others: trip.return_revenue_others,
              return_total_revenue: trip.return_total_revenue,
              route: trip.route as any,
              driver: trip.driver as any,
            },
            expensesByTrip[trip.id] || []
          )
        ),
      }));

      const filename = `fleet-trip-sheet-${periodType}-${new Date().toISOString().slice(0, 10)}`;
      exportPeriodTripSheet(busData, label, filename);
      toast.success('Fleet Trip Sheet downloaded successfully!');
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate Fleet Trip Sheet');
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Fleet Trip Sheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download trip sheets for all buses during a selected period. Each bus will have its own sheet in the Excel file.
          </p>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Last 7 Days</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodType === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
