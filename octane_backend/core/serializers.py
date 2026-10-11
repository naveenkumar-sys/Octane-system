import re
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, CategoryAttribute, Brand, Product, ProductSpecification, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, InvoiceItem, Payment,
    Purchase, PurchaseItem, SupplierPayment, ExpenseCategory, Expense,
    PartnerDrawings, PartnerSettlement, PartnerDeposit
)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'role']
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'role']

    def get_role(self, obj):
        if obj.is_staff or obj.is_superuser or obj.groups.filter(name='Admin').exists():
            return 'ADMIN'
        return 'CASHIER'


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserAdminSerializer(serializers.ModelSerializer):
    role = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'role', 'password']
        read_only_fields = ['id', 'is_superuser']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['role'] = 'ADMIN' if (instance.is_staff or instance.is_superuser or instance.groups.filter(name='Admin').exists()) else 'CASHIER'
        return data

    def create(self, validated_data):
        role = validated_data.pop('role', 'CASHIER')
        password = validated_data.pop('password', 'octane123')
        is_staff = (role == 'ADMIN')
        user = User.objects.create_user(is_staff=is_staff, **validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if role is not None:
            instance.is_staff = (role == 'ADMIN')
        if password:
            instance.set_password(password)
        instance.save()
        return instance




class BusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    total_invoiced = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'

    def get_total_invoiced(self, obj):
        return sum(inv.grand_total for inv in obj.invoices.filter(invoice_status='POSTED'))

    def get_total_paid(self, obj):
        return sum(inv.total_paid_amount for inv in obj.invoices.filter(invoice_status='POSTED'))

    def get_balance_due(self, obj):
        return sum(inv.balance_due_amount for inv in obj.invoices.filter(invoice_status='POSTED'))

    def to_internal_value(self, data):
        if hasattr(data, '_mutable') and not data._mutable:
            data = data.copy()
        elif isinstance(data, dict):
            data = data.copy()
        if 'mobile' in data and data['mobile']:
            cleaned = re.sub(r'[\s\-\(\)]', '', str(data['mobile']))
            data['mobile'] = cleaned if cleaned else None
        return super().to_internal_value(data)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Customer name cannot be empty.")
        return cleaned

    def validate_mobile(self, value):
        if value:
            cleaned = re.sub(r'[\s\-\(\)]', '', value)
            if not re.match(r'^\+?\d{9,15}$', cleaned):
                raise serializers.ValidationError("Phone number must be 10-15 digits. Example: 9876543210")
            return cleaned
        return value

    def validate_gstin(self, value):
        if value:
            value = value.strip().upper()
            if len(value) != 15:
                raise serializers.ValidationError("GSTIN must be exactly 15 characters long.")
        return value

    def validate(self, attrs):
        gstin = attrs.get('gstin')
        if gstin and len(gstin) >= 2 and gstin[:2].isdigit():
            if not attrs.get('state_code') or attrs.get('state_code') == '29':
                attrs['state_code'] = gstin[:2]
        return attrs


class SupplierSerializer(serializers.ModelSerializer):
    total_purchased = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    balance_outstanding = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = '__all__'

    def get_total_purchased(self, obj):
        return sum(p.total_amount for p in obj.purchases.all())

    def get_total_paid(self, obj):
        return sum(p.paid_amount for p in obj.purchases.all())

    def get_balance_outstanding(self, obj):
        return sum((p.total_amount - p.paid_amount) for p in obj.purchases.all())

    def to_internal_value(self, data):
        if hasattr(data, '_mutable') and not data._mutable:
            data = data.copy()
        elif isinstance(data, dict):
            data = data.copy()
        if 'mobile' in data and data['mobile']:
            cleaned = re.sub(r'[\s\-\(\)]', '', str(data['mobile']))
            data['mobile'] = cleaned if cleaned else None
        return super().to_internal_value(data)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Supplier name cannot be empty.")
        return cleaned

    def validate_mobile(self, value):
        if value:
            cleaned = re.sub(r'[\s\-\(\)]', '', value)
            if not re.match(r'^\+?\d{9,15}$', cleaned):
                raise serializers.ValidationError("Phone number must be 10-15 digits. Example: 9876543210")
            return cleaned
        return value

    def validate_gstin(self, value):
        if value:
            value = value.strip().upper()
            if len(value) != 15:
                raise serializers.ValidationError("GSTIN must be exactly 15 characters long.")
        return value

    def validate(self, attrs):
        gstin = attrs.get('gstin')
        if gstin and len(gstin) >= 2 and gstin[:2].isdigit():
            if not attrs.get('state_code') or attrs.get('state_code') == '29':
                attrs['state_code'] = gstin[:2]
        return attrs


class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = '__all__'

    def to_internal_value(self, data):
        if hasattr(data, '_mutable') and not data._mutable:
            data = data.copy()
        elif isinstance(data, dict):
            data = data.copy()
        if 'mobile' in data and data['mobile']:
            cleaned = re.sub(r'[\s\-\(\)]', '', str(data['mobile']))
            data['mobile'] = cleaned if cleaned else None
        return super().to_internal_value(data)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Partner name cannot be empty.")
        qs = Partner.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"A partner named '{cleaned}' already exists.")
        return cleaned

    def validate_ownership_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Ownership percentage must be between 0% and 100%.")
        other_partners = Partner.objects.filter(is_active=True)
        if self.instance:
            other_partners = other_partners.exclude(id=self.instance.id)
        current_total = sum(p.ownership_percentage for p in other_partners)
        if (current_total + value) > 100:
            raise serializers.ValidationError(
                f"Total ownership percentage across all partners cannot exceed 100%. Current total of other partners is {current_total}%."
            )
        return value

    def validate_initial_capital(self, value):
        if value < 0:
            raise serializers.ValidationError("Initial capital cannot be negative.")
        return value

    def validate_mobile(self, value):
        if value:
            cleaned = re.sub(r'[\s\-\(\)]', '', value)
            if not re.match(r'^\+?\d{9,15}$', cleaned):
                raise serializers.ValidationError("Phone number must be 10-15 digits. Example: 9876543210")
            return cleaned
        return value

    def validate(self, attrs):
        if self.instance and 'initial_capital' in attrs:
            if attrs['initial_capital'] != self.instance.initial_capital:
                raise serializers.ValidationError({
                    "initial_capital": "Opening capital cannot be modified after partner registration. Use an admin capital adjustment instead."
                })
        return attrs


