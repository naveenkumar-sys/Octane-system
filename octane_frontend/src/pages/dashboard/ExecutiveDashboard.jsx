import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Building2, Wallet, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw, ShoppingCart, 
  Receipt, CreditCard, PieChart, ShieldAlert, ChevronRight, Calendar,
  Layers, CheckCircle2, Package, ArrowRight, BarChart3, Activity,
  Clock, Sparkles, AlertCircle, FileText, Check, IndianRupee, X,
  ShoppingBag, Plus, Eye, CheckCircle, Shield, SlidersHorizontal
} from 'lucide-react';
import { api } from '../../services/api';
import { LoadingState } from '../../components/ui/StateViews';
import { RecordPaymentModal } from '../../components/forms/RecordPaymentModal';

// Formatting Helpers matching screenshot style
const fmtRupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDecimal = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formats like ₹18.46L, ₹2.84L, ₹1.46L matching the screenshot
const fmtLakhs = (n) => {
  const num = Number(n || 0);
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
  if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num.toFixed(0)}`;
};

const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  return [];
};

export const ExecutiveDashboard = ({ onNavigate }) => {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [activePreset, setActivePreset] = useState('this_month');
  const [metrics, setMetrics] = useState(null);
  const [currentStockList, setCurrentStockList] = useState([]);
  const [dueInvoicesList, setDueInvoicesList] = useState([]);
  const [duePurchasesList, setDuePurchasesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Active Tab for Due Bills Hub ('receivables' | 'payables')
  const [dueBillsTab, setDueBillsTab] = useState('receivables');

  // Customer Payment Recording Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');
  const [paymentErrorMsg, setPaymentErrorMsg] = useState('');

  // Supplier Payment Recording Modal State
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null);
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [supplierPayMode, setSupplierPayMode] = useState('BANK_TRANSFER');
  const [supplierPayDate, setSupplierPayDate] = useState(today);
  const [supplierPayRef, setSupplierPayRef] = useState('');
  const [supplierPayNotes, setSupplierPayNotes] = useState('');
  const [submittingSupplierPay, setSubmittingSupplierPay] = useState(false);
  const [supplierPaySuccessMsg, setSupplierPaySuccessMsg] = useState('');
  const [supplierPayErrorMsg, setSupplierPayErrorMsg] = useState('');

  // Stock Entry / Restock Modal State
  const [isStockEntryModalOpen, setIsStockEntryModalOpen] = useState(false);
  const [stockEntryProduct, setStockEntryProduct] = useState(null);
  const [stockEntryQtyToAdd, setStockEntryQtyToAdd] = useState(1);
  const [stockEntryReason, setStockEntryReason] = useState('Vendor Stock Inward / Replenishment');
  const [stockEntryCustomNotes, setStockEntryCustomNotes] = useState('');
  const [submittingStockEntry, setSubmittingStockEntry] = useState(false);
  const [stockEntrySuccessMsg, setStockEntrySuccessMsg] = useState('');
  const [stockEntryErrorMsg, setStockEntryErrorMsg] = useState('');

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashMetrics, stockData, invoicesData, purchasesData] = await Promise.all([
        api.getDashboardMetrics(startDate, endDate),
        api.getCurrentStock().catch(() => []),
        api.getInvoices('invoice_status=POSTED').catch(() => []),
        api.getPurchases().catch(() => [])
      ]);

      setMetrics(dashMetrics);
      setCurrentStockList(extractList(stockData));
      
      const rawInvoices = extractList(invoicesData);
      const unpaidInvs = rawInvoices.filter(inv => Number(inv.balance_due_amount || inv.balance_due || 0) > 0);
      setDueInvoicesList(unpaidInvs);

      const rawPurchases = extractList(purchasesData);
      const unpaidPurs = rawPurchases.filter(p => Number(p.total_amount || 0) > Number(p.paid_amount || 0));
      setDuePurchasesList(unpaidPurs);

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    let s = monthStart;
    let e = today;

    if (preset === 'today') {
      s = today;
      e = today;
    } else if (preset === 'this_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      s = monday.toISOString().split('T')[0];
      e = today;
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      e = today;
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      s = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      e = today;
    } else if (preset === 'all_time') {
      s = '2020-01-01';
      e = today;
    }

    setStartDate(s);
    setEndDate(e);
  };

  // Safe real metrics mapping (100% database driven)
  const m = useMemo(() => {
    if (!metrics) return {};
    return {
      todaySales: Number(metrics.today_sales || 0),
      todayGrossSales: Number(metrics.today_gross_sales || 0),
      todaySalesReturns: Number(metrics.today_sales_returns || 0),
      todayReturnsCount: Number(metrics.today_returns_count || 0),
      todayVsYesterdayPct: metrics.today_vs_yesterday_pct ?? null,
      yesterdaySales: Number(metrics.yesterday_sales || 0),
      monthSales: Number(metrics.month_sales || 0),

      grossProfit: Number(metrics.gross_profit || 0),
      grossMarginPct: Number(metrics.gross_margin_pct || 0),
      
      stockValue: Number(metrics.stock_value || metrics.inventory_valuation || 0),
      lowStockCount: Number(metrics.low_stock_count || 0),
      outOfStockCount: Number(metrics.out_of_stock_count || 0),
      totalSkus: Number(metrics.total_skus || 0),
      healthyStockCount: Number(metrics.healthy_stock_count || 0),

      receivables: Number(metrics.customer_receivables || metrics.total_customer_outstanding || 0),
      overdueReceivables: Number(metrics.overdue_receivables || 0),
      supplierPayables: Number(metrics.supplier_payables || 0),
      
      sevenDaysSales: Array.isArray(metrics.seven_days_sales) ? metrics.seven_days_sales : [],
      paymentMix: metrics.payment_mix || { total_collected: 0, segments: [] },
      recentActivity: Array.isArray(metrics.recent_activity) ? metrics.recent_activity : []
    };
  }, [metrics]);

  // Filter low-stock items from real inventory list
  const lowStockProducts = useMemo(() => {
    return currentStockList.filter(p => {
      const stock = Number(p.current_stock || 0);
      const minAlert = Number(p.min_stock_alert !== undefined ? p.min_stock_alert : 2);
      return p.stock_status === 'LOW_STOCK' || p.stock_status === 'OUT_OF_STOCK' || stock <= minAlert;
    });
  }, [currentStockList]);

  // Compute 7 days max revenue for proportional bar height
  const maxDayRevenue = useMemo(() => {
    if (!m.sevenDaysSales || m.sevenDaysSales.length === 0) return 1;
    const maxVal = Math.max(...m.sevenDaysSales.map(d => Number(d.revenue || 0)));
    return maxVal > 0 ? maxVal : 1;
  }, [m.sevenDaysSales]);

  // SVG Donut Math (strictly using real database payment numbers)
  const donutData = useMemo(() => {
    const rawSegments = m.paymentMix?.segments || [];
    const totalColl = Number(m.paymentMix?.total_collected || 0);

    const segments = rawSegments.length > 0 ? rawSegments : [
      { mode: 'UPI', label: 'UPI', pct: 0, color: '#ea580c', amount: 0 },
      { mode: 'CASH', label: 'Cash', pct: 0, color: '#f59e0b', amount: 0 },
      { mode: 'CARD', label: 'Card', pct: 0, color: '#3b82f6', amount: 0 }
    ];

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPct = 0;

    const renderedSegments = segments.map((seg) => {
      const segPct = Math.max(0, Math.min(100, Number(seg.pct || 0)));
      const strokeLength = totalColl > 0 ? (segPct / 100) * circumference : 0;
      const strokeDashoffset = - (accumulatedPct / 100) * circumference;
      accumulatedPct += segPct;

      return {
        ...seg,
        strokeLength,
        strokeDashoffset,
        circumference
      };
    });

    return {
      radius,
      circumference,
      segments: renderedSegments,
      totalCollected: totalColl
    };
  }, [m.paymentMix]);

  // Open modal to record payment against an unpaid customer invoice
  const handleOpenRecordPayment = (inv) => {
    setSelectedInvoiceForPayment(inv);
  };

  // Open modal to record payment against a supplier purchase bill
  const handleOpenSupplierPayment = (pur) => {
    const total = Number(pur.total_amount || 0);
    const paid = Number(pur.paid_amount || 0);
    const balDue = Math.max(0, total - paid);

    setSelectedPurchaseForPayment({
      id: pur.id,
      invoice_number: pur.supplier_invoice_number || `PUR-${pur.id}`,
      supplier: pur.supplier?.name || pur.supplier_name || 'Supplier Vendor',
      total_amount: total,
      balance_due: balDue,
    });
    setSupplierPayAmount(String(balDue > 0 ? balDue : ''));
    setSupplierPayMode('BANK_TRANSFER');
    setSupplierPayDate(today);
    setSupplierPayRef('');
    setSupplierPayNotes('');
    setSupplierPaySuccessMsg('');
    setSupplierPayErrorMsg('');
  };

  // Submit supplier payment to backend API
  const handleSaveSupplierPayment = async (e) => {
    e.preventDefault();
    if (!selectedPurchaseForPayment) return;
    const numAmt = parseFloat(supplierPayAmount);
    if (!numAmt || numAmt <= 0) {
      setSupplierPayErrorMsg('Please enter a valid payment amount greater than zero.');
      return;
    }
    const maxPayable = Number(selectedPurchaseForPayment.balance_due || 0);
    if (numAmt > maxPayable) {
      setSupplierPayErrorMsg(`Payment amount cannot exceed vendor balance of ${fmtRupee(maxPayable)}.`);
      return;
    }

    setSubmittingSupplierPay(true);
    setSupplierPayErrorMsg('');
    try {
      await api.recordSupplierPayment(selectedPurchaseForPayment.id, {
        amount: numAmt,
        payment_mode: supplierPayMode,
        payment_date: supplierPayDate,
        reference_number: supplierPayRef,
        notes: supplierPayNotes
      });
      setSupplierPaySuccessMsg(`Supplier payment of ${fmtRupee(numAmt)} recorded successfully!`);
      setTimeout(() => {
        setSelectedPurchaseForPayment(null);
        fetchAllData();
      }, 1200);
    } catch (err) {
      console.error('Failed to record supplier payment:', err);
      setSupplierPayErrorMsg(err.message || 'Failed to record supplier payment. Please try again.');
    } finally {
      setSubmittingSupplierPay(false);
    }
  };

  // Open Stock Entry / Quick Restock Modal for a product
  const handleOpenStockEntryModal = (prod = null) => {
    const targetProd = prod || (currentStockList.length > 0 ? currentStockList[0] : null);
    setStockEntryProduct(targetProd);
    setStockEntryQtyToAdd(5);
    setStockEntryReason('Vendor Stock Inward / Replenishment');
    setStockEntryCustomNotes('');
    setStockEntrySuccessMsg('');
    setStockEntryErrorMsg('');
    setIsStockEntryModalOpen(true);
  };

  // Submit physical stock entry / adjustment
  const handleSaveStockEntry = async (e) => {
    e.preventDefault();
    if (!stockEntryProduct) {
      setStockEntryErrorMsg('Please select a product to restock.');
      return;
    }

    const qtyToAdd = parseInt(stockEntryQtyToAdd, 10);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      setStockEntryErrorMsg('Please enter a valid quantity greater than 0.');
      return;
    }

    const prodId = stockEntryProduct.product_id || stockEntryProduct.id;
    const currQty = Number(stockEntryProduct.current_stock || 0);
    const newTotalQty = currQty + qtyToAdd;

    setSubmittingStockEntry(true);
    setStockEntryErrorMsg('');
    try {
      const reasonCombined = `${stockEntryReason}${stockEntryCustomNotes ? ` - ${stockEntryCustomNotes}` : ''}`;
      await api.postStockAdjustment({
        product_id: prodId,
        new_stock_quantity: newTotalQty,
        reason: reasonCombined
      });

      setStockEntrySuccessMsg(`Added +${qtyToAdd} units to '${stockEntryProduct.product_name || stockEntryProduct.name}'. New stock is ${newTotalQty} units!`);
      setTimeout(() => {
        setIsStockEntryModalOpen(false);
        fetchAllData();
      }, 1200);
    } catch (err) {
      console.error('Failed to save stock entry:', err);
      setStockEntryErrorMsg(err.message || 'Failed to adjust stock. Please try again.');
    } finally {
      setSubmittingStockEntry(false);
    }
  };

  if (loading && !metrics) {
    return <LoadingState message="Loading live operational dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* ─────────────────────────────────────────────────────────────
          TOP OPERATIONAL SUBHEADER BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 tracking-wide uppercase">
              Live operational view • Main Store
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Store Performance &amp; Operations
          </h1>
        </div>

        {/* Controls & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Presets */}
          <div className="flex bg-white border border-slate-200/90 rounded-xl p-1 items-center shadow-xs">
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This week' },
              { id: 'this_month', label: 'This month' },
              { id: 'all_time', label: 'All time' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-orange-50 text-orange-700 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-600 rounded-xl shadow-xs transition cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          QUICK ACTION OPERATIONS COMMAND BAR (New Bill, New Purchase, Restock)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-slate-700/50">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Fast Store Actions
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Instantly create customer sales invoices, register vendor purchases, or enter incoming stock.
            </p>
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          
          {/* BUTTON 1: NEW BILL / POS SALE */}
          <button
            onClick={() => onNavigate && onNavigate('/pos/new')}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Redirect to POS Billing Terminal"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ New Bill (POS)</span>
          </button>

          {/* BUTTON 2: NEW PURCHASE */}
          <button
            onClick={() => onNavigate && onNavigate('/purchases/new')}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Redirect to Inbound Purchase Entry"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ New Purchase</span>
          </button>

          {/* BUTTON 4: RECORD EXPENSE */}
          <button
            onClick={() => onNavigate && onNavigate('/finance/expenses')}
            className="px-3 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-600/70 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Record business operational expenses"
          >
            <Receipt className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Expense</span>
          </button>

        </div>
      </div>
      

      {/* ─────────────────────────────────────────────────────────────
          ROW 1: 4 TOP KPI CARDS (Matching Screenshot Structure)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: Today's sales */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Today&apos;s Net Sales</span>
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {fmtRupee(m.todaySales)}
            </div>
            {m.todaySalesReturns > 0 ? (
              <div className="mt-2 text-[11px] font-bold text-amber-800 flex flex-wrap items-center gap-1 font-mono bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200">
                <span className="text-slate-600 font-sans">Gross: {fmtRupee(m.todayGrossSales)}</span>
                <span>•</span>
                <span className="text-rose-600">↩ Ret: -{fmtRupee(m.todaySalesReturns)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
                {m.todaySales > 0 ? (
                  <>
                    <span className="text-sm leading-none">↑</span>
                    <span>{fmtRupee(m.todaySales)} billed today</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-normal">
                    Month-to-date: <strong className="text-slate-700 font-semibold">{fmtLakhs(m.monthSales)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: Gross profit */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-500 block">Gross Profit</span>
              <span className="text-[10px] text-slate-400">Sales − Cost of Goods</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${m.grossProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {fmtRupee(m.grossProfit)}
            </div>
            <div className={`mt-2 text-xs font-semibold ${m.grossMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {pct(m.grossMarginPct)} profit margin
            </div>
          </div>
        </div>

        {/* CARD 3: Stock value */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-500 block">Stock Value</span>
              <span className="text-[10px] text-slate-400">Inventory at purchase cost</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" title={fmtDecimal(m.stockValue)}>
              {fmtLakhs(m.stockValue)}
            </div>
            <div className="mt-2 text-xs font-semibold text-amber-600 flex items-center gap-1.5">
              <span>{m.lowStockCount} items low in stock</span>
            </div>
          </div>
        </div>

        {/* CARD 4: Receivables */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-500 block">Pending Receivables</span>
              <span className="text-[10px] text-slate-400">Uncollected customer dues</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" title={fmtDecimal(m.receivables)}>
              {fmtLakhs(m.receivables)}
            </div>
            <div className="mt-2 text-xs font-semibold text-amber-600">
              {m.overdueReceivables > 0 
                ? `${fmtRupee(m.overdueReceivables)} overdue`
                : '✓ No overdue customer dues'}
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 2: MIDDLE SECTION (Sales Performance & Payment Mix)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: Sales Performance Bar Chart */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Sales performance</h2>
                <p className="text-xs text-slate-400 mt-0.5">Revenue across the last 7 days</p>
              </div>
              <span className="bg-orange-50 text-orange-700 font-semibold text-xs px-3 py-1 rounded-full border border-orange-200/50">
                This week
              </span>
            </div>

            {/* Interactive Bar Chart */}
            <div className="mt-8 pt-4 pb-2">
              <div className="h-56 w-full flex items-end justify-between gap-3 sm:gap-6 px-2 sm:px-6 relative">
                
                {/* Horizontal Baseline Guideline */}
                <div className="absolute inset-x-0 bottom-8 border-b border-slate-100 pointer-events-none" />

                {m.sevenDaysSales.map((item, idx) => {
                  const rev = Number(item.revenue || 0);
                  const heightPercent = rev > 0 ? Math.max(12, Math.round((rev / maxDayRevenue) * 100)) : 3;
                  const isHovered = hoveredBar === idx;

                  return (
                    <div 
                      key={idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div className="absolute -top-12 z-20 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <p className="font-bold">{fmtRupee(rev)}</p>
                          <p className="text-[10px] text-slate-300 font-normal">{item.invoices_count || 0} bills • {item.day}</p>
                        </div>
                      )}

                      {/* Bar */}
                      <div className="w-full max-w-[42px] flex items-end justify-center mb-2 h-full">
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-300 shadow-xs ${
                            rev > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-200'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span className={`text-xs font-semibold transition mt-1 ${isHovered ? 'text-orange-600' : 'text-slate-400'}`}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-3 mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Peak Day: <strong className="text-slate-700">
              {m.sevenDaysSales.reduce((prev, curr) => ((curr.revenue || 0) > (prev.revenue || 0) ? curr : prev), m.sevenDaysSales[0] || {})?.day || 'Sat'}
            </strong></span>
            <span>Period Average: <strong className="text-slate-700">
              {fmtRupee(m.sevenDaysSales.length > 0 ? m.sevenDaysSales.reduce((a, b) => a + Number(b.revenue || 0), 0) / m.sevenDaysSales.length : 0)} / day
            </strong></span>
          </div>
        </div>

        {/* RIGHT COLUMN: Payment Mix Donut Chart */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Payment mix</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activePreset === 'today' ? "Today's collections" : "Collections in selected period"}
                </p>
              </div>
            </div>

            {/* SVG Donut Chart */}
            <div className="my-6 flex items-center justify-center">
              <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                  {/* Background Track Circle */}
                  <circle
                    cx="70"
                    cy="70"
                    r={donutData.radius}
                    stroke="#f1f5f9"
                    strokeWidth="16"
                    fill="transparent"
                  />
                  {/* Segment Arcs */}
                  {donutData.segments.map((seg, i) => (
                    <circle
                      key={i}
                      cx="70"
                      cy="70"
                      r={donutData.radius}
                      stroke={seg.color}
                      strokeWidth="16"
                      strokeDasharray={`${seg.strokeLength} ${donutData.circumference}`}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap="butt"
                      fill="transparent"
                      className="transition-all duration-700"
                    />
                  ))}
                </svg>

                {/* Inner Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {donutData.totalCollected > 0 ? fmtLakhs(donutData.totalCollected) : '₹0'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mt-0.5">
                    collected
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Donut Legend below strictly from database */}
          <div className="border-t border-slate-50 pt-4 flex items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-slate-600">
            {donutData.segments.map((seg, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: seg.color }}
                />
                <span>{seg.label} <strong className="text-slate-800">{Number(seg.pct || 0)}%</strong></span>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 3: BOTTOM SECTION (Recent Activity & Inventory Health)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT: Recent activity */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent activity</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live business events &amp; bills</p>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('/pos/invoices')}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* Activity List with Due Status Badges & Quick Record Payment Action */}
            <div className="divide-y divide-slate-50 mt-2">
              {m.recentActivity.length > 0 ? (
                m.recentActivity.slice(0, 5).map((act, i) => (
                  <div key={i} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 rounded-xl px-2 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        act.has_due ? 'bg-amber-100/70 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {act.has_due ? <Clock className="w-4 h-4 stroke-[2.5]" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {act.title}
                          </p>
                          {act.has_due && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80">
                              Due: {fmtRupee(act.balance_due)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {act.customer} • {act.has_due ? `Paid ${fmtRupee(act.paid_amount)} of ${fmtRupee(act.amount)}` : act.payment_mode} • {act.date}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-sm font-bold text-slate-900">
                        {fmtRupee(act.amount)}
                      </span>
                      {act.has_due && (
                        <button
                          onClick={() => handleOpenRecordPayment(act)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                          title="Record payment for outstanding balance"
                        >
                          <IndianRupee className="w-3 h-3" />
                          <span>Record Payment</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No invoices or payments recorded for this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Inventory health */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">Inventory health</h2>
                <p className="text-xs text-slate-400 mt-0.5">Stock movement and warehouse levels</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Healthy Stock Header */}
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Stock SKUs Distribution</span>
                <span className="text-slate-900">{m.totalSkus} Total Items</span>
              </div>

              {/* Progress Bar Segmented */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${m.totalSkus > 0 ? Math.round((m.healthyStockCount / m.totalSkus) * 100) : 0}%` }}
                  title="Healthy Stock"
                />
                <div 
                  className="bg-amber-400 h-full transition-all duration-500" 
                  style={{ width: `${m.totalSkus > 0 ? Math.round((m.lowStockCount / m.totalSkus) * 100) : 0}%` }}
                  title="Low Stock"
                />
                <div 
                  className="bg-rose-500 h-full transition-all duration-500" 
                  style={{ width: `${m.totalSkus > 0 ? Math.round((m.outOfStockCount / m.totalSkus) * 100) : 0}%` }}
                  title="Out of Stock"
                />
              </div>

              {/* Stock Status Badges */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-emerald-50/70 border border-emerald-100/60 rounded-xl p-2.5 text-center">
                  <div className="text-base font-extrabold text-emerald-700">{m.healthyStockCount}</div>
                  <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Optimal</div>
                </div>
                <div 
                  onClick={() => handleOpenStockEntryModal()}
                  className="bg-amber-50/70 hover:bg-amber-100/80 border border-amber-100/60 rounded-xl p-2.5 text-center transition cursor-pointer"
                  title="Click to restock"
                >
                  <div className="text-base font-extrabold text-amber-700">{m.lowStockCount}</div>
                  <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">Low Stock ⚡</div>
                </div>
                <div 
                  onClick={() => handleOpenStockEntryModal()}
                  className="bg-rose-50/70 hover:bg-rose-100/80 border border-rose-100/60 rounded-xl p-2.5 text-center transition cursor-pointer"
                  title="Click to restock"
                >
                  <div className="text-base font-extrabold text-rose-700">{m.outOfStockCount}</div>
                  <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mt-0.5">Depleted ⚡</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 mt-4 flex gap-2">
            <button
              onClick={() => handleOpenStockEntryModal()}
              className="flex-1 py-2 px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Entry Stock</span>
            </button>
            <button
              onClick={() => onNavigate && onNavigate('/inventory/overview')}
              className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Manage Warehouse</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: STOCK ENTRY / QUICK RESTOCK MODAL
      ───────────────────────────────────────────────────────────── */}
      {isStockEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Physical Stock Entry &amp; Restock</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quickly add replenished warehouse units or record incoming items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStockEntryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error or Success feedback */}
            {stockEntryErrorMsg && (
              <div className="my-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {stockEntryErrorMsg}
              </div>
            )}
            {stockEntrySuccessMsg && (
              <div className="my-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{stockEntrySuccessMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveStockEntry} className="space-y-4 mt-3">
              
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product to Restock *
                </label>
                <select
                  value={stockEntryProduct ? (stockEntryProduct.product_id || stockEntryProduct.id) : ''}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const found = currentStockList.find(p => String(p.product_id || p.id) === String(selId));
                    setStockEntryProduct(found || null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 transition cursor-pointer"
                >
                  {currentStockList.map((p) => (
                    <option key={p.product_id || p.id} value={p.product_id || p.id}>
                      {p.product_name || p.name} (SKU: {p.sku}) • Current Stock: {p.current_stock || 0} {p.unit || 'NOS'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Stock Level Overview Card */}
              {stockEntryProduct && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Current Physical Stock:</span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {stockEntryProduct.current_stock || 0} <span className="text-xs font-normal text-slate-500">{stockEntryProduct.unit || 'NOS'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-medium">New Stock After Restock:</span>
                    <div className="text-base font-black text-emerald-600 mt-0.5">
                      {(Number(stockEntryProduct.current_stock || 0) + (parseInt(stockEntryQtyToAdd, 10) || 0))} <span className="text-xs font-normal text-slate-500">{stockEntryProduct.unit || 'NOS'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity to Add */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to Add (+Units) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={stockEntryQtyToAdd}
                    onChange={(e) => setStockEntryQtyToAdd(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 transition"
                  />
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 5, 10, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setStockEntryQtyToAdd(preset)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          stockEntryQtyToAdd === preset
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Restock Reason / Source
                </label>
                <select
                  value={stockEntryReason}
                  onChange={(e) => setStockEntryReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 transition cursor-pointer"
                >
                  <option value="Vendor Stock Inward / Replenishment">Vendor Stock Inward / Replenishment</option>
                  <option value="Physical Stock Count Correction">Physical Stock Count Correction</option>
                  <option value="Warehouse Audit Inward">Warehouse Audit Inward</option>
                  <option value="Opening Stock Balancing">Opening Stock Balancing</option>
                  <option value="Other Manual Inward">Other Manual Inward</option>
                </select>
              </div>

              {/* Optional Custom Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference Note / Batch No. (Optional)
                </label>
                <input
                  type="text"
                  value={stockEntryCustomNotes}
                  onChange={(e) => setStockEntryCustomNotes(e.target.value)}
                  placeholder="e.g. Received from Supplier Delivery Batch #291"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 transition"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsStockEntryModalOpen(false);
                    if (onNavigate) onNavigate('/purchases/new');
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Create Formal Purchase Bill Instead →</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsStockEntryModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingStockEntry}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {submittingStockEntry ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Stock Entry</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: RECORD CUSTOMER PAYMENT (SHARED COMPREHENSIVE MODAL)
      ───────────────────────────────────────────────────────────── */}
      {selectedInvoiceForPayment && (
        <RecordPaymentModal
          isOpen={Boolean(selectedInvoiceForPayment)}
          onClose={() => setSelectedInvoiceForPayment(null)}
          invoice={selectedInvoiceForPayment}
          onSuccess={() => {
            setSelectedInvoiceForPayment(null);
            fetchAllData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: RECORD SUPPLIER PAYMENT
      ───────────────────────────────────────────────────────────── */}
      {selectedPurchaseForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Supplier Payment</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Purchase #{selectedPurchaseForPayment.invoice_number} • {selectedPurchaseForPayment.supplier}
                </p>
              </div>
              <button
                onClick={() => setSelectedPurchaseForPayment(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoiced & Due Balance Callout */}
            <div className="my-4 p-3 bg-rose-50/70 border border-rose-200/70 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-medium">Total Bill:</span>
                <span className="ml-1 font-bold text-slate-800">{fmtRupee(selectedPurchaseForPayment.total_amount)}</span>
              </div>
              <div>
                <span className="text-rose-800 font-medium">Balance Due:</span>
                <span className="ml-1 font-extrabold text-rose-700 text-sm">{fmtRupee(selectedPurchaseForPayment.balance_due)}</span>
              </div>
            </div>

            {/* Error or Success feedback */}
            {supplierPayErrorMsg && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {supplierPayErrorMsg}
              </div>
            )}
            {supplierPaySuccessMsg && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{supplierPaySuccessMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveSupplierPayment} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Amount Paid (₹) *</label>
                  <button
                    type="button"
                    onClick={() => setSupplierPayAmount(String(selectedPurchaseForPayment.balance_due || ''))}
                    className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Pay Full Due ({fmtRupee(selectedPurchaseForPayment.balance_due)})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={supplierPayAmount}
                  onChange={(e) => setSupplierPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={supplierPayMode}
                    onChange={(e) => setSupplierPayMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={supplierPayDate}
                    onChange={(e) => setSupplierPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / UTR / Cheque No.</label>
                <input
                  type="text"
                  value={supplierPayRef}
                  onChange={(e) => setSupplierPayRef(e.target.value)}
                  placeholder="Optional reference number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={supplierPayNotes}
                  onChange={(e) => setSupplierPayNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseForPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSupplierPay}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingSupplierPay ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Confirm Supplier Payment</span>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default ExecutiveDashboard;
