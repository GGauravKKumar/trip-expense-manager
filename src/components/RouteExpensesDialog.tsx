import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download } from 'lucide-react';
import { exportToExcel, formatCurrency, formatDate } from '@/lib/exportUtils';
import { ExpenseStatus } from '@/types/database';

interface RouteExpense {
  id: string;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
  description: string | null;
  trip: { trip_number: string } | null;
  category: { name: string } | null;
  submitter: { full_name: string } | null;
}

interface RouteExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  routeName: string;
}

export default function RouteExpensesDialog({
  open,
  onOpenChange,
  routeId,
  routeName,
}: RouteExpensesDialogProps) {
  const [expenses, setExpenses] = useState<RouteExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (open && routeId) {
      fetchExpenses();
    }
  }, [open, routeId]);

  async function fetchExpenses() {
    setLoading(true);
    
    // First get all trips for this route
    const { data: trips } = await supabase
      .from('trips')
      .select('id')
      .eq('route_id', routeId);

    if (!trips || trips.length === 0) {
      setExpenses([]);
      setTotalAmount(0);
      setLoading(false);
      return;
    }

    const tripIds = trips.map(t => t.id);

    // Then get all expenses for those trips
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        id, amount, expense_date, status, description,
        trip:trips(trip_number),
        category:expense_categories(name),
        submitter:profiles!expenses_submitted_by_fkey(full_name)
      `)
      .in('trip_id', tripIds)
      .eq('status', 'approved')
      .order('expense_date', { ascending: false });

    if (!error && data) {
      setExpenses(data as RouteExpense[]);
      setTotalAmount(data.reduce((sum, e) => sum + Number(e.amount), 0));
    }
    setLoading(false);
  }

  async function handleExport() {
    if (expenses.length === 0) return;

    await exportToExcel(
      expenses,
      [
        { header: 'Trip #', key: 'trip', format: (v) => v?.trip_number || '-' },
        { header: 'Driver', key: 'submitter', format: (v) => v?.full_name || '-' },
        { header: 'Category', key: 'category', format: (v) => v?.name || '-' },
        { header: 'Amount', key: 'amount', format: (v) => Number(v) },
        { header: 'Date', key: 'expense_date', format: formatDate },
        { header: 'Description', key: 'description', format: (v) => v || '-' },
      ],
      `route-expenses-${routeName.replace(/\s+/g, '-').toLowerCase()}`
    );
  }

  const getStatusBadge = (status: ExpenseStatus) => (
    <Badge variant={status === 'approved' ? 'default' : status === 'denied' ? 'destructive' : 'secondary'}>
      {status}
    </Badge>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Route Expenses: {routeName}</span>
            {expenses.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No approved expenses found for this route
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Approved Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip #</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.trip?.trip_number || '-'}
                      </TableCell>
                      <TableCell>{expense.submitter?.full_name || '-'}</TableCell>
                      <TableCell>{expense.category?.name || '-'}</TableCell>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
