import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any) => string | number;
}

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const worksheetData = [
    columns.map(col => col.header),
    ...data.map(row =>
      columns.map(col => {
        const value = row[col.key];
        return col.format ? col.format(value) : value ?? '';
      })
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const maxLength = Math.max(
      col.header.length,
      ...data.map(row => {
        const val = col.format ? col.format(row[col.key]) : row[col.key];
        return String(val ?? '').length;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '₹0';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
