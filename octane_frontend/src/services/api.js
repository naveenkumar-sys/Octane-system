const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');

/**
 * Token management helpers
 */
export const getToken = () => localStorage.getItem('octane_access_token');
export const getRefreshToken = () => localStorage.getItem('octane_refresh_token');
export const setTokens = (access, refresh) => {
  if (access) localStorage.setItem('octane_access_token', access);
  if (refresh) localStorage.setItem('octane_refresh_token', refresh);
};
export const clearTokens = () => {
  localStorage.removeItem('octane_access_token');
  localStorage.removeItem('octane_refresh_token');
};

/**
 * Core Request wrapper supporting JWT Auth & Auto-Refresh
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle Token Expiry (401 Unauthorized) by attempting refresh once
  if (response.status === 401 && getRefreshToken()) {
    const refreshSuccess = await refreshTokenFlow();
    if (refreshSuccess) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      response = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      window.dispatchEvent(new Event('auth-logout'));
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData === 'object') {
        if (errorData.detail) errorMessage = errorData.detail;
        else if (errorData.error) errorMessage = errorData.error;
        else {
          errorMessage = Object.entries(errorData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(' | ');
        }
      }
    } catch {
      // Ignore json parse error
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Refresh JWT Token Flow
 */
async function refreshTokenFlow() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (res.ok) {
      const data = await res.json();
      setTokens(data.access, data.refresh || refresh);
      return true;
    }
  } catch (err) {
    console.error('Failed to refresh token:', err);
  }

  return false;
}

/**
 * Backend API Service Endpoints Object
 */
