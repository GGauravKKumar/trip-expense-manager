

# Implementation Plan: Quick Wins - Search, Filtering, Pagination & Driver License Alerts

## Overview
This plan implements Phase 1 quick wins to significantly improve usability across all management pages. We'll add search functionality, status/date filtering, pagination controls, and driver license expiry alerts on the admin dashboard.

---

## Implementation Summary

### Features to Implement:
1. **Search & Filtering** - Add search bars and filter dropdowns to all management tables
2. **Pagination** - Add page controls with configurable page sizes
3. **Driver License Expiry Alerts** - Add alerts card on Admin Dashboard

---

## Detailed Implementation

### 1. Create Reusable Pagination Hook & Component

**New File: `src/hooks/useTableFilters.ts`**

Creates a custom hook to manage:
- Search query state
- Filter selections
- Pagination (current page, page size)
- Computed filtered & paginated data

```text
State managed:
- searchQuery: string
- filters: Record<string, any>
- currentPage: number
- pageSize: number (10, 25, 50, 100)
- totalCount: number

Functions:
- setSearchQuery(query)
- setFilter(key, value)
- setPage(page)
- setPageSize(size)
- resetFilters()

Returns:
- paginatedData
- totalPages
- showingFrom/showingTo
- all state and setters
```

---

### 2. Update Bus Management Page

**File: `src/pages/admin/BusManagement.tsx`**

Add above the table:
- **Search input**: Filter by registration number or bus name
- **Status filter dropdown**: All / Active / Maintenance / Inactive
- **Pagination controls** at bottom of table

Changes:
- Add search state and status filter state
- Filter buses array based on search and status
- Slice filtered array for pagination
- Add "Showing X-Y of Z buses" text
- Add page size selector and page navigation buttons

---

### 3. Update Driver Management Page

**File: `src/pages/admin/DriverManagement.tsx`**

Add above the table:
- **Search input**: Filter by name, phone, or license number
- **Role filter dropdown**: All / Admin / Driver / No Role
- **Pagination controls** at bottom

---

### 4. Update Trip Management Page

**File: `src/pages/admin/TripManagement.tsx`**

Add above the table:
- **Search input**: Filter by trip number, bus, driver, or route name
- **Status filter dropdown**: All / Scheduled / In Progress / Completed / Cancelled
- **Trip type filter**: All / One Way / Two Way
- **Date range picker** (optional for this phase)
- **Pagination controls** at bottom

---

### 5. Update Route Management Page

**File: `src/pages/admin/RouteManagement.tsx`**

Add above the table:
- **Search input**: Filter by route name, from/to state, or address
- **Pagination controls** at bottom

---

### 6. Update Expense Approval Page

**File: `src/pages/admin/ExpenseApproval.tsx`**

Already has status filter buttons. Add:
- **Search input**: Filter by trip number, driver name, or category
- **Pagination controls** at bottom

---

### 7. Add Driver License Expiry Alerts to Admin Dashboard

**File: `src/pages/admin/AdminDashboard.tsx`**

Add a new alerts card similar to bus document expiry:
- Fetch all drivers with license expiry dates
- Filter those expiring within 30 days or already expired
- Display in a red-tinted card below the bus expiry alerts
- Show driver name, license number, and days remaining
- Link to driver management page

New function: `fetchExpiringLicenses()`
- Query profiles table where license_expiry is within next 30 days
- Sort by days remaining ascending

---

## UI Components Used

### Search & Filter Bar Layout
```text
+------------------------------------------------------------------+
| [Search: ___________________]  [Status: ▼]  [Type: ▼]            |
+------------------------------------------------------------------+
| Table content...                                                  |
+------------------------------------------------------------------+
| Showing 1-10 of 45 items    [10 ▼]  [< Prev] [1] [2] [3] [Next >]|
+------------------------------------------------------------------+
```

### Pagination Component Usage
Using existing `Pagination` components from `src/components/ui/pagination.tsx`:
- `Pagination`, `PaginationContent`, `PaginationItem`
- `PaginationPrevious`, `PaginationNext`, `PaginationLink`
- `PaginationEllipsis` for large page counts

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useTableFilters.ts` | Reusable hook for search, filter, pagination logic |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/BusManagement.tsx` | Add search, status filter, pagination |
| `src/pages/admin/DriverManagement.tsx` | Add search, role filter, pagination |
| `src/pages/admin/TripManagement.tsx` | Add search, status filter, pagination |
| `src/pages/admin/RouteManagement.tsx` | Add search, pagination |
| `src/pages/admin/ExpenseApproval.tsx` | Add search, pagination |
| `src/pages/admin/AdminDashboard.tsx` | Add driver license expiry alerts card |

---

## Technical Details

### Search Implementation
Client-side filtering for each page:
```typescript
const filteredData = data.filter(item => {
  const matchesSearch = searchQuery === '' || 
    item.field1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.field2?.toLowerCase().includes(searchQuery.toLowerCase());
  
  const matchesFilter = filterValue === 'all' || item.status === filterValue;
  
  return matchesSearch && matchesFilter;
});
```

### Pagination Implementation
```typescript
const pageSize = 10;
const totalPages = Math.ceil(filteredData.length / pageSize);
const paginatedData = filteredData.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);
```

### Driver License Alert
```typescript
interface DriverExpiry {
  id: string;
  full_name: string;
  license_number: string | null;
  license_expiry: string;
  days_remaining: number;
}

async function fetchExpiringLicenses() {
  const { data: drivers } = await supabase
    .from('profiles')
    .select('id, full_name, license_number, license_expiry')
    .not('license_expiry', 'is', null);
  
  // Filter and sort by days remaining
  const expiring = drivers?.filter(d => {
    const expiry = parseISO(d.license_expiry);
    const daysLeft = differenceInDays(expiry, today);
    return daysLeft <= 30;
  });
}
```

---

## Estimated Changes

- **New code**: ~200 lines (reusable hook + alert card)
- **Modified code**: ~50-80 lines per management page
- **Total**: ~500 lines of changes

---

## No Database Changes Required

All filtering and pagination is handled client-side using the existing data fetched from Supabase. This keeps the implementation simple and doesn't require any new tables, columns, or RLS policies.

