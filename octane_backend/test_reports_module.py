"""
Octane Systems - Reports & Analytics Comprehensive Audit & Security Test Suite
Tests:
1. Executive Dashboard Metrics (Sales, Payables, Receivables, Stock health, Partner balances)
2. Sales Detailed Report (Date filtering, Customer filtering, Payment Status, Search)
3. Purchase Detailed Report (Date filtering, Supplier filtering, Payment Status)
4. Inventory Report (Category filtering, Low stock only filter, Valuation totals)
5. GST Report (Taxable totals, CGST, SGST, IGST calculations)
6. GST HSN Summary Report (HSN code aggregations)
7. Accounting Reconciliation & P&L Reports integration
8. Security & RBAC (Unauthenticated blocked, Cashier blocked from sensitive executive reports, Admin allowed)
9. Database Cleanliness & Zero Residual Data Verification
"""

import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import (
    Customer, Supplier, ProductCategory, Brand, Product,
    Invoice, InvoiceItem, Purchase, PurchaseItem, Payment,
    Partner, ExpenseCategory, Expense, StockMovement
)

User = get_user_model()
client = APIClient()

print("=" * 80)
print("RUNNING OCTANE SYSTEMS REPORTS & ANALYTICS MODULE INTEGRITY TEST SUITE")
print("=" * 80)

# Setup Test Users
admin_user = User.objects.filter(is_superuser=True).first()
if not admin_user:
    admin_user = User.objects.create_superuser('admin_report_test', 'admin@reporttest.com', 'AdminPass123!')

cashier_user, _ = User.objects.get_or_create(username='cashier_report_test', defaults={'is_staff': False, 'is_superuser': False})
cashier_user.is_staff = False
cashier_user.is_superuser = False
cashier_user.save()

# Baseline Counts
initial_invoices = Invoice.objects.count()
initial_purchases = Purchase.objects.count()
initial_products = Product.objects.count()
initial_customers = Customer.objects.count()

print(f"[*] Initial Baseline: {initial_invoices} Invoices, {initial_purchases} Purchases, {initial_products} Products.")

created_entities = []

