import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import SearchBar from '../../components/ui/SearchBar';
import FilterBar from '../../components/ui/FilterBar';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StateViews';
import { Layers, AlertTriangle, CheckCircle2, XCircle, Package, DollarSign, Search, RefreshCw, Eye, X, Barcode, Info, Tag } from 'lucide-react';

export const StockOverview = () => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [trackingFilter, setTrackingFilter] = useState('ALL');

  // Modal State for Overview of exact item clicked
  const [selectedItemForOverview, setSelectedItemForOverview] = useState(null);
  const [itemSerials, setItemSerials] = useState([]);
  const [loadingSerials, setLoadingSerials] = useState(false);

  const handleOpenOverview = async (item) => {
    setSelectedItemForOverview(item);
    setItemSerials([]);
    if (item.tracking_type === 'SERIAL_NUMBER') {
      setLoadingSerials(true);
      try {
        const res = await api.getSerialNumbers(`?product=${item.product_id}`);
        const list = Array.isArray(res) ? res : res.results || [];
        setItemSerials(list);
      } catch (err) {
        console.error('Failed to load item serials:', err);
      } finally {
        setLoadingSerials(false);
      }
    }
  };

  const fetchStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCurrentStock();
      setStockData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load stock overview:', err);
      setError(err.message || 'Failed to fetch inventory stock records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    let totalItems = stockData.length;
    let totalStockUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    stockData.forEach((item) => {
      const stock = Number(item.current_stock) || 0;
      totalStockUnits += stock;
      totalValuation += Number(item.stock_value) || 0;

      if (item.stock_status === 'LOW_STOCK') lowStockCount++;
      if (item.stock_status === 'OUT_OF_STOCK') outOfStockCount++;
    });

    return { totalItems, totalStockUnits, totalValuation, lowStockCount, outOfStockCount };
  }, [stockData]);

  // Filter Data
  const filteredData = useMemo(() => {
    return stockData.filter((item) => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        (item.product_name && item.product_name.toLowerCase().includes(query)) ||
        (item.sku && item.sku.toLowerCase().includes(query)) ||
        (item.category_name && item.category_name.toLowerCase().includes(query));

      // Status Filter
      const matchStatus = statusFilter === 'ALL' || item.stock_status === statusFilter;

      // Tracking Filter
      const matchTracking = trackingFilter === 'ALL' || item.tracking_type === trackingFilter;

      return matchSearch && matchStatus && matchTracking;
    });
  }, [stockData, searchQuery, statusFilter, trackingFilter]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, trackingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, safePage, pageSize]);

  const renderStockStatusBadge = (status, minAlert, currentStock) => {
    switch (status) {
      case 'IN_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span>In Stock</span>
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600 animate-pulse" />
            <span>Low Stock (&le; {minAlert})</span>
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} className="text-rose-500" />
            <span>Out of Stock</span>
          </span>
        );
      default:
        return <StatusBadge status={status} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="text-orange-600" size={24} />
            Stock Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live physical inventory balances, tracking types, reorder levels & stock valuation.
          </p>
        </div>
        <button
          onClick={fetchStock}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer border border-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Total Products
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.totalItems}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Package size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Total Stock Units
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {metrics.totalStockUnits.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Total Stock Value
              </p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                ₹{metrics.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Stock Reorder Alerts
              </p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {metrics.lowStockCount + metrics.outOfStockCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {metrics.lowStockCount} Low | {metrics.outOfStockCount} Out of Stock
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar: Search & Filters */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search product name, SKU, or category..."
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
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>

            {/* Tracking Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">Tracking:</span>
              <select
                value={trackingFilter}
                onChange={(e) => setTrackingFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ALL">All Tracking Types</option>
                <option value="QUANTITY">Quantity Only</option>
                <option value="SERIAL_NUMBER">Serial Number</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Stock Table */}
      {loading ? (
        <LoadingState message="Fetching live stock balances from Django engine..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStock} />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title="No Stock Items Found"
          description={
            searchQuery || statusFilter !== 'ALL' || trackingFilter !== 'ALL'
              ? 'No products match your search or filter criteria.'
              : 'No inventory tracked products available in Product Master.'
          }
        />
      ) : (
        <Card className="bg-white border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product Info</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Tracking Type</th>
                  <th className="py-3.5 px-4 text-right">Current Stock</th>
                  <th className="py-3.5 px-4 text-right">Available Serials</th>
                  <th className="py-3.5 px-4">Reorder Status</th>
                  <th className="py-3.5 px-4 text-right">Valuation (₹)</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedData.map((item) => {
                  const isSerial = item.tracking_type === 'SERIAL_NUMBER';
                  return (
                    <tr
                      key={item.product_id}
                      onClick={() => handleOpenOverview(item)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                      title="Click to view detailed stock overview for this item"
                    >
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 hover:text-orange-600 transition-colors">
                          {item.product_name}
                        </div>
                        {item.specifications_text && (
                          <div className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded w-fit border border-orange-100 my-0.5">
                            {item.specifications_text}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">ID: #{item.product_id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {item.sku || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.category_name || 'Uncategorized'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={item.tracking_type} type="tracking" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {item.current_stock}
                        </span>{' '}
                        <span className="text-[10px] text-slate-500 font-mono uppercase">
                          {item.unit || 'NOS'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {isSerial ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            {item.current_stock} available
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">N/A (Quantity)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {renderStockStatusBadge(item.stock_status, item.min_stock_alert, item.current_stock)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹
                        {Number(item.stock_value || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOverview(item);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-100/80 transition-colors cursor-pointer"
                          title="View Stock Overview"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredData.length > 0 && (
            <Pagination
              currentPage={safePage}
              totalItems={filteredData.length}
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

      {/* Stock Overview Modal */}
      {selectedItemForOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900">{selectedItemForOverview.product_name}</h3>
                  {selectedItemForOverview.sku && (
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      SKU: {selectedItemForOverview.sku}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>Category: <strong className="text-slate-800">{selectedItemForOverview.category_name || 'Uncategorized'}</strong></span>
                  <span>•</span>
                  <span>Product ID: <strong className="font-mono text-slate-800">#{selectedItemForOverview.product_id}</strong></span>
                </p>
                {selectedItemForOverview.specifications_text && (
                  <div className="mt-2 text-xs font-semibold text-orange-800 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 inline-block">
                    Specs: {selectedItemForOverview.specifications_text}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedItemForOverview(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stock Summary Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Current Stock</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedItemForOverview.current_stock} <span className="text-xs font-normal text-slate-500">{selectedItemForOverview.unit || 'NOS'}</span>
                </div>
                <div className="mt-1">
                  {renderStockStatusBadge(
                    selectedItemForOverview.stock_status,
                    selectedItemForOverview.min_stock_alert,
                    selectedItemForOverview.current_stock
                  )}
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase">Total Valuation</div>
                <div className="text-base font-black text-emerald-950 mt-1 font-mono">
                  ₹{Number(selectedItemForOverview.stock_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-700 mt-1 font-mono">
                  Stock &times; Cost
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Unit Pricing</div>
                <div className="text-xs font-bold text-slate-900 mt-1 font-mono">
                  Buy: ₹{parseFloat(selectedItemForOverview.purchase_price || 0).toFixed(2)}
                </div>
                <div className="text-xs font-extrabold text-orange-600 font-mono">
                  Sell: ₹{parseFloat(selectedItemForOverview.selling_price || 0).toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Reorder Alert</div>
                <div className="text-sm font-extrabold text-slate-800 mt-1">
                  &le; {selectedItemForOverview.min_stock_alert} {selectedItemForOverview.unit || 'NOS'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Threshold Level
                </div>
              </div>
            </div>

            {/* Tracking & Serial Registry */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Barcode size={16} className="text-orange-600" />
                  <span>Tracking Type: {selectedItemForOverview.tracking_type}</span>
                </h4>
                <StatusBadge status={selectedItemForOverview.tracking_type} type="tracking" />
              </div>

              {selectedItemForOverview.tracking_type === 'SERIAL_NUMBER' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Registered Serial Numbers ({itemSerials.length})</span>
                    <span className="text-[11px] text-amber-700 font-mono">
                      Available: {itemSerials.filter((s) => s.status === 'AVAILABLE').length}
                    </span>
                  </div>

                  {loadingSerials ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 animate-pulse">
                      Loading serial numbers for this product...
                    </div>
                  ) : itemSerials.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-semibold">
                      No serial numbers registered for this product master yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {itemSerials.map((serial) => (
                        <div
                          key={serial.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="font-mono font-extrabold text-slate-900 flex items-center gap-1.5">
                            <Barcode size={13} className="text-slate-400" />
                            <span>{serial.serial_number}</span>
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              serial.status === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : serial.status === 'SOLD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {serial.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center gap-2">
                  <Info size={16} className="text-blue-500 shrink-0" />
                  <span>This item uses standard bulk quantity tracking. Individual serial numbers are not tracked.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockOverview;
