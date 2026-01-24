
# Implementation Plan: Enhanced Bus Fleet Management Features

## Overview
This plan addresses the project owner's requirements for a comprehensive enhancement to the bus fleet management system. The implementation covers bus ownership models, scheduled trips, enhanced revenue sources with GST, stock management, and home state tax tracking.

---

## Requirements Summary

1. **Bus Ownership Categories**: Own vs Partnership buses with configurable profit split
2. **Scheduled/Fixed Route Buses**: Recurring trip scheduling with automatic daily trips
3. **Enhanced Revenue Sources**: Cash, App, Online, Paytm, Others with 18% GST calculation
4. **Stock Management**: Track company stock with low-stock alerts and email notifications
5. **Home State Tax**: Monthly tax due dates with alerts and email notifications

---

## Implementation Details

### Part 1: Bus Ownership Categories

**Database Changes - `buses` table modifications:**
- Add `ownership_type` ENUM column: `'owned' | 'partnership'`
- Add `partner_name` text column (nullable)
- Add `company_profit_share` numeric column (default 100)
- Add `partner_profit_share` numeric column (default 0)

**UI Changes:**
- Update `BusManagement.tsx` to include ownership type selector
- Add partnership details section (partner name, profit split percentages)
- Add validation to ensure profit shares total 100%

**Report Changes:**
- Update `ProfitabilityReport.tsx` to show split calculations for partnership buses
- Show company share vs partner share columns

---

### Part 2: Scheduled/Fixed Route Trips

**Database Changes:**
- Create new `bus_schedules` table:
  - `id` (uuid, primary key)
  - `bus_id` (uuid, foreign key to buses)
  - `route_id` (uuid, foreign key to routes)
  - `driver_id` (uuid, nullable, foreign key to profiles)
  - `departure_time` (time) - e.g., "22:00"
  - `arrival_time` (time) - e.g., "06:00"
  - `days_of_week` (text array) - e.g., ["monday", "wednesday", "friday"]
  - `is_return_same_day` (boolean, default false)
  - `return_departure_time` (time, nullable) - e.g., "09:00"
  - `return_arrival_time` (time, nullable) - e.g., "22:00"
  - `is_active` (boolean, default true)
  - `created_at`, `updated_at`

**New Components:**
- Create `ScheduleManagement.tsx` page for managing recurring schedules
- Add schedule form with time pickers for departure/arrival times
- Add day-of-week selector (checkboxes for each day)
- Visual schedule calendar view

**Edge Function:**
- Create `generate-scheduled-trips` edge function
- Runs daily (via cron) to create trip records for next day
- Automatically creates two-way trips based on schedule configuration

**UI Updates:**
- Add "Schedules" navigation item in sidebar
- Update Trip Management to show "Scheduled" badge for auto-generated trips

---

### Part 3: Enhanced Revenue Sources with GST

**Database Changes - `trips` table modifications:**
- Rename/clarify existing columns:
  - `revenue_cash` - Cash collections
  - `revenue_online` - Online bookings (website/app)
  - `revenue_paytm` - Paytm payments
  - `revenue_others` - Agent/other sources
- Add new columns:
  - `revenue_agent` numeric (default 0) - Agent commissions/bookings
  - `gst_percentage` numeric (default 18) - GST rate
  - `revenue_before_gst` numeric (generated) - Total before GST
  - `gst_amount` numeric (generated) - Calculated GST
  - `revenue_after_gst` numeric (generated) - Net after GST deduction
- Same columns for return journey (`return_revenue_agent`, etc.)

**UI Changes:**
- Update `TripRevenueDialog.tsx`:
  - Add Agent revenue field
  - Show GST breakdown (Revenue before GST, GST @ 18%, Net Revenue)
  - Add toggle for GST-inclusive vs GST-exclusive input

**Report Changes:**
- Update `tripSheetExport.ts` to include GST columns
- Update `ProfitabilityReport.tsx` to show gross revenue, GST paid, net revenue
- Add GST summary section in exports

---

### Part 4: Stock Management

**Database Changes:**
- Create new `stock_items` table:
  - `id` (uuid, primary key)
  - `item_name` (text) - e.g., "Company Box"
  - `quantity` (integer)
  - `low_stock_threshold` (integer, default 50)
  - `unit` (text) - e.g., "boxes", "pieces"
  - `notes` (text, nullable)
  - `last_updated_by` (uuid, foreign key to profiles)
  - `created_at`, `updated_at`

