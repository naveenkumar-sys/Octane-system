import os
import sys
import django
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.exceptions import ValidationError

from core.models import (
    Supplier, ProductCategory, Product, SerialNumber, StockMovement,
    Purchase, PurchaseItem, SupplierPayment, Partner, Invoice, InvoiceItem
)
from core.serializers import (
    CreatePurchaseInputSerializer, PurchaseSerializer
)
from core.services.purchase_service import PurchaseService
from core.services.stock_service import StockService
from core.views import PurchaseViewSet, SupplierViewSet


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def log_pass(test_name, details=""):
    print(f"  {Colors.GREEN}[PASS]{Colors.END}: {test_name}" + (f" ({details})" if details else ""))


def log_fail(test_name, reason):
    print(f"  {Colors.RED}[FAIL]{Colors.END}: {test_name} -> Error: {reason}")
    raise AssertionError(f"{test_name} failed: {reason}")


def run_purchase_module_tests():
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE} OCTANE SYSTEMS - PURCHASES MODULE INTEGRITY AUDIT SUITE {Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    factory = APIRequestFactory()
    created_records = []
    
    # Track existing record counts before test
    initial_counts = {
        'Product': Product.objects.count(),
        'Supplier': Supplier.objects.count(),
        'Purchase': Purchase.objects.count(),
        'PurchaseItem': PurchaseItem.objects.count(),
        'StockMovement': StockMovement.objects.count(),
        'SerialNumber': SerialNumber.objects.count(),
        'SupplierPayment': SupplierPayment.objects.count(),
    }

    # Setup test users
    admin_user, _ = User.objects.get_or_create(username='audit_pur_admin', defaults={'is_staff': True, 'is_superuser': True})
    cashier_user, _ = User.objects.get_or_create(username='audit_pur_cashier', defaults={'is_staff': False, 'is_superuser': False})

    try:
        # ==============================================================
        # 1. SETUP TEST FIXTURES
        # ==============================================================
        print(f"{Colors.BOLD}1. Setting up Audit Test Fixtures (Supplier, Category, Products)...{Colors.END}")
        
        # Test category
        cat = ProductCategory.objects.create(name="Audit Hardware Category")
        created_records.append(cat)

        # Test supplier
        supp = Supplier.objects.create(
            name="Matrix Infotech Audit Supplier",
            mobile="+919876543210",
            gstin="29AAAAA0000A1Z5",
            city="Bengaluru",
            state_code="29"
        )
        created_records.append(supp)

        # Inactive supplier
        inactive_supp = Supplier.objects.create(
            name="Defunct Vendor Ltd",
            is_active=False
        )
        created_records.append(inactive_supp)

        # Product A: Quantity Tracked (e.g. Kingston 1TB NVMe SSD)
        prod_qty = Product.objects.create(
            name="Kingston NV2 1TB NVMe SSD",
            category=cat,
            purchase_price=Decimal('4200.00'),
            selling_price=Decimal('5500.00'),
            gst_rate=Decimal('18.00'),
            is_stock_enabled=True,
            tracking_type='QUANTITY'
        )
        created_records.append(prod_qty)

        # Product B: Serial Tracked (e.g. Asus Vivobook Laptop)
        prod_serial = Product.objects.create(
            name="Asus Vivobook 15 OLED",
            category=cat,
            purchase_price=Decimal('50000.00'),
            selling_price=Decimal('62000.00'),
            gst_rate=Decimal('18.00'),
            is_stock_enabled=True,
            tracking_type='SERIAL_NUMBER'
        )
        created_records.append(prod_serial)

        # Inactive product
        prod_inactive = Product.objects.create(
            name="Discontinued HDD",
            category=cat,
            is_active=False,
            is_stock_enabled=True
        )
        created_records.append(prod_inactive)

        # Existing partner for out-of-pocket funding
        partner = Partner.objects.filter(is_active=True).first()
        if not partner:
            partner = Partner.objects.create(name="Audit Funding Partner", ownership_percentage=Decimal('10.00'))
            created_records.append(partner)

        log_pass("Audit Fixtures Initialized", f"Supplier '{supp.name}', Qty Prod '{prod_qty.name}', Serial Prod '{prod_serial.name}'")

        # ==============================================================
        # 2. VALIDATION OF INVALID / MALFORMED PURCHASES
        # ==============================================================
        print(f"\n{Colors.BOLD}2. Auditing Purchase Validation & Boundary Controls...{Colors.END}")

        # 2.1 Empty items line
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'items': []
            })
            log_fail("Empty Items Rejection", "Allowed purchase with 0 items")
        except ValidationError:
            log_pass("Empty Items Rejection", "Blocked purchase with no line items")

        # 2.2 Inactive supplier rejection
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': inactive_supp.id,
                'items': [{'product_id': prod_qty.id, 'quantity': 1, 'unit_cost': 4200}]
            })
            log_fail("Inactive Supplier Rejection", "Allowed purchase from inactive supplier")
        except ValidationError:
            log_pass("Inactive Supplier Rejection", "Blocked purchase from inactive supplier")

        # 2.3 Inactive product rejection
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'items': [{'product_id': prod_inactive.id, 'quantity': 1, 'unit_cost': 1000}]
            })
            log_fail("Inactive Product Rejection", "Allowed purchase of inactive product")
        except ValidationError:
            log_pass("Inactive Product Rejection", "Blocked purchase of inactive product")

        # 2.4 Negative unit cost / quantity
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'items': [{'product_id': prod_qty.id, 'quantity': -5, 'unit_cost': 4200}]
            })
            log_fail("Negative Quantity Rejection", "Allowed negative purchase quantity")
        except ValidationError:
            log_pass("Negative Quantity Rejection", "Blocked negative purchase quantity")

        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'items': [{'product_id': prod_qty.id, 'quantity': 2, 'unit_cost': -500}]
            })
            log_fail("Negative Unit Cost Rejection", "Allowed negative unit cost")
        except ValidationError:
            log_pass("Negative Unit Cost Rejection", "Blocked negative unit cost")

        # ==============================================================
        # 3. QUANTITY-TRACKED PRODUCT INWARD & STOCK LEDGER
        # ==============================================================
        print(f"\n{Colors.BOLD}3. Auditing Quantity-Tracked Inward & Tax Calculations...{Colors.END}")

        initial_stock_qty = prod_qty.get_current_stock()
        
        # Inward 5 SSDs @ 4000 each + 18% GST (Taxable: 20000, Tax: 3600, Total: 23600)
        # Fully paid upfront via CASH
        pur_qty_payload = {
            'supplier_id': supp.id,
            'supplier_invoice_number': 'INV-MI-001',
            'payment_mode': 'CASH',
            'paid_amount': Decimal('23600.00'),
            'items': [{
                'product_id': prod_qty.id,
                'quantity': 5,
                'unit_cost': Decimal('4000.00'),
                'gst_rate': Decimal('18.00')
            }]
        }
        pur1 = PurchaseService.create_and_post_purchase(admin_user, pur_qty_payload)
        created_records.append(pur1)

        # Assertions on Purchase 1
        if pur1.total_amount != Decimal('23600.00'):
            log_fail("Purchase Total Calculation", f"Expected 23600.00, got {pur1.total_amount}")
        if pur1.tax_amount != Decimal('3600.00'):
            log_fail("Purchase Tax Calculation", f"Expected 3600.00, got {pur1.tax_amount}")
        if pur1.payment_status != 'PAID':
            log_fail("Purchase Payment Status", f"Expected PAID, got {pur1.payment_status}")
        log_pass("Purchase Tax & Total Calculations", f"Bill Total: Rs.{pur1.total_amount} (Tax: Rs.{pur1.tax_amount})")

        # Assert stock movement
        new_stock_qty = prod_qty.get_current_stock()
        if new_stock_qty != (initial_stock_qty + 5):
            log_fail("Stock Ledger Inward Increment", f"Expected {initial_stock_qty + 5}, got {new_stock_qty}")
        log_pass("Stock Ledger Inward Increment", f"Current stock increased from {initial_stock_qty} to {new_stock_qty}")

        # Assert SupplierPayment created for upfront CASH
        upfront_pmt = SupplierPayment.objects.filter(purchase=pur1).first()
        if not upfront_pmt or upfront_pmt.amount != Decimal('23600.00'):
            log_fail("Upfront SupplierPayment Creation", f"Missing or wrong payment amount: {upfront_pmt}")
        log_pass("Upfront SupplierPayment Ledger Entry", f"Payment #{upfront_pmt.payment_number} recorded Rs.{upfront_pmt.amount}")

        # Duplicate vendor invoice check
        try:
            PurchaseService.create_and_post_purchase(admin_user, pur_qty_payload)
            log_fail("Duplicate Supplier Invoice Guard", "Allowed duplicate vendor invoice number")
        except ValidationError:
            log_pass("Duplicate Supplier Invoice Guard", f"Blocked duplicate invoice 'INV-MI-001' for '{supp.name}'")

        # ==============================================================
        # 4. SERIAL-TRACKED PRODUCT INWARD & BARCODE INTEGRITY
        # ==============================================================
        print(f"\n{Colors.BOLD}4. Auditing Serial-Tracked Inward & Barcode Registry...{Colors.END}")

        initial_stock_laptop = prod_serial.get_current_stock()

        # 4.1 Inward with mismatched serial count (Qty=2, but 1 serial provided)
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'supplier_invoice_number': 'INV-MI-002',
                'items': [{
                    'product_id': prod_serial.id,
                    'quantity': 2,
                    'unit_cost': Decimal('50000.00'),
                    'gst_rate': Decimal('18.00'),
                    'serial_numbers_text': 'LAP-SN-001'  # Only 1 serial!
                }]
            })
            log_fail("Serial Count Mismatch Guard", "Allowed 2 qty with 1 serial")
        except ValidationError:
            log_pass("Serial Count Mismatch Guard", "Blocked inward when serial count does not match quantity")

        # 4.2 Inward with duplicate serials in batch
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'supplier_invoice_number': 'INV-MI-003',
                'items': [{
                    'product_id': prod_serial.id,
                    'quantity': 2,
                    'unit_cost': Decimal('50000.00'),
                    'serial_numbers_text': 'LAP-SN-001, LAP-SN-001'  # Duplicate in same batch!
                }]
            })
            log_fail("Duplicate Batch Serial Guard", "Allowed duplicate serials in batch")
        except ValidationError:
            log_pass("Duplicate Batch Serial Guard", "Blocked duplicate serials within the same purchase line")

        # 4.3 Successful Serial Inward: 2 Laptops @ 50,000 + 18% GST on CREDIT
        # Total: 1,18,000. Paid: 0.00 (CREDIT)
        pur2 = PurchaseService.create_and_post_purchase(admin_user, {
            'supplier_id': supp.id,
            'supplier_invoice_number': 'INV-MI-004',
            'payment_mode': 'CREDIT',
            'items': [{
                'product_id': prod_serial.id,
                'quantity': 2,
                'unit_cost': Decimal('50000.00'),
                'gst_rate': Decimal('18.00'),
                'serial_numbers_text': 'AUDIT-LAP-001, AUDIT-LAP-002'
            }]
        })
        created_records.append(pur2)

        # Assertions on Purchase 2 (Credit)
        if pur2.payment_status != 'UNPAID':
            log_fail("Credit Purchase Status", f"Expected UNPAID, got {pur2.payment_status}")
        if pur2.paid_amount != Decimal('0.00'):
            log_fail("Credit Purchase Paid Amount", f"Expected 0.00, got {pur2.paid_amount}")
        log_pass("Credit Purchase Posting", f"Total: Rs.{pur2.total_amount}, Paid: Rs.{pur2.paid_amount}, Status: UNPAID")

        # Assert SerialNumber instances in DB
        s1 = SerialNumber.objects.filter(product=prod_serial, serial_number='AUDIT-LAP-001').first()
        s2 = SerialNumber.objects.filter(product=prod_serial, serial_number='AUDIT-LAP-002').first()
        if not s1 or not s2 or s1.status != 'AVAILABLE' or s2.status != 'AVAILABLE':
            log_fail("SerialNumber Registry", f"Serials not properly registered as AVAILABLE: {s1}, {s2}")
        log_pass("SerialNumber Registry Creation", f"Created serials 'AUDIT-LAP-001' and 'AUDIT-LAP-002' with status AVAILABLE")

        # Assert Stock count
        new_laptop_stock = prod_serial.get_current_stock()
        if new_laptop_stock != (initial_stock_laptop + 2):
            log_fail("Serial Stock Count Increment", f"Expected {initial_stock_laptop + 2}, got {new_laptop_stock}")
        log_pass("Serial Stock Increment", f"Laptop stock increased to {new_laptop_stock}")

        # 4.4 Attempting to re-inward an existing serial in DB
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'supplier_invoice_number': 'INV-MI-005',
                'items': [{
                    'product_id': prod_serial.id,
                    'quantity': 1,
                    'unit_cost': Decimal('50000.00'),
                    'serial_numbers_text': 'AUDIT-LAP-001'  # Already exists!
                }]
            })
            log_fail("Existing Serial Collision Guard", "Allowed re-inwarding existing serial number")
        except ValidationError:
            log_pass("Existing Serial Collision Guard", "Blocked inwarding already-registered serial number")

        # ==============================================================
        # 5. SUPPLIER CREDIT DUES & DELAYED PAYMENT RECORDING
        # ==============================================================
        print(f"\n{Colors.BOLD}5. Auditing Supplier Credit Ledgers & Delayed Payments...{Colors.END}")

        # Check supplier outstanding payable
        # pur1 was paid (23600), pur2 is unpaid (118000) -> Outstanding = 118000
        balance_outstanding = sum((p.total_amount - p.paid_amount) for p in supp.purchases.all())
        if balance_outstanding != Decimal('118000.00'):
            log_fail("Supplier Balance Calculation", f"Expected 118000.00, got {balance_outstanding}")
        log_pass("Supplier Outstanding Ledger Balance", f"Outstanding payable to '{supp.name}' is Rs.{balance_outstanding}")

        # 5.1 Delayed payment overpay guard: Paying 150000 when due is 118000
        try:
            PurchaseService.record_supplier_payment(admin_user, pur2.id, {
                'amount': Decimal('150000.00'),
                'payment_mode': 'BANK_TRANSFER'
            })
            log_fail("Payment Overpay Guard", "Allowed paying more than remaining balance")
        except ValidationError:
            log_pass("Payment Overpay Boundary Guard", "Blocked supplier payment exceeding outstanding balance")

        # 5.2 Partial delayed payment: Pay 50000 via NEFT
        pay1 = PurchaseService.record_supplier_payment(admin_user, pur2.id, {
            'amount': Decimal('50000.00'),
            'payment_mode': 'BANK_TRANSFER',
            'reference_number': 'NEFT-REF-9988'
        })
        pur2.refresh_from_db()
        if pur2.paid_amount != Decimal('50000.00') or pur2.payment_status != 'PARTIALLY_PAID':
            log_fail("Partial Delayed Payment Status", f"Expected 50000.00 / PARTIALLY_PAID, got {pur2.paid_amount} / {pur2.payment_status}")
        log_pass("Partial Delayed Payment Recording", f"Recorded Rs.{pay1.amount} (NEFT). Status now {pur2.payment_status}, Remaining: Rs.{pur2.total_amount - pur2.paid_amount}")

        # 5.3 Clear remaining balance: Pay 68000 via UPI
        pay2 = PurchaseService.record_supplier_payment(admin_user, pur2.id, {
            'amount': Decimal('68000.00'),
            'payment_mode': 'UPI',
            'reference_number': 'UPI-REF-1122'
        })
        pur2.refresh_from_db()
        if pur2.paid_amount != Decimal('118000.00') or pur2.payment_status != 'PAID':
            log_fail("Full Payment Status Update", f"Expected 118000.00 / PAID, got {pur2.paid_amount} / {pur2.payment_status}")
        log_pass("Full Payment Settlement", f"Recorded final Rs.{pay2.amount} (UPI). Bill #{pur2.purchase_number} fully settled (PAID)")

        # ==============================================================
        # 6. PARTNER OUT-OF-POCKET PURCHASE FUNDING
        # ==============================================================
        print(f"\n{Colors.BOLD}6. Auditing Partner Out-of-Pocket Purchase Funding...{Colors.END}")

        # 6.1 Unspecified partner rejection
        try:
            PurchaseService.create_and_post_purchase(admin_user, {
                'supplier_id': supp.id,
                'supplier_invoice_number': 'INV-MI-006',
                'payment_mode': 'PARTNER_OUT_OF_POCKET',
                'items': [{'product_id': prod_qty.id, 'quantity': 1, 'unit_cost': Decimal('4000.00')}]
            })
            log_fail("Partner Out-of-Pocket Validation", "Allowed PARTNER_OUT_OF_POCKET without partner")
        except ValidationError:
            log_pass("Partner Selection Enforcement", "Blocked PARTNER_OUT_OF_POCKET without funding partner")

        # 6.2 Valid partner-funded purchase
        pur_partner = PurchaseService.create_and_post_purchase(admin_user, {
            'supplier_id': supp.id,
            'supplier_invoice_number': 'INV-MI-007',
            'payment_mode': 'PARTNER_OUT_OF_POCKET',
            'paid_by_partner_id': partner.id,
            'items': [{
                'product_id': prod_qty.id,
                'quantity': 2,
                'unit_cost': Decimal('4000.00'),
                'gst_rate': Decimal('18.00')
            }]
        })
        created_records.append(pur_partner)
        if pur_partner.paid_by_partner_id != partner.id or pur_partner.payment_status != 'PAID':
            log_fail("Partner Funded Purchase Creation", f"Partner ID mismatch or status not PAID: {pur_partner}")
        log_pass("Partner-Funded Purchase Registration", f"Purchase #{pur_partner.purchase_number} funded by '{partner.name}' (Rs.{pur_partner.total_amount})")

        # ==============================================================
        # 7. SUPPLIER PURCHASE RETURNS
        # ==============================================================
        print(f"\n{Colors.BOLD}7. Auditing Supplier Purchase Return Workflow...{Colors.END}")

        # Return 1 unit of SSD from pur1 (Total: 4000 + 18% = 4720)
        pur1_item = pur1.items.first()
        stock_before_ret = prod_qty.get_current_stock()
        
        ret_result = PurchaseService.process_purchase_return(admin_user, pur1.id, {
            'items': [{
                'purchase_item_id': pur1_item.id,
                'quantity': 1,
                'reason': 'Damaged box upon arrival'
            }]
        })
        
        pur1.refresh_from_db()
        stock_after_ret = prod_qty.get_current_stock()
        
        # Verify stock decreased by 1
        if stock_after_ret != (stock_before_ret - 1):
            log_fail("Purchase Return Stock Reduction", f"Expected {stock_before_ret - 1}, got {stock_after_ret}")
        log_pass("Purchase Return Stock Ledger Outward", f"Stock decreased from {stock_before_ret} to {stock_after_ret}")

        # Verify bill amount reduced by 4720
        expected_new_total = Decimal('23600.00') - Decimal('4720.00')
        if pur1.total_amount != expected_new_total:
            log_fail("Purchase Return Total Reduction", f"Expected {expected_new_total}, got {pur1.total_amount}")
        log_pass("Purchase Return Value Credit", f"Purchase bill reduced to Rs.{pur1.total_amount}")

        # Return Serialized Laptop (AUDIT-LAP-002)
        pur2_item = pur2.items.first()
        ret_laptop = PurchaseService.process_purchase_return(admin_user, pur2.id, {
            'items': [{
                'purchase_item_id': pur2_item.id,
                'quantity': 1,
                'serial_number': 'AUDIT-LAP-002',
                'reason': 'Screen flicker defect'
            }]
        })
        s2.refresh_from_db()
        if s2.status != 'DEFECTIVE':
            log_fail("Defective Serial Return Status", f"Expected status DEFECTIVE, got {s2.status}")
        log_pass("Serial Return Status Transition", f"Serial 'AUDIT-LAP-002' transitioned from AVAILABLE -> DEFECTIVE")

        # ==============================================================
        # 8. SECURITY & ROLE-BASED ACCESS CONTROL (RBAC)
        # ==============================================================
        print(f"\n{Colors.BOLD}8. Auditing Purchase RBAC & Endpoint Permissions...{Colors.END}")

        # 8.1 Unauthenticated request blocked
        req_unauth = factory.get('/api/purchases/')
        resp_unauth = PurchaseViewSet.as_view({'get': 'list'})(req_unauth)
        if resp_unauth.status_code not in (401, 403):
            log_fail("Unauthenticated Purchase Access", f"Expected 401/403, got {resp_unauth.status_code}")
        log_pass("Unauthenticated Purchase Access Guard", f"Blocked with HTTP {resp_unauth.status_code}")

        # 8.2 Cashier blocked from viewing/creating purchases
        req_cashier_get = factory.get('/api/purchases/')
        force_authenticate(req_cashier_get, user=cashier_user)
        resp_cashier_get = PurchaseViewSet.as_view({'get': 'list'})(req_cashier_get)
        if resp_cashier_get.status_code != 403:
            log_fail("Cashier Purchase Read Access", f"Expected 403, got {resp_cashier_get.status_code}")
        log_pass("Cashier Purchase Read Guard", "Blocked cashier with HTTP 403 Forbidden")

        req_cashier_post = factory.post('/api/purchases/', {'supplier_id': supp.id})
        force_authenticate(req_cashier_post, user=cashier_user)
        resp_cashier_post = PurchaseViewSet.as_view({'post': 'create'})(req_cashier_post)
        if resp_cashier_post.status_code != 403:
            log_fail("Cashier Purchase Write Access", f"Expected 403, got {resp_cashier_post.status_code}")
        log_pass("Cashier Purchase Write Guard", "Blocked cashier with HTTP 403 Forbidden")

        # ==============================================================
        # 9. DELETION INTEGRITY & PHANTOM STOCK PRESERVATION
        # ==============================================================
        print(f"\n{Colors.BOLD}9. Auditing Purchase Deletion Integrity & Reversal...{Colors.END}")

        # 9.1 Purchase with return processed cannot be deleted
        req_del_ret = factory.delete(f'/api/purchases/{pur1.id}/')
        force_authenticate(req_del_ret, user=admin_user)
        resp_del_ret = PurchaseViewSet.as_view({'delete': 'destroy'})(req_del_ret, pk=pur1.id)
        if resp_del_ret.status_code != 400:
            log_fail("Deletion of Returned Purchase Guard", f"Expected 400, got {resp_del_ret.status_code}")
        log_pass("Returned Purchase Deletion Guard", f"Blocked with HTTP 400: '{resp_del_ret.data.get('error')}'")

        # 9.2 Purchase with sold serial cannot be deleted
        # Simulate an invoice sale of 'AUDIT-LAP-001'
        s1.status = 'SOLD'
        s1.save()
        req_del_sold = factory.delete(f'/api/purchases/{pur2.id}/')
        force_authenticate(req_del_sold, user=admin_user)
        resp_del_sold = PurchaseViewSet.as_view({'delete': 'destroy'})(req_del_sold, pk=pur2.id)
        if resp_del_sold.status_code != 400:
            log_fail("Deletion of Sold Serial Purchase Guard", f"Expected 400, got {resp_del_sold.status_code}")
        log_pass("Sold Serial Purchase Deletion Guard", f"Blocked with HTTP 400: '{resp_del_sold.data.get('error')}'")
        s1.status = 'AVAILABLE'
        s1.save()

        # 9.3 Clean deletion of an unreturned purchase:
        # Create a temporary purchase, verify stock is added, delete purchase, verify stock and serials are reverted
        clean_pur = PurchaseService.create_and_post_purchase(admin_user, {
            'supplier_id': supp.id,
            'supplier_invoice_number': 'INV-CLEAN-TEMP-001',
            'payment_mode': 'CASH',
            'items': [{
                'product_id': prod_serial.id,
                'quantity': 1,
                'unit_cost': Decimal('50000.00'),
                'serial_numbers_text': 'AUDIT-TEMP-SERIAL-999'
            }]
        })
        temp_stock_mid = prod_serial.get_current_stock()
        
        # Now delete via API ViewSet
        req_del_clean = factory.delete(f'/api/purchases/{clean_pur.id}/')
        force_authenticate(req_del_clean, user=admin_user)
        resp_del_clean = PurchaseViewSet.as_view({'delete': 'destroy'})(req_del_clean, pk=clean_pur.id)
        if resp_del_clean.status_code != 200:
            log_fail("Clean Purchase Deletion", f"Expected 200, got {resp_del_clean.status_code}")
        
        temp_stock_after = prod_serial.get_current_stock()
        serial_exists = SerialNumber.objects.filter(serial_number='AUDIT-TEMP-SERIAL-999').exists()
        mov_exists = StockMovement.objects.filter(reference_type='PURCHASE', reference_id=clean_pur.purchase_number).exists()
        
        if temp_stock_after != (temp_stock_mid - 1) or serial_exists or mov_exists:
            log_fail("Stock & Serial Reversal on Deletion", f"Stock: {temp_stock_after}, Serial exists: {serial_exists}, Movement exists: {mov_exists}")
        log_pass("Atomic Stock Ledger & Serial Reversal on Deletion", f"Stock reverted (-1), serial purged, 0 ghost movements remain")

        # 9.4 Supplier with purchases cannot be deleted
        req_del_supp = factory.delete(f'/api/suppliers/{supp.id}/')
        force_authenticate(req_del_supp, user=admin_user)
        resp_del_supp = SupplierViewSet.as_view({'delete': 'destroy'})(req_del_supp, pk=supp.id)
        if resp_del_supp.status_code != 400:
            log_fail("Supplier with Purchases Deletion Guard", f"Expected 400, got {resp_del_supp.status_code}")
        log_pass("Supplier Cascade Deletion Protection", f"Blocked with HTTP 400: '{resp_del_supp.data.get('error')}'")

        print(f"\n{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN} ALL PURCHASES MODULE INTEGRITY & SECURITY TESTS PASSED! {Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}\n")

    finally:
        # ==============================================================
        # 10. COMPREHENSIVE TEARDOWN (CLEAN DATABASE PROMISE)
        # ==============================================================
        print(f"{Colors.BOLD}10. Cleaning up all audit records (leaving database clean)...{Colors.END}")
        with transaction.atomic():
            # Delete any created purchases cleanly
            for pur in Purchase.objects.filter(supplier__name="Matrix Infotech Audit Supplier"):
                StockMovement.objects.filter(reference_type__in=['PURCHASE', 'PURCHASE_RETURN'], reference_id=pur.purchase_number).delete()
                SerialNumber.objects.filter(purchase_reference__icontains=pur.purchase_number).delete()
                SupplierPayment.objects.filter(purchase=pur).delete()
                pur.items.all().delete()
                pur.delete()

            # Clean serials
            SerialNumber.objects.filter(serial_number__startswith="AUDIT-").delete()
            
            # Clean stock movements
            StockMovement.objects.filter(product__name__in=["Kingston NV2 1TB NVMe SSD", "Asus Vivobook 15 OLED", "Discontinued HDD"]).delete()

            # Clean up all created master records in reverse order
            for rec in reversed(created_records):
                try:
                    rec.delete()
                except Exception:
                    pass

            admin_user.delete()
            cashier_user.delete()

        # Verify database record counts match initial counts
        final_counts = {
            'Product': Product.objects.count(),
            'Supplier': Supplier.objects.count(),
            'Purchase': Purchase.objects.count(),
            'PurchaseItem': PurchaseItem.objects.count(),
            'StockMovement': StockMovement.objects.count(),
            'SerialNumber': SerialNumber.objects.count(),
            'SupplierPayment': SupplierPayment.objects.count(),
        }

        diffs = {k: final_counts[k] - initial_counts[k] for k in initial_counts if final_counts[k] != initial_counts[k]}
        if diffs:
            print(f"{Colors.RED}[CLEANUP WARNING]{Colors.END}: Stray records detected: {diffs}")
        else:
            print(f"{Colors.GREEN}[CLEANUP COMPLETE]{Colors.END}: All test records purged. Database is 100% clean.\n")


if __name__ == '__main__':
    run_purchase_module_tests()
