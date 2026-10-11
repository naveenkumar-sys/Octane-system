import React, { useState } from 'react';
import { Percent, Plus, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';

export const TaxHsnMaster = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const [taxes, setTaxes] = useState([
    { id: 1, hsn_sac: '84713010', type: 'HSN', rate: 18.0, description: 'Laptops & Portable Computers', is_active: true },
    { id: 2, hsn_sac: '85235100', type: 'HSN', rate: 18.0, description: 'SSD & Memory Storage Media', is_active: true },
    { id: 3, hsn_sac: '85258090', type: 'HSN', rate: 18.0, description: 'CCTV Security Cameras', is_active: true },
    { id: 4, hsn_sac: '84733020', type: 'HSN', rate: 18.0, description: 'Computer RAM & Accessories', is_active: true },
    { id: 5, hsn_sac: '998313', type: 'SAC', rate: 18.0, description: 'IT Infrastructure & Maintenance Services', is_active: true },
    { id: 6, hsn_sac: '998713', type: 'SAC', rate: 18.0, description: 'Computer & Hardware Repair Services', is_active: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [formData, setFormData] = useState({ hsn_sac: '', type: 'HSN', rate: '18.00', description: '', is_active: true });

  const handleOpenAdd = () => {
    setEditingTax(null);
    setFormData({ hsn_sac: '', type: 'HSN', rate: '18.00', description: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tax) => {
    setEditingTax(tax);
    setFormData({
      hsn_sac: tax.hsn_sac || '',
      type: tax.type || 'HSN',
      rate: tax.rate ?? '18.00',
      description: tax.description || '',
      is_active: tax.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (editingTax) {
      setTaxes(taxes.map((t) => (t.id === editingTax.id ? { ...t, ...formData, rate: parseFloat(formData.rate) } : t)));
    } else {
      setTaxes([...taxes, { id: Date.now(), ...formData, rate: parseFloat(formData.rate) }]);
    }
    setIsModalOpen(false);
  };

  const filteredTaxes = taxes.filter(
    (t) =>
      !searchQuery ||
      t.hsn_sac.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'HSN / SAC Code',
      accessor: 'hsn_sac',
      sortable: true,
      render: (row) => <span className="font-mono font-extrabold text-slate-900">{row.hsn_sac}</span>,
    },
    {
      header: 'Type',
      accessor: 'type',
      sortable: true,
      render: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
            row.type === 'HSN' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: 'GST Rate',
      accessor: 'rate',
      sortable: true,
      render: (row) => <span className="font-bold text-emerald-600 font-mono">{row.rate}% GST</span>,
    },
    {
      header: 'Goods / Service Description',
      accessor: 'description',
      render: (row) => <span className="text-xs text-slate-600">{row.description}</span>,
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
              title="Edit HSN/SAC Code"
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
            <Percent className="text-orange-600" size={24} />
            <span>Tax / HSN / SAC Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            GST tax slabs and HSN/SAC code reference directory for GST compliance.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add HSN / SAC Code</span>
          </button>
        )}
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search HSN/SAC code or description..." />
      </div>

      <DataTable columns={columns} data={filteredTaxes} keyField="id" />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        title={editingTax ? `Edit HSN/SAC: ${editingTax.hsn_sac}` : 'Add HSN / SAC Code'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. 84713010"
                value={formData.hsn_sac}
                onChange={(e) => setFormData({ ...formData, hsn_sac: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
              >
                <option value="HSN">HSN (Physical Goods)</option>
                <option value="SAC">SAC (Services & Labor)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">GST Rate (%)</label>
            <select
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
            >
              <option value="0.00">0% (Exempted)</option>
              <option value="5.00">5% GST</option>
              <option value="12.00">12% GST</option>
              <option value="18.00">18% GST (Standard)</option>
              <option value="28.00">28% GST</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description</label>
            <input
              type="text"
              placeholder="Goods or service description..."
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

export default TaxHsnMaster;