- Create `stock_transactions` table for history:
  - `id` (uuid)
  - `stock_item_id` (uuid, foreign key)
  - `transaction_type` ENUM: `'add' | 'remove' | 'adjustment'`
  - `quantity_change` (integer) - positive or negative
  - `previous_quantity` (integer)
  - `new_quantity` (integer)
  - `notes` (text, nullable)
  - `created_by` (uuid)
  - `created_at`

**Admin Settings Updates:**
- Add `low_stock_alert_threshold` setting (default 50)
- Add `stock_alert_email` setting for notification recipient
- Add `smtp_host`, `smtp_port`, `smtp_user` settings (stored securely)

**New Components:**
- Create `StockManagement.tsx` page:
  - List all stock items with current quantities
  - Add/Edit stock items
  - Quick update quantity buttons (+10, -10, custom)
  - Stock history/transaction log
  - Low stock indicators (red when below threshold)

**Dashboard Updates:**
- Add "Low Stock Alert" card on AdminDashboard
- Show items below threshold with quantity and item name

**Edge Function:**
- Create `check-stock-alerts` edge function
- Check stock levels against thresholds
- Send email notification using SMTP (GoDaddy mail)
- Run via cron (daily check)

---

### Part 5: Home State Tax Management

**Database Changes - `buses` table modifications:**
- Add `home_state_id` (uuid, foreign key to indian_states)
- Add `monthly_tax_amount` (numeric)
- Add `tax_due_day` (integer, 1-28) - Day of month tax is due
- Add `last_tax_paid_date` (date, nullable)
- Add `next_tax_due_date` (date, generated or updated via trigger)

**Alternative: Separate Tax Table:**
- Create `bus_tax_records` table:
  - `id` (uuid)
  - `bus_id` (uuid, foreign key)
  - `tax_period_start` (date) - e.g., "2024-01-01"
  - `tax_period_end` (date) - e.g., "2024-01-31"
  - `amount` (numeric)
  - `due_date` (date)
  - `paid_date` (date, nullable)
  - `payment_reference` (text, nullable)
  - `status` ENUM: `'pending' | 'paid' | 'overdue'`
  - `created_at`, `updated_at`

**UI Changes:**
- Update `BusManagement.tsx`:
  - Add "Tax Details" section in bus form
  - Home state selector
  - Monthly tax amount input
  - Due date day selector

- Create tax status view:
  - Show upcoming tax dues
  - Quick "Mark as Paid" action
  - Payment history

**Dashboard Updates:**
- Add "Tax Due Alerts" card on AdminDashboard
- Show buses with tax due within 7 days
- Link to bus management for payment update

**Edge Function:**
- Create `check-tax-alerts` edge function
- Check for taxes due within 7 days
- Send email notification to admin
- Run via cron (daily)

---

## Email Notification System

**Edge Function: `send-alert-email`**
- Shared function for sending emails via GoDaddy SMTP
- Uses environment variables:
  - `SMTP_HOST` - GoDaddy SMTP server
  - `SMTP_PORT` - Usually 465 or 587
  - `SMTP_USER` - Email username
  - `SMTP_PASS` - Email password
  - `ADMIN_EMAIL` - Recipient for alerts

**Email Templates:**
- Low Stock Alert email template
- Tax Due Reminder email template

---

## File Changes Summary

### New Files to Create:
| File | Purpose |
|------|---------|
| `src/pages/admin/ScheduleManagement.tsx` | Manage recurring bus schedules |
| `src/pages/admin/StockManagement.tsx` | Manage office stock inventory |
| `src/components/TaxDetailsCard.tsx` | Tax payment status component |
| `supabase/functions/generate-scheduled-trips/index.ts` | Auto-generate trips from schedules |
| `supabase/functions/check-stock-alerts/index.ts` | Check stock levels and send emails |
| `supabase/functions/check-tax-alerts/index.ts` | Check tax dues and send emails |
| `supabase/functions/send-alert-email/index.ts` | Shared email sending function |

