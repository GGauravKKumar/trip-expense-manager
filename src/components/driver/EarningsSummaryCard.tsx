import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, Truck, Route } from 'lucide-react';
import { format } from 'date-fns';

interface EarningsSummaryProps {
  monthlyTrips: number;
  totalDistance: number;
}

export default function EarningsSummaryCard({ monthlyTrips, totalDistance }: EarningsSummaryProps) {
  const now = new Date();
  const monthName = format(now, 'MMMM yyyy');

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Monthly Summary
        </CardTitle>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {monthName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
              {monthlyTrips}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Truck className="h-3 w-3" />
              Trips Completed
            </div>
          </div>
          
          <div className="text-center border-l border-primary/20">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
              {totalDistance.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Route className="h-3 w-3" />
              km Driven
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
