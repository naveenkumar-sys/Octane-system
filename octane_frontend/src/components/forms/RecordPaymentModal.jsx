import React, { useState, useEffect, useMemo } from 'react';
import FormModal from '../ui/FormModal';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { CreditCard, AlertCircle, Plus, Trash2, CheckCircle2, User, Wallet } from 'lucide-react';

export const RecordPaymentModal = ({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}) => {
  const [partners, setPartners] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const maxAmount = useMemo(() => {
    if (!invoice) return 0;
    return parseFloat(invoice.balance_due_amount !== undefined ? invoice.balance_due_amount : invoice.balance_due || 0);
  }, [invoice]);

  useEffect(() => {
    if (isOpen) {
      fetchPartners();
    }
  }, [isOpen]);

  useEffect(() => {
    if (invoice && isOpen) {
      setPayments([
        {
          id: Date.now(),
          payer: 'BUSINESS',
          payment_mode: 'CASH',
          amount: maxAmount > 0 ? maxAmount.toFixed(2) : '',
          reference_number: '',
        }
      ]);
      setNotes(`Payment for Invoice #${invoice.invoice_number}`);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [invoice, isOpen, maxAmount]);

  const fetchPartners = async () => {
    try {
      const res = await api.getPartners();
      const list = Array.isArray(res) ? res : res.results || [];
      setPartners(list);
    } catch (e) {
      console.error('Error fetching partners for payment allocation:', e);
    }
  };

  if (!invoice) return null;

  // Live total of currently entered split payment rows
  const totalRecordingAmount = useMemo(() => {
    return payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  }, [payments]);

  // Payment Row Handlers
  const handleAddPaymentRow = () => {
    const currentSum = totalRecordingAmount;
    const rem = Math.max(0, maxAmount - currentSum);
    setPayments((prev) => [
      ...prev,
      {
        id: Date.now(),
        payer: 'BUSINESS',
        payment_mode: 'CASH',
        amount: rem > 0 ? rem.toFixed(2) : '',
        reference_number: '',
      }
    ]);
  };

  const handleRemovePaymentRow = (index) => {
    if (payments.length === 1) {
      toast.warning('At least one payment line is required.');
      return;
    }
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index, field, val) => {
    const updated = [...payments];
    updated[index] = {
      ...updated[index],
      [field]: val,
    };
    setPayments(updated);
  };

  // Quick Pay Actions
  const handleQuickPay = (mode) => {
    if (maxAmount <= 0) return;
    setPayments([
      {
        id: Date.now(),
        payer: 'BUSINESS',
        payment_mode: mode,
        amount: maxAmount.toFixed(2),
        reference_number: '',
      }
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validPayments = payments.filter((p) => (parseFloat(p.amount) || 0) > 0);

    if (validPayments.length === 0) {
      setError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (totalRecordingAmount > maxAmount + 0.01) {
      setError(`Total recorded payment (₹${totalRecordingAmount.toFixed(2)}) cannot exceed remaining balance due (₹${maxAmount.toFixed(2)}).`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        payments: validPayments.map((p) => ({
          payer: p.payer,
          payment_mode: p.payment_mode,
          amount: parseFloat(p.amount) || 0,
          reference_number: (p.reference_number || '').trim(),
          partner_allocation_json: p.payer !== 'BUSINESS' ? {
            partner_id: parseInt(p.payer, 10),
            partner_name: partners.find((pt) => String(pt.id) === String(p.payer))?.name || 'Partner',
            amount: parseFloat(p.amount) || 0,
            mode: p.payment_mode,
          } : null,
        })),
        payment_date: paymentDate,
        notes: notes.trim(),
      };

      const result = await api.recordInvoicePayment(invoice.id, payload);
      toast.success(`Recorded ₹${totalRecordingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} payment for Invoice #${invoice.invoice_number}!`);

      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment.');
      toast.error(err.message || 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Payment for Invoice #${invoice.invoice_number}`}
      subtitle={`Customer: ${invoice.buyer_name || invoice.customer_name || invoice.customer || 'Cash Customer'} • Balance Due: ₹${maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
      submitLabel={`Record Payment (₹${totalRecordingAmount.toFixed(2)})`}
      onSubmit={handleSubmit}
      loading={loading}
    >
      <div className="space-y-4">
        {/* Outstanding Balance & Live Calculator Banner */}
        <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-1.5">
          <div className="flex items-center justify-between text-amber-900 font-extrabold">
            <span>Invoice Total: ₹{parseFloat(invoice.grand_total ?? invoice.total_amount ?? invoice.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-emerald-700">Previously Paid: ₹{parseFloat(invoice.total_paid_amount ?? invoice.paid_amount ?? invoice.total_paid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between font-extrabold pt-1 border-t border-amber-200/80">
            <span className="text-slate-800">Outstanding Balance Due:</span>
            <span className="text-rose-600 font-mono text-sm">₹{maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between font-extrabold text-xs pt-1 border-t border-amber-200/60">
            <span className="text-slate-700">Currently Entering Payment:</span>
            <span className={`font-mono text-xs ${
              Math.abs(totalRecordingAmount - maxAmount) < 0.01 ? 'text-emerald-700' :
              totalRecordingAmount > maxAmount ? 'text-rose-700' : 'text-amber-700'
            }`}>
              ₹{totalRecordingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              {totalRecordingAmount > maxAmount && ' (Exceeds Due!)'}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Fill Actions & Add Split Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Quick Pay:</span>
            <button
              type="button"
              onClick={() => handleQuickPay('CASH')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition-colors cursor-pointer"
            >
              Full Cash
            </button>
            <button
              type="button"
              onClick={() => handleQuickPay('UPI')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition-colors cursor-pointer"
            >
              Full UPI
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddPaymentRow}
            className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold rounded-lg border border-orange-200 text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Add Split Payment</span>
          </button>
        </div>

        {/* Split Payment Rows */}
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
            Payment Lines ({payments.length})
          </div>

          {payments.map((p, pidx) => (
            <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                {/* Partner / Recipient Selection */}
                <div className="sm:col-span-5 space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-600 block">Received By (Account / Partner)</label>
                  <select
                    value={p.payer}
                    onChange={(e) => handlePaymentChange(pidx, 'payer', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="BUSINESS">Business (Store Account)</option>
                    {partners.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        Partner: {pt.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Mode */}
                <div className="sm:col-span-4 space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-600 block">Payment Mode</label>
                  <select
                    value={p.payment_mode}
                    onChange={(e) => handlePaymentChange(pidx, 'payment_mode', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {/* Amount */}
                <div className="sm:col-span-3 space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-600 block">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxAmount}
                    value={p.amount}
                    onChange={(e) => handlePaymentChange(pidx, 'amount', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-extrabold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Reference Number & Delete Row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                <input
                  type="text"
                  placeholder="Txn Ref / Cheque No / Notes for this line (optional)"
                  value={p.reference_number}
                  onChange={(e) => handlePaymentChange(pidx, 'reference_number', e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 focus:outline-none"
                />

                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePaymentRow(pidx)}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove split line"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Global Details: Date & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">General Notes / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Payment received against invoice"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>
      </div>
    </FormModal>
  );
};

export default RecordPaymentModal;
