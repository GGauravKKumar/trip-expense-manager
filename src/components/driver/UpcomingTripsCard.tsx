import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, ArrowRight, Play } from 'lucide-react';
import { Trip } from '@/types/database';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface UpcomingTripsCardProps {
  trips: Trip[];
  onStartTrip: (trip: Trip) => void;
}

export default function UpcomingTripsCard({ trips, onStartTrip }: UpcomingTripsCardProps) {
  const scheduledTrips = trips
    .filter(t => t.status === 'scheduled')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 3);

  if (scheduledTrips.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Trips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            No upcoming trips scheduled
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming Trips
          </CardTitle>
          <Link to="/driver/trips">
            <Button variant="ghost" size="sm" className="text-xs">
              View All →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scheduledTrips.map((trip) => {
          const startDate = parseISO(trip.start_date);
          const timeUntil = formatDistanceToNow(startDate, { addSuffix: true });
          const isToday = format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          const bus = trip.bus as any;
          const route = trip.route as any;

          return (
            <div
              key={trip.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{trip.trip_number}</span>
                  <Badge variant={trip.trip_type === 'two_way' ? 'default' : 'outline'} className="text-xs">
                    {trip.trip_type === 'two_way' ? 'Two-Way' : 'One-Way'}
                  </Badge>
                  {isToday && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      Today
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {route?.route_name || 'Unknown route'}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {trip.departure_time || format(startDate, 'HH:mm')}
                  </span>
                  <span className="text-primary font-medium">{timeUntil}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => onStartTrip(trip)}>
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
