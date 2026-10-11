"""
Octane Systems - Master Module Comprehensive Integrity & Security Test Suite
Tests:
1. Product Categories & Attributes (Validation, Whitespace, Duplicates)
2. Brands Master (Security, Case-insensitive Duplicates)
3. Product Master (The PostgreSQL NULL SKU fix, Negative Prices, Specs)
4. Service Categories & Services (SAC default, Non-negative Rates, Master linkages)
5. Customers Master (Phone sanitation, 15-char GSTIN, State Code sync)
6. Suppliers Master (Validation, Clean phone/GSTIN)
7. Expense Categories Master (Unique name, Strip)
8. Partners Master (Total Ownership <= 100%, Immutable initial capital, Non-negative)
9. Security & Access Control (Unauthenticated blocked, Cashier blocked from Partner/Admin endpoints)
10. Transactional Delete Protection (Prevent deleting masters referenced in data)
11. Automatic Teardown (Leaves DB 100% clean)
"""

import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from core.models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, CategoryAttribute, Brand, Product, ProductSpecification,
    ServiceCategory, Service, ExpenseCategory
)
from core.serializers import (
    CustomerSerializer, SupplierSerializer, PartnerSerializer,
    ProductCategorySerializer, BrandSerializer, ProductSerializer,
    ServiceCategorySerializer, ServiceSerializer, ExpenseCategorySerializer
)
from core.views import (
    CustomerViewSet, SupplierViewSet, PartnerViewSet,
    ProductCategoryViewSet, BrandViewSet, ProductViewSet,
    ServiceCategoryViewSet, ServiceViewSet, ExpenseCategoryViewSet
)


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_pass(test_name, detail=""):
    print(f"  {Colors.GREEN}[PASS]{Colors.END}: {test_name} {f'({detail})' if detail else ''}")

def log_fail(test_name, error=""):
    print(f"  {Colors.RED}[FAIL]{Colors.END}: {test_name} -> Error: {error}")
    sys.exit(1)


