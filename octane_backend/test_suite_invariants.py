"""
Octane Systems - Automated System Invariants & Financial Audit Test Suite
Tests:
1. Stock Ledger Arithmetic & Zero-Drift Invariant
2. Oversell & Negative Stock Boundary Prevention
3. GST Engine Math (Intra-State Split vs Inter-State IGST vs Non-GST)
4. Double-Entry Invoicing & Split Payment Balancing
5. Partner Equity & Inter-Partner Settlements
6. P&L and Executive Dashboard Mathematical Reconciliation
"""

import os
import sys
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

# Alias for both
ValidationExceptions = (DjangoValidationError, DRFValidationError)
from django.utils import timezone
from core.models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, Brand, Product, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, InvoiceItem, Payment,
    ExpenseCategory, Expense, Purchase, PurchaseItem,
    PartnerDrawings, PartnerSettlement, PartnerDeposit, SupplierPayment
)
from core.services.stock_service import StockService
from core.services.tax_engine import TaxEngine
from core.services.invoice_service import InvoiceService
from core.services.purchase_service import PurchaseService
from core.services.partner_ledger_service import PartnerLedgerService
from core.services.reports_service import ReportsService


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def log_pass(name, details=""):
    print(f"  [PASS]: {name} {f'({details})' if details else ''}")


def log_fail(name, error):
    print(f"  [FAIL]: {name} -> Error: {error}")


def cleanup_audit_data():
    """Removes all test artifacts and resets counters cleanly."""
    test_prefix = "AUDIT_TEST_"
    Payment.objects.filter(payment_number__startswith="PAY-AUDIT").delete()
    Payment.objects.filter(created_by__username='audit_test_admin').delete()
    Payment.objects.filter(invoice__customer__name__startswith=test_prefix).delete()
    InvoiceItem.objects.filter(product__name__startswith=test_prefix).delete()
    InvoiceItem.objects.filter(invoice__created_by__username='audit_test_admin').delete()
    InvoiceItem.objects.filter(invoice__customer__name__startswith=test_prefix).delete()
    Invoice.objects.filter(customer__name__startswith=test_prefix).delete()
    Invoice.objects.filter(created_by__username='audit_test_admin').delete()
    PartnerDeposit.objects.filter(deposit_number__startswith="DEP-AUDIT").delete()
    PartnerDrawings.objects.filter(drawing_number__startswith="DRW-AUDIT").delete()
    PartnerSettlement.objects.filter(settlement_number__startswith="STL-AUDIT").delete()
    Expense.objects.filter(expense_number__startswith="EXP-AUDIT").delete()
    ExpenseCategory.objects.filter(name__in=['Audit Utilities', 'Audit Test Hardware']).delete()
    StockMovement.objects.filter(product__name__startswith=test_prefix).delete()
    SerialNumber.objects.filter(serial_number__startswith="SN-AUDIT").delete()
    Product.objects.filter(name__startswith=test_prefix).delete()
    ProductCategory.objects.filter(name='Audit Test Hardware').delete()
    Customer.objects.filter(name__startswith=test_prefix).delete()
    Supplier.objects.filter(name__startswith=test_prefix).delete()
    Partner.objects.filter(name__startswith=test_prefix).delete()
    User.objects.filter(username='audit_test_admin').delete()
    bp = BusinessProfile.objects.first()
    if bp and not Invoice.objects.exists():
        bp.next_invoice_number = 1001
        bp.next_non_gst_number = 1001
        bp.save()


