import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, TrendingUp, Download, Receipt, FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '../../services/api';
import ReportFilters from '../../components/reports/ReportFilters';
import ReportTable from '../../components/reports/ReportTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportReportToExcel, exportReportToPdf, exportReportToCsv } from '../../utils/reportExportUtils';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const COLUMNS = [
  {
    key: 'invoice_number',
    label: 'Invoice #',
    render: (v, row) => {
      const isGst =
        row?.is_gst !== false &&
        !v?.startsWith('EST-') &&
        (row?.invoice_type === 'TAX_INVOICE' || Number(row?.total_tax) > 0 || v?.startsWith('INV-'));
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-orange-700">{v}</span>
          {isGst ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              GST
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              Non-GST
            </span>
          )}
        </div>
      );
    },
  },
  { key: 'invoice_date', label: 'Date' },
  { key: 'customer_name', label: 'Customer', render: (v) => <span className="font-semibold text-slate-800">{v}</span> },
  { key: 'subtotal', label: 'Subtotal', align: 'right', format: 'currency', render: (v) => fmt(v) },
  {
    key: 'discount_amount',
    label: 'Discount',
    align: 'right',
    format: 'currency',
    render: (v) => (v > 0 ? <span className="text-rose-600">{fmt(v)}</span> : '—'),
  },
  { key: 'total_tax', label: 'GST', align: 'right', format: 'currency', render: (v) => fmt(v) },
  {
    key: 'grand_total',
    label: 'Total',
    align: 'right',
    format: 'currency',
    render: (v) => <span className="font-extrabold text-slate-900">{fmt(v)}</span>,
  },
  {
    key: 'amount_paid',
    label: 'Paid',
    align: 'right',
    format: 'currency',
    render: (v) => <span className="text-emerald-700 font-bold">{fmt(v)}</span>,
  },
  {
    key: 'balance_due',
    label: 'Balance',
    align: 'right',
    format: 'currency',
    render: (v) => (v > 0 ? <span className="text-rose-600 font-bold">{fmt(v)}</span> : <span className="text-emerald-600 font-bold">—</span>),
  },
  { key: 'payment_status', label: 'Status', align: 'center', render: (v) => <StatusBadge status={v} type="payment" /> },
];

