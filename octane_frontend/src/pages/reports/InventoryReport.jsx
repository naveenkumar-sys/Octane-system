import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, AlertTriangle, Download, RefreshCw, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import ReportTable from '../../components/reports/ReportTable';
import { exportReportToExcel, exportReportToPdf, exportReportToCsv } from '../../utils/reportExportUtils';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const COLUMNS = [
  { key: 'sku', label: 'SKU', render: (v) => <span className="font-mono text-slate-600">{v}</span> },
  { key: 'product_name', label: 'Product', render: (v) => <span className="font-semibold">{v}</span> },
  { key: 'category', label: 'Category' },
  { key: 'opening_stock', label: 'Opening Stock', align: 'right' },
  { key: 'purchases', label: 'Stock Added', align: 'right', render: (v) => <span className="text-emerald-700 font-bold">{v}</span> },
  { key: 'sales', label: 'Items Sold', align: 'right', render: (v) => <span className="text-rose-600 font-bold">{v}</span> },
  { key: 'sales_returns', label: 'Customer Ret.', align: 'right' },
  { key: 'purchase_returns', label: 'Supplier Ret.', align: 'right' },
  { key: 'adj_in', label: 'Adj +', align: 'right' },
  { key: 'adj_out', label: 'Adj −', align: 'right' },
  {
    key: 'closing_stock',
    label: 'Current Stock',
    align: 'right',
    render: (v, row) => (
      <span className={`font-extrabold ${row.is_low_stock ? 'text-rose-600' : 'text-slate-900'}`}>
        {v} {row.is_low_stock && <AlertTriangle size={11} className="inline text-rose-500 ml-1" />}
      </span>
    ),
  },
  { key: 'stock_value', label: 'Stock Value', align: 'right', format: 'currency', render: (v) => <span className="font-bold text-slate-900">{fmt(v)}</span> },
];

const InventoryReport = () => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categories, setCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    api.getProductCategories()
      .then((res) => {
        setCategories(Array.isArray(res) ? res : res.results || []);
      })
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category_id', categoryFilter);
      if (lowStockOnly) params.append('low_stock_only', 'true');
      const data = await api.getInventoryReport(`?${params.toString()}`);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load inventory report.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, lowStockOnly]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const getSummaryCards = () => [
    { label: 'Total Items', value: String(report?.total_products || 0) },
    { label: 'Total Stock Value', value: fmt(report?.total_stock_value) },
    { label: 'Low Stock Alerts', value: String(report?.low_stock_count || 0) },
  ];

  const handleExportExcel = () => {
    if (!report?.rows?.length) return;
    const catName = categories.find((c) => String(c.id) === String(categoryFilter))?.name || 'All Categories';
    exportReportToExcel({
      filename: `inventory_valuation_${new Date().toISOString().split('T')[0]}`,
      title: 'Inventory Stock Valuation Report',
      subtitle: `Category: ${catName} | Filter: ${lowStockOnly ? 'Low Stock Only' : 'All Stock'}`,
      dateRange: `As of ${new Date().toLocaleDateString('en-IN')}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: report.rows,
      sheetName: 'Inventory Valuation',
    });
  };

  const handleExportPdf = () => {
    if (!report?.rows?.length) return;
    const catName = categories.find((c) => String(c.id) === String(categoryFilter))?.name || 'All Categories';
    exportReportToPdf({
      filename: `inventory_valuation_${new Date().toISOString().split('T')[0]}`,
      title: 'Inventory Stock Valuation Report',
      subtitle: `Category: ${catName} | Filter: ${lowStockOnly ? 'Low Stock Only' : 'All Stock'}`,
      dateRange: `As of ${new Date().toLocaleDateString('en-IN')}`,
      summaryCards: getSummaryCards(),
      columns: COLUMNS,
      rows: report.rows,
      orientation: 'landscape',
    });
  };

  const handleExportCsv = () => {
    if (!report?.rows?.length) return;
    exportReportToCsv({
      filename: `inventory_valuation_${new Date().toISOString().split('T')[0]}`,
      columns: COLUMNS,
      rows: report.rows,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Package className="text-orange-600" size={24} />
          <span>Inventory Report</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View live stock quantities, stock additions, items sold, returns, and total stock values.
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 min-w-[180px]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 accent-orange-600 rounded"
          />
          <span className="text-xs font-bold text-slate-700">Low Stock Only</span>
        </label>

        <div className="flex gap-2 ml-auto items-end">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Loading...' : 'Apply Filters'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              disabled={loading || !report?.rows?.length}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-slate-300 shadow-xs"
            >
              <Download size={13} className="text-orange-600" />
              <span>Export</span>
              <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Export Inventory As
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    handleExportExcel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 text-left transition-colors cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                    XLS
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">Excel Workbook</div>
                    <div className="text-[10px] text-slate-400">Microsoft Excel (.xlsx)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    handleExportPdf();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-800 text-left transition-colors cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">
                    PDF
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">Download PDF</div>
                    <div className="text-[10px] text-slate-400">Printable Statement (.pdf)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    handleExportCsv();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors cursor-pointer border-t border-slate-100"
                >
                  <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                    CSV
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">CSV Spreadsheet</div>
                    <div className="text-[10px] text-slate-400">Plain text data (.csv)</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">{error}</div>
      )}

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Items</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{report.total_products}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Active products in inventory</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Stock Value</p>
            <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{fmt(report.total_stock_value)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Worth at purchase cost</p>
          </div>
          <div className={`p-4 rounded-2xl border shadow-xs ${report.low_stock_count > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${report.low_stock_count > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              Low Stock Alert
            </p>
            <p className={`text-2xl font-extrabold mt-1 ${report.low_stock_count > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {report.low_stock_count}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Items running out of stock</p>
          </div>
        </div>
      )}

      {/* Main Table */}
      <ReportTable
        columns={COLUMNS}
        rows={report?.rows || []}
        loading={loading}
        emptyMessage="No inventory items found."
      />
    </div>
  );
};

export default InventoryReport;
