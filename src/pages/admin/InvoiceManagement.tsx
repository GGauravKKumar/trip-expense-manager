import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, FileText, Download, Eye, CreditCard, Search, Filter, ArrowUpRight, ArrowDownLeft, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import InvoiceDialog from '@/components/InvoiceDialog';
import InvoiceDetailDialog from '@/components/InvoiceDetailDialog';
import InvoicePaymentDialog from '@/components/InvoicePaymentDialog';
import ExcelJS from 'exceljs';
import { 
  Invoice, 
  InvoiceLineItem, 
  InvoiceDirection, 
  InvoiceStatus, 
  InvoiceCategory,
  INVOICE_CATEGORIES,
  INVOICE_STATUS_CONFIG 
} from '@/types/invoice';

// Re-export types for backward compatibility
export type { Invoice, InvoiceLineItem, InvoicePayment, InvoiceType, InvoiceStatus, InvoiceDirection, InvoiceCategory } from '@/types/invoice';

export default function InvoiceManagement() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<InvoiceDirection>('sales');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDirection, setCreateDirection] = useState<InvoiceDirection>('sales');
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
    const config = INVOICE_STATUS_CONFIG[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  function getCategoryBadge(category: InvoiceCategory) {
    const cat = INVOICE_CATEGORIES.find(c => c.value === category);
    return <Badge variant="outline" className="text-xs">{cat?.label || category}</Badge>;
  }

  function getTypeBadge(type: string) {
    const labels: Record<string, string> = {
      customer: 'Customer',
      online_app: 'Online App',
      charter: 'Charter',
    };
    return <Badge variant="secondary" className="text-xs">{labels[type] || type}</Badge>;
  }

  // Filter invoices by direction and other filters
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesDirection = (invoice.direction || 'sales') === activeTab;
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesType = typeFilter === 'all' || invoice.invoice_type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || invoice.category === categoryFilter;
    return matchesDirection && matchesSearch && matchesStatus && matchesType && matchesCategory;
  });

  // Separate totals for sales and purchases
  const salesInvoices = invoices.filter(inv => (inv.direction || 'sales') === 'sales');
  const purchaseInvoices = invoices.filter(inv => inv.direction === 'purchase');

  const salesTotal = salesInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const salesPaid = salesInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const salesPending = salesInvoices.reduce((sum, inv) => sum + inv.balance_due, 0);
  const salesOverdue = salesInvoices.filter(inv => inv.status === 'overdue').length;

  const purchaseTotal = purchaseInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const purchasePaid = purchaseInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const purchasePending = purchaseInvoices.reduce((sum, inv) => sum + inv.balance_due, 0);
  const purchaseOverdue = purchaseInvoices.filter(inv => inv.status === 'overdue').length;

  async function exportToExcel() {
    const invoiceIds = filteredInvoices.map(inv => inv.id);
    const { data: allLineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .in('invoice_id', invoiceIds);

    const workbook = new ExcelJS.Workbook();
    const directionLabel = activeTab === 'sales' ? 'Sales' : 'Purchase';
    
    const summarySheet = workbook.addWorksheet(`${directionLabel} Invoice Summary`);
    summarySheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 12 },
      { header: activeTab === 'sales' ? 'Customer' : 'Vendor', key: 'party', width: 25 },
      { header: 'GST Number', key: 'gst', width: 18 },
      { header: 'Category', key: 'category', width: 15 },
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
        party: activeTab === 'sales' ? inv.customer_name : (inv.vendor_name || inv.customer_name),
        gst: activeTab === 'sales' ? (inv.customer_gst || '') : (inv.vendor_gst || ''),
        category: INVOICE_CATEGORIES.find(c => c.value === inv.category)?.label || inv.category,
        type: inv.invoice_type,
        subtotal: inv.subtotal,
        gstAmount: inv.gst_amount,
        totalAmount: inv.total_amount,
        paid: inv.amount_paid,
        balance: inv.balance_due,
        status: inv.status,
      });
    });
    
    const lineItemsSheet = workbook.addWorksheet('Line Items Detail');
    lineItemsSheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Party', key: 'party', width: 25 },
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
        party: activeTab === 'sales' ? (invoice?.customer_name || '') : (invoice?.vendor_name || invoice?.customer_name || ''),
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
    a.download = `${directionLabel}_Invoices_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${directionLabel} invoices to Excel`);
  }

  function openCreateDialog(direction: InvoiceDirection) {
    setCreateDirection(direction);
    setCreateDialogOpen(true);
  }

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
            <p className="text-muted-foreground">Manage sales and purchase invoices with GST tracking</p>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                Sales Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">₹{salesTotal.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Received: ₹{salesPaid.toLocaleString('en-IN')} | Pending: ₹{salesPending.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-red-500" />
                Purchase Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">₹{purchaseTotal.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Paid: ₹{purchasePaid.toLocaleString('en-IN')} | Due: ₹{purchasePending.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-500" />
                GST Collected (Output)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                ₹{salesInvoices.reduce((sum, inv) => sum + inv.gst_amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">From {salesInvoices.length} sales invoices</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-500" />
                GST Paid (Input)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                ₹{purchaseInvoices.reduce((sum, inv) => sum + inv.gst_amount, 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">From {purchaseInvoices.length} purchase invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Sales and Purchase */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InvoiceDirection)}>
          <div className="flex items-center justify-between">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Sales Invoices ({salesInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="purchase" className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                Purchase Invoices ({purchaseInvoices.length})
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={() => openCreateDialog(activeTab)}>
                <Plus className="h-4 w-4 mr-2" />
                New {activeTab === 'sales' ? 'Sales' : 'Purchase'} Invoice
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label className="sr-only">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search by invoice number or ${activeTab === 'sales' ? 'customer' : 'vendor'}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-[150px]">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <Tag className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {INVOICE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {activeTab === 'sales' && (
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
                )}
              </div>
            </CardContent>
          </Card>

          <TabsContent value="sales" className="mt-4">
            <InvoiceTable
              invoices={filteredInvoices}
              direction="sales"
              onView={setViewingInvoice}
              onPayment={setPaymentInvoice}
              getStatusBadge={getStatusBadge}
              getCategoryBadge={getCategoryBadge}
              getTypeBadge={getTypeBadge}
            />
          </TabsContent>

          <TabsContent value="purchase" className="mt-4">
            <InvoiceTable
              invoices={filteredInvoices}
              direction="purchase"
              onView={setViewingInvoice}
              onPayment={setPaymentInvoice}
              getStatusBadge={getStatusBadge}
              getCategoryBadge={getCategoryBadge}
              getTypeBadge={getTypeBadge}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <InvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        direction={createDirection}
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
          direction={editingInvoice.direction || 'sales'}
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

// Extracted Invoice Table Component
interface InvoiceTableProps {
  invoices: Invoice[];
  direction: InvoiceDirection;
  onView: (invoice: Invoice) => void;
  onPayment: (invoice: Invoice) => void;
  getStatusBadge: (status: InvoiceStatus) => React.ReactNode;
  getCategoryBadge: (category: InvoiceCategory) => React.ReactNode;
  getTypeBadge: (type: string) => React.ReactNode;
}

function InvoiceTable({ invoices, direction, onView, onPayment, getStatusBadge, getCategoryBadge, getTypeBadge }: InvoiceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{direction === 'sales' ? 'Sales Invoices' : 'Purchase Invoices'}</CardTitle>
        <CardDescription>
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {direction} invoices found. Create your first {direction} invoice.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>{direction === 'sales' ? 'Customer' : 'Vendor'}</TableHead>
                <TableHead>Category</TableHead>
                {direction === 'sales' && <TableHead>Type</TableHead>}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    {direction === 'sales' 
                      ? invoice.customer_name 
                      : (invoice.vendor_name || invoice.customer_name)}
                  </TableCell>
                  <TableCell>{getCategoryBadge(invoice.category || 'general')}</TableCell>
                  {direction === 'sales' && <TableCell>{getTypeBadge(invoice.invoice_type)}</TableCell>}
                  <TableCell className="text-right font-medium">₹{invoice.total_amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right text-muted-foreground">₹{invoice.gst_amount.toLocaleString('en-IN')}</TableCell>
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
                        onClick={() => onView(invoice)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPayment(invoice)}
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
  );
}
