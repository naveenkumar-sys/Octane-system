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
    BusinessProfile, Customer, ProductCategory, Product, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, InvoiceItem, Payment, Partner
)
from core.services.invoice_service import InvoiceService
from core.services.stock_service import StockService
from core.services.tax_engine import TaxEngine
from core.services.partner_ledger_service import PartnerLedgerService
from core.views import InvoiceViewSet, CustomerOutstandingView


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


def run_invoice_module_tests():
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE} OCTANE SYSTEMS - POS BILLING & INVOICING AUDIT SUITE {Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    factory = APIRequestFactory()
    created_records = []

    # Initial counts snapshot
    initial_counts = {
        'Invoice': Invoice.objects.count(),
        'InvoiceItem': InvoiceItem.objects.count(),
        'Payment': Payment.objects.count(),
        'StockMovement': StockMovement.objects.count(),
        'SerialNumber': SerialNumber.objects.count(),
        'Customer': Customer.objects.count(),
        'Product': Product.objects.count(),
        'Service': Service.objects.count(),
    }

    # Setup test users
    admin_user, _ = User.objects.get_or_create(username='audit_pos_admin', defaults={'is_staff': True, 'is_superuser': True})
    cashier_user, _ = User.objects.get_or_create(username='audit_pos_cashier', defaults={'is_staff': False, 'is_superuser': False})

    try:
        # ==============================================================
        # 1. SETUP TEST FIXTURES
        # ==============================================================
        print(f"{Colors.BOLD}1. Setting up POS Audit Test Fixtures (Customer, Catalog, Stock)...{Colors.END}")
        
        # Intra-state customer (Karnataka 29)
        cust_local = Customer.objects.create(
            name="Vikas Gowda Intra",
            mobile="+919888811111",
            gstin="29ABCDE1234F1Z5",
            city="Bengaluru",
            state_code="29"
        )
        created_records.append(cust_local)

        # Inter-state customer (Tamil Nadu 33)
        cust_inter = Customer.objects.create(
            name="Murugan Enterprises Inter",
            mobile="+919777722222",
            gstin="33ABCDE5678F1Z9",
            city="Chennai",
            state_code="33"
        )
        created_records.append(cust_inter)

        # Inactive customer
        cust_inactive = Customer.objects.create(
            name="Inactive Customer",
            is_active=False
        )
        created_records.append(cust_inactive)

        # Category
        cat = ProductCategory.objects.create(name="POS Hardware Audit Cat")
        created_records.append(cat)

        # Product A: Quantity Tracked (Thermal Receipt Printer)
        prod_qty = Product.objects.create(
            name="Epson TM-T82 Thermal Printer",
            category=cat,
            purchase_price=Decimal('6000.00'),
            selling_price=Decimal('8000.00'),
            gst_rate=Decimal('18.00'),
            is_stock_enabled=True,
            tracking_type='QUANTITY'
        )
        created_records.append(prod_qty)
        # Give it opening stock of 10 units
        StockService.process_stock_in(
            product=prod_qty,
            quantity=10,
            movement_type='OPENING',
            reference_type='AUDIT_INIT',
            unit_cost=Decimal('6000.00'),
            user=admin_user
        )

        # Product B: Serial Tracked (Gaming Laptop)
        prod_serial = Product.objects.create(
            name="Lenovo Legion 5 Pro",
            category=cat,
            purchase_price=Decimal('90000.00'),
            selling_price=Decimal('120000.00'),
            gst_rate=Decimal('18.00'),
            is_stock_enabled=True,
            tracking_type='SERIAL_NUMBER'
        )
        created_records.append(prod_serial)
        # Inward 2 serials: POS-SN-101 and POS-SN-102
        StockService.process_stock_in(
            product=prod_serial,
            quantity=2,
            movement_type='OPENING',
            reference_type='AUDIT_INIT',
            serial_numbers_list=['POS-SN-101', 'POS-SN-102'],
            unit_cost=Decimal('90000.00'),
            user=admin_user
        )

        # Service Category & Service (Chip-Level Motherboard Servicing)
        sc = ServiceCategory.objects.create(name="POS Repair Services")
        created_records.append(sc)

        svc = Service.objects.create(
            service_name="Motherboard BGA Reballing Service",
            category=sc,
            default_rate=Decimal('3500.00'),
            gst_rate=Decimal('18.00'),
            sac="998313"
        )
        created_records.append(svc)

        # Inactive Service
        svc_inactive = Service.objects.create(
            service_name="Discontinued Repair Service",
            is_active=False
        )
        created_records.append(svc_inactive)

        # Partner
        partner = Partner.objects.filter(is_active=True).first()

        log_pass("POS Fixtures Initialized", f"Printers stock: 10, Laptops stock: 2, Service: '{svc.service_name}'")

        # ==============================================================
        # 2. VALIDATION & BOUNDARY GUARDS
        # ==============================================================
        print(f"\n{Colors.BOLD}2. Auditing POS Pre-Validation & Boundary Controls...{Colors.END}")

        # 2.1 Empty items rejection
        try:
            InvoiceService.create_and_post_invoice(admin_user, {'items': []})
            log_fail("Empty Items Rejection", "Allowed invoice with 0 items")
        except ValidationError:
            log_pass("Empty Items Rejection", "Blocked invoice with no line items")

        # 2.2 Inactive customer rejection
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'customer_id': cust_inactive.id,
                'items': [{'item_type': 'PRODUCT', 'product_id': prod_qty.id, 'quantity': 1, 'rate': 8000}]
            })
            log_fail("Inactive Customer Rejection", "Allowed billing an inactive customer")
        except ValidationError:
            log_pass("Inactive Customer Rejection", "Blocked billing inactive customer")

        # 2.3 Inactive service rejection
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'items': [{'item_type': 'SERVICE', 'service_id': svc_inactive.id, 'rate': 3500}]
            })
            log_fail("Inactive Service Rejection", "Allowed billing an inactive service")
        except ValidationError:
            log_pass("Inactive Service Rejection", "Blocked billing inactive service")

        # 2.4 Overpayment boundary guard: Total bill 8000 + 18% = 9440, but paid 15000
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'items': [{'item_type': 'PRODUCT', 'product_id': prod_qty.id, 'quantity': 1, 'rate': 8000, 'gst_rate': 18}],
                'payments': [{'payment_mode': 'CASH', 'amount': Decimal('15000.00')}]
            })
            log_fail("Upfront Overpayment Guard", "Allowed upfront payment exceeding invoice grand total")
        except ValidationError:
            log_pass("Upfront Overpayment Guard", "Blocked cash payment exceeding invoice total")

        # ==============================================================
        # 3. GST TAX CALCULATIONS: INTRA-STATE vs INTER-STATE
        # ==============================================================
        print(f"\n{Colors.BOLD}3. Auditing GST Tax Engine (Intra-State CGST/SGST vs Inter-State IGST)...{Colors.END}")

        # 3.1 Intra-State Bill: 2 Printers @ 8000 each = 16000 taxable. 18% GST = 2880 (CGST: 1440, SGST: 1440, IGST: 0)
        inv_intra = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_local.id,
            'buyer_state_code': '29',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': prod_qty.id,
                'quantity': 2,
                'rate': Decimal('8000.00'),
                'gst_rate': Decimal('18.00')
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': Decimal('18880.00')}]
        })
        created_records.append(inv_intra)

        if inv_intra.taxable_amount != Decimal('16000.00'):
            log_fail("Intra-State Taxable Value", f"Expected 16000.00, got {inv_intra.taxable_amount}")
        if inv_intra.total_cgst != Decimal('1440.00') or inv_intra.total_sgst != Decimal('1440.00') or inv_intra.total_igst != Decimal('0.00'):
            log_fail("Intra-State Split", f"Expected CGST=1440, SGST=1440, IGST=0. Got {inv_intra.total_cgst}, {inv_intra.total_sgst}, {inv_intra.total_igst}")
        if inv_intra.grand_total != Decimal('18880.00'):
            log_fail("Intra-State Grand Total", f"Expected 18880.00, got {inv_intra.grand_total}")
        log_pass("Intra-State Tax Split (Karnataka -> Karnataka)", f"Taxable: Rs.16000, CGST: Rs.{inv_intra.total_cgst}, SGST: Rs.{inv_intra.total_sgst}, IGST: Rs.0")

        # Stock check: 10 - 2 = 8
        if prod_qty.get_current_stock() != 8:
            log_fail("Quantity Stock Deduction", f"Expected 8, got {prod_qty.get_current_stock()}")
        log_pass("Quantity Stock Outward", f"Stock deducted by 2 (Remaining: {prod_qty.get_current_stock()})")

        # 3.2 Inter-State Bill: 1 Printer @ 8000 to Tamil Nadu (33). 18% GST = 1440 IGST (CGST: 0, SGST: 0)
        inv_inter = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_inter.id,
            'buyer_state_code': '33',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': prod_qty.id,
                'quantity': 1,
                'rate': Decimal('8000.00'),
                'gst_rate': Decimal('18.00')
            }],
            'payments': [{'payment_mode': 'UPI', 'amount': Decimal('9440.00')}]
        })
        created_records.append(inv_inter)

        if inv_inter.total_cgst != Decimal('0.00') or inv_inter.total_sgst != Decimal('0.00') or inv_inter.total_igst != Decimal('1440.00'):
            log_fail("Inter-State Split", f"Expected CGST=0, SGST=0, IGST=1440. Got {inv_inter.total_cgst}, {inv_inter.total_sgst}, {inv_inter.total_igst}")
        log_pass("Inter-State IGST Split (Karnataka -> Tamil Nadu)", f"Taxable: Rs.8000, CGST: Rs.0, SGST: Rs.0, IGST: Rs.{inv_inter.total_igst}")

        # 3.3 Non-GST / Estimate Invoice
        inv_nongst = InvoiceService.create_and_post_invoice(admin_user, {
            'invoice_type': 'NON_GST',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': prod_qty.id,
                'quantity': 1,
                'rate': Decimal('8000.00')
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': Decimal('8000.00')}]
        })
        created_records.append(inv_nongst)
        if inv_nongst.total_tax != Decimal('0.00') or inv_nongst.grand_total != Decimal('8000.00'):
            log_fail("Non-GST Tax Zeroing", f"Expected 0 tax, got {inv_nongst.total_tax}")
        if not inv_nongst.invoice_number.startswith('EST-'):
            log_fail("Non-GST Numbering Prefix", f"Expected EST- prefix, got {inv_nongst.invoice_number}")
        log_pass("Non-GST / Estimate Invoice Generation", f"Invoice #{inv_nongst.invoice_number} generated with 0% Tax (Grand Total: Rs.{inv_nongst.grand_total})")

        # ==============================================================
        # 4. SERIAL-TRACKED OUTWARD & BARCODE INTEGRITY
        # ==============================================================
        print(f"\n{Colors.BOLD}4. Auditing Serial Number Outward & Barcode Registry...{Colors.END}")

        # 4.1 Missing serial on serial-tracked product
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'customer_id': cust_local.id,
                'items': [{'item_type': 'PRODUCT', 'product_id': prod_serial.id, 'quantity': 1, 'rate': 120000}]
            })
            log_fail("Missing Serial Rejection", "Allowed selling serial product without serial number")
        except ValidationError:
            log_pass("Missing Serial Enforcement", "Blocked checkout of serial-tracked product without barcode")

        # 4.2 Non-existent serial
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'customer_id': cust_local.id,
                'items': [{
                    'item_type': 'PRODUCT',
                    'product_id': prod_serial.id,
                    'quantity': 1,
                    'rate': 120000,
                    'serial_number': 'FAKE-SERIAL-999'
                }]
            })
            log_fail("Non-Existent Serial Guard", "Allowed selling non-existent serial")
        except ValidationError:
            log_pass("Non-Existent Serial Guard", "Blocked selling non-existent serial number")

        # 4.3 Successful Serial Outward: Sell POS-SN-101
        inv_serial = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_local.id,
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': prod_serial.id,
                'quantity': 1,
                'rate': Decimal('120000.00'),
                'gst_rate': Decimal('18.00'),
                'serial_number': 'POS-SN-101'
            }],
            'payments': [{'payment_mode': 'CARD', 'amount': Decimal('141600.00')}]
        })
        created_records.append(inv_serial)

        sn_101 = SerialNumber.objects.get(product=prod_serial, serial_number='POS-SN-101')
        if sn_101.status != 'SOLD' or sn_101.invoice_reference != f"INVOICE-{inv_serial.invoice_number}":
            log_fail("Serial SOLD Status Update", f"Expected SOLD, got {sn_101.status}")
        log_pass("Serial Status Outward Transition", f"Serial 'POS-SN-101' transitioned to SOLD linked to {sn_101.invoice_reference}")

        # 4.4 Attempting to sell already-sold serial 'POS-SN-101'
        try:
            InvoiceService.create_and_post_invoice(admin_user, {
                'customer_id': cust_local.id,
                'items': [{
                    'item_type': 'PRODUCT',
                    'product_id': prod_serial.id,
                    'quantity': 1,
                    'rate': 120000,
                    'serial_number': 'POS-SN-101'
                }]
            })
            log_fail("Already Sold Serial Guard", "Allowed selling already sold serial")
        except ValidationError:
            log_pass("Already Sold Serial Guard", "Blocked double-selling serial 'POS-SN-101'")

        # ==============================================================
        # 5. MIXED BASKET BILLING (PRODUCT + SERVICE)
        # ==============================================================
        print(f"\n{Colors.BOLD}5. Auditing Mixed Baskets (Physical Products + Labor Services)...{Colors.END}")

        # Bill 1 Printer (Product) + 1 Motherboard Service (Service)
        # Printer: 8000 + 18% = 9440
        # Service: 3500 + 18% = 4130
        # Total: 13570
        stock_printer_before = prod_qty.get_current_stock()
        
        inv_mixed = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_local.id,
            'items': [
                {'item_type': 'PRODUCT', 'product_id': prod_qty.id, 'quantity': 1, 'rate': Decimal('8000.00'), 'gst_rate': 18},
                {'item_type': 'SERVICE', 'service_id': svc.id, 'quantity': 1, 'rate': Decimal('3500.00'), 'gst_rate': 18}
            ],
            'payments': [{'payment_mode': 'CASH', 'amount': Decimal('13570.00')}]
        })
        created_records.append(inv_mixed)

        if inv_mixed.grand_total != Decimal('13570.00'):
            log_fail("Mixed Bill Grand Total", f"Expected 13570.00, got {inv_mixed.grand_total}")
        
        # Verify physical stock reduced by 1 for product
        stock_printer_after = prod_qty.get_current_stock()
        if stock_printer_after != (stock_printer_before - 1):
            log_fail("Mixed Bill Stock Deduction", f"Expected {stock_printer_before - 1}, got {stock_printer_after}")
        
        # Verify NO stock movements were created for the service
        svc_movements = StockMovement.objects.filter(reference_type='INVOICE', reference_id=inv_mixed.invoice_number, notes__icontains=svc.service_name).count()
        if svc_movements != 0:
            log_fail("Service Stock Invariance", "Stock movements incorrectly generated for non-physical service")
        log_pass("Mixed Basket Processing", f"Product stock deducted (-1), 0 phantom movements for Service, Bill Total: Rs.{inv_mixed.grand_total}")

        # ==============================================================
        # 6. SPLIT PAYMENTS, CREDIT DUES & DELAYED SETTLEMENT
        # ==============================================================
        print(f"\n{Colors.BOLD}6. Auditing Split Payments & Customer Credit Ledgers...{Colors.END}")

        # 6.1 Split Payment (Cash + UPI) on full bill
        # Total: 8000 + 18% = 9440 -> Paid: 5000 Cash + 4440 UPI
        inv_split = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_local.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': prod_qty.id, 'quantity': 1, 'rate': Decimal('8000.00'), 'gst_rate': 18}],
            'payments': [
                {'payment_mode': 'CASH', 'amount': Decimal('5000.00')},
                {'payment_mode': 'UPI', 'amount': Decimal('4440.00')}
            ]
        })
        created_records.append(inv_split)
        if inv_split.payment_status != 'PAID' or inv_split.payments.count() != 2:
            log_fail("Split Payment Settlement", f"Status: {inv_split.payment_status}, Payments count: {inv_split.payments.count()}")
        log_pass("Multi-Mode Split Payment", f"Bill settled with 2 receipts: Rs.5000 (CASH) + Rs.4440 (UPI). Status: PAID")

        # 6.2 Partial Payment with Credit Balance
        # Total: 9440 -> Upfront: 2000 Cash, Credit: 7440
        inv_credit = InvoiceService.create_and_post_invoice(admin_user, {
            'customer_id': cust_local.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': prod_qty.id, 'quantity': 1, 'rate': Decimal('8000.00'), 'gst_rate': 18}],
            'payments': [
                {'payment_mode': 'CASH', 'amount': Decimal('2000.00')},
                {'payment_mode': 'CREDIT', 'amount': Decimal('7440.00')}  # Must NOT be added to total_paid!
            ]
        })
        created_records.append(inv_credit)
        if inv_credit.total_paid_amount != Decimal('2000.00') or inv_credit.balance_due_amount != Decimal('7440.00') or inv_credit.payment_status != 'PARTIALLY_PAID':
            log_fail("Partial Credit Bill", f"Paid: {inv_credit.total_paid_amount}, Due: {inv_credit.balance_due_amount}, Status: {inv_credit.payment_status}")
        log_pass("Partial Payment & Credit Dues Posting", f"Paid: Rs.{inv_credit.total_paid_amount}, Outstanding Dues: Rs.{inv_credit.balance_due_amount}")

        # Check Customer Outstanding endpoint
        req_out = factory.get(f'/api/customers/{cust_local.id}/outstanding/')
        force_authenticate(req_out, user=admin_user)
        resp_out = CustomerOutstandingView.as_view()(req_out, customer_id=cust_local.id)
        if resp_out.data['balance_due'] != Decimal('7440.00'):
            log_fail("Customer Receivables API", f"Expected 7440.00, got {resp_out.data['balance_due']}")
        log_pass("Customer Outstanding API Calculation", f"Customer '{cust_local.name}' balance due correctly verified as Rs.{resp_out.data['balance_due']}")

        # 6.3 Delayed Payment via /api/invoices/<id>/record-payment/
        # Overpay check: paying 10000 when due is 7440
        try:
            InvoiceService.record_delayed_payment(admin_user, inv_credit.id, {'amount': Decimal('10000.00'), 'payment_mode': 'CASH'})
            log_fail("Delayed Payment Overpay Guard", "Allowed paying more than remaining due")
        except ValidationError:
            log_pass("Delayed Payment Overpay Guard", "Blocked delayed payment exceeding balance due")

        # Pay exact remaining balance: 7440
        pay_delayed = InvoiceService.record_delayed_payment(admin_user, inv_credit.id, {
            'amount': Decimal('7440.00'),
            'payment_mode': 'BANK_TRANSFER',
            'reference_number': 'IMPS-REC-8877'
        })
        inv_credit.refresh_from_db()
        if inv_credit.balance_due_amount != Decimal('0.00') or inv_credit.payment_status != 'PAID':
            log_fail("Delayed Payment Clearance", f"Due: {inv_credit.balance_due_amount}, Status: {inv_credit.payment_status}")
        log_pass("Delayed Customer Payment Clearance", f"Recorded Rs.{pay_delayed.amount} (BANK_TRANSFER). Invoice #{inv_credit.invoice_number} now fully PAID")

        # ==============================================================
        # 7. PARTNER CUSTOMER CASH COLLECTION TRACKING
        # ==============================================================
        print(f"\n{Colors.BOLD}7. Auditing Partner Collection Ledger Entries...{Colors.END}")

        if partner:
            # Customer pays Rs. 4130 for a service directly to Partner Lokesh/Ramesh
            inv_partner = InvoiceService.create_and_post_invoice(admin_user, {
                'customer_id': cust_local.id,
                'items': [{'item_type': 'SERVICE', 'service_id': svc.id, 'quantity': 1, 'rate': Decimal('3500.00'), 'gst_rate': 18}],
                'payments': [{
                    'payment_mode': 'UPI',
                    'amount': Decimal('4130.00'),
                    'partner_allocation_json': {'partner_id': partner.id, 'partner_name': partner.name, 'amount': 4130.00}
                }],
                'partner_allocation_json': {'partner_id': partner.id, 'partner_name': partner.name, 'amount': 4130.00}
            })
            created_records.append(inv_partner)

            # Assert partner ledger calculates this as customer collection debit
            partner_collections = PartnerLedgerService._get_partner_customer_collections(partner)
            if partner_collections < Decimal('4130.00'):
                log_fail("Partner Collection Tracking", f"Expected at least 4130.00, got {partner_collections}")
            log_pass("Partner Collection Accountability", f"Partner '{partner.name}' debited for holding Rs.{partner_collections} in customer collection")

        # ==============================================================
        # 8. CUSTOMER SALES RETURNS
        # ==============================================================
        print(f"\n{Colors.BOLD}8. Auditing Customer Sales Return Workflow...{Colors.END}")

        # Return Serialized Laptop from inv_serial
        inv_item_laptop = inv_serial.items.first()
        ret_res = InvoiceService.process_sales_return(admin_user, inv_serial.id, {
            'items': [{
                'invoice_item_id': inv_item_laptop.id,
                'quantity': 1,
                'serial_number': 'POS-SN-101',
                'reason': 'Customer requested refund within 7 days'
            }]
        })
        sn_101.refresh_from_db()
        if sn_101.status != 'RETURNED':
            log_fail("Serial Sales Return Status", f"Expected RETURNED, got {sn_101.status}")
        log_pass("Serial Return Status Transition", f"Serial 'POS-SN-101' transitioned from SOLD -> RETURNED")

        # Check stock increased back
        laptop_stock = prod_serial.get_current_stock()
        if laptop_stock != 2:
            log_fail("Sales Return Stock Restoration", f"Expected 2, got {laptop_stock}")
        log_pass("Sales Return Stock Ledger Inward", f"Laptop stock restored to {laptop_stock}")

        # Attempting return of already returned item
        try:
            InvoiceService.process_sales_return(admin_user, inv_serial.id, {
                'items': [{'invoice_item_id': inv_item_laptop.id, 'quantity': 1, 'serial_number': 'POS-SN-101'}]
            })
            log_fail("Duplicate Return Guard", "Allowed returning already returned item")
        except ValidationError:
            log_pass("Duplicate Sales Return Guard", "Blocked returning already returned unit")

        # ==============================================================
        # 9. SECURITY & RBAC ENFORCEMENT
        # ==============================================================
        print(f"\n{Colors.BOLD}9. Auditing POS Role-Based Security & Permissions...{Colors.END}")

        # 9.1 Unauthenticated write blocked
        req_unauth = factory.post('/api/invoices/', {'buyer_name': 'Hacker'})
        resp_unauth = InvoiceViewSet.as_view({'post': 'create'})(req_unauth)
        if resp_unauth.status_code not in (401, 403):
            log_fail("Unauthenticated POS Checkout", f"Expected 401/403, got {resp_unauth.status_code}")
        log_pass("Unauthenticated Checkout Guard", f"Blocked with HTTP {resp_unauth.status_code}")

        # 9.2 Cashier CAN checkout (POST /api/invoices/)
        req_cashier_post = factory.post('/api/invoices/', {
            'buyer_name': 'Walk-in Customer',
            'items': [{'item_type': 'SERVICE', 'service_id': svc.id, 'quantity': 1, 'rate': 3500}],
            'payments': [{'payment_mode': 'CASH', 'amount': 4130}]
        }, format='json')
        force_authenticate(req_cashier_post, user=cashier_user)
        resp_cashier_post = InvoiceViewSet.as_view({'post': 'create'})(req_cashier_post)
        if resp_cashier_post.status_code != 201:
            log_fail("Cashier POS Checkout", f"Expected 201, got {resp_cashier_post.status_code}")
        cashier_inv_id = resp_cashier_post.data['id']
        created_records.append(Invoice.objects.get(id=cashier_inv_id))
        log_pass("Cashier POS Checkout Permission", f"Cashier successfully created Invoice #{resp_cashier_post.data['invoice_number']}")

        # 9.3 Cashier CANNOT delete invoice (DELETE /api/invoices/<id>/)
        req_cashier_del = factory.delete(f'/api/invoices/{cashier_inv_id}/')
        force_authenticate(req_cashier_del, user=cashier_user)
        resp_cashier_del = InvoiceViewSet.as_view({'delete': 'destroy'})(req_cashier_del, pk=cashier_inv_id)
        if resp_cashier_del.status_code != 403:
            log_fail("Cashier Invoice Deletion Guard", f"Expected 403, got {resp_cashier_del.status_code}")
        log_pass("Cashier Invoice Deletion Guard", "Blocked cashier from deleting invoices with HTTP 403 Forbidden")

        # ==============================================================
        # 10. DELETION ROLLBACK & PHANTOM STOCK PRESERVATION
        # ==============================================================
        print(f"\n{Colors.BOLD}10. Auditing Invoice Deletion Integrity & Stock Rollback...{Colors.END}")

        # 10.1 Invoice with sales returns cannot be deleted
        req_del_ret = factory.delete(f'/api/invoices/{inv_serial.id}/')
        force_authenticate(req_del_ret, user=admin_user)
        resp_del_ret = InvoiceViewSet.as_view({'delete': 'destroy'})(req_del_ret, pk=inv_serial.id)
        if resp_del_ret.status_code != 400:
            log_fail("Returned Invoice Deletion Guard", f"Expected 400, got {resp_del_ret.status_code}")
        log_pass("Returned Invoice Deletion Guard", f"Blocked with HTTP 400: '{resp_del_ret.data.get('error')}'")

        # 10.2 Clean Invoice Deletion:
        # Create a temporary bill selling laptop 'POS-SN-102', verify serial is SOLD and stock decreases.
        # Then admin deletes invoice -> verify stock is restored, serial is AVAILABLE, 0 ghost movements remain.
        clean_inv = InvoiceService.create_and_post_invoice(admin_user, {
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': prod_serial.id,
                'quantity': 1,
                'rate': Decimal('120000.00'),
                'gst_rate': Decimal('18.00'),
                'serial_number': 'POS-SN-102'
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': Decimal('141600.00')}]
        })
        sn_102 = SerialNumber.objects.get(product=prod_serial, serial_number='POS-SN-102')
        if sn_102.status != 'SOLD' or prod_serial.get_current_stock() != 1:
            log_fail("Temporary Sale Setup", "Sale did not deduct stock or mark serial SOLD")

        # Now delete clean invoice via Admin API
        req_del_clean = factory.delete(f'/api/invoices/{clean_inv.id}/')
        force_authenticate(req_del_clean, user=admin_user)
        resp_del_clean = InvoiceViewSet.as_view({'delete': 'destroy'})(req_del_clean, pk=clean_inv.id)
        if resp_del_clean.status_code != 200:
            log_fail("Clean Invoice Deletion", f"Expected 200, got {resp_del_clean.status_code}")

        sn_102.refresh_from_db()
        stock_restored = prod_serial.get_current_stock()
        mov_exists = StockMovement.objects.filter(reference_type='INVOICE', reference_id=clean_inv.invoice_number).exists()

        if sn_102.status != 'AVAILABLE' or stock_restored != 2 or mov_exists:
            log_fail("Stock & Serial Reversal on Invoice Deletion", f"Serial status: {sn_102.status}, Stock: {stock_restored}, Mov: {mov_exists}")
        log_pass("Atomic Stock & Serial Rollback on Deletion", f"Stock restored to {stock_restored}, serial 'POS-SN-102' restored to AVAILABLE, 0 phantom movements")

        # 10.3 Customer with linked invoices cannot be deleted
        req_del_cust = factory.delete(f'/api/customers/{cust_local.id}/')
        force_authenticate(req_del_cust, user=admin_user)
        from core.views import CustomerViewSet
        resp_del_cust = CustomerViewSet.as_view({'delete': 'destroy'})(req_del_cust, pk=cust_local.id)
        if resp_del_cust.status_code != 400:
            log_fail("Customer with Invoices Deletion Guard", f"Expected 400, got {resp_del_cust.status_code}")
        log_pass("Customer Cascade Deletion Guard", f"Blocked with HTTP 400: '{resp_del_cust.data.get('error')}'")

        print(f"\n{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN} ALL POS BILLING & INVOICING TESTS PASSED! {Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}\n")

    finally:
        # ==============================================================
        # 11. COMPREHENSIVE TEARDOWN (CLEAN DATABASE PROMISE)
        # ==============================================================
        print(f"{Colors.BOLD}11. Cleaning up all audit records (leaving database clean)...{Colors.END}")
        with transaction.atomic():
            # Clean only test invoices created during this test
            for rec in list(created_records):
                if isinstance(rec, Invoice):
                    try:
                        StockMovement.objects.filter(reference_type__in=['INVOICE', 'SALES_RETURN'], reference_id=rec.invoice_number).delete()
                        Payment.objects.filter(invoice=rec).delete()
                        rec.items.all().delete()
                        rec.delete()
                    except Exception:
                        pass

            # Clean serial numbers created during test
            SerialNumber.objects.filter(serial_number__in=['POS-SN-101', 'POS-SN-102']).delete()

            # Clean stock movements
            StockMovement.objects.filter(product__name__in=["Epson TM-T82 Thermal Printer", "Lenovo Legion 5 Pro"]).delete()

            # Clean master fixtures
            for rec in reversed(created_records):
                if not isinstance(rec, Invoice):
                    try:
                        rec.delete()
                    except Exception:
                        pass

            admin_user.delete()
            cashier_user.delete()

        final_counts = {
            'Invoice': Invoice.objects.count(),
            'InvoiceItem': InvoiceItem.objects.count(),
            'Payment': Payment.objects.count(),
            'StockMovement': StockMovement.objects.count(),
            'SerialNumber': SerialNumber.objects.count(),
            'Customer': Customer.objects.count(),
            'Product': Product.objects.count(),
            'Service': Service.objects.count(),
        }

        diffs = {k: final_counts[k] - initial_counts[k] for k in initial_counts if final_counts[k] != initial_counts[k]}
        if diffs:
            print(f"{Colors.RED}[CLEANUP WARNING]{Colors.END}: Stray records detected: {diffs}")
        else:
            print(f"{Colors.GREEN}[CLEANUP COMPLETE]{Colors.END}: All test records purged. Database is 100% clean.\n")


if __name__ == '__main__':
    run_invoice_module_tests()
