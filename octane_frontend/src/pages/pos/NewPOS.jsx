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
  Shield,
  ShieldCheck,
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
  FileText,
  Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import CustomerFormModal from '../../components/forms/CustomerFormModal';
import A4InvoicePrintModal from '../../components/invoice/A4InvoicePrint';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { downloadInvoicePdf } from '../../utils/invoicePdfExporter';

export const NewPOS = ({ initialQuotation = null, onQuotationConsumed = null }) => {
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
  const [savingPdf, setSavingPdf] = useState(false);

  const handleDownloadInvoicePdf = async (inv) => {
    const target = inv || successInvoice;
    if (!target) return;
    setSavingPdf(true);
    try {
      const fileName = await downloadInvoicePdf(target, businessProfile);
      toast.success(`Invoice PDF downloaded: ${fileName}`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to generate PDF. You can also use Print -> Save as PDF.');
    } finally {
      setSavingPdf(false);
    }
  };

  // Barcode input ref & Catalog navigation refs
  const barcodeInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const catalogListRef = useRef(null);
  const catalogItemRefs = useRef([]);
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState(0);

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
        api.getSerialNumbers('?status__in=AVAILABLE,RETURNED').catch(() => []),
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

  // Convert Quotation into POS Sale
  useEffect(() => {
    if (initialQuotation && products.length > 0) {
      if (initialQuotation.customer) {
        const matched = customers.find((c) => c.id === initialQuotation.customer);
        if (matched) setSelectedCustomer(matched);
      } else if (initialQuotation.buyer_name) {
        setSelectedCustomer({
          id: null,
          name: initialQuotation.buyer_name,
          mobile: initialQuotation.buyer_phone || '',
          gstin: initialQuotation.buyer_gstin || '',
          billing_address_line1: initialQuotation.buyer_address || '',
          city: initialQuotation.buyer_city || 'Bengaluru',
        });
      }

      if (Array.isArray(initialQuotation.items)) {
        const loadedCart = [];
        initialQuotation.items.forEach((qItem) => {
          const matchedProd = products.find(
            (p) =>
              (p.sku && p.sku === qItem.part_number) ||
              (p.name && p.name.toLowerCase() === (qItem.description || '').toLowerCase())
          );

          if (matchedProd) {
            loadedCart.push({
              item_type: 'PRODUCT',
              product_id: matchedProd.id,
              product_name: matchedProd.name,
              sku: matchedProd.sku || qItem.part_number,
              brand: matchedProd.brand,
              category_name: matchedProd.category_name,
              specifications: matchedProd.specifications,
              tracking_type: matchedProd.tracking_type,
              current_stock: matchedProd.current_stock || 0,
              selling_price: parseFloat(qItem.unit_price) || matchedProd.selling_price,
              quantity: parseFloat(qItem.quantity) || 1,
              gst_rate: parseFloat(qItem.gst_rate) ?? matchedProd.gst_rate,
              hsn_sac: matchedProd.hsn_sac,
              serial_numbers: [],
            });
          } else {
            loadedCart.push({
              item_type: 'SERVICE',
              service_id: null,
              product_name: qItem.description || 'Custom Item',
              sku: qItem.part_number || '',
              selling_price: parseFloat(qItem.unit_price) || 0,
              quantity: parseFloat(qItem.quantity) || 1,
              gst_rate: parseFloat(qItem.gst_rate) ?? 18,
              hsn_sac: '998313',
            });
          }
        });
        if (loadedCart.length > 0) {
          setCart(loadedCart);
          toast.success(`Loaded items from Quotation #${initialQuotation.quotation_number}`);
        }
      }
      if (onQuotationConsumed) onQuotationConsumed();
    }
  }, [initialQuotation, products, customers]);

  // Fetch available serial numbers for a serial-tracked product
  const fetchSerialsForProduct = async (productId) => {
    if (availableSerialsCache[productId]) return availableSerialsCache[productId];
    try {
      const res = await api.getSerialNumbers(`?product=${productId}&status__in=AVAILABLE,RETURNED`);
      const serialList = Array.isArray(res) ? res : res.results || [];
      setAvailableSerialsCache((prev) => ({ ...prev, [productId]: serialList }));
      return serialList;
    } catch (err) {
      console.error('Error fetching serial numbers for product:', productId, err);
      return [];
    }
  };

  // Dynamic Category Counts for Category Filter Pills
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: products.length + services.length,
      SERVICES: services.length,
    };
    categories.forEach((cat) => {
      counts[cat.id] = products.filter((p) => String(p.category) === String(cat.id)).length;
    });
    return counts;
  }, [products, services, categories]);

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

    const isAll = selectedCategory === 'ALL' && posItemTypeFilter === 'ALL';
    const isServiceCategory = selectedCategory === 'SERVICES' || posItemTypeFilter === 'SERVICES';

    // Add Products (if not strictly SERVICES view)
    if (!isServiceCategory && (posItemTypeFilter === 'ALL' || posItemTypeFilter === 'PRODUCTS')) {
      products.forEach((p) => {
        if (!isAll && selectedCategory !== 'ALL' && String(p.category) !== String(selectedCategory)) {
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
          category_name: p.category_name || categories.find((c) => String(c.id) === String(p.category))?.name || 'Hardware',
          matching_serial: matchingSerialText,
        });
      });
    }

    // Add Services (if ALL or SERVICES view)
    if ((isAll || isServiceCategory) && (posItemTypeFilter === 'ALL' || posItemTypeFilter === 'SERVICES')) {
      services.forEach((s) => {
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
          display_code: s.sac ? `SAC ${s.sac}` : 'SERVICE',
          display_price: parseFloat(s.default_rate || 0),
          category_name: s.category_name || 'Services',
        });
      });
    }

    return items;
  }, [products, services, posItemTypeFilter, selectedCategory, productSearch, availableSerialsList]);

  // Keep selected item index clamped
  useEffect(() => {
    if (selectedCatalogIndex >= filteredCatalog.length && filteredCatalog.length > 0) {
      setSelectedCatalogIndex(filteredCatalog.length - 1);
    }
  }, [filteredCatalog.length, selectedCatalogIndex]);

  // Keyboard navigation: Up / Down arrow moves highlight, Enter adds, Esc clears, / focuses search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside any modal dialog
      if (
        isCustomerLookupOpen ||
        isCustomerModalOpen ||
        isPrintModalOpen ||
        isClearCartConfirmOpen
      ) {
        return;
      }

      const activeEl = document.activeElement;
      const isInsideOtherInput =
        activeEl &&
        activeEl !== searchInputRef.current &&
        activeEl !== barcodeInputRef.current &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (isInsideOtherInput) return;

      if (e.key === '/') {
        if (activeEl !== searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'ArrowDown') {
        if (filteredCatalog.length > 0) {
          e.preventDefault();
          setSelectedCatalogIndex((prev) => {
            const next = Math.min(filteredCatalog.length - 1, prev + 1);
            catalogItemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
        }
      } else if (e.key === 'ArrowUp') {
        if (filteredCatalog.length > 0) {
          e.preventDefault();
          setSelectedCatalogIndex((prev) => {
            const next = Math.max(0, prev - 1);
            catalogItemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
        }
      } else if (e.key === 'Enter') {
        if (filteredCatalog[selectedCatalogIndex]) {
          e.preventDefault();
          handleAddToCart(filteredCatalog[selectedCatalogIndex]);
        }
      } else if (e.key === 'Escape') {
        if (productSearch) {
          e.preventDefault();
          setProductSearch('');
          setSelectedCatalogIndex(0);
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredCatalog,
    selectedCatalogIndex,
    isCustomerLookupOpen,
    isCustomerModalOpen,
    isPrintModalOpen,
    isClearCartConfirmOpen,
    productSearch,
  ]);

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
          warranty: item.warranty || '',
          is_warranty_open: false,
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
        warranty: item.warranty || '',
        is_warranty_open: false,
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

  // Warranty management for cart items
  const handleToggleWarranty = (index) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        is_warranty_open: !updated[index].is_warranty_open,
      };
      return updated;
    });
  };

  const handleSelectWarrantyPreset = (index, presetText) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        warranty: presetText,
        is_warranty_open: false,
      };
      return updated;
    });
    if (presetText) {
      toast.success(`Warranty set: "${presetText}"`);
    } else {
      toast.info('Warranty removed.');
    }
  };

  const handleWarrantyChange = (index, text) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        warranty: text,
      };
      return updated;
    });
  };

  const handleClearWarranty = (index) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        warranty: '',
        is_warranty_open: false,
      };
      return updated;
    });
    toast.info('Warranty removed.');
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

    // 0. Mandatory Customer Validation
    if (!selectedCustomer) {
      const err = 'Customer selection is mandatory. Please select or register a customer before completing this sale.';
      setFormError(err);
      toast.error(err);
      setIsCustomerLookupOpen(true);
      return;
    }

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
    const partnerPayments = activePayments.filter((p) => p.payer && p.payer !== 'BUSINESS');

    let partnerAllocationJson = null;
    if (partnerPayments.length > 0) {
      const distinctPartnerIds = [...new Set(partnerPayments.map((p) => String(p.payer)))];
      const totalPartnerAmount = partnerPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      if (distinctPartnerIds.length === 1) {
        const partnerObj = partners.find((pt) => String(pt.id) === distinctPartnerIds[0]);
        partnerAllocationJson = {
          partner_id: parseInt(distinctPartnerIds[0], 10),
          partner_name: partnerObj ? partnerObj.name : 'Partner',
          amount: totalPartnerAmount,
          mode: partnerPayments.length === 1 ? partnerPayments[0].payment_mode : 'SPLIT',
        };
      } else {
        partnerAllocationJson = {
          partner_id: null,
          partner_name: 'Split Across Partners',
          amount: totalPartnerAmount,
          mode: 'SPLIT',
        };
      }
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
          warranty: item.warranty || '',
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
            warranty: item.warranty || '',
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
          warranty: item.warranty || '',
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
      payments: activePayments.map((p) => {
        const isPartner = p.payer && p.payer !== 'BUSINESS';
        const partnerObj = isPartner ? partners.find((pt) => String(pt.id) === String(p.payer)) : null;
        return {
          payer: p.payer || 'BUSINESS',
          payment_mode: p.payment_mode,
          amount: parseFloat(p.amount) || 0,
          reference_number: (p.reference_number || '').trim(),
          partner_allocation_json: isPartner ? {
            partner_id: parseInt(p.payer, 10),
            partner_name: partnerObj ? partnerObj.name : 'Partner',
            amount: parseFloat(p.amount) || 0,
            mode: p.payment_mode,
          } : null,
        };
      }),
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
    <div className="flex flex-col h-full space-y-2 overflow-hidden">
      {/* 1. Terminal Top Bar (Compact High-Efficiency POS Header) */}
      <div className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Terminal Title & Active Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xs flex items-center justify-center shrink-0">
            <ShoppingCart size={17} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-900 tracking-tight">POS Billing Terminal</h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Cashier: <strong className="text-slate-800 font-semibold">{user?.first_name || user?.username || 'Cashier'}</strong>
            </p>
          </div>
        </div>

        {/* Barcode Fast Scan & Customer Selection */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Barcode Scanner Input */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white px-2.5 py-1 rounded-lg border border-slate-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all shadow-2xs"
          >
            <Barcode size={15} className="text-orange-600 shrink-0" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode / SKU..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-36 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none uppercase placeholder:text-slate-400 placeholder:normal-case"
            />
            <kbd className="hidden sm:inline-block px-1 py-0.2 text-[8.5px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ↵
            </kbd>
          </form>

          {/* Customer Selection Pill (Mandatory Entry) */}
          <div
            className={`flex items-center p-0.5 rounded-lg border shadow-2xs transition-all ${
              !selectedCustomer
                ? 'border-2 border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1 pl-2 pr-1">
              <Users size={14} className={!selectedCustomer ? 'text-orange-600 animate-pulse' : 'text-slate-500'} />
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
                className={`py-0.5 bg-transparent text-xs font-bold focus:outline-none max-w-[150px] truncate cursor-pointer ${
                  !selectedCustomer ? 'text-orange-800' : 'text-slate-900'
                }`}
              >
                <option value="">-- Customer Required * --</option>
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
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                !selectedCustomer
                  ? 'bg-orange-600 hover:bg-orange-700 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
              title="Lookup customer by Phone or Register New Profile"
            >
              <Phone size={12} />
              <span>{!selectedCustomer ? 'Select Customer *' : 'Change / + New'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Last Sale Success Banner (Compact) */}
      {successInvoice && !isPrintModalOpen && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <CheckCircle2 size={13} />
            </div>
            <div>
              <span className="font-bold text-emerald-950">Sale Completed: </span>
              <span className="font-mono font-extrabold text-emerald-800">
                #{successInvoice.invoice_number || 'INV'}
              </span>
              <span className="text-emerald-700 ml-1 font-medium">
                ({successInvoice.customer_name || 'Customer'} • ₹{parseFloat(successInvoice.grand_total || successInvoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={savingPdf}
              onClick={() => handleDownloadInvoicePdf(successInvoice)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs shadow-xs border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Save invoice as PDF"
            >
              <Download size={12} className={savingPdf ? 'animate-bounce text-orange-400' : 'text-orange-400'} />
              <span>{savingPdf ? 'Saving...' : 'Save PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 shadow-xs transition-all cursor-pointer"
              title="Open full print preview"
            >
              <Printer size={12} className="text-orange-600" />
              <span>Print A4</span>
            </button>
            <button
              type="button"
              onClick={() => setSuccessInvoice(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Terminal Layout Grid (Catalog Left 60% • Cart Right 40% - Single Screen Viewport) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-hidden">

        {/* LEFT COLUMN: Product & Service Catalog (7 Cols on LG) - High-Density POS Kiosk Layout */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 overflow-hidden">
          {/* 1. Top Search Bar */}
          <div className="relative flex items-center w-full rounded-xl border-2 border-orange-500 bg-white px-3 py-1.5 sm:py-2 shadow-xs transition-all focus-within:ring-2 focus-within:ring-orange-500/10 shrink-0">
            <Search size={17} className="text-[#6C5CE7] stroke-[2.5] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder='Type name, SKU or scan barcode...  e.g. "iph 17" or "apple charger"'
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedCatalogIndex(0);
              }}
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 placeholder:font-normal font-medium text-xs sm:text-sm focus:outline-none pl-2.5 pr-2"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => {
                  setProductSearch('');
                  setSelectedCatalogIndex(0);
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full mr-1 cursor-pointer"
                title="Clear search (Esc)"
              >
                <X size={14} />
              </button>
            )}
            <span className="hidden sm:flex items-center justify-center w-5 h-5 rounded bg-slate-100 text-slate-400 font-mono text-[10px] font-semibold border border-slate-200 select-none">
              /
            </span>
          </div>

          {/* 2. Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            {/* 'All' Pill */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setPosItemTypeFilter('ALL');
                setSelectedCatalogIndex(0);
              }}
              className={`px-3 py-1 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'ALL' && posItemTypeFilter === 'ALL'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>All</span>
              <span className="font-mono text-[11px] opacity-90">{categoryCounts.ALL}</span>
            </button>

            {/* Dynamic Product Categories */}
            {categories.map((cat) => {
              const isCatActive = posItemTypeFilter !== 'SERVICES' && String(selectedCategory) === String(cat.id);
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPosItemTypeFilter('PRODUCTS');
                    setSelectedCatalogIndex(0);
                  }}
                  className={`px-3 py-1 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    isCatActive
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="font-mono text-[11px] opacity-90">{count}</span>
                </button>
              );
            })}

            {/* Services Pill */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('SERVICES');
                setPosItemTypeFilter('SERVICES');
                setSelectedCatalogIndex(0);
              }}
              className={`px-3 py-1 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'SERVICES' || posItemTypeFilter === 'SERVICES'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Services</span>
              <span className="font-mono text-[11px] opacity-90">{categoryCounts.SERVICES}</span>
            </button>
          </div>

          {/* 3. Subtitle / Keyboard Shortcuts Bar */}
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-0.5 shrink-0">
            <span>QUICK PICKS · BEST SELLERS</span>
            <span className="hidden sm:inline font-mono">↑ ↓ TO MOVE · ENTER TO ADD · ESC TO CLEAR</span>
          </div>

          {/* 4. Vertical Item List (Smooth Internal Scroll) */}
          {filteredCatalog.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-500 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Package size={28} className="mx-auto text-slate-300 mb-1.5 stroke-[1.5]" />
              <div className="font-extrabold text-slate-700 text-xs">No items found</div>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                {productSearch
                  ? 'No products or services match your search query.'
                  : selectedCategory !== 'ALL'
                  ? 'No items match the selected category in this view.'
                  : 'No active items available.'}
              </p>
            </div>
          ) : (
            <div
              ref={catalogListRef}
              className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0 select-none"
            >
              {filteredCatalog.map((item, idx) => {
                const isService = item.item_type === 'SERVICE';
                const stock = isService ? 999 : parseFloat(item.current_stock || item.stock || 0);
                const isSelected = selectedCatalogIndex === idx;

                const inCartItem = cart.find((c) =>
                  isService
                    ? c.item_type === 'SERVICE' && c.service_id === item.id
                    : c.item_type === 'PRODUCT' && c.product_id === item.id
                );
                const inCartQty = inCartItem ? inCartItem.quantity : 0;

                return (
                  <div
                    key={`${item.item_type}-${item.id}`}
                    ref={(el) => (catalogItemRefs.current[idx] = el)}
                    onClick={() => {
                      setSelectedCatalogIndex(idx);
                      handleAddToCart(item);
                    }}
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-orange-500 bg-orange-50/25 shadow-2xs'
                        : 'border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 bg-white'
                    }`}
                  >
                    {/* Left: Item Title & Subtitle */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug truncate">
                        {item.display_title}
                      </h4>
                      <p className="text-[10.5px] text-slate-400 font-mono font-medium mt-0.5 flex items-center gap-1 truncate">
                        <span>{item.display_code}</span>
                        <span>·</span>
                        <span>{item.category_name || (isService ? 'Services' : 'Hardware')}</span>
                        {item.matching_serial && (
                          <span className="text-amber-800 font-bold bg-amber-50 px-1 py-0.2 rounded text-[9.5px]">
                            S/N: {item.matching_serial}
                          </span>
                        )}
                        {inCartQty > 0 && (
                          <span className="text-orange-700 font-bold bg-orange-100/80 px-1.5 py-0.2 rounded text-[9.5px]">
                            ({inCartQty} in cart)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Right: Badge, Price, Add Button */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Stock / Service Badge */}
                      {isService ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100/60">
                          Service
                        </span>
                      ) : stock <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100/60">
                          Out
                        </span>
                      ) : stock <= 3 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-100/60">
                          Only {stock}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-100/60">
                          {stock} in stock
                        </span>
                      )}

                      {/* Price */}
                      <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 tracking-tight min-w-[75px] text-right">
                        ₹{item.display_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>

                      {/* Tactile Orange Square Add Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCatalogIndex(idx);
                          handleAddToCart(item);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-600 hover:bg-orange-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all shrink-0 cursor-pointer"
                        title="Add to Bill (Enter)"
                      >
                        <Plus size={15} className="stroke-[3]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: POS Cart, Financial Summary & Checkout (5 Cols on LG) - High-Density Fixed-Height Viewport */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2 overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
                <ShoppingCart size={14} />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-slate-900 leading-tight">Current Cart Items</h3>
                <p className="text-[10px] text-slate-400">
                  {cart.reduce((sum, item) => sum + (item.quantity || 1), 0)} total units
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10.5px] font-mono font-bold">
                {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
              </span>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                  title="Clear All Cart Items"
                >
                  <Trash2 size={13} />
                  <span className="text-[10px]">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Invoice Stream Toggle: GST Tax Invoice (INV-) vs Non-GST Bill / Estimate (EST-) */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center gap-1 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => handleToggleInvoiceType(true)}
              className={`flex-1 py-1 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                isGstInvoice
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              <FileText size={11} />
              <span>GST Tax Invoice</span>
              <span className="text-[9px] px-1 py-0.2 rounded font-mono font-extrabold bg-orange-100 text-orange-800">
                {businessProfile?.next_invoice_number ? `${businessProfile.invoice_prefix || 'INV-'}${businessProfile.next_invoice_number}` : 'INV-'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleInvoiceType(false)}
              className={`flex-1 py-1 px-2 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                !isGstInvoice
                  ? 'bg-white text-indigo-700 shadow-2xs font-extrabold ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              <Tag size={11} />
              <span>Non-GST Bill</span>
              <span className="text-[9px] px-1 py-0.2 rounded font-mono font-extrabold bg-indigo-100 text-indigo-800">
                {businessProfile?.next_non_gst_number ? `${businessProfile.non_gst_prefix || 'EST-'}${businessProfile.next_non_gst_number}` : 'EST-'}
              </span>
            </button>
          </div>

          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-1.5 min-h-[140px]">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-300 shadow-2xs">
                <ShoppingCart size={20} className="stroke-[1.5]" />
              </div>
              <div className="font-bold text-slate-700 text-xs">Your POS Cart is Empty</div>
              <p className="text-[10.5px] text-slate-400 max-w-xs mx-auto">
                Click any product or service from the catalog on the left to add it to this bill.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[120px]">
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

                          {/* Warranty Badge or Toggle */}
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {item.warranty ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <ShieldCheck size={11} className="text-blue-600 shrink-0" />
                                <span>{item.warranty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWarranty(idx)}
                                  className="ml-1 text-[9.5px] text-blue-600 hover:text-blue-900 underline font-semibold cursor-pointer"
                                  title="Edit warranty"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearWarranty(idx)}
                                  className="p-0.5 text-blue-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="Remove warranty"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleWarranty(idx)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-blue-700 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                                title="Add warranty for this item"
                              >
                                <Shield size={10} className="text-slate-400" />
                                <span>+ Warranty</span>
                              </button>
                            )}
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

                      {/* Expandable Warranty Drawer (If Open) */}
                      {item.is_warranty_open && (
                        <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs space-y-2 mt-2">
                          <div className="font-extrabold text-blue-950 text-[10.5px] flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Shield size={12} className="text-blue-600" />
                              <span>Select or Type Warranty</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleWarranty(idx)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title="Close warranty editor"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          {/* Quick 1-Click Preset Chips */}
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              '1 Year Brand',
                              '2 Years Brand',
                              '3 Years Brand',
                              '6 Months Store',
                              '1 Month Testing',
                              '7 Days Replacement',
                            ].map((preset) => {
                              const presetFull = `${preset} Warranty`;
                              const isSelected = (item.warranty || '') === presetFull;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handleSelectWarrantyPreset(idx, presetFull)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                      : 'bg-white hover:bg-blue-100/70 text-slate-700 border border-blue-200'
                                  }`}
                                >
                                  {preset}
                                </button>
                              );
                            })}
                            {item.warranty && (
                              <button
                                type="button"
                                onClick={() => handleClearWarranty(idx)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* Custom Text Input + Done Button */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <input
                              type="text"
                              value={item.warranty || ''}
                              onChange={(e) => handleWarrantyChange(idx, e.target.value)}
                              placeholder="Or type custom warranty (e.g. 1 Year On-site, 3 Yrs Manufacturer)..."
                              className="flex-1 px-2.5 py-1 bg-white border border-blue-300 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleToggleWarranty(idx);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleWarranty(idx)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-2xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Check size={12} />
                              <span>Done</span>
                            </button>
                          </div>
                        </div>
                      )}

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

          {/* Pinned Bottom Controls: Summary, Payments, Checkout (Always Visible) */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-100 shrink-0">
            {/* Financial Summary Card */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span className="font-sans font-medium">{isGstInvoice ? 'Taxable Subtotal:' : 'Subtotal:'}</span>
                <span>₹{summary.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {isGstInvoice ? (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span className="font-sans font-medium">Total GST ({summary.isInterstate ? 'IGST' : 'CGST+SGST'}):</span>
                  <span>₹{summary.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="flex justify-between text-indigo-700 text-[11px] font-semibold">
                  <span className="font-sans font-medium">GST Amount:</span>
                  <span className="px-1 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-[9.5px] font-bold">₹0.00 (Non-GST)</span>
                </div>
              )}
              {summary.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                  <span className="font-sans font-medium">Discount:</span>
                  <span>- ₹{summary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
                <span className="font-sans font-extrabold text-xs text-slate-900">Grand Total:</span>
                <span className={`text-base font-extrabold tracking-tight ${isGstInvoice ? 'text-orange-600' : 'text-indigo-700'}`}>
                  ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Quick Payment Mode Selector & Paid/Due Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-slate-800 uppercase tracking-wide text-[10px]">
                  Payment Method
                </span>
                <button
                  type="button"
                  onClick={() => setShowSplitPayment(!showSplitPayment)}
                  className="font-bold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-0.5 text-[10px]"
                >
                  <span>{showSplitPayment ? 'Hide Split' : '+ Split / Partner'}</span>
                </button>
              </div>

              {/* 4 Quick Payment Mode Cards */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { mode: 'CASH', label: 'Cash', icon: Banknote },
                  { mode: 'UPI', label: 'UPI', icon: QrCode },
                  { mode: 'CARD', label: 'Card', icon: CreditCard },
                  { mode: 'BANK_TRANSFER', label: 'Bank', icon: Building2 },
                ].map(({ mode, label, icon: Icon }) => {
                  const isSelected = activeQuickPayMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleQuickPayFull(mode)}
                      className={`py-1 px-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500/20 shadow-2xs font-extrabold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold'
                      }`}
                    >
                      <Icon size={13} className={isSelected ? 'text-orange-600' : 'text-slate-500'} />
                      <span className="text-[10.5px]">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Realtime Paid vs Due / Change Indicator */}
              <div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono">
                <span className="text-emerald-700 font-bold font-sans">
                  Paid: ₹{summary.totalPaid.toFixed(2)}
                </span>
                {summary.balanceDue > 0 ? (
                  <span className="text-rose-600 font-bold font-sans">
                    Due: ₹{summary.balanceDue.toFixed(2)}
                  </span>
                ) : changeToReturn > 0 ? (
                  <span className="text-emerald-600 font-bold font-sans">
                    Change: ₹{changeToReturn.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold font-sans">
                    ✓ Paid in Full
                  </span>
                )}
              </div>

              {/* Expandable Split Payment Rows */}
              {(showSplitPayment || payments.length > 1) && (
                <div className="space-y-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                  <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Split Payment Rows
                  </div>
                  {payments.map((p, pidx) => (
                    <div key={p.id} className="grid grid-cols-12 gap-1 items-center bg-white p-1 rounded border border-slate-200 shadow-2xs">
                      {/* Payer Select */}
                      <select
                        value={p.payer}
                        onChange={(e) => handlePaymentChange(pidx, 'payer', e.target.value)}
                        className="col-span-4 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-900 focus:outline-none"
                      >
                        <option value="BUSINESS">Store</option>
                        {partners.map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.name}
                          </option>
                        ))}
                      </select>

                      {/* Mode Select */}
                      <select
                        value={p.payment_mode}
                        onChange={(e) => handlePaymentChange(pidx, 'payment_mode', e.target.value)}
                        className="col-span-3 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-900 focus:outline-none"
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
                        className="col-span-4 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-900 focus:outline-none"
                      />

                      {/* Remove Row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(pidx)}
                        className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>+ Add Split Row</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-800 flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span className="truncate">{formError}</span>
              </div>
            )}

            {/* Customer Mandatory Notice above Checkout Button */}
            {!selectedCustomer && (
              <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span className="font-bold text-[11px] truncate">Customer required to complete sale</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerLookupOpen(true)}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[10.5px] shrink-0 cursor-pointer shadow-2xs"
                >
                  Select Customer *
                </button>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleCompleteSale}
              className={`w-full py-2.5 px-3 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider ${
                isGstInvoice
                  ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-orange-500/25'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25'
              }`}
            >
              {submitting ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  <ShoppingCart size={15} />
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
