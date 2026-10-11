import React from 'react';
import { X } from 'lucide-react';

export const FormModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  loading = false,
  submitLabel = 'Save Record',
  error = null,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto relative">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-extrabold tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-300 font-mono mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold font-mono">
            {typeof error === 'object'
              ? Object.entries(error)
                  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                  .join(' | ')
              : error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">{children}</div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              {loading ? 'Processing...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormModal;
