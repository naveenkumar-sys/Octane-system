import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';
import {
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Barcode,
  History,
  Info,
  X,
  Package,
  Layers,
  FileText,
} from 'lucide-react';

export const StockAdjustment = () => {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState(null);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('IN'); // 'IN' or 'OUT'
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  // Serial Numbers State for serialized products
  const [availableSerials, setAvailableSerials] = useState([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialNumbersText, setSerialNumbersText] = useState('');
  const [selectedSerialsToDeduct, setSelectedSerialsToDeduct] = useState([]);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recent Adjustments Activity State
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    setErrorProducts(null);
    try {
      const stockData = await api.getCurrentStock();
      const productList = Array.isArray(stockData) ? stockData : [];
      setProducts(productList);
    } catch (err) {
      console.error('Failed to load stock overview for adjustment:', err);
      setErrorProducts(err.message || 'Failed to fetch inventory stock data.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchRecentAdjustments = async () => {
    setLoadingAdjustments(true);
    try {
      const res = await api.getStockMovements('?limit=25');
      const list = Array.isArray(res) ? res : res.results || [];
      const adjustmentsOnly = list.filter(
        (m) => m.movement_type === 'ADJUSTMENT_IN' || m.movement_type === 'ADJUSTMENT_OUT'
      );
      setRecentAdjustments(adjustmentsOnly.slice(0, 10));
    } catch (err) {
      console.error('Failed to fetch recent adjustments:', err);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchRecentAdjustments();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.product_id) === String(selectedProductId)),
    [products, selectedProductId]
  );

  const currentStock = selectedProduct ? Number(selectedProduct.current_stock) || 0 : 0;
  const qtyNum = parseInt(quantity, 10) || 0;

  // Calculate new stock quantity
  const calculatedNewStock =
    adjustmentType === 'IN' ? currentStock + qtyNum : Math.max(0, currentStock - qtyNum);

  // Check if requested stock OUT exceeds available physical stock
  const isInvalidReduction =
    selectedProduct && adjustmentType === 'OUT' && (currentStock === 0 || qtyNum > currentStock);

  // Load available serial numbers when serialized product is selected
  useEffect(() => {
    if (selectedProduct && selectedProduct.tracking_type === 'SERIAL_NUMBER') {
      const fetchSerials = async () => {
        setLoadingSerials(true);
        try {
          const res = await api.getSerialNumbers(`?product=${selectedProduct.product_id}&status=AVAILABLE`);
          const list = Array.isArray(res) ? res : res.results || [];
          setAvailableSerials(list);
        } catch (err) {
          console.error('Failed to load available serial numbers:', err);
          setAvailableSerials([]);
        } finally {
          setLoadingSerials(false);
        }
      };
      fetchSerials();
    } else {
      setAvailableSerials([]);
      setSelectedSerialsToDeduct([]);
      setSerialNumbersText('');
    }
  }, [selectedProduct]);

  // Parse serial numbers text into array
  const parsedInSerials = useMemo(() => {
    return serialNumbersText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [serialNumbersText]);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProductId(prodId);
    setQuantity(1);
    setReason('');
    setSerialNumbersText('');
    setSelectedSerialsToDeduct([]);

    const prod = products.find((p) => String(p.product_id) === String(prodId));
    if (prod && Number(prod.current_stock) === 0) {
      setAdjustmentType('IN');
    }
  };

  const toggleSerialToDeduct = (serial) => {
    if (selectedSerialsToDeduct.includes(serial)) {
      setSelectedSerialsToDeduct(selectedSerialsToDeduct.filter((s) => s !== serial));
    } else {
      if (selectedSerialsToDeduct.length < qtyNum) {
        setSelectedSerialsToDeduct([...selectedSerialsToDeduct, serial]);
      } else {
        toast.info(`Already selected ${qtyNum} serial number(s) to match the quantity.`);
      }
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select a product from the list.');
      return;
    }

    if (qtyNum <= 0) {
      toast.error('Adjustment quantity must be greater than zero.');
      return;
    }

    if (adjustmentType === 'OUT' && qtyNum > currentStock) {
      toast.error(`Cannot reduce stock by ${qtyNum}. Current available stock is only ${currentStock}.`);
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason or note for this stock adjustment.');
      return;
    }

    // Serial number checks for SERIAL_NUMBER tracked items
    if (selectedProduct.tracking_type === 'SERIAL_NUMBER') {
      if (adjustmentType === 'IN') {
        if (parsedInSerials.length !== qtyNum) {
          toast.error(
            `For serial-tracked product '${selectedProduct.product_name}', exactly ${qtyNum} serial number(s) must be entered (currently: ${parsedInSerials.length}).`
          );
          return;
        }
        const uniqueSet = new Set(parsedInSerials);
        if (uniqueSet.size !== parsedInSerials.length) {
          toast.error('Duplicate serial numbers found in your entry list.');
          return;
        }
      } else if (adjustmentType === 'OUT') {
        if (selectedSerialsToDeduct.length > 0 && selectedSerialsToDeduct.length !== qtyNum) {
          toast.error(
            `You selected ${selectedSerialsToDeduct.length} serials, but adjustment quantity is ${qtyNum}. Please select exactly ${qtyNum} serial(s) or leave blank to deduct by FIFO order.`
          );
          return;
        }
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmAdjustment = async () => {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    try {
      const serialsPayload =
        selectedProduct.tracking_type === 'SERIAL_NUMBER'
          ? adjustmentType === 'IN'
            ? parsedInSerials
            : selectedSerialsToDeduct
          : [];

      const payload = {
        product_id: selectedProduct.product_id,
        new_stock_quantity: calculatedNewStock,
        reason: `${adjustmentType === 'IN' ? 'Stock Adjustment IN (+)' : 'Stock Adjustment OUT (-)'}: ${reason.trim()}`,
        serial_numbers: serialsPayload,
      };

      const response = await api.postStockAdjustment(payload);
      toast.success(response.message || `Stock adjusted successfully for '${selectedProduct.product_name}'.`);

      // Reset Form & Refresh Products & Adjustments History
      setSelectedProductId('');
      setQuantity(1);
      setReason('');
      setSerialNumbersText('');
      setSelectedSerialsToDeduct([]);
      setShowConfirmModal(false);
      fetchProducts();
      fetchRecentAdjustments();
    } catch (err) {
      console.error('Failed to execute stock adjustment:', err);
      toast.error(err.message || 'Failed to execute stock adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProducts) {
    return <LoadingState message="Loading current stock levels from Django engine..." />;
  }

  if (errorProducts) {
    return <ErrorState message={errorProducts} onRetry={fetchProducts} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="text-orange-600" size={24} />
            <span>Stock Adjustment</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Correct physical stock disparities resulting from audit variances, damages, or discrepancies.
          </p>
        </div>
        <button
          onClick={() => {
            fetchProducts();
            fetchRecentAdjustments();
          }}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer border border-slate-200 shadow-2xs"
        >
          <RefreshCw size={14} className={loadingProducts ? 'animate-spin' : ''} />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* Adjustment Form Card */}
      <Card className="p-6 bg-white border-slate-200 shadow-xs space-y-6">
        <form onSubmit={handlePreSubmit} className="space-y-6">
          {/* Step 1: Product Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
              1. Select Target Product <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={handleProductChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              required
            >
              <option value="">-- Choose Product to Adjust --</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.sku || 'No SKU'}) — Current Live Stock: {p.current_stock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Product Stock Summary Banner */}
          {selectedProduct && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-in fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Selected Item</span>
                <span className="font-extrabold text-slate-900 text-sm block mt-0.5">{selectedProduct.product_name}</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  SKU: <strong>{selectedProduct.sku || '—'}</strong>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Current Live Stock</span>
                <span className="font-mono font-black text-slate-900 text-xl block mt-0.5">
                  {selectedProduct.current_stock} {selectedProduct.unit}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  Status: <strong className={currentStock === 0 ? 'text-rose-600' : 'text-emerald-700'}>{selectedProduct.stock_status}</strong>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Tracking Mode</span>
                <div className="mt-1">
                  <StatusBadge status={selectedProduct.tracking_type} type="tracking" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Adjustment Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
              2. Adjustment Direction <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAdjustmentType('IN')}
                className={`py-3.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-start gap-3 transition-all cursor-pointer ${
                  adjustmentType === 'IN'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ArrowDownRight size={20} />
                </div>
                <div className="text-left">
                  <div className="font-extrabold text-sm">Adjustment IN (+)</div>
                  <div className="text-[11px] font-normal text-slate-500 mt-0.5">Add physical stock to system</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('OUT')}
                disabled={selectedProduct && currentStock === 0}
                className={`py-3.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-start gap-3 transition-all cursor-pointer ${
                  selectedProduct && currentStock === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                    : adjustmentType === 'OUT'
                    ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-xs ring-2 ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={20} />
                </div>
                <div className="text-left">
                  <div className="font-extrabold text-sm">Adjustment OUT (-)</div>
                  <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                    {selectedProduct && currentStock === 0
                      ? 'No stock available to deduct (Stock: 0)'
                      : 'Deduct physical stock (damage/loss)'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 3: Quantity & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                3. Adjustment Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={adjustmentType === 'OUT' && selectedProduct ? currentStock : undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-black text-slate-900 focus:outline-none focus:ring-2 font-mono ${
                  isInvalidReduction
                    ? 'border-rose-300 bg-rose-50 focus:ring-rose-500'
                    : 'border-slate-300 bg-slate-50 focus:ring-orange-500/30 focus:border-orange-500'
                }`}
                required
              />
              {isInvalidReduction && (
                <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <ShieldAlert size={14} /> Cannot reduce by {qtyNum}. Maximum removable stock is {currentStock}.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                Reason / Note <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Physical inventory count correction, Damaged stock"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* Step 4: Serial Numbers Handling for SERIAL_NUMBER Tracked Items */}
          {selectedProduct && selectedProduct.tracking_type === 'SERIAL_NUMBER' && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Barcode size={16} className="text-amber-700" />
                  <span className="text-xs font-mono font-bold text-amber-950 uppercase">
                    {adjustmentType === 'IN'
                      ? `Serial Numbers to Add (+)`
                      : `Select Serial Numbers to Deduct (-)`}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border ${
                    adjustmentType === 'IN'
                      ? parsedInSerials.length === qtyNum
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-200 text-amber-900 border-amber-300'
                      : selectedSerialsToDeduct.length === qtyNum
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  {adjustmentType === 'IN'
                    ? `${parsedInSerials.length} / ${qtyNum} Serials Entered`
                    : `${selectedSerialsToDeduct.length} / ${qtyNum} Serials Picked`}
                </span>
              </div>

              {adjustmentType === 'IN' ? (
                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={serialNumbersText}
                    onChange={(e) => setSerialNumbersText(e.target.value)}
                    placeholder="Enter new serial numbers separated by commas or newlines (e.g. SN1001, SN1002)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-amber-800">
                    Each serial number will be registered into the system with status <strong>AVAILABLE</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-900">
                    Click the serial numbers below to select which physical units are being deducted / damaged:
                  </p>
                  {loadingSerials ? (
                    <div className="text-xs text-amber-700 py-2">Loading active serial numbers...</div>
                  ) : availableSerials.length === 0 ? (
                    <div className="text-xs text-rose-700 font-semibold py-2">
                      No serial numbers currently registered as AVAILABLE for this product.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-amber-200">
                      {availableSerials.map((s) => {
                        const isSelected = selectedSerialsToDeduct.includes(s.serial_number);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSerialToDeduct(s.serial_number)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}
                            {s.serial_number}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedSerialsToDeduct.length === 0 && (
                    <p className="text-[10px] text-amber-700 italic">
                      Tip: If you do not select specific serials, the system will automatically deduct the oldest available serial numbers in FIFO order.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resulting Stock Preview Card */}
          {selectedProduct && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs animate-in fade-in ${
                isInvalidReduction
                  ? 'bg-rose-50/90 border-rose-300 text-rose-900'
                  : 'bg-orange-50/70 border-orange-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg ${
                    isInvalidReduction ? 'bg-rose-600' : 'bg-orange-600'
                  }`}
                >
                  {adjustmentType === 'IN' ? '+' : '-'}
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Resulting Stock Level Calculation</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Current: <strong>{currentStock}</strong> {adjustmentType === 'IN' ? '+' : '-'} Adjustment:{' '}
                    <strong>{qtyNum}</strong>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">New Final Stock</span>
                <span
                  className={`font-mono font-black text-2xl ${
                    calculatedNewStock < 0 ? 'text-rose-600' : 'text-orange-700'
                  }`}
                >
                  {calculatedNewStock} {selectedProduct.unit}
                </span>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!selectedProduct || isInvalidReduction || !reason.trim() || qtyNum <= 0}
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Proceed to Stock Adjustment Confirmation</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* CLEAR, SPACIOUS CONFIRMATION MODAL                            */}
      {/* ------------------------------------------------------------- */}
      {showConfirmModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Confirm Stock Adjustment</h3>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    Review inventory count disparity details before posting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Product Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">Target Product</span>
                  <StatusBadge status={selectedProduct.tracking_type} type="tracking" />
                </div>
                <div className="text-base font-extrabold text-slate-900">{selectedProduct.product_name}</div>
                <div className="text-xs font-mono text-slate-500">
                  SKU: <strong>{selectedProduct.sku || '—'}</strong>
                </div>
              </div>

              {/* Adjustment Calculation Grid */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Previous Stock</span>
                  <span className="text-lg font-mono font-extrabold text-slate-700 mt-1 block">
                    {currentStock} {selectedProduct.unit}
                  </span>
                </div>
                <div className="border-x border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Adjustment</span>
                  <span
                    className={`text-lg font-mono font-extrabold mt-1 block ${
                      adjustmentType === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {adjustmentType === 'IN' ? '+' : '-'} {qtyNum} {selectedProduct.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">New Live Stock</span>
                  <span className="text-lg font-mono font-black text-orange-600 mt-1 block">
                    {calculatedNewStock} {selectedProduct.unit}
                  </span>
                </div>
              </div>

              {/* Serial Numbers Summary (if applicable) */}
              {selectedProduct.tracking_type === 'SERIAL_NUMBER' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Barcode size={14} className="text-amber-700" />
                    <span>
                      {adjustmentType === 'IN'
                        ? `Serials Being Added (${parsedInSerials.length})`
                        : `Serials Being Deducted (${selectedSerialsToDeduct.length || 'FIFO Auto-Pick'})`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto font-mono text-[11px]">
                    {adjustmentType === 'IN'
                      ? parsedInSerials.map((sn, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                            {sn}
                          </span>
                        ))
                      : selectedSerialsToDeduct.length > 0
                      ? selectedSerialsToDeduct.map((sn, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                            {sn}
                          </span>
                        ))
                      : (
                          <span className="text-slate-500 italic">
                            First {qtyNum} available serial number(s) will be deducted automatically in FIFO order.
                          </span>
                        )}
                  </div>
                </div>
              )}

              {/* Reason Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">Adjustment Audit Reason</span>
                <p className="text-slate-800 font-medium mt-1 leading-relaxed">{reason}</p>
              </div>

              {/* Immutable Ledger Notice */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <p>
                  This action adjusts physical stock across OCTANE ERP (POS Billing, Stock Ledger, Inventory Overview) and logs an immutable{' '}
                  <span className="font-mono font-bold text-slate-800">
                    {adjustmentType === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'}
                  </span>{' '}
                  StockMovement ledger transaction.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjustment}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Applying Adjustment...</span>
                  </>
                ) : (
                  <span>Confirm & Apply Adjustment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RECENT STOCK ADJUSTMENTS AUDIT HISTORY TABLE                   */}
      {/* ------------------------------------------------------------- */}
      <Card className="p-6 bg-white border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-orange-600" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Recent Stock Adjustments History
            </h2>
          </div>
          <button
            type="button"
            onClick={fetchRecentAdjustments}
            className="text-xs font-bold text-slate-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loadingAdjustments ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {recentAdjustments.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <FileText size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No stock adjustment movements recorded yet.</p>
            <p className="text-[11px] mt-0.5">Use the form above to record physical stock disparity corrections.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="px-3.5 py-2.5 text-left">Date & Time</th>
                  <th className="px-3.5 py-2.5 text-left">Product</th>
                  <th className="px-3.5 py-2.5 text-center">Direction</th>
                  <th className="px-3.5 py-2.5 text-right">Quantity</th>
                  <th className="px-3.5 py-2.5 text-left">Reason / Audit Notes</th>
                  <th className="px-3.5 py-2.5 text-left">Adjusted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAdjustments.map((adj, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(adj.created_at).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      {adj.product_name || `Product #${adj.product}`}
                      {adj.serial_number_text && (
                        <div className="text-[10px] font-mono text-amber-700">S/N: {adj.serial_number_text}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          adj.movement_type === 'ADJUSTMENT_IN'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        {adj.movement_type === 'ADJUSTMENT_IN' ? 'IN (+)' : 'OUT (-)'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                      {adj.quantity}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate" title={adj.notes}>
                      {adj.notes || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 font-mono">
                      {adj.created_by_username || 'admin'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StockAdjustment;
