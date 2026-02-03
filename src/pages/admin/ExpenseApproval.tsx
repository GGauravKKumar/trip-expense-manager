import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { USE_PYTHON_API, getCloudClient } from '@/lib/backend';
import { apiClient } from '@/lib/api-client';
import { Expense, ExpenseStatus } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Check, X, Eye, Loader2, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, formatCurrency, formatDate } from '@/lib/exportUtils';
import { useTableFilters } from '@/hooks/useTableFilters';
import { SearchFilterBar, TablePagination } from '@/components/TableFilters';

export default function ExpenseApproval() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('pending');

  // Table filters
  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    showingFrom,
    showingTo,
    totalCount,
  } = useTableFilters({
    data: expenses,
    searchFields: [
      (exp) => (exp.trip as any)?.trip_number,
      (exp) => (exp.submitter as any)?.full_name,
      (exp) => (exp.category as any)?.name,
    ],
  });

  useEffect(() => {
    fetchExpenses();
  }, [statusFilter]);

  async function fetchExpenses() {
    try {
      if (USE_PYTHON_API) {
        const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
        const { data, error } = await apiClient.get<Expense[]>(`/expenses${statusParam}`);
        if (error) {
          toast.error('Failed to fetch expenses');
        } else {
          setExpenses(data || []);
        }
      } else {
        const supabase = await getCloudClient();
        let query = supabase
          .from('expenses')
          .select(`
            *,
            category:expense_categories(name, icon),
            trip:trips(trip_number),
            submitter:profiles!expenses_submitted_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) {
          toast.error('Failed to fetch expenses');
        } else {
          setExpenses((data || []) as unknown as Expense[]);
        }
      }
    } catch (err) {
      toast.error('Failed to fetch expenses');
    }
    setLoading(false);
  }

  function handleView(expense: Expense) {
    setSelectedExpense(expense);
    setRemarks('');
    setDialogOpen(true);
  }

  async function handleApprove() {
    if (!selectedExpense || !user) return;
    setSubmitting(true);

    try {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.put(`/expenses/${selectedExpense.id}`, {
          status: 'approved',
          admin_remarks: remarks || null,
        });

        if (error) {
          toast.error('Failed to approve expense');
        } else {
          toast.success('Expense approved and added to trip total');
          setDialogOpen(false);
          fetchExpenses();
        }
      } else {
        const supabase = await getCloudClient();
        // Get admin profile id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          toast.error('Admin profile not found');
          setSubmitting(false);
          return;
        }

        const { error } = await supabase
          .from('expenses')
          .update({
            status: 'approved',
            admin_remarks: remarks || null,
            approved_by: profile.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', selectedExpense.id);

        if (error) {
          toast.error('Failed to approve expense');
        } else {
          toast.success('Expense approved and added to trip total');
          setDialogOpen(false);
          fetchExpenses();
        }
      }
    } catch (err) {
      toast.error('Failed to approve expense');
    }
    setSubmitting(false);
  }

  async function handleDeny() {
    if (!selectedExpense || !user) return;
    if (!remarks.trim()) {
      toast.error('Please provide a reason for denial');
      return;
    }
    setSubmitting(true);

    try {
      if (USE_PYTHON_API) {
        const { error } = await apiClient.put(`/expenses/${selectedExpense.id}`, {
          status: 'denied',
          admin_remarks: remarks,
        });

        if (error) {
          toast.error('Failed to deny expense');
        } else {
          toast.success('Expense denied');
          setDialogOpen(false);
          fetchExpenses();
        }
      } else {
        const supabase = await getCloudClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          toast.error('Admin profile not found');
          setSubmitting(false);
          return;
        }

        const { error } = await supabase
          .from('expenses')
          .update({
            status: 'denied',
            admin_remarks: remarks,
            approved_by: profile.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', selectedExpense.id);

        if (error) {
          toast.error('Failed to deny expense');
        } else {
          toast.success('Expense denied');
          setDialogOpen(false);
          fetchExpenses();
        }
      }
    } catch (err) {
      toast.error('Failed to deny expense');
    }
    setSubmitting(false);
  }

  const getStatusBadge = (status: ExpenseStatus) => {
    const variants: Record<ExpenseStatus, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      approved: 'default',
      denied: 'destructive',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  function handleExportExpenses() {
    if (expenses.length === 0) return;

    exportToExcel(
      expenses,
      [
        { header: 'Trip #', key: 'trip', format: (v) => v?.trip_number || '-' },
        { header: 'Driver', key: 'submitter', format: (v) => v?.full_name || '-' },
        { header: 'Category', key: 'category', format: (v) => v?.name || '-' },
        { header: 'Amount', key: 'amount', format: (v) => Number(v) },
        { header: 'Date', key: 'expense_date', format: formatDate },
        { header: 'Status', key: 'status' },
        { header: 'Admin Remarks', key: 'admin_remarks', format: (v) => v || '-' },
      ],
      `expenses-${statusFilter}-report`
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Expense Approval</h1>
            <p className="text-muted-foreground">Review and approve driver expenses</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleExportExpenses} disabled={expenses.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <SearchFilterBar
          searchPlaceholder="Search by trip number, driver, or category..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip #</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {expenses.length === 0 ? 'No expenses found' : 'No expenses match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {(expense.trip as any)?.trip_number}
                      </TableCell>
                      <TableCell>{(expense.submitter as any)?.full_name}</TableCell>
                      <TableCell>{(expense.category as any)?.name}</TableCell>
                      <TableCell>₹{Number(expense.amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        {new Date(expense.expense_date).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell>
                        {expense.document_url ? (
                          <a
                            href={expense.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleView(expense)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              showingFrom={showingFrom}
              showingTo={showingTo}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemName="expenses"
            />
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
            </DialogHeader>
            {selectedExpense && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Trip</p>
                    <p className="font-medium">{(selectedExpense.trip as any)?.trip_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Driver</p>
                    <p className="font-medium">{(selectedExpense.submitter as any)?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{(selectedExpense.category as any)?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">
                      ₹{Number(selectedExpense.amount).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(selectedExpense.expense_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {getStatusBadge(selectedExpense.status)}
                  </div>
                </div>

                {selectedExpense.description && (
                  <div>
                    <p className="text-muted-foreground text-sm">Description</p>
                    <p>{selectedExpense.description}</p>
                  </div>
                )}

                {selectedExpense.document_url && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">Document</p>
                    <a
                      href={selectedExpense.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View uploaded document
                    </a>
                  </div>
                )}

                {selectedExpense.status === 'pending' && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-sm mb-2">
                        Admin Remarks {selectedExpense.status === 'pending' && '(required for denial)'}
                      </p>
                      <Textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add remarks..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleDeny}
                        disabled={submitting}
                      >
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <X className="h-4 w-4 mr-2" />
                        Deny
                      </Button>
                      <Button onClick={handleApprove} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  </>
                )}

                {selectedExpense.admin_remarks && selectedExpense.status !== 'pending' && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-sm">Admin Remarks</p>
                    <p>{selectedExpense.admin_remarks}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
