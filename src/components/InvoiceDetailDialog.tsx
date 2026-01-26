import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Edit, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Invoice, InvoiceStatus, InvoiceLineItem, InvoicePayment, INVOICE_CATEGORIES, INVOICE_STATUS_CONFIG } from '@/types/invoice';

interface Props {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onRefresh: () => void;
}

export default function InvoiceDetailDialog({ invoice, open, onOpenChange, onEdit, onRefresh }: Props) {
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDetails();
    }
  }, [open, invoice.id]);

  async function fetchDetails() {
    setLoading(true);
    
    const [itemsResult, paymentsResult] = await Promise.all([
      supabase.from('invoice_line_items').select('*').eq('invoice_id', invoice.id).order('created_at'),
      supabase.from('invoice_payments').select('*').eq('invoice_id', invoice.id).order('payment_date', { ascending: false }),
    ]);

    if (itemsResult.data) {
      setLineItems(itemsResult.data as InvoiceLineItem[]);
    }
    if (paymentsResult.data) {
      setPayments(paymentsResult.data as InvoicePayment[]);
    }
    
    setLoading(false);
  }

  async function updateStatus(newStatus: InvoiceStatus) {
    setUpdatingStatus(true);
    
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      onRefresh();
    }
    
    setUpdatingStatus(false);
  }

  function getStatusBadge(status: InvoiceStatus) {
    const config = INVOICE_STATUS_CONFIG[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  const isSales = (invoice.direction || 'sales') === 'sales';
  const categoryLabel = INVOICE_CATEGORIES.find(c => c.value === invoice.category)?.label || invoice.category;

  const regularItems = lineItems.filter((item) => !item.is_deduction);
  const deductionItems = lineItems.filter((item) => item.is_deduction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isSales ? (
                <ArrowUpRight className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowDownLeft className="h-5 w-5 text-red-500" />
              )}
              {isSales ? 'Sales' : 'Purchase'} Invoice {invoice.invoice_number}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{categoryLabel}</Badge>
              {getStatusBadge(invoice.status)}
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Party Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">
                  {isSales ? 'Customer' : 'Vendor'}
                </h4>
                <p className="font-medium">
                  {isSales ? invoice.customer_name : (invoice.vendor_name || invoice.customer_name)}
                </p>
                {isSales ? (
                  <>
                    {invoice.customer_address && <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>}
                    {invoice.customer_phone && <p className="text-sm text-muted-foreground">{invoice.customer_phone}</p>}
                    {invoice.customer_gst && <p className="text-sm text-muted-foreground">GST: {invoice.customer_gst}</p>}
                  </>
                ) : (
                  <>
                    {invoice.vendor_address && <p className="text-sm text-muted-foreground">{invoice.vendor_address}</p>}
                    {invoice.vendor_phone && <p className="text-sm text-muted-foreground">{invoice.vendor_phone}</p>}
                    {invoice.vendor_gst && <p className="text-sm text-muted-foreground">GST: {invoice.vendor_gst}</p>}
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Invoice Date: <span className="font-medium text-foreground">{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</span>
                </div>
                {invoice.due_date && (
                  <div className="text-sm text-muted-foreground">
                    Due Date: <span className="font-medium text-foreground">{format(new Date(invoice.due_date), 'dd MMM yyyy')}</span>
                  </div>
                )}
                {isSales && (
                  <div className="text-sm text-muted-foreground">
                    Type: <Badge variant="outline" className="ml-1">{invoice.invoice_type}</Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <h4 className="font-medium mb-3">Line Items</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-center">GST %</TableHead>
                    <TableHead className="text-center">Incl. GST</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-center">{item.gst_percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.rate_includes_gst ? 'default' : 'outline'} className="text-xs">
                          {item.rate_includes_gst ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">₹{item.base_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₹{item.gst_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium">₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Deductions */}
            {deductionItems.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-destructive">Deductions</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-center">GST %</TableHead>
                      <TableHead className="text-center">Incl. GST</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductionItems.map((item) => (
                      <TableRow key={item.id} className="text-destructive">
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-center">{item.gst_percentage}%</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {item.rate_includes_gst ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">-₹{item.base_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">-₹{item.gst_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-medium">-₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST:</span>
                  <span>₹{invoice.gst_amount.toLocaleString('en-IN')}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>₹{invoice.total_amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Paid:</span>
                  <span>₹{invoice.amount_paid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-medium text-yellow-600">
                  <span>Balance Due:</span>
                  <span>₹{invoice.balance_due.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment History */}
            <div>
              <h4 className="font-medium mb-3">Payment History</h4>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{payment.payment_mode}</TableCell>
                        <TableCell>{payment.reference_number || '-'}</TableCell>
                        <TableCell className="text-right text-green-600">₹{payment.amount.toLocaleString('en-IN')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Notes */}
            {(invoice.notes || invoice.terms) && (
              <>
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  {invoice.notes && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Notes</h4>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Terms & Conditions</h4>
                      <p className="text-sm">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Status Update */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Update Status:</span>
                <Select
                  value={invoice.status}
                  onValueChange={(value: InvoiceStatus) => updateStatus(value)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {updatingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
