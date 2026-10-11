from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from rest_framework import viewsets, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from .models import (
    BusinessProfile, Customer, Supplier, Partner,
    ProductCategory, CategoryAttribute, Brand, Product, ServiceCategory, Service,
    SerialNumber, StockMovement, Invoice, InvoiceItem, Payment,
    Purchase, PurchaseItem, SupplierPayment, ExpenseCategory, Expense,
    PartnerDrawings, PartnerSettlement, PartnerDeposit
)
from django.contrib.auth.models import User
from .serializers import (
    UserSerializer,
    UserProfileUpdateSerializer,
    UserAdminSerializer,
    BusinessProfileSerializer, 
    CustomerSerializer, 
    SupplierSerializer, 
    PartnerSerializer,
    ProductCategorySerializer,
    CategoryAttributeSerializer,
    BrandSerializer,
    ProductSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
    SerialNumberSerializer,
    StockMovementSerializer,
    OpeningStockBatchSerializer,
    StockAdjustmentInputSerializer,
    UpdateSerialNumberStatusSerializer,
    InvoiceSerializer,
    PaymentSerializer,
    CreateInvoiceInputSerializer,
    RecordDelayedPaymentInputSerializer,
    PurchaseSerializer,
    CreatePurchaseInputSerializer,
    SupplierPaymentSerializer,
    SalesReturnInputSerializer,
    PurchaseReturnInputSerializer,
    RecordSupplierPaymentInputSerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
    PartnerDrawingsSerializer,
    PartnerSettlementSerializer,
    PartnerDepositSerializer
)
from .services.stock_service import StockService
from .services.tax_engine import TaxEngine
from .services.invoice_service import InvoiceService
from .services.invoice_formatter import InvoiceFormatter
from .services.purchase_service import PurchaseService
from .services.partner_ledger_service import PartnerLedgerService
from .services.reports_service import ReportsService
from .permissions import (
    IsAdminUser, 
    IsAdminOrReadOnly, 
    IsAdminOrPublicReadOnly,
    IsAdminOrCanCreateCustomer, 
    IsAdminOrCanCreateInvoice
)


