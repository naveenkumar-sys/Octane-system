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
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from core.models import (
    Product, ProductCategory, Brand, SerialNumber, StockMovement,
    Invoice, InvoiceItem, Payment, Customer
)
from core.services.stock_service import StockService
from core.services.reports_service import ReportsService


def run_inventory_tests():
    print("=" * 80)
    print("OCTANE SYSTEMS - MODULE 4: INVENTORY & SERIAL TRACKING AUTOMATED TEST SUITE")
    print("=" * 80)

    # Record baseline database state
    baseline_products = Product.objects.count()
    baseline_serials = SerialNumber.objects.count()
    baseline_movements = StockMovement.objects.count()
    print(f"[*] Baseline DB State: Products={baseline_products}, Serials={baseline_serials}, Movements={baseline_movements}")

    # Track all created test records for guaranteed cleanup
    created = {
        'categories': [],
        'brands': [],
        'products': [],
        'serials': [],
        'movements': [],
        'customers': [],
        'invoices': [],
        'users': []
    }

    client = APIClient()

    # Setup test admin and cashier
    admin_user = User.objects.filter(username='test_admin_inv').first()
    if not admin_user:
        admin_user = User.objects.create_superuser('test_admin_inv', 'test_admin_inv@example.com', 'AdminPass123!')
        created['users'].append(admin_user)

    cashier_user = User.objects.filter(username='test_cashier_inv').first()
    if not cashier_user:
        cashier_user = User.objects.create_user('test_cashier_inv', 'test_cashier_inv@example.com', 'CashierPass123!')
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
        # Create test Category and Brand
        test_cat = ProductCategory.objects.create(name="Test Inv Category Hardware")
        created['categories'].append(test_cat)
        test_brand = Brand.objects.create(name="Test Inv Brand Pro")
        created['brands'].append(test_brand)

        # -------------------------------------------------------------
        # TEST 1: Opening Stock Batch for Quantity-Tracked Product
        # -------------------------------------------------------------
        print("\n--- TEST 1: Opening Stock for Quantity-Tracked Product ---")
        p_qty = Product.objects.create(
            name="Test Kingston 16GB DDR4 RAM",
            sku="RAM-KNG-16G-TEST",
            category=test_cat,
            brand=test_brand,
            purchase_price=Decimal('2500.00'),
            selling_price=Decimal('3200.00'),
            tracking_type='QUANTITY',
            is_stock_enabled=True,
            min_stock_alert=3
        )
        created['products'].append(p_qty)

        payload_open_qty = {
            "items": [
                {
                    "product_id": p_qty.id,
                    "quantity": 10,
                    "unit_cost": "2450.00",
                    "notes": "Opening batch 10 units RAM"
                }
            ]
        }
        res = client.post('/api/inventory/opening-stock/', payload_open_qty, format='json')
        assert_true(res.status_code == status.HTTP_201_CREATED, "Opening stock API returns 201 Created for quantity product")
        assert_true(res.data.get('movements_count') == 1, "Returns movements_count=1")

        p_qty.refresh_from_db()
        assert_true(p_qty.get_current_stock() == 10, f"Product current stock is 10 (actual: {p_qty.get_current_stock()})")

        mov_qty = StockMovement.objects.filter(product=p_qty, movement_type='OPENING').first()
        assert_true(mov_qty is not None, "StockMovement record created with movement_type='OPENING'")
        assert_true(mov_qty.quantity == 10, "StockMovement quantity is 10")
        assert_true(mov_qty.unit_cost == Decimal('2450.00'), "StockMovement unit_cost recorded as 2450.00")
        assert_true(mov_qty.reference_type == 'OPENING_STOCK', "Reference type is OPENING_STOCK")
        created['movements'].append(mov_qty)

        # -------------------------------------------------------------
        # TEST 2: Opening Stock for Serial-Tracked Product
        # -------------------------------------------------------------
        print("\n--- TEST 2: Opening Stock for Serial-Tracked Product ---")
        p_ser = Product.objects.create(
            name="Test Lenovo ThinkPad E14",
            sku="LAP-LEN-E14-TEST",
            category=test_cat,
            brand=test_brand,
            purchase_price=Decimal('45000.00'),
            selling_price=Decimal('55000.00'),
            tracking_type='SERIAL_NUMBER',
            is_stock_enabled=True,
            min_stock_alert=2
        )
        created['products'].append(p_ser)

        serials_batch = ["TEST-SN-LP-001", "TEST-SN-LP-002", "TEST-SN-LP-003"]
        payload_open_ser = {
            "items": [
                {
                    "product_id": p_ser.id,
                    "quantity": 3,
                    "unit_cost": "44000.00",
                    "serial_numbers": serials_batch,
                    "notes": "Initial 3 laptops batch"
                }
            ]
        }
        res_ser = client.post('/api/inventory/opening-stock/', payload_open_ser, format='json')
        assert_true(res_ser.status_code == status.HTTP_201_CREATED, "Opening stock API returns 201 Created for serial product")
        assert_true(res_ser.data.get('movements_count') == 3, "Creates 3 individual 1:1 serial movements")

        p_ser.refresh_from_db()
        assert_true(p_ser.get_current_stock() == 3, f"Product current stock is 3 (actual: {p_ser.get_current_stock()})")

        ser_objs = list(SerialNumber.objects.filter(product=p_ser, serial_number__in=serials_batch))
        assert_true(len(ser_objs) == 3, "Exactly 3 SerialNumber records created in database")
        for sn in ser_objs:
            created['serials'].append(sn)
            assert_true(sn.status == 'AVAILABLE', f"Serial '{sn.serial_number}' status is 'AVAILABLE'")
            assert_true(sn.purchase_reference == 'OPENING_STOCK-INITIAL', f"Purchase ref is 'OPENING_STOCK-INITIAL'")

        mov_sers = list(StockMovement.objects.filter(product=p_ser, movement_type='OPENING'))
        assert_true(len(mov_sers) == 3, "3 StockMovement records exist for serial product")
        for m in mov_sers:
            created['movements'].append(m)
            assert_true(m.quantity == 1, "Each serial movement quantity is 1")
            assert_true(m.unit_cost == Decimal('44000.00'), "Unit cost is 44000.00")

        # -------------------------------------------------------------
        # TEST 3: Opening Stock Validation Boundaries & Guards
        # -------------------------------------------------------------
        print("\n--- TEST 3: Opening Stock Validation Boundaries ---")
        # 3a. Negative unit cost
        res_neg = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_qty.id, "quantity": 2, "unit_cost": "-500.00"}]
        }, format='json')
        assert_true(res_neg.status_code == status.HTTP_400_BAD_REQUEST, "Rejects negative unit cost with 400 Bad Request")

        # 3b. Quantity mismatch for serials (quantity 2 but 1 serial provided)
        res_mismatch = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_ser.id, "quantity": 2, "serial_numbers": ["TEST-SN-LP-999"]}]
        }, format='json')
        assert_true(res_mismatch.status_code == status.HTTP_400_BAD_REQUEST, "Rejects serial count mismatch with 400 Bad Request")

        # 3c. Duplicate serials within batch
        res_batch_dup = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_ser.id, "quantity": 2, "serial_numbers": ["SN-DUP-01", "SN-DUP-01"]}]
        }, format='json')
        assert_true(res_batch_dup.status_code == status.HTTP_400_BAD_REQUEST, "Rejects duplicate serials within batch with 400 Bad Request")

        # 3d. Already existing serial in DB
        res_db_dup = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_ser.id, "quantity": 1, "serial_numbers": ["TEST-SN-LP-001"]}]
        }, format='json')
        assert_true(res_db_dup.status_code == status.HTTP_400_BAD_REQUEST, "Rejects existing serial number in DB with 400 Bad Request")

        # 3e. Inactive product
        p_inactive = Product.objects.create(
            name="Test Inactive Product",
            sku="INACT-TEST-001",
            category=test_cat,
            is_active=False
        )
        created['products'].append(p_inactive)
        res_inact = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_inactive.id, "quantity": 1}]
        }, format='json')
        assert_true(res_inact.status_code == status.HTTP_400_BAD_REQUEST, "Rejects opening stock for inactive product with 400 Bad Request")

        # 3f. Non-stock product (services / digital items)
        p_nostock = Product.objects.create(
            name="Test Digital License",
            sku="DIG-LIC-TEST",
            category=test_cat,
            is_stock_enabled=False
        )
        created['products'].append(p_nostock)
        res_nostk = client.post('/api/inventory/opening-stock/', {
            "items": [{"product_id": p_nostock.id, "quantity": 1}]
        }, format='json')
        assert_true(res_nostk.status_code == status.HTTP_400_BAD_REQUEST, "Rejects opening stock for non-stock enabled product with 400 Bad Request")

        # -------------------------------------------------------------
        # TEST 4: Physical Stock Adjustment IN (Positive Adjustment)
        # -------------------------------------------------------------
        print("\n--- TEST 4: Physical Stock Adjustment IN ---")
        # For quantity product: currently has 10 units, adjust to 15
        res_adj_in = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_qty.id,
            "new_stock_quantity": 15,
            "reason": "Physical count audit: found 5 extra units"
        }, format='json')
        assert_true(res_adj_in.status_code == status.HTTP_200_OK, "Stock adjustment IN returns 200 OK")
        p_qty.refresh_from_db()
        assert_true(p_qty.get_current_stock() == 15, f"Product current stock increased to 15 (actual: {p_qty.get_current_stock()})")

        mov_adj_in = StockMovement.objects.filter(product=p_qty, movement_type='ADJUSTMENT_IN').first()
        assert_true(mov_adj_in is not None, "StockMovement record created with movement_type='ADJUSTMENT_IN'")
        assert_true(mov_adj_in.quantity == 5, "Adjustment IN quantity is 5")
        assert_true(mov_adj_in.unit_cost > Decimal('0.00'), f"Adjustment IN carries acquisition unit cost: {mov_adj_in.unit_cost}")
        created['movements'].append(mov_adj_in)

        # For serial product: currently has 3 units, adjust to 5 (add 2 new serials)
        res_adj_ser_in = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_ser.id,
            "new_stock_quantity": 5,
            "reason": "Physical count audit: 2 untracked units found",
            "serial_numbers": ["TEST-SN-LP-004", "TEST-SN-LP-005"]
        }, format='json')
        assert_true(res_adj_ser_in.status_code == status.HTTP_200_OK, "Serial stock adjustment IN returns 200 OK")
        p_ser.refresh_from_db()
        assert_true(p_ser.get_current_stock() == 5, f"Serial product current stock increased to 5 (actual: {p_ser.get_current_stock()})")

        new_sns = list(SerialNumber.objects.filter(product=p_ser, serial_number__in=["TEST-SN-LP-004", "TEST-SN-LP-005"]))
        assert_true(len(new_sns) == 2, "2 new SerialNumber records created")
        for sn in new_sns:
            created['serials'].append(sn)
            assert_true(sn.status == 'AVAILABLE', f"New serial '{sn.serial_number}' is AVAILABLE")

        mov_ser_in = list(StockMovement.objects.filter(product=p_ser, movement_type='ADJUSTMENT_IN'))
        for m in mov_ser_in:
            created['movements'].append(m)

        # -------------------------------------------------------------
        # TEST 5: Physical Stock Adjustment OUT (Negative Adjustment)
        # -------------------------------------------------------------
        print("\n--- TEST 5: Physical Stock Adjustment OUT ---")
        # For quantity product: currently has 15 units, adjust down to 12 (remove 3 damaged)
        res_adj_out = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_qty.id,
            "new_stock_quantity": 12,
            "reason": "Damaged goods written off"
        }, format='json')
        assert_true(res_adj_out.status_code == status.HTTP_200_OK, "Stock adjustment OUT returns 200 OK")
        p_qty.refresh_from_db()
        assert_true(p_qty.get_current_stock() == 12, f"Product current stock decreased to 12 (actual: {p_qty.get_current_stock()})")

        mov_adj_out = StockMovement.objects.filter(product=p_qty, movement_type='ADJUSTMENT_OUT').first()
        assert_true(mov_adj_out is not None, "StockMovement record created with movement_type='ADJUSTMENT_OUT'")
        assert_true(mov_adj_out.quantity == 3, "Adjustment OUT quantity is 3")
        created['movements'].append(mov_adj_out)

        # For serial product: currently has 5 units, adjust down to 4 (explicitly deduct TEST-SN-LP-005)
        res_adj_ser_out = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_ser.id,
            "new_stock_quantity": 4,
            "reason": "Defective motherboard written off",
            "serial_numbers": ["TEST-SN-LP-005"]
        }, format='json')
        assert_true(res_adj_ser_out.status_code == status.HTTP_200_OK, "Serial stock adjustment OUT returns 200 OK")
        p_ser.refresh_from_db()
        assert_true(p_ser.get_current_stock() == 4, f"Serial product current stock decreased to 4 (actual: {p_ser.get_current_stock()})")

        sn_def = SerialNumber.objects.get(product=p_ser, serial_number="TEST-SN-LP-005")
        assert_true(sn_def.status == 'DEFECTIVE', f"Deducted serial '{sn_def.serial_number}' status is marked 'DEFECTIVE'")

        mov_ser_out = list(StockMovement.objects.filter(product=p_ser, movement_type='ADJUSTMENT_OUT'))
        for m in mov_ser_out:
            created['movements'].append(m)

        # -------------------------------------------------------------
        # TEST 6: Adjustment Boundaries & FIFO Fallback
        # -------------------------------------------------------------
        print("\n--- TEST 6: Adjustment Boundaries & FIFO Fallback ---")
        # 6a. Negative new_stock_quantity rejected
        res_neg_stock = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_qty.id,
            "new_stock_quantity": -5,
            "reason": "Invalid count"
        }, format='json')
        assert_true(res_neg_stock.status_code == status.HTTP_400_BAD_REQUEST, "Rejects negative new_stock_quantity with 400 Bad Request")

        # 6b. Adjustment for inactive product rejected
        res_inact_adj = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_inactive.id,
            "new_stock_quantity": 5,
            "reason": "Audit"
        }, format='json')
        assert_true(res_inact_adj.status_code == status.HTTP_400_BAD_REQUEST, "Rejects adjustment for inactive product with 400 Bad Request")

        # 6c. Serial product FIFO fallback when serial_numbers list is omitted:
        # currently has 4 units, adjust to 3 without passing serial_numbers
        res_fifo = client.post('/api/inventory/adjust-stock/', {
            "product_id": p_ser.id,
            "new_stock_quantity": 3,
            "reason": "Audit deduction without explicit barcode scan"
        }, format='json')
        assert_true(res_fifo.status_code == status.HTTP_200_OK, "FIFO serial deduction succeeds with 200 OK")
        p_ser.refresh_from_db()
        assert_true(p_ser.get_current_stock() == 3, f"Current stock reduced to 3 (actual: {p_ser.get_current_stock()})")

        avail_serials_count = SerialNumber.objects.filter(product=p_ser, status='AVAILABLE').count()
        assert_true(avail_serials_count == 3, f"Exactly 3 available serials remain in DB (actual: {avail_serials_count})")

        # -------------------------------------------------------------
        # TEST 7: ProductViewSet Controlled adjust_stock Action
        # -------------------------------------------------------------
        print("\n--- TEST 7: ProductViewSet adjust_stock Action ---")
        res_action = client.post(f'/api/products/{p_qty.id}/adjust_stock/', {
            "new_stock_quantity": 10,
            "reason": "Admin direct count alignment"
        }, format='json')
        assert_true(res_action.status_code == status.HTTP_200_OK, "Direct action on /api/products/<id>/adjust_stock/ returns 200 OK")
        p_qty.refresh_from_db()
        assert_true(p_qty.get_current_stock() == 10, f"Stock updated to 10 via ViewSet action (actual: {p_qty.get_current_stock()})")

        # Negative quantity check on action
        res_act_neg = client.post(f'/api/products/{p_qty.id}/adjust_stock/', {
            "new_stock_quantity": -1
        }, format='json')
        assert_true(res_act_neg.status_code == status.HTTP_400_BAD_REQUEST, "Action rejects negative quantity with 400 Bad Request")

        # -------------------------------------------------------------
        # TEST 8: Serial Number Status Lifecycle & update_status Action
        # -------------------------------------------------------------
        print("\n--- TEST 8: Serial Number Status Lifecycle & Management ---")
        # Grab sn_def (which is DEFECTIVE) and restock it to AVAILABLE
        res_status_up = client.post(f'/api/serial-numbers/{sn_def.id}/update_status/', {
            "status": "AVAILABLE",
            "notes": "Repaired and cleared quality inspection"
        }, format='json')
        assert_true(res_status_up.status_code == status.HTTP_200_OK, "Admin can update serial status from DEFECTIVE to AVAILABLE")
        sn_def.refresh_from_db()
        assert_true(sn_def.status == 'AVAILABLE', "Serial status is now 'AVAILABLE'")

        # Non-admin / cashier user attempt rejected
        client.force_authenticate(user=cashier_user)
        res_cashier = client.post(f'/api/serial-numbers/{sn_def.id}/update_status/', {
            "status": "DEFECTIVE"
        }, format='json')
        assert_true(res_cashier.status_code == status.HTTP_403_FORBIDDEN, "Cashier blocked from updating serial status with 403 Forbidden")

        # Restore admin auth
        client.force_authenticate(user=admin_user)

        # -------------------------------------------------------------
        # TEST 9: CurrentStockView Metrics & Low Stock Alerts
        # -------------------------------------------------------------
        print("\n--- TEST 9: CurrentStockView Alerts & Valuation ---")
        # Create product with 0 stock -> OUT_OF_STOCK
        p_out = Product.objects.create(
            name="Test Empty Inventory Part",
            sku="PART-EMPTY-TEST",
            category=test_cat,
            purchase_price=Decimal('100.00'),
            selling_price=Decimal('150.00'),
            tracking_type='QUANTITY',
            is_stock_enabled=True,
            min_stock_alert=5
        )
        created['products'].append(p_out)

        # Create product with low stock (2 units <= min_stock_alert 5) -> LOW_STOCK
        p_low = Product.objects.create(
            name="Test Low Stock Cable",
            sku="CBL-LOW-TEST",
            category=test_cat,
            purchase_price=Decimal('50.00'),
            selling_price=Decimal('80.00'),
            tracking_type='QUANTITY',
            is_stock_enabled=True,
            min_stock_alert=5
        )
        created['products'].append(p_low)
        mov_low = StockMovement.objects.create(
            product=p_low,
            movement_type='OPENING',
            quantity=2,
            reference_type='OPENING_STOCK',
            unit_cost=Decimal('50.00'),
            created_by=admin_user
        )
        created['movements'].append(mov_low)

        res_stock = client.get('/api/inventory/current-stock/')
        assert_true(res_stock.status_code == status.HTTP_200_OK, "CurrentStockView returns 200 OK")
        stock_items = {item['product_id']: item for item in res_stock.data}

        # Check p_out status
        item_out = stock_items.get(p_out.id)
        assert_true(item_out is not None, "Product p_out present in current stock list")
        assert_true(item_out['stock_status'] == 'OUT_OF_STOCK', f"0 stock item has status 'OUT_OF_STOCK' (actual: {item_out['stock_status']})")
        assert_true(item_out['stock_value'] == 0.0, "Stock valuation for 0 stock is 0.0")

        # Check p_low status
        item_low = stock_items.get(p_low.id)
        assert_true(item_low is not None, "Product p_low present in current stock list")
        assert_true(item_low['stock_status'] == 'LOW_STOCK', f"Low stock item has status 'LOW_STOCK' (actual: {item_low['stock_status']})")
        assert_true(item_low['current_stock'] == 2, "Current stock is 2")
        assert_true(item_low['stock_value'] == 100.0, f"Stock value is 2 * 50 = 100.0 (actual: {item_low['stock_value']})")

        # Check search filtering
        res_search = client.get('/api/inventory/current-stock/?search=CBL-LOW-TEST')
        assert_true(len(res_search.data) == 1, "Search by SKU returns exact matching item")
        assert_true(res_search.data[0]['product_id'] == p_low.id, "Returned item is p_low")

        # Check status filtering
        res_filter_low = client.get('/api/inventory/current-stock/?status=LOW_STOCK')
        low_ids = [it['product_id'] for it in res_filter_low.data]
        assert_true(p_low.id in low_ids, "Filtered LOW_STOCK contains p_low")
        assert_true(p_out.id not in low_ids, "Filtered LOW_STOCK excludes p_out")

        # Check inventory valuation report
        val_report = ReportsService.get_inventory_valuation_report()
        assert_true('total_stock_valuation' in val_report, "Valuation report contains 'total_stock_valuation'")
        assert_true(val_report['total_stock_valuation'] > 0, "Total stock valuation is positive")

        # -------------------------------------------------------------
        # TEST 10: Stock Movement Ledger Immutability & Audit Integrity
        # -------------------------------------------------------------
        print("\n--- TEST 10: Stock Movement Ledger Immutability ---")
        # Direct POST on StockMovementViewSet must be forbidden (ReadOnlyModelViewSet -> 405 Method Not Allowed)
        res_mov_post = client.post('/api/stock-movements/', {
            "product": p_qty.id,
            "movement_type": "OPENING",
            "quantity": 100
        }, format='json')
        assert_true(res_mov_post.status_code == status.HTTP_405_METHOD_NOT_ALLOWED, "Direct POST on /api/stock-movements/ rejected with 405 Method Not Allowed")

        # Direct DELETE on StockMovementViewSet must be forbidden
        res_mov_del = client.delete(f'/api/stock-movements/{mov_qty.id}/')
        assert_true(res_mov_del.status_code == status.HTTP_405_METHOD_NOT_ALLOWED, "Direct DELETE on /api/stock-movements/<id>/ rejected with 405 Method Not Allowed")

        # Read audit log filterable by product
        res_mov_list = client.get(f'/api/stock-movements/?product={p_qty.id}')
        assert_true(res_mov_list.status_code == status.HTTP_200_OK, "StockMovementViewSet list returns 200 OK")
        mov_items = res_mov_list.data if isinstance(res_mov_list.data, list) else res_mov_list.data.get('results', [])
        assert_true(len(mov_items) >= 2, f"Stock ledger lists movements for p_qty (count: {len(mov_items)})")

    except Exception as e:
        print(f"\n[EXCEPTION DURING TESTING]: {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n" + "=" * 80)
        print("TEARDOWN & DATABASE PURGING")
        print("=" * 80)

        # Clean test StockMovements created during test
        for p in created['products']:
            if p.id:
                StockMovement.objects.filter(product=p).delete()
        for m in created['movements']:
            if m.id:
                StockMovement.objects.filter(id=m.id).delete()

        # Clean test SerialNumbers
        for sn in created['serials']:
            if sn.id:
                SerialNumber.objects.filter(id=sn.id).delete()
        for p in created['products']:
            if p.id:
                SerialNumber.objects.filter(product=p).delete()

        # Clean test Products
        for p in created['products']:
            if p.id:
                Product.objects.filter(id=p.id).delete()

        # Clean test Categories and Brands
        for c in created['categories']:
            if c.id:
                ProductCategory.objects.filter(id=c.id).delete()
        for b in created['brands']:
            if b.id:
                Brand.objects.filter(id=b.id).delete()

        # Clean test Users
        for u in created['users']:
            if u.id:
                User.objects.filter(id=u.id).delete()

        # Verify DB state
        after_products = Product.objects.count()
        after_serials = SerialNumber.objects.count()
        after_movements = StockMovement.objects.count()
        print(f"[*] Final DB State: Products={after_products}, Serials={after_serials}, Movements={after_movements}")

        if (after_products == baseline_products and 
            after_serials == baseline_serials and 
            after_movements == baseline_movements):
            print("[SUCCESS] 100% CLEAN TEARDOWN: Database returned precisely to pre-test baseline!")
        else:
            print("[WARNING] DATABASE MISMATCH: Stray records may remain!")

    print("\n" + "=" * 80)
    print(f"TEST RESULTS SUMMARY: {passed_count} PASSED, {failed_count} FAILED")
    print("=" * 80)
    return failed_count == 0


if __name__ == '__main__':
    success = run_inventory_tests()
    sys.exit(0 if success else 1)
