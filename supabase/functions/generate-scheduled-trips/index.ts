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

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isOvernightJourney(departureTime: string, arrivalTime: string): boolean {
  return parseTimeToMinutes(arrivalTime) < parseTimeToMinutes(departureTime);
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
    
    // Get yesterday's date for checking in-progress trips
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().split("T")[0];

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
    const skipped: string[] = [];

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

        // Determine if this is an overnight journey
        const departureTime = schedule.departure_time;
        const arrivalTime = schedule.arrival_time;
        const isOvernight = isOvernightJourney(departureTime, arrivalTime);

        // Check if bus already has an in-progress trip
        const { data: activeBusTrip } = await supabase
          .from("trips")
          .select("id, trip_number, trip_date, arrival_time")
          .eq("bus_id", schedule.bus_id)
          .eq("status", "in_progress")
          .maybeSingle();

        if (activeBusTrip) {
          // For overnight journeys, check if yesterday's trip should be completing today
          if (isOvernight) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeMinutes = currentHour * 60 + currentMinutes;
            const arrivalMinutes = parseTimeToMinutes(arrivalTime);
            
            // If current time is before today's expected arrival, skip (bus still en route)
            if (currentTimeMinutes < arrivalMinutes) {
              skipped.push(
                `Schedule ${schedule.id}: Bus ${schedule.buses?.registration_number} ` +
                `is still en route from yesterday's trip ${activeBusTrip.trip_number} ` +
                `(expected arrival at ${arrivalTime})`
              );
              console.log(`Skipping: Bus ${schedule.buses?.registration_number} still en route`);
              continue;
            }
          } else {
            // For same-day journeys, skip entirely if bus is busy
            skipped.push(
              `Schedule ${schedule.id}: Bus ${schedule.buses?.registration_number} ` +
              `is already on trip ${activeBusTrip.trip_number}`
            );
            console.log(`Skipping: Bus ${schedule.buses?.registration_number} is on active trip`);
            continue;
          }
        }

        // Check if driver already has an in-progress trip
        if (schedule.driver_id) {
          const { data: activeDriverTrip } = await supabase
            .from("trips")
            .select("id, trip_number")
            .eq("driver_id", schedule.driver_id)
            .eq("status", "in_progress")
            .maybeSingle();

          if (activeDriverTrip) {
            skipped.push(
              `Schedule ${schedule.id}: Driver ${schedule.profiles?.full_name} ` +
              `is already on trip ${activeDriverTrip.trip_number}`
            );
            console.log(`Skipping: Driver ${schedule.profiles?.full_name} is on active trip`);
            continue;
          }
        }

        // Find yesterday's trip for this schedule (to link trips)
        const { data: yesterdayTrip } = await supabase
          .from("trips")
          .select("id, trip_number, cycle_position")
          .eq("schedule_id", schedule.id)
          .eq("trip_date", yesterdayDateStr)
          .maybeSingle();

        // Calculate expected arrival date
        const expectedArrivalDate = isOvernight
          ? new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          : todayDateStr;

        // Create start_date from today + departure time
        const [depHour, depMin] = departureTime.split(":").map(Number);
        const startDate = new Date(today);
        startDate.setHours(depHour, depMin, 0, 0);
        
        // Get bus and driver names for snapshot
        const busName = schedule.buses?.bus_name || schedule.buses?.registration_number || "";
        const driverName = schedule.profiles?.full_name || "";

        // Calculate cycle position
        const cyclePosition = yesterdayTrip 
          ? (yesterdayTrip.cycle_position || 1) + 1 
          : 1;
        
        const tripNumber = generateTripNumber();
        
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
          expected_arrival_date: expectedArrivalDate,
          previous_trip_id: yesterdayTrip?.id || null,
          cycle_position: cyclePosition,
        };

        // Add return journey details if two-way
        if (schedule.is_two_way && schedule.return_departure_time) {
          tripData.return_departure_time = schedule.return_departure_time;
          tripData.return_arrival_time = schedule.return_arrival_time;
        }

        const { data: newTrip, error: insertError } = await supabase
          .from("trips")
          .insert(tripData)
          .select("id")
          .single();

        if (insertError) {
          errors.push(`Failed to create trip for schedule ${schedule.id}: ${insertError.message}`);
          continue;
        }

        // Update yesterday's trip with next_trip_id if it exists
        if (yesterdayTrip && newTrip) {
          await supabase
            .from("trips")
            .update({ next_trip_id: newTrip.id })
            .eq("id", yesterdayTrip.id);
        }

        tripsCreated++;
        console.log(`Created trip ${tripNumber} for schedule ${schedule.id}${isOvernight ? ' (overnight)' : ''}`);

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
    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length} schedules due to active trips`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: todayDateStr,
        day: todayName,
        schedulesProcessed: schedules.length,
        tripsCreated,
        skipped: skipped.length > 0 ? skipped : undefined,
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