### Files to Modify:
| File | Changes |
|------|---------|
| `src/pages/admin/BusManagement.tsx` | Add ownership type, partnership details, tax info |
| `src/pages/admin/TripManagement.tsx` | Show schedule badge, update revenue display |
| `src/pages/admin/AdminDashboard.tsx` | Add stock alerts, tax alerts cards |
| `src/pages/admin/Settings.tsx` | Add stock threshold, SMTP settings |
| `src/components/TripRevenueDialog.tsx` | Add agent field, GST calculation display |
| `src/components/layout/Sidebar.tsx` | Add Schedules, Stock navigation items |
| `src/App.tsx` | Add new routes |
| `src/types/database.ts` | Add new types for schedules, stock, tax |
| `src/lib/tripSheetExport.ts` | Add GST columns, agent revenue |
| `src/pages/admin/ProfitabilityReport.tsx` | Add partnership profit split, GST breakdown |

### Database Migrations:
1. **Ownership Migration**: Add ownership columns to buses table
2. **Schedules Migration**: Create bus_schedules table with RLS
3. **Revenue Migration**: Add agent revenue and GST columns to trips
4. **Stock Migration**: Create stock_items and stock_transactions tables with RLS
5. **Tax Migration**: Add tax columns to buses table OR create bus_tax_records table

---

## Secrets Required

The following secrets need to be added for email functionality:
- `SMTP_HOST` - GoDaddy SMTP server (e.g., smtpout.secureserver.net)
- `SMTP_PORT` - SMTP port (465 for SSL, 587 for TLS)
- `SMTP_USER` - GoDaddy email username
- `SMTP_PASS` - GoDaddy email password
- `ADMIN_ALERT_EMAIL` - Email address to receive alerts

---

## Implementation Order

### Phase 1: Database & Core Structure (Migration Heavy)
1. Create all database migrations
2. Update TypeScript types
3. Add new admin settings

### Phase 2: Bus Ownership & Tax
1. Update Bus Management for ownership types
2. Add tax tracking fields and UI
3. Add tax alerts to dashboard

### Phase 3: Revenue & GST
1. Update TripRevenueDialog with agent and GST
2. Update exports with GST calculations
3. Update profitability reports

### Phase 4: Schedules
1. Create ScheduleManagement page
2. Create generate-scheduled-trips edge function
3. Add navigation and integration

### Phase 5: Stock Management
1. Create StockManagement page
2. Add stock alerts to dashboard
3. Create check-stock-alerts edge function

### Phase 6: Email Notifications
1. Add SMTP secrets (requires user input)
2. Create send-alert-email edge function
3. Integrate with stock and tax alert functions

---

## Technical Notes

### GST Calculation Logic
```typescript
// If user enters GST-inclusive amounts:
const revenueBeforeGst = totalRevenue;
const gstAmount = totalRevenue * 0.18 / 1.18; // 18% GST included
const revenueAfterGst = totalRevenue - gstAmount;

// If user enters GST-exclusive amounts:
const gstAmount = totalRevenue * 0.18;
const revenueBeforeGst = totalRevenue;
const revenueAfterGst = totalRevenue - gstAmount;
```

### Partnership Profit Split
```typescript
// For partnership buses:
const totalProfit = tripRevenue - tripExpense;
const companyShare = totalProfit * (bus.company_profit_share / 100);
const partnerShare = totalProfit * (bus.partner_profit_share / 100);
```

### Schedule Trip Generation
```typescript
// Runs daily at midnight
// For each active schedule where today matches days_of_week:
// - Create trip for tomorrow
// - If two-way, create return trip details
// - Assign driver from schedule
```

---

## Estimated Effort

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Database & Core | 2-3 hours |
| Phase 2: Ownership & Tax | 2-3 hours |
| Phase 3: Revenue & GST | 2-3 hours |
| Phase 4: Schedules | 3-4 hours |
| Phase 5: Stock Management | 2-3 hours |
| Phase 6: Email Notifications | 2-3 hours |
| **Total** | **13-19 hours** |

---

## Questions Clarified

Based on the requirements, I've made these design decisions:
1. **Revenue Sources**: Keeping Cash, Online, Paytm, Others + adding Agent as the fifth source
2. **GST**: Showing GST deduction from revenue (not adding to expenses)
3. **Stock**: Single stock item type initially ("Company Box"), expandable to multiple items
4. **Tax Records**: Using columns on buses table for simplicity, with option to expand to separate table for full payment history
5. **Schedules**: Supporting multi-day schedules with configurable return timing
