import React, { useMemo } from 'react';
import octaneLogo from '../../assets/octane_logo.png';
import octaneSeal from '../../assets/octane_seal.png';

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

// Helper function to format date as DD/MM/YYYY (Day/Month/Year)
export const formatDateDMY = (dateVal) => {
  if (!dateVal) return '—';
  const str = String(dateVal).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return str;
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

  if (item.warranty) {
    const cleanWarranty = String(item.warranty).replace(/^warranty\s*:\s*/i, '').trim();
    if (cleanWarranty) {
      specs.push(cleanWarranty);
    }
  }

  if (item.notes || item.description_extra) {
    specs.push(item.notes || item.description_extra);
  }

  return specs;
};

// Single A4 Copy Component
export const A4SinglePageCopy = ({ copyType, invoice, company = {} }) => {
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

  const isCancelled = Boolean(
    invoice.invoice_status === 'CANCELLED' ||
    (typeof invoice.notes === 'string' && invoice.notes.startsWith('[CANCELLED'))
  );

  const documentTitle = invoice.title || (
    isPurchase
      ? (isCancelled ? 'PURCHASE INVOICE (CANCELLED / VOID)' : 'PURCHASE INVOICE')
      : (isCancelled ? (isNonGst ? 'INVOICE (CANCELLED / VOID)' : 'TAX INVOICE (CANCELLED / VOID)') : (isNonGst ? 'INVOICE' : 'TAX INVOICE'))
  );

  const effectiveCompany = {
    name: company.name || company.company_name || 'OCTANE SYSTEM',
    address_line1: company.address_line1 || 'No.101, 2nd Floor, 14th Cross, 20th B Main',
    address_line2: company.address_line2 || 'Venkateshwara Layout, Maruthinagar, BTM Layout',
    city_pincode: company.city_pincode || (company.city ? `${company.city} ${company.pincode || ''}`.trim() : 'Bengaluru 560068'),
    city: company.city || 'Bengaluru',
    phone: company.phone || '7338515910',
    extra_info: company.extra_info || 'COSMIC : 3278 / CENTRIX 4674 / 8493',
    email: company.email || 'Matrix.Stock2015@gmail.Com',
    gstin: company.gstin || '29ACBFM5112C1ZO',
    state_name: company.state_name || 'Karnataka',
    state_code: company.state_code || '29',
    contact_email: company.contact_email || company.email || 'MATRIX.VINIT@GMAIL.COM',
    bank_name: company.bank_name || 'KOTAK BANK (3149366297) NEW',
    bank_account: company.bank_account || company.account_number || '3149366297',
    bank_ifsc: company.bank_ifsc || company.ifsc_code || '-VV PURUM & KKBK0008055',
    logo: company.logo || company.logo_url || octaneLogo,
    seal: company.seal || company.seal_url || octaneSeal,
    ...company,
  };

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
    <div className="a4-sheet-page-wrapper relative w-[210mm] max-w-full h-[297mm] max-h-[297mm] print:w-[210mm] print:max-w-[210mm] print:h-[295mm] print:max-h-[295mm] box-border p-[6mm] print:p-[4mm] flex flex-col justify-between overflow-hidden bg-white text-black font-sans text-[11.5px] leading-tight select-none shadow-2xl print:shadow-none print:border-none mx-auto page-break-inside-avoid">
      {isCancelled && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50 overflow-hidden">
          <div className="border-[6px] border-rose-600/35 text-rose-600/35 text-5xl font-black uppercase tracking-widest px-10 py-3 rotate-[-30deg] select-none">
            CANCELLED / VOID
          </div>
        </div>
      )}
      {/* 1. Header Title & Copy Type */}
      <div className="flex items-center justify-between pb-1 flex-shrink-0">
        <div className="w-1/4">
          {isCancelled && (
            <span className="bg-rose-100 text-rose-800 text-[10px] font-mono font-black px-2 py-0.5 rounded border border-rose-300">
              DOCUMENT VOIDED
            </span>
          )}
        </div>
        <h1 className={`text-lg font-black text-center uppercase tracking-wider w-2/4 ${isCancelled ? 'text-rose-700' : 'text-black'}`}>
          {documentTitle}
        </h1>
        <div className="text-[11px] font-bold text-right italic uppercase w-1/4 text-black">
          ({copyType})
        </div>
      </div>

      {/* Main Outer Table Box - Stretches dynamically to cover the exact A4 sheet */}
      <div className="flex-1 flex flex-col justify-between border-[1.5px] border-black border-collapse my-0.5 min-h-0 overflow-hidden text-black">
        {/* Top Grid: Seller + Buyer (Left) & Reference Grid (Right) */}
        <div className="grid grid-cols-2 border-b-[1.5px] border-black flex-shrink-0">
          {/* Left Column: Seller & Buyer */}
          <div className="border-r-[1.5px] border-black flex flex-col justify-between">
            {/* Upper Box: Vendor (for Purchase) or Company (for Sales) */}
            {!isPurchase ? (
              // Sales: Seller = Company
              <div className="p-2.5 space-y-0.5 text-black">
                <div className="flex items-center gap-2 pb-1 leading-none">
                  <img
                    src={octaneLogo}
                    alt="Octane Systems Official Logo"
                    className="h-8 w-8 object-contain shrink-0"
                  />
                  <div className="font-black text-[14px] uppercase tracking-wide leading-none text-black">
                    {effectiveCompany.name || 'OCTANE SYSTEM'}
                  </div>
                </div>
                <div className="text-[11.5px] leading-snug font-semibold text-black">{effectiveCompany.address_line1}</div>
                {effectiveCompany.address_line2 && <div className="text-[11.5px] font-semibold text-black">{effectiveCompany.address_line2}</div>}
                <div className="text-[11.5px] font-semibold text-black">{effectiveCompany.city_pincode}</div>
                {effectiveCompany.phone && <div className="text-[11.5px] font-semibold text-black">Ph: {effectiveCompany.phone}</div>}
                {effectiveCompany.email && <div className="text-[11.5px] font-semibold text-black">Email: {effectiveCompany.email}</div>}
                <div className="text-[11.5px] font-black pt-1 text-black">GSTIN/UIN: {effectiveCompany.gstin}</div>
                <div className="text-[11.5px] font-black text-black">State Name: {effectiveCompany.state_name}, Code: {effectiveCompany.state_code}</div>
              </div>
            ) : (
              // Purchase: Seller = Vendor / Supplier
              <div className="p-2.5 space-y-0.5 text-black">
                <div className="text-[10.5px] font-bold text-black uppercase">Vendor / Supplier (Seller)</div>
                <div className="font-black text-[13.5px] uppercase text-black">{invoice.supplier_name || 'Vendor Supplier'}</div>
                <div className="text-[11.5px] leading-snug font-semibold text-black">{invoice.supplier_address || 'Vendor Address'}</div>
                {invoice.supplier_mobile && <div className="text-[11.5px] font-semibold text-black">Ph: {invoice.supplier_mobile}</div>}
                <div className="text-[11.5px] font-black pt-1 text-black">GSTIN/UIN: {invoice.supplier_gstin || '—'}</div>
                <div className="text-[11.5px] font-black text-black">State Name: {invoice.supplier_state || 'Karnataka'}, Code: {invoice.supplier_state_code || '29'}</div>
              </div>
            )}

            {/* Lower Box: Buyer (Customer for Sales, Company for Purchase) */}
            {!isPurchase ? (
              // Sales: Buyer = Customer
              <div className="border-t-[1.5px] border-black p-2.5 space-y-0.5 text-black">
                <div className="text-[10.5px] font-bold text-black uppercase">Buyer (Bill to)</div>
                <div className="font-black text-[13px] uppercase text-black">{invoice.customer_name || invoice.buyer_name || 'Cash Customer'}</div>
                <div className="text-[11.5px] leading-snug font-semibold text-black">{invoice.customer_address || invoice.buyer_address || 'Local Customer'}</div>
                {invoice.customer_mobile && <div className="text-[11.5px] font-semibold text-black">Ph: {invoice.customer_mobile}</div>}
                <div className="text-[11.5px] font-black pt-1 text-black">GSTIN/UIN: {invoice.customer_gstin || invoice.buyer_gstin || '—'}</div>
                <div className="text-[11.5px] font-black text-black">State Name: {invoice.customer_state || effectiveCompany.state_name || 'Karnataka'}, Code: {invoice.customer_state_code || effectiveCompany.state_code || '29'}</div>
              </div>
            ) : (
              // Purchase: Buyer = Company (Store / Recipient)
              <div className="border-t-[1.5px] border-black p-2.5 space-y-0.5 text-black">
                <div className="text-[10.5px] font-bold text-black uppercase">Recipient / Buyer (Store)</div>
                <div className="flex items-center gap-2 pb-1 leading-none">
                  <img
                    src={octaneLogo}
                    alt="Octane Systems Official Logo"
                    className="h-8 w-8 object-contain shrink-0"
                  />
                  <div className="font-black text-[13px] uppercase leading-none text-black">
                    {effectiveCompany.name || 'OCTANE SYSTEM'}
                  </div>
                </div>
                <div className="text-[11.5px] leading-snug font-semibold text-black">{effectiveCompany.address_line1}</div>
                <div className="text-[11.5px] font-black pt-1 text-black">GSTIN/UIN: {effectiveCompany.gstin}</div>
                <div className="text-[11.5px] font-black text-black">State Name: {effectiveCompany.state_name}, Code: {effectiveCompany.state_code}</div>
              </div>
            )}
          </div>

          {/* Right Column: Reference Grid */}
          <div className="text-[11.5px] text-black">
            <div className="grid grid-cols-2 border-b-[1.5px] border-black">
              <div className="p-2 border-r-[1.5px] border-black">
                <div className="text-[10px] font-bold text-black uppercase tracking-wider">{isPurchase ? 'OCTANE Purchase No.' : 'Invoice No.'}</div>
                <div className="font-black text-[13px] font-mono text-black">{invoice.invoice_number || invoice.purchase_number || invoice.number || 'INV-001'}</div>
              </div>
              <div className="p-2">
                <div className="text-[10px] font-bold text-black uppercase tracking-wider">Dated</div>
                <div className="font-black text-[13px] font-mono text-black">{formatDateDMY(invoice.invoice_date || invoice.purchase_date || invoice.created_at || new Date())}</div>
              </div>
            </div>

            {isPurchase ? (
              <>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Supplier Invoice No.</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.supplier_invoice_number || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Payment Mode</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.payment_mode || 'Cash'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Collected / Paid via</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.partner_allocation_json?.partner_name ? `Partner: ${invoice.partner_allocation_json.partner_name}` : (invoice.paid_by_partner_name || 'Company Account')}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Payment Status</div>
                    <div className="font-black uppercase text-[11.5px] text-black">{paymentStatus}</div>
                  </div>
                </div>
                <div className="p-1.5 min-h-[38px] max-h-[58px] overflow-hidden flex flex-col justify-start">
                  <div className="text-[10px] font-bold text-black uppercase leading-none mb-1">Notes / Remarks</div>
                  <div className="font-semibold text-[10.5px] text-black break-words leading-tight whitespace-pre-wrap">{invoice.notes || 'Vendor Stock Entry'}</div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Delivery Note</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.delivery_note || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Mode/Terms of Payment</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.payment_terms || invoice.payment_mode || 'Cash / Immediate'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Reference No. & Date.</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.reference_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Other References</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.other_references || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Buyer's Order No.</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.buyer_order_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Dated</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.buyer_order_date ? formatDateDMY(invoice.buyer_order_date) : '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-1.5 border-r border-black">
                    <div className="text-[10px] font-bold text-black uppercase">Dispatch Doc No.</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.dispatch_doc_no || '—'}</div>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-black uppercase">Dispatched through</div>
                    <div className="font-bold text-[11.5px] text-black">{invoice.dispatched_through || 'Hand Delivery'}</div>
                  </div>
                </div>

                <div className="p-1.5 min-h-[38px]">
                  <div className="text-[10px] font-bold text-black uppercase">Terms of Delivery</div>
                  <div className="font-bold text-[10.5px] text-black leading-snug">{invoice.terms_of_delivery || 'Goods once sold will not be taken back or exchanged.'}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 4. Item Table Section - Expands to bridge all remaining vertical space */}
        <div className="flex-1 flex flex-col border-b-[1.5px] border-black min-h-[140px] text-black">
          <table className="w-full border-collapse text-[11.5px] table-fixed flex-1 h-full text-black">
            <thead>
              <tr className="border-b-[1.5px] border-black bg-black/5 text-[11px] font-black text-black uppercase tracking-normal">
                <th className="border-r border-black py-1.5 px-1 text-center w-[35px] font-black">Sl<br/>No.</th>
                <th className="border-r border-black py-1.5 px-2 text-left font-black">Description of Goods</th>
                <th className="border-r border-black py-1.5 px-1 text-center w-[68px] font-black">HSN/SAC</th>
                <th className="border-r border-black py-1.5 px-2 text-center w-[78px] font-black">Quantity</th>
                <th className="border-r border-black py-1.5 px-2 text-right w-[80px] font-black">Rate</th>
                <th className="border-r border-black py-1.5 px-1 text-center w-[40px] font-black">per</th>
                <th className="border-r border-black py-1.5 px-1 text-right w-[46px] font-black">Disc. %</th>
                <th className="py-1.5 px-2 text-right w-[95px] font-black">Amount</th>
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
                  <tr key={idx} className="align-top page-break-inside-avoid text-black text-[11.5px]">
                    <td className="border-r border-black py-2 px-1 text-center font-bold">{idx + 1}</td>
                    <td className="border-r border-black py-2 px-2">
                      <div className="font-black text-[12px] uppercase text-black">{item.product_name || item.description || 'Product Item'}</div>
                      {specs.length > 0 && (
                        <div className="text-[10px] font-semibold text-black space-y-0.5 mt-0.5 pl-1">
                          {specs.map((s, i) => (
                            <div key={i}>{s}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="border-r border-black py-2 px-1 text-center font-bold font-mono text-[11.5px] text-black">{item.hsn_sac || item.hsn_code || '852411'}</td>
                    <td className="border-r border-black py-2 px-2 text-right font-black font-mono text-[11.5px] text-black whitespace-nowrap">{qty} {item.unit || 'NOS.'}</td>
                    <td className="border-r border-black py-2 px-2 text-right font-bold font-mono text-[11.5px] whitespace-nowrap text-black">{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black py-2 px-1 text-center font-bold font-mono text-[11px] uppercase text-black">{item.unit || 'NOS.'}</td>
                    <td className="border-r border-black py-2 px-1 text-right font-bold font-mono text-[11.5px] text-black">{disc > 0 ? `${disc}%` : ''}</td>
                    <td className="py-2 px-2 text-right font-black font-mono text-[12px] whitespace-nowrap text-black">{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}

              {/* Tax Breakdown Lines inside Item Table (Only if GST invoice with tax) */}
              {!isNonGst && totalTaxAmount > 0 && (
                !invoice.is_interstate ? (
                  <>
                    <tr className="align-top text-black text-[11.5px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black py-1 px-2 font-black italic text-right pr-6 text-black">CGST OUTPUT</td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="py-1 px-2 text-right font-black font-mono text-[12px] whitespace-nowrap text-black">{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="align-top text-black text-[11.5px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black py-1 px-2 font-black italic text-right pr-6 text-black">SGST OUTPUT</td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="py-1 px-2 text-right font-black font-mono text-[12px] whitespace-nowrap text-black">{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </>
                ) : (
                  <tr className="align-top text-black text-[11.5px]">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black py-1 px-2 font-black italic text-right pr-6 text-black">IGST OUTPUT</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="py-1 px-2 text-right font-black font-mono text-[12px] whitespace-nowrap text-black">{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
            <tfoot className="border-t-[1.5px] border-black bg-black/5 font-black text-[12px] text-black">
              <tr>
                <td className="border-r border-black w-[35px]"></td>
                <td className="border-r border-black py-2 px-2 text-right font-black uppercase text-[12px]">Total</td>
                <td className="border-r border-black w-[68px]"></td>
                <td className="border-r border-black py-2 px-2 text-right font-black font-mono text-[12px] w-[78px] text-black whitespace-nowrap">{totalQuantity} {items[0]?.unit || 'NOS.'}</td>
                <td className="border-r border-black w-[80px]"></td>
                <td className="border-r border-black w-[40px]"></td>
                <td className="border-r border-black w-[46px]"></td>
                <td className="py-2 px-2 text-right font-mono font-black text-[13px] w-[95px] whitespace-nowrap text-black">₹&nbsp;{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Section: Summary, Declarations, Signatures */}
        <div className="flex-shrink-0 text-black">
          {/* 5. Amount Chargeable in Words */}
          <div className="border-b-[1.5px] border-black p-2 flex items-center justify-between text-black">
            <div>
              <span className="text-[10px] font-bold text-black uppercase tracking-wider block">Amount Chargeable (in words)</span>
              <span className="font-black text-[12.5px] text-black block">{numberToWordsRupees(grandTotal)}</span>
            </div>
            <div className="font-black italic text-[11px] text-black">E. & O.E</div>
          </div>

          {/* 6. HSN/SAC Tax Summary Table & Tax Amount in Words (GST Invoices Only) */}
          {!isNonGst && totalTaxAmount > 0 && (
            <>
              <table className="w-full border-collapse text-[11px] text-black">
                <thead>
                  <tr className="border-b-[1.5px] border-black bg-black/5 font-black text-black uppercase">
                    <th className="border-r border-black py-1 px-1.5 text-left" rowSpan={2}>HSN/SAC</th>
                    <th className="border-r border-black py-1 px-1.5 text-right" rowSpan={2}>Taxable<br/>Value</th>
                    {!invoice.is_interstate ? (
                      <>
                        <th className="border-r border-black py-1 px-1 text-center" colSpan={2}>CGST</th>
                        <th className="border-r border-black py-1 px-1 text-center" colSpan={2}>SGST/UTGST</th>
                      </>
                    ) : (
                      <th className="border-r border-black py-1 px-1 text-center" colSpan={2}>IGST</th>
                    )}
                    <th className="py-1 px-1.5 text-right" rowSpan={2}>Total<br/>Tax Amount</th>
                  </tr>
                  <tr className="border-b border-black bg-black/5 font-black text-[10px] text-black uppercase">
                    {!invoice.is_interstate ? (
                      <>
                        <th className="border-r border-black py-1 px-1 text-center w-[45px]">Rate</th>
                        <th className="border-r border-black py-1 px-1 text-right w-[70px]">Amount</th>
                        <th className="border-r border-black py-1 px-1 text-center w-[45px]">Rate</th>
                        <th className="border-r border-black py-1 px-1 text-right w-[70px]">Amount</th>
                      </>
                    ) : (
                      <>
                        <th className="border-r border-black py-1 px-1 text-center w-[55px]">Rate</th>
                        <th className="border-r border-black py-1 px-1 text-right w-[95px]">Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map((h, i) => (
                    <tr key={i} className="border-b border-black font-mono font-bold text-black text-[11px]">
                      <td className="border-r border-black py-1 px-1.5 font-black">{h.hsn_sac}</td>
                      <td className="border-r border-black py-1 px-1.5 text-right">{h.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      {!invoice.is_interstate ? (
                        <>
                          <td className="border-r border-black py-1 px-1 text-center">{h.cgst_rate}</td>
                          <td className="border-r border-black py-1 px-1 text-right">{h.cgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="border-r border-black py-1 px-1 text-center">{h.sgst_rate}</td>
                          <td className="border-r border-black py-1 px-1 text-right">{h.sgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-black py-1 px-1 text-center">{h.igst_rate}</td>
                          <td className="border-r border-black py-1 px-1 text-right">{h.igst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </>
                      )}
                      <td className="py-1 px-1.5 text-right font-black">{h.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {/* HSN Summary Total Row */}
                  <tr className="font-black font-mono border-b-[1.5px] border-black bg-black/5 text-[11.5px] text-black">
                    <td className="border-r border-black py-1 px-1.5 text-right font-sans uppercase">Total</td>
                    <td className="border-r border-black py-1 px-1.5 text-right">{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    {!invoice.is_interstate ? (
                      <>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-1 px-1 text-right">{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-1 px-1 text-right">{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    ) : (
                      <>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black py-1 px-1 text-right">{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    )}
                    <td className="py-1 px-1.5 text-right font-black">{totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              {/* 7. Tax Amount in Words */}
              <div className="border-b-[1.5px] border-black p-1.5 text-black">
                <span className="font-bold text-[10.5px] text-black uppercase">Tax Amount (in words) : </span>
                <span className="font-black text-[12px] text-black">{numberToWordsRupees(totalTaxAmount)}</span>
              </div>
            </>
          )}

          {/* 8. Declaration & Bank Details */}
          <div className="grid grid-cols-2 border-b-[1.5px] border-black text-black">
            {/* Declaration */}
            <div className="border-r-[1.5px] border-black p-2 space-y-1">
              <div className="font-black underline text-[10.5px] uppercase tracking-wider text-black">Declaration</div>
              <p className="text-[10px] leading-snug font-semibold text-black">
                {isPurchase
                  ? 'We declare that this purchase invoice shows the actual price of the goods received and that all particulars are true and correct.'
                  : 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
              </p>
            </div>

            {/* Bank Details */}
            <div className="p-2 space-y-0.5 text-[10.5px] text-black">
              <div className="font-black underline uppercase tracking-wider text-black">Company's Bank Details</div>
              <div><span className="font-bold text-black">Bank Name: </span><span className="font-black text-black">{effectiveCompany.bank_name}</span></div>
              <div><span className="font-bold text-black">A/c No.: </span><span className="font-black text-black">{effectiveCompany.bank_account}</span></div>
              <div><span className="font-bold text-black">Branch & IFS Code: </span><span className="font-black text-black">{effectiveCompany.bank_ifsc}</span></div>
            </div>
          </div>

          {/* 10. Signatures Grid */}
          <div className="grid grid-cols-2 text-black min-h-[85px] items-end p-2 relative">
            <div className="font-bold text-[11px] text-black pb-1">Customer's / Vendor's Seal and Signature</div>
            <div className="flex flex-col items-end text-right">
              <div className="font-black text-[12px] text-black leading-tight mb-1">for {effectiveCompany.name || 'OCTANE System'}</div>
              <img
                src={effectiveCompany.seal || octaneSeal}
                alt="Octane Systems Official Seal"
                className="h-[65px] w-[65px] object-contain my-1 mix-blend-multiply"
              />
              <div className="font-bold text-[11px] text-black">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>

      {/* 11. Jurisdiction & Computer Generated Footer */}
      <div className="flex-shrink-0 pt-1 text-center text-[10px] font-bold text-black space-y-0.5">
        <div>SUBJECT TO {effectiveCompany.city ? effectiveCompany.city.toUpperCase() : 'BENGALURU'} JURISDICTION</div>
        <div className="font-semibold italic text-black">This is a Computer Generated Document</div>
      </div>
    </div>
  );
};

export default A4SinglePageCopy;

