import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Eye, FileText, Maximize2, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { api } from '../../services/api';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { downloadInvoicePdf } from '../../utils/invoicePdfExporter';
import { downloadPurchasePdf } from '../../utils/purchasePdfExporter';
import octaneLogo from '../../assets/octane_logo.png';
import octaneSeal from '../../assets/octane_seal.png';

// Re-export shared helpers and single-page copy component for backwards compatibility
export {
  numberToWordsRupees,
  formatDateDMY,
  renderItemSpecsAndSku,
  A4SinglePageCopy,
} from './A4SinglePageCopy';

import { A4SinglePageCopy } from './A4SinglePageCopy';

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
  const [savingPdf, setSavingPdf] = useState(false);
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

  // Dynamic document title update so browser's native "Print -> Save as PDF"
  // automatically defaults to the official naming format:
  // Invoice_<InvoiceNumber>_<CustomerName>.pdf or Purchase_<PurchaseNumber>_<SupplierName>.pdf
  useEffect(() => {
    if (isOpen && invoiceData) {
      const origTitle = document.title;
      const isPur = Boolean(
        invoiceData.is_purchase ||
        invoiceData.document_type === 'PURCHASE' ||
        (invoiceData.supplier_name && !invoiceData.customer_name)
      );
      const safeNum = String(invoiceData.invoice_number || invoiceData.purchase_number || invoiceData.number || '001').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const safeParty = String(invoiceData.customer_name || invoiceData.supplier_name || invoiceData.buyer_name || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const prefix = isPur ? 'Purchase' : 'Invoice';
      document.title = `${prefix}_${safeNum}_${safeParty}`;
      return () => {
        document.title = origTitle;
      };
    }
  }, [isOpen, invoiceData]);

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

  const company = {
    name: activeProfile?.company_name || companyData?.name || 'OCTANE SYSTEM',
    address_line1: activeProfile?.address_line1 || companyData?.address_line1 || 'No.101, 2nd Floor, 14th Cross, 20th B Main',
    address_line2: activeProfile?.address_line2 || companyData?.address_line2 || 'Venkateshwara Layout, Maruthinagar, BTM Layout',
    city_pincode: activeProfile?.city ? `${activeProfile.city} ${activeProfile.pincode || ''}`.trim() : (companyData?.city_pincode || 'Bengaluru 560068'),
    city: activeProfile?.city || companyData?.city || 'Bengaluru',
    phone: activeProfile?.phone || companyData?.phone || '7338515910',
    extra_info: 'COSMIC : 3278 / CENTRIX 4674 / 8493',
    email: activeProfile?.email || 'Matrix.Stock2015@gmail.Com',
    gstin: activeProfile?.gstin || '29ACBFM5112C1ZO',
    state_name: activeProfile?.state_name || 'Karnataka',
    state_code: activeProfile?.state_code || '29',
    contact_email: activeProfile?.email || 'MATRIX.VINIT@GMAIL.COM',
    bank_name: activeProfile?.bank_name || 'KOTAK BANK (3149366297) NEW',
    bank_account: activeProfile?.account_number || '3149366297',
    bank_ifsc: activeProfile?.ifsc_code || '-VV PURUM & KKBK0008055',
    logo: activeProfile?.logo_url || companyData?.logo || companyData?.logo_url || octaneLogo,
    seal: activeProfile?.seal_url || companyData?.seal || octaneSeal,
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
    const safeNum = String(invoiceData.invoice_number || invoiceData.purchase_number || invoiceData.number || '001').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeParty = String(invoiceData.customer_name || invoiceData.supplier_name || invoiceData.buyer_name || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const prefix = isPurchase ? 'Purchase' : 'Invoice';
    document.title = `${prefix}_${safeNum}_${safeParty}`;
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSavePdf = async () => {
    setSavingPdf(true);
    try {
      const printArea = document.getElementById('a4-invoice-print-area');
      const prevMode = viewMode;
      if (prevMode !== 'actual') {
        setViewMode('actual');
        await new Promise((r) => setTimeout(r, 120));
      }

      const sheetElements = printArea ? printArea.querySelectorAll('.a4-sheet-page-wrapper') : [];
      if (!sheetElements || sheetElements.length === 0) {
        throw new Error('A4 sheet elements not found in print view');
      }

      const safeNum = String(invoiceData.invoice_number || invoiceData.purchase_number || invoiceData.number || '001').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const safeParty = String(invoiceData.customer_name || invoiceData.supplier_name || invoiceData.buyer_name || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const prefix = isPurchase ? 'Purchase' : 'Invoice';
      const fileName = `${prefix}_${safeNum}_${safeParty}.pdf`;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < sheetElements.length; i++) {
        const sheetEl = sheetElements[i];
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

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      if (prevMode !== 'actual') {
        setViewMode(prevMode);
      }

      pdf.save(fileName);
      toast.success(`${prefix} PDF downloaded: ${fileName}`);
    } catch (err) {
      console.error('Failed to export direct DOM PDF, attempting fallback:', err);
      try {
        let fallbackFile;
        if (isPurchase) {
          fallbackFile = await downloadPurchasePdf(invoiceData, company);
        } else {
          fallbackFile = await downloadInvoicePdf(invoiceData, company);
        }
        toast.success(`PDF downloaded: ${fallbackFile}`);
      } catch (fallbackErr) {
        console.error('Fallback export also failed:', fallbackErr);
        toast.error('Failed to generate PDF. You can also use Print -> Save as PDF.');
      }
    } finally {
      setSavingPdf(false);
    }
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
              <span>{isPurchase ? 'Purchase Invoice Preview' : 'Tax Invoice Print Preview'}</span>
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

          {/* Save as PDF button */}
          <button
            type="button"
            disabled={savingPdf}
            onClick={handleSavePdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl border border-slate-600 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Save and download official PDF file to local computer"
          >
            <Download size={15} className={savingPdf ? 'animate-bounce text-orange-400' : 'text-orange-400'} />
            <span>{savingPdf ? 'Generating PDF...' : 'Save as PDF'}</span>
          </button>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-600/30 transition-all cursor-pointer"
          >
            <Printer size={15} />
            <span>{isPurchase ? 'Print Purchase Invoice' : 'Print A4 Invoice'}</span>
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
