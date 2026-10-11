import React, { useState } from 'react';
import {
  Sparkles,
  DollarSign,
  TrendingUp,
  Package,
  Plus,
  Trash2,
  Edit,
  Download,
  CheckCircle,
  AlertTriangle,
  User,
  Search,
  Filter,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card, { StatCard } from '../components/ui/Card';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Input, { Select, Toggle } from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';

export const DesignSystemShowcase = () => {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [toggleState, setToggleState] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [page, setPage] = useState(1);

  // Sample Mock Data for Table Showcase
  const mockTableData = [
    { id: 'INV-2026-001', customer: 'Nexus Electronics', amount: '₹145,200.00', status: 'POSTED', payment: 'PAID', date: '2026-09-20' },
    { id: 'INV-2026-002', customer: 'Aero Dynamics Ltd', amount: '₹89,400.00', status: 'POSTED', payment: 'PARTIALLY_PAID', date: '2026-09-19' },
    { id: 'INV-2026-003', customer: 'Starlight Retailers', amount: '₹32,100.00', status: 'DRAFT', payment: 'UNPAID', date: '2026-09-19' },
    { id: 'INV-2026-004', customer: 'Vortex Solutions', amount: '₹210,000.00', status: 'POSTED', payment: 'PAID', date: '2026-09-18' },
    { id: 'INV-2026-005', customer: 'Titanium Hardware', amount: '₹45,600.00', status: 'CANCELLED', payment: 'UNPAID', date: '2026-09-17' },
  ];

  const tableColumns = [
    { title: 'Invoice ID', key: 'id', render: (row) => <span className="font-mono font-bold text-orange-600">{row.id}</span> },
    { title: 'Customer Name', key: 'customer', render: (row) => <span className="font-semibold text-slate-800">{row.customer}</span> },
    { title: 'Amount (GST Incl.)', key: 'amount', align: 'right', render: (row) => <span className="font-mono font-bold text-slate-900">{row.amount}</span> },
    { title: 'Invoice Status', key: 'status', align: 'center', render: (row) => <StatusBadge status={row.status} type="invoice" /> },
    { title: 'Payment Status', key: 'payment', align: 'center', render: (row) => <StatusBadge status={row.payment} type="payment" /> },
    { title: 'Date', key: 'date', align: 'right', render: (row) => <span className="text-slate-500 font-mono text-[11px]">{row.date}</span> },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: () => (
        <div className="flex items-center justify-center gap-1">
          <button className="p-1 text-slate-400 hover:text-orange-600 transition-colors"><Edit size={14} /></button>
          <button className="p-1 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-10 pb-12">
      {/* Header Banner - Bright Orange Theme */}
      <div className="p-6 rounded-2xl border border-orange-400 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <Sparkles size={160} className="text-white" />
        </div>
        <div className="flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-widest mb-2">
          <Sparkles size={16} />
          <span>OCTANE Bright Design System • Component Gallery</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Vibrant Bright & Orange Theme Foundation
        </h1>
        <p className="text-sm text-orange-50 mt-2 max-w-2xl leading-relaxed font-medium">
          Clean, high-contrast, bright UI palette engineered for maximum readability in retail POS environments, with warm orange accents, elevated white cards, crisp typography, and fluid micro-interactions.
        </p>
      </div>

      {/* SECTION 1: STATS & KPI WIDGETS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-orange-500 pl-3">
          1. Metric & KPI Stat Cards
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Revenue"
            value="₹1,482,900"
            subtitle="vs last month"
            icon={DollarSign}
            trendType="up"
            trendValue="+14.2%"
            accentColor="orange"
          />
          <StatCard
            title="Total Sales Count"
            value="1,240 Invoices"
            subtitle="Active billing period"
            icon={TrendingUp}
            trendType="up"
            trendValue="+8.5%"
            accentColor="emerald"
          />
          <StatCard
            title="Low Stock Items"
            value="14 Products"
            subtitle="Requires vendor PO"
            icon={Package}
            trendType="down"
            trendValue="3 Critical"
            accentColor="rose"
          />
          <StatCard
            title="Partner Capital"
            value="₹5,000,000"
            subtitle="50 / 50 Ownership"
            icon={User}
            trendType="neutral"
            trendValue="Balanced"
            accentColor="amber"
          />
        </div>
      </section>

      {/* SECTION 2: BUTTON VARIANTS & SIZES */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-orange-500 pl-3">
          2. Interactive Buttons & Actions
        </h2>
        <Card title="Button Variants & States" subtitle="Hover, focus glow, and loading indicators">
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary" icon={Plus} onClick={() => toast.success('Primary Action Clicked')}>
              Primary Action
            </Button>
            <Button variant="secondary" icon={Download} onClick={() => toast.info('Secondary Export Triggered')}>
              Secondary Button
            </Button>
            <Button variant="outline" icon={Filter}>
              Outline Filter
            </Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="success" icon={CheckCircle}>
              Success Save
            </Button>
            <Button variant="danger" icon={Trash2}>
              Danger Delete
            </Button>
            <Button variant="primary" loading>
              Processing
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3 items-center">
            <span className="text-xs text-slate-500 font-bold uppercase mr-2">Sizes:</span>
            <Button size="xs" variant="secondary">Extra Small (xs)</Button>
            <Button size="sm" variant="secondary">Small (sm)</Button>
            <Button size="md" variant="secondary">Medium (md)</Button>
            <Button size="lg" variant="secondary">Large (lg)</Button>
          </div>
        </Card>
      </section>

      {/* SECTION 3: STATUS BADGES */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-orange-500 pl-3">
          3. Status Badges Matrix
        </h2>
        <Card title="Domain Status Indicators" subtitle="Standardized bright colors mapped to DB choices">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-2">Payment Status:</span>
              <div className="flex gap-3">
                <StatusBadge status="PAID" type="payment" />
                <StatusBadge status="PARTIALLY_PAID" type="payment" />
                <StatusBadge status="UNPAID" type="payment" />
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 block mb-2">Invoice Status:</span>
              <div className="flex gap-3">
                <StatusBadge status="POSTED" type="invoice" />
                <StatusBadge status="DRAFT" type="invoice" />
                <StatusBadge status="CANCELLED" type="invoice" />
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 block mb-2">Serial / Stock Status:</span>
              <div className="flex gap-3">
                <StatusBadge status="AVAILABLE" type="serial" />
                <StatusBadge status="SOLD" type="serial" />
                <StatusBadge status="RETURNED" type="serial" />
                <StatusBadge status="DEFECTIVE" type="serial" />
                <StatusBadge status="IN_STOCK" type="stock" />
                <StatusBadge status="LOW_STOCK" type="stock" />
                <StatusBadge status="OUT_OF_STOCK" type="stock" />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* SECTION 4: FORM CONTROLS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-orange-500 pl-3">
          4. Form Controls & Input Fields
        </h2>
        <Card title="Form Inputs, Selects & Toggles" subtitle="Clean bright white inputs with orange focus glow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Product SKU Code"
              placeholder="e.g. PRD-8829"
              icon={Search}
              helperText="Unique product identification code"
            />
            <Select
              label="GST Tax Rate Bracket"
              options={[
                { value: '18', label: '18% Standard GST (CGST 9% + SGST 9%)' },
                { value: '28', label: '28% Luxury GST (CGST 14% + SGST 14%)' },
                { value: '5', label: '5% Reduced GST' },
                { value: '0', label: '0% Exempted' },
              ]}
            />
            <Input
              label="Selling Price (₹)"
              placeholder="0.00"
              icon={DollarSign}
              error={null}
            />
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <Toggle
              label="Enable Serial Number Tracking"
              description="Requires barcode prompt during invoice posting"
              enabled={toggleState}
              onChange={setToggleState}
            />
            <Button
              variant="outline"
              onClick={() => setModalOpen(true)}
              icon={Sparkles}
            >
              Test Modal Dialog Trigger
            </Button>
          </div>
        </Card>
      </section>

      {/* SECTION 5: DATA TABLE */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-orange-500 pl-3">
          5. Data Table Component
        </h2>
        <Table
          columns={tableColumns}
          data={mockTableData}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search invoices by customer or ID..."
          filterOptions={[
            { value: 'POSTED', label: 'Posted Invoices' },
            { value: 'DRAFT', label: 'Draft Invoices' },
            { value: 'CANCELLED', label: 'Cancelled Invoices' },
          ]}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          page={page}
          totalPages={3}
          totalRecords={15}
          onPageChange={setPage}
          headerActions={
            <Button variant="primary" size="xs" icon={Plus}>
              Create Invoice
            </Button>
          }
        />
      </section>

      {/* TEST MODAL DIALOG */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Interactive System Modal"
        subtitle="Standard modal layout pattern across Octane Systems"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast.success('Modal Action Confirmed!');
              }}
            >
              Confirm Action
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            This modal dialog demonstrates smooth animation transitions, accessible title bars, close triggers, and customizable action footers in the bright theme.
          </p>
          <Input label="Confirm Action Code" placeholder="Enter confirmation code..." />
        </div>
      </Modal>
    </div>
  );
};

export default DesignSystemShowcase;
