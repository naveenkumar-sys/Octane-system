import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Pagination from './Pagination';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records available.',
  keyField = 'id',
  pageSize: initialPageSize = 10,
  paginationPerPage,
  pageSizeOptions = [10, 15, 25, 50, 100],
  showPagination = true,
}) => {
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageSize, setPageSize] = useState(paginationPerPage || initialPageSize || 10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync if prop changes
  useEffect(() => {
    if (paginationPerPage) setPageSize(paginationPerPage);
  }, [paginationPerPage]);

  // Reset to first page when underlying data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data?.length]);

  const handleSort = (field) => {
    if (!field) return;
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortField] ?? '';
      let bVal = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize, showPagination]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable && handleSort(col.accessor)}
                  className={`py-3 px-4 ${col.sortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''} ${
                    col.className || ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && sortField === col.accessor && (
                      <span className="text-orange-600">
                        {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 font-mono">
                  Loading records...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={row[keyField] ?? rIdx} className="hover:bg-orange-50/30 transition-colors">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`py-3 px-4 text-slate-800 font-medium ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.accessor] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {showPagination && sortedData.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={sortedData.length}
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

export default DataTable;