class CategoryAttributeSerializer(serializers.ModelSerializer):
    options = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = CategoryAttribute
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        opts = data.get('options')
        if isinstance(opts, list):
            data['options'] = ','.join(str(x).strip() for x in opts if str(x).strip())
        elif isinstance(opts, str):
            data['options'] = opts.strip()
        elif opts is None:
            data['options'] = ''
        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        raw_options = instance.options or ''
        if isinstance(raw_options, str) and raw_options.strip():
            ret['options'] = [o.strip() for o in raw_options.split(',') if o.strip()]
        else:
            ret['options'] = []
        return ret


class ProductSpecificationSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)

    class Meta:
        model = ProductSpecification
        fields = ['id', 'attribute', 'attribute_name', 'value']


class ProductCategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    attributes = CategoryAttributeSerializer(many=True, read_only=True)

    class Meta:
        model = ProductCategory
        fields = '__all__'

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Category name cannot be empty.")
        qs = ProductCategory.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"A category named '{cleaned}' already exists.")
        return cleaned


class BrandSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'category', 'category_name', 
            'origin', 'description', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if 'category' in data and (data['category'] == '' or data['category'] is None):
            data = data.copy() if hasattr(data, 'copy') else dict(data)
            data['category'] = None
        return super().to_internal_value(data)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Brand name cannot be empty.")
        qs = Brand.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"A brand named '{cleaned}' already exists.")
        return cleaned


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    current_stock = serializers.SerializerMethodField()
    specifications = ProductSpecificationSerializer(many=True, read_only=True)
    specifications_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    specifications_text = serializers.SerializerMethodField()
    hsn_sac = serializers.CharField(required=False, allow_blank=True, default="852411")

    class Meta:
        model = Product
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'sku' in data and (data['sku'] == '' or data['sku'] is None):
            data['sku'] = None
        if 'hsn_sac' in data and not str(data.get('hsn_sac', '')).strip():
            data['hsn_sac'] = "852411"
        return super().to_internal_value(data)

    def get_current_stock(self, obj):
        return obj.get_current_stock()

    def get_specifications_text(self, obj):
        specs = obj.specifications.select_related('attribute').all()
        if not specs:
            return ""
        return ", ".join([f"{s.attribute.name}: {s.value}" for s in specs])

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Product name cannot be empty.")
        return cleaned

    def validate_sku(self, value):
        if not value or not str(value).strip():
            return None
        cleaned = str(value).strip().upper()
        qs = Product.objects.filter(sku__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"Product with SKU '{cleaned}' already exists.")
        return cleaned

    def validate_selling_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Selling price cannot be negative.")
        return value

    def validate_purchase_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Purchase price cannot be negative.")
        return value

    def validate_min_stock_alert(self, value):
        if value < 0:
            raise serializers.ValidationError("Minimum stock alert limit cannot be negative.")
        return value

    def validate_hsn_sac(self, value):
        cleaned = str(value or '').strip()
        return cleaned or "852411"

    def create(self, validated_data):
        specs_data = validated_data.pop('specifications_input', [])
        product = super().create(validated_data)
        self._save_specifications(product, specs_data)
        return product

    def update(self, instance, validated_data):
        specs_data = validated_data.pop('specifications_input', None)
        product = super().update(instance, validated_data)
        if specs_data is not None:
            product.specifications.all().delete()
            self._save_specifications(product, specs_data)
        return product

    def _save_specifications(self, product, specs_data):
        for item in specs_data:
            attr_id = item.get('attribute_id') or item.get('attribute')
            val = str(item.get('value', '')).strip()
            if attr_id and val:
                try:
                    attr = CategoryAttribute.objects.get(id=attr_id)
                    ProductSpecification.objects.create(
                        product=product,
                        attribute=attr,
                        value=val
                    )
                except CategoryAttribute.DoesNotExist:
                    pass


