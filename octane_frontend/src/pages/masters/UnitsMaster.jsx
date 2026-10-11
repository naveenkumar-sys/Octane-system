import React, { useState } from 'react';
import { Scale, Plus, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';

export const UnitsMaster = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const [units, setUnits] = useState([
    { id: 1, code: 'NOS', name: 'Numbers', decimal_places: 0, description: 'Individual unit count', is_active: true },
    { id: 2, code: 'PCS', name: 'Pieces', decimal_places: 0, description: 'Piece count', is_active: true },
    { id: 3, code: 'SET', name: 'Set', decimal_places: 0, description: 'Multi-item packaged set', is_active: true },
    { id: 4, code: 'MTR', name: 'Meters', decimal_places: 2, description: 'Cable length in meters', is_active: true },
    { id: 5, code: 'BOX', name: 'Box', decimal_places: 0, description: 'Box quantity', is_active: true },
    { id: 6, code: 'PACK', name: 'Pack', decimal_places: 0, description: 'Bundled pack', is_active: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '', description: '', decimal_places: 0, is_active: true });

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setFormData({ code: '', name: '', description: '', decimal_places: 0, is_active: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code || '',
      name: unit.name || '',
      description: unit.description || '',
      decimal_places: unit.decimal_places || 0,
      is_active: unit.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (editingUnit) {
      setUnits(units.map((u) => (u.id === editingUnit.id ? { ...u, ...formData } : u)));
    } else {
      setUnits([...units, { id: Date.now(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const filteredUnits = units.filter(
    (u) =>
      !searchQuery ||
      u.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: 'Unit Code',
      accessor: 'code',
      sortable: true,
      render: (row) => <span className="font-mono font-extrabold text-orange-600">{row.code}</span>,
    },
    {
      header: 'Full Name',
      accessor: 'name',
      sortable: true,
      render: (row) => <span className="font-extrabold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => <span className="text-xs text-slate-500">{row.description || '—'}</span>,
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
              title="Edit Unit"
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
            <Scale className="text-orange-600" size={24} />
            <span>Units Master Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Measurement units directory (NOS, PCS, SET, MTR, BOX, PACK) used across product inventory.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add New Unit</span>
          </button>
        )}
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search unit code or name..." />
      </div>

      <DataTable columns={columns} data={filteredUnits} keyField="id" />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        title={editingUnit ? `Edit Unit: ${editingUnit.code}` : 'Add New Unit Master'}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Unit Code (Short Symbol) *</label>
            <input
              type="text"
              required
              placeholder="e.g. NOS, PCS, MTR"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Numbers, Meters, Pieces"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description</label>
            <input
              type="text"
              placeholder="Unit description or usage..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default UnitsMaster;
