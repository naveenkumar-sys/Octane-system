import React, { useState, useEffect } from 'react';
import FormModal from '../ui/FormModal';
import { Tag } from 'lucide-react';
import { api } from '../../services/api';

export const BrandFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  categories = [],
  editingBrand = null,
  initialCategoryId = '',
  title,
  subtitle,
  submitText,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    origin: '',
    description: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editingBrand) {
        setFormData({
          name: editingBrand.name || '',
          category: editingBrand.category || editingBrand.category_id || '',
          origin: editingBrand.origin || '',
          description: editingBrand.description || '',
          is_active: editingBrand.is_active ?? true,
        });
      } else {
        setFormData({
          name: '',
          category: initialCategoryId || '',
          origin: '',
          description: '',
          is_active: true,
        });
      }
    }
  }, [isOpen, editingBrand, initialCategoryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Brand name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      category: formData.category ? Number(formData.category) : null,
      origin: formData.origin.trim() || '',
      description: formData.description.trim() || '',
      is_active: formData.is_active,
    };

    try {
      let result;
      if (editingBrand) {
        result = await api.updateBrand(editingBrand.id, payload);
      } else {
        result = await api.createBrand(payload);
      }

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Error saving brand:', err);
      setError(err.message || 'Failed to save brand.');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = title || (editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Add New Brand Master');
  const modalSubtitle = subtitle || (editingBrand ? 'Update brand details' : 'Configure manufacturer brand and category scope.');
  const buttonText = submitText || (editingBrand ? 'Update Brand' : 'Save Record');

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={Tag}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      submitText={buttonText}
    >
      <div className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Brand Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Dell, HP, Lenovo, Hikvision, Samsung, Kingston"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-bold text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Associated Category Scope (Optional)
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-semibold text-slate-900"
          >
            <option value="">-- All Categories / General --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Country of Origin / Manufacturer (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. USA, India, Taiwan, China"
            value={formData.origin}
            onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Description / Notes (Optional)
          </label>
          <textarea
            rows="2"
            placeholder="Brief brand specifications or authorized distribution notes..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-slate-800"
          />
        </div>

        {editingBrand && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="brand_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
            />
            <label htmlFor="brand_is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
              Active Status
            </label>
          </div>
        )}
      </div>
    </FormModal>
  );
};

export default BrandFormModal;
