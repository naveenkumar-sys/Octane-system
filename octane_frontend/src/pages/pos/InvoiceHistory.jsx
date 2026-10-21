import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Calendar,
  Filter,
  Eye,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Package,
  Wrench,
  User,
  Tag,
  DollarSign,
  RotateCcw,
  Ban
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import FormModal from '../../components/ui/FormModal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';
import RecordPaymentModal from '../../components/forms/RecordPaymentModal';
import { toast } from 'react-toastify';

export const isInvoiceGst = (inv) => {
  if (!inv) return true;
  // Non-GST serial prefixes are always Non-GST
  if (inv.invoice_number && (inv.invoice_number.startsWith('EST-') || inv.invoice_number.startsWith('BILL-') || inv.invoice_number.startsWith('NG-'))) {
    return false;
  }
  // Explicitly marked as Non-GST
  if (inv.invoice_type === 'NON_GST' || inv.is_gst === false) {
    return false;
  }
  // Invoices issued with 0% GST / zero total tax to retail consumers (no GSTIN) are without GST
  if (parseFloat(inv.total_tax || 0) === 0 && !inv.buyer_gstin) {
    return false;
  }
  if (inv.is_gst !== undefined && inv.is_gst !== null) return Boolean(inv.is_gst);
  if (inv.invoice_type) return inv.invoice_type === 'TAX_INVOICE';
  return parseFloat(inv.total_tax || 0) > 0 || Boolean(inv.buyer_gstin);
};

