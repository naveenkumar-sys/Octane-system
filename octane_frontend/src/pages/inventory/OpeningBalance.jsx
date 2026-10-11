import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';
import {
  Package,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Info,
  FileText,
  ArrowRight,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  DollarSign,
  Tag,
  Receipt,
  Wallet,
  X,
  Sparkles,
} from 'lucide-react';

import ProductFormModal from '../../components/forms/ProductFormModal';
import SupplierFormModal from '../../components/forms/SupplierFormModal';

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const OPENING_SOURCE_OPTIONS = [
  { id: 'EXISTING_STOCK', label: 'Existing Business Stock' },
  { id: 'PARTNER_CONTRIBUTION', label: 'Partner / Owner Contribution' },
  { id: 'DATA_MIGRATION', label: 'Previous System / Data Migration' },
  { id: 'OTHER', label: 'Other' },
];

export const OpeningBalance = () => {
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Opening Line Entry Modal State (Replaces the cramped/collapsed inline form)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // Quick Create Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  // Quick Create Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');
  const [openingSource, setOpeningSource] = useState('EXISTING_STOCK');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [originalPurchaseDate, setOriginalPurchaseDate] = useState('');
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState('');
  const [openingDate, setOpeningDate] = useState(() => toLocalDateString(new Date()));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [serialNumbersText, setSerialNumbersText] = useState('');
  const [individualSerials, setIndividualSerials] = useState(['']);
  const [serialInputMode, setSerialInputMode] = useState('individual'); // 'individual' or 'bulk'
  const [isSwitchingTracking, setIsSwitchingTracking] = useState(false);

  // Funding Breakdown State for the current item
  const [fundingRows, setFundingRows] = useState([]);

  // Batch Items Queue
  const [batchItems, setBatchItems] = useState([]);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMasterData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, partnersRes, suppliersRes, categoriesRes] = await Promise.all([
        api.getProducts(),
        api.getPartners(),
        api.getSuppliers(),
        api.getProductCategories(),
      ]);

      const productList = Array.isArray(productsRes) ? productsRes : productsRes.results || [];
      const partnerList = Array.isArray(partnersRes) ? partnersRes : partnersRes.results || [];
      const supplierList = Array.isArray(suppliersRes) ? suppliersRes : suppliersRes.results || [];
      const categoryList = Array.isArray(categoriesRes) ? categoriesRes : categoriesRes.results || [];

      // Only keep active products with stock enabled
      setProducts(productList.filter((p) => p.is_stock_enabled && p.is_active));
      setPartners(partnerList.filter((p) => p.is_active !== false));
      setSuppliers(supplierList.filter((s) => s.is_active !== false));
      setCategories(categoryList);
    } catch (err) {
      console.error('Failed to load opening balance master data:', err);
      setError(err.message || 'Failed to fetch master data for opening balance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const handleProductCreated = async (createdProduct) => {
    try {
      const data = await api.getProducts();
      const productList = Array.isArray(data) ? data : data.results || [];
      const stockProducts = productList.filter((p) => p.is_stock_enabled && p.is_active);
      setProducts(stockProducts);

      if (createdProduct && createdProduct.id) {
        setSelectedProductId(String(createdProduct.id));
        setQuantity(1);
        setSerialNumbersText('');
        setUnitCost(createdProduct.purchase_price || '0');
      }
      toast.success(`Product '${createdProduct?.name || ''}' created and auto-selected!`);
    } catch (err) {
      console.error('Failed to refresh product list after quick create:', err);
    }
  };

  const handleSupplierCreated = async (createdSupplier) => {
    try {
      const data = await api.getSuppliers();
      const supplierList = Array.isArray(data) ? data : data.results || [];
      const activeSuppliers = supplierList.filter((s) => s.is_active !== false);
      setSuppliers(activeSuppliers);

      if (createdSupplier && createdSupplier.id) {
        setSelectedSupplierId(String(createdSupplier.id));
      }
      toast.success(`Supplier '${createdSupplier?.name || ''}' created and auto-selected!`);
    } catch (err) {
      console.error('Failed to refresh supplier list after quick create:', err);
    }
  };

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)),
    [products, selectedProductId]
  );

  const selectedPartner = useMemo(
    () => partners.find((p) => String(p.id) === String(selectedPartnerId)),
    [partners, selectedPartnerId]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => String(s.id) === String(selectedSupplierId)),
    [suppliers, selectedSupplierId]
  );

  // Calculate realtime opening stock value
  const qtyNum = parseInt(quantity, 10) || 0;
  const unitCostNum = parseFloat(unitCost) || 0;
  const calculatedOpeningValue = qtyNum * unitCostNum;

  // Keep individualSerials array length synchronized with quantity
  const handleQuantityChange = (val) => {
    setQuantity(val);
    const newQty = parseInt(val, 10) || 0;
    if (newQty > 0) {
      setIndividualSerials((prev) => {
        const next = [...prev];
        if (newQty > next.length) {
          while (next.length < newQty) next.push('');
        } else if (newQty < next.length) {
          next.length = newQty;
        }
        return next;
      });
    }
  };

  // Handle individual serial input change (like Purchase screen)
  const handleIndividualSerialChange = (sIdx, value) => {
    const updated = [...individualSerials];
    while (updated.length <= sIdx) {
      updated.push('');
    }
    updated[sIdx] = value.toUpperCase();
    setIndividualSerials(updated);
    setSerialNumbersText(updated.filter(Boolean).join('\n'));
  };

  // Handle bulk textarea paste
  const handleBulkSerialChange = (text) => {
    setSerialNumbersText(text);
    const parsed = text
      .split(/[\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const targetLen = parseInt(quantity, 10) || 1;
    const updated = Array.from({ length: targetLen }).map((_, i) => parsed[i] || '');
    setIndividualSerials(updated);
  };

  // Parse serial numbers into clean trimmed uppercase array
  const parsedSerialNumbers = useMemo(() => {
    return individualSerials
      .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
      .filter(Boolean);
  }, [individualSerials]);

  // Handle switching tracking type on existing product directly from Opening Balance modal
  const handleSwitchTrackingType = async (productId, newTrackingType) => {
    setIsSwitchingTracking(true);
    try {
      await api.patchProduct(productId, { tracking_type: newTrackingType });
      setProducts((prev) =>
        prev.map((p) => (String(p.id) === String(productId) ? { ...p, tracking_type: newTrackingType } : p))
      );
      toast.success(
        `Product '${selectedProduct?.name || ''}' updated to ${
          newTrackingType === 'SERIAL_NUMBER' ? 'Serial Number Lifecycle Tracking' : 'Quantity Tracking'
        }!`
      );
    } catch (err) {
      console.error('Failed to update product tracking type:', err);
      toast.error(err.message || 'Failed to update tracking type for product.');
    } finally {
      setIsSwitchingTracking(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (e) => {
    const prodId = e.target.value;
    setSelectedProductId(prodId);
    setQuantity(1);
    setIndividualSerials(['']);
    setSerialNumbersText('');
    setSerialInputMode('individual');

    const prod = products.find((p) => String(p.id) === String(prodId));
    if (prod) {
      setUnitCost(prod.purchase_price || '0');
    } else {
      setUnitCost('');
    }
  };

  // Funding Breakdown Rows Handlers
  const handleAddFundingRow = () => {
    setFundingRows([...fundingRows, { payer_type: 'BUSINESS', partner_id: '', amount: '' }]);
  };

  const handleRemoveFundingRow = (index) => {
    setFundingRows(fundingRows.filter((_, i) => i !== index));
  };

  const handleFundingRowChange = (index, field, value) => {
    const updated = [...fundingRows];
    updated[index][field] = value;
    if (field === 'payer_type' && value === 'BUSINESS') {
      updated[index]['partner_id'] = '';
    }
    setFundingRows(updated);
  };

  // Total Batch Metrics
  const totalBatchValue = useMemo(() => {
    return batchItems.reduce((acc, item) => acc + (item.opening_value || 0), 0);
  }, [batchItems]);

  const totalBatchUnits = useMemo(() => {
    return batchItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
  }, [batchItems]);

  // Open modal in create mode
  const handleOpenCreateModal = () => {
    setEditingIndex(null);
    setSelectedProductId('');
    setQuantity(1);
    setUnitCost('');
    setOpeningSource('EXISTING_STOCK');
    setSelectedPartnerId('');
    setSelectedSupplierId('');
    setOriginalPurchaseDate('');
    setOriginalInvoiceNumber('');
    setOpeningDate(toLocalDateString(new Date()));
    setReferenceNumber('');
    setNotes('');
    setSerialNumbersText('');
    setIndividualSerials(['']);
    setSerialInputMode('individual');
    setFundingRows([]);
    setIsEntryModalOpen(true);
  };

  // Open modal in edit mode
  const handleEditItem = (index) => {
    const itemToEdit = batchItems[index];
    setEditingIndex(index);
    setSelectedProductId(String(itemToEdit.product_id));
    setQuantity(itemToEdit.quantity);
    setUnitCost(String(itemToEdit.unit_cost));
    setOpeningSource(itemToEdit.opening_source || 'EXISTING_STOCK');
    setSelectedPartnerId(itemToEdit.partner_id ? String(itemToEdit.partner_id) : '');
    setSelectedSupplierId(itemToEdit.supplier_id ? String(itemToEdit.supplier_id) : '');
    setOriginalPurchaseDate(itemToEdit.original_purchase_date || '');
    setOriginalInvoiceNumber(itemToEdit.original_invoice_number || '');
    setOpeningDate(itemToEdit.opening_date || toLocalDateString(new Date()));
    setReferenceNumber(itemToEdit.reference_number || '');
    setNotes(itemToEdit.user_notes || '');

    const existingSerials = itemToEdit.serial_numbers || [];
    const qCount = parseInt(itemToEdit.quantity, 10) || 1;
    const initialArr = Array.from({ length: qCount }).map((_, i) => existingSerials[i] || '');
    setIndividualSerials(initialArr);
    setSerialNumbersText(existingSerials.join('\n'));
    setSerialInputMode('individual');

    if (itemToEdit.funding_breakdown && itemToEdit.funding_breakdown.length > 0) {
      setFundingRows(
        itemToEdit.funding_breakdown.map((f) => ({
          payer_type: f.payer_type,
          partner_id: f.partner_id || '',
          amount: String(f.amount),
        }))
      );
    } else {
      setFundingRows([]);
    }

    setIsEntryModalOpen(true);
  };

  const handleRemoveItem = (index) => {
    const updated = batchItems.filter((_, i) => i !== index);
    setBatchItems(updated);
    toast.info('Removed item from opening balance queue.');
  };

  // Add or Update Item in Batch Queue
  const handleSaveModalItem = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select an existing product from Product Master.');
      return;
    }

    if (qtyNum <= 0) {
      toast.error('Opening quantity must be a positive integer greater than 0.');
      return;
    }

    if (isNaN(unitCostNum) || unitCostNum < 0) {
      toast.error('Unit cost must be a valid non-negative number.');
      return;
    }

    if (openingSource === 'PARTNER_CONTRIBUTION' && !selectedPartnerId) {
      toast.error('Please select the contributing Partner / Owner.');
      return;
    }

    // Serial number validations for SERIAL_NUMBER tracked products
    if (selectedProduct.tracking_type === 'SERIAL_NUMBER') {
      if (parsedSerialNumbers.length !== qtyNum) {
        toast.error(
          `For serial-tracked product '${selectedProduct.name}', exactly ${qtyNum} serial number(s) must be entered (currently entered: ${parsedSerialNumbers.length}).`
        );
        return;
      }

      // Check duplicate serials within current input
      const uniqueSerials = new Set(parsedSerialNumbers);
      if (uniqueSerials.size !== parsedSerialNumbers.length) {
        toast.error('Duplicate serial numbers found in your entry list.');
        return;
      }

      // Check if any serial is already queued in batchItems (excluding the one currently being edited)
      const existingQueuedSerials = new Set();
      batchItems.forEach((item, idx) => {
        if (idx !== editingIndex && item.serial_numbers) {
          item.serial_numbers.forEach((s) => existingQueuedSerials.add(s));
        }
      });

      const conflictSerials = parsedSerialNumbers.filter((s) => existingQueuedSerials.has(s));
      if (conflictSerials.length > 0) {
        toast.error(`Serial number(s) already queued in this batch: ${conflictSerials.join(', ')}`);
        return;
      }
    }

    // Format funding breakdown list
    const validFundingList = fundingRows
      .filter((f) => parseFloat(f.amount) > 0)
      .map((f) => {
        if (f.payer_type === 'PARTNER') {
          const partObj = partners.find((p) => String(p.id) === String(f.partner_id));
          return {
            payer_type: 'PARTNER',
            partner_id: f.partner_id,
            payer_name: partObj ? partObj.name : 'Partner',
            amount: parseFloat(f.amount),
          };
        }
        return {
          payer_type: 'BUSINESS',
          payer_name: 'Business',
          amount: parseFloat(f.amount),
        };
      });

    const sourceObj = OPENING_SOURCE_OPTIONS.find((s) => s.id === openingSource);
    const sourceLabel = sourceObj ? sourceObj.label : openingSource;

    // Construct detailed notes string for backend audit logging
    const notesParts = [];
    notesParts.push(`[Source: ${sourceLabel}${selectedPartner ? ` (${selectedPartner.name})` : ''}]`);
    if (selectedSupplier) {
      notesParts.push(`[Hist. Supplier: ${selectedSupplier.name}]`);
    }
    if (originalInvoiceNumber.trim()) {
      notesParts.push(`[Orig. Inv#: ${originalInvoiceNumber.trim()}]`);
    }
    if (originalPurchaseDate) {
      notesParts.push(`[Orig. Date: ${originalPurchaseDate}]`);
    }
    if (referenceNumber.trim()) {
      notesParts.push(`[Ref: ${referenceNumber.trim()}]`);
    }
    if (openingDate) {
      notesParts.push(`[Opening Date: ${openingDate}]`);
    }
    if (validFundingList.length > 0) {
      const fundStr = validFundingList.map((f) => `${f.payer_name}: ₹${f.amount}`).join(', ');
      notesParts.push(`[Funding: ${fundStr}]`);
    }
    if (notes.trim()) {
      notesParts.push(notes.trim());
    } else {
      notesParts.push('Initial physical opening balance entry');
    }

    const formattedBackendNotes = notesParts.join(' ');

    const itemData = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      unit: selectedProduct.unit || 'NOS',
      tracking_type: selectedProduct.tracking_type,
      quantity: qtyNum,
      unit_cost: unitCostNum,
      opening_value: calculatedOpeningValue,
      opening_source: openingSource,
      opening_source_label: sourceLabel,
      partner_id: selectedPartner ? selectedPartner.id : null,
      partner_name: selectedPartner ? selectedPartner.name : null,
      supplier_id: selectedSupplier ? selectedSupplier.id : null,
      supplier_name: selectedSupplier ? selectedSupplier.name : null,
      original_purchase_date: originalPurchaseDate,
      original_invoice_number: originalInvoiceNumber.trim(),
      opening_date: openingDate,
      reference_number: referenceNumber.trim(),
      user_notes: notes.trim(),
      funding_breakdown: validFundingList,
      serial_numbers: selectedProduct.tracking_type === 'SERIAL_NUMBER' ? parsedSerialNumbers : [],
      backend_notes: formattedBackendNotes,
    };

    if (editingIndex !== null) {
      const updated = [...batchItems];
      updated[editingIndex] = itemData;
      setBatchItems(updated);
      toast.success(`Updated '${selectedProduct.name}' in opening stock batch.`);
    } else {
      setBatchItems([...batchItems, itemData]);
      toast.success(`Added '${selectedProduct.name}' to opening stock batch.`);
    }

    setIsEntryModalOpen(false);
    setEditingIndex(null);
  };

  // Submit Batch to Backend API
  const handleSubmitBatch = async () => {
    if (batchItems.length === 0) {
      toast.error('Batch queue is empty. Add at least one product before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: batchItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          serial_numbers: item.serial_numbers,
          notes: item.backend_notes,
        })),
      };

      const response = await api.postOpeningStock(payload);
      toast.success(response.message || 'Successfully recorded initial opening stock balances!');
      setBatchItems([]);
      setShowConfirmModal(false);
      fetchMasterData(); // Refresh product stock levels
    } catch (err) {
      console.error('Failed to submit opening stock batch:', err);
      toast.error(err.message || 'Failed to post opening stock batch. Check serial number uniqueness.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading catalog products, partners & suppliers from Django backend..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchMasterData} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="text-orange-600" size={24} />
            <span>Opening Balance Entry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Load initial physical stock balances and historical inventory data into OCTANE ERP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Product to Opening Batch</span>
          </button>
        </div>
      </div>

      {/* Prominent Informational Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
          <Info size={18} />
        </div>
        <div className="space-y-1">
          <div className="font-extrabold text-amber-950 uppercase tracking-wide">
            Initial Inventory Entry Notice
          </div>
          <p className="text-amber-900 leading-relaxed">
            Opening Balance is used <strong>only to load stock that already existed</strong> before implementing OCTANE ERP.
            Normal supplier purchases must be entered through <strong className="text-slate-900">Purchases &rarr; New Purchase</strong>.
          </p>
        </div>
      </div>

      {/* KPI Cards when Queue has items */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Queued Products</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{batchItems.length} Products</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Physical Units</p>
          <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{totalBatchUnits} Units</p>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Opening Valuation</p>
          <p className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
            ₹{totalBatchValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Main Full-Width Opening Batch Queue */}
      <Card className="p-5 bg-white border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-orange-600" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Opening Batch Queue ({batchItems.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Product</span>
            </button>
            {batchItems.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchItems([])}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              >
                Clear Queue
              </button>
            )}
          </div>
        </div>

        {batchItems.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/60 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-100/70 text-orange-600 mx-auto flex items-center justify-center">
              <Package size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-extrabold text-slate-800">Opening Batch Queue is Empty</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Click below to open the line entry modal and queue multiple stock items before reviewing and posting initial balances.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Add First Product to Opening Batch</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-3.5 py-3 text-left">#</th>
                    <th className="px-3.5 py-3 text-left">Product & SKU</th>
                    <th className="px-3.5 py-3 text-center">Tracking</th>
                    <th className="px-3.5 py-3 text-right">Quantity</th>
                    <th className="px-3.5 py-3 text-right">Unit Cost</th>
                    <th className="px-3.5 py-3 text-right">Opening Value</th>
                    <th className="px-3.5 py-3 text-left">Stock Source</th>
                    <th className="px-3.5 py-3 text-left">Hist. Reference</th>
                    <th className="px-3.5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchItems.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3 text-slate-400 font-mono">{index + 1}</td>
                      <td className="px-3.5 py-3">
                        <div className="font-extrabold text-slate-900">{item.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">SKU: {item.sku || '—'}</div>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <StatusBadge status={item.tracking_type} type="tracking" />
                        {item.serial_numbers && item.serial_numbers.length > 0 && (
                          <div className="text-[9px] font-mono text-amber-700 font-bold mt-1">
                            {item.serial_numbers.length} Serials
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-slate-700">
                        ₹{item.unit_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-extrabold text-emerald-700 text-sm">
                        ₹{item.opening_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                          {item.opening_source_label}
                        </span>
                        {item.partner_name && (
                          <div className="text-[10px] font-semibold text-blue-700 mt-0.5">
                            Owner: {item.partner_name}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 text-[11px]">
                        {item.supplier_name && <div>Supplier: <strong>{item.supplier_name}</strong></div>}
                        {item.original_invoice_number && <div>Inv #: <span className="font-mono">{item.original_invoice_number}</span></div>}
                        {item.original_purchase_date && <div>Date: <span className="font-mono">{item.original_purchase_date}</span></div>}
                        {!item.supplier_name && !item.original_invoice_number && !item.original_purchase_date && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditItem(index)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove Item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Valuation & Post Button Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-6 w-full sm:w-auto">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  TOTAL OPENING INVENTORY VALUE:
                </span>
                <span className="text-xl font-mono font-black text-emerald-400">
                  ₹{totalBatchValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Add Another Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Review & Post Opening Balance ({batchItems.length})</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* EXPANDED, SPACIOUS & CLEAR OPENING LINE ENTRY MODAL          */}
      {/* ------------------------------------------------------------- */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {editingIndex !== null ? 'Edit Opening Stock Item' : 'Add Product to Opening Stock Batch'}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    Record initial physical stock that existed prior to OCTANE ERP go-live.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEntryModalOpen(false);
                  setEditingIndex(null);
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveModalItem} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* 1. Product Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Tag size={14} className="text-orange-600" />
                      <span>Product Master</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsProductModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} />
                      <span>+ Add New Product</span>
                    </button>
                  </div>
                  <select
                    value={selectedProductId}
                    onChange={handleProductSelect}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                    required
                  >
                    <option value="">-- Choose Existing Product from Catalog --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku || 'No SKU'}) [{p.tracking_type === 'SERIAL_NUMBER' ? 'SERIAL' : 'QTY'}] — Current Physical Stock: {p.current_stock || 0} {p.unit}
                      </option>
                    ))}
                  </select>

                  {/* Selected Product Banner */}
                  {selectedProduct && (
                    <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900">{selectedProduct.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          SKU: <strong>{selectedProduct.sku || '—'}</strong> | Current Stock: <strong>{selectedProduct.current_stock || 0} {selectedProduct.unit}</strong> | Default Purchase: ₹{selectedProduct.purchase_price || '0.00'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={selectedProduct.tracking_type} type="tracking" />
                        {selectedProduct.tracking_type === 'QUANTITY' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchTrackingType(selectedProduct.id, 'SERIAL_NUMBER')}
                            disabled={isSwitchingTracking}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            title="Switch this existing product to Serial Number Lifecycle Tracking (required for Laptops, Mobiles, PCs)"
                          >
                            <Barcode size={13} />
                            <span>{isSwitchingTracking ? 'Switching...' : '⚡ Switch to Serial Tracking'}</span>
                          </button>
                        )}
                        {selectedProduct.tracking_type === 'SERIAL_NUMBER' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchTrackingType(selectedProduct.id, 'QUANTITY')}
                            disabled={isSwitchingTracking}
                            className="px-2 py-0.5 text-[10px] text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                            title="Switch to Quantity Tracking"
                          >
                            {isSwitchingTracking ? 'Switching...' : 'Switch to Quantity'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Quantity, Unit Cost & Calculated Stock Value */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                      Opening Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                      Unit Cost (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                      Opening Valuation
                    </label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-sm font-mono font-black text-emerald-800 flex items-center justify-between">
                      <span>₹</span>
                      <span>
                        {calculatedOpeningValue.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Helpful Prompt if Product is currently QUANTITY tracked */}
                {selectedProduct && selectedProduct.tracking_type === 'QUANTITY' && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
                    <div className="flex items-start gap-2.5">
                      <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-900 block">Laptop or Serialized Device?</span>
                        <span className="text-[11px] text-slate-600">
                          This product is currently configured for <strong>Quantity Tracking</strong> (bulk stock). If you want to record individual Serial Numbers like in the Purchase screen, enable Serial Tracking.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchTrackingType(selectedProduct.id, 'SERIAL_NUMBER')}
                      disabled={isSwitchingTracking}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Barcode size={14} />
                      <span>{isSwitchingTracking ? 'Enabling...' : 'Enable Serial Tracking'}</span>
                    </button>
                  </div>
                )}

                {/* 3. Serial Numbers Input for SERIAL_NUMBER products - Individual inputs like Purchase screen */}
                {selectedProduct && selectedProduct.tracking_type === 'SERIAL_NUMBER' && (
                  <div className="space-y-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase font-mono">
                        <Barcode size={16} className="text-amber-700" />
                        <span>Physical Serial Numbers ({parsedSerialNumbers.length} / {qtyNum})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSerialInputMode(serialInputMode === 'individual' ? 'bulk' : 'individual')}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                        >
                          {serialInputMode === 'individual' ? '📋 Switch to Bulk Paste' : '📝 Switch to Individual Boxes'}
                        </button>
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                            parsedSerialNumbers.length === qtyNum
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {parsedSerialNumbers.length === qtyNum ? '✓ Count Matches' : `Requires ${qtyNum} Serials`}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      Enter the physical barcode / serial number for each device. Each unit will be registered as <strong className="text-slate-900">AVAILABLE</strong> in inventory.
                    </p>

                    {serialInputMode === 'individual' ? (
                      <div
                        className={`grid gap-3 pt-1 max-h-64 overflow-y-auto pr-1 ${
                          qtyNum === 1
                            ? 'grid-cols-1 max-w-sm'
                            : qtyNum === 2
                            ? 'grid-cols-1 sm:grid-cols-2'
                            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                        }`}
                      >
                        {Array.from({ length: qtyNum }).map((_, sIdx) => (
                          <div key={sIdx} className="space-y-1">
                            <label className="block text-xs font-bold text-slate-800">
                              Serial #{sIdx + 1} <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder={`e.g. SN-00${sIdx + 1}`}
                                value={individualSerials[sIdx] || ''}
                                onChange={(e) => handleIndividualSerialChange(sIdx, e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 transition-all shadow-2xs"
                              />
                              {individualSerials[sIdx] && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                                  <CheckCircle2 size={15} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <textarea
                          rows={3}
                          value={serialNumbersText}
                          onChange={(e) => handleBulkSerialChange(e.target.value)}
                          placeholder="Paste multiple serial numbers separated by commas or newlines (e.g., SN001, SN002)..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                        />
                        <div className="text-[10px] text-amber-800 flex items-center justify-between">
                          <span>Bulk paste automatically populates individual serial slots.</span>
                          <span>{parsedSerialNumbers.length} serials detected</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Opening Stock Source & Partner Dropdown */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                        Opening Stock Source <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={openingSource}
                        onChange={(e) => {
                          setOpeningSource(e.target.value);
                          if (e.target.value !== 'PARTNER_CONTRIBUTION') {
                            setSelectedPartnerId('');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                        required
                      >
                        {OPENING_SOURCE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {openingSource === 'PARTNER_CONTRIBUTION' && (
                      <div className="space-y-1">
                        <label className="block text-xs font-mono font-bold text-blue-900 uppercase flex items-center gap-1">
                          <UserCheck size={14} className="text-blue-600" />
                          <span>Contributing Partner / Owner</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedPartnerId}
                          onChange={(e) => setSelectedPartnerId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                          required
                        >
                          <option value="">-- Choose Partner / Owner --</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Historical Purchase Reference Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <Receipt size={15} className="text-slate-500" />
                    <span>Historical Purchase Reference (Optional)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono text-slate-700 uppercase font-semibold">
                          Hist. Supplier
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsSupplierModalOpen(true)}
                          className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                        >
                          + Add Supplier
                        </button>
                      </div>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      >
                        <option value="">-- Optional --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono text-slate-700 uppercase font-semibold">
                        Orig. Invoice #
                      </label>
                      <input
                        type="text"
                        value={originalInvoiceNumber}
                        onChange={(e) => setOriginalInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-9901"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono text-slate-700 uppercase font-semibold">
                        Orig. Purchase Date
                      </label>
                      <input
                        type="date"
                        value={originalPurchaseDate}
                        onChange={(e) => setOriginalPurchaseDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono text-slate-700 uppercase font-semibold">
                        Opening Stock Date
                      </label>
                      <input
                        type="date"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono text-slate-700 uppercase font-semibold">
                        Ref Number / Audit Notes
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="e.g. Pre-ERP shop audit notes"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Historical Funding / Payer Breakdown Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={15} className="text-slate-500" />
                      <span>Historical Funding / Payer Breakdown (Optional)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFundingRow}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-0.5 rounded-lg transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus size={12} />
                      <span>+ Add Payer</span>
                    </button>
                  </div>

                  {fundingRows.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No funding split added. Cost will be attributed to regular business capital by default.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {fundingRows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <select
                            value={row.payer_type}
                            onChange={(e) => handleFundingRowChange(idx, 'payer_type', e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                          >
                            <option value="BUSINESS">Business Capital</option>
                            <option value="PARTNER">Partner Contribution</option>
                          </select>

                          {row.payer_type === 'PARTNER' && (
                            <select
                              value={row.partner_id}
                              onChange={(e) => handleFundingRowChange(idx, 'partner_id', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-bold text-blue-900"
                            >
                              <option value="">-- Choose Partner --</option>
                              {partners.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          )}

                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount ₹"
                            value={row.amount}
                            onChange={(e) => handleFundingRowChange(idx, 'amount', e.target.value)}
                            className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold"
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveFundingRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs font-mono text-slate-500 font-bold">
                  Item Valuation: <span className="text-emerald-700 text-sm font-black">₹{calculatedOpeningValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEntryModalOpen(false);
                      setEditingIndex(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>{editingIndex !== null ? 'Update Queued Item' : '+ Add Product to Opening Batch'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Confirm Opening Inventory Entry</h3>
                <p className="text-xs text-slate-500">Review stock items and total valuation before posting to live ledger.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {batchItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>{item.product_name}</span>
                    <span className="font-mono">Qty: {item.quantity} × ₹{item.unit_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600 font-mono">
                    <span>Source: {item.opening_source_label}{item.partner_name ? ` (${item.partner_name})` : ''}</span>
                    <span className="font-extrabold text-emerald-700">₹{item.opening_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {item.serial_numbers && item.serial_numbers.length > 0 && (
                    <div className="text-[10px] font-mono text-amber-800">
                      Serials: {item.serial_numbers.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-slate-400 uppercase">TOTAL OPENING VALUATION:</span>
              <span className="text-lg font-black text-emerald-400">
                ₹{totalBatchValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
              ℹ️ Notice: This batch will record initial physical stock in the backend under reference type <span className="font-mono font-bold">OPENING_STOCK</span>. It does NOT generate any purchase orders, supplier payables, or cash payment records.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitBatch}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Posting Opening Stock...</span>
                  </>
                ) : (
                  <span>Confirm & Post Opening Stock</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Product Form Modal */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={handleProductCreated}
        categories={categories}
        title="Quick Create Catalog Product"
        subtitle="Create a new physical product master record for catalog classification."
      />

      {/* Quick Create Supplier Form Modal */}
      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSuccess={handleSupplierCreated}
        title="Quick Create Supplier Master"
        subtitle="Create a new supplier master record for catalog classification."
      />
    </div>
  );
};

export default OpeningBalance;
