import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function generateTripNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `TRP${dateStr}${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's day name
    const today = new Date();
    const todayName = dayNames[today.getDay()];
    const todayDateStr = today.toISOString().split("T")[0];

    console.log(`Generating scheduled trips for ${todayName} (${todayDateStr})`);

    // Get active schedules for today
    const { data: schedules, error: scheduleError } = await supabase
      .from("bus_schedules")
      .select(`
        *,
        buses (id, registration_number, bus_name),
        routes (id, route_name, from_address, to_address, distance_km),
        profiles:driver_id (id, full_name)
      `)
      .eq("is_active", true)
      .contains("days_of_week", [todayName]);

    if (scheduleError) throw scheduleError;

    if (!schedules || schedules.length === 0) {
      console.log("No schedules found for today");
      return new Response(
        JSON.stringify({ success: true, message: "No schedules for today", tripsCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tripsCreated = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        // Check if trip already exists for this schedule today
        const { data: existingTrip } = await supabase
          .from("trips")
          .select("id")
          .eq("schedule_id", schedule.id)
          .eq("trip_date", todayDateStr)
          .single();

        if (existingTrip) {
          console.log(`Trip already exists for schedule ${schedule.id} on ${todayDateStr}`);
          continue;
        }

        // Calculate departure and arrival dates/times
        const departureTime = schedule.departure_time;
        const arrivalTime = schedule.arrival_time;

        // If arrival time is earlier than departure, it's next day arrival
        const departureParts = departureTime.split(":");
        const arrivalParts = arrivalTime.split(":");
        const departureMinutes = parseInt(departureParts[0]) * 60 + parseInt(departureParts[1]);
        const arrivalMinutes = parseInt(arrivalParts[0]) * 60 + parseInt(arrivalParts[1]);

        const arrivalDate = new Date(today);
        if (arrivalMinutes <= departureMinutes) {
          // Arrival is next day
          arrivalDate.setDate(arrivalDate.getDate() + 1);
        }

        // Create the main trip
        const tripNumber = generateTripNumber();
        
        // Create start_date from today + departure time
        const [depHour, depMin] = departureTime.split(":").map(Number);
        const startDate = new Date(today);
        startDate.setHours(depHour, depMin, 0, 0);
        
        // Get bus and driver names for snapshot
        const busName = schedule.buses?.bus_name || schedule.buses?.registration_number || "";
        const driverName = schedule.profiles?.full_name || "";
        
        const tripData: Record<string, unknown> = {
          trip_number: tripNumber,
          bus_id: schedule.bus_id,
          driver_id: schedule.driver_id,
          route_id: schedule.route_id,
          schedule_id: schedule.id,
          trip_date: todayDateStr,
          departure_time: departureTime,
          arrival_time: arrivalTime,
          start_date: startDate.toISOString(),
          status: "scheduled",
          trip_type: schedule.is_two_way ? "two_way" : "one_way",
          bus_name_snapshot: busName,
          driver_name_snapshot: driverName,
        };

        // Add return journey details if two-way
        if (schedule.is_two_way && schedule.return_departure_time) {
          tripData.return_departure_time = schedule.return_departure_time;
          tripData.return_arrival_time = schedule.return_arrival_time;
        }

        const { error: insertError } = await supabase
          .from("trips")
          .insert(tripData);

        if (insertError) {
          errors.push(`Failed to create trip for schedule ${schedule.id}: ${insertError.message}`);
          continue;
        }

        tripsCreated++;
        console.log(`Created trip ${tripNumber} for schedule ${schedule.id}`);

        // Create notification for driver if assigned
        if (schedule.driver_id) {
          await supabase.from("notifications").insert({
            user_id: schedule.driver_id,
            type: "trip_reminder",
            title: "Scheduled Trip Today",
            message: `You have a scheduled trip: ${schedule.routes?.route_name || "Route"} departing at ${departureTime}`,
          });
        }
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing schedule ${schedule.id}: ${errMessage}`);
      }
    }

    console.log(`Generated ${tripsCreated} trips from ${schedules.length} schedules`);

    return new Response(
      JSON.stringify({
        success: true,
        date: todayDateStr,
        day: todayName,
        schedulesProcessed: schedules.length,
        tripsCreated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating scheduled trips:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
