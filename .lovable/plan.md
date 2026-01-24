

# Implementation Plan: Password Change & Invoice Management

## Overview
This plan adds two new features to the Fleet Manager application:
1. **Password Change** - Allow all users (Admin, Driver, Repair Org) to change their password from their profile page
2. **Invoice Management** - A comprehensive invoicing system for admins to manage customer invoices, online app invoices, and track deductions like advertisements

---

## Feature 1: Password Change

### Location
- **Admin**: Settings page (`/admin/settings`)
- **Driver**: Profile page (`/driver/profile`)
- **Repair Org**: New profile section in Repair Dashboard (`/repair`)

### Implementation Details

**What will be added:**
- A new "Change Password" card section in each user's respective page
- Form with current password, new password, and confirm password fields
- Password strength validation (minimum 8 characters)
- Uses the built-in authentication `updateUser` method for secure password updates

**Files to modify:**
1. `src/pages/admin/Settings.tsx` - Add password change card
2. `src/pages/driver/DriverProfile.tsx` - Add password change card
3. `src/pages/repair/RepairDashboard.tsx` - Add profile/password section

**No database changes required** - Password updates are handled by the authentication system directly.

---

## Feature 2: Invoice Management

### What You Described
Based on your requirements, the invoice system will support:
- **Customer/Party invoices** - General invoices for bus bookings, charters
- **Online app invoices** - Invoices from online booking platforms with deductions for advertisements, commissions, etc.
- **Full accounting features** - Payment history, partial payments, credit notes, due dates

### Database Design

**New Table: `invoices`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| invoice_number | text | Auto-generated (INV240124001) |
| invoice_date | date | Invoice creation date |
| due_date | date | Payment due date |
| customer_name | text | Customer/Party name |
| customer_address | text | Customer address (optional) |
| customer_phone | text | Customer phone (optional) |
| customer_gst | text | Customer GST number (optional) |
| invoice_type | enum | 'customer', 'online_app', 'charter' |
| trip_id | uuid | Link to trip (optional) |
| bus_id | uuid | Link to bus (optional) |
| subtotal | numeric | Amount before deductions/tax |
| gst_amount | numeric | GST amount |
| total_amount | numeric | Final total after all calculations |
| amount_paid | numeric | Total paid so far |
| balance_due | numeric | Remaining balance |
| status | enum | 'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled' |
| notes | text | Internal notes |
| terms | text | Terms and conditions |
| created_at | timestamp | Record creation |
| updated_at | timestamp | Last update |

**New Table: `invoice_line_items`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| invoice_id | uuid | Foreign key to invoices |
| description | text | Item/service description |
| quantity | numeric | Quantity (default 1) |
| unit_price | numeric | Price per unit |
| amount | numeric | Line total |
| is_deduction | boolean | True for deductions (ads, commission) |
| created_at | timestamp | Record creation |

**New Table: `invoice_payments`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| invoice_id | uuid | Foreign key to invoices |
| payment_date | date | When payment was received |
| amount | numeric | Payment amount |
| payment_mode | text | Cash, Bank Transfer, Cheque, etc. |
| reference_number | text | Transaction/Cheque reference |
| notes | text | Payment notes |
| created_by | uuid | Who recorded the payment |
| created_at | timestamp | Record creation |

**New Enum: `invoice_type`**
- customer
- online_app
- charter

**New Enum: `invoice_status`**
- draft
- sent
- partial
- paid
- overdue
- cancelled

### User Interface

**New Admin Page: `/admin/invoices`**

**Main Features:**
1. **Invoice List View**
   - Table with filters (date range, status, type, customer)
   - Quick status indicators (Paid, Partial, Overdue)
   - Search by invoice number or customer name
   - Export to Excel

2. **Create/Edit Invoice Dialog**
   - Customer details section
   - Invoice type selector
   - Optional trip/bus linking
   - Line items editor (add/remove rows)
     - Description, quantity, rate, amount
     - Toggle for deduction items (shown in red, subtracted from total)
   - GST calculation (auto-calculated or manual)
   - Due date picker
   - Notes and terms

3. **Invoice Detail View**
   - Full invoice information
   - Line items with subtotals
   - Deductions section (advertisements, platform fees, etc.)
   - Payment history with add payment option
   - Status update controls

4. **Record Payment Dialog**
   - Amount field
   - Payment mode selector
   - Reference number
   - Date picker
   - Notes

**Menu Addition:**
- New "Invoices" item in admin sidebar (using FileText icon)

### Excel Export
The export will include:
- Invoice number
- Date
- Customer name
- Type
- Subtotal
- Deductions
- GST
- Total
- Paid amount
- Balance
- Status

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/InvoiceManagement.tsx` | Main invoice management page |
| `src/components/InvoiceDialog.tsx` | Create/Edit invoice dialog |
| `src/components/InvoicePaymentDialog.tsx` | Record payment dialog |
| `src/components/InvoiceDetailDialog.tsx` | View invoice details |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Add Invoices menu item for admin |
| `src/App.tsx` | Add invoice route |
| `src/types/database.ts` | Add Invoice, InvoiceLineItem, InvoicePayment types |
| `src/pages/admin/Settings.tsx` | Add password change section |
| `src/pages/driver/DriverProfile.tsx` | Add password change section |
| `src/pages/repair/RepairDashboard.tsx` | Add profile/password section |

---

## Technical Details

### Password Change Implementation
```text
Uses supabase.auth.updateUser({ password: newPassword })
- Validates current password first
- Confirms new password matches confirmation
- Minimum 8 characters required
- Shows success/error feedback
```

### Invoice Number Generation
```text
Format: INV + YYMMDD + 3-digit sequence
Example: INV240124001, INV240124002
Auto-increments per day
```

### Deduction Handling
```text
Line items with is_deduction=true are:
- Displayed separately in UI
- Subtracted from subtotal
- Common for: Platform commission, Advertisement fees, TDS, etc.
```

### RLS Policies
```text
Invoices:
- Admins can manage all invoices (ALL)

Invoice Line Items:
- Admins can manage all line items (ALL)

Invoice Payments:
- Admins can manage all payments (ALL)
```

---

## Summary

This implementation provides:

1. **Password Change**: Simple, secure password update for all user types in their respective profile/settings pages

2. **Invoice Management**: A complete invoicing system supporting:
   - Multiple invoice types (customer, online app, charter)
   - Line items with deduction support for ads, commissions
   - Payment tracking with partial payment support
   - Payment history and audit trail
   - Excel export for accounting
   - Status management (draft to paid workflow)

