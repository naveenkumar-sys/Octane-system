import React, { useState, useEffect } from 'react';
import { Building2, Eye, CreditCard, RefreshCw, Printer } from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';

export const SupplierPayables = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // A4 Invoice Print Modal State
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // Selected Supplier Detail Modal
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Record Payment Modal State
  const [payModalSupplier, setPayModalSupplier] = useState(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, purRes, payRes] = await Promise.all([
        api.getSuppliers(),
        api.getPurchases(),
        api.getSupplierPayments(),
      ]);

      setSuppliers(Array.isArray(supRes) ? supRes : supRes.results || []);
      setPurchases(Array.isArray(purRes) ? purRes : purRes.results || []);
      setPayments(Array.isArray(payRes) ? payRes : payRes.results || []);
    } catch (err) {
      console.error('Error loading supplier payables:', err);
      setError(err.message || 'Failed to load supplier payables ledger.');
    } finally {
      setLoading(false);
    }
  };

  // Compute stats per supplier
  const supplierLedger = suppliers.map((sup) => {
    const supPurchases = purchases.filter((p) => String(p.supplier) === String(sup.id) || p.supplier_name === sup.name);
    
    let totalPurchased = 0;
    let totalPaid = 0;

    supPurchases.forEach((p) => {
      totalPurchased += parseFloat(p.total_amount || 0);
      totalPaid += parseFloat(p.paid_amount || 0);
    });

    const outstanding = Math.max(0, totalPurchased - totalPaid);

    return {
      ...sup,
      purchases_count: supPurchases.length,
      total_purchased: totalPurchased,
      total_paid: totalPaid,
      outstanding_balance: outstanding,
      pending_purchases: supPurchases.filter((p) => parseFloat(p.total_amount) > parseFloat(p.paid_amount)),
    };
  });

  // Global Totals
  const overallTotalPurchased = supplierLedger.reduce((acc, s) => acc + s.total_purchased, 0);
  const overallTotalPaid = supplierLedger.reduce((acc, s) => acc + s.total_paid, 0);
  const overallOutstanding = supplierLedger.reduce((acc, s) => acc + s.outstanding_balance, 0);

  // Filtered Suppliers
  const filteredSuppliers = supplierLedger.filter((s) => {
    return (
      !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleOpenPayModal = (sup) => {
    setPayModalSupplier(sup);
    const pending = sup.pending_purchases || [];
    const firstPending = pending.length > 0 ? pending[0] : null;

    if (firstPending) {
      setSelectedPurchaseId(String(firstPending.id));
      const bal = Math.max(0, parseFloat(firstPending.total_amount) - parseFloat(firstPending.paid_amount));
      setPayAmount(bal.toFixed(2));
    } else {
      setSelectedPurchaseId('');
      setPayAmount('0.00');
    }

    setPayMode('CASH');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayNotes('');
    setPayError(null);
  };

  const handlePurchaseSelectChange = (pId) => {
    setSelectedPurchaseId(pId);
    if (payModalSupplier) {
      const match = payModalSupplier.pending_purchases.find((p) => String(p.id) === String(pId));
      if (match) {
        const bal = Math.max(0, parseFloat(match.total_amount) - parseFloat(match.paid_amount));
        setPayAmount(bal.toFixed(2));
      }
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedPurchaseId) {
      setPayError('Please select a purchase invoice to apply payment.');
      return;
    }
    setPayLoading(true);
    setPayError(null);

    try {
      await api.recordSupplierPayment(selectedPurchaseId, {
        amount: parseFloat(payAmount),
        payment_mode: payMode,
        payment_date: payDate,
        reference_number: payRef.trim(),
        notes: payNotes.trim(),
      });
      setPayModalSupplier(null);
      fetchData();
    } catch (err) {
      setPayError(err.message || 'Failed to record payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const columns = [
    {
      header: 'Supplier Profile',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900">{row.name}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            {row.company_name ? `${row.company_name} | ` : ''}GSTIN: {row.gstin || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Purchases Count',
      accessor: 'purchases_count',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-bold text-slate-700">{row.purchases_count} Invoices</span>
      ),
    },
    {
      header: 'Total Purchased',
      accessor: 'total_purchased',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-slate-900 font-mono">
          ₹{row.total_purchased.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Total Paid',
      accessor: 'total_paid',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-emerald-600 font-mono">
          ₹{row.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Outstanding Balance',
      accessor: 'outstanding_balance',
      sortable: true,
      render: (row) => (
        <span
          className={`font-extrabold font-mono text-xs ${
            row.outstanding_balance > 0 ? 'text-rose-600' : 'text-slate-400'
          }`}
        >
          ₹{row.outstanding_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setSelectedSupplier(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="View Supplier Payable Ledger"
          >
            <Eye size={16} />
          </button>

          {row.outstanding_balance > 0 && (
            <button
              onClick={() => handleOpenPayModal(row)}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Record Supplier Payment"
            >
              <CreditCard size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Fetching supplier payables ledger..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="text-orange-600" size={24} />
            <span>Supplier Payables Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor credit balances, total procurement & outstanding supplier payables.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-all"
          title="Refresh Ledger"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Procurement</span>
          <span className="text-xl font-extrabold text-slate-900 font-mono">
            ₹{overallTotalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Vendor Paid</span>
          <span className="text-xl font-extrabold text-emerald-600 font-mono">
            ₹{overallTotalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-2xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-orange-800 block">Total Outstanding Dues</span>
          <span className="text-xl font-extrabold text-rose-600 font-mono">
            ₹{overallOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search supplier by name, company, GSTIN..."
        />
      </div>

      {/* Data Table */}
      {filteredSuppliers.length === 0 ? (
        <EmptyState
          title="No Suppliers Found"
          description={
            searchQuery
              ? 'No suppliers match your search query.'
              : 'Supplier directory is empty. Add suppliers in Masters -> Suppliers.'
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredSuppliers} keyField="id" />
      )}

      {/* View Supplier Payable Details Modal */}
      {selectedSupplier && (
        <FormModal
          isOpen={Boolean(selectedSupplier)}
          onClose={() => setSelectedSupplier(null)}
          title={`Payable Ledger: ${selectedSupplier.name}`}
          subtitle={`Company: ${selectedSupplier.company_name || 'N/A'} | GSTIN: ${selectedSupplier.gstin || 'N/A'}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setSelectedSupplier(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Purchased</span>
                <span className="font-extrabold text-slate-900 font-mono">
                  ₹{selectedSupplier.total_purchased.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Paid</span>
                <span className="font-extrabold text-emerald-600 font-mono">
                  ₹{selectedSupplier.total_paid.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Balance Due</span>
                <span className="font-extrabold text-rose-600 font-mono">
                  ₹{selectedSupplier.outstanding_balance.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">Pending Purchase Invoices:</h4>
              {selectedSupplier.pending_purchases.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  All purchase invoices for this vendor are fully settled.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Invoice #</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Total</th>
                        <th className="p-2">Paid</th>
                        <th className="p-2 text-right">Balance Due</th>
                        <th className="p-2 text-center">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSupplier.pending_purchases.map((inv) => {
                        const bal = parseFloat(inv.total_amount) - parseFloat(inv.paid_amount);
                        return (
                          <tr key={inv.id}>
                            <td className="p-2 font-mono font-bold text-slate-900">{inv.purchase_number}</td>
                            <td className="p-2 text-slate-600">{inv.purchase_date}</td>
                            <td className="p-2 font-mono">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                            <td className="p-2 font-mono text-emerald-600">₹{parseFloat(inv.paid_amount).toFixed(2)}</td>
                            <td className="p-2 font-mono font-bold text-rose-600 text-right">
                              ₹{bal.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setPrintInvoiceData({
                                  ...inv,
                                  is_purchase: true,
                                  supplier_name: selectedSupplier.name,
                                  supplier_address: selectedSupplier.address,
                                  supplier_mobile: selectedSupplier.mobile,
                                  supplier_gstin: selectedSupplier.gstin,
                                })}
                                className="p-1 rounded text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                                title="Print Purchase Invoice A4"
                              >
                                <Printer size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </FormModal>
      )}

      {/* Record Payment Modal */}
      {payModalSupplier && (
        <FormModal
          isOpen={Boolean(payModalSupplier)}
          onClose={() => setPayModalSupplier(null)}
          onSubmit={handlePaySubmit}
          loading={payLoading}
          title={`Record Supplier Payment for ${payModalSupplier.name}`}
          subtitle={`Outstanding Balance: ₹${payModalSupplier.outstanding_balance.toFixed(2)}`}
          submitLabel="Post Payment"
          error={payError}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Select Purchase Invoice *</label>
              <select
                required
                value={selectedPurchaseId}
                onChange={(e) => handlePurchaseSelectChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="">Select Pending Purchase...</option>
                {(payModalSupplier.pending_purchases || []).map((p) => {
                  const bal = parseFloat(p.total_amount) - parseFloat(p.paid_amount);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.purchase_number} — Due: ₹{bal.toFixed(2)} (Total: ₹{parseFloat(p.total_amount).toFixed(2)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank NetBanking / NEFT</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Reference / Txn Number</label>
              <input
                type="text"
                placeholder="e.g. UTR-9821031 / CHQ-8821"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Notes / Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional notes for supplier payment..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* A4 Purchase Invoice Print Modal */}
      <A4InvoicePrintModal
        isOpen={Boolean(printInvoiceData)}
        onClose={() => setPrintInvoiceData(null)}
        invoiceData={printInvoiceData}
      />
    </div>
  );
};

export default SupplierPayables;
