from decimal import Decimal
from django.db import models
from django.db.models import Sum, Q
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.contrib.auth.models import User

phone_validator = RegexValidator(
    regex=r'^\+?\d{9,15}$',
    message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
)

gstin_validator = RegexValidator(
    regex=r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
    message="Invalid GSTIN format. Example: 29DRTPA7275L1ZW"
)


class BusinessProfile(models.Model):
    """
    Singleton model to store business settings and invoice templates info.
    """
    company_name = models.CharField(max_length=255, default="OCTANE SYSTEMS")
    logo_url = models.TextField(blank=True, default="")
    address_line1 = models.CharField(max_length=255, default="No.101, 2nd Floor, 14th Cross, 20th B Main")
    address_line2 = models.CharField(max_length=255, default="Venkateshwara Layout, Maruthinagar, BTM Layout")
    city = models.CharField(max_length=100, default="Bengaluru")
    pincode = models.CharField(max_length=20, default="560068")
    phone = models.CharField(max_length=50, default="7338515910")
    email = models.EmailField(default="contact@octanesystems.in")
    gstin = models.CharField(max_length=15, default="29DRTPA7275L1ZW", validators=[gstin_validator])
    state_name = models.CharField(max_length=100, default="Karnataka")
    state_code = models.CharField(max_length=10, default="29")
    
    # Bank Details
    bank_name = models.CharField(max_length=255, default="KOTAK BANK")
    account_number = models.CharField(max_length=100, default="3149366297")
    branch_name = models.CharField(max_length=255, default="VV PURUM")
    ifsc_code = models.CharField(max_length=50, default="KKBK0008055")
    
    # Invoice Config
    invoice_prefix = models.CharField(max_length=20, default="INV-")
    next_invoice_number = models.PositiveIntegerField(default=1001)
    non_gst_prefix = models.CharField(max_length=20, default="EST-")
    next_non_gst_number = models.PositiveIntegerField(default=1001)
    
    # Footer & Declarations
    declaration = models.TextField(
        default="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
    )
    terms_of_delivery = models.TextField(blank=True, default="Goods once sold will not be taken back or exchanged.")
    jurisdiction_text = models.CharField(max_length=255, default="SUBJECT TO BENGALURU JURISDICTION")
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Business Profile"
        verbose_name_plural = "Business Profile"

    def __str__(self):
        return f"{self.company_name} ({self.gstin})"


class Customer(models.Model):
    """
    Customer master store.
    """
    CUSTOMER_TYPE_CHOICES = (
        ('INDIVIDUAL', 'Individual'),
        ('BUSINESS', 'Business / Company'),
    )

    name = models.CharField(max_length=255)
    mobile = models.CharField(max_length=20, blank=True, null=True, validators=[phone_validator])
    email = models.EmailField(blank=True, null=True)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES, default='INDIVIDUAL')
    gstin = models.CharField(max_length=15, blank=True, null=True)
    
    # Address details
    billing_address_line1 = models.CharField(max_length=255, blank=True, null=True)
    billing_address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, default="Bengaluru")
    pincode = models.CharField(max_length=20, blank=True, null=True)
    state_name = models.CharField(max_length=100, default="Karnataka")
    state_code = models.CharField(max_length=10, default="29")
    shipping_address = models.TextField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['mobile']),
            models.Index(fields=['gstin']),
        ]

    def __str__(self):
        return f"{self.name} ({self.mobile or 'No Mobile'})"


class Supplier(models.Model):
    """
    Supplier / Vendor master.
    """
    name = models.CharField(max_length=255)
    mobile = models.CharField(max_length=20, blank=True, null=True, validators=[phone_validator])
    email = models.EmailField(blank=True, null=True)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    
    address_line1 = models.CharField(max_length=255, blank=True, null=True)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, default="Bengaluru")
    pincode = models.CharField(max_length=20, blank=True, null=True)
    state_name = models.CharField(max_length=100, default="Karnataka")
    state_code = models.CharField(max_length=10, default="29")
    
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['gstin']),
        ]

    def __str__(self):
        return f"{self.name} ({self.gstin or 'Unregistered'})"


class Partner(models.Model):
    """
    Partner / Business Owner profile (e.g., Ramesh & Lokesh).
    """
    name = models.CharField(max_length=100, unique=True)
    mobile = models.CharField(max_length=20, blank=True, null=True, validators=[phone_validator])
    email = models.EmailField(blank=True, null=True)
    ownership_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=50.00,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    initial_capital = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"Partner: {self.name} ({self.ownership_percentage}%)"


