import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProfileProvider } from './context/BusinessProfileContext';
import { ToastProvider } from './components/ui/Toast';
import AppLayout from './components/layout/AppLayout';
import PlaceholderPage from './pages/PlaceholderPage';
import Login from './pages/Login';
import ProtectedRoute, { CASHIER_ALLOWED_MODULES } from './components/auth/ProtectedRoute';

import ProductsMaster from './pages/masters/ProductsMaster';
import ServicesMaster from './pages/masters/ServicesMaster';
import CategoriesMaster from './pages/masters/CategoriesMaster';
import ExpenseCategoriesMaster from './pages/masters/ExpenseCategoriesMaster';
import BrandsMaster from './pages/masters/BrandsMaster';
import UnitsMaster from './pages/masters/UnitsMaster';
import TaxHsnMaster from './pages/masters/TaxHsnMaster';
import SuppliersMaster from './pages/masters/SuppliersMaster';
import CustomersMaster from './pages/masters/CustomersMaster';
import PaymentMethodsMaster from './pages/masters/PaymentMethodsMaster';

import NewPurchase from './pages/purchases/NewPurchase';
import PurchaseHistory from './pages/purchases/PurchaseHistory';
import SupplierPayables from './pages/purchases/SupplierPayables';

import StockOverview from './pages/inventory/StockOverview';
import StockLedger from './pages/inventory/StockLedger';
import SerialNumbers from './pages/inventory/SerialNumbers';
import OpeningBalance from './pages/inventory/OpeningBalance';
import StockAdjustment from './pages/inventory/StockAdjustment';
import NewPOS from './pages/pos/NewPOS';
import InvoiceHistory from './pages/pos/InvoiceHistory';
import CustomerReceivables from './pages/finance/CustomerReceivables';
import Expenses from './pages/finance/Expenses';
import PartnerLedger from './pages/finance/PartnerLedger';
import PaymentsLog from './pages/finance/PaymentsLog';
import ExecutiveDashboard from './pages/dashboard/ExecutiveDashboard';

import SalesReport from './pages/reports/SalesReport';
import PurchaseReport from './pages/reports/PurchaseReport';
import InventoryReport from './pages/reports/InventoryReport';
import GstReport from './pages/reports/GstReport';
import PnlReport from './pages/reports/PnlReport';
import SystemSettings from './pages/settings/SystemSettings';

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wrench,
  Layers,
  Barcode,
  ShoppingBag,
  Receipt,
  Users,
  Building2,
  PieChart,
  BarChart3,
  Building,
  Tag,
  Scale,
  Percent,
  CreditCard,
  FileText,
  TrendingUp,
  Truck,
  FileSpreadsheet,
  Boxes,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';

