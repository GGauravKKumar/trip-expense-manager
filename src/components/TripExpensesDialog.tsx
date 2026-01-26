import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download } from 'lucide-react';
import { exportToExcel, formatCurrency, formatDate } from '@/lib/exportUtils';
import { ExpenseStatus } from '@/types/database';

interface TripExpense {
  id: string;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
  description: string | null;
  category: { name: string } | null;
  submitter: { full_name: string } | null;
}

interface TripExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripNumber: string;
}

export default function TripExpensesDialog({
  open,
  onOpenChange,
  tripId,
  tripNumber,
}: TripExpensesDialogProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, denied: 0 });

  useEffect(() => {
    if (open && tripId) {
      fetchExpenses();
    }
  }, [open, tripId]);

  async function fetchExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        id, amount, expense_date, status, description,
        category:expense_categories(name),
        submitter:profiles!expenses_submitted_by_fkey(full_name)
      `)
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false });

    if (!error && data) {
      setExpenses(data as TripExpense[]);
      
      const approved = data.filter(e => e.status === 'approved');
      const pending = data.filter(e => e.status === 'pending');
      const denied = data.filter(e => e.status === 'denied');
      
      setStats({
        total: data.reduce((sum, e) => sum + Number(e.amount), 0),
        approved: approved.reduce((sum, e) => sum + Number(e.amount), 0),
        pending: pending.length,
        denied: denied.length,
      });
    }
    setLoading(false);
  }

  async function handleExport() {
    if (expenses.length === 0) return;

    await exportToExcel(
      expenses,
      [
        { header: 'Category', key: 'category', format: (v) => v?.name || '-' },
        { header: 'Driver', key: 'submitter', format: (v) => v?.full_name || '-' },
        { header: 'Amount', key: 'amount', format: (v) => Number(v) },
        { header: 'Date', key: 'expense_date', format: formatDate },
        { header: 'Status', key: 'status' },
        { header: 'Description', key: 'description', format: (v) => v || '-' },
      ],
      `trip-expenses-${tripNumber}`
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
            <span>Trip Expenses: {tripNumber}</span>
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
              No expenses found for this trip
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Approved Total</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(stats.approved)}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold text-orange-600">{stats.pending} items</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Denied</p>
                  <p className="text-xl font-bold text-red-600">{stats.denied} items</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.category?.name || '-'}</TableCell>
                      <TableCell>{expense.submitter?.full_name || '-'}</TableCell>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description || '-'}</TableCell>
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
