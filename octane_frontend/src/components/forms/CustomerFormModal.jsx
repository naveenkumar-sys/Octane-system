import React, { useState, useEffect } from 'react';
import FormModal from '../ui/FormModal';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export const CustomerFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit = null,
  initialMobile = '',
  title = 'Add Customer',
  subtitle = 'Create customer profile for POS billing & GST returns',
}) => {
  const initialFormState = {
    name: '',
    mobile: initialMobile || '',
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (customerToEdit) {
      setFormData({
        name: customerToEdit.name || '',
        mobile: customerToEdit.mobile || '',
        email: customerToEdit.email || '',
        customer_type: customerToEdit.customer_type || 'INDIVIDUAL',
        gstin: customerToEdit.gstin || '',
        billing_address_line1: customerToEdit.billing_address_line1 || '',
        billing_address_line2: customerToEdit.billing_address_line2 || '',
        city: customerToEdit.city || 'Bengaluru',
        pincode: customerToEdit.pincode || '',
        state_name: customerToEdit.state_name || 'Karnataka',
        state_code: customerToEdit.state_code || '29',
        shipping_address: customerToEdit.shipping_address || '',
        is_active: customerToEdit.is_active !== undefined ? customerToEdit.is_active : true,
        notes: customerToEdit.notes || '',
      });
    } else {
      setFormData({
        ...initialFormState,
        mobile: initialMobile || '',
      });
    }
    setError(null);
  }, [customerToEdit, initialMobile, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (customerToEdit) {
        result = await api.updateCustomer(customerToEdit.id, formData);
        toast.success(`Customer "${result.name}" updated successfully!`);
      } else {
        result = await api.createCustomer(formData);
        toast.success(`Customer "${result.name}" created successfully!`);
      }

      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Error saving customer:', err);
      setError(err.message || 'Failed to save customer.');
      toast.error(err.message || 'Failed to save customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={customerToEdit ? 'Edit Customer' : title}
      subtitle={subtitle}
      submitLabel={customerToEdit ? 'Save Changes' : 'Create Customer'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Customer Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Tech Solutions / Rahul Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Customer Type</label>
            <select
              value={formData.customer_type}
              onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="INDIVIDUAL">Individual (B2C Retail)</option>
              <option value="BUSINESS">Business (B2B Tax Invoice)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Mobile Number</label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">GSTIN Number</label>
            <input
              type="text"
              placeholder="29AAAAA0000A1Z5"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 uppercase"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-700">Billing Address</label>
            <input
              type="text"
              placeholder="Address Line 1"
              value={formData.billing_address_line1}
              onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">City</label>
            <input
              type="text"
              placeholder="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Pincode</label>
            <input
              type="text"
              placeholder="Pincode"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>
      </div>
    </FormModal>
  );
};

export default CustomerFormModal;
