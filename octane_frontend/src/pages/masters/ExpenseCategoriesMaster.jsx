import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import FormModal from '../../components/ui/FormModal';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';

export const ExpenseCategoriesMaster = () => {
  const { isAdmin } = useAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });

  useEffect(() => {
    fetchExpenseCategories();
  }, []);

  const fetchExpenseCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenseCategories();
      const list = Array.isArray(res) ? res : res.results || [];
      setCategories(list);
    } catch (err) {
      console.error('Error loading expense categories:', err);
      setError(err.message || 'Failed to load expense categories master.');
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

  const handleToggleActive = async (cat) => {
    try {
      await api.patchExpenseCategory(cat.id, { is_active: !cat.is_active });
      toast.success(`Category "${cat.name}" marked as ${!cat.is_active ? 'active' : 'inactive'}.`);
      await fetchExpenseCategories();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error(err.message || 'Failed to update category status.');
    }
  };

  const handleDelete = (cat) => {
    setCategoryToDelete(cat);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setDeleteLoading(true);
    try {
      await api.deleteExpenseCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted successfully.`);
      setCategoryToDelete(null);
      await fetchExpenseCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error(err.message || 'Failed to delete category. It may have associated expenses.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingCategory) {
        await api.updateExpenseCategory(editingCategory.id, formData);
        toast.success(`Category "${formData.name}" updated successfully.`);
      } else {
        await api.createExpenseCategory(formData);
        toast.success(`Category "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      await fetchExpenseCategories();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? cat.is_active
          : !cat.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [categories]);

  const columns = [
    {
      header: 'Category Name',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <span className="font-extrabold text-slate-900">{row.name}</span>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.description || <span className="text-slate-400 italic">No description provided</span>}
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
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => handleToggleActive(row)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                row.is_active
                  ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                  : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
              }`}
              title={row.is_active ? 'Deactivate Category' : 'Activate Category'}
            >
              {row.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              title="Edit Category"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete Category"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : null,
    },
  ];

  if (loading) return <LoadingState message="Loading Expense Categories Master..." />;
  if (error) return <ErrorState message={error} onRetry={fetchExpenseCategories} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-orange-600" size={24} />
            <span>Expense Categories Master</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure standard operating expense classifications, overhead ledgers, and operational cost accounts.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Expense Category</span>
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Categories</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Categories</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inactive Categories</div>
            <div className="text-2xl font-black text-slate-500 mt-1">{stats.inactive}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search expense category name..."
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-white text-slate-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inactive ({stats.inactive})
          </button>
        </div>
      </div>

      {/* Data Table */}
      {filteredCategories.length === 0 ? (
        <EmptyState
          title="No Expense Categories Found"
          description={
            searchQuery
              ? `No categories match "${searchQuery}". Try clearing search filters.`
              : 'Define expense categories such as Rent, Utilities, Salaries, and Office Supplies.'
          }
          actionLabel={isAdmin ? '+ Add Expense Category' : null}
          onAction={isAdmin ? handleOpenAdd : null}
        />
      ) : (
        <DataTable columns={columns} data={filteredCategories} keyField="id" />
      )}

      {/* Add / Edit Form Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        loading={formLoading}
        title={editingCategory ? `Edit Expense Category: ${editingCategory.name}` : 'Add New Expense Category'}
        error={formError}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Category Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rent & Premises, Office Supplies, Advertising"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description</label>
            <textarea
              rows={3}
              placeholder="Enter category description, usage notes, or accounting scope..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="expense_cat_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="expense_cat_is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Category (Available for expense recording)
            </label>
          </div>
        </div>
      </FormModal>

      {/* Delete Expense Category Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title="Delete Expense Category?"
        message={`Are you sure you want to delete the expense category "${categoryToDelete?.name}"? If there are existing expense vouchers linked to this category, deletion will be blocked.`}
        confirmLabel="Delete Category"
        variant="danger"
      />
    </div>
  );
};

export default ExpenseCategoriesMaster;
