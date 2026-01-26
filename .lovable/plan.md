
# Plan: Implement Multi-Day Continuous Bus Scheduling

## Problem Analysis

Your bus scheduling pattern is a **continuous overnight service** that the current system doesn't handle correctly:

```text
Day 1 (Jan 1):
  20:15 - Depart Delhi for Manali

Day 2 (Jan 2):
  06:00 - Arrive Manali
  09:00 - Depart Manali for Delhi  
  18:00 - Arrive Delhi
  20:15 - Depart Delhi for Manali (NEW TRIP)

Day 3 (Jan 3): Same as Day 2...
```

**Current Issue:** The system generates a new trip every day at midnight, but the previous day's trip (which spans overnight) isn't completed yet, causing:
1. Duplicate trips being generated
2. Bus appearing "double-booked"
3. Confusion about which trip is which

## Root Cause

The current system treats each day independently:
- **Schedule says:** "Run daily at 20:15"
- **System does:** Creates a new trip record every day at midnight
- **Problem:** The 20:15 departure from yesterday arrives at 06:00 today, overlapping with today's new trip

## Solution Overview

Implement a **trip cycle awareness** system that understands when a trip from the previous day is still in progress and links consecutive trips properly.

---

## Technical Implementation

### 1. Add Trip Linking Fields to Database

Add new columns to track trip cycles:

```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS previous_trip_id UUID REFERENCES trips(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS next_trip_id UUID REFERENCES trips(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cycle_position INTEGER DEFAULT 1;
```

This creates a chain: Trip A (Day 1) -> Trip B (Day 2) -> Trip C (Day 3)

### 2. Update Edge Function Logic

Modify `generate-scheduled-trips/index.ts` to:

1. **Check for completing trips:** Before generating a new trip, check if there's a trip from yesterday that should be completing today
2. **Link consecutive trips:** When creating today's trip, link it to yesterday's trip
3. **Smart status handling:** Only create a "scheduled" trip if the previous one has reached a certain point

**New Logic Flow:**
```text
For each schedule:
  1. Find yesterday's trip for this bus/schedule
  2. If yesterday's trip exists and is 'in_progress':
     - Check if it should be completing soon (arrival time passed)
     - If yes, create today's trip as "scheduled" but linked
     - If no, skip - bus still on outward journey
  3. If yesterday's trip is 'completed' or no previous trip:
     - Create today's trip normally
```

### 3. Update Schedule Management UI

Add new fields to the schedule form:

- **Journey Span Indicator:** Visual display showing the overnight nature
- **Next Day Arrival Checkbox:** Explicit flag for overnight journeys
- **Turnaround Time:** Time between arrival and next departure

**Files to modify:**
- `src/pages/admin/ScheduleManagement.tsx`

### 4. Update Trip Management Display

Show trip chains visually:

- Display linked trips together
- Show "Continues from yesterday" indicator
- Add "Chain View" to see multi-day trip sequences

**Files to modify:**
- `src/pages/admin/TripManagement.tsx`
- `src/components/TripTimeline.tsx`

### 5. Update Driver Trip View

Enhance driver interface to show:

- Current trip context (which day of the cycle)
- Quick view of upcoming continuation
- Clear distinction between outward and return legs

**Files to modify:**
- `src/pages/driver/DriverTrips.tsx`

---

## Database Changes

### New Columns for Trips Table

| Column | Type | Purpose |
|--------|------|---------|
| `previous_trip_id` | UUID | Link to yesterday's trip |
| `next_trip_id` | UUID | Link to tomorrow's trip |
| `cycle_position` | INTEGER | Day number in multi-day cycle |
| `expected_arrival_date` | DATE | When bus arrives at destination |

### Schedule Table Updates

| Column | Type | Purpose |
|--------|------|---------|
| `is_overnight` | BOOLEAN | Flag for overnight journeys |
| `arrival_next_day` | BOOLEAN | Arrival is on next calendar day |
| `turnaround_hours` | NUMERIC | Hours between arrival and next departure |

---

## Edge Function Updates

### File: `supabase/functions/generate-scheduled-trips/index.ts`

**Key Changes:**

1. Calculate expected arrival date based on times:
```typescript
// Detect overnight journey
const isOvernight = arrivalMinutes < departureMinutes;
const arrivalDate = isOvernight 
  ? addDays(departureDate, 1) 
  : departureDate;
```

2. Check for active trips before creating:
```typescript
// Find yesterday's trip that may still be active
const yesterdayDate = subtractDays(today, 1);
const { data: yesterdayTrip } = await supabase
  .from("trips")
  .select("id, status, arrival_time")
  .eq("schedule_id", schedule.id)
  .eq("trip_date", yesterdayDate)
  .maybeSingle();

// For overnight services, check if yesterday's trip is done
if (yesterdayTrip && yesterdayTrip.status === 'in_progress') {
  const now = new Date();
  const todayArrivalTime = parseTime(schedule.arrival_time);
  
  if (now < todayArrivalTime) {
    // Bus hasn't arrived yet - skip creating new trip
    console.log(`Skipping: Bus still en route from yesterday's trip`);
    continue;
  }
}
```

3. Link trips when creating:
```typescript
// Link to previous trip if exists
if (yesterdayTrip) {
  tripData.previous_trip_id = yesterdayTrip.id;
  
  // Also update yesterday's trip with next_trip_id
  await supabase
    .from("trips")
    .update({ next_trip_id: newTripId })
    .eq("id", yesterdayTrip.id);
}
```

---

## UI Enhancements

### Schedule Form Visual Timeline

Add a visual representation showing the overnight pattern:

```text
┌─────────────────────────────────────────────────────────────┐
│  Day 1                    │  Day 2                          │
│                           │                                 │
│  20:15 ──────────────────── 06:00 (Outward)                │
│                             09:00 ──────────── 18:00       │
│                                                  (Return)   │
│                             20:15 ──── ... (Next Cycle)    │
└─────────────────────────────────────────────────────────────┘
```

### Trip Table Enhancements

- Group consecutive trips visually
- Show chain indicators (←→ icons)
- Add "Cycle" column showing position

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/TripChainIndicator.tsx` | Visual indicator for linked trips |
| `src/components/ScheduleTimeline.tsx` | Visual timeline for schedule creation |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-scheduled-trips/index.ts` | Add trip linking and overnight detection |
| `src/pages/admin/ScheduleManagement.tsx` | Add overnight schedule options and visual timeline |
| `src/pages/admin/TripManagement.tsx` | Show trip chains and linked trips |
| `src/pages/driver/DriverTrips.tsx` | Show cycle context for drivers |
| `src/components/TripTimeline.tsx` | Enhance to show multi-day context |
| `src/types/database.ts` | Add new Trip fields |

---

## Summary

This solution:

1. **Prevents double-booking** by understanding overnight journeys
2. **Links consecutive trips** for easy tracking
3. **Shows clear visual context** for multi-day cycles
4. **Handles the Delhi-Manali pattern** exactly as you described

The system will understand that:
- Departing at 20:15 PM means arriving at 06:00 AM **next day**
- The return at 09:00 AM completes at 18:00 PM same day
- The next cycle starts at 20:15 PM same day (after turnaround)
- Each cycle spans 2 calendar days for the outward journey

