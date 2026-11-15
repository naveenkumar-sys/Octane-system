import React from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { A4SinglePageCopy } from '../components/invoice/A4SinglePageCopy';

/**
 * Renders an invoice or purchase document offscreen using the exact
 * on-screen A4SinglePageCopy React component and captures it via html2canvas into jsPDF.
 * This guarantees 100% pixel-perfect fidelity between the print preview and the saved PDF file.
 */
export const exportDomToPdf = async ({
  invoice,
  company = {},
  isPurchase = false,
  copyType,
  fileName,
}) => {
  if (typeof document === 'undefined') {
    throw new Error('DOM document not available for offscreen PDF export');
  }

  // Create an offscreen mount container with exact A4 sheet dimensions
  const container = document.createElement('div');
  container.id = `offscreen-a4-pdf-export-${Date.now()}`;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.height = '297mm';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  const root = createRoot(container);

  const effectiveCopyType = copyType || (isPurchase ? 'SUPPLIER COPY' : 'ORIGINAL FOR RECIPIENT');

  root.render(
    React.createElement(A4SinglePageCopy, {
      copyType: effectiveCopyType,
      invoice,
      company,
    })
  );

  // Give React 18 a short tick to render DOM, apply Tailwind stylesheet rules and paint
  await new Promise((resolve) => setTimeout(resolve, 220));

  try {
    const sheetEl = container.querySelector('.a4-sheet-page-wrapper') || container.firstElementChild;
    if (!sheetEl) {
      throw new Error('Failed to locate rendered A4 sheet DOM element');
    }

    const origShadow = sheetEl.style.boxShadow;
    sheetEl.style.boxShadow = 'none';

    const canvas = await html2canvas(sheetEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    sheetEl.style.boxShadow = origShadow;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

    const finalFileName = fileName || (() => {
      const safeNum = String(invoice.invoice_number || invoice.purchase_number || invoice.number || '001').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const safeParty = String(invoice.customer_name || invoice.supplier_name || invoice.buyer_name || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const prefix = isPurchase ? 'Purchase' : 'Invoice';
      return `${prefix}_${safeNum}_${safeParty}.pdf`;
    })();

    pdf.save(finalFileName);
    return finalFileName;
  } finally {
    setTimeout(() => {
      try {
        root.unmount();
        container.remove();
      } catch (_) {}
    }, 100);
  }
};

export default exportDomToPdf;

