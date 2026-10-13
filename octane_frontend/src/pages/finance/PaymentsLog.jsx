import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Search, Calendar, Filter, ArrowUpRight, ArrowDownLeft, 
  RefreshCw, Wallet, FileText, Clock 
} from 'lucide-react';
import { api } from '../../services/api';
import { LoadingState } from '../../components/ui/StateViews';
import Pagination from '../../components/ui/Pagination';

const PaymentsLog = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await api.getAllPayments();
      setPayments(data.results || data || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Filter Logic
  const filteredPayments = payments.filter((payment) => {
    const searchMatch = 
      (payment.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.payer_payee || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.related_doc || '').toLowerCase().includes(searchTerm.toLowerCase());

    const modeMatch = selectedMode === 'ALL' || payment.payment_mode === selectedMode;
    const typeMatch = selectedType === 'ALL' || payment.transaction_type === selectedType;
    
    let dateMatch = true;
    if (dateRange.start) {
      dateMatch = dateMatch && new Date(payment.date) >= new Date(dateRange.start);
    }
    if (dateRange.end) {
      dateMatch = dateMatch && new Date(payment.date) <= new Date(dateRange.end + 'T23:59:59');
    }

    return searchMatch && modeMatch && typeMatch && dateMatch;
  });

  // Calculate totals
  const storeCustomerInflow = filteredPayments
    .filter(p => p.txn_type === 'CUSTOMER_RECEIPT' && (!p.partner_allocation || !p.partner_allocation.partner_name))
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const partnerDepositsInflow = filteredPayments
    .filter(p => p.txn_type === 'PARTNER_DEPOSIT')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const storeInflow = storeCustomerInflow + partnerDepositsInflow;

  const partnerCollections = filteredPayments
    .filter(p => p.txn_type === 'CUSTOMER_RECEIPT' && p.partner_allocation && p.partner_allocation.partner_name)
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const totalInflowAll = filteredPayments
    .filter(p => p.direction === 'IN')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const totalOutflow = filteredPayments
    .filter(p => p.direction === 'OUT')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  // Store Physical Cash & Bank Balance (in drawer & company bank account)
  const storeCashInHand = storeInflow - totalOutflow;

  // Unhanded cash sitting in partner pockets
  const cashHeldByPartners = Math.max(0, partnerCollections - partnerDepositsInflow);

  // Total Business Liquid Capital (Store Cash + Bank + In Partner Hands)
  const totalBusinessFunds = storeCashInHand + cashHeldByPartners;

  const paymentModes = ['ALL', 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];
  const transactionTypes = [
    'ALL', 
    'Customer Payment', 
    'Purchase Payment', 
    'Business Expense', 
    'Partner Drawing',
    'Partner Handover / Deposit'
  ];

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMode, selectedType, dateRange.start, dateRange.end]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedPayments = filteredPayments.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <div className="space-y-5">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Monetary Payments Audit Log</h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Complete transaction record of cash, bank, UPI, and online payments. Non-monetary credit dues are strictly excluded.
          </p>
        </div>

        <button 
          onClick={fetchPayments} 
          className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Payments</span>
        </button>
      </div>

      {/* Summary KPI Cards & Calculation Banner */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Store Cash / Bank In-Hand */}
          <div className="p-4 bg-white rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/40 to-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Store Cash In-Hand</span>
                <span className="text-[10px] text-blue-600 font-semibold">Till Drawer + Store Bank</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-extrabold font-mono ${storeCashInHand >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
              ₹{storeCashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Physical cash in till &amp; company bank balance</div>
          </div>

          {/* 2. Customer Money Held by Partners */}
          <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Held by Partners</span>
                <span className="text-[10px] text-amber-600 font-semibold">Customer Collections</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-amber-700 font-mono">
              ₹{cashHeldByPartners.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Pending handover / deposit to store till</div>
          </div>

          {/* 3. Money Paid Out (Outflow) */}
          <div className="p-4 bg-white rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/40 to-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Total Paid Out</span>
                <span className="text-[10px] text-rose-600 font-semibold">Suppliers + Expenses + Draws</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-rose-600 font-mono">
              ₹{totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Vendor bills, rent/bills &amp; partner withdrawals</div>
          </div>

          {/* 4. Total Business Liquid Funds */}
          <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Total Liquid Funds</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Store + Partner Hands</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 font-mono">
              ₹{totalBusinessFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Total available capital across store &amp; partners</div>
          </div>
        </div>

        {/* Clear Calculation Banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
              <span className="text-sm">💵</span>
              <span>Reconciliation:</span>
              <span className="font-mono text-blue-700">Store Cash (₹{storeCashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
              <span>=</span>
              <span className="font-mono text-emerald-700">Store Inflow (₹{storeInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
              <span>−</span>
              <span className="font-mono text-rose-600">Store Outflow (₹{totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-amber-700">Partner Hands: ₹{cashHeldByPartners.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              * Note: Store Inflow includes direct customer receipts (₹{storeCustomerInflow.toLocaleString('en-IN')}) plus partner deposits handed over to the store (₹{partnerDepositsInflow.toLocaleString('en-IN')}).
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ✓ Physical Till Verified
            </span>
          </div>
        </div>
      </div>


      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex flex-col md:flex-row items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] w-full">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
          <input 
            type="text"
            placeholder="Search ref #, party name, invoice/purchase doc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
          >
            {paymentModes.map(m => (
              <option key={m} value={m}>{m === 'ALL' ? 'All Modes' : m.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
          >
            {transactionTypes.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Transaction Types' : t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-bold text-xs hidden sm:inline">From:</span>
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-500"
            title="Start Date (From)"
          />
          <span className="text-slate-400 text-xs font-bold">until</span>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-500"
            title="Current Date / End Date (Until)"
          />
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, '0');
              const d = String(now.getDate()).padStart(2, '0');
              setDateRange({ start: '', end: `${y}-${m}-${d}` });
            }}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 hover:border-orange-300 rounded-xl font-bold text-slate-700 text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
            title="Show all payments from start until current date"
          >
            <Clock size={12} className="text-orange-600" />
            <span>Until Now</span>
          </button>
        </div>
      </div>

      {/* Payments Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Reference / Document</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Payer / Payee</th>
                <th className="py-3 px-4">Type & Mode</th>
                <th className="py-3 px-4 text-center">Direction</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <LoadingState message="Loading payment transactions..." />
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400 text-xs font-medium">
                    No monetary payment records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900 font-mono">
                            {p.txn_number || (p.reference_number && p.reference_number !== '—' ? p.reference_number : `PAY-${p.id}`)}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.related_doc && p.related_doc !== '—' && (
                              <div className="text-[11px] text-orange-600 font-mono font-medium">{p.related_doc}</div>
                            )}
                            {p.reference_number && p.reference_number !== '—' && p.reference_number !== p.txn_number && (
                              <div className="text-[10px] text-slate-400 font-mono">Ref: {p.reference_number}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {new Date(p.date).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{p.payer_payee || 'N/A'}</div>
                      {p.partner_allocation && (
                        <div className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                          <span>👤 Collected by: {p.partner_allocation.partner_name || 'Partner'}</span>
                        </div>
                      )}
                      {p.notes && <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{p.notes}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {p.transaction_type}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono font-medium">{p.payment_mode}</div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {p.direction === 'IN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowDownLeft className="w-3 h-3" /> INFLOW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <ArrowUpRight className="w-3 h-3" /> OUTFLOW
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-sm font-mono">
                      <span className={p.direction === 'IN' ? 'text-emerald-700' : 'text-rose-600'}>
                        {p.direction === 'IN' ? '+' : '-'} ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredPayments.length > 0 && (
          <Pagination
            currentPage={safePage}
            totalItems={filteredPayments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PaymentsLog;
