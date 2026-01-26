
# Plan: Improve Input GST Calculation

## Problem Statement

The current GST Report calculates Input GST as a flat 15% estimate of all driver-submitted expenses, which is inaccurate. The user wants Input GST to be calculated only from:

1. **Invoices** - Already have GST tracking (gst_amount field)
2. **Repair Records** - Need to add GST fields for repair organizations to specify
3. **Stock** - Water taken from stock has fixed pricing (currently no GST tracking)

Driver-submitted expenses should NOT be included in Input GST calculations.

---

## Technical Implementation

### 1. Database Changes

Add GST fields to `repair_records` table:

```sql
ALTER TABLE public.repair_records 
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_applicable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC DEFAULT 18;
```

Add GST rate field to `stock_items` table:

```sql
ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC DEFAULT 0;
```

### 2. Input GST Sources

After implementation, Input GST will be calculated from:

| Source | GST Data Location | Condition |
|--------|------------------|-----------|
| Invoices (Purchases) | Currently invoices are OUTPUT (sales to customers), not INPUT. Need to clarify if there are purchase invoices |
| Repair Records | New `gst_amount` field | `status = 'approved'` and `gst_applicable = true` |
| Stock Items | Calculate from `unit_price * gst_percentage` for water taken during trips | Based on trip `water_taken` field |

### 3. Repair Dashboard Updates

**File:** `src/pages/repair/RepairDashboard.tsx`

Add GST input section to the repair submission form:

- **GST Applicable** - Toggle switch (default: Yes)
- **GST Amount (Rs)** - Input field for exact GST amount (visible when applicable)
- **GST Rate** - Display field showing calculated percentage

Form data state updates:
```typescript
const defaultFormData = {
  // ... existing fields
  gst_applicable: true,
  gst_amount: '',
};
```

### 4. Admin Repair Records View Updates

**File:** `src/pages/admin/RepairRecords.tsx`

Display GST information in the detail dialog:
- Show GST Amount alongside Labor Cost and Parts Cost
- Show "GST Not Applicable" badge if `gst_applicable = false`
- Include GST in total cost breakdown

### 5. GST Report Calculation Updates

**File:** `src/pages/admin/GSTReport.tsx`

Replace current expense-based estimation with actual GST from:

```typescript
async function fetchInputGST() {
  // 1. GST from approved repair records
  const { data: repairData } = await supabase
    .from('repair_records')
    .select('gst_amount, gst_applicable')
    .eq('status', 'approved')
    .eq('gst_applicable', true)
    .gte('repair_date', startDate)
    .lte('repair_date', endDate);
  
  const repairGST = repairData?.reduce((sum, r) => 
    sum + (Number(r.gst_amount) || 0), 0) || 0;

  // 2. GST from stock used in trips (water)
  const { data: tripData } = await supabase
    .from('trips')
    .select('water_taken')
    .eq('status', 'completed')
    .gte('start_date', startDate)
    .lte('start_date', endDate);
  
  // Fetch stock item GST rate for water
  const { data: stockItem } = await supabase
    .from('stock_items')
    .select('unit_price, gst_percentage')
    .ilike('item_name', '%water%')
    .single();
  
  const waterTaken = tripData?.reduce((sum, t) => 
    sum + (Number(t.water_taken) || 0), 0) || 0;
  const stockGSTRate = (stockItem?.gst_percentage || 0) / 100;
  const stockValue = waterTaken * (stockItem?.unit_price || 0);
  const stockGST = stockValue * stockGSTRate / (1 + stockGSTRate);

  // Total Input GST
  const totalInputGST = repairGST + stockGST;
  
  return { repairGST, stockGST, totalInputGST };
}
```

### 6. UI Display Updates

Update Input GST card subtitle from "Estimated from expenses" to "From repairs & stock":

```typescript
<p className="text-xs text-muted-foreground">From repairs & stock</p>
```

Add breakdown in GSTR-1 Summary section:
```
Input GST Breakdown:
- Repair Bills: ₹X,XXX
- Stock (Water): ₹XXX
- Total Input: ₹X,XXX
```

### 7. Stock Management Updates

**File:** `src/pages/admin/StockManagement.tsx`

Add GST Rate field to the stock item form:

```typescript
<div className="space-y-2">
  <Label htmlFor="gst_percentage">GST Rate (%)</Label>
  <Input
    id="gst_percentage"
    type="number"
    step="0.01"
    value={formData.gst_percentage}
    onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 0 })}
  />
  <p className="text-xs text-muted-foreground">GST rate for this item (0 if exempt)</p>
</div>
```

### 8. Type Definitions Update

**File:** `src/types/database.ts`

Add new fields to StockItem and create RepairRecord interface:

```typescript
export interface StockItem {
  // ... existing fields
  gst_percentage: number;
}

export interface RepairRecord {
  // ... existing fields
  gst_amount: number;
  gst_applicable: boolean;
  gst_percentage: number;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/GSTReport.tsx` | Replace expense-based Input GST with actual GST from repairs & stock |
| `src/pages/repair/RepairDashboard.tsx` | Add GST fields to submission form |
| `src/pages/admin/RepairRecords.tsx` | Display GST info in detail view |
| `src/pages/admin/StockManagement.tsx` | Add GST rate field to stock items |
| `src/types/database.ts` | Add GST fields to type definitions |

---

## Summary

This implementation will:

1. **Remove driver expenses** from Input GST calculation (as requested)
2. **Add GST tracking to repair records** with option for "no GST" scenarios
3. **Add GST rate to stock items** for accurate water/consumables GST
4. **Calculate actual Input GST** from real data instead of estimates
5. **Show clear breakdown** of Input GST sources in the report
