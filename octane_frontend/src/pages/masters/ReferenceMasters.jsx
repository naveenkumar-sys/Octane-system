import React, { useState } from 'react';
import { Tag, Scale, Percent, CreditCard, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import FormModal from '../../components/ui/FormModal';
import StatusBadge from '../../components/ui/StatusBadge';

export const ReferenceMasters = ({ defaultTab = 'brands' }) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Reference Master Demo Data Stores (Persisted locally & synced to product definitions)
  const [brands, setBrands] = useState([
    { id: 1, name: 'Dell', origin: 'USA', category: 'Laptops & Workstations', is_active: true },
    { id: 2, name: 'HP', origin: 'USA', category: 'Printers & Laptops', is_active: true },
    { id: 3, name: 'Lenovo', origin: 'China', category: 'ThinkPad & Laptops', is_active: true },
    { id: 4, name: 'Hikvision', origin: 'China', category: 'CCTV & Security', is_active: true },
    { id: 5, name: 'Kingston', origin: 'USA', category: 'RAM & SSD Storage', is_active: true },
    { id: 6, name: 'Samsung', origin: 'Korea', category: 'Displays & Memory', is_active: true },
  ]);

  const [units, setUnits] = useState([
    { id: 1, code: 'NOS', name: 'Numbers', decimal_places: 0, description: 'Individual unit count', is_active: true },
    { id: 2, code: 'PCS', name: 'Pieces', decimal_places: 0, description: 'Piece count', is_active: true },
    { id: 3, code: 'SET', name: 'Set', decimal_places: 0, description: 'Multi-item packaged set', is_active: true },
    { id: 4, code: 'MTR', name: 'Meters', decimal_places: 2, description: 'Cable length in meters', is_active: true },
    { id: 5, code: 'BOX', name: 'Box', decimal_places: 0, description: 'Box quantity', is_active: true },
  ]);

  const [taxes, setTaxes] = useState([
    { id: 1, hsn_sac: '84713010', type: 'HSN', rate: 18.0, description: 'Laptops & Portable Computers', is_active: true },
    { id: 2, hsn_sac: '85235100', type: 'HSN', rate: 18.0, description: 'SSD & Memory Storage Media', is_active: true },
    { id: 3, hsn_sac: '85258090', type: 'HSN', rate: 18.0, description: 'CCTV Security Cameras', is_active: true },
    { id: 4, hsn_sac: '998313', type: 'SAC', rate: 18.0, description: 'IT Infrastructure & Repair Services', is_active: true },
    { id: 5, hsn_sac: '998713', type: 'SAC', rate: 18.0, description: 'Computer & Hardware Maintenance', is_active: true },
  ]);

  const [paymentMethods, setPaymentMethods] = useState([
    { id: 1, name: 'Cash', code: 'CASH', icon_type: 'Cash', is_active: true, description: 'Physical cash billing at terminal' },
    { id: 2, name: 'UPI / QR Code', code: 'UPI', icon_type: 'QR', is_active: true, description: 'GooglePay, PhonePe, Paytm QR' },
    { id: 3, name: 'Bank Transfer / NEFT', code: 'BANK', icon_type: 'Bank', is_active: true, description: 'Direct Kotak bank settlement' },
    { id: 4, name: 'Cheque', code: 'CHEQUE', icon_type: 'Paper', is_active: true, description: 'Delayed clearance cheque' },
    { id: 5, name: 'Credit / Debit Card', code: 'CARD', icon_type: 'POS', is_active: true, description: 'POS card terminal swipe' },
  ]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordExtra, setNewRecordExtra] = useState('');
  const [newRecordRate, setNewRecordRate] = useState('18.00');

  const handleOpenAdd = () => {
    setNewRecordName('');
    setNewRecordExtra('');
    setIsModalOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newRecordName) return;

    if (activeTab === 'brands') {
      setBrands([
        ...brands,
        { id: Date.now(), name: newRecordName, category: newRecordExtra || 'General', is_active: true },
      ]);
    } else if (activeTab === 'units') {
      setUnits([
        ...units,
        { id: Date.now(), code: newRecordName.toUpperCase(), name: newRecordExtra || newRecordName, decimal_places: 0, is_active: true },
      ]);
    } else if (activeTab === 'tax') {
      setTaxes([
        ...taxes,
        { id: Date.now(), hsn_sac: newRecordName, type: 'HSN', rate: parseFloat(newRecordRate || 18), description: newRecordExtra, is_active: true },
      ]);
    } else if (activeTab === 'payments') {
      setPaymentMethods([
        ...paymentMethods,
        { id: Date.now(), name: newRecordName, code: newRecordName.toUpperCase().replace(/\s+/g, '_'), is_active: true, description: newRecordExtra },
      ]);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="text-orange-600" size={24} />
            <span>Reference Masters Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain reusable Brands, Measurement Units, GST HSN/SAC Codes, and Payment Methods.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Reference Master</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs border gap-1">
        <button
          onClick={() => setActiveTab('brands')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'brands' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Tag size={15} />
          <span>Brands Master ({brands.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'units' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Scale size={15} />
          <span>Measurement Units ({units.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'tax' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Percent size={15} />
          <span>GST / HSN / SAC ({taxes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'payments' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CreditCard size={15} />
          <span>Payment Methods ({paymentMethods.length})</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'brands' && (
        <DataTable
          columns={[
            { header: 'Brand Name', accessor: 'name', sortable: true, render: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
            { header: 'Category Scope', accessor: 'category', render: (r) => <span className="text-xs text-slate-600">{r.category}</span> },
            { header: 'Status', accessor: 'is_active', render: (r) => <StatusBadge status={r.is_active} type="status" /> },
          ]}
          data={brands}
        />
      )}

      {activeTab === 'units' && (
        <DataTable
          columns={[
            { header: 'Unit Code', accessor: 'code', sortable: true, render: (r) => <span className="font-mono font-extrabold text-orange-600">{r.code}</span> },
            { header: 'Full Name', accessor: 'name', render: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
            { header: 'Description', accessor: 'description', render: (r) => <span className="text-xs text-slate-500">{r.description}</span> },
            { header: 'Status', accessor: 'is_active', render: (r) => <StatusBadge status={r.is_active} type="status" /> },
          ]}
          data={units}
        />
      )}

      {activeTab === 'tax' && (
        <DataTable
          columns={[
            { header: 'HSN / SAC Code', accessor: 'hsn_sac', sortable: true, render: (r) => <span className="font-mono font-extrabold text-slate-900">{r.hsn_sac}</span> },
            { header: 'Type', accessor: 'type', render: (r) => <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 rounded font-bold">{r.type}</span> },
            { header: 'GST Tax Rate', accessor: 'rate', sortable: true, render: (r) => <span className="font-bold text-emerald-600">{r.rate}%</span> },
            { header: 'Description', accessor: 'description', render: (r) => <span className="text-xs text-slate-600">{r.description}</span> },
          ]}
          data={taxes}
        />
      )}

      {activeTab === 'payments' && (
        <DataTable
          columns={[
            { header: 'Payment Method', accessor: 'name', sortable: true, render: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
            { header: 'Code', accessor: 'code', render: (r) => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{r.code}</span> },
            { header: 'Description', accessor: 'description', render: (r) => <span className="text-xs text-slate-500">{r.description}</span> },
            { header: 'Status', accessor: 'is_active', render: (r) => <StatusBadge status={r.is_active} type="status" /> },
          ]}
          data={paymentMethods}
        />
      )}

      {/* Add Master Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddSubmit}
        title={`Add New ${activeTab.toUpperCase()} Master`}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Name / Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. Master name or code"
              value={newRecordName}
              onChange={(e) => setNewRecordName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
            />
          </div>

          {activeTab === 'tax' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">GST Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={newRecordRate}
                onChange={(e) => setNewRecordRate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Description / Details</label>
            <input
              type="text"
              placeholder="Brief description..."
              value={newRecordExtra}
              onChange={(e) => setNewRecordExtra(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default ReferenceMasters;
