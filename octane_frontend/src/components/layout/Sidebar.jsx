import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  X,
  Tag,
  Scale,
  Percent,
  CreditCard,
  FileText,
  BookOpen,
  Boxes,
  Wallet,
  TrendingUp,
  Truck,
  FileSpreadsheet,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusinessProfile } from '../../context/BusinessProfileContext';

export const NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    section: 'Dashboard',
    icon: LayoutDashboard,
    singleItem: true,
    items: [
      { id: '/dashboard', label: 'Executive Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'masters',
    section: 'Masters',
    icon: BookOpen,
    items: [
      { id: '/masters/products', label: 'Products', path: '/masters/products', icon: Package },
      { id: '/masters/categories', label: 'Categories', path: '/masters/categories', icon: Layers },
      { id: '/masters/services', label: 'Services', path: '/masters/services', icon: Wrench },
      { id: '/masters/expense-categories', label: 'Expense Categories', path: '/masters/expense-categories', icon: Receipt },
      { id: '/masters/brands', label: 'Brands', path: '/masters/brands', icon: Tag },
      { id: '/masters/units', label: 'Units', path: '/masters/units', icon: Scale },
      { id: '/masters/tax-hsn-sac', label: 'Tax / HSN / SAC', path: '/masters/tax-hsn-sac', icon: Percent },
      { id: '/masters/suppliers', label: 'Suppliers', path: '/masters/suppliers', icon: Building2 },
      { id: '/masters/customers', label: 'Customers', path: '/masters/customers', icon: Users },
      { id: '/masters/payment-methods', label: 'Payment Methods', path: '/masters/payment-methods', icon: CreditCard },
    ],
  },
  {
    id: 'purchases',
    section: 'Purchases',
    icon: ShoppingBag,
    items: [
      { id: '/purchases/new', label: 'New Purchase', path: '/purchases/new', icon: ShoppingBag },
      { id: '/purchases/history', label: 'Purchase History', path: '/purchases/history', icon: Receipt },
      { id: '/purchases/payables', label: 'Supplier Payables', path: '/purchases/payables', icon: Building2 },
    ],
  },
  {
    id: 'inventory',
    section: 'Inventory',
    icon: Boxes,
    items: [
      { id: '/inventory/overview', label: 'Stock Overview', path: '/inventory/overview', icon: Boxes },
      { id: '/inventory/ledger', label: 'Stock Ledger', path: '/inventory/ledger', icon: FileText },
      { id: '/inventory/serial-numbers', label: 'Serial Numbers', path: '/inventory/serial-numbers', icon: Barcode },
      { id: '/inventory/opening-balance', label: 'Opening Balance', path: '/inventory/opening-balance', icon: Scale },
      { id: '/inventory/adjustment', label: 'Stock Adjustment', path: '/inventory/adjustment', icon: SlidersHorizontal },
    ],
  },
  {
    id: 'pos',
    section: 'POS Billing',
    icon: ShoppingCart,
    items: [
      { id: '/pos/new', label: 'New Sale', path: '/pos/new', icon: ShoppingCart, badge: 'FAST', badgeColor: 'orange' },
      { id: '/pos/invoices', label: 'Invoice History', path: '/pos/invoices', icon: FileText },
    ],
  },
  {
    id: 'finance',
    section: 'Finance',
    icon: Wallet,
    items: [
      { id: '/finance/receivables', label: 'Customer Receivables', path: '/finance/receivables', icon: Users },
      { id: '/finance/expenses', label: 'Expenses', path: '/finance/expenses', icon: Receipt },
      { id: '/finance/partner-ledger', label: 'Partner Ledger', path: '/finance/partner-ledger', icon: PieChart },
      { id: '/finance/payments', label: 'Payments', path: '/finance/payments', icon: CreditCard },
    ],
  },
  {
    id: 'reports',
    section: 'Reports',
    icon: BarChart3,
    items: [
      { id: '/reports/sales', label: 'Sales', path: '/reports/sales', icon: TrendingUp },
      { id: '/reports/purchases', label: 'Purchases', path: '/reports/purchases', icon: Truck },
      { id: '/reports/inventory', label: 'Inventory', path: '/reports/inventory', icon: Package },
      { id: '/reports/gst', label: 'GST', path: '/reports/gst', icon: FileSpreadsheet },
      { id: '/reports/profit-loss', label: 'Profit & Loss', path: '/reports/profit-loss', icon: PieChart },
    ],
  },
  {
    id: 'settings',
    section: 'Settings',
    icon: Settings,
    singleItem: true,
    items: [
      { id: '/settings', label: 'System Settings', path: '/settings', icon: Settings },
    ],
  },
];

