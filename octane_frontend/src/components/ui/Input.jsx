import React, { forwardRef } from 'react';

export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      icon: Icon,
      iconPosition = 'left',
      type = 'text',
      className = '',
      inputClassName = '',
      required = false,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative rounded-lg shadow-sm">
          {Icon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Icon size={18} />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            className={`
              w-full rounded-lg bg-white border text-sm text-slate-900 placeholder-slate-400
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500
              disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed
              ${Icon && iconPosition === 'left' ? 'pl-10' : 'pl-3.5'}
              ${Icon && iconPosition === 'right' ? 'pr-10' : 'pr-3.5'}
              ${error ? 'border-rose-500 focus:ring-rose-500/30 focus:border-rose-500' : 'border-slate-300 hover:border-slate-400'}
              py-2.5
              ${inputClassName}
            `}
            {...props}
          />

          {Icon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <Icon size={18} />
            </div>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
        {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Select = forwardRef(
  (
    {
      label,
      options = [],
      error,
      helperText,
      icon: Icon,
      className = '',
      selectClassName = '',
      required = false,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative rounded-lg shadow-sm">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Icon size={18} />
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            className={`
              w-full rounded-lg bg-white border text-sm text-slate-900
              transition-colors duration-200 appearance-none
              focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500
              disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed
              ${Icon ? 'pl-10' : 'pl-3.5'} pr-8 py-2.5
              ${error ? 'border-rose-500 focus:ring-rose-500/30 focus:border-rose-500' : 'border-slate-300 hover:border-slate-400'}
              ${selectClassName}
            `}
            {...props}
          >
            {children ? (
              children
            ) : (
              options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
                  {opt.label}
                </option>
              ))
            )}
          </select>

          {/* Custom chevron arrow */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
        {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export const Toggle = ({ enabled, onChange, label, description, disabled = false }) => {
  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="pr-4">
          {label && <span className="text-sm font-semibold text-slate-800">{label}</span>}
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-white
          ${enabled ? 'bg-orange-500' : 'bg-slate-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
};

export default Input;
