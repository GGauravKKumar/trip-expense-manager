import ExcelJS from 'exceljs';

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
  revenueAgent: number;
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

export async function exportTripSheet(trips: TripSheetData[], vehicleNo: string, filename: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Trip Sheet');
  
  // Create header rows
  worksheet.addRow(['BUS TRIP SHEET']);
  worksheet.addRow(['Vehicle No', vehicleNo]);
  worksheet.addRow(['', 'Hours', '', 'Journey', '', 'Odometer Reading', '', '', '', '', '', 'Revenue from operation', '', '', '', '', '', 'Expenses in operation']);
  worksheet.addRow(['Date', 'Out', 'Returned', 'From', 'To', 'Start', 'Finished', 'Dist KM', 'Reason for trip', 'Driver Sign', 'Direction', 'Cash', 'Online', 'Paytm', 'Others', 'Agent', 'G.Total', 'Diesel', 'Driver', 'Route Exp.', 'Maintenance', 'Govt. duty', 'Others', 'Total Exp.', 'N.Income']);

  // Create data rows
  trips.forEach(trip => {
    worksheet.addRow([
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
      trip.revenueAgent || 0,
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
  });

  // Add empty rows to match template
  while (worksheet.rowCount < 14) {
    worksheet.addRow(['', '', '', '', '', '', '', 0, '', '', '', '', '', '', '', '', 0, '', '', '', '', '', '', 0, 0]);
  }

  // Calculate totals
  const totals = trips.reduce((acc, trip) => ({
    distanceKm: acc.distanceKm + (trip.distanceKm || 0),
    revenueCash: acc.revenueCash + (trip.revenueCash || 0),
    revenueOnline: acc.revenueOnline + (trip.revenueOnline || 0),
    revenuePaytm: acc.revenuePaytm + (trip.revenuePaytm || 0),
    revenueOthers: acc.revenueOthers + (trip.revenueOthers || 0),
    revenueAgent: acc.revenueAgent + (trip.revenueAgent || 0),
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
    revenueAgent: 0,
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
  worksheet.addRow([
    'TOTAL', '', '', '', '', '', '', totals.distanceKm, '', '', '',
    totals.revenueCash, totals.revenueOnline, totals.revenuePaytm, totals.revenueOthers, totals.revenueAgent, totals.revenueTotal,
    totals.expenseDiesel, totals.expenseDriver, totals.expenseRoute, totals.expenseMaintenance, totals.expenseGovtDuty, totals.expenseOthers, totals.expenseTotal, totals.netIncome
  ]);

  // Set column widths
  worksheet.columns = [
    { width: 12 }, // Date
    { width: 10 }, // Out
    { width: 10 }, // Returned
    { width: 15 }, // From
    { width: 15 }, // To
    { width: 8 },  // Start
    { width: 8 },  // Finished
    { width: 8 },  // Dist KM
    { width: 15 }, // Reason
    { width: 12 }, // Driver Sign
    { width: 10 }, // Direction
    { width: 10 }, // Cash
    { width: 10 }, // Online
    { width: 10 }, // Paytm
    { width: 10 }, // Others
    { width: 10 }, // Agent
    { width: 10 }, // G.Total
    { width: 10 }, // Diesel
    { width: 10 }, // Driver
    { width: 10 }, // Route Exp
    { width: 12 }, // Maintenance
    { width: 10 }, // Govt duty
    { width: 10 }, // Others
    { width: 10 }, // Total Exp
    { width: 10 }, // N.Income
  ];

  // Merge cells for headers
  worksheet.mergeCells('A1:Y1');
  worksheet.mergeCells('B3:C3');
  worksheet.mergeCells('D3:E3');
  worksheet.mergeCells('F3:G3');
  worksheet.mergeCells('L3:Q3');
  worksheet.mergeCells('R3:X3');

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
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
    revenue_agent?: number | null;
    total_revenue?: number | null;
    // Return journey
    odometer_return_start?: number | null;
    odometer_return_end?: number | null;
    distance_return?: number | null;
    return_revenue_cash?: number | null;
    return_revenue_online?: number | null;
    return_revenue_paytm?: number | null;
    return_revenue_others?: number | null;
    return_revenue_agent?: number | null;
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
    (Number(trip.revenue_others) || 0) +
    (Number(trip.revenue_agent) || 0);

  const returnRevenueTotal =
    (Number(trip.return_revenue_cash) || 0) +
    (Number(trip.return_revenue_online) || 0) +
    (Number(trip.return_revenue_paytm) || 0) +
    (Number(trip.return_revenue_others) || 0) +
    (Number(trip.return_revenue_agent) || 0);

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
    revenueAgent: Number(trip.revenue_agent) || 0,
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
    revenueAgent: Number(trip.return_revenue_agent) || 0,
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
