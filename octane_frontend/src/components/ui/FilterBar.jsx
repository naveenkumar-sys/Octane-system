import React from 'react';
import { Filter } from 'lucide-react';

export const FilterBar = ({ filters = [], values = {}, onChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
        <Filter size={14} className="text-orange-600" />
        <span>Filters:</span>
      </div>
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center">
          <select
            value={values[filter.key] ?? filter.defaultValue ?? 'ALL'}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all cursor-pointer"
          >
            <option value="ALL">{filter.label}: All</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};

export default FilterBar;
