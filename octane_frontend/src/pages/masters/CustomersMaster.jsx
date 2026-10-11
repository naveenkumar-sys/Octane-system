import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Eye } from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';

export const CustomersMaster = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [detailCustomer, setDetailCustomer] = useState(null);

  const initialFormState = {
    name: '',
    mobile: '',
    email: '',
    customer_type: 'INDIVIDUAL',
    gstin: '',
    billing_address_line1: '',
    billing_address_line2: '',
    city: 'Bengaluru',
    pincode: '',
    state_name: 'Karnataka',
    state_code: '29',
    shipping_address: '',
    is_active: true,
    notes: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCustomers();
      setCustomers(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError(err.message || 'Failed to load customers master.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name || '',
      mobile: cust.mobile || '',
      email: cust.email || '',
      customer_type: cust.customer_type || 'INDIVIDUAL',
      gstin: cust.gstin || '',
      billing_address_line1: cust.billing_address_line1 || '',
      billing_address_line2: cust.billing_address_line2 || '',
      city: cust.city || 'Bengaluru',
      pincode: cust.pincode || '',
      state_name: cust.state_name || 'Karnataka',
      state_code: cust.state_code || '29',
      shipping_address: cust.shipping_address || '',
      is_active: cust.is_active ?? true,
      notes: cust.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      !searchQuery ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobile?.includes(searchQuery) ||
      c.gstin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'Customer Name & Type',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-extrabold text-slate-900 flex items-center gap-2">
            <span>{row.name}</span>
            <StatusBadge status={row.customer_type} type="customer_type" />
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            GSTIN: {row.gstin || 'Unregistered'}
          </div>
        </div>
      ),
    },
    {
      header: 'Contact Details',
      accessor: 'mobile',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.mobile || '—'}</div>
          <div className="text-[11px] text-slate-400">{row.email || 'No Email'}</div>
        </div>
      ),
    },
    {
      header: 'City / Location',
      accessor: 'city',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.city}, {row.state_name}
        </span>
      ),
    },
    {
      header: 'Billing Ledger Summary',
      accessor: 'total_invoiced',
      render: (row) => (
        <div>
          <div className="font-mono text-xs font-bold text-slate-900">
            Invoiced: ₹{parseFloat(row.total_invoiced || 0).toFixed(2)}
          </div>
          <div
            className={`text-[10px] font-mono font-bold ${
              parseFloat(row.balance_due || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            Balance Due: ₹{parseFloat(row.balance_due || 0).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setDetailCustomer(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="View Customer Details"
          >
            <Eye size={16} />
          </button>

          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            title="Edit Customer"
          >
            <Edit2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState message="Loading Customers Master directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchCustomers} />;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-orange-600" size={24} />
            <span>Customers Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer Profiles, B2B GSTIN registry, billing addresses & credit balance ledgers.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search customer by name, mobile, GSTIN..."
        />
      </div>

      {/* Data Table */}
      {filteredCustomers.length === 0 ? (
        <EmptyState
          title="No Customers Found"
          description={
            searchQuery
              ? 'No customers match your search parameters.'
              : 'Customer directory is empty. Click "+ Add New Customer" to register a customer.'
          }
          actionLabel="+ Add New Customer"
          onAction={handleOpenAdd}
        />
      ) : (
        <DataTable columns={columns} data={filteredCustomers} keyField="id" />
      )}

      {/* Form Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        loading={formLoading}
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add New Customer Profile'}
        error={formError}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-700">Customer Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar / Octane Technologies"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Customer Type</label>
            <select
              value={formData.customer_type}
              onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            >
              <option value="INDIVIDUAL">Individual (Retail B2C)</option>
              <option value="BUSINESS">Business / Company (B2B)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Mobile Number</label>
            <input
              type="text"
              placeholder="+91 9888888888"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Email Address</label>
            <input
              type="email"
              placeholder="customer@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">GSTIN (B2B Businesses)</label>
            <input
              type="text"
              placeholder="e.g. 29DRTPA7275L1ZW"
              maxLength={15}
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Billing Address Line 1</label>
            <input
              type="text"
              placeholder="House / Office / Street"
              value={formData.billing_address_line1}
              onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">State Name</label>
            <input
              type="text"
              value={formData.state_name}
              onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">State Code</label>
            <input
              type="text"
              value={formData.state_code}
              onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
        </div>
      </FormModal>

      {/* Details Modal */}
      {detailCustomer && (
        <FormModal
          isOpen={Boolean(detailCustomer)}
          onClose={() => setDetailCustomer(null)}
          title={`Customer: ${detailCustomer.name}`}
          subtitle={`GSTIN: ${detailCustomer.gstin || 'Unregistered Individual'}`}
          submitLabel="Close"
          onSubmit={(e) => {
            e.preventDefault();
            setDetailCustomer(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Invoiced</span>
                <span className="text-base font-extrabold text-slate-900">
                  ₹{parseFloat(detailCustomer.total_invoiced || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Due</span>
                <span className="text-base font-extrabold text-rose-600">
                  ₹{parseFloat(detailCustomer.balance_due || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
};

export default CustomersMaster;
