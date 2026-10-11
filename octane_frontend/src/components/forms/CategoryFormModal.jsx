import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import FormModal from '../ui/FormModal';
import { toast } from 'react-toastify';

export const CategoryFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Create Product Category',
  subtitle = 'Add a new product category to classify catalog items.',
}) => {
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setFormData({
        name: '',
        description: '',
        is_active: true,
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const createdCategory = await api.createProductCategory({
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
      });

      toast.success(`Category '${createdCategory.name}' created successfully!`);
      if (onSuccess) {
        onSuccess(createdCategory);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create product category:', err);
      setFormError(err.message || 'Failed to create category.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      onSubmit={handleSubmit}
      isLoading={formLoading}
      submitLabel="Create Category"
    >
      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
          {formError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
            Category Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Laptops, Storage Devices, CCTV Cameras"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Brief classification description..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>
    </FormModal>
  );
};

export default CategoryFormModal;
