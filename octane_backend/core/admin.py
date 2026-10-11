from django.contrib import admin
from .models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, Product, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, InvoiceItem, Payment,
    Purchase, PurchaseItem, SupplierPayment, ExpenseCategory, Expense,
    PartnerDrawings, PartnerSettlement, PartnerDeposit
)


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'gstin', 'phone', 'email', 'invoice_prefix', 'next_invoice_number')


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'mobile', 'customer_type', 'gstin', 'city', 'is_active')
    list_filter = ('customer_type', 'is_active', 'state_name')
    search_fields = ('name', 'mobile', 'email', 'gstin', 'city')


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'mobile', 'gstin', 'city', 'is_active')
    list_filter = ('is_active', 'state_name')
    search_fields = ('name', 'mobile', 'email', 'gstin', 'city')


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ('name', 'mobile', 'email', 'ownership_percentage', 'is_active')
    search_fields = ('name', 'mobile', 'email')


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    search_fields = ('name', 'description')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'category', 'selling_price', 'hsn_sac', 'tracking_type', 'is_stock_enabled', 'is_active')
    list_filter = ('category', 'tracking_type', 'is_stock_enabled', 'is_active')
    search_fields = ('name', 'sku', 'brand', 'model_number', 'hsn_sac')


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    search_fields = ('name', 'description')


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('service_name', 'category', 'sac', 'default_rate', 'gst_rate', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('service_name', 'sac', 'description')


@admin.register(SerialNumber)
class SerialNumberAdmin(admin.ModelAdmin):
    list_display = ('serial_number', 'product', 'status', 'purchase_reference', 'invoice_reference', 'updated_at')
    list_filter = ('status', 'product')
    search_fields = ('serial_number', 'product__name', 'purchase_reference', 'invoice_reference')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'movement_type', 'quantity', 'reference_type', 'reference_id', 'serial_number', 'created_at')
    list_filter = ('movement_type', 'reference_type', 'created_at')
    search_fields = ('product__name', 'product__sku', 'reference_id', 'notes')


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'invoice_date', 'buyer_name', 'grand_total', 'total_paid_amount', 'balance_due_amount', 'payment_status', 'invoice_status')
    list_filter = ('payment_status', 'invoice_status', 'invoice_date')
    search_fields = ('invoice_number', 'buyer_name', 'buyer_gstin')
    inlines = [InvoiceItemInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('payment_number', 'invoice', 'customer', 'payment_date', 'payment_mode', 'amount', 'created_at')
    list_filter = ('payment_mode', 'payment_date')
    search_fields = ('payment_number', 'reference_number', 'notes')


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ('purchase_number', 'supplier', 'supplier_invoice_number', 'purchase_date', 'total_amount', 'paid_by_partner', 'payment_status')
    list_filter = ('payment_status', 'payment_mode', 'paid_by_partner')
    search_fields = ('purchase_number', 'supplier_invoice_number')
    inlines = [PurchaseItemInline]


@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = ('payment_number', 'purchase', 'supplier', 'payment_date', 'payment_mode', 'amount', 'created_at')
    list_filter = ('payment_mode', 'payment_date')
    search_fields = ('payment_number', 'reference_number', 'notes')



@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    search_fields = ('name', 'description')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('expense_number', 'category', 'expense_date', 'amount', 'payment_mode', 'paid_by_partner')
    list_filter = ('category', 'payment_mode', 'paid_by_partner')
    search_fields = ('expense_number', 'description', 'receipt_reference')


@admin.register(PartnerDrawings)
class PartnerDrawingsAdmin(admin.ModelAdmin):
    list_display = ('drawing_number', 'partner', 'drawing_date', 'amount', 'payment_mode')
    list_filter = ('partner', 'payment_mode')
    search_fields = ('drawing_number', 'partner__name', 'notes')


@admin.register(PartnerSettlement)
class PartnerSettlementAdmin(admin.ModelAdmin):
    list_display = ('settlement_number', 'from_partner', 'to_partner', 'settlement_date', 'amount', 'payment_mode')
    list_filter = ('from_partner', 'to_partner', 'payment_mode')
    search_fields = ('settlement_number', 'from_partner__name', 'to_partner__name', 'notes')


@admin.register(PartnerDeposit)
class PartnerDepositAdmin(admin.ModelAdmin):
    list_display = ('deposit_number', 'partner', 'deposit_date', 'amount', 'payment_mode', 'deposit_type')
    list_filter = ('partner', 'payment_mode', 'deposit_type')
    search_fields = ('deposit_number', 'partner__name', 'reference_number', 'notes')

