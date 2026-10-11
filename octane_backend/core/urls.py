from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserProfileView,
    ChangePasswordView,
    UserViewSet,
    BusinessProfileViewSet,
    CustomerViewSet,
    SupplierViewSet,
    PartnerViewSet,
    ProductCategoryViewSet,
    CategoryAttributeViewSet,
    BrandViewSet,
    ProductViewSet,
    ServiceCategoryViewSet,
    ServiceViewSet,
    SerialNumberViewSet,
    StockMovementViewSet,
    OpeningStockView,
    StockAdjustmentView,
    CurrentStockView,
    TaxPreviewView,
    InvoiceViewSet,
    PaymentViewSet,
    ProcessSalesReturnView,
    RecordDelayedPaymentView,
    CustomerOutstandingView,
    CustomerReceivablesSummaryView,
    PurchaseViewSet,
    ProcessPurchaseReturnView,
    RecordSupplierPaymentView,
    SupplierPaymentViewSet,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    PartnerDrawingsViewSet,
    PartnerSettlementViewSet,
    PartnerDepositViewSet,
    PartnerLedgerSummaryView,
    PartnerLedgerStatementView,
    DashboardMetricsView,
    ProfitAndLossReportView,
    AccountingReconciliationView,
    GstHsnReportView,
    InventoryValuationReportView,
    FinancialPaymentsLogView,
    SalesReportView,
    PurchaseReportView,
    InventoryReportView,
    GstReportView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'business-profile', BusinessProfileViewSet, basename='business-profile')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'partners', PartnerViewSet, basename='partner')

# Phase 2 routes
router.register(r'product-categories', ProductCategoryViewSet, basename='product-category')
router.register(r'category-attributes', CategoryAttributeViewSet, basename='category-attribute')
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'service-categories', ServiceCategoryViewSet, basename='service-category')
router.register(r'services', ServiceViewSet, basename='service')

# Phase 3 routes
router.register(r'serial-numbers', SerialNumberViewSet, basename='serial-number')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')

# Phase 5 routes
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')

# Phase 6 routes
router.register(r'purchases', PurchaseViewSet, basename='purchase')
router.register(r'supplier-payments', SupplierPaymentViewSet, basename='supplier-payment')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'expenses', ExpenseViewSet, basename='expense')

# Phase 7 routes
router.register(r'partner-drawings', PartnerDrawingsViewSet, basename='partner-drawing')
router.register(r'partner-settlements', PartnerSettlementViewSet, basename='partner-settlement')
router.register(r'partner-deposits', PartnerDepositViewSet, basename='partner-deposit')

urlpatterns = [
    # Auth endpoints (Username & Password JWT flow)
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', UserProfileView.as_view(), name='user_profile'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    
    # Inventory custom APIs
    path('inventory/opening-stock/', OpeningStockView.as_view(), name='opening_stock'),
    path('inventory/adjust-stock/', StockAdjustmentView.as_view(), name='adjust_stock'),
    path('inventory/current-stock/', CurrentStockView.as_view(), name='current_stock'),

    # Phase 4 GST Tax preview API
    path('tax/calculate-preview/', TaxPreviewView.as_view(), name='tax_preview'),

    # Phase 5 Payment & Credit custom APIs
    path('invoices/<int:invoice_id>/record-payment/', RecordDelayedPaymentView.as_view(), name='record_delayed_payment'),
    path('invoices/<int:invoice_id>/sales-return/', ProcessSalesReturnView.as_view(), name='process_sales_return'),
    path('customers/<int:customer_id>/outstanding/', CustomerOutstandingView.as_view(), name='customer_outstanding'),
    path('finance/customer-receivables/', CustomerReceivablesSummaryView.as_view(), name='customer_receivables_summary'),
    path('finance/all-payments/', FinancialPaymentsLogView.as_view(), name='financial_all_payments'),

    # Phase 6 Supplier Payment & Purchase Return custom APIs
    path('purchases/<int:purchase_id>/record-payment/', RecordSupplierPaymentView.as_view(), name='record_supplier_payment'),
    path('purchases/<int:purchase_id>/purchase-return/', ProcessPurchaseReturnView.as_view(), name='process_purchase_return'),

    # Phase 7 Partner Ledger custom APIs
    path('partner-ledger/summary/', PartnerLedgerSummaryView.as_view(), name='partner_ledger_summary_all'),
    path('partner-ledger/summary/<int:partner_id>/', PartnerLedgerSummaryView.as_view(), name='partner_ledger_summary_single'),
    path('partner-ledger/statement/<int:partner_id>/', PartnerLedgerStatementView.as_view(), name='partner_ledger_statement'),

    # Financial & Executive Reports APIs
    path('reports/dashboard/', DashboardMetricsView.as_view(), name='report_dashboard'),
    path('reports/pnl/', ProfitAndLossReportView.as_view(), name='report_pnl'),
    path('reports/reconciliation/', AccountingReconciliationView.as_view(), name='report_accounting_reconciliation'),
    path('reports/gst-hsn/', GstHsnReportView.as_view(), name='report_gst_hsn'),
    path('reports/inventory-valuation/', InventoryValuationReportView.as_view(), name='report_inventory_valuation'),

    # Phase 11: Detailed Report APIs
    path('reports/sales/', SalesReportView.as_view(), name='report_sales'),
    path('reports/purchases/', PurchaseReportView.as_view(), name='report_purchases'),
    path('reports/inventory/', InventoryReportView.as_view(), name='report_inventory'),
    path('reports/gst/', GstReportView.as_view(), name='report_gst'),

    # API endpoints
    path('', include(router.urls)),
]