export const Sidebar = ({
  currentRoute,
  onSelectRoute,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { isAdmin } = useAuth();
  const { businessProfile } = useBusinessProfile();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [openSections, setOpenSections] = useState({ masters: true, dashboard: true });

  const CASHIER_ALLOWED = [
    '/masters/products',
    '/masters/services',
    '/masters/categories',
    '/masters/brands',
    '/masters/units',
    '/masters/tax-hsn-sac',
    '/masters/customers',
    '/pos/new',
    '/pos/invoices',
  ];

  const filteredNavigation = NAVIGATION_ITEMS.map((group) => {
    if (isAdmin) return group;
    return {
      ...group,
      items: group.items.filter((item) => CASHIER_ALLOWED.includes(item.id)),
    };
  }).filter((group) => group.items.length > 0);

  // Auto-expand section containing currentRoute
  useEffect(() => {
    const activeGroup = filteredNavigation.find((group) =>
      group.items.some((item) => item.id === currentRoute || item.path === currentRoute)
    );
    if (activeGroup) {
      setOpenSections((prev) => ({
        ...prev,
        [activeGroup.id]: true,
      }));
    }
  }, [currentRoute]);

  const toggleSection = (sectionId) => {
    if (isCollapsed) {
      onToggleCollapse(); // expand sidebar if collapsed
    }
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleMouseEnter = (e, item) => {
    // Only show hover tooltip on desktop when collapsed
    if (isCollapsed && window.innerWidth >= 1024) {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredItem({
        label: item.label || item.section,
        badge: item.badge,
        top: rect.top + rect.height / 2,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const handleItemClick = (id) => {
    onSelectRoute(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-white border-r border-slate-200
          transition-all duration-300 ease-in-out select-none shadow-2xl lg:shadow-sm
          ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-slate-200 bg-white relative">
          <div
            onClick={isCollapsed ? onToggleCollapse : undefined}
            className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'lg:cursor-pointer lg:mx-auto' : ''}`}
            title={isCollapsed ? 'Click to expand sidebar' : undefined}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-500/20 flex-shrink-0 overflow-hidden border border-slate-100">
              {businessProfile?.logo_url ? (
                <img
                  src={businessProfile.logo_url}
                  alt={businessProfile.company_name || 'Store Logo'}
                  className="w-full h-full object-contain bg-white p-1"
                />
              ) : (
                <Zap size={22} className="fill-current text-white" />
              )}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight font-sans truncate" title={businessProfile?.company_name || 'OCTANE ERP'}>
                  {businessProfile?.company_name || (
                    <>OCTANE<span className="text-orange-600">.ERP</span></>
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold truncate">
                  {businessProfile?.city ? `${businessProfile.city} Store` : 'Enterprise Shell'}
                </span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors lg:hidden"
            title="Close menu"
          >
            <X size={20} />
          </button>

          {/* Desktop Always Visible Collapse/Expand Toggle */}
          <button
            onClick={onToggleCollapse}
            className={`
              p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors hidden lg:flex items-center justify-center
              ${isCollapsed ? 'absolute -right-3 top-5 bg-white border border-slate-300 shadow-md p-1 rounded-full z-50 text-orange-600 hover:text-orange-700' : ''}
            `}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Links List (Hidden scrollbar) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filteredNavigation.map((group) => {
            const isSingle = group.singleItem || group.items.length === 1;
            const isSectionActive = group.items.some(
              (item) => item.id === currentRoute || item.path === currentRoute
            );
            const isOpen = !!openSections[group.id];
            const SectionIcon = group.icon;

            if (isSingle) {
              const singleItem = group.items[0];
              const Icon = singleItem.icon || SectionIcon;
              const isActive = currentRoute === singleItem.id || currentRoute === singleItem.path;

              return (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => handleItemClick(singleItem.id)}
                    onMouseEnter={(e) => handleMouseEnter(e, singleItem)}
                    onMouseLeave={handleMouseLeave}
                    title={singleItem.label}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-150 relative
                      ${
                        isActive
                          ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-xs'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                      }
                      ${isCollapsed && !isMobileOpen ? 'lg:justify-center lg:px-0' : ''}
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r-full" />
                    )}

                    <Icon
                      size={19}
                      className={`flex-shrink-0 transition-colors ${
                        isActive ? 'text-orange-600' : 'text-slate-400'
                      }`}
                    />

                    {(!isCollapsed || isMobileOpen) && (
                      <span className="truncate flex-1 text-left">{singleItem.label}</span>
                    )}
                  </button>
                </div>
              );
            }

            // Collapsible Multi-item Main Menu Section
            return (
              <div key={group.id} className="space-y-1">
                {/* Main Menu Section Header */}
                <button
                  onClick={() => toggleSection(group.id)}
                  onMouseEnter={(e) => handleMouseEnter(e, group)}
                  onMouseLeave={handleMouseLeave}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-150 relative
                    ${
                      isSectionActive
                        ? 'text-orange-700 bg-orange-50/60 font-extrabold border border-orange-100/80'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }
                    ${isCollapsed && !isMobileOpen ? 'lg:justify-center lg:px-0' : ''}
                  `}
                >
                  <SectionIcon
                    size={19}
                    className={`flex-shrink-0 transition-colors ${
                      isSectionActive ? 'text-orange-600' : 'text-slate-500'
                    }`}
                  />

                  {(!isCollapsed || isMobileOpen) && (
                    <>
                      <span className="truncate flex-1 text-left tracking-wide">{group.section}</span>
                      <span className="text-slate-400 p-0.5 rounded transition-transform duration-200">
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </>
                  )}
                </button>

                {/* Submenu Accordion Items */}
                {isOpen && (!isCollapsed || isMobileOpen) && (
                  <div className="pl-4 ml-3 border-l-2 border-slate-100 space-y-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = currentRoute === item.id || currentRoute === item.path;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          title={item.label}
                          className={`
                            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium text-xs transition-all duration-150 relative
                            ${
                              isActive
                                ? 'bg-orange-50 text-orange-700 font-semibold border border-orange-200 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                            }
                          `}
                        >
                          {isActive && (
                            <span className="absolute -left-[17px] top-2 bottom-2 w-1 bg-orange-500 rounded-r-full" />
                          )}
                          <ItemIcon
                            size={16}
                            className={`flex-shrink-0 transition-colors ${
                              isActive ? 'text-orange-600' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md border ${
                                item.badgeColor === 'amber'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-orange-100 text-orange-800 border-orange-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Fixed Unclipped Floating Hover Tooltip when Collapsed on Desktop */}
      {isCollapsed && hoveredItem && (
        <div
          style={{ top: `${hoveredItem.top}px` }}
          className="fixed left-20 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-2xl z-50 hidden lg:flex items-center gap-2 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100 border border-slate-800"
        >
          <span>{hoveredItem.label}</span>
          {hoveredItem.badge && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-orange-500 text-white rounded">
              {hoveredItem.badge}
            </span>
          )}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-slate-800" />
        </div>
      )}
    </>
  );
};

export default Sidebar;

