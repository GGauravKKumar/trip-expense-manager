
# Plan: Create Comprehensive Analytics Dashboard

## Overview

Create a dedicated Analytics page that provides deep insights into fleet operations with interactive charts, KPIs, trend analysis, and comparison views. This will complement the existing AdminDashboard (overview) and ProfitabilityReport (detailed financial analysis) with a focus on operational metrics and trends.

---

## Page Structure

### 1. Header Section
- Page title "Fleet Analytics"
- Date range picker (similar to ProfitabilityReport)
- Quick period buttons (This Week, This Month, This Quarter, This Year)
- Export to Excel button

### 2. KPI Summary Cards (Top Row)
- **Revenue Performance**: Total revenue with trend comparison
- **Profit Margin**: Percentage profit margin with indicator
- **Trip Completion Rate**: Completed vs Scheduled percentage
- **Fuel Efficiency**: Average km/liter across fleet

### 3. Revenue Analytics Section
- **Revenue Trend Chart**: Line chart showing daily/weekly/monthly revenue trends
- **Revenue by Source**: Pie chart breaking down Cash, Online, Paytm, Agent, Others
- **Revenue Comparison**: Bar chart comparing current period vs previous period

### 4. Trip Analytics Section
- **Trip Volume Trend**: Area chart showing trip counts over time
- **Trip Status Distribution**: Donut chart (Completed, In Progress, Scheduled, Cancelled)
- **Average Revenue per Trip**: Trend line with comparison

### 5. Bus Performance Section
- **Top Performing Buses**: Horizontal bar chart ranked by profit
- **Bus Utilization**: Heatmap or bar showing trips per bus
- **Fuel Efficiency Ranking**: Sorted bar chart (km/liter)

### 6. Route Performance Section
- **Most Profitable Routes**: Horizontal bar chart
- **Route Frequency**: Bar chart showing trip counts by route
- **Average Profit per Route**: Comparison view

### 7. Driver Performance Section
- **Top Drivers by Revenue**: Ranked list with sparklines
- **Driver Trip Counts**: Bar chart
- **Expense Submission Rate**: Compliance metric

### 8. Expense Analysis Section
- **Expense by Category**: Pie chart (Fuel, Toll, Food, Repairs, etc.)
- **Expense Trend**: Line chart over time
- **Expense vs Revenue Ratio**: Trend analysis

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/Analytics.tsx` | Main analytics page component |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/admin/analytics` |
| `src/components/layout/Sidebar.tsx` | Add navigation link with BarChart3 icon |

### Data Fetching Strategy

The page will fetch data from existing tables using aggregation queries:

```typescript
// Revenue by payment source
SELECT 
  SUM(revenue_cash) as cash,
  SUM(revenue_online) as online,
  SUM(revenue_paytm) as paytm,
  SUM(revenue_agent) as agent,
  SUM(revenue_others) as others
FROM trips WHERE status = 'completed' AND date_range

// Daily revenue trend
SELECT 
  DATE(start_date) as date,
  SUM(total_revenue) as revenue,
  SUM(total_expense) as expense,
  COUNT(*) as trips
FROM trips GROUP BY DATE(start_date)

// Expense breakdown
SELECT 
  ec.name, SUM(e.amount)
FROM expenses e
JOIN expense_categories ec ON e.category_id = ec.id
WHERE e.status = 'approved'
GROUP BY ec.name
```

### Key Features

1. **Interactive Charts**: Using Recharts (already in the project)
   - Tooltips with detailed information
   - Click-to-filter functionality
   - Responsive design

2. **Date Range Filtering**: Reusable pattern from ProfitabilityReport
   - Start/end date pickers
   - Quick period selectors

3. **Real-time Calculations**:
   - Profit margins
   - Growth percentages
   - Period comparisons

4. **Export Functionality**: Using ExcelJS (already installed)
   - Multi-sheet workbook
   - Formatted data tables

### UI Components Used
- Card, CardHeader, CardTitle, CardContent (existing)
- Tabs, TabsList, TabsTrigger, TabsContent (for section navigation)
- Recharts: BarChart, LineChart, PieChart, AreaChart, RadialBarChart
- Badge for indicators
- Skeleton for loading states

---

## Chart Components Detail

### 1. Revenue Trend Line Chart
```text
     ₹50K |
          |       ____
     ₹40K |      /    \____
          |     /          \
     ₹30K |____/            \___
          |________________________
           Jan  Feb  Mar  Apr  May
```

### 2. Revenue Source Pie Chart
```text
        ┌─────────┐
       /  Cash    \
      │   45%     │
      │   Online  │
       \  35%    /
        └─────────┘
        Agent 15% | Others 5%
```

### 3. Bus Performance Bar Chart
```text
MH121454    ████████████████░░░  ₹4,920
HR3829731   ████████████░░░░░░░  ₹3,900
MP09BJ6966  ░░░░░░░░░░░░░░░░░░░  ₹0
```

### 4. Expense Category Breakdown
```text
Fuel     ████████████████  73%
Toll     ████████          27%
Food     ░░░░░░░░░░░░░░░░   0%
```

---

## State Management

```typescript
interface AnalyticsState {
  loading: boolean;
  dateRange: { start: Date; end: Date };
  
  // KPIs
  totalRevenue: number;
  totalExpense: number;
  profitMargin: number;
  tripCompletionRate: number;
  avgFuelEfficiency: number;
  
  // Trends
  revenueTrend: { date: string; revenue: number; expense: number }[];
  tripTrend: { date: string; count: number }[];
  
  // Breakdowns
  revenueBySource: { source: string; amount: number }[];
  expenseByCategory: { category: string; amount: number }[];
  tripsByStatus: { status: string; count: number }[];
  
  // Performance
  busPerformance: { name: string; revenue: number; profit: number; trips: number }[];
  routePerformance: { name: string; revenue: number; trips: number }[];
  driverPerformance: { name: string; revenue: number; trips: number }[];
}
```

---

## Analytics Calculations

### Profit Margin
```typescript
const profitMargin = ((totalRevenue - totalExpense) / totalRevenue) * 100;
```

### Trip Completion Rate
```typescript
const completionRate = (completedTrips / totalScheduledTrips) * 100;
```

### Period Comparison (Growth)
```typescript
const revenueGrowth = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
```

### Fuel Efficiency
```typescript
const efficiency = totalDistance / totalFuelLiters; // km/L
```

---

## Responsive Design

- Desktop: 4-column grid for KPIs, 2-column for charts
- Tablet: 2-column grid
- Mobile: Single column, stacked layout
- Charts resize automatically using ResponsiveContainer

---

## Summary

This Analytics page will provide:
- **Visual insights** through interactive charts
- **Trend analysis** for revenue, trips, and expenses
- **Comparative views** across buses, routes, and drivers
- **Actionable KPIs** for quick decision-making
- **Export capability** for offline analysis

The page follows existing patterns in ProfitabilityReport and GSTReport, ensuring consistency in UI and data handling.
