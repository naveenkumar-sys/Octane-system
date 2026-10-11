import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from core.models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, Product, SerialNumber, StockMovement,
    Invoice, InvoiceItem, Payment, ExpenseCategory, Expense,
    PartnerDrawings, PartnerSettlement, PartnerDeposit
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Removes all tester/audit dummy records created by test suites, leaving only real operational data."

    def handle(self, *args, **options):
        with transaction.atomic():
            test_prefix = "AUDIT_TEST_"

            # 1. Payments
            pmt_deleted, _ = Payment.objects.filter(
                payment_number__startswith="PAY-AUDIT"
            ).delete()
            pmt_inv_deleted, _ = Payment.objects.filter(
                invoice__customer__name__startswith=test_prefix
            ).delete()
            pmt_inv_deleted2, _ = Payment.objects.filter(
                created_by__username='audit_test_admin'
            ).delete()

            # 2. Invoices & Items
            inv_items_deleted, _ = InvoiceItem.objects.filter(
                product__name__startswith=test_prefix
            ).delete()
            inv_items_deleted2, _ = InvoiceItem.objects.filter(
                invoice__created_by__username='audit_test_admin'
            ).delete()
            invoices_deleted, _ = Invoice.objects.filter(
                created_by__username='audit_test_admin'
            ).delete()
            invoices_deleted2, _ = Invoice.objects.filter(
                customer__name__startswith=test_prefix
            ).delete()

            # 3. Partner Transactions
            dep_deleted, _ = PartnerDeposit.objects.filter(
                deposit_number__startswith="DEP-AUDIT"
            ).delete()
            drw_deleted, _ = PartnerDrawings.objects.filter(
                drawing_number__startswith="DRW-AUDIT"
            ).delete()
            stl_deleted, _ = PartnerSettlement.objects.filter(
                settlement_number__startswith="STL-AUDIT"
            ).delete()

            # 4. Expenses
            exp_deleted, _ = Expense.objects.filter(
                expense_number__startswith="EXP-AUDIT"
            ).delete()
            exp_cat_deleted, _ = ExpenseCategory.objects.filter(
                name__in=['Audit Utilities', 'Audit Test Hardware']
            ).delete()

            # 5. Stock & Serials
            sm_deleted, _ = StockMovement.objects.filter(
                product__name__startswith=test_prefix
            ).delete()
            sn_deleted, _ = SerialNumber.objects.filter(
                serial_number__startswith="SN-AUDIT"
            ).delete()

            # 6. Master Records
            prod_deleted, _ = Product.objects.filter(
                name__startswith=test_prefix
            ).delete()
            pcat_deleted, _ = ProductCategory.objects.filter(
                name='Audit Test Hardware'
            ).delete()
            cust_deleted, _ = Customer.objects.filter(
                name__startswith=test_prefix
            ).delete()
            supp_deleted, _ = Supplier.objects.filter(
                name__startswith=test_prefix
            ).delete()
            part_deleted, _ = Partner.objects.filter(
                name__startswith=test_prefix
            ).delete()

            # 7. Test User
            user_deleted, _ = User.objects.filter(
                username='audit_test_admin'
            ).delete()

            # 8. Reset next_invoice_number if no active invoices remain
            bp = BusinessProfile.objects.first()
            if bp and not Invoice.objects.exists():
                bp.next_invoice_number = 1001
                bp.next_non_gst_number = 1001
                bp.save()

            self.stdout.write(self.style.SUCCESS(
                f"Successfully removed all tester data:\n"
                f" - Invoices deleted: {invoices_deleted + invoices_deleted2}\n"
                f" - Payments deleted: {pmt_deleted + pmt_inv_deleted + pmt_inv_deleted2}\n"
                f" - Test Partners deleted: {part_deleted}\n"
                f" - Test Products deleted: {prod_deleted}\n"
                f" - Test Customers/Suppliers deleted: {cust_deleted + supp_deleted}\n"
                f" - Test Expenses/Drawings/Deposits/Settlements deleted: {exp_deleted + drw_deleted + dep_deleted + stl_deleted}\n"
                f" - Test Serials/Stock deleted: {sn_deleted + sm_deleted}\n"
                f" - Test Users deleted: {user_deleted}\n"
                f"All real business master records and active transactions preserved intact."
            ))
