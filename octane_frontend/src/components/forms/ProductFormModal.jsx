import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import FormModal from '../ui/FormModal';
import BrandFormModal from './BrandFormModal';
import CategoryFormModal from './CategoryFormModal';
import { Layers, Barcode } from 'lucide-react';

// Keywords to auto-recommend Serial Number tracking for high-value devices
const isSerializedKeyword = (text) => {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  const keywords = [
    'laptop', 'notebook', 'vivobook', 'thinkpad', 'macbook', 'zenbook', 'ideapad', 
    'computer', 'desktop', 'pc', 'all-in-one', 'aio', 'workstation', 'server',
    'mobile', 'phone', 'iphone', 'smartphone', 'galaxy', 'pixel', 'tablet', 'ipad'
  ];
  return keywords.some((k) => lower.includes(k));
};

// Helper function to generate clean, deterministic SKU based on product details & specifications
const generateSKU = (name = '', brand = '', modelNumber = '', specsList = []) => {
  const sanitize = (str) => str.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const b = sanitize(brand);
  const m = sanitize(modelNumber);
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  let parts = [];

  if (b) {
    parts.push(b.slice(0, 4));
  }

  words.forEach((w) => {
    const cleaned = sanitize(w);
    if (cleaned && (!b || !cleaned.startsWith(b.slice(0, 3)))) {
      if (parts.length < 3) {
        parts.push(cleaned.slice(0, 4));
      }
    }
  });

  if (m && !parts.includes(m.slice(0, 8))) {
    parts.push(m.slice(0, 8));
  }

  // Include spec values in SKU
  specsList.forEach((specVal) => {
    const cleanSpec = sanitize(String(specVal));
    if (cleanSpec && !parts.includes(cleanSpec)) {
      parts.push(cleanSpec.slice(0, 6));
    }
  });

  const skuBase = parts.filter(Boolean).join('-');
  return skuBase || 'SKU-AUTO';
};

