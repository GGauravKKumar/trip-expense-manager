import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Invoice, InvoiceType, InvoiceLineItem } from '@/pages/admin/InvoiceManagement';

interface LineItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  is_deduction: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  onSuccess: () => void;
}

export default function InvoiceDialog({ open, onOpenChange, invoice, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_gst: '',
    invoice_type: 'customer' as InvoiceType,
    gst_percentage: 18,
    notes: '',
    terms: '',
  });
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    { description: '', quantity: 1, unit_price: 0, is_deduction: false },
  ]);

  useEffect(() => {
    if (open && invoice) {
      // Load existing invoice data
      setFormData({
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        customer_name: invoice.customer_name,
        customer_address: invoice.customer_address || '',
        customer_phone: invoice.customer_phone || '',
        customer_gst: invoice.customer_gst || '',
        invoice_type: invoice.invoice_type,
        gst_percentage: invoice.subtotal > 0 ? (invoice.gst_amount / invoice.subtotal) * 100 : 18,
        notes: invoice.notes || '',
        terms: invoice.terms || '',
      });
      fetchLineItems(invoice.id);
    } else if (open) {
      // Reset form for new invoice
      setFormData({
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        customer_name: '',
        customer_address: '',
        customer_phone: '',
        customer_gst: '',
        invoice_type: 'customer',
        gst_percentage: 18,
        notes: '',
        terms: '',
      });
      setLineItems([{ description: '', quantity: 1, unit_price: 0, is_deduction: false }]);
    }
  }, [open, invoice]);

  async function fetchLineItems(invoiceId: string) {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at');

    if (error) {
      console.error('Error fetching line items:', error);
    } else if (data && data.length > 0) {
      setLineItems(
        (data as InvoiceLineItem[]).map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_deduction: item.is_deduction,
        }))
      );
    }
    setLoadingItems(false);
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, is_deduction: false }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  }

  function updateLineItem(index: number, field: keyof LineItemForm, value: string | number | boolean) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  function calculateTotals() {
    let positiveTotal = 0;
    let deductionsTotal = 0;

    lineItems.forEach((item) => {
      const amount = item.quantity * item.unit_price;
      if (item.is_deduction) {
        deductionsTotal += amount;
      } else {
        positiveTotal += amount;
      }
    });

    const subtotal = positiveTotal - deductionsTotal;
    const gstAmount = subtotal * (formData.gst_percentage / 100);
    const totalAmount = subtotal + gstAmount;

    return { subtotal, gstAmount, totalAmount, deductionsTotal };
  }

  async function generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    
    // Get count of invoices for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    
    const sequence = ((count || 0) + 1).toString().padStart(3, '0');
    return `INV${dateStr}${sequence}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.customer_name) {
      toast.error('Customer name is required');
      return;
    }

    if (lineItems.every((item) => !item.description)) {
      toast.error('At least one line item is required');
      return;
    }

    setLoading(true);

    try {
      const { subtotal, gstAmount, totalAmount } = calculateTotals();

      if (invoice) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            invoice_date: formData.invoice_date,
            due_date: formData.due_date || null,
            customer_name: formData.customer_name,
            customer_address: formData.customer_address || null,
            customer_phone: formData.customer_phone || null,
            customer_gst: formData.customer_gst || null,
            invoice_type: formData.invoice_type,
            subtotal,
            gst_amount: gstAmount,
            total_amount: totalAmount,
            balance_due: totalAmount - invoice.amount_paid,
            notes: formData.notes || null,
            terms: formData.terms || null,
          })
          .eq('id', invoice.id);

        if (invoiceError) throw invoiceError;

        // Delete existing line items and re-insert
        await supabase.from('invoice_line_items').delete().eq('invoice_id', invoice.id);

        const lineItemsToInsert = lineItems
          .filter((item) => item.description)
          .map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.quantity * item.unit_price,
            is_deduction: item.is_deduction,
          }));

        if (lineItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success('Invoice updated successfully');
      } else {
        // Create new invoice
        const invoiceNumber = await generateInvoiceNumber();

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date || null,
            customer_name: formData.customer_name,
            customer_address: formData.customer_address || null,
            customer_phone: formData.customer_phone || null,
            customer_gst: formData.customer_gst || null,
            invoice_type: formData.invoice_type,
            subtotal,
            gst_amount: gstAmount,
            total_amount: totalAmount,
            amount_paid: 0,
            balance_due: totalAmount,
            status: 'draft',
            notes: formData.notes || null,
            terms: formData.terms || null,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Insert line items
        const lineItemsToInsert = lineItems
          .filter((item) => item.description)
          .map((item) => ({
            invoice_id: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.quantity * item.unit_price,
            is_deduction: item.is_deduction,
          }));

        if (lineItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success(`Invoice ${invoiceNumber} created successfully`);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error saving invoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save invoice';
      toast.error(errorMessage);
    }

    setLoading(false);
  }

  const { subtotal, gstAmount, totalAmount, deductionsTotal } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Customer Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Phone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Input
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_gst">GST Number</Label>
                <Input
                  id="customer_gst"
                  value={formData.customer_gst}
                  onChange={(e) => setFormData({ ...formData, customer_gst: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Invoice Details</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invoice_type">Invoice Type *</Label>
                <Select
                  value={formData.invoice_type}
                  onValueChange={(value: InvoiceType) => setFormData({ ...formData, invoice_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="online_app">Online App</SelectItem>
                    <SelectItem value="charter">Charter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Line Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {loadingItems ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className={`grid gap-3 p-3 rounded-lg border ${item.is_deduction ? 'bg-destructive/5 border-destructive/20' : ''}`}
                  >
                    <div className="grid gap-3 md:grid-cols-12 items-end">
                      <div className="md:col-span-5 space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs">Rate (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <div className={`p-2 text-sm font-medium ${item.is_deduction ? 'text-destructive' : ''}`}>
                          {item.is_deduction ? '-' : ''}₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="md:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`deduction-${index}`}
                        checked={item.is_deduction}
                        onCheckedChange={(checked) => updateLineItem(index, 'is_deduction', !!checked)}
                      />
                      <Label htmlFor={`deduction-${index}`} className="text-sm text-muted-foreground cursor-pointer">
                        This is a deduction (e.g., advertisement fees, platform commission)
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GST and Totals */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gst_percentage">GST %</Label>
                <Input
                  id="gst_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.gst_percentage}
                  onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2 text-right">
                <div className="text-sm text-muted-foreground">
                  Deductions: <span className="text-destructive font-medium">-₹{deductionsTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Subtotal: <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  GST ({formData.gst_percentage}%): <span className="font-medium">₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-lg font-bold">
                  Total: ₹{totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes for internal reference..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                placeholder="Payment terms, conditions..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {invoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
