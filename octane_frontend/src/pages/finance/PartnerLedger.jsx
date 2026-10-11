import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  User,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Edit2,
  Users,
  Wallet
} from 'lucide-react';
import { api } from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import FormModal from '../../components/ui/FormModal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/StateViews';
import { toast } from 'react-toastify';

export const PartnerLedger = () => {
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [statement, setStatement] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals for Drawing, Settlement, Deposit/Handover, and Partner Master
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);

  // Partner Form State
  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    ownership_percentage: '50.00',
    initial_capital: '0.00',
    is_active: true,
  });

  // Drawing Form State
  const [drawingForm, setDrawingForm] = useState({
    partner_id: '',
    amount: '',
    drawing_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    notes: '',
  });

  // Settlement Form State
  const [settlementForm, setSettlementForm] = useState({
    from_partner_id: '',
    to_partner_id: '',
    amount: '',
    settlement_date: new Date().toISOString().split('T')[0],
    payment_mode: 'UPI',
    reference_number: '',
    notes: '',
  });

  // Deposit / Handover Form State
  const [depositForm, setDepositForm] = useState({
    partner_id: '',
    amount: '',
    deposit_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    deposit_type: 'CUSTOMER_COLLECTION_HANDOVER',
    reference_number: '',
    notes: '',
  });

  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  useEffect(() => {
    fetchPartnersAndSummary();
  }, []);

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPartnerStatement(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  const fetchPartnersAndSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        api.getPartners(),
        api.getPartnerLedgerSummary()
      ]);

      const pList = Array.isArray(pRes) ? pRes : pRes.results || [];
      const summaries = Array.isArray(sRes) ? sRes : (sRes ? [sRes] : []);

      setPartners(pList);

      const targetId = selectedPartnerId || (pList.length > 0 ? pList[0].id : null);
      if (targetId && (!selectedPartnerId || !pList.some(p => String(p.id) === String(selectedPartnerId)))) {
        setSelectedPartnerId(targetId);
      }

      if (summaries && summaries.length > 0) {
        const activeSum = targetId
          ? summaries.find((s) => String(s.partner_id) === String(targetId)) || summaries[0]
          : summaries[0];
        setLedgerSummary(activeSum);
      }
    } catch (err) {
      console.error('Error fetching partner ledger data:', err);
      setError(err.message || 'Failed to load partner capital ledger balances.');
      toast.error('Failed to load partner capital ledger.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerStatement = async (partnerId) => {
    try {
      const res = await api.getPartnerLedgerStatement(partnerId);
      if (res) {
        setStatement(res.statement || []);
        if (res.summary) {
          setLedgerSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Error loading partner statement:', err);
      toast.error('Failed to load partner journal statement.');
    }
  };

  const handlePartnerTabChange = (partnerId) => {
    setSelectedPartnerId(partnerId);
  };

  // Open Partner Modal
  const openAddPartnerModal = () => {
    setEditingPartner(null);
    setPartnerFormData({
      name: '',
      mobile: '',
      email: '',
      ownership_percentage: '50.00',
      initial_capital: '0.00',
      is_active: true,
    });
    setModalError(null);
    setIsPartnerModalOpen(true);
  };

  const openEditPartnerModal = (p) => {
    setEditingPartner(p);
    setPartnerFormData({
      name: p.name,
      mobile: p.mobile || '',
      email: p.email || '',
      ownership_percentage: p.ownership_percentage || '50.00',
      initial_capital: p.initial_capital || '0.00',
      is_active: p.is_active !== undefined ? p.is_active : true,
    });
    setModalError(null);
    setIsPartnerModalOpen(true);
  };

  // Submit Partner Form
  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const name = partnerFormData.name.trim();
    if (!name) {
      setModalError('Partner name is required.');
      return;
    }

    const ownership = parseFloat(partnerFormData.ownership_percentage);
    if (isNaN(ownership) || ownership < 0 || ownership > 100) {
      setModalError('Ownership percentage must be between 0% and 100%.');
      return;
    }

    const initCap = parseFloat(partnerFormData.initial_capital) || 0;
    if (initCap < 0) {
      setModalError('Initial capital cannot be negative.');
      return;
    }

    setModalSaving(true);
    try {
      const payload = {
        name,
        mobile: partnerFormData.mobile.trim() || null,
        email: partnerFormData.email.trim() || null,
        ownership_percentage: ownership,
        initial_capital: initCap,
        is_active: partnerFormData.is_active,
      };

      if (editingPartner) {
        await api.updatePartner(editingPartner.id, payload);
        toast.success(`Partner "${name}" updated successfully!`);
      } else {
        const created = await api.createPartner(payload);
        toast.success(`Partner "${created.name}" created successfully!`);
        setSelectedPartnerId(created.id);
      }

      setIsPartnerModalOpen(false);
      setEditingPartner(null);
      await fetchPartnersAndSummary();
    } catch (err) {
      console.error('Error saving partner profile:', err);
      setModalError(err.message || 'Failed to save partner details.');
      toast.error(err.message || 'Failed to save partner details.');
    } finally {
      setModalSaving(false);
    }
  };

  // Open Drawing Modal
  const openDrawingModal = () => {
    setDrawingForm({
      partner_id: selectedPartnerId || (partners.length > 0 ? partners[0].id : ''),
      amount: '',
      drawing_date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      notes: '',
    });
    setModalError(null);
    setIsDrawingModalOpen(true);
  };

  // Open Settlement Modal
  const openSettlementModal = () => {
    const fromId = selectedPartnerId || (partners.length > 0 ? partners[0].id : '');
    const toId = partners.find((p) => String(p.id) !== String(fromId))?.id || '';
    setSettlementForm({
      from_partner_id: fromId,
      to_partner_id: toId,
      amount: '',
      settlement_date: new Date().toISOString().split('T')[0],
      payment_mode: 'UPI',
      reference_number: '',
      notes: '',
    });
    setModalError(null);
    setIsSettlementModalOpen(true);
  };

  // Submit Drawing
  const handleDrawingSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const amt = parseFloat(drawingForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Drawing amount must be greater than ₹0.');
      return;
    }

    if (!drawingForm.partner_id) {
      setModalError('Please select a partner.');
      return;
    }

    setModalSaving(true);
    try {
      await api.createPartnerDrawing({
        partner_id: parseInt(drawingForm.partner_id, 10),
        amount: amt,
        drawing_date: drawingForm.drawing_date,
        payment_mode: drawingForm.payment_mode,
        notes: drawingForm.notes.trim(),
      });
      toast.success(`Personal drawing of ₹${amt.toLocaleString('en-IN')} recorded successfully!`);
      setIsDrawingModalOpen(false);
      fetchPartnersAndSummary();
      if (selectedPartnerId) fetchPartnerStatement(selectedPartnerId);
    } catch (err) {
      console.error('Error recording drawing:', err);
      setModalError(err.message || 'Failed to record partner drawing.');
      toast.error(err.message || 'Failed to record partner drawing.');
    } finally {
      setModalSaving(false);
    }
  };

  // Submit Settlement
  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const amt = parseFloat(settlementForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Settlement amount must be greater than ₹0.');
      return;
    }

    if (!settlementForm.from_partner_id || !settlementForm.to_partner_id) {
      setModalError('Please select both paying and receiving partners.');
      return;
    }

    if (String(settlementForm.from_partner_id) === String(settlementForm.to_partner_id)) {
      setModalError('Paying and receiving partners must be different.');
      return;
    }

    setModalSaving(true);
    try {
      await api.createPartnerSettlement({
        from_partner_id: parseInt(settlementForm.from_partner_id, 10),
        to_partner_id: parseInt(settlementForm.to_partner_id, 10),
        amount: amt,
        settlement_date: settlementForm.settlement_date,
        payment_mode: settlementForm.payment_mode,
        reference_number: settlementForm.reference_number.trim(),
        notes: settlementForm.notes.trim(),
      });
      toast.success(`Partner settlement of ₹${amt.toLocaleString('en-IN')} recorded successfully!`);
      setIsSettlementModalOpen(false);
      fetchPartnersAndSummary();
      if (selectedPartnerId) fetchPartnerStatement(selectedPartnerId);
    } catch (err) {
      console.error('Error recording settlement:', err);
      setModalError(err.message || 'Failed to record partner settlement.');
      toast.error(err.message || 'Failed to record partner settlement.');
    } finally {
      setModalSaving(false);
    }
  };

  // Open Deposit / Handover Modal
  const openDepositModal = (defaultAmt = '') => {
    setDepositForm({
      partner_id: selectedPartnerId || (partners.length > 0 ? partners[0].id : ''),
      amount: defaultAmt ? String(defaultAmt) : '',
      deposit_date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      deposit_type: 'CUSTOMER_COLLECTION_HANDOVER',
      reference_number: '',
      notes: '',
    });
    setModalError(null);
    setIsDepositModalOpen(true);
  };

  // Submit Deposit / Handover
  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const amt = parseFloat(depositForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Deposit amount must be greater than ₹0.');
      return;
    }

    if (!depositForm.partner_id) {
      setModalError('Please select a partner.');
      return;
    }

    setModalSaving(true);
    try {
      await api.createPartnerDeposit({
        partner_id: parseInt(depositForm.partner_id, 10),
        amount: amt,
        deposit_date: depositForm.deposit_date,
        payment_mode: depositForm.payment_mode,
        deposit_type: depositForm.deposit_type,
        reference_number: (depositForm.reference_number || '').trim(),
        notes: (depositForm.notes || '').trim(),
      });
      toast.success(`Handover/deposit of ₹${amt.toLocaleString('en-IN')} to store recorded successfully!`);
      setIsDepositModalOpen(false);
      fetchPartnersAndSummary();
      if (selectedPartnerId) fetchPartnerStatement(selectedPartnerId);
    } catch (err) {
      console.error('Error recording deposit:', err);
      setModalError(err.message || 'Failed to record deposit/handover.');
      toast.error(err.message || 'Failed to record deposit/handover.');
    } finally {
      setModalSaving(false);
    }
  };

  const currentPartnerObj = useMemo(() => {
    return partners.find((p) => String(p.id) === String(selectedPartnerId));
  }, [partners, selectedPartnerId]);

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700">{row.date}</span>
      ),
    },
    {
      key: 'type',
      header: 'Transaction Type',
      render: (row) => {
        const isCredit = parseFloat(row.credit || 0) > 0;
        let badgeColor = isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
        if (row.type === 'OPENING_CAPITAL') {
          badgeColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        } else if (row.type === 'CUSTOMER_COLLECTION') {
          badgeColor = 'bg-rose-100 text-rose-800 border border-rose-200';
        } else if (row.type === 'DEPOSIT_HANDOVER') {
          badgeColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        } else if (row.type === 'DRAWING') {
          badgeColor = 'bg-amber-100 text-amber-800 border border-amber-200';
        }
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${badgeColor}`}>
            {row.type ? row.type.replace('_', ' ') : (isCredit ? 'CREDIT' : 'DEBIT')}
          </span>
        );
      },
    },
    {
      key: 'reference',
      header: 'Ref # / Doc',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-orange-600">{row.reference || '—'}</span>
      ),
    },
    {
      key: 'description',
      header: 'Journal Narration',
      render: (row) => (
        <div className="max-w-md text-xs font-bold text-slate-800 leading-snug">{row.description}</div>
      ),
    },
    {
      key: 'credit',
      header: 'Credit (₹)',
      render: (row) => {
        const val = parseFloat(row.credit || 0);
        return (
          <span className={`font-mono font-extrabold text-xs ${val > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
            {val > 0 ? `+₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
          </span>
        );
      },
    },
    {
      key: 'debit',
      header: 'Debit (₹)',
      render: (row) => {
        const val = parseFloat(row.debit || 0);
        return (
          <span className={`font-mono font-extrabold text-xs ${val > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
            {val > 0 ? `-₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
          </span>
        );
      },
    },
    {
      key: 'running_balance',
      header: 'Running Balance',
      render: (row) => {
        const bal = parseFloat(row.running_balance || 0);
        return (
          <span className={`font-mono font-extrabold text-xs ${bal >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
            ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
  ];

  if (loading) return <LoadingState message="Calculating partner capital ledgers & running statements..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPartnersAndSummary} />;

  return (
    <div className="space-y-5">
      {/* Partner Tabs Bar & Action Buttons */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Partner Selection Pills */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs gap-1">
          {partners.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePartnerTabChange(p.id)}
              className={`px-4 py-1.5 font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                String(selectedPartnerId) === String(p.id)
                  ? 'bg-white text-orange-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={14} />
              <span>Partner: {p.name}</span>
            </button>
          ))}
          <button
            onClick={openAddPartnerModal}
            className="px-2.5 py-1.5 text-orange-600 hover:text-orange-700 hover:bg-white/80 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            title="Register New Partner"
          >
            <Plus size={13} />
            <span>Add Partner</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentPartnerObj && (
            <button
              onClick={() => openEditPartnerModal(currentPartnerObj)}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1 transition-all cursor-pointer"
              title="Edit Partner Profile / Capital"
            >
              <Edit2 size={13} className="text-slate-500" />
              <span>Edit Partner</span>
            </button>
          )}

          <button
            onClick={() => openDepositModal()}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Handover collected customer money or deposit capital into store till/bank"
          >
            <Wallet size={15} />
            <span>Handover / Deposit to Store</span>
          </button>

          <button
            onClick={openDrawingModal}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1 transition-all cursor-pointer"
          >
            <ArrowDownLeft size={15} className="text-rose-600" />
            <span>Record Drawing (Withdrawal)</span>
          </button>

          <button
            onClick={openSettlementModal}
            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all cursor-pointer"
          >
            <ArrowUpRight size={15} />
            <span>Inter-Partner Settlement</span>
          </button>
        </div>
      </div>

      {/* Capital Account Summary Banner */}
      {ledgerSummary && (
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <PieChart size={18} className="text-orange-600" />
                <span>Capital Account Ledger — {ledgerSummary.partner_name}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ownership Share: <strong className="text-slate-800">{ledgerSummary.ownership_percentage}%</strong> • Real-time Equity Capital Balance
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Net Capital Balance</div>
              <div className={`text-2xl font-extrabold font-mono ${parseFloat(ledgerSummary.net_capital_balance || 0) >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                ₹{parseFloat(ledgerSummary.net_capital_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Pending Cash in Partner Pocket Alert Banner */}
          {parseFloat(ledgerSummary.cash_held_in_hand || 0) > 0 && (
            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Wallet size={16} />
                </div>
                <div>
                  <div className="font-extrabold text-amber-950 flex items-center gap-2">
                    <span>Customer Cash Held by {ledgerSummary.partner_name}:</span>
                    <span className="font-mono text-rose-700 text-sm font-extrabold">
                      ₹{parseFloat(ledgerSummary.cash_held_in_hand).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Payments collected from customer invoices directly by {ledgerSummary.partner_name} and not yet handed over to store till / bank.
                  </p>
                </div>
              </div>
              <button
                onClick={() => openDepositModal(ledgerSummary.cash_held_in_hand)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowDownLeft size={14} />
                <span>Handover ₹{parseFloat(ledgerSummary.cash_held_in_hand).toLocaleString('en-IN')} to Store Till</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs font-mono">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Initial Capital</div>
              <div className="font-extrabold text-blue-700">
                +₹{parseFloat(ledgerSummary.initial_capital || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Stock Funded</div>
              <div className="font-extrabold text-emerald-700">
                +₹{parseFloat(ledgerSummary.purchases_funded || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Expenses Funded</div>
              <div className="font-extrabold text-emerald-700">
                +₹{parseFloat(ledgerSummary.expenses_funded || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Customer Collections</div>
              <div className="font-extrabold text-rose-600">
                -₹{parseFloat(ledgerSummary.customer_collections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Deposited to Store</div>
              <div className="font-extrabold text-emerald-700">
                +₹{parseFloat(ledgerSummary.deposits_handed_over || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Personal Drawings</div>
              <div className="font-extrabold text-rose-600">
                -₹{parseFloat(ledgerSummary.drawings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chronological Journal Statement Table */}
      <div className="space-y-2">
        <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center justify-between px-1">
          <span>Chronological Journal Statement & Audit Trail</span>
          <span className="text-[10px] text-slate-400 font-mono font-bold">{statement.length} Transaction Line(s)</span>
        </div>

        {statement.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Capital Journal Entries"
            message="No capital transactions, out-of-pocket funding, or drawings logged for this partner yet."
          />
        ) : (
          <DataTable data={statement} columns={columns} paginationPerPage={20} />
        )}
      </div>

      {/* Partner Profile Modal (Add / Edit) */}
      {isPartnerModalOpen && (
        <FormModal
          isOpen={isPartnerModalOpen}
          onClose={() => {
            setIsPartnerModalOpen(false);
            setEditingPartner(null);
          }}
          title={editingPartner ? `Edit Partner: ${editingPartner.name}` : 'Register New Partner'}
          subtitle="Configure partner equity share, initial capital investment, and contact info."
          submitLabel={editingPartner ? 'Update Partner' : 'Save Partner'}
          onSubmit={handlePartnerSubmit}
          loading={modalSaving}
        >
          <div className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Partner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh or Lokesh"
                  value={partnerFormData.name}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Ownership Equity (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  placeholder="50.00"
                  value={partnerFormData.ownership_percentage}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, ownership_percentage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Initial / Opening Capital (₹)</label>
                  {editingPartner && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Locked after registration
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={Boolean(editingPartner)}
                  placeholder="0.00"
                  value={partnerFormData.initial_capital}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, initial_capital: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-extrabold focus:outline-none ${
                    editingPartner
                      ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-orange-500/30'
                  }`}
                />
                {editingPartner && (
                  <p className="text-[10px] text-slate-400">
                    Opening equity cannot be silently modified. Use a partner drawing, funding, or settlement for capital changes.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Mobile Number</label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={partnerFormData.mobile}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, mobile: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  placeholder="partner@octanesystems.in"
                  value={partnerFormData.email}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </FormModal>
      )}

      {/* Record Drawing Modal */}
      {isDrawingModalOpen && (
        <FormModal
          isOpen={isDrawingModalOpen}
          onClose={() => setIsDrawingModalOpen(false)}
          title="Record Partner Drawing (Cash/Bank Withdrawal)"
          subtitle="Record personal cash or bank withdrawal taken by a partner. Debits capital balance."
          submitLabel="Record Drawing"
          onSubmit={handleDrawingSubmit}
          loading={modalSaving}
        >
          <div className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Partner *</label>
                <select
                  required
                  value={drawingForm.partner_id}
                  onChange={(e) => setDrawingForm({ ...drawingForm, partner_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">-- Select Partner --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Withdrawal Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={drawingForm.amount}
                  onChange={(e) => setDrawingForm({ ...drawingForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Drawing Date *</label>
                <input
                  type="date"
                  required
                  value={drawingForm.drawing_date}
                  onChange={(e) => setDrawingForm({ ...drawingForm, drawing_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                <select
                  value={drawingForm.payment_mode}
                  onChange={(e) => setDrawingForm({ ...drawingForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CASH">Store Cash</option>
                  <option value="UPI">Store UPI / GPay</option>
                  <option value="BANK_TRANSFER">Store Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly personal drawings / cash withdrawal"
                  value={drawingForm.notes}
                  onChange={(e) => setDrawingForm({ ...drawingForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </FormModal>
      )}

      {/* Record Settlement Modal */}
      {isSettlementModalOpen && (
        <FormModal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          title="Inter-Partner Equity Settlement"
          subtitle="Record inter-partner fund transfers (e.g., Ramesh transfers money to Lokesh to equalize equity balances)."
          submitLabel="Record Settlement"
          onSubmit={handleSettlementSubmit}
          loading={modalSaving}
        >
          <div className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">From Partner (Payer) *</label>
                <select
                  required
                  value={settlementForm.from_partner_id}
                  onChange={(e) => setSettlementForm({ ...settlementForm, from_partner_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">-- Select Payer --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">To Partner (Recipient) *</label>
                <select
                  required
                  value={settlementForm.to_partner_id}
                  onChange={(e) => setSettlementForm({ ...settlementForm, to_partner_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">-- Select Recipient --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Settlement Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={settlementForm.amount}
                  onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Settlement Date *</label>
                <input
                  type="date"
                  required
                  value={settlementForm.settlement_date}
                  onChange={(e) => setSettlementForm({ ...settlementForm, settlement_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                <select
                  value={settlementForm.payment_mode}
                  onChange={(e) => setSettlementForm({ ...settlementForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="UPI">UPI / GPay</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Txn / Ref Number</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-98427189"
                  value={settlementForm.reference_number}
                  onChange={(e) => setSettlementForm({ ...settlementForm, reference_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Equity balancing settlement payment"
                  value={settlementForm.notes}
                  onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </FormModal>
      )}
      {/* Record Partner Deposit / Handover Modal */}
      {isDepositModalOpen && (
        <FormModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          title="Handover / Deposit to Store Till or Bank"
          subtitle="Deposit collected customer payments or inject fresh working capital into store cash drawer / company bank account."
          submitLabel="Record Store Deposit"
          onSubmit={handleDepositSubmit}
          loading={modalSaving}
        >
          <div className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Partner Depositing *</label>
                <select
                  required
                  value={depositForm.partner_id}
                  onChange={(e) => setDepositForm({ ...depositForm, partner_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="">-- Select Partner --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Deposit Purpose / Type *</label>
                <select
                  required
                  value={depositForm.deposit_type}
                  onChange={(e) => setDepositForm({ ...depositForm, deposit_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CUSTOMER_COLLECTION_HANDOVER">Handover of Collected Customer Payments</option>
                  <option value="CAPITAL_INJECTION">Additional Capital Deposit into Business</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Deposit Date *</label>
                <input
                  type="date"
                  required
                  value={depositForm.deposit_date}
                  onChange={(e) => setDepositForm({ ...depositForm, deposit_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Destination / Mode *</label>
                <select
                  value={depositForm.payment_mode}
                  onChange={(e) => setDepositForm({ ...depositForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="CASH">Physical Cash to Till Drawer</option>
                  <option value="BANK_TRANSFER">Bank Transfer / IMPS to Company Bank</option>
                  <option value="UPI">UPI to Company Bank</option>
                  <option value="CHEQUE">Cheque to Company Account</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Ref / Slip Number</label>
                <input
                  type="text"
                  placeholder="e.g. Cash Slip / UTR / Reference"
                  value={depositForm.reference_number}
                  onChange={(e) => setDepositForm({ ...depositForm, reference_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Deposited cash collected from customers into shop till"
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
};

export default PartnerLedger;