# ==========================================
# PHASE 2: PRODUCT & SERVICE MASTERS
# ==========================================

class ProductCategory(models.Model):
    """
    Category for physical products (e.g., Laptop, Laptop Accessories, Mobile, CCTV, Printer).
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Product Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class CategoryAttribute(models.Model):
    """
    Configurable dynamic attributes for a ProductCategory (e.g., RAM, Storage, CPU, Color, DPI).
    """
    ATTRIBUTE_TYPE_CHOICES = (
        ('TEXT', 'Text Input'),
        ('NUMBER', 'Numeric Value'),
        ('DROPDOWN', 'Dropdown Selection'),
    )

    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, related_name='attributes')
    name = models.CharField(max_length=100)
    attribute_type = models.CharField(max_length=20, choices=ATTRIBUTE_TYPE_CHOICES, default='TEXT')
    options = models.TextField(blank=True, null=True, help_text="Comma-separated options for DROPDOWN type e.g. 4GB,8GB,16GB")
    is_required = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        unique_together = ('category', 'name')

    def __str__(self):
        return f"{self.category.name} -> {self.name} ({self.attribute_type})"


class Brand(models.Model):
    """
    Brand / Manufacturer master (e.g., Dell, HP, Lenovo, Hikvision, Samsung, Kingston).
    Can be optionally associated with a ProductCategory.
    """
    name = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='brands'
    )
    origin = models.CharField(max_length=100, blank=True, null=True, help_text="Country of Origin / Manufacturer")
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class Product(models.Model):
    """
    Physical product master (Laptops, Accessories, RAM, SSD, Printers, CCTV parts, etc.).
    MUST maintain stock.
    """
    TRACKING_TYPE_CHOICES = (
        ('QUANTITY', 'Quantity Tracking'),
        ('SERIAL_NUMBER', 'Serial Number Tracking'),
    )

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True, blank=True, null=True)
    category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True, related_name='products')
    brand = models.CharField(max_length=100, blank=True, null=True)
    model_number = models.CharField(max_length=100, blank=True, null=True)
    
    hsn_sac = models.CharField(max_length=20, default="852411")
    unit = models.CharField(max_length=20, default="NOS")  # e.g., NOS, SET, PCS, MTR
    
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00, validators=[MinValueValidator(0), MaxValueValidator(100)])
    
    is_stock_enabled = models.BooleanField(default=True)
    tracking_type = models.CharField(max_length=20, choices=TRACKING_TYPE_CHOICES, default='QUANTITY')
    min_stock_alert = models.PositiveIntegerField(default=2)
    
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['sku']),
            models.Index(fields=['hsn_sac']),
            models.Index(fields=['tracking_type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.unit} @ ₹{self.selling_price})"

    def save(self, *args, **kwargs):
        if not self.sku or not str(self.sku).strip():
            self.sku = None
        else:
            self.sku = str(self.sku).strip().upper()
        super().save(*args, **kwargs)

    def get_current_stock(self):
        if not self.is_stock_enabled:
            return 999999

        stock_in_types = ['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN']
        stock_out_types = ['SALE', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT']

        total_in = StockMovement.objects.filter(
            product=self,
            movement_type__in=stock_in_types
        ).aggregate(total=Sum('quantity'))['total'] or 0

        total_out = StockMovement.objects.filter(
            product=self,
            movement_type__in=stock_out_types
        ).aggregate(total=Sum('quantity'))['total'] or 0

        return max(0, total_in - total_out)

    @property
    def specifications_text(self):
        specs = self.specifications.all()
        if not specs:
            return ""
        return ", ".join([s.value for s in specs if s.value])


class ProductSpecification(models.Model):
    """
    Key-Value specification for a specific Product instance based on its CategoryAttributes.
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='specifications')
    attribute = models.ForeignKey(CategoryAttribute, on_delete=models.CASCADE, related_name='product_specifications')
    value = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['attribute__display_order', 'attribute__name']
        unique_together = ('product', 'attribute')

    def __str__(self):
        return f"{self.product.name} - {self.attribute.name}: {self.value}"


