from decimal import Decimal
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from core.models import Quotation, Product, StockMovement, SerialNumber, Invoice

class QuotationModuleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='adminpassword123')
        self.client.force_authenticate(user=self.user)
        self.product = Product.objects.create(
            name="Test Laptop XPS",
            sku="XPS-13-9310",
            selling_price=Decimal("85000.00"),
            tracking_type="SERIAL",
            is_stock_enabled=True
        )
        self.serial = SerialNumber.objects.create(
            product=self.product,
            serial_number="XPS-TEST-SN-001",
            status="AVAILABLE"
        )

    def test_quotation_creation_and_auto_numbering(self):
        # Check next number endpoint
        next_res = self.client.get('/api/quotations/next_number/')
        self.assertEqual(next_res.status_code, status.HTTP_200_OK)
        self.assertEqual(next_res.data['next_quotation_number'], 'OCT0001')

        payload = {
            'buyer_name': 'Acme Corp Technologies',
            'buyer_address': '45 Tech Boulevard, Electronic City',
            'buyer_city': 'Bengaluru',
            'buyer_state': 'Karnataka',
            'buyer_pincode': '560100',
            'buyer_phone': '+91 9888877777',
            'buyer_email': 'procurement@acme.com',
            'buyer_gstin': '29ABCDE1234F1Z5',
            'validity_days': 14,
            'items': [
                {
                    'sn': 1,
                    'part_number': 'XPS-13-9310',
                    'description': 'Dell XPS 13 i7 / 16GB / 512GB SSD',
                    'unit_price': 85000.00,
                    'quantity': 2,
                    'total_value': 170000.00,
                    'gst_rate': 18.0,
                    'gst_amount': 30600.00,
                    'total': 200600.00
                }
            ],
            'taxable_amount': '170000.00',
            'total_tax': '30600.00',
            'grand_total': '200600.00'
        }

        res = self.client.post('/api/quotations/', payload, format='json')
        if res.status_code != status.HTTP_201_CREATED:
            print("ERROR DATA:", res.data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['quotation_number'], 'OCT0001')
        self.assertEqual(res.data['status'], 'DRAFT')
        self.assertEqual(len(res.data['items']), 1)

        # Invariant checks: Quotation must NEVER touch stock, serial numbers, or invoices
        self.assertEqual(StockMovement.objects.count(), 0)
        self.assertEqual(Invoice.objects.count(), 0)
        self.serial.refresh_from_db()
        self.assertEqual(self.serial.status, 'AVAILABLE')
        self.assertEqual(StockMovement.objects.filter(product=self.product).count(), 0)

        # Test subsequent auto-numbering
        next_res2 = self.client.get('/api/quotations/next_number/')
        self.assertEqual(next_res2.data['next_quotation_number'], 'OCT0002')

    def test_quotation_update_and_delete(self):
        quote = Quotation.objects.create(
            buyer_name="Client Alpha",
            items=[{'sn': 1, 'description': 'Consulting Service', 'total': 15000.00}],
            grand_total=Decimal("15000.00")
        )
        self.assertEqual(quote.quotation_number, 'OCT0001')

        # Update status to SENT
        patch_res = self.client.patch(f'/api/quotations/{quote.id}/', {'status': 'SENT'}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['status'], 'SENT')

        # Delete quote
        del_res = self.client.delete(f'/api/quotations/{quote.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Quotation.objects.filter(id=quote.id).exists())
