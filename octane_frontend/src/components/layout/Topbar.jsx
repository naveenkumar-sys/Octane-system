import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  LogOut,
  User,
  ChevronDown,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Package,
  Menu,
  ShieldCheck,
  KeyRound,
  ShoppingCart,
  ShoppingBag,
  Layers,
  Receipt,
  FileText,
  BarChart3,
  Users,
  Building2,
  X,
  ArrowRight,
  Sparkles,
  Command,
  IndianRupee,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Truck,
  FileSpreadsheet,
  PieChart,
  Boxes,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const SEARCHABLE_ROUTES = [
  { path: '/pos/new', title: 'POS Billing Terminal', category: 'Sales', icon: ShoppingCart, keywords: 'pos bill billing sale new retail cash tender invoice register' },
  { path: '/pos/invoices', title: 'Invoice History Log', category: 'Sales', icon: FileText, keywords: 'invoices history sales receipts print duplicate' },
  { path: '/purchases/new', title: 'New Purchase Entry', category: 'Purchases', icon: ShoppingBag, keywords: 'purchase buy supplier vendor bill inbound stock-in' },
  { path: '/purchases/history', title: 'Purchase History Log', category: 'Purchases', icon: Receipt, keywords: 'purchases history supplier invoices' },
  { path: '/purchases/payables', title: 'Supplier Payables Ledger', category: 'Purchases', icon: Building2, keywords: 'payables supplier vendor dues unpaid outstanding' },
  { path: '/inventory/overview', title: 'Stock Overview & Valuation', category: 'Inventory', icon: Boxes, keywords: 'inventory stock warehouse count balance skus valuation' },
  { path: '/inventory/adjustment', title: 'Stock Adjustment & Corrections', category: 'Inventory', icon: SlidersHorizontal, keywords: 'adjustment correct stock recount physical damage discrepancy' },
  { path: '/inventory/ledger', title: 'Stock Movements Ledger', category: 'Inventory', icon: FileText, keywords: 'movements ledger in out audit stock' },
  { path: '/inventory/serial-numbers', title: 'Serial Numbers & IMEI Registry', category: 'Inventory', icon: Package, keywords: 'serial numbers imei warranty barcode' },
  { path: '/finance/receivables', title: 'Customer Receivables Ledger', category: 'Finance', icon: Users, keywords: 'receivables customer credit due unpaid balance collection' },
  { path: '/finance/expenses', title: 'Operational Expenses', category: 'Finance', icon: Receipt, keywords: 'expenses bills rent electricity office salary overheads' },
  { path: '/finance/partner-ledger', title: 'Partner Capital Ledger', category: 'Finance', icon: Users, keywords: 'partner ledger capital drawings equity profit split' },
  { path: '/finance/payments', title: 'Unified Payments Log', category: 'Finance', icon: Receipt, keywords: 'payments transactions cash upi bank' },
  { path: '/reports/profit-loss', title: 'Profit & Loss Statement (P&L)', category: 'Reports', icon: PieChart, keywords: 'pnl profit loss net profit gross margin revenue financial income' },
  { path: '/reports/sales', title: 'Sales & Revenue Analysis', category: 'Reports', icon: TrendingUp, keywords: 'sales report revenue analytics customer sales' },
  { path: '/reports/purchases', title: 'Purchases Audit Report', category: 'Reports', icon: Truck, keywords: 'purchases report vendor audit spend' },
  { path: '/reports/inventory', title: 'Inventory Valuation Report', category: 'Reports', icon: Package, keywords: 'inventory valuation fifo dead stock reorder' },
  { path: '/reports/gst', title: 'GST Returns & HSN/SAC Report', category: 'Reports', icon: FileSpreadsheet, keywords: 'gst gstr-1 tax return hsn sac summary' },
  { path: '/masters/products', title: 'Products Master Directory', category: 'Masters', icon: Package, keywords: 'products items skus catalog physical goods price' },
  { path: '/masters/services', title: 'Services Master Directory', category: 'Masters', icon: Sparkles, keywords: 'services labor repairs charges' },
  { path: '/masters/categories', title: 'Product Categories Master', category: 'Masters', icon: Layers, keywords: 'categories product classification groups' },
  { path: '/masters/brands', title: 'Brands Master Directory', category: 'Masters', icon: Package, keywords: 'brands manufacturers labels' },
  { path: '/masters/suppliers', title: 'Suppliers / Vendor Master', category: 'Masters', icon: Building2, keywords: 'suppliers vendors directory contacts gstin' },
  { path: '/masters/customers', title: 'Customers Master Directory', category: 'Masters', icon: Users, keywords: 'customers clients directory contacts b2b b2c gstin' },
  { path: '/dashboard', title: 'Executive Dashboard & Live View', category: 'Dashboard', icon: BarChart3, keywords: 'dashboard home overview live metrics kpis store' },
  { path: '/settings', title: 'System Settings & Store Branding', category: 'Settings', icon: Settings, keywords: 'settings system shop name logo branding users rbac password credentials profile' },
];