class ServiceCategory(models.Model):
    """
    Category for non-physical services (e.g., Repair, Software Installation, CCTV Service).
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Service Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Service(models.Model):
    """
    Service master (Laptop Repair, Windows Installation, Cleaning, Labor).
    MUST NOT maintain stock.
    """
    service_name = models.CharField(max_length=255)
    category = models.ForeignKey(ServiceCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='services')
    sac = models.CharField(max_length=20, default="998313")  # SAC code for IT services
    
    default_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00, validators=[MinValueValidator(0), MaxValueValidator(100)])
    
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['service_name']
        indexes = [
            models.Index(fields=['service_name']),
            models.Index(fields=['sac']),
        ]

    def __str__(self):
        return f"Service: {self.service_name} (@ ₹{self.default_rate})"


# ==========================================
# PHASE 3: STOCK & INVENTORY ENGINE
# ==========================================

class SerialNumber(models.Model):
    """
    Serial Number registry for physical products (e.g. Laptops, High-value devices).
    """
    STATUS_CHOICES = (
        ('AVAILABLE', 'Available'),
        ('SOLD', 'Sold'),
        ('RETURNED', 'Returned'),
        ('DEFECTIVE', 'Defective / Damaged'),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='serial_numbers')
    serial_number = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    
    purchase_reference = models.CharField(max_length=100, blank=True, null=True)
    invoice_reference = models.CharField(max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('product', 'serial_number')
        ordering = ['serial_number']
        indexes = [
            models.Index(fields=['serial_number']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.product.name} - S/N: {self.serial_number} ({self.status})"


class StockMovement(models.Model):
    """
    Immutable transaction-based Stock Movement ledger for all physical product stock changes.
    """
    MOVEMENT_TYPE_CHOICES = (
        ('OPENING', 'Opening Stock (In)'),
        ('PURCHASE', 'Purchase (In)'),
        ('SALE', 'Sale (Out)'),
        ('SALES_RETURN', 'Sales Return (In)'),
        ('PURCHASE_RETURN', 'Purchase Return (Out)'),
        ('ADJUSTMENT_IN', 'Stock Adjustment (In)'),
        ('ADJUSTMENT_OUT', 'Stock Adjustment (Out)'),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPE_CHOICES)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    
    reference_type = models.CharField(max_length=50, default='MANUAL')
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    
    serial_number = models.ForeignKey(SerialNumber, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['movement_type']),
            models.Index(fields=['reference_type', 'reference_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.product.name} | {self.movement_type} | Qty: {self.quantity} | Ref: {self.reference_type}-{self.reference_id}"


# ==========================================
# PHASE 5: INVOICE & PAYMENT ENGINE
# ==========================================

class Invoice(models.Model):
    """
    Immutable Customer Invoice Header.
    """
    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Unpaid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Fully Paid'),
    )

    INVOICE_STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted / Final'),
        ('CANCELLED', 'Cancelled'),
    )

    INVOICE_TYPE_CHOICES = (
        ('TAX_INVOICE', 'Tax Invoice (GST)'),
        ('NON_GST', 'Non-GST / Estimate Bill'),
    )

    invoice_number = models.CharField(max_length=50, unique=True)
    invoice_date = models.DateField()
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    seller_name = models.CharField(max_length=255, default="OCTANE SYSTEMS")
    seller_gstin = models.CharField(max_length=15, default="29DRTPA7275L1ZW")
    seller_state_code = models.CharField(max_length=10, default="29")
    
    buyer_name = models.CharField(max_length=255)
    buyer_gstin = models.CharField(max_length=15, blank=True, null=True)
    buyer_state_code = models.CharField(max_length=10, default="29")
    buyer_address = models.TextField(blank=True, null=True)
    
    delivery_note = models.CharField(max_length=255, blank=True, null=True)
    mode_of_payment = models.CharField(max_length=100, default="Cash")
    reference_no = models.CharField(max_length=100, blank=True, null=True)
    buyer_order_no = models.CharField(max_length=100, blank=True, null=True)
    dispatch_doc_no = models.CharField(max_length=100, blank=True, null=True)
    dispatched_through = models.CharField(max_length=100, blank=True, null=True)
    destination = models.CharField(max_length=100, blank=True, null=True)
    terms_of_delivery = models.TextField(blank=True, null=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    total_cgst = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_sgst = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_igst = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    balance_due_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='UNPAID')
    invoice_status = models.CharField(max_length=20, choices=INVOICE_STATUS_CHOICES, default='POSTED')
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPE_CHOICES, default='TAX_INVOICE')
    is_gst = models.BooleanField(default=True)

    amount_in_words = models.TextField(blank=True, null=True)
    tax_amount_in_words = models.TextField(blank=True, null=True)
    partner_allocation_json = models.JSONField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['invoice_date']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['invoice_status']),
            models.Index(fields=['invoice_type']),
            models.Index(fields=['is_gst']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} | {self.buyer_name} | ₹{self.grand_total}"

    def recalculate_payment_status(self):
        """
        Calculates paid amount strictly from actual monetary payments (excluding CREDIT).
        Single source of truth for invoice payment status & balances.
        """
        actual_paid = sum(
            (p.amount for p in self.payments.exclude(payment_mode='CREDIT')),
            Decimal('0.00')
        )
        self.total_paid_amount = actual_paid
        self.balance_due_amount = max(Decimal('0.00'), self.grand_total - actual_paid)

        if self.total_paid_amount == Decimal('0.00'):
            self.payment_status = 'UNPAID'
        elif self.total_paid_amount >= self.grand_total and self.grand_total > Decimal('0.00'):
            self.payment_status = 'PAID'
        else:
            self.payment_status = 'PARTIALLY_PAID'
        return self.payment_status


class InvoiceItem(models.Model):
    """
    Line Item snapshot inside an Invoice (Product or Service).
    """
    ITEM_TYPE_CHOICES = (
        ('PRODUCT', 'Physical Product'),
        ('SERVICE', 'Non-Physical Service'),
    )

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default='PRODUCT')
    
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    serial_number = models.ForeignKey(SerialNumber, on_delete=models.SET_NULL, null=True, blank=True)

    description = models.TextField()
    hsn_sac = models.CharField(max_length=20, default="852411")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    unit = models.CharField(max_length=20, default="NOS")
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    taxable_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.description[:30]} ({self.quantity} x ₹{self.rate})"


class Payment(models.Model):
    """
    Multi-mode Payment receipt record attached to Invoice / Customer.
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay / PhonePe'),
        ('CARD', 'Credit / Debit Card'),
        ('BANK_TRANSFER', 'Bank Transfer / NEFT / IMPS'),
        ('CHEQUE', 'Cheque'),
    )

    payment_number = models.CharField(max_length=50, unique=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='payments')
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    payment_date = models.DateField()
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, default='CASH')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    partner_allocation_json = models.JSONField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment_number']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['payment_mode']),
        ]

    def __str__(self):
        return f"Payment {self.payment_number} | {self.payment_mode} | ₹{self.amount}"


