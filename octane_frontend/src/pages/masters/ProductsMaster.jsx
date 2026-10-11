import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Power, Eye, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FilterBar from '../../components/ui/FilterBar';
import FormModal from '../../components/ui/FormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import { toast } from 'react-toastify';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import ProductFormModal from '../../components/forms/ProductFormModal';

// Helper function to generate clean, deterministic SKU based on product details
const generateSKU = (name = '', brand = '', modelNumber = '') => {
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

  const skuBase = parts.filter(Boolean).join('-');
  return skuBase || 'SKU-AUTO';
};

export const ProductsMaster = () => {
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState({ category: 'ALL', status: 'ALL', tracking: 'ALL' });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Detail Slide-over / Modal State
  const [detailProduct, setDetailProduct] = useState(null);

  // Confirm Status Toggle State
  const [confirmToggleProduct, setConfirmToggleProduct] = useState(null);

  // Form Fields State
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

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-generate SKU when creating a new product (only when !editingProduct)
  useEffect(() => {
    if (!editingProduct && isModalOpen) {
      const autoSku = generateSKU(formData.name, formData.brand, formData.model_number);
      setFormData((prev) => ({ ...prev, sku: autoSku }));
    }
  }, [formData.name, formData.brand, formData.model_number, editingProduct, isModalOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts(),
        api.getProductCategories(),
      ]);
      setProducts(Array.isArray(prodRes) ? prodRes : prodRes.results || []);
      setCategories(Array.isArray(catRes) ? catRes : catRes.results || []);
    } catch (err) {
      console.error('Error loading products master:', err);
      setError(err.message || 'Failed to load products from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      brand: product.brand || '',
      model_number: product.model_number || '',
      hsn_sac: product.hsn_sac || '852411',
      unit: product.unit || 'NOS',
      purchase_price: product.purchase_price ?? '0.00',
      selling_price: product.selling_price ?? '0.00',
      gst_rate: product.gst_rate ?? '18.00',
      is_stock_enabled: product.is_stock_enabled ?? true,
      tracking_type: product.tracking_type || 'QUANTITY',
      min_stock_alert: product.min_stock_alert ?? 2,
      is_active: product.is_active ?? true,
      description: product.description || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    // Final fallback for SKU if not generated
    const finalSku = formData.sku || generateSKU(formData.name, formData.brand, formData.model_number);

    const payload = {
      ...formData,
      sku: finalSku,
      category: formData.category ? parseInt(formData.category, 10) : null,
      purchase_price: parseFloat(formData.purchase_price || 0),
      selling_price: parseFloat(formData.selling_price || 0),
      gst_rate: parseFloat(formData.gst_rate || 0),
      min_stock_alert: parseInt(formData.min_stock_alert || 0, 10),
    };

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmToggleProduct) return;
    setFormLoading(true);
    try {
      await api.patchProduct(confirmToggleProduct.id, {
        is_active: !confirmToggleProduct.is_active,
      });
      setConfirmToggleProduct(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle status.');
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.hsn_sac?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterValues.category === 'ALL' || String(p.category) === String(filterValues.category);

    const matchesStatus =
      filterValues.status === 'ALL' ||
      (filterValues.status === 'ACTIVE' && p.is_active) ||
      (filterValues.status === 'INACTIVE' && !p.is_active);

    const matchesTracking =
      filterValues.tracking === 'ALL' || p.tracking_type === filterValues.tracking;

    return matchesSearch && matchesCategory && matchesStatus && matchesTracking;
  });

  // Table Columns
  const columns = [
    {
      header: 'Product Details',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
            <span>{row.name}</span>
            {row.brand && (
              <span className="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-bold">
                {row.brand}
              </span>
            )}
          </div>
          {row.specifications_text && (
            <div className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded w-fit border border-orange-100 my-0.5">
              {row.specifications_text}
            </div>
          )}
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3 mt-0.5">
            <span>SKU: {row.sku || 'N/A'}</span>
            <span>HSN: {row.hsn_sac}</span>
            <span>Unit: {row.unit}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category_name',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {row.category_name || 'Uncategorized'}
        </span>
      ),
    },
    {
      header: 'Pricing & Tax',
      accessor: 'selling_price',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900">
            ₹{parseFloat(row.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Buy: ₹{parseFloat(row.purchase_price).toFixed(2)} | GST: {row.gst_rate}%
          </div>
        </div>
      ),
    },
    {
      header: 'Tracking',
      accessor: 'tracking_type',
      sortable: true,
      render: (row) => <StatusBadge status={row.tracking_type} type="tracking" />,
    },
    {
      header: 'Status',
      accessor: 'is_active',
      sortable: true,
      render: (row) => <StatusBadge status={row.is_active} type="status" />,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setDetailProduct(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="View Product Details"
          >
            <Eye size={16} />
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                title="Edit Product Master"
              >
                <Edit2 size={16} />
              </button>

              <button
                onClick={() => setConfirmToggleProduct(row)}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.is_active
                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={row.is_active ? 'Deactivate Product' : 'Activate Product'}
              >
                <Power size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const filterConfigs = [
    {
      key: 'category',
      label: 'Category',
      options: categories.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'ACTIVE', label: 'Active Only' },
        { value: 'INACTIVE', label: 'Inactive Only' },
      ],
    },
    {
      key: 'tracking',
      label: 'Tracking',
      options: [
        { value: 'QUANTITY', label: 'Quantity Tracking' },
        { value: 'SERIAL_NUMBER', label: 'Serial Number Tracking' },
      ],
    },
  ];

  if (loading) return <LoadingState message="Fetching Products Master directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="text-orange-600" size={24} />
            <span>Products Catalog Master</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical items directory, HSN codes, GST tax rates, reorder thresholds & tracking types.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add New Product</span>
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search product by name, SKU, HSN, brand..."
        />
        <FilterBar
          filters={filterConfigs}
          values={filterValues}
          onChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
        />
      </div>

      {/* Data Table */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="No Products Found"
          description={
            searchQuery || filterValues.category !== 'ALL'
              ? 'No products match your search or filter parameters.'
              : 'Product catalog is empty. Click "+ Add New Product" to create your first product.'
          }
          actionLabel={isAdmin ? '+ Add New Product' : null}
          onAction={isAdmin ? handleOpenAdd : null}
        />
      ) : (
        <DataTable columns={columns} data={filteredProducts} keyField="id" />
      )}

      {/* Create / Edit Form Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        editingProduct={editingProduct}
        categories={categories}
      />

      {/* Details Modal */}
      {detailProduct && (
        <FormModal
          isOpen={Boolean(detailProduct)}
          onClose={() => setDetailProduct(null)}
          title={`Product: ${detailProduct.name}`}
          subtitle={`SKU: ${detailProduct.sku || 'N/A'}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setDetailProduct(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Selling Price</span>
                <span className="text-base font-extrabold text-slate-900">
                  ₹{parseFloat(detailProduct.selling_price).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchase Cost</span>
                <span className="text-xs font-bold text-slate-700">
                  ₹{parseFloat(detailProduct.purchase_price).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">GST Tax Rate</span>
                <span className="text-xs font-bold text-slate-700">{detailProduct.gst_rate}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reorder Alert Limit</span>
                <span className="text-xs font-bold text-slate-700">{detailProduct.min_stock_alert} {detailProduct.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-500">Category:</span>{' '}
                <span className="font-semibold text-slate-800">{detailProduct.category_name || 'N/A'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">HSN Code:</span>{' '}
                <span className="font-mono font-semibold text-slate-800">{detailProduct.hsn_sac}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Tracking:</span>{' '}
                <StatusBadge status={detailProduct.tracking_type} type="tracking" />
              </div>
              <div>
                <span className="font-bold text-slate-500">Status:</span>{' '}
                <StatusBadge status={detailProduct.is_active} type="status" />
              </div>
            </div>

            {detailProduct.specifications && detailProduct.specifications.length > 0 && (
              <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80 space-y-2">
                <span className="font-extrabold text-xs text-orange-900 uppercase tracking-wider block">
                  Category Specifications
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {detailProduct.specifications.map((spec, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-orange-100 flex items-center justify-between">
                      <span className="font-bold text-slate-500">{spec.attribute_name}:</span>
                      <span className="font-extrabold text-slate-900 font-mono">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailProduct.description && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-1">Description:</span>
                {detailProduct.description}
              </div>
            )}
          </div>
        </FormModal>
      )}

      {/* Confirm Deactivate Modal */}
      <ConfirmDialog
        isOpen={Boolean(confirmToggleProduct)}
        onClose={() => setConfirmToggleProduct(null)}
        onConfirm={handleToggleStatus}
        loading={formLoading}
        title={confirmToggleProduct?.is_active ? 'Deactivate Product' : 'Activate Product'}
        message={`Are you sure you want to ${
          confirmToggleProduct?.is_active ? 'deactivate' : 'activate'
        } product "${confirmToggleProduct?.name}"?`}
        confirmLabel={confirmToggleProduct?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmToggleProduct?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
};

export default ProductsMaster;