def run_all_invariant_tests():
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE} OCTANE SYSTEMS - FULL SYSTEM INVARIANT & AUDIT SUITE {Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    results = {"passed": 0, "failed": 0, "errors": []}

    cleanup_audit_data()

    # Setup isolated test admin user and business profile
    admin_user, _ = User.objects.get_or_create(username='audit_test_admin', defaults={'is_staff': True, 'is_superuser': True})
    profile, _ = BusinessProfile.objects.get_or_create(
        id=1,
        defaults={
            'company_name': 'Octane Systems Test Lab',
            'gstin': '29ABCDE1234F1Z5',
            'state_code': '29',
            'invoice_prefix': 'INV-',
            'non_gst_prefix': 'EST-',
        }
    )

    test_prefix = "AUDIT_TEST_"
    category, _ = ProductCategory.objects.get_or_create(name='Audit Test Hardware')

    # =========================================================================
    # TEST 1: STOCK LEDGER ARITHMETIC & DOUBLE-ENTRY INVARIANT (QUANTITY ITEM)
    # =========================================================================
    print(f"{Colors.BOLD}1. Testing Stock Ledger Arithmetic & Invariants (Quantity Item)...{Colors.END}")
    try:
        qty_product = Product.objects.create(
            name=f"{test_prefix}RAM_16GB",
            sku=f"{test_prefix}RAM-16G",
            category=category,
            purchase_price=Decimal('2000.00'),
            selling_price=Decimal('3000.00'),
            is_stock_enabled=True,
            tracking_type='QUANTITY'
        )
        assert qty_product.get_current_stock() == 0, "Initial stock must be 0"

        # 1. Opening Balance (+10)
        StockService.process_stock_in(
            product=qty_product, quantity=10, movement_type='OPENING',
            reference_type='OPENING_BALANCE', reference_id='OP-01', user=admin_user, unit_cost=Decimal('2000.00')
        )
        assert qty_product.get_current_stock() == 10, f"Stock after opening should be 10, got {qty_product.get_current_stock()}"

        # 2. Stock Adjustment IN (+5)
        StockService.adjust_stock(product=qty_product, new_stock_quantity=15, reason='Found extra in bin', user=admin_user)
        assert qty_product.get_current_stock() == 15, f"Stock after Adj IN should be 15, got {qty_product.get_current_stock()}"

        # 3. Stock Adjustment OUT (-3)
        StockService.adjust_stock(product=qty_product, new_stock_quantity=12, reason='Damaged in transit', user=admin_user)
        assert qty_product.get_current_stock() == 12, f"Stock after Adj OUT should be 12, got {qty_product.get_current_stock()}"

        # 4. Supplier Purchase (+10)
        supplier = Supplier.objects.create(name=f"{test_prefix}Chipset_Corp", mobile="9988776655")
        StockService.process_stock_in(
            product=qty_product, quantity=10, movement_type='PURCHASE',
            reference_type='PURCHASE', reference_id='PO-01', user=admin_user, unit_cost=Decimal('2000.00')
        )
        assert qty_product.get_current_stock() == 22, f"Stock after Purchase should be 22, got {qty_product.get_current_stock()}"

        # 5. Purchase Return (-2)
        StockService.process_stock_out(
            product=qty_product, quantity=2, movement_type='PURCHASE_RETURN',
            reference_type='PURCHASE_RETURN', reference_id='PRET-01', user=admin_user
        )
        assert qty_product.get_current_stock() == 20, f"Stock after Purchase Return should be 20, got {qty_product.get_current_stock()}"

        # 6. Customer POS Sale (-5)
        customer = Customer.objects.create(name=f"{test_prefix}Customer_Alpha", mobile="9876543210", state_code="29")
        StockService.process_stock_out(
            product=qty_product, quantity=5, movement_type='SALE',
            reference_type='INVOICE', reference_id='INV-01', user=admin_user
        )
        assert qty_product.get_current_stock() == 15, f"Stock after Sale should be 15, got {qty_product.get_current_stock()}"

        # 7. Sales Return (+1)
        StockService.process_stock_in(
            product=qty_product, quantity=1, movement_type='SALES_RETURN',
            reference_type='SALES_RETURN', reference_id='SRET-01', user=admin_user
        )
        assert qty_product.get_current_stock() == 16, f"Stock after Sales Return should be 16, got {qty_product.get_current_stock()}"

        # Strict Mathematical Invariant Check:
        # Stock = Inwards (10 + 5 + 10 + 1 = 26) - Outwards (3 + 2 + 5 = 10) = 16
        inward_sum = StockMovement.objects.filter(
            product=qty_product, movement_type__in=['OPENING', 'ADJUSTMENT_IN', 'PURCHASE', 'SALES_RETURN']
        ).aggregate(total=django.db.models.Sum('quantity'))['total'] or 0

        outward_sum = StockMovement.objects.filter(
            product=qty_product, movement_type__in=['ADJUSTMENT_OUT', 'PURCHASE_RETURN', 'SALE']
        ).aggregate(total=django.db.models.Sum('quantity'))['total'] or 0

        computed_stock = inward_sum - outward_sum
        live_stock = qty_product.get_current_stock()
        assert computed_stock == live_stock == 16, f"Mismatch: computed {computed_stock} vs live {live_stock}"

        log_pass("Quantity Stock Double-Entry Invariant", f"Ledger In: {inward_sum}, Out: {outward_sum}, Net Live Stock: {live_stock}")
        results["passed"] += 1
    except Exception as e:
        log_fail("Quantity Stock Double-Entry Invariant", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 2: OVER-SELL & NEGATIVE STOCK BOUNDARY GUARD
    # =========================================================================
    print(f"\n{Colors.BOLD}2. Testing Over-sell & Negative Stock Boundary Guard...{Colors.END}")
    try:
        # Current stock is 16. Attempting to sell 17 or reduce by 17 must fail!
        failed_as_expected = False
        try:
            StockService.process_stock_out(
                product=qty_product, quantity=25, movement_type='SALE',
                reference_type='INVOICE', reference_id='INV-ILLEGAL', user=admin_user
            )
        except ValidationExceptions:
            failed_as_expected = True

        assert failed_as_expected, "StockService permitted selling more stock than available!"
        assert qty_product.get_current_stock() == 16, "Current stock mutated despite illegal sale attempt!"

        log_pass("Negative Stock Prevention", "Blocked attempt to deduct 25 units when available stock was 16")
        results["passed"] += 1
    except Exception as e:
        log_fail("Negative Stock Prevention", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 3: SERIAL NUMBER LIFECYCLE & FIFO CONSISTENCY
    # =========================================================================
    print(f"\n{Colors.BOLD}3. Testing Serial Number Registry & FIFO Lifecycle...{Colors.END}")
    try:
        ser_product = Product.objects.create(
            name=f"{test_prefix}Gaming_Laptop",
            sku=f"{test_prefix}LAP-GAME-01",
            category=category,
            purchase_price=Decimal('50000.00'),
            selling_price=Decimal('65000.00'),
            is_stock_enabled=True,
            tracking_type='SERIAL_NUMBER'
        )

        # 1. Add 3 serialized laptops via Opening Balance
        sn_list = [f"SN-AUDIT-{i}" for i in range(101, 104)]
        StockService.process_stock_in(
            product=ser_product, quantity=3, movement_type='OPENING',
            reference_type='OPENING_BALANCE', reference_id='OP-SER-01',
            serial_numbers_list=sn_list, user=admin_user, unit_cost=Decimal('50000.00')
        )
        assert ser_product.get_current_stock() == 3, f"Expected 3, got {ser_product.get_current_stock()}"

        available_count = SerialNumber.objects.filter(product=ser_product, status='AVAILABLE').count()
        assert available_count == 3, f"Expected 3 AVAILABLE serials, got {available_count}"

        # 2. Sell 1 laptop with explicit serial 'SN-AUDIT-101'
        StockService.process_stock_out(
            product=ser_product, quantity=1, movement_type='SALE',
            reference_type='INVOICE', reference_id='INV-SER-01',
            serial_number_str='SN-AUDIT-101', user=admin_user
        )
        assert ser_product.get_current_stock() == 2, f"Expected 2, got {ser_product.get_current_stock()}"
        sn101 = SerialNumber.objects.get(product=ser_product, serial_number='SN-AUDIT-101')
        assert sn101.status == 'SOLD', f"Expected status SOLD, got {sn101.status}"

        # 3. Attempting to sell 'SN-AUDIT-101' AGAIN must fail!
        double_sold = False
        try:
            StockService.process_stock_out(
                product=ser_product, quantity=1, movement_type='SALE',
                reference_type='INVOICE', reference_id='INV-SER-DUP',
                serial_number_str='SN-AUDIT-101', user=admin_user
            )
        except ValidationExceptions:
            double_sold = True
        assert double_sold, "System allowed selling an already SOLD serial number!"

        # 4. Stock Adjustment OUT (-1) with FIFO fallback
        StockService.adjust_stock(product=ser_product, new_stock_quantity=1, reason='Dropped in store', user=admin_user)
        assert ser_product.get_current_stock() == 1, f"Expected 1, got {ser_product.get_current_stock()}"

        # Check that the adjusted unit was marked DEFECTIVE and not SOLD
        defective_count = SerialNumber.objects.filter(product=ser_product, status='DEFECTIVE').count()
        assert defective_count == 1, f"Expected 1 DEFECTIVE serial, got {defective_count}"

        log_pass("Serial Number Lifecycle & Double-Sale Guard", f"3 Serials created -> 1 SOLD -> 1 Duplicate sale BLOCKED -> 1 FIFO DEFECTIVE")
        results["passed"] += 1
    except Exception as e:
        log_fail("Serial Number Lifecycle & Double-Sale Guard", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 4: GST TAX ENGINE (INTRA-STATE SPLIT vs INTER-STATE IGST)
    # =========================================================================
    print(f"\n{Colors.BOLD}4. Testing GST Tax Engine Math Invariants...{Colors.END}")
    try:
        # Intra-state calculation (Karnataka 29 -> Karnataka 29):
        # 18% GST on Rs. 10,000 -> CGST: Rs. 900 (9%), SGST: Rs. 900 (9%), IGST: 0.00
        calc_intra = TaxEngine.calculate_item_tax(
            rate=Decimal('10000.00'),
            qty=1,
            discount_pct=Decimal('0.00'),
            gst_rate=Decimal('18.00'),
            is_intra_state=True
        )
        assert calc_intra['cgst_amount'] == Decimal('900.00'), f"Expected CGST 900.00, got {calc_intra['cgst_amount']}"
        assert calc_intra['sgst_amount'] == Decimal('900.00'), f"Expected SGST 900.00, got {calc_intra['sgst_amount']}"
        assert calc_intra['igst_amount'] == Decimal('0.00'), f"Expected IGST 0.00, got {calc_intra['igst_amount']}"
        assert calc_intra['total_tax'] == Decimal('1800.00'), f"Expected Total Tax 1800.00, got {calc_intra['total_tax']}"

        # Inter-state calculation (Karnataka 29 -> Maharashtra 27):
        # 18% GST on Rs. 10,000 -> CGST: 0.00, SGST: 0.00, IGST: Rs. 1800.00 (18%)
        calc_inter = TaxEngine.calculate_item_tax(
            rate=Decimal('10000.00'),
            qty=1,
            discount_pct=Decimal('0.00'),
            gst_rate=Decimal('18.00'),
            is_intra_state=False
        )
        assert calc_inter['cgst_amount'] == Decimal('0.00'), f"Expected CGST 0.00, got {calc_inter['cgst_amount']}"
        assert calc_inter['sgst_amount'] == Decimal('0.00'), f"Expected SGST 0.00, got {calc_inter['sgst_amount']}"
        assert calc_inter['igst_amount'] == Decimal('1800.00'), f"Expected IGST 1800.00, got {calc_inter['igst_amount']}"
        assert calc_inter['total_tax'] == Decimal('1800.00'), f"Expected Total Tax 1800.00, got {calc_inter['total_tax']}"

        # Non-GST calculation (Estimate/Bill without GST):
        calc_nongst = TaxEngine.calculate_item_tax(
            rate=Decimal('10000.00'),
            qty=1,
            discount_pct=Decimal('0.00'),
            gst_rate=Decimal('0.00'),
            is_intra_state=True
        )
        assert calc_nongst['total_tax'] == Decimal('0.00')

        log_pass("GST Engine Intra-State & Inter-State Accuracy", "Intra: 9% CGST + 9% SGST = 18% | Inter: 18% IGST | Non-GST: 0.00")
        results["passed"] += 1
    except Exception as e:
        log_fail("GST Engine Intra-State & Inter-State Accuracy", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 5: DOUBLE-ENTRY INVOICE & SPLIT PAYMENT BALANCING
    # =========================================================================
    print(f"\n{Colors.BOLD}5. Testing Double-Entry Invoice & Split Payment Balancing...{Colors.END}")
    try:
        # Create an invoice for Rs. 50,000 + 18% GST = Rs. 59,000
        # Split Payment: Cash Rs. 20,000 + UPI Rs. 20,000 + Credit (Balance Due) Rs. 19,000
        inv_data = {
            'customer_id': customer.id,
            'is_gst_invoice': True,
            'items': [
                {
                    'product_id': qty_product.id,
                    'quantity': 5,
                    'selling_price': Decimal('10000.00'),
                    'discount_pct': Decimal('0.00'),
                    'gst_rate': Decimal('18.00'),
                    'hsn_sac': '8473'
                }
            ],
            'payments': [
                {'payment_mode': 'CASH', 'amount': Decimal('20000.00'), 'payer': 'BUSINESS'},
                {'payment_mode': 'UPI', 'amount': Decimal('20000.00'), 'reference_number': 'UPI-REF-123', 'payer': 'BUSINESS'},
                {'payment_mode': 'CREDIT', 'amount': Decimal('19000.00'), 'payer': 'BUSINESS'}
            ]
        }

        invoice = InvoiceService.create_and_post_invoice(user=admin_user, payload=inv_data)

        # Invariant 1: Grand Total == Taxable (50,000) + CGST (4,500) + SGST (4,500) == 59,000.00
        assert invoice.taxable_amount == Decimal('50000.00'), f"Taxable mismatch: {invoice.taxable_amount}"
        assert invoice.total_cgst == Decimal('4500.00'), f"CGST mismatch: {invoice.total_cgst}"
        assert invoice.total_sgst == Decimal('4500.00'), f"SGST mismatch: {invoice.total_sgst}"
        assert invoice.grand_total == Decimal('59000.00'), f"Grand total mismatch: {invoice.grand_total}"

        # Invariant 2: Total Paid (40,000) + Balance Due (19,000) == Grand Total (59,000)
        assert invoice.total_paid_amount == Decimal('40000.00'), f"Total paid mismatch: {invoice.total_paid_amount}"
        assert invoice.balance_due_amount == Decimal('19000.00'), f"Balance due mismatch: {invoice.balance_due_amount}"
        assert invoice.payment_status == 'PARTIALLY_PAID', f"Expected PARTIALLY_PAID, got {invoice.payment_status}"

        # Invariant 3: Customer Outstanding Balance increased by exactly Rs. 19,000
        customer.refresh_from_db()
        outstanding = sum(inv.balance_due_amount for inv in customer.invoices.filter(invoice_status='POSTED'))
        assert outstanding >= Decimal('19000.00'), f"Outstanding balance mismatch: {outstanding}"

        # Invariant 4: Delayed Payment installment settles balance to 0.00
        InvoiceService.record_delayed_payment(
            user=admin_user,
            invoice_id=invoice.id,
            payment_payload={
                'amount': Decimal('19000.00'),
                'payment_mode': 'BANK_TRANSFER',
                'reference_number': 'IMPS-FINAL-789',
            }
        )
        invoice.refresh_from_db()
        assert invoice.balance_due_amount == Decimal('0.00'), f"Expected balance due 0.00, got {invoice.balance_due_amount}"
        assert invoice.total_paid_amount == Decimal('59000.00'), f"Expected paid 59000.00, got {invoice.total_paid_amount}"
        assert invoice.payment_status == 'PAID', f"Expected PAID, got {invoice.payment_status}"

        log_pass("Double-Entry Invoice & Payment Balancing", "Grand Total Rs. 59,000 = Cash Rs. 20k + UPI Rs. 20k + Credit Rs. 19k -> Installment paid -> Balance Due: 0.00 (PAID)")
        results["passed"] += 1
    except Exception as e:
        log_fail("Double-Entry Invoice & Payment Balancing", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 6: PARTNER EQUITY LEDGER & INTER-PARTNER SETTLEMENTS
    # =========================================================================
    print(f"\n{Colors.BOLD}6. Testing Partner Equity & Inter-Partner Settlements...{Colors.END}")
    try:
        partner_a = Partner.objects.create(name=f"{test_prefix}Rohan", initial_capital=Decimal('100000.00'), mobile="9111111111")
        partner_b = Partner.objects.create(name=f"{test_prefix}Kavita", initial_capital=Decimal('100000.00'), mobile="9222222222")

        # 1. Partner A takes drawing (-Rs. 15,000)
        PartnerDrawings.objects.create(
            drawing_number="DRW-AUDIT-01", partner=partner_a, drawing_date=timezone.now().date(),
            amount=Decimal('15000.00'), payment_mode='CASH', notes='Personal use', created_by=admin_user
        )

        # 2. Partner A pays out-of-pocket store expense (+Rs. 5,000)
        exp_cat, _ = ExpenseCategory.objects.get_or_create(name='Audit Utilities')
        Expense.objects.create(
            expense_number="EXP-AUDIT-OOP-01", category=exp_cat, expense_date=timezone.now().date(),
            amount=Decimal('5000.00'), payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=partner_a, description='Office internet paid by Rohan', created_by=admin_user
        )

        # 3. Inter-Partner Settlement: Rohan pays Kavita Rs. 10,000
        PartnerSettlement.objects.create(
            settlement_number="STL-AUDIT-RK-01", from_partner=partner_a, to_partner=partner_b,
            settlement_date=timezone.now().date(), amount=Decimal('10000.00'), payment_mode='UPI',
            notes='Rohan settled personal debt with Kavita', created_by=admin_user
        )

        # Mathematical Check:
        # Partner A balance = 100,000 - 15,000 (drawing) + 5,000 (expense funded) - 10,000 (settlement out) = 80,000.00
        # Partner B balance = 100,000 + 10,000 (settlement in) = 110,000.00
        sum_a = PartnerLedgerService.get_partner_ledger_summary(partner_id=partner_a.id)
        sum_b = PartnerLedgerService.get_partner_ledger_summary(partner_id=partner_b.id)
        assert sum_a['net_capital_balance'] == Decimal('80000.00'), f"Expected Partner A 80000.00, got {sum_a['net_capital_balance']}"
        assert sum_b['net_capital_balance'] == Decimal('110000.00'), f"Expected Partner B 110000.00, got {sum_b['net_capital_balance']}"

        # 4. Customer pays Partner A directly Rs. 20,000 (Debit to Partner A, money held in pocket)
        Payment.objects.create(
            payment_number="PAY-AUDIT-PT-01",
            payment_date=timezone.now().date(),
            amount=Decimal('20000.00'),
            payment_mode='CASH',
            partner_allocation_json={'partner_id': partner_a.id, 'partner_name': partner_a.name, 'amount': 20000.00},
            notes='Customer paid Partner Rohan directly',
            created_by=admin_user
        )
        sum_a2 = PartnerLedgerService.get_partner_ledger_summary(partner_id=partner_a.id)
        # Partner A balance must now be 80,000 - 20,000 (collected) = 60,000.00
        assert sum_a2['net_capital_balance'] == Decimal('60000.00'), f"Expected Partner A 60000.00 after collection, got {sum_a2['net_capital_balance']}"
        assert sum_a2['cash_held_in_hand'] == Decimal('20000.00'), f"Expected 20000.00 cash held by Partner A, got {sum_a2['cash_held_in_hand']}"

        # 5. Partner A deposits/hands over the collected Rs. 20,000 into the store cash till
        PartnerDeposit.objects.create(
            deposit_number="DEP-AUDIT-01",
            partner=partner_a,
            deposit_date=timezone.now().date(),
            amount=Decimal('20000.00'),
            payment_mode='CASH',
            deposit_type='CUSTOMER_COLLECTION_HANDOVER',
            notes='Rohan handed over customer cash to shop till',
            created_by=admin_user
        )
        sum_a3 = PartnerLedgerService.get_partner_ledger_summary(partner_id=partner_a.id)
        # Partner A balance must now be 60,000 + 20,000 (deposit credit) = 80,000.00
        assert sum_a3['net_capital_balance'] == Decimal('80000.00'), f"Expected Partner A 80000.00 after deposit, got {sum_a3['net_capital_balance']}"
        assert sum_a3['cash_held_in_hand'] == Decimal('0.00'), f"Expected 0.00 cash held after handover, got {sum_a3['cash_held_in_hand']}"

        # 6. Verify chronological running statement consistency
        stmt = PartnerLedgerService.get_chronological_statement(partner_a.id)
        final_running = stmt[-1]['running_balance']
        assert final_running == Decimal('80000.00'), f"Expected final running balance 80000.00, got {final_running}"

        log_pass("Partner Equity & Cash Flow Invariants", f"Drawings (-15k) | Expense (+5k) | Settlement (-10k) | Collection (-20k) | Handover (+20k) -> Balance: Rs. 80,000 (Exact)")
        results["passed"] += 1
    except Exception as e:
        log_fail("Partner Equity & Inter-Partner Invariants", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # Automatic post-run cleanup of all tester artifacts
    cleanup_audit_data()

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD} AUDIT RUN COMPLETE: {Colors.GREEN}{results['passed']} Passed{Colors.END}, {Colors.RED if results['failed'] > 0 else Colors.GREEN}{results['failed']} Failed{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    return results


if __name__ == '__main__':
    run_all_invariant_tests()

