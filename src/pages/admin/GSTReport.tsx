import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, Download, Calendar, TrendingUp, TrendingDown, 
  IndianRupee, ArrowRight, ArrowLeft, Loader2, PieChart
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';
import ExcelJS from 'exceljs';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface GSTSummary {
  period: string;
  outputGST: number; // GST collected from revenue
  inputGST: number;  // GST on expenses (estimated)
  netGST: number;    // Output - Input
  totalRevenue: number;
  totalExpenses: number;
}

interface InvoiceGSTData {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
}

interface TripGSTData {
  id: string;
  trip_number: string;
  trip_date: string;
  total_revenue: number;
  gst_amount: number;
  net_revenue: number;
}

export default function GSTReport() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<GSTSummary>({
    period: '',
    outputGST: 0,
    inputGST: 0,
    netGST: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  });
  const [invoices, setInvoices] = useState<InvoiceGSTData[]>([]);
  const [tripGST, setTripGST] = useState<TripGSTData[]>([]);
  const [gstPercentage, setGstPercentage] = useState(18);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  function handlePeriodChange(value: string) {
    setPeriod(value);
    const now = new Date();
    
    switch (value) {
      case 'month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'quarter':
        setStartDate(format(startOfQuarter(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfQuarter(now), 'yyyy-MM-dd'));
        break;
      case 'year':
        setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfYear(now), 'yyyy-MM-dd'));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
    }
  }

  async function fetchData() {
    setLoading(true);

    // Fetch GST percentage from settings
    const { data: gstSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'default_gst_percentage')
      .single();
    
    if (gstSetting?.value) {
      setGstPercentage(parseFloat(gstSetting.value));
    }

    await Promise.all([
      fetchInvoiceGST(),
      fetchTripGST(),
      fetchExpenseGST(),
    ]);

    setLoading(false);
  }

  async function fetchInvoiceGST() {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, invoice_date, subtotal, gst_amount, total_amount')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .neq('status', 'cancelled')
      .order('invoice_date', { ascending: false });

    setInvoices((data || []) as InvoiceGSTData[]);
  }

  async function fetchTripGST() {
    const { data } = await supabase
      .from('trips')
      .select('id, trip_number, trip_date, total_revenue, return_total_revenue, gst_percentage')
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .eq('status', 'completed');

    if (data) {
      const tripData: TripGSTData[] = data.map(trip => {
        const totalRev = (Number(trip.total_revenue) || 0) + (Number(trip.return_total_revenue) || 0);
        const gstRate = trip.gst_percentage || 18;
        const gstAmount = totalRev - (totalRev / (1 + gstRate / 100));
        
        return {
          id: trip.id,
          trip_number: trip.trip_number,
          trip_date: trip.trip_date || '',
          total_revenue: totalRev,
          gst_amount: gstAmount,
          net_revenue: totalRev - gstAmount,
        };
      });
      setTripGST(tripData);
    }
  }

  async function fetchExpenseGST() {
    // Fetch approved expenses for input GST estimation
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('status', 'approved')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    
    // Calculate totals
    const invoiceGST = invoices.reduce((sum, inv) => sum + Number(inv.gst_amount), 0);
    const tripGSTTotal = tripGST.reduce((sum, trip) => sum + trip.gst_amount, 0);
    const outputGST = invoiceGST + tripGSTTotal;
    
    // Estimate input GST (assumed 18% on certain expense categories like fuel, repairs)
    const estimatedInputGST = totalExpenses * 0.15; // Approximate 15% average GST on expenses
    
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0) +
                         tripGST.reduce((sum, trip) => sum + trip.total_revenue, 0);

    setSummary({
      period: `${format(new Date(startDate), 'dd MMM yyyy')} - ${format(new Date(endDate), 'dd MMM yyyy')}`,
      outputGST,
      inputGST: estimatedInputGST,
      netGST: outputGST - estimatedInputGST,
      totalRevenue,
      totalExpenses,
    });
  }

  useEffect(() => {
    if (invoices.length > 0 || tripGST.length > 0) {
      fetchExpenseGST();
    }
  }, [invoices, tripGST, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const pieData = [
    { name: 'Output GST (Collected)', value: summary.outputGST, color: 'hsl(var(--chart-1))' },
    { name: 'Input GST (Paid)', value: summary.inputGST, color: 'hsl(var(--chart-2))' },
  ];

  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fleet Manager';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('GST Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Amount (₹)', key: 'amount', width: 20 },
    ];
    summarySheet.addRows([
      { metric: 'Period', amount: summary.period },
      { metric: 'Total Revenue', amount: summary.totalRevenue },
      { metric: 'Total Expenses', amount: summary.totalExpenses },
      { metric: 'Output GST (Collected)', amount: summary.outputGST },
      { metric: 'Input GST (Paid - Estimated)', amount: summary.inputGST },
      { metric: 'Net GST Payable', amount: summary.netGST },
    ]);

    // Invoice GST Sheet
    const invoiceSheet = workbook.addWorksheet('Invoice GST');
    invoiceSheet.columns = [
      { header: 'Invoice #', key: 'invoice_number', width: 15 },
      { header: 'Customer', key: 'customer_name', width: 25 },
      { header: 'Date', key: 'invoice_date', width: 12 },
      { header: 'Base Amount', key: 'subtotal', width: 15 },
      { header: 'GST Amount', key: 'gst_amount', width: 15 },
      { header: 'Total', key: 'total_amount', width: 15 },
    ];
    invoiceSheet.addRows(invoices.map(inv => ({
      ...inv,
      invoice_date: format(new Date(inv.invoice_date), 'dd-MM-yyyy'),
    })));

    // Trip GST Sheet
    const tripSheet = workbook.addWorksheet('Trip GST');
    tripSheet.columns = [
      { header: 'Trip #', key: 'trip_number', width: 15 },
      { header: 'Date', key: 'trip_date', width: 12 },
      { header: 'Total Revenue', key: 'total_revenue', width: 15 },
      { header: 'GST Amount', key: 'gst_amount', width: 15 },
      { header: 'Net Revenue', key: 'net_revenue', width: 15 },
    ];
    tripSheet.addRows(tripGST.map(trip => ({
      ...trip,
      trip_date: trip.trip_date ? format(new Date(trip.trip_date), 'dd-MM-yyyy') : '-',
    })));

    // Style headers
    [summarySheet, invoiceSheet, tripSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Report_${format(new Date(startDate), 'MMMyyyy')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              GST Report
            </h1>
            <p className="text-muted-foreground">Monthly GST summary and tax compliance</p>
          </div>
          <Button onClick={exportToExcel} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>From</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => { setPeriod('custom'); setStartDate(e.target.value); }} 
                />
              </div>
              
              <div className="space-y-2">
                <Label>To</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => { setPeriod('custom'); setEndDate(e.target.value); }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Output GST (Collected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.outputGST)}
                  </div>
                  <p className="text-xs text-muted-foreground">From invoices & trips</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Input GST (Paid)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.inputGST)}
                  </div>
                  <p className="text-xs text-muted-foreground">Estimated from expenses</p>
                </CardContent>
              </Card>

              <Card className={summary.netGST >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Net GST {summary.netGST >= 0 ? 'Payable' : 'Credit'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${summary.netGST >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(Math.abs(summary.netGST))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.netGST >= 0 ? 'To be paid to government' : 'Credit available'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">{summary.period}</div>
                  <p className="text-xs text-muted-foreground">
                    Revenue: {formatCurrency(summary.totalRevenue)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Tables */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    GST Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${formatCurrency(value)}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">GSTR-1 Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">B2B Invoices</span>
                      <span className="font-medium">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">B2C (Trip Revenue)</span>
                      <span className="font-medium">{tripGST.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Taxable Value</span>
                      <span className="font-medium">{formatCurrency(summary.totalRevenue - summary.outputGST)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Total GST Liability</span>
                      <span className="font-bold text-primary">{formatCurrency(summary.outputGST)}</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <p><strong>Note:</strong> Input GST is estimated based on expense categories. 
                    Actual ITC claims should be verified against GST invoices.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoice Details Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Invoice GST Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Base Amount</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No invoices found for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.slice(0, 10).map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.customer_name}</TableCell>
                          <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.subtotal)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.gst_amount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {invoices.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Showing 10 of {invoices.length} invoices. Export to Excel for full list.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Trip GST Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Trip Revenue GST Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trip #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">GST (18%)</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripGST.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No completed trips found for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      tripGST.slice(0, 10).map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell className="font-medium">{trip.trip_number}</TableCell>
                          <TableCell>{trip.trip_date ? format(new Date(trip.trip_date), 'dd MMM yyyy') : '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(trip.total_revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(trip.gst_amount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(trip.net_revenue)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {tripGST.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Showing 10 of {tripGST.length} trips. Export to Excel for full list.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
