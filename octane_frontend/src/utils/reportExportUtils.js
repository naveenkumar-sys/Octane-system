import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (val) => {
  const n = Number(val || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Universal Excel Exporter for Tabular Reports
 */
export const exportReportToExcel = ({
  filename = 'report',
  title = 'OCTANE ERP REPORT',
  subtitle = '',
  dateRange = '',
  summaryCards = [],
  columns = [],
  rows = [],
  sheetName = 'Report',
}) => {
  const wb = XLSX.utils.book_new();

  // Build worksheet rows
  const wsData = [];

  // Header Title
  wsData.push([title.toUpperCase()]);
  if (subtitle) wsData.push([subtitle]);
  if (dateRange) wsData.push([`Period: ${dateRange}`]);
  wsData.push([`Generated On: ${new Date().toLocaleString('en-IN')}`]);
  wsData.push([]); // blank row

  // Summary Metrics Block
  if (summaryCards && summaryCards.length > 0) {
    wsData.push(['--- SUMMARY METRICS ---']);
    summaryCards.forEach((card) => {
      wsData.push([card.label, card.value]);
    });
    wsData.push([]); // blank row
  }

  // Table Headers
  const headerLabels = columns.map((col) => col.label || col.header || col.key);
  wsData.push(headerLabels);

  // Table Data Rows
  rows.forEach((row) => {
    const rowData = columns.map((col) => {
      let val = row[col.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return val;
      return String(val);
    });
    wsData.push(rowData);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-calculate column widths
  const colWidths = headerLabels.map((lbl, colIdx) => {
    let maxLen = String(lbl).length;
    rows.forEach((row) => {
      const val = row[columns[colIdx].key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Universal PDF Exporter for Tabular Reports
 */
export const exportReportToPdf = ({
  filename = 'report',
  title = 'OCTANE ERP REPORT',
  subtitle = '',
  dateRange = '',
  summaryCards = [],
  columns = [],
  rows = [],
  orientation = 'landscape',
}) => {
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding Top Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Accent Line
  doc.setFillColor(234, 88, 12); // orange-600
  doc.rect(0, 45, pageWidth, 4, 'F');

  // Company / App Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OCTANE ERP', 30, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Management & Financial Reporting', 130, 28);

  // Timestamp
  const nowStr = new Date().toLocaleString('en-IN');
  doc.setFontSize(8);
  doc.text(`Generated: ${nowStr}`, pageWidth - 30, 28, { align: 'right' });

  // Report Title & Period
  let currentY = 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 30, currentY);

  currentY += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let subText = subtitle;
  if (dateRange) {
    subText += (subText ? ' | ' : '') + `Period: ${dateRange}`;
  }
  doc.text(subText, 30, currentY);

  // Summary Metrics Banner / Grid
  if (summaryCards && summaryCards.length > 0) {
    currentY += 15;
    const cardWidth = Math.min(140, (pageWidth - 60) / summaryCards.length);
    const cardHeight = 38;

    summaryCards.forEach((c, idx) => {
      const cardX = 30 + idx * (cardWidth + 8);
      // Card background
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 4, 4, 'FD');

      // Card Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label.toUpperCase().slice(0, 24), cardX + 8, currentY + 13);

      // Card Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const valText = String(c.value).replace(/₹/g, 'Rs. ');
      doc.text(valText.slice(0, 20), cardX + 8, currentY + 28);
    });

    currentY += cardHeight + 15;
  } else {
    currentY += 15;
  }

  // Prepare table data
  const head = [columns.map((col) => col.label || col.header || col.key)];
  const body = rows.map((row) =>
    columns.map((col) => {
      let val = row[col.key];
      if (val === null || val === undefined) return '—';
      if (typeof val === 'number') {
        if (col.format === 'currency') return formatCurrency(val);
        return val.toLocaleString('en-IN');
      }
      return String(val).replace(/₹/g, 'Rs. ');
    })
  );

  // Column alignments
  const columnStyles = {};
  columns.forEach((col, idx) => {
    if (col.align === 'right' || col.format === 'currency') {
      columnStyles[idx] = { halign: 'right' };
    } else if (col.align === 'center') {
      columnStyles[idx] = { halign: 'center' };
    }
  });

  autoTable(doc, {
    startY: currentY,
    head,
    body,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    didDrawPage: (data) => {
      // Footer page numbering
      const totalPages = doc.internal.getNumberOfPages();
      const pageCurrent = data.pageNumber;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `OCTANE ERP - Confidential Report | Page ${pageCurrent} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 15,
        { align: 'center' }
      );
    },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Universal CSV Exporter
 */
export const exportReportToCsv = ({
  filename = 'report',
  columns = [],
  rows = [],
}) => {
  const headers = columns.map((c) => c.label || c.key);
  const csvLines = [headers.join(',')];

  rows.forEach((row) => {
    const vals = columns.map((col) => {
      let val = row[col.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csvLines.push(vals.join(','));
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Specialized P&L Exporter (Excel)
 */
export const exportPnlToExcel = ({
  filename = 'pnl_statement',
  report,
}) => {
  if (!report) return;
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['OCTANE SYSTEMS - PROFIT & LOSS STATEMENT (TRADING & INCOME STATEMENT)'],
    [`Period: ${report.start_date} to ${report.end_date}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['LINE ITEM', 'AMOUNT (INR)', 'MARGIN / NOTES'],
    ['1. SALES & REVENUE (WHAT CUSTOMERS BOUGHT)', '', ''],
    ['Total Bill Amount to Customers (With GST)', report.gross_sales, 'Total Invoiced'],
    ['Total Sales Value (Before GST)', report.gross_sales_taxable || report.sales_taxable_revenue, '100.0%'],
    ['Minus: Customer Returns (Refunded)', -(report.sales_returns_taxable || 0), 'Deduction'],
    ['NET SALES INCOME (YOUR BUSINESS TURNOVER)', report.net_sales_revenue || report.sales_taxable_revenue, 'Real Sales Income'],
    ['GST Tax Collected (For Government)', report.tax_collected, 'Tax Collected (Excluded from Profit)'],
    [],
    ['2. PURCHASE COST OF SOLD ITEMS (STOCK AUDIT)', '', ''],
    ['Starting Stock Value (Beginning of Period)', report.opening_inventory || 0, 'Stock on Hand (Start)'],
    ['Plus: New Purchases Received (Stock Added)', report.purchases_taxable || 0, 'New Stock Investment'],
    ['Minus: Goods Returned to Suppliers', -(report.purchase_returns_taxable || 0), 'Returned to Vendors'],
    ['Total Stock Handled (Starting + Purchases)', report.goods_available_for_sale || 0, 'Total Available Stock'],
    ['Minus: Unsold Stock Still in Shop', -(report.closing_inventory || 0), 'Stock Asset at End'],
    ['COST OF ITEMS ACTUALLY SOLD', report.cost_of_goods_sold, 'Purchase Cost of Sold Items'],
    [],
    ['3. PROFIT ON SALES', '', ''],
    ['PROFIT ON SALES', report.gross_profit, `${report.gross_margin_pct}% Margin`],
    [],
    ['4. SHOP RUNNING EXPENSES', '', ''],
  ];

  if (report.expense_breakdown && report.expense_breakdown.length > 0) {
    const baseRevenue = report.net_sales_revenue || report.sales_taxable_revenue;
    report.expense_breakdown.forEach((exp) => {
      const pctVal = baseRevenue
        ? `${((exp.total / baseRevenue) * 100).toFixed(1)}%`
        : '0.0%';
      wsData.push([`  - ${exp.category}`, exp.total, pctVal]);
    });
  } else {
    wsData.push(['  - No operating expenses recorded', 0, '0.0%']);
  }

  wsData.push(['TOTAL SHOP RUNNING BILLS', report.operating_expenses, '']);
  wsData.push([]);
  wsData.push([
    report.net_profit >= 0 ? '5. FINAL NET PROFIT' : '5. FINAL NET LOSS',
    report.net_profit,
    `${report.net_margin_pct}% Net Margin`,
  ]);
  wsData.push([]);
  wsData.push(['6. GST & CASH POSITION (SEPARATE FROM PROFIT)', '', '']);
  wsData.push(['GST Collected from Customers (Output Tax)', report.output_gst || 0, 'Tax collected on sales']);
  wsData.push(['GST Paid on Purchases (Input Credit)', report.input_gst || 0, 'Tax credit on purchases']);
  wsData.push([
    (report.net_gst_payable || 0) > 0 ? 'Net GST to Pay Government' : 'Available GST Credit (No Tax to Pay)',
    Math.abs(report.net_gst_payable || 0),
    (report.net_gst_payable || 0) > 0 ? 'Payable to Government' : 'Credit Carried Forward'
  ]);
  wsData.push(['Money Received from Customers', report.total_customer_receipts || 0, 'Cash/Bank Inflow']);
  wsData.push(['Money Paid to Suppliers', report.total_supplier_payouts || 0, 'Cash/Bank Outflow']);
  wsData.push(['Cash Paid for Shop Bills & Rent', (report.total_operating_cash_expenses || 0) + (report.total_partner_drawings || 0), 'Cash/Bank Outflow']);
  wsData.push([
    (report.net_cash_flow || 0) >= 0 ? 'Net Cash Inflow (Surplus)' : 'Net Cash Outflow (Deficit)',
    report.net_cash_flow || 0,
    'Real Cash Movement'
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Specialized P&L Exporter (PDF)
 */
export const exportPnlToPdf = ({
  filename = 'pnl_statement',
  report,
}) => {
  if (!report) return;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding Top Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 45, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OCTANE ERP', 30, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Profit & Loss Financial Statement (Audited Trading & Income)', 130, 28);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 30, 28, { align: 'right' });

  // Period Subheader
  let currentY = 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('STATEMENT OF PROFIT & LOSS', 30, currentY);

  currentY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${report.start_date} to ${report.end_date} | Invoices by Bill Date`, 30, currentY);

  currentY += 20;

  // Statement rows
  const pnlRows = [
    ['Total Bill Amount to Customers (With GST)', formatCurrency(report.gross_sales), 'Total Invoiced'],
    ['Total Sales Value (Before GST)', formatCurrency(report.gross_sales_taxable || report.sales_taxable_revenue), '100.0%'],
    ['Minus: Customer Returns (Refunded)', formatCurrency(report.sales_returns_taxable || 0), 'Returns'],
    ['NET SALES INCOME (YOUR TURNOVER)', formatCurrency(report.net_sales_revenue || report.sales_taxable_revenue), 'Real Sales Income'],
    ['--- PURCHASE COST OF SOLD ITEMS ---', '', ''],
    ['Starting Stock Value (Beginning of Period)', formatCurrency(report.opening_inventory || 0), 'Stock on Hand'],
    ['Plus: New Purchases Received (Stock Added)', formatCurrency(report.purchases_taxable || 0), 'Stock Added'],
    ['Minus: Goods Returned to Suppliers', formatCurrency(report.purchase_returns_taxable || 0), 'Vendor Returns'],
    ['Total Stock Handled', formatCurrency(report.goods_available_for_sale || 0), 'Available Stock'],
    ['Minus: Unsold Stock Still in Shop', formatCurrency(report.closing_inventory || 0), 'Stock in Shop'],
    ['COST OF ITEMS ACTUALLY SOLD', formatCurrency(report.cost_of_goods_sold), 'Purchase Cost'],
    ['--- PROFITABILITY ---', '', ''],
    ['PROFIT ON SALES', formatCurrency(report.gross_profit), `${report.gross_margin_pct}%`],
    ['Total Shop Running Bills', formatCurrency(report.operating_expenses), 'Shop Expenses'],
  ];

  if (report.expense_breakdown && report.expense_breakdown.length > 0) {
    const baseRevenue = report.net_sales_revenue || report.sales_taxable_revenue;
    report.expense_breakdown.forEach((exp) => {
      const pctVal = baseRevenue
        ? `${((exp.total / baseRevenue) * 100).toFixed(1)}%`
        : '—';
      pnlRows.push([`   ↳ ${exp.category}`, formatCurrency(exp.total), pctVal]);
    });
  }

  const isProfit = report.net_profit >= 0;
  pnlRows.push([
    isProfit ? 'FINAL NET PROFIT' : 'FINAL NET LOSS',
    formatCurrency(Math.abs(report.net_profit)),
    `${report.net_margin_pct}%`,
  ]);

  pnlRows.push(['--- GST & CASH REGISTER (Informational) ---', '', '']);
  pnlRows.push(['GST Collected from Customers', formatCurrency(report.output_gst || 0), 'Output Tax']);
  pnlRows.push(['GST Paid on Purchases (Credit)', formatCurrency(report.input_gst || 0), 'Input Tax Credit']);
  pnlRows.push([
    (report.net_gst_payable || 0) > 0 ? 'Net GST to Pay Government' : 'Available GST Credit (No Tax to Pay)',
    formatCurrency(Math.abs(report.net_gst_payable || 0)),
    (report.net_gst_payable || 0) > 0 ? 'Tax Payable' : 'Credit Available'
  ]);
  pnlRows.push([
    (report.net_cash_flow || 0) >= 0 ? 'Net Cash Inflow (Surplus)' : 'Net Cash Outflow (Deficit)',
    formatCurrency(report.net_cash_flow || 0),
    'Real Money Flow'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Financial Line Item', 'Amount (INR)', 'Margin / Disclosure']],
    body: pnlRows,
    margin: { left: 30, right: 30 },
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 120 },
      2: { halign: 'right', cellWidth: 100 },
    },
    didParseCell: (data) => {
      const rawText = String(data.cell.raw);
      if (rawText.includes('PROFIT ON SALES') || rawText.includes('FINAL NET PROFIT') || rawText.includes('TOTAL SALES (BEFORE TAX)')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 253, 244]; // emerald-50
        data.cell.styles.textColor = [22, 101, 52]; // emerald-800
      } else if (rawText.includes('FINAL NET LOSS')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 241, 242]; // rose-50
        data.cell.styles.textColor = [159, 18, 57]; // rose-800
      }
      if (rawText.startsWith('---')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [71, 85, 105];
      }
    },
    didDrawPage: (data) => {
      const totalPages = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `OCTANE ERP - Confidential P&L | Page ${data.pageNumber} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 15,
        { align: 'center' }
      );
    },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Specialized GST Report Exporter (Excel)
 */
export const exportGstToExcel = ({
  filename = 'gst_summary_report',
  report,
}) => {
  if (!report) return;
  const wb = XLSX.utils.book_new();

  // Sheet 1: GST Overview (Output, Input, Net)
  const overviewData = [
    ['OCTANE SYSTEMS - GST TAX COMPLIANCE REPORT'],
    [`Period: ${report.start_date} to ${report.end_date}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['TAX TYPE / CATEGORY', 'TAXABLE AMOUNT', 'CGST', 'SGST', 'IGST', 'TOTAL TAX', 'GROSS INVOICE VALUE'],
    [
      'Output GST (Sales Invoices)',
      report.output_gst?.taxable_amount || 0,
      report.output_gst?.cgst || 0,
      report.output_gst?.sgst || 0,
      report.output_gst?.igst || 0,
      report.output_gst?.total_tax || 0,
      report.output_gst?.gross_sales || 0,
    ],
    [
      'Input GST Credit (Purchases)',
      report.input_gst?.taxable_amount || 0,
      report.input_gst?.cgst || 0,
      report.input_gst?.sgst || 0,
      report.input_gst?.igst || 0,
      report.input_gst?.total_tax || 0,
      report.input_gst?.gross_purchases || 0,
    ],
    [],
    [
      'NET GST PAYABLE / (REFUND)',
      '',
      report.net_gst?.cgst || 0,
      report.net_gst?.sgst || 0,
      report.net_gst?.igst || 0,
      report.net_gst?.total_payable || 0,
      '',
    ],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'GST Overview');

  // Sheet 2: HSN / SAC Summary
  if (report.hsn_summary && report.hsn_summary.length > 0) {
    const hsnData = [
      ['HSN/SAC SUMMARY FOR GSTR-1'],
      [`Period: ${report.start_date} to ${report.end_date}`],
      [],
      ['HSN / SAC', 'DESCRIPTION', 'TOTAL QUANTITY', 'TAXABLE AMOUNT', 'CGST', 'SGST', 'IGST', 'TOTAL AMOUNT'],
    ];

    report.hsn_summary.forEach((item) => {
      hsnData.push([
        item.hsn_sac,
        item.description || '',
        item.total_qty,
        item.taxable_amount,
        item.cgst_amount,
        item.sgst_amount,
        item.igst_amount,
        item.total_amount,
      ]);
    });

    const wsHsn = XLSX.utils.aoa_to_sheet(hsnData);
    wsHsn['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsHsn, 'HSN-SAC Summary');
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Specialized GST Report Exporter (PDF)
 */
export const exportGstToPdf = ({
  filename = 'gst_summary_report',
  report,
}) => {
  if (!report) return;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding Top Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 45, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OCTANE ERP', 30, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('GST Tax Compliance & GSTR-1 Summary', 130, 28);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 30, 28, { align: 'right' });

  let currentY = 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('GST TAX AUDIT & FILING STATEMENT', 30, currentY);

  currentY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${report.start_date} to ${report.end_date}`, 30, currentY);

  currentY += 15;

  // Table 1: GST Tax Net Reconciliation
  const out = report.output_gst || {};
  const inp = report.input_gst || {};
  const net = report.net_gst || {};

  const summaryHead = [['Tax Stream', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total GST', 'Gross Turnover']];
  const summaryBody = [
    [
      'Output Tax (Sales)',
      formatCurrency(out.taxable_amount),
      formatCurrency(out.cgst),
      formatCurrency(out.sgst),
      formatCurrency(out.igst),
      formatCurrency(out.total_tax),
      formatCurrency(out.gross_sales),
    ],
    [
      'Input Tax Credit (Purchases)',
      formatCurrency(inp.taxable_amount),
      formatCurrency(inp.cgst),
      formatCurrency(inp.sgst),
      formatCurrency(inp.igst),
      formatCurrency(inp.total_tax),
      formatCurrency(inp.gross_purchases),
    ],
    [
      'NET GST PAYABLE',
      '—',
      formatCurrency(net.cgst),
      formatCurrency(net.sgst),
      formatCurrency(net.igst),
      formatCurrency(net.total_payable),
      '—',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: summaryHead,
    body: summaryBody,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [255, 247, 237]; // orange-50
        data.cell.styles.textColor = [194, 65, 12]; // orange-700
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 25;

  // Table 2: HSN/SAC Breakdown
  if (report.hsn_summary && report.hsn_summary.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('HSN / SAC Outward Supplies Summary (GSTR-1)', 30, currentY);

    const hsnHead = [['HSN/SAC', 'Description', 'Quantity', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Invoice']];
    const hsnBody = report.hsn_summary.map((h) => [
      h.hsn_sac,
      (h.description || '').slice(0, 30),
      Number(h.total_qty).toFixed(2),
      formatCurrency(h.taxable_amount),
      formatCurrency(h.cgst_amount),
      formatCurrency(h.sgst_amount),
      formatCurrency(h.igst_amount),
      formatCurrency(h.total_amount),
    ]);

    autoTable(doc, {
      startY: currentY + 8,
      head: hsnHead,
      body: hsnBody,
      margin: { left: 30, right: 30 },
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        const totalPages = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `OCTANE ERP - GST Tax Audit | Page ${data.pageNumber} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 15,
          { align: 'center' }
        );
      },
    });
  }

  doc.save(`${filename}.pdf`);
};
