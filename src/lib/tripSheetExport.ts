import * as XLSX from 'xlsx';

interface TripSheetData {
  vehicleNo: string;
  date: string;
  hoursOut: string;
  hoursReturned: string;
  from: string;
  to: string;
  odometerStart: number;
  odometerFinished: number;
  distanceKm: number;
  reasonForTrip: string;
  driverSign: string;
  tripType: 'one_way' | 'two_way';
  journeyDirection: 'outward' | 'return';
  // Revenue
  revenueCash: number;
  revenueOnline: number;
  revenuePaytm: number;
  revenueOthers: number;
  revenueTotal: number;
  // Expenses
  expenseDiesel: number;
  expenseDriver: number;
  expenseRoute: number;
  expenseMaintenance: number;
  expenseGovtDuty: number;
  expenseOthers: number;
  expenseTotal: number;
  netIncome: number;
}

export function exportTripSheet(trips: TripSheetData[], vehicleNo: string, filename: string) {
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Create header rows
  const headerRows = [
    ['BUS TRIP SHEET', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Vehicle No', vehicleNo, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Hours', '', 'Journey', '', 'Odometer Reading', '', '', '', '', '', 'Revenue from operation', '', '', '', '', 'Expenses in operation', '', '', '', '', '', '', ''],
    ['Date', 'Out', 'Returned', 'From', 'To', 'Start', 'Finished', 'Dist KM', 'Reason for trip', 'Driver Sign', 'Direction', 'Cash', 'Online', 'Paytm', 'Others', 'G.Total', 'Diesel', 'Driver', 'Route Exp.', 'Maintenance', 'Govt. duty', 'Others', 'Total Exp.', 'N.Income'],
  ];

  // Create data rows
  const dataRows = trips.map(trip => [
    trip.date,
    trip.hoursOut,
    trip.hoursReturned,
    trip.from,
    trip.to,
    trip.odometerStart || 0,
    trip.odometerFinished || 0,
    trip.distanceKm || 0,
    trip.reasonForTrip || '',
    trip.driverSign || '',
    trip.journeyDirection === 'return' ? '↩ Return' : '→ Outward',
    trip.revenueCash || 0,
    trip.revenueOnline || 0,
    trip.revenuePaytm || 0,
    trip.revenueOthers || 0,
    trip.revenueTotal || 0,
    trip.expenseDiesel || 0,
    trip.expenseDriver || 0,
    trip.expenseRoute || 0,
    trip.expenseMaintenance || 0,
    trip.expenseGovtDuty || 0,
    trip.expenseOthers || 0,
    trip.expenseTotal || 0,
    trip.netIncome || 0,
  ]);

  // Add empty rows to match template
  while (dataRows.length < 10) {
    dataRows.push(['', '', '', '', '', '', '', 0, '', '', '', '', '', '', '', 0, '', '', '', '', '', '', 0, 0]);
  }

  // Calculate totals
  const totals = trips.reduce((acc, trip) => ({
    distanceKm: acc.distanceKm + (trip.distanceKm || 0),
    revenueCash: acc.revenueCash + (trip.revenueCash || 0),
    revenueOnline: acc.revenueOnline + (trip.revenueOnline || 0),
    revenuePaytm: acc.revenuePaytm + (trip.revenuePaytm || 0),
    revenueOthers: acc.revenueOthers + (trip.revenueOthers || 0),
    revenueTotal: acc.revenueTotal + (trip.revenueTotal || 0),
    expenseDiesel: acc.expenseDiesel + (trip.expenseDiesel || 0),
    expenseDriver: acc.expenseDriver + (trip.expenseDriver || 0),
    expenseRoute: acc.expenseRoute + (trip.expenseRoute || 0),
    expenseMaintenance: acc.expenseMaintenance + (trip.expenseMaintenance || 0),
    expenseGovtDuty: acc.expenseGovtDuty + (trip.expenseGovtDuty || 0),
    expenseOthers: acc.expenseOthers + (trip.expenseOthers || 0),
    expenseTotal: acc.expenseTotal + (trip.expenseTotal || 0),
    netIncome: acc.netIncome + (trip.netIncome || 0),
  }), {
    distanceKm: 0,
    revenueCash: 0,
    revenueOnline: 0,
    revenuePaytm: 0,
    revenueOthers: 0,
    revenueTotal: 0,
    expenseDiesel: 0,
    expenseDriver: 0,
    expenseRoute: 0,
    expenseMaintenance: 0,
    expenseGovtDuty: 0,
    expenseOthers: 0,
    expenseTotal: 0,
    netIncome: 0,
  });

  // Add totals row
  dataRows.push([
    'TOTAL', '', '', '', '', '', '', totals.distanceKm, '', '', '',
    totals.revenueCash, totals.revenueOnline, totals.revenuePaytm, totals.revenueOthers, totals.revenueTotal,
    totals.expenseDiesel, totals.expenseDriver, totals.expenseRoute, totals.expenseMaintenance, totals.expenseGovtDuty, totals.expenseOthers, totals.expenseTotal, totals.netIncome
  ]);

  // Combine all rows
  const allRows = [...headerRows, ...dataRows];
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Out
    { wch: 10 }, // Returned
    { wch: 15 }, // From
    { wch: 15 }, // To
    { wch: 8 },  // Start
    { wch: 8 },  // Finished
    { wch: 8 },  // Dist KM
    { wch: 15 }, // Reason
    { wch: 12 }, // Driver Sign
    { wch: 10 }, // Direction
    { wch: 10 }, // Cash
    { wch: 10 }, // Online
    { wch: 10 }, // Paytm
    { wch: 10 }, // Others
    { wch: 10 }, // G.Total
    { wch: 10 }, // Diesel
    { wch: 10 }, // Driver
    { wch: 10 }, // Route Exp
    { wch: 12 }, // Maintenance
    { wch: 10 }, // Govt duty
    { wch: 10 }, // Others
    { wch: 10 }, // Total Exp
    { wch: 10 }, // N.Income
  ];

  // Merge cells for headers
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 23 } }, // BUS TRIP SHEET
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },  // Hours
    { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },  // Journey
    { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },  // Odometer Reading
    { s: { r: 2, c: 11 }, e: { r: 2, c: 15 } }, // Revenue from operation
    { s: { r: 2, c: 16 }, e: { r: 2, c: 22 } }, // Expenses in operation
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trip Sheet');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Helper to convert trip data from database format to sheet format
// For two-way trips, this returns an array with outward and return rows
export function mapTripToSheetData(
  trip: {
    id: string;
    trip_number: string;
    start_date: string;
    end_date: string | null;
    status: string;
    notes: string | null;
    trip_type?: string;
    // Outward journey
    total_expense: number | null;
    odometer_start?: number | null;
    odometer_end?: number | null;
    distance_traveled?: number | null;
    revenue_cash?: number | null;
    revenue_online?: number | null;
    revenue_paytm?: number | null;
    revenue_others?: number | null;
    total_revenue?: number | null;
    // Return journey
    odometer_return_start?: number | null;
    odometer_return_end?: number | null;
    distance_return?: number | null;
    return_revenue_cash?: number | null;
    return_revenue_online?: number | null;
    return_revenue_paytm?: number | null;
    return_revenue_others?: number | null;
    return_total_revenue?: number | null;
    return_total_expense?: number | null;
    bus?: { registration_number: string; bus_name: string | null } | null;
    route?: { route_name: string; distance_km: number | null; from_address: string | null; to_address: string | null } | null;
    driver?: { full_name: string } | null;
  },
  expenses: {
    category_name: string;
    amount: number;
  }[]
): TripSheetData[] {
  // Group expenses by category (split between outward and return for two-way trips)
  const expenseByCategory = expenses.reduce((acc, exp) => {
    const category = exp.category_name.toLowerCase();
    if (category.includes('diesel') || category.includes('fuel')) {
      acc.diesel += exp.amount;
    } else if (category.includes('driver') || category.includes('salary')) {
      acc.driver += exp.amount;
    } else if (category.includes('route') || category.includes('toll')) {
      acc.route += exp.amount;
    } else if (category.includes('maintenance') || category.includes('repair')) {
      acc.maintenance += exp.amount;
    } else if (category.includes('govt') || category.includes('tax') || category.includes('duty')) {
      acc.govtDuty += exp.amount;
    } else {
      acc.others += exp.amount;
    }
    return acc;
  }, { diesel: 0, driver: 0, route: 0, maintenance: 0, govtDuty: 0, others: 0 });

  const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);

  const outwardRevenueTotal =
    (Number(trip.revenue_cash) || 0) +
    (Number(trip.revenue_online) || 0) +
    (Number(trip.revenue_paytm) || 0) +
    (Number(trip.revenue_others) || 0);

  const returnRevenueTotal =
    (Number(trip.return_revenue_cash) || 0) +
    (Number(trip.return_revenue_online) || 0) +
    (Number(trip.return_revenue_paytm) || 0) +
    (Number(trip.return_revenue_others) || 0);

  const startDate = new Date(trip.start_date);
  const endDate = trip.end_date ? new Date(trip.end_date) : null;

  const routeParts = trip.route?.route_name?.split(' - ') || [];
  const fromLocation = trip.route?.from_address || routeParts[0] || '';
  const toLocation = trip.route?.to_address || routeParts[1] || '';

  const isTwoWay = trip.trip_type === 'two_way';

  // Outward journey data
  const outwardData: TripSheetData = {
    vehicleNo: trip.bus?.registration_number || '',
    date: startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: '2-digit' }),
    hoursOut: startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    hoursReturned: endDate ? endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    from: fromLocation,
    to: toLocation,
    odometerStart: Number(trip.odometer_start) || 0,
    odometerFinished: Number(trip.odometer_end) || 0,
    distanceKm: Number(trip.distance_traveled) || trip.route?.distance_km || 0,
    reasonForTrip: trip.notes || 'Trip',
    driverSign: trip.driver?.full_name || '',
    tripType: isTwoWay ? 'two_way' : 'one_way',
    journeyDirection: 'outward',
    // Revenue from outward journey
    revenueCash: Number(trip.revenue_cash) || 0,
    revenueOnline: Number(trip.revenue_online) || 0,
    revenuePaytm: Number(trip.revenue_paytm) || 0,
    revenueOthers: Number(trip.revenue_others) || 0,
    revenueTotal: outwardRevenueTotal,
    // Expenses (for two-way trips, split evenly or use return expense field)
    expenseDiesel: isTwoWay ? expenseByCategory.diesel / 2 : expenseByCategory.diesel,
    expenseDriver: isTwoWay ? expenseByCategory.driver / 2 : expenseByCategory.driver,
    expenseRoute: isTwoWay ? expenseByCategory.route / 2 : expenseByCategory.route,
    expenseMaintenance: isTwoWay ? expenseByCategory.maintenance / 2 : expenseByCategory.maintenance,
    expenseGovtDuty: isTwoWay ? expenseByCategory.govtDuty / 2 : expenseByCategory.govtDuty,
    expenseOthers: isTwoWay ? expenseByCategory.others / 2 : expenseByCategory.others,
    expenseTotal: isTwoWay ? totalExpense / 2 : totalExpense,
    netIncome: isTwoWay ? (outwardRevenueTotal - totalExpense / 2) : (outwardRevenueTotal - totalExpense),
  };

  if (!isTwoWay) {
    return [outwardData];
  }

  // Return journey data for two-way trips
  const returnData: TripSheetData = {
    vehicleNo: trip.bus?.registration_number || '',
    date: startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: '2-digit' }),
    hoursOut: '', // Return journey timing
    hoursReturned: endDate ? endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    from: toLocation, // Swapped for return journey
    to: fromLocation,
    odometerStart: Number(trip.odometer_return_start) || 0,
    odometerFinished: Number(trip.odometer_return_end) || 0,
    distanceKm: Number(trip.distance_return) || trip.route?.distance_km || 0,
    reasonForTrip: 'Return',
    driverSign: trip.driver?.full_name || '',
    tripType: 'two_way',
    journeyDirection: 'return',
    // Revenue from return journey
    revenueCash: Number(trip.return_revenue_cash) || 0,
    revenueOnline: Number(trip.return_revenue_online) || 0,
    revenuePaytm: Number(trip.return_revenue_paytm) || 0,
    revenueOthers: Number(trip.return_revenue_others) || 0,
    revenueTotal: returnRevenueTotal,
    // Expenses (split for return journey)
    expenseDiesel: expenseByCategory.diesel / 2,
    expenseDriver: expenseByCategory.driver / 2,
    expenseRoute: expenseByCategory.route / 2,
    expenseMaintenance: expenseByCategory.maintenance / 2,
    expenseGovtDuty: expenseByCategory.govtDuty / 2,
    expenseOthers: expenseByCategory.others / 2,
    expenseTotal: totalExpense / 2,
    netIncome: returnRevenueTotal - totalExpense / 2,
  };

  return [outwardData, returnData];
}