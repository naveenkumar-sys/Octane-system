import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Eye, FileText, Maximize2, ZoomIn } from 'lucide-react';
import { api } from '../../services/api';
import { useBusinessProfile } from '../../context/BusinessProfileContext';

// Helper function to convert number to Rupees in words
export const numberToWordsRupees = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Indian Rupees Zero Only';
  const n = Math.floor(Math.abs(Number(amount)));
  if (n === 0) return 'Indian Rupees Zero Only';

  const single = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(num) {
    let str = '';
    if (num >= 100) {
      str += single[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += single[num] + ' ';
    }
    return str;
  }

  let result = '';
  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  const hundred = rem;

  if (crore > 0) result += convertChunk(crore) + 'Crore ';
  if (lakh > 0) result += convertChunk(lakh) + 'Lakh ';
  if (thousand > 0) result += convertChunk(thousand) + 'Thousand ';
  if (hundred > 0) result += convertChunk(hundred);

  return `Indian Rupees ${result.trim()} Only`;
};

// Specifications and Variant Formatter Helper
export const renderItemSpecsAndSku = (item) => {
  const specs = [];
  
  if (item.sku || item.product_sku) {
    specs.push(`SKU: ${item.sku || item.product_sku}`);
  }

  if (item.product_specifications || item.specifications) {
    specs.push(item.product_specifications || item.specifications);
  }

  if (item.ram || item.storage || item.processor || item.graphics || item.color || item.size) {
    const parts = [];
    if (item.ram) parts.push(`RAM: ${item.ram}`);
    if (item.storage) parts.push(`Storage: ${item.storage}`);
    if (item.processor) parts.push(`CPU: ${item.processor}`);
    if (item.graphics) parts.push(`GPU: ${item.graphics}`);
    if (item.color) parts.push(`Color: ${item.color}`);
    if (item.size) parts.push(`Size: ${item.size}`);
    if (parts.length > 0) specs.push(parts.join(' | '));
  }

  if (item.model_number || item.model) {
    specs.push(`Model: ${item.model_number || item.model}`);
  }

  if (item.serial_number_str || item.serial_number_text || item.serial_numbers_text) {
    specs.push(`S/N: ${item.serial_number_str || item.serial_number_text || item.serial_numbers_text}`);
  }

  if (item.notes || item.description_extra) {
    specs.push(item.notes || item.description_extra);
  }

  return specs;
};

