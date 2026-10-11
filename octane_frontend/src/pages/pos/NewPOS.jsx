import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Sparkles,
  Tag,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert,
  Wrench,
  Phone,
  Edit2,
  UserPlus,
  X,
  Check,
  Banknote,
  QrCode,
  Building2,
  FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import CustomerFormModal from '../../components/forms/CustomerFormModal';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';

export const NewPOS = () => {
  const { user } = useAuth();

  // Data Masters
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [productSearch, setProductSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [posItemTypeFilter, setPosItemTypeFilter] = useState('ALL'); // 'ALL' | 'PRODUCTS' | 'SERVICES'
  const [customerSearch, setCustomerSearch] = useState('');

  // Customer State & Lookup Controls
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = Walk-in Cash Customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerLookupOpen, setIsCustomerLookupOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [initialMobileForNew, setInitialMobileForNew] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');

  const handleCustomerSaved = (savedCustomer) => {
    if (!savedCustomer) return;
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === savedCustomer.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedCustomer;
        return copy;
      }
      return [savedCustomer, ...prev];
    });
    setSelectedCustomer(savedCustomer);
    setIsCustomerModalOpen(false);
    setIsCustomerLookupOpen(false);
    setCustomerToEdit(null);
    setInitialMobileForNew('');
    toast.success(`Customer "${savedCustomer.name}" selected for billing.`);
  };

  // Cart State
  const [cart, setCart] = useState([]);
  const [isGstInvoice, setIsGstInvoice] = useState(true); // true = GST Tax Invoice (INV-), false = Non-GST Bill (EST-)

  // Available Serial Numbers per Product Cache: { [productId]: [ { id, serial_number, status } ] }
  const [availableSerialsCache, setAvailableSerialsCache] = useState({});
  const [availableSerialsList, setAvailableSerialsList] = useState([]);

  // Payment Breakdown State: [ { id, payer: 'BUSINESS' | partnerId, payment_mode: 'CASH', amount: 1000, reference_number: '' } ]
  const [payments, setPayments] = useState([
    { id: 1, payer: 'BUSINESS', payment_mode: 'CASH', amount: '', reference_number: '' }
  ]);
  const [showSplitPayment, setShowSplitPayment] = useState(false);

  // Submit / Completion State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successInvoice, setSuccessInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);

  // Barcode input ref
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchInitialPOSData();
  }, []);

  const fetchInitialPOSData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, custRes, partRes, servRes, serialsRes, profRes, servCatRes] = await Promise.all([
        api.getProducts(),
        api.getProductCategories(),
        api.getCustomers(),
        api.getPartners(),
        api.getServices(),
        api.getSerialNumbers('?status=AVAILABLE').catch(() => []),
        api.getBusinessProfile().catch(() => null),
        api.getServiceCategories().catch(() => []),
      ]);

      const prodList = Array.isArray(prodRes) ? prodRes : prodRes.results || [];
      const catList = Array.isArray(catRes) ? catRes : catRes.results || [];
      const custList = Array.isArray(custRes) ? custRes : custRes.results || [];
      const partList = Array.isArray(partRes) ? partRes : partRes.results || [];
      const servList = Array.isArray(servRes) ? servRes : servRes.results || [];
      const serialList = Array.isArray(serialsRes) ? serialsRes : serialsRes?.results || [];
      const servCatList = Array.isArray(servCatRes) ? servCatRes : servCatRes?.results || [];

      setProducts(prodList);
      setCategories(catList);
      setServiceCategories(servCatList);
      setCustomers(custList);
      setPartners(partList);
      setServices(servList.filter((s) => s.is_active !== false));
      setAvailableSerialsList(serialList);
      if (profRes) setBusinessProfile(profRes);

      const preloadedCache = {};
      serialList.forEach((sn) => {
        const pId = sn.product;
        if (!preloadedCache[pId]) preloadedCache[pId] = [];
        preloadedCache[pId].push(sn);
      });
      setAvailableSerialsCache(preloadedCache);
    } catch (err) {
      console.error('Error fetching POS prerequisites:', err);
      setError(err.message || 'Failed to load POS terminal data.');
      toast.error('Failed to load POS terminal data.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available serial numbers for a serial-tracked product
  const fetchSerialsForProduct = async (productId) => {
    if (availableSerialsCache[productId]) return availableSerialsCache[productId];
    try {
      const res = await api.getSerialNumbers(`?product=${productId}&status=AVAILABLE`);
      const serialList = Array.isArray(res) ? res : res.results || [];
      setAvailableSerialsCache((prev) => ({ ...prev, [productId]: serialList }));
      return serialList;
    } catch (err) {
      console.error('Error fetching serial numbers for product:', productId, err);
      return [];
    }
  };

  // Combined Filtered Catalog (Products + Services with Multi-Field & Serial Number Search)
  const filteredCatalog = useMemo(() => {
    const items = [];

    // Build serial numbers lookup map by product ID
    const productSerialsMap = {};
    availableSerialsList.forEach((sn) => {
      const pId = sn.product;
      if (!productSerialsMap[pId]) productSerialsMap[pId] = [];
      if (sn.serial_number) productSerialsMap[pId].push(sn.serial_number);
    });

    const isFiltered = selectedCategory && selectedCategory !== 'ALL';
    let targetProdCatId = null;
    let targetServCatId = null;

    if (isFiltered) {
      if (selectedCategory.startsWith('PROD_')) {
        targetProdCatId = selectedCategory.replace('PROD_', '');
      } else if (selectedCategory.startsWith('SERV_')) {
        targetServCatId = selectedCategory.replace('SERV_', '');
      } else {
        // Fallback for legacy numeric string
        targetProdCatId = selectedCategory;
      }
    }

    // Add Products (if filter is ALL or PRODUCTS)
    if (posItemTypeFilter === 'ALL' || posItemTypeFilter === 'PRODUCTS') {
      products.forEach((p) => {
        const stock = parseFloat(p.current_stock || p.stock || 0);
        if (stock <= 0) return; // Do not show out-of-stock products

        if (selectedCategory !== 'ALL' && String(p.category) !== String(selectedCategory)) {
          return;
        }

        let matchingSerialText = null;

        if (productSearch.trim()) {
          const query = productSearch.toLowerCase().trim();
          const matchesName = (p.name || '').toLowerCase().includes(query);
          const matchesSku = (p.sku || '').toLowerCase().includes(query);
          const matchesBrand = (p.brand_name || p.brand || '').toLowerCase().includes(query);
          const matchesModel = (p.model_number || '').toLowerCase().includes(query);
          const matchesBarcode = (p.barcode || '').toLowerCase().includes(query);
          const matchesCategory = (p.category_name || '').toLowerCase().includes(query);
          const matchesSpecs = (p.specifications_text || '').toLowerCase().includes(query);
          const matchesHsn = (p.hsn_sac || '').toLowerCase().includes(query);

          // Serial number matching
          const prodSerials = productSerialsMap[p.id] || [];
          const foundSerial = prodSerials.find((sn) => sn.toLowerCase().includes(query));
          if (foundSerial) {
            matchingSerialText = foundSerial;
          }

          if (
            !matchesName &&
            !matchesSku &&
            !matchesBrand &&
            !matchesModel &&
            !matchesBarcode &&
            !matchesCategory &&
            !matchesSpecs &&
            !matchesHsn &&
            !foundSerial
          ) {
            return;
          }
        }

        items.push({
          ...p,
          item_type: 'PRODUCT',
          display_title: p.name,
          display_code: p.sku || 'SKU',
          display_price: parseFloat(p.selling_price || 0),
          matching_serial: matchingSerialText,
        });
      });
    }

    // Add Services (if filter is ALL or SERVICES)
    if (posItemTypeFilter === 'ALL' || posItemTypeFilter === 'SERVICES') {
      services.forEach((s) => {
        if (selectedCategory !== 'ALL' && String(s.category) !== String(selectedCategory)) {
          return;
        }

        if (productSearch.trim()) {
          const query = productSearch.toLowerCase().trim();
          const matchesName = (s.service_name || '').toLowerCase().includes(query);
          const matchesSac = (s.sac || '').toLowerCase().includes(query);
          const matchesDesc = (s.description || '').toLowerCase().includes(query);
          const matchesCategory = (s.category_name || '').toLowerCase().includes(query);
          if (!matchesName && !matchesSac && !matchesDesc && !matchesCategory) {
            return;
          }
        }

        items.push({
          ...s,
          item_type: 'SERVICE',
          display_title: s.service_name,
          display_code: s.sac ? `SAC: ${s.sac}` : 'SERVICE',
          display_price: parseFloat(s.default_rate || 0),
        });
      });
    }

    return items;
  }, [products, services, posItemTypeFilter, selectedCategory, productSearch, availableSerialsList]);

  // Handle Quick Add to Cart (Product or Service, with optional pre-selected serial number)
  const handleAddToCart = async (item, specificSerial = null) => {
    const serialToAssign = specificSerial || item.matching_serial || null;

    if (item.item_type === 'SERVICE') {
      // Add Service to cart
      const existingIndex = cart.findIndex((c) => c.item_type === 'SERVICE' && c.service_id === item.id);

      if (existingIndex >= 0) {
        const updatedCart = [...cart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: updatedCart[existingIndex].quantity + 1,
        };
        setCart(updatedCart);
        toast.info(`Updated "${item.service_name}" quantity to ${updatedCart[existingIndex].quantity + 1}.`);
      } else {
        const catGst = item.gst_rate !== undefined && item.gst_rate !== null ? parseFloat(item.gst_rate) : 18.0;
        const newItem = {
          item_type: 'SERVICE',
          service_id: item.id,
          product_name: item.service_name,
          sku: item.sac ? `SAC: ${item.sac}` : 'SERVICE',
          brand: 'Service Master',
          specifications_text: item.description || `SAC: ${item.sac || '998313'}`,
          tracking_type: 'NONE',
          current_stock: 999999, // Unlimited stock
          unit: 'NOS',
          selling_price: parseFloat(item.default_rate || 0),
          discount_pct: 0,
          original_gst_rate: catGst,
          gst_rate: isGstInvoice ? catGst : 0.0,
          hsn_sac: item.sac || '998313',
          quantity: 1,
          selected_serials: [],
        };
        setCart((prev) => [...prev, newItem]);
        toast.success(`Added Service "${item.service_name}" to cart.`);
      }
      return;
    }

    // Product handling
    const stock = parseFloat(item.current_stock || item.stock || 0);
    if (stock <= 0) {
      toast.error(`Product "${item.name}" is out of stock!`);
      return;
    }

    const existingIndex = cart.findIndex((c) => c.item_type === 'PRODUCT' && c.product_id === item.id);

    if (existingIndex >= 0) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity >= stock) {
        toast.warning(`Cannot add more. Available stock for "${item.name}" is ${stock}.`);
        return;
      }

      const updatedCart = [...cart];
      const updatedSerials = [...(existingItem.selected_serials || [])];

      if (item.tracking_type === 'SERIAL_NUMBER' && serialToAssign) {
        if (!updatedSerials.includes(serialToAssign)) {
          const emptySlot = updatedSerials.indexOf('');
          if (emptySlot >= 0) {
            updatedSerials[emptySlot] = serialToAssign;
          } else {
            updatedSerials.push(serialToAssign);
          }
        }
      } else if (item.tracking_type === 'SERIAL_NUMBER') {
        updatedSerials.push('');
      }

      updatedCart[existingIndex] = {
        ...existingItem,
        quantity: Math.max(existingItem.quantity + 1, updatedSerials.length),
        selected_serials: updatedSerials,
      };
      setCart(updatedCart);
      toast.info(serialToAssign ? `Added "${item.name}" (S/N: ${serialToAssign}) to cart.` : `Updated "${item.name}" quantity to ${existingItem.quantity + 1}.`);
    } else {
      const initialSerials = item.tracking_type === 'SERIAL_NUMBER'
        ? [serialToAssign || '']
        : [];

      const catGst = item.gst_rate !== undefined && item.gst_rate !== null ? parseFloat(item.gst_rate) : 18.0;
      const newItem = {
        item_type: 'PRODUCT',
        product_id: item.id,
        product_name: item.name,
        sku: item.sku || '',
        brand: item.brand_name || item.brand || '',
        specifications_text: item.specifications_text || '',
        tracking_type: item.tracking_type || 'QUANTITY',
        current_stock: stock,
        unit: item.unit || 'NOS',
        selling_price: parseFloat(item.selling_price || 0),
        discount_pct: 0,
        original_gst_rate: catGst,
        gst_rate: isGstInvoice ? catGst : 0.0,
        hsn_sac: item.hsn_sac || '852411',
        quantity: 1,
        selected_serials: initialSerials,
      };

      setCart((prev) => [...prev, newItem]);
      toast.success(serialToAssign ? `Added "${item.name}" (S/N: ${serialToAssign}) to cart.` : `Added "${item.name}" to cart.`);

      if (item.tracking_type === 'SERIAL_NUMBER') {
        fetchSerialsForProduct(item.id);
      }
    }
  };

  // Handle Barcode / SKU / Serial Number Scan Entry
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim().toLowerCase();

    // 1. First check if code matches product barcode or SKU
    let matched = products.find(
      (p) =>
        (p.barcode || '').toLowerCase() === code ||
        (p.sku || '').toLowerCase() === code
    );
    let matchedSerial = null;

    // 2. If not matched, check serial numbers directly
    if (!matched) {
      const serialObj = availableSerialsList.find((sn) => (sn.serial_number || '').toLowerCase() === code);
      if (serialObj) {
        matched = products.find((p) => String(p.id) === String(serialObj.product));
        matchedSerial = serialObj.serial_number;
      }
    }

    if (matched) {
      handleAddToCart({ ...matched, item_type: 'PRODUCT' }, matchedSerial);
      setBarcodeInput('');
      if (matchedSerial) {
        toast.success(`Scanned Serial Number "${matchedSerial}" for "${matched.name}".`);
      }
    } else {
      toast.error(`No product or serial number found matching: "${barcodeInput}"`);
    }
  };

  // Update Item Quantity in Cart
  const handleQuantityChange = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    if (item.item_type !== 'SERVICE' && newQty > item.current_stock) {
      toast.warning(`Maximum available stock for "${item.product_name}" is ${item.current_stock}.`);
      return;
    }

    // Adjust serials array size
    let updatedSerials = [...(item.selected_serials || [])];
    if (newQty > updatedSerials.length) {
      while (updatedSerials.length < newQty) updatedSerials.push('');
    } else if (newQty < updatedSerials.length) {
      updatedSerials = updatedSerials.slice(0, newQty);
    }

    updated[index] = {
      ...item,
      quantity: newQty,
      selected_serials: updatedSerials,
    };

    setCart(updated);
  };

  // Direct Quantity Input
  const handleQuantitySet = (index, val) => {
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty <= 0) return;

    const updated = [...cart];
    const item = updated[index];

    if (item.item_type !== 'SERVICE' && qty > item.current_stock) {
      toast.warning(`Maximum available stock for "${item.product_name}" is ${item.current_stock}.`);
      return;
    }

    let updatedSerials = [...(item.selected_serials || [])];
    if (qty > updatedSerials.length) {
      while (updatedSerials.length < qty) updatedSerials.push('');
    } else if (qty < updatedSerials.length) {
      updatedSerials = updatedSerials.slice(0, qty);
    }

    updated[index] = {
      ...item,
      quantity: qty,
      selected_serials: updatedSerials,
    };
    setCart(updated);
  };

  // Switch invoice billing stream between GST Tax Invoice and Non-GST Bill
  const handleToggleInvoiceType = (isGst) => {
    setIsGstInvoice(isGst);
    if (!isGst) {
      setCart((prev) => prev.map((item) => ({ ...item, gst_rate: 0.0 })));
      toast.info('Switched to Non-GST Bill (EST- series). All items set to 0% tax.');
    } else {
      setCart((prev) => prev.map((item) => ({
        ...item,
        gst_rate: item.original_gst_rate !== undefined ? item.original_gst_rate : 18.0
      })));
      toast.info('Switched to GST Tax Invoice (INV- series).');
    }
  };

  // Update Price, Discount, or GST Rate
  const handleItemFieldChange = (index, field, val) => {
    const parsedVal = val === '' ? 0 : (parseFloat(val) || 0);
    const updated = [...cart];
    updated[index] = {
      ...updated[index],
      [field]: parsedVal,
    };
    setCart(updated);

    // Auto-sync stream toggle when user changes item GST rate
    if (field === 'gst_rate') {
      const allZero = updated.every((it) => (parseFloat(it.gst_rate) || 0) === 0);
      if (allZero && parsedVal === 0) {
        setIsGstInvoice(false);
      } else if (parsedVal > 0) {
        setIsGstInvoice(true);
      }
    }
  };

  // Serial Selection for a Cart Item
  const handleSerialChange = (cartIndex, serialUnitIndex, selectedSerialStr) => {
    // Check if duplicate serial selected elsewhere in cart
    if (selectedSerialStr) {
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const serials = item.selected_serials || [];
        for (let j = 0; j < serials.length; j++) {
          if (i === cartIndex && j === serialUnitIndex) continue;
          if (serials[j] === selectedSerialStr) {
            toast.error(`Serial number "${selectedSerialStr}" is already selected for another unit!`);
            return;
          }
        }
      }
    }

    const updatedCart = [...cart];
    const updatedSerials = [...(updatedCart[cartIndex].selected_serials || [])];
    updatedSerials[serialUnitIndex] = selectedSerialStr;
    updatedCart[cartIndex] = {
      ...updatedCart[cartIndex],
      selected_serials: updatedSerials,
    };
    setCart(updatedCart);
  };

  // Remove Item from Cart
  const handleRemoveItem = (index) => {
    const item = cart[index];
    setCart((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Removed "${item.product_name}" from cart.`);
  };

  // Clear Entire Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setIsClearCartConfirmOpen(true);
  };

  const handleConfirmClearCart = () => {
    setCart([]);
    setIsClearCartConfirmOpen(false);
    toast.info('POS Cart cleared.');
  };

  // Financial Summary Calculations
  const summary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const sellerStateCode = '29'; // Default Karnataka
    const buyerStateCode = selectedCustomer ? (selectedCustomer.state_code || '29') : sellerStateCode;
    const isInterstate = sellerStateCode !== buyerStateCode;

    cart.forEach((item) => {
      const qty = item.quantity || 1;
      const rate = item.selling_price || 0;
      const discPct = item.discount_pct || 0;
      const gstRate = isGstInvoice
        ? (item.gst_rate !== undefined && item.gst_rate !== null ? parseFloat(item.gst_rate) : 18.0)
        : 0.0;

      const lineGross = qty * rate;
      const lineDisc = lineGross * (discPct / 100);
      const lineTaxable = lineGross - lineDisc;

      let lineTax = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (gstRate > 0) {
        if (isInterstate) {
          igst = lineTaxable * (gstRate / 100);
          lineTax = igst;
        } else {
          cgst = lineTaxable * (gstRate / 200);
          sgst = lineTaxable * (gstRate / 200);
          lineTax = cgst + sgst;
        }
      }

      subtotal += lineGross;
      totalDiscount += lineDisc;
      totalTaxable += lineTaxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
    });

    const totalTax = isInterstate ? totalIgst : (totalCgst + totalSgst);
    const grandTotal = totalTaxable + totalTax;

    // Payment Totals
    const totalPaid = payments.reduce((acc, p) => (p.payment_mode === 'CREDIT' ? acc : acc + (parseFloat(p.amount) || 0)), 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    let paymentStatus = 'UNPAID';
    if (totalPaid >= grandTotal && grandTotal > 0) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return {
      subtotal,
      totalDiscount,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      grandTotal,
      totalPaid,
      balanceDue,
      paymentStatus,
      isInterstate,
    };
  }, [cart, selectedCustomer, payments, isGstInvoice]);

  // Auto-fill primary payment row when grand total changes and there's only 1 default payment row
  useEffect(() => {
    if (payments.length === 1 && (payments[0].amount === '' || parseFloat(payments[0].amount || 0) === 0 || activeQuickPayMode)) {
      setPayments([
        { ...payments[0], amount: summary.grandTotal > 0 ? summary.grandTotal.toFixed(2) : '' }
      ]);
    }
  }, [summary.grandTotal]);

  // Payment Row Handlers
  const handleAddPaymentRow = () => {
    setPayments((prev) => [
      ...prev,
      { id: Date.now(), payer: 'BUSINESS', payment_mode: 'CASH', amount: '', reference_number: '' }
    ]);
  };

  const handleRemovePaymentRow = (index) => {
    if (payments.length === 1) {
      toast.warning('At least one payment row is required.');
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

  // Quick Pay Full Buttons
  const handleQuickPayFull = (mode) => {
    if (summary.grandTotal <= 0) return;
    setPayments([
      { id: Date.now(), payer: 'BUSINESS', payment_mode: mode, amount: summary.grandTotal.toFixed(2), reference_number: '' }
    ]);
    toast.info(`Set full payment via ${mode}.`);
  };

  const changeToReturn = (summary.totalPaid > summary.grandTotal && summary.grandTotal > 0)
    ? (summary.totalPaid - summary.grandTotal)
    : 0;

  const activeQuickPayMode = (payments.length === 1 && parseFloat(payments[0].amount || 0) >= summary.grandTotal && summary.grandTotal > 0)
    ? payments[0].payment_mode
    : null;

  // Handle Customer Creation Success
  const handleCustomerCreated = (newCust) => {
    api.getCustomers().then((res) => {
      const list = Array.isArray(res) ? res : res.results || [];
      setCustomers(list);
      if (newCust && newCust.id) {
        setSelectedCustomer(newCust);
        toast.success(`Selected newly created customer: "${newCust.name}"`);
      }
    });
  };

  // Complete Sale / Submit POS Invoice
  const handleCompleteSale = async () => {
    setFormError(null);

    // 1. Cart Validation
    if (cart.length === 0) {
      const err = 'Cannot complete sale. Cart is empty!';
      setFormError(err);
      toast.error(err);
      return;
    }

    // 2. Serial Number Validation
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      if (item.tracking_type === 'SERIAL_NUMBER') {
        const serials = item.selected_serials || [];
        if (serials.length !== item.quantity || serials.some((s) => !s.trim())) {
          const err = `Please select serial number(s) for product "${item.product_name}".`;
          setFormError(err);
          toast.error(err);
          return;
        }
      }
    }

    // 3. Payment Validation
    if (summary.totalPaid > summary.grandTotal + 0.01) {
      const err = `Total payment (₹${summary.totalPaid.toFixed(2)}) cannot exceed Invoice Grand Total (₹${summary.grandTotal.toFixed(2)}).`;
      setFormError(err);
      toast.error(err);
      return;
    }

    setSubmitting(true);

    // Prepare Invoice Payload according to backend CreateInvoiceInputSerializer
    const activePayments = payments.filter((p) => (parseFloat(p.amount) || 0) > 0 && p.payment_mode !== 'CREDIT');
    const partnerPayment = activePayments.find((p) => p.payer !== 'BUSINESS');

    let partnerAllocationJson = null;
    if (partnerPayment) {
      const partnerObj = partners.find((pt) => String(pt.id) === String(partnerPayment.payer));
      partnerAllocationJson = {
        partner_id: parseInt(partnerPayment.payer, 10),
        partner_name: partnerObj ? partnerObj.name : 'Partner',
        amount: parseFloat(partnerPayment.amount),
        mode: partnerPayment.payment_mode,
      };
    }

    // Expand cart items into line items payload for backend (Products & Services)
    const itemsPayload = [];
    cart.forEach((item) => {
      const itemGst = isGstInvoice
        ? (item.gst_rate !== undefined && item.gst_rate !== null ? parseFloat(item.gst_rate) : 18.0)
        : 0.0;
      if (item.item_type === 'SERVICE') {
        itemsPayload.push({
          item_type: 'SERVICE',
          service_id: item.service_id,
          description: item.product_name,
          hsn_sac: item.hsn_sac || '998313',
          qty: item.quantity,
          unit: 'NOS',
          rate: item.selling_price,
          discount: item.discount_pct || 0,
          gst_rate: itemGst,
        });
      } else if (item.tracking_type === 'SERIAL_NUMBER') {
        // Create 1 line item per serial unit
        (item.selected_serials || []).forEach((sn) => {
          itemsPayload.push({
            item_type: 'PRODUCT',
            product_id: item.product_id,
            serial_number: sn,
            description: item.product_name,
            hsn_sac: item.hsn_sac,
            qty: 1,
            unit: item.unit,
            rate: item.selling_price,
            discount: item.discount_pct || 0,
            gst_rate: itemGst,
          });
        });
      } else {
        itemsPayload.push({
          item_type: 'PRODUCT',
          product_id: item.product_id,
          description: item.product_name,
          hsn_sac: item.hsn_sac,
          qty: item.quantity,
          unit: item.unit,
          rate: item.selling_price,
          discount: item.discount_pct || 0,
          gst_rate: itemGst,
        });
      }
    });

    const payload = {
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      buyer_name: selectedCustomer ? selectedCustomer.name : 'Cash Customer',
      buyer_gstin: selectedCustomer ? selectedCustomer.gstin : '',
      buyer_state_code: selectedCustomer ? (selectedCustomer.state_code || '29') : '29',
      buyer_address: selectedCustomer ? (selectedCustomer.billing_address_line1 || '') : '',
      invoice_date: new Date().toISOString().split('T')[0],
      mode_of_payment: activePayments.length > 0 ? activePayments[0].payment_mode : 'CASH',
      items: itemsPayload,
      payments: activePayments.map((p) => ({
        payment_mode: p.payment_mode,
        amount: parseFloat(p.amount) || 0,
        reference_number: p.reference_number || '',
      })),
      partner_allocation_json: partnerAllocationJson,
      invoice_type: (!isGstInvoice || (summary.totalTax === 0 && !selectedCustomer?.gstin)) ? 'NON_GST' : 'TAX_INVOICE',
      is_gst: !(!isGstInvoice || (summary.totalTax === 0 && !selectedCustomer?.gstin)),
    };

    try {
      const createdInvoice = await api.createInvoice(payload);
      toast.success(`Sale completed! Invoice ${createdInvoice.invoice_number || ''} generated successfully.`);

      // Store complete invoice object for A4 Print Modal
      setSuccessInvoice({
        ...createdInvoice,
        is_purchase: false,
        customer_name: selectedCustomer ? selectedCustomer.name : 'Cash Customer',
        customer_mobile: selectedCustomer ? selectedCustomer.mobile : '',
        customer_address: selectedCustomer ? selectedCustomer.billing_address_line1 : '',
        customer_gstin: selectedCustomer ? selectedCustomer.gstin : '',
        customer_state: selectedCustomer ? selectedCustomer.state_name : 'Karnataka',
        customer_state_code: selectedCustomer ? selectedCustomer.state_code : '29',
      });

      // Clear Cart & Form for next cashier sale
      setCart([]);
      setSelectedCustomer(null);
      setPayments([{ id: Date.now(), payer: 'BUSINESS', payment_mode: 'CASH', amount: '', reference_number: '' }]);
      setFormError(null);
      setIsPrintModalOpen(true);

      // Refresh product stock and business profile counters in background
      api.getProducts().then((res) => setProducts(Array.isArray(res) ? res : res.results || []));
      api.getBusinessProfile().then((res) => { if (res) setBusinessProfile(res); });
    } catch (err) {
      console.error('Failed to process POS checkout:', err);
      const errMsg = err.message || 'Failed to complete sale transaction.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Initializing POS Terminal Catalog & Stock..." />;
  if (error) return <ErrorState message={error} onRetry={fetchInitialPOSData} />;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
      {/* 1. Terminal Top Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Terminal Title & Active Status */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25 flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">POS Billing Terminal</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE TERMINAL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cashier: <strong className="text-slate-800 font-semibold">{user?.first_name || user?.username || 'Cashier'}</strong> • Active Store Session
            </p>
          </div>
        </div>

        {/* Barcode Fast Scan & Customer Selection */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Barcode Scanner Input */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white px-3 py-2 rounded-xl border border-slate-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all shadow-2xs"
          >
            <Barcode size={17} className="text-orange-600 flex-shrink-0" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode / SKU..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-44 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none uppercase placeholder:text-slate-400 placeholder:normal-case"
            />
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ↵ Enter
            </kbd>
          </form>

          {/* Customer Selection Pill */}
          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 pl-2 pr-1">
              <Users size={15} className="text-slate-500" />
              <select
                value={selectedCustomer ? selectedCustomer.id : ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) setSelectedCustomer(null);
                  else {
                    const cust = customers.find((c) => String(c.id) === String(id));
                    setSelectedCustomer(cust || null);
                  }
                }}
                className="py-1 bg-transparent text-xs font-bold text-slate-900 focus:outline-none max-w-[170px] truncate cursor-pointer"
              >
                <option value="">Walk-in Cash Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setLookupPhone(selectedCustomer?.mobile || '');
                setIsCustomerLookupOpen(true);
              }}
              className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Lookup customer by Phone Number"
            >
              <Phone size={13} />
              <span>Verify / + New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Customer Information Badge Banner */}
      {selectedCustomer && (
        <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 text-white font-bold flex items-center justify-center text-xs">
              {selectedCustomer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>{selectedCustomer.name}</span>
                <span className="px-1.5 py-0.2 text-[9.5px] font-mono font-bold bg-orange-100 text-orange-800 rounded">
                  {selectedCustomer.customer_type || 'INDIVIDUAL'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-3 mt-0.5">
                {selectedCustomer.mobile && <span>Ph: <strong>{selectedCustomer.mobile}</strong></span>}
                {selectedCustomer.gstin && <span>GSTIN: <strong className="font-mono">{selectedCustomer.gstin}</strong></span>}
                <span>State: <strong>{selectedCustomer.state_name || 'Karnataka'} ({selectedCustomer.state_code || '29'})</strong></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCustomerToEdit(selectedCustomer);
                setInitialMobileForNew('');
                setIsCustomerModalOpen(true);
              }}
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
              title="Edit Customer Profile"
            >
              <Edit2 size={13} />
              <span>Edit Details</span>
            </button>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-xs font-bold text-orange-700 hover:text-orange-900 underline cursor-pointer"
            >
              Switch to Walk-in
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Terminal Layout Grid (Catalog Left 60% • Cart Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT COLUMN: Product & Service Catalog (7 Cols on LG) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Product / Service Search Input */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, serial number / IMEI, SKU, brand, specs..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type Filter Pills (ALL | PRODUCTS | SERVICES) */}
              <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPosItemTypeFilter('ALL');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    posItemTypeFilter === 'ALL'
                      ? 'bg-white text-orange-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono ${posItemTypeFilter === 'ALL' ? 'bg-orange-50 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                    {products.filter(p => parseFloat(p.current_stock || p.stock || 0) > 0).length + services.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPosItemTypeFilter('PRODUCTS');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    posItemTypeFilter === 'PRODUCTS'
                      ? 'bg-white text-orange-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package size={13} />
                  <span>Products</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono ${posItemTypeFilter === 'PRODUCTS' ? 'bg-orange-50 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                    {products.filter(p => parseFloat(p.current_stock || p.stock || 0) > 0).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPosItemTypeFilter('SERVICES');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    posItemTypeFilter === 'SERVICES'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wrench size={13} />
                  <span>Services</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono ${posItemTypeFilter === 'SERVICES' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    {services.length}
                  </span>
                </button>
              </div>

              {/* Category Dropdown */}
              {posItemTypeFilter !== 'SERVICES' && (
                <select
                  id="pos-category-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer flex-shrink-0"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Catalog Grid */}
            {filteredCatalog.length === 0 ? (
              <div className="py-14 text-center text-slate-500 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Package size={36} className="mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <div className="font-extrabold text-slate-700 text-sm">No items found</div>
                <p className="text-[11.5px] text-slate-400 mt-1 max-w-sm mx-auto">
                  {productSearch
                    ? 'No products or services match your search query.'
                    : selectedCategory !== 'ALL'
                    ? 'No items match the selected category in this view.'
                    : 'No active items available.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3.5 max-h-[620px] overflow-y-auto p-1.5 pt-2.5 pb-2.5 pr-2">
                {filteredCatalog.map((item) => {
                  const isService = item.item_type === 'SERVICE';
                  const stock = isService ? 999 : parseFloat(item.current_stock || item.stock || 0);

                  const inCartItem = cart.find((c) =>
                    item.item_type === 'SERVICE'
                      ? c.item_type === 'SERVICE' && c.service_id === item.id
                      : c.item_type === 'PRODUCT' && c.product_id === item.id
                  );
                  const inCartQty = inCartItem ? inCartItem.quantity : 0;

                  return (
                    <div
                      key={`${item.item_type}-${item.id}`}
                      onClick={() => handleAddToCart(item)}
                      className={`p-3.5 bg-white rounded-2xl border transition-all flex flex-col justify-between group relative select-none cursor-pointer ${
                        inCartQty > 0
                          ? 'border-orange-400 ring-2 ring-orange-500/20 bg-orange-50/15 shadow-xs'
                          : isService
                            ? 'border-slate-200 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5'
                            : 'border-slate-200 hover:border-orange-400 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      <div>
                        {/* Header: Item Type & Stock/SAC Badge */}
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          {isService ? (
                            <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Wrench size={10} /> SERVICE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[120px]">
                              {item.brand_name || item.brand || 'PRODUCT'}
                            </span>
                          )}

                          {isService ? (
                            <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              SAC {item.sac || '998313'}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold border flex items-center gap-1 ${
                              stock > 5
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : stock > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${stock > 5 ? 'bg-emerald-500' : stock > 0 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                              {stock > 0 ? `Stock: ${stock} ${item.unit || 'NOS'}` : 'Stock: 0 NOS'}
                            </span>
                          )}
                        </div>

                        {/* Item Title */}
                        <h4 className={`font-bold text-xs text-slate-900 line-clamp-2 min-h-[2.2rem] leading-snug transition-colors ${
                          isService ? 'group-hover:text-indigo-600' : 'group-hover:text-orange-600'
                        }`}>
                          {item.display_title}
                        </h4>

                        {/* Specs / Description Pill (Uniform Height, No Clipping, Serial Match Badge) */}
                        <div className="mt-1.5 min-h-[2rem] overflow-hidden text-[10px] leading-snug">
                          {item.matching_serial ? (
                            <p className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg truncate font-mono font-bold flex items-center gap-1">
                              <Tag size={10} className="shrink-0 text-amber-600" />
                              <span className="truncate">Matches S/N: {item.matching_serial}</span>
                            </p>
                          ) : item.specifications_text || item.description ? (
                            <p className="text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg line-clamp-2">
                              {item.specifications_text || item.description}
                            </p>
                          ) : (
                            <p className="text-slate-400 italic px-1 py-1">
                              {isService ? 'Standard Service' : (item.category_name || 'Hardware Component')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer: Price & Add Button (Stacked row layout - zero collision, zero price clipping) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                        {/* Row 1: SKU on left, Full Price on right */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[50%]" title={item.sku}>
                            {isService ? `GST ${item.gst_rate || 18}%` : (item.sku || 'SKU')}
                          </span>
                          <span className="text-sm font-black text-slate-900 font-mono tracking-tight shrink-0 text-right">
                            ₹{item.display_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Row 2: Full-width tactile action button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item);
                          }}
                          className={`w-full py-1.5 px-3 rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            inCartQty > 0
                              ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/25 ring-2 ring-orange-500/30'
                              : isService
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'
                          }`}
                        >
                          {inCartQty > 0 ? (
                            <>
                              <Check size={13} className="stroke-[3] shrink-0" />
                              <span className="whitespace-nowrap font-extrabold">Added to Bill ({inCartQty})</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} className="stroke-[3] shrink-0" />
                              <span className="whitespace-nowrap font-bold">+ Add to Bill</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: POS Cart, Financial Summary & Checkout (5 Cols on LG) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Current Cart Items</h3>
                  <p className="text-[10.5px] text-slate-400">
                    {cart.reduce((sum, item) => sum + (item.quantity || 1), 0)} total units
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-mono font-bold">
                  {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Clear All Cart Items"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Invoice Stream Toggle: GST Tax Invoice (INV-) vs Non-GST Bill / Estimate (EST-) */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleToggleInvoiceType(true)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isGstInvoice
                    ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                <FileText size={13} />
                <span>GST Tax Invoice</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-extrabold bg-orange-100 text-orange-800">
                  {businessProfile?.next_invoice_number ? `${businessProfile.invoice_prefix || 'INV-'}${businessProfile.next_invoice_number}` : 'INV-'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleInvoiceType(false)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isGstInvoice
                    ? 'bg-white text-indigo-700 shadow-2xs font-extrabold ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                <Tag size={13} />
                <span>Non-GST Bill</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-extrabold bg-indigo-100 text-indigo-800">
                  {businessProfile?.next_non_gst_number ? `${businessProfile.non_gst_prefix || 'EST-'}${businessProfile.next_non_gst_number}` : 'EST-'}
                </span>
              </button>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-300 shadow-2xs">
                  <ShoppingCart size={24} className="stroke-[1.5]" />
                </div>
                <div className="font-bold text-slate-700 text-sm">Your POS Cart is Empty</div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Click any product or service from the catalog on the left, or scan a barcode to add it to this bill.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto p-1 pt-1.5 pb-1 pr-1.5">
                {cart.map((item, idx) => {
                  const lineTotal = item.quantity * item.selling_price * (1 - (item.discount_pct || 0) / 100);
                  const isService = item.item_type === 'SERVICE';
                  const isSerial = !isService && item.tracking_type === 'SERIAL_NUMBER';
                  const availableSerials = availableSerialsCache[item.product_id] || [];

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isService ? 'bg-indigo-50/30 border-indigo-200' : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      {/* Item Top: Badge, Title & Remove */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {isService ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                                <Wrench size={9} /> SERVICE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                <Package size={9} /> PRODUCT
                              </span>
                            )}
                            <span className="font-extrabold text-xs text-slate-900 truncate">{item.product_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.sku} {!isService && `• Stock: ${item.current_stock}`} • {isGstInvoice ? `GST ${parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : 18)}%` : 'Non-GST (0% Tax)'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Serial Number Picker (If Serial Tracked) */}
                      {isSerial && (
                        <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1.5 mt-2">
                          <div className="font-extrabold text-amber-900 text-[10.5px] flex items-center justify-between">
                            <span>Select Serial Number(s) *</span>
                            <span className="font-mono text-[9.5px]">Required: {item.quantity}</span>
                          </div>
                          <div className="space-y-1">
                            {Array.from({ length: item.quantity }).map((_, unitIdx) => (
                              <select
                                key={unitIdx}
                                value={(item.selected_serials || [])[unitIdx] || ''}
                                onChange={(e) => handleSerialChange(idx, unitIdx, e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="">-- Select Serial #{unitIdx + 1} --</option>
                                {availableSerials.map((s) => (
                                   <option key={s.id} value={s.serial_number}>
                                    SN: {s.serial_number}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Line Item Inputs Grid: Qty Stepper, Rate, Disc %, GST %, Line Total */}
                      <div className="flex items-center justify-between gap-1.5 text-xs font-mono pt-2 border-t border-slate-100 mt-2">
                        {/* Qty Stepper */}
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs h-8 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, -1)}
                            className="px-1.5 py-1 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.current_stock}
                            value={item.quantity}
                            onChange={(e) => handleQuantitySet(idx, e.target.value)}
                            className="w-8 text-center font-bold text-xs bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, 1)}
                            className="px-1.5 py-1 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        {/* Rate Input */}
                        <div className="w-20 min-w-0 flex-1">
                          <input
                            type="number"
                            step="0.01"
                            value={item.selling_price}
                            onChange={(e) => handleItemFieldChange(idx, 'selling_price', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 h-8"
                            title="Unit Rate"
                            placeholder="Rate"
                          />
                        </div>

                        {/* Disc % Input */}
                        <div className="w-14 shrink-0">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Disc%"
                            value={item.discount_pct || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'discount_pct', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-400 h-8"
                            title="Discount %"
                          />
                        </div>

                        {/* GST % Selection Dropdown / Non-GST indicator */}
                        <div className="w-[82px] shrink-0">
                          {isGstInvoice ? (
                            <select
                              value={parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : 18)}
                              onChange={(e) => handleItemFieldChange(idx, 'gst_rate', e.target.value)}
                              className="w-full px-1 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer h-8"
                              title="Select GST Rate %"
                            >
                              <option value={0}>0% GST</option>
                              <option value={5}>5% GST</option>
                              <option value={12}>12% GST</option>
                              <option value={18}>18% GST</option>
                              <option value={28}>28% GST</option>
                              {![0, 5, 12, 18, 28].includes(parseFloat(item.gst_rate ?? 18)) && (
                                <option value={parseFloat(item.gst_rate)}>{parseFloat(item.gst_rate)}% GST</option>
                              )}
                            </select>
                          ) : (
                            <div className="w-full px-1 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-mono font-bold text-slate-500 text-center flex items-center justify-center h-8" title="Non-GST Mode: Tax is 0%">
                              0% GST
                            </div>
                          )}
                        </div>

                        {/* Line Total */}
                        <div className="text-right font-extrabold text-slate-900 text-xs shrink-0 whitespace-nowrap pl-1">
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Financial Summary Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span className="font-sans font-medium">{isGstInvoice ? 'Taxable Subtotal:' : 'Subtotal:'}</span>
                <span>₹{summary.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {isGstInvoice ? (
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans font-medium">Total GST ({summary.isInterstate ? 'IGST' : 'CGST + SGST'}):</span>
                  <span>₹{summary.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="flex justify-between text-indigo-700 font-semibold">
                  <span className="font-sans font-medium">GST Amount:</span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-[10px] font-bold">₹0.00 (Non-GST / Estimate)</span>
                </div>
              )}
              {summary.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span className="font-sans font-medium">Total Discount:</span>
                  <span>- ₹{summary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="font-sans font-extrabold text-sm text-slate-900">Grand Total:</span>
                <span className={`text-xl font-extrabold tracking-tight ${isGstInvoice ? 'text-orange-600' : 'text-indigo-700'}`}>
                  ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector & Breakdown */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  Payment Method
                </span>
                <button
                  type="button"
                  onClick={() => setShowSplitPayment(!showSplitPayment)}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1"
                >
                  <span>{showSplitPayment ? 'Hide Split Options' : '+ Split / Partner Payment'}</span>
                </button>
              </div>

              {/* 4 Quick Payment Mode Cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { mode: 'CASH', label: 'Cash', icon: Banknote },
                  { mode: 'UPI', label: 'UPI / QR', icon: QrCode },
                  { mode: 'CARD', label: 'Card', icon: CreditCard },
                  { mode: 'BANK_TRANSFER', label: 'Bank', icon: Building2 },
                ].map(({ mode, label, icon: Icon }) => {
                  const isSelected = activeQuickPayMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleQuickPayFull(mode)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 border-orange-500 text-orange-700 ring-2 ring-orange-500/20 shadow-2xs font-extrabold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold'
                      }`}
                    >
                      <Icon size={18} className={isSelected ? 'text-orange-600' : 'text-slate-500'} />
                      <span className="text-[11px]">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Realtime Paid vs Due / Change Indicator */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                <span className="text-emerald-700 font-bold font-sans">
                  Total Paid: ₹{summary.totalPaid.toFixed(2)}
                </span>
                {summary.balanceDue > 0 ? (
                  <span className="text-rose-600 font-bold font-sans">
                    Due: ₹{summary.balanceDue.toFixed(2)}
                  </span>
                ) : changeToReturn > 0 ? (
                  <span className="text-emerald-600 font-bold font-sans">
                    Change to Return: ₹{changeToReturn.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold font-sans">
                    ✓ Paid in Full
                  </span>
                )}
              </div>

              {/* Expandable Split Payment Rows */}
              {(showSplitPayment || payments.length > 1) && (
                <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Custom Split Payment Rows
                  </div>
                  {payments.map((p, pidx) => (
                    <div key={p.id} className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      {/* Payer Select */}
                      <select
                        value={p.payer}
                        onChange={(e) => handlePaymentChange(pidx, 'payer', e.target.value)}
                        className="col-span-4 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 focus:outline-none"
                      >
                        <option value="BUSINESS">Business (Store)</option>
                        {partners.map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            Partner: {pt.name}
                          </option>
                        ))}
                      </select>

                      {/* Mode Select */}
                      <select
                        value={p.payment_mode}
                        onChange={(e) => handlePaymentChange(pidx, 'payment_mode', e.target.value)}
                        className="col-span-3 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 focus:outline-none"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank</option>
                      </select>

                      {/* Amount Input */}
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={p.amount}
                        onChange={(e) => handlePaymentChange(pidx, 'amount', e.target.value)}
                        className="col-span-4 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />

                      {/* Remove Row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(pidx)}
                        className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <Plus size={13} />
                    <span>+ Add Another Split Row</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleCompleteSale}
              className={`w-full py-4 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider ${
                isGstInvoice
                  ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-orange-500/25'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25'
              }`}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing {isGstInvoice ? 'Invoice' : 'Bill'}...</span>
                </div>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  <span>
                    {isGstInvoice
                      ? `Complete GST Sale (${businessProfile?.next_invoice_number ? `${businessProfile.invoice_prefix || 'INV-'}${businessProfile.next_invoice_number}` : 'INV-'})`
                      : `Complete Non-GST Bill (${businessProfile?.next_non_gst_number ? `${businessProfile.non_gst_prefix || 'EST-'}${businessProfile.next_non_gst_number}` : 'EST-'})`}
                    {' '}(₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Mobile Verification & Lookup Modal */}
      {isCustomerLookupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Phone size={18} className="text-orange-600" />
                  <span>Customer Phone Verification</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter mobile number to check existing customer or register new profile
                </p>
              </div>
              <button
                onClick={() => setIsCustomerLookupOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Phone Lookup Input */}
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Enter 10-digit customer mobile number..."
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                autoFocus
              />
              {lookupPhone && (
                <button
                  onClick={() => setLookupPhone('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results Section */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {(() => {
                const term = lookupPhone.trim().toLowerCase();
                const matched = term
                  ? customers.filter(
                      (c) =>
                        (c.mobile || '').toLowerCase().includes(term) ||
                        (c.name || '').toLowerCase().includes(term)
                    )
                  : customers.slice(0, 5);

                if (term && matched.length === 0) {
                  return (
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-center space-y-3">
                      <AlertCircle size={28} className="mx-auto text-amber-600" />
                      <div>
                        <div className="font-extrabold text-xs text-amber-900">
                          No Customer Found with Mobile "{lookupPhone}"
                        </div>
                        <p className="text-[11px] text-amber-700 mt-1">
                          This mobile number is not registered yet. Create a new profile to proceed.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setIsCustomerLookupOpen(false);
                          setCustomerToEdit(null);
                          setInitialMobileForNew(lookupPhone);
                          setIsCustomerModalOpen(true);
                        }}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <UserPlus size={15} />
                        <span>+ Register New Customer ({lookupPhone})</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {term ? `Matched Customers (${matched.length})` : 'Recent Customers'}
                    </div>
                    {matched.map((cust) => (
                      <div
                        key={cust.id}
                        className="p-3 bg-slate-50 hover:bg-orange-50/40 border border-slate-200 rounded-xl flex items-center justify-between transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                            <span>{cust.name}</span>
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-slate-200 text-slate-700 rounded">
                              {cust.customer_type || 'INDIVIDUAL'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Ph: <strong>{cust.mobile || 'N/A'}</strong> {cust.gstin && `• GSTIN: ${cust.gstin}`}
                          </div>
                          {(cust.city || cust.state_name) && (
                            <div className="text-[10px] text-slate-400">
                              {cust.city}, {cust.state_name}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIsCustomerLookupOpen(false);
                              setCustomerToEdit(cust);
                              setInitialMobileForNew('');
                              setIsCustomerModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-white hover:bg-amber-100 border border-slate-200 text-slate-700 hover:text-amber-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Edit Customer Details"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsCustomerLookupOpen(false);
                              toast.success(`Selected customer "${cust.name}"`);
                            }}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            <span>Select</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Quick Action Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerLookupOpen(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                Use Walk-in Cash Customer
              </button>

              <button
                onClick={() => {
                  setIsCustomerLookupOpen(false);
                  setCustomerToEdit(null);
                  setInitialMobileForNew(lookupPhone);
                  setIsCustomerModalOpen(true);
                }}
                className="text-xs font-bold text-orange-600 hover:text-orange-800 cursor-pointer flex items-center gap-1"
              >
                <UserPlus size={13} />
                <span>Create New Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Quick Create / Edit Modal */}
      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setCustomerToEdit(null);
          setInitialMobileForNew('');
        }}
        customerToEdit={customerToEdit}
        initialMobile={initialMobileForNew}
        onSuccess={handleCustomerSaved}
      />

      {/* Generated A4 Invoice Print Modal */}
      <A4InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        invoiceData={successInvoice}
        autoPrint={false}
      />

      {/* Clear POS Cart Confirmation Modal */}
      <ConfirmDialog
        isOpen={isClearCartConfirmOpen}
        onClose={() => setIsClearCartConfirmOpen(false)}
        onConfirm={handleConfirmClearCart}
        title="Clear Entire Cart?"
        message="Are you sure you want to clear all items from the current POS cart? This will remove all selected products, services, and serial assignments."
        confirmLabel="Clear Cart"
        variant="danger"
      />
    </div>
  );
};

export default NewPOS;
