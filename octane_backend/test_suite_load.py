"""
Octane Systems - High-Concurrency & Stress Load Testing Suite
Tests:
1. High-Concurrency Stock Race Condition (30 concurrent checkouts for 10 items)
   - Invariant: Zero Oversell Guarantee (exactly 10 succeed, 20 rejected, stock == 0)
2. High-Concurrency Split Payment Race Condition
   - Invariant: Payments cannot exceed invoice balance even under simultaneous execution
3. Concurrent Stock Movement Throughput & Deadlock Immunity
   - 50 concurrent mixed stock operations (Stock IN, Stock OUT) with atomic consistency
"""

import os
import sys
import django
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection, transaction
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.utils import timezone

from core.models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, Product, SerialNumber, StockMovement,
    Invoice, InvoiceItem, Payment
)
from core.services.stock_service import StockService
from core.services.invoice_service import InvoiceService


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


def run_load_and_concurrency_tests():
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE} OCTANE SYSTEMS - CONCURRENCY & STRESS TEST SUITE     {Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    results = {"passed": 0, "failed": 0, "errors": []}

    admin_user, _ = User.objects.get_or_create(username='stress_test_admin', defaults={'is_staff': True, 'is_superuser': True})
    test_prefix = "STRESS_TEST_"

    # Clean up test records
    Product.objects.filter(name__startswith=test_prefix).delete()
    Customer.objects.filter(name__startswith=test_prefix).delete()
    Invoice.objects.filter(customer__name__startswith=test_prefix).delete()
    category, _ = ProductCategory.objects.get_or_create(name='Stress Test Hardware')

    # =========================================================================
    # TEST 1: 30 CONCURRENT CHECKOUTS FOR 10 STOCK UNITS (RACE CONDITION)
    # =========================================================================
    print(f"{Colors.BOLD}1. Testing Concurrent Stock Checkout (Race Condition Prevention)...{Colors.END}")
    try:
        # Create a product with initial stock of exactly 10
        product = Product.objects.create(
            name=f"{test_prefix}SSD_1TB",
            sku=f"{test_prefix}SSD-1T",
            category=category,
            purchase_price=Decimal('4000.00'),
            selling_price=Decimal('6000.00'),
            is_stock_enabled=True,
            tracking_type='QUANTITY'
        )
        StockService.process_stock_in(
            product=product, quantity=10, movement_type='OPENING',
            reference_type='OPENING_BALANCE', reference_id='STRESS-OP-01', user=admin_user,
            unit_cost=Decimal('4000.00')
        )
        assert product.get_current_stock() == 10, "Initial stock should be 10"

        # Customer for sales
        cust = Customer.objects.create(name=f"{test_prefix}Customer_1", mobile="9988112233")

        def single_checkout(worker_id):
            # Close stale connection in this thread to ensure independent db session
            connection.close()
            try:
                # Attempt to process stock out of 1 unit
                StockService.process_stock_out(
                    product=product,
                    quantity=1,
                    movement_type='SALE',
                    reference_type='INVOICE',
                    reference_id=f"STRESS-INV-{worker_id}",
                    user=admin_user
                )
                return True, worker_id, None
            except (DjangoValidationError, DRFValidationError, Exception) as exc:
                return False, worker_id, str(exc)

        # Launch 30 concurrent checkout threads simultaneously
        num_threads = 30
        success_count = 0
        failure_count = 0
        rejection_reasons = []

        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(single_checkout, i) for i in range(num_threads)]
            for fut in as_completed(futures):
                success, worker_id, err = fut.result()
                if success:
                    success_count += 1
                else:
                    failure_count += 1
                    rejection_reasons.append(err)

        # Refresh product from DB
        connection.close()
        product.refresh_from_db()
        final_stock = product.get_current_stock()

        print(f"     -> Attempted: {num_threads} concurrent checkouts for 10 items")
        print(f"     -> Succeeded: {success_count} checkouts")
        print(f"     -> Blocked/Rejected: {failure_count} checkouts")
        print(f"     -> Final Database Stock: {final_stock}")

        # Invariant Assertions:
        assert success_count == 10, f"Expected exactly 10 successes, got {success_count}!"
        assert failure_count == 20, f"Expected exactly 20 rejections, got {failure_count}!"
        assert final_stock == 0, f"Stock must be exactly 0, got {final_stock}!"

        log_pass(
            "Race Condition Oversell Prevention",
            f"30 threads competed: exactly {success_count} won, {failure_count} rejected, stock held at {final_stock} without going negative."
        )
        results["passed"] += 1
    except Exception as e:
        log_fail("Race Condition Oversell Prevention", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 2: CONCURRENT DELAYED PAYMENTS (PREVENT OVER-PAYMENT RACE CONDITION)
    # =========================================================================
    print(f"\n{Colors.BOLD}2. Testing Concurrent Delayed Payments Race Condition...{Colors.END}")
    try:
        # Create an unpaid invoice for Rs. 5,000
        inv_payload = {
            'customer_id': cust.id,
            'is_gst_invoice': False,
            'items': [
                {
                    'product_id': product.id,
                    'quantity': 1,
                    'selling_price': Decimal('5000.00'),
                    'discount_pct': Decimal('0.00'),
                    'gst_rate': Decimal('0.00'),
                }
            ],
            'payments': [
                {'payment_mode': 'CREDIT', 'amount': Decimal('5000.00'), 'payer': 'BUSINESS'}
            ]
        }
        # First add 1 stock unit so invoice creation succeeds
        StockService.process_stock_in(
            product=product, quantity=1, movement_type='PURCHASE',
            reference_type='PURCHASE', reference_id='STRESS-PO-01', user=admin_user, unit_cost=Decimal('4000.00')
        )
        invoice = InvoiceService.create_and_post_invoice(user=admin_user, payload=inv_payload)
        assert invoice.balance_due_amount == Decimal('5000.00'), "Balance due must be 5000"

        # 10 concurrent threads each attempt to pay Rs. 1,000
        # Exactly 5 threads should succeed to pay the 5,000; the other 5 MUST be rejected
        def single_payment_worker(worker_id):
            connection.close()
            try:
                InvoiceService.record_delayed_payment(
                    user=admin_user,
                    invoice_id=invoice.id,
                    payment_payload={
                        'amount': Decimal('1000.00'),
                        'payment_mode': 'CASH',
                        'notes': f'Stress installment {worker_id}'
                    }
                )
                return True, worker_id, None
            except (DjangoValidationError, DRFValidationError, Exception) as exc:
                return False, worker_id, str(exc)

        pmt_success = 0
        pmt_failed = 0
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(single_payment_worker, i) for i in range(10)]
            for fut in as_completed(futures):
                success, worker_id, err = fut.result()
                if success:
                    pmt_success += 1
                else:
                    pmt_failed += 1

        connection.close()
        invoice.refresh_from_db()

        print(f"     -> Attempted: 10 concurrent payments of Rs. 1,000 against Rs. 5,000 balance")
        print(f"     -> Succeeded: {pmt_success} payments")
        print(f"     -> Rejected: {pmt_failed} payments")
        print(f"     -> Invoice Total Paid: Rs. {invoice.total_paid_amount}, Remaining Balance Due: Rs. {invoice.balance_due_amount}")

        assert invoice.total_paid_amount == Decimal('5000.00'), f"Total paid mismatch: {invoice.total_paid_amount}"
        assert invoice.balance_due_amount == Decimal('0.00'), f"Balance due mismatch: {invoice.balance_due_amount}"
        assert pmt_success == 5, f"Expected 5 payments to succeed, got {pmt_success}"
        assert pmt_failed == 5, f"Expected 5 payments to be rejected, got {pmt_failed}"

        log_pass(
            "Over-Payment Race Condition Prevention",
            f"Blocked excess payments; total paid locked at exactly Rs. {invoice.total_paid_amount} (Balance Due: Rs. 0.00)"
        )
        results["passed"] += 1
    except Exception as e:
        log_fail("Over-Payment Race Condition Prevention", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # TEST 3: HIGH-THROUGHPUT CONCURRENT STOCK IN/OUT (DEADLOCK RESILIENCE)
    # =========================================================================
    print(f"\n{Colors.BOLD}3. Testing High-Throughput Concurrent Movements & Deadlock Resilience...{Colors.END}")
    try:
        # Create a product with 0 stock
        tp_product = Product.objects.create(
            name=f"{test_prefix}Mouse_Wireless",
            sku=f"{test_prefix}MOU-WL-01",
            category=category,
            purchase_price=Decimal('500.00'),
            selling_price=Decimal('800.00'),
            is_stock_enabled=True,
            tracking_type='QUANTITY'
        )

        # We will run 25 stock IN operations of 2 units each = +50 units
        # and 25 stock OUT operations of 1 unit each = -25 units
        # All executed concurrently across 10 worker threads.
        # Net final stock must equal exactly: +50 - 25 = 25 units.
        # First seed initial stock of 25 so OUT operations never fail due to negative stock
        StockService.process_stock_in(
            product=tp_product, quantity=25, movement_type='OPENING',
            reference_type='OPENING_BALANCE', reference_id='TP-OP-01', user=admin_user, unit_cost=Decimal('500.00')
        )

        def worker_op(op_id, is_in):
            connection.close()
            try:
                if is_in:
                    StockService.process_stock_in(
                        product=tp_product, quantity=2, movement_type='PURCHASE',
                        reference_type='PURCHASE', reference_id=f"TP-IN-{op_id}", user=admin_user, unit_cost=Decimal('500.00')
                    )
                else:
                    StockService.process_stock_out(
                        product=tp_product, quantity=1, movement_type='SALE',
                        reference_type='INVOICE', reference_id=f"TP-OUT-{op_id}", user=admin_user
                    )
                return True, op_id, None
            except Exception as exc:
                return False, op_id, str(exc)

        tasks = [(i, True) for i in range(25)] + [(i, False) for i in range(25)]
        import random
        random.seed(42)
        random.shuffle(tasks)

        op_success = 0
        op_errors = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(worker_op, task[0], task[1]) for task in tasks]
            for fut in as_completed(futures):
                success, op_id, err = fut.result()
                if success:
                    op_success += 1
                else:
                    op_errors.append(err)

        connection.close()
        tp_product.refresh_from_db()
        final_tp_stock = tp_product.get_current_stock()
        expected_stock = 25 + (25 * 2) - (25 * 1) # 25 + 50 - 25 = 50

        print(f"     -> Executed 50 concurrent mixed stock operations (25 IN x 2 units, 25 OUT x 1 unit)")
        print(f"     -> Successful operations: {op_success}/50")
        print(f"     -> Final stock: {final_tp_stock} (Expected: {expected_stock})")

        assert op_success == 50, f"Some operations failed: {op_errors}"
        assert final_tp_stock == expected_stock, f"Expected {expected_stock}, got {final_tp_stock}"

        log_pass("Concurrent Throughput & Deadlock Resilience", f"50 concurrent interleaved read/write operations completed without a single deadlock or data race.")
        results["passed"] += 1
    except Exception as e:
        log_fail("Concurrent Throughput & Deadlock Resilience", e)
        results["failed"] += 1
        results["errors"].append(str(e))

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD} STRESS RUN COMPLETE: {Colors.GREEN}{results['passed']} Passed{Colors.END}, {Colors.RED if results['failed'] > 0 else Colors.GREEN}{results['failed']} Failed{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    return results


if __name__ == '__main__':
    run_load_and_concurrency_tests()
