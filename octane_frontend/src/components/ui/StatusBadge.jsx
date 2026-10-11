import React from 'react';

export const StatusBadge = ({ status, type = 'status' }) => {
  // Handle Payment Statuses (PAID, PARTIALLY_PAID, UNPAID)
  if (type === 'payment' || status === 'PAID' || status === 'PARTIALLY_PAID' || status === 'UNPAID') {
    const isPaid = status === 'PAID';
    const isPartial = status === 'PARTIALLY_PAID';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
          isPaid
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : isPartial
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : isPartial ? 'bg-amber-500' : 'bg-rose-500'}`} />
        <span>{isPartial ? 'PARTIAL' : status}</span>
      </span>
    );
  }

  if (type === 'status') {
    const isActive = status === true || status === 'ACTIVE' || status === 'Active';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <span>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
      </span>
    );
  }

  if (type === 'tracking') {
    const isSerial = status === 'SERIAL_NUMBER';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
          isSerial
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}
      >
        <span>{isSerial ? 'SERIAL NUMBER' : 'QUANTITY'}</span>
      </span>
    );
  }

  if (type === 'customer_type') {
    const isBusiness = status === 'BUSINESS';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
          isBusiness
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        <span>{isBusiness ? 'BUSINESS' : 'INDIVIDUAL'}</span>
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
      {String(status)}
    </span>
  );
};

export default StatusBadge;
