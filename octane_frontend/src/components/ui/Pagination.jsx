import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  showPageSize = true,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }

    if (safePage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 ${className}`}
    >
      {/* Left: Summary & Page Size selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="font-medium text-slate-600">
          Showing <span className="font-extrabold text-slate-900 font-mono">{startItem}</span> to{' '}
          <span className="font-extrabold text-slate-900 font-mono">{endItem}</span> of{' '}
          <span className="font-extrabold text-slate-900 font-mono">{totalItems}</span> entries
        </div>

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 text-slate-500">
            <span className="text-[11px] font-medium">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
          title="First Page"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
          title="Previous Page"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1 px-1">
          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} className="px-1 text-slate-400 font-mono select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  safePage === p
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
          title="Next Page"
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
          title="Last Page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
