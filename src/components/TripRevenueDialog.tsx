import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { Trip } from '@/types/database';
import { Loader2, ArrowRight, ArrowLeft, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface TripRevenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onSuccess: () => void;
}

// Moved outside the component to prevent re-creation on each render
const RevenueFields = ({ prefix = '', values, onChange }: { 
  prefix?: string; 
  values: { cash: string; online: string; paytm: string; others: string; agent: string };
  onChange: (field: string, value: string) => void;
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}revenue_cash`}>Cash (₹)</Label>
        <Input
          id={`${prefix}revenue_cash`}
          type="number"
          value={values.cash}
          onChange={(e) => onChange(`${prefix}revenue_cash`, e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}revenue_online`}>Online/App (₹)</Label>
        <Input
          id={`${prefix}revenue_online`}
          type="number"
          value={values.online}
          onChange={(e) => onChange(`${prefix}revenue_online`, e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}revenue_paytm`}>Paytm (₹)</Label>
        <Input
          id={`${prefix}revenue_paytm`}
          type="number"
          value={values.paytm}
          onChange={(e) => onChange(`${prefix}revenue_paytm`, e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}revenue_others`}>Others (₹)</Label>
        <Input
          id={`${prefix}revenue_others`}
          type="number"
          value={values.others}
          onChange={(e) => onChange(`${prefix}revenue_others`, e.target.value)}
          placeholder="0"
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${prefix}revenue_agent`}>Agent Booking (₹)</Label>
      <Input
        id={`${prefix}revenue_agent`}
        type="number"
        value={values.agent}
        onChange={(e) => onChange(`${prefix}revenue_agent`, e.target.value)}
        placeholder="0"
      />
    </div>
  </div>
);

export default function TripRevenueDialog({ open, onOpenChange, trip, onSuccess }: TripRevenueDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [gstPercentage, setGstPercentage] = useState(18);
  const [formData, setFormData] = useState({
    // Outward journey
    revenue_cash: '0',
    revenue_online: '0',
    revenue_paytm: '0',
    revenue_others: '0',
    revenue_agent: '0',
    // Return journey
    return_revenue_cash: '0',
    return_revenue_online: '0',
    return_revenue_paytm: '0',
    return_revenue_others: '0',
    return_revenue_agent: '0',
  });

  useEffect(() => {
    if (trip) {
      setFormData({
        revenue_cash: trip.revenue_cash?.toString() || '0',
        revenue_online: trip.revenue_online?.toString() || '0',
        revenue_paytm: trip.revenue_paytm?.toString() || '0',
        revenue_others: trip.revenue_others?.toString() || '0',
        revenue_agent: trip.revenue_agent?.toString() || '0',
        return_revenue_cash: trip.return_revenue_cash?.toString() || '0',
        return_revenue_online: trip.return_revenue_online?.toString() || '0',
        return_revenue_paytm: trip.return_revenue_paytm?.toString() || '0',
        return_revenue_others: trip.return_revenue_others?.toString() || '0',
        return_revenue_agent: trip.return_revenue_agent?.toString() || '0',
      });
      setGstPercentage(trip.gst_percentage || 18);
    }
  }, [trip]);

  // Fetch GST percentage from settings
  useEffect(() => {
    async function fetchGstSetting() {
      if (USE_PYTHON_API) {
        const { data } = await apiClient.get<any>('/settings/gst_percentage');
        if (data?.value) {
          setGstPercentage(parseFloat(data.value) || 18);
        }
      } else {
        const supabase = await getCloudClient();
        const { data } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'gst_percentage')
          .single();
        if (data?.value) {
          setGstPercentage(parseFloat(data.value) || 18);
        }
      }
    }
    fetchGstSetting();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;

    setSubmitting(true);

    // Note: total_revenue is a generated column, so we don't include it in the update
    const updateData: Record<string, number> = {
      revenue_cash: parseFloat(formData.revenue_cash) || 0,
      revenue_online: parseFloat(formData.revenue_online) || 0,
      revenue_paytm: parseFloat(formData.revenue_paytm) || 0,
      revenue_others: parseFloat(formData.revenue_others) || 0,
      revenue_agent: parseFloat(formData.revenue_agent) || 0,
      gst_percentage: gstPercentage,
    };

    if (trip.trip_type === 'two_way') {
      const returnTotalValue =
        (parseFloat(formData.return_revenue_cash) || 0) +
        (parseFloat(formData.return_revenue_online) || 0) +
        (parseFloat(formData.return_revenue_paytm) || 0) +
        (parseFloat(formData.return_revenue_others) || 0) +
        (parseFloat(formData.return_revenue_agent) || 0);

      updateData.return_revenue_cash = parseFloat(formData.return_revenue_cash) || 0;
      updateData.return_revenue_online = parseFloat(formData.return_revenue_online) || 0;
      updateData.return_revenue_paytm = parseFloat(formData.return_revenue_paytm) || 0;
      updateData.return_revenue_others = parseFloat(formData.return_revenue_others) || 0;
      updateData.return_revenue_agent = parseFloat(formData.return_revenue_agent) || 0;
      updateData.return_total_revenue = returnTotalValue;
    }

    let error: any = null;
    if (USE_PYTHON_API) {
      const res = await apiClient.put(`/trips/${trip.id}`, updateData);
      error = res.error;
    } else {
      const supabase = await getCloudClient();
      const res = await supabase.from('trips').update(updateData).eq('id', trip.id);
      error = res.error;
    }

    if (error) {
      console.error('Revenue update error:', error);
      toast.error(error.message || 'Failed to update revenue');
    } else {
      toast.success('Revenue updated successfully');
      onOpenChange(false);
      onSuccess();
    }
    setSubmitting(false);
  }

  // Calculate totals
  const outwardTotal =
    (parseFloat(formData.revenue_cash) || 0) +
    (parseFloat(formData.revenue_online) || 0) +
    (parseFloat(formData.revenue_paytm) || 0) +
    (parseFloat(formData.revenue_others) || 0) +
    (parseFloat(formData.revenue_agent) || 0);

  const returnTotal =
    (parseFloat(formData.return_revenue_cash) || 0) +
    (parseFloat(formData.return_revenue_online) || 0) +
    (parseFloat(formData.return_revenue_paytm) || 0) +
    (parseFloat(formData.return_revenue_others) || 0) +
    (parseFloat(formData.return_revenue_agent) || 0);

  const isTwoWay = trip?.trip_type === 'two_way';
  const grandTotal = outwardTotal + (isTwoWay ? returnTotal : 0);
  
  // GST Calculation (GST is inclusive in the total, so we extract it)
  const gstAmount = grandTotal * (gstPercentage / (100 + gstPercentage));
  const netRevenue = grandTotal - gstAmount;

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
                <RevenueFields
                  values={{
                    cash: formData.revenue_cash,
                    online: formData.revenue_online,
                    paytm: formData.revenue_paytm,
                    others: formData.revenue_others,
                    agent: formData.revenue_agent,
                  }}
                  onChange={handleFieldChange}
                />
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    Outward Total: ₹{outwardTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="return" className="space-y-4">
                <RevenueFields
                  prefix="return_"
                  values={{
                    cash: formData.return_revenue_cash,
                    online: formData.return_revenue_online,
                    paytm: formData.return_revenue_paytm,
                    others: formData.return_revenue_others,
                    agent: formData.return_revenue_agent,
                  }}
                  onChange={handleFieldChange}
                />
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">
                    Return Total: ₹{returnTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <RevenueFields
              values={{
                cash: formData.revenue_cash,
                online: formData.revenue_online,
                paytm: formData.revenue_paytm,
                others: formData.revenue_others,
                agent: formData.revenue_agent,
              }}
              onChange={handleFieldChange}
            />
          )}

          {/* GST Breakdown */}
          <div className="p-4 bg-primary/10 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4" />
              <span className="font-medium">GST Breakdown</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Gross Revenue:</span>
              <span className="text-right font-medium">₹{grandTotal.toLocaleString('en-IN')}</span>
              
              <span className="text-muted-foreground">GST @ {gstPercentage}% (inclusive):</span>
              <span className="text-right text-destructive">- ₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              
              <span className="font-medium">Net Revenue:</span>
              <span className="text-right font-bold text-green-600">₹{netRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
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