import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import SearchBar from '../../components/ui/SearchBar';
import Pagination from '../../components/ui/Pagination';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StateViews';
import { FileText, ArrowDownRight, ArrowUpRight, Filter, Calendar, RefreshCw, Barcode } from 'lucide-react';

const IN_MOVEMENT_TYPES = ['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN'];

export const StockLedger = () => {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movementsRes, productsRes] = await Promise.all([
        api.getStockMovements(),
        api.getProducts(),
      ]);

      const movementList = Array.isArray(movementsRes)
        ? movementsRes
        : movementsRes.results || [];
      const productList = Array.isArray(productsRes)
        ? productsRes
        : productsRes.results || [];

      setMovements(movementList);
      setProducts(productList);
    } catch (err) {
      console.error('Failed to load stock ledger:', err);
      setError(err.message || 'Failed to fetch stock movement audit log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute chronological running balance per product
  const movementsWithRunningBalance = useMemo(() => {
    const chronological = [...movements].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const productBalances = {};
    const runningMap = new Map();

    chronological.forEach((item) => {
      const pId = item.product;
      if (productBalances[pId] === undefined) {
        productBalances[pId] = 0;
      }

      const isIn = IN_MOVEMENT_TYPES.includes(item.movement_type);
      if (isIn) {
        productBalances[pId] += item.quantity;
      } else {
        productBalances[pId] -= item.quantity;
      }

      runningMap.set(item.id, productBalances[pId]);
    });

    return movements.map((item) => ({
      ...item,
      running_balance: runningMap.get(item.id) ?? 0,
    }));
  }, [movements]);

  // Filter Movements
  const filteredMovements = useMemo(() => {
    return movementsWithRunningBalance.filter((item) => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        (item.product_name && item.product_name.toLowerCase().includes(query)) ||
        (item.product_sku && item.product_sku.toLowerCase().includes(query)) ||
        (item.reference_id && item.reference_id.toLowerCase().includes(query)) ||
        (item.reference_type && item.reference_type.toLowerCase().includes(query)) ||
        (item.notes && item.notes.toLowerCase().includes(query)) ||
        (item.serial_number_text && item.serial_number_text.toLowerCase().includes(query));

      // Product Filter
      const matchProduct =
        productFilter === 'ALL' || String(item.product) === String(productFilter);

      // Movement Type Filter
      const matchType =
        movementTypeFilter === 'ALL' || item.movement_type === movementTypeFilter;

      // Date Range Filter
      let matchDate = true;
      if (fromDate || toDate) {
        const itemDate = new Date(item.created_at).setHours(0, 0, 0, 0);
        if (fromDate) {
          const from = new Date(fromDate).setHours(0, 0, 0, 0);
          if (itemDate < from) matchDate = false;
        }
        if (toDate) {
          const to = new Date(toDate).setHours(23, 59, 59, 999);
          if (itemDate > to) matchDate = false;
        }
      }

      return matchSearch && matchProduct && matchType && matchDate;
    });
  }, [movementsWithRunningBalance, searchQuery, productFilter, movementTypeFilter, fromDate, toDate]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, productFilter, movementTypeFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedMovements = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, safePage, pageSize]);

  const renderDirectionBadge = (type) => {
    const isIn = IN_MOVEMENT_TYPES.includes(type);
    if (isIn) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ArrowDownRight size={12} className="text-emerald-600" />
          <span>IN (+Stock)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
        <ArrowUpRight size={12} className="text-rose-600" />
        <span>OUT (-Stock)</span>
      </span>
    );
  };

  const formatMovementLabel = (type) => {
    const labels = {
      OPENING: 'Opening Stock',
      PURCHASE: 'Vendor Purchase',
      SALE: 'Customer Sale',
      SALES_RETURN: 'Sales Return',
      PURCHASE_RETURN: 'Purchase Return',
      ADJUSTMENT_IN: 'Stock Adjust (In)',
      ADJUSTMENT_OUT: 'Stock Adjust (Out)',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-orange-600" size={24} />
            Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable transaction-based stock movement history & audit trail.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer border border-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Control Bar & Filters */}
      <Card className="p-4 bg-white border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search product, SKU, reference, or serial..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Product Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">Product:</span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[180px] truncate"
              >
                <option value="ALL">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">Movement:</span>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ALL">All Movement Types</option>
                <option value="OPENING">Opening Stock</option>
                <option value="PURCHASE">Purchase (In)</option>
                <option value="SALE">Sale (Out)</option>
                <option value="SALES_RETURN">Sales Return (In)</option>
                <option value="PURCHASE_RETURN">Purchase Return (Out)</option>
                <option value="ADJUSTMENT_IN">Stock Adjustment (In)</option>
                <option value="ADJUSTMENT_OUT">Stock Adjustment (Out)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono font-bold uppercase">
            <Calendar size={14} />
            <span>Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          {(fromDate || toDate || productFilter !== 'ALL' || movementTypeFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setProductFilter('ALL');
                setMovementTypeFilter('ALL');
                setFromDate('');
                setToDate('');
              }}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Main Table */}
      {loading ? (
        <LoadingState message="Loading immutable stock movement log..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filteredMovements.length === 0 ? (
        <EmptyState
          title="No Stock Movements Found"
          description="No stock movement log entries match your filter criteria."
        />
      ) : (
        <Card className="bg-white border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[150px]">Date & Time</th>
                  <th className="py-3.5 px-4 min-w-[260px]">Product Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">Movement Type</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">Direction</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[70px]">Qty</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[100px]">Running Balance</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[110px]">Unit Value</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Reference</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[90px]">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedMovements.map((item) => {
                  const isIn = IN_MOVEMENT_TYPES.includes(item.movement_type);
                  const costVal = parseFloat(item.unit_cost || item.unit_price || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3.5 px-4 min-w-[260px]">
                        <div className="font-extrabold text-slate-900 text-xs tracking-tight">
                          {item.product_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.product_specifications && (
                            <span className="inline-flex items-center text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/80 whitespace-nowrap">
                              {item.product_specifications}
                            </span>
                          )}
                          {item.product_sku && (
                            <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                              SKU: <span className="text-slate-600 font-medium">{item.product_sku}</span>
                            </span>
                          )}
                        </div>
                        {item.serial_number_text && (
                          <div className="mt-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300/80 whitespace-nowrap shadow-2xs">
                              <Barcode size={11} className="text-amber-600 shrink-0" />
                              <span>S/N: {item.serial_number_text}</span>
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {formatMovementLabel(item.movement_type)}
                      </td>
                      <td className="py-3 px-4">{renderDirectionBadge(item.movement_type)}</td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-sm">
                        <span className={isIn ? 'text-emerald-700' : 'text-rose-700'}>
                          {isIn ? '+' : '-'}{item.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-800 text-xs">
                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {item.running_balance}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                        {costVal > 0 ? `₹${costVal.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {item.reference_type}
                          {item.reference_id ? ` #${item.reference_id}` : ''}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 italic max-w-xs truncate">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {item.created_by_username || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredMovements.length > 0 && (
            <Pagination
              currentPage={safePage}
              totalItems={filteredMovements.length}
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

export default StockLedger;
