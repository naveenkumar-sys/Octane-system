import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  DollarSign,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  X,
  Phone,
  Building2,
  Receipt
} from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import RecordPaymentModal from '../../components/forms/RecordPaymentModal';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';
import { toast } from 'react-toastify';

export const CustomerReceivables = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyDuesFilter, setOnlyDuesFilter] = useState(true);

  // Selected Customer Drawer & Payment Modal
  const [selectedCustDetail, setSelectedCustDetail] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);

  useEffect(() => {
    fetchReceivablesSummary();
  }, []);

  const fetchReceivablesSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCustomerReceivablesSummary();
      setData(res);
    } catch (err) {
      console.error('Error fetching customer receivables:', err);
      setError(err.message || 'Failed to load customer receivables summary.');
      toast.error('Failed to load customer receivables summary.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    await fetchReceivablesSummary();
    if (selectedCustDetail) {
      // Refresh selected customer pending invoices
      try {
        const updatedCust = await api.getCustomerOutstanding(selectedCustDetail.customer_id);
        setSelectedCustDetail({
          ...selectedCustDetail,
          total_billed: updatedCust.total_invoiced,
          total_paid: updatedCust.total_paid,
          balance_due: updatedCust.balance_due,
          pending_invoices: updatedCust.pending_invoices,
          unpaid_count: updatedCust.pending_invoices.length,
        });
      } catch (e) {
        console.error('Error refreshing customer detail:', e);
      }
    }
  };

  // Filtered Customers Calculation
  const filteredCustomers = useMemo(() => {
    if (!data || !data.customers) return [];
    return data.customers.filter((c) => {
      // Only Dues filter
      if (onlyDuesFilter && c.balance_due <= 0) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (c.customer_name || '').toLowerCase().includes(q);
        const mobileMatch = (c.mobile || '').includes(q);
        const gstinMatch = (c.gstin || '').toLowerCase().includes(q);
        const cityMatch = (c.city || '').toLowerCase().includes(q);

        if (!nameMatch && !mobileMatch && !gstinMatch && !cityMatch) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, onlyDuesFilter]);

  const columns = [
    {
      key: 'customer_name',
      header: 'Customer',
      render: (c) => (
        <div>
          <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
            <span>{c.customer_name}</span>
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-slate-100 text-slate-700 rounded">
              {c.customer_type || 'INDIVIDUAL'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {c.mobile && `Ph: ${c.mobile}`} {c.gstin && `• GSTIN: ${c.gstin}`}
          </div>
        </div>
      ),
    },
    {
      key: 'unpaid_count',
      header: 'Unpaid Invoices',
      render: (c) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
          c.unpaid_count > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
        }`}>
          {c.unpaid_count} Invoice(s)
        </span>
      ),
    },
    {
      key: 'total_billed',
      header: 'Total Billed',
      render: (c) => (
        <span className="font-extrabold text-xs text-slate-900 font-mono">
          ₹{c.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_paid',
      header: 'Total Paid',
      render: (c) => (
        <span className="font-extrabold text-xs text-emerald-700 font-mono">
          ₹{c.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'balance_due',
      header: 'Outstanding Balance',
      render: (c) => (
        <span className={`font-extrabold text-xs font-mono ${c.balance_due > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          ₹{c.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <button
          onClick={() => setSelectedCustDetail(c)}
          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>View Dues & Pay</span>
          <ChevronRight size={14} />
        </button>
      ),
    },
  ];

  if (loading) return <LoadingState message="Calculating customer credit dues and receivables..." />;
  if (error) return <ErrorState message={error} onRetry={fetchReceivablesSummary} />;

  return (
    <div className="space-y-5">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Billed</div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            ₹{(data?.total_billed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Dues Collected</div>
          <div className="text-xl font-extrabold text-emerald-800 font-mono">
            ₹{(data?.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Net Outstanding Receivables</div>
          <div className="text-xl font-extrabold text-rose-600 font-mono">
            ₹{(data?.total_receivable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customers with Active Dues</div>
          <div className="text-xl font-extrabold text-amber-700 font-mono">
            {(data?.customers || []).filter((c) => c.balance_due > 0).length} Customers
          </div>
        </div>
      </div>

      {/* Filter & Search Header */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name, mobile, GSTIN or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setOnlyDuesFilter(true)}
            className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
              onlyDuesFilter ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Customers with Dues
          </button>
          <button
            onClick={() => setOnlyDuesFilter(false)}
            className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
              !onlyDuesFilter ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Customers
          </button>
        </div>
      </div>

      {/* Customer Dues Data Table */}
      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Customer Receivables Found"
          message={onlyDuesFilter ? 'Great news! All customer receivables are fully cleared and paid.' : 'No customer records found.'}
        />
      ) : (
        <DataTable data={filteredCustomers} columns={columns} paginationPerPage={15} />
      )}

      {/* Customer Detail & Pending Invoices Drawer */}
      {selectedCustDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white max-w-xl w-full h-full p-6 shadow-2xl overflow-y-auto space-y-5 animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{selectedCustDetail.customer_name}</h2>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  {selectedCustDetail.mobile && <span>Ph: <strong>{selectedCustDetail.mobile}</strong></span>}
                  {selectedCustDetail.gstin && <span>• GSTIN: <strong className="font-mono">{selectedCustDetail.gstin}</strong></span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dues Overview Summary */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span>Total Billed Amount:</span>
                <span className="font-mono font-bold">₹{selectedCustDetail.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-800">
                <span>Total Payments Received:</span>
                <span className="font-mono font-bold">₹{selectedCustDetail.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-rose-700 font-extrabold text-sm pt-2 border-t border-orange-200/80">
                <span>Total Outstanding Balance:</span>
                <span className="font-mono">₹{selectedCustDetail.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Pending Invoices List */}
            <div className="space-y-3">
              <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Outstanding Unpaid / Partial Invoices</span>
                <span className="text-[10px] text-slate-400 font-mono font-bold">
                  {(selectedCustDetail.pending_invoices || []).length} Pending
                </span>
              </div>

              {(selectedCustDetail.pending_invoices || []).length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  This customer has zero pending invoice dues!
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCustDetail.pending_invoices.map((inv) => (
                    <div
                      key={inv.id || inv.invoice_id}
                      className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 hover:border-orange-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 font-mono">
                            Invoice #{inv.invoice_number}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">Issued on {inv.invoice_date}</div>
                        </div>
                        <StatusBadge status={inv.payment_status} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Billed</div>
                          <div className="font-bold text-slate-900">₹{parseFloat(inv.grand_total).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Paid</div>
                          <div className="font-bold text-emerald-700">₹{parseFloat(inv.total_paid_amount).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Balance</div>
                          <div className="font-extrabold text-rose-600">₹{parseFloat(inv.balance_due_amount).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={async () => {
                            try {
                              const fullInv = await api.getInvoice(inv.id || inv.invoice_id);
                              setPrintInvoice(fullInv);
                            } catch (e) {
                              toast.error('Failed to load invoice for printing.');
                            }
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Receipt size={13} />
                          <span>View A4 Bill</span>
                        </button>

                        <button
                          onClick={() => {
                            setPaymentInvoice({
                              id: inv.id || inv.invoice_id,
                              invoice_number: inv.invoice_number,
                              buyer_name: selectedCustDetail.customer_name,
                              grand_total: inv.grand_total,
                              total_paid_amount: inv.total_paid_amount,
                              balance_due_amount: inv.balance_due_amount,
                            });
                          }}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <CreditCard size={14} />
                          <span>Record Payment</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <RecordPaymentModal
          isOpen={Boolean(paymentInvoice)}
          onClose={() => setPaymentInvoice(null)}
          invoice={paymentInvoice}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Print Modal */}
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

export default CustomerReceivables;
