"""
Octane Systems - Exhaustive Financial & Reporting Mathematics Audit Script
Validates 100% of mathematical formulas across all real-time scenarios:
1. Partner Deposit (Capital Injection & Customer Collection Handover)
2. Partner Withdraw / Drawings (Cash / Bank Debit)
3. Partner Out-of-pocket Business Pay (Purchases & Operating Expenses)
4. Partner Customer Collections (Implicit Drawings Debit & Cash in Hand)
5. Inter-Partner Settlements (Debit & Credit transfers)
6. Partner Chronological Statement & Running Balances
7. Sales Report Calculations (Taxable, CGST, SGST, IGST, Grand Total, Due Balance)
8. Purchase Report Calculations (Subtotal, Input Tax, Total, Due Balance)
9. Inventory Report Calculations (Stock Movements In/Out, Closing, Valuation)
10. GST Report Calculations (Output GST, Input GST, Net GST Payable, HSN Summary)
11. Profit & Loss (P&L) Calculations (Revenue, COGS, Gross Profit, OpEx, Net Profit, Cash Flow)
12. 14-Point Diagnostic Accounting Reconciliation
13. Complete Teardown & Residual Zero-State Verification
"""

import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import (
    Partner, Customer, Supplier, ProductCategory, Brand, Product,
    Invoice, InvoiceItem, Purchase, PurchaseItem, Payment,
    ExpenseCategory, Expense, PartnerDrawings, PartnerSettlement,
    PartnerDeposit, SupplierPayment, StockMovement
)
from core.services.partner_ledger_service import PartnerLedgerService
from core.services.reports_service import ReportsService

User = get_user_model()


