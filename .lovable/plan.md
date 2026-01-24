
# Add Manual Trip Generation Button for Schedule Management

## Overview
Add a button in the Schedule Management page that allows admins to manually trigger trip generation from active schedules. This provides control over when trips are created, instead of relying solely on the automated daily edge function.

## Current State
- The `generate-scheduled-trips` edge function automatically creates trips for today's active schedules
- It checks which schedules are active for the current day of the week
- It prevents duplicate trips by checking if a trip already exists for a schedule on that date
- The function is designed to be called automatically (daily cron) but can also be invoked manually

## Changes Required

### 1. Update Schedule Management Page
**File:** `src/pages/admin/ScheduleManagement.tsx`

Add a "Generate Today's Trips" button in the header area (next to "Add Schedule" button) that:
- Shows a calendar/play icon for visual clarity
- Displays a loading state while generating
- Calls the `generate-scheduled-trips` edge function
- Shows success/error toast with number of trips created
- Optionally shows which schedules were skipped (already have trips for today)

### 2. Register Edge Function in Config
**File:** `supabase/config.toml`

Add configuration for the `generate-scheduled-trips` function to allow it to be called from the frontend:
```toml
[functions.generate-scheduled-trips]
verify_jwt = false
```

## UI Design

The button will be placed in the header section:

```text
+----------------------------------------------------------+
| Schedule Management                                       |
| Manage recurring bus schedules for fixed routes          |
|                                                          |
|                    [Generate Today's Trips] [Add Schedule]|
+----------------------------------------------------------+
```

### Button Behavior
- **Default state:** Shows "Generate Today's Trips" with a Play/Calendar icon
- **Loading state:** Shows spinner with "Generating..."
- **Success:** Toast showing "Created X trips from Y schedules"
- **Partial success:** Toast showing created count plus any errors
- **No schedules for today:** Toast showing "No schedules for today"

## Technical Details

### Function Call
```typescript
const handleGenerateTrips = async () => {
  setGenerating(true);
  try {
    const { data, error } = await supabase.functions.invoke('generate-scheduled-trips');
    
    if (error) throw error;
    
    if (data.tripsCreated > 0) {
      toast.success(`Created ${data.tripsCreated} trips from ${data.schedulesProcessed} schedules`);
    } else if (data.schedulesProcessed === 0) {
      toast.info('No active schedules found for today');
    } else {
      toast.info('All trips for today already exist');
    }
  } catch (error) {
    toast.error('Failed to generate trips');
  } finally {
    setGenerating(false);
  }
};
```

### New State Variable
```typescript
const [generating, setGenerating] = useState(false);
```

### New Import
```typescript
import { Play } from 'lucide-react';
// or Calendar, Zap - whatever icon fits best
```

## Summary of File Changes

| File | Change |
|------|--------|
| `src/pages/admin/ScheduleManagement.tsx` | Add "Generate Today's Trips" button with handler |
| `supabase/config.toml` | Register `generate-scheduled-trips` function |

## Benefits
- Admins can manually create trips when needed without waiting for the daily automation
- Useful for testing schedules or handling edge cases
- Provides immediate feedback on trip creation status
- No database changes required - uses existing edge function