export const api = {
  // Auth & Profile
  login: (username, password) =>
    apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getProfile: () => apiRequest('/auth/me/'),
  updateProfile: (data) =>
    apiRequest('/auth/me/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data) =>
    apiRequest('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // User Management (Admin)
  getUsers: () => apiRequest('/users/'),
  createUser: (userData) =>
    apiRequest('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (id, userData) =>
    apiRequest(`/users/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  deleteUser: (id) =>
    apiRequest(`/users/${id}/`, {
      method: 'DELETE',
    }),

  // Masters - Business Profile
  getBusinessProfile: () => apiRequest('/business-profile/'),
  updateBusinessProfile: (data) =>
    apiRequest('/business-profile/', { method: 'POST', body: JSON.stringify(data) }),

  // Masters - Product Categories
  getProductCategories: () => apiRequest('/product-categories/'),
  createProductCategory: (data) =>
    apiRequest('/product-categories/', { method: 'POST', body: JSON.stringify(data) }),
  updateProductCategory: (id, data) =>
    apiRequest(`/product-categories/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),

  // Masters - Category Attributes
  getCategoryAttributes: (params = '') => apiRequest(`/category-attributes/${params}`),
  createCategoryAttribute: (data) =>
    apiRequest('/category-attributes/', { method: 'POST', body: JSON.stringify(data) }),
  updateCategoryAttribute: (id, data) =>
    apiRequest(`/category-attributes/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategoryAttribute: (id) =>
    apiRequest(`/category-attributes/${id}/`, { method: 'DELETE' }),

  // Masters - Brands
  getBrands: (params = '') => apiRequest(`/brands/${params}`),
  getBrand: (id) => apiRequest(`/brands/${id}/`),
  createBrand: (data) => apiRequest('/brands/', { method: 'POST', body: JSON.stringify(data) }),
  updateBrand: (id, data) => apiRequest(`/brands/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchBrand: (id, data) => apiRequest(`/brands/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBrand: (id) => apiRequest(`/brands/${id}/`, { method: 'DELETE' }),

  // Masters - Products
  getProducts: (params = '') => apiRequest(`/products/${params}`),
  getProduct: (id) => apiRequest(`/products/${id}/`),
  createProduct: (data) => apiRequest('/products/', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => apiRequest(`/products/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchProduct: (id, data) => apiRequest(`/products/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id) => apiRequest(`/products/${id}/`, { method: 'DELETE' }),

  // Masters - Service Categories
  getServiceCategories: () => apiRequest('/service-categories/'),
  createServiceCategory: (data) =>
    apiRequest('/service-categories/', { method: 'POST', body: JSON.stringify(data) }),
  updateServiceCategory: (id, data) =>
    apiRequest(`/service-categories/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),

  // Masters - Services
  getServices: (params = '') => apiRequest(`/services/${params}`),
  getService: (id) => apiRequest(`/services/${id}/`),
  createService: (data) => apiRequest('/services/', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) => apiRequest(`/services/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchService: (id, data) => apiRequest(`/services/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id) => apiRequest(`/services/${id}/`, { method: 'DELETE' }),

  // Masters - Customers
  getCustomers: (params = '') => apiRequest(`/customers/${params}`),
  getCustomer: (id) => apiRequest(`/customers/${id}/`),
  createCustomer: (data) => apiRequest('/customers/', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => apiRequest(`/customers/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchCustomer: (id, data) => apiRequest(`/customers/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Masters - Suppliers
  getSuppliers: (params = '') => apiRequest(`/suppliers/${params}`),
  getSupplier: (id) => apiRequest(`/suppliers/${id}/`),
  createSupplier: (data) => apiRequest('/suppliers/', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id, data) => apiRequest(`/suppliers/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchSupplier: (id, data) => apiRequest(`/suppliers/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  getPartners: (params = '') => apiRequest(`/partners/${params}`),
  getPartner: (id) => apiRequest(`/partners/${id}/`),
  createPartner: (data) => apiRequest('/partners/', { method: 'POST', body: JSON.stringify(data) }),
  updatePartner: (id, data) => apiRequest(`/partners/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchPartner: (id, data) => apiRequest(`/partners/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePartner: (id) => apiRequest(`/partners/${id}/`, { method: 'DELETE' }),

  getExpenseCategories: (params = '') => apiRequest(`/expense-categories/${params}`),
  getExpenseCategory: (id) => apiRequest(`/expense-categories/${id}/`),
  createExpenseCategory: (data) => apiRequest('/expense-categories/', { method: 'POST', body: JSON.stringify(data) }),
  updateExpenseCategory: (id, data) => apiRequest(`/expense-categories/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  patchExpenseCategory: (id, data) => apiRequest(`/expense-categories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteExpenseCategory: (id) => apiRequest(`/expense-categories/${id}/`, { method: 'DELETE' }),

  // Inventory & Serials
  getCurrentStock: (params = '') => apiRequest(`/inventory/current-stock/${params}`),
  getSerialNumbers: (params = '') => apiRequest(`/serial-numbers/${params}`),
  updateSerialNumberStatus: (id, data) =>
    apiRequest(`/serial-numbers/${id}/update_status/`, { method: 'POST', body: JSON.stringify(data) }),
  getStockMovements: (params = '') => apiRequest(`/stock-movements/${params}`),
  postOpeningStock: (data) => apiRequest('/inventory/opening-stock/', { method: 'POST', body: JSON.stringify(data) }),
  postStockAdjustment: (data) => apiRequest('/inventory/adjust-stock/', { method: 'POST', body: JSON.stringify(data) }),

  // Transactions - Purchases
  getPurchases: (params = '') => apiRequest(`/purchases/${params}`),
  getPurchase: (id) => apiRequest(`/purchases/${id}/`),
  createPurchase: (data) => apiRequest('/purchases/', { method: 'POST', body: JSON.stringify(data) }),
  recordSupplierPayment: (purchaseId, data) =>
    apiRequest(`/purchases/${purchaseId}/record-payment/`, { method: 'POST', body: JSON.stringify(data) }),
  processPurchaseReturn: (purchaseId, data) =>
    apiRequest(`/purchases/${purchaseId}/purchase-return/`, { method: 'POST', body: JSON.stringify(data) }),
  cancelPurchase: (purchaseId, data) =>
    apiRequest(`/purchases/${purchaseId}/cancel/`, { method: 'POST', body: JSON.stringify(data) }),
  getSupplierPayments: (params = '') => apiRequest(`/supplier-payments/${params}`),
  getInvoices: (params = '') => apiRequest(`/invoices/${params}`),
  getInvoice: (id) => apiRequest(`/invoices/${id}/`),
  createInvoice: (data) => apiRequest('/invoices/', { method: 'POST', body: JSON.stringify(data) }),
  recordInvoicePayment: (invoiceId, data) =>
    apiRequest(`/invoices/${invoiceId}/record-payment/`, { method: 'POST', body: JSON.stringify(data) }),
  processSalesReturn: (invoiceId, data) =>
    apiRequest(`/invoices/${invoiceId}/sales-return/`, { method: 'POST', body: JSON.stringify(data) }),
  cancelInvoice: (invoiceId, data) =>
    apiRequest(`/invoices/${invoiceId}/cancel/`, { method: 'POST', body: JSON.stringify(data) }),
  getPayments: (params = '') => apiRequest(`/payments/${params}`),
  getAllPayments: (params = '') => apiRequest(`/finance/all-payments/${params}`),
  getExpenses: (params = '') => apiRequest(`/expenses/${params}`),
  createExpense: (data) => apiRequest('/expenses/', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id, data) => apiRequest(`/expenses/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id) => apiRequest(`/expenses/${id}/`, { method: 'DELETE' }),
  createExpenseCategory: (data) => apiRequest('/expense-categories/', { method: 'POST', body: JSON.stringify(data) }),
  getPartnerDrawings: () => apiRequest('/partner-drawings/'),
  createPartnerDrawing: (data) => apiRequest('/partner-drawings/', { method: 'POST', body: JSON.stringify(data) }),
  getPartnerSettlements: () => apiRequest('/partner-settlements/'),
  createPartnerSettlement: (data) => apiRequest('/partner-settlements/', { method: 'POST', body: JSON.stringify(data) }),
  getPartnerDeposits: () => apiRequest('/partner-deposits/'),
  createPartnerDeposit: (data) => apiRequest('/partner-deposits/', { method: 'POST', body: JSON.stringify(data) }),

  // Financial Reports & Ledgers
  getDashboardMetrics: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.append('start_date', start);
    if (end) params.append('end_date', end);
    const qs = params.toString();
    return apiRequest(`/reports/dashboard/${qs ? `?${qs}` : ''}`);
  },
  getPnlReport: (start, end) =>
    apiRequest(`/reports/pnl/?start_date=${start || ''}&end_date=${end || ''}`),
  getAccountingReconciliation: (start, end) =>
    apiRequest(`/reports/reconciliation/?start_date=${start || ''}&end_date=${end || ''}`),
  getGstHsnReport: (start, end) =>
    apiRequest(`/reports/gst-hsn/?start_date=${start || ''}&end_date=${end || ''}`),
  getInventoryValuation: () => apiRequest('/reports/inventory-valuation/'),
  getPartnerLedgerSummary: (id) =>
    apiRequest(id ? `/partner-ledger/summary/${id}/` : '/partner-ledger/summary/'),
  getPartnerLedgerStatement: (id) => apiRequest(`/partner-ledger/statement/${id}/`),
  getCustomerOutstanding: (id) => apiRequest(`/customers/${id}/outstanding/`),
  getCustomerReceivablesSummary: () => apiRequest('/finance/customer-receivables/'),

  // Phase 11: Detailed Report APIs
  getSalesReport: (params = '') => apiRequest(`/reports/sales/${params}`),
  getPurchaseReport: (params = '') => apiRequest(`/reports/purchases/${params}`),
  getInventoryReport: (params = '') => apiRequest(`/reports/inventory/${params}`),
  getGstReport: (params = '') => apiRequest(`/reports/gst/${params}`),

  // Business Profile & Store Settings
  getBusinessProfile: () => apiRequest('/business-profile/'),
  updateBusinessProfile: (data) =>
    apiRequest('/business-profile/', { method: 'POST', body: JSON.stringify(data) }),
};
