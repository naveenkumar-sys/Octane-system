import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag } from 'lucide-react';
import { api } from '../../services/api';
import ReportFilters from '../../components/reports/ReportFilters';
import ReportTable from '../../components/reports/ReportTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportReportToExcel, exportReportToPdf, exportReportToCsv } from '../../utils/reportExportUtils';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const COLUMNS = [
  { key: 'purchase_number', label: 'Purchase #', render: (v) => <span className="font-mono font-bold text-orange-700">{v}</span> },
  { key: 'purchase_date', label: 'Date' },
  { key: 'supplier_name', label: 'Supplier', render: (v) => <span className="font-semibold">{v}</span> },
  { key: 'supplier_invoice_number', label: 'Supplier Bill #', render: (v) => <span className="font-mono text-slate-600">{v}</span> },
  { key: 'subtotal', label: 'Taxable Amount', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'tax_amount', label: 'GST', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'total_amount', label: 'Total Bill', align: 'right', format: 'currency', render: (v) => <span className="font-extrabold">{fmt(v)}</span> },
  { key: 'paid_amount', label: 'Paid', align: 'right', format: 'currency', render: (v) => <span className="text-emerald-700 font-bold">{fmt(v)}</span> },
  { key: 'balance_due', label: 'Pending to Pay', align: 'right', format: 'currency', render: (v) => (v > 0 ? <span className="text-rose-600 font-bold">{fmt(v)}</span> : <span className="text-emerald-600">—</span>) },
  { key: 'payment_status', label: 'Status', align: 'center', render: (v) => <StatusBadge status={v} type="payment" /> },
];

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PurchaseReport = () => {
  const today = toLocalDateString(new Date());
  const monthStart = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (customStart, customEnd) => {
    const sDate = customStart !== undefined ? customStart : startDate;
    const eDate = customEnd !== undefined ? customEnd : endDate;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sDate) params.append('start_date', sDate);
      if (eDate) params.append('end_date', eDate);
      if (paymentStatus !== 'ALL') params.append('payment_status', paymentStatus);
      if (search.trim()) params.append('search', search.trim());
      const data = await api.getPurchaseReport(`?${params.toString()}`);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase report.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, paymentStatus, search]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = report?.summary;
  const taxableAmount = summary?.total_taxable ?? Math.max(0, (Number(summary?.total_amount || 0) - Number(summary?.total_tax || 0)));

  const getSummaryCards = () => [
    { label: 'Total Purchases', value: String(report?.total_purchases || 0) },
    { label: 'Items Value (Before GST)', value: fmt(taxableAmount) },
    { label: 'GST Paid (Tax Credit)', value: fmt(summary?.total_tax) },
    { label: 'Total Bill (With GST)', value: fmt(summary?.total_amount) },
    { label: 'Amount Paid', value: fmt(summary?.total_paid) },
    { label: 'Pending to Pay', value: fmt(summary?.total_balance_due) },
  ];

  const handleExportExcel = () => {
    if (!report?.rows?.length) return;
    exportReportToExcel({
      filename: `purchase_report_${startDate}_${endDate}`,
      title: 'Supplier Purchases Audit Report',
      subtitle: `Payment Status: ${paymentStatus}`,
      dateRange: `${startDate} to ${endDate}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: report.rows,
      sheetName: 'Purchase Report',
    });
  };

  const handleExportPdf = () => {
    if (!report?.rows?.length) return;
    exportReportToPdf({
      filename: `purchase_report_${startDate}_${endDate}`,
      title: 'Supplier Purchases Audit Report',
      subtitle: `Payment Status: ${paymentStatus}`,
      dateRange: `${startDate} to ${endDate}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: report.rows,
      orientation: 'landscape',
    });
  };

  const handleExportCsv = () => {
    if (!report?.rows?.length) return;
    exportReportToCsv({
      filename: `purchase_report_${startDate}_${endDate}`,
      columns: COLUMNS,
      rows: report.rows,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingBag className="text-orange-600" size={24} />
          <span>Purchase Report</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View supplier purchases, GST credits paid, and pending balances.
        </p>
      </div>

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={fetchReport}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Purchase # or Supplier..."
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onExportCsv={handleExportCsv}
        hasData={Boolean(report?.rows?.length)}
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
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">{error}</div>
      )}

      {summary && (
        <div className="space-y-3">
          {/* 6 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Purchases</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{report.total_purchases}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Orders recorded</p>
            </div>
            <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Items Cost (Pre-GST)</p>
              <p className="text-xl font-extrabold text-blue-900 font-mono mt-1">{fmt(taxableAmount)}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Enters P&amp;L stock value</p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST Paid (Credit)</p>
              <p className="text-xl font-extrabold text-orange-600 font-mono mt-1">{fmt(summary.total_tax)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Input tax credit (ITC)</p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Bill (With GST)</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">{fmt(summary.total_amount)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Gross supplier invoices</p>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 shadow-xs">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Amount Paid</p>
              <p className="text-xl font-extrabold text-emerald-800 font-mono mt-1">{fmt(summary.total_paid)}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Paid from till / bank</p>
            </div>
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 shadow-xs">
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Pending to Pay</p>
              <p className="text-xl font-extrabold text-rose-700 font-mono mt-1">{fmt(summary.total_balance_due)}</p>
              <p className="text-[10px] text-rose-500 mt-0.5">{summary.total_balance_due > 0 ? 'Supplier dues' : 'Fully settled'}</p>
            </div>
          </div>

          {/* Simple Calculation Explanation Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="text-sm">📦</span>
                <span>Bill Calculation:</span>
                <span className="font-mono text-slate-700">Total Bill ({fmt(summary.total_amount)})</span>
                <span>=</span>
                <span className="font-mono text-blue-700">Items Cost ({fmt(taxableAmount)})</span>
                <span>+</span>
                <span className="font-mono text-orange-600">GST Credit ({fmt(summary.total_tax)})</span>
              </div>
              <p className="text-[11px] text-slate-500">
                * Note for Profit &amp; Loss: The {fmt(summary.total_tax)} GST is claimed back from the government. Only the {fmt(taxableAmount)} pre-tax cost is added to your stock value.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                summary.total_balance_due > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {summary.total_balance_due > 0 ? `Pending Due: ${fmt(summary.total_balance_due)}` : '✓ All Supplier Bills Paid (₹0 Due)'}
              </span>
            </div>
          </div>
        </div>
      )}

      <ReportTable
        columns={COLUMNS}
        rows={report?.rows || []}
        loading={loading}
        emptyMessage="No purchase records found for the selected period."
      />
    </div>
  );
};

export default PurchaseReport;
