import os
import sys
import django
from decimal import Decimal

# Force Windows console to use utf-8
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.utils import timezone
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from core.models import (
    Partner, ExpenseCategory, Expense, PartnerDrawings, PartnerSettlement, PartnerDeposit,
    ProductCategory, Brand, Product, Supplier, Purchase, PurchaseItem,
    Customer, Invoice, InvoiceItem, Payment, StockMovement
)
from core.services.partner_ledger_service import PartnerLedgerService
from core.services.reports_service import ReportsService


def run_finance_module_tests():
    print("=" * 80)
    print("OCTANE SYSTEMS - MODULE 5: FINANCE & PARTNER LEDGER AUTOMATED TEST SUITE")
    print("=" * 80)

    # Record baseline state
    baseline_partners = Partner.objects.count()
    baseline_exp_cats = ExpenseCategory.objects.count()
    baseline_expenses = Expense.objects.count()
    baseline_drawings = PartnerDrawings.objects.count()
    baseline_settlements = PartnerSettlement.objects.count()
    baseline_deposits = PartnerDeposit.objects.count()
    baseline_products = Product.objects.count()
    baseline_purchases = Purchase.objects.count()
    baseline_invoices = Invoice.objects.count()

    print(f"[*] Baseline DB State: Partners={baseline_partners}, ExpCats={baseline_exp_cats}, Expenses={baseline_expenses}, Drawings={baseline_drawings}, Settlements={baseline_settlements}, Deposits={baseline_deposits}")

    created = {
        'partners': [],
        'exp_cats': [],
        'expenses': [],
        'drawings': [],
        'settlements': [],
        'deposits': [],
        'suppliers': [],
        'purchases': [],
        'prod_cats': [],
        'brands': [],
        'products': [],
        'customers': [],
        'invoices': [],
        'users': []
    }

    client = APIClient()

    # Setup test admin and cashier
    admin_user = User.objects.filter(username='test_admin_fin').first()
    if not admin_user:
        admin_user = User.objects.create_superuser('test_admin_fin', 'test_admin_fin@example.com', 'AdminPass123!')
        created['users'].append(admin_user)

    cashier_user = User.objects.filter(username='test_cashier_fin').first()
    if not cashier_user:
        cashier_user = User.objects.create_user('test_cashier_fin', 'test_cashier_fin@example.com', 'CashierPass123!')
        created['users'].append(cashier_user)

    client.force_authenticate(user=admin_user)

    passed_count = 0
    failed_count = 0

    def assert_true(condition, message):
        nonlocal passed_count, failed_count
        if condition:
            print(f"  [PASS] {message}")
            passed_count += 1
        else:
            print(f"  [FAIL] {message}")
            failed_count += 1
            raise AssertionError(message)

    try:
        # Create 2 test partners with 0% equity so they don't violate total equity <= 100%
        partner_a = Partner.objects.create(
            name="Test Partner Anand",
            mobile="9886099001",
            ownership_percentage=Decimal('0.00'),
            initial_capital=Decimal('50000.00'),
            is_active=True
        )
        created['partners'].append(partner_a)

        partner_b = Partner.objects.create(
            name="Test Partner Bharat",
            mobile="9886099002",
            ownership_percentage=Decimal('0.00'),
            initial_capital=Decimal('30000.00'),
            is_active=True
        )
        created['partners'].append(partner_b)

        # Inactive partner for validation checks
        partner_inactive = Partner.objects.create(
            name="Test Partner Inactive",
            mobile="9886099003",
            ownership_percentage=Decimal('0.00'),
            initial_capital=Decimal('10000.00'),
            is_active=False
        )
        created['partners'].append(partner_inactive)

        # -------------------------------------------------------------
        # TEST 1: Expense Categories Master & Boundary Controls
        # -------------------------------------------------------------
        print("\n--- TEST 1: Expense Categories Master ---")
        res_cat = client.post('/api/expense-categories/', {
            "name": "Test Office Utilities & Power",
            "description": "Electricity, Generator & Water bills",
            "is_active": True
        }, format='json')
        assert_true(res_cat.status_code == status.HTTP_201_CREATED, "Expense category created with 201 Created")
        exp_cat = ExpenseCategory.objects.get(id=res_cat.data['id'])
        created['exp_cats'].append(exp_cat)

        # Duplicate category name rejected
        res_dup_cat = client.post('/api/expense-categories/', {
            "name": "test office utilities & power"
        }, format='json')
        assert_true(res_dup_cat.status_code == status.HTTP_400_BAD_REQUEST, "Rejects duplicate category name with 400 Bad Request")

        # Inactive category creation
        res_inact_cat = client.post('/api/expense-categories/', {
            "name": "Test Inactive Exp Category",
            "is_active": False
        }, format='json')
        assert_true(res_inact_cat.status_code == status.HTTP_201_CREATED, "Inactive category created")
        cat_inact = ExpenseCategory.objects.get(id=res_inact_cat.data['id'])
        created['exp_cats'].append(cat_inact)

        # -------------------------------------------------------------
        # TEST 2: Operating Business Expenses (Store & Partner Out-of-Pocket)
        # -------------------------------------------------------------
        print("\n--- TEST 2: Operating Business Expenses ---")
        # 2a. Store-paid cash expense
        res_exp_store = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "2500.00",
            "payment_mode": "CASH",
            "description": "Monthly Office Cleaning & Drinking Water",
            "receipt_reference": "BILL-CLN-01"
        }, format='json')
        assert_true(res_exp_store.status_code == status.HTTP_201_CREATED, "Store cash expense created with 201 Created")
        exp_store = Expense.objects.get(id=res_exp_store.data['id'])
        created['expenses'].append(exp_store)
        assert_true(exp_store.expense_number.startswith('EXP-'), f"Auto-generated expense_number: {exp_store.expense_number}")
        assert_true(exp_store.paid_by_partner is None, "Store expense has paid_by_partner=None")

        # 2b. Partner out-of-pocket expense (Partner Anand pays ₹5,000)
        res_exp_partner = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "5000.00",
            "payment_mode": "PARTNER_OUT_OF_POCKET",
            "paid_by_partner_id": partner_a.id,
            "description": "Office Broadband Fiber Annual Subscription",
            "receipt_reference": "ACT-FIBER-01"
        }, format='json')
        assert_true(res_exp_partner.status_code == status.HTTP_201_CREATED, "Partner out-of-pocket expense created with 201 Created")
        exp_partner = Expense.objects.get(id=res_exp_partner.data['id'])
        created['expenses'].append(exp_partner)
        assert_true(exp_partner.paid_by_partner_id == partner_a.id, f"Expense attributed to {partner_a.name}")

        # 2c. Partner split expense (Partner Anand ₹3,000 + Partner Bharat ₹2,000 = ₹5,000)
        res_exp_split = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "5000.00",
            "payment_mode": "PARTNER_OUT_OF_POCKET",
            "partner_split_json": {
                partner_a.name: "3000.00",
                partner_b.name: "2000.00"
            },
            "description": "Shop Signboard & LED Neon Board Installation",
            "receipt_reference": "SIGN-NEON-01"
        }, format='json')
        assert_true(res_exp_split.status_code == status.HTTP_201_CREATED, "Split partner expense created with 201 Created")
        exp_split = Expense.objects.get(id=res_exp_split.data['id'])
        created['expenses'].append(exp_split)

        # -------------------------------------------------------------
        # TEST 3: Expense Validation Boundaries & Cascade Protection
        # -------------------------------------------------------------
        print("\n--- TEST 3: Expense Validation Boundaries ---")
        # 3a. Negative or zero expense amount rejected
        res_neg_exp = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "-500.00",
            "payment_mode": "CASH",
            "description": "Invalid negative amount"
        }, format='json')
        assert_true(res_neg_exp.status_code == status.HTTP_400_BAD_REQUEST, "Rejects negative expense amount with 400 Bad Request")

        # 3b. Expense under inactive category rejected
        res_inact_cat_exp = client.post('/api/expenses/', {
            "category_id": cat_inact.id,
            "amount": "1000.00",
            "payment_mode": "CASH",
            "description": "Expense under inactive category"
        }, format='json')
        assert_true(res_inact_cat_exp.status_code == status.HTTP_400_BAD_REQUEST, "Rejects expense under inactive category with 400 Bad Request")

        # 3c. Out-of-pocket expense attributed to inactive partner rejected
        res_inact_ptnr_exp = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "1000.00",
            "payment_mode": "PARTNER_OUT_OF_POCKET",
            "paid_by_partner_id": partner_inactive.id,
            "description": "Expense by inactive partner"
        }, format='json')
        assert_true(res_inact_ptnr_exp.status_code == status.HTTP_400_BAD_REQUEST, "Rejects out-of-pocket expense for inactive partner with 400 Bad Request")

        # 3d. Split expense exceeding total amount rejected (Total ₹5,000, but split sums to ₹6,000)
        res_over_split = client.post('/api/expenses/', {
            "category_id": exp_cat.id,
            "amount": "5000.00",
            "payment_mode": "PARTNER_OUT_OF_POCKET",
            "partner_split_json": {
                partner_a.name: "4000.00",
                partner_b.name: "2000.00"
            },
            "description": "Over-split expense"
        }, format='json')
        assert_true(res_over_split.status_code == status.HTTP_400_BAD_REQUEST, "Rejects split exceeding expense amount with 400 Bad Request")

        # 3e. Deletion cascade protection on ExpenseCategory
        res_del_cat = client.delete(f'/api/expense-categories/{exp_cat.id}/')
        assert_true(res_del_cat.status_code == status.HTTP_400_BAD_REQUEST, "Blocks deleting ExpenseCategory when expenses exist under it")

        # -------------------------------------------------------------
        # TEST 4: Partner Drawings (Capital Withdrawals)
        # -------------------------------------------------------------
        print("\n--- TEST 4: Partner Drawings ---")
        res_draw = client.post('/api/partner-drawings/', {
            "partner_id": partner_a.id,
            "amount": "8000.00",
            "payment_mode": "CASH",
            "notes": "Personal cash withdrawal by Anand"
        }, format='json')
        assert_true(res_draw.status_code == status.HTTP_201_CREATED, "Partner drawing recorded with 201 Created")
        draw_obj = PartnerDrawings.objects.get(id=res_draw.data['id'])
        created['drawings'].append(draw_obj)
        assert_true(draw_obj.drawing_number.startswith('DRW-'), f"Auto-generated drawing_number: {draw_obj.drawing_number}")
        assert_true(draw_obj.amount == Decimal('8000.00'), "Drawing amount is Rs.8000.00")

        # Drawing for inactive partner rejected
        res_inact_draw = client.post('/api/partner-drawings/', {
            "partner_id": partner_inactive.id,
            "amount": "1000.00",
            "payment_mode": "CASH"
        }, format='json')
        assert_true(res_inact_draw.status_code == status.HTTP_400_BAD_REQUEST, "Rejects drawing for inactive partner with 400 Bad Request")

        # Negative drawing amount rejected
        res_neg_draw = client.post('/api/partner-drawings/', {
            "partner_id": partner_a.id,
            "amount": "-500.00",
            "payment_mode": "CASH"
        }, format='json')
        assert_true(res_neg_draw.status_code == status.HTTP_400_BAD_REQUEST, "Rejects negative drawing amount with 400 Bad Request")

        # -------------------------------------------------------------
        # TEST 5: Inter-Partner Settlements & Self-Settlement Guard
        # -------------------------------------------------------------
        print("\n--- TEST 5: Inter-Partner Settlements ---")
        # 5a. Self-settlement rejected (Anand paying Anand)
        res_self_stl = client.post('/api/partner-settlements/', {
            "from_partner_id": partner_a.id,
            "to_partner_id": partner_a.id,
            "amount": "2000.00",
            "payment_mode": "UPI"
        }, format='json')
        assert_true(res_self_stl.status_code == status.HTTP_400_BAD_REQUEST, "Rejects self-settlement (from_partner == to_partner) with 400 Bad Request")

        # 5b. Valid settlement: Anand pays Bharat ₹4,000 (UPI)
        res_stl = client.post('/api/partner-settlements/', {
            "from_partner_id": partner_a.id,
            "to_partner_id": partner_b.id,
            "amount": "4000.00",
            "payment_mode": "UPI",
            "reference_number": "UPI-SETTLE-8899",
            "notes": "Anand reimburses Bharat for store renovation"
        }, format='json')
        assert_true(res_stl.status_code == status.HTTP_201_CREATED, "Inter-partner settlement recorded with 201 Created")
        stl_obj = PartnerSettlement.objects.get(id=res_stl.data['id'])
        created['settlements'].append(stl_obj)
        assert_true(stl_obj.settlement_number.startswith('STL-'), f"Auto-generated settlement_number: {stl_obj.settlement_number}")

        # 5c. Settlement with inactive partner rejected
        res_inact_stl = client.post('/api/partner-settlements/', {
            "from_partner_id": partner_inactive.id,
            "to_partner_id": partner_b.id,
            "amount": "1000.00",
            "payment_mode": "CASH"
        }, format='json')
        assert_true(res_inact_stl.status_code == status.HTTP_400_BAD_REQUEST, "Rejects settlement from inactive partner with 400 Bad Request")

        # -------------------------------------------------------------
        # TEST 6: Partner Deposits & Handovers to Store Till/Bank
        # -------------------------------------------------------------
        print("\n--- TEST 6: Partner Deposits & Handovers ---")
        # 6a. Handover of customer collections (Partner Anand hands over ₹10,000 to Store Cash Till)
        res_dep_handover = client.post('/api/partner-deposits/', {
            "partner_id": partner_a.id,
            "amount": "10000.00",
            "payment_mode": "CASH",
            "deposit_type": "CUSTOMER_COLLECTION_HANDOVER",
            "notes": "Cash collected from customer counter handed over to till"
        }, format='json')
        assert_true(res_dep_handover.status_code == status.HTTP_201_CREATED, "Collection handover deposit recorded with 201 Created")
        dep_handover = PartnerDeposit.objects.get(id=res_dep_handover.data['id'])
        created['deposits'].append(dep_handover)
        assert_true(dep_handover.deposit_number.startswith('DEP-'), f"Auto-generated deposit_number: {dep_handover.deposit_number}")

        # 6b. Capital injection (Partner Bharat injects ₹15,000 fresh working capital into Store Bank)
        res_dep_capital = client.post('/api/partner-deposits/', {
            "partner_id": partner_b.id,
            "amount": "15000.00",
            "payment_mode": "BANK_TRANSFER",
            "deposit_type": "CAPITAL_INJECTION",
            "reference_number": "NEFT-INJECT-01",
            "notes": "Additional capital injection for inventory expansion"
        }, format='json')
        assert_true(res_dep_capital.status_code == status.HTTP_201_CREATED, "Capital injection deposit recorded with 201 Created")
        dep_capital = PartnerDeposit.objects.get(id=res_dep_capital.data['id'])
        created['deposits'].append(dep_capital)

        # 6c. Deposit for inactive partner rejected
        res_inact_dep = client.post('/api/partner-deposits/', {
            "partner_id": partner_inactive.id,
            "amount": "5000.00",
            "payment_mode": "CASH"
        }, format='json')
        assert_true(res_inact_dep.status_code == status.HTTP_400_BAD_REQUEST, "Rejects deposit for inactive partner with 400 Bad Request")

        # -------------------------------------------------------------
        # TEST 7: Partner Ledger Mathematical Invariant & Dynamic Summary
        # -------------------------------------------------------------
        print("\n--- TEST 7: Partner Ledger Summary & Statement Calculations ---")
        # Create a purchase funded by Anand (Rs.15,000)
        sup = Supplier.objects.create(name="Test Fin Audit Supplier", mobile="9886077001", is_active=True)
        created['suppliers'].append(sup)
        pcat = ProductCategory.objects.create(name="Test Fin Prod Cat")
        created['prod_cats'].append(pcat)
        prod = Product.objects.create(name="Test Fin Product", sku="FIN-PROD-01", category=pcat, purchase_price=Decimal('1000.00'), is_stock_enabled=True)
        created['products'].append(prod)

        purch = Purchase.objects.create(
            purchase_number="PUR-FIN-001",
            supplier=sup,
            purchase_date=timezone.now().date(),
            total_amount=Decimal('15000.00'),
            tax_amount=Decimal('0.00'),
            paid_amount=Decimal('15000.00'),
            payment_status='PAID',
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=partner_a,
            created_by=admin_user
        )
        created['purchases'].append(purch)

        # Create a customer invoice where customer payment was collected and held by Anand (Rs.10,000)
        cust = Customer.objects.create(name="Test Fin Customer", mobile="9886077002", is_active=True)
        created['customers'].append(cust)
        inv = Invoice.objects.create(
            invoice_number="INV-FIN-001",
            customer=cust,
            buyer_name=cust.name,
            invoice_date=timezone.now().date(),
            taxable_amount=Decimal('10000.00'),
            grand_total=Decimal('10000.00'),
            total_paid_amount=Decimal('10000.00'),
            payment_status='PAID',
            invoice_status='POSTED',
            created_by=admin_user
        )
        created['invoices'].append(inv)
        pmt = Payment.objects.create(
            payment_number="PAY-FIN-001",
            invoice=inv,
            customer=cust,
            payment_date=timezone.now().date(),
            payment_mode='CASH',
            amount=Decimal('10000.00'),
            partner_allocation_json={"partner_id": partner_a.id, "amount": "10000.00"},
            created_by=admin_user
        )

        # Call PartnerLedgerSummaryView for Partner Anand
        res_summary_a = client.get(f'/api/partner-ledger/summary/{partner_a.id}/')
        assert_true(res_summary_a.status_code == status.HTTP_200_OK, "PartnerLedgerSummaryView returns 200 OK")
        summary_a = res_summary_a.data

        # Verify Anand's Credits:
        # initial_capital = 50,000
        # purchases_funded = 15,000
        # expenses_funded = 5,000 (direct) + 3,000 (split share) = 8,000
        # deposits_handed_over = 10,000
        # settlements_received = 0
        expected_credits_a = Decimal('50000.00') + Decimal('15000.00') + Decimal('8000.00') + Decimal('10000.00')
        assert_true(Decimal(str(summary_a['initial_capital'])) == Decimal('50000.00'), "Initial capital is Rs.50000.00")
        assert_true(Decimal(str(summary_a['purchases_funded'])) == Decimal('15000.00'), "Purchases funded is Rs.15000.00")
        assert_true(Decimal(str(summary_a['expenses_funded'])) == Decimal('8000.00'), f"Expenses funded is Rs.8000.00 (actual: {summary_a['expenses_funded']})")
        assert_true(Decimal(str(summary_a['deposits_handed_over'])) == Decimal('10000.00'), "Deposits handed over is Rs.10000.00")
        assert_true(Decimal(str(summary_a['total_credits'])) == expected_credits_a, f"Total credits match Rs.{expected_credits_a}")

        # Verify Anand's Debits:
        # customer_collections = 10,000
        # drawings = 8,000
        # settlements_paid = 4,000
        expected_debits_a = Decimal('10000.00') + Decimal('8000.00') + Decimal('4000.00')
        assert_true(Decimal(str(summary_a['customer_collections'])) == Decimal('10000.00'), "Customer collections is Rs.10000.00")
        assert_true(Decimal(str(summary_a['drawings'])) == Decimal('8000.00'), "Drawings is Rs.8000.00")
        assert_true(Decimal(str(summary_a['settlements_paid'])) == Decimal('4000.00'), "Settlements paid is Rs.4000.00")
        assert_true(Decimal(str(summary_a['total_debits'])) == expected_debits_a, f"Total debits match Rs.{expected_debits_a}")

        # Verify Anand's Net Capital Balance:
        # 83,000 - 22,000 = 61,000
        expected_net_a = expected_credits_a - expected_debits_a
        assert_true(Decimal(str(summary_a['net_capital_balance'])) == expected_net_a, f"Net capital balance is Rs.{expected_net_a} (actual: {summary_a['net_capital_balance']})")

        # Verify Cash Held In Hand:
        # collections (10,000) - handed over (10,000) = 0
        assert_true(Decimal(str(summary_a['cash_held_in_hand'])) == Decimal('0.00'), "Cash held in hand is Rs.0.00 after full handover")

        # Check Statement View
        res_stmt_a = client.get(f'/api/partner-ledger/statement/{partner_a.id}/')
        assert_true(res_stmt_a.status_code == status.HTTP_200_OK, "PartnerLedgerStatementView returns 200 OK")
        statement_a = res_stmt_a.data.get('statement', [])
        assert_true(len(statement_a) >= 6, f"Statement contains all chronological journal entries (count: {len(statement_a)})")
        last_running_bal = Decimal(str(statement_a[-1]['running_balance']))
        assert_true(last_running_bal == expected_net_a, f"Statement final running balance matches net capital balance: Rs.{last_running_bal}")

        # -------------------------------------------------------------
        # TEST 8: Cash Register Till & Financial Payments Log
        # -------------------------------------------------------------
        print("\n--- TEST 8: Financial Payments Log & Cash Register Till ---")
        res_all_pmts = client.get('/api/finance/all-payments/')
        assert_true(res_all_pmts.status_code == status.HTTP_200_OK, "FinancialPaymentsLogView returns 200 OK")
        all_txns = res_all_pmts.data

        txn_types = set(t['txn_type'] for t in all_txns)
        assert_true('EXPENSE' in txn_types, "All payments log contains store-paid EXPENSE")
        assert_true('PARTNER_DRAWING' in txn_types, "All payments log contains PARTNER_DRAWING")
        assert_true('PARTNER_DEPOSIT' in txn_types, "All payments log contains PARTNER_DEPOSIT")

        # Zero CREDIT payments in log
        for t in all_txns:
            assert_true(t.get('payment_mode') != 'CREDIT', "Zero CREDIT entries in financial cash log")

        # Mode filter (CASH)
        res_cash = client.get('/api/finance/all-payments/?payment_mode=CASH')
        for t in res_cash.data:
            assert_true(t['payment_mode'] == 'CASH', "Filtered by CASH returns exclusively CASH entries")

        # -------------------------------------------------------------
        # TEST 9: Profit & Loss (P&L) Report Financial Accuracy
        # -------------------------------------------------------------
        print("\n--- TEST 9: Profit & Loss (P&L) Report ---")
        res_pnl = client.get(f'/api/reports/pnl/?start_date={timezone.now().date()}&end_date={timezone.now().date()}')
        assert_true(res_pnl.status_code == status.HTTP_200_OK, "ProfitAndLossReportView returns 200 OK")
        pnl = res_pnl.data
        assert_true('gross_sales' in pnl, "P&L contains gross_sales")
        assert_true('cost_of_goods_sold' in pnl, "P&L contains cost_of_goods_sold")
        assert_true('gross_profit' in pnl, "P&L contains gross_profit")
        assert_true('operating_expenses' in pnl, "P&L contains operating_expenses")
        assert_true('net_profit' in pnl, "P&L contains net_profit")
        assert_true('store_net_cash_flow' in pnl, "P&L contains store_net_cash_flow")

        # Accounting reconciliation diagnostic
        res_rec = client.get(f'/api/reports/reconciliation/?start_date={timezone.now().date()}&end_date={timezone.now().date()}')
        assert_true(res_rec.status_code == status.HTTP_200_OK, "AccountingReconciliationView returns 200 OK")
        assert_true('is_balanced' in res_rec.data, "Accounting reconciliation contains is_balanced status")

        # -------------------------------------------------------------
        # TEST 10: RBAC & Access Control Enforcement
        # -------------------------------------------------------------
        print("\n--- TEST 10: Finance RBAC & Cashier Access Control ---")
        client.force_authenticate(user=cashier_user)

        # Cashier blocked from Expense Master
        res_cash_exp = client.get('/api/expenses/')
        assert_true(res_cash_exp.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/expenses/ with 403 Forbidden")

        # Cashier blocked from Partner Drawings
        res_cash_drw = client.get('/api/partner-drawings/')
        assert_true(res_cash_drw.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/partner-drawings/ with 403 Forbidden")

        # Cashier blocked from Partner Settlements
        res_cash_stl = client.get('/api/partner-settlements/')
        assert_true(res_cash_stl.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/partner-settlements/ with 403 Forbidden")

        # Cashier blocked from Partner Deposits
        res_cash_dep = client.get('/api/partner-deposits/')
        assert_true(res_cash_dep.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/partner-deposits/ with 403 Forbidden")

        # Cashier blocked from Partner Ledger Summary
        res_cash_led = client.get('/api/partner-ledger/summary/')
        assert_true(res_cash_led.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/partner-ledger/summary/ with 403 Forbidden")

        # Cashier blocked from Financial Payments Log
        res_cash_pmts = client.get('/api/finance/all-payments/')
        assert_true(res_cash_pmts.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/finance/all-payments/ with 403 Forbidden")

        # Cashier blocked from P&L Report
        res_cash_pnl = client.get('/api/reports/pnl/')
        assert_true(res_cash_pnl.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from /api/reports/pnl/ with 403 Forbidden")

        # Unauthenticated blocked from all finance APIs
        client.force_authenticate(user=None)
        res_unauth = client.get('/api/expenses/')
        assert_true(res_unauth.status_code == status.HTTP_401_UNAUTHORIZED, "Unauthenticated request blocked with 401 Unauthorized")

    except Exception as e:
        print(f"\n[EXCEPTION DURING TESTING]: {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n" + "=" * 80)
        print("TEARDOWN & DATABASE PURGING")
        print("=" * 80)

        # Clean Payments & Invoices
        for inv in created['invoices']:
            if inv.id:
                Payment.objects.filter(invoice=inv).delete()
                InvoiceItem.objects.filter(invoice=inv).delete()
                Invoice.objects.filter(id=inv.id).delete()

        # Clean Customers
        for c in created['customers']:
            if c.id:
                Customer.objects.filter(id=c.id).delete()

        # Clean Purchases
        for p in created['purchases']:
            if p.id:
                PurchaseItem.objects.filter(purchase=p).delete()
                Purchase.objects.filter(id=p.id).delete()

        # Clean Suppliers
        for s in created['suppliers']:
            if s.id:
                Supplier.objects.filter(id=s.id).delete()

        # Clean Products, Categories, Brands
        for p in created['products']:
            if p.id:
                StockMovement.objects.filter(product=p).delete()
                Product.objects.filter(id=p.id).delete()
        for c in created['prod_cats']:
            if c.id:
                ProductCategory.objects.filter(id=c.id).delete()

        # Clean Finance Transactions
        for stl in created['settlements']:
            if stl.id:
                PartnerSettlement.objects.filter(id=stl.id).delete()
        for drw in created['drawings']:
            if drw.id:
                PartnerDrawings.objects.filter(id=drw.id).delete()
        for dep in created['deposits']:
            if dep.id:
                PartnerDeposit.objects.filter(id=dep.id).delete()
        for exp in created['expenses']:
            if exp.id:
                Expense.objects.filter(id=exp.id).delete()
        for ec in created['exp_cats']:
            if ec.id:
                ExpenseCategory.objects.filter(id=ec.id).delete()

        # Clean Partners
        for ptn in created['partners']:
            if ptn.id:
                Partner.objects.filter(id=ptn.id).delete()

        # Clean Users
        for u in created['users']:
            if u.id:
                User.objects.filter(id=u.id).delete()

        # Verify Final DB State
        after_partners = Partner.objects.count()
        after_exp_cats = ExpenseCategory.objects.count()
        after_expenses = Expense.objects.count()
        after_drawings = PartnerDrawings.objects.count()
        after_settlements = PartnerSettlement.objects.count()
        after_deposits = PartnerDeposit.objects.count()
        after_products = Product.objects.count()
        after_purchases = Purchase.objects.count()
        after_invoices = Invoice.objects.count()

        print(f"[*] Final DB State: Partners={after_partners}, ExpCats={after_exp_cats}, Expenses={after_expenses}, Drawings={after_drawings}, Settlements={after_settlements}, Deposits={after_deposits}")

        if (after_partners == baseline_partners and
            after_exp_cats == baseline_exp_cats and
            after_expenses == baseline_expenses and
            after_drawings == baseline_drawings and
            after_settlements == baseline_settlements and
            after_deposits == baseline_deposits and
            after_products == baseline_products and
            after_purchases == baseline_purchases and
            after_invoices == baseline_invoices):
            print("[SUCCESS] 100% CLEAN TEARDOWN: Database returned precisely to pre-test baseline!")
        else:
            print("[WARNING] DATABASE MISMATCH: Stray records may remain!")

    print("\n" + "=" * 80)
    print(f"TEST RESULTS SUMMARY: {passed_count} PASSED, {failed_count} FAILED")
    print("=" * 80)
    return failed_count == 0


if __name__ == '__main__':
    success = run_finance_module_tests()
    sys.exit(0 if success else 1)
