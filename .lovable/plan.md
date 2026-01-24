

# Add Delete Functionality for Buses and Drivers

## Overview
This plan adds delete capabilities for admins to remove buses and drivers from the system, with proper confirmation dialogs and dependency checks to prevent data integrity issues.

## Key Considerations

### Data Integrity
The database has foreign key relationships that affect deletion:
- **Buses**: The `trips` table references `buses(id)` - deleting a bus with associated trips would fail
- **Drivers/Profiles**: The `trips` table references `profiles(id)` for `driver_id`, and `expenses` table references `profiles(id)` for `submitted_by`

### Approach
Before deleting, we'll check if the entity has related records (trips) and:
- If related records exist: Show a warning explaining why deletion is blocked
- If no related records: Show a confirmation dialog and proceed with deletion

## Implementation Steps

### 1. Update Bus Management Page
**File: `src/pages/admin/BusManagement.tsx`**

- Add new imports: `Trash2` icon, `AlertDialog` components
- Add state for delete confirmation: `deletingBus`, `hasRelatedTrips`
- Add `checkBusTrips(busId)` function to check if bus has associated trips
- Add `handleDeleteBus(bus)` function to initiate deletion with dependency check
- Add `confirmDeleteBus()` function to execute the delete operation
- Add delete button (Trash icon) next to the edit button in the table
- Add AlertDialog for delete confirmation with two variants:
  - Blocked deletion (has trips): Warning message explaining the bus cannot be deleted
  - Allowed deletion: Confirmation with "Delete" and "Cancel" buttons

### 2. Update Driver Management Page
**File: `src/pages/admin/DriverManagement.tsx`**

- Add new imports: `Trash2` icon, `AlertDialog` components
- Add state for delete confirmation: `deletingDriver`, `hasRelatedData`
- Add `checkDriverDependencies(profileId)` function to check:
  - Trips assigned to this driver
  - Expenses submitted by this driver
- Add `handleDeleteDriver(driver)` function to initiate deletion with dependency check
- Add `confirmDeleteDriver()` function that:
  - Deletes from `user_roles` table first (using `user_id`)
  - Deletes from `profiles` table
- Add delete button (Trash icon) next to the edit button in the table
- Add AlertDialog for delete confirmation with appropriate messages

### 3. Database Considerations
No database changes needed - the existing RLS policies already allow admins to delete:
- `buses`: "Admins can manage buses" policy with `ALL` command
- `profiles`: "Admins can manage all profiles" policy with `ALL` command
- `user_roles`: "Admins can manage roles" policy with `ALL` command

---

## Technical Details

### Bus Management Changes

```text
State additions:
- deletingBus: Bus | null
- hasRelatedTrips: boolean
- deleteDialogOpen: boolean

New functions:
- checkBusTrips(busId): Queries trips table to check if any trips use this bus
- handleDeleteBus(bus): Opens dialog, checks dependencies
- confirmDeleteBus(): Executes DELETE from buses where id = deletingBus.id
```

### Driver Management Changes

```text
State additions:
- deletingDriver: DriverWithRole | null
- hasRelatedData: boolean
- deleteDialogOpen: boolean
- relatedDataInfo: { trips: number, expenses: number }

New functions:
- checkDriverDependencies(profileId): Queries trips and expenses tables
- handleDeleteDriver(driver): Opens dialog, checks dependencies  
- confirmDeleteDriver(): 
  1. DELETE from user_roles where user_id = driver.user_id
  2. DELETE from profiles where id = driver.id
```

### UI Components Used
- `AlertDialog` from existing UI components for confirmation dialogs
- `Trash2` icon from lucide-react for delete buttons
- Destructive button variant for delete actions

### Error Handling
- Toast notifications for success/failure
- Proper loading states during deletion
- Refresh data after successful deletion

