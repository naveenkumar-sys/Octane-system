import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import FormModal from '../ui/FormModal';

export const SupplierFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingSupplier = null,
  title,
  subtitle,
}) => {
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

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
    if (isOpen) {
      setFormError(null);
      if (editingSupplier) {
        setFormData({
          name: editingSupplier.name || '',
          mobile: editingSupplier.mobile || '',
          email: editingSupplier.email || '',
          gstin: editingSupplier.gstin || '',
          address_line1: editingSupplier.address_line1 || '',
          address_line2: editingSupplier.address_line2 || '',
          city: editingSupplier.city || 'Bengaluru',
          pincode: editingSupplier.pincode || '',
          state_name: editingSupplier.state_name || 'Karnataka',
          state_code: editingSupplier.state_code || '29',
          is_active: editingSupplier.is_active ?? true,
          notes: editingSupplier.notes || '',
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [isOpen, editingSupplier]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      let result;
      if (editingSupplier) {
        result = await api.updateSupplier(editingSupplier.id, formData);
      } else {
        result = await api.createSupplier(formData);
      }
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      setFormError(err.message || 'Validation error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleFormSubmit}
      loading={formLoading}
      title={title || (editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier')}
      subtitle={subtitle}
      error={formError}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-700">Supplier / Vendor Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Infotech Hardware Distributors Pvt Ltd"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Mobile Number</label>
          <input
            type="text"
            placeholder="+91 9999999999"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Email Address</label>
          <input
            type="email"
            placeholder="vendor@infotech.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-700">GSTIN Number (15 Characters)</label>
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
          <label className="text-xs font-bold text-slate-700">Address Line 1</label>
          <input
            type="text"
            placeholder="Building No / Street"
            value={formData.address_line1}
            onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Address Line 2</label>
          <input
            type="text"
            placeholder="Area / Landmark"
            value={formData.address_line2}
            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
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
          <label className="text-xs font-bold text-slate-700">Pincode</label>
          <input
            type="text"
            placeholder="560068"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
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

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-700">Supplier Notes</label>
          <textarea
            rows={2}
            placeholder="Payment terms, bank account details..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>
      </div>
    </FormModal>
  );
};

export default SupplierFormModal;
