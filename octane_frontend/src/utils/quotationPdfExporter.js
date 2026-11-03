import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import octaneLogo from '../assets/octane_logo.png';
import octaneSeal from '../assets/octane_seal.png';

// Helper for date formatting (DD-MM-YYYY)
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

// Formats numbers with Indian currency notation
export const formatINR = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to safely load image in browser without throwing errors
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
 * Generates an official Octane Systems branded A4 Quotation PDF
 * and directly downloads it to the user's local disk.
 *
 * @param {Object} quotation - Quotation data object
 * @param {Object} company - Optional company profile object
 * @returns {Promise<string>} The generated file name
 */
export const downloadQuotationPdf = async (quotation, company = {}) => {
  if (!quotation) {
    throw new Error('No quotation data provided for PDF export.');
  }

  // Pre-load images if available
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
  const margin = 10;

  // 1. Header: Logo & Company Info
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', margin, 8, 22, 14);
    } catch {
      // Fallback gracefully if image fails
    }
  }

  const textStartX = logoImg ? margin + 25 : margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(12, 74, 138); // Octane Blue #0C4A8A
  doc.text('OCTANE SYSTEMS', textStartX, 13.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(12, 74, 138);
  doc.text('INNOVATION  |  SOLUTIONS  |  GROWTH', textStartX, 17.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const companyAddress = company?.address || '154/A, 14th cross, 20th B Main Rd, Maruti Nagar, BTM 1st Stage, Bengaluru 560068';
  doc.text(companyAddress, textStartX, 21.5);
  doc.text('Ph: +91 95007 10234  |  Web: www.octanesystems.in  |  GSTIN: 29DRTPA7275L1ZW', textStartX, 25);

  // 2. Quote Meta Box (Top Right)
  const boxX = 145;
  const boxY = 8;
  const boxW = 55;
  const boxH = 17.5;
  doc.setFillColor(232, 242, 250); // Light Blue #E8F2FA
  doc.setDrawColor(184, 215, 242);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Date:', boxX + 4, boxY + 4.8);
  doc.text('Quote#:', boxX + 4, boxY + 9.8);
  doc.text('Valid until:', boxX + 4, boxY + 14.8);

  doc.setTextColor(12, 74, 138);
  doc.text(formatDateDMY(quotation.quotation_date || new Date()), boxX + 22, boxY + 4.8);
  doc.text(String(quotation.quotation_number || 'OCT0001'), boxX + 22, boxY + 9.8);
  doc.text(`${quotation.validity_days || 7} Days`, boxX + 22, boxY + 14.8);

  // Horizontal blue divider
  doc.setDrawColor(12, 74, 138);
  doc.setLineWidth(0.8);
  doc.line(margin, 28, pageWidth - margin, 28);

  // 3. Buyer Details & Quotation Ribbon
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(12, 74, 138);
  doc.text('To,', margin, 34);

  doc.setFillColor(12, 74, 138);
  doc.rect(margin, 35.5, 16, 4.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text('BUYER:', margin + 1.5, 39);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(quotation.buyer_name || 'Valued Client', margin, 44.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  let buyerY = 48.5;
  if (quotation.buyer_address) {
    const addressLines = doc.splitTextToSize(quotation.buyer_address, 85);
    doc.text(addressLines, margin, buyerY);
    buyerY += (addressLines.length * 3.8);
  }

  const cityState = [quotation.buyer_city, quotation.buyer_state].filter(Boolean).join(', ');
  const pin = quotation.buyer_pincode ? ` ${quotation.buyer_pincode}` : '';
  if (cityState || pin) {
    doc.text(`${cityState}${pin}`, margin, buyerY);
    buyerY += 3.8;
  }

  if (quotation.buyer_gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 74, 138);
    doc.text(`GSTIN: ${quotation.buyer_gstin}`, margin, buyerY);
    buyerY += 3.8;
  }

  if (quotation.buyer_phone) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${quotation.buyer_phone}`, margin, buyerY);
    buyerY += 3.8;
  }

  // Right side QUOTATION banner
  doc.setFillColor(12, 74, 138);
  doc.roundedRect(135, 33, 65, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('QUOTATION', 145, 39.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(12, 74, 138);
  doc.text('Your Technology Partner for a Better Tomorrow', 135, 46);

  // 4. Line Items Table
  const tableY = Math.max(buyerY + 2, 54);
  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const tableData = items.length === 0
    ? [[1, '—', 'No items added', '0.00', 0, '0.00', '0%', '0.00']]
    : items.map((it, idx) => {
        const unitPrice = parseFloat(it.unit_price) || 0;
        const qty = parseFloat(it.quantity) || 1;
        const taxable = parseFloat(it.total_value) || (unitPrice * qty);
        const gstRate = parseFloat(it.gst_rate ?? 18);
        const total = parseFloat(it.total) || (taxable * (1 + gstRate / 100));

        return [
          it.sn || idx + 1,
          it.part_number || it.sku || '—',
          it.description || '—',
          formatINR(unitPrice),
          qty,
          formatINR(taxable),
          `${gstRate}%`,
          formatINR(total),
        ];
      });

  autoTable(doc, {
    startY: tableY,
    head: [['SN#', 'Part Number', 'Description', 'Unit Price (Rs)', 'Qty', 'Total Value (Rs)', 'GST %', 'Total (Rs)']],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [12, 74, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 26 },
      2: { halign: 'left' },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'right', cellWidth: 26, fontStyle: 'bold', textColor: [12, 74, 138] },
    },
    alternateRowStyles: {
      fillColor: [237, 245, 252],
    },
    styles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      lineColor: [184, 215, 242],
      lineWidth: 0.2,
      cellPadding: 2.2,
    },
    foot: [[
      {
        content: 'TOTAL TAXABLE / GRAND TOTAL:',
        colSpan: 3,
        styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] },
      },
      {
        content: `Rs. ${formatINR(quotation.taxable_amount || 0)}`,
        colSpan: 3,
        styles: { halign: 'right', fontStyle: 'bold' },
      },
      {
        content: `+ Rs. ${formatINR(quotation.total_tax || 0)}`,
        styles: { halign: 'center', fontSize: 7.5 },
      },
      {
        content: `Rs. ${formatINR(quotation.grand_total || 0)}`,
        styles: { halign: 'right', fontStyle: 'bold', textColor: [12, 74, 138], fontSize: 9 },
      },
    ]],
    footStyles: {
      fillColor: [237, 245, 252],
      lineColor: [12, 74, 138],
      lineWidth: 0.3,
    },
  });

  const endY = doc.lastAutoTable.finalY + 5;
  const colW = (pageWidth - margin * 2 - 6) / 3;

  // 5. Bottom Section: Terms | Bank Details | Signatory
  // Box 1: Terms
  doc.setFillColor(244, 249, 253);
  doc.setDrawColor(197, 223, 245);
  doc.roundedRect(margin, endY, colW + 4, 38, 2, 2, 'FD');
  doc.setFillColor(12, 74, 138);
  doc.rect(margin, endY, 35, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('TERMS & CONDITIONS', margin + 2, endY + 3.5);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  const rawTerms = quotation.terms_and_conditions
    ? quotation.terms_and_conditions.split('\n').filter(Boolean)
    : [
        'Taxes extra as applicable at time of billing',
        'Delivery: 1 week',
        'Validity: 7 days',
        'Payment: 15 days',
        'PO should be in name of Octane Systems',
      ];

  rawTerms.slice(0, 5).forEach((t, i) => {
    const cleanTerm = t.replace(/^[•\-\*\d\.]+\s*/, '').trim();
    doc.text(`• ${cleanTerm.slice(0, 38)}`, margin + 2, endY + 9.5 + i * 4.8);
  });

  // Box 2: Bank Details
  const bankX = margin + colW + 7;
  doc.setFillColor(244, 249, 253);
  doc.setDrawColor(197, 223, 245);
  doc.roundedRect(bankX, endY, colW + 2, 38, 2, 2, 'FD');
  doc.setFillColor(12, 74, 138);
  doc.rect(bankX, endY, 35, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('BANK DETAILS', bankX + 2, endY + 3.5);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Bank Name: ${quotation.bank_name || 'HDFC BANK'}`, bankX + 2, endY + 10);
  doc.text(`A/c No: ${quotation.account_number || '50100856647820'}`, bankX + 2, endY + 15);
  doc.text(`Branch: ${quotation.branch_ifsc || 'KORAMANGALA & HDFC0000053'}`.slice(0, 36), bankX + 2, endY + 20);
  doc.text(`A/c Name: ${quotation.account_holder || 'Sanjay'}`, bankX + 2, endY + 25);

  // Box 3: Signatory & Seal
  const sigX = bankX + colW + 5;
  const sigW = pageWidth - margin - sigX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(12, 74, 138);
  doc.text('For OCTANE SYSTEMS', sigX + sigW / 2, endY + 5, { align: 'center' });

  if (sealImg) {
    try {
      doc.addImage(sealImg, 'PNG', sigX + sigW / 2 - 10, endY + 7, 20, 20);
    } catch {
      // Fallback
    }
  }

  doc.setDrawColor(12, 74, 138);
  doc.setLineWidth(0.3);
  doc.line(sigX + 2, endY + 30, sigX + sigW - 2, endY + 30);
  doc.setFontSize(7);
  doc.text('Authorized Signatory', sigX + sigW / 2, endY + 34, { align: 'center' });

  // 6. Contact Strip & Thank you
  const contactY = endY + 41.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const contact = quotation.contact_person || 'JAGADEESH S';
  const phone = quotation.contact_phone || '+91 95007 10234';
  const email = quotation.contact_email || 'support@octanesystems.in';
  doc.text(
    `If you have any questions about this quote, please contact: ${contact}, ${phone} | ${email}`,
    pageWidth / 2,
    contactY,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(12, 74, 138);
  doc.text('Thank You for Your Business!', pageWidth / 2, contactY + 4.5, { align: 'center' });

  // 7. Bottom Brand Banner
  doc.setFillColor(12, 74, 138);
  doc.rect(0, pageHeight - 9, pageWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('OCTANE SYSTEMS | 154/A, 14th cross, 20th B Main Rd, Maruti Nagar, Bengaluru', margin, pageHeight - 3.5);
  doc.text('+91 95007 10234  |  www.octanesystems.in', pageWidth - margin, pageHeight - 3.5, { align: 'right' });

  // 8. Sanitize Filename & Save
  const safeQuoteNum = String(quotation.quotation_number || 'OCT0001').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeBuyer = String(quotation.buyer_name || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Quotation_${safeQuoteNum}_${safeBuyer}.pdf`;

  // Save to user's local disk
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
