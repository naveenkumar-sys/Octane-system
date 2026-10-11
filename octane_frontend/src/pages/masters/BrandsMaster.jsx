import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BrandFormModal from '../../components/forms/BrandFormModal';
import { api } from '../../services/api';

export const BrandsMaster = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandsData, catsData] = await Promise.all([
        api.getBrands(),
        api.getProductCategories(),
      ]);
      setBrands(Array.isArray(brandsData) ? brandsData : brandsData.results || []);
      setCategories(Array.isArray(catsData) ? catsData : catsData.results || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
      setError(err.message || 'Failed to load brands directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingBrand(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (brand) => {
    setEditingBrand(brand);
    setIsModalOpen(true);
  };

  const handleSuccess = (savedBrand) => {
    if (editingBrand) {
      setBrands((prev) => prev.map((b) => (b.id === savedBrand.id ? savedBrand : b)));
    } else {
      setBrands((prev) => [...prev, savedBrand]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (brand) => {
    setBrandToDelete(brand);
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;
    setDeleteLoading(true);
    try {
      await api.deleteBrand(brandToDelete.id);
      setBrands((prev) => prev.filter((b) => b.id !== brandToDelete.id));
      toast.success(`Brand "${brandToDelete.name}" deleted successfully.`);
      setBrandToDelete(null);
    } catch (err) {
      toast.error(`Failed to delete brand: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredBrands = brands.filter(
    (b) =>
      !searchQuery ||
      b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.origin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'Brand Name',
      accessor: 'name',
      sortable: true,
      render: (row) => <span className="font-extrabold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Category Scope',
      accessor: 'category_name',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.category_name || 'All Categories / General'}
        </span>
      ),
    },
    {
      header: 'Country / Manufacturer',
      accessor: 'origin',
      render: (row) => <span className="text-xs text-slate-500 font-mono">{row.origin || 'N/A'}</span>,
    },
    {
      header: 'Notes / Description',
      accessor: 'description',
      render: (row) => (
        <span className="text-xs text-slate-500 truncate max-w-[200px] block" title={row.description}>
          {row.description || '—'}
        </span>
      ),
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
      render: (row) =>
        isAdmin ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
              title="Edit Brand"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete Brand"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="text-orange-600" size={24} />
            <span>Brands Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manufacturer brand directory connected to inventory product and purchase definitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Brands"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Add New Brand</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search brand name, category, or origin..." />
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-500">
          Loading brands directory...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredBrands}
          keyField="id"
          emptyMessage="No brands configured yet. Click '+ Add New Brand' to create one."
        />
      )}

      <BrandFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        categories={categories}
        editingBrand={editingBrand}
        title={editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Add New Brand Master'}
        subtitle={editingBrand ? 'Update brand details' : 'Configure manufacturer brand and category scope.'}
      />

      <ConfirmDialog
        isOpen={Boolean(brandToDelete)}
        onClose={() => setBrandToDelete(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title="Delete Brand?"
        message={`Are you sure you want to delete brand "${brandToDelete?.name}"? Products mapped to this brand may be affected.`}
        confirmLabel="Delete Brand"
        variant="danger"
      />
    </div>
  );
};

export default BrandsMaster;
