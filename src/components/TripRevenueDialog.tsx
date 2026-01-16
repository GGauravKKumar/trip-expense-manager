import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Trip } from '@/types/database';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface TripRevenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onSuccess: () => void;
}

export default function TripRevenueDialog({ open, onOpenChange, trip, onSuccess }: TripRevenueDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Outward journey
    revenue_cash: '0',
    revenue_online: '0',
    revenue_paytm: '0',
    revenue_others: '0',
    // Return journey
    return_revenue_cash: '0',
    return_revenue_online: '0',
    return_revenue_paytm: '0',
    return_revenue_others: '0',
  });

  useEffect(() => {
    if (trip) {
      setFormData({
        revenue_cash: trip.revenue_cash?.toString() || '0',
        revenue_online: trip.revenue_online?.toString() || '0',
        revenue_paytm: trip.revenue_paytm?.toString() || '0',
        revenue_others: trip.revenue_others?.toString() || '0',
        return_revenue_cash: trip.return_revenue_cash?.toString() || '0',
        return_revenue_online: trip.return_revenue_online?.toString() || '0',
        return_revenue_paytm: trip.return_revenue_paytm?.toString() || '0',
        return_revenue_others: trip.return_revenue_others?.toString() || '0',
      });
    }
  }, [trip]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;

    setSubmitting(true);

    const outwardSum = 
      (parseFloat(formData.revenue_cash) || 0) +
      (parseFloat(formData.revenue_online) || 0) +
      (parseFloat(formData.revenue_paytm) || 0) +
      (parseFloat(formData.revenue_others) || 0);

    const updateData: Record<string, number> = {
      revenue_cash: parseFloat(formData.revenue_cash) || 0,
      revenue_online: parseFloat(formData.revenue_online) || 0,
      revenue_paytm: parseFloat(formData.revenue_paytm) || 0,
      revenue_others: parseFloat(formData.revenue_others) || 0,
      total_revenue: outwardSum,
    };

    if (trip.trip_type === 'two_way') {
      const returnSum = 
        (parseFloat(formData.return_revenue_cash) || 0) +
        (parseFloat(formData.return_revenue_online) || 0) +
        (parseFloat(formData.return_revenue_paytm) || 0) +
        (parseFloat(formData.return_revenue_others) || 0);

      updateData.return_revenue_cash = parseFloat(formData.return_revenue_cash) || 0;
      updateData.return_revenue_online = parseFloat(formData.return_revenue_online) || 0;
      updateData.return_revenue_paytm = parseFloat(formData.return_revenue_paytm) || 0;
      updateData.return_revenue_others = parseFloat(formData.return_revenue_others) || 0;
      updateData.return_total_revenue = returnSum;
    }

    const { error } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', trip.id);

    if (error) {
      toast.error('Failed to update revenue');
    } else {
      toast.success('Revenue updated successfully');
      onOpenChange(false);
      onSuccess();
    }
    setSubmitting(false);
  }

  const outwardTotal =
    (parseFloat(formData.revenue_cash) || 0) +
    (parseFloat(formData.revenue_online) || 0) +
    (parseFloat(formData.revenue_paytm) || 0) +
    (parseFloat(formData.revenue_others) || 0);

  const returnTotal =
    (parseFloat(formData.return_revenue_cash) || 0) +
    (parseFloat(formData.return_revenue_online) || 0) +
    (parseFloat(formData.return_revenue_paytm) || 0) +
    (parseFloat(formData.return_revenue_others) || 0);

  const isTwoWay = trip?.trip_type === 'two_way';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Revenue Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Trip: {trip?.trip_number}</p>
            <p className="text-sm text-muted-foreground">
              {(trip?.route as any)?.route_name}
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
                    <Label htmlFor="revenue_cash">Cash (₹)</Label>
                    <Input
                      id="revenue_cash"
                      type="number"
                      value={formData.revenue_cash}
                      onChange={(e) => setFormData({ ...formData, revenue_cash: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue_online">Online (₹)</Label>
                    <Input
                      id="revenue_online"
                      type="number"
                      value={formData.revenue_online}
                      onChange={(e) => setFormData({ ...formData, revenue_online: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue_paytm">Paytm (₹)</Label>
                    <Input
                      id="revenue_paytm"
                      type="number"
                      value={formData.revenue_paytm}
                      onChange={(e) => setFormData({ ...formData, revenue_paytm: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue_others">Others (₹)</Label>
                    <Input
                      id="revenue_others"
                      type="number"
                      value={formData.revenue_others}
                      onChange={(e) => setFormData({ ...formData, revenue_others: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    Outward Total: ₹{outwardTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="return" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="return_revenue_cash">Cash (₹)</Label>
                    <Input
                      id="return_revenue_cash"
                      type="number"
                      value={formData.return_revenue_cash}
                      onChange={(e) => setFormData({ ...formData, return_revenue_cash: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_revenue_online">Online (₹)</Label>
                    <Input
                      id="return_revenue_online"
                      type="number"
                      value={formData.return_revenue_online}
                      onChange={(e) => setFormData({ ...formData, return_revenue_online: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_revenue_paytm">Paytm (₹)</Label>
                    <Input
                      id="return_revenue_paytm"
                      type="number"
                      value={formData.return_revenue_paytm}
                      onChange={(e) => setFormData({ ...formData, return_revenue_paytm: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_revenue_others">Others (₹)</Label>
                    <Input
                      id="return_revenue_others"
                      type="number"
                      value={formData.return_revenue_others}
                      onChange={(e) => setFormData({ ...formData, return_revenue_others: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">
                    Return Total: ₹{returnTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue_cash">Cash (₹)</Label>
                <Input
                  id="revenue_cash"
                  type="number"
                  value={formData.revenue_cash}
                  onChange={(e) => setFormData({ ...formData, revenue_cash: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_online">Online (₹)</Label>
                <Input
                  id="revenue_online"
                  type="number"
                  value={formData.revenue_online}
                  onChange={(e) => setFormData({ ...formData, revenue_online: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_paytm">Paytm (₹)</Label>
                <Input
                  id="revenue_paytm"
                  type="number"
                  value={formData.revenue_paytm}
                  onChange={(e) => setFormData({ ...formData, revenue_paytm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_others">Others (₹)</Label>
                <Input
                  id="revenue_others"
                  type="number"
                  value={formData.revenue_others}
                  onChange={(e) => setFormData({ ...formData, revenue_others: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-lg font-bold">
              Grand Total: ₹{(outwardTotal + (isTwoWay ? returnTotal : 0)).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Revenue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}