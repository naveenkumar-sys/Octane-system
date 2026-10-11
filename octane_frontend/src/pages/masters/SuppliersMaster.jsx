import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Power, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';
import SupplierFormModal from '../../components/forms/SupplierFormModal';

export const SuppliersMaster = () => {
  const { isAdmin } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [detailSupplier, setDetailSupplier] = useState(null);
  const [confirmToggleSupplier, setConfirmToggleSupplier] = useState(null);

  const initialFormState = {
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    address_line1: '',
    address_line2: '',
    city: 'Bengaluru',
    pincode: '',
    state_name: 'Karnataka',
    state_code: '29',
    is_active: true,
    notes: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSuppliers();
      setSuppliers(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError(err.message || 'Failed to load suppliers master.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name || '',
      mobile: sup.mobile || '',
      email: sup.email || '',
      gstin: sup.gstin || '',
      address_line1: sup.address_line1 || '',
      address_line2: sup.address_line2 || '',
      city: sup.city || 'Bengaluru',
      pincode: sup.pincode || '',
      state_name: sup.state_name || 'Karnataka',
      state_code: sup.state_code || '29',
      is_active: sup.is_active ?? true,
      notes: sup.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, formData);
      } else {
        await api.createSupplier(formData);
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmToggleSupplier) return;
    setFormLoading(true);
    try {
      await api.patchSupplier(confirmToggleSupplier.id, {
        is_active: !confirmToggleSupplier.is_active,
      });
      setConfirmToggleSupplier(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle supplier status.');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.mobile?.includes(searchQuery) ||
      s.gstin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'Supplier Name & GSTIN',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900">{row.name}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            GSTIN: {row.gstin || 'Unregistered'}
          </div>
        </div>
      ),
    },
    {
      header: 'Contact Info',
      accessor: 'mobile',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.mobile || '—'}</div>
          <div className="text-[11px] text-slate-400">{row.email || 'No Email'}</div>
        </div>
      ),
    },
    {
      header: 'Location',
      accessor: 'city',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.city}, {row.state_name} ({row.state_code})
        </span>
      ),
    },
    {
      header: 'Financial Summary',
      accessor: 'total_purchased',
      render: (row) => (
        <div>
          <div className="font-mono text-xs font-bold text-slate-900">
            Purchases: ₹{parseFloat(row.total_purchased || 0).toFixed(2)}
          </div>
          <div
            className={`text-[10px] font-mono font-bold ${
              parseFloat(row.balance_outstanding || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            Due: ₹{parseFloat(row.balance_outstanding || 0).toFixed(2)}
          </div>
        </div>
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
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setDetailSupplier(row)}
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
                title="Edit Supplier"
              >
                <Edit2 size={16} />
              </button>

              <button
                onClick={() => setConfirmToggleSupplier(row)}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.is_active
                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={row.is_active ? 'Deactivate Supplier' : 'Activate Supplier'}
              >
                <Power size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading Suppliers Master directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchSuppliers} />;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="text-orange-600" size={24} />
            <span>Suppliers Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor master records, GSTIN registry, billing addresses & credit summary.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add New Supplier</span>
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search supplier by name, mobile, GSTIN..."
        />
      </div>

      {/* Data Table */}
      {filteredSuppliers.length === 0 ? (
        <EmptyState
          title="No Suppliers Found"
          description={
            searchQuery
              ? 'No suppliers match your search parameters.'
              : 'Supplier directory is empty. Click "+ Add New Supplier" to create your first vendor profile.'
          }
          actionLabel={isAdmin ? '+ Add New Supplier' : null}
          onAction={isAdmin ? handleOpenAdd : null}
        />
      ) : (
        <DataTable columns={columns} data={filteredSuppliers} keyField="id" />
      )}

      {/* Supplier Form Modal */}
      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSuppliers}
        editingSupplier={editingSupplier}
      />

      {/* Details Modal */}
      {detailSupplier && (
        <FormModal
          isOpen={Boolean(detailSupplier)}
          onClose={() => setDetailSupplier(null)}
          title={`Supplier: ${detailSupplier.name}`}
          subtitle={`GSTIN: ${detailSupplier.gstin || 'Unregistered'}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setDetailSupplier(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Purchased</span>
                <span className="text-base font-extrabold text-slate-900">
                  ₹{parseFloat(detailSupplier.total_purchased || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Outstanding</span>
                <span className="text-base font-extrabold text-rose-600">
                  ₹{parseFloat(detailSupplier.balance_outstanding || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-500 block">Address:</span>
              <p className="text-slate-800">
                {[detailSupplier.address_line1, detailSupplier.address_line2, detailSupplier.city, detailSupplier.state_name, detailSupplier.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>
        </FormModal>
      )}

      {/* Confirm Deactivate Modal */}
      <ConfirmDialog
        isOpen={Boolean(confirmToggleSupplier)}
        onClose={() => setConfirmToggleSupplier(null)}
        onConfirm={handleToggleStatus}
        loading={formLoading}
        title={confirmToggleSupplier?.is_active ? 'Deactivate Supplier' : 'Activate Supplier'}
        message={`Are you sure you want to ${
          confirmToggleSupplier?.is_active ? 'deactivate' : 'activate'
        } supplier "${confirmToggleSupplier?.name}"?`}
        confirmLabel={confirmToggleSupplier?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmToggleSupplier?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
};

export default SuppliersMaster;
