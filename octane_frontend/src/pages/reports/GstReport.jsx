import React, { useState, useEffect, useCallback } from 'react';
import { Receipt } from 'lucide-react';
import { api } from '../../services/api';
import ReportFilters from '../../components/reports/ReportFilters';
import ReportTable from '../../components/reports/ReportTable';
import { exportGstToExcel, exportGstToPdf, exportReportToCsv } from '../../utils/reportExportUtils';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const HSN_COLUMNS = [
  { key: 'hsn_sac', label: 'HSN / SAC', render: (v) => <span className="font-mono font-bold">{v}</span> },
  { key: 'description', label: 'Description', render: (v) => <span className="text-slate-600">{String(v).slice(0, 40)}</span> },
  { key: 'total_qty', label: 'Quantity', align: 'right', render: (v) => Number(v).toFixed(2) },
  { key: 'taxable_amount', label: 'Taxable', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'cgst_amount', label: 'CGST', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'sgst_amount', label: 'SGST', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'igst_amount', label: 'IGST', align: 'right', format: 'currency', render: (v) => fmt(v) },
  { key: 'total_amount', label: 'Total', align: 'right', format: 'currency', render: (v) => <span className="font-bold">{fmt(v)}</span> },
];

const GstCard = ({ label, value, highlight, sub }) => (
  <div className={`p-4 rounded-2xl border shadow-xs ${highlight ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
    <p className={`text-sm font-extrabold font-mono ${highlight ? 'text-orange-400' : 'text-slate-900'}`}>{value}</p>
    {sub && <p className={`text-[10px] mt-1 ${highlight ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
  </div>
);

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const GstReport = () => {
  const today = toLocalDateString(new Date());
  const monthStart = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
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
      const data = await api.getGstReport(`?${params.toString()}`);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load GST report.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportExcel = () => {
    if (!report) return;
    exportGstToExcel({
      filename: `gst_tax_audit_${startDate}_${endDate}`,
      report,
    });
  };

  const handleExportPdf = () => {
    if (!report) return;
    exportGstToPdf({
      filename: `gst_tax_audit_${startDate}_${endDate}`,
      report,
    });
  };

  const handleExportCsv = () => {
    if (!report?.hsn_summary?.length) return;
    exportReportToCsv({
      filename: `gst_hsn_summary_${startDate}_${endDate}`,
      columns: HSN_COLUMNS,
      rows: report.hsn_summary,
    });
  };

  const out = report?.output_gst;
  const inp = report?.input_gst;
  const net = report?.net_gst;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Receipt className="text-orange-600" size={24} />
          <span>GST Report</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          GST collected from customers, GST credit paid to suppliers, and your net tax payable.
        </p>
      </div>

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={fetchReport}
        loading={loading}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onExportCsv={handleExportCsv}
        hasData={Boolean(report)}
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">{error}</div>
      )}

      {/* Output vs Input GST Summary */}
      {report && (
        <>
          {/* Simple GST Calculation Explanation Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="text-base">🏛️</span>
                <span>GST Tax Rule:</span>
                <span className="font-mono text-indigo-700">Net Tax to Pay ({fmt(net?.total_payable)})</span>
                <span>=</span>
                <span className="font-mono text-blue-700">Collected on Sales ({fmt(out?.total_tax)})</span>
                <span>−</span>
                <span className="font-mono text-emerald-700">Credit on Purchases ({fmt(inp?.total_tax)})</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You collected {fmt(out?.total_tax)} from your customers, but you already paid {fmt(inp?.total_tax)} to your suppliers. You only pay the government portal the net difference of {fmt(net?.total_payable)}.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                <span>Net to Govt:</span>
                <span className="font-mono">{fmt(net?.total_payable)}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Output GST (Sales) */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  GST Collected on Sales
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  From Customers
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GstCard label="Sales (Before GST)" value={fmt(out?.taxable_amount)} />
                <GstCard label="Total Invoiced (With GST)" value={fmt(out?.gross_sales)} />
                <GstCard label="CGST" value={fmt(out?.cgst)} />
                <GstCard label="SGST" value={fmt(out?.sgst)} />
                <GstCard label="IGST" value={fmt(out?.igst)} />
                <GstCard label="Total GST Collected" value={fmt(out?.total_tax)} highlight />
              </div>
            </div>

            {/* Input GST (Purchases) */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  GST Paid on Purchases
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Tax Credit (ITC)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GstCard label="Purchases (Before GST)" value={fmt(inp?.taxable_amount)} />
                <GstCard label="Total Purchases (With GST)" value={fmt(inp?.gross_purchases)} />
                <GstCard label="Input CGST" value={fmt(inp?.cgst)} />
                <GstCard label="Input SGST" value={fmt(inp?.sgst)} />
                <GstCard label="Input IGST" value={fmt(inp?.igst)} />
                <GstCard label="Total GST Credit Paid" value={fmt(inp?.total_tax)} highlight />
              </div>
            </div>

            {/* Net GST Position */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  Final GST Position
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  Payable to Govt
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GstCard label="Net CGST" value={fmt(net?.cgst)} />
                <GstCard label="Net SGST" value={fmt(net?.sgst)} />
                <GstCard label="Net IGST" value={fmt(net?.igst)} />
                <div className="col-span-2">
                  <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Final Net GST to Pay
                    </p>
                    <p className="text-xl font-extrabold font-mono text-white">
                      {fmt(net?.total_payable)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      GST Collected minus GST Credit Paid
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HSN Summary Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                HSN / Product Tax Code Summary (for GSTR-1)
              </h2>
              <span className="text-xs text-slate-500 font-semibold">
                {report.hsn_summary?.length || 0} unique codes
              </span>
            </div>
            <ReportTable
              columns={HSN_COLUMNS}
              rows={report.hsn_summary || []}
              loading={loading}
              emptyMessage="No HSN data found for the selected period."
            />
          </div>
        </>
      )}
    </div>
  );
};

export default GstReport;