const MODULE_CONFIG = {
  '/dashboard': {
    title: 'Executive Dashboard',
    description: 'High-level business performance, sales metrics, stock value, and profit overview.',
    code: 'DASHBOARD-01',
    icon: LayoutDashboard,
  },
  '/masters/products': {
    title: 'Products Master',
    description: 'Physical product catalog directory, SKU, brand, unit, HSN, pricing & GST tax rules.',
    code: 'MASTER-PROD',
    icon: Package,
  },
  '/masters/services': {
    title: 'Services Master',
    description: 'Service & labor catalog directory, SAC codes, default rates, and non-inventory items.',
    code: 'MASTER-SVC',
    icon: Wrench,
  },
  '/masters/categories': {
    title: 'Categories Master',
    description: 'Product & service category directory for catalog classification.',
    code: 'MASTER-CAT',
    icon: Layers,
  },
  '/masters/expense-categories': {
    title: 'Expense Categories Master',
    description: 'Operational expense categories for overheads, rent, salaries, utilities, and tax allocations.',
    code: 'MASTER-EXP-CAT',
    icon: Receipt,
  },
  '/masters/expenses': {
    title: 'Expense Categories Master',
    description: 'Operational expense categories for overheads, rent, salaries, utilities, and tax allocations.',
    code: 'MASTER-EXP-CAT',
    icon: Receipt,
  },
  '/masters/brands': {
    title: 'Brands Master',
    description: 'Manufacturer brand directory for physical inventory items.',
    code: 'MASTER-BRD',
    icon: Tag,
  },
  '/masters/units': {
    title: 'Units Master',
    description: 'Measurement unit directory (NOS, PCS, SET, MTR, BOX, PACK).',
    code: 'MASTER-UNIT',
    icon: Scale,
  },
  '/masters/tax-hsn-sac': {
    title: 'Tax / HSN / SAC Master',
    description: 'GST Tax Slabs (0%, 5%, 12%, 18%, 28%) and HSN/SAC code directory.',
    code: 'MASTER-TAX',
    icon: Percent,
  },
  '/masters/suppliers': {
    title: 'Suppliers Master',
    description: 'Vendor profiles, GSTIN details, and contact directory.',
    code: 'MASTER-SUPP',
    icon: Building2,
  },
  '/masters/customers': {
    title: 'Customers Master',
    description: 'Customer directory, Individual B2C & Business B2B GSTIN profiles.',
    code: 'MASTER-CUST',
    icon: Users,
  },
  '/masters/payment-methods': {
    title: 'Payment Methods Master',
    description: 'Accepted payment modes (Cash, UPI/QR, Bank Transfer, Cheque, Card).',
    code: 'MASTER-PAY',
    icon: CreditCard,
  },
  // Purchases
  '/purchases/new': {
    title: 'New Purchase Entry',
    description: 'Supplier purchase orders, inbound serial registry, and stock reception.',
    code: 'PURCH-NEW',
    icon: ShoppingBag,
  },
  '/purchases/history': {
    title: 'Purchase History Log',
    description: 'Historical supplier purchase invoices and stock-in transactions.',
    code: 'PURCH-HIST',
    icon: Receipt,
  },
  '/purchases/payables': {
    title: 'Supplier Payables Ledger',
    description: 'Outstanding vendor balances, supplier payments, and payment terms.',
    code: 'PURCH-PAY',
    icon: Building2,
  },
  // Inventory
  '/inventory/overview': {
    title: 'Stock Overview',
    description: 'Real-time stock balance, valuation, and reorder alerts.',
    code: 'INV-OVERVIEW',
    icon: Boxes,
  },
  '/inventory/ledger': {
    title: 'Stock Movements Ledger',
    description: 'Complete audit trail of sales, purchases, returns, and adjustments.',
    code: 'INV-LEDGER',
    icon: FileText,
  },
  '/inventory/serial-numbers': {
    title: 'Serial Numbers Registry',
    description: 'Individual product serial number lifecycle tracking.',
    code: 'INV-SERIALS',
    icon: Barcode,
  },
  '/inventory/opening-balance': {
    title: 'Opening Balance Entry',
    description: 'Initial stock quantity & serial number setup.',
    code: 'INV-OPENING',
    icon: Scale,
  },
  '/inventory/adjustment': {
    title: 'Stock Adjustment',
    description: 'Manual stock corrections, damage, and inventory reconciliation.',
    code: 'INV-ADJUST',
    icon: SlidersHorizontal,
  },
  // POS Billing
  '/pos': {
    title: 'POS Billing Terminal',
    description: 'Ultra-fast retail billing with dual barcode scan & serial registry.',
    code: 'POS-NEW',
    icon: ShoppingCart,
  },
  '/pos/new': {
    title: 'POS Billing Terminal',
    description: 'Ultra-fast retail billing with dual barcode scan & serial registry.',
    code: 'POS-NEW',
    icon: ShoppingCart,
  },
  '/pos/invoices': {
    title: 'Invoice History Log',
    description: 'Issued sales invoices, GST returns, and credit balances.',
    code: 'POS-INVOICES',
    icon: FileText,
  },
  // Finance
  '/finance/receivables': {
    title: 'Customer Receivables Ledger',
    description: 'Outstanding customer credit balances, unpaid invoice dues, and payment reception.',
    code: 'FIN-REC',
    icon: Users,
  },
  '/finance/expenses': {
    title: 'Operational Expenses',
    description: 'Business operating expenses, utility bills, and payment logs.',
    code: 'FIN-EXPENSE',
    icon: Receipt,
  },
  '/finance/partner-ledger': {
    title: 'Partner Capital Ledger',
    description: 'Partner capital accounts, drawings, and monthly equity split.',
    code: 'FIN-PARTNER',
    icon: PieChart,
  },
  '/finance/payments': {
    title: 'Payments Log',
    description: 'Customer payment receipts, supplier payouts, and cash ledger.',
    code: 'FIN-PAYMENT',
    icon: CreditCard,
  },
  // Reports
  '/reports/sales': {
    title: 'Sales & Revenue Reports',
    description: 'Daily, monthly, and customer sales analysis.',
    code: 'REP-SALES',
    icon: TrendingUp,
  },
  '/reports/purchases': {
    title: 'Purchases Audit Reports',
    description: 'Vendor purchase summaries and stock inflow audit.',
    code: 'REP-PURCHASE',
    icon: Truck,
  },
  '/reports/inventory': {
    title: 'Inventory Valuation Report',
    description: 'FIFO inventory valuation, dead stock, and reorder audits.',
    code: 'REP-INV',
    icon: Package,
  },
  '/reports/gst': {
    title: 'GST HSN/SAC Summary Report',
    description: 'B2B & B2C GST returns, GSTR-1, and HSN summary.',
    code: 'REP-GST',
    icon: FileSpreadsheet,
  },
  '/reports/profit-loss': {
    title: 'Profit & Loss Statement',
    description: 'Net profit, gross margin, operating expenses, and financial health.',
    code: 'REP-PNL',
    icon: PieChart,
  },
  '/settings': {
    title: 'System & Store Settings',
    description: 'Shop branding, logo upload, user accounts, and account credentials.',
    code: 'SYS-SETTINGS',
    icon: Settings,
  },
  '/business-profile': {
    title: 'System & Store Settings',
    description: 'Shop branding, logo upload, user accounts, and account credentials.',
    code: 'SYS-SETTINGS',
    icon: Settings,
  },
};

