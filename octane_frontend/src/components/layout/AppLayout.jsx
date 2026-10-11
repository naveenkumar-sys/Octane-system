import React, { useState } from 'react';
import Sidebar, { NAVIGATION_ITEMS } from './Sidebar';
import Topbar from './Topbar';

export const AppLayout = ({ children, currentRoute, onNavigate }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentRoute={currentRoute}
        onSelectRoute={onNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Top Navigation Bar */}
      <Topbar
        onNavigate={onNavigate}
        currentRoute={currentRoute}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
      />

      {/* Main Content Area */}
      <main
        className={`
          pt-16 transition-all duration-300 min-h-screen flex flex-col
          pl-0 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        {/* Responsive Content Container */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