class ServiceCategorySerializer(serializers.ModelSerializer):
    service_count = serializers.IntegerField(source='services.count', read_only=True)

    class Meta:
        model = ServiceCategory
        fields = '__all__'

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Service category name cannot be empty.")
        qs = ServiceCategory.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"A service category named '{cleaned}' already exists.")
        return cleaned


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    sac = serializers.CharField(required=False, allow_blank=True, default="998313")

    class Meta:
        model = Service
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'sac' in data and not str(data.get('sac', '')).strip():
            data['sac'] = "998313"
        return super().to_internal_value(data)

    def validate_service_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Service name cannot be empty.")
        return cleaned

    def validate_default_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Default service rate cannot be negative.")
        return value

    def validate_sac(self, value):
        cleaned = str(value or '').strip()
        return cleaned or "998313"


class SerialNumberSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_specifications = serializers.CharField(source='product.specifications_text', read_only=True)

    class Meta:
        model = SerialNumber
        fields = '__all__'


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_specifications = serializers.CharField(source='product.specifications_text', read_only=True)
    serial_number_text = serializers.CharField(source='serial_number.serial_number', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'


class OpeningStockItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), min_value=Decimal('0.00'))
    serial_numbers = serializers.ListField(
        child=serializers.CharField(max_length=100), 
        required=False, 
        default=list
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_product_id(self, value):
        product = Product.objects.filter(id=value).first()
        if not product:
            raise serializers.ValidationError(f"Product with ID {value} does not exist.")
        if not product.is_active:
            raise serializers.ValidationError(f"Cannot record opening stock for inactive product '{product.name}'.")
        if not product.is_stock_enabled:
            raise serializers.ValidationError(f"Stock tracking is not enabled for product '{product.name}'.")
        return value


class OpeningStockBatchSerializer(serializers.Serializer):
    items = OpeningStockItemSerializer(many=True)


class StockAdjustmentInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    new_stock_quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    serial_numbers = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list
    )

    def validate_product_id(self, value):
        product = Product.objects.filter(id=value).first()
        if not product:
            raise serializers.ValidationError(f"Product with ID {value} does not exist.")
        if not product.is_active:
            raise serializers.ValidationError(f"Cannot adjust stock for inactive product '{product.name}'.")
        if not product.is_stock_enabled:
            raise serializers.ValidationError(f"Stock tracking is not enabled for product '{product.name}'.")
        return value


class UpdateSerialNumberStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['AVAILABLE', 'DEFECTIVE', 'RETURNED'])
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class InvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_specifications = serializers.CharField(source='product.specifications_text', read_only=True)
    service_name = serializers.CharField(source='service.service_name', read_only=True)
    serial_number_str = serializers.CharField(source='serial_number.serial_number', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'


class CreateInvoiceItemInputSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=['PRODUCT', 'SERVICE'], default='PRODUCT')
    product_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.IntegerField(required=False, allow_null=True)
    serial_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    hsn_sac = serializers.CharField(required=False, allow_blank=True, default='852411')
    qty = serializers.DecimalField(max_digits=10, decimal_places=2, default=1.0, min_value=Decimal('0.01'))
    unit = serializers.CharField(required=False, allow_blank=True, default='NOS')
    rate = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.00'))
    discount = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.0, min_value=0, max_value=100)
    gst_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=18.0, min_value=0, max_value=100)


class CreatePaymentInputSerializer(serializers.Serializer):
    payer = serializers.CharField(required=False, allow_blank=True, default='BUSINESS')
    payment_mode = serializers.ChoiceField(choices=['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'], default='CASH')
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    reference_number = serializers.CharField(required=False, allow_blank=True, default='')
    partner_allocation_json = serializers.JSONField(required=False, allow_null=True)


class CreateInvoiceInputSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    buyer_name = serializers.CharField(required=False, allow_blank=True, default='')
    buyer_gstin = serializers.CharField(required=False, allow_blank=True, default='')
    buyer_state_code = serializers.CharField(required=False, allow_blank=True, default='29')
    buyer_address = serializers.CharField(required=False, allow_blank=True, default='')
    
    invoice_date = serializers.DateField(required=False)
    delivery_note = serializers.CharField(required=False, allow_blank=True, default='')
    mode_of_payment = serializers.CharField(required=False, allow_blank=True, default='Cash')
    reference_no = serializers.CharField(required=False, allow_blank=True, default='')
    buyer_order_no = serializers.CharField(required=False, allow_blank=True, default='')
    dispatch_doc_no = serializers.CharField(required=False, allow_blank=True, default='')
    dispatched_through = serializers.CharField(required=False, allow_blank=True, default='')
    destination = serializers.CharField(required=False, allow_blank=True, default='')
    terms_of_delivery = serializers.CharField(required=False, allow_blank=True, default='')

    items = CreateInvoiceItemInputSerializer(many=True)
    payments = CreatePaymentInputSerializer(many=True, required=False, default=list)
    partner_allocation_json = serializers.JSONField(required=False, allow_null=True)
    invoice_type = serializers.ChoiceField(choices=['TAX_INVOICE', 'NON_GST'], required=False, default='TAX_INVOICE')
    is_gst = serializers.BooleanField(required=False, default=True)


class RecordDelayedPaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    payment_mode = serializers.ChoiceField(choices=['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'], default='CASH', required=False)
    payment_date = serializers.DateField(required=False)
    reference_number = serializers.CharField(required=False, allow_blank=True, default='')
    partner_allocation_json = serializers.JSONField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    payments = CreatePaymentInputSerializer(many=True, required=False)


# ==========================================
# PHASE 6 SERIALIZERS
# ==========================================

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PurchaseItem
        fields = '__all__'


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    paid_by_partner_name = serializers.CharField(source='paid_by_partner.name', read_only=True)
    balance_amount = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = '__all__'

    def get_balance_amount(self, obj):
        return max(Decimal('0.00'), obj.total_amount - obj.paid_amount)


class CreatePurchaseItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    description = serializers.CharField(required=False, allow_blank=True, default='')
    hsn_sac = serializers.CharField(required=False, allow_blank=True, default='852411')
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    gst_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=18.0, min_value=0)
    serial_numbers_text = serializers.CharField(required=False, allow_blank=True, default='')


class CreatePurchaseInputSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True, default='')
    purchase_date = serializers.DateField(required=False)
    payment_mode = serializers.ChoiceField(
        choices=['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'PARTNER_OUT_OF_POCKET'],
        default='CASH'
    )
    paid_by_partner_id = serializers.IntegerField(required=False, allow_null=True)
    partner_split_json = serializers.JSONField(required=False, allow_null=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0)
    reference_number = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = CreatePurchaseItemInputSerializer(many=True)


class ExpenseCategorySerializer(serializers.ModelSerializer):
    expense_count = serializers.IntegerField(source='expenses.count', read_only=True)

    class Meta:
        model = ExpenseCategory
        fields = '__all__'

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Expense category name cannot be empty.")
        qs = ExpenseCategory.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"An expense category named '{cleaned}' already exists.")
        return cleaned


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    paid_by_partner_name = serializers.CharField(source='paid_by_partner.name', read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=ExpenseCategory.objects.all(), source='category', write_only=True
    )
    paid_by_partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(), source='paid_by_partner', write_only=True, required=False, allow_null=True
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    expense_date = serializers.DateField(required=False)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['expense_number', 'created_by']

    def validate(self, attrs):
        category = attrs.get('category')
        payment_mode = attrs.get('payment_mode')
        paid_by_partner = attrs.get('paid_by_partner')
        amount = attrs.get('amount') or (self.instance.amount if self.instance else Decimal('0.00'))

        # Check category on creation
        if not self.instance:
            if not category:
                raise serializers.ValidationError({"category_id": "Please select an expense category."})
            if not category.is_active:
                raise serializers.ValidationError({"category_id": "Cannot record expense under an inactive category."})
        else:
            if 'category' in attrs:
                if not category:
                    raise serializers.ValidationError({"category_id": "Please select an expense category."})
                if category != self.instance.category and not category.is_active:
                    raise serializers.ValidationError({"category_id": "Cannot assign an inactive category."})

        # Validate partner out of pocket mode
        if payment_mode == 'PARTNER_OUT_OF_POCKET':
            split_json = attrs.get('partner_split_json')
            if not paid_by_partner and not split_json:
                if not self.instance or (not self.instance.paid_by_partner and not self.instance.partner_split_json):
                    raise serializers.ValidationError({"paid_by_partner_id": "Please select the partner or partner split who paid out-of-pocket."})

        if paid_by_partner and not payment_mode:
            attrs['payment_mode'] = 'PARTNER_OUT_OF_POCKET'

        if paid_by_partner and not paid_by_partner.is_active:
            raise serializers.ValidationError({"paid_by_partner_id": f"Cannot attribute expense to inactive partner '{paid_by_partner.name}'."})

        # Validate partner split if provided
        split_json = attrs.get('partner_split_json')
        if split_json and isinstance(split_json, dict):
            total_split = Decimal('0.00')
            for p_key, p_val in split_json.items():
                p_obj = Partner.objects.filter(name__iexact=str(p_key).strip()).first()
                if not p_obj:
                    p_obj = Partner.objects.filter(id=str(p_key).strip()).first() if str(p_key).strip().isdigit() else None
                if not p_obj:
                    raise serializers.ValidationError({"partner_split_json": f"Partner '{p_key}' not found in active partner directory."})
                if not p_obj.is_active:
                    raise serializers.ValidationError({"partner_split_json": f"Cannot allocate expense split to inactive partner '{p_obj.name}'."})
                try:
                    s_val = Decimal(str(p_val))
                    if s_val <= Decimal('0.00'):
                        raise serializers.ValidationError({"partner_split_json": f"Split amount for '{p_key}' must be greater than zero."})
                    total_split += s_val
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"partner_split_json": f"Invalid split amount for '{p_key}'."})

            if total_split > amount:
                raise serializers.ValidationError({"partner_split_json": f"Total partner split (₹{total_split}) exceeds expense amount (₹{amount})."})

        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        
        # Auto-generate expense_number safely
        exp_count = Expense.objects.count() + 1
        num = f"EXP-{exp_count:04d}"
        while Expense.objects.filter(expense_number=num).exists():
            exp_count += 1
            num = f"EXP-{exp_count:04d}"
        validated_data['expense_number'] = num
        validated_data['created_by'] = user
        if 'expense_date' not in validated_data or not validated_data['expense_date']:
            validated_data['expense_date'] = timezone.now().date()

        return super().create(validated_data)


# ==========================================
# PHASE 7 SERIALIZERS
# ==========================================

class PartnerDrawingsSerializer(serializers.ModelSerializer):
    partner = serializers.PrimaryKeyRelatedField(read_only=True)
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(), source='partner', write_only=True
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    drawing_date = serializers.DateField(required=False)

    class Meta:
        model = PartnerDrawings
        fields = '__all__'
        read_only_fields = ['drawing_number', 'created_by']

    def validate(self, attrs):
        partner = attrs.get('partner')
        if partner and not partner.is_active:
            raise serializers.ValidationError({"partner_id": f"Cannot record drawing for inactive partner '{partner.name}'."})
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        draw_count = PartnerDrawings.objects.count() + 1
        num = f"DRW-{draw_count:04d}"
        while PartnerDrawings.objects.filter(drawing_number=num).exists():
            draw_count += 1
            num = f"DRW-{draw_count:04d}"
        validated_data['drawing_number'] = num
        validated_data['created_by'] = user
        if 'drawing_date' not in validated_data or not validated_data['drawing_date']:
            validated_data['drawing_date'] = timezone.now().date()

        return super().create(validated_data)


