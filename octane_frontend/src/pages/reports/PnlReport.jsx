import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, ShieldCheck, 
  HelpCircle, RefreshCw, ArrowUpRight, ArrowDownLeft, 
  Wallet, Receipt, CheckCircle2, AlertTriangle, Layers, Users
} from 'lucide-react';
import { api } from '../../services/api';
import ReportFilters from '../../components/reports/ReportFilters';
import { exportPnlToExcel, exportPnlToPdf } from '../../utils/reportExportUtils';
import FormModal from '../../components/ui/FormModal';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PnlReport = () => {
  const today = toLocalDateString(new Date());
  const monthStart = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [partnerSummaries, setPartnerSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Diagnostic Reconciliation Modal State
  const [reconciliation, setReconciliation] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [showReconModal, setShowReconModal] = useState(false);

  const fetchReport = useCallback(async (customStart, customEnd) => {
    const sDate = customStart !== undefined ? customStart : startDate;
    const eDate = customEnd !== undefined ? customEnd : endDate;
    setLoading(true);
    setError(null);
    try {
      const [data, pSummary] = await Promise.all([
        api.getPnlReport(sDate, eDate),
        api.getPartnerLedgerSummary().catch(() => [])
      ]);
      setReport(data);
      setPartnerSummaries(Array.isArray(pSummary) ? pSummary : (pSummary ? [pSummary] : []));
    } catch (err) {
      setError(err.message || 'Failed to load P&L report.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const fetchReconciliation = async () => {
    setReconLoading(true);
    try {
      const data = await api.getAccountingReconciliation(startDate, endDate);
      setReconciliation(data);
      setShowReconModal(true);
    } catch (err) {
      console.error('Failed to load accounting reconciliation:', err);
    } finally {
      setReconLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportExcel = () => {
    if (!report) return;
    exportPnlToExcel({
      filename: `pnl_statement_${startDate}_${endDate}`,
      report,
    });
  };

  const handleExportPdf = () => {
    if (!report) return;
    exportPnlToPdf({
      filename: `pnl_statement_${startDate}_${endDate}`,
      report,
    });
  };

  const isProfit = report && report.net_profit >= 0;
  const isGrossProfit = report && report.gross_profit >= 0;

  // Store Cash In-Hand (Till Drawer + Store Bank - exactly matches Payments Log)
  const storeInflow = report
    ? (Number(report.store_customer_receipts ?? report.total_customer_receipts ?? 0) + Number(report.partner_deposits_to_store ?? 0))
    : 0;
  const storeOutflow = report
    ? (Number(report.total_supplier_payouts ?? 0) + Number(report.total_operating_cash_expenses ?? 0) + Number(report.total_partner_drawings ?? 0))
    : 0;
  const storeCashInHand = report?.store_net_cash_flow !== undefined
    ? report.store_net_cash_flow
    : (storeInflow - storeOutflow);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-orange-600" size={24} />
            <span>Profit &amp; Loss Statement</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track total sales, purchase cost of sold products, operating expenses, and final business profit.
          </p>
        </div>

        <button
          onClick={fetchReconciliation}
          disabled={reconLoading}
          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-2 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ShieldCheck size={16} className="text-indigo-600" />
          <span>{reconLoading ? 'Verifying...' : 'Audit & Verify Numbers'}</span>
        </button>
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
        hasData={Boolean(report)}
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">{error}</div>
      )}

      {loading && !report && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Period Banner & Accounting Disclosure */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>
                Accounting Period: {report.start_date <= '2020-01-01' ? 'All Time (From Start)' : report.start_date} to {report.end_date} {report.end_date === today ? '(Until Now)' : ''}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Invoices by Bill Date • Stock Valued at Purchase Cost • GST Handled Separately
            </span>
          </div>

          {/* Top-line 4 Metric KPI Cards - Simplified Business English */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Sales (Before Tax) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Sales (Before GST)</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">Shop Income</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 font-mono">
                {fmt(report.net_sales_revenue ?? report.sales_taxable_revenue)}
              </div>
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                Pre-tax sales income (Customer bills with GST: <strong className="text-slate-700">{fmt(report.gross_sales)}</strong>)
              </p>
            </div>

            {/* Card 2: Cost of Sold Products */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cost of Sold Products (Before GST)</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">Pre-Tax Cost</span>
              </div>
              <div className="text-xl font-extrabold text-rose-600 font-mono">
                {fmt(report.cost_of_goods_sold)}
              </div>
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                Base purchase cost of sold products, <strong>without GST</strong> (excl. unsold stock)
              </p>
            </div>

            {/* Card 3: Profit on Sales */}
            <div className="p-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Gross Profit on Sales</span>
                <span className="text-[10.5px] font-extrabold text-emerald-700 font-mono">{pct(report.gross_margin_pct)} margin</span>
              </div>
              <div className={`text-xl font-extrabold font-mono ${isGrossProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                {fmt(report.gross_profit)}
              </div>
              <p className="text-[10.5px] text-emerald-700/80 leading-relaxed">
                Sales Income ({fmt(report.net_sales_revenue)}) − Cost of Sold Items ({fmt(report.cost_of_goods_sold)})
              </p>
            </div>

            {/* Card 4: Final Net Profit */}
            <div className={`p-4 rounded-2xl border shadow-2xs space-y-1.5 ${isProfit ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-800 text-white' : 'bg-rose-50 border-rose-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isProfit ? 'text-slate-300' : 'text-rose-600'}`}>
                  {isProfit ? 'Final Business Profit' : 'Final Business Loss'}
                </span>
                <span className={`text-[10.5px] font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-700'}`}>
                  {pct(report.net_margin_pct)} net
                </span>
              </div>
              <div className={`text-xl font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-700'}`}>
                {fmt(Math.abs(report.net_profit))}
              </div>
              <p className={`text-[10.5px] ${isProfit ? 'text-slate-400' : 'text-rose-600'} leading-relaxed`}>
                Sales Profit ({fmt(report.gross_profit)}) − Shop Bills ({fmt(report.operating_expenses)})
              </p>
            </div>
          </div>

          {/* Net Cash In Hand vs Net Business Profit Clarity Banner */}
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-indigo-200/90 rounded-2xl shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide">
                  Clear Accounting View: Cash In-Hand vs Business Profit
                </span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Understand The Difference
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {/* Cash In Hand Card */}
              <div className="p-3.5 bg-white border border-purple-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wallet size={15} className="text-purple-600" />
                    <span className="font-extrabold text-purple-950">Store Cash In-Hand (Liquidity)</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">Till &amp; Bank</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${storeCashInHand >= 0 ? 'text-purple-700' : 'text-rose-600'}`}>
                  {fmt(storeCashInHand)}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Actual money in bank &amp; cash till.</strong> Physical cash in till &amp; company bank balance (matches Payments Log).
                </p>
                <div className="text-[10px] text-purple-800 font-mono bg-purple-50/80 p-2 rounded-lg border border-purple-100">
                  Store Inflow ({fmt(storeInflow)}) − Store Outflow ({fmt(storeOutflow)})
                </div>
              </div>

              {/* Real Business Profit Card */}
              <div className="p-3.5 bg-white border border-indigo-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={15} className="text-indigo-600" />
                    <span className="font-extrabold text-indigo-950">Real Business Profit (Earnings)</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">Without GST</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {fmt(Math.abs(report.net_profit))}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>What your shop actually earned.</strong> GST is excluded here because taxes belong to the government, not to store profit.
                </p>
                <div className="text-[10px] text-indigo-800 font-mono bg-indigo-50/80 p-2 rounded-lg border border-indigo-100">
                  Sales Income ({fmt(report.net_sales_revenue)}) − Cost of Sold Items ({fmt(report.cost_of_goods_sold)}) − Bills ({fmt(report.operating_expenses)})
                </div>
              </div>
            </div>
          </div>

          {/* Statement Detailed Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Box 1: Revenue (Sales Turnover) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Sales &amp; Revenue (What Customers Bought)
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">BILLED INVOICES</span>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-700">Total Sales Value</span>
                      <span className="ml-1.5 text-[10px] text-slate-400">(Before GST)</span>
                      <p className="text-[10px] text-slate-400">Total amount billed to customers</p>
                    </div>
                    <span className="font-mono font-semibold text-slate-800">
                      {fmt(report.gross_sales_taxable ?? report.sales_taxable_revenue)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600 pl-3 border-l-2 border-rose-200">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-700 font-mono">− Minus</span>
                        <span className="font-semibold">Customer Returns</span>
                        <span className="text-[10px] text-rose-400 font-normal">(Refunded items)</span>
                      </div>
                      <p className="text-[10px] text-rose-500 mt-0.5">Refunded money deducted from sales</p>
                    </div>
                    <span className="font-mono font-bold">
                      − {fmt(report.sales_returns_taxable || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-extrabold text-slate-900 text-sm">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-100 text-blue-700 font-mono">= Result</span>
                        <span className="text-blue-900">Net Sales Income</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-normal mt-0.5">Real sales earned (Sales − Returns)</p>
                    </div>
                    <span className="font-mono text-blue-700 text-base">
                      {fmt(report.net_sales_revenue ?? report.sales_taxable_revenue)}
                    </span>
                  </div>
                </div>

                {/* Tax Note */}
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex justify-between items-center">
                    <span>Total Bill Amount to Customers (With GST):</span>
                    <span className="font-mono font-bold text-slate-700">{fmt(report.gross_sales)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>GST Tax Collected (For Government):</span>
                    <span className="font-mono font-bold text-slate-700">{fmt(report.tax_collected)}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 italic mt-1 leading-relaxed">
                    * Note: GST collected belongs to the government tax department, so it is kept separate from your shop's actual earnings.
                  </p>
                </div>
              </div>
            </div>

            {/* Box 2: Cost of Sold Products */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Purchase Cost of Sold Items (Stock Audit)
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">STOCK AUDIT</span>
              </div>

              <div className="p-4 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center text-slate-700 font-sans">
                  <div>
                    <span className="font-semibold">Starting Stock Value</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">(Beginning of period)</span>
                    <p className="text-[10px] text-slate-400">Stock on shelves at start of period</p>
                  </div>
                  <span className="font-mono font-semibold">{fmt(report.opening_inventory || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700 font-sans pl-3 border-l-2 border-emerald-300">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-700 font-mono">+ Plus</span>
                      <span className="font-semibold">New Purchases Received</span>
                      <span className="text-[10px] text-slate-400 font-mono">(Before GST)</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-0.5 font-sans">New stock added to shop from suppliers</p>
                  </div>
                  <span className="font-mono font-semibold text-emerald-700">+ {fmt(report.purchases_taxable || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700 font-sans pl-3 border-l-2 border-rose-300">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-700 font-mono">− Minus</span>
                      <span className="font-semibold">Goods Returned to Suppliers</span>
                    </div>
                    <p className="text-[10px] text-rose-500 mt-0.5 font-sans">Defective stock sent back to suppliers</p>
                  </div>
                  <span className="font-mono font-semibold text-rose-600">− {fmt(report.purchase_returns_taxable || 0)}</span>
                </div>

                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-slate-800 font-bold font-sans">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 font-mono">= Total</span>
                      <span>Total Stock Handled</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">Total stock available to sell (Starting Stock + Purchases)</p>
                  </div>
                  <span className="font-mono">{fmt(report.goods_available_for_sale || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700 font-sans pl-3 border-l-2 border-blue-300">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-100 text-blue-700 font-mono">− Minus</span>
                      <span className="font-semibold">Unsold Stock Still in Shop</span>
                      <span className="text-[10px] text-blue-400 font-normal">(Closing stock)</span>
                    </div>
                    <p className="text-[10px] text-blue-600 mt-0.5 font-sans">Stock still on shelves (asset, not an expense yet)</p>
                  </div>
                  <span className="font-mono font-semibold text-blue-700">
                    − {fmt(
                      report.goods_available_for_sale && report.cost_of_goods_sold
                        ? Math.max(0, report.goods_available_for_sale - report.cost_of_goods_sold)
                        : (report.closing_inventory || 0)
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-extrabold text-slate-900 text-sm font-sans">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-700 font-mono">− Deduct</span>
                      <span className="text-rose-900">Cost of Items Actually Sold (Before GST)</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-normal mt-0.5">Purchase cost of sold items (deducted from sales to find profit)</p>
                  </div>
                  <span className="font-mono text-rose-600 text-base">− {fmt(report.cost_of_goods_sold)}</span>
                </div>

                {/* Purchase Tax Note */}
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5 text-[11px] text-slate-500 font-sans">
                  <div className="flex justify-between items-center">
                    <div>
                      <span>Total Purchase Bills Paid to Suppliers:</span>
                      <span className="ml-1 text-[10px] text-slate-400">(With GST)</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700">
                      {fmt(report.purchases_gross || ((report.purchases_taxable || 0) + (report.purchases_gst || report.input_gst || 0)))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-700 font-mono mr-1">− Claim</span>
                      <span>GST Input Tax Credit Claimed (ITC):</span>
                      <p className="text-[9.5px] text-emerald-600 font-normal">GST claimed back from Govt (reduces your purchase cost)</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">
                      − {fmt(report.purchases_gst ?? report.input_gst ?? 0)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 italic mt-1 leading-relaxed">
                    * Note: Total bills paid to suppliers was {fmt(report.purchases_gross || ((report.purchases_taxable || 0) + (report.purchases_gst || report.input_gst || 0)))}, but {fmt(report.purchases_gst ?? report.input_gst ?? 0)} is GST you claim back from the government. Only the pre-tax item cost of {fmt(report.purchases_taxable || 0)} enters inventory valuation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Box 3: Operating Expenses & Net Profit Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Shop Running Expenses &amp; Final Business Profit / Loss
                </h2>
              </div>
              <span className="text-xs font-bold text-rose-600 font-mono">
                Total Shop Bills: {fmt(report.operating_expenses)}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Expense Category Breakdown Pills */}
              <div>
                <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Monthly Shop Running Bills (Rent, Salaries, Electricity, Tea/Office, Transport, etc.)
                </p>
                {report.expense_breakdown?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {report.expense_breakdown.map((exp, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{exp.category}</span>
                        <span className="font-mono font-bold text-slate-900">{fmt(exp.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                    No operating expenses recorded for this date range.
                  </p>
                )}
              </div>

              {/* Net Profit Final Summary Row */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isProfit ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
                <div>
                  <h3 className={`text-sm font-extrabold uppercase tracking-wide ${isProfit ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {isProfit ? 'Final Net Profit (Take-Home Business Earnings)' : 'Final Net Loss (Shop Bills Exceeded Sales Profit)'}
                  </h3>
                  <p className={`text-xs mt-0.5 ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isProfit
                      ? `Profit on Sales (${fmt(report.gross_profit)}) − Shop Bills (${fmt(report.operating_expenses)})`
                      : `Sales Profit was ${fmt(report.gross_profit)}, but Shop Bills were ${fmt(report.operating_expenses)} (Bills exceeded profit by ${fmt(Math.abs(report.net_profit))})`
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-extrabold font-mono ${isProfit ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {fmt(Math.abs(report.net_profit))}
                  </div>
                  <div className={`text-xs font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Net Margin: {pct(report.net_margin_pct)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Box 4: Separate Tax & Cash Flow Disclosures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* GST Position Card */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">GST Tax Summary</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">GOVERNMENT TAX</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-100 text-blue-700 font-mono">+ Tax</span>
                      <span>GST Collected from Customers (Output Tax):</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tax collected for government</p>
                  </div>
                  <span className="font-mono font-bold text-slate-800">+{fmt(report.output_gst || report.net_output_gst || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-700 font-mono">− Credit</span>
                      <span>Minus: GST Paid on Purchases (Input Credit):</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Tax already paid to suppliers that you deduct</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">− {fmt(report.input_gst || 0)}</span>
                </div>

                {/* Conditional Display for Positive Payable vs Negative Credit */}
                {(report.net_gst_payable || 0) > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center font-extrabold text-amber-900">
                      <span>Net GST to Pay Government:</span>
                      <span className="font-mono text-base">{fmt(report.net_gst_payable)}</span>
                    </div>
                    <p className="text-[10px] text-amber-700 font-medium">
                      Amount to pay to the GST portal for this period.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center font-extrabold text-emerald-900">
                      <span>Available GST Credit (No Tax to Pay Now):</span>
                      <span className="font-mono text-base text-emerald-700">
                        {fmt(Math.abs(report.net_gst_payable || 0))}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-emerald-700 font-medium leading-relaxed">
                      You paid more GST on purchases than collected on sales. This credit will reduce your future GST payments!
                    </p>
                  </div>
                )}

                <p className="text-[10.5px] text-slate-500 italic leading-relaxed pt-1">
                  * Note: GST is not your profit or cost. Tax collected from customers is offset against tax already paid to your suppliers.
                </p>
              </div>
            </div>

            {/* Cash Flow Position Card */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Actual Cash &amp; Bank Register</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">REAL MONEY FLOW</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>+ Customer Payments Received at Store Till:</span>
                  <span className="font-mono font-bold text-emerald-700">+{fmt(report.store_customer_receipts ?? report.total_customer_receipts ?? 0)}</span>
                </div>
                {(report.partner_deposits_to_store || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>+ Partner Cash Handed Over / Deposited to Store:</span>
                    <span className="font-mono font-bold text-emerald-700">+{fmt(report.partner_deposits_to_store || 0)}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>− Money Paid to Suppliers (From Shop Till &amp; Bank):</span>
                    <span className="font-mono font-bold text-rose-600">− {fmt(report.total_supplier_payouts || 0)}</span>
                  </div>
                  {(report.purchases_gross || 0) > (report.total_supplier_payouts || 0) && (
                    <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-0.5 text-slate-600 ml-1">
                      <div className="flex justify-between">
                        <span>• Total Purchases Billed:</span>
                        <span className="font-mono font-semibold">{fmt(report.purchases_gross || 0)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-700 font-medium">
                        <span>• Paid by Partners Out-of-Pocket (Personal funds):</span>
                        <span className="font-mono">− {fmt((report.purchases_gross || 0) - (report.total_supplier_payouts || 0))}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-0.5 mt-0.5">
                        <span>• Paid directly from Shop Drawer/Bank:</span>
                        <span className="font-mono">{fmt(report.total_supplier_payouts || 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>− Cash Paid for Shop Bills &amp; Rent:</span>
                  <span className="font-mono font-bold text-rose-600">
                    − {fmt(report.total_operating_cash_expenses || 0)}
                  </span>
                </div>
                {(report.total_partner_drawings || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>− Partner Personal Drawings (Withdrawals):</span>
                    <span className="font-mono font-bold text-rose-600">
                      − {fmt(report.total_partner_drawings || 0)}
                    </span>
                  </div>
                )}

                <div className={`p-3 rounded-xl border space-y-1 ${storeCashInHand >= 0 ? 'bg-purple-50 border-purple-200' : 'bg-rose-50 border-rose-200'}`}>
                  <div className="flex justify-between items-center font-extrabold text-slate-900">
                    <span>
                      {storeCashInHand >= 0
                        ? 'Store Cash In-Hand (Till & Bank Surplus):'
                        : 'Store Cash Deficit (Till & Bank Negative):'
                      }
                    </span>
                    <span className={`font-mono text-base ${storeCashInHand >= 0 ? 'text-purple-700' : 'text-rose-700'}`}>
                      {fmt(storeCashInHand)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {storeCashInHand >= 0
                      ? 'Physical cash in till & company bank balance (matches Payments Log).'
                      : 'More money went out from shop drawer & bank than came in during this period.'
                    }
                  </p>
                </div>

                <p className="text-[10.5px] text-slate-500 italic leading-relaxed pt-1">
                  * Note: Cash flow measures real money moving in-and-out of bank and cash till. It matches the Monetary Payments Audit Log.
                </p>
              </div>
            </div>
          </div>

          {/* Partner Capital & Equity Position Card */}
          {partnerSummaries && partnerSummaries.length > 0 && (
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Partner Capital Balances (Money Put IN vs Taken OUT)
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Tracks who paid for stock/bills from personal pockets vs who took cash out of the register
                    </p>
                  </div>
                </div>
                <a
                  href="/finance/partner-ledger"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs"
                >
                  <span>Open Full Partner Ledger</span>
                  <ArrowUpRight size={14} />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {partnerSummaries.map((p) => {
                  const netBal = Number(p.net_capital_balance || 0);
                  const isStoreOwes = netBal >= 0;
                  return (
                    <div key={p.partner_id || p.partner_name} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-sm text-slate-900">{p.partner_name}</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {p.ownership_percentage}% Equity
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 text-slate-600 pt-1.5 border-t border-slate-200/80">
                        <div className="flex justify-between items-center">
                          <span>+ Purchases Funded (Personal Pocket):</span>
                          <span className="font-mono font-bold text-emerald-700">+{fmt(p.purchases_funded || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>+ Shop Bills Funded (Personal Pocket):</span>
                          <span className="font-mono font-bold text-emerald-700">+{fmt(p.expenses_funded || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>− Cash Withdrawn (Drawings):</span>
                          <span className="font-mono font-bold text-rose-600">− {fmt(p.drawings || 0)}</span>
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border mt-2 flex justify-between items-center ${isStoreOwes ? 'bg-indigo-50/80 border-indigo-200' : 'bg-amber-50/80 border-amber-200'}`}>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                            Net Capital Balance:
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            {isStoreOwes ? 'Store owes partner' : 'Partner owes store'}
                          </span>
                        </div>
                        <span className={`font-mono font-extrabold text-base ${isStoreOwes ? 'text-indigo-800' : 'text-amber-800'}`}>
                          {fmt(Math.abs(netBal))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 14-Point Accounting Reconciliation Diagnostic Modal */}
      {showReconModal && reconciliation && (
        <FormModal
          isOpen={showReconModal}
          onClose={() => setShowReconModal(false)}
          title="Numbers Verification &amp; Audit Diagnostic"
          subtitle={`Audit check for period ${reconciliation.start_date} to ${reconciliation.end_date}`}
          submitLabel="Close Audit"
          onSubmit={(e) => {
            e.preventDefault();
            setShowReconModal(false);
          }}
        >
          <div className="space-y-4">
            {/* Status Header Badge */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${reconciliation.is_balanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-xs">
                    {reconciliation.is_balanced ? 'All Financial Numbers Match 100% (Zero Variance)' : 'Reconciliation Variance Detected'}
                  </div>
                  <div className="text-[10.5px] opacity-80">
                    Sales bills, stock inventory movements, expenses, and GST balances are mathematically verified.
                  </div>
                </div>
              </div>
              <span className="px-2 py-1 bg-white rounded-lg border font-mono font-bold text-[10px] shadow-2xs">
                {reconciliation.is_balanced ? 'VERIFIED: OK' : 'CHECK VARIANCE'}
              </span>
            </div>

            {/* 14 Points Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-slate-100 text-slate-700 font-sans font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-2.5">Financial Step</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                    <th className="p-2.5 text-slate-500 font-sans">Business Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">1. Starting Stock Value</td>
                    <td className="p-2 text-right">{fmt(reconciliation.opening_inventory)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Stock on hand at start of period</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">2. New Stock Purchases</td>
                    <td className="p-2 text-right text-emerald-700">+{fmt(reconciliation.purchases)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">New goods bought from suppliers</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">3. Goods Returned to Suppliers</td>
                    <td className="p-2 text-right text-rose-600">−{fmt(reconciliation.purchase_returns)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Returned defective/excess items</td>
                  </tr>
                  <tr className="bg-slate-50/70 font-bold">
                    <td className="p-2 font-sans text-slate-900">4. Total Stock Handled</td>
                    <td className="p-2 text-right text-slate-900">{fmt(reconciliation.available_inventory)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Starting + New Purchases − Returns</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">5. Unsold Stock in Shop</td>
                    <td className="p-2 text-right text-blue-700">{fmt(reconciliation.closing_inventory)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Stock still on shelves (Closing inventory)</td>
                  </tr>
                  <tr className="bg-rose-50/40 font-bold">
                    <td className="p-2 font-sans text-rose-800">6. Cost of Items Actually Sold</td>
                    <td className="p-2 text-right text-rose-600">{fmt(reconciliation.cogs)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Total Handled − Unsold Stock</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">7. Total Sales Value (Before Tax)</td>
                    <td className="p-2 text-right">{fmt(reconciliation.sales_before_gst)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Value of products/services billed</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">8. Minus: Customer Returns</td>
                    <td className="p-2 text-right text-rose-600">−{fmt(reconciliation.sales_returns)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Customer refunds &amp; returns</td>
                  </tr>
                  <tr className="bg-blue-50/50 font-bold">
                    <td className="p-2 font-sans text-blue-900">9. Net Business Sales</td>
                    <td className="p-2 text-right text-blue-700">{fmt(reconciliation.net_sales)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Real sales kept (Sales − Returns)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">10. GST Collected from Customers</td>
                    <td className="p-2 text-right">{fmt(reconciliation.output_gst)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Tax collected for Government</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">11. GST Paid on Purchases</td>
                    <td className="p-2 text-right">{fmt(reconciliation.input_gst)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Available tax credit from suppliers</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-sans font-semibold text-slate-800">12. Shop Running Bills</td>
                    <td className="p-2 text-right text-rose-600">−{fmt(reconciliation.operating_expenses)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Rent, electricity, salaries, tea, etc.</td>
                  </tr>
                  <tr className="bg-emerald-50/50 font-bold">
                    <td className="p-2 font-sans text-emerald-800">13. Profit from Sales</td>
                    <td className="p-2 text-right text-emerald-700">{fmt(reconciliation.gross_profit)}</td>
                    <td className="p-2 font-sans text-slate-500 text-[10.5px]">Net Sales − Cost of Sold Items</td>
                  </tr>
                  <tr className="bg-slate-900 text-white font-extrabold">
                    <td className="p-2.5 font-sans">14. Final Net Profit / Loss</td>
                    <td className="p-2.5 text-right text-orange-400">{fmt(reconciliation.net_profit)}</td>
                    <td className="p-2.5 font-sans text-slate-300 text-[10.5px]">Profit on Sales − Shop Bills</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
};

export default PnlReport;
