import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

// Modules accessible by Cashier role
export const CASHIER_ALLOWED_MODULES = [
  '/masters/products',
  '/masters/services',
  '/masters/categories',
  '/masters/brands',
  '/masters/units',
  '/masters/tax-hsn-sac',
  '/masters/customers',
  '/pos/new',
  '/pos/invoices',
  '/finance/receivables',
  '/settings',
  '/business-profile',
];

export const ProtectedRoute = ({ children, currentRoute, onNavigate }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-orange-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest uppercase">Verifying Access Credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return children;
  }

  // Check RBAC permission for Cashier role
  const isCashier = !isAdmin;
  const isRouteAllowed = isAdmin || CASHIER_ALLOWED_MODULES.includes(currentRoute);

  if (isCashier && !isRouteAllowed) {
    return (
      <div className="p-6 sm:p-12 max-w-xl mx-auto my-12 bg-white border border-rose-200 rounded-2xl shadow-lg text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-600">
            Your Cashier account does not have permission to access the{' '}
            <span className="font-semibold text-slate-800 uppercase font-mono">{currentRoute}</span> module.
          </p>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
          Only Managerial & Administrator roles can access financial ledgers, purchase stock-in, supplier directory, partner accounts, and system configuration.
        </p>
        <div>
          <button
            onClick={() => onNavigate('/pos/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Return to POS Billing Terminal</span>
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
