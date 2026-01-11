import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trip, TripStatus } from '@/types/database';
import { Loader2 } from 'lucide-react';

export default function DriverTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchTrips(); }, [user]);

  async function fetchTrips() {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single();
    if (!profile) return;

    const { data } = await supabase.from('trips').select(`*, bus:buses(registration_number), route:routes(route_name)`).eq('driver_id', profile.id).order('start_date', { ascending: false });
    setTrips(data as Trip[] || []);
    setLoading(false);
  }

  const getStatusBadge = (status: TripStatus) => {
    const v: Record<TripStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = { scheduled: 'outline', in_progress: 'default', completed: 'secondary', cancelled: 'destructive' };
    return <Badge variant={v[status]}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Card><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Trip #</TableHead><TableHead>Bus</TableHead><TableHead>Route</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Expense</TableHead></TableRow></TableHeader>
            <TableBody>{loading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : trips.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No trips assigned</TableCell></TableRow> : trips.map(t => <TableRow key={t.id}><TableCell className="font-medium">{t.trip_number}</TableCell><TableCell>{(t.bus as any)?.registration_number}</TableCell><TableCell>{(t.route as any)?.route_name}</TableCell><TableCell>{new Date(t.start_date).toLocaleDateString('en-IN')}</TableCell><TableCell>{getStatusBadge(t.status)}</TableCell><TableCell>₹{Number(t.total_expense).toLocaleString('en-IN')}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
