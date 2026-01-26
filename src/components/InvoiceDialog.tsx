import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { toast } from 'sonner';
import { 
  Invoice, 
  InvoiceType, 
  InvoiceLineItem,
  InvoiceDirection,
  InvoiceCategory,
  INVOICE_CATEGORIES
} from '@/types/invoice';

interface LineItemForm {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  is_deduction: boolean;
  gst_percentage: number;
  rate_includes_gst: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  direction: InvoiceDirection;
  onSuccess: () => void;
}

export default function InvoiceDialog({ open, onOpenChange, invoice, direction, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    // For sales
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_gst: '',
    // For purchase
    vendor_name: '',
    vendor_address: '',
    vendor_phone: '',
    vendor_gst: '',
    // Common
    invoice_type: 'customer' as InvoiceType,
    category: 'general' as InvoiceCategory,
    notes: '',
    terms: '',
  });
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    { description: '', quantity: 1, unit_price: 0, is_deduction: false, gst_percentage: 18, rate_includes_gst: false },
  ]);

  const isSales = direction === 'sales';

  useEffect(() => {
    if (open && invoice) {
      // Load existing invoice data
      setFormData({
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        customer_name: invoice.customer_name || '',
        customer_address: invoice.customer_address || '',
        customer_phone: invoice.customer_phone || '',
        customer_gst: invoice.customer_gst || '',
        vendor_name: invoice.vendor_name || '',
        vendor_address: invoice.vendor_address || '',
        vendor_phone: invoice.vendor_phone || '',
        vendor_gst: invoice.vendor_gst || '',
        invoice_type: invoice.invoice_type,
        category: invoice.category || 'general',
        notes: invoice.notes || '',
        terms: invoice.terms || '',
      });
      fetchLineItems(invoice.id);
    } else if (open) {
      // Reset form for new invoice
      setFormData({
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        customer_name: '',
        customer_address: '',
        customer_phone: '',
        customer_gst: '',
        vendor_name: '',
        vendor_address: '',
        vendor_phone: '',
        vendor_gst: '',
        invoice_type: 'customer',
        category: 'general',
        notes: '',
        terms: '',
      });
      setLineItems([{ description: '', quantity: 1, unit_price: 0, is_deduction: false, gst_percentage: 18, rate_includes_gst: false }]);
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
          gst_percentage: item.gst_percentage ?? 18,
          rate_includes_gst: item.rate_includes_gst ?? false,
        }))
      );
    }
    setLoadingItems(false);
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, is_deduction: false, gst_percentage: 18, rate_includes_gst: false }]);
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

  function calculateLineItemAmounts(item: LineItemForm) {
    const rawAmount = item.quantity * item.unit_price;
    
    if (item.rate_includes_gst) {
      const baseAmount = rawAmount / (1 + item.gst_percentage / 100);
      const gstAmount = rawAmount - baseAmount;
      return { baseAmount, gstAmount, totalAmount: rawAmount };
    } else {
      const gstAmount = rawAmount * (item.gst_percentage / 100);
      return { baseAmount: rawAmount, gstAmount, totalAmount: rawAmount + gstAmount };
    }
  }

  function calculateTotals() {
    let positiveBaseTotal = 0;
    let positiveGstTotal = 0;
    let deductionsBaseTotal = 0;
    let deductionsGstTotal = 0;

    lineItems.forEach((item) => {
      const { baseAmount, gstAmount } = calculateLineItemAmounts(item);
      if (item.is_deduction) {
        deductionsBaseTotal += baseAmount;
        deductionsGstTotal += gstAmount;
      } else {
        positiveBaseTotal += baseAmount;
        positiveGstTotal += gstAmount;
      }
    });

    const subtotal = positiveBaseTotal - deductionsBaseTotal;
    const gstAmount = positiveGstTotal - deductionsGstTotal;
    const totalAmount = subtotal + gstAmount;
    const deductionsTotal = deductionsBaseTotal + deductionsGstTotal;

    return { subtotal, gstAmount, totalAmount, deductionsTotal };
  }

  async function generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = isSales ? 'INV' : 'PUR';
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('direction', direction)
      .gte('created_at', todayStart.toISOString());
    
    const sequence = ((count || 0) + 1).toString().padStart(3, '0');
    return `${prefix}${dateStr}${sequence}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const partyName = isSales ? formData.customer_name : formData.vendor_name;
    if (!partyName) {
      toast.error(isSales ? 'Customer name is required' : 'Vendor name is required');
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
            customer_name: formData.customer_name || formData.vendor_name,
            customer_address: formData.customer_address || null,
            customer_phone: formData.customer_phone || null,
            customer_gst: formData.customer_gst || null,
            vendor_name: formData.vendor_name || null,
            vendor_address: formData.vendor_address || null,
            vendor_phone: formData.vendor_phone || null,
            vendor_gst: formData.vendor_gst || null,
            invoice_type: formData.invoice_type,
            category: formData.category,
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
          .map((item) => {
            const amounts = calculateLineItemAmounts(item);
            return {
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: amounts.totalAmount,
              is_deduction: item.is_deduction,
              gst_percentage: item.gst_percentage,
              rate_includes_gst: item.rate_includes_gst,
              base_amount: amounts.baseAmount,
              gst_amount: amounts.gstAmount,
            };
          });

        if (lineItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success('Invoice updated successfully');
      } else {
        // Create new invoice
        const invoiceNumber = formData.invoice_number.trim() || await generateInvoiceNumber();

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date || null,
            direction,
            category: formData.category,
            customer_name: formData.customer_name || formData.vendor_name,
            customer_address: formData.customer_address || null,
            customer_phone: formData.customer_phone || null,
            customer_gst: formData.customer_gst || null,
            vendor_name: formData.vendor_name || null,
            vendor_address: formData.vendor_address || null,
            vendor_phone: formData.vendor_phone || null,
            vendor_gst: formData.vendor_gst || null,
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
          .map((item) => {
            const amounts = calculateLineItemAmounts(item);
            return {
              invoice_id: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: amounts.totalAmount,
              is_deduction: item.is_deduction,
              gst_percentage: item.gst_percentage,
              rate_includes_gst: item.rate_includes_gst,
              base_amount: amounts.baseAmount,
              gst_amount: amounts.gstAmount,
            };
          });

        if (lineItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success(`${isSales ? 'Sales' : 'Purchase'} invoice ${invoiceNumber} created`);
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
          <DialogTitle className="flex items-center gap-2">
            {isSales ? (
              <ArrowUpRight className="h-5 w-5 text-green-500" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 text-red-500" />
            )}
            {invoice ? 'Edit' : 'Create'} {isSales ? 'Sales' : 'Purchase'} Invoice
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Party Details */}
          <div className="space-y-4">
            <h3 className="font-medium">{isSales ? 'Customer Details' : 'Vendor Details'}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="party_name">{isSales ? 'Customer' : 'Vendor'} Name *</Label>
                <Input
                  id="party_name"
                  value={isSales ? formData.customer_name : formData.vendor_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [isSales ? 'customer_name' : 'vendor_name']: e.target.value 
                  })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party_phone">Phone</Label>
                <Input
                  id="party_phone"
                  value={isSales ? formData.customer_phone : formData.vendor_phone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [isSales ? 'customer_phone' : 'vendor_phone']: e.target.value 
                  })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="party_address">Address</Label>
                <Input
                  id="party_address"
                  value={isSales ? formData.customer_address : formData.vendor_address}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [isSales ? 'customer_address' : 'vendor_address']: e.target.value 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party_gst">GST Number</Label>
                <Input
                  id="party_gst"
                  value={isSales ? formData.customer_gst : formData.vendor_gst}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [isSales ? 'customer_gst' : 'vendor_gst']: e.target.value 
                  })}
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Invoice Details</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder={invoice ? '' : 'Auto-generated if empty'}
                  disabled={!!invoice}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: InvoiceCategory) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isSales && (
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
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-4">
                {lineItems.map((item, index) => {
                  const { baseAmount, gstAmount: lineGst, totalAmount: lineTotal } = calculateLineItemAmounts(item);
                  return (
                    <div
                      key={index}
                      className={`space-y-4 p-4 rounded-lg border ${item.is_deduction ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'}`}
                    >
                      {/* Row 1: Description and Delete */}
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs font-medium">Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Enter item description"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Row 2: Qty, Rate, GST % */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Rate (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">GST %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.gst_percentage}
                            onChange={(e) => updateLineItem(index, 'gst_percentage', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {/* Row 3: Checkboxes */}
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`gst-inclusive-${index}`}
                            checked={item.rate_includes_gst}
                            onCheckedChange={(checked) => updateLineItem(index, 'rate_includes_gst', !!checked)}
                          />
                          <Label htmlFor={`gst-inclusive-${index}`} className="text-sm cursor-pointer">
                            Rate includes GST
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`deduction-${index}`}
                            checked={item.is_deduction}
                            onCheckedChange={(checked) => updateLineItem(index, 'is_deduction', !!checked)}
                          />
                          <Label htmlFor={`deduction-${index}`} className="text-sm cursor-pointer">
                            This is a deduction
                          </Label>
                        </div>
                      </div>

                      {/* Row 4: Amount breakdown */}
                      <div className={`p-3 rounded-md bg-background border ${item.is_deduction ? 'border-destructive/30' : 'border-border'}`}>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Amount Breakdown:</span>
                          <span className={`font-medium ${item.is_deduction ? 'text-destructive' : ''}`}>
                            {item.is_deduction ? '- ' : ''}
                            Base: ₹{baseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} + 
                            GST: ₹{lineGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })} = 
                            <span className="font-bold ml-1">₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2 text-right">
                <div className="text-sm text-muted-foreground">
                  Deductions: <span className="text-destructive font-medium">-₹{deductionsTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Subtotal (Base): <span className="font-medium">₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total GST: <span className="font-medium">₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="text-lg font-bold">
                  Grand Total: ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes for internal reference..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {invoice ? 'Update Invoice' : `Create ${isSales ? 'Sales' : 'Purchase'} Invoice`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
