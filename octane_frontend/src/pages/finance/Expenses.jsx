import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  Filter,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  User,
  X,
  Tag,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Layers,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import FormModal from '../../components/ui/FormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';

export const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Category Master & Quick Add State
  const [isCategoryMasterOpen, setIsCategoryMasterOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '', is_active: true });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState(null);

  // Expense Form State
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    paid_by_partner_id: '',
    receipt_reference: '',
    description: '',
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, catRes, partRes] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories(),
        api.getPartners()
      ]);

      const expList = Array.isArray(expRes) ? expRes : expRes.results || [];
      const catList = Array.isArray(catRes) ? catRes : catRes.results || [];
      const partList = Array.isArray(partRes) ? partRes : partRes.results || [];

      setExpenses(expList);
      setCategories(catList);
      setPartners(partList);
    } catch (err) {
      console.error('Error loading expenses data:', err);
      setError(err.message || 'Failed to load operational expenses.');
      toast.error('Failed to load operational expenses.');
    } finally {
      setLoading(false);
    }
  };

  // Categories available for the form (Active ones + the one currently on the edited expense)
  const formCategoryOptions = useMemo(() => {
    const active = categories.filter((c) => c.is_active);
    if (editingExpense && editingExpense.category) {
      const editCatId = editingExpense.category.id || editingExpense.category;
      if (!active.some((c) => String(c.id) === String(editCatId))) {
        const currentCat = categories.find((c) => String(c.id) === String(editCatId));
        if (currentCat) {
          return [currentCat, ...active];
        }
      }
    }
    return active;
  }, [categories, editingExpense]);

  const openCreateModal = () => {
    setEditingExpense(null);
    const activeCats = categories.filter((c) => c.is_active);
    setFormData({
      category_id: activeCats.length > 0 ? activeCats[0].id : '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      paid_by_partner_id: '',
      receipt_reference: '',
      description: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category_id: expense.category ? (expense.category.id || expense.category) : '',
      amount: expense.amount,
      expense_date: expense.expense_date,
      payment_mode: expense.payment_mode || 'CASH',
      paid_by_partner_id: expense.paid_by_partner ? (expense.paid_by_partner.id || expense.paid_by_partner) : '',
      receipt_reference: expense.receipt_reference || '',
      description: expense.description || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteExpense = (expense) => {
    setExpenseToDelete(expense);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeleteLoading(true);
    try {
      await api.deleteExpense(expenseToDelete.id);
      toast.success(`Expense ${expenseToDelete.expense_number} deleted successfully.`);
      setExpenseToDelete(null);
      fetchInitialData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      toast.error(err.message || 'Failed to delete expense record.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Expense amount must be greater than ₹0.');
      return;
    }

    if (!formData.category_id) {
      setFormError('Please select a valid expense category.');
      return;
    }

    if (formData.payment_mode === 'PARTNER_OUT_OF_POCKET' && !formData.paid_by_partner_id) {
      setFormError('Please select which partner paid this expense out-of-pocket.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        category_id: parseInt(formData.category_id, 10),
        amount: amt,
        expense_date: formData.expense_date,
        payment_mode: formData.payment_mode,
        paid_by_partner_id: formData.paid_by_partner_id ? parseInt(formData.paid_by_partner_id, 10) : null,
        receipt_reference: formData.receipt_reference.trim(),
        description: formData.description.trim(),
      };

      if (editingExpense) {
        await api.updateExpense(editingExpense.id, payload);
        toast.success(`Expense ${editingExpense.expense_number} updated successfully!`);
      } else {
        await api.createExpense(payload);
        toast.success('New operational expense recorded successfully!');
      }

      setIsModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error('Error saving expense:', err);
      setFormError(err.message || 'Failed to save expense.');
      toast.error(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  // Category Master Handlers
  const openAddCategoryQuickModal = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', description: '', is_active: true });
    setCategoryError(null);
    setIsAddCatModalOpen(true);
  };

  const openEditCategoryModal = (cat) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || '',
      is_active: cat.is_active,
    });
    setCategoryError(null);
    setIsAddCatModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const name = categoryFormData.name.trim();
    if (!name) {
      setCategoryError('Category name is required.');
      return;
    }

    setCategorySaving(true);
    setCategoryError(null);

    try {
      let savedCat;
      if (editingCategory) {
        savedCat = await api.updateExpenseCategory(editingCategory.id, {
          name,
          description: categoryFormData.description.trim(),
          is_active: categoryFormData.is_active,
        });
        toast.success(`Category "${savedCat.name}" updated successfully!`);
      } else {
        savedCat = await api.createExpenseCategory({
          name,
          description: categoryFormData.description.trim(),
          is_active: true,
        });
        toast.success(`New category "${savedCat.name}" created successfully!`);
        // If expense modal is open, auto-select this new category
        if (isModalOpen) {
          setFormData((prev) => ({ ...prev, category_id: savedCat.id }));
        }
      }

      // Refresh categories list
      const catRes = await api.getExpenseCategories();
      const catList = Array.isArray(catRes) ? catRes : catRes.results || [];
      setCategories(catList);

      setIsAddCatModalOpen(false);
      setEditingCategory(null);
    } catch (err) {
      console.error('Error saving expense category:', err);
      setCategoryError(err.message || 'Failed to save expense category.');
      toast.error(err.message || 'Failed to save expense category.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    try {
      const updated = await api.patchExpenseCategory(cat.id, { is_active: !cat.is_active });
      toast.success(`Category "${cat.name}" is now ${updated.is_active ? 'ACTIVE' : 'DEACTIVATED'}.`);
      const catRes = await api.getExpenseCategories();
      const catList = Array.isArray(catRes) ? catRes : catRes.results || [];
      setCategories(catList);
    } catch (err) {
      console.error('Error toggling category status:', err);
      toast.error(err.message || 'Failed to update category status.');
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Category filter
      if (categoryFilter !== 'ALL' && String(exp.category ? exp.category.id || exp.category : '') !== String(categoryFilter)) {
        return false;
      }

      // Mode filter
      if (modeFilter !== 'ALL' && exp.payment_mode !== modeFilter) {
        return false;
      }

      // Date filter
      if (startDate && exp.expense_date < startDate) return false;
      if (endDate && exp.expense_date > endDate) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (exp.expense_number || '').toLowerCase().includes(q);
        const descMatch = (exp.description || '').toLowerCase().includes(q);
        const refMatch = (exp.receipt_reference || '').toLowerCase().includes(q);
        const catMatch = (exp.category_name || '').toLowerCase().includes(q);
        const partMatch = (exp.paid_by_partner_name || '').toLowerCase().includes(q);

        if (!numMatch && !descMatch && !refMatch && !catMatch && !partMatch) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, searchQuery, categoryFilter, modeFilter, startDate, endDate]);

  // Financial Metrics Summary
  const metrics = useMemo(() => {
    let totalAmount = 0;
    let businessPaid = 0;
    let partnerFunded = 0;
    const currentMonth = new Date().toISOString().substring(0, 7);
    let monthAmount = 0;

    filteredExpenses.forEach((exp) => {
      const amt = parseFloat(exp.amount || 0);
      totalAmount += amt;
      if (exp.expense_date && exp.expense_date.startsWith(currentMonth)) {
        monthAmount += amt;
      }

      if (exp.paid_by_partner || exp.payment_mode === 'PARTNER_OUT_OF_POCKET') {
        partnerFunded += amt;
      } else {
        businessPaid += amt;
      }
    });

    return { totalAmount, monthAmount, businessPaid, partnerFunded, count: filteredExpenses.length };
  }, [filteredExpenses]);

  const columns = [
    {
      key: 'expense_number',
      header: 'Expense #',
      render: (exp) => (
        <div>
          <div className="font-extrabold text-xs text-slate-900 font-mono flex items-center gap-1">
            <Receipt size={13} className="text-orange-600" />
            <span>{exp.expense_number}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">{exp.expense_date}</div>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'Category',
      render: (exp) => (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-xs">
          {exp.category_name || 'General Expense'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description / Remarks',
      render: (exp) => (
        <div className="max-w-xs">
          <div className="font-bold text-xs text-slate-900 truncate">{exp.description || '—'}</div>
          {exp.receipt_reference && (
            <div className="text-[10px] text-slate-400 font-mono">Ref: {exp.receipt_reference}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (exp) => (
        <span className="font-extrabold text-xs text-slate-900 font-mono">
          ₹{parseFloat(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'payment_mode',
      header: 'Paid Via',
      render: (exp) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 uppercase">
          {exp.payment_mode === 'PARTNER_OUT_OF_POCKET' ? 'Out-Of-Pocket' : exp.payment_mode}
        </span>
      ),
    },
    {
      key: 'paid_by',
      header: 'Paid By Account',
      render: (exp) => (
        <div>
          {exp.paid_by_partner_name ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
              <User size={11} />
              <span>Partner: {exp.paid_by_partner_name}</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1 w-fit">
              <Building2 size={11} />
              <span>Business Account</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (exp) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewingExpense(exp)}
            className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => openEditModal(exp)}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            title="Edit Expense"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => handleDeleteExpense(exp)}
            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Delete Expense"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading business operating expenses log..." />;
  if (error) return <ErrorState message={error} onRetry={fetchInitialData} />;

  return (
    <div className="space-y-5">
      {/* Header Metric Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Shop Running Expenses</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              ₹{metrics.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">{metrics.count} Recorded Expense(s)</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expenses This Month</div>
            <div className="text-xl font-extrabold text-rose-600 font-mono">
              ₹{metrics.monthAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-rose-500 font-medium">Bills recorded this month</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/60 to-white shadow-2xs space-y-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Paid from Shop Cash / Bank</div>
            <div className="text-xl font-extrabold text-slate-800 font-mono">
              ₹{metrics.businessPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Deducted from shop liquidity</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs space-y-1">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Paid by Partner (Personal Pocket)</div>
            <div className="text-xl font-extrabold text-amber-700 font-mono">
              ₹{metrics.partnerFunded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-600 font-medium">Partner funded (shop cash not used)</div>
          </div>
        </div>

        {/* Impact on Profit Banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span className="font-semibold text-slate-700">
              Operating expenses (Rent, Electricity, Salaries, Tea, Transport) are deducted from Gross Profit to determine your final Business Net Profit in the Profit &amp; Loss report.
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Action Header */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by expense #, category, description, ref # or partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          {/* Category Dropdown Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {!c.is_active ? '(Inactive)' : ''}
              </option>
            ))}
          </select>

          {/* Payment Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI / GPay</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="PARTNER_OUT_OF_POCKET">Partner Out-of-pocket</option>
          </select>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCategoryMasterOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Manage Expense Categories Master"
            >
              <Tag size={15} className="text-orange-600" />
              <span>Category Master</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Record Expense</span>
            </button>
          </div>
        </div>

        {/* Date Range & Quick Presets Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick:</span>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const t = `${y}-${m}-${d}`;
                setStartDate(t);
                setEndDate(t);
              }}
              className="px-2.5 py-1 rounded-lg font-bold bg-slate-50 hover:bg-orange-50 hover:text-orange-700 text-slate-600 border border-slate-200 transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                setStartDate(`${y}-${m}-01`);
                setEndDate(`${y}-${m}-${d}`);
              }}
              className="px-2.5 py-1 rounded-lg font-bold bg-slate-50 hover:bg-orange-50 hover:text-orange-700 text-slate-600 border border-slate-200 transition-all cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                setEndDate(`${y}-${m}-${d}`);
              }}
              className="px-2.5 py-1 rounded-lg font-bold bg-slate-50 hover:bg-orange-50 hover:text-orange-700 text-slate-600 border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
            >
              <Clock size={12} className="text-orange-600" />
              <span>Until Now</span>
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2.5 py-1 rounded-lg font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Date Pickers (From / To) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={14} className="text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-xs">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                title="Expense Start Date (From)"
              />
            </div>
            <span className="text-slate-400 font-bold text-xs">until</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-xs">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                title="Expense End Date (To)"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                title="Reset Dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Active Date Banner Feedback */}
        {(startDate || endDate) && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50/70 border border-orange-200 rounded-xl text-xs text-orange-900 font-semibold">
            <span>
              📅 Filtered Range: <strong>{startDate || 'All Previous'}</strong> to <strong>{endDate || 'Current Date'}</strong>
            </span>
            <span className="font-mono text-orange-700 font-bold">
              {filteredExpenses.length} expense(s) • ₹{metrics.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Expenses Data Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No Operational Expenses Found"
          message={searchQuery ? 'No expense records match your search criteria.' : 'No operational expenses recorded yet.'}
        />
      ) : (
        <DataTable data={filteredExpenses} columns={columns} paginationPerPage={15} />
      )}

      {/* Create / Edit Expense Modal */}
      {isModalOpen && (
        <FormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingExpense ? `Edit Expense ${editingExpense.expense_number}` : 'Record New Operating Expense'}
          subtitle="Record business utilities, rent, salaries, or partner out-of-pocket operational costs."
          submitLabel={editingExpense ? 'Update Expense' : 'Save Expense'}
          onSubmit={handleFormSubmit}
          loading={saving}
        >
          <div className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category with Quick Add Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Expense Category *</label>
                  <button
                    type="button"
                    onClick={openAddCategoryQuickModal}
                    className="text-[11px] font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Category</span>
                  </button>
                </div>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">-- Select Category --</option>
                  {formCategoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.is_active ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
                {formCategoryOptions.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold">
                    No active categories found. Click "+ Add Category" to create one.
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Expense Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="0.00"
                />
              </div>

              {/* Expense Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              {/* Payment Mode */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      payment_mode: mode,
                      paid_by_partner_id: mode !== 'PARTNER_OUT_OF_POCKET' ? '' : prev.paid_by_partner_id,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CASH">Store Cash</option>
                  <option value="UPI">Store UPI / GPay</option>
                  <option value="CARD">Store Card Account</option>
                  <option value="BANK_TRANSFER">Store Bank Transfer</option>
                  <option value="PARTNER_OUT_OF_POCKET">Paid Out-of-Pocket by Partner</option>
                </select>
              </div>

              {/* Paid by Partner */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Paid By (Account / Partner)</label>
                <select
                  value={formData.paid_by_partner_id}
                  onChange={(e) => {
                    const partnerVal = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      paid_by_partner_id: partnerVal,
                      payment_mode: partnerVal ? 'PARTNER_OUT_OF_POCKET' : (prev.payment_mode === 'PARTNER_OUT_OF_POCKET' ? 'CASH' : prev.payment_mode),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">Business Store Account (Store Cash/Bank Outflow)</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      Partner: {p.name} (Credited to Partner Capital Ledger)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Selecting a partner credits their Capital Ledger account automatically. Business store payments leave partner ledger unaffected.
                </p>
              </div>

              {/* Receipt Reference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Receipt / Bill Ref No.</label>
                <input
                  type="text"
                  placeholder="e.g. Bill #48201 / Txn ID"
                  value={formData.receipt_reference}
                  onChange={(e) => setFormData({ ...formData, receipt_reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              {/* Description */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Description / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Electricity Bill / Internet Subscription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </FormModal>
      )}

      {/* Quick Add / Edit Category Modal */}
      {isAddCatModalOpen && (
        <FormModal
          isOpen={isAddCatModalOpen}
          onClose={() => {
            setIsAddCatModalOpen(false);
            setEditingCategory(null);
          }}
          title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Expense Category'}
          subtitle="Expense categories categorize store utilities, office expenses, staff wages, etc."
          submitLabel={editingCategory ? 'Update Category' : 'Create Category'}
          onSubmit={handleSaveCategory}
          loading={categorySaving}
        >
          <div className="space-y-4">
            {categoryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rent, Office Refreshments, Broadband"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description / Scope</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the expenses in this category..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              {editingCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryFormData.is_active}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, is_active: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded border-slate-300"
                    />
                    <span>Active (Available in Expense Form)</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </FormModal>
      )}

      {/* Category Master Management Drawer */}
      {isCategoryMasterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white max-w-lg w-full h-full p-6 shadow-2xl overflow-y-auto space-y-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Tag size={16} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Expense Category Master</h2>
                  <span className="text-xs text-slate-500">Manage categories, status, and naming</span>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryMasterOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{categories.length} Categories Configured</span>
              <button
                onClick={openAddCategoryQuickModal}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Category</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {categories.map((cat) => (
                <div key={cat.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 truncate">{cat.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cat.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {cat.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-[11px] text-slate-500 truncate">{cat.description}</p>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {cat.expense_count || 0} Recorded Expense(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        cat.is_active
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title={cat.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                    >
                      {cat.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => openEditCategoryModal(cat)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category Name & Details"
                    >
                      <Edit2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Expense Detail Drawer */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white max-w-md w-full h-full p-6 shadow-2xl overflow-y-auto space-y-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-mono">Expense #{viewingExpense.expense_number}</h2>
                <span className="text-xs text-slate-400">Recorded on {viewingExpense.expense_date}</span>
              </div>
              <button onClick={() => setViewingExpense(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Category:</span>
                <span className="font-extrabold text-slate-900 font-sans">{viewingExpense.category_name || 'General'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount:</span>
                <span className="font-extrabold text-rose-600 text-sm">₹{parseFloat(viewingExpense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment Mode:</span>
                <span className="font-bold text-slate-800 uppercase">{viewingExpense.payment_mode}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid By:</span>
                <span className="font-bold text-slate-900 font-sans">
                  {viewingExpense.paid_by_partner_name ? `Partner (${viewingExpense.paid_by_partner_name})` : 'Business Store Account'}
                </span>
              </div>
              {viewingExpense.receipt_reference && (
                <div className="flex justify-between text-slate-600">
                  <span>Receipt Ref:</span>
                  <span className="font-bold text-slate-800">{viewingExpense.receipt_reference}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-extrabold text-slate-900 uppercase">Remarks / Purpose</div>
              <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed">
                {viewingExpense.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(expenseToDelete)}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleConfirmDeleteExpense}
        loading={deleteLoading}
        title="Delete Expense Record?"
        message={`Are you sure you want to delete expense record ${expenseToDelete?.expense_number}? This will reverse the expense and its corresponding financial ledger transactions.`}
        confirmLabel="Delete Expense"
        variant="danger"
      />
    </div>
  );
};

export default Expenses;
