import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Truck, MapPin, Gauge, Clock, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Trip } from '@/types/database';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { Link } from 'react-router-dom';

interface ActiveTripCardProps {
  trip: Trip | null;
  onUpdateOdometer: () => void;
  onCompleteTrip: () => void;
}

export default function ActiveTripCard({ trip, onUpdateOdometer, onCompleteTrip }: ActiveTripCardProps) {
  if (!trip) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Active Trip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            No active trip at the moment
          </p>
          <Link to="/driver/trips" className="block">
            <Button variant="outline" className="w-full mt-2">
              View Scheduled Trips
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const bus = trip.bus as any;
  const route = trip.route as any;
  const startTime = new Date(trip.start_date);
  const now = new Date();
  const hoursElapsed = differenceInHours(now, startTime);
  const minutesElapsed = differenceInMinutes(now, startTime) % 60;

  // Calculate completion progress based on odometer readings
  const hasOutwardStart = !!trip.odometer_start;
  const hasOutwardEnd = !!trip.odometer_end;
  const hasReturnStart = !!trip.odometer_return_start;
  const hasReturnEnd = !!trip.odometer_return_end;
  
  const isTwoWay = trip.trip_type === 'two_way';
  const totalSteps = isTwoWay ? 4 : 2;
  const completedSteps = [hasOutwardStart, hasOutwardEnd, ...(isTwoWay ? [hasReturnStart, hasReturnEnd] : [])].filter(Boolean).length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  const canComplete = isTwoWay 
    ? hasOutwardStart && hasOutwardEnd && hasReturnStart && hasReturnEnd
    : hasOutwardStart && hasOutwardEnd;

  // Calculate distance
  const outwardDistance = Number(trip.distance_traveled) || 0;
  const returnDistance = Number(trip.distance_return) || 0;
  const totalDistance = outwardDistance + returnDistance;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Active Trip
          </CardTitle>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            In Progress
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trip Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{trip.trip_number}</span>
            <Badge variant={isTwoWay ? 'default' : 'outline'}>
              {isTwoWay ? 'Two-Way' : 'One-Way'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-3 w-3" />
              {bus?.registration_number || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {route?.route_name || 'N/A'}
            </div>
          </div>

          {/* Time Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Started: {format(startTime, 'HH:mm')}
            </div>
            <div className="text-primary font-medium">
              {hoursElapsed}h {minutesElapsed}m elapsed
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Odometer Progress</span>
            <span className="font-medium">{completedSteps}/{totalSteps} readings</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {/* Odometer Status */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-1 ${hasOutwardStart ? 'text-green-600' : 'text-muted-foreground'}`}>
              <ArrowRight className="h-3 w-3" />
              Start: {trip.odometer_start || 'Not set'}
            </div>
            <div className={`flex items-center gap-1 ${hasOutwardEnd ? 'text-green-600' : 'text-muted-foreground'}`}>
              <ArrowRight className="h-3 w-3" />
              End: {trip.odometer_end || 'Not set'}
            </div>
            {isTwoWay && (
              <>
                <div className={`flex items-center gap-1 ${hasReturnStart ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <ArrowLeft className="h-3 w-3" />
                  Return Start: {trip.odometer_return_start || 'Not set'}
                </div>
                <div className={`flex items-center gap-1 ${hasReturnEnd ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <ArrowLeft className="h-3 w-3" />
                  Return End: {trip.odometer_return_end || 'Not set'}
                </div>
              </>
            )}
          </div>

          {totalDistance > 0 && (
            <div className="text-sm font-medium text-center pt-2">
              Total Distance: {totalDistance} km
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onUpdateOdometer}>
            <Gauge className="h-4 w-4 mr-1" />
            Update Odometer
          </Button>
          <Button 
            className="flex-1" 
            disabled={!canComplete}
            onClick={onCompleteTrip}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Complete
          </Button>
        </div>

        {!canComplete && (
          <p className="text-xs text-muted-foreground text-center">
            Complete all odometer readings to finish the trip
          </p>
        )}
      </CardContent>
    </Card>
  );
}
