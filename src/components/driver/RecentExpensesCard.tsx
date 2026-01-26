import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface Expense {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'denied';
  expense_date: string;
  category?: { name: string };
  trip?: { trip_number: string };
}

interface RecentExpensesCardProps {
  expenses: Expense[];
}

export default function RecentExpensesCard({ expenses }: RecentExpensesCardProps) {
  const recentExpenses = expenses.slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'denied':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'secondary',
      denied: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (recentExpenses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Recent Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            No expenses submitted yet
          </p>
          <Link to="/driver/expenses" className="block">
            <Button variant="outline" className="w-full">
              Add Your First Expense
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Recent Expenses
          </CardTitle>
          <Link to="/driver/expenses">
            <Button variant="ghost" size="sm" className="text-xs">
              View All →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentExpenses.map((expense) => (
          <div
            key={expense.id}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(expense.status)}
              <div>
                <div className="text-sm font-medium">
                  ₹{expense.amount.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expense.category?.name || 'Expense'} • {expense.trip?.trip_number || 'N/A'}
                </div>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(expense.status)}
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(expense.expense_date), 'dd MMM')}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
