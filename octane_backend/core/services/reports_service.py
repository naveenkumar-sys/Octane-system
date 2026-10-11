import datetime
from datetime import date, timedelta
from decimal import Decimal
from django.db.models import Sum, Q, Prefetch, Count
from django.utils import timezone
from core.models import (
    Product, Invoice, InvoiceItem, Expense, StockMovement,
    Customer, Payment, Purchase, PurchaseItem, SupplierPayment,
    PartnerDrawings, PartnerDeposit, ProductCategory
)
from core.services.partner_ledger_service import PartnerLedgerService


class ReportsService:
    """
    Business Financial & Reporting Service for Octane Systems.
    All calculations are derived from source-of-truth tables.
    Never mutates any data.
    """

    # ------------------------------------------------------------------
    # Helper: parse dates
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_dates(start_date, end_date):
        if not start_date:
            start_date = timezone.now().date().replace(day=1)
        if not end_date:
            end_date = timezone.now().date()
        # Accept string or date objects
        if isinstance(start_date, str) and start_date:
            from datetime import date
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str) and end_date:
            from datetime import date
            end_date = date.fromisoformat(end_date)
        return start_date, end_date

    # ------------------------------------------------------------------
    # DASHBOARD
    # ------------------------------------------------------------------
    @staticmethod
    def get_dashboard_summary(start_date=None, end_date=None):
        """
        Executive Dashboard Summary.
        Delegates profitability, revenue, COGS, operating expenses, and cash flow
        directly to get_profit_and_loss_report() to guarantee a single source of truth
        and 100% reconciliation with P&L.
        """
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)
        pnl = ReportsService.get_profit_and_loss_report(start_date, end_date)

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        month_start = today.replace(day=1)

        today_invoices = Invoice.objects.filter(invoice_date=today, invoice_status='POSTED')
        yesterday_invoices = Invoice.objects.filter(invoice_date=yesterday, invoice_status='POSTED')
        month_invoices = Invoice.objects.filter(invoice_date__gte=month_start, invoice_status='POSTED')

        today_sales = today_invoices.aggregate(sum=Sum('taxable_amount'))['sum'] or Decimal('0.00')
        today_gross_sales = today_invoices.aggregate(sum=Sum('grand_total'))['sum'] or Decimal('0.00')
        yesterday_sales = yesterday_invoices.aggregate(sum=Sum('taxable_amount'))['sum'] or Decimal('0.00')
        month_sales = month_invoices.aggregate(sum=Sum('taxable_amount'))['sum'] or Decimal('0.00')

        if yesterday_sales > 0:
            today_vs_yesterday_pct = round(float((today_sales - yesterday_sales) / yesterday_sales * 100), 1)
        else:
            today_vs_yesterday_pct = 100.0 if today_sales > 0 else 0.0

        unpaid_invoices = Invoice.objects.filter(invoice_status='POSTED', balance_due_amount__gt=0)
        total_customer_outstanding = unpaid_invoices.aggregate(sum=Sum('balance_due_amount'))['sum'] or Decimal('0.00')
        
        # Overdue invoices (invoices with balance due older than 15 days or past today)
        fifteen_days_ago = today - timedelta(days=15)
        overdue_invoices = unpaid_invoices.filter(invoice_date__lt=fifteen_days_ago)
        total_overdue = overdue_invoices.aggregate(sum=Sum('balance_due_amount'))['sum'] or Decimal('0.00')
        if total_overdue == 0 and total_customer_outstanding > 0:
            total_overdue = total_customer_outstanding

        purchases = Purchase.objects.all()
        total_supplier_payables = sum((p.total_amount - p.paid_amount) for p in purchases if p.total_amount > p.paid_amount)

        products = Product.objects.filter(is_stock_enabled=True, is_active=True)
        total_skus = products.count()
        low_stock_count = sum(1 for p in products if p.get_current_stock() <= 2)
        out_of_stock_count = sum(1 for p in products if p.get_current_stock() <= 0)
        healthy_stock_count = max(0, total_skus - low_stock_count - out_of_stock_count)

        partner_summaries = PartnerLedgerService.get_partner_ledger_summary()
        summary_list = partner_summaries if isinstance(partner_summaries, list) else ([partner_summaries] if partner_summaries else [])
        partner_balances_formatted = []
        for p in summary_list:
            partner_balances_formatted.append({
                'id': p['partner_id'],
                'partner_id': p['partner_id'],
                'name': p['partner_name'],
                'partner_name': p['partner_name'],
                'share_percentage': float(p['ownership_percentage']),
                'ownership_percentage': float(p['ownership_percentage']),
                'current_balance': float(p['net_capital_balance']),
                'net_capital_balance': float(p['net_capital_balance']),
                'total_credits': float(p['total_credits']),
                'total_debits': float(p['total_debits']),
            })

        # Last 7 Days Sales Trend (for Bar Chart matching layout: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
        seven_days_sales = []
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_name = day_date.strftime('%a')
            day_invs = Invoice.objects.filter(invoice_date=day_date, invoice_status='POSTED')
            day_rev = day_invs.aggregate(sum=Sum('taxable_amount'))['sum'] or Decimal('0.00')
            day_cnt = day_invs.count()
            seven_days_sales.append({
                'day': day_name,
                'date': str(day_date),
                'revenue': float(day_rev),
                'invoices_count': day_cnt
            })

        # Payment Collections & Payment Mix (Donut Chart matching layout: UPI, Cash, Card)
        period_payments = Payment.objects.filter(payment_date__gte=start_date, payment_date__lte=end_date)
        total_collected = period_payments.aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        mode_aggregates = period_payments.values('payment_mode').annotate(total=Sum('amount'))
        mode_dict = {item['payment_mode']: float(item['total']) for item in mode_aggregates}

        upi_amt = mode_dict.get('UPI', 0.0)
        cash_amt = mode_dict.get('CASH', 0.0)
        card_bank_amt = mode_dict.get('CARD', 0.0) + mode_dict.get('BANK_TRANSFER', 0.0) + mode_dict.get('CHEQUE', 0.0)
        total_collected_float = float(total_collected)

        if total_collected_float > 0:
            upi_pct = round((upi_amt / total_collected_float) * 100)
            cash_pct = round((cash_amt / total_collected_float) * 100)
            card_pct = max(0, 100 - upi_pct - cash_pct)
        else:
            upi_pct, cash_pct, card_pct = 0, 0, 0

        payment_mix = {
            'total_collected': total_collected_float,
            'upi_amount': upi_amt,
            'upi_pct': upi_pct,
            'cash_amount': cash_amt,
            'cash_pct': cash_pct,
            'card_amount': card_bank_amt,
            'card_pct': card_pct,
            'segments': [
                {'mode': 'UPI', 'label': 'UPI', 'amount': upi_amt, 'pct': upi_pct, 'color': '#f97316'},
                {'mode': 'CASH', 'label': 'Cash', 'amount': cash_amt, 'pct': cash_pct, 'color': '#f59e0b'},
                {'mode': 'CARD', 'label': 'Card', 'amount': card_bank_amt, 'pct': card_pct, 'color': '#3b82f6'},
            ]
        }

        # Recent Business Activity Feed (matching layout)
        recent_activity = []
        for inv in Invoice.objects.filter(invoice_status='POSTED').select_related('customer').order_by('-invoice_date', '-created_at')[:6]:
            cust = inv.customer.name if inv.customer else (inv.buyer_name or 'Walk-in Customer')
            is_paid = inv.payment_status == 'PAID'
            has_due = (inv.balance_due_amount or Decimal('0.00')) > Decimal('0.00')
            recent_activity.append({
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'title': f"Invoice {inv.invoice_number} paid" if is_paid else f"Invoice {inv.invoice_number} due",
                'customer': cust,
                'payment_mode': inv.mode_of_payment or ('UPI' if is_paid else 'Credit'),
                'amount': float(inv.grand_total or 0),
                'paid_amount': float(inv.total_paid_amount or 0),
                'balance_due': float(inv.balance_due_amount or 0),
                'date': str(inv.invoice_date),
                'status': inv.payment_status,
                'is_paid': is_paid,
                'has_due': has_due,
            })

        return {
            'start_date': pnl['start_date'],
            'end_date': pnl['end_date'],

            # Revenue & Profitability (Reused directly from P&L source of truth)
            'total_income': float(pnl['net_sales_revenue']),
            'total_revenue': float(pnl['net_sales_revenue']),
            'net_sales_revenue': float(pnl['net_sales_revenue']),
            'gross_sales': float(pnl['gross_sales']),
            'gross_sales_taxable': float(pnl['gross_sales_taxable']),
            'sales_returns_taxable': float(pnl['sales_returns_taxable']),

            'cogs': float(pnl['cost_of_goods_sold']),
            'cost_of_goods_sold': float(pnl['cost_of_goods_sold']),
            'gross_profit': float(pnl['gross_profit']),
            'gross_margin_pct': float(pnl['gross_margin_pct']),

            'total_expenses': float(pnl['operating_expenses']),
            'operating_expenses': float(pnl['operating_expenses']),
            'expense_breakdown': pnl['expense_breakdown'],

            'net_profit': float(pnl['net_profit']),
            'net_business_profit': float(pnl['net_profit']),
            'net_margin_pct': float(pnl['net_margin_pct']),

            # Cash Flow (Reused directly from P&L source of truth)
            'total_customer_receipts': float(pnl['total_customer_receipts']),
            'total_supplier_payouts': float(pnl['total_supplier_payouts']),
            'total_business_expenses': float(pnl['total_operating_cash_expenses']),
            'total_partner_drawings': float(pnl['total_partner_drawings']),
            'net_cash_movement': float(pnl['net_cash_flow']),
            'net_cash_flow': float(pnl['net_cash_flow']),

            # Tax
            'output_gst': float(pnl['output_gst']),
            'input_gst': float(pnl['input_gst']),
            'net_gst_payable': float(pnl['net_gst_payable']),

            # Working Capital & Inventory
            'total_customer_outstanding': float(total_customer_outstanding),
            'customer_receivables': float(total_customer_outstanding),
            'overdue_receivables': float(total_overdue),
            'supplier_payables': float(total_supplier_payables),
            'inventory_valuation': float(pnl['closing_inventory']),
            'stock_value': float(pnl['closing_inventory']),
            'total_skus': total_skus,
            'healthy_stock_count': healthy_stock_count,
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'partner_balances': partner_balances_formatted,

            # Quick indicators & comparisons
            'today_sales': float(today_sales),
            'today_gross_sales': float(today_gross_sales),
            'yesterday_sales': float(yesterday_sales),
            'today_vs_yesterday_pct': float(today_vs_yesterday_pct),
            'month_sales': float(month_sales),

            # Visual Chart & Analytics Data
            'seven_days_sales': seven_days_sales,
            'payment_mix': payment_mix,
            'recent_activity': recent_activity,

            'daily_trends': [
                {
                    'date': str(d['invoice_date']),
                    'revenue': float(d['revenue'] or 0),
                    'sales_amount': float(d['revenue'] or 0),
                    'grand_total': float(d['grand_total'] or 0),
                    'invoices_count': int(d['invoices_count'] or 0)
                }
                for d in Invoice.objects.filter(
                    invoice_date__gte=start_date,
                    invoice_date__lte=end_date,
                    invoice_status='POSTED'
                ).values('invoice_date').annotate(
                    revenue=Sum('taxable_amount'),
                    grand_total=Sum('grand_total'),
                    invoices_count=Count('id')
                ).order_by('invoice_date')
            ],

            'top_products': [
                {
                    'id': item['product__id'],
                    'name': item['product__name'],
                    'sku': item['product__sku'],
                    'qty': float(item['total_qty'] or 0),
                    'units_sold': float(item['total_qty'] or 0),
                    'revenue': float(item['taxable_sales'] or 0),
                    'gross_revenue': float(item['gross_sales'] or 0)
                }
                for item in InvoiceItem.objects.filter(
                    invoice__invoice_date__gte=start_date,
                    invoice__invoice_date__lte=end_date,
                    invoice__invoice_status='POSTED',
                    item_type='PRODUCT',
                    product__isnull=False
                ).values('product__id', 'product__name', 'product__sku').annotate(
                    total_qty=Sum('quantity'),
                    taxable_sales=Sum('taxable_value'),
                    gross_sales=Sum('total_amount')
                ).order_by('-taxable_sales')[:6]
            ],

            'recent_invoices': [
                {
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'date': str(inv.invoice_date),
                    'customer': inv.customer.name if inv.customer else (inv.buyer_name or 'Walk-in Customer'),
                    'customer_name': inv.customer.name if inv.customer else (inv.buyer_name or 'Walk-in Customer'),
                    'amount': float(inv.grand_total or 0),
                    'paid': float(inv.total_paid_amount or 0),
                    'status': inv.payment_status,
                }
                for inv in Invoice.objects.filter(
                    invoice_status='POSTED'
                ).select_related('customer').order_by('-invoice_date', '-created_at')[:5]
            ],
        }

    # ------------------------------------------------------------------
    # SALES REPORT
    # ------------------------------------------------------------------
    @staticmethod
    def get_sales_report(start_date=None, end_date=None, customer_id=None,
                         payment_status=None, search=None, invoice_type=None, is_gst=None):
        """
        Returns per-invoice sales rows with financial breakdown.
        Filters: date range, customer, payment_status, search, invoice_type ('TAX_INVOICE' | 'NON_GST'), is_gst (bool).
        """
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)

        qs = Invoice.objects.filter(
            invoice_date__gte=start_date,
            invoice_date__lte=end_date,
            invoice_status='POSTED'
        ).select_related('customer').prefetch_related(
            Prefetch('items', queryset=InvoiceItem.objects.select_related('product', 'service'))
        ).order_by('-invoice_date', '-created_at')

        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        if payment_status and payment_status != 'ALL':
            qs = qs.filter(payment_status=payment_status)

        if invoice_type == 'TAX_INVOICE' or str(is_gst).lower() in ['true', '1']:
            qs = qs.filter(Q(is_gst=True) | Q(invoice_type='TAX_INVOICE')).exclude(invoice_number__startswith='EST-')
        elif invoice_type == 'NON_GST' or str(is_gst).lower() in ['false', '0']:
            qs = qs.filter(Q(is_gst=False) | Q(invoice_type='NON_GST') | Q(invoice_number__startswith='EST-'))

        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(buyer_name__icontains=search) |
                Q(customer__name__icontains=search)
            )

        rows = []
        for inv in qs:
            item_lines = []
            for it in inv.items.all():
                item_lines.append({
                    'item_type': it.item_type,
                    'description': it.description,
                    'hsn_sac': it.hsn_sac,
                    'quantity': float(it.quantity),
                    'unit': it.unit,
                    'rate': float(it.rate),
                    'discount_pct': float(it.discount_pct),
                    'taxable_value': float(it.taxable_value),
                    'gst_rate': float(it.gst_rate),
                    'cgst_amount': float(it.cgst_amount),
                    'sgst_amount': float(it.sgst_amount),
                    'igst_amount': float(it.igst_amount),
                    'total_amount': float(it.total_amount),
                })

            is_non_gst = bool(
                (inv.invoice_number and inv.invoice_number.startswith('EST-')) or
                getattr(inv, 'is_gst', True) is False or
                getattr(inv, 'invoice_type', 'TAX_INVOICE') == 'NON_GST'
            )

            rows.append({
                'invoice_number': inv.invoice_number,
                'invoice_date': str(inv.invoice_date),
                'customer_name': inv.customer.name if inv.customer else inv.buyer_name,
                'customer_id': inv.customer_id,
                'subtotal': float(inv.subtotal),
                'discount_amount': float(inv.discount_amount),
                'taxable_amount': float(inv.taxable_amount),
                'total_cgst': float(inv.total_cgst),
                'total_sgst': float(inv.total_sgst),
                'total_igst': float(inv.total_igst),
                'total_tax': float(inv.total_tax),
                'grand_total': float(inv.grand_total),
                'amount_paid': float(inv.total_paid_amount),
                'balance_due': float(inv.balance_due_amount),
                'payment_status': inv.payment_status,
                'mode_of_payment': inv.mode_of_payment,
                'invoice_type': 'NON_GST' if is_non_gst else 'TAX_INVOICE',
                'is_gst': not is_non_gst,
                'items': item_lines,
            })

        # Aggregated summary
        total_grand = sum(r['grand_total'] for r in rows)
        total_paid = sum(r['amount_paid'] for r in rows)
        total_balance = sum(r['balance_due'] for r in rows)
        total_tax = sum(r['total_tax'] for r in rows)
        total_taxable = sum(r['taxable_amount'] for r in rows)
        total_discount = sum(r['discount_amount'] for r in rows)

        return {
            'start_date': str(start_date),
            'end_date': str(end_date),
            'total_invoices': len(rows),
            'summary': {
                'total_taxable_amount': round(total_taxable, 2),
                'total_discount': round(total_discount, 2),
                'total_tax': round(total_tax, 2),
                'total_grand_total': round(total_grand, 2),
                'total_paid': round(total_paid, 2),
                'total_balance_due': round(total_balance, 2),
            },
            'rows': rows,
        }

    # ------------------------------------------------------------------
    # PURCHASE REPORT
    # ------------------------------------------------------------------
    @staticmethod
    def get_purchase_report(start_date=None, end_date=None, supplier_id=None,
                            payment_status=None, search=None):
        """
        Returns per-purchase rows with line item detail.
        """
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)

        qs = Purchase.objects.filter(
            purchase_date__gte=start_date,
            purchase_date__lte=end_date,
        ).select_related('supplier').prefetch_related(
            Prefetch('items', queryset=PurchaseItem.objects.select_related('product'))
        ).order_by('-purchase_date', '-created_at')

        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        if payment_status and payment_status != 'ALL':
            qs = qs.filter(payment_status=payment_status)

        if search:
            qs = qs.filter(
                Q(purchase_number__icontains=search) |
                Q(supplier_invoice_number__icontains=search) |
                Q(supplier__name__icontains=search)
            )

        rows = []
        for pur in qs:
            item_lines = []
            for it in pur.items.all():
                gst_tax = float(it.unit_cost * it.quantity * it.gst_rate / 100)
                item_lines.append({
                    'product_name': it.product.name if it.product else it.description or '',
                    'sku': it.product.sku if it.product else '',
                    'hsn_sac': it.hsn_sac,
                    'quantity': it.quantity,
                    'unit_cost': float(it.unit_cost),
                    'gst_rate': float(it.gst_rate),
                    'gst_amount': round(gst_tax, 2),
                    'total_amount': float(it.total_amount),
                })

            rows.append({
                'purchase_number': pur.purchase_number,
                'purchase_date': str(pur.purchase_date),
                'supplier_name': pur.supplier.name if pur.supplier else '—',
                'supplier_id': pur.supplier_id,
                'supplier_invoice_number': pur.supplier_invoice_number or '—',
                'subtotal': round(float(pur.total_amount) - float(pur.tax_amount), 2),
                'tax_amount': float(pur.tax_amount),
                'total_amount': float(pur.total_amount),
                'paid_amount': float(pur.paid_amount),
                'balance_due': round(max(0, float(pur.total_amount) - float(pur.paid_amount)), 2),
                'payment_status': pur.payment_status,
                'payment_mode': pur.payment_mode,
                'items': item_lines,
            })

        total_amount = sum(r['total_amount'] for r in rows)
        total_paid = sum(r['paid_amount'] for r in rows)
        total_balance = sum(r['balance_due'] for r in rows)
        total_tax = sum(r['tax_amount'] for r in rows)
        total_taxable = round(total_amount - total_tax, 2)

        return {
            'start_date': str(start_date),
            'end_date': str(end_date),
            'total_purchases': len(rows),
            'summary': {
                'total_amount': round(total_amount, 2),
                'total_taxable': total_taxable,
                'total_tax': round(total_tax, 2),
                'total_paid': round(total_paid, 2),
                'total_balance_due': round(total_balance, 2),
            },
            'rows': rows,
        }

    # ------------------------------------------------------------------
    # INVENTORY REPORT
    # ------------------------------------------------------------------
    @staticmethod
    def get_inventory_report(category_id=None, low_stock_only=False):
        """
        Per-product stock movement summary with opening/closing stock.
        Includes: opening, purchases, sales, sales returns, purchase returns, adjustments.
        """
        qs = Product.objects.filter(is_stock_enabled=True, is_active=True).select_related('category')

        if category_id:
            qs = qs.filter(category_id=category_id)

        rows = []
        for p in qs:
            movements = StockMovement.objects.filter(product=p)

            opening = int(movements.filter(movement_type='OPENING').aggregate(s=Sum('quantity'))['s'] or 0)
            purchased = int(movements.filter(movement_type='PURCHASE').aggregate(s=Sum('quantity'))['s'] or 0)
            sold = int(movements.filter(movement_type='SALE').aggregate(s=Sum('quantity'))['s'] or 0)
            sales_returns = int(movements.filter(movement_type='SALES_RETURN').aggregate(s=Sum('quantity'))['s'] or 0)
            purchase_returns = int(movements.filter(movement_type='PURCHASE_RETURN').aggregate(s=Sum('quantity'))['s'] or 0)
            adj_in = int(movements.filter(movement_type='ADJUSTMENT_IN').aggregate(s=Sum('quantity'))['s'] or 0)
            adj_out = int(movements.filter(movement_type='ADJUSTMENT_OUT').aggregate(s=Sum('quantity'))['s'] or 0)

            closing = opening + purchased + sales_returns + adj_in - sold - purchase_returns - adj_out
            closing = max(0, closing)
            stock_value = closing * float(p.purchase_price)
            is_low_stock = closing <= p.min_stock_alert

            if low_stock_only and not is_low_stock:
                continue

            rows.append({
                'product_id': p.id,
                'product_name': p.name,
                'sku': p.sku or '—',
                'category': p.category.name if p.category else 'General',
                'tracking_type': p.tracking_type,
                'unit': p.unit,
                'purchase_price': float(p.purchase_price),
                'selling_price': float(p.selling_price),
                'min_stock_alert': p.min_stock_alert,
                'opening_stock': opening,
                'purchases': purchased,
                'sales': sold,
                'sales_returns': sales_returns,
                'purchase_returns': purchase_returns,
                'adj_in': adj_in,
                'adj_out': adj_out,
                'closing_stock': closing,
                'stock_value': round(stock_value, 2),
                'is_low_stock': is_low_stock,
            })

        total_value = sum(r['stock_value'] for r in rows)
        low_stock_count = sum(1 for r in rows if r['is_low_stock'])

        return {
            'total_products': len(rows),
            'total_stock_value': round(total_value, 2),
            'low_stock_count': low_stock_count,
            'rows': rows,
        }

    # ------------------------------------------------------------------
    # GST REPORT
    # ------------------------------------------------------------------
    @staticmethod
    def get_gst_report(start_date=None, end_date=None):
        """
        Output GST (from invoices) + Input GST (from purchases).
        Net GST = Output - Input.
        """
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)

        # --- Output GST (Sales) ---
        invoices = Invoice.objects.filter(
            invoice_date__gte=start_date,
            invoice_date__lte=end_date,
            invoice_status='POSTED'
        )
        inv_agg = invoices.aggregate(
            taxable=Sum('taxable_amount'),
            cgst=Sum('total_cgst'),
            sgst=Sum('total_sgst'),
            igst=Sum('total_igst'),
            total=Sum('grand_total'),
        )

        output_taxable = float(inv_agg['taxable'] or 0)
        output_cgst = float(inv_agg['cgst'] or 0)
        output_sgst = float(inv_agg['sgst'] or 0)
        output_igst = float(inv_agg['igst'] or 0)
        output_total_tax = output_cgst + output_sgst + output_igst
        output_gross = float(inv_agg['total'] or 0)

        # --- Input GST (Purchases) ---
        purchases = Purchase.objects.filter(
            purchase_date__gte=start_date,
            purchase_date__lte=end_date,
        )
        purch_agg = purchases.aggregate(
            total=Sum('total_amount'),
            tax=Sum('tax_amount'),
        )
        input_total = float(purch_agg['total'] or 0)
        input_tax = float(purch_agg['tax'] or 0)
        input_taxable = round(input_total - input_tax, 2)

        # Assume split between CGST/SGST equally if no detailed breakdown
        # (purchases are intra-state by default; use 50/50 split of input GST)
        input_cgst = round(input_tax / 2, 2)
        input_sgst = round(input_tax / 2, 2)
        input_igst = 0.0

        # Net GST payable
        net_cgst = round(output_cgst - input_cgst, 2)
        net_sgst = round(output_sgst - input_sgst, 2)
        net_igst = round(output_igst - input_igst, 2)
        net_total = round(output_total_tax - input_tax, 2)

        # Per-HSN breakdown for output
        invoice_items = InvoiceItem.objects.filter(
            invoice__invoice_date__gte=start_date,
            invoice__invoice_date__lte=end_date,
            invoice__invoice_status='POSTED'
        )

        hsn_map = {}
        for item in invoice_items:
            hsn = item.hsn_sac or 'OTHER'
            if hsn not in hsn_map:
                hsn_map[hsn] = {
                    'hsn_sac': hsn,
                    'description': item.description,
                    'total_qty': Decimal('0.00'),
                    'taxable_amount': Decimal('0.00'),
                    'cgst_amount': Decimal('0.00'),
                    'sgst_amount': Decimal('0.00'),
                    'igst_amount': Decimal('0.00'),
                    'total_amount': Decimal('0.00'),
                }
            hsn_map[hsn]['total_qty'] += item.quantity
            hsn_map[hsn]['taxable_amount'] += item.taxable_value
            hsn_map[hsn]['cgst_amount'] += item.cgst_amount
            hsn_map[hsn]['sgst_amount'] += item.sgst_amount
            hsn_map[hsn]['igst_amount'] += item.igst_amount
            hsn_map[hsn]['total_amount'] += item.total_amount

        hsn_rows = [{
            'hsn_sac': v['hsn_sac'],
            'description': v['description'],
            'total_qty': float(v['total_qty']),
            'taxable_amount': float(v['taxable_amount']),
            'cgst_amount': float(v['cgst_amount']),
            'sgst_amount': float(v['sgst_amount']),
            'igst_amount': float(v['igst_amount']),
            'total_amount': float(v['total_amount']),
        } for v in hsn_map.values()]

        return {
            'start_date': str(start_date),
            'end_date': str(end_date),
            'output_gst': {
                'taxable_amount': round(output_taxable, 2),
                'cgst': round(output_cgst, 2),
                'sgst': round(output_sgst, 2),
                'igst': round(output_igst, 2),
                'total_tax': round(output_total_tax, 2),
                'gross_sales': round(output_gross, 2),
            },
            'input_gst': {
                'taxable_amount': round(input_taxable, 2),
                'cgst': round(input_cgst, 2),
                'sgst': round(input_sgst, 2),
                'igst': round(input_igst, 2),
                'total_tax': round(input_tax, 2),
                'gross_purchases': round(input_total, 2),
            },
            'net_gst': {
                'cgst': net_cgst,
                'sgst': net_sgst,
                'igst': net_igst,
                'total_payable': net_total,
            },
            'hsn_summary': hsn_rows,
        }

    # ------------------------------------------------------------------
    # PROFIT & LOSS REPORT
    # ------------------------------------------------------------------
    @staticmethod
    def get_profit_and_loss_report(start_date=None, end_date=None):
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)

        # 1. SALES REVENUE (Gross & Taxable)
        invoices = Invoice.objects.filter(
            invoice_date__gte=start_date,
            invoice_date__lte=end_date,
            invoice_status='POSTED'
        )

        gross_sales_taxable = invoices.aggregate(sum=Sum('taxable_amount'))['sum'] or Decimal('0.00')
        tax_agg = invoices.aggregate(cgst=Sum('total_cgst'), sgst=Sum('total_sgst'), igst=Sum('total_igst'))
        total_tax_collected = (tax_agg['cgst'] or Decimal('0.00')) + \
                              (tax_agg['sgst'] or Decimal('0.00')) + \
                              (tax_agg['igst'] or Decimal('0.00'))
        gross_sales_invoiced = invoices.aggregate(sum=Sum('grand_total'))['sum'] or Decimal('0.00')

        # 2. SALES RETURNS during period
        sales_return_movements = StockMovement.objects.filter(
            movement_type='SALES_RETURN',
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        sales_returns_taxable = sum(
            Decimal(str(m.quantity)) * (m.unit_price if m.unit_price > Decimal('0.00') else Decimal('0.00'))
            for m in sales_return_movements
        )
        sales_returns_cost = sum(
            Decimal(str(m.quantity)) * (m.unit_cost if m.unit_cost > Decimal('0.00') else m.product.purchase_price)
            for m in sales_return_movements
        )
        sales_returns_gst = sum(
            Decimal(str(m.quantity)) * ((m.unit_price * (m.product.gst_rate if m.product else Decimal('18.00'))) / Decimal('100'))
            for m in sales_return_movements
        )

        net_sales_taxable = max(Decimal('0.00'), gross_sales_taxable - sales_returns_taxable)
        net_output_tax = max(Decimal('0.00'), total_tax_collected - sales_returns_gst)

        # 3. TRADING ACCOUNT / INVENTORY VALUATION RECONCILIATION
        products = Product.objects.filter(is_stock_enabled=True)

        opening_inventory = Decimal('0.00')
        closing_inventory = Decimal('0.00')

        for p in products:
            p_movements = p.stock_movements.all()
            # Movements strictly before start_date
            before_moves = p_movements.filter(created_at__date__lt=start_date)
            in_before = sum(m.quantity for m in before_moves if m.movement_type in ['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN'])
            out_before = sum(m.quantity for m in before_moves if m.movement_type in ['SALE', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT'])
            p_opening_qty = max(0, in_before - out_before)
            opening_inventory += Decimal(str(p_opening_qty)) * p.purchase_price

            # Movements up to end_date
            upto_moves = p_movements.filter(created_at__date__lte=end_date)
            in_upto = sum(m.quantity for m in upto_moves if m.movement_type in ['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN'])
            out_upto = sum(m.quantity for m in upto_moves if m.movement_type in ['SALE', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT'])
            p_closing_qty = max(0, in_upto - out_upto)
            closing_inventory += Decimal(str(p_closing_qty)) * p.purchase_price

        # Purchases in period (Taxable cost)
        purchases = Purchase.objects.filter(purchase_date__gte=start_date, purchase_date__lte=end_date)
        purch_agg = purchases.aggregate(total=Sum('total_amount'), tax=Sum('tax_amount'))
        purchases_gross = purch_agg['total'] or Decimal('0.00')
        input_gst_purchases = purch_agg['tax'] or Decimal('0.00')
        purchases_taxable = purchases_gross - input_gst_purchases

        # Purchase returns in period
        pur_return_movements = StockMovement.objects.filter(
            movement_type='PURCHASE_RETURN',
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        purchase_returns_cost = sum(
            Decimal(str(m.quantity)) * (m.unit_cost if m.unit_cost > Decimal('0.00') else m.product.purchase_price)
            for m in pur_return_movements
        )
        purchase_returns_tax = sum(
            Decimal(str(m.quantity)) * (((m.unit_cost if m.unit_cost > Decimal('0.00') else m.product.purchase_price) * (m.product.gst_rate if m.product else Decimal('18.00'))) / Decimal('100'))
            for m in pur_return_movements
        )

        goods_available_for_sale = opening_inventory + purchases_taxable - purchase_returns_cost

        # 4. COGS based on sold product units (minus returned product units)
        invoice_items = InvoiceItem.objects.filter(
            invoice__invoice_date__gte=start_date,
            invoice__invoice_date__lte=end_date,
            invoice__invoice_status='POSTED',
            item_type='PRODUCT',
            product__isnull=False
        ).select_related('product')

        gross_sold_cost = Decimal('0.00')
        for item in invoice_items:
            unit_cost = item.unit_cost if item.unit_cost > Decimal('0.00') else item.product.purchase_price
            gross_sold_cost += (unit_cost * item.quantity)

        cogs = max(Decimal('0.00'), gross_sold_cost - sales_returns_cost)

        # 5. PROFITABILITY
        gross_profit = net_sales_taxable - cogs

        expenses = Expense.objects.filter(expense_date__gte=start_date, expense_date__lte=end_date)
        total_operating_expenses = expenses.aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        expense_breakdown = []
        from django.db.models import Sum as _Sum
        cats = expenses.values('category__name').annotate(total=_Sum('amount')).order_by('-total')
        for c in cats:
            expense_breakdown.append({
                'category': c['category__name'] or 'Uncategorized',
                'total': float(c['total'] or 0),
            })

        net_profit = gross_profit - total_operating_expenses

        # 6. TAX POSITION (Output vs Input)
        net_input_tax = max(Decimal('0.00'), input_gst_purchases - purchase_returns_tax)
        net_gst_position = net_output_tax - net_input_tax

        # 7. CASH FLOW (Monetary movements in period)
        # Store Inflow: Customer payments direct to store + Partner handovers/deposits to store
        total_store_customer_receipts = Payment.objects.filter(
            payment_date__gte=start_date,
            payment_date__lte=end_date,
            partner_allocation_json__isnull=True
        ).exclude(payment_mode='CREDIT').aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        total_partner_customer_collections = Payment.objects.filter(
            payment_date__gte=start_date,
            payment_date__lte=end_date,
            partner_allocation_json__isnull=False
        ).exclude(payment_mode='CREDIT').aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        total_customer_receipts = total_store_customer_receipts + total_partner_customer_collections

        total_partner_deposits = PartnerDeposit.objects.filter(
            deposit_date__gte=start_date,
            deposit_date__lte=end_date
        ).aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        total_supplier_payouts = SupplierPayment.objects.filter(
            payment_date__gte=start_date,
            payment_date__lte=end_date
        ).exclude(payment_mode='CREDIT').aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        total_business_expenses = Expense.objects.filter(
            expense_date__gte=start_date,
            expense_date__lte=end_date,
            paid_by_partner__isnull=True
        ).exclude(payment_mode='PARTNER_OUT_OF_POCKET').aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        total_partner_drawings = PartnerDrawings.objects.filter(
            drawing_date__gte=start_date,
            drawing_date__lte=end_date
        ).aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')

        store_monetary_inflow = total_store_customer_receipts + total_partner_deposits
        store_monetary_outflow = total_supplier_payouts + total_business_expenses + total_partner_drawings
        store_net_cash_flow = store_monetary_inflow - store_monetary_outflow

        # Total net cash flow across business
        net_cash_flow = total_customer_receipts - store_monetary_outflow

        gross_margin_pct = round(float((gross_profit / net_sales_taxable) * 100), 2) if net_sales_taxable else 0.0
        net_margin_pct = round(float((net_profit / net_sales_taxable) * 100), 2) if net_sales_taxable else 0.0

        return {
            'start_date': str(start_date),
            'end_date': str(end_date),

            # Revenue
            'gross_sales': float(gross_sales_invoiced),
            'gross_sales_taxable': float(gross_sales_taxable),
            'sales_taxable_revenue': float(net_sales_taxable),
            'sales_returns_taxable': float(sales_returns_taxable),
            'net_sales_revenue': float(net_sales_taxable),
            'tax_collected': float(total_tax_collected),
            'sales_returns_gst': float(sales_returns_gst),
            'net_output_gst': float(net_output_tax),

            # Trading Account / Inventory Valuation Reconciliation
            'opening_inventory': float(round(opening_inventory, 2)),
            'purchases_gross': float(round(purchases_gross, 2)),
            'purchases_taxable': float(round(purchases_taxable, 2)),
            'purchases_gst': float(round(input_gst_purchases, 2)),
            'purchase_returns_taxable': float(round(purchase_returns_cost, 2)),
            'goods_available_for_sale': float(round(goods_available_for_sale, 2)),
            'closing_inventory': float(round(closing_inventory, 2)),
            'cost_of_goods_sold': float(round(cogs, 2)),

            # Profitability
            'gross_profit': float(round(gross_profit, 2)),
            'gross_margin_pct': gross_margin_pct,
            'operating_expenses': float(round(total_operating_expenses, 2)),
            'expense_breakdown': expense_breakdown,
            'net_profit': float(round(net_profit, 2)),
            'net_margin_pct': net_margin_pct,

            # Tax
            'output_gst': float(round(net_output_tax, 2)),
            'input_gst': float(round(net_input_tax, 2)),
            'net_gst_payable': float(round(net_gst_position, 2)),

            # Cash Flow
            'total_customer_receipts': float(round(total_customer_receipts, 2)),
            'store_customer_receipts': float(round(total_store_customer_receipts, 2)),
            'partner_customer_collections': float(round(total_partner_customer_collections, 2)),
            'partner_deposits_to_store': float(round(total_partner_deposits, 2)),
            'total_supplier_payouts': float(round(total_supplier_payouts, 2)),
            'total_operating_cash_expenses': float(round(total_business_expenses, 2)),
            'total_partner_drawings': float(round(total_partner_drawings, 2)),
            'store_net_cash_flow': float(round(store_net_cash_flow, 2)),
            'net_cash_flow': float(round(net_cash_flow, 2)),
        }

    # ------------------------------------------------------------------
    # ACCOUNTING RECONCILIATION DIAGNOSTIC
    # ------------------------------------------------------------------
    @staticmethod
    def get_accounting_reconciliation(start_date=None, end_date=None):
        """
        Diagnostic calculation returning comprehensive 14-point reconciliation
        between Inventory Movements, P&L, Tax Liabilities, and Working Capital.
        """
        pnl = ReportsService.get_profit_and_loss_report(start_date, end_date)

        opening_inv = pnl['opening_inventory']
        purchases = pnl['purchases_taxable']
        pur_returns = pnl['purchase_returns_taxable']
        avail_inv = pnl['goods_available_for_sale']
        closing_inv = pnl['closing_inventory']
        cogs = pnl['cost_of_goods_sold']

        sales_before_gst = pnl['gross_sales_taxable']
        sales_returns = pnl['sales_returns_taxable']
        net_sales = pnl['net_sales_revenue']

        output_gst = pnl['output_gst']
        input_gst = pnl['input_gst']
        operating_expenses = pnl['operating_expenses']
        gross_profit = pnl['gross_profit']
        net_profit = pnl['net_profit']

        # Balance validations
        trading_cogs = round(avail_inv - closing_inv, 2)
        inv_diff = round(abs(trading_cogs - cogs), 2)
        profit_diff = round(abs((net_sales - cogs - operating_expenses) - net_profit), 2)
        is_balanced = (inv_diff <= 0.05) and (profit_diff <= 0.05)

        return {
            'start_date': pnl['start_date'],
            'end_date': pnl['end_date'],
            'opening_inventory': opening_inv,
            'purchases': purchases,
            'purchase_returns': pur_returns,
            'available_inventory': avail_inv,
            'closing_inventory': closing_inv,
            'cogs': cogs,
            'trading_account_cogs': trading_cogs,
            'detailed_sold_cogs': cogs,
            'cogs_difference': inv_diff,
            'sales_before_gst': sales_before_gst,
            'sales_returns': sales_returns,
            'net_sales': net_sales,
            'output_gst': output_gst,
            'input_gst': input_gst,
            'operating_expenses': operating_expenses,
            'gross_profit': gross_profit,
            'net_profit': net_profit,
            'is_balanced': is_balanced,
            'inventory_reconciliation_variance': inv_diff,
            'profit_reconciliation_variance': profit_diff,
        }

    # ------------------------------------------------------------------
    # INVENTORY VALUATION (existing, kept for backward compat)
    # ------------------------------------------------------------------
    @staticmethod
    def get_inventory_valuation_report():
        products = Product.objects.filter(is_stock_enabled=True, is_active=True).select_related('category')
        report = []
        total_valuation = Decimal('0.00')

        for p in products:
            qty = p.get_current_stock()
            val = qty * p.purchase_price
            total_valuation += val
            report.append({
                'product_id': p.id,
                'name': p.name,
                'sku': p.sku,
                'category': p.category.name if p.category else 'General',
                'tracking_type': p.tracking_type,
                'current_stock': qty,
                'unit_purchase_price': float(p.purchase_price),
                'selling_price': float(p.selling_price),
                'total_valuation': float(val),
            })

        return {
            'total_stock_valuation': float(total_valuation),
            'products': report,
        }

    # ------------------------------------------------------------------
    # GST HSN SUMMARY (existing, kept for backward compat)
    # ------------------------------------------------------------------
    @staticmethod
    def get_gst_hsn_summary_report(start_date=None, end_date=None):
        start_date, end_date = ReportsService._parse_dates(start_date, end_date)

        invoice_items = InvoiceItem.objects.filter(
            invoice__invoice_date__gte=start_date,
            invoice__invoice_date__lte=end_date,
            invoice__invoice_status='POSTED'
        )

        hsn_map = {}
        for item in invoice_items:
            hsn = item.hsn_sac or 'OTHER'
            if hsn not in hsn_map:
                hsn_map[hsn] = {
                    'hsn_sac': hsn,
                    'description': item.description,
                    'total_qty': Decimal('0.00'),
                    'taxable_amount': Decimal('0.00'),
                    'cgst_amount': Decimal('0.00'),
                    'sgst_amount': Decimal('0.00'),
                    'igst_amount': Decimal('0.00'),
                    'total_amount': Decimal('0.00'),
                }
            hsn_map[hsn]['total_qty'] += item.quantity
            hsn_map[hsn]['taxable_amount'] += item.taxable_value
            hsn_map[hsn]['cgst_amount'] += item.cgst_amount
            hsn_map[hsn]['sgst_amount'] += item.sgst_amount
            hsn_map[hsn]['igst_amount'] += item.igst_amount
            hsn_map[hsn]['total_amount'] += item.total_amount

        return list(hsn_map.values())
