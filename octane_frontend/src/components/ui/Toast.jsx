import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
    remove: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Floating Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem = ({ toast, onClose }) => {
  const styles = {
    success: {
      bg: 'bg-white border-emerald-300 text-emerald-700',
      icon: CheckCircle2,
      shadow: 'shadow-lg shadow-emerald-500/10',
    },
    error: {
      bg: 'bg-white border-rose-300 text-rose-700',
      icon: AlertCircle,
      shadow: 'shadow-lg shadow-rose-500/10',
    },
    warning: {
      bg: 'bg-white border-amber-300 text-amber-700',
      icon: AlertTriangle,
      shadow: 'shadow-lg shadow-amber-500/10',
    },
    info: {
      bg: 'bg-white border-blue-300 text-blue-700',
      icon: Info,
      shadow: 'shadow-lg shadow-blue-500/10',
    },
  };

  const current = styles[toast.type] || styles.info;
  const Icon = current.icon;

  return (
    <div
      className={`
        pointer-events-auto flex items-center justify-between rounded-xl border p-4 shadow-xl backdrop-blur-md
        transition-all duration-300 animate-in slide-in-from-right-5 fade-in
        ${current.bg} ${current.shadow}
      `}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className="flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-800 leading-snug">{toast.message}</span>
      </div>
      <button
        onClick={onClose}
        className="ml-3 rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ToastProvider;
