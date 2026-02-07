import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Invoice } from '@/pages/admin/InvoiceManagement';

interface Props {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const paymentModes = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'UPI',
  'Credit Card',
  'Debit Card',
  'Other',
];

export default function InvoicePaymentDialog({ invoice, open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: invoice.balance_due.toString(),
    payment_mode: 'Cash',
    reference_number: '',
    notes: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > invoice.balance_due) {
      toast.error('Payment amount cannot exceed balance due');
      return;
    }

    setLoading(true);

    try {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.post(`/invoices/${invoice.id}/payments`, {
          payment_date: formData.payment_date,
          amount,
          payment_mode: formData.payment_mode,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
        });
        if (error) throw error;
      } else {
        const supabase = await getCloudClient();

        // Get profile ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        // Insert payment
        const { error: paymentError } = await supabase.from('invoice_payments').insert({
          invoice_id: invoice.id,
          payment_date: formData.payment_date,
          amount,
          payment_mode: formData.payment_mode,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
          created_by: profile?.id || null,
        });

        if (paymentError) throw paymentError;

        // Update invoice amounts and status
        const newAmountPaid = invoice.amount_paid + amount;
        const newBalanceDue = invoice.total_amount - newAmountPaid;
        let newStatus = invoice.status;

        if (newBalanceDue <= 0) {
          newStatus = 'paid';
        } else if (newAmountPaid > 0) {
          newStatus = 'partial';
        }

        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: newStatus,
          })
          .eq('id', invoice.id);

        if (updateError) throw updateError;
      }

      toast.success('Payment recorded successfully');
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error recording payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to record payment';
      toast.error(errorMessage);
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Invoice:</span>
            <span className="font-medium">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-medium">{invoice.customer_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="font-medium">₹{invoice.total_amount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Already Paid:</span>
            <span className="font-medium text-green-600">₹{invoice.amount_paid.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
            <span>Balance Due:</span>
            <span className="text-yellow-600">₹{invoice.balance_due.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={invoice.balance_due}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_mode">Payment Mode *</Label>
            <Select
              value={formData.payment_mode}
              onValueChange={(value) => setFormData({ ...formData, payment_mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_number">Reference / Transaction Number</Label>
            <Input
              id="reference_number"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              placeholder="Cheque number, UPI ref, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
