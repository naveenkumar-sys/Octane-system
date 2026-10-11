from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from core.models import Partner, Invoice, Payment, Purchase, Expense, PartnerDrawings, PartnerSettlement, PartnerDeposit


class PartnerLedgerService:
    """
    Calculates live Partner Financial Ledgers, Capital Balances, and Chronological Statements.
    Applies to Ramesh, Lokesh, or any configured Partner.
    
    Logically and mathematically correct double-entry cash flow:
    1. Capital Injections & Initial Capital: CREDIT (+)
    2. Out-of-pocket Purchases/Expenses Funded by Partner: CREDIT (+)
    3. Deposits / Collections Handed Over to Store Till/Bank: CREDIT (+)
    4. Settlements Received from other partners: CREDIT (+)
    5. Personal Drawings / Withdrawals from store: DEBIT (-)
    6. Customer Invoice Payments Collected & Held by Partner: DEBIT (-)
    7. Settlements Paid to other partners: DEBIT (-)
    """

    @staticmethod
    def get_partner_ledger_summary(partner_id=None):
        """
        Returns live balance summary breakdown for a specific partner or all active partners.
        """
        partners = Partner.objects.filter(is_active=True)
        if partner_id:
            partners = partners.filter(id=partner_id)

        results = []
        for partner in partners:
            summary = PartnerLedgerService._calculate_single_partner_summary(partner)
            results.append(summary)

        return results[0] if partner_id and results else results

    @staticmethod
    def _get_partner_purchase_contribution(purchase, partner):
        """
        Determines the contribution funded by a specific partner for a purchase:
        1. Explicit partner_split_json dictionary (e.g. {"Lokesh": 136000, "Ramesh": 100000})
        2. Payment breakdown notes summary: "[Payment Breakdown: ...]"
        3. Single paid_by_partner field (when no split exists)
        """
        split_json = getattr(purchase, 'partner_split_json', None)
        if split_json and isinstance(split_json, dict):
            val = split_json.get(partner.name) or split_json.get(str(partner.id)) or split_json.get(partner.name.lower())
            if val is not None:
                try:
                    return Decimal(str(val))
                except Exception:
                    pass
            return Decimal('0.00')

        notes = getattr(purchase, 'notes', '') or ''
        if '[Payment Breakdown:' in notes:
            import re
            m = re.search(r'\[Payment Breakdown:\s*(.*?)\]', notes, re.DOTALL)
            if m:
                breakdown_str = m.group(1)
                for part in breakdown_str.split(';'):
                    segments = [s.strip() for s in part.split('|')]
                    if len(segments) >= 3:
                        payer_part = segments[0]
                        payer_name = payer_part.split(':', 1)[1].strip() if ':' in payer_part else payer_part.strip()
                        if payer_name.lower() == partner.name.lower() or str(partner.id) in payer_part:
                            amt_clean = re.sub(r'[^\d.]', '', segments[2])
                            if amt_clean:
                                try:
                                    return Decimal(amt_clean)
                                except Exception:
                                    pass
                return Decimal('0.00')

        if purchase.paid_by_partner_id == partner.id:
            return purchase.paid_amount or Decimal('0.00')

        return Decimal('0.00')

    @staticmethod
    def _get_partner_customer_collections(partner):
        """
        Calculates total customer invoice payments collected and held by a partner.
        A collection is an implicit drawing / liability (DEBIT) until deposited back to the business.
        """
        collections = Decimal('0.00')
        invoices_processed = set()

        # Check posted Invoices with partner_allocation_json
        for inv in Invoice.objects.filter(invoice_status='POSTED'):
            alloc = getattr(inv, 'partner_allocation_json', None)
            if alloc and isinstance(alloc, dict):
                invoices_processed.add(inv.id)
                if alloc.get('partner_id') == partner.id or alloc.get('partner_name') == partner.name:
                    amt = alloc.get('amount')
                    if amt:
                        try:
                            collections += Decimal(str(amt))
                        except Exception:
                            pass
                else:
                    val = alloc.get(partner.name) or alloc.get(str(partner.id)) or alloc.get(str(partner.name).capitalize())
                    if val is not None:
                        try:
                            val_dec = Decimal(str(val))
                            if 0 < val_dec <= 100 and inv.grand_total > 100:
                                collections += (inv.grand_total * val_dec) / Decimal('100')
                            else:
                                collections += val_dec
                        except Exception:
                            pass

        # Check Payments with partner_allocation_json
        for pmt in Payment.objects.filter(partner_allocation_json__isnull=False):
            if pmt.invoice_id and pmt.invoice_id in invoices_processed:
                continue
            alloc = pmt.partner_allocation_json
            if alloc and isinstance(alloc, dict):
                if alloc.get('partner_id') == partner.id or alloc.get('partner_name') == partner.name:
                    amt = alloc.get('amount')
                    if amt:
                        try:
                            collections += Decimal(str(amt))
                        except Exception:
                            pass
                else:
                    val = alloc.get(partner.name) or alloc.get(str(partner.id))
                    if val is not None:
                        try:
                            collections += Decimal(str(val))
                        except Exception:
                            pass

        return collections

    @staticmethod
    def _calculate_single_partner_summary(partner):
        """
        Calculates capital ledger balance breakdown for one partner.
        """
        initial_capital = getattr(partner, 'initial_capital', None) or Decimal('0.00')

        # 1. Out-of-pocket Purchases funded by partner (supports split payments)
        purchases_funded = Decimal('0.00')
        for p in Purchase.objects.all():
            purchases_funded += PartnerLedgerService._get_partner_purchase_contribution(p, partner)

        # 2. Out-of-pocket Expenses funded by partner
        expenses_funded = Decimal('0.00')
        for exp in Expense.objects.all():
            if exp.paid_by_partner_id == partner.id:
                expenses_funded += exp.amount
            elif exp.partner_split_json and isinstance(exp.partner_split_json, dict):
                split_val = exp.partner_split_json.get(partner.name) or exp.partner_split_json.get(str(partner.id))
                if split_val is not None:
                    try:
                        expenses_funded += Decimal(str(split_val))
                    except Exception:
                        pass

        # 3. Customer Payments Collected & Retained by Partner (DEBIT)
        customer_collections = PartnerLedgerService._get_partner_customer_collections(partner)

        # 4. Deposits / Cash Handovers to Store Till/Bank (CREDIT)
        deposits_handed_over = PartnerDeposit.objects.filter(partner=partner).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        # 5. Personal Cash/Bank Drawings from Store (DEBIT)
        drawings = PartnerDrawings.objects.filter(partner=partner).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        # 6. Settlements Paid to other partner (DEBIT)
        settlements_paid = PartnerSettlement.objects.filter(from_partner=partner).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        # 7. Settlements Received from other partner (CREDIT)
        settlements_received = PartnerSettlement.objects.filter(to_partner=partner).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        # Total Credits (+): Money partner provided to the business or deposited to store
        total_credits = initial_capital + purchases_funded + expenses_funded + deposits_handed_over + settlements_received

        # Total Debits (-): Money partner took from store or collected directly from customers
        total_debits = drawings + customer_collections + settlements_paid

        # Live Net Capital Balance
        net_capital_balance = total_credits - total_debits

        # Live cash currently held in partner's hand/personal account from customer collections
        cash_held_in_hand = max(Decimal('0.00'), customer_collections - deposits_handed_over)

        return {
            'partner_id': partner.id,
            'partner_name': partner.name,
            'ownership_percentage': partner.ownership_percentage,
            'initial_capital': initial_capital,
            'purchases_funded': purchases_funded,
            'expenses_funded': expenses_funded,
            'deposits_handed_over': deposits_handed_over,
            'settlements_received': settlements_received,
            'total_credits': total_credits,
            'drawings': drawings,
            'customer_collections': customer_collections,
            'incomes_allocated': Decimal('0.00'),  # Backwards compatibility
            'settlements_paid': settlements_paid,
            'total_debits': total_debits,
            'net_capital_balance': net_capital_balance,
            'cash_held_in_hand': cash_held_in_hand,
        }

    @staticmethod
    def get_chronological_statement(partner_id):
        """
        Returns chronological journal list of all ledger transactions for a partner.
        """
        partner = Partner.objects.get(id=partner_id)
        entries = []

        # 0. Opening Capital (Opening Equity Balance)
        initial_capital = getattr(partner, 'initial_capital', None) or Decimal('0.00')
        created_d = partner.created_at.date() if partner.created_at else timezone.now().date()
        created_dt = partner.created_at or timezone.now()
        entries.append({
            'date': created_d,
            'created_at': created_dt,
            'type': 'OPENING_CAPITAL',
            'reference': f"CAP-{partner.id:02d}",
            'description': f"Initial Opening Capital for {partner.name}",
            'credit': initial_capital,
            'debit': Decimal('0.00')
        })

        # 1. Purchases Funded (supports split payments)
        for p in Purchase.objects.all():
            contrib = PartnerLedgerService._get_partner_purchase_contribution(p, partner)
            if contrib > Decimal('0.00'):
                is_split = bool(p.partner_split_json and len(p.partner_split_json) > 1) or ('[Payment Breakdown:' in (p.notes or ''))
                desc_suffix = f" (Split Funded - ₹{contrib:,.2f})" if is_split else " (Out-of-pocket)"
                entries.append({
                    'date': p.purchase_date,
                    'created_at': p.created_at,
                    'type': 'PURCHASE_FUNDED',
                    'reference': p.purchase_number,
                    'description': f"Purchased stock from {p.supplier.name if p.supplier else 'Supplier'}{desc_suffix}",
                    'credit': contrib,
                    'debit': Decimal('0.00')
                })

        # 2. Expenses Funded
        for e in Expense.objects.all():
            if e.paid_by_partner_id == partner.id:
                entries.append({
                    'date': e.expense_date,
                    'created_at': e.created_at,
                    'type': 'EXPENSE_FUNDED',
                    'reference': e.expense_number,
                    'description': f"Paid expense: {e.description} (Out-of-pocket)",
                    'credit': e.amount,
                    'debit': Decimal('0.00')
                })
            elif e.partner_split_json and isinstance(e.partner_split_json, dict):
                split_val = e.partner_split_json.get(partner.name) or e.partner_split_json.get(str(partner.id))
                if split_val is not None:
                    try:
                        amt = Decimal(str(split_val))
                        entries.append({
                            'date': e.expense_date,
                            'created_at': e.created_at,
                            'type': 'EXPENSE_FUNDED',
                            'reference': e.expense_number,
                            'description': f"Paid split expense: {e.description} (Out-of-pocket share)",
                            'credit': amt,
                            'debit': Decimal('0.00')
                        })
                    except Exception:
                        pass

        # 3. Customer Payments Collected & Held by Partner (DEBIT)
        invoices_processed = set()
        for inv in Invoice.objects.filter(invoice_status='POSTED'):
            alloc = getattr(inv, 'partner_allocation_json', None)
            if alloc and isinstance(alloc, dict):
                invoices_processed.add(inv.id)
                if alloc.get('partner_id') == partner.id or alloc.get('partner_name') == partner.name:
                    amt = alloc.get('amount')
                    if amt:
                        try:
                            entries.append({
                                'date': inv.invoice_date,
                                'created_at': inv.created_at,
                                'type': 'CUSTOMER_COLLECTION',
                                'reference': inv.invoice_number,
                                'description': f"Customer payment collected & held by {partner.name} (#{inv.invoice_number})",
                                'credit': Decimal('0.00'),
                                'debit': Decimal(str(amt))
                            })
                        except Exception:
                            pass
                else:
                    val = alloc.get(partner.name) or alloc.get(str(partner.id))
                    if val is not None:
                        try:
                            val_dec = Decimal(str(val))
                            share_amt = (inv.grand_total * val_dec) / Decimal('100') if val_dec <= 100 else val_dec
                            entries.append({
                                'date': inv.invoice_date,
                                'created_at': inv.created_at,
                                'type': 'CUSTOMER_COLLECTION',
                                'reference': inv.invoice_number,
                                'description': f"Customer collection retained by {partner.name} (#{inv.invoice_number})",
                                'credit': Decimal('0.00'),
                                'debit': share_amt
                            })
                        except Exception:
                            pass

        for pmt in Payment.objects.filter(partner_allocation_json__isnull=False):
            if pmt.invoice_id and pmt.invoice_id in invoices_processed:
                continue
            alloc = pmt.partner_allocation_json
            if alloc and isinstance(alloc, dict):
                if alloc.get('partner_id') == partner.id or alloc.get('partner_name') == partner.name:
                    amt = alloc.get('amount')
                    if amt:
                        try:
                            entries.append({
                                'date': pmt.payment_date,
                                'created_at': pmt.created_at,
                                'type': 'CUSTOMER_COLLECTION',
                                'reference': pmt.payment_number,
                                'description': f"Customer payment received & held by {partner.name} (#{pmt.payment_number})",
                                'credit': Decimal('0.00'),
                                'debit': Decimal(str(amt))
                            })
                        except Exception:
                            pass

        # 4. Deposits / Cash Handovers to Store Till/Bank (CREDIT)
        for dep in PartnerDeposit.objects.filter(partner=partner):
            type_label = "Collection Handover" if dep.deposit_type == 'CUSTOMER_COLLECTION_HANDOVER' else "Capital Injection"
            entries.append({
                'date': dep.deposit_date,
                'created_at': dep.created_at,
                'type': 'DEPOSIT_HANDOVER',
                'reference': dep.deposit_number,
                'description': f"Handover / Deposit to store till/bank ({dep.payment_mode}) - {type_label}",
                'credit': dep.amount,
                'debit': Decimal('0.00')
            })

        # 5. Personal Cash/Bank Drawings (DEBIT)
        for d in PartnerDrawings.objects.filter(partner=partner):
            entries.append({
                'date': d.drawing_date,
                'created_at': d.created_at,
                'type': 'DRAWING',
                'reference': d.drawing_number,
                'description': f"Personal cash/bank withdrawal ({d.payment_mode})",
                'credit': Decimal('0.00'),
                'debit': d.amount
            })

        # 6. Settlements Paid to other partner (DEBIT)
        for sp in PartnerSettlement.objects.filter(from_partner=partner):
            entries.append({
                'date': sp.settlement_date,
                'created_at': sp.created_at,
                'type': 'SETTLEMENT_PAID',
                'reference': sp.settlement_number,
                'description': f"Settlement paid to {sp.to_partner.name}",
                'credit': Decimal('0.00'),
                'debit': sp.amount
            })

        # 7. Settlements Received from other partner (CREDIT)
        for sr in PartnerSettlement.objects.filter(to_partner=partner):
            entries.append({
                'date': sr.settlement_date,
                'created_at': sr.created_at,
                'type': 'SETTLEMENT_RECEIVED',
                'reference': sr.settlement_number,
                'description': f"Settlement received from {sr.from_partner.name}",
                'credit': sr.amount,
                'debit': Decimal('0.00')
            })

        # Sort chronologically
        entries.sort(key=lambda x: (x['date'], x['created_at']))

        # Calculate running balance
        running_balance = Decimal('0.00')
        for entry in entries:
            running_balance += (Decimal(str(entry['credit'])) - Decimal(str(entry['debit'])))
            entry['running_balance'] = running_balance

        return entries
