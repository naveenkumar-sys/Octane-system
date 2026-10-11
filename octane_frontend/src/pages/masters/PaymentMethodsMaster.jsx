import React, { useState } from 'react';
import { CreditCard, Plus, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';

export const PaymentMethodsMaster = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const [methods, setMethods] = useState([
    { id: 1, name: 'Cash', code: 'CASH', description: 'Physical cash billing at terminal', is_active: true },
    { id: 2, name: 'UPI / QR Code', code: 'UPI', description: 'GooglePay, PhonePe, Paytm QR code settlement', is_active: true },
    { id: 3, name: 'Bank Transfer / NEFT', code: 'BANK', description: 'Direct Kotak bank account transfer', is_active: true },
    { id: 4, name: 'Cheque', code: 'CHEQUE', description: 'Delayed clearance cheque payment', is_active: true },
    { id: 5, name: 'Credit / Debit Card', code: 'CARD', description: 'POS card terminal swipe', is_active: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '', is_active: true });

  const handleOpenAdd = () => {
    setEditingMethod(null);
    setFormData({ name: '', code: '', description: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (method) => {
    setEditingMethod(method);
    setFormData({
      name: method.name || '',
      code: method.code || '',
      description: method.description || '',
      is_active: method.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (editingMethod) {
      setMethods(methods.map((m) => (m.id === editingMethod.id ? { ...m, ...formData } : m)));
    } else {
      setMethods([...methods, { id: Date.now(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const filteredMethods = methods.filter(
    (m) =>
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'Payment Method',
      accessor: 'name',
      sortable: true,
      render: (row) => <span className="font-extrabold text-slate-900">{row.name}</span>,
    },
    {
      header: 'System Code',
      accessor: 'code',
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">{row.code}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => <span className="text-xs text-slate-500">{row.description}</span>,
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
              title="Edit Payment Method"
            >
              <Edit2 size={16} />
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
            <CreditCard className="text-orange-600" size={24} />
            <span>Payment Methods Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accepted payment modes (Cash, UPI, Bank Transfer, Card, Cheque) used in POS billing & financial ledgers.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Payment Method</span>
          </button>
        )}
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search payment method or code..." />
      </div>

      <DataTable columns={columns} data={filteredMethods} keyField="id" />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        title={editingMethod ? `Edit Payment Method: ${editingMethod.name}` : 'Add New Payment Method'}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Payment Method Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. UPI / QR Code"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">System Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. UPI, CASH, BANK"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description</label>
            <input
              type="text"
              placeholder="Usage details..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default PaymentMethodsMaster;
