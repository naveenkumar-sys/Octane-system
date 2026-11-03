import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  User,
  Plus,
  Trash2,
  Printer,
  Save,
  ArrowLeft,
  Calendar,
  Clock,
  Building,
  CreditCard,
  Phone,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Percent,
  Package,
  Lock,
  Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../services/api';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { A4QuotationPrintModal } from '../../components/quotation/A4QuotationPrint';
import { downloadQuotationPdf } from '../../utils/quotationPdfExporter';

const DEFAULT_TERMS = `• Taxes extra as applicable at the time of billing
• Delivery: 1 week
• Validity: 7 days
• Payment: 15 days
• Order: Purchase Order should be in the name of Octane Systems`;

export const QuotationForm = ({ quotationId = null, onNavigateToList, onSaved }) => {
  const { businessProfile } = useBusinessProfile();

  // Loading & Master States
  const [loading, setLoading] = useState(false);
  const [fetchingMasters, setFetchingMasters] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Print Preview Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewQuotationData, setPreviewQuotationData] = useState(null);

  // Direct PDF Export State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Form State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState(7);
  const [status, setStatus] = useState('DRAFT');

  // Selected Customer / Buyer Info
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCity, setBuyerCity] = useState('Bengaluru');
  const [buyerState, setBuyerState] = useState('Karnataka');
  const [buyerPincode, setBuyerPincode] = useState('560100');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');

  // Line Items
  const [items, setItems] = useState([
    {
      sn: 1,
      part_number: '',
      description: '',
      unit_price: '',
      quantity: 1,
      gst_rate: 18,
    },
  ]);

  // Terms & Bank Details
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [bankName, setBankName] = useState('HDFC BANK');
  const [accountNumber, setAccountNumber] = useState('50100856647820');
  const [branchIfsc, setBranchIfsc] = useState('KORAMANGALA & HDFC0000053');
  const [accountHolder, setAccountHolder] = useState('Sanjay');

  // Contact info
  const [contactPerson, setContactPerson] = useState('JAGADEESH S');
  const [contactPhone, setContactPhone] = useState('+91 95007 10234');
  const [contactEmail, setContactEmail] = useState('support@octanesystems.in');
  const [notes, setNotes] = useState('');

  // 1. Fetch Masters & Quotation data if editing
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setFetchingMasters(true);
        const [custRes, prodRes] = await Promise.all([
          api.getCustomers().catch(() => []),
          api.getProducts().catch(() => []),
        ]);

        const custList = Array.isArray(custRes) ? custRes : (custRes?.results || []);
        const prodList = Array.isArray(prodRes) ? prodRes : (prodRes?.results || []);
        setCustomers(custList);
        setProducts(prodList);

        if (quotationId) {
          // Editing existing quote
          const quote = await api.getQuotation(quotationId);
          setQuotationNumber(quote.quotation_number || '');
          setQuotationDate(quote.quotation_date || new Date().toISOString().split('T')[0]);
          setValidityDays(quote.validity_days || 7);
          setStatus(quote.status || 'DRAFT');

          if (quote.customer) setSelectedCustomerId(String(quote.customer));
          setBuyerName(quote.buyer_name || '');
          setBuyerAddress(quote.buyer_address || '');
          setBuyerCity(quote.buyer_city || 'Bengaluru');
          setBuyerState(quote.buyer_state || 'Karnataka');
          setBuyerPincode(quote.buyer_pincode || '');
          setBuyerPhone(quote.buyer_phone || '');
          setBuyerEmail(quote.buyer_email || '');
          setBuyerGstin(quote.buyer_gstin || '');

          if (Array.isArray(quote.items) && quote.items.length > 0) {
            setItems(quote.items);
          }

          if (quote.terms_and_conditions) setTerms(quote.terms_and_conditions);
          if (quote.bank_name) setBankName(quote.bank_name);
          if (quote.account_number) setAccountNumber(quote.account_number);
          if (quote.branch_ifsc) setBranchIfsc(quote.branch_ifsc);
          if (quote.account_holder) setAccountHolder(quote.account_holder);
          if (quote.contact_person) setContactPerson(quote.contact_person);
          if (quote.contact_phone) setContactPhone(quote.contact_phone);
          if (quote.contact_email) setContactEmail(quote.contact_email);
          if (quote.notes) setNotes(quote.notes);
        } else {
          // New quotation: fetch next quotation number
          try {
            const nextRes = await api.getNextQuotationNumber();
            if (nextRes?.next_quotation_number) {
              setQuotationNumber(nextRes.next_quotation_number);
            }
          } catch {
            setQuotationNumber('OCT0001');
          }
        }
      } catch (err) {
        console.error('Failed loading initial quotation data:', err);
        toast.error('Failed to load initial quotation data.');
      } finally {
        setFetchingMasters(false);
      }
    };

    loadInitialData();
  }, [quotationId]);

  // Handle Customer Selection
  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;

    const cust = customers.find((c) => String(c.id) === String(customerId));
    if (cust) {
      setBuyerName(cust.name || '');
      const addr = [cust.billing_address_line1, cust.billing_address_line2].filter(Boolean).join(', ');
      setBuyerAddress(addr || cust.shipping_address || '');
      setBuyerCity(cust.city || 'Bengaluru');
      setBuyerState(cust.state_name || 'Karnataka');
      setBuyerPincode(cust.pincode || '');
      setBuyerPhone(cust.mobile || '');
      setBuyerEmail(cust.email || '');
      setBuyerGstin(cust.gstin || '');
      toast.info(`Auto-filled details for "${cust.name}"`);
    }
  };

  // Add Item Row
  const handleAddItem = (product = null) => {
    if (product) {
      const partNo = product.sku || product.model_number || `PRD-${product.id}`;
      const desc = product.name + (product.specifications ? ` (${product.specifications})` : '');
      const price = parseFloat(product.selling_price || product.unit_price || 0);
      const gst = parseFloat(product.gst_rate ?? 18);

      const newItem = {
        sn: items.length + 1,
        part_number: partNo,
        description: desc,
        unit_price: price,
        quantity: 1,
        gst_rate: gst,
        product_id: product.id,
      };

      // If the first row is completely empty, replace it with the selected product
      if (
        items.length === 1 &&
        !items[0].description.trim() &&
        !items[0].part_number.trim() &&
        (!items[0].unit_price || items[0].unit_price === '0' || items[0].unit_price === 0)
      ) {
        setItems([{ ...newItem, sn: 1 }]);
      } else {
        setItems([...items, newItem]);
      }
      toast.success(`Added "${product.name}" to quotation`);
    } else {
      setItems([
        ...items,
        {
          sn: items.length + 1,
          part_number: '',
          description: '',
          unit_price: '',
          quantity: 1,
          gst_rate: 18,
        },
      ]);
    }
  };

  // Update Item Field
  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      // Keep at least one empty row
      setItems([
        {
          sn: 1,
          part_number: '',
          description: '',
          unit_price: '',
          quantity: 1,
          gst_rate: 18,
        },
      ]);
      return;
    }
    const filtered = items.filter((_, i) => i !== index).map((row, idx) => ({ ...row, sn: idx + 1 }));
    setItems(filtered);
  };

  // Live Calculations
  const calculatedItems = useMemo(() => {
    return items.map((row, idx) => {
      const unitPriceNum = parseFloat(row.unit_price) || 0;
      const qtyNum = parseFloat(row.quantity) || 0;
      const taxable = unitPriceNum * qtyNum;
      const gstRateNum = parseFloat(row.gst_rate) || 0;
      const gstAmount = taxable * (gstRateNum / 100);
      const total = taxable + gstAmount;

      return {
        ...row,
        sn: idx + 1,
        unit_price: row.unit_price, // Preserves '' if empty
        unit_price_num: unitPriceNum,
        quantity: row.quantity,
        quantity_num: qtyNum,
        total_value: taxable,
        gst_rate: row.gst_rate ?? 18,
        gst_amount: gstAmount,
        total: total,
      };
    });
  }, [items]);

  const summary = useMemo(() => {
    const taxableTotal = calculatedItems.reduce((acc, row) => acc + (row.total_value || 0), 0);
    const taxTotal = calculatedItems.reduce((acc, row) => acc + (row.gst_amount || 0), 0);
    const grand = taxableTotal + taxTotal;
    const totalQty = calculatedItems.reduce((acc, row) => acc + (row.quantity || 0), 0);

    return {
      taxableAmount: taxableTotal,
      cgstAmount: taxTotal / 2,
      sgstAmount: taxTotal / 2,
      igstAmount: 0,
      totalTax: taxTotal,
      grandTotal: grand,
      totalQty,
    };
  }, [calculatedItems]);

  // Construct Payload
  const getPayload = () => {
    return {
      quotation_number: quotationNumber.trim() || undefined,
      quotation_date: quotationDate,
      validity_days: parseInt(validityDays, 10) || 7,
      status: status,
      customer: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
      buyer_name: buyerName.trim(),
      buyer_address: buyerAddress.trim(),
      buyer_city: buyerCity.trim(),
      buyer_state: buyerState.trim(),
      buyer_pincode: buyerPincode.trim(),
      buyer_phone: buyerPhone.trim(),
      buyer_email: buyerEmail.trim(),
      buyer_gstin: buyerGstin.trim(),
      items: calculatedItems.map((it) => ({
        ...it,
        unit_price: parseFloat(it.unit_price) || 0,
        quantity: parseFloat(it.quantity) || 1,
      })),
      taxable_amount: summary.taxableAmount.toFixed(2),
      cgst_amount: summary.cgstAmount.toFixed(2),
      sgst_amount: summary.sgstAmount.toFixed(2),
      igst_amount: summary.igstAmount.toFixed(2),
      total_tax: summary.totalTax.toFixed(2),
      grand_total: summary.grandTotal.toFixed(2),
      terms_and_conditions: terms,
      bank_name: bankName,
      account_number: accountNumber,
      branch_ifsc: branchIfsc,
      account_holder: accountHolder,
      contact_person: contactPerson,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      notes: notes,
    };
  };

  // Save Handler
  const handleSave = async (actionType = false) => {
    if (!buyerName.trim()) {
      toast.error('Buyer Name or Company is required.');
      return null;
    }

    const validItems = calculatedItems.filter((i) => i.description.trim() || i.part_number.trim());
    if (validItems.length === 0) {
      toast.error('Please add at least one line item with description.');
      return null;
    }

    try {
      setLoading(true);
      if (actionType === 'pdf') setIsGeneratingPdf(true);
      const payload = getPayload();
      let result;

      if (quotationId) {
        result = await api.updateQuotation(quotationId, payload);
        toast.success(`Quotation #${result.quotation_number} updated successfully!`);
      } else {
        result = await api.createQuotation(payload);
        toast.success(`Quotation #${result.quotation_number} created successfully!`);
      }

      if (actionType === 'pdf') {
        const fileName = await downloadQuotationPdf(result, businessProfile);
        toast.success(`Quotation PDF saved to your system: ${fileName}`);
        setIsGeneratingPdf(false);
        if (onSaved) {
          onSaved(result);
        } else if (onNavigateToList) {
          onNavigateToList();
        }
      } else if (actionType === true) {
        setPreviewQuotationData(result);
        setPrintModalOpen(true);
      } else if (onSaved) {
        onSaved(result);
      } else if (onNavigateToList) {
        onNavigateToList();
      }

      return result;
    } catch (err) {
      console.error('Failed to save quotation:', err);
      toast.error(err.message || 'Failed to save quotation.');
      return null;
    } finally {
      setLoading(false);
      setIsGeneratingPdf(false);
    }
  };

  // Preview without saving
  const handleInstantPreview = () => {
    if (!buyerName.trim()) {
      toast.error('Please enter Buyer Name to preview.');
      return;
    }
    const currentData = {
      ...getPayload(),
      quotation_number: quotationNumber || 'OCT-PREVIEW',
    };
    setPreviewQuotationData(currentData);
    setPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Toolbar (White Card matching Octane Systems theme) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          {onNavigateToList && (
            <button
              onClick={onNavigateToList}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Back to Quotations List"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide">
              <FileText className="text-orange-600" size={22} />
              {quotationId ? 'Edit Quotation' : 'Quotation Preparation'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Prepare professional price proposals using official Octane Systems branding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleInstantPreview}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            <Eye size={15} />
            <span>Preview A4</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave(false)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save size={15} />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('pdf')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0C4A8A] hover:bg-[#0a3d72] text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            title="Save quotation and download PDF immediately"
          >
            {isGeneratingPdf ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <Download size={15} />
            )}
            <span>{isGeneratingPdf ? 'Saving PDF...' : 'Save as PDF'}</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer size={15} />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {/* 2. Top Settings & Buyer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Quote Meta Card */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock size={16} className="text-orange-600" /> Quotation Meta
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Quote Number</label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                placeholder="OCT0001"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Quote Date</label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none cursor-pointer"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent to Client</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Buyer Details Card */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-orange-600" /> Buyer / Customer Details
            </h2>

            {/* Quick Customer Picker */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-orange-600 font-bold focus:border-orange-500 focus:outline-none max-w-[220px] cursor-pointer"
              >
                <option value="">Select Existing Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </select>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className="text-xs font-semibold text-slate-500 hover:text-orange-600 underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">
                Buyer Name / Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="e.g. Velapkam Tech Park"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">GSTIN</label>
              <input
                type="text"
                value={buyerGstin}
                onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                placeholder="29AAAAA0000A1Z5"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono uppercase focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">Address</label>
              <input
                type="text"
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                placeholder="e.g. Electronic city, Hosur road"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">City</label>
              <input
                type="text"
                value={buyerCity}
                onChange={(e) => setBuyerCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">State</label>
              <input
                type="text"
                value={buyerState}
                onChange={(e) => setBuyerState(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Pincode</label>
              <input
                type="text"
                value={buyerPincode}
                onChange={(e) => setBuyerPincode(e.target.value)}
                placeholder="560100"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Contact Phone</label>
              <input
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+91..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Line Items Table (White card with clean light theme styling) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Package size={16} className="text-orange-600" /> Quotation Line Items
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Columns strictly match the 8-column layout of the official Quotation sheet
            </p>
          </div>

          {/* Quick Product Add Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              onChange={(e) => {
                const prod = products.find((p) => String(p.id) === e.target.value);
                if (prod) handleAddItem(prod);
                e.target.value = '';
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-orange-600 font-bold focus:border-orange-500 focus:outline-none cursor-pointer"
            >
              <option value="">+ Add from Catalog...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `[${p.sku}]` : ''} - ₹{p.selling_price || 0}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleAddItem()}
              className="flex items-center gap-1 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-xl border border-orange-200 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Blank Row</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-2 text-center w-10">SN#</th>
                <th className="py-2.5 px-3 w-40">Part Number</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right w-28">Unit Price (₹)</th>
                <th className="py-2.5 px-2 text-center w-20">Qty</th>
                <th className="py-2.5 px-3 text-right w-28">Total Value</th>
                <th className="py-2.5 px-2 text-center w-24">GST %</th>
                <th className="py-2.5 px-3 text-right w-32">Total (₹)</th>
                <th className="py-2.5 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/70 transition-colors text-slate-900">
                  <td className="py-2 px-2 text-center font-bold text-slate-500">
                    {item.sn}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={item.part_number || ''}
                      onChange={(e) => handleUpdateItem(index, 'part_number', e.target.value)}
                      placeholder="SKU / Code"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 font-mono font-semibold focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                      placeholder="Item name & specifications"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price ?? ''}
                      onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 font-mono text-right focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 font-bold text-center focus:border-orange-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                    ₹{item.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={item.gst_rate}
                      onChange={(e) => handleUpdateItem(index, 'gst_rate', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 text-center font-bold focus:border-orange-500 focus:outline-none cursor-pointer"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-orange-600">
                    ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove Row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Summary */}
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-200 text-slate-900">
                <td colSpan={3} className="py-3 px-4 text-right uppercase text-slate-600 text-xs">
                  Summary Totals:
                </td>
                <td colSpan={3} className="py-3 px-3 text-right font-mono text-slate-800">
                  Taxable: ₹{summary.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-2 text-center font-mono text-slate-700 text-xs">
                  GST: ₹{summary.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-base font-black text-emerald-600">
                  ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Terms, Bank Details & Footer Information (White Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Terms & Conditions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <CheckCircle2 size={15} className="text-orange-600" /> Terms & Conditions
          </h2>
          <textarea
            rows="5"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 leading-relaxed focus:border-orange-500 focus:bg-white focus:outline-none"
            placeholder="Enter quote terms..."
          />
        </div>

        {/* Bank Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building size={15} className="text-orange-600" /> Company Bank Details
          </h2>
          <div className="space-y-2">
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Branch / IFSC</label>
              <input
                type="text"
                value={branchIfsc}
                onChange={(e) => setBranchIfsc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Account Holder Name</label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact & Signatory Notes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <Mail size={15} className="text-orange-600" /> Signatory & Contact Info
          </h2>
          <div className="space-y-2">
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-0.5">Internal Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal memo..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Modal Component */}
      <A4QuotationPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        quotation={previewQuotationData}
      />
    </div>
  );
};

export default QuotationForm;
