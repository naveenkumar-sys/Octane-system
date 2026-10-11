import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import SearchBar from '../../components/ui/SearchBar';
import Pagination from '../../components/ui/Pagination';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StateViews';
import { Barcode, CheckCircle2, ShieldAlert, RotateCcw, AlertTriangle, RefreshCw, Info } from 'lucide-react';

export const SerialNumbers = () => {
  const [serials, setSerials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serialsRes, productsRes] = await Promise.all([
        api.getSerialNumbers(),
        api.getProducts(),
      ]);

      const serialList = Array.isArray(serialsRes)
        ? serialsRes
        : serialsRes.results || [];
      const productList = Array.isArray(productsRes)
        ? productsRes
        : productsRes.results || [];

      setSerials(serialList);
      // Filter products that have tracking_type === 'SERIAL_NUMBER'
      setProducts(productList.filter((p) => p.tracking_type === 'SERIAL_NUMBER'));
    } catch (err) {
      console.error('Failed to load serial numbers registry:', err);
      setError(err.message || 'Failed to fetch serial numbers data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Data
  const filteredSerials = useMemo(() => {
    return serials.filter((item) => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        (item.serial_number && item.serial_number.toLowerCase().includes(query)) ||
        (item.product_name && item.product_name.toLowerCase().includes(query)) ||
        (item.purchase_reference && item.purchase_reference.toLowerCase().includes(query)) ||
        (item.invoice_reference && item.invoice_reference.toLowerCase().includes(query));

      // Status
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;

      // Product
      const matchProduct =
        productFilter === 'ALL' || String(item.product) === String(productFilter);

      return matchSearch && matchStatus && matchProduct;
    });
  }, [serials, searchQuery, statusFilter, productFilter]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, productFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSerials.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedSerials = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSerials.slice(start, start + pageSize);
  }, [filteredSerials, safePage, pageSize]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span>AVAILABLE</span>
          </span>
        );
      case 'SOLD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            <Info size={12} className="text-slate-500" />
            <span>SOLD</span>
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
            <RotateCcw size={12} className="text-amber-600" />
            <span>RETURNED</span>
          </span>
        );
      case 'DEFECTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={12} className="text-rose-500" />
            <span>DEFECTIVE</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Barcode className="text-orange-600" size={24} />
            Serial Numbers Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual product serial-level tracking, warranty references & status lifecycle.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer border border-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Serials</span>
        </button>
      </div>

      {/* Control Bar: Search & Filters */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search serial number, product name, or invoice..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="SOLD">Sold</option>
                <option value="RETURNED">Returned</option>
                <option value="DEFECTIVE">Defective</option>
              </select>
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">Product:</span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[200px] truncate"
              >
                <option value="ALL">All Serial Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      {loading ? (
        <LoadingState message="Fetching serial number records from Django backend..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filteredSerials.length === 0 ? (
        <EmptyState
          title="No Serial Numbers Found"
          description={
            searchQuery || statusFilter !== 'ALL' || productFilter !== 'ALL'
              ? 'No serial numbers match your filter criteria.'
              : 'No serial numbers have been recorded yet. Serial numbers are auto-created when recording Opening Balance or Purchases.'
          }
        />
      ) : (
        <Card className="bg-white border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Serial Number</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Purchase Ref</th>
                  <th className="py-3.5 px-4">Sales Ref</th>
                  <th className="py-3.5 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSerials.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-black text-amber-900 bg-amber-50/40 border-r border-amber-100/50">
                      {item.serial_number}
                    </td>
                    <td className="py-3 px-4 min-w-[220px]">
                      <div className="font-extrabold text-slate-900 text-xs">{item.product_name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.product_specifications && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/80 whitespace-nowrap">
                            {item.product_specifications}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">Product ID: #{item.product}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {item.purchase_reference || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {item.invoice_reference || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSerials.length > 0 && (
            <Pagination
              currentPage={safePage}
              totalItems={filteredSerials.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setCurrentPage(1);
              }}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default SerialNumbers;
