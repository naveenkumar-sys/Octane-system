import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Edit2, Power, Eye } from 'lucide-react';
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

export const ServicesMaster = () => {
  const { isAdmin } = useAuth();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState({ category: 'ALL', status: 'ALL' });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Detail Modal State
  const [detailService, setDetailService] = useState(null);
  const [confirmToggleService, setConfirmToggleService] = useState(null);

  // Form Initial State (No Stock Fields!)
  const initialFormState = {
    service_name: '',
    category: '',
    sac: '998313',
    default_rate: '0.00',
    gst_rate: '18.00',
    description: '',
    is_active: true,
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [svcRes, catRes] = await Promise.all([
        api.getServices(),
        api.getServiceCategories(),
      ]);
      setServices(Array.isArray(svcRes) ? svcRes : svcRes.results || []);
      setCategories(Array.isArray(catRes) ? catRes : catRes.results || []);
    } catch (err) {
      console.error('Error loading services master:', err);
      setError(err.message || 'Failed to load services from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service) => {
    setEditingService(service);
    setFormData({
      service_name: service.service_name || '',
      category: service.category || '',
      sac: service.sac || '998313',
      default_rate: service.default_rate ?? '0.00',
      gst_rate: service.gst_rate ?? '18.00',
      description: service.description || '',
      is_active: service.is_active ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const payload = {
      ...formData,
      category: formData.category ? parseInt(formData.category, 10) : null,
      default_rate: parseFloat(formData.default_rate || 0),
      gst_rate: parseFloat(formData.gst_rate || 0),
    };

    try {
      if (editingService) {
        await api.updateService(editingService.id, payload);
      } else {
        await api.createService(payload);
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
    if (!confirmToggleService) return;
    setFormLoading(true);
    try {
      await api.patchService(confirmToggleService.id, {
        is_active: !confirmToggleService.is_active,
      });
      setConfirmToggleService(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle service status.');
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered Services
  const filteredServices = services.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sac?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterValues.category === 'ALL' || String(s.category) === String(filterValues.category);

    const matchesStatus =
      filterValues.status === 'ALL' ||
      (filterValues.status === 'ACTIVE' && s.is_active) ||
      (filterValues.status === 'INACTIVE' && !s.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Table Columns
  const columns = [
    {
      header: 'Service Name & SAC',
      accessor: 'service_name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900">{row.service_name}</div>
          <div className="text-[11px] text-slate-400 font-mono">SAC: {row.sac || 'N/A'}</div>
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
      header: 'Default Rate (₹)',
      accessor: 'default_rate',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-slate-900">
          ₹{parseFloat(row.default_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'GST Rate',
      accessor: 'gst_rate',
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-slate-700">{row.gst_rate}%</span>,
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
            onClick={() => setDetailService(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="View Details"
          >
            <Eye size={16} />
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                title="Edit Service Master"
              >
                <Edit2 size={16} />
              </button>

              <button
                onClick={() => setConfirmToggleService(row)}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.is_active
                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={row.is_active ? 'Deactivate Service' : 'Activate Service'}
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
  ];

  if (loading) return <LoadingState message="Fetching Services Master directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="text-orange-600" size={24} />
            <span>Services Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Non-inventory labor services, SAC codes, SAC tax rates & default labor charges.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add New Service</span>
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search service by name or SAC code..."
        />
        <FilterBar
          filters={filterConfigs}
          values={filterValues}
          onChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
        />
      </div>

      {/* Data Table */}
      {filteredServices.length === 0 ? (
        <EmptyState
          title="No Services Found"
          description={
            searchQuery || filterValues.category !== 'ALL'
              ? 'No services match your search or filter parameters.'
              : 'Services master directory is empty. Click "+ Add New Service" to create your first service.'
          }
          actionLabel={isAdmin ? '+ Add New Service' : null}
          onAction={isAdmin ? handleOpenAdd : null}
        />
      ) : (
        <DataTable columns={columns} data={filteredServices} keyField="id" />
      )}

      {/* Create / Edit Form Modal (Non-Inventory) */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        loading={formLoading}
        title={editingService ? `Edit Service: ${editingService.service_name}` : 'Add New Service Master'}
        subtitle="Services are non-inventory items. Service creation never modifies stock balances."
        error={formError}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-700">Service Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Laptop Motherboard Chip-Level Repair"
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            >
              <option value="">Select Service Category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">SAC Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. 998313 (IT Infrastructure & Maintenance)"
              value={formData.sac}
              onChange={(e) => setFormData({ ...formData, sac: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Default Service Charge (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.default_rate}
              onChange={(e) => setFormData({ ...formData, default_rate: e.target.value })}
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

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-700">Service Terms & Scope</label>
            <textarea
              rows={2}
              placeholder="Enter service scope or labor warranty details..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
        </div>
      </FormModal>

      {/* Details Modal */}
      {detailService && (
        <FormModal
          isOpen={Boolean(detailService)}
          onClose={() => setDetailService(null)}
          title={`Service: ${detailService.service_name}`}
          subtitle={`SAC Code: ${detailService.sac}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setDetailService(null);
          }}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Default Labor Charge</span>
                <span className="text-lg font-extrabold text-slate-900">
                  ₹{parseFloat(detailService.default_rate).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">GST Rate</span>
                <span className="text-sm font-bold text-slate-700">{detailService.gst_rate}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-500">Category:</span>{' '}
                <span className="font-semibold text-slate-800">{detailService.category_name || 'N/A'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Status:</span>{' '}
                <StatusBadge status={detailService.is_active} type="status" />
              </div>
            </div>

            {detailService.description && (
              <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100 text-xs text-slate-700">
                <span className="font-bold text-orange-900 block mb-1">Scope & Terms:</span>
                {detailService.description}
              </div>
            )}
          </div>
        </FormModal>
      )}

      {/* Confirm Deactivate Modal */}
      <ConfirmDialog
        isOpen={Boolean(confirmToggleService)}
        onClose={() => setConfirmToggleService(null)}
        onConfirm={handleToggleStatus}
        loading={formLoading}
        title={confirmToggleService?.is_active ? 'Deactivate Service' : 'Activate Service'}
        message={`Are you sure you want to ${
          confirmToggleService?.is_active ? 'deactivate' : 'activate'
        } service "${confirmToggleService?.service_name}"?`}
        confirmLabel={confirmToggleService?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmToggleService?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
};

export default ServicesMaster;
