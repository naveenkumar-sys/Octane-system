import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Calendar,
  FileText,
  Clock,
  User,
  MapPin,
  Phone,
  Globe,
  CreditCard,
  Building,
  CheckSquare,
  ListOrdered,
  Settings,
  Package,
  Percent,
  Mail,
  ZoomIn,
  Maximize2,
  Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { downloadQuotationPdf } from '../../utils/quotationPdfExporter';
import octaneLogo from '../../assets/octane_logo.png';
import octaneSeal from '../../assets/octane_seal.png';

// Helper for date formatting
export const formatDateDMY = (dateVal) => {
  if (!dateVal) return '—';
  const str = String(dateVal).trim();
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) return str;

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return str;
};

// Formats currency numbers with Indian formatting
export const formatINR = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const A4QuotationSheet = ({ quotation, company }) => {
  const rawItems = Array.isArray(quotation?.items) ? quotation.items : [];
  
  // Filter out any completely blank accidental items
  const validItems = useMemo(() => {
    return rawItems.filter(
      (it) => (it.description && String(it.description).trim()) || (it.part_number && String(it.part_number).trim()) || it.unit_price || it.total
    );
  }, [rawItems]);

  // Dynamic rows strictly based on user items (no dummy/placeholder rows)
  const displayRows = useMemo(() => {
    if (!validItems || validItems.length === 0) {
      return [{
        isActual: false,
        sn: 1,
        part_number: '—',
        description: 'No items added',
        unit_price: 0,
        quantity: 0,
        total_value: 0,
        gst_rate: 0,
        total: 0
      }];
    }
    return validItems.map((it, idx) => ({
      ...it,
      isActual: true,
      sn: it.sn || idx + 1
    }));
  }, [validItems]);

  const quoteDate = formatDateDMY(quotation?.quotation_date || new Date());
  const validityText = quotation?.validity_days ? `${quotation.validity_days} Days` : '7 Days';

  // Bank details fallback matching template
  const bankName = quotation?.bank_name || 'HDFC BANK';
  const accountNo = quotation?.account_number || '50100856647820';
  const branchIfsc = quotation?.branch_ifsc || 'KORAMANGALA & HDFC0000053';
  const accountHolder = quotation?.account_holder || 'Sanjay';

  // Contact person fallback
  const contactPerson = quotation?.contact_person || 'JAGADEESH S';
  const contactPhone = quotation?.contact_phone || '+91 95007 10234';
  const contactEmail = quotation?.contact_email || 'support@octanesystems.in';

  // Address matching template
  const companyAddress = '154/A, 14th cross, 20th B Main Rd, Maruti Nagar, BTM 1st Stage, Bengaluru, Karnataka 560068';

  const termsList = useMemo(() => {
    if (quotation?.terms_and_conditions) {
      return quotation.terms_and_conditions
        .split('\n')
        .map((t) => t.replace(/^[•\-\*\d\.]+\s*/, '').trim())
        .filter(Boolean);
    }
    return [
      'Taxes extra as applicable at the time of billing',
      'Delivery: 1 week',
      'Validity: 7 days',
      'Payment: 15 days',
      'Order: Purchase Order should be in the name of Octane Systems',
    ];
  }, [quotation?.terms_and_conditions]);

  return (
    <div className="relative w-[210mm] max-w-full min-h-[auto] print:w-[210mm] print:max-w-[210mm] box-border p-[8mm] print:p-[6mm] bg-white text-slate-800 font-sans text-[11px] leading-tight select-none shadow-2xl print:shadow-none print:border-none mx-auto page-break-inside-avoid">
      
      {/* ========================================================
          1. HEADER SECTION (Logo + Address + Date Box + Background Shapes)
      ======================================================== */}
      <div className="relative mb-2">
        {/* Top Right Geometric Wings - Seamlessly touches top & right edges and the horizontal blue line */}
        <div className="absolute -top-[8mm] -right-[8mm] bottom-0 w-[44%] pointer-events-none z-0 overflow-hidden">
          {/* Light Blue Polygon */}
          <div
            className="absolute inset-0 bg-[#E8F2FA]"
            style={{ clipPath: 'polygon(24% 0, 100% 0, 100% 100%, 0 100%)' }}
          />
          {/* Dark Blue Triangle Wing strictly at the far right corner */}
          <div
            className="absolute top-0 right-0 w-[24%] h-full bg-[#0C4A8A]"
            style={{ clipPath: 'polygon(60% 0, 100% 0, 100% 100%, 0 100%)' }}
          />
        </div>

        {/* Header Content */}
        <div className="flex items-center justify-between pb-2.5 relative z-10 min-h-[72px]">
          
          {/* Top Left: Official Logo + Company Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src={octaneLogo}
              alt="Octane Systems Official Logo"
              className="h-11 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="text-[19px] font-black tracking-wide text-[#0C4A8A] leading-tight">
                OCTANE SYSTEMS
              </h1>
              <p className="text-[7.5px] font-bold tracking-[0.24em] text-[#0C4A8A] uppercase">
                INNOVATION &nbsp;|&nbsp; SOLUTIONS &nbsp;|&nbsp; GROWTH
              </p>
            </div>
          </div>

          {/* Thin Vertical Separator Line */}
          <div className="h-12 w-[1px] bg-slate-300 mx-2 shrink-0 self-center" />

          {/* Center: Company Contact Details */}
          <div className="text-[8.5px] text-slate-700 space-y-0.5 leading-tight shrink-0 max-w-[235px]">
            <div className="flex items-start gap-1">
              <MapPin size={10} className="text-[#0C4A8A] shrink-0 mt-0.5" />
              <span className="leading-tight">{companyAddress}</span>
            </div>
            <div className="flex items-center gap-1">
              <Phone size={10} className="text-[#0C4A8A] shrink-0" />
              <span className="font-semibold">+91 95007 10234</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe size={10} className="text-[#0C4A8A] shrink-0" />
              <span>www.octanesystems.in</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-[#0C4A8A]">
              <CreditCard size={10} className="shrink-0" />
              <span>GST NO: 29DRTPA7275L1ZW</span>
            </div>
          </div>

          {/* Top Right: Date, Quote#, Validity squarely inside the Light-Blue Wing */}
          <div className="shrink-0 text-[10px] space-y-1.5 font-medium text-slate-800 pr-10 z-10">
            <div className="grid grid-cols-[16px_58px_8px_auto] items-center whitespace-nowrap">
              <Calendar size={12} className="text-[#0C4A8A]" />
              <span className="font-semibold text-slate-700">Date</span>
              <span className="font-bold text-slate-600">:</span>
              <span className="font-bold text-slate-900">{quoteDate}</span>
            </div>
            <div className="grid grid-cols-[16px_58px_8px_auto] items-center whitespace-nowrap">
              <FileText size={12} className="text-[#0C4A8A]" />
              <span className="font-semibold text-slate-700">Quote#</span>
              <span className="font-bold text-slate-600">:</span>
              <span className="font-black text-[#0C4A8A]">{quotation?.quotation_number || 'OCT0001'}</span>
            </div>
            <div className="grid grid-cols-[16px_58px_8px_auto] items-center whitespace-nowrap">
              <Clock size={12} className="text-[#0C4A8A]" />
              <span className="font-semibold text-slate-700">Valid until</span>
              <span className="font-bold text-slate-600">:</span>
              <span className="font-bold text-slate-900">{validityText}</span>
            </div>
          </div>
        </div>

        {/* Solid Blue Horizontal Dividing Line */}
        <div className="h-[2.5px] bg-[#0C4A8A] w-full" />
      </div>

        {/* ========================================================
            2. BUYER SECTION + "QUOTATION" BANNER
        ======================================================== */}
        <div className="flex items-start justify-between my-2.5 gap-4">
          
          {/* Buyer Block */}
          <div className="text-[10px] text-slate-800 max-w-[42%]">
            <div className="flex items-center gap-1 font-bold text-[#0C4A8A]">
              <User size={12} />
              <span>To</span>
            </div>
            <div className="inline-block bg-[#0C4A8A] text-white font-bold text-[10px] px-3 py-0.5 rounded-sm my-1 uppercase tracking-wide">
              Buyer:
            </div>
            <div className="font-bold text-[12px] text-slate-900 leading-tight">
              {quotation?.buyer_name || 'Valued Client'}
            </div>
            {quotation?.buyer_address && (
              <div className="text-slate-700 whitespace-pre-line leading-snug mt-0.5">
                {quotation.buyer_address}
              </div>
            )}
            <div className="text-slate-700">
              {quotation?.buyer_city && <span>{quotation.buyer_city}</span>}
              {quotation?.buyer_state && <span>, {quotation.buyer_state}</span>}
              {quotation?.buyer_pincode && <span> {quotation.buyer_pincode}</span>}
            </div>
            {quotation?.buyer_gstin && (
              <div className="text-[9.5px] font-bold text-[#0C4A8A] mt-0.5">
                GSTIN: {quotation.buyer_gstin}
              </div>
            )}
            {quotation?.buyer_phone && (
              <div className="text-[9.5px] text-slate-600">
                Phone: {quotation.buyer_phone}
              </div>
            )}
          </div>

          {/* Quotation Parallelogram Banner & Tagline */}
          <div className="flex flex-col items-end pr-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Left Accent Double Slashes */}
              <span className="text-[#48A4E0] font-black text-2xl tracking-tighter italic mr-1 select-none">//</span>
              
              {/* Parallelogram Ribbon */}
              <div
                className="bg-[#0C4A8A] text-white px-7 py-2 rounded-sm flex items-center gap-2 shadow-sm"
                style={{ transform: 'skewX(-14deg)' }}
              >
                <div style={{ transform: 'skewX(14deg)' }} className="flex items-center gap-2">
                  <div className="bg-white/10 p-1 rounded-sm border border-white/20">
                    <FileText size={16} className="text-white" />
                  </div>
                  <span className="text-[19px] font-black tracking-widest uppercase text-white font-sans">
                    QUOTATION
                  </span>
                </div>
              </div>

              {/* Right Accent Double Slashes */}
              <span className="text-[#48A4E0] font-black text-2xl tracking-tighter italic ml-1 select-none">//</span>
            </div>

            {/* Slogan underneath banner */}
            <div className="text-[#0C4A8A] italic font-serif text-[12.5px] mt-2 font-bold tracking-wide">
              Your Technology Partner for a Better Tomorrow
            </div>
          </div>
        </div>

        {/* ========================================================
            3. MAIN LINE ITEMS TABLE (8 COLUMNS EXACT TEMPLATE)
        ======================================================== */}
        <div className="border-[1.5px] border-[#68A2D5] rounded-xl overflow-hidden mt-2">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#0C4A8A] text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2 px-2 text-center w-[38px] border-r border-[#1B5BA1]">
                  <div className="flex items-center justify-center gap-1">
                    <ListOrdered size={11} /> SN#
                  </div>
                </th>
                <th className="py-2 px-2 text-left w-[115px] border-r border-[#1B5BA1]">
                  <div className="flex items-center gap-1">
                    <Settings size={11} /> Part Number
                  </div>
                </th>
                <th className="py-2 px-3 text-left border-r border-[#1B5BA1]">
                  <div className="flex items-center gap-1">
                    <FileText size={11} /> Description
                  </div>
                </th>
                <th className="py-2 px-2 text-right w-[85px] border-r border-[#1B5BA1]">
                  <div className="flex items-center justify-end gap-0.5">₹ Unit Price</div>
                </th>
                <th className="py-2 px-2 text-center w-[45px] border-r border-[#1B5BA1]">
                  <div className="flex items-center justify-center gap-1">
                    <Package size={11} /> Qty
                  </div>
                </th>
                <th className="py-2 px-2 text-right w-[85px] border-r border-[#1B5BA1]">
                  <div className="flex items-center justify-end gap-0.5">₹ Total value</div>
                </th>
                <th className="py-2 px-2 text-right w-[75px] border-r border-[#1B5BA1]">
                  <div className="flex items-center justify-end gap-1">
                    <Percent size={10} /> GST %
                  </div>
                </th>
                <th className="py-2 px-2 text-right w-[95px]">
                  <div className="flex items-center justify-end gap-0.5">₹ Total</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => {
                const isEven = index % 2 === 1;
                const rowBg = isEven ? 'bg-[#EDF5FC]' : 'bg-white';

                if (!row.isActual) {
                  return (
                    <tr
                      key={`empty-${index}`}
                      className={`h-[28px] ${rowBg} border-b border-[#B8D7F2] text-[10px] text-slate-500`}
                    >
                      <td className="py-2 text-center text-slate-400 border-r border-[#B8D7F2]">1</td>
                      <td className="py-2 px-2 text-slate-400 border-r border-[#B8D7F2]">—</td>
                      <td className="py-2 px-3 italic border-r border-[#B8D7F2]">{row.description}</td>
                      <td className="py-2 px-2 text-right text-slate-400 border-r border-[#B8D7F2]">—</td>
                      <td className="py-2 px-1 text-center text-slate-400 border-r border-[#B8D7F2]">—</td>
                      <td className="py-2 px-2 text-right text-slate-400 border-r border-[#B8D7F2]">—</td>
                      <td className="py-2 px-2 text-right text-slate-400 border-r border-[#B8D7F2]">—</td>
                      <td className="py-2 px-2 text-right text-slate-400">—</td>
                    </tr>
                  );
                }

                // Actual populated line item
                const unitPrice = parseFloat(row.unit_price || 0);
                const qty = parseFloat(row.quantity || 1);
                const taxableVal = parseFloat(row.total_value || unitPrice * qty);
                const gstRate = parseFloat(row.gst_rate ?? 18);
                const total = parseFloat(row.total || taxableVal * (1 + gstRate / 100));

                return (
                  <tr
                    key={`item-${index}`}
                    className={`h-[28px] ${rowBg} border-b border-[#B8D7F2] text-[10px] text-slate-800`}
                  >
                    <td className="py-1.5 px-1 text-center font-bold text-slate-700 border-r border-[#B8D7F2]">
                      {row.sn}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-900 border-r border-[#B8D7F2] truncate max-w-[115px]">
                      {row.part_number || row.sku || '—'}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-[#B8D7F2] leading-snug">
                      <div>{row.description || '—'}</div>
                      {row.specifications && (
                        <div className="text-[8.5px] text-slate-500 font-normal">{row.specifications}</div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold border-r border-[#B8D7F2]">
                      {formatINR(unitPrice)}
                    </td>
                    <td className="py-1.5 px-1 text-center font-bold border-r border-[#B8D7F2]">
                      {qty}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold border-r border-[#B8D7F2]">
                      {formatINR(taxableVal)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-700 border-r border-[#B8D7F2]">
                      {gstRate}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-black text-[#0C4A8A]">
                      {formatINR(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-[#EDF5FC] font-bold text-slate-900 border-t-2 border-[#0C4A8A] text-[10.5px]">
                <td colSpan={3} className="py-1.5 px-3 text-right uppercase text-slate-800 tracking-wider">
                  TOTAL TAXABLE / GRAND TOTAL:
                </td>
                <td colSpan={3} className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-[#B8D7F2]">
                  ₹ {formatINR(quotation?.taxable_amount || 0)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-700 border-r border-[#B8D7F2] text-[10px]">
                  + ₹ {formatINR(quotation?.total_tax || 0)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[12px] font-black text-[#0C4A8A]">
                  ₹ {formatINR(quotation?.grand_total || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      {/* ========================================================
          4. BOTTOM SECTION: Terms | Bank Details | Signatory
          (Flows dynamically based on table size)
      ======================================================== */}
      <div className="mt-5">
        <div className="grid grid-cols-12 gap-3 pb-2 border-b border-slate-200 items-start">
          
          {/* Column 1: Terms & Conditions */}
          <div className="col-span-5 bg-[#F4F9FD] border border-[#C5DFF5] rounded-xl p-2.5 text-[9.5px]">
            <div
              className="inline-flex items-center gap-1.5 text-white bg-[#0C4A8A] px-3.5 py-1 rounded-l-md font-bold uppercase text-[9.5px] mb-2"
              style={{ clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0 100%)' }}
            >
              <CheckSquare size={11} className="text-[#00A3E0]" />
              <span className="pr-2">Terms & Conditions:</span>
            </div>
            <ul className="space-y-1 text-slate-700 leading-tight pl-0.5">
              {termsList.map((term, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[#0C4A8A] font-black leading-none mt-0.5 text-[11px]">•</span>
                  <span>{term}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Company's Bank Details */}
          <div className="col-span-4 bg-[#F4F9FD] border border-[#C5DFF5] rounded-xl p-2.5 text-[9.5px]">
            <div
              className="inline-flex items-center gap-1.5 text-white bg-[#0C4A8A] px-3.5 py-1 rounded-l-md font-bold uppercase text-[9.5px] mb-2"
              style={{ clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0 100%)' }}
            >
              <Building size={11} className="text-[#00A3E0]" />
              <span className="pr-2">Company's Bank Details</span>
            </div>
            <div className="space-y-1.5 text-slate-800 font-medium">
              <div className="grid grid-cols-12">
                <span className="col-span-5 text-slate-600 font-semibold">Bank Name</span>
                <span className="col-span-1">:</span>
                <span className="col-span-6 font-bold text-slate-900">{bankName}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-5 text-slate-600 font-semibold">A/c No</span>
                <span className="col-span-1">:</span>
                <span className="col-span-6 font-mono font-bold text-slate-900">{accountNo}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-5 text-slate-600 font-semibold">Branch</span>
                <span className="col-span-1">:</span>
                <span className="col-span-6 font-mono font-semibold text-slate-900">{branchIfsc}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-5 text-slate-600 font-semibold">Account Holder Name</span>
                <span className="col-span-1">:</span>
                <span className="col-span-6 font-bold text-slate-900">{accountHolder}</span>
              </div>
            </div>
          </div>

          {/* Column 3: Authorized Signatory with Seal */}
          <div className="col-span-3 flex flex-col items-center justify-between h-full text-center pt-1">
            <div className="font-black text-[#0C4A8A] text-[11.5px] uppercase tracking-wide">
              For OCTANE SYSTEMS
            </div>
            
            {/* Stamp / Seal Image */}
            <div className="my-1.5">
              <img
                src={octaneSeal}
                alt="Octane Systems Official Seal"
                className="h-17 w-17 object-contain shrink-0 mx-auto"
              />
            </div>

            <div className="border-t border-[#0C4A8A] pt-1 w-full text-[9.5px] font-bold text-[#0C4A8A] uppercase">
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* ========================================================
            5. CONTACT STRIP & THANK YOU
        ======================================================== */}
        <div className="text-center py-1.5">
          <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-slate-700">
            <div className="bg-[#0C4A8A] text-white p-0.5 rounded-xs">
              <Mail size={10} />
            </div>
            <span>If you have any questions about this price quote, please contact:</span>
            <span className="font-bold text-[#0C4A8A]">{contactPerson}, {contactPhone}</span>
            <span>E-mail: <strong className="text-[#0C4A8A]">{contactEmail}</strong></span>
          </div>

          {/* Underline separator */}
          <div className="w-56 h-[1px] bg-slate-300 mx-auto mt-1" />

          <div className="italic font-bold text-[#0C4A8A] text-[11px] mt-0.5 tracking-wide font-serif">
            Thank You for Your Business!
          </div>
        </div>

        {/* ========================================================
            6. BOTTOM BRAND BAR WITH CYAN GEOMETRIC ACCENT
        ======================================================== */}
        <div className="relative bg-[#0C4A8A] text-white px-4 py-1.5 rounded-sm flex items-center justify-between text-[9px] font-medium overflow-hidden">
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="text-[#00A3E0]" />
            <strong className="font-bold">OCTANE SYSTEMS</strong> &nbsp;|&nbsp; {companyAddress}
          </div>
          <div className="flex items-center gap-3 pr-10">
            <span className="flex items-center gap-1">
              <Phone size={10} className="text-[#00A3E0]" /> +91 95007 10234
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Globe size={10} className="text-[#00A3E0]" /> www.octanesystems.in
            </span>
          </div>

          {/* Dynamic Geometric Cyan Accent Wing */}
          <div
            className="absolute right-0 top-0 bottom-0 w-10 bg-[#00A3E0]"
            style={{ clipPath: 'polygon(45% 100%, 100% 0, 100% 100%, 0 100%)' }}
          />
        </div>
      </div>
    </div>
  );
};

export const A4QuotationPrintModal = ({ isOpen, onClose, quotation }) => {
  const { businessProfile } = useBusinessProfile();
  const [viewMode, setViewMode] = useState('fit');
  const [savingPdf, setSavingPdf] = useState(false);

  if (!isOpen || !quotation) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsPdf = async () => {
    setSavingPdf(true);
    try {
      const fileName = await downloadQuotationPdf(quotation, businessProfile);
      toast.success(`Quotation PDF downloaded: ${fileName}`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to save PDF. Please try Print -> Save as PDF.');
    } finally {
      setSavingPdf(false);
    }
  };

  return createPortal(
    <div
      id="a4-quotation-print-portal"
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex flex-col justify-start items-center overflow-y-auto p-4 print:p-0 print:bg-white print:overflow-visible"
    >
      {/* Top Floating Control Bar */}
      <div className="sticky top-2 z-50 flex items-center justify-between gap-3 bg-white text-slate-800 px-5 py-2.5 rounded-2xl shadow-xl border border-slate-200 mb-4 print:hidden max-w-4xl w-full">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-[#0C4A8A]" />
          <span className="font-extrabold text-sm tracking-wide text-slate-900">
            Quotation Preview &mdash; #{quotation.quotation_number}
          </span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            {quotation.status || 'DRAFT'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'fit' ? 'full' : 'fit')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
          >
            {viewMode === 'fit' ? <Maximize2 size={13} /> : <ZoomIn size={13} />}
            <span>{viewMode === 'fit' ? 'Actual 100%' : 'Fit Screen'}</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer size={15} />
            <span>Print Quotation</span>
          </button>

          {/* Save as PDF Button */}
          <button
            onClick={handleSaveAsPdf}
            disabled={savingPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0C4A8A] hover:bg-[#0a3d72] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            title="Save quotation as a PDF file"
          >
            <Download size={15} />
            <span>{savingPdf ? 'Saving…' : 'Save as PDF'}</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        id="a4-quotation-print-area"
        className={`print:m-0 print:p-0 transition-transform duration-200 ${
          viewMode === 'fit' ? 'scale-[0.88] origin-top' : 'scale-100'
        }`}
      >
        <A4QuotationSheet quotation={quotation} company={businessProfile} />
      </div>
    </div>,
    document.body
  );
};

export default A4QuotationPrintModal;
