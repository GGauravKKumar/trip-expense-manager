import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Trip } from '@/types/database';
import { Loader2 } from 'lucide-react';
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
    revenue_cash: trip?.revenue_cash?.toString() || '0',
    revenue_online: trip?.revenue_online?.toString() || '0',
    revenue_paytm: trip?.revenue_paytm?.toString() || '0',
    revenue_others: trip?.revenue_others?.toString() || '0',
  });

  // Reset form when trip changes
  useState(() => {
    if (trip) {
      setFormData({
        revenue_cash: trip.revenue_cash?.toString() || '0',
        revenue_online: trip.revenue_online?.toString() || '0',
        revenue_paytm: trip.revenue_paytm?.toString() || '0',
        revenue_others: trip.revenue_others?.toString() || '0',
      });
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;

    setSubmitting(true);

    const { error } = await supabase
      .from('trips')
      .update({
        revenue_cash: parseFloat(formData.revenue_cash) || 0,
        revenue_online: parseFloat(formData.revenue_online) || 0,
        revenue_paytm: parseFloat(formData.revenue_paytm) || 0,
        revenue_others: parseFloat(formData.revenue_others) || 0,
      })
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

  const totalRevenue =
    (parseFloat(formData.revenue_cash) || 0) +
    (parseFloat(formData.revenue_online) || 0) +
    (parseFloat(formData.revenue_paytm) || 0) +
    (parseFloat(formData.revenue_others) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Revenue Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Trip: {trip?.trip_number}</p>
            <p className="text-sm text-muted-foreground">
              {(trip?.route as any)?.route_name}
            </p>
          </div>

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

          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-lg font-bold">
              Total Revenue: ₹{totalRevenue.toLocaleString('en-IN')}
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