const SalesReport = () => {
  const today = toLocalDateString(new Date());
  const monthStart = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'GST' | 'NON_GST'
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIdRef = useRef(0);

  const fetchReport = useCallback(
    async (customStart, customEnd) => {
      const sDate = customStart !== undefined ? customStart : startDate;
      const eDate = customEnd !== undefined ? customEnd : endDate;

      const currentFetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (sDate) params.append('start_date', sDate);
        if (eDate) params.append('end_date', eDate);
        if (paymentStatus !== 'ALL') params.append('payment_status', paymentStatus);
        if (search.trim()) params.append('search', search.trim());
        const data = await api.getSalesReport(`?${params.toString()}`);
        if (currentFetchId === fetchIdRef.current) {
          setReport(data);
        }
      } catch (err) {
        if (currentFetchId === fetchIdRef.current) {
          setError(err.message || 'Failed to load sales report.');
        }
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [startDate, endDate, paymentStatus, search]
  );

  // Initial load
  useEffect(() => {
    fetchReport(startDate, endDate);
  }, []);

  // Fetch when payment status changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchReport(startDate, endDate);
  }, [paymentStatus]);

  // Enrich rows with explicit GST classification
  const enrichedRows = useMemo(() => {
    return (report?.rows || []).map((r) => {
      const isGst =
        r.is_gst !== false &&
        r.invoice_type !== 'NON_GST' &&
        !r.invoice_number?.startsWith('EST-') &&
        (r.invoice_type === 'TAX_INVOICE' || Number(r.total_tax) > 0 || r.invoice_number?.startsWith('INV-'));
      return {
        ...r,
        is_gst: isGst,
        invoice_type_label: isGst ? 'GST Tax Invoice' : 'Non-GST / Estimate',
      };
    });
  }, [report?.rows]);

  const allRows = enrichedRows;
  const gstRows = useMemo(() => enrichedRows.filter((r) => r.is_gst), [enrichedRows]);
  const nonGstRows = useMemo(() => enrichedRows.filter((r) => !r.is_gst), [enrichedRows]);

  // Tab filtered rows
  const activeTabRows = useMemo(() => {
    if (activeTab === 'GST') return gstRows;
    if (activeTab === 'NON_GST') return nonGstRows;
    return allRows;
  }, [activeTab, allRows, gstRows, nonGstRows]);

  // Client search filtering
  const displayedRows = useMemo(() => {
    if (!search.trim()) return activeTabRows;
    const q = search.trim().toLowerCase();
    return activeTabRows.filter(
      (r) =>
        (r.invoice_number && r.invoice_number.toLowerCase().includes(q)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.payment_status && r.payment_status.toLowerCase().includes(q))
    );
  }, [activeTabRows, search]);

  // Tab-specific Summary Metrics
  const summary = useMemo(() => {
    const count = displayedRows.length;
    const taxable = displayedRows.reduce((sum, r) => sum + Number(r.taxable_amount || 0), 0);
    const tax = displayedRows.reduce((sum, r) => sum + Number(r.total_tax || 0), 0);
    const grand = displayedRows.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);
    const paid = displayedRows.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
    const due = displayedRows.reduce((sum, r) => sum + Number(r.balance_due || 0), 0);
    return {
      total_invoices: count,
      total_taxable_amount: taxable,
      total_tax: tax,
      total_grand_total: grand,
      total_paid: paid,
      total_balance_due: due,
    };
  }, [displayedRows]);

  const getSummaryCards = () => [
    { label: 'Total Invoices', value: String(summary.total_invoices) },
    { label: 'Sales (Before GST)', value: fmt(summary.total_taxable_amount) },
    { label: 'GST Collected', value: fmt(summary.total_tax) },
    { label: 'Total Invoiced', value: fmt(summary.total_grand_total) },
    { label: 'Amount Received', value: fmt(summary.total_paid) },
    { label: 'Pending Dues', value: fmt(summary.total_balance_due) },
  ];

  const getTabMeta = () => {
    if (activeTab === 'GST') {
      return {
        slug: 'gst',
        title: 'GST Sales & Tax Invoices Report',
        sheet: 'GST Invoices',
        typeLabel: 'GST Tax Invoices',
      };
    }
    if (activeTab === 'NON_GST') {
      return {
        slug: 'non_gst',
        title: 'Non-GST & Estimate Invoices Report',
        sheet: 'Non-GST Invoices',
        typeLabel: 'Non-GST / Estimates',
      };
    }
    return {
      slug: 'all',
      title: 'Sales & Revenue Audit Report (All Invoices)',
      sheet: 'All Sales',
      typeLabel: 'All Invoices (GST & Non-GST)',
    };
  };

  const handleExportExcel = () => {
    if (!displayedRows.length) return;
    const meta = getTabMeta();
    exportReportToExcel({
      filename: `sales_report_${meta.slug}_${startDate}_${endDate}`,
      title: meta.title,
      subtitle: `Invoice Category: ${meta.typeLabel} | Payment Status: ${paymentStatus}`,
      dateRange: `${startDate} to ${endDate}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: displayedRows,
      sheetName: meta.sheet,
    });
  };

  const handleExportPdf = () => {
    if (!displayedRows.length) return;
    const meta = getTabMeta();
    exportReportToPdf({
      filename: `sales_report_${meta.slug}_${startDate}_${endDate}`,
      title: meta.title,
      subtitle: `Invoice Category: ${meta.typeLabel} | Payment Status: ${paymentStatus}`,
      dateRange: `${startDate} to ${endDate}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: displayedRows,
      orientation: 'landscape',
    });
  };

  const handleExportCsv = () => {
    if (!displayedRows.length) return;
    const meta = getTabMeta();
    exportReportToCsv({
      filename: `sales_report_${meta.slug}_${startDate}_${endDate}`,
      columns: COLUMNS,
      rows: displayedRows,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="text-orange-600" size={24} />
          <span>Sales Report</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track all sales invoices, GST collected, payments received, and pending customer dues.
        </p>
      </div>

      {/* Filters */}
      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={(s, e) => fetchReport(s, e)}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Invoice # or Customer..."
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onExportCsv={handleExportCsv}
        exportLabel={activeTab === 'GST' ? 'Export GST' : activeTab === 'NON_GST' ? 'Export Non-GST' : 'Export All'}
        hasData={Boolean(displayedRows.length)}
        extraFilters={
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        }
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Active Sales Period Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>
            Sales Accounting Period: {startDate <= '2020-01-01' ? 'All-Time (From Start)' : startDate} to {endDate} {endDate === today ? '(Until Now)' : ''}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {allRows.length} total invoice{allRows.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Category Tabs: All, GST, Non-GST & Quick Tab Downloads */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Invoices</span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                activeTab === 'ALL' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {allRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GST')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'GST'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-blue-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>GST Invoices</span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                activeTab === 'GST' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {gstRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NON_GST')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'NON_GST'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>Non-GST / Estimates</span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                activeTab === 'NON_GST' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {nonGstRows.length}
            </span>
          </button>
        </div>

        {/* Quick Tab Export Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            Export {activeTab === 'GST' ? 'GST' : activeTab === 'NON_GST' ? 'Non-GST' : 'All'}:
          </span>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || !displayedRows.length}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            title={`Download ${activeTab} as Excel`}
          >
            <FileSpreadsheet size={13} />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={loading || !displayedRows.length}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            title={`Download ${activeTab} as PDF`}
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !displayedRows.length}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            title={`Download ${activeTab} as CSV`}
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards for Active Tab */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Invoices</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{summary.total_invoices}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Bills generated</p>
          </div>
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Sales Income (Pre-GST)</p>
            <p className="text-xl font-extrabold text-blue-900 font-mono mt-1">{fmt(summary.total_taxable_amount)}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">Actual shop revenue</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST Collected</p>
            <p className="text-xl font-extrabold text-orange-600 font-mono mt-1">{fmt(summary.total_tax)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Tax for government</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Invoiced (With GST)</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">{fmt(summary.total_grand_total)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Customer bill totals</p>
          </div>
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 shadow-xs">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Amount Received</p>
            <p className="text-xl font-extrabold text-emerald-800 font-mono mt-1">{fmt(summary.total_paid)}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Cash / UPI / Bank collected</p>
          </div>
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 shadow-xs">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Pending Dues</p>
            <p className="text-xl font-extrabold text-rose-700 font-mono mt-1">{fmt(summary.total_balance_due)}</p>
            <p className="text-[10px] text-rose-500 mt-0.5">{summary.total_balance_due > 0 ? 'Pending credit' : '100% collected'}</p>
          </div>
        </div>

        {/* Clear Calculation Banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <span className="text-sm">🧾</span>
              <span>Sales Calculation:</span>
              <span className="font-mono text-slate-700">Total Billed ({fmt(summary.total_grand_total)})</span>
              <span>=</span>
              <span className="font-mono text-blue-700">Sales Income ({fmt(summary.total_taxable_amount)})</span>
              <span>+</span>
              <span className="font-mono text-orange-600">GST Collected ({fmt(summary.total_tax)})</span>
            </div>
            <p className="text-[11px] text-slate-500">
              * Note: Sales Income ({fmt(summary.total_taxable_amount)}) is your shop's actual turnover in Profit &amp; Loss. GST ({fmt(summary.total_tax)}) belongs to the tax department.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              summary.total_balance_due > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {summary.total_balance_due > 0 ? `Uncollected Dues: ${fmt(summary.total_balance_due)}` : '✓ All Invoices Collected (₹0 Balance)'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <ReportTable
        columns={COLUMNS}
        rows={displayedRows}
        loading={loading}
        emptyMessage={
          activeTab === 'GST'
            ? 'No GST tax invoices found for the selected period.'
            : activeTab === 'NON_GST'
            ? 'No Non-GST / estimate bills found for the selected period.'
            : 'No sales invoices found for the selected period.'
        }
      />
    </div>
  );
};

export default SalesReport;
