import React, { useState, useEffect } from 'react';
import { Receipt, Eye, CreditCard, RotateCcw, Plus, RefreshCw, Printer } from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FilterBar from '../../components/ui/FilterBar';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';

export const PurchaseHistory = ({ onSelectRoute }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState({ payment_status: 'ALL' });

  // Detail Modal State
  const [detailPurchase, setDetailPurchase] = useState(null);

  // Record Payment Modal State
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Purchase Return Modal State
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [returnSerial, setReturnSerial] = useState('');
  const [returnReason, setReturnReason] = useState('');
  // A4 Invoice Print Modal State
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPurchases();
      setPurchases(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Error fetching purchases history:', err);
      setError(err.message || 'Failed to load purchase history.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecordPayment = (purchase) => {
    setPaymentPurchase(purchase);
    const balance = Math.max(0, parseFloat(purchase.total_amount) - parseFloat(purchase.paid_amount));
    setPaymentAmount(balance > 0 ? String(balance.toFixed(2)) : '0.00');
    setPaymentMode('CASH');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentRefNumber('');
    setPaymentNotes('');
    setPaymentError(null);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentPurchase) return;
    setPaymentLoading(true);
    setPaymentError(null);

    try {
      await api.recordSupplierPayment(paymentPurchase.id, {
        amount: parseFloat(paymentAmount),
        payment_mode: paymentMode,
        payment_date: paymentDate,
        reference_number: paymentRefNumber.trim(),
        notes: paymentNotes.trim(),
      });
      setPaymentPurchase(null);
      fetchPurchases();
    } catch (err) {
      setPaymentError(err.message || 'Failed to record supplier payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenReturn = (purchase) => {
    setReturnPurchase(purchase);
    const firstItem = purchase.items && purchase.items.length > 0 ? purchase.items[0] : null;
    setReturnItemId(firstItem ? String(firstItem.id) : '');
    setReturnQty('1');
    setReturnSerial('');
    setReturnReason('Supplier Return');
    setReturnError(null);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnPurchase || !returnItemId) return;
    setReturnLoading(true);
    setReturnError(null);

    const selectedItem = returnPurchase.items.find((i) => String(i.id) === String(returnItemId));
    if (!selectedItem) {
      setReturnError('Invalid item selected for return.');
      setReturnLoading(false);
      return;
    }

    const payload = {
      items: [
        {
          purchase_item_id: selectedItem.id,
          product_id: selectedItem.product,
          quantity: parseInt(returnQty, 10),
          serial_number: returnSerial.trim(),
          reason: returnReason.trim(),
        },
      ],
      notes: `Purchase Return for #${returnPurchase.purchase_number}`,
    };

    try {
      await api.processPurchaseReturn(returnPurchase.id, payload);
      setReturnPurchase(null);
      fetchPurchases();
    } catch (err) {
      setReturnError(err.message || 'Failed to process purchase return.');
    } finally {
      setReturnLoading(false);
    }
  };

  // Filtered purchases
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.purchase_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier_invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterValues.payment_status === 'ALL' || p.payment_status === filterValues.payment_status;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'OCTANE Purchase No.',
      accessor: 'purchase_number',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900 font-mono">{row.purchase_number}</div>
          <div className="text-[11px] text-slate-400 font-medium">{row.purchase_date}</div>
        </div>
      ),
    },
    {
      header: 'Supplier Invoice No.',
      accessor: 'supplier_invoice_number',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-700 text-xs">
          {row.supplier_invoice_number || '—'}
        </span>
      ),
    },
    {
      header: 'Supplier',
      accessor: 'supplier_name',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-slate-900 text-xs">
          {row.supplier_name || 'Unassigned Supplier'}
        </span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: 'total_amount',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900 font-mono">
            ₹{parseFloat(row.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Tax: ₹{parseFloat(row.tax_amount || 0).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      header: 'Paid / Balance',
      accessor: 'paid_amount',
      sortable: true,
      render: (row) => {
        const total = parseFloat(row.total_amount || 0);
        const paid = parseFloat(row.paid_amount || 0);
        const balance = Math.max(0, total - paid);

        return (
          <div>
            <div className="text-xs font-bold text-emerald-600 font-mono">
              Paid: ₹{paid.toFixed(2)}
            </div>
            {balance > 0 ? (
              <div className="text-[10px] font-bold text-rose-600 font-mono">
                Due: ₹{balance.toFixed(2)}
              </div>
            ) : (
              <div className="text-[10px] font-bold text-slate-400">Settled</div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'payment_status',
      sortable: true,
      render: (row) => <StatusBadge status={row.payment_status} type="payment" />,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      render: (row) => {
        const balance = Math.max(0, parseFloat(row.total_amount || 0) - parseFloat(row.paid_amount || 0));

        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setPrintInvoiceData(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              title="Print A4 Tax Invoice"
            >
              <Printer size={16} />
            </button>

            <button
              onClick={() => setDetailPurchase(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="View Purchase Details"
            >
              <Eye size={16} />
            </button>

            {balance > 0 && (
              <button
                onClick={() => handleOpenRecordPayment(row)}
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Record Supplier Payment"
              >
                <CreditCard size={16} />
              </button>
            )}

            <button
              onClick={() => handleOpenReturn(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Process Purchase Return"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  const filterConfigs = [
    {
      key: 'payment_status',
      label: 'Payment Status',
      options: [
        { value: 'PAID', label: 'Paid In Full' },
        { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
        { value: 'UNPAID', label: 'Unpaid Dues' },
      ],
    },
  ];

  if (loading) return <LoadingState message="Fetching purchase invoice history..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPurchases} />;

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-orange-600" size={24} />
            <span>Purchase History Log</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of vendor stock receipts, payments & supplier returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPurchases}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
          {onSelectRoute && (
            <button
              onClick={() => onSelectRoute('/purchases/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>+ New Purchase</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by Purchase #, Supplier Name, Invoice #..."
        />
        <FilterBar
          filters={filterConfigs}
          values={filterValues}
          onChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
        />
      </div>

      {/* Data Table */}
      {filteredPurchases.length === 0 ? (
        <EmptyState
          title="No Purchases Found"
          description={
            searchQuery || filterValues.payment_status !== 'ALL'
              ? 'No purchase invoices match your filter criteria.'
              : 'No purchase invoices recorded yet. Click "+ New Purchase" to record your first vendor stock purchase.'
          }
          actionLabel="+ New Purchase"
          onAction={onSelectRoute ? () => onSelectRoute('/purchases/new') : null}
        />
      ) : (
        <DataTable columns={columns} data={filteredPurchases} keyField="id" />
      )}

      {/* View Purchase Details Modal */}
      {detailPurchase && (
        <FormModal
          isOpen={Boolean(detailPurchase)}
          onClose={() => setDetailPurchase(null)}
          title={`Purchase Invoice: ${detailPurchase.purchase_number}`}
          subtitle={`Supplier Invoice No: ${detailPurchase.supplier_invoice_number || 'N/A'}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setDetailPurchase(null);
          }}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPrintInvoiceData(detailPurchase)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
              >
                <Printer size={14} />
                <span>Print A4 Tax Invoice</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">OCTANE Purchase No.</span>
                <span className="font-mono font-extrabold text-slate-900">{detailPurchase.purchase_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Supplier Invoice No.</span>
                <span className="font-mono font-bold text-slate-800">{detailPurchase.supplier_invoice_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Supplier Name</span>
                <span className="font-bold text-slate-900">{detailPurchase.supplier_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Purchase Date</span>
                <span className="font-semibold text-slate-700">{detailPurchase.purchase_date}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Amount</span>
                <span className="font-extrabold text-slate-900 font-mono">
                  ₹{parseFloat(detailPurchase.total_amount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Paid Amount</span>
                <span className="font-extrabold text-emerald-600 font-mono">
                  ₹{parseFloat(detailPurchase.paid_amount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Payment Mode</span>
                <span className="font-bold text-slate-700">{detailPurchase.payment_mode}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">Purchased Items:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">Cost</th>
                      <th className="p-2">GST</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(detailPurchase.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium text-slate-900">
                          <div>{item.description || item.product_name}</div>
                          {item.product_specifications && (
                            <div className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded w-fit border border-orange-100 my-0.5">
                              {item.product_specifications}
                            </div>
                          )}
                          {item.serial_numbers_text && (
                            <div className="text-[10px] font-mono text-orange-600">
                              Serials: {item.serial_numbers_text}
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-bold">{item.quantity}</td>
                        <td className="p-2 font-mono">₹{parseFloat(item.unit_cost).toFixed(2)}</td>
                        <td className="p-2 font-mono">{item.gst_rate}%</td>
                        <td className="p-2 font-mono font-bold text-right">
                          ₹{parseFloat(item.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {detailPurchase.notes && (
              <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl text-xs text-slate-700">
                <span className="font-bold text-orange-900 block mb-0.5">Notes:</span>
                {detailPurchase.notes}
              </div>
            )}
          </div>
        </FormModal>
      )}

      {/* Record Supplier Payment Modal */}
      {paymentPurchase && (
        <FormModal
          isOpen={Boolean(paymentPurchase)}
          onClose={() => setPaymentPurchase(null)}
          onSubmit={handleRecordPaymentSubmit}
          loading={paymentLoading}
          title={`Record Supplier Payment for ${paymentPurchase.purchase_number}`}
          subtitle={`Supplier: ${paymentPurchase.supplier_name || 'N/A'}`}
          submitLabel="Post Payment"
          error={paymentError}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Invoice</span>
                <span className="font-bold text-slate-900 font-mono">
                  ₹{parseFloat(paymentPurchase.total_amount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Remaining Dues</span>
                <span className="font-extrabold text-rose-600 font-mono">
                  ₹{Math.max(0, parseFloat(paymentPurchase.total_amount) - parseFloat(paymentPurchase.paid_amount)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
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
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Reference / Txn Number</label>
              <input
                type="text"
                placeholder="e.g. UTR-90218821 / CHQ-1002"
                value={paymentRefNumber}
                onChange={(e) => setPaymentRefNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Notes / Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional payment reference notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* Process Purchase Return Modal */}
      {returnPurchase && (
        <FormModal
          isOpen={Boolean(returnPurchase)}
          onClose={() => setReturnPurchase(null)}
          onSubmit={handleReturnSubmit}
          loading={returnLoading}
          title={`Process Supplier Return for ${returnPurchase.purchase_number}`}
          subtitle={`Supplier: ${returnPurchase.supplier_name || 'N/A'}`}
          submitLabel="Process Return"
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
                  setReturnSerial('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                {(returnPurchase.items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description || item.product_name} (Purchased Qty: {item.quantity})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const selectedItem = (returnPurchase.items || []).find((i) => String(i.id) === String(returnItemId));
              const isSerialTracked = selectedItem?.serial_numbers_text && selectedItem.serial_numbers_text.trim().length > 0;

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
                    <div className="space-y-1 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <label className="text-xs font-bold text-amber-900 block">
                        Serial Number to Return *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SN-001"
                        value={returnSerial}
                        onChange={(e) => setReturnSerial(e.target.value.toUpperCase().trim())}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                      />
                      <span className="text-[10px] text-amber-700 block mt-1 font-mono">
                        Available Serial Numbers: {selectedItem.serial_numbers_text}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Reason for Return</label>
              <textarea
                rows={2}
                placeholder="Reason for returning items to vendor..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* A4 Tax Invoice Print Modal */}
      <A4InvoicePrintModal
        isOpen={Boolean(printInvoiceData)}
        onClose={() => setPrintInvoiceData(null)}
        invoiceData={printInvoiceData}
      />
    </div>
  );
};

export default PurchaseHistory;
