from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.contrib.auth.models import User
from core.models import (
    Invoice, InvoiceItem, Payment, SupplierPayment,
    Purchase, PurchaseItem, StockMovement, SerialNumber,
    Expense, PartnerDrawings, PartnerSettlement, PartnerDeposit, BusinessProfile,
    Product, ProductCategory, CategoryAttribute, ProductSpecification,
    Brand, Service, ServiceCategory, Customer, Supplier, ExpenseCategory, Partner
)


class Command(BaseCommand):
    help = "Clear all transactions and all master data (products, categories, brands, customers, suppliers) while keeping admin logins and business profile."

    def handle(self, *args, **options):
        with transaction.atomic():
            # 1. Clear all transactions & stock
            InvoiceItem.objects.all().delete()
            Invoice.objects.all().delete()
            Payment.objects.all().delete()
            PurchaseItem.objects.all().delete()
            Purchase.objects.all().delete()
            SupplierPayment.objects.all().delete()
            StockMovement.objects.all().delete()
            SerialNumber.objects.all().delete()
            Expense.objects.all().delete()
            PartnerDrawings.objects.all().delete()
            PartnerSettlement.objects.all().delete()
            PartnerDeposit.objects.all().delete()

            # 2. Clear all products & catalog masters
            ProductSpecification.objects.all().delete()
            CategoryAttribute.objects.all().delete()
            p_count = Product.objects.count()
            Product.objects.all().delete()
            pc_count = ProductCategory.objects.count()
            ProductCategory.objects.all().delete()
            b_count = Brand.objects.count()
            Brand.objects.all().delete()

            # 3. Clear services
            s_count = Service.objects.count()
            Service.objects.all().delete()
            sc_count = ServiceCategory.objects.count()
            ServiceCategory.objects.all().delete()

            # 4. Clear contacts
            c_count = Customer.objects.count()
            Customer.objects.all().delete()
            sup_count = Supplier.objects.count()
            Supplier.objects.all().delete()

            # 5. Clear expenses, partners, & test users
            ec_count = ExpenseCategory.objects.count()
            ExpenseCategory.objects.all().delete()
            part_count = Partner.objects.count()
            Partner.objects.all().delete()

            User.objects.filter(username__in=[
                'audit_test_admin', 'stress_test_admin', 'speed_test_admin', 'audit_stress_user'
            ]).delete()

            # 6. Reset sequence counter
            bp = BusinessProfile.objects.first()
            if bp:
                bp.next_invoice_number = 1001
                bp.next_non_gst_number = 1001
                bp.save()

            self.stdout.write(self.style.SUCCESS(
                f"Successfully wiped all transactions and master data:\n"
                f" - {p_count} Products removed\n"
                f" - {pc_count} Product Categories removed\n"
                f" - {b_count} Brands removed\n"
                f" - {s_count} Services removed\n"
                f" - {sc_count} Service Categories removed\n"
                f" - {c_count} Customers removed\n"
                f" - {sup_count} Suppliers removed\n"
                f" - {ec_count} Expense Categories removed\n"
                f" - {part_count} Partners removed\n"
                f" - All Purchases, Invoices, Payments, Deposits, & Stock records cleared\n"
                f" - Kept Admin accounts ('admin', 'naveen') & Business Profile ('OCTANE')\n"
                f" - Reset invoice sequence counter to 1001"
            ))
