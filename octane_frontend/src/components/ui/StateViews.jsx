import React from 'react';
import { Database, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import Card from './Card';

export const LoadingState = ({ message = 'Loading Master Data from Django Server...' }) => (
  <Card className="p-12 text-center bg-white border-slate-200">
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      <span className="text-xs font-mono font-bold tracking-widest text-orange-600 uppercase">
        {message}
      </span>
    </div>
  </Card>
);

export const EmptyState = ({
  title = 'No Master Records Found',
  description = 'No matching records found in the database. Create a new entry to get started.',
  actionLabel,
  onAction,
}) => (
  <Card className="p-12 text-center border-dashed border-slate-300 bg-slate-50/50">
    <div className="max-w-md mx-auto flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
        <Layers size={28} />
      </div>
      <h3 className="text-sm font-extrabold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </Card>
);

export const ErrorState = ({ message = 'Failed to load master records from backend.', onRetry }) => (
  <Card className="p-8 text-center bg-rose-50/50 border-rose-200">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
        <AlertCircle size={24} />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-900">Backend Communication Error</h4>
        <p className="text-xs text-rose-700 font-mono max-w-lg">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  </Card>
);
