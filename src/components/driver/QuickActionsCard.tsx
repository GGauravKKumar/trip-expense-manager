import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, MapPin, Receipt, Gauge, User } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickActionsCardProps {
  hasActiveTrip: boolean;
  onUpdateOdometer?: () => void;
}

export default function QuickActionsCard({ hasActiveTrip, onUpdateOdometer }: QuickActionsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/driver/trips">
            <Button variant="outline" className="w-full h-20 flex-col gap-2">
              <MapPin className="h-5 w-5" />
              <span className="text-xs">My Trips</span>
            </Button>
          </Link>
          
          <Link to="/driver/expenses">
            <Button variant="outline" className="w-full h-20 flex-col gap-2">
              <Receipt className="h-5 w-5" />
              <span className="text-xs">Add Expense</span>
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            className="w-full h-20 flex-col gap-2"
            disabled={!hasActiveTrip}
            onClick={onUpdateOdometer}
          >
            <Gauge className="h-5 w-5" />
            <span className="text-xs">Update Odometer</span>
          </Button>
          
          <Link to="/driver/profile">
            <Button variant="outline" className="w-full h-20 flex-col gap-2">
              <User className="h-5 w-5" />
              <span className="text-xs">My Profile</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
