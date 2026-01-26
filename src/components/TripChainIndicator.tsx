import { cn } from '@/lib/utils';
import { Link, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TripChainIndicatorProps {
  previousTripId?: string | null;
  nextTripId?: string | null;
  previousTripNumber?: string;
  nextTripNumber?: string;
  cyclePosition?: number;
  compact?: boolean;
}

export default function TripChainIndicator({
  previousTripId,
  nextTripId,
  previousTripNumber,
  nextTripNumber,
  cyclePosition = 1,
  compact = false,
}: TripChainIndicatorProps) {
  const hasChain = previousTripId || nextTripId;

  if (!hasChain) {
    return null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-help gap-1 text-xs">
              <Link className="h-3 w-3" />
              Cycle #{cyclePosition}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              {previousTripId && (
                <div className="flex items-center gap-1">
                  <ChevronLeft className="h-3 w-3" />
                  From: {previousTripNumber || 'Previous day'}
                </div>
              )}
              {nextTripId && (
                <div className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  To: {nextTripNumber || 'Next day'}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
      <Link className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">Trip Chain</span>
      
      <div className="flex items-center gap-1 ml-auto">
        {previousTripId && (
          <Badge variant="outline" className="text-xs">
            <ChevronLeft className="h-3 w-3 mr-1" />
            {previousTripNumber || 'Previous'}
          </Badge>
        )}
        
        <Badge variant="secondary" className="text-xs">
          #{cyclePosition}
        </Badge>
        
        {nextTripId && (
          <Badge variant="outline" className="text-xs">
            {nextTripNumber || 'Next'}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Badge>
        )}
      </div>
    </div>
  );
}
