import ExcelJS from 'exceljs';

interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any) => string | number;
}

export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Add headers
  worksheet.addRow(columns.map(col => col.header));

  // Add data rows
  data.forEach(row => {
    worksheet.addRow(
      columns.map(col => {
        const value = row[col.key];
        return col.format ? col.format(value) : value ?? '';
      })
    );
  });

  // Auto-size columns
  worksheet.columns.forEach((column, i) => {
    const maxLength = Math.max(
      columns[i].header.length,
      ...data.map(row => {
        const val = columns[i].format ? columns[i].format(row[columns[i].key]) : row[columns[i].key];
        return String(val ?? '').length;
      })
    );
    column.width = Math.min(maxLength + 2, 50);
  });

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
