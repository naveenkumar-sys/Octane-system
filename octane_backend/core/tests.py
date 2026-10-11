from decimal import Decimal
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.exceptions import ValidationError
from core.models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, Brand, Product, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, Payment,
    ExpenseCategory, Expense, Purchase, PurchaseItem,
    PartnerDrawings, PartnerSettlement, SupplierPayment
)
from core.services.stock_service import StockService
from core.services.tax_engine import TaxEngine, amount_to_words_indian
from core.services.invoice_formatter import InvoiceFormatter
from core.services.invoice_service import InvoiceService
from core.services.purchase_service import PurchaseService
from core.services.partner_ledger_service import PartnerLedgerService
from core.services.reports_service import ReportsService



class Phase1AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.login_url = reverse('token_obtain_pair')
        self.me_url = reverse('user_profile')

    def test_jwt_login_success(self):
        payload = {'username': 'admin', 'password': 'adminpassword123'}
        response = self.client.post(self.login_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class Phase4TaxEngineAndA4PrintTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)
        self.profile = BusinessProfile.objects.create(company_name="OCTANE SYSTEMS", gstin="29DRTPA7275L1ZW", state_code="29")
        self.customer = Customer.objects.create(name="ABC Technologies", gstin="29ABCDE1234F1Z5", state_code="29")

    def test_amount_to_words_indian(self):
        self.assertEqual(amount_to_words_indian(2478.00), "Indian Rupees Two Thousand Four Hundred Seventy Eight Only")

    def test_intra_state_gst_calculation_matrix_sample(self):
        items_data = [{
            'description': 'LAPTOP SCREEN-ASESORIS',
            'hsn_sac': '852411',
            'qty': 1,
            'rate': 2100.00,
            'discount': 0,
            'gst_rate': 18.00
        }]
        result = TaxEngine.calculate_invoice_taxes(items_data=items_data, seller_state_code="29", buyer_state_code="29")
        self.assertTrue(result['is_intra_state'])
        self.assertEqual(result['grand_total'], Decimal('2478.00'))