class UserProfileView(APIView):
    """
    Returns or updates current authenticated user details and password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """
    Secure password change endpoint for current authenticated user.
    Verifies old_password and sets new_password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not new_password or len(new_password) < 6:
            return Response(
                {'error': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if old_password and not user.check_password(old_password):
            return Response(
                {'error': 'Current password entered is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only endpoint to view, create, update, and manage users.
    """
    queryset = User.objects.all().order_by('-id')
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminUser]



class BusinessProfileViewSet(viewsets.ModelViewSet):
    """
    Singleton ViewSet to view and update Business Profile.
    """
    queryset = BusinessProfile.objects.all()
    serializer_class = BusinessProfileSerializer
    permission_classes = [IsAdminOrPublicReadOnly]

    def list(self, request, *args, **kwargs):
        profile, _ = BusinessProfile.objects.get_or_create(id=1)
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        profile, _ = BusinessProfile.objects.get_or_create(id=1)
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Customers.
    """
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAdminOrCanCreateCustomer]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_type', 'is_active', 'state_name']
    search_fields = ['name', 'mobile', 'email', 'gstin', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.invoices.exists():
            return Response(
                {'error': f"Cannot delete customer '{instance.name}' because {instance.invoices.count()} invoice(s) are linked to them. Please deactivate the customer instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Suppliers / Vendors.
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'state_name']
    search_fields = ['name', 'mobile', 'email', 'gstin', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.purchases.exists():
            return Response(
                {'error': f"Cannot delete supplier '{instance.name}' because {instance.purchases.count()} purchase transaction(s) are linked to them. Please deactivate the supplier instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class PartnerViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Partners (Ramesh & Lokesh).
    """
    queryset = Partner.objects.all()
    serializer_class = PartnerSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'mobile', 'email']
    ordering_fields = ['name', 'ownership_percentage']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.drawings.exists() or instance.deposits.exists() or instance.settlements_paid.exists() or instance.settlements_received.exists():
            return Response(
                {'error': f"Cannot delete partner '{instance.name}' because financial transactions exist in their ledger. Please mark the partner as inactive instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if instance.purchases_funded.exists() or instance.expenses_funded.exists():
            return Response(
                {'error': f"Cannot delete partner '{instance.name}' because they have funded business purchases/expenses. Please mark the partner as inactive instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Product Categories.
    """
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.products.exists():
            return Response(
                {'error': f"Cannot delete category '{instance.name}' because {instance.products.count()} product(s) belong to it. Please reassign or delete those products first."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class CategoryAttributeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing ProductCategory attributes (RAM, Storage, CPU, Color, etc.).
    """
    queryset = CategoryAttribute.objects.select_related('category').all()
    serializer_class = CategoryAttributeSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'attribute_type']
    search_fields = ['name', 'options']
    ordering = ['display_order', 'name']


class BrandViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Product Brands.
    """
    queryset = Brand.objects.select_related('category').all()
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'origin', 'category__name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(Q(category_id=category_id) | Q(category__isnull=True))
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if Product.objects.filter(brand__iexact=instance.name).exists():
            return Response(
                {'error': f"Cannot delete brand '{instance.name}' because products in the catalog are assigned to this brand."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


from django.db import transaction

class ProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Physical Product Master catalog.
    """
    queryset = Product.objects.select_related('category').all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'tracking_type', 'is_stock_enabled', 'is_active']
    search_fields = ['name', 'sku', 'barcode', 'brand', 'model_number', 'hsn_sac', 'specifications_text', 'category__name', 'serial_numbers__serial_number']
    ordering_fields = ['name', 'selling_price', 'created_at']
    ordering = ['name']

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        product = Product.objects.get(pk=serializer.instance.pk)
        out_serializer = self.get_serializer(product)
        headers = self.get_success_headers(out_serializer.data)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        product = Product.objects.get(pk=instance.pk)
        out_serializer = self.get_serializer(product)
        return Response(out_serializer.data)

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.invoice_items.exists():
            return Response(
                {'error': f"Cannot delete product '{instance.name}' because it has customer sales history. Please deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if instance.purchase_items.exists():
            return Response(
                {'error': f"Cannot delete product '{instance.name}' because purchase transactions exist for it. Please deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if instance.stock_movements.exists():
            return Response(
                {'error': f"Cannot delete product '{instance.name}' because stock movements exist for it. Please deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def adjust_stock(self, request, pk=None):
        """
        Controlled physical stock adjustment endpoint for Admin.
        """
        product = self.get_object()
        if not product.is_active:
            return Response({'detail': f"Cannot adjust stock for inactive product '{product.name}'."}, status=status.HTTP_400_BAD_REQUEST)
        if not product.is_stock_enabled:
            return Response({'detail': f"Stock tracking is not enabled for product '{product.name}'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_stock = int(request.data.get('new_stock_quantity'))
        except (TypeError, ValueError):
            return Response({'detail': 'new_stock_quantity must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_stock < 0:
            return Response({'detail': 'new_stock_quantity cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')
        serial_numbers = request.data.get('serial_numbers', [])
        try:
            StockService.adjust_stock(product, new_stock, reason, request.user, serial_numbers=serial_numbers)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        product.refresh_from_db()
        serializer = self.get_serializer(product)
        return Response(serializer.data, status=status.HTTP_200_OK)



class ServiceCategoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Service Categories.
    """
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.services.exists():
            return Response(
                {'error': f"Cannot delete service category '{instance.name}' because {instance.services.count()} service(s) belong to it. Please reassign or delete those services first."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class ServiceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Service Master catalog (Labor/Repairs).
    """
    queryset = Service.objects.select_related('category').all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['service_name', 'sac', 'description']
    ordering_fields = ['service_name', 'default_rate', 'created_at']
    ordering = ['service_name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.invoice_items.exists():
            return Response(
                {'error': f"Cannot delete service '{instance.service_name}' because it has been invoiced in customer sales. Please deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class SerialNumberViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API endpoint for viewing product Serial Number registry.
    """
    queryset = SerialNumber.objects.select_related('product').all()
    serializer_class = SerialNumberSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['product', 'status']
    search_fields = ['serial_number', 'product__name', 'purchase_reference', 'invoice_reference']
    ordering = ['serial_number']

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def update_status(self, request, pk=None):
        serial = self.get_object()
        serializer = UpdateSerialNumberStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']

        if serial.status == 'SOLD' and new_status != 'SOLD':
            return Response(
                {"error": f"Cannot manually alter status of sold serial '{serial.serial_number}'. Use Sales Return to process return of sold items."},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = serial.status
        serial.status = new_status
        if new_status == 'AVAILABLE':
            serial.invoice_reference = None
        serial.save()

        return Response({
            "message": f"Serial '{serial.serial_number}' status updated from {old_status} to {new_status}.",
            "serial_number": serial.serial_number,
            "status": serial.status
        }, status=status.HTTP_200_OK)



class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API endpoint for viewing transaction-based Stock Movement audit logs.
    """
    queryset = StockMovement.objects.select_related('product', 'serial_number', 'created_by').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['product', 'movement_type', 'reference_type']
    search_fields = ['product__name', 'product__sku', 'reference_id', 'notes']
    ordering = ['-created_at']


class OpeningStockView(APIView):
    """
    API Endpoint to record initial Opening Stock batch for products.
    """
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        serializer = OpeningStockBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created_movements = []
        for item in serializer.validated_data['items']:
            product = get_object_or_404(Product, id=item['product_id'])
            
            if not product.is_active:
                raise ValidationError(f"Cannot record opening stock for inactive product '{product.name}'.")

            if not product.is_stock_enabled:
                raise ValidationError(f"Stock tracking is not enabled for product '{product.name}'.")

            item_cost = item.get('unit_cost')
            if item_cost is None or item_cost == Decimal('0.00'):
                item_cost = product.purchase_price

            movements = StockService.process_stock_in(
                product=product,
                quantity=item['quantity'],
                movement_type='OPENING',
                reference_type='OPENING_STOCK',
                reference_id='INITIAL',
                serial_numbers_list=item.get('serial_numbers', []),
                unit_cost=item_cost,
                notes=item.get('notes', 'Initial opening stock entry'),
                user=request.user
            )
            if movements:
                created_movements.extend(movements if isinstance(movements, list) else [movements])

        return Response({
            "message": f"Successfully created {len(created_movements)} opening stock movements.",
            "movements_count": len(created_movements)
        }, status=status.HTTP_201_CREATED)



class StockAdjustmentView(APIView):
    """
    API Endpoint to perform manual physical stock count adjustments.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = StockAdjustmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        product = get_object_or_404(Product, id=data['product_id'])

        if not product.is_active:
            raise ValidationError(f"Cannot adjust stock for inactive product '{product.name}'.")

        if not product.is_stock_enabled:
            raise ValidationError(f"Stock tracking is not enabled for product '{product.name}'.")

        result = StockService.adjust_stock(
            product=product,
            new_stock_quantity=data['new_stock_quantity'],
            reason=data.get('reason', 'Manual physical stock adjustment'),
            user=request.user,
            serial_numbers=data.get('serial_numbers', [])
        )

        return Response({
            "message": f"Stock adjusted successfully for product '{product.name}'. New current stock: {product.get_current_stock()}",
            "current_stock": product.get_current_stock()
        }, status=status.HTTP_200_OK)


class CurrentStockView(APIView):
    """
    API Endpoint returning live inventory dashboard stock counts & alerts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = Product.objects.filter(is_stock_enabled=True, is_active=True).select_related('category')

        category_id = request.query_params.get('category_id')
        if category_id:
            products = products.filter(category_id=category_id)

        search = (request.query_params.get('search') or '').strip().lower()
        status_param = request.query_params.get('status')
        
        inventory_data = []
        for p in products:
            if search:
                if search not in p.name.lower() and search not in (p.sku or '').lower() and search not in (p.category.name if p.category else '').lower():
                    continue

            curr_stock = p.get_current_stock()
            
            if curr_stock == 0:
                stock_status = "OUT_OF_STOCK"
            elif curr_stock <= p.min_stock_alert:
                stock_status = "LOW_STOCK"
            else:
                stock_status = "IN_STOCK"

            if status_param and status_param != 'ALL' and stock_status != status_param:
                continue

            inventory_data.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "specifications_text": p.specifications_text,
                "category_name": p.category.name if p.category else None,
                "unit": p.unit,
                "tracking_type": p.tracking_type,
                "purchase_price": p.purchase_price,
                "selling_price": p.selling_price,
                "current_stock": curr_stock,
                "min_stock_alert": p.min_stock_alert,
                "stock_status": stock_status,
                "stock_value": float(curr_stock * p.purchase_price)
            })

        return Response(inventory_data)


class TaxPreviewView(APIView):
    """
    API Endpoint for live POS Billing tax preview calculation before invoice creation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        seller_profile, _ = BusinessProfile.objects.get_or_create(id=1)
        
        customer_id = request.data.get('customer_id')
        buyer_state_code = request.data.get('buyer_state_code', seller_profile.state_code)

        if customer_id:
            customer = Customer.objects.filter(id=customer_id).first()
            if customer:
                buyer_state_code = customer.state_code

        items_data = request.data.get('items', [])
        if not items_data:
            return Response({"error": "No items provided for tax preview calculation."}, status=status.HTTP_400_BAD_REQUEST)

        tax_results = TaxEngine.calculate_invoice_taxes(
            items_data=items_data,
            seller_state_code=seller_profile.state_code,
            buyer_state_code=buyer_state_code
        )

        return Response(tax_results, status=status.HTTP_200_OK)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing Customer Invoices.
    """
    def get_queryset(self):
        qs = Invoice.objects.prefetch_related('items', 'payments').select_related('customer', 'created_by').all()
        # Data healing check for consistency across legacy records
        for inv in qs:
            has_credit = inv.payments.filter(payment_mode='CREDIT').exists()
            actual_paid = sum((p.amount for p in inv.payments.exclude(payment_mode='CREDIT')), Decimal('0.00'))
            expected_due = max(Decimal('0.00'), inv.grand_total - actual_paid)
            if has_credit or inv.total_paid_amount != actual_paid or inv.balance_due_amount != expected_due:
                inv.payments.filter(payment_mode='CREDIT').delete()
                inv.recalculate_payment_status()
                inv.save()
        return qs
    serializer_class = InvoiceSerializer
    pagination_class = None
    permission_classes = [IsAdminOrCanCreateInvoice]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'payment_status', 'invoice_status', 'invoice_date', 'invoice_type', 'is_gst']
    search_fields = ['invoice_number', 'buyer_name', 'buyer_gstin', 'items__description']
    ordering_fields = ['invoice_date', 'grand_total', 'created_at']
    ordering = ['-created_at']

    def create(self, request, *args, **kwargs):
        serializer = CreateInvoiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = InvoiceService.create_and_post_invoice(
            user=request.user,
            payload=serializer.validated_data
        )

        out_serializer = InvoiceSerializer(invoice)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='print-data')
    def print_data(self, request, pk=None):
        invoice = self.get_object()
        
        items_raw_data = []
        for item in invoice.items.all():
            items_raw_data.append({
                'item_type': item.item_type,
                'description': item.description,
                'hsn_sac': item.hsn_sac,
                'qty': float(item.quantity),
                'unit': item.unit,
                'rate': float(item.rate),
                'discount': float(item.discount_pct),
                'gst_rate': float(item.gst_rate)
            })

        print_payload = InvoiceFormatter.format_invoice_print_data(
            invoice_number=invoice.invoice_number,
            invoice_date=str(invoice.invoice_date),
            customer_obj=invoice.customer,
            items_raw_data=items_raw_data,
            delivery_note=invoice.delivery_note or '',
            mode_of_payment=invoice.mode_of_payment or 'Cash',
            reference_no=invoice.reference_no or '',
            buyer_order_no=invoice.buyer_order_no or '',
            dispatch_doc_no=invoice.dispatch_doc_no or '',
            dispatched_through=invoice.dispatched_through or '',
            destination=invoice.destination or '',
            terms_of_delivery=invoice.terms_of_delivery or ''
        )

        return Response(print_payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='sales-return', permission_classes=[IsAdminUser])
    def sales_return(self, request, pk=None):
        serializer = SalesReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InvoiceService.process_sales_return(
            user=request.user,
            invoice_id=pk,
            return_payload=serializer.validated_data
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='record-payment', permission_classes=[IsAdminOrCanCreateInvoice])
    def record_payment(self, request, pk=None):
        serializer = RecordDelayedPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment_res = InvoiceService.record_delayed_payment(
            user=request.user,
            invoice_id=pk,
            payment_payload=serializer.validated_data
        )
        if isinstance(payment_res, list):
            payment_serializer = PaymentSerializer(payment_res, many=True)
        else:
            payment_serializer = PaymentSerializer(payment_res)
        return Response(payment_serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()

        # 1. Block deletion if sales returns have been processed against this invoice
        sales_returns = StockMovement.objects.filter(
            reference_type='SALES_RETURN',
            reference_id=invoice.invoice_number
        )
        if sales_returns.exists():
            return Response(
                {"error": f"Cannot delete Invoice #{invoice.invoice_number} because customer sales returns have already been processed against it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Revert serial numbers from SOLD back to AVAILABLE
        for item in invoice.items.select_related('product', 'serial_number').all():
            if item.item_type == 'PRODUCT' and item.product:
                if item.product.tracking_type == 'SERIAL_NUMBER':
                    if item.serial_number:
                        item.serial_number.status = 'AVAILABLE'
                        item.serial_number.invoice_reference = None
                        item.serial_number.save()

        # 3. Clean up StockMovements created by this invoice (SALE outwards)
        StockMovement.objects.filter(
            reference_type='INVOICE',
            reference_id=invoice.invoice_number
        ).delete()

        # 4. Clean up Payments created for this invoice
        invoice.payments.all().delete()

        # 5. Delete invoice header (cascades InvoiceItems)
        inv_num = invoice.invoice_number
        invoice.delete()

        return Response(
            {"message": f"Invoice #{inv_num} and associated stock ledger movements have been deleted cleanly."},
            status=status.HTTP_200_OK
        )


class ProcessSalesReturnView(APIView):
    """
    API Endpoint to process customer sales return for an invoice.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, invoice_id):
        serializer = SalesReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = InvoiceService.process_sales_return(
            user=request.user,
            invoice_id=invoice_id,
            return_payload=serializer.validated_data
        )
        return Response(result, status=status.HTTP_200_OK)



class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API ViewSet for viewing payment records.
    """
    queryset = Payment.objects.select_related('invoice', 'customer', 'created_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAdminOrCanCreateInvoice]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['invoice', 'customer', 'payment_mode', 'payment_date']
    search_fields = ['payment_number', 'reference_number', 'notes', 'customer__name']
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-created_at']


class RecordDelayedPaymentView(APIView):
    """
    API Endpoint to record a delayed customer payment against a balance due.
    """
    permission_classes = [IsAdminOrCanCreateInvoice]

    def post(self, request, invoice_id):
        serializer = RecordDelayedPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_res = InvoiceService.record_delayed_payment(
            user=request.user,
            invoice_id=invoice_id,
            payment_payload=serializer.validated_data
        )

        if isinstance(payment_res, list):
            payment_serializer = PaymentSerializer(payment_res, many=True)
        else:
            payment_serializer = PaymentSerializer(payment_res)

        return Response(payment_serializer.data, status=status.HTTP_201_CREATED)


class CustomerOutstandingView(APIView):
    """
    API Endpoint returning customer credit dues and payment ledger balance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, customer_id):
        customer = get_object_or_404(Customer, id=customer_id)
        
        invoices = Invoice.objects.filter(customer=customer, invoice_status='POSTED')
        
        total_invoiced = sum(inv.grand_total for inv in invoices)
        total_paid = sum(inv.total_paid_amount for inv in invoices)
        balance_due = sum(inv.balance_due_amount for inv in invoices)

        pending_invoices = []
        for inv in invoices.filter(balance_due_amount__gt=0):
            pending_invoices.append({
                'invoice_id': inv.id,
                'invoice_number': inv.invoice_number,
                'invoice_date': inv.invoice_date,
                'grand_total': inv.grand_total,
                'total_paid_amount': inv.total_paid_amount,
                'balance_due_amount': inv.balance_due_amount,
                'payment_status': inv.payment_status
            })

        return Response({
            'customer_id': customer.id,
            'customer_name': customer.name,
            'mobile': customer.mobile,
            'gstin': customer.gstin,
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'balance_due': balance_due,
            'pending_invoices': pending_invoices
        })


class CustomerReceivablesSummaryView(APIView):
    """
    API Endpoint returning summary & customer breakdown for Customer Receivables module.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        customers = Customer.objects.prefetch_related('invoices').all()
        result = []
        
        posted_invoices_all = Invoice.objects.filter(invoice_status='POSTED')
        total_billed_all = posted_invoices_all.aggregate(sum=Sum('grand_total'))['sum'] or Decimal('0.00')
        total_paid_all = Payment.objects.exclude(payment_mode='CREDIT').aggregate(sum=Sum('amount'))['sum'] or Decimal('0.00')
        total_receivable_all = posted_invoices_all.filter(balance_due_amount__gt=0).aggregate(sum=Sum('balance_due_amount'))['sum'] or Decimal('0.00')

        for cust in customers:
            posted_invoices = cust.invoices.filter(invoice_status='POSTED')
            cust_billed = sum(inv.grand_total for inv in posted_invoices)
            cust_paid = sum(inv.total_paid_amount for inv in posted_invoices)
            cust_due = sum(inv.balance_due_amount for inv in posted_invoices)
            unpaid_count = posted_invoices.filter(balance_due_amount__gt=0).count()

            if cust_due > 0 or posted_invoices.exists():
                pending_invoices = []
                for inv in posted_invoices.filter(balance_due_amount__gt=0):
                    pending_invoices.append({
                        'id': inv.id,
                        'invoice_number': inv.invoice_number,
                        'invoice_date': str(inv.invoice_date),
                        'grand_total': float(inv.grand_total),
                        'total_paid_amount': float(inv.total_paid_amount),
                        'balance_due_amount': float(inv.balance_due_amount),
                        'payment_status': inv.payment_status,
                    })

                result.append({
                    'customer_id': cust.id,
                    'customer_name': cust.name,
                    'mobile': cust.mobile,
                    'customer_type': cust.customer_type,
                    'gstin': cust.gstin,
                    'city': cust.city,
                    'state_name': cust.state_name,
                    'total_billed': float(cust_billed),
                    'total_paid': float(cust_paid),
                    'balance_due': float(cust_due),
                    'unpaid_count': unpaid_count,
                    'pending_invoices': pending_invoices,
                })

        result.sort(key=lambda x: x['balance_due'], reverse=True)

        return Response({
            'total_billed': float(total_billed_all),
            'total_paid': float(total_paid_all),
            'total_receivable': float(total_receivable_all),
            'customers': result
        })


# ==========================================
# PHASE 6: PURCHASES & EXPENSES VIEWSETS
# ==========================================

class PurchaseViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Vendor Stock Purchases.
    """
    queryset = Purchase.objects.prefetch_related('items').select_related('supplier', 'paid_by_partner', 'created_by').all()
    serializer_class = PurchaseSerializer
    pagination_class = None
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'payment_mode', 'paid_by_partner', 'payment_status', 'purchase_date']
    search_fields = ['purchase_number', 'supplier_invoice_number', 'supplier__name', 'notes']
    ordering_fields = ['purchase_date', 'total_amount', 'created_at']
    ordering = ['-created_at']

    def create(self, request, *args, **kwargs):
        serializer = CreatePurchaseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        purchase = PurchaseService.create_and_post_purchase(
            user=request.user,
            payload=serializer.validated_data
        )

        out_serializer = PurchaseSerializer(purchase)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='purchase-return', permission_classes=[IsAdminUser])
    def purchase_return(self, request, pk=None):
        serializer = PurchaseReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = PurchaseService.process_purchase_return(
            user=request.user,
            purchase_id=pk,
            return_payload=serializer.validated_data
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='record-payment', permission_classes=[IsAdminUser])
    def record_payment(self, request, pk=None):
        serializer = RecordSupplierPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = PurchaseService.record_supplier_payment(
            user=request.user,
            purchase_id=pk,
            payment_payload=serializer.validated_data
        )
        out_serializer = SupplierPaymentSerializer(payment)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()

        # 1. Check if any serial number inwarded by this purchase has been sold
        linked_serials = SerialNumber.objects.filter(
            purchase_reference__icontains=purchase.purchase_number
        )
        sold_serials = linked_serials.filter(status='SOLD')
        if sold_serials.exists():
            sold_list = ", ".join(sold_serials.values_list('serial_number', flat=True)[:5])
            return Response(
                {"error": f"Cannot delete Purchase #{purchase.purchase_number} because serial number(s) inwarded by this purchase ({sold_list}) have already been sold in customer invoices."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Check if any purchase returns have been processed against this purchase
        return_movements = StockMovement.objects.filter(
            reference_type='PURCHASE_RETURN',
            reference_id=purchase.purchase_number
        )
        if return_movements.exists():
            return Response(
                {"error": f"Cannot delete Purchase #{purchase.purchase_number} because purchase returns have already been processed against it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. For quantity-tracked items, check if current stock is lower than purchase quantity
        for item in purchase.items.select_related('product').all():
            if item.product and item.product.tracking_type == 'QUANTITY' and item.product.is_stock_enabled:
                curr_stock = item.product.get_current_stock()
                if curr_stock < item.quantity:
                    return Response(
                        {"error": f"Cannot delete Purchase #{purchase.purchase_number} because {item.quantity - curr_stock} unit(s) of '{item.product.name}' have already been sold or moved out."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # 4. Clean up StockMovements created by this purchase
        StockMovement.objects.filter(
            reference_type='PURCHASE',
            reference_id=purchase.purchase_number
        ).delete()

        # 5. Clean up inwarded SerialNumbers (they are all AVAILABLE since we verified none are SOLD)
        linked_serials.delete()

        # 6. Clean up SupplierPayments linked to this purchase
        SupplierPayment.objects.filter(purchase=purchase).delete()

        # 7. Delete purchase header (cascades to PurchaseItems)
        purchase_num = purchase.purchase_number
        purchase.delete()

        return Response(
            {"message": f"Purchase #{purchase_num} and associated stock ledger movements have been deleted cleanly."},
            status=status.HTTP_200_OK
        )


class ProcessPurchaseReturnView(APIView):
    """
    API Endpoint to process supplier purchase return for a purchase.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, purchase_id):
        serializer = PurchaseReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = PurchaseService.process_purchase_return(
            user=request.user,
            purchase_id=purchase_id,
            return_payload=serializer.validated_data
        )
        return Response(result, status=status.HTTP_200_OK)


class RecordSupplierPaymentView(APIView):
    """
    API Endpoint to record a delayed supplier payment against a purchase.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, purchase_id):
        serializer = RecordSupplierPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = PurchaseService.record_supplier_payment(
            user=request.user,
            purchase_id=purchase_id,
            payment_payload=serializer.validated_data
        )
        out_serializer = SupplierPaymentSerializer(payment)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class SupplierPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API ViewSet for viewing supplier payment records.
    """
    queryset = SupplierPayment.objects.select_related('purchase', 'supplier', 'created_by').all()
    serializer_class = SupplierPaymentSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['payment_mode', 'purchase', 'supplier', 'payment_date']
    search_fields = ['payment_number', 'reference_number', 'notes', 'supplier__name']
    ordering = ['-created_at']



class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Expense Categories.
    """
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering = ['name']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.expenses.exists():
            return Response(
                {'error': f"Cannot delete expense category '{instance.name}' because {instance.expenses.count()} expense record(s) exist under it. Please mark the category as inactive instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Operating Business Expenses.
    """
    queryset = Expense.objects.select_related('category', 'paid_by_partner', 'created_by').all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'payment_mode', 'paid_by_partner', 'expense_date']
    search_fields = ['expense_number', 'description', 'receipt_reference']
    ordering_fields = ['expense_date', 'amount', 'created_at']
    ordering = ['-created_at']


# ==========================================
# PHASE 7: PARTNER LEDGER & SETTLEMENT VIEWSETS
# ==========================================

class PartnerDrawingsViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Personal Partner Drawings / Cash Withdrawals.
    """
    queryset = PartnerDrawings.objects.select_related('partner', 'created_by').all()
    serializer_class = PartnerDrawingsSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['partner', 'payment_mode', 'drawing_date']
    search_fields = ['drawing_number', 'partner__name', 'notes']
    ordering = ['-created_at']


class PartnerSettlementViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Inter-Partner Financial Settlements.
    """
    queryset = PartnerSettlement.objects.select_related('from_partner', 'to_partner', 'created_by').all()
    serializer_class = PartnerSettlementSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['from_partner', 'to_partner', 'payment_mode', 'settlement_date']
    search_fields = ['settlement_number', 'from_partner__name', 'to_partner__name', 'reference_number', 'notes']
    ordering = ['-created_at']


class PartnerDepositViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for Partner Cash/Bank Deposits & Handovers to Store.
    """
    queryset = PartnerDeposit.objects.select_related('partner', 'created_by').all()
    serializer_class = PartnerDepositSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['partner', 'payment_mode', 'deposit_type', 'deposit_date']
    search_fields = ['deposit_number', 'partner__name', 'reference_number', 'notes']
    ordering = ['-created_at']


class PartnerLedgerSummaryView(APIView):
    """
    API Endpoint returning live capital ledger balance summaries for Ramesh & Lokesh.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, partner_id=None):
        data = PartnerLedgerService.get_partner_ledger_summary(partner_id)
        return Response(data, status=status.HTTP_200_OK)


class PartnerLedgerStatementView(APIView):
    """
    API Endpoint returning chronological running ledger journal statement for a specific partner.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, partner_id):
        partner = get_object_or_404(Partner, id=partner_id)
        statement = PartnerLedgerService.get_chronological_statement(partner.id)
        summary = PartnerLedgerService._calculate_single_partner_summary(partner)

        return Response({
            'partner': PartnerSerializer(partner).data,
            'summary': summary,
            'statement': statement
        }, status=status.HTTP_200_OK)


# ==========================================
# REPORTS & DASHBOARD VIEWS
# ==========================================

class DashboardMetricsView(APIView):
    """
    API Endpoint returning high-level executive dashboard metrics.
    Supports optional date filtering (start_date, end_date).
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        metrics = ReportsService.get_dashboard_summary(start_date, end_date)
        return Response(metrics, status=status.HTTP_200_OK)


class ProfitAndLossReportView(APIView):
    """
    API Endpoint returning P&L Report for date range.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        report = ReportsService.get_profit_and_loss_report(start_date, end_date)
        return Response(report, status=status.HTTP_200_OK)


class AccountingReconciliationView(APIView):
    """
    API Endpoint returning diagnostic 14-point accounting reconciliation
    for inventory, sales, COGS, expenses, tax liabilities, and net profit.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        reconciliation = ReportsService.get_accounting_reconciliation(start_date, end_date)
        return Response(reconciliation, status=status.HTTP_200_OK)



class GstHsnReportView(APIView):
    """
    API Endpoint returning GST HSN/SAC Summary Report for GSTR-1 filing.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        report = ReportsService.get_gst_hsn_summary_report(start_date, end_date)
        return Response(report, status=status.HTTP_200_OK)


class InventoryValuationReportView(APIView):
    """
    API Endpoint returning Inventory Stock Valuation Report.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        report = ReportsService.get_inventory_valuation_report()
        return Response(report, status=status.HTTP_200_OK)


class FinancialPaymentsLogView(APIView):
    """
    API Endpoint returning unified monetary payment transactions across Customer Receipts,
    Supplier Payments, Operating Expenses, Partner Drawings, and Partner Settlements.
    Never includes CREDIT.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        date_from = request.query_params.get('start_date')
        date_to = request.query_params.get('end_date')
        mode_filter = request.query_params.get('payment_mode')
        type_filter = request.query_params.get('txn_type')
        search_query = (request.query_params.get('search') or '').strip().lower()

        transactions = []

        # 1. Customer Receipts (excluding CREDIT)
        if not type_filter or type_filter == 'ALL' or type_filter == 'CUSTOMER_RECEIPT':
            pmts = Payment.objects.exclude(payment_mode='CREDIT').select_related('invoice', 'customer')
            if date_from:
                pmts = pmts.filter(payment_date__gte=date_from)
            if date_to:
                pmts = pmts.filter(payment_date__lte=date_to)
            if mode_filter and mode_filter != 'ALL':
                pmts = pmts.filter(payment_mode=mode_filter)

            for p in pmts:
                cust_name = p.customer.name if p.customer else (p.invoice.buyer_name if p.invoice else 'Cash Customer')
                ref_num = p.reference_number or '—'
                notes_text = p.notes or ''
                doc_num = p.invoice.invoice_number if p.invoice else '—'

                if search_query and not (
                    search_query in p.payment_number.lower() or
                    search_query in cust_name.lower() or
                    search_query in ref_num.lower() or
                    search_query in notes_text.lower() or
                    search_query in doc_num.lower()
                ):
                    continue

                transactions.append({
                    'id': f"cust-{p.id}",
                    'txn_number': p.payment_number,
                    'date': str(p.payment_date),
                    'created_at': p.created_at.isoformat(),
                    'txn_type': 'CUSTOMER_RECEIPT',
                    'txn_type_label': 'Customer Receipt',
                    'transaction_type': 'Customer Payment',
                    'direction': 'IN',
                    'party_name': cust_name,
                    'payer_payee': cust_name,
                    'party_type': 'CUSTOMER',
                    'payment_mode': p.payment_mode,
                    'amount': float(p.amount),
                    'reference_number': ref_num,
                    'related_doc': doc_num,
                    'notes': notes_text,
                    'partner_allocation': p.partner_allocation_json,
                })

        # 2. Supplier Payments (excluding CREDIT)
        if not type_filter or type_filter == 'ALL' or type_filter == 'SUPPLIER_PAYMENT':
            spmts = SupplierPayment.objects.exclude(payment_mode='CREDIT').select_related('purchase', 'supplier')
            if date_from:
                spmts = spmts.filter(payment_date__gte=date_from)
            if date_to:
                spmts = spmts.filter(payment_date__lte=date_to)
            if mode_filter and mode_filter != 'ALL':
                spmts = spmts.filter(payment_mode=mode_filter)

            for sp in spmts:
                supp_name = sp.supplier.name if sp.supplier else 'Vendor'
                ref_num = sp.reference_number or '—'
                notes_text = sp.notes or ''
                doc_num = sp.purchase.purchase_number if sp.purchase else '—'

                if search_query and not (
                    search_query in sp.payment_number.lower() or
                    search_query in supp_name.lower() or
                    search_query in ref_num.lower() or
                    search_query in notes_text.lower() or
                    search_query in doc_num.lower()
                ):
                    continue

                transactions.append({
                    'id': f"supp-{sp.id}",
                    'txn_number': sp.payment_number,
                    'date': str(sp.payment_date),
                    'created_at': sp.created_at.isoformat(),
                    'txn_type': 'SUPPLIER_PAYMENT',
                    'txn_type_label': 'Supplier Payout',
                    'transaction_type': 'Purchase Payment',
                    'direction': 'OUT',
                    'party_name': supp_name,
                    'payer_payee': supp_name,
                    'party_type': 'SUPPLIER',
                    'payment_mode': sp.payment_mode,
                    'amount': float(sp.amount),
                    'reference_number': ref_num,
                    'related_doc': doc_num,
                    'notes': notes_text,
                    'partner_allocation': None,
                })

        # 3. Store-Paid Operating Expenses (excludes partner out-of-pocket expenses)
        if not type_filter or type_filter == 'ALL' or type_filter == 'EXPENSE':
            exps = Expense.objects.filter(paid_by_partner__isnull=True).exclude(payment_mode='PARTNER_OUT_OF_POCKET').select_related('category')
            if date_from:
                exps = exps.filter(expense_date__gte=date_from)
            if date_to:
                exps = exps.filter(expense_date__lte=date_to)
            if mode_filter and mode_filter != 'ALL':
                exps = exps.filter(payment_mode=mode_filter)

            for ex in exps:
                cat_name = ex.category.name if ex.category else "Operating Expense"
                payer_label = "Business Store"
                ref_num = ex.receipt_reference or ex.expense_number
                desc = ex.description or ''

                if search_query and not (
                    search_query in ex.expense_number.lower() or
                    search_query in cat_name.lower() or
                    search_query in desc.lower() or
                    search_query in ref_num.lower() or
                    search_query in payer_label.lower()
                ):
                    continue

                transactions.append({
                    'id': f"exp-{ex.id}",
                    'txn_number': ex.expense_number,
                    'date': str(ex.expense_date),
                    'created_at': ex.created_at.isoformat(),
                    'txn_type': 'EXPENSE',
                    'txn_type_label': f"Expense ({cat_name})",
                    'transaction_type': 'Business Expense',
                    'direction': 'OUT',
                    'party_name': payer_label,
                    'payer_payee': payer_label,
                    'party_type': 'EXPENSE',
                    'payment_mode': ex.payment_mode,
                    'amount': float(ex.amount),
                    'reference_number': ref_num,
                    'related_doc': cat_name,
                    'notes': desc,
                    'partner_allocation': None,
                })

        # 4. Partner Drawings (Company Cash/Bank Outflow)
        if not type_filter or type_filter == 'ALL' or type_filter == 'PARTNER_DRAWING':
            drawings = PartnerDrawings.objects.select_related('partner')
            if date_from:
                drawings = drawings.filter(drawing_date__gte=date_from)
            if date_to:
                drawings = drawings.filter(drawing_date__lte=date_to)
            if mode_filter and mode_filter != 'ALL':
                drawings = drawings.filter(payment_mode=mode_filter)

            for dr in drawings:
                p_name = dr.partner.name if dr.partner else 'Partner'
                notes_text = dr.notes or ''

                if search_query and not (
                    search_query in dr.drawing_number.lower() or
                    search_query in p_name.lower() or
                    search_query in notes_text.lower()
                ):
                    continue

                transactions.append({
                    'id': f"drw-{dr.id}",
                    'txn_number': dr.drawing_number,
                    'date': str(dr.drawing_date),
                    'created_at': dr.created_at.isoformat(),
                    'txn_type': 'PARTNER_DRAWING',
                    'txn_type_label': f"Partner Drawing ({p_name})",
                    'transaction_type': 'Partner Drawing',
                    'direction': 'OUT',
                    'party_name': p_name,
                    'payer_payee': f"Partner: {p_name}",
                    'party_type': 'PARTNER',
                    'payment_mode': dr.payment_mode,
                    'amount': float(dr.amount),
                    'reference_number': dr.drawing_number,
                    'related_doc': 'Capital Withdrawal',
                    'notes': notes_text,
                    'partner_allocation': {'partner_name': p_name},
                })

        # 5. Partner Deposits / Handovers (Money inflow into Store Cash Drawer / Store Bank)
        if not type_filter or type_filter == 'ALL' or type_filter == 'PARTNER_DEPOSIT':
            deps = PartnerDeposit.objects.select_related('partner')
            if date_from:
                deps = deps.filter(deposit_date__gte=date_from)
            if date_to:
                deps = deps.filter(deposit_date__lte=date_to)
            if mode_filter and mode_filter != 'ALL':
                deps = deps.filter(payment_mode=mode_filter)

            for dep in deps:
                p_name = dep.partner.name if dep.partner else 'Partner'
                type_lbl = 'Handover of Collections' if dep.deposit_type == 'CUSTOMER_COLLECTION_HANDOVER' else 'Capital Injection'
                ref_num = dep.reference_number or dep.deposit_number
                notes_text = dep.notes or ''

                if search_query and not (
                    search_query in dep.deposit_number.lower() or
                    search_query in p_name.lower() or
                    search_query in ref_num.lower() or
                    search_query in notes_text.lower()
                ):
                    continue

                transactions.append({
                    'id': f"dep-{dep.id}",
                    'txn_number': dep.deposit_number,
                    'date': str(dep.deposit_date),
                    'created_at': dep.created_at.isoformat(),
                    'txn_type': 'PARTNER_DEPOSIT',
                    'txn_type_label': f"Partner Handover ({p_name})",
                    'transaction_type': 'Partner Handover / Deposit',
                    'direction': 'IN',
                    'party_name': f"Partner: {p_name}",
                    'payer_payee': f"Partner: {p_name}",
                    'party_type': 'PARTNER',
                    'payment_mode': dep.payment_mode,
                    'amount': float(dep.amount),
                    'reference_number': ref_num,
                    'related_doc': type_lbl,
                    'notes': notes_text,
                    'partner_allocation': {'partner_name': p_name, 'deposit_type': dep.deposit_type},
                })

        # Sort all monetary transactions chronologically (newest first)
        transactions.sort(key=lambda x: (x['date'], x['created_at']), reverse=True)

        return Response(transactions, status=status.HTTP_200_OK)




# ==========================================
# PHASE 11: DETAILED REPORT VIEWS
# ==========================================

class SalesReportView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        report = ReportsService.get_sales_report(
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date'),
            customer_id=request.query_params.get('customer_id'),
            payment_status=request.query_params.get('payment_status'),
            search=request.query_params.get('search'),
            invoice_type=request.query_params.get('invoice_type'),
            is_gst=request.query_params.get('is_gst'),
        )
        return Response(report, status=status.HTTP_200_OK)

class PurchaseReportView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        report = ReportsService.get_purchase_report(
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date'),
            supplier_id=request.query_params.get('supplier_id'),
            payment_status=request.query_params.get('payment_status'),
            search=request.query_params.get('search'),
        )
        return Response(report, status=status.HTTP_200_OK)

class InventoryReportView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        low_stock_only = request.query_params.get('low_stock_only', '').lower() in ('1', 'true', 'yes')
        report = ReportsService.get_inventory_report(
            category_id=request.query_params.get('category_id'),
            low_stock_only=low_stock_only,
        )
        return Response(report, status=status.HTTP_200_OK)

class GstReportView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        report = ReportsService.get_gst_report(
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date'),
        )
        return Response(report, status=status.HTTP_200_OK)

