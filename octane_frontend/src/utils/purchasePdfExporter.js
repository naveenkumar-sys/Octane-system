import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import octaneLogo from '../assets/octane_logo.png';
import octaneSeal from '../assets/octane_seal.png';
import { numberToWordsRupees, formatDateDMY, renderItemSpecsAndSku } from '../components/invoice/A4InvoicePrint';
import { exportDomToPdf } from './domPdfExporter';

// Format numbers to Indian currency string
const formatNum = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Safe image loader
const loadHtmlImage = (src) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

/**
 * Downloads a Purchase Voucher / Stock Receipt PDF with the EXACT Bill UI of A4InvoicePrint
 * and the requested file name format: Purchase_<PurchaseNumber>_<SupplierName>.pdf
 *
 * @param {Object} purchase - Purchase record object
 * @param {Object} companyProfile - Optional company profile data
 * @returns {Promise<string>} Generated file name
 */
export const downloadPurchasePdf = async (purchase, companyProfile = {}) => {
  if (!purchase) {
    throw new Error('No purchase data provided for PDF generation.');
  }

  // Attempt pixel-perfect HTML/DOM export first so saved PDF matches print view 100%
  if (typeof document !== 'undefined') {
    try {
      const fileName = await exportDomToPdf({
        invoice: purchase,
        company: companyProfile,
        isPurchase: true,
        copyType: 'SUPPLIER COPY',
      });
      return fileName;
    } catch (domErr) {
      console.warn('DOM PDF export failed, falling back to coordinate jsPDF:', domErr);
    }
  }

  const [logoImg, sealImg] = await Promise.all([
    loadHtmlImage(octaneLogo),
    loadHtmlImage(octaneSeal),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 7;
  const contentWidth = pageWidth - margin * 2; // 196mm

  const items = purchase.items || [];

  const isCancelled = Boolean(
    purchase.status === 'CANCELLED' ||
    purchase.invoice_status === 'CANCELLED' ||
    (typeof purchase.notes === 'string' && purchase.notes.startsWith('[CANCELLED'))
  );

  const docTitle = purchase.title || (
    isCancelled ? 'PURCHASE INVOICE (CANCELLED / VOID)' : 'PURCHASE INVOICE'
  );

  const copyType = 'SUPPLIER COPY';

  // Live Company Profile (Recipient / Store)
  const company = {
    name: companyProfile?.company_name || 'MATRIX INFOTECH',
    address_line1: companyProfile?.address_line1 || '99, 2ND FLOOR , SRI CHODESWARI COMPLEX',
    address_line2: companyProfile?.address_line2 || 'BEHIND SHARDA TALKIES , S.P.ROAD',
    city_pincode: companyProfile?.city ? `${companyProfile.city} ${companyProfile.pincode || ''}`.trim() : 'BANGALORE 02',
    city: companyProfile?.city || 'BANGALORE',
    phone: companyProfile?.phone || '080-41623454 / 5 / 6',
    email: companyProfile?.email || 'Matrix.Stock2015@gmail.Com',
    gstin: companyProfile?.gstin || '29ACBFM5112C1ZO',
    state_name: companyProfile?.state_name || 'Karnataka',
    state_code: companyProfile?.state_code || '29',
    bank_name: companyProfile?.bank_name || 'KOTAK BANK (3149366297) NEW',
    bank_account: companyProfile?.account_number || '3149366297',
    bank_ifsc: companyProfile?.ifsc_code || '-VV PURUM & KKBK0008055',
    ...companyProfile,
  };

  // Aggregated HSN/SAC summary
  const hsnMap = {};
  items.forEach((item) => {
    const code = item.hsn_sac || item.hsn_code || '852411';
    if (!hsnMap[code]) {
      const gstRate = parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : (purchase.gst_rate ?? 18));
      hsnMap[code] = {
        hsn_sac: code,
        taxable_value: 0,
        cgst_rate: (gstRate / 2).toFixed(1).replace(/\.0$/, '') + '%',
        cgst_amount: 0,
        sgst_rate: (gstRate / 2).toFixed(1).replace(/\.0$/, '') + '%',
        sgst_amount: 0,
        igst_rate: gstRate.toFixed(1).replace(/\.0$/, '') + '%',
        igst_amount: 0,
        total_tax: 0,
      };
    }
    const qty = parseFloat(item.quantity || item.qty || 1);
    const rate = parseFloat(item.unit_cost || item.rate || item.unit_price || 0);
    const disc = parseFloat(item.discount_percent || item.discount || 0);
    const lineTaxable = parseFloat(item.taxable_value ?? (qty * rate * (1 - disc / 100)));
    const gstRate = parseFloat(item.gst_rate !== undefined && item.gst_rate !== null ? item.gst_rate : (purchase.gst_rate ?? 18));

    const cgstAmt = parseFloat(item.cgst_amount ?? (lineTaxable * (gstRate / 200)));
    const sgstAmt = parseFloat(item.sgst_amount ?? (lineTaxable * (gstRate / 200)));
    const igstAmt = parseFloat(item.igst_amount ?? (lineTaxable * (gstRate / 100)));

    hsnMap[code].taxable_value += lineTaxable;
    hsnMap[code].cgst_amount += cgstAmt;
    hsnMap[code].sgst_amount += sgstAmt;
    hsnMap[code].igst_amount += igstAmt;
    hsnMap[code].total_tax += purchase.is_interstate ? igstAmt : (cgstAmt + sgstAmt);
  });
  const hsnSummary = Object.values(hsnMap);

  const totalTaxable = hsnSummary.reduce((sum, h) => sum + h.taxable_value, 0);
  const totalCgst = hsnSummary.reduce((sum, h) => sum + h.cgst_amount, 0);
  const totalSgst = hsnSummary.reduce((sum, h) => sum + h.sgst_amount, 0);
  const totalIgst = hsnSummary.reduce((sum, h) => sum + h.igst_amount, 0);
  const totalTaxAmount = purchase.is_interstate ? totalIgst : (totalCgst + totalSgst);

  const grandTotal = parseFloat(purchase.grand_total ?? purchase.total_amount ?? (totalTaxable + totalTaxAmount));
  const totalQuantity = items.reduce((sum, i) => sum + parseFloat(i.quantity || i.qty || 1), 0);
  const amountPaid = parseFloat(purchase.total_paid_amount ?? purchase.paid_amount ?? purchase.amount_paid ?? 0);
  const paymentStatus = purchase.payment_status || (amountPaid === 0 ? 'UNPAID' : (amountPaid >= grandTotal - 0.01 ? 'PAID' : 'PARTIALLY_PAID'));

  // 1. Watermark if Cancelled
  if (isCancelled) {
    doc.saveGraphicsState();
    doc.setTextColor(244, 63, 94);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(38);
    doc.text('CANCELLED / VOID', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 35,
    });
    doc.restoreGraphicsState();
  }

  // 2. Header Title & Copy Type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(docTitle, pageWidth / 2, 11, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`(${copyType})`, pageWidth - margin, 11, { align: 'right' });

  // 3. Upper Grid: Seller/Vendor (Top Left), Recipient/Store (Bottom Left) & Reference Grid (Right)
  const startY = 14;
  const gridH = 58;
  const midX = margin + contentWidth / 2; // 105mm

  // Outer border of top grid
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, startY, contentWidth, gridH);
  // Center vertical dividing line
  doc.line(midX, startY, midX, startY + gridH);

  // --- LEFT COLUMN: Seller (Vendor) & Buyer (Recipient/Store) ---
  const sellerBuyerDividerY = startY + 29;
  doc.line(margin, sellerBuyerDividerY, midX, sellerBuyerDividerY);

  // Vendor Details (Seller)
  let vendorY = startY + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Vendor / Supplier (Seller)', margin + 2, vendorY);
  vendorY += 4;
  doc.setFontSize(9.5);
  doc.text(String(purchase.supplier_name || 'Vendor Supplier').toUpperCase(), margin + 2, vendorY);
  vendorY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(purchase.supplier_address || 'Vendor Address', margin + 2, vendorY);
  vendorY += 3.5;
  if (purchase.supplier_mobile) {
    doc.text(`Ph: ${purchase.supplier_mobile}`, margin + 2, vendorY);
    vendorY += 3.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN/UIN: ${purchase.supplier_gstin || '—'}`, margin + 2, vendorY);
  vendorY += 3.5;
  doc.text(`State Name: ${purchase.supplier_state || 'Karnataka'}, Code: ${purchase.supplier_state_code || '29'}`, margin + 2, vendorY);

  // Recipient / Store Details (Buyer)
  let storeY = sellerBuyerDividerY + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Recipient / Buyer (Store)', margin + 2, storeY);

  let storeTextX = margin + 2;
  if (logoImg) {
    try {
      // 6.0mm x 6.0mm logo perfectly vertically centered with OCTANE SYSTEM text
      doc.addImage(logoImg, 'PNG', margin + 2, sellerBuyerDividerY + 4.2, 5.8, 5.8);
      storeTextX = margin + 9.5;
    } catch {
      // Ignore logo error
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(String(company.name || 'OCTANE SYSTEM').toUpperCase(), storeTextX, sellerBuyerDividerY + 8.2);

  storeY = sellerBuyerDividerY + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(company.address_line1 || '', margin + 2, storeY);
  storeY += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN/UIN: ${company.gstin || '—'}`, margin + 2, storeY);
  storeY += 3.5;
  doc.text(`State Name: ${company.state_name || 'Karnataka'}, Code: ${company.state_code || '29'}`, margin + 2, storeY);

  // --- RIGHT COLUMN: Purchase Reference Grid ---
  const rowH = gridH / 4; // 14.5mm per row
  const rightMidX = midX + (contentWidth / 4); // 154mm

  // Horizontal lines across right column
  for (let i = 1; i < 4; i++) {
    doc.line(midX, startY + rowH * i, margin + contentWidth, startY + rowH * i);
  }
  // Vertical split inside rows 1 to 3
  for (let i = 0; i < 3; i++) {
    doc.line(rightMidX, startY + rowH * i, rightMidX, startY + rowH * (i + 1));
  }

  // Row 1: OCTANE Purchase No. & Dated
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('OCTANE Purchase No.', midX + 2, startY + 4);
  doc.setFontSize(9);
  doc.text(String(purchase.purchase_number || purchase.invoice_number || 'PUR-001'), midX + 2, startY + 9);

  doc.setFontSize(6.5);
  doc.text('Dated', rightMidX + 2, startY + 4);
  doc.setFontSize(9);
  doc.text(formatDateDMY(purchase.purchase_date || purchase.created_at || new Date()), rightMidX + 2, startY + 9);

  // Row 2: Supplier Invoice No. & Payment Mode
  let rY = startY + rowH;
  doc.setFontSize(6.5);
  doc.text('Supplier Invoice No.', midX + 2, rY + 4);
  doc.setFontSize(8);
  doc.text(purchase.supplier_invoice_number || '—', midX + 2, rY + 9);

  doc.setFontSize(6.5);
  doc.text('Payment Mode', rightMidX + 2, rY + 4);
  doc.setFontSize(8);
  doc.text(purchase.payment_mode || 'Cash', rightMidX + 2, rY + 9);

  // Row 3: Collected / Paid via & Payment Status
  rY += rowH;
  doc.setFontSize(6.5);
  doc.text('Collected / Paid via', midX + 2, rY + 4);
  doc.setFontSize(7.5);
  const paidVia = purchase.partner_allocation_json?.partner_name
    ? `Partner: ${purchase.partner_allocation_json.partner_name}`
    : (purchase.paid_by_partner_name || 'Company Account');
  doc.text(paidVia, midX + 2, rY + 9);

  doc.setFontSize(6.5);
  doc.text('Payment Status', rightMidX + 2, rY + 4);
  doc.setFontSize(8.5);
  doc.text(paymentStatus.toUpperCase(), rightMidX + 2, rY + 9);

  // Row 4: Notes / Remarks
  rY += rowH;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Notes / Remarks', midX + 2, rY + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const rawNotes = purchase.notes || 'Vendor Stock Entry';
  const cleanNotes = String(rawNotes).replace(/₹/g, 'Rs. ');
  const maxNotesWidth = 78; // Constrain to 78mm to stay well clear of the right border at 98mm
  const splitNotes = doc.splitTextToSize(cleanNotes, maxNotesWidth);
  doc.text(splitNotes.slice(0, 3), midX + 2, rY + 7);

  // 4. Item Table Section
  const tableStartY = startY + gridH;

  const tableBody = items.map((item, idx) => {
    const qty = parseFloat(item.quantity || item.qty || 1);
    const rate = parseFloat(item.unit_cost || item.rate || item.unit_price || 0);
    const disc = parseFloat(item.discount_percent || item.discount || 0);
    const lineAmount = parseFloat(item.taxable_value ?? item.amount ?? (qty * rate * (1 - disc / 100)));
    const specs = renderItemSpecsAndSku(item);

    let desc = (item.product_name || item.description || 'Product Item').toUpperCase();
    if (specs.length > 0) {
      desc += '\n' + specs.join(' | ');
    }

    return [
      idx + 1,
      desc,
      item.hsn_sac || item.hsn_code || '852411',
      `${qty} ${item.unit || 'NOS.'}`,
      formatNum(rate),
      item.unit || 'NOS.',
      disc > 0 ? `${disc}%` : '',
      formatNum(lineAmount),
    ];
  });

  // Append tax breakdown rows if GST
  if (totalTaxAmount > 0) {
    if (!purchase.is_interstate) {
      tableBody.push([
        '',
        { content: 'CGST INPUT', styles: { halign: 'right', fontStyle: 'bolditalic' } },
        '',
        '',
        '',
        '',
        '',
        formatNum(totalCgst),
      ]);
      tableBody.push([
        '',
        { content: 'SGST INPUT', styles: { halign: 'right', fontStyle: 'bolditalic' } },
        '',
        '',
        '',
        '',
        '',
        formatNum(totalSgst),
      ]);
    } else {
      tableBody.push([
        '',
        { content: 'IGST INPUT', styles: { halign: 'right', fontStyle: 'bolditalic' } },
        '',
        '',
        '',
        '',
        '',
        formatNum(totalIgst),
      ]);
    }
  }

  // 4. Calculate target table height to stretch and fill the exact A4 sheet
  const outerBottomY = pageHeight - 8.5; // 288.5mm
  const signH = 22;
  const decBankH = 17;
  const amountWordsH = 8.5;
  const taxWordsH = 6.5;

  let hsnHead = null;
  let hsnBody = null;
  let hsnFoot = null;
  let hsnTableH = 0;

  if (totalTaxAmount > 0) {
    if (!purchase.is_interstate) {
      hsnHead = [
        [
          { content: 'HSN/SAC', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
          { content: 'Taxable\nValue', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
          { content: 'Central Tax', colSpan: 2, styles: { halign: 'center' } },
          { content: 'State Tax', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Total\nTax Amount', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
        ],
        [
          { content: 'Rate', styles: { halign: 'center' } },
          { content: 'Amount', styles: { halign: 'right' } },
          { content: 'Rate', styles: { halign: 'center' } },
          { content: 'Amount', styles: { halign: 'right' } },
        ],
      ];

      hsnBody = hsnSummary.map((h) => [
        h.hsn_sac,
        formatNum(h.taxable_value),
        h.cgst_rate,
        formatNum(h.cgst_amount),
        h.sgst_rate,
        formatNum(h.sgst_amount),
        formatNum(h.total_tax),
      ]);

      hsnFoot = [[
        { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNum(totalTaxable), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
        { content: formatNum(totalCgst), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
        { content: formatNum(totalSgst), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNum(totalTaxAmount), styles: { halign: 'right', fontStyle: 'bold' } },
      ]];
    } else {
      hsnHead = [
        [
          { content: 'HSN/SAC', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
          { content: 'Taxable\nValue', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
          { content: 'Integrated Tax (IGST)', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Total\nTax Amount', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
        ],
        [
          { content: 'Rate', styles: { halign: 'center' } },
          { content: 'Amount', styles: { halign: 'right' } },
        ],
      ];

      hsnBody = hsnSummary.map((h) => [
        h.hsn_sac,
        formatNum(h.taxable_value),
        h.igst_rate,
        formatNum(h.igst_amount),
        formatNum(h.total_tax),
      ]);

      hsnFoot = [[
        { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNum(totalTaxable), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
        { content: formatNum(totalIgst), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatNum(totalTaxAmount), styles: { halign: 'right', fontStyle: 'bold' } },
      ]];
    }

    const dummyHsn = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    autoTable(dummyHsn, {
      startY: 0,
      margin: { left: margin, right: margin },
      head: hsnHead,
      body: hsnBody,
      foot: hsnFoot,
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 1.4,
      },
    });
    hsnTableH = dummyHsn.lastAutoTable.finalY;
  }

  const totalBottomH = amountWordsH + (totalTaxAmount > 0 ? (hsnTableH + taxWordsH) : 0) + decBankH + signH;
  const targetTableEndY = outerBottomY - totalBottomH;

  const itemTableHead = [[
    { content: 'Sl\nNo.', styles: { halign: 'center', cellWidth: 10 } },
    { content: 'Description of Goods', styles: { halign: 'left', cellWidth: 70 } },
    { content: 'HSN/SAC', styles: { halign: 'center', cellWidth: 18 } },
    { content: 'Quantity', styles: { halign: 'right', cellWidth: 20 } },
    { content: 'Rate', styles: { halign: 'right', cellWidth: 22 } },
    { content: 'per', styles: { halign: 'center', cellWidth: 12 } },
    { content: 'Disc. %', styles: { halign: 'right', cellWidth: 14 } },
    { content: 'Amount', styles: { halign: 'right', cellWidth: 30 } },
  ]];

  const itemTableFoot = [[
    '',
    { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } },
    '',
    { content: `${totalQuantity} ${items[0]?.unit || 'NOS.'}`, styles: { halign: 'right', fontStyle: 'bold' } },
    '',
    '',
    '',
    { content: `Rs. ${formatNum(grandTotal)}`, styles: { halign: 'right', fontStyle: 'bold' } },
  ]];

  const itemColumnStyles = {
    0: { halign: 'center', cellWidth: 10 },
    1: { halign: 'left', cellWidth: 70 },
    2: { halign: 'center', cellWidth: 18 },
    3: { halign: 'right', cellWidth: 20 },
    4: { halign: 'right', cellWidth: 22 },
    5: { halign: 'center', cellWidth: 12 },
    6: { halign: 'right', cellWidth: 14 },
    7: { halign: 'right', cellWidth: 30, lineWidth: { top: 0, bottom: 0, left: 0, right: 0 } },
  };

  // Measure natural items table height
  const dummyTable = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  autoTable(dummyTable, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: itemTableHead,
    body: tableBody,
    foot: itemTableFoot,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      lineWidth: { top: 0, bottom: 0, left: 0, right: 0.25 },
      cellPadding: 1.8,
    },
    columnStyles: itemColumnStyles,
  });

  const naturalTableEndY = dummyTable.lastAutoTable.finalY;
  const spacerH = targetTableEndY - naturalTableEndY;

  const finalTableBody = [...tableBody];
  if (spacerH > 4) {
    finalTableBody.push([
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
      { content: '', styles: { minCellHeight: spacerH } },
    ]);
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: itemTableHead,
    body: finalTableBody,
    foot: itemTableFoot,
    theme: 'plain',
    tableLineWidth: 0.35,
    tableLineColor: [0, 0, 0],
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: { top: 0, bottom: 0, left: 0, right: 0.25 },
      cellPadding: 1.8,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.35,
    },
    footStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.35,
    },
    columnStyles: itemColumnStyles,
  });

  let currentY = doc.lastAutoTable.finalY;

  // 5. Amount Chargeable in Words Row
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, currentY, contentWidth, amountWordsH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Amount Chargeable (in words)', margin + 2, currentY + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(numberToWordsRupees(grandTotal), margin + 2, currentY + 7);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('E. & O.E', margin + contentWidth - 2, currentY + 5.5, { align: 'right' });

  currentY += amountWordsH;

  // 6. HSN/SAC Tax Summary Table (if GST tax present)
  if (totalTaxAmount > 0 && hsnHead) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: hsnHead,
      body: hsnBody,
      foot: hsnFoot,
      theme: 'plain',
      tableLineWidth: 0.35,
      tableLineColor: [0, 0, 0],
      styles: {
        font: 'helvetica',
        fontSize: 7,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 1.4,
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.35,
      },
      footStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.35,
      },
    });

    currentY = doc.lastAutoTable.finalY;

    // Tax amount in words
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(margin, currentY, contentWidth, taxWordsH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Tax Amount (in words) : ', margin + 2, currentY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(numberToWordsRupees(totalTaxAmount), margin + 33, currentY + 4.5);

    currentY += taxWordsH;
  }

  // 7. Declaration & Company Bank Details Grid
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, currentY, contentWidth, decBankH);
  doc.line(midX, currentY, midX, currentY + decBankH);

  // Declaration (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Declaration', margin + 2, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(
    'We declare that this purchase invoice shows the actual price of the goods\nreceived and that all particulars are verified and recorded.',
    margin + 2,
    currentY + 8
  );

  // Bank Details (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text("Company's Bank Details", midX + 2, currentY + 4);
  doc.setFontSize(7);
  doc.text(`Bank Name: ${company.bank_name || 'KOTAK BANK'}`, midX + 2, currentY + 8);
  doc.text(`A/c No.: ${company.bank_account || '3149366297'}`, midX + 2, currentY + 11.5);
  doc.text(`Branch & IFS Code: ${company.bank_ifsc || 'KKBK0008055'}`, midX + 2, currentY + 15);

  currentY += decBankH;

  // 8. Signatures Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, currentY, contentWidth, signH);

  // Left: Vendor's Seal & Signature
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text("Vendor's Seal and Signature", margin + 2, currentY + signH - 3);

  // Right: for OCTANE SYSTEM with stamp & Authorised Signatory
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`for ${company.name || 'OCTANE SYSTEM'}`, margin + contentWidth - 2, currentY + 4.5, { align: 'right' });

  if (sealImg) {
    try {
      doc.addImage(sealImg, 'PNG', margin + contentWidth - 26, currentY + 5.5, 13, 13);
    } catch {
      // Ignore seal image render issue
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Authorised Signatory', margin + contentWidth - 2, currentY + signH - 3, { align: 'right' });

  // 9. Bottom Footer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(`SUBJECT TO ${(company.city || 'BENGALURU').toUpperCase()} JURISDICTION`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.text('This is a Computer Generated Document', pageWidth / 2, pageHeight - 2.5, { align: 'center' });

  // 10. File Name Format: Purchase_<PurchaseNumber>_<SupplierName>.pdf
  const safePurNum = String(purchase.purchase_number || purchase.invoice_number || 'PUR0001').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeSupplier = String(purchase.supplier_name || 'Supplier').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Purchase_${safePurNum}_${safeSupplier}.pdf`;

  // Save to disk
  try {
    doc.save(fileName);
  } catch {
    const blob = doc.output('blob');
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);
  }

  return fileName;
};

export default downloadPurchasePdf;
