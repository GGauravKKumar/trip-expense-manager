import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeft, Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface TripTimelineProps {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  tripType: 'one_way' | 'two_way';
  departureTime?: string | null;
  arrivalTime?: string | null;
  returnDepartureTime?: string | null;
  returnArrivalTime?: string | null;
  compact?: boolean;
}

const statusConfig = {
  scheduled: { color: 'bg-yellow-500', textColor: 'text-yellow-600', label: 'Scheduled', icon: Calendar },
  in_progress: { color: 'bg-blue-500', textColor: 'text-blue-600', label: 'In Progress', icon: Clock },
  completed: { color: 'bg-green-500', textColor: 'text-green-600', label: 'Completed', icon: CheckCircle },
  cancelled: { color: 'bg-red-500', textColor: 'text-red-600', label: 'Cancelled', icon: XCircle },
};

export default function TripTimeline({ 
  status, 
  tripType, 
  departureTime, 
  arrivalTime,
  returnDepartureTime,
  returnArrivalTime,
  compact = false 
}: TripTimelineProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const isTwoWay = tripType === 'two_way';

  // Progress calculation
  const getProgress = () => {
    switch (status) {
      case 'scheduled': return 0;
      case 'in_progress': return 50;
      case 'completed': return 100;
      case 'cancelled': return 0;
      default: return 0;
    }
  };

  if (compact) {
    return (
      <div className="space-y-1">
        {/* Outward Journey */}
        <div className="flex items-center gap-2 text-xs">
          <div className={cn('w-2 h-2 rounded-full', config.color)} />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            {departureTime || '--:--'} → {arrivalTime || '--:--'}
          </span>
        </div>
        
        {/* Return Journey */}
        {isTwoWay && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-muted" />
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {returnDepartureTime || '--:--'} → {returnArrivalTime || '--:--'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn('font-medium', config.textColor)}>
            <StatusIcon className="h-3 w-3 inline mr-1" />
            {config.label}
          </span>
        </div>
        
        {/* Progress Track */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('absolute top-0 left-0 h-full rounded-full transition-all duration-500', config.color)}
            style={{ width: `${getProgress()}%` }}
          />
          
          {/* Milestones */}
          <div className="absolute top-0 left-0 w-full h-full flex justify-between items-center px-0">
            <div className={cn(
              'w-3 h-3 rounded-full border-2 border-background z-10',
              status !== 'cancelled' ? config.color : 'bg-muted'
            )} />
            <div className={cn(
              'w-3 h-3 rounded-full border-2 border-background z-10',
              status === 'in_progress' || status === 'completed' ? config.color : 'bg-muted'
            )} />
            <div className={cn(
              'w-3 h-3 rounded-full border-2 border-background z-10',
              status === 'completed' ? config.color : 'bg-muted'
            )} />
          </div>
        </div>
        
        {/* Labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Scheduled</span>
          <span>In Progress</span>
          <span>Completed</span>
        </div>
      </div>

      {/* Journey Timeline */}
      <div className="space-y-2 pt-2 border-t">
        {/* Outward Journey */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
            <ArrowRight className="h-3 w-3 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium">Outward Journey</div>
            <div className="text-xs text-muted-foreground">
              Dep: {departureTime || '--:--'} • Arr: {arrivalTime || '--:--'}
            </div>
          </div>
        </div>
        
        {/* Connection Line */}
        {isTwoWay && (
          <div className="ml-3 border-l-2 border-dashed border-muted h-4" />
        )}
        
        {/* Return Journey */}
        {isTwoWay && (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary">
              <ArrowLeft className="h-3 w-3 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Return Journey</div>
              <div className="text-xs text-muted-foreground">
                Dep: {returnDepartureTime || '--:--'} • Arr: {returnArrivalTime || '--:--'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