class Phase5POSBillingAndPaymentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)
        
        self.profile = BusinessProfile.objects.get_or_create(id=1, defaults={'company_name': 'OCTANE SYSTEMS', 'state_code': '29'})[0]
        self.customer = Customer.objects.create(name="ABC Technologies", state_code="29")
        self.category = ProductCategory.objects.create(name="Hardware")
        
        # Product 1: RAM (Quantity tracking)
        self.ram = Product.objects.create(
            name="16GB DDR4 RAM", sku="RAM-16GB", category=self.category,
            purchase_price=2200.00, selling_price=3000.00, is_stock_enabled=True
        )
        # Seed RAM initial stock = 10
        StockService.process_stock_in(self.ram, 10, 'OPENING', 'OPENING_STOCK', user=self.user)

        # Product 2: Laptop (Serial tracking)
        self.laptop = Product.objects.create(
            name="Dell Latitude 5450", sku="LAP-DELL-5450", category=self.category,
            purchase_price=42000.00, selling_price=50000.00, is_stock_enabled=True, tracking_type='SERIAL_NUMBER'
        )
        StockService.process_stock_in(self.laptop, 2, 'OPENING', 'OPENING_STOCK', serial_numbers_list=['DL001', 'DL002'], user=self.user)

        # Service: Windows OS Installation
        self.os_service = Service.objects.create(
            service_name="Windows 11 Installation", sac="998313", default_rate=500.00
        )

    def test_pos_billing_mixed_product_and_service_stock_out(self):
        """Verify unified billing creates invoice, performs Stock OUT on products, skips stock out on services."""
        payload = {
            'customer_id': self.customer.id,
            'items': [
                {
                    'item_type': 'PRODUCT',
                    'product_id': self.ram.id,
                    'qty': 2,
                    'rate': 3000.00,
                    'gst_rate': 18.00
                },
                {
                    'item_type': 'SERVICE',
                    'service_id': self.os_service.id,
                    'qty': 1,
                    'rate': 500.00,
                    'gst_rate': 18.00
                }
            ],
            'payments': [
                {'payment_mode': 'CASH', 'amount': 2000.00},
                {'payment_mode': 'UPI', 'amount': 5000.00}
            ],
            'partner_allocation_json': {'Ramesh': 50, 'Lokesh': 50}
        }

        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        
        self.assertIsNotNone(invoice.invoice_number)
        self.assertEqual(invoice.items.count(), 2)
        
        # Verify RAM Stock OUT: 10 - 2 = 8
        self.assertEqual(self.ram.get_current_stock(), 8)
        
        # Total line taxable: (3000*2) + 500 = 6500. Tax (18%): 1170. Grand total: 7670.
        self.assertEqual(invoice.grand_total, Decimal('7670.00'))
        self.assertEqual(invoice.total_paid_amount, Decimal('7000.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('670.00'))
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')

    def test_delayed_payment_recording(self):
        """Verify delayed payment updates total paid and transitions payment_status to PAID."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.os_service.id, 'qty': 1, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 500.00}]  # Total 1180, Paid 500, Balance 680
        }
        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')
        self.assertEqual(invoice.balance_due_amount, Decimal('680.00'))

        # Record delayed payment of remaining 680
        payment = InvoiceService.record_delayed_payment(
            self.user, 
            invoice.id, 
            {'amount': 680.00, 'payment_mode': 'UPI', 'reference_number': 'UPI998877'}
        )

        invoice.refresh_from_db()
        self.assertEqual(invoice.total_paid_amount, Decimal('1180.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('0.00'))
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_invoice_create_via_api(self):
        """Verify POST /api/invoices/ creates invoice via REST API."""
        url = reverse('invoice-list')
        payload = {
            'customer_id': self.customer.id,
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.ram.id,
                'qty': 1,
                'rate': 3000.00,
                'gst_rate': 18.00
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': 3540.00}]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['payment_status'], 'PAID')

    def test_product_only_sale_with_stock_deduction(self):
        """Verify product-only sale deducts stock and records Stock Movement."""
        initial_stock = self.ram.get_current_stock()
        payload = {
            'customer_id': self.customer.id,
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.ram.id,
                'qty': 3,
                'rate': 3000.00,
                'discount': 10.00,
                'gst_rate': 18.00
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': 9558.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        self.assertEqual(self.ram.get_current_stock(), initial_stock - 3)
        self.assertEqual(invoice.items.first().item_type, 'PRODUCT')
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_service_only_sale_without_stock(self):
        """Verify service-only sale creates invoice without stock deduction or stock ledger movement."""
        movements_count_before = StockMovement.objects.count()
        payload = {
            'customer_id': self.customer.id,
            'items': [{
                'item_type': 'SERVICE',
                'service_id': self.os_service.id,
                'qty': 2,
                'rate': 500.00,
                'gst_rate': 18.00
            }],
            'payments': [{'payment_mode': 'UPI', 'amount': 1180.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        movements_count_after = StockMovement.objects.count()

        self.assertEqual(movements_count_before, movements_count_after)
        self.assertEqual(invoice.items.first().item_type, 'SERVICE')
        self.assertEqual(invoice.grand_total, Decimal('1180.00'))
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_serial_number_product_sale(self):
        """Verify sale of serial-tracked product updates serial status to SOLD."""
        serial_obj = SerialNumber.objects.get(serial_number='DL001')
        self.assertEqual(serial_obj.status, 'AVAILABLE')

        payload = {
            'customer_id': self.customer.id,
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.laptop.id,
                'serial_number': 'DL001',
                'qty': 1,
                'rate': 50000.00,
                'gst_rate': 18.00
            }],
            'payments': [{'payment_mode': 'BANK_TRANSFER', 'amount': 59000.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        serial_obj.refresh_from_db()

        self.assertEqual(serial_obj.status, 'SOLD')
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_mixed_product_and_service_gst_and_discount(self):
        """Verify mixed Product + Service invoice with discounts and tax calculation."""
        payload = {
            'customer_id': self.customer.id,
            'items': [
                {
                    'item_type': 'PRODUCT',
                    'product_id': self.ram.id,
                    'qty': 1,
                    'rate': 3000.00,
                    'discount': 10.00, # 2700 taxable
                    'gst_rate': 18.00
                },
                {
                    'item_type': 'SERVICE',
                    'service_id': self.os_service.id,
                    'qty': 1,
                    'rate': 500.00,
                    'discount': 0.00, # 500 taxable
                    'gst_rate': 18.00
                }
            ],
            'payments': [{'payment_mode': 'CARD', 'amount': 3776.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.user, payload)
        self.assertEqual(invoice.items.count(), 2)
        # Taxable: 2700 + 500 = 3200. Tax (18%): 576. Grand Total: 3776.
        self.assertEqual(invoice.taxable_amount, Decimal('3200.00'))
        self.assertEqual(invoice.grand_total, Decimal('3776.00'))
        self.assertEqual(invoice.payment_status, 'PAID')


class Phase6PurchaseAndExpenseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)
        
        self.supplier = Supplier.objects.create(name="Redington India Ltd", gstin="29REDIN1234F1Z9", state_code="29")
        self.partner_ramesh = Partner.objects.get_or_create(name="Ramesh", defaults={'ownership_percentage': 50.00})[0]
        self.partner_lokesh = Partner.objects.get_or_create(name="Lokesh", defaults={'ownership_percentage': 50.00})[0]
        
        self.category = ProductCategory.objects.create(name="Hardware")
        self.ram = Product.objects.create(
            name="8GB DDR4 RAM", sku="RAM-8GB", category=self.category,
            purchase_price=1500.00, selling_price=2200.00, is_stock_enabled=True, tracking_type='QUANTITY'
        )
        self.laptop = Product.objects.create(
            name="Lenovo ThinkPad E14", sku="LAP-LEN-E14", category=self.category,
            purchase_price=50000.00, selling_price=60000.00, is_stock_enabled=True, tracking_type='SERIAL_NUMBER'
        )

        self.expense_cat = ExpenseCategory.objects.create(name="Office Rent & Utilities")

    def test_purchase_creation_and_stock_in_with_serials(self):
        """Verify Purchase creation performs stock IN for quantity items & registers serial numbers for serial tracked items."""
        payload = {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'INV-RED-9988',
            'paid_by_partner_id': self.partner_ramesh.id,
            'payment_mode': 'PARTNER_OUT_OF_POCKET',
            'items': [
                {
                    'product_id': self.ram.id,
                    'quantity': 5,
                    'unit_cost': 1500.00,
                    'gst_rate': 18.00
                },
                {
                    'product_id': self.laptop.id,
                    'quantity': 2,
                    'unit_cost': 50000.00,
                    'gst_rate': 18.00,
                    'serial_numbers_text': 'LENV001, LENV002'
                }
            ]
        }

        purchase = PurchaseService.create_and_post_purchase(self.user, payload)
        self.assertTrue(purchase.purchase_number.startswith("PUR-"))
        self.assertEqual(purchase.paid_by_partner, self.partner_ramesh)
        self.assertEqual(purchase.payment_status, 'PAID')

        # Stock check for RAM: 0 + 5 = 5
        self.assertEqual(self.ram.get_current_stock(), 5)

        # Stock check for Laptop: 0 + 2 = 2, and serial status check
        self.assertEqual(self.laptop.get_current_stock(), 2)
        sn1 = SerialNumber.objects.get(product=self.laptop, serial_number='LENV001')
        self.assertEqual(sn1.status, 'AVAILABLE')

    def test_purchase_api_endpoint(self):
        """Verify POST /api/purchases/ via REST API."""
        url = reverse('purchase-list')
        payload = {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'INV-8877',
            'paid_by_partner_id': self.partner_lokesh.id,
            'items': [{
                'product_id': self.ram.id,
                'quantity': 3,
                'unit_cost': 1500.00,
                'gst_rate': 18.00
            }]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['paid_by_partner'], self.partner_lokesh.id)

    def test_expense_creation_and_api(self):
        """Verify Expense creation paid out of pocket by partner."""
        url = reverse('expense-list')
        payload = {
            'category_id': self.expense_cat.id,
            'description': 'September Office Rent',
            'amount': 15000.00,
            'payment_mode': 'PARTNER_OUT_OF_POCKET',
            'paid_by_partner_id': self.partner_ramesh.id
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['paid_by_partner'], self.partner_ramesh.id)
        
        # Verify expense count
        self.assertEqual(Expense.objects.count(), 1)


class Phase7PartnerLedgerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)
        
        self.ramesh = Partner.objects.get_or_create(name="Ramesh", defaults={'ownership_percentage': 50.00})[0]
        self.lokesh = Partner.objects.get_or_create(name="Lokesh", defaults={'ownership_percentage': 50.00})[0]
        
        self.supplier = Supplier.objects.create(name="Redington India Ltd", gstin="29REDIN1234F1Z9", state_code="29")
        self.category = ProductCategory.objects.create(name="Hardware")
        self.ram = Product.objects.create(
            name="16GB DDR4 RAM", sku="RAM-16GB-TEST", category=self.category,
            purchase_price=2000.00, selling_price=3000.00, is_stock_enabled=True
        )

        self.expense_cat = ExpenseCategory.objects.create(name="Office Utilities")

    def test_partner_out_of_pocket_purchase_and_drawings_ledger_balance(self):
        """Verify Ramesh funding purchase increases his capital credit and drawing reduces debit."""
        # 1. Ramesh pays ₹10,000 purchase out of pocket
        PurchaseService.create_and_post_purchase(self.user, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'INV-TEST-1',
            'paid_by_partner_id': self.ramesh.id,
            'payment_mode': 'PARTNER_OUT_OF_POCKET',
            'items': [{'product_id': self.ram.id, 'quantity': 5, 'unit_cost': 2000.00, 'gst_rate': 0.00}]
        })

        # 2. Ramesh takes ₹3,000 cash drawing
        PartnerDrawings.objects.create(
            drawing_number='DRW-0001',
            partner=self.ramesh,
            drawing_date='2026-09-12',
            amount=Decimal('3000.00'),
            payment_mode='CASH',
            created_by=self.user
        )

        summary = PartnerLedgerService._calculate_single_partner_summary(self.ramesh)
        self.assertEqual(summary['purchases_funded'], Decimal('10000.00'))
        self.assertEqual(summary['drawings'], Decimal('3000.00'))
        self.assertEqual(summary['net_capital_balance'], Decimal('7000.00'))

    def test_inter_partner_settlement(self):
        """Verify Ramesh paying Lokesh ₹2,000 reduces Ramesh balance and increases Lokesh balance."""
        PartnerSettlement.objects.create(
            settlement_number='STL-0001',
            from_partner=self.ramesh,
            to_partner=self.lokesh,
            settlement_date='2026-09-12',
            amount=Decimal('2000.00'),
            payment_mode='UPI',
            created_by=self.user
        )

        ramesh_sum = PartnerLedgerService._calculate_single_partner_summary(self.ramesh)
        lokesh_sum = PartnerLedgerService._calculate_single_partner_summary(self.lokesh)

        self.assertEqual(ramesh_sum['settlements_paid'], Decimal('2000.00'))
        self.assertEqual(ramesh_sum['net_capital_balance'], Decimal('-2000.00'))

        self.assertEqual(lokesh_sum['settlements_received'], Decimal('2000.00'))
        self.assertEqual(lokesh_sum['net_capital_balance'], Decimal('2000.00'))

    def test_partner_ledger_api_endpoints(self):
        """Verify GET /api/partner-ledger/summary/ and GET /api/partner-ledger/statement/{id}/."""
        summary_url = reverse('partner_ledger_summary_all')
        res1 = self.client.get(summary_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res1.data), 2)

        stmt_url = reverse('partner_ledger_statement', kwargs={'partner_id': self.ramesh.id})
        res2 = self.client.get(stmt_url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIn('statement', res2.data)
        self.assertIn('summary', res2.data)


class Phase8FinancialReportsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)

    def test_financial_reports_endpoints(self):
        """Verify dashboard, P&L, GST HSN, and inventory valuation endpoints return 200 OK."""
        res_dash = self.client.get(reverse('report_dashboard'))
        self.assertEqual(res_dash.status_code, status.HTTP_200_OK)

        res_pnl = self.client.get(reverse('report_pnl'))
        self.assertEqual(res_pnl.status_code, status.HTTP_200_OK)

        res_gst = self.client.get(reverse('report_gst_hsn'))
        self.assertEqual(res_gst.status_code, status.HTTP_200_OK)

        res_val = self.client.get(reverse('report_inventory_valuation'))
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)


class Phase2RbacPermissionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin_user', password='password123', is_staff=True)
        self.cashier = User.objects.create_user(username='cashier_user', password='password123', is_staff=False)
        self.category = ProductCategory.objects.create(name="Laptops")
        self.product = Product.objects.create(name="Test Laptop", sku="TEST-LAP", category=self.category, selling_price=50000.00)

    def test_cashier_can_read_products_but_cannot_create_or_update(self):
        self.client.force_authenticate(user=self.cashier)
        
        # Cashier can list products (GET)
        res_get = self.client.get(reverse('product-list'))
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)

        # Cashier CANNOT create product (POST)
        res_post = self.client.post(reverse('product-list'), {'name': 'Unauthorized Laptop', 'selling_price': 100})
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

        # Cashier CANNOT update product (PATCH)
        res_patch = self.client.patch(reverse('product-detail', kwargs={'pk': self.product.id}), {'selling_price': 10.00})
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_cannot_access_admin_only_endpoints(self):
        self.client.force_authenticate(user=self.cashier)

        # Stock Adjustment -> 403
        res_adj = self.client.post(reverse('adjust_stock'), {'product_id': self.product.id, 'new_stock_quantity': 10})
        self.assertEqual(res_adj.status_code, status.HTTP_403_FORBIDDEN)


        # Partner Ledger -> 403
        res_part = self.client.get(reverse('partner_ledger_summary_all'))
        self.assertEqual(res_part.status_code, status.HTTP_403_FORBIDDEN)

        # P&L Report -> 403
        res_pnl = self.client.get(reverse('report_pnl'))
        self.assertEqual(res_pnl.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_has_full_access(self):
        self.client.force_authenticate(user=self.admin)

        # Admin CAN create product
        res_post = self.client.post(reverse('product-list'), {'name': 'Admin Laptop', 'sku': 'ADM-LAP', 'selling_price': 60000})
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)

        # Admin CAN view P&L report
        res_pnl = self.client.get(reverse('report_pnl'))
        self.assertEqual(res_pnl.status_code, status.HTTP_200_OK)


class Phase3ProductAndOpeningStockTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin_phase3', password='password123', is_staff=True)
        self.cashier = User.objects.create_user(username='cashier_phase3', password='password123', is_staff=False)
        self.category = ProductCategory.objects.create(name="Computer Hardware")
        
        # Quantity-tracked Product
        self.ram = Product.objects.create(
            name="Corsair 16GB RAM",
            sku="RAM-COR-16GB",
            category=self.category,
            purchase_price=2500.00,
            selling_price=3500.00,
            is_stock_enabled=True,
            tracking_type="QUANTITY"
        )

        # Serial-tracked Product
        self.laptop = Product.objects.create(
            name="Lenovo ThinkPad T14",
            sku="LAP-LEN-T14",
            category=self.category,
            purchase_price=55000.00,
            selling_price=65000.00,
            is_stock_enabled=True,
            tracking_type="SERIAL_NUMBER"
        )

    def test_product_master_creation_does_not_modify_stock(self):
        """Verify creating or editing a product master never modifies current stock."""
        self.client.force_authenticate(user=self.admin)
        
        res = self.client.post(reverse('product-list'), {
            'name': 'SSD 500GB',
            'sku': 'SSD-500GB',
            'is_stock_enabled': True,
            'purchase_price': 3000.00,
            'selling_price': 4000.00,
            'tracking_type': 'QUANTITY',
            'initial_stock': 10  # Passed payload should be ignored
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_prod = Product.objects.get(sku='SSD-500GB')
        self.assertEqual(new_prod.get_current_stock(), 0)

        # Edit product
        res_edit = self.client.patch(reverse('product-detail', kwargs={'pk': new_prod.id}), {
            'selling_price': 4200.00,
            'initial_stock': 50  # Should be ignored
        }, format='json')
        self.assertEqual(res_edit.status_code, status.HTTP_200_OK)
        new_prod.refresh_from_db()
        self.assertEqual(new_prod.get_current_stock(), 0)

    def test_product_validation_duplicate_sku_and_negative_price(self):
        self.client.force_authenticate(user=self.admin)

        # Duplicate SKU
        res_dup = self.client.post(reverse('product-list'), {
            'name': 'Duplicate RAM',
            'sku': 'RAM-COR-16GB',
            'selling_price': 3500.00
        }, format='json')
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative Price
        res_neg = self.client.post(reverse('product-list'), {
            'name': 'Negative Laptop',
            'sku': 'LAP-NEG',
            'selling_price': -500.00
        }, format='json')
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantity_opening_stock(self):
        self.client.force_authenticate(user=self.admin)

        res = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.ram.id,
                'quantity': 25,
                'unit_cost': 2500.00,
                'notes': 'Initial RAM batch'
            }]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.ram.get_current_stock(), 25)
        
        # Verify no fake serials were created
        self.assertEqual(SerialNumber.objects.filter(product=self.ram).count(), 0)

    def test_serial_opening_stock_exact_count_required(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Missing serials for qty = 2 -> Reject
        res_missing = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 2,
                'serial_numbers': ['SN-LEN-001']  # Only 1 serial for qty 2
            }]
        }, format='json')
        self.assertEqual(res_missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.laptop.get_current_stock(), 0)

        # 2. Duplicate serial in batch -> Reject
        res_batch_dup = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 2,
                'serial_numbers': ['SN-LEN-001', 'SN-LEN-001']
            }]
        }, format='json')
        self.assertEqual(res_batch_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Valid serials matching qty = 2 -> Success
        res_success = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 2,
                'serial_numbers': ['SN-LEN-001', 'SN-LEN-002']
            }]
        }, format='json')
        self.assertEqual(res_success.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.laptop.get_current_stock(), 2)

        # Check DB records
        serials = SerialNumber.objects.filter(product=self.laptop, status='AVAILABLE')
        self.assertEqual(serials.count(), 2)
        self.assertIn('SN-LEN-001', [s.serial_number for s in serials])

        # 4. Attempt adding duplicate serial already in DB -> Reject
        res_existing_dup = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 1,
                'serial_numbers': ['SN-LEN-001']
            }]
        }, format='json')
        self.assertEqual(res_existing_dup.status_code, status.HTTP_400_BAD_REQUEST)


    def test_opening_stock_cashier_forbidden(self):
        self.client.force_authenticate(user=self.cashier)

        res = self.client.post(reverse('opening_stock'), {
            'items': [{
                'product_id': self.ram.id,
                'quantity': 10
            }]
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_stock_adjustment_quantity_in_and_out(self):
        """Test stock adjustment IN and OUT for quantity-tracked products."""
        self.client.force_authenticate(user=self.admin)

        # 1. Start with 0 stock
        self.assertEqual(self.ram.get_current_stock(), 0)

        # 2. Adjust IN to 15
        res = self.client.post(reverse('adjust_stock'), {
            'product_id': self.ram.id,
            'new_stock_quantity': 15,
            'reason': 'Audit count correction IN'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.ram.get_current_stock(), 15)

        # Verify StockMovement record
        movement_in = StockMovement.objects.filter(product=self.ram, movement_type='ADJUSTMENT_IN').first()
        self.assertIsNotNone(movement_in)
        self.assertEqual(movement_in.quantity, 15)
        self.assertEqual(movement_in.notes, 'Audit count correction IN')

        # 3. Adjust OUT to 10 (deduction of 5)
        res_out = self.client.post(reverse('adjust_stock'), {
            'product_id': self.ram.id,
            'new_stock_quantity': 10,
            'reason': 'Damaged items found during audit'
        }, format='json')
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)
        self.assertEqual(self.ram.get_current_stock(), 10)

        movement_out = StockMovement.objects.filter(product=self.ram, movement_type='ADJUSTMENT_OUT').first()
        self.assertIsNotNone(movement_out)
        self.assertEqual(movement_out.quantity, 5)

    def test_stock_adjustment_serialized_products(self):
        """Test stock adjustment IN and OUT for serial-tracked items with validation."""
        self.client.force_authenticate(user=self.admin)

        # 1. Adjust IN by 2 units with serial numbers
        res = self.client.post(reverse('adjust_stock'), {
            'product_id': self.laptop.id,
            'new_stock_quantity': 2,
            'reason': 'Discovered units in storeroom',
            'serial_numbers': ['SN-ADJ-001', 'SN-ADJ-002']
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.laptop.get_current_stock(), 2)

        # Check serial numbers are created with AVAILABLE status
        serials = SerialNumber.objects.filter(product=self.laptop, status='AVAILABLE')
        self.assertEqual(serials.count(), 2)
        self.assertIn('SN-ADJ-001', [s.serial_number for s in serials])

        # 2. Adjust OUT by 1 unit with specific serial number
        res_out = self.client.post(reverse('adjust_stock'), {
            'product_id': self.laptop.id,
            'new_stock_quantity': 1,
            'reason': 'Damaged display unit',
            'serial_numbers': ['SN-ADJ-001']
        }, format='json')
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)
        self.assertEqual(self.laptop.get_current_stock(), 1)

        # Verify SN-ADJ-001 is now DEFECTIVE (written off / damaged)
        sn1 = SerialNumber.objects.get(product=self.laptop, serial_number='SN-ADJ-001')
        self.assertEqual(sn1.status, 'DEFECTIVE')

        # 3. Adjust OUT remaining unit with FIFO fallback (no explicit serial provided)
        res_out_fifo = self.client.post(reverse('adjust_stock'), {
            'product_id': self.laptop.id,
            'new_stock_quantity': 0,
            'reason': 'Liquid damage write-off'
        }, format='json')
        self.assertEqual(res_out_fifo.status_code, status.HTTP_200_OK)
        self.assertEqual(self.laptop.get_current_stock(), 0)

        sn2 = SerialNumber.objects.get(product=self.laptop, serial_number='SN-ADJ-002')
        self.assertEqual(sn2.status, 'DEFECTIVE')

    def test_stock_adjustment_validation_guards(self):
        """Test negative adjustments and mismatch error handling."""
        self.client.force_authenticate(user=self.admin)

        # 1. Negative new stock quantity is rejected
        res = self.client.post(reverse('adjust_stock'), {
            'product_id': self.ram.id,
            'new_stock_quantity': -5,
            'reason': 'Invalid negative value'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Adjusting serialized product IN with insufficient serial count fails
        res_sn_mismatch = self.client.post(reverse('adjust_stock'), {
            'product_id': self.laptop.id,
            'new_stock_quantity': 3,
            'reason': 'Mismatch test',
            'serial_numbers': ['ONLY-ONE']
        }, format='json')
        self.assertEqual(res_sn_mismatch.status_code, status.HTTP_400_BAD_REQUEST)


class Phase4PurchaseAndSupplierStockInTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin_p4', password='password123', is_staff=True)
        self.cashier = User.objects.create_user(username='cashier_p4', password='password123', is_staff=False)
        
        self.supplier = Supplier.objects.create(
            name="Matrix Infotech", gstin="29MATRX1234F1Z1", state_code="29", is_active=True
        )
        self.inactive_supplier = Supplier.objects.create(
            name="Closed Vendor", gstin="29CLOSE1234F1Z2", is_active=False
        )
        
        self.category = ProductCategory.objects.create(name="Computer Hardware")
        self.ram = Product.objects.create(
            name="Kingston 16GB DDR5 RAM", sku="RAM-KNG-16GB", category=self.category,
            purchase_price=4500.00, selling_price=5500.00, is_stock_enabled=True, tracking_type='QUANTITY'
        )
        self.laptop = Product.objects.create(
            name="Dell Latitude 5450", sku="LAP-DELL-5450-P4", category=self.category,
            purchase_price=45000.00, selling_price=55000.00, is_stock_enabled=True, tracking_type='SERIAL_NUMBER'
        )
        self.inactive_product = Product.objects.create(
            name="Obsolete Mouse", sku="MOU-OBS", category=self.category,
            purchase_price=100.00, selling_price=200.00, is_active=False
        )

    def test_admin_purchase_quantity_product_increases_stock(self):
        """Verify Admin purchase of QUANTITY product creates PURCHASE StockMovement and increases stock."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('purchase-list')
        payload = {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'MI-4285',
            'payment_mode': 'CASH',
            'paid_amount': 94400.00,
            'items': [{
                'product_id': self.ram.id,
                'quantity': 20,
                'unit_cost': 4000.00,
                'gst_rate': 18.00
            }]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.ram.get_current_stock(), 20)
        
        # Check Catalog purchase_price isolated
        self.ram.refresh_from_db()
        self.assertEqual(self.ram.purchase_price, Decimal('4500.00'))

        # StockMovement check
        movement = StockMovement.objects.filter(product=self.ram, movement_type='PURCHASE').first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, 20)

    def test_cashier_cannot_create_purchase(self):
        """Verify Cashier user receives 403 Forbidden when creating a purchase."""
        self.client.force_authenticate(user=self.cashier)
        url = reverse('purchase-list')
        payload = {
            'supplier_id': self.supplier.id,
            'items': [{'product_id': self.ram.id, 'quantity': 5, 'unit_cost': 4000.00}]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_supplier_invoice_rejected(self):
        """Verify duplicate invoice number for the same supplier is rejected."""
        self.client.force_authenticate(user=self.admin)
        payload = {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'MI-DUP-1',
            'items': [{'product_id': self.ram.id, 'quantity': 1, 'unit_cost': 4000.00}]
        }
        res1 = self.client.post(reverse('purchase-list'), payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempt duplicate
        res2 = self.client.post(reverse('purchase-list'), payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_serial_product_purchase_validation_and_registration(self):
        """Verify serial product purchase registers AVAILABLE serials and rejects serial count mismatch or duplicate."""
        self.client.force_authenticate(user=self.admin)

        # 1. Quantity mismatch (Qty=3, Serials=2) -> Reject
        res_mismatch = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 3,
                'unit_cost': 43500.00,
                'serial_numbers_text': 'DL5450-A1, DL5450-A2'
            }]
        }, format='json')
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Duplicate serial in batch -> Reject
        res_dup_batch = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 3,
                'unit_cost': 43500.00,
                'serial_numbers_text': 'DL5450-A1, DL5450-A2, DL5450-A1'
            }]
        }, format='json')
        self.assertEqual(res_dup_batch.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Valid purchase Qty=3 with 3 unique serials -> Success
        res_success = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'MI-SERIAL-1',
            'items': [{
                'product_id': self.laptop.id,
                'quantity': 3,
                'unit_cost': 43500.00,
                'serial_numbers_text': 'DL5450-A1, DL5450-A2, DL5450-A3'
            }]
        }, format='json')
        self.assertEqual(res_success.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.laptop.get_current_stock(), 3)

        # Check serials status
        serials = SerialNumber.objects.filter(product=self.laptop)
        self.assertEqual(serials.count(), 3)
        self.assertTrue(all(s.status == 'AVAILABLE' for s in serials))

    def test_overpayment_and_negative_payment_rejected(self):
        """Verify paid amount > grand total or < 0 is rejected."""
        self.client.force_authenticate(user=self.admin)

        # Overpayment
        res_over = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'paid_amount': 100000.00,  # Grand total: 4720
            'items': [{'product_id': self.ram.id, 'quantity': 1, 'unit_cost': 4000.00, 'gst_rate': 18.00}]
        }, format='json')
        self.assertEqual(res_over.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative payment
        res_neg = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'paid_amount': -500.00,
            'items': [{'product_id': self.ram.id, 'quantity': 1, 'unit_cost': 4000.00}]
        }, format='json')
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_product_and_supplier_rejected(self):
        """Verify purchasing inactive product or using inactive supplier is rejected."""
        self.client.force_authenticate(user=self.admin)

        # Inactive product
        res_in_prod = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'items': [{'product_id': self.inactive_product.id, 'quantity': 1, 'unit_cost': 100.00}]
        }, format='json')
        self.assertEqual(res_in_prod.status_code, status.HTTP_400_BAD_REQUEST)

        # Inactive supplier
        res_in_supp = self.client.post(reverse('purchase-list'), {
            'supplier_id': self.inactive_supplier.id,
            'items': [{'product_id': self.ram.id, 'quantity': 1, 'unit_cost': 4000.00}]
        }, format='json')
        self.assertEqual(res_in_supp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supplier_balance_summary(self):
        """Verify supplier total_purchased, total_paid, and balance_outstanding."""
        self.client.force_authenticate(user=self.admin)
        
        # Create partial payment purchase: Total 4720 (4000 + 18% GST), Paid 2000, Balance 2720
        self.client.post(reverse('purchase-list'), {
            'supplier_id': self.supplier.id,
            'paid_amount': 2000.00,
            'items': [{'product_id': self.ram.id, 'quantity': 1, 'unit_cost': 4000.00, 'gst_rate': 18.00}]
        }, format='json')

        res = self.client.get(reverse('supplier-detail', kwargs={'pk': self.supplier.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data['total_purchased'])), Decimal('4720.00'))
        self.assertEqual(Decimal(str(res.data['total_paid'])), Decimal('2000.00'))
        self.assertEqual(Decimal(str(res.data['balance_outstanding'])), Decimal('2720.00'))

    def test_admin_stock_adjustment_endpoint(self):
        """Verify POST /api/products/{id}/adjust_stock/ adjusts stock cleanly for Admin."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('product-adjust-stock', kwargs={'pk': self.ram.id})
        
        res = self.client.post(url, {
            'new_stock_quantity': 15,
            'reason': 'Physical stock audit adjustment'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.ram.get_current_stock(), 15)

        # Check movement ledger entry
        movement = StockMovement.objects.filter(product=self.ram, movement_type='ADJUSTMENT_IN').first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, 15)
        self.assertEqual(movement.notes, 'Physical stock audit adjustment')


class Phase8ReturnAndSupplierPaymentTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.cashier = User.objects.create_user(username='cashier', password='cashierpassword123')
        
        self.profile = BusinessProfile.objects.get_or_create(id=1, defaults={'company_name': 'OCTANE SYSTEMS', 'state_code': '29'})[0]
        self.customer = Customer.objects.create(name="Return Customer", state_code="29")
        self.supplier = Supplier.objects.create(name="Return Supplier", gstin="29MI42851234F1Z")
        self.category = ProductCategory.objects.create(name="Hardware")
        
        # Products
        self.ram = Product.objects.create(
            name="8GB RAM", sku="RAM-8GB", category=self.category,
            purchase_price=1500.00, selling_price=2000.00, is_stock_enabled=True, tracking_type='QUANTITY'
        )
        StockService.process_stock_in(self.ram, 10, 'OPENING', 'OPENING_STOCK', user=self.admin)

        self.laptop = Product.objects.create(
            name="Dell Latitude 5450", sku="LAP-DELL-5450", category=self.category,
            purchase_price=40000.00, selling_price=50000.00, is_stock_enabled=True, tracking_type='SERIAL_NUMBER'
        )
        StockService.process_stock_in(self.laptop, 2, 'OPENING', 'OPENING_STOCK', serial_numbers_list=['SN001', 'SN002'], user=self.admin)

    def test_sales_return_quantity_and_serial_products(self):
        """Test sales return for quantity and serial products."""
        self.client.force_authenticate(user=self.admin)
        
        # 1. Post POS Sale
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'items': [
                {'item_type': 'PRODUCT', 'product_id': self.ram.id, 'qty': 3, 'rate': 2000.00, 'gst_rate': 18.00},
                {'item_type': 'PRODUCT', 'product_id': self.laptop.id, 'qty': 1, 'serial_number': 'SN001', 'rate': 50000.00, 'gst_rate': 18.00}
            ]
        })
        
        ram_item = invoice.items.get(product=self.ram)
        laptop_item = invoice.items.get(product=self.laptop)

        self.assertEqual(self.ram.get_current_stock(), 7)  # 10 - 3
        self.assertEqual(self.laptop.get_current_stock(), 1)  # 2 - 1

        # 2. Process Sales Return for 1 RAM and 1 Laptop (SN001)
        res_ret = self.client.post(reverse('process_sales_return', kwargs={'invoice_id': invoice.id}), {
            'items': [
                {'invoice_item_id': ram_item.id, 'quantity': 1, 'reason': 'Customer changed mind'},
                {'invoice_item_id': laptop_item.id, 'quantity': 1, 'serial_number': 'SN001', 'reason': 'Defective display'}
            ]
        }, format='json')
        self.assertEqual(res_ret.status_code, status.HTTP_200_OK)

        # 3. Verify stock increased
        self.assertEqual(self.ram.get_current_stock(), 8)
        self.assertEqual(self.laptop.get_current_stock(), 2)

        # 4. Verify serial status updated to RETURNED
        sn001 = SerialNumber.objects.get(product=self.laptop, serial_number='SN001')
        self.assertEqual(sn001.status, 'RETURNED')

    def test_sales_return_validations(self):
        """Verify return quantity limits and duplicate/invalid serial returns are rejected."""
        self.client.force_authenticate(user=self.admin)
        
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': self.ram.id, 'qty': 2, 'rate': 2000.00}]
        })
        ram_item = invoice.items.first()

        # Reject return quantity > sold quantity
        res = self.client.post(reverse('process_sales_return', kwargs={'invoice_id': invoice.id}), {
            'items': [{'invoice_item_id': ram_item.id, 'quantity': 5}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_purchase_return_and_supplier_payable(self):
        """Test purchase return reduces stock and supplier payable balance."""
        self.client.force_authenticate(user=self.admin)

        # 1. Post Purchase for 5 RAMs @ 1500 + 18% GST (Total 8850, Paid 3000, Outstanding 5850)
        purchase = PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'SUP-INV-101',
            'paid_amount': 3000.00,
            'payment_mode': 'CASH',
            'items': [{'product_id': self.ram.id, 'quantity': 5, 'unit_cost': 1500.00, 'gst_rate': 18.00}]
        })
        self.assertEqual(self.ram.get_current_stock(), 15)  # 10 + 5

        pur_item = purchase.items.first()

        # 2. Return 2 RAMs to supplier
        res_ret = self.client.post(reverse('process_purchase_return', kwargs={'purchase_id': purchase.id}), {
            'items': [{'purchase_item_id': pur_item.id, 'quantity': 2, 'reason': 'Excess shipment'}]
        }, format='json')
        self.assertEqual(res_ret.status_code, status.HTTP_200_OK)

        # 3. Stock should decrease by 2
        self.assertEqual(self.ram.get_current_stock(), 13)

        # 4. Verify purchase total amount reduced
        purchase.refresh_from_db()
        # 2 units * (1500 + 270 tax) = 3540 return value. Total amount 8850 - 3540 = 5310
        self.assertEqual(purchase.total_amount, Decimal('5310.00'))

    def test_supplier_payment_workflow(self):
        """Test recording delayed supplier payment updates purchase paid_amount and payment_status."""
        self.client.force_authenticate(user=self.admin)

        # 1. Purchase total 8850, Paid 3000, Outstanding 5850, Status PARTIALLY_PAID
        purchase = PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'SUP-INV-102',
            'paid_amount': 3000.00,
            'items': [{'product_id': self.ram.id, 'quantity': 5, 'unit_cost': 1500.00, 'gst_rate': 18.00}]
        })
        self.assertEqual(purchase.payment_status, 'PARTIALLY_PAID')

        # 2. Record delayed supplier payment of 5850
        res_pay = self.client.post(reverse('record_supplier_payment', kwargs={'purchase_id': purchase.id}), {
            'amount': 5850.00,
            'payment_mode': 'BANK_TRANSFER',
            'reference_number': 'TXN998877',
            'notes': 'Bank transfer settlement'
        }, format='json')
        self.assertEqual(res_pay.status_code, status.HTTP_201_CREATED)

        purchase.refresh_from_db()
        self.assertEqual(purchase.paid_amount, Decimal('8850.00'))
        self.assertEqual(purchase.payment_status, 'PAID')

        # 3. Reject overpayment
        res_over = self.client.post(reverse('record_supplier_payment', kwargs={'purchase_id': purchase.id}), {
            'amount': 100.00
        }, format='json')
        self.assertEqual(res_over.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rbac_cashier_forbidden_on_admin_operations(self):
        """Verify cashier is forbidden (403) on returns and supplier payment endpoints."""
        self.client.force_authenticate(user=self.cashier)

        # Sales return forbidden
        res_sr = self.client.post(reverse('process_sales_return', kwargs={'invoice_id': 1}), {'items': []})
        self.assertEqual(res_sr.status_code, status.HTTP_403_FORBIDDEN)

        # Purchase return forbidden
        res_pr = self.client.post(reverse('process_purchase_return', kwargs={'purchase_id': 1}), {'items': []})
        self.assertEqual(res_pr.status_code, status.HTTP_403_FORBIDDEN)

        # Supplier payment forbidden
        res_sp = self.client.post(reverse('record_supplier_payment', kwargs={'purchase_id': 1}), {'amount': 100.00})
        self.assertEqual(res_sp.status_code, status.HTTP_403_FORBIDDEN)


class Phase8InvoiceHistoryAndReceivablesTests(APITestCase):
    """
    Phase 8 Test Suite: Invoice History, Delayed Customer Payments, Receivables, Returns & RBAC.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser('admin8', 'admin8@octane.com', 'adminpass')
        self.cashier = User.objects.create_user('cashier8', 'cashier8@octane.com', 'cashierpass')
        
        self.client.force_authenticate(user=self.admin)

        self.profile = BusinessProfile.objects.create(
            company_name='Octane Systems Phase 8',
            gstin='29DRTPA7275L1ZW',
            state_code='29',
            invoice_prefix='INV-P8-',
            next_invoice_number=100
        )

        self.customer = Customer.objects.create(
            name='Phase 8 Client',
            mobile='9988776655',
            customer_type='BUSINESS',
            gstin='29AAAAA1111A1Z5',
            state_code='29'
        )

        self.category = ProductCategory.objects.create(name='Hardware')
        self.ram = Product.objects.create(
            category=self.category,
            name='DDR4 RAM 16GB P8',
            sku='RAM-P8-16',
            purchase_price=Decimal('2000.00'),
            selling_price=Decimal('3000.00'),
            hsn_sac='854231'
        )
        StockService.process_stock_in(self.ram, 20, 'OPENING', 'OPENING_STOCK', user=self.admin)

        self.service = Service.objects.create(
            service_name='System Optimization P8',
            sac='998313',
            default_rate=Decimal('1000.00'),
            is_active=True
        )

    def test_fully_paid_invoice(self):
        """Verify fully paid invoice sets status to PAID and zero balance due."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': self.ram.id, 'qty': 1, 'rate': 3000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 3540.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('3540.00'))
        self.assertEqual(invoice.total_paid_amount, Decimal('3540.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('0.00'))
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_unpaid_invoice(self):
        """Verify unpaid invoice sets status to UNPAID and leaves balance_due equal to grand_total."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 2, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': []
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('2360.00'))
        self.assertEqual(invoice.total_paid_amount, Decimal('0.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('2360.00'))
        self.assertEqual(invoice.payment_status, 'UNPAID')

    def test_partially_paid_invoice(self):
        """Verify partially paid invoice sets status to PARTIALLY_PAID."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': self.ram.id, 'qty': 2, 'rate': 3000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'UPI', 'amount': 2000.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('7080.00'))
        self.assertEqual(invoice.total_paid_amount, Decimal('2000.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('5080.00'))
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')

    def test_later_customer_payment(self):
        """Verify recording later customer payment via endpoint updates total_paid and balance_due."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 500.00}]  # Total 1180, Paid 500, Due 680
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        
        # Record later payment of 400
        url = reverse('record_delayed_payment', kwargs={'invoice_id': invoice.id})
        res = self.client.post(url, {
            'amount': 400.00,
            'payment_mode': 'UPI',
            'reference_number': 'UPI12345',
            'notes': 'Partial clear'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.total_paid_amount, Decimal('900.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('280.00'))
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')

    def test_payment_exceeding_balance(self):
        """Verify recording payment exceeding remaining balance due raises validation error."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 1000.00}]  # Total 1180, Due 180
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)

        url = reverse('record_delayed_payment', kwargs={'invoice_id': invoice.id})
        res = self.client.post(url, {'amount': 500.00}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_multiple_later_payments_reaching_zero(self):
        """Verify multiple later payments progressively clear balance due until zero."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 2, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': []  # Total 2360, Due 2360
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.payment_status, 'UNPAID')

        # Payment 1: 1000
        url = reverse('record_delayed_payment', kwargs={'invoice_id': invoice.id})
        self.client.post(url, {'amount': 1000.00, 'payment_mode': 'CASH'}, format='json')
        invoice.refresh_from_db()
        self.assertEqual(invoice.balance_due_amount, Decimal('1360.00'))
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')

        # Payment 2: 1360 (Clears full balance)
        self.client.post(url, {'amount': 1360.00, 'payment_mode': 'BANK_TRANSFER'}, format='json')
        invoice.refresh_from_db()
        self.assertEqual(invoice.total_paid_amount, Decimal('2360.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('0.00'))
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_product_return_restores_inventory(self):
        """Verify returning a product line item restores stock and creates StockMovement(SALES_RETURN)."""
        initial_stock = self.ram.get_current_stock()
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'PRODUCT', 'product_id': self.ram.id, 'qty': 5, 'rate': 3000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 17700.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(self.ram.get_current_stock(), initial_stock - 5)

        # Return 2 units of RAM
        item_obj = invoice.items.first()
        res_return = InvoiceService.process_sales_return(self.admin, invoice.id, {
            'items': [{'invoice_item_id': item_obj.id, 'quantity': 2, 'reason': 'Customer returned 2 units'}]
        })
        self.assertIsNotNone(res_return)
        self.assertEqual(self.ram.get_current_stock(), initial_stock - 3)

    def test_service_cancellation_no_inventory_movement(self):
        """Verify returning/cancelling a service line item creates zero stock movements."""
        movements_before = StockMovement.objects.count()
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 2, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 2360.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        
        item_obj = invoice.items.first()
        InvoiceService.process_sales_return(self.admin, invoice.id, {
            'items': [{'invoice_item_id': item_obj.id, 'quantity': 1, 'reason': 'Service cancelled'}]
        })
        movements_after = StockMovement.objects.count()
        self.assertEqual(movements_after, movements_before)

    def test_customer_receivables_summary_api(self):
        """Verify GET /api/finance/customer-receivables/ returns aggregated dues summary."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 2000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 1000.00}]  # Total 2360, Paid 1000, Due 1360
        }
        InvoiceService.create_and_post_invoice(self.admin, payload)

        url = reverse('customer_receivables_summary')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_receivable', res.data)
        self.assertGreaterEqual(res.data['total_receivable'], 1360.00)


class Phase9PaymentStatusConsistencyTests(APITestCase):
    """
    Test suite verifying Single Source of Truth for Invoice payment status and financial calculations:
    - grand_total
    - amount_paid = sum of actual successful payments (CREDIT excluded)
    - balance_due = grand_total - amount_paid
    - payment_status: UNPAID (0 paid), PARTIALLY_PAID (0 < paid < grand_total), PAID (paid >= grand_total)
    """
    def setUp(self):
        self.admin = User.objects.create_superuser('admin_p9', 'admin9@octane.com', 'adminpass')
        self.client.force_authenticate(user=self.admin)
        
        self.profile = BusinessProfile.objects.get_or_create(id=1, defaults={'company_name': 'OCTANE SYSTEMS', 'state_code': '29'})[0]
        self.customer = Customer.objects.create(name="Matrix Customer", state_code="29")
        self.service = Service.objects.create(service_name="RAM & SSD Labor", sac="998313", default_rate=Decimal('799.00'), is_active=True)

    def test_unpaid_invoice_with_zero_payment(self):
        """₹942.82 invoice with no payment: Paid ₹0 / Due ₹942.82 / UNPAID."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 799.00, 'gst_rate': 18.00}],
            'payments': []  # Taxable 799, GST 143.82 -> Grand total 942.82
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('942.82'))
        self.assertEqual(invoice.total_paid_amount, Decimal('0.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('942.82'))
        self.assertEqual(invoice.payment_status, 'UNPAID')

        # Check API endpoint representation
        url = reverse('invoice-detail', kwargs={'pk': invoice.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(res.data['total_paid_amount'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(res.data['balance_due_amount'])), Decimal('942.82'))
        self.assertEqual(res.data['payment_status'], 'UNPAID')

    def test_partially_paid_invoice(self):
        """₹942.82 invoice with ₹400 payment: Paid ₹400 / Due ₹542.82 / PARTIALLY_PAID."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 799.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 400.00}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('942.82'))
        self.assertEqual(invoice.total_paid_amount, Decimal('400.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('542.82'))
        self.assertEqual(invoice.payment_status, 'PARTIALLY_PAID')

    def test_fully_paid_invoice(self):
        """₹942.82 invoice with ₹942.82 payment: Paid ₹942.82 / Due ₹0 / PAID."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 799.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'UPI', 'amount': 942.82}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('942.82'))
        self.assertEqual(invoice.total_paid_amount, Decimal('942.82'))
        self.assertEqual(invoice.balance_due_amount, Decimal('0.00'))
        self.assertEqual(invoice.payment_status, 'PAID')

    def test_credit_is_not_counted_as_actual_payment(self):
        """CREDIT payment mode must NOT be stored or counted as actual payment."""
        payload = {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 799.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CREDIT', 'amount': 942.82}]
        }
        invoice = InvoiceService.create_and_post_invoice(self.admin, payload)
        self.assertEqual(invoice.grand_total, Decimal('942.82'))
        self.assertEqual(invoice.total_paid_amount, Decimal('0.00'))
        self.assertEqual(invoice.balance_due_amount, Decimal('942.82'))
        self.assertEqual(invoice.payment_status, 'UNPAID')
        self.assertEqual(invoice.payments.count(), 0)

    def test_split_payment_with_partner_allocation(self):
        """Recording split payment across Cash and Partner UPI allocation."""
        partner = Partner.objects.create(name="Ramesh", ownership_percentage=50.0)
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': self.service.id, 'qty': 1, 'rate': 799.00, 'gst_rate': 18.00}],
            'payments': []
        })
        self.assertEqual(invoice.payment_status, 'UNPAID')

        url = reverse('record_delayed_payment', kwargs={'invoice_id': invoice.id})
        res = self.client.post(url, {
            'payments': [
                {'payer': 'BUSINESS', 'payment_mode': 'CASH', 'amount': 400.00},
                {'payer': str(partner.id), 'payment_mode': 'UPI', 'amount': 542.82, 'reference_number': 'UPI-98427'}
            ]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.total_paid_amount, Decimal('942.82'))
        self.assertEqual(invoice.balance_due_amount, Decimal('0.00'))
        self.assertEqual(invoice.payment_status, 'PAID')
        self.assertEqual(invoice.payments.count(), 2)

        # Check partner allocation JSON stored on the second payment
        p2 = invoice.payments.filter(payment_mode='UPI').first()
        self.assertIsNotNone(p2.partner_allocation_json)
        self.assertEqual(p2.partner_allocation_json['partner_name'], 'Ramesh')


class Phase10FinanceModuleTests(APITestCase):
    """
    Test suite for OCTANE ERP Phase 10: Finance Module:
    - Business expense vs Partner-paid expense
    - Partner-funded purchase & partner ledger linkage
    - Supplier payment & Customer payment
    - Partner ledger running balance
    - Payments log & CREDIT exclusion
    - Financial summary consistency
    """
    def setUp(self):
        self.admin = User.objects.create_superuser('admin_p10', 'admin10@octane.com', 'adminpass')
        self.cashier = User.objects.create_user('cashier_p10', 'cashier10@octane.com', 'cashierpass')
        self.client.force_authenticate(user=self.admin)

        self.profile = BusinessProfile.objects.get_or_create(id=1, defaults={'company_name': 'OCTANE SYSTEMS', 'state_code': '29'})[0]
        self.category = ExpenseCategory.objects.create(name="Office Utilities")
        self.partner = Partner.objects.create(name="Suresh Kumar", ownership_percentage=50.0)
        self.supplier = Supplier.objects.create(name="Apex Tech Vendors", mobile="9988776655")
        self.customer = Customer.objects.create(name="Acme Corp", mobile="9123456789")

    def test_business_expense_creation_does_not_create_partner_liability(self):
        """Business-paid expense records operating expense without affecting partner ledger."""
        expense = Expense.objects.create(
            expense_number="EXP-10001",
            category=self.category,
            amount=Decimal('1500.00'),
            expense_date='2026-09-25',
            payment_mode='CASH',
            description='Office Electricity Bill',
            created_by=self.admin
        )
        self.assertEqual(expense.amount, Decimal('1500.00'))
        self.assertIsNone(expense.paid_by_partner)

        # Check partner balance remains 0
        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner.id)
        self.assertEqual(summary['net_capital_balance'], Decimal('0.00'))

    def test_partner_paid_expense_links_to_partner_ledger(self):
        """Partner-paid expense increases partner capital balance (liability to partner)."""
        expense = Expense.objects.create(
            expense_number="EXP-10002",
            category=self.category,
            amount=Decimal('2500.00'),
            expense_date='2026-09-25',
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=self.partner,
            description='Server Hosting Paid Out of Pocket',
            created_by=self.admin
        )
        self.assertEqual(expense.paid_by_partner_id, self.partner.id)

        # Partner ledger must reflect ₹2500 credit contribution
        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner.id)
        self.assertEqual(summary['net_capital_balance'], Decimal('2500.00'))

    def test_partner_funded_purchase_linkage(self):
        """Supplier purchase funded by partner increases partner capital ledger."""
        purchase = Purchase.objects.create(
            purchase_number="PUR-10001",
            supplier=self.supplier,
            purchase_date='2026-09-25',
            total_amount=Decimal('11800.00'),
            paid_amount=Decimal('11800.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=self.partner,
            payment_status='PAID'
        )
        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner.id)
        self.assertEqual(summary['purchases_funded'], Decimal('11800.00'))
        self.assertEqual(summary['net_capital_balance'], Decimal('11800.00'))

    def test_supplier_payment_flow(self):
        """Recording supplier payment updates payable balance and registers in payments log."""
        purchase = Purchase.objects.create(
            purchase_number="PUR-10002",
            supplier=self.supplier,
            purchase_date='2026-09-25',
            total_amount=Decimal('5900.00'),
            paid_amount=Decimal('0.00'),
            payment_mode='CREDIT',
            payment_status='UNPAID'
        )
        # Pay supplier ₹3000
        payment = SupplierPayment.objects.create(
            purchase=purchase,
            supplier=self.supplier,
            amount=Decimal('3000.00'),
            payment_mode='BANK_TRANSFER',
            payment_date='2026-09-25'
        )
        self.assertEqual(payment.amount, Decimal('3000.00'))

        # Query unified payments API endpoint
        url = reverse('financial_all_payments')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        records = res.data if isinstance(res.data, list) else res.data.get('results', [])
        supplier_pay = next((r for r in records if r['transaction_type'] == 'Purchase Payment'), None)
        self.assertIsNotNone(supplier_pay)
        self.assertEqual(supplier_pay['amount'], 3000.0)
        self.assertEqual(supplier_pay['direction'], 'OUT')

    def test_customer_payment_flow(self):
        """Customer payment on invoice is logged as INFLOW in payments log."""
        service = Service.objects.create(service_name="Consulting", sac="998314", default_rate=Decimal('1000.00'), is_active=True)
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'items': [{'item_type': 'SERVICE', 'service_id': service.id, 'qty': 1, 'rate': 1000.00, 'gst_rate': 18.00}],
            'payments': [{'payment_mode': 'CASH', 'amount': 1180.00}]
        })

        url = reverse('financial_all_payments')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        records = res.data if isinstance(res.data, list) else res.data.get('results', [])
        cust_pay = next((r for r in records if r['transaction_type'] == 'Customer Payment'), None)
        self.assertIsNotNone(cust_pay)
        self.assertEqual(cust_pay['amount'], 1180.0)
        self.assertEqual(cust_pay['direction'], 'IN')

    def test_credit_exclusion_from_monetary_payments(self):
        """CREDIT transactions must NEVER appear in the monetary payments log."""
        # Record a partner-funded purchase (CREDIT to partner balance, non-monetary payout by business)
        Purchase.objects.create(
            purchase_number="PUR-10003",
            supplier=self.supplier,
            purchase_date='2026-09-25',
            total_amount=Decimal('2360.00'),
            paid_amount=Decimal('2360.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=self.partner,
            payment_status='PAID'
        )

        url = reverse('financial_all_payments')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        records = res.data if isinstance(res.data, list) else res.data.get('results', [])
        for r in records:
            self.assertNotEqual(r['payment_mode'], 'CREDIT')

    def test_financial_summary_consistency(self):
        """Dashboard summary API returns consistent metrics from single source of truth."""
        url = reverse('report_dashboard')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_income', res.data)
        self.assertIn('total_expenses', res.data)
        self.assertIn('customer_receivables', res.data)
        self.assertIn('supplier_payables', res.data)
        self.assertIn('net_cash_movement', res.data)

    def test_cashier_rbac_restriction_on_partner_ledger(self):
        """Cashier must be restricted from accessing partner ledger endpoint."""
        self.client.force_authenticate(user=self.cashier)
        url = reverse('partner_ledger_summary_single', kwargs={'partner_id': self.partner.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)











# ==========================================
# PHASE 11: REPORTS MODULE TESTS
# ==========================================

class Phase11ReportsModuleTests(APITestCase):
    """
    Tests for Phase 11 Reports: Sales, Purchase, Inventory, GST, P&L.
    Verifies data accuracy, date filtering, and that reports are read-only (no data mutation).
    """

    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin11', password='adminpass123')
        self.cashier = User.objects.create_user(username='cashier11', password='cashierpass123', is_staff=False)
        self.client.force_authenticate(user=self.admin)

        BusinessProfile.objects.get_or_create(id=1, defaults={'company_name': 'OCTANE SYSTEMS', 'state_code': '29'})

        self.supplier = Supplier.objects.create(name='Test Supplier', state_code='29')
        self.customer = Customer.objects.create(name='Test Customer', state_code='29')
        self.category = ProductCategory.objects.create(name='Test Category')

        self.product = Product.objects.create(
            name='Test Laptop',
            sku='TEST-LAP-001',
            category=self.category,
            purchase_price=40000.00,
            selling_price=55000.00,
            is_stock_enabled=True,
            tracking_type='QUANTITY',
            gst_rate=18.00,
        )

        # Seed opening stock
        from core.services.stock_service import StockService
        StockService.process_stock_in(self.product, 20, 'OPENING', 'OPENING_STOCK', user=self.admin)

        # Create a purchase
        self.purchase = Purchase.objects.create(
            purchase_number='PUR-TEST-001',
            supplier=self.supplier,
            purchase_date='2026-09-01',
            total_amount=47200.00,
            tax_amount=7200.00,
            paid_amount=47200.00,
            payment_mode='CASH',
            payment_status='PAID',
        )
        self.purchase_item = PurchaseItem.objects.create(
            purchase=self.purchase,
            product=self.product,
            quantity=1,
            unit_cost=40000.00,
            gst_rate=18.00,
            total_amount=47200.00,
        )
        # Record stock in for purchase
        StockService.process_stock_in(self.product, 1, 'PURCHASE', str(self.purchase.purchase_number), user=self.admin)

        # Create a posted invoice using the correct InvoiceService method
        from core.services.invoice_service import InvoiceService
        self.invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'invoice_date': '2026-09-10',
            'customer_id': self.customer.id,
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.product.id,
                'description': 'Test Laptop Sale',
                'hsn_sac': '852411',
                'qty': 1,
                'rate': 55000.00,
                'discount': 0,
                'gst_rate': 18.00,
            }],
            'payments': [{'payment_mode': 'CASH', 'amount': 64900.00}],
        })

        # Create expense
        exp_cat = ExpenseCategory.objects.create(name='Test Expenses')
        self.expense = Expense.objects.create(
            expense_number='EXP-TEST-001',
            category=exp_cat,
            expense_date='2026-09-15',
            amount=5000.00,
            payment_mode='CASH',
            description='Test operating expense',
        )

    # --- Sales Report Tests ---

    def test_sales_report_basic(self):
        """Sales report returns rows with correct summary totals."""
        url = reverse('report_sales')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('rows', res.data)
        self.assertIn('summary', res.data)
        self.assertGreaterEqual(len(res.data['rows']), 1)

    def test_sales_report_summary_totals_match_rows(self):
        """Summary totals equal the sum of row values."""
        url = reverse('report_sales')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        rows = res.data['rows']
        total_from_rows = sum(r['grand_total'] for r in rows)
        self.assertAlmostEqual(float(res.data['summary']['total_grand_total']), total_from_rows, places=2)

    def test_sales_report_date_filter_excludes_out_of_range(self):
        """Date filter should exclude invoices outside range."""
        url = reverse('report_sales')
        res = self.client.get(url, {'start_date': '2026-08-01', 'end_date': '2026-08-31'})
        self.assertEqual(res.status_code, 200)
        # Invoice created on 2026-09-10 should not be in August range
        self.assertEqual(len(res.data['rows']), 0)

    def test_sales_report_payment_status_filter(self):
        """Paid status filter returns only paid invoices."""
        url = reverse('report_sales')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30', 'payment_status': 'PAID'})
        self.assertEqual(res.status_code, 200)
        for row in res.data['rows']:
            self.assertEqual(row['payment_status'], 'PAID')

    def test_sales_report_no_data_mutation(self):
        """Fetching sales report does not change any invoice data."""
        url = reverse('report_sales')
        invoice_count_before = Invoice.objects.count()
        self.client.get(url)
        self.assertEqual(Invoice.objects.count(), invoice_count_before)

    def test_sales_report_cashier_access_denied(self):
        """Cashier should be denied access to sales report."""
        self.client.force_authenticate(user=self.cashier)
        url = reverse('report_sales')
        res = self.client.get(url)
        self.assertEqual(res.status_code, 403)

    # --- Purchase Report Tests ---

    def test_purchase_report_basic(self):
        """Purchase report returns rows with correct structure."""
        url = reverse('report_purchases')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('rows', res.data)
        self.assertIn('summary', res.data)

    def test_purchase_report_totals_match(self):
        """Summary total_amount equals sum of row total_amounts."""
        url = reverse('report_purchases')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        rows = res.data['rows']
        total_from_rows = sum(r['total_amount'] for r in rows)
        self.assertAlmostEqual(float(res.data['summary']['total_amount']), total_from_rows, places=2)

    def test_purchase_report_date_filter(self):
        """Purchase date filter excludes out-of-range purchases."""
        url = reverse('report_purchases')
        res = self.client.get(url, {'start_date': '2026-10-01', 'end_date': '2026-10-31'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['rows']), 0)

    def test_purchase_report_supplier_filter(self):
        """Supplier filter returns only that supplier's purchases."""
        url = reverse('report_purchases')
        res = self.client.get(url, {'supplier_id': self.supplier.id})
        self.assertEqual(res.status_code, 200)
        for row in res.data['rows']:
            self.assertEqual(row['supplier_id'], self.supplier.id)

    def test_purchase_report_no_data_mutation(self):
        """Fetching purchase report does not change any purchase data."""
        url = reverse('report_purchases')
        purchase_count_before = Purchase.objects.count()
        self.client.get(url)
        self.assertEqual(Purchase.objects.count(), purchase_count_before)

    # --- Inventory Report Tests ---

    def test_inventory_report_basic(self):
        """Inventory report returns products with stock summaries."""
        url = reverse('report_inventory')
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('rows', res.data)
        self.assertIn('total_stock_value', res.data)
        self.assertGreaterEqual(len(res.data['rows']), 1)

    def test_inventory_report_row_fields(self):
        """Inventory report rows have required fields."""
        url = reverse('report_inventory')
        res = self.client.get(url)
        row = res.data['rows'][0]
        required_fields = ['product_id', 'product_name', 'opening_stock', 'purchases',
                           'sales', 'closing_stock', 'stock_value']
        for f in required_fields:
            self.assertIn(f, row)

    def test_inventory_report_stock_math(self):
        """Closing stock = opening + purchases - sales + adjustments."""
        url = reverse('report_inventory')
        res = self.client.get(url)
        # Find our product row
        row = next((r for r in res.data['rows'] if r['product_id'] == self.product.id), None)
        self.assertIsNotNone(row)
        expected_closing = (row['opening_stock'] + row['purchases'] + row['sales_returns'] +
                            row['adj_in'] - row['sales'] - row['purchase_returns'] - row['adj_out'])
        self.assertEqual(row['closing_stock'], max(0, expected_closing))

    def test_inventory_report_category_filter(self):
        """Category filter returns only products from that category."""
        url = reverse('report_inventory')
        res = self.client.get(url, {'category_id': self.category.id})
        self.assertEqual(res.status_code, 200)
        for row in res.data['rows']:
            self.assertEqual(row['category'], self.category.name)

    def test_inventory_report_low_stock_only_flag(self):
        """low_stock_only flag returns only products at or below min_stock_alert."""
        url = reverse('report_inventory')
        res = self.client.get(url, {'low_stock_only': 'true'})
        self.assertEqual(res.status_code, 200)
        for row in res.data['rows']:
            self.assertTrue(row['is_low_stock'])

    def test_inventory_report_no_data_mutation(self):
        """Fetching inventory report does not change any product or stock data."""
        url = reverse('report_inventory')
        product_count_before = Product.objects.count()
        stock_count_before = StockMovement.objects.count()
        self.client.get(url)
        self.assertEqual(Product.objects.count(), product_count_before)
        self.assertEqual(StockMovement.objects.count(), stock_count_before)

    # --- GST Report Tests ---

    def test_gst_report_basic(self):
        """GST report returns output_gst, input_gst, net_gst, and hsn_summary."""
        url = reverse('report_gst')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('output_gst', res.data)
        self.assertIn('input_gst', res.data)
        self.assertIn('net_gst', res.data)
        self.assertIn('hsn_summary', res.data)

    def test_gst_report_net_equals_output_minus_input(self):
        """Net GST total_payable == output total_tax - input total_tax."""
        url = reverse('report_gst')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        expected_net = round(
            float(res.data['output_gst']['total_tax']) - float(res.data['input_gst']['total_tax']),
            2
        )
        self.assertAlmostEqual(float(res.data['net_gst']['total_payable']), expected_net, places=2)

    def test_gst_report_date_filter(self):
        """Date filter for GST report works correctly."""
        url = reverse('report_gst')
        res = self.client.get(url, {'start_date': '2026-10-01', 'end_date': '2026-10-31'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(float(res.data['output_gst']['total_tax']), 0.0)

    def test_gst_report_no_data_mutation(self):
        """Fetching GST report does not change any invoice or purchase data."""
        url = reverse('report_gst')
        inv_count_before = Invoice.objects.count()
        pur_count_before = Purchase.objects.count()
        self.client.get(url)
        self.assertEqual(Invoice.objects.count(), inv_count_before)
        self.assertEqual(Purchase.objects.count(), pur_count_before)

    # --- P&L Report Tests ---

    def test_pnl_report_basic(self):
        """P&L report returns gross_sales, cogs, gross_profit, operating_expenses, net_profit."""
        url = reverse('report_pnl')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, 200)
        required = ['gross_sales', 'cost_of_goods_sold', 'gross_profit', 'operating_expenses', 'net_profit']
        for f in required:
            self.assertIn(f, res.data)

    def test_pnl_report_net_profit_math(self):
        """net_profit = gross_profit - operating_expenses."""
        url = reverse('report_pnl')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        expected_net = round(float(res.data['gross_profit']) - float(res.data['operating_expenses']), 2)
        self.assertAlmostEqual(float(res.data['net_profit']), expected_net, places=2)

    def test_pnl_report_gross_profit_math(self):
        """gross_profit = sales_taxable_revenue - cost_of_goods_sold."""
        url = reverse('report_pnl')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        expected_gross = round(float(res.data['sales_taxable_revenue']) - float(res.data['cost_of_goods_sold']), 2)
        self.assertAlmostEqual(float(res.data['gross_profit']), expected_gross, places=2)

    def test_pnl_report_date_filter(self):
        """Date filter for P&L returns zero sales in empty range."""
        url = reverse('report_pnl')
        res = self.client.get(url, {'start_date': '2025-01-01', 'end_date': '2025-01-31'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(float(res.data['gross_sales']), 0.0)

    def test_pnl_report_no_data_mutation(self):
        """Fetching P&L report does not change any data."""
        url = reverse('report_pnl')
        inv_count_before = Invoice.objects.count()
        exp_count_before = Expense.objects.count()
        self.client.get(url)
        self.assertEqual(Invoice.objects.count(), inv_count_before)
        self.assertEqual(Expense.objects.count(), exp_count_before)


class FinanceModuleAuditTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='fin_admin', password='password123')
        self.cashier = User.objects.create_user(username='fin_cashier', password='password123', is_staff=False)
        self.profile = BusinessProfile.objects.create(
            company_name="OCTANE SYSTEMS", gstin="29DRTPA7275L1ZW", state_code="29"
        )
        self.partner_ramesh = Partner.objects.create(
            name="Ramesh", ownership_percentage=Decimal('50.00'), initial_capital=Decimal('50000.00')
        )
        self.partner_lokesh = Partner.objects.create(
            name="Lokesh", ownership_percentage=Decimal('50.00'), initial_capital=Decimal('50000.00')
        )
        self.category = ExpenseCategory.objects.create(name="Rent & Utilities", is_active=True)
        self.inactive_category = ExpenseCategory.objects.create(name="Old Discontinued", is_active=False)
        self.customer = Customer.objects.create(name="Test Customer", mobile="9876543210", state_code="29")
        self.supplier = Supplier.objects.create(name="Matrix Vendor", state_code="29")
        self.prod_cat = ProductCategory.objects.create(name="Hardware")
        self.product = Product.objects.create(
            name="Dell Latitude 7490", sku="DELL-7490", category=self.prod_cat,
            selling_price=Decimal('25000.00'), purchase_price=Decimal('20000.00')
        )

    # 1. Expense Category creation & validation
    def test_expense_category_create_success(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('expense-category-list'), {
            'name': 'Staff Salaries',
            'description': 'Monthly payroll'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Staff Salaries')

    def test_expense_category_duplicate_prevention(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('expense-category-list'), {
            'name': 'rent & utilities'  # Case-insensitive duplicate of 'Rent & Utilities'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expense_category_toggle_active(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('expense-category-detail', args=[self.category.id])
        res = self.client.patch(url, {'is_active': False})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.category.refresh_from_db()
        self.assertFalse(self.category.is_active)

    # 2. Expense creation
    def test_create_business_paid_expense(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('expense-list'), {
            'category_id': self.category.id,
            'amount': '1500.00',
            'payment_mode': 'CASH',
            'description': 'Office coffee and tea supplies'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        exp = Expense.objects.get(id=res.data['id'])
        self.assertEqual(exp.amount, Decimal('1500.00'))
        self.assertIsNone(exp.paid_by_partner)

    def test_expense_creation_rejects_inactive_category(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('expense-list'), {
            'category_id': self.inactive_category.id,
            'amount': '1500.00',
            'payment_mode': 'CASH',
            'description': 'Should fail with inactive category'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_partner_paid_expense(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('expense-list'), {
            'category_id': self.category.id,
            'amount': '3000.00',
            'payment_mode': 'PARTNER_OUT_OF_POCKET',
            'paid_by_partner_id': self.partner_ramesh.id,
            'description': 'Ramesh paid internet router bill'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner_ramesh.id)
        self.assertEqual(summary['expenses_funded'], Decimal('3000.00'))

    # 3. Partner Ledger calculations (drawings, settlements, purchases funded, opening balance)
    def test_partner_ledger_opening_balance_and_funding(self):
        self.client.force_authenticate(user=self.admin)
        # Create partner funded purchase
        Purchase.objects.create(
            purchase_number="PUR-TEST-001",
            supplier=self.supplier,
            purchase_date="2026-09-01",
            total_amount=Decimal('10000.00'),
            paid_amount=Decimal('10000.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=self.partner_ramesh,
            created_by=self.admin
        )
        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner_ramesh.id)
        self.assertEqual(summary['initial_capital'], Decimal('50000.00'))
        self.assertEqual(summary['purchases_funded'], Decimal('10000.00'))
        self.assertEqual(summary['net_capital_balance'], Decimal('60000.00'))

    def test_partner_drawing_and_settlement(self):
        self.client.force_authenticate(user=self.admin)
        # Record drawing for Ramesh
        res_drw = self.client.post(reverse('partner-drawing-list'), {
            'partner_id': self.partner_ramesh.id,
            'amount': '5000.00',
            'drawing_date': '2026-09-15',
            'payment_mode': 'CASH',
            'notes': 'Personal drawing'
        })
        self.assertEqual(res_drw.status_code, status.HTTP_201_CREATED)

        # Record settlement from Ramesh to Lokesh
        res_stl = self.client.post(reverse('partner-settlement-list'), {
            'from_partner_id': self.partner_ramesh.id,
            'to_partner_id': self.partner_lokesh.id,
            'amount': '2000.00',
            'settlement_date': '2026-09-16',
            'payment_mode': 'UPI',
            'notes': 'Inter-partner settlement'
        })
        self.assertEqual(res_stl.status_code, status.HTTP_201_CREATED)

        summary_ramesh = PartnerLedgerService.get_partner_ledger_summary(self.partner_ramesh.id)
        self.assertEqual(summary_ramesh['drawings'], Decimal('5000.00'))
        self.assertEqual(summary_ramesh['settlements_paid'], Decimal('2000.00'))
        # 50,000 opening - 5,000 drawing - 2,000 settlement = 43,000
        self.assertEqual(summary_ramesh['net_capital_balance'], Decimal('43000.00'))

        summary_lokesh = PartnerLedgerService.get_partner_ledger_summary(self.partner_lokesh.id)
        self.assertEqual(summary_lokesh['settlements_received'], Decimal('2000.00'))
        # 50,000 opening + 2,000 settlement = 52,000
        self.assertEqual(summary_lokesh['net_capital_balance'], Decimal('52000.00'))

    def test_partner_ledger_statement_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('partner_ledger_statement', args=[self.partner_ramesh.id])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('statement', res.data)
        self.assertIn('summary', res.data)
        # First entry is opening capital
        self.assertTrue(any(row['type'] == 'OPENING_CAPITAL' for row in res.data['statement']))

    # 4. Customer Receivables & Payment flows
    def test_customer_receivables_and_partial_payment(self):
        self.client.force_authenticate(user=self.admin)
        # Create an unpaid invoice for customer
        inv = Invoice.objects.create(
            invoice_number="INV-REC-001",
            invoice_date="2026-09-01",
            customer=self.customer,
            buyer_name=self.customer.name,
            subtotal=Decimal('10000.00'),
            taxable_amount=Decimal('10000.00'),
            grand_total=Decimal('10000.00'),
            total_paid_amount=Decimal('0.00'),
            balance_due_amount=Decimal('10000.00'),
            payment_status='UNPAID',
            invoice_status='POSTED',
            created_by=self.admin
        )

        # Check customer receivables summary
        res = self.client.get(reverse('customer_receivables_summary'))
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(float(res.data['total_receivable']), 10000.0)

        # Record partial payment of 4000
        pay_url = reverse('record_delayed_payment', args=[inv.id])
        res_pay = self.client.post(pay_url, {
            'amount': '4000.00',
            'payment_mode': 'UPI',
            'notes': 'Partial payment'
        })
        self.assertEqual(res_pay.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.total_paid_amount, Decimal('4000.00'))
        self.assertEqual(inv.balance_due_amount, Decimal('6000.00'))
        self.assertEqual(inv.payment_status, 'PARTIALLY_PAID')

        # Record remaining payment of 6000
        res_pay2 = self.client.post(pay_url, {
            'amount': '6000.00',
            'payment_mode': 'CASH',
            'notes': 'Full clearance'
        })
        self.assertEqual(res_pay2.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.total_paid_amount, Decimal('10000.00'))
        self.assertEqual(inv.balance_due_amount, Decimal('0.00'))
        self.assertEqual(inv.payment_status, 'PAID')

    # 5. CREDIT exclusion & Monetary Payments Log
    def test_monetary_payments_log_excludes_credit(self):
        self.client.force_authenticate(user=self.admin)
        # Create CASH payment
        Payment.objects.create(
            payment_number="PAY-CASH-001",
            customer=self.customer,
            payment_date="2026-09-10",
            payment_mode="CASH",
            amount=Decimal('2500.00'),
            created_by=self.admin
        )
        # Create Operating Expense
        Expense.objects.create(
            expense_number="EXP-STORE-001",
            category=self.category,
            expense_date="2026-09-11",
            amount=Decimal('1200.00'),
            payment_mode="UPI",
            description="Broadband bill",
            created_by=self.admin
        )
        url = reverse('financial_all_payments')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        txns = res.data

        # Verify CASH payment has transaction_type 'Customer Payment' and direction 'IN'
        cash_txn = next(t for t in txns if t['txn_number'] == 'PAY-CASH-001')
        self.assertEqual(cash_txn['direction'], 'IN')
        self.assertEqual(cash_txn['transaction_type'], 'Customer Payment')
        self.assertEqual(cash_txn['amount'], 2500.0)

        # Verify Expense has transaction_type 'Business Expense' and direction 'OUT'
        exp_txn = next(t for t in txns if t['txn_number'] == 'EXP-STORE-001')
        self.assertEqual(exp_txn['direction'], 'OUT')
        self.assertEqual(exp_txn['transaction_type'], 'Business Expense')
        self.assertEqual(exp_txn['amount'], 1200.0)

        # Ensure no CREDIT transaction exists in monetary log
        self.assertFalse(any(t['payment_mode'] == 'CREDIT' for t in txns))

    # 6. RBAC restrictions (Admin vs Cashier)
    def test_rbac_cashier_denied_sensitive_finance(self):
        self.client.force_authenticate(user=self.cashier)
        endpoints = [
            reverse('customer_receivables_summary'),
            reverse('partner_ledger_summary_all'),
            reverse('financial_all_payments'),
            reverse('expense-list'),
            reverse('expense-category-list'),
            reverse('partner-list'),
            reverse('partner-drawing-list'),
            reverse('partner-settlement-list'),
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(
                res.status_code, status.HTTP_403_FORBIDDEN,
                f"Cashier should be forbidden from accessing {ep}, got {res.status_code}"
            )

    # 7. Split purchase payment allocation across partners
    def test_partner_ledger_split_purchase_funded(self):
        self.client.force_authenticate(user=self.admin)
        partner_lokesh = Partner.objects.create(name="Lokesh Test", ownership_percentage=Decimal('50.00'), is_active=True)
        partner_ramesh = Partner.objects.create(name="Ramesh Test", ownership_percentage=Decimal('50.00'), is_active=True)

        purchase = Purchase.objects.create(
            purchase_number="PUR-TEST-SPLIT-01",
            purchase_date="2026-09-26",
            total_amount=Decimal('236000.00'),
            tax_amount=Decimal('36000.00'),
            paid_amount=Decimal('236000.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            partner_split_json={'Lokesh Test': 136000.00, 'Ramesh Test': 100000.00},
            payment_status='PAID',
            created_by=self.admin
        )

        sum_lokesh = PartnerLedgerService.get_partner_ledger_summary(partner_lokesh.id)
        sum_ramesh = PartnerLedgerService.get_partner_ledger_summary(partner_ramesh.id)

        self.assertEqual(sum_lokesh['purchases_funded'], Decimal('136000.00'))
        self.assertEqual(sum_ramesh['purchases_funded'], Decimal('100000.00'))

        stmt_lokesh = PartnerLedgerService.get_chronological_statement(partner_lokesh.id)
        stmt_ramesh = PartnerLedgerService.get_chronological_statement(partner_ramesh.id)

        l_entry = next(e for e in stmt_lokesh if e['reference'] == 'PUR-TEST-SPLIT-01')
        r_entry = next(e for e in stmt_ramesh if e['reference'] == 'PUR-TEST-SPLIT-01')

        self.assertEqual(l_entry['credit'], Decimal('136000.00'))
        self.assertEqual(r_entry['credit'], Decimal('100000.00'))
        self.assertIn('Split Funded', l_entry['description'])
        self.assertIn('Split Funded', r_entry['description'])

    # 8. Upfront and Delayed Supplier Payments
    def test_upfront_and_delayed_supplier_payments(self):
        self.client.force_authenticate(user=self.admin)
        from core.services.purchase_service import PurchaseService

        # Create purchase with upfront store payment of 6,000 out of 10,000
        purchase = PurchaseService.create_and_post_purchase(
            user=self.admin,
            payload={
                'supplier_id': self.supplier.id,
                'supplier_invoice_number': 'SUPP-INV-999',
                'purchase_date': '2026-09-20',
                'payment_mode': 'CASH',
                'paid_amount': Decimal('6000.00'),
                'items': [
                    {
                        'product_id': self.product.id,
                        'quantity': 10,
                        'unit_cost': Decimal('847.46'),
                        'gst_rate': Decimal('18.00'),
                    }
                ]
            }
        )

        # 1. Verify SupplierPayment was created for the upfront amount
        upfront_pmts = SupplierPayment.objects.filter(purchase=purchase)
        self.assertEqual(upfront_pmts.count(), 1)
        upfront_sp = upfront_pmts.first()
        self.assertEqual(upfront_sp.amount, Decimal('6000.00'))
        self.assertEqual(upfront_sp.payment_mode, 'CASH')

        # 2. Verify upfront payment appears in Payments Log
        url = reverse('financial_all_payments')
        res_log = self.client.get(url)
        self.assertEqual(res_log.status_code, 200)
        found_upfront = next((t for t in res_log.data if t['txn_number'] == upfront_sp.payment_number), None)
        self.assertIsNotNone(found_upfront)
        self.assertEqual(found_upfront['direction'], 'OUT')
        self.assertEqual(found_upfront['transaction_type'], 'Purchase Payment')
        self.assertEqual(found_upfront['amount'], 6000.0)

        # 3. Record delayed payment for remaining payable
        delayed_res = self.client.post(
            reverse('record_supplier_payment', args=[purchase.id]),
            {
                'amount': str(round(purchase.total_amount - purchase.paid_amount, 2)),
                'payment_mode': 'BANK_TRANSFER',
                'notes': 'Final settlement to supplier'
            }
        )
        self.assertEqual(delayed_res.status_code, status.HTTP_201_CREATED)
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')
        self.assertEqual(purchase.supplier_payments.count(), 2)

    # 9. Mixed Transactions & Executive Dashboard Financial Consistency
    def test_mixed_transactions_and_executive_dashboard_consistency(self):
        self.client.force_authenticate(user=self.admin)
        from core.services.purchase_service import PurchaseService
        from core.services.reports_service import ReportsService

        # Flow A: Customer Invoice & Payment (Inflow)
        inv = Invoice.objects.create(
            invoice_number="INV-AUDIT-001",
            invoice_date="2026-09-25",
            customer=self.customer,
            buyer_name=self.customer.name,
            subtotal=Decimal('20000.00'),
            taxable_amount=Decimal('20000.00'),
            grand_total=Decimal('20000.00'),
            total_paid_amount=Decimal('20000.00'),
            balance_due_amount=Decimal('0.00'),
            payment_status='PAID',
            invoice_status='POSTED',
            created_by=self.admin
        )
        Payment.objects.create(
            payment_number="PAY-AUDIT-CUST-01",
            invoice=inv,
            customer=self.customer,
            payment_date="2026-09-25",
            payment_mode="BANK_TRANSFER",
            amount=Decimal('20000.00'),
            created_by=self.admin
        )

        # Flow B: Business Expense (Store Outflow)
        Expense.objects.create(
            expense_number="EXP-AUDIT-BIZ-01",
            category=self.category,
            expense_date="2026-09-25",
            amount=Decimal('3000.00'),
            payment_mode="CASH",
            description="Office Electricity",
            created_by=self.admin
        )

        # Flow C: Partner-Paid Expense (No store cash outflow; Ramesh equity credited)
        Expense.objects.create(
            expense_number="EXP-AUDIT-RAMESH-01",
            category=self.category,
            expense_date="2026-09-25",
            amount=Decimal('2000.00'),
            payment_mode="PARTNER_OUT_OF_POCKET",
            paid_by_partner=self.partner_ramesh,
            description="Software license paid by Ramesh",
            created_by=self.admin
        )

        # Flow D: Partner-Funded Purchase (No store cash outflow; Lokesh equity credited)
        Purchase.objects.create(
            purchase_number="PUR-AUDIT-LOKESH-01",
            supplier=self.supplier,
            purchase_date="2026-09-25",
            total_amount=Decimal('5000.00'),
            paid_amount=Decimal('5000.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=self.partner_lokesh,
            payment_status='PAID',
            created_by=self.admin
        )

        # Flow E: Upfront Supplier Purchase Paid by Business (Store Outflow)
        PurchaseService.create_and_post_purchase(
            user=self.admin,
            payload={
                'supplier_id': self.supplier.id,
                'supplier_invoice_number': 'SUPP-AUDIT-02',
                'purchase_date': '2026-09-25',
                'payment_mode': 'UPI',
                'paid_amount': Decimal('4000.00'),
                'items': [
                    {
                        'product_id': self.product.id,
                        'quantity': 5,
                        'unit_cost': Decimal('1000.00'),
                        'gst_rate': Decimal('18.00'),
                    }
                ]
            }
        )

        # Flow F: Partner Drawing (Company cash outflow; Ramesh equity debited)
        PartnerDrawings.objects.create(
            drawing_number="DRW-AUDIT-RAMESH-01",
            partner=self.partner_ramesh,
            drawing_date="2026-09-25",
            amount=Decimal('1500.00'),
            payment_mode="CASH",
            notes="Personal withdrawal by Ramesh",
            created_by=self.admin
        )

        # Flow G: Partner Settlement (Ramesh -> Lokesh; No company cash movement)
        PartnerSettlement.objects.create(
            settlement_number="STL-AUDIT-01",
            from_partner=self.partner_ramesh,
            to_partner=self.partner_lokesh,
            settlement_date="2026-09-25",
            amount=Decimal('1000.00'),
            payment_mode="UPI",
            notes="Ramesh pays Lokesh",
            created_by=self.admin
        )

        # Check Executive Dashboard Summary
        summary = ReportsService.get_dashboard_summary('2026-09-01', '2026-09-30')
        self.assertEqual(summary['total_customer_receipts'], 20000.0)
        self.assertEqual(summary['total_supplier_payouts'], 4000.0)
        self.assertEqual(summary['total_business_expenses'], 3000.0)
        # Net Cash Movement = Inflow (20000) - Outflows (4000 + 3000 + 1500) = 11,500.00
        self.assertEqual(summary['net_cash_movement'], 11500.0)

        # Verify partner ledger balances
        p_ramesh = next(p for p in summary['partner_balances'] if p['id'] == self.partner_ramesh.id)
        # 50,000 (initial) + 2,000 (expense funded) - 1,500 (drawing) - 1,000 (settlement) = 49,500
        self.assertEqual(p_ramesh['current_balance'], 49500.0)

        p_lokesh = next(p for p in summary['partner_balances'] if p['id'] == self.partner_lokesh.id)
        # 50,000 (initial) + 5,000 (purchase funded) + 1,000 (settlement received) = 56,000
        self.assertEqual(p_lokesh['current_balance'], 56000.0)

        # Check Payments Log Endpoint consistency
        log_res = self.client.get(reverse('financial_all_payments'))
        self.assertEqual(log_res.status_code, 200)
        txns = log_res.data
        total_inflow = sum(t['amount'] for t in txns if t['direction'] == 'IN')
        total_outflow = sum(t['amount'] for t in txns if t['direction'] == 'OUT')
        net_log_flow = total_inflow - total_outflow

        self.assertEqual(total_inflow, 20000.0)
        self.assertEqual(total_outflow, 8500.0)
        self.assertEqual(net_log_flow, 11500.0)
        self.assertEqual(net_log_flow, summary['net_cash_movement'])

    # 10. Opening / Initial Capital Tests
    def test_opening_capital_positive_ledger_integration(self):
        self.client.force_authenticate(user=self.admin)
        pmt_count_before = Payment.objects.count()
        exp_count_before = Expense.objects.count()

        # Register new partner with opening capital
        res = self.client.post(reverse('partner-list'), {
            'name': 'Deepak Investor',
            'ownership_percentage': '33.33',
            'initial_capital': '75000.00',
            'mobile': '9876543299',
            'is_active': True
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        partner_id = res.data['id']

        # 1. Verify partner model persists initial_capital
        partner = Partner.objects.get(id=partner_id)
        self.assertEqual(partner.initial_capital, Decimal('75000.00'))

        # 2. Verify NO monetary Payment or Expense transaction is generated
        self.assertEqual(Payment.objects.count(), pmt_count_before)
        self.assertEqual(Expense.objects.count(), exp_count_before)

        # 3. Verify opening capital is in summary and net capital balance
        summary = PartnerLedgerService.get_partner_ledger_summary(partner_id)
        self.assertEqual(summary['initial_capital'], Decimal('75000.00'))
        self.assertEqual(summary['total_credits'], Decimal('75000.00'))
        self.assertEqual(summary['total_debits'], Decimal('0.00'))
        self.assertEqual(summary['net_capital_balance'], Decimal('75000.00'))

        # 4. Verify OPENING_CAPITAL journal entry in chronological statement
        stmt = PartnerLedgerService.get_chronological_statement(partner_id)
        self.assertGreaterEqual(len(stmt), 1)
        opening_entry = stmt[0]
        self.assertEqual(opening_entry['type'], 'OPENING_CAPITAL')
        self.assertEqual(opening_entry['credit'], Decimal('75000.00'))
        self.assertEqual(opening_entry['debit'], Decimal('0.00'))
        self.assertEqual(opening_entry['running_balance'], Decimal('75000.00'))

    def test_opening_capital_zero_ledger_integration(self):
        self.client.force_authenticate(user=self.admin)

        # Register partner with 0.00 opening capital
        res = self.client.post(reverse('partner-list'), {
            'name': 'Zero Capital Partner',
            'ownership_percentage': '10.00',
            'initial_capital': '0.00',
            'is_active': True
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        partner_id = res.data['id']

        # 1. Summary reflects zero initial capital and zero balance
        summary = PartnerLedgerService.get_partner_ledger_summary(partner_id)
        self.assertEqual(summary['initial_capital'], Decimal('0.00'))
        self.assertEqual(summary['net_capital_balance'], Decimal('0.00'))

        # 2. Chronological statement has OPENING_CAPITAL entry with 0.00
        stmt = PartnerLedgerService.get_chronological_statement(partner_id)
        self.assertGreaterEqual(len(stmt), 1)
        opening_entry = stmt[0]
        self.assertEqual(opening_entry['type'], 'OPENING_CAPITAL')
        self.assertEqual(opening_entry['credit'], Decimal('0.00'))
        self.assertEqual(opening_entry['running_balance'], Decimal('0.00'))

        # 3. Personal drawing of 500 makes net capital negative 500
        PartnerDrawings.objects.create(
            drawing_number="DRW-ZERO-PARTNER-01",
            partner=Partner.objects.get(id=partner_id),
            drawing_date="2026-09-26",
            amount=Decimal('500.00'),
            payment_mode="CASH",
            created_by=self.admin
        )
        updated_summary = PartnerLedgerService.get_partner_ledger_summary(partner_id)
        self.assertEqual(updated_summary['net_capital_balance'], Decimal('-500.00'))

    def test_opening_capital_immutable_on_partner_update(self):
        self.client.force_authenticate(user=self.admin)
        partner = Partner.objects.create(
            name="Immutability Test Partner",
            ownership_percentage=Decimal('50.00'),
            initial_capital=Decimal('50000.00'),
            is_active=True
        )

        # Attempt to silently change initial_capital via PATCH -> Must fail with 400
        res_patch = self.client.patch(reverse('partner-detail', args=[partner.id]), {
            'initial_capital': '90000.00'
        })
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('initial_capital', res_patch.data)

        # Attempt to silently change initial_capital via PUT -> Must fail with 400
        res_put = self.client.put(reverse('partner-detail', args=[partner.id]), {
            'name': 'Immutability Test Partner',
            'ownership_percentage': '50.00',
            'initial_capital': '90000.00',
            'is_active': True
        })
        self.assertEqual(res_put.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('initial_capital', res_put.data)

        # Updating other details while preserving initial_capital -> Must succeed
        res_valid = self.client.patch(reverse('partner-detail', args=[partner.id]), {
            'mobile': '9988776655',
            'email': 'partner.updated@octane.in',
            'initial_capital': '50000.00'
        })
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        partner.refresh_from_db()
        self.assertEqual(partner.mobile, '9988776655')
        self.assertEqual(partner.initial_capital, Decimal('50000.00'))

    def test_pos_partner_allocation_ledger_integration(self):
        """
        Verifies that when a POS sale is billed/collected by a partner (e.g. Ramesh or Lokesh),
        it properly records in partner ledger summary and chronological statement.
        """
        self.client.force_authenticate(user=self.admin)
        from core.services.invoice_service import InvoiceService

        # Seed stock for product
        StockMovement.objects.create(
            product=self.product,
            movement_type='OPENING',
            quantity=5,
            created_by=self.admin
        )

        inv_payload = {
            'customer_id': self.customer.id,
            'buyer_name': self.customer.name,
            'buyer_state_code': '29',
            'invoice_date': '2026-09-28',
            'items': [
                {
                    'item_type': 'PRODUCT',
                    'product_id': self.product.id,
                    'description': self.product.name,
                    'qty': 1,
                    'rate': Decimal('25000.00'),
                    'gst_rate': Decimal('18.00'),
                }
            ],
            'payments': [
                {
                    'payment_mode': 'CASH',
                    'amount': Decimal('29500.00'),
                    'partner_allocation_json': {
                        'partner_id': self.partner_ramesh.id,
                        'partner_name': self.partner_ramesh.name,
                        'amount': 29500.00,
                        'mode': 'CASH'
                    }
                }
            ],
            'partner_allocation_json': {
                'partner_id': self.partner_ramesh.id,
                'partner_name': self.partner_ramesh.name,
                'amount': 29500.00,
                'mode': 'CASH'
            }
        }
        invoice = InvoiceService.create_and_post_invoice(user=self.admin, payload=inv_payload)
        self.assertEqual(invoice.invoice_status, 'POSTED')

        summary = PartnerLedgerService.get_partner_ledger_summary(self.partner_ramesh.id)
        self.assertEqual(summary['incomes_allocated'], Decimal('29500.00'))

        statement = PartnerLedgerService.get_chronological_statement(self.partner_ramesh.id)
        pos_entry = next((e for e in statement if e['reference'] == invoice.invoice_number), None)
        self.assertIsNotNone(pos_entry)
        self.assertEqual(pos_entry['credit'], Decimal('29500.00'))
        self.assertIn('POS Sale', pos_entry['description'])



# ==========================================
# PHASE 13: PROFIT & LOSS ACCOUNTING AUDIT TESTS
# ==========================================

class ProfitAndLossAccountingAuditTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='pnl_admin', password='password123')
        self.profile = BusinessProfile.objects.create(
            company_name="OCTANE SYSTEMS", gstin="29DRTPA7275L1ZW", state_code="29"
        )
        self.supplier = Supplier.objects.create(
            name="Alpha Tech Wholesalers", gstin="29ABCDE1234F1Z5", state_code="29"
        )
        self.customer = Customer.objects.create(
            name="Mega Corp Enterprises", mobile="9876543210", state_code="29"
        )
        self.category_hardware = ProductCategory.objects.create(name="Enterprise Hardware")
        self.exp_category = ExpenseCategory.objects.create(name="Utilities & Office", is_active=True)

        # High-value Product: 11 units will be purchased at ₹50,000 each = ₹5,50,000 purchase taxable
        self.server_unit = Product.objects.create(
            name="Octane Xeon Server",
            sku="XEON-SRV-01",
            category=self.category_hardware,
            tracking_type="QUANTITY",
            unit="PCS",
            purchase_price=Decimal('50000.00'),
            selling_price=Decimal('100000.00'),
            min_stock_alert=2,
            is_stock_enabled=True,
            is_active=True
        )

    def test_section_12_realistic_scenario_purchase_asset_vs_cogs(self):
        """
        Verify the exact scenario specified by the user:
        - Opening inventory = ₹0
        - Purchase: ₹5,50,000 (11 units @ ₹50,000)
        - Only 1 unit costing ₹50,000 is sold
        - Sales taxable value: ₹1,00,000 (+ 18% GST = ₹18,000)
        - Operating expense: ₹10,000
        Conceptual result:
        - Revenue = ₹1,00,000 (taxable revenue, not gross with GST)
        - COGS = ₹50,000 (cost of units sold, NOT ₹5,50,000 total purchases!)
        - Closing inventory = ₹5,00,000 (remaining 10 units @ ₹50,000)
        - Gross Profit = ₹50,000
        - Operating Expenses = ₹10,000
        - Net Profit = ₹40,000
        - The remaining ₹5,00,000 purchase cost remains represented by inventory, not become P&L expense!
        """
        self.client.force_authenticate(user=self.admin)

        # 1. Purchase 11 units @ ₹50,000 = ₹5,50,000 taxable (+ ₹99,000 GST = ₹6,49,000 total)
        purchase = PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-XEON-001',
            'purchase_date': '2026-09-10',
            'payment_mode': 'BANK_TRANSFER',
            'paid_amount': 649000.00,
            'items': [{
                'product_id': self.server_unit.id,
                'quantity': 11,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })
        self.assertEqual(self.server_unit.get_current_stock(), 11)

        # 2. Sell only 1 unit for ₹1,00,000 taxable (+ 18% GST = ₹1,18,000)
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-15',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.server_unit.id,
                'qty': 1,
                'rate': 100000.00,
                'gst_rate': 18.00
            }],
            'payments': [{
                'payment_mode': 'BANK_TRANSFER',
                'amount': 118000.00
            }]
        })
        self.assertEqual(self.server_unit.get_current_stock(), 10)

        # 3. Operating expense = ₹10,000
        Expense.objects.create(
            category=self.exp_category,
            expense_date='2026-09-20',
            amount=Decimal('10000.00'),
            payment_mode='BANK_TRANSFER',
            description='Server Room Electricity',
            created_by=self.admin
        )

        # 4. Fetch P&L Report
        url = reverse('report_pnl')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        # Revenue must equal taxable sales ₹1,00,000 (NOT ₹1,18,000 including GST!)
        self.assertEqual(data['sales_taxable_revenue'], 100000.0)
        self.assertEqual(data['net_sales_revenue'], 100000.0)
        self.assertEqual(data['gross_sales'], 118000.0)
        self.assertEqual(data['tax_collected'], 18000.0)

        # COGS must equal cost of 1 sold unit: ₹50,000 (NOT ₹5,50,000!)
        self.assertEqual(data['cost_of_goods_sold'], 50000.0)

        # Closing inventory must equal remaining 10 units: ₹5,00,000
        self.assertEqual(data['closing_inventory'], 500000.0)
        self.assertEqual(data['goods_available_for_sale'], 550000.0)

        # Gross Profit = 100,000 - 50,000 = 50,000
        self.assertEqual(data['gross_profit'], 50000.0)
        self.assertEqual(data['gross_margin_pct'], 50.0)

        # Operating Expenses = 10,000
        self.assertEqual(data['operating_expenses'], 10000.0)

        # Net Profit = 50,000 - 10,000 = 40,000
        self.assertEqual(data['net_profit'], 40000.0)
        self.assertEqual(data['net_margin_pct'], 40.0)

    def test_sales_return_reverses_revenue_cogs_and_restores_inventory(self):
        """
        Verify sales return accounting:
        - Reverses sales revenue
        - Reverses output GST
        - Restores inventory quantity and asset valuation
        - Reverses COGS
        - Adjusts Gross & Net Profit
        """
        self.client.force_authenticate(user=self.admin)

        # Purchase 5 units @ 20,000
        purchase = PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RET-01',
            'purchase_date': '2026-09-01',
            'paid_amount': 118000.00,
            'items': [{
                'product_id': self.server_unit.id,
                'quantity': 5,
                'unit_cost': 20000.00,
                'gst_rate': 18.00
            }]
        })

        # Sell 2 units @ 30,000 (Taxable = 60,000, GST = 10,800, Total = 70,800)
        invoice = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-05',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.server_unit.id,
                'qty': 2,
                'rate': 30000.00,
                'gst_rate': 18.00
            }]
        })
        self.assertEqual(self.server_unit.get_current_stock(), 3)

        inv_item = invoice.items.first()

        # Customer returns 1 unit
        res_ret = self.client.post(reverse('process_sales_return', kwargs={'invoice_id': invoice.id}), {
            'items': [{
                'invoice_item_id': inv_item.id,
                'quantity': 1,
                'reason': 'Customer requested refund'
            }]
        }, format='json')
        self.assertEqual(res_ret.status_code, status.HTTP_200_OK)

        # Stock restored from 3 to 4
        self.assertEqual(self.server_unit.get_current_stock(), 4)

        # Check P&L
        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        # Gross sales taxable = 60,000, sales return = 30,000 -> Net sales = 30,000
        self.assertEqual(pnl['gross_sales_taxable'], 60000.0)
        self.assertEqual(pnl['sales_returns_taxable'], 30000.0)
        self.assertEqual(pnl['net_sales_revenue'], 30000.0)

        # COGS was 2 * 20,000 = 40,000 minus return 1 * 20,000 = 20,000
        self.assertEqual(pnl['cost_of_goods_sold'], 20000.0)
        # Gross Profit = 30,000 - 20,000 = 10,000
        self.assertEqual(pnl['gross_profit'], 10000.0)

    def test_purchase_return_reverses_payable_and_input_gst(self):
        """
        Verify purchase return accounting:
        - Decreases supplier payable
        - Decreases inventory stock and valuation
        - Decreases input GST credit
        """
        self.client.force_authenticate(user=self.admin)

        # Purchase 4 units @ 25,000 (+ 18% GST = 118,000 total, paid 50,000, payable 68,000)
        purchase = PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RET-02',
            'purchase_date': '2026-09-01',
            'paid_amount': 50000.00,
            'items': [{
                'product_id': self.server_unit.id,
                'quantity': 4,
                'unit_cost': 25000.00,
                'gst_rate': 18.00
            }]
        })
        self.assertEqual(self.server_unit.get_current_stock(), 4)
        pur_item = purchase.items.first()

        # Return 1 unit to supplier (Unit total cost = 25,000 + 4,500 tax = 29,500)
        res_ret = self.client.post(reverse('process_purchase_return', kwargs={'purchase_id': purchase.id}), {
            'items': [{
                'purchase_item_id': pur_item.id,
                'quantity': 1,
                'reason': 'Damaged in transit'
            }]
        }, format='json')
        self.assertEqual(res_ret.status_code, status.HTTP_200_OK)

        # Stock reduced from 4 to 3
        self.assertEqual(self.server_unit.get_current_stock(), 3)

        purchase.refresh_from_db()
        # Original 118,000 - 29,500 = 88,500
        self.assertEqual(purchase.total_amount, Decimal('88500.00'))

    def test_accounting_reconciliation_diagnostic_endpoint(self):
        """
        Verify /api/reports/reconciliation/ returns all 14 points and balances to zero variance.
        """
        self.client.force_authenticate(user=self.admin)

        # Seed purchase, sale, expense
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RECON-01',
            'purchase_date': '2026-09-02',
            'paid_amount': 236000.00,
            'items': [{
                'product_id': self.server_unit.id,
                'quantity': 4,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-10',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.server_unit.id,
                'qty': 1,
                'rate': 80000.00,
                'gst_rate': 18.00
            }],
            'payments': [{
                'payment_mode': 'CASH',
                'amount': 94400.00
            }]
        })

        Expense.objects.create(
            category=self.exp_category,
            expense_date='2026-09-15',
            amount=Decimal('5000.00'),
            payment_mode='CASH',
            created_by=self.admin
        )

        url = reverse('report_accounting_reconciliation')
        res = self.client.get(url, {'start_date': '2026-09-01', 'end_date': '2026-09-30'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        required_fields = [
            'opening_inventory',
            'purchases',
            'purchase_returns',
            'available_inventory',
            'closing_inventory',
            'cogs',
            'sales_before_gst',
            'sales_returns',
            'net_sales',
            'output_gst',
            'input_gst',
            'operating_expenses',
            'gross_profit',
            'net_profit',
            'is_balanced'
        ]
        for field in required_fields:
            self.assertIn(field, data, f"Missing required reconciliation field: {field}")

        self.assertTrue(data['is_balanced'], "Accounting reconciliation is not balanced!")
        self.assertEqual(data['cogs'], 50000.0)
        self.assertEqual(data['gross_profit'], 30000.0)  # 80,000 - 50,000
        self.assertEqual(data['net_profit'], 25000.0)    # 30,000 - 5,000

    def test_credit_sale_and_paid_sale_in_pnl_and_cash_flow(self):
        """
        Verify that credit sales appear in accrual sales revenue on P&L,
        and generate customer receivables, but do NOT count as cash flow receipts
        until payment is actually received.
        """
        self.client.force_authenticate(user=self.admin)

        # 1. Purchase 2 units @ 30,000 = 60,000
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-CREDIT-01',
            'purchase_date': '2026-09-01',
            'paid_amount': 70800.00,
            'items': [{'product_id': self.server_unit.id, 'quantity': 2, 'unit_cost': 30000.00, 'gst_rate': 18.00}]
        })

        # 2. Credit sale of 1 unit @ 50,000 + 18% GST = 59,000 (No payment upfront)
        inv = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-05',
            'items': [{'item_type': 'PRODUCT', 'product_id': self.server_unit.id, 'qty': 1, 'rate': 50000.00, 'gst_rate': 18.00}],
            'payments': []  # 100% Credit
        })
        self.assertEqual(inv.payment_status, 'UNPAID')
        self.assertEqual(inv.balance_due_amount, Decimal('59000.00'))

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        # P&L Revenue is accrual: includes the credit sale of 50,000
        self.assertEqual(pnl['sales_taxable_revenue'], 50000.0)
        self.assertEqual(pnl['cost_of_goods_sold'], 30000.0)
        self.assertEqual(pnl['gross_profit'], 20000.0)
        # But Cash Flow has 0 customer receipts!
        self.assertEqual(pnl['total_customer_receipts'], 0.0)

        # 3. Customer later pays 59,000
        InvoiceService.record_delayed_payment(self.admin, inv.id, {
            'amount': 59000.00,
            'payment_mode': 'UPI',
            'payment_date': '2026-09-10'
        })
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, 'PAID')

        # Now cash flow reflects the payment receipt
        pnl_after = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        self.assertEqual(pnl_after['total_customer_receipts'], 59000.0)

    def test_partner_funded_purchase_and_partner_paid_expense(self):
        """
        Verify that partner-paid expenses affect P&L profitability,
        but do not reduce business account cash flow (partner equity increases).
        """
        self.client.force_authenticate(user=self.admin)
        partner = Partner.objects.create(name="Praveen", ownership_percentage=Decimal('50.00'), initial_capital=Decimal('100000.00'))

        # Partner pays an operating expense personally
        Expense.objects.create(
            category=self.exp_category,
            expense_date='2026-09-10',
            amount=Decimal('8000.00'),
            payment_mode='PARTNER_OUT_OF_POCKET',
            paid_by_partner=partner,
            description='Partner paid office maintenance',
            created_by=self.admin
        )

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        # Affects P&L operating expenses
        self.assertEqual(pnl['operating_expenses'], 8000.0)
        # Does NOT reduce business cash flow!
        self.assertEqual(pnl['total_operating_cash_expenses'], 0.0)

    def test_service_only_sale_has_zero_cogs(self):
        """
        Verify pure services sale has 0 COGS and 100% gross margin.
        """
        self.client.force_authenticate(user=self.admin)
        svc_cat = ServiceCategory.objects.create(name="Cloud Consulting")
        svc = Service.objects.create(category=svc_cat, service_name="Server Migration", default_rate=Decimal('25000.00'), gst_rate=Decimal('18.00'))

        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-05',
            'items': [{
                'item_type': 'SERVICE',
                'service_id': svc.id,
                'qty': 1,
                'rate': 25000.00,
                'gst_rate': 18.00
            }]
        })

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        self.assertEqual(pnl['sales_taxable_revenue'], 25000.0)
        self.assertEqual(pnl['cost_of_goods_sold'], 0.0)
        self.assertEqual(pnl['gross_profit'], 25000.0)
        self.assertEqual(pnl['gross_margin_pct'], 100.0)

    def test_date_range_filtering_opening_and_closing_inventory(self):
        """
        Verify that selecting a date range properly isolates transactions,
        and computes opening stock prior to start_date and closing stock up to end_date.
        """
        self.client.force_authenticate(user=self.admin)

        # August: Purchase 10 units @ 20,000 = 200,000
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-AUG-01',
            'purchase_date': '2026-08-15',
            'paid_amount': 236000.00,
            'items': [{'product_id': self.server_unit.id, 'quantity': 10, 'unit_cost': 20000.00, 'gst_rate': 18.00}]
        })

        # August: Sell 3 units @ 40,000
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-08-20',
            'items': [{'item_type': 'PRODUCT', 'product_id': self.server_unit.id, 'qty': 3, 'rate': 40000.00, 'gst_rate': 18.00}]
        })
        # Remaining at end of August: 7 units

        # September: Sell 2 units @ 45,000
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-12',
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.server_unit.id,
                'qty': 2,
                'rate': 45000.00,
                'gst_rate': 18.00
            }]
        })

        # Query September only
        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        # Only September sales are included
        self.assertEqual(pnl['sales_taxable_revenue'], 90000.0)
        # Opening inventory before Sept 1: 7 units @ 50,000 = 350,000
        self.assertEqual(pnl['opening_inventory'], 350000.0)
        # Purchases during Sept: 0
        self.assertEqual(pnl['purchases_taxable'], 0.0)
        # Closing inventory at Sept 30: 5 units @ 50,000 = 250,000
        self.assertEqual(pnl['closing_inventory'], 250000.0)
        # COGS = 2 units * unit_cost (20,000) = 40,000
        self.assertEqual(pnl['cost_of_goods_sold'], 40000.0)


