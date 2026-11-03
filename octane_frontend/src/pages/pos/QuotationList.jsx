import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  Printer,
  Edit2,
  Trash2,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCheck,
  User,
  Filter,
  DollarSign,
  Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../services/api';
import { A4QuotationPrintModal, A4QuotationSheet, formatDateDMY, formatINR } from '../../components/quotation/A4QuotationPrint';
import { downloadQuotationPdf } from '../../utils/quotationPdfExporter';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';

export const QuotationList = ({ onNewQuotation, onEditQuotation, onConvertToInvoice }) => {
  const { businessProfile } = useBusinessProfile();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Print Preview Modal State
  const [selectedQuoteForPrint, setSelectedQuoteForPrint] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Direct PDF Download State
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Delete Dialog State
  const [quoteToDelete, setQuoteToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Quotations
  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getQuotations();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setQuotations(list);
    } catch (err) {
      console.error('Failed to load quotations:', err);
      setError(err.message || 'Failed to load quotations list.');
      toast.error('Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Filtered List
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        (q.quotation_number && q.quotation_number.toLowerCase().includes(search)) ||
        (q.buyer_name && q.buyer_name.toLowerCase().includes(search)) ||
        (q.buyer_phone && q.buyer_phone.toLowerCase().includes(search)) ||
        (q.buyer_email && q.buyer_email.toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    });
  }, [quotations, statusFilter, searchTerm]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCount = quotations.length;
    const totalAmount = quotations.reduce((acc, q) => acc + (parseFloat(q.grand_total) || 0), 0);
    const draftCount = quotations.filter((q) => q.status === 'DRAFT').length;
    const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length;

    return { totalCount, totalAmount, draftCount, acceptedCount };
  }, [quotations]);

  // Print Action
  const handleOpenPrint = (quote) => {
    setSelectedQuoteForPrint(quote);
    setPrintModalOpen(true);
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteQuotation(quoteToDelete.id);
      toast.success(`Quotation #${quoteToDelete.quotation_number} deleted successfully.`);
      setQuotations((prev) => prev.filter((q) => q.id !== quoteToDelete.id));
      setQuoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete quotation:', err);
      toast.error(err.message || 'Failed to delete quotation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Direct Save as PDF — generates crisp vector PDF and downloads directly to local system
  const handleDirectPdf = async (quote) => {
    if (downloadingPdfId) return;
    try {
      setDownloadingPdfId(quote.id);
      const fileName = await downloadQuotationPdf(quote, businessProfile);
      toast.success(`PDF saved to your computer: ${fileName}`);
    } catch (err) {
      console.error('Direct PDF export error:', err);
      toast.error('Failed to generate PDF. Please try Print -> Save as PDF.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Helper badge color
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">Accepted</span>;
      case 'CONVERTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-200">Converted to Sale</span>;
      case 'SENT':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">Sent</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">Expired</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200">Draft</span>;
    }
  };

  if (loading && quotations.length === 0) {
    return <LoadingState message="Loading quotations directory..." />;
  }

  if (error && quotations.length === 0) {
    return <ErrorState message={error} onRetry={fetchQuotations} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Actions Bar (White Card) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-50 text-orange-600 border border-orange-200 rounded-2xl">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide">
              Quotations Directory
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate, print, and track client quotations with zero inventory impact
            </p>
          </div>
        </div>

        <button
          onClick={onNewQuotation}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>New Quotation</span>
        </button>
      </div>

      {/* 2. Key Metrics Bar (White Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Quotes</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalCount}</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Proposed Value</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">₹{formatINR(stats.totalAmount)}</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accepted / Converted</div>
          <div className="text-2xl font-black text-purple-600 mt-1">{stats.acceptedCount}</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Draft Proposals</div>
          <div className="text-2xl font-black text-orange-600 mt-1">{stats.draftCount}</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar (White Card) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote#, buyer, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter size={14} className="text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CONVERTED">Converted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* 4. Quotations Table (White Card) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4">Quote Number</th>
                <th className="py-3 px-4">Date & Validity</th>
                <th className="py-3 px-4">Buyer / Client</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm text-slate-700">No quotations found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || statusFilter !== 'ALL'
                        ? 'Try clearing search filters to see all records'
                        : 'Click "+ New Quotation" to prepare your first quote'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quote) => {
                  const itemCount = Array.isArray(quote.items) ? quote.items.length : 0;
                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-slate-50/70 transition-colors group text-slate-800"
                    >
                      {/* Quote Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <button
                          onClick={() => handleOpenPrint(quote)}
                          className="hover:text-orange-600 hover:underline cursor-pointer flex items-center gap-1.5"
                          title="Click to Print / Preview"
                        >
                          <FileText size={14} className="text-orange-600 shrink-0" />
                          <span>{quote.quotation_number}</span>
                        </button>
                      </td>

                      {/* Date & Validity */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-900">{formatDateDMY(quote.quotation_date)}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> Valid {quote.validity_days || 7} days
                        </div>
                      </td>

                      {/* Buyer */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-[12.5px]">{quote.buyer_name}</div>
                        <div className="text-[10.5px] text-slate-500 truncate max-w-xs">
                          {quote.buyer_city ? `${quote.buyer_city}, ` : ''}{quote.buyer_phone || quote.buyer_email || '—'}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                          {itemCount}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                        ₹{formatINR(quote.grand_total)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {getStatusBadge(quote.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print / Preview */}
                          <button
                            onClick={() => handleOpenPrint(quote)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print / Preview Quotation"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Save as PDF */}
                          <button
                            onClick={() => handleDirectPdf(quote)}
                            disabled={downloadingPdfId === quote.id}
                            className="p-1.5 text-slate-500 hover:text-[#0C4A8A] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save as PDF"
                          >
                            {downloadingPdfId === quote.id ? (
                              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            ) : (
                              <Download size={15} />
                            )}
                          </button>

                          {/* Edit */}
                          {onEditQuotation && (
                            <button
                              onClick={() => onEditQuotation(quote.id)}
                              className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Quotation"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Convert to Sale / Invoice */}
                          {onConvertToInvoice && (
                            <button
                              onClick={() => onConvertToInvoice(quote)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Convert to POS Sale"
                            >
                              <ArrowRight size={15} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => setQuoteToDelete(quote)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Print Preview Modal */}
      <A4QuotationPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        quotation={selectedQuoteForPrint}
      />

      {/* 6. Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(quoteToDelete)}
        title="Delete Quotation?"
        message={`Are you sure you want to delete Quotation #${quoteToDelete?.quotation_number} for "${quoteToDelete?.buyer_name}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        isDanger={true}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setQuoteToDelete(null)}
      />
    </div>
  );
};

export default QuotationList;