def run_master_tests():
    print(f"\n{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE} OCTANE SYSTEMS - MASTER MODULE INTEGRITY AUDIT SUITE {Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}======================================================{Colors.END}\n")

    factory = APIRequestFactory()
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.create_superuser('test_admin', 'admin@octane.in', 'password123')
    
    cashier_user, _ = User.objects.get_or_create(username='test_cashier_audit', defaults={'is_staff': False})

    created_records = []

    try:
        # ==============================================================
        # 1. PRODUCT CATEGORIES & ATTRIBUTES
        # ==============================================================
        print(f"{Colors.BOLD}1. Auditing Product Categories & Attributes Master...{Colors.END}")
        # Test 1.1: Category creation with whitespace
        cat_s1 = ProductCategorySerializer(data={'name': '   Gaming Laptops   ', 'description': 'High performance'})
        if not cat_s1.is_valid():
            log_fail("ProductCategory whitespace stripping", cat_s1.errors)
        cat1 = cat_s1.save()
        created_records.append(cat1)
        if cat1.name != 'Gaming Laptops':
            log_fail("ProductCategory name not stripped", cat1.name)
        log_pass("Category Whitespace Sanitization", f"Saved clean as '{cat1.name}'")

        # Test 1.2: Case-insensitive duplicate prevention
        cat_dup = ProductCategorySerializer(data={'name': 'gaming laptops'})
        if cat_dup.is_valid():
            log_fail("Category Duplicate Prevention", "Allowed duplicate category with different casing")
        log_pass("Category Case-Insensitive Duplicate Prevention", "Blocked duplicate 'gaming laptops'")

        # Test 1.3: Category Attributes
        attr = CategoryAttribute.objects.create(
            category=cat1,
            name='RAM Capacity',
            attribute_type='DROPDOWN',
            options='8GB,16GB,32GB'
        )
        created_records.append(attr)
        log_pass("Category Attribute Attachment", f"Added '{attr.name}' with options: {attr.options}")

        # ==============================================================
        # 2. BRANDS MASTER
        # ==============================================================
        print(f"\n{Colors.BOLD}2. Auditing Brands Master & Access Control...{Colors.END}")
        # Test 2.1: Brand creation
        b_s1 = BrandSerializer(data={'name': '  Asus ROG  ', 'category': cat1.id, 'origin': 'Taiwan'})
        if not b_s1.is_valid():
            log_fail("Brand creation", b_s1.errors)
        b1 = b_s1.save()
        created_records.append(b1)
        if b1.name != 'Asus ROG':
            log_fail("Brand whitespace stripping", b1.name)
        log_pass("Brand Whitespace Sanitization", f"Saved clean as '{b1.name}'")

        # Test 2.2: Brand case-insensitive duplicate check
        b_dup = BrandSerializer(data={'name': 'asus rog'})
        if b_dup.is_valid():
            log_fail("Brand Duplicate Check", "Allowed duplicate brand")
        log_pass("Brand Case-Insensitive Duplicate Prevention", "Blocked duplicate 'asus rog'")

        # ==============================================================
        # 3. PRODUCT MASTER & POSTGRESQL NULL SKU INTEGRITY
        # ==============================================================
        print(f"\n{Colors.BOLD}3. Auditing Products Master (NULL SKU Bug & Constraints)...{Colors.END}")
        # Test 3.1: Product without SKU
        p_s1 = ProductSerializer(data={
            'name': 'Asus Zephyrus G14',
            'category': cat1.id,
            'brand': 'Asus ROG',
            'sku': '',  # Empty string from UI
            'purchase_price': 80000,
            'selling_price': 110000,
            'gst_rate': 18.00,
            'is_stock_enabled': True,
            'tracking_type': 'SERIAL_NUMBER'
        })
        if not p_s1.is_valid():
            log_fail("Product 1 without SKU validation", p_s1.errors)
        p1 = p_s1.save()
        created_records.append(p1)
        if p1.sku is not None:
            log_fail("Empty string SKU should convert to None", f"Got: {repr(p1.sku)}")
        log_pass("Product 1 Saved with NULL SKU", f"Product ID {p1.id}, sku=None")

        # Test 3.2: Second product without SKU (Guarantees PostgreSQL IntegrityError is resolved)
        p_s2 = ProductSerializer(data={
            'name': 'Asus Strix SCAR 16',
            'category': cat1.id,
            'brand': 'Asus ROG',
            'sku': '   ',  # Whitespace only from UI
            'purchase_price': 120000,
            'selling_price': 160000,
            'gst_rate': 18.00,
            'is_stock_enabled': True,
            'tracking_type': 'SERIAL_NUMBER'
        })
        if not p_s2.is_valid():
            log_fail("Product 2 without SKU validation", p_s2.errors)
        p2 = p_s2.save()
        created_records.append(p2)
        if p2.sku is not None:
            log_fail("Whitespace SKU should convert to None", f"Got: {repr(p2.sku)}")
        log_pass("PostgreSQL Multiple NULL SKUs Allowed", f"Product ID {p2.id} created cleanly without unique key collision")

        # Test 3.3: Product with Custom SKU and Duplicate Prevention
        p_s3 = ProductSerializer(data={
            'name': 'Asus TUF A15',
            'category': cat1.id,
            'sku': 'tuf-a15-512',
            'purchase_price': 60000,
            'selling_price': 75000,
        })
        if not p_s3.is_valid():
            log_fail("Product 3 with custom SKU", p_s3.errors)
        p3 = p_s3.save()
        created_records.append(p3)
        if p3.sku != 'TUF-A15-512':
            log_fail("SKU uppercase conversion", p3.sku)
        log_pass("SKU Uppercase Normalization", f"Saved as '{p3.sku}'")

        # Test duplicate of custom SKU
        p_dup = ProductSerializer(data={'name': 'Duplicate TUF', 'sku': 'TUF-A15-512'})
        if p_dup.is_valid():
            log_fail("Product Duplicate SKU Check", "Allowed duplicate SKU")
        log_pass("Product Duplicate SKU Prevention", "Blocked duplicate 'TUF-A15-512'")

        # Test 3.4: Negative prices rejected
        p_neg = ProductSerializer(data={'name': 'Bad Product', 'selling_price': -100})
        if p_neg.is_valid():
            log_fail("Negative Selling Price", "Allowed negative selling price")
        log_pass("Negative Price Boundary Protection", "Blocked negative selling price")

        # ==============================================================
        # 4. SERVICE CATEGORIES & SERVICES MASTER
        # ==============================================================
        print(f"\n{Colors.BOLD}4. Auditing Service Categories & Services Master...{Colors.END}")
        sc_s1 = ServiceCategorySerializer(data={'name': '  Hardware Repairs  '})
        if not sc_s1.is_valid():
            log_fail("Service Category creation", sc_s1.errors)
        sc1 = sc_s1.save()
        created_records.append(sc1)
        log_pass("Service Category Creation", f"Saved clean as '{sc1.name}'")

        sc_dup = ServiceCategorySerializer(data={'name': 'hardware repairs'})
        if sc_dup.is_valid():
            log_fail("Service Category Duplicate Prevention", "Allowed duplicate")
        log_pass("Service Category Duplicate Prevention", "Blocked duplicate 'hardware repairs'")

        svc_s1 = ServiceSerializer(data={
            'service_name': '  Motherboard Chip-Level Repair  ',
            'category': sc1.id,
            'default_rate': 2500.00,
            'gst_rate': 18.00,
            'sac': ''  # Should default to 998313
        })
        if not svc_s1.is_valid():
            log_fail("Service creation", svc_s1.errors)
        svc1 = svc_s1.save()
        created_records.append(svc1)
        if svc1.sac != '998313':
            log_fail("Service SAC default", svc1.sac)
        log_pass("Service Master Creation & Default SAC", f"Service '{svc1.service_name}' with SAC: {svc1.sac}")

        svc_neg = ServiceSerializer(data={'service_name': 'Bad Service', 'default_rate': -500})
        if svc_neg.is_valid():
            log_fail("Service Negative Rate Check", "Allowed negative rate")
        log_pass("Service Negative Rate Protection", "Blocked negative service rate")

        # ==============================================================
        # 5. CUSTOMERS MASTER
        # ==============================================================
        print(f"\n{Colors.BOLD}5. Auditing Customers Master...{Colors.END}")
        # Test 5.1: Phone cleaning (spaces, hyphens)
        cust_s1 = CustomerSerializer(data={
            'name': '  Rajesh Sharma  ',
            'mobile': '  98860-12345  ',
            'gstin': '29DRTPA7275L1ZW',
            'city': 'Bengaluru',
            'state_name': 'Karnataka',
            'customer_type': 'BUSINESS'
        })
        if not cust_s1.is_valid():
            log_fail("Customer validation", cust_s1.errors)
        c1 = cust_s1.save()
        created_records.append(c1)
        if c1.mobile != '9886012345':
            log_fail("Customer Phone sanitization", c1.mobile)
        if c1.state_code != '29':
            log_fail("Customer State Code sync from GSTIN", c1.state_code)
        log_pass("Customer Phone & GSTIN State Alignment", f"Clean mobile: '{c1.mobile}', State Code: '{c1.state_code}'")

        # Test 5.2: Invalid GSTIN length
        cust_bad_gst = CustomerSerializer(data={'name': 'Bad GST', 'gstin': '29INVALID'})
        if cust_bad_gst.is_valid():
            log_fail("Customer GSTIN Length Check", "Allowed invalid GSTIN")
        log_pass("Customer GSTIN 15-char Validation", "Blocked invalid GSTIN '29INVALID'")

        # Test 5.3: Invalid Mobile
        cust_bad_phone = CustomerSerializer(data={'name': 'Bad Phone', 'mobile': '12345'})
        if cust_bad_phone.is_valid():
            log_fail("Customer Phone Length Check", "Allowed 5-digit phone")
        log_pass("Customer Phone Format Validation", "Blocked short mobile '12345'")

        # ==============================================================
        # 6. SUPPLIERS MASTER
        # ==============================================================
        print(f"\n{Colors.BOLD}6. Auditing Suppliers Master...{Colors.END}")
        supp_s1 = SupplierSerializer(data={
            'name': '  Apex IT Components Pvt Ltd  ',
            'mobile': '+91 99000-55555',
            'gstin': '29AAACA0000A1Z5',
            'city': 'Bengaluru',
        })
        if not supp_s1.is_valid():
            log_fail("Supplier validation", supp_s1.errors)
        s1 = supp_s1.save()
        created_records.append(s1)
        if s1.mobile != '+919900055555':
            log_fail("Supplier Phone sanitization", s1.mobile)
        log_pass("Supplier Master Sanitization & Creation", f"Clean name: '{s1.name}', Clean mobile: '{s1.mobile}'")

        # ==============================================================
        # 7. EXPENSE CATEGORIES MASTER
        # ==============================================================
        print(f"\n{Colors.BOLD}7. Auditing Expense Categories Master...{Colors.END}")
        exp_s1 = ExpenseCategorySerializer(data={'name': '  Office Internet & Fiber  ', 'description': 'Monthly broadband'})
        if not exp_s1.is_valid():
            log_fail("Expense Category creation", exp_s1.errors)
        ec1 = exp_s1.save()
        created_records.append(ec1)
        log_pass("Expense Category Creation", f"Clean name: '{ec1.name}'")

        exp_dup = ExpenseCategorySerializer(data={'name': 'office internet & fiber'})
        if exp_dup.is_valid():
            log_fail("Expense Category Duplicate Check", "Allowed duplicate")
        log_pass("Expense Category Duplicate Prevention", "Blocked duplicate 'office internet & fiber'")

        # ==============================================================
        # 8. PARTNERS MASTER (EQUITY INVARIANTS)
        # ==============================================================
        print(f"\n{Colors.BOLD}8. Auditing Partners Master (Ownership <= 100% Invariant)...{Colors.END}")
        existing_active = list(Partner.objects.filter(is_active=True))
        existing_total = sum(p.ownership_percentage for p in existing_active)

        if existing_total >= Decimal('100.00'):
            # Test 8.1: Existing total is 100%, attempting to add another partner with >0% MUST fail
            p_bad = PartnerSerializer(data={'name': 'Auditor Partner Over', 'ownership_percentage': 5.00, 'initial_capital': 10000})
            if p_bad.is_valid():
                log_fail("Partner Total Ownership Over 100%", "Allowed exceeding total equity when already 100%")
            log_pass("Partner Ownership Invariant Guard", f"Blocked partner creation exceeding 100% (current total: {existing_total}%)")

            # Temporarily adjust first partner by 10% to test creation and immutability
            p_to_adjust = existing_active[0]
            orig_pct = p_to_adjust.ownership_percentage
            try:
                Partner.objects.filter(id=p_to_adjust.id).update(ownership_percentage=orig_pct - Decimal('10.00'))

                # Adding 15% (90 + 15 = 105%) must fail
                p_bad2 = PartnerSerializer(data={'name': 'Auditor Partner Exceed', 'ownership_percentage': 15.00})
                if p_bad2.is_valid():
                    log_fail("Partner Total Ownership Over 100%", "Allowed 105% total equity across partners")
                log_pass("Partner Ownership Invariant Guard", "Blocked partner with 15% (current total 90% + 15% = 105%)")

                # Adding 10% (90 + 10 = 100%) must succeed
                p_good = PartnerSerializer(data={'name': 'Auditor Test Partner', 'ownership_percentage': 10.00, 'initial_capital': 50000})
                if not p_good.is_valid():
                    log_fail("Partner creation within 100%", p_good.errors)
                pt1 = p_good.save()
                created_records.append(pt1)
                log_pass("Partner Registered within 100%", f"Created '{pt1.name}' with 10% equity (total exactly 100%)")

                # Initial capital immutability
                p1_update = PartnerSerializer(pt1, data={'initial_capital': 200000}, partial=True)
                if p1_update.is_valid():
                    log_fail("Partner Initial Capital Immutability", "Allowed modifying initial capital after registration")
                log_pass("Partner Capital Immutability Guard", "Blocked editing initial capital post-registration")
            finally:
                Partner.objects.filter(id=p_to_adjust.id).update(ownership_percentage=orig_pct)
        else:
            remaining = Decimal('100.00') - existing_total
            # Exceeding remaining
            p_bad = PartnerSerializer(data={'name': 'Auditor Partner Exceed', 'ownership_percentage': remaining + Decimal('10.00')})
            if p_bad.is_valid():
                log_fail("Partner Total Ownership Over 100%", "Allowed exceeding total equity")
            log_pass("Partner Ownership Invariant Guard", f"Blocked partner exceeding remaining equity of {remaining}%")

            # Within remaining
            p_good = PartnerSerializer(data={'name': 'Auditor Test Partner', 'ownership_percentage': remaining, 'initial_capital': 50000})
            if not p_good.is_valid():
                log_fail("Partner creation within remaining", p_good.errors)
            pt1 = p_good.save()
            created_records.append(pt1)
            log_pass("Partner Registered within 100%", f"Created '{pt1.name}' with {remaining}% equity")

            # Initial capital immutability
            p1_update = PartnerSerializer(pt1, data={'initial_capital': 200000}, partial=True)
            if p1_update.is_valid():
                log_fail("Partner Initial Capital Immutability", "Allowed modifying initial capital after registration")
            log_pass("Partner Capital Immutability Guard", "Blocked editing initial capital post-registration")

        # ==============================================================
        # 9. SECURITY & ACCESS CONTROL CHECKS
        # ==============================================================
        print(f"\n{Colors.BOLD}9. Auditing Master Role-Based Permissions & Security...{Colors.END}")
        # Test 9.1: Unauthenticated request blocked
        req_unauth = factory.post('/api/products/', {'name': 'Hack Product'})
        resp_unauth = ProductViewSet.as_view({'post': 'create'})(req_unauth)
        if resp_unauth.status_code not in (401, 403):
            log_fail("Unauthenticated write allowed", f"Status: {resp_unauth.status_code}")
        log_pass("Unauthenticated Write Rejection", f"Blocked with HTTP {resp_unauth.status_code}")

        # Test 9.2: Cashier blocked from Partner Master
        req_cashier = factory.post('/api/partners/', {'name': 'Cashier Partner', 'ownership_percentage': 10})
        force_authenticate(req_cashier, user=cashier_user)
        resp_cashier = PartnerViewSet.as_view({'post': 'create'})(req_cashier)
        if resp_cashier.status_code != 403:
            log_fail("Cashier allowed to create Partner", f"Status: {resp_cashier.status_code}")
        log_pass("Cashier Forbidden from Partner Master", "Blocked with HTTP 403")

        # Test 9.3: Cashier blocked from Expense Category Master
        req_ec_cashier = factory.post('/api/expense-categories/', {'name': 'Cashier Expense Cat'})
        force_authenticate(req_ec_cashier, user=cashier_user)
        resp_ec_cashier = ExpenseCategoryViewSet.as_view({'post': 'create'})(req_ec_cashier)
        if resp_ec_cashier.status_code != 403:
            log_fail("Cashier allowed to create Expense Category", f"Status: {resp_ec_cashier.status_code}")
        log_pass("Cashier Forbidden from Expense Categories", "Blocked with HTTP 403")

        # Test 9.4: Cashier CAN read products (Safe method)
        req_read = factory.get('/api/products/')
        force_authenticate(req_read, user=cashier_user)
        resp_read = ProductViewSet.as_view({'get': 'list'})(req_read)
        if resp_read.status_code != 200:
            log_fail("Cashier blocked from reading products", f"Status: {resp_read.status_code}")
        log_pass("Cashier Read Access Allowed", "Returned HTTP 200 for products catalog")

        # ==============================================================
        # 10. SAFE DELETION INTEGRITY CHECKS
        # ==============================================================
        print(f"\n{Colors.BOLD}10. Auditing Master Deletion Protection...{Colors.END}")
        # Test 10.1: Category with products cannot be deleted
        req_del_cat = factory.delete(f'/api/product-categories/{cat1.id}/')
        force_authenticate(req_del_cat, user=admin_user)
        resp_del_cat = ProductCategoryViewSet.as_view({'delete': 'destroy'})(req_del_cat, pk=cat1.id)
        if resp_del_cat.status_code != 400:
            log_fail("Category with products deleted", f"Status: {resp_del_cat.status_code}")
        log_pass("Category Deletion Protection", f"Blocked with HTTP 400: '{resp_del_cat.data.get('error')}'")

        # Test 10.2: Service Category with services cannot be deleted
        req_del_sc = factory.delete(f'/api/service-categories/{sc1.id}/')
        force_authenticate(req_del_sc, user=admin_user)
        resp_del_sc = ServiceCategoryViewSet.as_view({'delete': 'destroy'})(req_del_sc, pk=sc1.id)
        if resp_del_sc.status_code != 400:
            log_fail("Service Category with services deleted", f"Status: {resp_del_sc.status_code}")
        log_pass("Service Category Deletion Protection", f"Blocked with HTTP 400: '{resp_del_sc.data.get('error')}'")

        print(f"\n{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN} ALL MASTER MODULE INTEGRITY & SECURITY TESTS PASSED! {Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN}======================================================{Colors.END}\n")

    finally:
        # ==============================================================
        # 11. AUTOMATIC CLEANUP OF ALL AUDIT DUMMY DATA
        # ==============================================================
        print(f"{Colors.BOLD}11. Cleaning up all test records (leaving database clean)...{Colors.END}")
        with transaction.atomic():
            for rec in reversed(created_records):
                try:
                    rec.delete()
                except Exception:
                    pass
            cashier_user.delete()
        print(f"{Colors.GREEN}[CLEANUP COMPLETE]{Colors.END}: All test records purged. Database remains clean.\n")


if __name__ == '__main__':
    run_master_tests()
