import { cn } from '@/lib/utils';
import { Moon, Sun, ArrowRight, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScheduleTimelineProps {
  departureTime: string;
  arrivalTime: string;
  isTwoWay: boolean;
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  compact?: boolean;
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isOvernightJourney(departure: string, arrival: string): boolean {
  return parseTimeToMinutes(arrival) < parseTimeToMinutes(departure);
}

function calculateTurnaround(arrival: string, departure: string): number {
  const arrivalMinutes = parseTimeToMinutes(arrival);
  const departureMinutes = parseTimeToMinutes(departure);
  
  let diff = departureMinutes - arrivalMinutes;
  if (diff < 0) diff += 24 * 60; // Handle overnight
  return diff / 60; // Return hours
}

export default function ScheduleTimeline({
  departureTime,
  arrivalTime,
  isTwoWay,
  returnDepartureTime,
  returnArrivalTime,
  compact = false,
}: ScheduleTimelineProps) {
  const outwardOvernight = isOvernightJourney(departureTime, arrivalTime);
  const returnOvernight = isTwoWay && returnDepartureTime && returnArrivalTime
    ? isOvernightJourney(returnDepartureTime, returnArrivalTime)
    : false;
  
  const turnaroundHours = isTwoWay && returnDepartureTime
    ? calculateTurnaround(arrivalTime, returnDepartureTime)
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <ArrowRight className="h-3 w-3 text-primary" />
          <span>{departureTime}</span>
          <span className="text-muted-foreground">→</span>
          <span>{arrivalTime}</span>
          {outwardOvernight && (
            <Moon className="h-3 w-3 text-blue-500" />
          )}
        </div>
        {isTwoWay && returnDepartureTime && (
          <>
            <span className="text-muted-foreground">|</span>
            <div className="flex items-center gap-1">
              <ArrowLeft className="h-3 w-3 text-secondary-foreground" />
              <span>{returnDepartureTime}</span>
              <span className="text-muted-foreground">→</span>
              <span>{returnArrivalTime || '--:--'}</span>
              {returnOvernight && (
                <Moon className="h-3 w-3 text-blue-500" />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      {/* Timeline Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Journey Timeline</span>
        {outwardOvernight && (
          <Badge variant="outline" className="ml-auto text-blue-600 border-blue-300">
            <Moon className="h-3 w-3 mr-1" />
            Overnight
          </Badge>
        )}
      </div>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Day 1 Section */}
        <div className="flex items-center gap-2 mb-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-muted-foreground">Day 1</span>
        </div>
        
        <div className="relative ml-6 pl-4 border-l-2 border-primary/30 space-y-3">
          {/* Outward Departure */}
          <div className="relative">
            <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-primary border-2 border-background" />
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{departureTime}</span>
              <span className="text-xs text-muted-foreground">Depart</span>
            </div>
          </div>

          {/* Outward Arrival (same day if not overnight) */}
          {!outwardOvernight && (
            <div className="relative">
              <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{arrivalTime}</span>
                <span className="text-xs text-muted-foreground">Arrive</span>
              </div>
            </div>
          )}
        </div>

        {/* Day 2 Section (for overnight journeys) */}
        {(outwardOvernight || (isTwoWay && returnDepartureTime)) && (
          <>
            <div className="flex items-center gap-2 mt-4 mb-2">
              <Moon className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Day 2</span>
            </div>
            
            <div className="relative ml-6 pl-4 border-l-2 border-secondary/30 space-y-3">
              {/* Outward Arrival (next day) */}
              {outwardOvernight && (
                <div className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{arrivalTime}</span>
                    <span className="text-xs text-muted-foreground">Arrive (Next Day)</span>
                  </div>
                </div>
              )}

              {/* Turnaround indicator */}
              {isTwoWay && returnDepartureTime && (
                <div className="relative py-1">
                  <div className="absolute -left-[18px] w-[2px] h-full bg-dashed border-l-2 border-dashed border-muted-foreground/30" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{turnaroundHours.toFixed(1)}h turnaround</span>
                    {turnaroundHours < 2 && (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>
              )}

              {/* Return Departure */}
              {isTwoWay && returnDepartureTime && (
                <div className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-secondary border-2 border-background" />
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4 text-secondary-foreground" />
                    <span className="text-sm font-medium">{returnDepartureTime}</span>
                    <span className="text-xs text-muted-foreground">Return Depart</span>
                  </div>
                </div>
              )}

              {/* Return Arrival (same day if not overnight) */}
              {isTwoWay && returnArrivalTime && !returnOvernight && (
                <div className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{returnArrivalTime}</span>
                    <span className="text-xs text-muted-foreground">Return Arrive</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Day 3 (for return overnight journeys) */}
        {returnOvernight && (
          <>
            <div className="flex items-center gap-2 mt-4 mb-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Day 3</span>
            </div>
            
            <div className="relative ml-6 pl-4 border-l-2 border-green-500/30 space-y-3">
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{returnArrivalTime}</span>
                  <span className="text-xs text-muted-foreground">Return Arrive (Next Day)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
        {outwardOvernight && (
          <span className="flex items-center gap-1">
            <Moon className="h-3 w-3" />
            Outward: Overnight journey
          </span>
        )}
        {returnOvernight && (
          <span className="flex items-center gap-1">
            <Moon className="h-3 w-3" />
            Return: Overnight journey
          </span>
        )}
      </div>
    </div>
  );
}