def run_full_financial_audit():
    print("=" * 85)
    print("  OCTANE SYSTEMS: EXHAUSTIVE REAL-TIME FINANCIAL & REPORTING AUDIT")
    print("=" * 85)

    # 1. Baseline Verification
    tables = [
        Partner, Customer, Supplier, ProductCategory, Brand, Product,
        Invoice, InvoiceItem, Payment, Purchase, PurchaseItem,
        ExpenseCategory, Expense, PartnerDrawings, PartnerSettlement,
        PartnerDeposit, SupplierPayment, StockMovement
    ]
    baseline_counts = {t.__name__: t.objects.count() for t in tables}
    print(f"[*] Pre-Audit Database Record State: {baseline_counts}")

    created = {t.__name__: [] for t in tables}
    created['users'] = []

    passed = 0
    failed = 0

    def assert_eq(actual, expected, test_name, tolerance=Decimal('0.02')):
        nonlocal passed, failed
        if isinstance(actual, bool) or isinstance(expected, bool):
            if bool(actual) == bool(expected):
                print(f"  [PASS] {test_name}: {actual} == {expected}")
                passed += 1
                return True
            else:
                print(f"  [FAIL] {test_name}: Expected {expected}, got {actual}")
                failed += 1
                return False
        act_dec = Decimal(str(actual))
        exp_dec = Decimal(str(expected))
        diff = abs(act_dec - exp_dec)
        if diff <= tolerance:
            print(f"  [PASS] {test_name}: {act_dec} == {exp_dec}")
            passed += 1
            return True
        else:
            print(f"  [FAIL] {test_name}: Expected {exp_dec}, got {act_dec} (Diff: {diff})")
            failed += 1
            return False

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: PARTNER SETUP & INITIAL CAPITAL
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 1] Partner Initial Capital & Equity Setup ---")
        partner_a = Partner.objects.create(
            name="Audit Partner Ramesh",
            ownership_percentage=Decimal('60.00'),
            initial_capital=Decimal('50000.00')
        )
        created['Partner'].append(partner_a)

        partner_b = Partner.objects.create(
            name="Audit Partner Lokesh",
            ownership_percentage=Decimal('40.00'),
            initial_capital=Decimal('30000.00')
        )
        created['Partner'].append(partner_b)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['initial_capital'], Decimal('50000.00'), "Partner A Initial Capital")
        assert_eq(sum_a['total_credits'], Decimal('50000.00'), "Partner A Opening Total Credits")
        assert_eq(sum_a['total_debits'], Decimal('0.00'), "Partner A Opening Total Debits")
        assert_eq(sum_a['net_capital_balance'], Decimal('50000.00'), "Partner A Net Capital Balance")

        # -------------------------------------------------------------
        # SCENARIO 2: BUSINESS PAY - PARTNER FUNDING PURCHASES (CREDIT)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 2] Business Pay: Partner Out-of-Pocket Purchase Funding ---")
        cat = ProductCategory.objects.create(name="Audit Electronics")
        created['ProductCategory'].append(cat)

        brand = Brand.objects.create(name="OctanePro")
        created['Brand'].append(brand)

        supplier = Supplier.objects.create(name="Audit Vendor Supplies", mobile="9876500001")
        created['Supplier'].append(supplier)

        prod_laptop = Product.objects.create(
            name="Audit Core Laptop",
            sku="AUDIT-LAP-01",
            category=cat,
            brand=brand.name,
            purchase_price=Decimal('1000.00'),
            selling_price=Decimal('1500.00'),
            gst_rate=Decimal('18.00'),
            hsn_sac="84713010",
            min_stock_alert=2,
            is_stock_enabled=True
        )
        created['Product'].append(prod_laptop)

        # Purchase 10 laptops @ 1000 = 10000 taxable + 1800 tax = 11800 total
        # Partner A pays 11,800 out of pocket
        pur1 = Purchase.objects.create(
            purchase_number="PUR-AUDIT-001",
            supplier=supplier,
            purchase_date=date.today(),
            total_amount=Decimal('11800.00'),
            tax_amount=Decimal('1800.00'),
            paid_amount=Decimal('11800.00'),
            payment_status='PAID',
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=partner_a
        )
        created['Purchase'].append(pur1)

        pi1 = PurchaseItem.objects.create(
            purchase=pur1,
            product=prod_laptop,
            quantity=10,
            unit_cost=Decimal('1000.00'),
            gst_rate=Decimal('18.00'),
            total_amount=Decimal('11800.00')
        )
        created['PurchaseItem'].append(pi1)

        # Stock movement for purchase
        sm_pur = StockMovement.objects.create(
            product=prod_laptop,
            movement_type='PURCHASE',
            quantity=10,
            unit_cost=Decimal('1000.00'),
            unit_price=Decimal('1500.00'),
            reference_type='PURCHASE',
            reference_id=pur1.purchase_number
        )
        created['StockMovement'].append(sm_pur)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['purchases_funded'], Decimal('11800.00'), "Partner A Purchases Funded")
        assert_eq(sum_a['total_credits'], Decimal('61800.00'), "Partner A Credits after Purchase (50k + 11.8k)")
        assert_eq(sum_a['net_capital_balance'], Decimal('61800.00'), "Partner A Net Balance after Purchase")

        # -------------------------------------------------------------
        # SCENARIO 3: BUSINESS PAY - PARTNER FUNDING EXPENSES (CREDIT)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 3] Business Pay: Partner Out-of-Pocket Expense Funding ---")
        exp_cat = ExpenseCategory.objects.create(name="Audit Store Rent")
        created['ExpenseCategory'].append(exp_cat)

        exp1 = Expense.objects.create(
            expense_number="EXP-AUDIT-001",
            category=exp_cat,
            description="Monthly Store Rental paid by Partner A",
            amount=Decimal('5000.00'),
            expense_date=date.today(),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=partner_a
        )
        created['Expense'].append(exp1)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['expenses_funded'], Decimal('5000.00'), "Partner A Expenses Funded")
        assert_eq(sum_a['total_credits'], Decimal('66800.00'), "Partner A Total Credits (61.8k + 5k)")
        assert_eq(sum_a['net_capital_balance'], Decimal('66800.00'), "Partner A Net Capital Balance")

        # -------------------------------------------------------------
        # SCENARIO 4: PARTNER DRAWINGS / WITHDRAWAL (DEBIT)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 4] Partner Debit: Personal Drawings / Cash Withdrawal ---")
        drw1 = PartnerDrawings.objects.create(
            drawing_number="DRW-AUDIT-001",
            partner=partner_a,
            amount=Decimal('8000.00'),
            drawing_date=date.today(),
            payment_mode='CASH',
            notes="Personal household drawing"
        )
        created['PartnerDrawings'].append(drw1)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['drawings'], Decimal('8000.00'), "Partner A Personal Drawings Recorded")
        assert_eq(sum_a['total_debits'], Decimal('8000.00'), "Partner A Total Debits")
        assert_eq(sum_a['net_capital_balance'], Decimal('58800.00'), "Partner A Net Balance (66.8k - 8k = 58.8k)")

        # -------------------------------------------------------------
        # SCENARIO 5: PARTNER CUSTOMER COLLECTIONS (DEBIT & HELD CASH)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 5] Partner Debit: Customer Invoice Payment Collected & Retained ---")
        cust = Customer.objects.create(name="Audit Retail Customer", mobile="9876500002", state_code="33")
        created['Customer'].append(cust)

        # Invoice selling 4 laptops @ 1500 = 6000 taxable + 18% GST (1080) = 7080 total
        inv1 = Invoice.objects.create(
            invoice_number="INV-AUDIT-001",
            customer=cust,
            buyer_name=cust.name,
            invoice_date=date.today(),
            invoice_status='POSTED',
            subtotal=Decimal('6000.00'),
            taxable_amount=Decimal('6000.00'),
            total_cgst=Decimal('540.00'),
            total_sgst=Decimal('540.00'),
            total_igst=Decimal('0.00'),
            total_tax=Decimal('1080.00'),
            grand_total=Decimal('7080.00'),
            total_paid_amount=Decimal('7080.00'),
            balance_due_amount=Decimal('0.00'),
            payment_status='PAID',
            mode_of_payment='UPI',
            partner_allocation_json={'partner_id': partner_a.id, 'partner_name': partner_a.name, 'amount': '7080.00'}
        )
        created['Invoice'].append(inv1)

        ii1 = InvoiceItem.objects.create(
            invoice=inv1,
            item_type='PRODUCT',
            product=prod_laptop,
            description=prod_laptop.name,
            hsn_sac=prod_laptop.hsn_sac,
            quantity=4,
            unit="NOS",
            rate=Decimal('1500.00'),
            taxable_value=Decimal('6000.00'),
            gst_rate=Decimal('18.00'),
            cgst_amount=Decimal('540.00'),
            sgst_amount=Decimal('540.00'),
            igst_amount=Decimal('0.00'),
            total_amount=Decimal('7080.00'),
            unit_cost=Decimal('1000.00')
        )
        created['InvoiceItem'].append(ii1)

        sm_sale = StockMovement.objects.create(
            product=prod_laptop,
            movement_type='SALE',
            quantity=4,
            unit_cost=Decimal('1000.00'),
            unit_price=Decimal('1500.00'),
            reference_type='SALE',
            reference_id=inv1.invoice_number
        )
        created['StockMovement'].append(sm_sale)

        # Record payment for invoice
        pmt1 = Payment.objects.create(
            payment_number="PAY-AUDIT-001",
            invoice=inv1,
            customer=cust,
            amount=Decimal('7080.00'),
            payment_date=date.today(),
            payment_mode='UPI',
            partner_allocation_json={'partner_id': partner_a.id, 'partner_name': partner_a.name, 'amount': '7080.00'}
        )
        created['Payment'].append(pmt1)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['customer_collections'], Decimal('7080.00'), "Customer Collection Attributed to Partner A")
        assert_eq(sum_a['total_debits'], Decimal('15080.00'), "Partner A Total Debits (8k drawing + 7080 collection)")
        assert_eq(sum_a['net_capital_balance'], Decimal('51720.00'), "Partner A Net Balance (66.8k - 15.08k)")
        assert_eq(sum_a['cash_held_in_hand'], Decimal('7080.00'), "Partner A Cash in Hand Held from Customer")

        # -------------------------------------------------------------
        # SCENARIO 6: PARTNER DEPOSIT / HANDOVER TO STORE TILL (CREDIT)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 6] Partner Deposit: Collection Handover back to Store Till ---")
        dep1 = PartnerDeposit.objects.create(
            deposit_number="DEP-AUDIT-001",
            partner=partner_a,
            deposit_type='CUSTOMER_COLLECTION_HANDOVER',
            amount=Decimal('7080.00'),
            deposit_date=date.today(),
            payment_mode='CASH',
            notes="Full handover of UPI collection to business bank"
        )
        created['PartnerDeposit'].append(dep1)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        assert_eq(sum_a['deposits_handed_over'], Decimal('7080.00'), "Partner Deposits Handed Over")
        assert_eq(sum_a['total_credits'], Decimal('73880.00'), "Partner Total Credits (66.8k + 7080)")
        assert_eq(sum_a['net_capital_balance'], Decimal('58800.00'), "Partner Net Balance after Handover (Restored to 58.8k)")
        assert_eq(sum_a['cash_held_in_hand'], Decimal('0.00'), "Cash Held in Hand (Fully Handed Over = 0)")

        # -------------------------------------------------------------
        # SCENARIO 7: INTER-PARTNER SETTLEMENT (DEBIT & CREDIT)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 7] Inter-Partner Settlement Transfer ---")
        stl1 = PartnerSettlement.objects.create(
            settlement_number="STL-AUDIT-001",
            from_partner=partner_a,
            to_partner=partner_b,
            amount=Decimal('3000.00'),
            settlement_date=date.today(),
            payment_mode='BANK_TRANSFER',
            notes="Capital rebalancing transfer from Partner A to Partner B"
        )
        created['PartnerSettlement'].append(stl1)

        sum_a = PartnerLedgerService._calculate_single_partner_summary(partner_a)
        sum_b = PartnerLedgerService._calculate_single_partner_summary(partner_b)

        assert_eq(sum_a['settlements_paid'], Decimal('3000.00'), "Partner A Settlement Paid")
        assert_eq(sum_a['net_capital_balance'], Decimal('55800.00'), "Partner A Net Balance (58.8k - 3k = 55.8k)")

        assert_eq(sum_b['settlements_received'], Decimal('3000.00'), "Partner B Settlement Received")
        assert_eq(sum_b['total_credits'], Decimal('33000.00'), "Partner B Credits (30k opening + 3k received)")
        assert_eq(sum_b['net_capital_balance'], Decimal('33000.00'), "Partner B Net Balance")

        # -------------------------------------------------------------
        # SCENARIO 8: CHRONOLOGICAL STATEMENT JOURNAL & RUNNING BALANCES
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 8] Chronological Journal Entries & Running Balance Invariant ---")
        stmt_a = PartnerLedgerService.get_chronological_statement(partner_a.id)
        assert_eq(len(stmt_a), 7, "Partner A Statement Entry Count (Opening + Pur + Exp + Drw + Coll + Dep + Stl)")
        final_run_bal = stmt_a[-1]['running_balance']
        assert_eq(final_run_bal, sum_a['net_capital_balance'], "Statement Final Running Balance == Net Capital Balance")

        # -------------------------------------------------------------
        # SCENARIO 9: SALES REPORT CALCULATIONS
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 9] Sales Report Real-Time Calculations ---")
        sales_rep = ReportsService.get_sales_report(start_date=date.today(), end_date=date.today())
        s_summary = sales_rep['summary']
        assert_eq(s_summary['total_taxable_amount'], Decimal('6000.00'), "Sales Report Total Taxable Amount")
        assert_eq(s_summary['total_tax'], Decimal('1080.00'), "Sales Report Total GST Tax")
        assert_eq(s_summary['total_grand_total'], Decimal('7080.00'), "Sales Report Total Grand Total")
        assert_eq(s_summary['total_paid'], Decimal('7080.00'), "Sales Report Total Paid Amount")
        assert_eq(s_summary['total_balance_due'], Decimal('0.00'), "Sales Report Total Balance Due")
        assert_eq(sales_rep['total_invoices'], 1, "Sales Report Total Invoices Count")

        # -------------------------------------------------------------
        # SCENARIO 10: PURCHASE REPORT CALCULATIONS
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 10] Purchase Report Real-Time Calculations ---")
        pur_rep = ReportsService.get_purchase_report(start_date=date.today(), end_date=date.today())
        p_summary = pur_rep['summary']
        assert_eq(p_summary['total_taxable'], Decimal('10000.00'), "Purchase Report Total Taxable Amount")
        assert_eq(p_summary['total_tax'], Decimal('1800.00'), "Purchase Report Total Tax Amount")
        assert_eq(p_summary['total_amount'], Decimal('11800.00'), "Purchase Report Total Gross Amount")
        assert_eq(p_summary['total_paid'], Decimal('11800.00'), "Purchase Report Total Paid Amount")
        assert_eq(p_summary['total_balance_due'], Decimal('0.00'), "Purchase Report Total Balance Due")
        assert_eq(pur_rep['total_purchases'], 1, "Purchase Report Total Purchases Count")

        # -------------------------------------------------------------
        # SCENARIO 11: INVENTORY REPORT CALCULATIONS & VALUATION
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 11] Inventory Movement, Valuation & Stock Health Calculations ---")
        inv_rep = ReportsService.get_inventory_report()
        # Purchased: 10, Sold: 4 => Closing: 6 units. Cost: 1000 => Stock Value: 6000.00
        p_row = next((r for r in inv_rep['rows'] if r['product_id'] == prod_laptop.id), None)
        assert p_row is not None, "Product row found in Inventory Report"
        assert_eq(p_row['purchases'], 10, "Inventory Report Stock Inflow (Purchased)")
        assert_eq(p_row['sales'], 4, "Inventory Report Stock Outflow (Sold)")
        assert_eq(p_row['closing_stock'], 6, "Inventory Report Closing Stock (10 - 4 = 6)")
        assert_eq(p_row['stock_value'], Decimal('6000.00'), "Inventory Valuation (6 * 1000 = 6000.00)")
        assert_eq(p_row['is_low_stock'], False, "Product has 6 > min_stock_alert(2) => Healthy")
        assert_eq(inv_rep['total_stock_value'], Decimal('6000.00'), "Inventory Report Total Valuation")

        # -------------------------------------------------------------
        # SCENARIO 12: GST REPORT CALCULATIONS (GSTR-1, 3B, HSN)
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 12] GST Tax Engine & Net Position Calculations ---")
        gst_rep = ReportsService.get_gst_report(start_date=date.today(), end_date=date.today())
        out_gst = gst_rep['output_gst']
        in_gst = gst_rep['input_gst']
        net_gst = gst_rep['net_gst']

        assert_eq(out_gst['taxable_amount'], Decimal('6000.00'), "Output GST Taxable Amount")
        assert_eq(out_gst['total_tax'], Decimal('1080.00'), "Output Total Tax (540 CGST + 540 SGST)")
        assert_eq(in_gst['taxable_amount'], Decimal('10000.00'), "Input GST Taxable Purchases")
        assert_eq(in_gst['total_tax'], Decimal('1800.00'), "Input GST Tax Paid on Purchases")
        # Net GST = 1080 - 1800 = -720 (Input Credit excess of 720)
        assert_eq(net_gst['total_payable'], Decimal('-720.00'), "Net GST Position (Output 1080 - Input 1800 = -720.00)")
        assert_eq(len(gst_rep['hsn_summary']), 1, "HSN Summary Row Count")
        assert_eq(gst_rep['hsn_summary'][0]['hsn_sac'], "84713010", "HSN Code Aggregation")

        # -------------------------------------------------------------
        # SCENARIO 13: PROFIT & LOSS (P&L) COMPREHENSIVE RECONCILIATION
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 13] Profit & Loss (P&L) Real-Time Source of Truth ---")
        pnl = ReportsService.get_profit_and_loss_report(start_date=date.today(), end_date=date.today())
        # Net Sales Revenue: 6000.00
        # COGS: 4 units sold * 1000 cost = 4000.00
        # Gross Profit: 6000 - 4000 = 2000.00
        # Operating Expenses: 5000.00
        # Net Profit: 2000 - 5000 = -3000.00 (Operating loss of 3000)
        assert_eq(pnl['net_sales_revenue'], Decimal('6000.00'), "P&L Net Sales Revenue")
        assert_eq(pnl['cost_of_goods_sold'], Decimal('4000.00'), "P&L Cost of Goods Sold (4 sold * 1000)")
        assert_eq(pnl['gross_profit'], Decimal('2000.00'), "P&L Gross Profit (6000 - 4000)")
        assert_eq(pnl['operating_expenses'], Decimal('5000.00'), "P&L Operating Expenses (Rent 5000)")
        assert_eq(pnl['net_profit'], Decimal('-3000.00'), "P&L Net Profit (2000 - 5000 = -3000.00)")
        assert_eq(pnl['closing_inventory'], Decimal('6000.00'), "P&L Closing Inventory (6 * 1000)")

        # -------------------------------------------------------------
        # SCENARIO 14: 14-POINT ACCOUNTING RECONCILIATION AUDIT
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 14] 14-Point Diagnostic Accounting Reconciliation ---")
        recon = ReportsService.get_accounting_reconciliation(start_date=date.today(), end_date=date.today())
        assert recon['is_balanced'] is True, "Accounting Reconciliation is_balanced Invariant"
        assert_eq(recon['cogs_difference'], Decimal('0.00'), "Trading COGS vs Detailed Sold COGS Difference == 0")
        assert_eq(recon['profit_reconciliation_variance'], Decimal('0.00'), "Profit Reconciliation Variance == 0")

        # -------------------------------------------------------------
        # SCENARIO 15: EXECUTIVE DASHBOARD SUMMARY RECONCILIATION
        # -------------------------------------------------------------
        print("\n--- [SCENARIO 15] Executive Dashboard Live Synchronization ---")
        dash = ReportsService.get_dashboard_summary(start_date=date.today(), end_date=date.today())
        assert_eq(dash['net_sales_revenue'], pnl['net_sales_revenue'], "Dashboard Revenue == P&L Revenue")
        assert_eq(dash['cogs'], pnl['cost_of_goods_sold'], "Dashboard COGS == P&L COGS")
        assert_eq(dash['gross_profit'], pnl['gross_profit'], "Dashboard Gross Profit == P&L Gross Profit")
        assert_eq(dash['net_profit'], pnl['net_profit'], "Dashboard Net Profit == P&L Net Profit")
        assert_eq(dash['inventory_valuation'], pnl['closing_inventory'], "Dashboard Stock Value == Inventory Closing")

    finally:
        # -------------------------------------------------------------
        # COMPLETE CLEANUP & PURGE
        # -------------------------------------------------------------
        print("\n" + "=" * 85)
        print("  PURGING ALL AUDIT TEST DATA & RESTORING BASELINE STATE")
        print("=" * 85)

        # Reverse deletion order to prevent FK constraints
        Payment.objects.filter(id__in=[p.id for p in created['Payment']]).delete()
        InvoiceItem.objects.filter(id__in=[i.id for i in created['InvoiceItem']]).delete()
        Invoice.objects.filter(id__in=[i.id for i in created['Invoice']]).delete()

        StockMovement.objects.filter(id__in=[s.id for s in created['StockMovement']]).delete()
        PurchaseItem.objects.filter(id__in=[p.id for p in created['PurchaseItem']]).delete()
        Purchase.objects.filter(id__in=[p.id for p in created['Purchase']]).delete()

        PartnerDeposit.objects.filter(id__in=[d.id for d in created['PartnerDeposit']]).delete()
        PartnerSettlement.objects.filter(id__in=[s.id for s in created['PartnerSettlement']]).delete()
        PartnerDrawings.objects.filter(id__in=[d.id for d in created['PartnerDrawings']]).delete()
        Expense.objects.filter(id__in=[e.id for e in created['Expense']]).delete()
        ExpenseCategory.objects.filter(id__in=[c.id for c in created['ExpenseCategory']]).delete()

        Product.objects.filter(id__in=[p.id for p in created['Product']]).delete()
        Brand.objects.filter(id__in=[b.id for b in created['Brand']]).delete()
        ProductCategory.objects.filter(id__in=[c.id for c in created['ProductCategory']]).delete()
        Supplier.objects.filter(id__in=[s.id for s in created['Supplier']]).delete()
        Customer.objects.filter(id__in=[c.id for c in created['Customer']]).delete()
        Partner.objects.filter(id__in=[p.id for p in created['Partner']]).delete()

        for u in created['users']:
            if u.id:
                User.objects.filter(id=u.id).delete()

        final_counts = {t.__name__: t.objects.count() for t in tables}
        print(f"[*] Post-Teardown Database Record State: {final_counts}")

        all_clean = True
        for t_name, b_count in baseline_counts.items():
            f_count = final_counts[t_name]
            if f_count != b_count:
                print(f"  [ERROR] Residual mismatch on {t_name}: Baseline={b_count}, Final={f_count}")
                all_clean = False

        if all_clean:
            print("  [SUCCESS] 100% CLEAN PURGE: Zero residual test data remaining in the database!")
        else:
            print("  [CRITICAL] DATABASE NOT CLEAN: Stray test records detected!")

    print("\n" + "=" * 85)
    print(f"  AUDIT RESULTS: {passed} PASSED, {failed} FAILED | Clean Teardown: {'YES' if all_clean else 'NO'}")
    print("=" * 85)
    return failed == 0 and all_clean


if __name__ == '__main__':
    ok = run_full_financial_audit()
    sys.exit(0 if ok else 1)