// Single A4 Copy Component
const A4SinglePageCopy = ({ copyType, invoice, company }) => {
  const items = invoice.items || [];
  const isPurchase = Boolean(
    invoice.is_purchase ||
    invoice.document_type === 'PURCHASE' ||
    (invoice.supplier_name && !invoice.customer_name)
  );

  const isNonGst = Boolean(
    invoice.is_gst === false ||
    invoice.invoice_type === 'NON_GST' ||
    (invoice.invoice_number && (invoice.invoice_number.startsWith('EST-') || invoice.invoice_number.startsWith('BILL-') || invoice.invoice_number.startsWith('NG-'))) ||
    (parseFloat(invoice.total_tax || 0) === 0 && !invoice.buyer_gstin && !invoice.customer_gstin)
  );

  const documentTitle = invoice.title || (
    isPurchase
      ? 'PURCHASE VOUCHER / STOCK RECEIPT'
      : (isNonGst ? 'ESTIMATE / CASH MEMO' : 'TAX INVOICE')
  );

  // Aggregated HSN/SAC summary
  const hsnSummary = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const code = item.hsn_sac || item.hsn_code || '852411';
      if (!map[code]) {
        const gstRate = parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : (invoice.gst_rate ?? 18));
        map[code] = {
          hsn_sac: code,
          taxable_value: 0,
          cgst_rate: (gstRate / 2).toFixed(1).replace(/\.0$/, '') + '%',
          cgst_amount: 0,
          sgst_rate: (gstRate / 2).toFixed(1).replace(/\.0$/, '') + '%',
          sgst_amount: 0,
          igst_rate: gstRate.toFixed(1).replace(/\.0$/, '') + '%',
          igst_amount: 0,
          is_interstate: invoice.is_interstate || false,
          total_tax: 0,
        };
      }
      const qty = parseFloat(item.quantity || item.qty || 1);
      const rate = isPurchase
        ? parseFloat(item.unit_cost || item.rate || item.unit_price || 0)
        : parseFloat(item.rate ?? item.unit_price ?? item.selling_price ?? item.unit_cost ?? 0);
      const disc = parseFloat(item.discount_percent || item.discount || 0);
      const lineTaxable = parseFloat(item.taxable_value ?? (qty * rate * (1 - disc / 100)));
      const gstRate = parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : (invoice.gst_rate ?? 18));
      
      const cgstAmt = parseFloat(item.cgst_amount ?? (lineTaxable * (gstRate / 200)));
      const sgstAmt = parseFloat(item.sgst_amount ?? (lineTaxable * (gstRate / 200)));
      const igstAmt = parseFloat(item.igst_amount ?? (lineTaxable * (gstRate / 100)));

      map[code].taxable_value += lineTaxable;
      map[code].cgst_amount += cgstAmt;
      map[code].sgst_amount += sgstAmt;
      map[code].igst_amount += igstAmt;
      map[code].total_tax += invoice.is_interstate ? igstAmt : (cgstAmt + sgstAmt);
    });
    return Object.values(map);
  }, [items, invoice, isPurchase]);

  // Total tax calculation
  const totalTaxable = hsnSummary.reduce((sum, h) => sum + h.taxable_value, 0);
  const totalCgst = hsnSummary.reduce((sum, h) => sum + h.cgst_amount, 0);
  const totalSgst = hsnSummary.reduce((sum, h) => sum + h.sgst_amount, 0);
  const totalIgst = hsnSummary.reduce((sum, h) => sum + h.igst_amount, 0);
  const totalTaxAmount = invoice.is_interstate ? totalIgst : (totalCgst + totalSgst);

  const grandTotal = parseFloat(invoice.grand_total ?? invoice.total_amount ?? (totalTaxable + totalTaxAmount));
  const amountPaid = parseFloat(invoice.total_paid_amount ?? invoice.amount_paid ?? invoice.paid_amount ?? 0);
  const balanceDue = parseFloat(invoice.balance_due_amount ?? invoice.balance_due ?? invoice.balance_amount ?? Math.max(0, grandTotal - amountPaid));
  const totalQuantity = items.reduce((sum, i) => sum + parseFloat(i.quantity || i.qty || 1), 0);

  const paymentStatus = invoice.payment_status || (amountPaid === 0 ? 'UNPAID' : (amountPaid >= grandTotal - 0.01 ? 'PAID' : 'PARTIALLY_PAID'));

  return (
    <div className="w-[210mm] max-w-full h-[297mm] max-h-[297mm] print:w-[210mm] print:max-w-[210mm] print:h-[295mm] print:max-h-[295mm] box-border p-[7mm] print:p-[5mm] flex flex-col justify-between overflow-hidden bg-white text-black font-sans text-[10.5px] leading-tight select-none shadow-2xl print:shadow-none print:border-none mx-auto page-break-inside-avoid">
      {/* 1. Header Title & Copy Type */}
      <div className="flex items-center justify-between pb-1 flex-shrink-0">
        <div className="w-1/4"></div>
        <h1 className="text-base font-extrabold text-center uppercase tracking-wide w-2/4 text-slate-950">
          {documentTitle}
        </h1>
        <div className="text-[10px] font-bold text-right italic uppercase w-1/4 text-slate-800">
          ({copyType})
        </div>
      </div>

      {/* Main Outer Table Box - Stretches dynamically to cover the exact A4 sheet */}
      <div className="flex-1 flex flex-col justify-between border border-black border-collapse my-0.5 min-h-0 overflow-hidden">
        {/* Top Grid: Seller + Buyer (Left) & Reference Grid (Right) */}
        <div className="grid grid-cols-2 border-b border-black flex-shrink-0">
          {/* Left Column: Seller & Buyer */}
          <div className="border-r border-black flex flex-col justify-between">
            {/* Upper Box: Vendor (for Purchase) or Company (for Sales) */}
            {!isPurchase ? (
              // Sales: Seller = Company
              <div className="p-2 space-y-0.5">
                {company.logo && (
                  <div className="pb-1">
                    <img src={company.logo} alt="Company Logo" className="h-8 max-w-[120px] object-contain" />
                  </div>
                )}
                <div className="font-extrabold text-[12px] uppercase leading-tight">{company.name}</div>
                <div className="text-[10.5px] leading-snug font-medium">{company.address_line1}</div>
                {company.address_line2 && <div className="text-[10.5px] font-medium">{company.address_line2}</div>}
                <div className="text-[10.5px] font-medium">{company.city_pincode}</div>
                {company.phone && <div className="text-[10.5px] font-medium">Ph: {company.phone}</div>}
                {company.email && <div className="text-[10.5px] font-medium">Email: {company.email}</div>}
                <div className="text-[10.5px] font-bold pt-0.5">GSTIN/UIN: {company.gstin}</div>
                <div className="text-[10.5px] font-bold">State Name: {company.state_name}, Code: {company.state_code}</div>
              </div>
            ) : (
              // Purchase: Seller = Vendor / Supplier
              <div className="p-2 space-y-0.5">
                <div className="text-[9.5px] font-bold text-slate-700 uppercase">Vendor / Supplier (Seller)</div>
                <div className="font-extrabold text-[12px] uppercase">{invoice.supplier_name || 'Vendor Supplier'}</div>
                <div className="text-[10.5px] leading-snug font-medium">{invoice.supplier_address || 'Vendor Address'}</div>
                {invoice.supplier_mobile && <div className="text-[10.5px] font-medium">Ph: {invoice.supplier_mobile}</div>}
                <div className="text-[10.5px] font-bold pt-0.5">GSTIN/UIN: {invoice.supplier_gstin || '—'}</div>
                <div className="text-[10.5px] font-bold">State Name: {invoice.supplier_state || 'Karnataka'}, Code: {invoice.supplier_state_code || '29'}</div>
              </div>
            )}

            {/* Lower Box: Buyer (Customer for Sales, Company for Purchase) */}
            {!isPurchase ? (
              // Sales: Buyer = Customer
              <div className="border-t border-black p-2 space-y-0.5 bg-slate-50/20">
                <div className="text-[10px] font-semibold text-slate-700">Buyer (Bill to)</div>
                <div className="font-extrabold text-[11.5px] uppercase">{invoice.customer_name || invoice.buyer_name || 'Cash Customer'}</div>
                <div className="text-[10.5px] leading-snug">{invoice.customer_address || invoice.buyer_address || 'Local Customer'}</div>
                {invoice.customer_mobile && <div className="text-[10.5px] font-medium">Ph: {invoice.customer_mobile}</div>}
                <div className="text-[10.5px] font-bold pt-0.5">GSTIN/UIN: {invoice.customer_gstin || invoice.buyer_gstin || '—'}</div>
                <div className="text-[10.5px] font-bold">State Name: {invoice.customer_state || 'Karnataka'}, Code: {invoice.customer_state_code || '29'}</div>
              </div>
            ) : (
              // Purchase: Buyer = Company (Store / Recipient)
              <div className="border-t border-black p-2 space-y-0.5 bg-slate-50/20">
                <div className="text-[10px] font-semibold text-slate-700">Recipient / Buyer (Store)</div>
                {company.logo && (
                  <div className="pb-1">
                    <img src={company.logo} alt="Company Logo" className="h-7 max-w-[100px] object-contain" />
                  </div>
                )}
                <div className="font-extrabold text-[11.5px] uppercase">{company.name}</div>
                <div className="text-[10.5px] leading-snug">{company.address_line1}</div>
                <div className="text-[10.5px] font-bold pt-0.5">GSTIN/UIN: {company.gstin}</div>
                <div className="text-[10.5px] font-bold">State Name: {company.state_name}, Code: {company.state_code}</div>
              </div>
            )}
          </div>

          {/* Right Column: Reference Grid */}
          <div className="text-[10.5px]">
            <div className="grid grid-cols-2 border-b border-black">
              <div className="p-1.5 border-r border-black">
                <div className="text-[9.5px] text-slate-700">{isPurchase ? 'OCTANE Purchase No.' : 'Invoice No.'}</div>
                <div className="font-extrabold text-[11px]">{invoice.invoice_number || invoice.purchase_number || invoice.number || 'INV-001'}</div>
              </div>
              <div className="p-1.5">
                <div className="text-[9.5px] text-slate-700">Dated</div>
                <div className="font-extrabold text-[11px]">{invoice.invoice_date || invoice.purchase_date || invoice.created_at || new Date().toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            {isPurchase ? (
              <>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Supplier Invoice No.</div>
                    <div className="font-bold">{invoice.supplier_invoice_number || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Payment Mode</div>
                    <div className="font-bold">{invoice.payment_mode || 'Cash'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Collected / Paid via</div>
                    <div className="font-semibold">{invoice.partner_allocation_json?.partner_name ? `Partner: ${invoice.partner_allocation_json.partner_name}` : (invoice.paid_by_partner_name || 'Company Account')}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Payment Status</div>
                    <div className="font-bold uppercase text-[10.5px]">{paymentStatus}</div>
                  </div>
                </div>
                <div className="p-1.5 min-h-[42px]">
                  <div className="text-[9.5px] text-slate-700">Notes / Remarks</div>
                  <div className="font-semibold text-[10px]">{invoice.notes || 'Vendor Stock Entry'}</div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Delivery Note</div>
                    <div className="font-semibold">{invoice.delivery_note || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Mode/Terms of Payment</div>
                    <div className="font-semibold">{invoice.payment_terms || invoice.payment_mode || 'Cash / Immediate'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Reference No. & Date.</div>
                    <div className="font-semibold">{invoice.reference_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Other References</div>
                    <div className="font-semibold">{invoice.other_references || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Buyer's Order No.</div>
                    <div className="font-semibold">{invoice.buyer_order_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Dated</div>
                    <div className="font-semibold">{invoice.buyer_order_date || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[9.5px] text-slate-700">Dispatch Doc No.</div>
                    <div className="font-semibold">{invoice.dispatch_doc_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[9.5px] text-slate-700">Dispatched through</div>
                    <div className="font-semibold">{invoice.dispatched_through || 'Hand Delivery'}</div>
                  </div>
                </div>

                <div className="p-1.5 min-h-[38px]">
                  <div className="text-[9.5px] text-slate-700">Terms of Delivery</div>
                  <div className="font-semibold text-[10px]">{invoice.terms_of_delivery || 'Goods once sold will not be taken back or exchanged.'}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 4. Item Table Section - Expands to bridge all remaining vertical space */}
        <div className="flex-1 flex flex-col border-b border-black min-h-[140px]">
          <table className="w-full border-collapse text-[10.5px] table-fixed flex-1 h-full">
            <thead>
              <tr className="border-b border-black bg-slate-50/50 text-[10px] font-bold">
                <th className="border-r border-black py-1 px-1 text-center w-[30px]">Sl<br/>No.</th>
                <th className="border-r border-black py-1 px-2 text-left">Description of Goods</th>
                <th className="border-r border-black py-1 px-1 text-center w-[70px]">HSN/SAC</th>
                <th className="border-r border-black py-1 px-1 text-right w-[60px]">Quantity</th>
                <th className="border-r border-black py-1 px-1 text-right w-[65px]">Rate</th>
                <th className="border-r border-black py-1 px-1 text-center w-[45px]">per</th>
                <th className="border-r border-black py-1 px-1 text-right w-[50px]">Disc. %</th>
                <th className="py-1 px-2 text-right w-[85px]">Amount</th>
              </tr>
            </thead>
            <tbody className="h-full">
              {items.map((item, idx) => {
                const qty = parseFloat(item.quantity || item.qty || 1);
                const rate = isPurchase
                  ? parseFloat(item.unit_cost || item.rate || item.unit_price || 0)
                  : parseFloat(item.rate ?? item.unit_price ?? item.selling_price ?? item.unit_cost ?? 0);
                const disc = parseFloat(item.discount_percent || item.discount || 0);
                const lineAmount = parseFloat(item.taxable_value ?? item.amount ?? item.line_total ?? (qty * rate * (1 - disc / 100)));
                const specs = renderItemSpecsAndSku(item);

                return (
                  <tr key={idx} className="align-top page-break-inside-avoid">
                    <td className="border-r border-black py-1.5 px-1 text-center font-semibold">{idx + 1}</td>
                    <td className="border-r border-black py-1.5 px-2">
                      <div className="font-extrabold uppercase">{item.product_name || item.description || 'Product Item'}</div>
                      {specs.length > 0 && (
                        <div className="text-[9px] italic font-normal text-slate-800 space-y-0.5 mt-0.5 pl-1">
                          {specs.map((s, i) => (
                            <div key={i}>{s}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="border-r border-black py-1.5 px-1 text-center font-mono">{item.hsn_sac || item.hsn_code || '852411'}</td>
                    <td className="border-r border-black py-1.5 px-1 text-right font-bold font-mono">{qty} {item.unit || 'NOS.'}</td>
                    <td className="border-r border-black py-1.5 px-1 text-right font-mono whitespace-nowrap">{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black py-1.5 px-1 text-center font-mono uppercase">{item.unit || 'NOS.'}</td>
                    <td className="border-r border-black py-1.5 px-1 text-right font-mono">{disc > 0 ? `${disc}%` : ''}</td>
                    <td className="py-1.5 px-2 text-right font-bold font-mono whitespace-nowrap">{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}

              {/* Tax Breakdown Lines inside Item Table (Only if GST invoice with tax) */}
              {!isNonGst && totalTaxAmount > 0 && (
                !invoice.is_interstate ? (
                  <>
                    <tr className="align-top">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black py-0.5 px-2 font-bold italic text-right pr-6">CGST OUTPUT</td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="py-0.5 px-2 text-right font-bold font-mono whitespace-nowrap">{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black py-0.5 px-2 font-bold italic text-right pr-6">SGST OUTPUT</td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="py-0.5 px-2 text-right font-bold font-mono whitespace-nowrap">{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </>
                ) : (
                  <tr className="align-top">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black py-0.5 px-2 font-bold italic text-right pr-6">IGST OUTPUT</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="py-0.5 px-2 text-right font-bold font-mono whitespace-nowrap">{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )
              )}

              {/* Dynamic expanding spacer row that fills remaining vertical space */}
              <tr className="h-full" style={{ height: '100%' }}>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            </tbody>

            {/* Item Table Total Row - always pinned at the bottom of the items section */}
            <tfoot className="border-t border-black bg-slate-50/40 font-extrabold text-[10.5px]">
              <tr>
                <td className="border-r border-black w-[30px]"></td>
                <td className="border-r border-black py-1.5 px-2 text-right">Total</td>
                <td className="border-r border-black w-[70px]"></td>
                <td className="border-r border-black py-1.5 px-1 text-right font-mono w-[60px]">{totalQuantity} {items[0]?.unit || 'NOS.'}</td>
                <td className="border-r border-black w-[65px]"></td>
                <td className="border-r border-black w-[45px]"></td>
                <td className="border-r border-black w-[50px]"></td>
                <td className="py-1.5 px-1 text-right font-mono font-bold text-[11px] w-[85px] whitespace-nowrap">₹&nbsp;{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Section: Summary, Declarations, Signatures */}
        <div className="flex-shrink-0">
          {/* 5. Amount Chargeable in Words */}
          <div className="border-b border-black p-1.5 flex items-center justify-between text-[10.5px]">
            <div>
              <span className="text-[9.5px] text-slate-700 block">Amount Chargeable (in words)</span>
              <span className="font-extrabold text-[11px] block">{numberToWordsRupees(grandTotal)}</span>
            </div>
            <div className="font-bold italic text-[10px]">E. & O.E</div>
          </div>

          {/* 6. HSN/SAC Tax Summary Table & Tax Amount in Words (GST Invoices Only) */}
          {!isNonGst && totalTaxAmount > 0 && (
            <>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-black bg-slate-50/50 font-bold">
                    <th className="border-r border-black py-0.5 px-1 text-left" rowSpan={2}>HSN/SAC</th>
                    <th className="border-r border-black py-0.5 px-1 text-right" rowSpan={2}>Taxable<br/>Value</th>
                    {!invoice.is_interstate ? (
                      <>
                        <th className="border-r border-black py-0.5 px-1 text-center" colSpan={2}>CGST</th>
                        <th className="border-r border-black py-0.5 px-1 text-center" colSpan={2}>SGST/UTGST</th>
                      </>
                    ) : (
                      <th className="border-r border-black py-0.5 px-1 text-center" colSpan={2}>IGST</th>
                    )}
                    <th className="py-0.5 px-1 text-right" rowSpan={2}>Total<br/>Tax Amount</th>
                  </tr>
                  <tr className="border-b border-black bg-slate-50/50 font-bold text-[9px]">
                    {!invoice.is_interstate ? (
                      <>
                        <th className="border-r border-black py-0.5 px-1 text-center w-[40px]">Rate</th>
                        <th className="border-r border-black py-0.5 px-1 text-right w-[65px]">Amount</th>
                        <th className="border-r border-black py-0.5 px-1 text-center w-[40px]">Rate</th>
                        <th className="border-r border-black py-0.5 px-1 text-right w-[65px]">Amount</th>
                      </>
                    ) : (
                      <>
                        <th className="border-r border-black py-0.5 px-1 text-center w-[50px]">Rate</th>
                        <th className="border-r border-black py-0.5 px-1 text-right w-[90px]">Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map((h, i) => (
                    <tr key={i} className="border-b border-black font-mono">
                      <td className="border-r border-black py-0.5 px-1 font-bold">{h.hsn_sac}</td>
                      <td className="border-r border-black py-0.5 px-1 text-right">{h.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      {!invoice.is_interstate ? (
                        <>
                          <td className="border-r border-black py-0.5 px-1 text-center">{h.cgst_rate}</td>
                          <td className="border-r border-black py-0.5 px-1 text-right">{h.cgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="border-r border-black py-0.5 px-1 text-center">{h.sgst_rate}</td>
                          <td className="border-r border-black py-0.5 px-1 text-right">{h.sgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-black py-0.5 px-1 text-center">{h.igst_rate}</td>
                          <td className="border-r border-black py-0.5 px-1 text-right">{h.igst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </>
                      )}
                      <td className="py-0.5 px-1 text-right font-bold">{h.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {/* HSN Summary Total Row */}
                  <tr className="font-extrabold font-mono border-b border-black bg-slate-50/30">
                    <td className="border-r border-black py-0.5 px-1 text-right font-sans">Total</td>
                    <td className="border-r border-black py-0.5 px-1 text-right">{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    {!invoice.is_interstate ? (
                      <>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-0.5 px-1 text-right">{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-0.5 px-1 text-right">{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    ) : (
                      <>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-0.5 px-1 text-right">{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    )}
                    <td className="py-0.5 px-1 text-right">{totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              {/* 7. Tax Amount in Words */}
              <div className="border-b border-black p-1 text-[10px]">
                <span className="font-normal text-slate-800">Tax Amount (in words) : </span>
                <span className="font-extrabold">{numberToWordsRupees(totalTaxAmount)}</span>
              </div>
            </>
          )}

          {/* 8. Declaration & Bank Details */}
          <div className="grid grid-cols-2 border-b border-black text-[10px]">
            {/* Declaration */}
            <div className="border-r border-black p-1.5 space-y-1">
              <div className="font-bold underline text-[9.5px]">Declaration</div>
              <p className="text-[9px] leading-tight text-slate-800">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
            </div>

            {/* Bank Details */}
            <div className="p-1.5 space-y-0.5 text-[9.5px]">
              <div className="font-bold underline">Company's Bank Details</div>
              <div><span className="font-semibold text-slate-700">Bank Name: </span><span className="font-bold">{company.bank_name}</span></div>
              <div><span className="font-semibold text-slate-700">A/c No.: </span><span className="font-bold">{company.bank_account}</span></div>
              <div><span className="font-semibold text-slate-700">Branch & IFS Code: </span><span className="font-bold">{company.bank_ifsc}</span></div>
            </div>
          </div>

          {/* 10. Signatures Grid */}
          <div className="grid grid-cols-2 text-[10px] min-h-[48px] items-end p-1.5">
            <div className="font-bold text-slate-800">Customer's / Vendor's Seal and Signature</div>
            <div className="text-right space-y-4">
              <div className="font-bold text-slate-900">for {company.name}</div>
              <div className="font-bold text-slate-800">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>

      {/* 11. Jurisdiction & Computer Generated Footer */}
      <div className="flex-shrink-0 pt-0.5 text-center text-[9px] font-bold space-y-0.2">
        <div>SUBJECT TO {company.city ? company.city.toUpperCase() : 'BENGALURU'} JURISDICTION</div>
        <div className="font-normal italic text-slate-600">This is a Computer Generated Document</div>
      </div>
    </div>
  );
};

// Main Printable Modal Wrapper Component
export const A4InvoicePrintModal = ({
  isOpen,
  onClose,
  invoiceData,
  companyData,
  autoPrint = false,
  defaultCopies = 'SINGLE',
}) => {
  const [printCopies, setPrintCopies] = useState(defaultCopies); // 'SINGLE' (1 bill) or 'BOTH' (2 copies)
  const [businessProfile, setBusinessProfile] = useState(null);
  const [viewMode, setViewMode] = useState('fit'); // 'fit' or 'actual'
  const [scale, setScale] = useState(0.72);
  const { businessProfile: globalProfile } = useBusinessProfile();

  useEffect(() => {
    if (isOpen) {
      api.getBusinessProfile()
        .then((data) => {
          if (data) setBusinessProfile(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      // Calculate fit scale so entire A4 page (1123px) fits inside screen viewport
      const availH = window.innerHeight - 100;
      const fit = Math.min(1, Math.max(0.48, availH / 1125));
      setScale(fit);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setPrintCopies(defaultCopies);
      if (autoPrint) {
        const timer = setTimeout(() => {
          window.print();
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoPrint, defaultCopies]);

  // Listen for browser print events (e.g. user pressing Ctrl+P or clicking Print)
  // to ensure zoom scale is completely removed from the DOM before rendering print output
  useEffect(() => {
    const handleBeforePrint = () => {
      setViewMode('actual');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  if (!isOpen || !invoiceData) return null;

  const activeProfile = businessProfile || globalProfile;

  // Live Company Info from Business Profile (Overrideable via companyData prop)
  const company = {
    name: activeProfile?.company_name || 'MATRIX INFOTECH',
    address_line1: activeProfile?.address_line1 || '99, 2ND FLOOR , SRI CHODESWARI COMPLEX',
    address_line2: activeProfile?.address_line2 || 'BEHIND SHARDA TALKIES , S.P.ROAD',
    city_pincode: activeProfile?.city ? `${activeProfile.city} ${activeProfile.pincode || ''}`.trim() : 'BANGALORE 02',
    city: activeProfile?.city || 'BANGALORE',
    phone: activeProfile?.phone || '080-41623454 / 5 / 6',
    extra_info: 'COSMIC : 3278 / CENTRIX 4674 / 8493',
    email: activeProfile?.email || 'Matrix.Stock2015@gmail.Com',
    gstin: activeProfile?.gstin || '29ACBFM5112C1ZO',
    state_name: activeProfile?.state_name || 'Karnataka',
    state_code: activeProfile?.state_code || '29',
    contact_email: activeProfile?.email || 'MATRIX.VINIT@GMAIL.COM',
    bank_name: activeProfile?.bank_name || 'KOTAK BANK (3149366297) NEW',
    bank_account: activeProfile?.account_number || '3149366297',
    bank_ifsc: activeProfile?.ifsc_code || '-VV PURUM & KKBK0008055',
    logo: activeProfile?.logo_url || companyData?.logo || companyData?.logo_url,
    ...companyData,
  };

  if (!company.logo && (activeProfile?.logo_url || companyData?.logo_url)) {
    company.logo = activeProfile?.logo_url || companyData?.logo_url;
  }

  const isPurchase = Boolean(
    invoiceData.is_purchase ||
    invoiceData.document_type === 'PURCHASE' ||
    (invoiceData.supplier_name && !invoiceData.customer_name)
  );

  const primaryCopyLabel = isPurchase ? 'SUPPLIER COPY' : 'ORIGINAL FOR RECIPIENT';
  const secondaryCopyLabel = isPurchase ? 'OFFICE RECORD COPY' : 'DUPLICATE FOR TRANSPORTER';

  const handlePrint = () => {
    setViewMode('actual');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return createPortal(
    <div
      id="a4-print-modal-portal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex flex-col items-center print:static print:bg-white print:overflow-visible print:p-0 print:m-0 print:block"
    >
      {/* Top Action Header Bar (No Print) */}
      <div className="sticky top-0 z-50 w-full flex flex-wrap items-center justify-between gap-3 no-print bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 border-b border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
            <FileText size={17} />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Tax Invoice Print Preview</span>
              <span className="text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                A4 Sheet (210 × 297 mm)
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Guaranteed exact full-sheet fit • 1 single page
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Zoom view toggle */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'fit' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Fit whole A4 sheet on screen"
            >
              <Maximize2 size={13} />
              <span>Fit Page</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('actual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'actual' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="100% Actual Print Size"
            >
              <Eye size={13} />
              <span>100% Size</span>
            </button>
          </div>

          {/* Copy Selector */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setPrintCopies('SINGLE')}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                printCopies === 'SINGLE' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Single (1 Page)
            </button>
            <button
              onClick={() => setPrintCopies('BOTH')}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                printCopies === 'BOTH' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Original + Duplicate
            </button>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-600/30 transition-all cursor-pointer"
          >
            <Printer size={15} />
            <span>Print A4 Invoice</span>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Printable Area Container with Zoom Scaling */}
      <div className="w-full flex justify-center py-6 px-2 overflow-x-auto print:p-0 print:m-0 print:overflow-visible print:block print:w-full">
        <div
          id="a4-invoice-print-area"
          style={
            viewMode === 'fit'
              ? {
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                  marginBottom: `-${1123 * (1 - scale)}px`,
                }
              : {}
          }
          className="transition-transform duration-200 print:transform-none print:m-0"
        >
          {/* Page 1: Primary Copy */}
          <div className={printCopies === 'BOTH' ? 'page-break' : ''}>
            <A4SinglePageCopy
              copyType={primaryCopyLabel}
              invoice={invoiceData}
              company={company}
            />
          </div>

          {/* Page 2: Secondary Copy (Only if 2 Copies selected) */}
          {printCopies === 'BOTH' && (
            <div className="mt-8 print:mt-0">
              <A4SinglePageCopy
                copyType={secondaryCopyLabel}
                invoice={invoiceData}
                company={company}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default A4InvoicePrintModal;

