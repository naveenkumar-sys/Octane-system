import React from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import Pagination from './Pagination';

export const Table = ({
  columns = [],
  data = [],
  loading = false,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filterOptions = [],
  selectedFilter = '',
  onFilterChange,
  page = 1,
  totalPages = 1,
  totalRecords = 0,
  onPageChange,
  headerActions,
  emptyMessage = 'No records found',
  onRefresh,
}) => {
  return (
    <div className="glass-panel rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      {(onSearchChange || filterOptions.length > 0 || headerActions || onRefresh) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3 flex-1">
            {onSearchChange && (
              <div className="w-full sm:max-w-xs">
                <Input
                  icon={Search}
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="mb-0"
                  inputClassName="py-1.5 text-xs bg-white"
                />
              </div>
            )}

            {filterOptions.length > 0 && onFilterChange && (
              <select
                value={selectedFilter}
                onChange={(e) => onFilterChange(e.target.value)}
                className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="">All Statuses</option>
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                title="Refresh table"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-orange-600' : ''} />
              </button>
            )}
          </div>

          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Main Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-800">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`px-4 py-3.5 font-bold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.headerClassName || ''}`}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Skeleton Loading Rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-3 rounded-full bg-orange-50 text-orange-500 mb-3 border border-orange-200">
                      <Inbox size={32} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{emptyMessage}</span>
                    <span className="text-xs text-slate-500 mt-1">Try refining your search query or filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Real Data Rows
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-orange-50/40 transition-colors duration-150 group"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`px-4 py-3.5 whitespace-nowrap text-slate-800 text-xs ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 1 && onPageChange && (
        <Pagination
          currentPage={page}
          totalItems={totalRecords || totalPages * 10}
          pageSize={Math.max(1, Math.round((totalRecords || totalPages * 10) / totalPages))}
          onPageChange={onPageChange}
          showPageSize={false}
        />
      )}
    </div>
  );
};

export default Table;
