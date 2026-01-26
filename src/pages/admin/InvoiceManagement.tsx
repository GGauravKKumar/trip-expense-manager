import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, FileText, Download, Eye, CreditCard, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import InvoiceDialog from '@/components/InvoiceDialog';
import InvoiceDetailDialog from '@/components/InvoiceDetailDialog';
import InvoicePaymentDialog from '@/components/InvoicePaymentDialog';
import ExcelJS from 'exceljs';

export type InvoiceType = 'customer' | 'online_app' | 'charter';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  customer_gst: string | null;
  invoice_type: InvoiceType;
  trip_id: string | null;
  bus_id: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  is_deduction: boolean;
  gst_percentage: number;
  rate_includes_gst: boolean;
  base_amount: number;
  gst_amount: number;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export default function InvoiceManagement() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load invoices');
      console.error(error);
    } else {
      setInvoices((data || []) as Invoice[]);
    }
    setLoading(false);
  }

  function getStatusBadge(status: InvoiceStatus) {
    const variants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      sent: 'outline',
      partial: 'default',
      paid: 'default',
      overdue: 'destructive',
      cancelled: 'destructive',
    };
    const colors: Record<InvoiceStatus, string> = {
      draft: '',
      sent: '',
      partial: 'bg-yellow-500',
      paid: 'bg-green-500',
      overdue: '',
      cancelled: '',
    };
    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  }

  function getTypeBadge(type: InvoiceType) {
    const labels: Record<InvoiceType, string> = {
      customer: 'Customer',
      online_app: 'Online App',
      charter: 'Charter',
    };
    return <Badge variant="outline">{labels[type]}</Badge>;
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesType = typeFilter === 'all' || invoice.invoice_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  async function exportToExcel() {
    // Fetch all line items for filtered invoices
    const invoiceIds = filteredInvoices.map(inv => inv.id);
    const { data: allLineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .in('invoice_id', invoiceIds);

    const workbook = new ExcelJS.Workbook();
    
    // Create invoice summary sheet
    const summarySheet = workbook.addWorksheet('Invoice Summary');
    summarySheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 12 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Customer GST', key: 'customerGst', width: 18 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Subtotal (Base)', key: 'subtotal', width: 15 },
      { header: 'Total GST', key: 'gstAmount', width: 12 },
      { header: 'Grand Total', key: 'totalAmount', width: 12 },
      { header: 'Paid', key: 'paid', width: 12 },
      { header: 'Balance', key: 'balance', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
    ];
    
    filteredInvoices.forEach((inv) => {
      summarySheet.addRow({
        invoiceNumber: inv.invoice_number,
        date: format(new Date(inv.invoice_date), 'dd/MM/yyyy'),
        dueDate: inv.due_date ? format(new Date(inv.due_date), 'dd/MM/yyyy') : '',
        customer: inv.customer_name,
        customerGst: inv.customer_gst || '',
        type: inv.invoice_type,
        subtotal: inv.subtotal,
        gstAmount: inv.gst_amount,
        totalAmount: inv.total_amount,
        paid: inv.amount_paid,
        balance: inv.balance_due,
        status: inv.status,
      });
    });
    
    // Create line items detail sheet
    const lineItemsSheet = workbook.addWorksheet('Line Items Detail');
    lineItemsSheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Rate', key: 'unitRate', width: 12 },
      { header: 'Rate Includes GST', key: 'rateIncludesGst', width: 16 },
      { header: 'GST %', key: 'gstPercentage', width: 8 },
      { header: 'Base Amount', key: 'baseAmount', width: 12 },
      { header: 'GST Amount', key: 'gstAmount', width: 12 },
      { header: 'Total Amount', key: 'totalAmount', width: 12 },
      { header: 'Is Deduction', key: 'isDeduction', width: 12 },
    ];
    
    (allLineItems || []).forEach((item: InvoiceLineItem) => {
      const invoice = filteredInvoices.find(inv => inv.id === item.invoice_id);
      lineItemsSheet.addRow({
        invoiceNumber: invoice?.invoice_number || '',
        customer: invoice?.customer_name || '',
        description: item.description,
        quantity: item.quantity,
        unitRate: item.unit_price,
        rateIncludesGst: item.rate_includes_gst ? 'Yes' : 'No',
        gstPercentage: item.gst_percentage,
        baseAmount: item.base_amount,
        gstAmount: item.gst_amount,
        totalAmount: item.amount,
        isDeduction: item.is_deduction ? 'Yes' : 'No',
      });
    });
    
    // Style header rows
    [summarySheet, lineItemsSheet].forEach(sheet => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoices_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Exported to Excel with GST details');
  }

  // Summary calculations
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalPending = invoices.reduce((sum, inv) => sum + inv.balance_due, 0);
  const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Invoice Management
            </h1>
            <p className="text-muted-foreground">Manage customer invoices, online app invoices, and payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{totalAmount.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">₹{totalPending.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="sr-only">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by invoice number or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-[150px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="online_app">Online App</SelectItem>
                    <SelectItem value="charter">Charter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invoices found. Create your first invoice.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{getTypeBadge(invoice.invoice_type)}</TableCell>
                      <TableCell className="text-right">₹{invoice.total_amount.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">
                        <span className={invoice.balance_due > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          ₹{invoice.balance_due.toLocaleString('en-IN')}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingInvoice(invoice)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPaymentInvoice(invoice)}
                            title="Record Payment"
                            disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <InvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchInvoices}
      />

      {viewingInvoice && (
        <InvoiceDetailDialog
          invoice={viewingInvoice}
          open={!!viewingInvoice}
          onOpenChange={(open) => !open && setViewingInvoice(null)}
          onEdit={() => {
            setEditingInvoice(viewingInvoice);
            setViewingInvoice(null);
          }}
          onRefresh={fetchInvoices}
        />
      )}

      {editingInvoice && (
        <InvoiceDialog
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          invoice={editingInvoice}
          onSuccess={() => {
            fetchInvoices();
            setEditingInvoice(null);
          }}
        />
      )}

      {paymentInvoice && (
        <InvoicePaymentDialog
          invoice={paymentInvoice}
          open={!!paymentInvoice}
          onOpenChange={(open) => !open && setPaymentInvoice(null)}
          onSuccess={() => {
            fetchInvoices();
            setPaymentInvoice(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