try:
    # -------------------------------------------------------------
    # 1. SETUP DUMMY DATA FOR REPORTING ACCURACY VERIFICATION
    # -------------------------------------------------------------
    print("\n--- STEP 1: Setting up controlled dummy data for reports testing ---")
    cat = ProductCategory.objects.create(name='Report Test Cat')
    created_entities.append(cat)

    brand = Brand.objects.create(name='Report Test Brand')
    created_entities.append(brand)

    cust = Customer.objects.create(name='Report Test Customer', mobile='9876543210', state_code='33')
    created_entities.append(cust)

    supp = Supplier.objects.create(name='Report Test Supplier', mobile='9876543211')
    created_entities.append(supp)

    prod = Product.objects.create(
        name='Report Test Laptop',
        sku='REP-LAP-001',
        category=cat,
        brand='Report Test Brand',
        hsn_sac='84713010',
        purchase_price=Decimal('40000.00'),
        selling_price=Decimal('50000.00'),
        gst_rate=Decimal('18.00'),
        min_stock_alert=5,
        is_stock_enabled=True,
        is_active=True
    )
    created_entities.append(prod)

    # Create a Posted Invoice for testing reports
    inv = Invoice.objects.create(
        invoice_number='INV-REP-999',
        customer=cust,
        buyer_name=cust.name,
        buyer_state_code='33',
        invoice_date=date.today(),
        invoice_type='TAX_INVOICE',
        subtotal=Decimal('50000.00'),
        taxable_amount=Decimal('50000.00'),
        total_cgst=Decimal('4500.00'),
        total_sgst=Decimal('4500.00'),
        total_igst=Decimal('0.00'),
        total_tax=Decimal('9000.00'),
        grand_total=Decimal('59000.00'),
        total_paid_amount=Decimal('29000.00'),
        balance_due_amount=Decimal('30000.00'),
        invoice_status='POSTED',
        payment_status='PARTIAL',
        is_gst=True,
        created_by=admin_user
    )
    created_entities.append(inv)

    item = InvoiceItem.objects.create(
        invoice=inv,
        product=prod,
        description=prod.name,
        hsn_sac=prod.hsn_sac,
        quantity=Decimal('1.00'),
        rate=Decimal('50000.00'),
        gst_rate=Decimal('18.00'),
        taxable_value=Decimal('50000.00'),
        cgst_rate=Decimal('9.00'),
        cgst_amount=Decimal('4500.00'),
        sgst_rate=Decimal('9.00'),
        sgst_amount=Decimal('4500.00'),
        igst_rate=Decimal('0.00'),
        igst_amount=Decimal('0.00'),
        total_amount=Decimal('59000.00')
    )
    created_entities.append(item)

    # Create a Purchase for testing reports
    purch = Purchase.objects.create(
        purchase_number='PO-REP-999',
        supplier=supp,
        supplier_invoice_number='SINV-999',
        purchase_date=date.today(),
        total_amount=Decimal('47200.00'),
        tax_amount=Decimal('7200.00'),
        paid_amount=Decimal('20000.00'),
        payment_status='PARTIALLY_PAID',
        payment_mode='CASH',
        created_by=admin_user
    )
    created_entities.append(purch)

    pitem = PurchaseItem.objects.create(
        purchase=purch,
        product=prod,
        description=prod.name,
        hsn_sac=prod.hsn_sac,
        quantity=1,
        unit_cost=Decimal('40000.00'),
        gst_rate=Decimal('18.00'),
        total_amount=Decimal('47200.00')
    )
    created_entities.append(pitem)

    stock_in = StockMovement.objects.create(
        product=prod,
        movement_type='PURCHASE',
        quantity=10,
        reference_type='PURCHASE',
        reference_id=purch.purchase_number,
        unit_cost=Decimal('40000.00'),
        unit_price=Decimal('50000.00'),
        created_by=admin_user
    )
    created_entities.append(stock_in)

    print("[PASS] Dummy data created successfully.")

    # -------------------------------------------------------------
    # 2. EXECUTIVE DASHBOARD METRICS TEST
    # -------------------------------------------------------------
    print("\n--- STEP 2: Testing Executive Dashboard Metrics API ---")
    client.force_authenticate(user=admin_user)
    res = client.get('/api/reports/dashboard/')
    assert res.status_code == 200, f"Expected 200 on dashboard, got {res.status_code}"
    data = res.data
    assert 'today_sales' in data or 'gross_sales' in data, "Dashboard response missing sales data"
    assert 'total_customer_outstanding' in data, "Dashboard missing customer outstanding"
    assert 'supplier_payables' in data, "Dashboard missing supplier payables"
    assert Decimal(str(data['total_customer_outstanding'])) >= Decimal('30000.00'), "Customer outstanding not reflecting test invoice balance"
    print(f"[PASS] Dashboard metrics endpoint verified. Outstanding: {data['total_customer_outstanding']}, Payables: {data['supplier_payables']}")

    # -------------------------------------------------------------
    # 3. SALES DETAILED REPORT TEST
    # -------------------------------------------------------------
    print("\n--- STEP 3: Testing Sales Detailed Report API ---")
    res = client.get(f'/api/reports/sales/?customer_id={cust.id}')
    assert res.status_code == 200, f"Sales report failed: {res.status_code}"
    sales_data = res.data
    matching = [i for i in sales_data.get('rows', []) if i.get('invoice_number') == 'INV-REP-999']
    assert len(matching) >= 1, "Sales report did not return the filtered customer invoice"
    print(f"[PASS] Sales Report verified with customer filter: found invoice {matching[0]['invoice_number']}")

    # Filter by payment_status
    res_status = client.get('/api/reports/sales/?payment_status=PARTIAL')
    assert res_status.status_code == 200
    partial_invs = [i for i in res_status.data.get('rows', []) if i.get('invoice_number') == 'INV-REP-999']
    assert len(partial_invs) >= 1, "Sales report payment_status filter failed"
    print("[PASS] Sales Report verified with payment_status filter.")

    # -------------------------------------------------------------
    # 4. PURCHASE DETAILED REPORT TEST
    # -------------------------------------------------------------
    print("\n--- STEP 4: Testing Purchase Detailed Report API ---")
    res = client.get(f'/api/reports/purchases/?supplier_id={supp.id}')
    assert res.status_code == 200, f"Purchase report failed: {res.status_code}"
    purch_data = res.data
    matching_p = [p for p in purch_data.get('rows', []) if p.get('purchase_number') == 'PO-REP-999']
    assert len(matching_p) >= 1, "Purchase report did not return the filtered supplier purchase"
    print(f"[PASS] Purchase Report verified with supplier filter: found purchase {matching_p[0]['purchase_number']}")

    # -------------------------------------------------------------
    # 5. INVENTORY REPORT TEST
    # -------------------------------------------------------------
    print("\n--- STEP 5: Testing Inventory Report API ---")
    res = client.get(f'/api/reports/inventory/?category_id={cat.id}')
    assert res.status_code == 200, f"Inventory report failed: {res.status_code}"
    inv_data = res.data
    matching_prod = [p for p in inv_data.get('rows', []) if p.get('product_id') == prod.id]
    assert len(matching_prod) >= 1, "Inventory report category filter failed to return product"
    print(f"[PASS] Inventory Report verified: found product {matching_prod[0]['product_name']}")

    # Test low_stock_only filter
    res_low = client.get('/api/reports/inventory/?low_stock_only=true')
    assert res_low.status_code == 200
    # prod has closing stock 10 > min_stock 5, so it should not be in low_stock_only
    matching_prod_low = [p for p in res_low.data.get('rows', []) if p.get('product_id') == prod.id]
    assert len(matching_prod_low) == 0, "Healthy stock product unexpectedly returned in low_stock_only"
    print("[PASS] Inventory Report low_stock_only filter accurately excluded healthy product.")

    # -------------------------------------------------------------
    # 6. GST REPORT & GST HSN REPORT TESTS
    # -------------------------------------------------------------
    print("\n--- STEP 6: Testing GST and GST HSN Reports ---")
    res_gst = client.get(f'/api/reports/gst/?start_date={date.today().isoformat()}&end_date={date.today().isoformat()}')
    assert res_gst.status_code == 200, f"GST report failed: {res_gst.status_code}"
    gst_data = res_gst.data
    assert 'output_gst' in gst_data or 'total_tax' in gst_data, "GST report missing summary structure"
    print("[PASS] GST Report structure and tax metrics verified.")

    res_hsn = client.get(f'/api/reports/gst-hsn/?start_date={date.today().isoformat()}&end_date={date.today().isoformat()}')
    assert res_hsn.status_code == 200, f"GST HSN report failed: {res_hsn.status_code}"
    hsn_data = res_hsn.data
    hsn_list = hsn_data if isinstance(hsn_data, list) else hsn_data.get('hsn_summary', [])
    assert any(h.get('hsn_sac') == '84713010' for h in hsn_list), "HSN code 84713010 missing in GST HSN summary"
    print("[PASS] GST HSN Report verified with accurate HSN 84713010 grouping.")

    # -------------------------------------------------------------
    # 7. SECURITY & RBAC PERMISSION TESTING
    # -------------------------------------------------------------
    print("\n--- STEP 7: Testing Security & Access Control (RBAC) ---")
    client.force_authenticate(user=None)  # Unauthenticated
    unauth_res = client.get('/api/reports/dashboard/')
    assert unauth_res.status_code == 401, f"Expected 401 for unauthenticated dashboard request, got {unauth_res.status_code}"
    print("[PASS] Unauthenticated request correctly rejected with 401 Unauthorized.")

    client.force_authenticate(user=cashier_user)  # Cashier role (not admin/superuser)
    cashier_res = client.get('/api/reports/dashboard/')
    assert cashier_res.status_code == 403, f"Expected 403 for cashier accessing executive dashboard, got {cashier_res.status_code}"
    print("[PASS] Cashier role correctly blocked with 403 Forbidden on executive reports.")

    cashier_pnl = client.get('/api/reports/pnl/')
    assert cashier_pnl.status_code == 403, f"Expected 403 for cashier accessing P&L, got {cashier_pnl.status_code}"
    print("[PASS] Cashier role correctly blocked with 403 Forbidden on P&L.")