export const ProductFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingProduct = null,
  categories = [],
  title,
  subtitle,
}) => {
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const initialFormState = {
    name: '',
    sku: '',
    category: '',
    brand: '',
    model_number: '',
    hsn_sac: '852411',
    unit: 'NOS',
    purchase_price: '0.00',
    selling_price: '0.00',
    gst_rate: '18.00',
    is_stock_enabled: true,
    tracking_type: 'QUANTITY',
    min_stock_alert: 2,
    is_active: true,
    description: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [specsState, setSpecsState] = useState({});
  const [brandList, setBrandList] = useState([]);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [categoryList, setCategoryList] = useState(categories || []);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const fetchBrands = () => {
    api.getBrands().then((res) => {
      setBrandList(Array.isArray(res) ? res : res.results || []);
    }).catch(() => {});
  };

  const fetchCategories = () => {
    api.getProductCategories().then((res) => {
      const list = Array.isArray(res) ? res : res.results || [];
      setCategoryList(list);
    }).catch(() => {});
  };

  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoryList(categories);
    } else if (isOpen) {
      fetchCategories();
    }
  }, [categories, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
    }
  }, [isOpen]);

  const handleBrandCreated = (newBrand) => {
    if (newBrand && newBrand.name) {
      setBrandList((prev) => [...prev.filter((b) => b.id !== newBrand.id), newBrand]);
      setFormData((prev) => ({ ...prev, brand: newBrand.name }));
    }
    setIsBrandModalOpen(false);
  };

  const handleCategoryCreated = (newCategory) => {
    if (newCategory && newCategory.id) {
      setCategoryList((prev) => [...prev.filter((c) => c.id !== newCategory.id), newCategory]);
      setFormData((prev) => ({ ...prev, category: newCategory.id }));
    }
    setIsCategoryModalOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      if (editingProduct) {
        setFormData({
          name: editingProduct.name || '',
          sku: editingProduct.sku || '',
          category: editingProduct.category || '',
          brand: editingProduct.brand || '',
          model_number: editingProduct.model_number || '',
          hsn_sac: editingProduct.hsn_sac || '852411',
          unit: editingProduct.unit || 'NOS',
          purchase_price: editingProduct.purchase_price ?? '0.00',
          selling_price: editingProduct.selling_price ?? '0.00',
          gst_rate: editingProduct.gst_rate ?? '18.00',
          is_stock_enabled: editingProduct.is_stock_enabled ?? true,
          tracking_type: editingProduct.tracking_type || 'QUANTITY',
          min_stock_alert: editingProduct.min_stock_alert ?? 2,
          is_active: editingProduct.is_active ?? true,
          description: editingProduct.description || '',
        });

        // Populate specs state from editingProduct specifications
        if (editingProduct.specifications && Array.isArray(editingProduct.specifications)) {
          const initialSpecs = {};
          editingProduct.specifications.forEach((spec) => {
            initialSpecs[spec.attribute] = spec.value;
          });
          setSpecsState(initialSpecs);
        } else {
          setSpecsState({});
        }
      } else {
        setFormData(initialFormState);
        setSpecsState({});
      }
    }
  }, [isOpen, editingProduct]);

  // Current selected category attributes
  const currentCategory = categoryList.find((c) => String(c.id) === String(formData.category));
  const categoryAttributes = currentCategory?.attributes || [];

  // Auto-generate SKU when creating a new product (only when !editingProduct)
  useEffect(() => {
    if (!editingProduct && isOpen) {
      const activeSpecsList = Object.values(specsState).filter((v) => String(v).trim());
      const autoSku = generateSKU(formData.name, formData.brand, formData.model_number, activeSpecsList);
      setFormData((prev) => ({ ...prev, sku: autoSku }));
    }
  }, [formData.name, formData.brand, formData.model_number, specsState, editingProduct, isOpen]);

  const handleSpecChange = (attributeId, val) => {
    setSpecsState((prev) => ({
      ...prev,
      [attributeId]: val,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const activeSpecsList = Object.values(specsState).filter((v) => String(v).trim());
    const rawSku = formData.sku ? String(formData.sku).trim() : '';
    const finalSku = rawSku || (!editingProduct ? generateSKU(formData.name, formData.brand, formData.model_number, activeSpecsList) : (editingProduct.sku || null));

    const specificationsInput = Object.entries(specsState)
      .filter(([attrId, val]) => val !== undefined && String(val).trim() !== '')
      .map(([attrId, val]) => ({
        attribute_id: parseInt(attrId, 10),
        value: String(val).trim(),
      }));

    const payload = {
      ...formData,
      sku: finalSku,
      category: formData.category ? parseInt(formData.category, 10) : null,
      purchase_price: parseFloat(formData.purchase_price || 0),
      selling_price: parseFloat(formData.selling_price || 0),
      gst_rate: parseFloat(formData.gst_rate || 0),
      min_stock_alert: parseInt(formData.min_stock_alert || 0, 10),
      specifications_input: specificationsInput,
    };

    try {
      let result;
      if (editingProduct) {
        result = await api.updateProduct(editingProduct.id, payload);
      } else {
        result = await api.createProduct(payload);
      }
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleFormSubmit}
      loading={formLoading}
      title={title || (editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product Master')}
      subtitle={subtitle || 'Catalog Definition Only'}
      error={formError}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-700">Product Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Dell Latitude 5450 Laptop"
            value={formData.name}
            onChange={(e) => {
              const val = e.target.value;
              const shouldBeSerial = !editingProduct && isSerializedKeyword(val);
              setFormData((prev) => ({
                ...prev,
                name: val,
                tracking_type: shouldBeSerial ? 'SERIAL_NUMBER' : prev.tracking_type,
              }));
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>SKU (Stock Keeping Unit)</span>
            <span className="text-[10px] text-orange-600 font-mono font-bold">Auto-Generated</span>
          </label>
          <input
            type="text"
            readOnly
            value={formData.sku || 'SKU-PENDING'}
            className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-extrabold text-slate-600 cursor-not-allowed uppercase shadow-inner select-none"
            title="SKU is automatically generated by the system"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Category</label>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
            >
              + Quick Add Category
            </button>
          </div>
          <select
            value={formData.category}
            onChange={(e) => {
              const catId = e.target.value;
              const catObj = categoryList.find((c) => String(c.id) === String(catId));
              const shouldBeSerial = !editingProduct && (isSerializedKeyword(catObj?.name) || isSerializedKeyword(formData.name));
              setFormData((prev) => ({
                ...prev,
                category: catId,
                tracking_type: shouldBeSerial ? 'SERIAL_NUMBER' : prev.tracking_type,
              }));
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          >
            <option value="">Select Category...</option>
            {categoryList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Brand</label>
            <button
              type="button"
              onClick={() => setIsBrandModalOpen(true)}
              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
            >
              + Quick Add Brand
            </button>
          </div>
          <select
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          >
            <option value="">Select Brand...</option>
            {brandList
              .filter((b) => !formData.category || !b.category || String(b.category) === String(formData.category))
              .map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            {formData.brand &&
              !brandList.some(
                (b) =>
                  (!formData.category || !b.category || String(b.category) === String(formData.category)) &&
                  b.name === formData.brand
              ) && <option value={formData.brand}>{formData.brand}</option>}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Model Number</label>
          <input
            type="text"
            placeholder="e.g. 5450-I5-16GB"
            value={formData.model_number}
            onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">HSN Code *</label>
          <input
            type="text"
            required
            placeholder="e.g. 84713010"
            value={formData.hsn_sac}
            onChange={(e) => setFormData({ ...formData, hsn_sac: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Unit of Measurement</label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          >
            <option value="NOS">NOS (Numbers)</option>
            <option value="PCS">PCS (Pieces)</option>
            <option value="SET">SET (Set)</option>
            <option value="MTR">MTR (Meters)</option>
            <option value="BOX">BOX (Box)</option>
            <option value="PACK">PACK (Pack)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Purchase Price (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.purchase_price}
            onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Selling Price (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.selling_price}
            onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">GST Rate (%)</label>
          <select
            value={formData.gst_rate}
            onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          >
            <option value="0.00">0% (Exempted)</option>
            <option value="5.00">5% GST</option>
            <option value="12.00">12% GST</option>
            <option value="18.00">18% GST (Standard)</option>
            <option value="28.00">28% GST</option>
          </select>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Stock Tracking Method *</span>
            <span className="text-[10px] text-slate-400 font-normal">Choose inventory tracking granularity</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tracking_type: 'QUANTITY' })}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                formData.tracking_type === 'QUANTITY'
                  ? 'bg-orange-50/70 border-orange-500 ring-2 ring-orange-500/20 text-orange-950'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  formData.tracking_type === 'QUANTITY' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Layers size={18} />
              </div>
              <div>
                <div className="text-xs font-extrabold flex items-center gap-1.5">
                  <span>Quantity Tracking</span>
                  {formData.tracking_type === 'QUANTITY' && (
                    <span className="text-[9px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-bold">Selected</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Bulk count for accessories, cables, RAM, SSD, components & consumables.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, tracking_type: 'SERIAL_NUMBER' })}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                formData.tracking_type === 'SERIAL_NUMBER'
                  ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-950'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  formData.tracking_type === 'SERIAL_NUMBER' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Barcode size={18} />
              </div>
              <div>
                <div className="text-xs font-extrabold flex items-center gap-1.5">
                  <span>Serial Number Tracking</span>
                  <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                    Laptops / Mobiles
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Individual barcode & warranty lifecycle tracking for Laptops, Mobiles, Desktops.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Reorder Stock Alert Threshold</label>
          <input
            type="number"
            min="0"
            value={formData.min_stock_alert}
            onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-700">Description / Specifications</label>
          <textarea
            rows={2}
            placeholder="Additional technical details or description..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        {categoryAttributes.length > 0 && (
          <div className="sm:col-span-2 p-3 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>Category Specifications</span>
                <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-medium">
                  {currentCategory?.name}
                </span>
              </h4>
              <span className="text-[10px] text-orange-700">Dynamic Attributes</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categoryAttributes.map((attr) => {
                const val = specsState[attr.id] !== undefined ? specsState[attr.id] : '';
                return (
                  <div key={attr.id} className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {attr.name} {attr.is_required && <span className="text-red-500">*</span>}
                    </label>
                    {attr.attribute_type === 'DROPDOWN' && attr.options && attr.options.length > 0 ? (
                      <select
                        value={val}
                        onChange={(e) => handleSpecChange(attr.id, e.target.value)}
                        required={attr.is_required}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      >
                        <option value="">Select {attr.name}...</option>
                        {attr.options.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : attr.attribute_type === 'NUMBER' ? (
                      <input
                        type="number"
                        placeholder={`Enter ${attr.name}`}
                        value={val}
                        onChange={(e) => handleSpecChange(attr.id, e.target.value)}
                        required={attr.is_required}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={`Enter ${attr.name}`}
                        value={val}
                        onChange={(e) => handleSpecChange(attr.id, e.target.value)}
                        required={attr.is_required}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </FormModal>

      <BrandFormModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onSuccess={handleBrandCreated}
        categories={categoryList}
        initialCategoryId={formData.category}
        title="Quick Create Brand"
        subtitle="Add a new brand without leaving Product Master"
        submitText="Save & Select Brand"
      />

      <CategoryFormModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={handleCategoryCreated}
        title="Quick Create Category"
        subtitle="Add a new product category without leaving this form"
      />
    </>
  );
};

export default ProductFormModal;