# ==========================================
# PHASE 6: PURCHASES & EXPENSES MODULES
# ==========================================

class Purchase(models.Model):
    """
    Supplier / Vendor Stock Purchase Header.
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay'),
        ('CARD', 'Card'),
        ('BANK_TRANSFER', 'Bank Transfer / NEFT'),
        ('CREDIT', 'Supplier Credit / Dues'),
        ('PARTNER_OUT_OF_POCKET', 'Paid Out-of-Pocket by Partner'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Unpaid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Fully Paid'),
    )

    purchase_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    supplier_invoice_number = models.CharField(max_length=100, blank=True, null=True)  # e.g., MI-4285 from Matrix Infotech
    
    purchase_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    payment_mode = models.CharField(max_length=35, choices=PAYMENT_MODE_CHOICES, default='CASH')
    paid_by_partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases_funded')
    partner_split_json = models.JSONField(blank=True, null=True)  # Custom split e.g. {"Ramesh": 1130000, "Lokesh": 50000}
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PAID')
    
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['purchase_number']),
            models.Index(fields=['supplier_invoice_number']),
            models.Index(fields=['purchase_date']),
        ]

    def __str__(self):
        return f"Purchase {self.purchase_number} | {self.supplier.name if self.supplier else 'Vendor'} | ₹{self.total_amount}"


class PurchaseItem(models.Model):
    """
    Line Item inside a Supplier Purchase (Physical Goods).
    Triggers Stock IN automatically.
    """
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_items')
    
    description = models.TextField(blank=True, null=True)
    hsn_sac = models.CharField(max_length=20, default="852411")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    serial_numbers_text = models.TextField(blank=True, null=True)  # Comma separated serials e.g. "DL001, DL002"

    def __str__(self):
        return f"{self.purchase.purchase_number} - {self.product.name} (Qty: {self.quantity})"


class SupplierPayment(models.Model):
    """
    Payment made to Supplier/Vendor against a Purchase or supplier credit payable.
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay'),
        ('CARD', 'Card'),
        ('BANK_TRANSFER', 'Bank Transfer / NEFT / IMPS'),
        ('CHEQUE', 'Cheque'),
    )

    payment_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='payments')
    purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_payments')
    
    payment_date = models.DateField()
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, default='CASH')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment_number']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['supplier']),
        ]

    def __str__(self):
        return f"SupplierPayment {self.payment_number} | {self.supplier.name} | ₹{self.amount}"



