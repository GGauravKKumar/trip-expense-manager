import * as XLSX from 'xlsx';

interface BusTripData {
  vehicleNo: string;
  trips: TripRowData[];
}

interface TripRowData {
  date: string;
  hoursOut: string;
  hoursReturned: string;
  from: string;
  to: string;
  odometerStart: number;
  odometerFinished: number;
  distanceKm: number;
  reasonForTrip: string;
  driverName: string;
  direction: string;
  revenueCash: number;
  revenueOnline: number;
  revenuePaytm: number;
  revenueOthers: number;
  revenueAgent: number;
  revenueTotal: number;
  expenseDiesel: number;
  expenseDriver: number;
  expenseRoute: number;
  expenseMaintenance: number;
  expenseGovtDuty: number;
  expenseOthers: number;
  expenseTotal: number;
  netIncome: number;
}

export function exportPeriodTripSheet(
  busData: BusTripData[],
  periodLabel: string,
  filename: string
) {
  const workbook = XLSX.utils.book_new();

  busData.forEach((bus) => {
    // Header rows
    const headerRows = [
      ['BUS TRIP SHEET', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`Vehicle No: ${bus.vehicleNo}`, '', '', `Period: ${periodLabel}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', 'Hours', '', 'Journey', '', 'Odometer Reading', '', '', '', '', '', 'Revenue from operation', '', '', '', '', '', 'Expenses in operation', '', '', '', '', '', '', ''],
      ['Date', 'Out', 'Returned', 'From', 'To', 'Start', 'Finished', 'Dist KM', 'Reason for trip', 'Driver', 'Direction', 'Cash', 'Online', 'Paytm', 'Others', 'Agent', 'G.Total', 'Diesel', 'Driver', 'Route Exp.', 'Maintenance', 'Govt. duty', 'Others', 'Total Exp.', 'N.Income'],
    ];

    // Data rows
    const dataRows = bus.trips.map((trip) => [
      trip.date,
      trip.hoursOut,
      trip.hoursReturned,
      trip.from,
      trip.to,
      trip.odometerStart || '',
      trip.odometerFinished || '',
      trip.distanceKm || 0,
      trip.reasonForTrip || '',
      trip.driverName || '',
      trip.direction || '',
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

    // Totals
    const totals = bus.trips.reduce(
      (acc, trip) => ({
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
      }),
      {
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
      }
    );

    dataRows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      totals.distanceKm,
      '',
      '',
      '',
      totals.revenueCash,
      totals.revenueOnline,
      totals.revenuePaytm,
      totals.revenueOthers,
      totals.revenueAgent,
      totals.revenueTotal,
      totals.expenseDiesel,
      totals.expenseDriver,
      totals.expenseRoute,
      totals.expenseMaintenance,
      totals.expenseGovtDuty,
      totals.expenseOthers,
      totals.expenseTotal,
      totals.netIncome,
    ]);

    const allRows = [...headerRows, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);

    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 15 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    ];

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 24 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 2, c: 11 }, e: { r: 2, c: 16 } }, // Revenue including Agent
      { s: { r: 2, c: 17 }, e: { r: 2, c: 23 } }, // Expenses
    ];

    // Use bus registration as sheet name (truncate to 31 chars max for Excel)
    const sheetName = bus.vehicleNo.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Add summary sheet
  const summaryRows: (string | number)[][] = [
    ['FLEET SUMMARY', '', '', '', '', ''],
    [`Period: ${periodLabel}`, '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Vehicle', 'Total Trips', 'Total Distance (km)', 'Total Revenue', 'Total Expenses', 'Net Income'],
  ];

  let fleetTotals = { trips: 0, distance: 0, revenue: 0, expense: 0, net: 0 };

  busData.forEach((bus) => {
    const busTotal = bus.trips.reduce(
      (acc, t) => ({
        distance: acc.distance + (t.distanceKm || 0),
        revenue: acc.revenue + (t.revenueTotal || 0),
        expense: acc.expense + (t.expenseTotal || 0),
        net: acc.net + (t.netIncome || 0),
      }),
      { distance: 0, revenue: 0, expense: 0, net: 0 }
    );

    summaryRows.push([
      bus.vehicleNo,
      bus.trips.length,
      busTotal.distance,
      busTotal.revenue,
      busTotal.expense,
      busTotal.net,
    ]);

    fleetTotals.trips += bus.trips.length;
    fleetTotals.distance += busTotal.distance;
    fleetTotals.revenue += busTotal.revenue;
    fleetTotals.expense += busTotal.expense;
    fleetTotals.net += busTotal.net;
  });

  summaryRows.push([
    'FLEET TOTAL',
    fleetTotals.trips,
    fleetTotals.distance,
    fleetTotals.revenue,
    fleetTotals.expense,
    fleetTotals.net,
  ]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
  ];
  summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Returns an array of trip rows (for two-way trips, returns 2 rows)
export function mapTripToPeriodData(
  trip: {
    id: string;
    trip_number: string;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    trip_type?: string;
    // Outward journey
    odometer_start: number | null;
    odometer_end: number | null;
    distance_traveled: number | null;
    revenue_cash: number | null;
    revenue_online: number | null;
    revenue_paytm: number | null;
    revenue_others: number | null;
    revenue_agent?: number | null;
    total_revenue: number | null;
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
    route?: { route_name: string; from_address?: string | null; to_address?: string | null } | null;
    driver?: { full_name: string } | null;
  },
  expenses: { category_name: string; amount: number }[]
): TripRowData[] {
  const expenseByCategory = expenses.reduce(
    (acc, exp) => {
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
    },
    { diesel: 0, driver: 0, route: 0, maintenance: 0, govtDuty: 0, others: 0 }
  );

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

  // Outward journey
  const outwardRow: TripRowData = {
    date: startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: '2-digit' }),
    hoursOut: startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    hoursReturned: endDate ? endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    from: fromLocation,
    to: toLocation,
    odometerStart: Number(trip.odometer_start) || 0,
    odometerFinished: Number(trip.odometer_end) || 0,
    distanceKm: Number(trip.distance_traveled) || 0,
    reasonForTrip: trip.notes || 'Trip',
    driverName: trip.driver?.full_name || '',
    direction: '→ Outward',
    revenueCash: Number(trip.revenue_cash) || 0,
    revenueOnline: Number(trip.revenue_online) || 0,
    revenuePaytm: Number(trip.revenue_paytm) || 0,
    revenueOthers: Number(trip.revenue_others) || 0,
    revenueAgent: Number(trip.revenue_agent) || 0,
    revenueTotal: outwardRevenueTotal,
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
    return [outwardRow];
  }

  // Return journey for two-way trips
  const returnRow: TripRowData = {
    date: startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: '2-digit' }),
    hoursOut: '',
    hoursReturned: endDate ? endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    from: toLocation,
    to: fromLocation,
    odometerStart: Number(trip.odometer_return_start) || 0,
    odometerFinished: Number(trip.odometer_return_end) || 0,
    distanceKm: Number(trip.distance_return) || 0,
    reasonForTrip: 'Return',
    driverName: trip.driver?.full_name || '',
    direction: '↩ Return',
    revenueCash: Number(trip.return_revenue_cash) || 0,
    revenueOnline: Number(trip.return_revenue_online) || 0,
    revenuePaytm: Number(trip.return_revenue_paytm) || 0,
    revenueOthers: Number(trip.return_revenue_others) || 0,
    revenueAgent: Number(trip.return_revenue_agent) || 0,
    revenueTotal: returnRevenueTotal,
    expenseDiesel: expenseByCategory.diesel / 2,
    expenseDriver: expenseByCategory.driver / 2,
    expenseRoute: expenseByCategory.route / 2,
    expenseMaintenance: expenseByCategory.maintenance / 2,
    expenseGovtDuty: expenseByCategory.govtDuty / 2,
    expenseOthers: expenseByCategory.others / 2,
    expenseTotal: totalExpense / 2,
    netIncome: returnRevenueTotal - totalExpense / 2,
  };

  return [outwardRow, returnRow];
}