export const Topbar = ({ onNavigate, currentRoute, isSidebarCollapsed, onToggleMobileMenu }) => {
  const { user, logout, isAdmin } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Search Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [productsList, setProductsList] = useState([]);
  const [dashboardNotifs, setDashboardNotifs] = useState({ lowStock: 0, overdueDue: 0 });
  const searchInputRef = useRef(null);

  // Preload Products & Dashboard Alerts for live search and notifications
  useEffect(() => {
    let isMounted = true;
    
    // Fetch products for product search
    api.getProducts().then((res) => {
      if (isMounted && res) {
        const items = Array.isArray(res) ? res : (res.results || []);
        setProductsList(items);
      }
    }).catch((err) => {
      console.debug('Failed to preload search products:', err);
    });

    // Fetch dashboard stats for real notification counts
    api.getDashboardMetrics().then((data) => {
      if (isMounted && data) {
        setDashboardNotifs({
          lowStock: Number(data.low_stock_count || 0),
          overdueDue: Number(data.overdue_receivables || 0),
        });
      }
    }).catch(() => {});

    return () => { isMounted = false; };
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('#user-menu-dropdown')) {
        setUserDropdownOpen(false);
      }
      if (!e.target.closest('#notif-menu-dropdown')) {
        setNotifDropdownOpen(false);
      }
      if (!e.target.closest('#omni-search-container')) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filtered routes matching query
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) {
      // Default top suggestions when search query is empty but focused
      return SEARCHABLE_ROUTES.slice(0, 6);
    }
    const q = searchQuery.toLowerCase().trim();
    return SEARCHABLE_ROUTES.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.keywords.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchQuery]);

  // Filtered products matching query (Name, SKU, Brand, Category, Specs, Model, Barcode)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return productsList.filter((p) =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q)) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q)) ||
      (p.specifications_text && p.specifications_text.toLowerCase().includes(q)) ||
      (p.model_number && p.model_number.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, productsList]);

  // Combine results for keyboard navigation
  const allResults = useMemo(() => {
    const items = [...filteredRoutes.map(r => ({ type: 'route', data: r }))];
    filteredProducts.forEach(p => items.push({ type: 'product', data: p }));
    return items;
  }, [filteredRoutes, filteredProducts]);

  // Handle keyboard arrow navigation inside search
  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allResults.length || 1)) % (allResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        const item = allResults[selectedIndex];
        if (item.type === 'route') {
          handleSelectRoute(item.data.path);
        } else if (item.type === 'product') {
          handleSelectRoute('/pos/new');
        }
      }
    }
  };

  const handleSelectRoute = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const notifications = [
    {
      id: 1,
      title: dashboardNotifs.lowStock > 0 ? `${dashboardNotifs.lowStock} Items Low Stock` : 'Stock Levels Optimal',
      desc: dashboardNotifs.lowStock > 0 ? 'Replenishment needed in warehouse' : 'All items are above reorder threshold',
      time: 'Live',
      icon: Package,
      iconColor: dashboardNotifs.lowStock > 0 ? 'text-amber-600 bg-amber-100' : 'text-emerald-600 bg-emerald-100',
      actionRoute: '/inventory/overview',
    },
    {
      id: 2,
      title: dashboardNotifs.overdueDue > 0 ? `₹${dashboardNotifs.overdueDue.toLocaleString('en-IN')} Due / Overdue` : 'Clean Receivables Ledger',
      desc: dashboardNotifs.overdueDue > 0 ? 'Pending customer invoice collections' : 'All customer invoices settled',
      time: 'Live',
      icon: IndianRupee,
      iconColor: dashboardNotifs.overdueDue > 0 ? 'text-rose-600 bg-rose-100' : 'text-blue-600 bg-blue-100',
      actionRoute: '/finance/receivables',
    },
    {
      id: 3,
      title: 'Django REST Engine Live',
      desc: 'PostgreSQL database ledger connected',
      time: 'System',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 bg-emerald-100',
      actionRoute: '/dashboard',
    },
  ];

  return (
    <>
      <header
        className={`
          fixed top-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200
          flex items-center justify-between px-3 sm:px-6 transition-all duration-300 shadow-xs
          left-0 ${isSidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}
        `}
      >
        {/* Left: Mobile Hamburger Toggle + Searchbar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-sm sm:max-w-md lg:max-w-lg mr-2" id="omni-search-container">
          {/* Mobile Hamburger Button */}
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-orange-600 lg:hidden flex-shrink-0 transition-colors"
            title="Open Navigation Menu"
          >
            <Menu size={18} />
          </button>

          {/* Interactive Omni-Searchbar */}
          <div className="relative w-full min-w-0">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={15} />
            </div>
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                setSelectedIndex(0);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search pages, products, invoices... (Ctrl+K)"
              className="w-full pl-8 sm:pl-9 pr-16 py-1.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all shadow-inner"
            />

            {/* Right inside search: Clear button or shortcut badge */}
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Omni-Search Live Dropdown Results */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white border border-slate-200 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[420px] overflow-y-auto">
                
                {/* Header info */}
                <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                    {searchQuery ? `Results for "${searchQuery}"` : 'Quick Navigation'}
                  </span>
                  <span className="text-[10px]">Use ↑↓ to navigate, Enter to select</span>
                </div>

                {/* Section 1: Pages & Modules */}
                {filteredRoutes.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Pages &amp; Actions
                    </div>
                    {filteredRoutes.map((route, idx) => {
                      const Icon = route.icon;
                      const isSelected = selectedIndex === idx;
                      return (
                        <button
                          key={route.path}
                          onClick={() => handleSelectRoute(route.path)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-3 text-xs transition cursor-pointer ${
                            isSelected ? 'bg-orange-50 text-orange-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                              <Icon size={14} />
                            </div>
                            <span className="truncate">{route.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded-md font-mono">{route.category}</span>
                            <ArrowRight size={12} className={isSelected ? 'text-orange-500' : 'text-slate-300'} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Section 2: Products Catalog (when query exists) */}
                {filteredProducts.length > 0 && (
                  <div className="py-1 border-t border-slate-100">
                    <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Products in Catalog</span>
                      <span className="text-[10px] font-normal text-slate-400">Click to bill in POS</span>
                    </div>
                    {filteredProducts.map((prod, pIdx) => {
                      const overallIdx = filteredRoutes.length + pIdx;
                      const isSelected = selectedIndex === overallIdx;
                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleSelectRoute('/pos/new')}
                          onMouseEnter={() => setSelectedIndex(overallIdx)}
                          className={`px-3.5 py-2 flex items-center justify-between gap-3 text-xs transition cursor-pointer ${
                            isSelected ? 'bg-orange-50 text-orange-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                              <Package size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{prod.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                SKU: {prod.sku} • {prod.category_name || 'General'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-extrabold text-slate-900 text-xs">
                              ₹{Number(prod.selling_price || 0).toLocaleString('en-IN')}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRoute('/pos/new');
                              }}
                              className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-[10px] font-bold transition flex items-center gap-1"
                              title="Start POS Bill"
                            >
                              <span>Bill</span>
                              <ArrowUpRight size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty State */}
                {filteredRoutes.length === 0 && filteredProducts.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No results found for &ldquo;{searchQuery}&rdquo;. Try another term.
                  </div>
                )}

                {/* Quick Shortcuts Footer */}
                <div className="p-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectRoute('/pos/new')}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-orange-300 rounded-lg font-semibold text-slate-700 hover:text-orange-600 transition flex items-center gap-1 cursor-pointer"
                    >
                      <ShoppingCart size={12} className="text-orange-600" />
                      <span>+ New Bill</span>
                    </button>
                    <button
                      onClick={() => handleSelectRoute('/purchases/new')}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-emerald-300 rounded-lg font-semibold text-slate-700 hover:text-emerald-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      <ShoppingBag size={12} className="text-emerald-600" />
                      <span>+ New Purchase</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400">Esc to close</span>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Right Side: Notification Icon & User Profile Card */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Notification Bell Dropdown */}
          <div className="relative" id="notif-menu-dropdown">
            <button
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="relative p-2 sm:p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-orange-600 transition-all shadow-xs cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {/* Active Indicator Pulse Dot */}
              {(dashboardNotifs.lowStock > 0 || dashboardNotifs.overdueDue > 0) && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {notifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-84 rounded-2xl bg-white border border-slate-200 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-extrabold text-slate-900">System Notifications</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded-md">
                    {dashboardNotifs.lowStock > 0 || dashboardNotifs.overdueDue > 0 ? 'Active Alerts' : 'All Clear'}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          if (n.actionRoute && onNavigate) onNavigate(n.actionRoute);
                        }}
                        className="p-3 hover:bg-orange-50/50 transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <div className={`p-2 rounded-xl flex-shrink-0 ${n.iconColor}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 px-3">
                  <button
                    onClick={() => {
                      setNotifDropdownOpen(false);
                      if (onNavigate) onNavigate('/dashboard');
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                  >
                    View Executive Dashboard →
                  </button>
                  <button
                    onClick={() => setNotifDropdownOpen(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Card & Dropdown */}
          <div className="relative" id="user-menu-dropdown">
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotifDropdownOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 sm:pl-2.5 sm:pr-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all text-left shadow-xs cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-orange-500/15 flex-shrink-0">
                {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  {user?.username || 'Admin User'}
                  <ChevronDown size={14} className="text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {isAdmin ? 'ADMINISTRATOR' : 'CASHIER'}
                </div>
              </div>
            </button>

            {/* User Profile Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-900">{user?.username || 'Administrator'}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{user?.email || 'admin@octane.com'}</p>
                </div>

                <div className="py-1">
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        if (onNavigate) onNavigate('/settings?tab=shop');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors font-semibold cursor-pointer"
                    >
                      <Settings size={15} className="text-orange-600" />
                      <span>System Settings</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      if (onNavigate) onNavigate('/settings?tab=account');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors font-semibold cursor-pointer"
                  >
                    <KeyRound size={15} className="text-orange-600" />
                    <span>My Credentials &amp; Password</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-bold cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Logout Session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Topbar;