class PartnerSettlementSerializer(serializers.ModelSerializer):
    from_partner = serializers.PrimaryKeyRelatedField(read_only=True)
    to_partner = serializers.PrimaryKeyRelatedField(read_only=True)
    from_partner_name = serializers.CharField(source='from_partner.name', read_only=True)
    to_partner_name = serializers.CharField(source='to_partner.name', read_only=True)
    from_partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(), source='from_partner', write_only=True
    )
    to_partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(), source='to_partner', write_only=True
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    settlement_date = serializers.DateField(required=False)

    class Meta:
        model = PartnerSettlement
        fields = '__all__'
        read_only_fields = ['settlement_number', 'created_by']

    def validate(self, attrs):
        from_p = attrs.get('from_partner')
        to_p = attrs.get('to_partner')
        if from_p and to_p and from_p == to_p:
            raise serializers.ValidationError({"to_partner_id": "From Partner and To Partner cannot be the same person."})
        if from_p and not from_p.is_active:
            raise serializers.ValidationError({"from_partner_id": f"Cannot record settlement from inactive partner '{from_p.name}'."})
        if to_p and not to_p.is_active:
            raise serializers.ValidationError({"to_partner_id": f"Cannot record settlement to inactive partner '{to_p.name}'."})
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        stl_count = PartnerSettlement.objects.count() + 1
        num = f"STL-{stl_count:04d}"
        while PartnerSettlement.objects.filter(settlement_number=num).exists():
            stl_count += 1
            num = f"STL-{stl_count:04d}"
        validated_data['settlement_number'] = num
        validated_data['created_by'] = user
        if 'settlement_date' not in validated_data or not validated_data['settlement_date']:
            validated_data['settlement_date'] = timezone.now().date()

        return super().create(validated_data)


class PartnerDepositSerializer(serializers.ModelSerializer):
    partner = serializers.PrimaryKeyRelatedField(read_only=True)
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(), source='partner', write_only=True
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    deposit_date = serializers.DateField(required=False)

    class Meta:
        model = PartnerDeposit
        fields = '__all__'
        read_only_fields = ['deposit_number', 'created_by']

    def validate(self, attrs):
        partner = attrs.get('partner')
        if partner and not partner.is_active:
            raise serializers.ValidationError({"partner_id": f"Cannot record deposit/handover for inactive partner '{partner.name}'."})
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        dep_count = PartnerDeposit.objects.count() + 1
        num = f"DEP-{dep_count:04d}"
        while PartnerDeposit.objects.filter(deposit_number=num).exists():
            dep_count += 1
            num = f"DEP-{dep_count:04d}"
        validated_data['deposit_number'] = num
        validated_data['created_by'] = user
        if 'deposit_date' not in validated_data or not validated_data['deposit_date']:
            validated_data['deposit_date'] = timezone.now().date()

        return super().create(validated_data)


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_number = serializers.CharField(source='purchase.purchase_number', read_only=True)

    class Meta:
        model = SupplierPayment
        fields = '__all__'


class RecordSupplierPaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    payment_mode = serializers.ChoiceField(
        choices=['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'],
        default='CASH'
    )
    payment_date = serializers.DateField(required=False)
    reference_number = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class SalesReturnItemInputSerializer(serializers.Serializer):
    invoice_item_id = serializers.IntegerField(required=False, allow_null=True)
    product_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)
    serial_number = serializers.CharField(required=False, allow_blank=True, default='')
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class SalesReturnInputSerializer(serializers.Serializer):
    items = SalesReturnItemInputSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class PurchaseReturnItemInputSerializer(serializers.Serializer):
    purchase_item_id = serializers.IntegerField(required=False, allow_null=True)
    product_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)
    serial_number = serializers.CharField(required=False, allow_blank=True, default='')
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class PurchaseReturnInputSerializer(serializers.Serializer):
    items = PurchaseReturnItemInputSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')