const renderModuleContent = (currentRoute, onNavigate) => {
  switch (currentRoute) {
    case '/masters/products':
      return <ProductsMaster />;
    case '/masters/services':
      return <ServicesMaster />;
    case '/masters/categories':
      return <CategoriesMaster />;
    case '/masters/expense-categories':
    case '/masters/expenses':
      return <ExpenseCategoriesMaster />;
    case '/masters/brands':
      return <BrandsMaster />;
    case '/masters/units':
      return <UnitsMaster />;
    case '/masters/tax-hsn-sac':
      return <TaxHsnMaster />;
    case '/masters/suppliers':
      return <SuppliersMaster />;
    case '/masters/customers':
      return <CustomersMaster />;
    case '/masters/payment-methods':
      return <PaymentMethodsMaster />;
    case '/purchases/new':
      return <NewPurchase onNavigate={onNavigate} />;
    case '/purchases/history':
      return <PurchaseHistory onSelectRoute={onNavigate} />;
    case '/purchases/payables':
      return <SupplierPayables />;
    case '/inventory':
    case '/inventory/overview':
      return <StockOverview />;
    case '/inventory/ledger':
      return <StockLedger />;
    case '/inventory/serial-numbers':
      return <SerialNumbers />;
    case '/inventory/opening-balance':
      return <OpeningBalance />;
    case '/inventory/adjustment':
      return <StockAdjustment />;
    case '/pos':
    case '/pos/new':
      return <NewPOS />;
    case '/pos/invoices':
      return <InvoiceHistory />;
    case '/dashboard':
      return <ExecutiveDashboard onNavigate={onNavigate} />;
    case '/finance/receivables':
      return <CustomerReceivables />;
    case '/finance/expenses':
      return <Expenses />;
    case '/finance/partner-ledger':
      return <PartnerLedger />;
    case '/finance/payments':
      return <PaymentsLog />;
    case '/reports/sales':
      return <SalesReport />;
    case '/reports/purchases':
      return <PurchaseReport />;
    case '/reports/inventory':
      return <InventoryReport />;
    case '/reports/gst':
      return <GstReport />;
    case '/reports/profit-loss':
      return <PnlReport />;
    case '/settings':
    case '/business-profile':
      return <SystemSettings onNavigate={onNavigate} />;
    default:
      return (
        <PlaceholderPage
          title={MODULE_CONFIG[currentRoute]?.title || 'ERP Module'}
          description={MODULE_CONFIG[currentRoute]?.description || ''}
          moduleCode={MODULE_CONFIG[currentRoute]?.code || 'OCTANE'}
          icon={MODULE_CONFIG[currentRoute]?.icon}
          onNavigate={onNavigate}
        />
      );
  }
};

const getInitialRoute = () => {
  const path = window.location.pathname;
  if (path && path !== '/' && MODULE_CONFIG[path]) {
    return path;
  }
  return '/dashboard';
};

const MainContent = () => {
  const { user, isAdmin, loading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);

  const handleNavigate = (route) => {
    const [pathname] = (route || '').split('?');
    setCurrentRoute(pathname);
    if (window.location.pathname + window.location.search !== route) {
      window.history.pushState({}, '', route);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  // Sync route state on browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path && path !== '/' && MODULE_CONFIG[path]) {
        setCurrentRoute(path);
      } else {
        setCurrentRoute('/dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update browser URL on initial mount if on root '/'
  useEffect(() => {
    if (window.location.pathname === '/' || !window.location.pathname) {
      window.history.replaceState({}, '', currentRoute);
    }
  }, []);

  // Auto-route Cashier to POS if current route is restricted
  useEffect(() => {
    if (user && !isAdmin && !CASHIER_ALLOWED_MODULES.includes(currentRoute)) {
      handleNavigate('/pos/new');
    }
  }, [user, isAdmin, currentRoute]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-orange-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest uppercase">Initializing Octane Shell...</span>
        </div>
      </div>
    );
  }

  // Render Login if unauthenticated
  if (!user) {
    return <Login />;
  }

  // Render main application shell protected by RBAC
  return (
    <AppLayout currentRoute={currentRoute} onNavigate={handleNavigate}>
      <ProtectedRoute currentRoute={currentRoute} onNavigate={handleNavigate}>
        {renderModuleContent(currentRoute, handleNavigate)}
      </ProtectedRoute>
    </AppLayout>
  );
};

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function App() {
  return (
    <AuthProvider>
      <BusinessProfileProvider>
        <ToastProvider>
          <MainContent />
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
        </ToastProvider>
      </BusinessProfileProvider>
    </AuthProvider>
  );
}

export default App;