class ExpenseCategory(models.Model):
    """
    Category for operational business expenses (Rent, Electricity, Internet, Salaries, Tea).
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Expense Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Expense(models.Model):
    """
    Operating Business Expense entry.
    Tracks out-of-pocket funding by Ramesh or Lokesh.
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay'),
        ('CARD', 'Card'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('PARTNER_OUT_OF_POCKET', 'Paid Out-of-Pocket by Partner'),
    )

    expense_number = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, related_name='expenses')
    expense_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    
    payment_mode = models.CharField(max_length=35, choices=PAYMENT_MODE_CHOICES, default='CASH')
    paid_by_partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses_funded')
    partner_split_json = models.JSONField(blank=True, null=True)  # Custom split e.g. {"Ramesh": 3000, "Lokesh": 2000}
    
    description = models.TextField()
    receipt_reference = models.CharField(max_length=100, blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['expense_number']),
            models.Index(fields=['expense_date']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return f"Expense {self.expense_number} | {self.category.name if self.category else 'General'} | ₹{self.amount}"


class PartnerDrawings(models.Model):
    """
    Personal cash/bank withdrawal by a Partner (Ramesh or Lokesh).
    Reduces the partner's capital ledger balance.
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay'),
        ('BANK_TRANSFER', 'Bank Transfer'),
    )

    drawing_number = models.CharField(max_length=50, unique=True)
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='drawings')
    drawing_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, default='CASH')
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Partner Drawings"
        indexes = [
            models.Index(fields=['drawing_number']),
            models.Index(fields=['partner']),
            models.Index(fields=['drawing_date']),
        ]

    def __str__(self):
        return f"Drawing {self.drawing_number} | {self.partner.name} | ₹{self.amount}"


class PartnerSettlement(models.Model):
    """
    Inter-partner settlement transaction (e.g. Ramesh pays Lokesh directly to balance equity/funds).
    """
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash'),
        ('UPI', 'UPI / GPay'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
    )

    settlement_number = models.CharField(max_length=50, unique=True)
    from_partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='settlements_paid')
    to_partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='settlements_received')
    settlement_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, default='CASH')
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Partner Settlements"
        indexes = [
            models.Index(fields=['settlement_number']),
            models.Index(fields=['from_partner']),
            models.Index(fields=['to_partner']),
            models.Index(fields=['settlement_date']),
        ]

    def __str__(self):
        return f"Settlement {self.settlement_number} | {self.from_partner.name} -> {self.to_partner.name} | ₹{self.amount}"


class PartnerDeposit(models.Model):
    """
    Cash / UPI handover or capital deposit by a Partner into the Store Cash Drawer or Company Bank Account.
    - Used when a Partner collects cash/UPI from a customer and hands it over to the store till/bank.
    - Or when a Partner injects fresh working capital directly into the business.
    Increases Store Cash/Bank (+).
    Credits (+) the Partner's ledger (offsets the collection debit or adds equity).
    """
    DEPOSIT_TYPE_CHOICES = (
        ('CUSTOMER_COLLECTION_HANDOVER', 'Handover of Collected Customer Payments'),
        ('CAPITAL_INJECTION', 'Additional Working Capital Deposit'),
    )
    PAYMENT_MODE_CHOICES = (
        ('CASH', 'Cash to Till'),
        ('BANK_TRANSFER', 'Bank Transfer to Company Account'),
        ('UPI', 'UPI to Company Account'),
        ('CHEQUE', 'Cheque to Company Account'),
    )

    deposit_number = models.CharField(max_length=50, unique=True)
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='deposits')
    deposit_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, default='CASH')
    deposit_type = models.CharField(max_length=40, choices=DEPOSIT_TYPE_CHOICES, default='CUSTOMER_COLLECTION_HANDOVER')
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Partner Deposits & Handovers"
        indexes = [
            models.Index(fields=['deposit_number']),
            models.Index(fields=['partner']),
            models.Index(fields=['deposit_date']),
            models.Index(fields=['deposit_type']),
        ]

    def __str__(self):
        return f"Deposit {self.deposit_number} | {self.partner.name} | ₹{self.amount} ({self.deposit_type})"

