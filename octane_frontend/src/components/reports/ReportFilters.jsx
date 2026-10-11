import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Search, RefreshCw, Download, FileSpreadsheet, FileText, ChevronDown, Clock } from 'lucide-react';

/**
 * Shared date-range + quick-filter + multi-format export toolbar for all OCTANE reports.
 * Supports: Today, This Week, This Month, This Quarter, Until Now, and exports (Excel, PDF, CSV).
 */
const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportFilters = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  loading = false,
  extraFilters = null,
  onExport = null,
  onExportExcel = null,
  onExportPdf = null,
  onExportCsv = null,
  exportLabel = 'Export',
  searchValue = '',
  onSearchChange = null,
  searchPlaceholder = 'Search...',
  hasData = true,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('month');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPresetDates = (preset) => {
    const now = new Date();
    const end = toLocalDateString(now);
    let start = end;

    if (preset === 'today') {
      start = end;
    } else if (preset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      start = toLocalDateString(monday);
    } else if (preset === 'month') {
      start = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (preset === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      start = toLocalDateString(new Date(now.getFullYear(), q * 3, 1));
    } else if (preset === 'until_now' || preset === 'all_time') {
      // From system inception / earliest date until current date
      start = '2020-01-01';
    }
    return { start, end };
  };

  const setPreset = (presetKey) => {
    setActivePreset(presetKey);
    const { start, end } = getPresetDates(presetKey);
    onStartDateChange(start);
    onEndDateChange(end);
    if (onApply) {
      onApply(start, end);
    }
  };

  const isPresetActive = (presetKey) => {
    return activePreset === presetKey;
  };

  const presets = [
    { label: 'Today', key: 'today' },
    { label: 'This Week', key: 'week' },
    { label: 'This Month', key: 'month' },
    { label: 'This Quarter', key: 'quarter' },
    { label: '⚡ Until Now', key: 'until_now' },
  ];

  const hasMultiExport = Boolean(onExportExcel || onExportPdf);
  const effectiveCsvExport = onExportCsv || onExport;

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
      {/* Date presets row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick:</span>
        {presets.map((p) => {
          const active = isPresetActive(p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              disabled={loading}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                active
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-orange-50 hover:text-orange-700 border-slate-200 text-slate-600'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Date range + extra filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">From (Start Date)</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setActivePreset(null);
                  onStartDateChange(e.target.value);
                }}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>
          <span className="text-slate-400 text-xs font-bold mt-4">—</span>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Until (Current Date)</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setActivePreset(null);
                  onEndDateChange(e.target.value);
                }}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {onSearchChange && (
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {extraFilters}

        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => setPreset('until_now')}
            disabled={loading}
            title="Show all sales from the start until current date"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-2xs ${
              activePreset === 'until_now'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-700 border-slate-200'
            }`}
          >
            <Clock size={13} className={activePreset === 'until_now' ? 'text-white' : 'text-orange-600'} />
            <span>Until Now</span>
          </button>

          <button
            type="button"
            onClick={() => onApply && onApply(startDate, endDate)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Loading...' : 'Apply'}</span>
          </button>

          {/* Multi-Format Export Dropdown */}
          {hasMultiExport ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={loading || !hasData}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-slate-300 shadow-xs"
              >
                <Download size={13} className="text-orange-600" />
                <span>{exportLabel}</span>
                <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportOpen && (
                <div className="absolute right-0 bottom-full mb-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Export Report As
                  </div>
                  {onExportExcel && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        onExportExcel();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 text-left transition-colors cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        XLS
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">Excel Workbook</div>
                        <div className="text-[10px] text-slate-400">Microsoft Excel (.xlsx)</div>
                      </div>
                    </button>
                  )}
                  {onExportPdf && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        onExportPdf();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-800 text-left transition-colors cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">
                        PDF
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">Download PDF</div>
                        <div className="text-[10px] text-slate-400">Printable Statement (.pdf)</div>
                      </div>
                    </button>
                  )}
                  {effectiveCsvExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        effectiveCsvExport();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors cursor-pointer border-t border-slate-100"
                    >
                      <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                        CSV
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">CSV Spreadsheet</div>
                        <div className="text-[10px] text-slate-400">Plain text data (.csv)</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            effectiveCsvExport && (
              <button
                type="button"
                onClick={effectiveCsvExport}
                disabled={loading || !hasData}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-slate-200"
              >
                <Download size={13} />
                <span>{exportLabel}</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
