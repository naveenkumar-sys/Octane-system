import React from 'react';

export const Badge = ({
  children,
  variant = 'orange',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variants = {
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const dotColors = {
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    slate: 'bg-slate-500',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold border rounded-full ${variants[variant] || variants.slate} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[variant] || dotColors.slate}`} />
      )}
      {children}
    </span>
  );
};

export const StatusBadge = ({ status, type = 'payment', className = '' }) => {
  let label = status;
  let variant = 'slate';

  const normalized = (status || '').toString().toUpperCase();

  if (type === 'payment') {
    switch (normalized) {
      case 'PAID':
        label = 'Paid';
        variant = 'emerald';
        break;
      case 'PARTIALLY_PAID':
      case 'PARTIAL':
        label = 'Partially Paid';
        variant = 'amber';
        break;
      case 'UNPAID':
        label = 'Unpaid';
        variant = 'rose';
        break;
      default:
        label = status || 'Unknown';
        variant = 'slate';
    }
  } else if (type === 'invoice') {
    switch (normalized) {
      case 'POSTED':
        label = 'Posted';
        variant = 'orange';
        break;
      case 'DRAFT':
        label = 'Draft';
        variant = 'slate';
        break;
      case 'CANCELLED':
        label = 'Cancelled';
        variant = 'rose';
        break;
      default:
        label = status;
    }
  } else if (type === 'serial') {
    switch (normalized) {
      case 'AVAILABLE':
      case 'IN_STOCK':
        label = 'Available';
        variant = 'emerald';
        break;
      case 'SOLD':
        label = 'Sold';
        variant = 'blue';
        break;
      case 'RETURNED':
        label = 'Returned';
        variant = 'purple';
        break;
      case 'DEFECTIVE':
        label = 'Defective';
        variant = 'rose';
        break;
      default:
        label = status;
    }
  } else if (type === 'stock') {
    switch (normalized) {
      case 'IN_STOCK':
      case 'SUFFICIENT':
        label = 'In Stock';
        variant = 'emerald';
        break;
      case 'LOW_STOCK':
      case 'LOW':
        label = 'Low Stock';
        variant = 'amber';
        break;
      case 'OUT_OF_STOCK':
      case 'CRITICAL':
        label = 'Out of Stock';
        variant = 'rose';
        break;
      default:
        label = status;
    }
  } else if (type === 'role') {
    switch (normalized) {
      case 'ADMIN':
        label = 'Administrator';
        variant = 'orange';
        break;
      case 'CASHIER':
        label = 'Cashier';
        variant = 'amber';
        break;
      default:
        label = status;
    }
  }

  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  );
};

export default Badge;
