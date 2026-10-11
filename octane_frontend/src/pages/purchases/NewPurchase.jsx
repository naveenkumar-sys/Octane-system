import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, Info, CheckCircle2, AlertCircle, Lock, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import StatusBadge from '../../components/ui/StatusBadge';
import SupplierFormModal from '../../components/forms/SupplierFormModal';
import ProductFormModal from '../../components/forms/ProductFormModal';
import CategoryFormModal from '../../components/forms/CategoryFormModal';
import BrandFormModal from '../../components/forms/BrandFormModal';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';

export const NewPurchase = () => {
  const { isAdmin } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [partners, setPartners] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A4 Invoice Print Modal State
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // Quick Create Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [activeLineForProductCreate, setActiveLineForProductCreate] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeLineForCategoryCreate, setActiveLineForCategoryCreate] = useState(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [activeLineForBrandCreate, setActiveLineForBrandCreate] = useState(null);

  // Supplier Previous Invoices Lookup
  const [supplierPreviousPurchases, setSupplierPreviousPurchases] = useState([]);

  // Form Header State
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Payment Breakdown State (Allows 0, 1 or multiple actual payment rows)
  const [payments, setPayments] = useState([]);

  const addPaymentRow = () => {
    setPayments([
      ...payments,
      {
        payer: 'BUSINESS', // 'BUSINESS' or partner ID string
        payment_mode: 'CASH', // 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'
        amount: '0.00',
        reference_number: '',
        notes: '',
      },
    ]);
  };

  const removePaymentRow = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePaymentRow = (index, field, value) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  useEffect(() => {
    if (supplierId) {
      api.getPurchases(`?supplier=${supplierId}`)
        .then((res) => {
          const list = Array.isArray(res) ? res : res.results || [];
          setSupplierPreviousPurchases(list);
        })
        .catch(() => setSupplierPreviousPurchases([]));
    } else {
      setSupplierPreviousPurchases([]);
    }
  }, [supplierId]);

  const lastPurchaseWithInv = supplierPreviousPurchases.find(
    (p) => p.supplier_invoice_number && p.supplier_invoice_number.trim().length > 0
  );

  const isDuplicateInvoice = Boolean(
    supplierInvoiceNumber.trim() &&
    supplierPreviousPurchases.some(
      (p) => (p.supplier_invoice_number || '').trim().toLowerCase() === supplierInvoiceNumber.trim().toLowerCase()
    )
  );

  // Line Items State
  const [items, setItems] = useState([
    {
      category_id: '',
      brand: '',
      product_id: '',
      product_name: '',
      sku: '',
      tracking_type: 'QUANTITY',
      hsn_sac: '852411',
      unit: 'NOS',
      quantity: 1,
      unit_cost: '0.00',
      gst_rate: '18.00',
      serials: [''], // Array of serial strings matching quantity count
    },
  ]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, prodRes, partRes, catRes, brandRes] = await Promise.all([
        api.getSuppliers(),
        api.getProducts(),
        api.getPartners(),
        api.getProductCategories(),
        api.getBrands(),
      ]);
      setSuppliers(Array.isArray(supRes) ? supRes : supRes.results || []);
      setProducts(Array.isArray(prodRes) ? prodRes : prodRes.results || []);
      setPartners(Array.isArray(partRes) ? partRes : partRes.results || []);
      setCategories(Array.isArray(catRes) ? catRes : catRes.results || []);
      setBrands(Array.isArray(brandRes) ? brandRes : brandRes.results || []);
    } catch (err) {
      console.error('Error fetching purchase prerequisites:', err);
      setError(err.message || 'Failed to load suppliers and products.');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableBrands = (categoryId) => {
    const brandSet = new Set();
    // 1. From database brands
    brands.forEach((b) => {
      if (b.is_active !== false) {
        if (!categoryId || !b.category || String(b.category) === String(categoryId)) {
          if (b.name && typeof b.name === 'string' && b.name.trim()) {
            brandSet.add(b.name.trim());
          }
        }
      }
    });
    // 2. From existing products (fallback in case any products have brand text)
    products.forEach((p) => {
      if (!categoryId || String(p.category) === String(categoryId)) {
        if (p.brand && typeof p.brand === 'string' && p.brand.trim()) {
          brandSet.add(p.brand.trim());
        }
      }
    });
    return Array.from(brandSet).sort((a, b) => a.localeCompare(b));
  };

  const getFilteredProducts = (categoryId, brandName) => {
    return products.filter((p) => {
      const matchCategory = !categoryId || String(p.category) === String(categoryId);
      const matchBrand = !brandName || (p.brand && p.brand.trim().toLowerCase() === brandName.trim().toLowerCase());
      return matchCategory && matchBrand;
    });
  };

  const handleSupplierCreated = async (createdSupplier) => {
    try {
      const updated = await api.getSuppliers();
      const supList = Array.isArray(updated) ? updated : updated.results || [];
      setSuppliers(supList);
      if (createdSupplier && createdSupplier.id) {
        setSupplierId(String(createdSupplier.id));
      }
    } catch (err) {
      console.error('Error refreshing suppliers after quick create:', err);
    }
  };

  const handleOpenCategoryCreate = (lineIndex) => {
    setActiveLineForCategoryCreate(lineIndex);
    setIsCategoryModalOpen(true);
  };

  const handleCategoryCreated = async (createdCategory) => {
    try {
      const updated = await api.getProductCategories();
      const catList = Array.isArray(updated) ? updated : updated.results || [];
      setCategories(catList);

      if (createdCategory && createdCategory.id && activeLineForCategoryCreate !== null) {
        handleCategoryChange(activeLineForCategoryCreate, createdCategory.id);
      }
    } catch (err) {
      console.error('Error refreshing categories after quick create:', err);
    }
  };

  const handleCategoryChange = (index, categoryId) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      category_id: categoryId,
      brand: '',
      product_id: '',
      product_name: '',
      sku: '',
      tracking_type: 'QUANTITY',
      quantity: 1,
      serials: [''],
    };
    setItems(newItems);
  };

  const handleOpenBrandCreate = (lineIndex) => {
    setActiveLineForBrandCreate(lineIndex);
    setIsBrandModalOpen(true);
  };

  const handleBrandCreated = (createdBrand) => {
    if (createdBrand && createdBrand.name) {
      setBrands((prev) => [...prev.filter((b) => b.id !== createdBrand.id), createdBrand]);
      if (activeLineForBrandCreate !== null) {
        handleBrandChange(activeLineForBrandCreate, createdBrand.name);
      }
    }
  };

  const handleBrandChange = (index, brandName) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      brand: brandName,
      product_id: '',
      product_name: '',
      sku: '',
      tracking_type: 'QUANTITY',
      quantity: 1,
      serials: [''],
    };
    setItems(newItems);
  };

  const handleOpenProductCreate = (lineIndex) => {
    setActiveLineForProductCreate(lineIndex);
    setIsProductModalOpen(true);
  };

  const handleProductCreated = async (createdProduct) => {
    try {
      const updated = await api.getProducts();
      const prodList = Array.isArray(updated) ? updated : updated.results || [];
      setProducts(prodList);

      if (createdProduct && createdProduct.id && activeLineForProductCreate !== null) {
        handleProductSelect(activeLineForProductCreate, createdProduct.id, prodList);
      }
    } catch (err) {
      console.error('Error refreshing products after quick create:', err);
    }
  };

  const handleProductSelect = (index, productId, prodListSource = products) => {
    const selectedProd = prodListSource.find((p) => String(p.id) === String(productId));
    const newItems = [...items];

    if (selectedProd) {
      const currentQty = newItems[index].quantity || 1;
      newItems[index] = {
        ...newItems[index],
        category_id: newItems[index].category_id || (selectedProd.category ? String(selectedProd.category) : ''),
        brand: newItems[index].brand || (selectedProd.brand ? String(selectedProd.brand) : ''),
        product_id: selectedProd.id,
        product_name: selectedProd.name,
        sku: selectedProd.sku,
        specifications_text: selectedProd.specifications_text || '',
        tracking_type: selectedProd.tracking_type || 'QUANTITY',
        hsn_sac: selectedProd.hsn_sac || '852411',
        unit: selectedProd.unit || 'NOS',
        unit_cost: String(selectedProd.purchase_price ?? '0.00'),
        gst_rate: String(selectedProd.gst_rate ?? '18.00'),
        quantity: currentQty,
        serials: Array(currentQty).fill(''),
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
        sku: '',
        tracking_type: 'QUANTITY',
        quantity: 1,
        serials: [''],
      };
    }
    setItems(newItems);
  };

  const handleQuantityChange = (index, newQty) => {
    const qtyInt = Math.max(1, parseInt(newQty || '1', 10));
    const newItems = [...items];
    const currSerials = newItems[index].serials || [];
    
    // Adjust serials array length to match exact quantity
    let adjustedSerials = [...currSerials];
    if (adjustedSerials.length < qtyInt) {
      while (adjustedSerials.length < qtyInt) adjustedSerials.push('');
    } else if (adjustedSerials.length > qtyInt) {
      adjustedSerials = adjustedSerials.slice(0, qtyInt);
    }

    newItems[index] = {
      ...newItems[index],
      quantity: qtyInt,
      serials: adjustedSerials,
    };
    setItems(newItems);
  };

  const handleSerialChange = (itemIdx, serialIdx, value) => {
    const newItems = [...items];
    const updatedSerials = [...newItems[itemIdx].serials];
    updatedSerials[serialIdx] = value.toUpperCase().trim();
    newItems[itemIdx].serials = updatedSerials;
    setItems(newItems);
  };

  const addItemLine = () => {
    setItems([
      ...items,
      {
        category_id: '',
        brand: '',
        product_id: '',
        product_name: '',
        sku: '',
        tracking_type: 'QUANTITY',
        hsn_sac: '852411',
        unit: 'NOS',
        quantity: 1,
        unit_cost: '0.00',
        gst_rate: '18.00',
        serials: [''],
      },
    ]);
  };

  const removeItemLine = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Financial Summary Calculations
  const calculateSummary = () => {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const qty = parseFloat(item.quantity || 0);
      const cost = parseFloat(item.unit_cost || 0);
      const taxRate = parseFloat(item.gst_rate || 0);

      const lineSub = qty * cost;
      const lineTax = (lineSub * taxRate) / 100;

      subtotal += lineSub;
      totalTax += lineTax;
    });

    const grandTotal = subtotal + totalTax;

    // Total Paid = Sum of all actual payment row amounts
    const totalPaid = payments.reduce((acc, p) => {
      return acc + (parseFloat(p.amount || 0) || 0);
    }, 0);

    const balance = Math.max(0, grandTotal - totalPaid);

    let paymentStatus = 'UNPAID';
    if (totalPaid >= grandTotal && grandTotal > 0) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return { subtotal, totalTax, grandTotal, paid: totalPaid, balance, paymentStatus };
  };

  const summary = calculateSummary();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Form Validations
    if (!supplierId) {
      const err = 'Please select a Supplier for this purchase.';
      setFormError(err);
      toast.error(err);
      return;
    }

    if (items.some((i) => !i.product_id)) {
      const err = 'Please select a valid product for all line items.';
      setFormError(err);
      toast.error(err);
      return;
    }

    // Serial numbers validation
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.tracking_type === 'SERIAL_NUMBER') {
        const serials = item.serials || [];
        if (serials.length !== item.quantity) {
          const err = `Product "${item.product_name}" requires exactly ${item.quantity} serial numbers.`;
          setFormError(err);
          toast.error(err);
          return;
        }
        if (serials.some((s) => !s.trim())) {
          const err = `Please enter all ${item.quantity} serial numbers for product "${item.product_name}".`;
          setFormError(err);
          toast.error(err);
          return;
        }
        const uniqueSerials = new Set(serials);
        if (uniqueSerials.size !== serials.length) {
          const err = `Duplicate serial numbers found for product "${item.product_name}".`;
          setFormError(err);
          toast.error(err);
          return;
        }
      }
    }

    // Payment breakdown validations
    if (summary.paid > summary.grandTotal) {
      const err = `Total payment amount (₹${summary.paid.toFixed(2)}) cannot exceed Purchase Grand Total (₹${summary.grandTotal.toFixed(2)}).`;
      setFormError(err);
      toast.error(err);
      return;
    }

    setSubmitting(true);

    // Filter payment rows that have an actual paid amount > 0
    const activePaidRows = payments.filter((p) => (parseFloat(p.amount || 0) || 0) > 0);
    const partnerPayments = activePaidRows.filter((p) => p.payer !== 'BUSINESS');

    let payloadPaymentMode = 'CREDIT';
    let payloadPartnerId = null;
    let partnerSplitJson = null;

    if (summary.paid > 0) {
      if (partnerPayments.length > 0) {
        payloadPaymentMode = 'PARTNER_OUT_OF_POCKET';
        payloadPartnerId = parseInt(partnerPayments[0].payer, 10);
        if (partnerPayments.length > 1) {
          partnerSplitJson = {};
          partnerPayments.forEach((p) => {
            const pObj = partners.find((pt) => String(pt.id) === String(p.payer));
            const pName = pObj ? pObj.name : `Partner #${p.payer}`;
            const amt = parseFloat(p.amount || 0) || 0;
            partnerSplitJson[pName] = (partnerSplitJson[pName] || 0) + amt;
            partnerSplitJson[String(p.payer)] = (partnerSplitJson[String(p.payer)] || 0) + amt;
          });
        }
      } else if (activePaidRows.length > 0) {
        payloadPaymentMode = activePaidRows[0].payment_mode;
      } else if (payments.length > 0) {
        payloadPaymentMode = payments[0].payment_mode;
      }
    }

    // Build breakdown note summary if payments were made
    let combinedNotes = notes.trim();
    if (activePaidRows.length > 0) {
      const breakdownSummary = activePaidRows
        .map((p, idx) => {
          const payerName = p.payer === 'BUSINESS'
            ? 'Business'
            : (partners.find((pt) => String(pt.id) === String(p.payer))?.name || `Partner #${p.payer}`);
          const refStr = p.reference_number ? ` (Ref: ${p.reference_number})` : '';
          return `Payment #${idx + 1}: ${payerName} | ${p.payment_mode} | ₹${parseFloat(p.amount || 0).toLocaleString('en-IN')}${refStr}`;
        })
        .join(' ; ');

      combinedNotes = combinedNotes
        ? `${combinedNotes}\n\n[Payment Breakdown: ${breakdownSummary}]`
        : `[Payment Breakdown: ${breakdownSummary}]`;
    }

    const payload = {
      supplier_id: parseInt(supplierId, 10),
      supplier_invoice_number: supplierInvoiceNumber.trim(),
      purchase_date: purchaseDate,
      payment_mode: payloadPaymentMode,
      paid_by_partner_id: payloadPartnerId,
      partner_split_json: partnerSplitJson,
      paid_amount: summary.paid,
      notes: combinedNotes,
      items: items.map((item) => ({
        product_id: parseInt(item.product_id, 10),
        description: item.product_name,
        hsn_sac: item.hsn_sac,
        quantity: parseInt(item.quantity, 10),
        unit_cost: parseFloat(item.unit_cost || 0),
        gst_rate: parseFloat(item.gst_rate || 0),
        serial_numbers_text: item.tracking_type === 'SERIAL_NUMBER' ? item.serials.join(', ') : '',
      })),
    };

    try {
      const res = await api.createPurchase(payload);
      const selectedSup = suppliers.find((s) => String(s.id) === String(supplierId));
      const fullPrintObj = {
        ...res,
        is_purchase: true,
        supplier_name: selectedSup ? selectedSup.name : 'Supplier Vendor',
        supplier_address: selectedSup ? selectedSup.address : '',
        supplier_mobile: selectedSup ? selectedSup.mobile : '',
        supplier_gstin: selectedSup ? selectedSup.gstin : '',
      };
      
      setPrintInvoiceData(fullPrintObj);
      const msg = `Purchase ${res.purchase_number || 'order'} created successfully! Stock updated.`;
      setSuccessMessage(msg);
      toast.success(msg);
      
      // Reset form
      setSupplierId('');
      setSupplierInvoiceNumber('');
      setPayments([]);
      setNotes('');
      setItems([
        {
          category_id: '',
          brand: '',
          product_id: '',
          product_name: '',
          sku: '',
          tracking_type: 'QUANTITY',
          hsn_sac: '852411',
          unit: 'NOS',
          quantity: 1,
          unit_cost: '0.00',
          gst_rate: '18.00',
          serials: [''],
        },
      ]);
    } catch (err) {
      console.error('Failed to create purchase:', err);
      const errMsg = err.message || 'Failed to create purchase.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplierObj = suppliers.find((s) => String(s.id) === String(supplierId));

  if (loading) return <LoadingState message="Loading purchase environment & catalog..." />;
  if (error) return <ErrorState message={error} onRetry={fetchInitialData} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-orange-600" size={24} />
            <span>New Purchase Entry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive vendor stock, register serial numbers & record supplier invoice payables.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          {printInvoiceData && (
            <button
              type="button"
              onClick={() => setPrintInvoiceData(printInvoiceData)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all flex-shrink-0"
            >
              <Printer size={15} />
              <span>Print Purchase Invoice (A4)</span>
            </button>
          )}
        </div>
      )}

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-3 animate-in fade-in">
          <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Supplier & Purchase Header */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>1. Supplier & Invoice Details</span>
            <span className="text-xs text-slate-400 font-normal font-mono">System Reference & Vendor Invoice</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* OCTANE Internal Purchase Number (Auto Generated) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Purchase No.</span>
                <span className="text-[10px] text-orange-600 font-mono font-bold flex items-center gap-0.5">
                  <Lock size={10} /> Auto Generated
                </span>
              </label>
              <input
                type="text"
                readOnly
                value="PUR-2026-XXXXX"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-extrabold text-slate-600 cursor-not-allowed shadow-inner select-none uppercase"
                title="OCTANE Purchase Number is automatically generated by the backend upon saving"
              />
            </div>

            {/* Select Supplier */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Supplier *</label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(true)}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Create Supplier</span>
                  </button>
                )}
              </div>

              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              >
                <option value="">Select Vendor / Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.company_name ? `(${s.company_name})` : ''} — GSTIN: {s.gstin || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Invoice Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Supplier Invoice No.</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-9987"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl bg-slate-50 border text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 uppercase transition-colors ${
                  isDuplicateInvoice
                    ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500/30'
                    : 'border-slate-200 focus:ring-orange-500/30 focus:border-orange-500'
                }`}
              />

              {/* Real-time Duplicate Invoice Warning */}
              {isDuplicateInvoice && (
                <span className="text-[10px] font-bold text-rose-600 block animate-in fade-in">
                  ⚠️ Invoice "{supplierInvoiceNumber}" is already recorded for this supplier!
                </span>
              )}

              {/* Last Invoice Hint */}
              {!isDuplicateInvoice && lastPurchaseWithInv && (
                <span className="text-[10px] text-slate-500 block font-mono">
                  💡 Last Invoice: <strong className="text-slate-700">{lastPurchaseWithInv.supplier_invoice_number}</strong> ({lastPurchaseWithInv.purchase_date})
                </span>
              )}
            </div>

            {/* Purchase Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Purchase Date *</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>

          {selectedSupplierObj && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-600">
              <div>
                <span className="font-bold block text-slate-400 text-[10px] uppercase">Contact Person</span>
                <span className="font-semibold text-slate-900">{selectedSupplierObj.contact_person || 'N/A'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-400 text-[10px] uppercase">Mobile</span>
                <span className="font-semibold text-slate-900">{selectedSupplierObj.mobile || 'N/A'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-400 text-[10px] uppercase">GSTIN</span>
                <span className="font-mono font-semibold text-slate-900">{selectedSupplierObj.gstin || 'Unregistered'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-400 text-[10px] uppercase">State Code</span>
                <span className="font-mono font-semibold text-slate-900">{selectedSupplierObj.state_code || '29'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Line Items */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900">
              2. Purchase Line Items
            </h2>
            <button
              type="button"
              onClick={addItemLine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const lineSub = (parseFloat(item.quantity || 0) * parseFloat(item.unit_cost || 0));
              const lineTax = (lineSub * parseFloat(item.gst_rate || 0)) / 100;
              const lineTotal = lineSub + lineTax;

              const lineAvailableBrands = getAvailableBrands(item.category_id);
              const lineFilteredProducts = getFilteredProducts(item.category_id, item.brand);

              return (
                <div key={idx} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Item Line #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemLine(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove Line Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Flow Row: Category -> Brand -> Product */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pb-2 border-b border-slate-200/60">
                    {/* 1. Category Selection */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">1. Category</label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenCategoryCreate(idx)}
                            className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Create Category</span>
                          </button>
                        )}
                      </div>

                      <select
                        value={item.category_id || ''}
                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      >
                        <option value="">-- All Categories --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Brand Selection */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">2. Brand</label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenBrandCreate(idx)}
                            className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Create Brand</span>
                          </button>
                        )}
                      </div>

                      <select
                        value={item.brand || ''}
                        onChange={(e) => handleBrandChange(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      >
                        <option value="">-- All Brands --</option>
                        {lineAvailableBrands.map((bName) => (
                          <option key={bName} value={bName}>
                            {bName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Product Selection */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">3. Product (Master) *</label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenProductCreate(idx)}
                            className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Create Product</span>
                          </button>
                        )}
                      </div>

                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      >
                        <option value="">Select Product...</option>
                        {lineFilteredProducts.length === 0 ? (
                          <option value="" disabled>
                            -- No products found --
                          </option>
                        ) : (
                          lineFilteredProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.specifications_text ? `[${p.specifications_text}]` : ''} (SKU: {p.sku})
                            </option>
                          ))
                        )}
                      </select>
                      {item.specifications_text && (
                        <div className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 mt-1 w-fit">
                          Specs: {item.specifications_text}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financials / Quantities Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                    {/* Quantity */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Qty *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      />
                    </div>

                    {/* Unit Cost */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Buy Cost (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.unit_cost}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].unit_cost = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      />
                    </div>

                    {/* GST Rate */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">GST %</label>
                      <select
                        value={item.gst_rate}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].gst_rate = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      >
                        <option value="0.00">0%</option>
                        <option value="5.00">5%</option>
                        <option value="12.00">12%</option>
                        <option value="18.00">18%</option>
                        <option value="28.00">28%</option>
                      </select>
                    </div>

                    {/* Line Total */}
                    <div className="md:col-span-4 space-y-1 text-right flex flex-col justify-end">
                      <span className="text-[10px] text-slate-400 font-bold block">Line Total</span>
                      <span className="text-xs font-extrabold text-slate-900 font-mono">
                        ₹{lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Serial Number Tracking Input Section */}
                  {item.tracking_type === 'SERIAL_NUMBER' && item.product_id && (
                    <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                        <Info size={15} className="text-amber-600" />
                        <span>Serial Number Tracking Required ({item.quantity} Units)</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Enter physical device serial numbers below. Exactly {item.quantity} unique serial number(s) required.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {Array.from({ length: item.quantity }).map((_, sIdx) => (
                          <div key={sIdx} className="space-y-0.5">
                            <label className="text-[10px] font-bold text-amber-900">
                              Serial #{sIdx + 1} *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={`e.g. SN-${idx + 1}00${sIdx + 1}`}
                              value={item.serials[sIdx] || ''}
                              onChange={(e) => handleSerialChange(idx, sIdx, e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Financial Summary & Payment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>3. Payment Breakdown</span>
                <span className="text-xs font-normal font-mono text-slate-400">Record Actual Payments Made</span>
              </h2>
              <button
                type="button"
                onClick={addPaymentRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Payment</span>
              </button>
            </div>

            {/* Payment Rows List */}
            {payments.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  No initial cash/bank payments added. This purchase will be saved as <strong className="text-slate-900">Full Supplier Credit (UNPAID)</strong>.
                </p>
                <button
                  type="button"
                  onClick={addPaymentRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>Add First Payment Row</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((pRow, pIdx) => {
                  const isPartner = pRow.payer !== 'BUSINESS';
                  const partnerObj = partners.find((pt) => String(pt.id) === String(pRow.payer));

                  return (
                    <div key={pIdx} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 relative transition-all hover:border-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        
                        {/* WHO PAID? (Payer) */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase">Payer *</label>
                          <select
                            value={pRow.payer}
                            onChange={(e) => updatePaymentRow(pIdx, 'payer', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                          >
                            <option value="BUSINESS">🏢 Business (Company)</option>
                            {partners.map((pt) => (
                              <option key={pt.id} value={String(pt.id)}>
                                👤 {pt.name} (Partner)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* HOW WAS IT PAID? (Payment Mode) */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase">Payment Mode *</label>
                          <select
                            value={pRow.payment_mode}
                            onChange={(e) => updatePaymentRow(pIdx, 'payment_mode', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                          >
                            <option value="CASH">💵 Cash</option>
                            <option value="UPI">📱 UPI / QR Code</option>
                            <option value="CARD">💳 Debit / Credit Card</option>
                            <option value="BANK_TRANSFER">🏛️ Bank / NEFT</option>
                          </select>
                        </div>

                        {/* AMOUNT (₹) */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase">Amount Paid (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pRow.amount}
                            onChange={(e) => updatePaymentRow(pIdx, 'amount', e.target.value)}
                            placeholder="₹0.00"
                            className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                          />
                        </div>

                        {/* REMOVE BUTTON */}
                        <div className="sm:col-span-1 flex items-end justify-center pt-2 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => removePaymentRow(pIdx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Payment Row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Reference Number & Row Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <input
                          type="text"
                          placeholder="Ref No. (Txn ID / UTR / Cheque No.)"
                          value={pRow.reference_number || ''}
                          onChange={(e) => updatePaymentRow(pIdx, 'reference_number', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <input
                          type="text"
                          placeholder="Optional row note / remark..."
                          value={pRow.notes || ''}
                          onChange={(e) => updatePaymentRow(pIdx, 'notes', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>

                      {/* Partner Ledger Accounting Indicator */}
                      {isPartner && partnerObj && (
                        <div className="text-[10px] font-bold text-amber-700 flex items-center gap-1 pt-0.5">
                          <span>👤 Paid ₹{parseFloat(pRow.amount || 0).toLocaleString('en-IN')} by {partnerObj.name} out-of-pocket — automatically credited to {partnerObj.name}'s Partner Ledger.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* General Purchase Notes */}
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-700">General Purchase Notes / Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional reference notes for this stock purchase..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 pb-3 border-b border-slate-800 flex items-center justify-between">
                <span>Purchase Summary</span>
                <span className="text-[10px] text-orange-400 bg-orange-950/80 px-2 py-0.5 rounded font-bold font-mono">
                  {payments.length} Payment Row{payments.length === 1 ? '' : 's'}
                </span>
              </h3>

              <div className="space-y-2 pt-3 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Items Subtotal:</span>
                  <span className="font-mono font-bold">₹{summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>GST Tax:</span>
                  <span className="font-mono font-bold">₹{summary.totalTax.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-white">Grand Total:</span>
                  <span className="text-lg font-extrabold font-mono text-orange-400">
                    ₹{summary.grandTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400 pt-1">
                  <span>Total Paid Amount:</span>
                  <span className="font-mono font-semibold text-emerald-400">₹{summary.paid.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Supplier Payable (Balance):</span>
                  <span className="font-mono font-semibold text-rose-400">₹{summary.balance.toFixed(2)}</span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Payment Status:</span>
                  <StatusBadge status={summary.paymentStatus} type="payment" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Posting Purchase & Stock IN...' : 'Save & Post Stock Purchase'}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Create Supplier Modal */}
      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSuccess={handleSupplierCreated}
        title="Quick Create Supplier"
        subtitle="Add a new vendor record without leaving Purchase Entry"
      />

      {/* Quick Create Product Modal */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={handleProductCreated}
        categories={categories}
        title="Quick Create Product Master"
        subtitle="Add catalog item definition without leaving Purchase Entry"
      />

      {/* Quick Create Category Modal */}
      <CategoryFormModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={handleCategoryCreated}
        title="Quick Create Product Category"
        subtitle="Add a new product category without leaving Purchase Entry"
      />

      {/* Quick Create Brand Modal */}
      <BrandFormModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onSuccess={handleBrandCreated}
        categories={categories}
        initialCategoryId={activeLineForBrandCreate !== null ? items[activeLineForBrandCreate]?.category_id : ''}
        title="Quick Create Brand"
        subtitle="Add a new brand without leaving Purchase Entry"
        submitText="Save & Select Brand"
      />

      {/* A4 Purchase Invoice Print Modal */}
      <A4InvoicePrintModal
        isOpen={Boolean(printInvoiceData)}
        onClose={() => setPrintInvoiceData(null)}
        invoiceData={printInvoiceData}
      />
    </div>
  );
};

export default NewPurchase;
