import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Package, Wrench, Sliders, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import DataTable from '../../components/ui/DataTable';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';

export const CategoriesMaster = () => {
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'services'
  const [productCategories, setProductCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });

  // Category Attributes Modal State
  const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);
  const [selectedCategoryForAttrs, setSelectedCategoryForAttrs] = useState(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrError, setAttrError] = useState(null);
  const [editingAttrId, setEditingAttrId] = useState(null);
  const [attrToDelete, setAttrToDelete] = useState(null);
  const [attrForm, setAttrForm] = useState({
    name: '',
    attribute_type: 'TEXT',
    options_str: '',
    is_required: false,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodCats, servCats] = await Promise.all([
        api.getProductCategories(),
        api.getServiceCategories(),
      ]);
      setProductCategories(Array.isArray(prodCats) ? prodCats : prodCats.results || []);
      setServiceCategories(Array.isArray(servCats) ? servCats : servCats.results || []);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Failed to load categories master.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', is_active: true });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      is_active: cat.is_active ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenAttributes = (cat) => {
    setSelectedCategoryForAttrs(cat);
    setAttrForm({ name: '', attribute_type: 'TEXT', options_str: '', is_required: false });
    setEditingAttrId(null);
    setAttrError(null);
    setIsAttrModalOpen(true);
  };

  const handleEditAttrClick = (attr) => {
    setEditingAttrId(attr.id);
    setAttrForm({
      name: attr.name || '',
      attribute_type: attr.attribute_type || 'TEXT',
      options_str: Array.isArray(attr.options) ? attr.options.join(', ') : '',
      is_required: attr.is_required || false,
    });
    setAttrError(null);
  };

  const handleCancelAttrEdit = () => {
    setEditingAttrId(null);
    setAttrForm({ name: '', attribute_type: 'TEXT', options_str: '', is_required: false });
    setAttrError(null);
  };

  const handleSaveAttribute = async (e) => {
    e.preventDefault();
    if (!selectedCategoryForAttrs) return;
    setAttrLoading(true);
    setAttrError(null);

    const parsedOptions =
      attrForm.attribute_type === 'DROPDOWN'
        ? attrForm.options_str
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const payload = {
      category: selectedCategoryForAttrs.id,
      name: attrForm.name.trim(),
      attribute_type: attrForm.attribute_type,
      options: parsedOptions,
      is_required: attrForm.is_required,
    };

    try {
      if (editingAttrId) {
        await api.updateCategoryAttribute(editingAttrId, payload);
      } else {
        await api.createCategoryAttribute(payload);
      }
      setAttrForm({ name: '', attribute_type: 'TEXT', options_str: '', is_required: false });
      setEditingAttrId(null);

      // Refresh categories list and sync selectedCategoryForAttrs
      const prodCats = await api.getProductCategories();
      const updatedList = Array.isArray(prodCats) ? prodCats : prodCats.results || [];
      setProductCategories(updatedList);
      const refreshedCat = updatedList.find((c) => c.id === selectedCategoryForAttrs.id);
      if (refreshedCat) setSelectedCategoryForAttrs(refreshedCat);
    } catch (err) {
      setAttrError(err.message || 'Failed to save category attribute.');
    } finally {
      setAttrLoading(false);
    }
  };

  const handleDeleteAttribute = (attr) => {
    setAttrToDelete(attr);
  };

  const handleConfirmDeleteAttribute = async () => {
    if (!attrToDelete) return;
    setAttrLoading(true);
    setAttrError(null);
    try {
      await api.deleteCategoryAttribute(attrToDelete.id);
      const prodCats = await api.getProductCategories();
      const updatedList = Array.isArray(prodCats) ? prodCats : prodCats.results || [];
      setProductCategories(updatedList);
      const refreshedCat = updatedList.find((c) => c.id === selectedCategoryForAttrs.id);
      if (refreshedCat) setSelectedCategoryForAttrs(refreshedCat);
      toast.success(`Attribute "${attrToDelete.name}" removed successfully.`);
      setAttrToDelete(null);
    } catch (err) {
      setAttrError(err.message || 'Failed to delete attribute.');
      toast.error(err.message || 'Failed to delete attribute.');
    } finally {
      setAttrLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (activeTab === 'products') {
        if (editingCategory) {
          await api.updateProductCategory(editingCategory.id, formData);
        } else {
          await api.createProductCategory(formData);
        }
      } else {
        if (editingCategory) {
          await api.updateServiceCategory(editingCategory.id, formData);
        } else {
          await api.createServiceCategory(formData);
        }
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const currentList = activeTab === 'products' ? productCategories : serviceCategories;

  const columns = [
    {
      header: 'Category Name',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900">{row.name}</div>
          {row.description && <div className="text-[11px] text-slate-400 mt-0.5">{row.description}</div>}
        </div>
      ),
    },
    {
      header: 'Associated Items',
      accessor: 'product_count',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
          {row.product_count ?? row.service_count ?? 0} Items
        </span>
      ),
    },
    ...(activeTab === 'products'
      ? [
          {
            header: 'Configured Attributes',
            accessor: 'attributes',
            render: (row) => (
              <span className="inline-flex items-center gap-1 font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 text-xs">
                <Sliders size={12} />
                {row.attributes?.length || 0} Specs
              </span>
            ),
          },
        ]
      : []),
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
      render: (row) =>
        isAdmin ? (
          <div className="flex items-center justify-end gap-1">
            {activeTab === 'products' && (
              <button
                onClick={() => handleOpenAttributes(row)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer"
                title="Manage Category Attributes / Specs"
              >
                <Sliders size={14} />
                <span>Manage Attributes</span>
              </button>
            )}
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              title="Edit Category"
            >
              <Edit2 size={16} />
            </button>
          </div>
        ) : null,
    },
  ];

  if (loading) return <LoadingState message="Loading Category Master records..." />;
  if (error) return <ErrorState message={error} onRetry={fetchCategories} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="text-orange-600" size={24} />
            <span>Category Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize physical products and non-inventory services into structured master categories.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add {activeTab === 'products' ? 'Product' : 'Service'} Category</span>
          </button>
        )}
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs border max-w-md">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Package size={16} />
          <span>Product Categories ({productCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'services'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Wrench size={16} />
          <span>Service Categories ({serviceCategories.length})</span>
        </button>
      </div>

      {/* Data Table */}
      {currentList.length === 0 ? (
        <EmptyState
          title={`No ${activeTab === 'products' ? 'Product' : 'Service'} Categories`}
          description="Create categories to organize your master inventory and service rates."
          actionLabel={isAdmin ? `+ Add Category` : null}
          onAction={isAdmin ? handleOpenAdd : null}
        />
      ) : (
        <DataTable columns={columns} data={currentList} keyField="id" />
      )}

      {/* Form Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        loading={formLoading}
        title={
          editingCategory
            ? `Edit Category: ${editingCategory.name}`
            : `Add ${activeTab === 'products' ? 'Product' : 'Service'} Category`
        }
        error={formError}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Category Name *</label>
            <input
              type="text"
              required
              placeholder={activeTab === 'products' ? 'e.g. Laptops & Notebooks' : 'e.g. Screen Repair & Replacement'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description</label>
            <textarea
              rows={3}
              placeholder="Enter category description or scope..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="category_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="category_is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Category
            </label>
          </div>
        </div>
      </FormModal>

      {/* Category Attributes Modal */}
      {isAttrModalOpen && selectedCategoryForAttrs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="text-orange-600" size={18} />
                  <span>Category Attributes: {selectedCategoryForAttrs.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure dynamic specification fields required for products in this category.
                </p>
              </div>
              <button
                onClick={() => setIsAttrModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {attrError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                {attrError}
              </div>
            )}

            {/* List of Configured Attributes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configured Attributes ({selectedCategoryForAttrs.attributes?.length || 0})
              </h4>
              {!selectedCategoryForAttrs.attributes || selectedCategoryForAttrs.attributes.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-semibold">
                  No specifications configured for this category yet. Use the form below to add attributes (e.g., RAM, Storage, CPU, Color).
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCategoryForAttrs.attributes.map((attr) => (
                    <div
                      key={attr.id}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">{attr.name}</span>
                          <span className="text-[10px] font-mono font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            {attr.attribute_type}
                          </span>
                          {attr.is_required && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        {attr.attribute_type === 'DROPDOWN' && attr.options && attr.options.length > 0 && (
                          <div className="text-[11px] font-mono text-slate-500">
                            Options: {attr.options.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditAttrClick(attr)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                          title="Edit attribute"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttribute(attr)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete attribute"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add / Edit Form */}
            <form onSubmit={handleSaveAttribute} className="p-4 bg-orange-50/50 border border-orange-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                  {editingAttrId ? 'Edit Attribute' : '+ Add New Attribute'}
                </h4>
                {editingAttrId && (
                  <button
                    type="button"
                    onClick={handleCancelAttrEdit}
                    className="text-[11px] text-slate-500 hover:underline font-semibold cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Attribute Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RAM, Storage, CPU, Color"
                    value={attrForm.name}
                    onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Type *</label>
                  <select
                    value={attrForm.attribute_type}
                    onChange={(e) => setAttrForm({ ...attrForm, attribute_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  >
                    <option value="TEXT">Text (Free Input)</option>
                    <option value="NUMBER">Number</option>
                    <option value="DROPDOWN">Dropdown / Select</option>
                  </select>
                </div>

                {attrForm.attribute_type === 'DROPDOWN' && (
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Options (comma separated) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 4GB, 8GB, 16GB, 32GB"
                      value={attrForm.options_str}
                      onChange={(e) => setAttrForm({ ...attrForm, options_str: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attrForm.is_required}
                    onChange={(e) => setAttrForm({ ...attrForm, is_required: e.target.checked })}
                    className="rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">Required Field</span>
                </label>

                <button
                  type="submit"
                  disabled={attrLoading}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {attrLoading ? 'Saving...' : editingAttrId ? 'Update Attribute' : '+ Save Attribute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Attribute Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(attrToDelete)}
        onClose={() => setAttrToDelete(null)}
        onConfirm={handleConfirmDeleteAttribute}
        loading={attrLoading}
        title="Remove Attribute?"
        message={`Are you sure you want to remove attribute "${attrToDelete?.name}" from this category? Existing products may lose this attribute mapping.`}
        confirmLabel="Remove Attribute"
        variant="danger"
      />
    </div>
  );
};

export default CategoriesMaster;
