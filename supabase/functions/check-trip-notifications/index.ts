import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get trips starting within next 24 hours that are still scheduled and missing odometer
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: upcomingTrips, error: tripsError } = await supabase
      .from('trips')
      .select(`
        id,
        trip_number,
        start_date,
        odometer_start,
        trip_type,
        driver:profiles!trips_driver_id_fkey(id, user_id, full_name),
        route:routes(route_name)
      `)
      .in('status', ['scheduled', 'in_progress'])
      .is('odometer_start', null)
      .lte('start_date', tomorrow.toISOString())
      .gte('start_date', now.toISOString());

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      throw tripsError;
    }

    console.log(`Found ${upcomingTrips?.length || 0} trips needing odometer reminders`);

    const notificationsSent: string[] = [];

    for (const trip of upcomingTrips || []) {
      const driver = trip.driver as any;
      const route = trip.route as any;
      
      if (!driver?.user_id) continue;

      // Check if we already sent a notification for this trip today
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', driver.user_id)
        .like('message', `%${trip.trip_number}%`)
        .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString())
        .limit(1);

      if (existingNotification && existingNotification.length > 0) {
        console.log(`Skipping notification for trip ${trip.trip_number} - already sent today`);
        continue;
      }

      // Create notification
      const startDate = new Date(trip.start_date);
      const hoursUntilTrip = Math.round((startDate.getTime() - Date.now()) / (1000 * 60 * 60));
      
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: driver.user_id,
          title: 'Odometer Reading Required',
          message: `Your trip ${trip.trip_number} to ${route?.route_name || 'destination'} starts in ${hoursUntilTrip} hours. Please fill in the odometer readings.`,
          type: 'warning',
          link: '/driver/trips',
        });

      if (notifError) {
        console.error(`Failed to send notification for trip ${trip.trip_number}:`, notifError);
      } else {
        notificationsSent.push(trip.trip_number);
        console.log(`Sent notification to ${driver.full_name} for trip ${trip.trip_number}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notificationsSent.length} notifications`,
        trips: notificationsSent 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
