from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import (
    Invoice, InvoiceItem, Payment, SupplierPayment,
    Purchase, PurchaseItem, StockMovement, SerialNumber,
    Expense, PartnerDrawings, PartnerSettlement, PartnerDeposit, BusinessProfile
)


class Command(BaseCommand):
    help = "Clear all transactional data (invoices, payments, purchases, stock movements, expenses, serials) while keeping master records and users intact."

    def handle(self, *args, **options):
        with transaction.atomic():
            inv_count = Invoice.objects.count()
            pay_count = Payment.objects.count()
            purch_count = Purchase.objects.count()
            sm_count = StockMovement.objects.count()
            sn_count = SerialNumber.objects.count()
            exp_count = Expense.objects.count()
            sp_count = SupplierPayment.objects.count()
            draw_count = PartnerDrawings.objects.count()
            settle_count = PartnerSettlement.objects.count()

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

            bp = BusinessProfile.objects.first()
            if bp:
                bp.next_invoice_number = 1001
                bp.next_non_gst_number = 1001
                bp.save()

            self.stdout.write(self.style.SUCCESS(
                f"Successfully cleared:\n"
                f" - {inv_count} Invoices\n"
                f" - {pay_count} Customer Payments\n"
                f" - {purch_count} Supplier Purchases\n"
                f" - {sp_count} Supplier Payments\n"
                f" - {sm_count} Stock Movements\n"
                f" - {sn_count} Serial Numbers\n"
                f" - {exp_count} Operating Expenses\n"
                f" - {draw_count} Partner Drawings\n"
                f" - {settle_count} Partner Settlements\n"
                f"Reset invoice sequence counter to 1001."
            ))