export const InvoiceHistory = () => {
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceTypeTab, setInvoiceTypeTab] = useState('ALL'); // 'ALL' | 'GST' | 'NON_GST'
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals & Drawers
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [recordPaymentInvoice, setRecordPaymentInvoice] = useState(null);

  // Cancel / Void Modal State
  const [cancelInvoiceData, setCancelInvoiceData] = useState(null);
  const [cancelReason, setCancelReason] = useState('Invoice voided by admin request');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Sales Return Modal State
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [returnSerial, setReturnSerial] = useState('');
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState(null);

  const handleOpenCancel = (invoice) => {
    setCancelInvoiceData(invoice);
    setCancelReason('');
    setCancelError(null);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelInvoiceData) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await api.cancelInvoice(cancelInvoiceData.id, {
        reason: cancelReason.trim() || 'Voided by Administrator',
      });
      toast.success(`Invoice #${cancelInvoiceData.invoice_number} has been cancelled.`);
      setCancelInvoiceData(null);
      if (detailInvoice && detailInvoice.id === cancelInvoiceData.id) {
        setDetailInvoice(null);
      }
      fetchInvoices();
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel invoice.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenReturn = (invoice) => {
    setReturnInvoice(invoice);
    const items = invoice.items || [];
    const firstItem = items[0];
    setReturnItemId(firstItem ? String(firstItem.id) : '');
    setReturnQty('1');
    setReturnSerial(firstItem?.serial_number?.serial_number || (typeof firstItem?.serial_number === 'string' ? firstItem.serial_number : '') || '');
    setReturnReason('Customer Return');
    setReturnError(null);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnInvoice || !returnItemId) return;
    setReturnLoading(true);
    setReturnError(null);

    const selectedItem = (returnInvoice.items || []).find((i) => String(i.id) === String(returnItemId));
    if (!selectedItem) {
      setReturnError('Invalid item selected for return.');
      setReturnLoading(false);
      return;
    }

    try {
      const payload = {
        items: [
          {
            invoice_item_id: parseInt(returnItemId, 10),
            quantity: parseInt(returnQty, 10),
            serial_number: returnSerial.trim(),
            reason: returnReason.trim(),
          },
        ],
        notes: `Customer Sales Return for Invoice #${returnInvoice.invoice_number}`,
      };

      await api.processSalesReturn(returnInvoice.id, payload);
      setReturnInvoice(null);
      if (detailInvoice && detailInvoice.id === returnInvoice.id) {
        setDetailInvoice(null);
      }
      toast.success(`Sales return processed for Invoice #${returnInvoice.invoice_number}`);
      fetchInvoices();
    } catch (err) {
      setReturnError(err.message || 'Failed to process sales return.');
    } finally {
      setReturnLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getInvoices();
      const list = Array.isArray(res) ? res : res.results || [];
      setInvoices(list);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoice history.');
      toast.error('Failed to load invoice history.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    await fetchInvoices();
    if (detailInvoice) {
      // Refresh detail invoice if drawer is open
      try {
        const updated = await api.getInvoice(detailInvoice.id);
        setDetailInvoice(updated);
      } catch (e) {
        console.error('Error refreshing detailed invoice:', e);
      }
    }
  };

  // Count and breakdown for tabs across all fetched invoices
  const typeCounts = useMemo(() => {
    let gstCount = 0;
    let gstBilled = 0;
    let nonGstCount = 0;
    let nonGstBilled = 0;

    invoices.forEach((inv) => {
      const isGst = isInvoiceGst(inv);
      const total = parseFloat(inv.grand_total || 0);
      if (isGst) {
        gstCount += 1;
        gstBilled += total;
      } else {
        nonGstCount += 1;
        nonGstBilled += total;
      }
    });

    return { gstCount, gstBilled, nonGstCount, nonGstBilled, totalCount: invoices.length };
  }, [invoices]);

  // Filtered Invoices calculation
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Type Tab filter (All | GST Invoices | Non-GST Bills)
      const isGst = isInvoiceGst(inv);
      if (invoiceTypeTab === 'GST' && !isGst) return false;
      if (invoiceTypeTab === 'NON_GST' && isGst) return false;

      // Payment Status filter
      if (paymentStatusFilter !== 'ALL' && inv.payment_status !== paymentStatusFilter) {
        return false;
      }

      // Date range filter
      if (startDate && inv.invoice_date < startDate) return false;
      if (endDate && inv.invoice_date > endDate) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (inv.invoice_number || '').toLowerCase().includes(q);
        const buyerMatch = (inv.buyer_name || '').toLowerCase().includes(q);
        const mobileMatch = (inv.customer_mobile || inv.customer?.mobile || '').includes(q);
        const itemMatch = (inv.items || []).some((item) => (item.description || '').toLowerCase().includes(q));

        if (!numMatch && !buyerMatch && !mobileMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, invoiceTypeTab, searchQuery, paymentStatusFilter, startDate, endDate]);

  // Overall Metrics Calculation
  const metrics = useMemo(() => {
    let totalCount = 0;
    let totalBilled = 0;
    let totalReturned = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filteredInvoices.forEach((inv) => {
      totalCount += 1;
      if (inv.invoice_status !== 'CANCELLED') {
        totalBilled += parseFloat(inv.grand_total || 0);
        totalReturned += parseFloat(inv.returned_amount || 0);
        totalPaid += parseFloat(inv.total_paid_amount || 0);
        totalBalance += parseFloat(inv.balance_due_amount || 0);
      }
    });

    const netBilled = Math.max(0, totalBilled - totalReturned);

    return { totalCount, totalBilled, totalReturned, netBilled, totalPaid, totalBalance };
  }, [filteredInvoices]);

  const columns = [
    {
      key: 'invoice_number',
      header: 'Invoice / Bill #',
      render: (inv) => {
        const isGst = isInvoiceGst(inv);
        return (
          <div>
            <div className={`font-extrabold text-xs font-mono flex items-center gap-1.5 ${isGst ? 'text-orange-600' : 'text-indigo-600'}`}>
              <FileText size={13} />
              <span>{inv.invoice_number}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-extrabold border ${
                isGst
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {isGst ? 'GST' : 'NON-GST'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{inv.invoice_date}</div>
          </div>
        );
      },
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (inv) => (
        <div>
          <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
            <span>{inv.buyer_name || 'Cash Customer'}</span>
            <span className="px-1 py-0.2 text-[9px] font-mono font-bold bg-slate-100 text-slate-600 rounded">
              {inv.buyer_gstin ? 'B2B' : 'B2C'}
            </span>
          </div>
          {inv.customer?.mobile && (
            <div className="text-[10px] text-slate-500 font-mono">Ph: {inv.customer.mobile}</div>
          )}
        </div>
      ),
    },
    {
      key: 'items_count',
      header: 'Items',
      render: (inv) => (
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
          {(inv.items || []).length} Item(s)
        </span>
      ),
    },
    {
      key: 'grand_total',
      header: 'Grand Total',
      render: (inv) => (
        <span className="font-extrabold text-xs text-slate-900 font-mono">
          ₹{parseFloat(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_paid_amount',
      header: 'Paid',
      render: (inv) => (
        <span className="font-extrabold text-xs text-emerald-700 font-mono">
          ₹{parseFloat(inv.total_paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'balance_due_amount',
      header: 'Balance Due',
      render: (inv) => {
        const bal = parseFloat(inv.balance_due_amount || 0);
        return (
          <span className={`font-extrabold text-xs font-mono ${bal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (inv) => {
        const isCancelled = inv.invoice_status === 'CANCELLED';
        return (
          <div className="flex flex-col gap-1 items-start">
            {isCancelled ? (
              <StatusBadge status="CANCELLED" />
            ) : (
              <StatusBadge status={inv.payment_status} type="payment" />
            )}
            {inv.has_returns && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                ↩ Ret: ₹{parseFloat(inv.returned_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (inv) => {
        const isCancelled = inv.invoice_status === 'CANCELLED';
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDetailInvoice(inv)}
              className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye size={15} />
            </button>
            {!isCancelled && (
              <button
                onClick={() => handleOpenReturn(inv)}
                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                title="Process Sales Return"
              >
                <RotateCcw size={15} />
              </button>
            )}
            {!isCancelled && parseFloat(inv.balance_due_amount || 0) > 0 && (
              <button
                onClick={() => setRecordPaymentInvoice(inv)}
                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Record Payment"
              >
                <CreditCard size={15} />
              </button>
            )}
            <button
              onClick={() => setPrintInvoice(inv)}
              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Print A4 Invoice"
            >
              <Printer size={15} />
            </button>
            {!isCancelled && isAdmin && (
              <button
                onClick={() => handleOpenCancel(inv)}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Cancel / Void Invoice"
              >
                <Ban size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) return <LoadingState message="Loading sales invoice history log..." />;
  if (error) return <ErrorState message={error} onRetry={fetchInvoices} />;

  return (
    <div className="space-y-5">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {invoiceTypeTab === 'ALL' ? 'Total Documents' : invoiceTypeTab === 'GST' ? 'GST Tax Invoices' : 'Non-GST Bills'}
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">{metrics.totalCount} Records</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {invoiceTypeTab === 'NON_GST' ? 'Net Non-GST Revenue' : 'Net Sales Revenue'}
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            ₹{metrics.netBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          {metrics.totalReturned > 0 ? (
            <div className="text-[10px] text-amber-700 font-mono font-bold flex items-center gap-1">
              <span>Gross: ₹{metrics.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>•</span>
              <span className="text-rose-600">↩ Ret: -₹{metrics.totalReturned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-mono">100% Realized Revenue</div>
          )}
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Dues Collected</div>
          <div className="text-xl font-extrabold text-emerald-800 font-mono">
            ₹{metrics.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Outstanding Dues</div>
          <div className="text-xl font-extrabold text-rose-600 font-mono">
            ₹{metrics.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Individual Segments: All Documents vs GST Tax Invoices vs Non-GST Bills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setInvoiceTypeTab('ALL')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            invoiceTypeTab === 'ALL'
              ? 'bg-white text-slate-900 shadow-2xs font-extrabold ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={15} className={invoiceTypeTab === 'ALL' ? 'text-slate-900' : 'text-slate-400'} />
          <span>All Invoices & Bills</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-slate-200 text-slate-800">
            {typeCounts.totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setInvoiceTypeTab('GST')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            invoiceTypeTab === 'GST'
              ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-orange-200'
              : 'text-slate-600 hover:text-orange-600'
          }`}
        >
          <FileText size={15} className={invoiceTypeTab === 'GST' ? 'text-orange-600' : 'text-slate-400'} />
          <span>GST Invoices (INV-)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-orange-100 text-orange-800">
            {typeCounts.gstCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setInvoiceTypeTab('NON_GST')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            invoiceTypeTab === 'NON_GST'
              ? 'bg-white text-indigo-700 shadow-2xs font-extrabold ring-1 ring-indigo-200'
              : 'text-slate-600 hover:text-indigo-600'
          }`}
        >
          <Tag size={15} className={invoiceTypeTab === 'NON_GST' ? 'text-indigo-600' : 'text-slate-400'} />
          <span>Non-GST Bills (EST-)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-indigo-100 text-indigo-800">
            {typeCounts.nonGstCount}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number, customer name, phone, item name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {['ALL', 'PAID', 'PARTIALLY_PAID', 'UNPAID'].map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setPaymentStatusFilter(statusKey)}
                className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  paymentStatusFilter === statusKey
                    ? 'bg-white text-orange-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {statusKey === 'ALL' ? 'All' : statusKey.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-slate-500 font-bold hidden sm:inline">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs focus:outline-none"
              title="Start Date (From)"
            />
            <span className="text-slate-400 font-bold">until</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs focus:outline-none"
              title="Current Date / End Date (Until)"
            />
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                setEndDate(`${y}-${m}-${d}`);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 hover:border-orange-300 rounded-xl font-bold text-slate-700 text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
              title="Show all sales from start until current date"
            >
              <Clock size={12} className="text-orange-600" />
              <span>Until Now</span>
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                title="Clear Dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Data Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Invoices Found"
          message={searchQuery ? 'No invoice records match your search query or filters.' : 'No customer invoices have been issued yet.'}
        />
      ) : (
        <DataTable data={filteredInvoices} columns={columns} paginationPerPage={15} />
      )}

      {/* Invoice Detailed Drawer / Modal */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white max-w-2xl w-full h-full p-6 shadow-2xl overflow-y-auto space-y-5 animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-slate-900 font-mono">Invoice #{detailInvoice.invoice_number}</h2>
                  {detailInvoice.invoice_status === 'CANCELLED' ? (
                    <StatusBadge status="CANCELLED" />
                  ) : (
                    <StatusBadge status={detailInvoice.payment_status} type="payment" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issued on <strong>{detailInvoice.invoice_date}</strong> • Cashier: <strong>{detailInvoice.created_by_name || 'Admin'}</strong>
                </p>
              </div>
              <button
                onClick={() => setDetailInvoice(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cancelled Alert Banner */}
            {detailInvoice.invoice_status === 'CANCELLED' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-xs text-rose-900 uppercase tracking-wide">
                    Document Cancelled & Voided
                  </div>
                  <div className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                    {detailInvoice.notes || 'This invoice has been voided by the store administrator. All inward stock/serials were restored to inventory.'}
                  </div>
                </div>
              </div>
            )}

            {/* Sales Return Banner */}
            {detailInvoice.has_returns && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={14} className="text-amber-700" />
                  Sales Return Recorded
                </span>
                <span className="font-mono text-amber-800">
                  Total Returned: ₹{parseFloat(detailInvoice.returned_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Customer & Billing Info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between">
                <span>{detailInvoice.buyer_name || 'Cash Customer'}</span>
                <span className="font-mono text-xs text-orange-600">{detailInvoice.buyer_gstin ? `GSTIN: ${detailInvoice.buyer_gstin}` : 'Consumer B2C'}</span>
              </div>
              <div className="text-slate-600 flex flex-wrap items-center gap-4">
                {detailInvoice.customer?.mobile && <span>Phone: <strong>{detailInvoice.customer.mobile}</strong></span>}
                {detailInvoice.buyer_address && <span>Address: <strong>{detailInvoice.buyer_address}</strong></span>}
                <span>Payment Mode: <strong>{detailInvoice.mode_of_payment || 'Cash'}</strong></span>
                {detailInvoice.partner_allocation_json && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 font-sans">
                    👤 Partner Collection: <strong>{detailInvoice.partner_allocation_json.partner_name || 'Partner'}</strong> ({detailInvoice.partner_allocation_json.mode || 'CASH'})
                  </span>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Billed Items (Products & Services)</div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 text-center">HSN/SAC</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Tax</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {(detailInvoice.items || []).map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans">
                          <div className="flex items-center gap-1.5">
                            {item.item_type === 'SERVICE' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 flex items-center gap-0.5">
                                <Wrench size={9} /> SERVICE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                <Package size={9} /> PRODUCT
                              </span>
                            )}
                            <span className="font-extrabold text-slate-900">{item.description}</span>
                          </div>
                          {item.serial_number && (
                            <div className="text-[10px] text-amber-700 font-mono">SN: {item.serial_number.serial_number || item.serial_number}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">{item.hsn_sac || '-'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{item.quantity} {item.unit}</td>
                        <td className="p-2.5 text-right">₹{parseFloat(item.rate || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-slate-500">₹{parseFloat(item.total_tax || item.cgst_amount + item.sgst_amount + item.igst_amount || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">₹{parseFloat(item.total_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals Breakdown */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span>₹{parseFloat(detailInvoice.taxable_amount || detailInvoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Total Tax (GST):</span>
                <span>₹{parseFloat(detailInvoice.total_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between font-extrabold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                <span>Grand Total:</span>
                <span>₹{parseFloat(detailInvoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700 font-extrabold">
                <span>Total Amount Paid:</span>
                <span>₹{parseFloat(detailInvoice.total_paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-rose-600 font-extrabold text-sm pt-1 border-t border-slate-200">
                <span>Remaining Balance Due:</span>
                <span>₹{parseFloat(detailInvoice.balance_due_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payment History Audit Trail */}
            <div className="space-y-2">
              <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Payment Audit History Log</span>
                <span className="text-[10px] text-slate-400 font-mono">{(detailInvoice.payments || []).length} Transaction(s)</span>
              </div>
              {(detailInvoice.payments || []).length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                  No payment receipts recorded for this invoice yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailInvoice.payments.map((p, pIdx) => (
                    <div key={pIdx} className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between font-mono">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-slate-100 text-slate-700 border font-bold">
                            {p.payment_mode}
                          </span>
                          <span>Receipt #{p.payment_number}</span>
                          {p.partner_allocation_json && (
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-0.5 font-sans">
                              👤 {p.partner_allocation_json.partner_name || 'Partner'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                          {p.payment_date} {p.reference_number && `• Ref: ${p.reference_number}`}
                        </div>
                      </div>
                      <div className="text-right font-extrabold text-emerald-700 text-xs">
                        +₹{parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setPrintInvoice(detailInvoice);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer size={15} />
                <span>Print A4 Invoice</span>
              </button>

              <div className="flex items-center gap-2">
                {detailInvoice.invoice_status !== 'CANCELLED' && (
                  <>
                    <button
                      onClick={() => handleOpenReturn(detailInvoice)}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Process Return</span>
                    </button>

                    {parseFloat(detailInvoice.balance_due_amount || 0) > 0 && (
                      <button
                        onClick={() => {
                          setRecordPaymentInvoice(detailInvoice);
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <CreditCard size={15} />
                        <span>Record Payment (₹{parseFloat(detailInvoice.balance_due_amount).toFixed(2)})</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => handleOpenCancel(detailInvoice)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                        title="Cancel / Void this invoice"
                      >
                        <Ban size={14} />
                        <span>Void Invoice</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Sales Return Modal */}
      {returnInvoice && (
        <FormModal
          isOpen={Boolean(returnInvoice)}
          onClose={() => setReturnInvoice(null)}
          onSubmit={handleReturnSubmit}
          loading={returnLoading}
          title={`Process Customer Return for #${returnInvoice.invoice_number}`}
          subtitle={`Customer: ${returnInvoice.buyer_name || 'Cash Customer'}`}
          submitLabel="Process Sales Return"
          error={returnError}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Select Item to Return *</label>
              <select
                required
                value={returnItemId}
                onChange={(e) => {
                  setReturnItemId(e.target.value);
                  const item = (returnInvoice.items || []).find((i) => String(i.id) === String(e.target.value));
                  setReturnSerial(item?.serial_number?.serial_number || (typeof item?.serial_number === 'string' ? item.serial_number : '') || '');
                  setReturnQty('1');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                {(returnInvoice.items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.item_type}] {item.description} (Sold Qty: {item.quantity})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const selectedItem = (returnInvoice.items || []).find((i) => String(i.id) === String(returnItemId));
              const isSerialTracked = Boolean(selectedItem?.serial_number);

              return (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Return Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedItem?.quantity || 1}
                      required
                      value={returnQty}
                      onChange={(e) => setReturnQty(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>

                  {isSerialTracked && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Serial Number *</label>
                      <input
                        type="text"
                        required
                        value={returnSerial}
                        onChange={(e) => setReturnSerial(e.target.value)}
                        placeholder="Enter returned unit Serial Number"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      />
                    </div>
                  )}
                </>
              );
            })()}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Return Reason / Notes *</label>
              <textarea
                rows={2}
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Reason for customer sales return..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* Cancel / Void Invoice Confirmation Modal */}
      {cancelInvoiceData && (
        <FormModal
          isOpen={Boolean(cancelInvoiceData)}
          onClose={() => setCancelInvoiceData(null)}
          onSubmit={handleCancelSubmit}
          loading={cancelLoading}
          title={`Cancel & Void Invoice #${cancelInvoiceData.invoice_number}`}
          subtitle={`Customer: ${cancelInvoiceData.buyer_name || 'Cash Customer'} • Grand Total: ₹${parseFloat(cancelInvoiceData.grand_total || 0).toFixed(2)}`}
          submitLabel="Confirm Cancellation"
          error={cancelError}
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-rose-600" />
                Warning: Irreversible Soft Cancellation
              </div>
              <p className="text-[11px] leading-relaxed">
                Cancelling this invoice will mark it as <strong>CANCELLED / VOID</strong>, restore any outward sold serial numbers and stock back to available inventory, remove linked ledger payments, and retain this invoice for audit compliance.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Cancellation Reason *</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancelling this invoice (e.g. customer request, billing error)..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* Record Payment Modal */}
      {recordPaymentInvoice && (
        <RecordPaymentModal
          isOpen={Boolean(recordPaymentInvoice)}
          onClose={() => setRecordPaymentInvoice(null)}
          invoice={recordPaymentInvoice}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Print A4 Invoice Modal */}
      {printInvoice && (
        <A4InvoicePrintModal
          isOpen={Boolean(printInvoice)}
          onClose={() => setPrintInvoice(null)}
          invoiceData={printInvoice}
          autoPrint={false}
          defaultCopies="SINGLE"
        />
      )}
    </div>
  );
};

export default InvoiceHistory;