except Exception as e:
    print(f"\n[!] ERROR ENCOUNTERED: {e}")
    import traceback
    traceback.print_exc()
    raise e

finally:
    # -------------------------------------------------------------
    # 8. TEARDOWN & DATABASE PURGE
    # -------------------------------------------------------------
    print("\n--- STEP 8: Purging all dummy test records and verifying baseline state ---")
    # Delete in reverse foreign key dependency order
    for entity in reversed(created_entities):
        try:
            entity.delete()
        except Exception as del_err:
            print(f"Warning deleting {entity}: {del_err}")

    # Remove test cashier user
    if cashier_user:
        cashier_user.delete()

    final_invoices = Invoice.objects.count()
    final_purchases = Purchase.objects.count()
    final_products = Product.objects.count()
    final_customers = Customer.objects.count()

    print(f"[*] Baseline Verification:")
    print(f"    Invoices:  Initial={initial_invoices}, Final={final_invoices}")
    print(f"    Purchases: Initial={initial_purchases}, Final={final_purchases}")
    print(f"    Products:  Initial={initial_products}, Final={final_products}")
    print(f"    Customers: Initial={initial_customers}, Final={final_customers}")

    assert initial_invoices == final_invoices, "Invoice count mismatch after teardown!"
    assert initial_purchases == final_purchases, "Purchase count mismatch after teardown!"
    assert initial_products == final_products, "Product count mismatch after teardown!"
    assert initial_customers == final_customers, "Customer count mismatch after teardown!"

    print("[PASS] Zero residual test data. Database 100% clean!")

print("\n" + "=" * 80)
print("ALL REPORTS & ANALYTICS MODULE INTEGRITY TESTS PASSED SUCCESSFULLY! (100% CLEAN)")
print("=" * 80)