class ExecutiveDashboardPnlReconciliationTests(APITestCase):
    """
    Dedicated test suite verifying that Executive Dashboard and Profit & Loss report
    use the exact same accounting source of truth, produce 100% identical financial figures
    for any selected accounting period, and never treat inventory purchases as COGS.
    """

    def setUp(self):
        self.admin = User.objects.create_superuser('admin_recon', 'admin_recon@example.com', 'AdminPass123!')
        self.supplier = Supplier.objects.create(name="Recon Supplier", state_name="Karnataka", state_code="29")
        self.customer = Customer.objects.create(name="Recon Customer", state_name="Karnataka", state_code="29")
        self.category = ProductCategory.objects.create(name="Recon Category")
        self.exp_category = ExpenseCategory.objects.create(name="Recon Overheads")

        self.product = Product.objects.create(
            name="Precision Hardware Unit",
            sku="HW-RECON-01",
            category=self.category,
            hsn_sac="852411",
            purchase_price=Decimal('50000.00'),
            selling_price=Decimal('60000.00'),
            gst_rate=Decimal('18.00'),
            is_stock_enabled=True,
            is_active=True
        )

    def test_pnl_and_dashboard_reconciliation_identical_figures(self):
        """
        Verify:
        P&L Net Sales Revenue == Dashboard Net Sales Revenue
        P&L COGS == Dashboard COGS
        P&L Gross Profit == Dashboard Gross Profit
        P&L Operating Expenses == Dashboard Operating Expenses
        P&L Net Business Profit == Dashboard Net Business Profit
        P&L Net Cash Flow == Dashboard Net Cash Flow
        for the same accounting period.
        """
        self.client.force_authenticate(user=self.admin)

        # 1. Purchase: ₹5,50,000 inventory (11 units @ 50,000 + 18% GST = 6,49,000)
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RECON-550',
            'purchase_date': '2026-09-05',
            'paid_amount': 649000.00,
            'items': [{
                'product_id': self.product.id,
                'quantity': 11,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        # 2. Sale: Only 1 unit sold for ₹60,000 (+ 18% GST = ₹70,800)
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-15',
            'payments': [{'amount': 70800.00, 'payment_mode': 'BANK_TRANSFER'}],
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.product.id,
                'qty': 1,
                'rate': 60000.00,
                'gst_rate': 18.00
            }]
        })

        # 3. Operating expense = ₹5,000
        Expense.objects.create(
            category=self.exp_category,
            expense_date='2026-09-20',
            amount=Decimal('5000.00'),
            payment_mode='BANK_TRANSFER',
            description='Facility Rent',
            created_by=self.admin
        )

        period_start = '2026-09-01'
        period_end = '2026-09-30'

        pnl = ReportsService.get_profit_and_loss_report(period_start, period_end)
        dash = ReportsService.get_dashboard_summary(period_start, period_end)

        # Revenue matches
        self.assertEqual(pnl['net_sales_revenue'], 60000.0)
        self.assertEqual(dash['total_income'], pnl['net_sales_revenue'])
        self.assertEqual(dash['total_revenue'], pnl['net_sales_revenue'])
        self.assertEqual(dash['net_sales_revenue'], pnl['net_sales_revenue'])

        # COGS matches actual sold cost: ₹50,000 (NOT ₹5,50,000 total purchases!)
        self.assertEqual(pnl['cost_of_goods_sold'], 50000.0)
        self.assertEqual(dash['cogs'], pnl['cost_of_goods_sold'])
        self.assertEqual(dash['cost_of_goods_sold'], pnl['cost_of_goods_sold'])

        # Gross Profit matches: 60,000 - 50,000 = 10,000
        self.assertEqual(pnl['gross_profit'], 10000.0)
        self.assertEqual(dash['gross_profit'], pnl['gross_profit'])

        # Operating Expenses match: 5,000
        self.assertEqual(pnl['operating_expenses'], 5000.0)
        self.assertEqual(dash['total_expenses'], pnl['operating_expenses'])
        self.assertEqual(dash['operating_expenses'], pnl['operating_expenses'])

        # Net Business Profit matches: 10,000 - 5,000 = 5,000 (NOT -4,08,901 or negative!)
        self.assertEqual(pnl['net_profit'], 5000.0)
        self.assertEqual(dash['net_profit'], pnl['net_profit'])
        self.assertEqual(dash['net_business_profit'], pnl['net_profit'])

        # Cash Flow matches
        self.assertEqual(pnl['net_cash_flow'], dash['net_cash_flow'])
        self.assertEqual(pnl['net_cash_flow'], dash['net_cash_movement'])

        # Unsold inventory (10 units @ 50,000 = 5,00,000) remains asset on dashboard
        self.assertEqual(dash['inventory_valuation'], 500000.0)

    def test_dashboard_api_endpoint_matches_pnl_api_endpoint(self):
        """
        Verify that calling GET /api/reports/dashboard/?start_date=...&end_date=...
        returns figures identical to GET /api/reports/pnl/?start_date=...&end_date=...
        """
        self.client.force_authenticate(user=self.admin)

        # Purchase 5 units into inventory
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RECON-API',
            'purchase_date': '2026-08-01',
            'paid_amount': 295000.00,
            'items': [{
                'product_id': self.product.id,
                'quantity': 5,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        # August transaction (outside period)
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-08-15',
            'payments': [{'amount': 11800.00, 'payment_mode': 'CASH'}],
            'items': [{'item_type': 'PRODUCT', 'product_id': self.product.id, 'qty': 1, 'rate': 10000.00, 'gst_rate': 18.00}]
        })

        # September transaction (inside period)
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-12',
            'payments': [{'amount': 70800.00, 'payment_mode': 'BANK_TRANSFER'}],
            'items': [{'item_type': 'PRODUCT', 'product_id': self.product.id, 'qty': 1, 'rate': 60000.00, 'gst_rate': 18.00}]
        })

        query = {'start_date': '2026-09-01', 'end_date': '2026-09-30'}
        res_dash = self.client.get(reverse('report_dashboard'), query)
        res_pnl = self.client.get(reverse('report_pnl'), query)

        self.assertEqual(res_dash.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pnl.status_code, status.HTTP_200_OK)

        d_dash = res_dash.data
        d_pnl = res_pnl.data

        # Only September transaction included
        self.assertEqual(d_dash['total_income'], 60000.0)
        self.assertEqual(d_dash['total_income'], d_pnl['net_sales_revenue'])
        self.assertEqual(d_dash['cogs'], d_pnl['cost_of_goods_sold'])
        self.assertEqual(d_dash['gross_profit'], d_pnl['gross_profit'])
        self.assertEqual(d_dash['total_expenses'], d_pnl['operating_expenses'])
        self.assertEqual(d_dash['net_profit'], d_pnl['net_profit'])
        self.assertEqual(d_dash['net_cash_movement'], d_pnl['net_cash_flow'])

    def test_sales_return_reflected_identically_on_dashboard(self):
        """
        Verify sales return correctly updates both P&L and Dashboard identically:
        - Reduces sales revenue
        - Reduces COGS
        - Restores inventory asset valuation
        """
        self.client.force_authenticate(user=self.admin)

        # Purchase 5 units into inventory
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-RECON-RET',
            'purchase_date': '2026-09-01',
            'paid_amount': 295000.00,
            'items': [{
                'product_id': self.product.id,
                'quantity': 5,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        # Sell 2 units @ 60,000 (+ 18% GST = 141,600)
        inv = InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-05',
            'payments': [{'amount': 141600.00, 'payment_mode': 'UPI'}],
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.product.id,
                'qty': 2,
                'rate': 60000.00,
                'gst_rate': 18.00
            }]
        })

        # Return 1 unit
        inv_item = inv.items.filter(item_type='PRODUCT').first()
        self.client.post(reverse('process_sales_return', kwargs={'invoice_id': inv.id}), {
            'items': [{
                'invoice_item_id': inv_item.id,
                'quantity': 1,
                'reason': 'Returned by customer'
            }]
        }, format='json')

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        dash = ReportsService.get_dashboard_summary('2026-09-01', '2026-09-30')

        # Net sales = 120,000 - 60,000 = 60,000
        self.assertEqual(pnl['net_sales_revenue'], 60000.0)
        self.assertEqual(dash['total_income'], 60000.0)

        # Net COGS = (2 * 50,000) - (1 * 50,000) = 50,000
        self.assertEqual(pnl['cost_of_goods_sold'], 50000.0)
        self.assertEqual(dash['cogs'], 50000.0)

        # Gross Profit = 10,000
        self.assertEqual(pnl['gross_profit'], 10000.0)
        self.assertEqual(dash['gross_profit'], 10000.0)
        self.assertEqual(dash['net_profit'], 10000.0)

    def test_purchase_without_sale_cogs_is_zero(self):
        """
        TEST 1 & TEST 5:
        Purchase ₹5,50,000 inventory. Sell nothing.
        Expected:
        - Purchases = ₹5,50,000
        - COGS = ₹0.00
        - Operating Expenses = ₹0.00
        - Net Profit = ₹0.00
        - Closing inventory contains the unsold ₹5,50,000 inventory asset.
        """
        self.client.force_authenticate(user=self.admin)

        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-ZERO-SALE-01',
            'purchase_date': '2026-09-02',
            'paid_amount': 649000.00,
            'items': [{
                'product_id': self.product.id,
                'quantity': 11,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        dash = ReportsService.get_dashboard_summary('2026-09-01', '2026-09-30')

        self.assertEqual(pnl['purchases_taxable'], 550000.0)
        self.assertEqual(pnl['cost_of_goods_sold'], 0.0)
        self.assertEqual(dash['cogs'], 0.0)
        self.assertEqual(dash['total_income'], 0.0)
        self.assertEqual(dash['operating_expenses'], 0.0)
        self.assertEqual(dash['net_profit'], 0.0)
        self.assertEqual(dash['inventory_valuation'], 550000.0)

    def test_gst_excluded_from_revenue_and_cogs(self):
        """
        TEST 7:
        Verify Output GST (+18%) does not inflate Revenue and Input GST (+18%) does not inflate COGS.
        """
        self.client.force_authenticate(user=self.admin)

        # Purchase 1 unit @ 50,000 + 18% GST (9,000) = 59,000 total
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-GST-TEST',
            'purchase_date': '2026-09-02',
            'paid_amount': 59000.00,
            'items': [{
                'product_id': self.product.id,
                'quantity': 1,
                'unit_cost': 50000.00,
                'gst_rate': 18.00
            }]
        })

        # Sell 1 unit @ 60,000 + 18% GST (10,800) = 70,800 gross invoice
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-10',
            'payments': [{'amount': 70800.00, 'payment_mode': 'CASH'}],
            'items': [{
                'item_type': 'PRODUCT',
                'product_id': self.product.id,
                'qty': 1,
                'rate': 60000.00,
                'gst_rate': 18.00
            }]
        })

        pnl = ReportsService.get_profit_and_loss_report('2026-09-01', '2026-09-30')
        dash = ReportsService.get_dashboard_summary('2026-09-01', '2026-09-30')

        # Taxable sales = 60,000 (NOT 70,800)
        self.assertEqual(pnl['net_sales_revenue'], 60000.0)
        self.assertEqual(dash['total_income'], 60000.0)

        # Output GST = 10,800 is tracked under output_gst, NOT in profit
        self.assertEqual(pnl['output_gst'], 10800.0)
        self.assertEqual(pnl['input_gst'], 9000.0)

        # COGS = 50,000 (NOT 59,000)
        self.assertEqual(pnl['cost_of_goods_sold'], 50000.0)
        self.assertEqual(dash['cogs'], 50000.0)

        # Gross Profit = 10,000
        self.assertEqual(dash['gross_profit'], 10000.0)

    def test_dashboard_visual_analytics_payload(self):
        """
        Verify that get_dashboard_summary includes daily_trends, top_products,
        and recent_invoices for interactive charts and tables.
        """
        self.client.force_authenticate(user=self.admin)

        # 1. Purchase
        PurchaseService.create_and_post_purchase(self.admin, {
            'supplier_id': self.supplier.id,
            'supplier_invoice_number': 'PUR-VISUAL-01',
            'purchase_date': '2026-09-01',
            'paid_amount': 118000.00,
            'items': [{'product_id': self.product.id, 'quantity': 2, 'unit_cost': 50000.00, 'gst_rate': 18.00}]
        })

        # 2. Sale
        InvoiceService.create_and_post_invoice(self.admin, {
            'customer_id': self.customer.id,
            'invoice_date': '2026-09-15',
            'payments': [{'amount': 70800.00, 'payment_mode': 'CASH'}],
            'items': [{'item_type': 'PRODUCT', 'product_id': self.product.id, 'qty': 1, 'rate': 60000.00, 'gst_rate': 18.00}]
        })

        dash = ReportsService.get_dashboard_summary('2026-09-01', '2026-09-30')

        # Check visual analytics fields exist
        self.assertIn('daily_trends', dash)
        self.assertIn('top_products', dash)
        self.assertIn('recent_invoices', dash)

        # Check daily_trends contains the invoice date
        trends = dash['daily_trends']
        trend_dates = [t['date'] for t in trends]
        self.assertIn('2026-09-15', trend_dates)
        match_trend = next(t for t in trends if t['date'] == '2026-09-15')
        self.assertEqual(match_trend['sales_amount'], 60000.0)
        self.assertEqual(match_trend['invoices_count'], 1)

        # Check top_products contains the sold product
        top_prods = dash['top_products']
        self.assertTrue(len(top_prods) >= 1)
        self.assertEqual(top_prods[0]['name'], self.product.name)
        self.assertEqual(top_prods[0]['units_sold'], 1.0)
        self.assertEqual(top_prods[0]['revenue'], 60000.0)

        # Check recent_invoices
        recent = dash['recent_invoices']
        self.assertTrue(len(recent) >= 1)
        self.assertEqual(recent[0]['customer_name'], self.customer.name)
        self.assertEqual(recent[0]['status'], 'PAID')


class BrandModelAndApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.admin)
        self.category = ProductCategory.objects.create(name='Laptop')
        self.category2 = ProductCategory.objects.create(name='CCTV')

    def test_create_brand_with_category(self):
        url = reverse('brand-list')
        data = {
            'name': 'Dell',
            'category': self.category.id,
            'origin': 'USA',
            'description': 'Laptops and Workstations',
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Dell')
        self.assertEqual(res.data['category'], self.category.id)
        self.assertEqual(res.data['category_name'], 'Laptop')
        self.assertEqual(res.data['origin'], 'USA')

    def test_create_brand_without_category(self):
        url = reverse('brand-list')
        data = {
            'name': 'UniversalBrand',
            'category': None,
            'origin': 'India',
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(res.data['category'])
        self.assertIsNone(res.data['category_name'])

    def test_filter_brands_by_category(self):
        Brand.objects.create(name='Dell', category=self.category, origin='USA')
        Brand.objects.create(name='Hikvision', category=self.category2, origin='China')
        Brand.objects.create(name='SanDisk', category=None, origin='USA')  # General brand

        url = reverse('brand-list')
        res = self.client.get(f"{url}?category={self.category.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        names = [b['name'] for b in results]
        self.assertIn('Dell', names)
        self.assertIn('SanDisk', names)  # General brand included
        self.assertNotIn('Hikvision', names)  # Belonging to CCTV only







