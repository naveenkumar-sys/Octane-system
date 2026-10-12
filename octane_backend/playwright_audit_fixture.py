"""
Octane Systems - Playwright Audit Test Fixture Setup and Teardown
Manages controlled temporary test data for Playwright real-time visualization and speed benchmark.
Provides 100% clean teardown.
"""

import os
import sys
import django
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import (
    Partner, Customer, Supplier, ProductCategory, Brand, Product,
    Invoice, InvoiceItem, Payment, Purchase, PurchaseItem,
    ExpenseCategory, Expense, PartnerDrawings, PartnerSettlement,
    PartnerDeposit, SupplierPayment, StockMovement
)

User = get_user_model()


def setup_audit_data():
    print("[*] Setting up controlled test data for Playwright E2E benchmark...")
    
    # 1. Create or update test admin user
    user, created = User.objects.get_or_create(username='audit_tester')
    user.set_password('AuditPass123!')
    user.is_staff = True
    user.is_superuser = True
    user.save()

    # 2. Partners
    p_ramesh = Partner.objects.create(
        name="Audit Partner Ramesh",
        ownership_percentage=Decimal('60.00'),
        initial_capital=Decimal('50000.00')
    )
    p_lokesh = Partner.objects.create(
        name="Audit Partner Lokesh",
        ownership_percentage=Decimal('40.00'),
        initial_capital=Decimal('30000.00')
    )

    # 3. Master records
    cat = ProductCategory.objects.create(name="Audit Electronics")
    brand = Brand.objects.create(name="OctanePro")
    supp = Supplier.objects.create(name="Audit Supplies Ltd", mobile="9876543001")
    cust = Customer.objects.create(name="Audit Tech Enterprise", mobile="9876543002", state_code="33")

    prod = Product.objects.create(
        name="Audit Enterprise Laptop",
        sku="AUDIT-ENT-001",
        category=cat,
        brand=brand.name,
        purchase_price=Decimal('1000.00'),
        selling_price=Decimal('1500.00'),
        gst_rate=Decimal('18.00'),
        hsn_sac="84713010",
        min_stock_alert=2,
        is_stock_enabled=True
    )

    # 4. Purchase: 10 units @ 1000 = 10000 + 1800 tax = 11800
    pur = Purchase.objects.create(
        purchase_number="PO-E2E-001",
        supplier=supp,
        purchase_date=date.today(),
        total_amount=Decimal('11800.00'),
        tax_amount=Decimal('1800.00'),
        paid_amount=Decimal('11800.00'),
        payment_status='PAID',
        payment_mode='PARTNER_OUT_OF_POCKET',
        paid_by_partner=p_ramesh
    )
    PurchaseItem.objects.create(
        purchase=pur,
        product=prod,
        quantity=10,
        unit_cost=Decimal('1000.00'),
        gst_rate=Decimal('18.00'),
        total_amount=Decimal('11800.00')
    )
    StockMovement.objects.create(
        product=prod,
        movement_type='PURCHASE',
        quantity=10,
        unit_cost=Decimal('1000.00'),
        unit_price=Decimal('1500.00'),
        reference_type='PURCHASE',
        reference_id=pur.purchase_number
    )

    # 5. Sales Invoice: 4 units @ 1500 = 6000 + 1080 tax = 7080
    inv = Invoice.objects.create(
        invoice_number="INV-E2E-001",
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
        partner_allocation_json={'partner_id': p_ramesh.id, 'partner_name': p_ramesh.name, 'amount': '7080.00'}
    )
    InvoiceItem.objects.create(
        invoice=inv,
        item_type='PRODUCT',
        product=prod,
        description=prod.name,
        hsn_sac=prod.hsn_sac,
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
    StockMovement.objects.create(
        product=prod,
        movement_type='SALE',
        quantity=4,
        unit_cost=Decimal('1000.00'),
        unit_price=Decimal('1500.00'),
        reference_type='SALE',
        reference_id=inv.invoice_number
    )
    Payment.objects.create(
        payment_number="PAY-E2E-001",
        invoice=inv,
        customer=cust,
        amount=Decimal('7080.00'),
        payment_date=date.today(),
        payment_mode='UPI',
        partner_allocation_json={'partner_id': p_ramesh.id, 'partner_name': p_ramesh.name, 'amount': '7080.00'}
    )

    # 6. Expense: 5000 rent
    exp_cat = ExpenseCategory.objects.create(name="Audit Office Expense")
    Expense.objects.create(
        expense_number="EXP-E2E-001",
        category=exp_cat,
        description="Office space rental",
        amount=Decimal('5000.00'),
        expense_date=date.today(),
        payment_mode='PARTNER_OUT_OF_POCKET',
        paid_by_partner=p_ramesh
    )

    # 7. Drawing: 8000 cash
    PartnerDrawings.objects.create(
        drawing_number="DRW-E2E-001",
        partner=p_ramesh,
        amount=Decimal('8000.00'),
        drawing_date=date.today(),
        payment_mode='CASH',
        notes="Household allowance"
    )

    # 8. Deposit: 7080 handover
    PartnerDeposit.objects.create(
        deposit_number="DEP-E2E-001",
        partner=p_ramesh,
        deposit_type='CUSTOMER_COLLECTION_HANDOVER',
        amount=Decimal('7080.00'),
        deposit_date=date.today(),
        payment_mode='CASH',
        notes="Collection handover"
    )

    # 9. Settlement: 3000 to partner B
    PartnerSettlement.objects.create(
        settlement_number="STL-E2E-001",
        from_partner=p_ramesh,
        to_partner=p_lokesh,
        amount=Decimal('3000.00'),
        settlement_date=date.today(),
        payment_mode='BANK_TRANSFER',
        notes="Capital adjustment"
    )

    print("[SUCCESS] Playwright audit test data fixture initialized successfully!")


def teardown_audit_data():
    print("[*] Purging all Playwright audit test data from database...")

    Payment.objects.filter(payment_number__startswith="PAY-E2E").delete()
    InvoiceItem.objects.filter(invoice__invoice_number__startswith="INV-E2E").delete()
    Invoice.objects.filter(invoice_number__startswith="INV-E2E").delete()

    StockMovement.objects.filter(product__sku__startswith="AUDIT-").delete()
    PurchaseItem.objects.filter(purchase__purchase_number__startswith="PO-E2E").delete()
    Purchase.objects.filter(purchase_number__startswith="PO-E2E").delete()

    PartnerDeposit.objects.filter(deposit_number__startswith="DEP-E2E").delete()
    PartnerSettlement.objects.filter(settlement_number__startswith="STL-E2E").delete()
    PartnerDrawings.objects.filter(drawing_number__startswith="DRW-E2E").delete()
    Expense.objects.filter(expense_number__startswith="EXP-E2E").delete()
    ExpenseCategory.objects.filter(name__startswith="Audit").delete()

    Product.objects.filter(sku__startswith="AUDIT-").delete()
    Brand.objects.filter(name="OctanePro").delete()
    ProductCategory.objects.filter(name__startswith="Audit").delete()
    Supplier.objects.filter(name__startswith="Audit").delete()
    Customer.objects.filter(name__startswith="Audit").delete()
    Partner.objects.filter(name__startswith="Audit").delete()

    User.objects.filter(username='audit_tester').delete()

    # Verify counts
    tables = [
        Partner, Customer, Supplier, ProductCategory, Brand, Product,
        Invoice, InvoiceItem, Payment, Purchase, PurchaseItem,
        ExpenseCategory, Expense, PartnerDrawings, PartnerSettlement,
        PartnerDeposit, SupplierPayment, StockMovement
    ]
    counts = {t.__name__: t.objects.count() for t in tables}
    print(f"[*] Final Database Counts after Teardown: {counts}")
    is_clean = all(c == 0 for c in counts.values())
    if is_clean:
        print("[SUCCESS] 100% CLEAN TEARDOWN VERIFIED: All business tables at 0 records!")
    else:
        print("[WARNING] DATABASE NOT 100% CLEAN!")
    return is_clean


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'setup'
    if action == 'setup':
        setup_audit_data()
    elif action == 'teardown':
        ok = teardown_audit_data()
        sys.exit(0 if ok else 1)
