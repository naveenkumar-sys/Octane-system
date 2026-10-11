import React, { useState, useEffect } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import Pagination from '../ui/Pagination';

/**
 * Reusable report table with loading, empty, error states, and built-in pagination.
 * columns: [{ key, label, align, render }]
 */
export const ReportTable = ({
  columns = [],
  rows = [],
  loading = false,
  error = null,
  emptyMessage = 'No data found for the selected filters.',
  className = '',
  pageSize: initialPageSize = 15,
  paginationPerPage,
  showPagination = true,
  pageSizeOptions = [10, 15, 25, 50, 100],
}) => {
  const [pageSize, setPageSize] = useState(paginationPerPage || initialPageSize || 15);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync with prop if paginationPerPage or initialPageSize changes
  useEffect(() => {
    if (paginationPerPage) setPageSize(paginationPerPage);
  }, [paginationPerPage]);

  // Reset to page 1 whenever row length changes (e.g. search or filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [rows?.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin border-[3px]" />
        <span className="text-xs font-semibold">Loading report data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-rose-500">
        <AlertCircle size={32} className="text-rose-400" />
        <span className="text-xs font-semibold text-center">{error}</span>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
        <Inbox size={32} />
        <span className="text-xs font-semibold">{emptyMessage}</span>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedRows = showPagination
    ? rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : rows;

  return (
    <div className={`border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-slate-700 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && rows.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={rows.length}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
};

export default ReportTable;
