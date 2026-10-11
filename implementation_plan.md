# Octane Systems - Final Complete Implementation Plan

## Goal Description
Build a robust, fast, and simple billing, stock/inventory tracking, income, expense, payment management, and partner ledger application for **Octane Systems** (Laptop & Computer sales/service business). 

The system implements a transaction-based **Stock Movement Architecture** and a comprehensive **Payment Engine** (supporting split payment modes, delayed/partial payments, customer credit ledgers) for operations managed by partners **Ramesh** and **Lokesh**.

---

## Proposed Database Schema (DRF + PostgreSQL)

```text
+------------------------------------+       +------------------------------------+
|              Customer              |       |              Supplier              |
+------------------------------------+       +------------------------------------+
| id, name, mobile, email            |       | id, name, mobile, email            |
| gstin, customer_type               |       | gstin                              |
| billing_address_line1, line2       |       | address_line1, line2               |
| city, pincode, state_name, code    |       | city, pincode, state_name, code    |
| shipping_address                   |       | active_status                      |
| active_status                      |       +------------------------------------+
+------------------------------------+

+-----------------------------------------------------------------------------------+
|                                     Product                                       |
+-----------------------------------------------------------------------------------+
| id, name, sku, category, brand, model, hsn_sac, unit                              |
| purchase_price, selling_price, gst_rate                                           |
| is_stock_enabled (bool), tracking_type (QUANTITY | SERIAL_NUMBER), is_active      |
+-----------------------------------------------------------------------------------+
                                      |
                                      +---------------------------------------------+
                                      | 1:N                                         | 1:N
                                      v                                             v
                       +-----------------------------+               +-----------------------------+
                       |        SerialNumber         |               |        StockMovement        |
                       +-----------------------------+               +-----------------------------+
                       | id, product_id              |               | id, product_id              |
                       | serial_number (string)      |               | movement_type (ENUM)        |
                       | status (AVAILABLE|SOLD|...) |               | quantity (decimal/int)      |
                       | invoice_item_id             |               | reference_type, ref_id      |
                       | purchase_item_id            |               | serial_number_id (optional) |
                       +-----------------------------+               | created_at, created_by      |
                                                                     +-----------------------------+

+-----------------------------------------------------------------------------------+
|                                     Service                                       |
+-----------------------------------------------------------------------------------+
| id, service_name, sac, default_rate, gst_rate, description, is_active             |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
|                                     Invoice                                       |
+-----------------------------------------------------------------------------------+
| id, invoice_number, invoice_date, customer_id                                     |
| seller_gstin, seller_state, buyer_gstin, buyer_state, buyer_address               |
| subtotal, discount, taxable_amount, cgst_amount, sgst_amount, igst_amount        |
| grand_total, total_paid_amount, balance_due_amount                                |
| payment_status (UNPAID | PARTIALLY_PAID | PAID)                                   |
| invoice_status (DRAFT | POSTED | CANCELLED)                                       |
| amount_in_words, tax_amount_in_words                                              |
+-----------------------------------------------------------------------------------+
                                      |
                                      +---------------------------------------------+
                                      | 1:N                                         | 1:N
                                      v                                             v
                       +-----------------------------+               +-----------------------------+
                       |         InvoiceItem         |               |           Payment           |
                       +-----------------------------+               +-----------------------------+
                       | id, invoice_id              |               | id, payment_number, date    |
                       | item_type (PRODUCT|SERVICE) |               | invoice_id / purchase_id    |
                       | product_id / service_id     |               | customer_id / supplier_id   |
                       | hsn_sac, qty, rate, discount|               | payment_mode (CASH|UPI|...) |
                       | taxable_value, gst_rate     |               | amount, reference_number    |
                       | total_amount, serial_num_id |               | partner_allocation_json     |
                       +-----------------------------+               +-----------------------------+

+-------------------------------------+       +-------------------------------------+
|          Partner (Ramesh/Lokesh)    |       |         PartnerLedgerEntry          |
+-------------------------------------+       +-------------------------------------+
| id, name, mobile, ownership_pct     | ----> | id, partner_id, date, entry_type    |
+-------------------------------------+       | description, credit_amt, debit_amt  |
                                              | running_balance, ref_type, ref_id   |
                                              +-------------------------------------+
```

---

## Detailed Payment Architecture

### 1. Split Payment Support (Multi-Mode Payments)
A single invoice or purchase can be paid via multiple payment modes simultaneously:
* **Example**:
  * Invoice Total: **₹50,000**
  * Split Payment:
    * Cash: `₹10,000`
    * UPI / GPay: `₹20,000`
    * Card: `₹15,000`
    * Credit / Pending: `₹5,000`
  * System creates **3 Payment records** (Cash, UPI, Card) linked to Invoice `INV-0001`, leaving `₹5,000` as `balance_due_amount`.

### 2. Delayed & Partial Payment Handling
* **Payment Status State Machine**:
  * `UNPAID`: `total_paid_amount == 0`
  * `PARTIALLY_PAID`: `0 < total_paid_amount < grand_total`
  * `PAID`: `total_paid_amount >= grand_total`
* **Delayed Payment Workflow**:
  1. Customer buys laptop for `₹50,000`, pays `₹30,000` on Day 1. Invoice status = `PARTIALLY_PAID`, Balance = `₹20,000`.
  2. Customer returns 7 days later and pays remaining `₹20,000`.
  3. Staff opens Invoice or Customer Payments view, selects "Record Delayed Payment".
  4. System logs second Payment record of `₹20,000`, updates Invoice status to `PAID`, clears balance due, and allocates the `₹20,000` to Ramesh / Lokesh ledger.

### 3. Customer Outstanding & Credit Ledger
* Live customer credit tracking showing:
  * Total Invoiced Amount
  * Total Paid Amount
  * Net Outstanding Balance Due
* Quick collection entry directly from Customer Profile.

---

## Key Core Architectural Rules

1. **Products vs. Services**:
   * **Products** (Laptops, RAM, SSD, CCTV, Chargers, Cables): Physical goods with `is_stock_enabled=True`. Supports tracking types: `QUANTITY` or `SERIAL_NUMBER`.
   * **Services** (Laptop Repair, Windows Installation, Cleaning, Service labor): Non-physical, `is_stock_enabled=False`. **Zero stock tracking or validation**.
2. **Unified Billing**: Single invoice can contain both **Product items** (triggers Stock OUT) and **Service items** (no stock movement).
3. **Auditable Transaction-Based Ledger (`StockMovement`)**:
   * Every stock change logs a `StockMovement` entry (`OPENING`, `PURCHASE`, `SALE`, `SALES_RETURN`, `PURCHASE_RETURN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`).
4. **Complete Customer & Supplier Master**: Full street address, city, pincode, state name, state code (e.g. `Karnataka` - `29`), and GSTIN tracking.
5. **Multi-Mode Split & Delayed Payments**: Support Cash, UPI, Card, Bank, and Credit. Track partial payments and allow delayed collection logging with auto status transitions (`UNPAID` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID`).
6. **Atomic Invoice Posting (`@transaction.atomic`)**: Invoice creation, stock validation, stock-out logging, GST calculation, initial payment recording, and partner allocation execute in a single database transaction.

---

## Phase-by-Phase Implementation Roadmap

```text
+-----------------------------------------------------------------------------------+
| PHASE 1: Backend Foundation, Core Models, Stock Engine & Payment Engine          |
| - Django setup, PostgreSQL DB config                                              |
| - Models: Customer, Supplier, Product, Service, SerialNumber, StockMovement,      |
|   Invoice, Payment, Partner (Ramesh & Lokesh)                                     |
| - Stock Movement Engine (Opening, Purchase In, Sale Out, Adjustments)             |
| - Payment Engine (Split payment, Delayed payment, Balance tracking)               |
| - GST Engine & Amount in Words helper                                             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| PHASE 2: Frontend Foundation & Design System                                      |
| - Vite + React setup, Design Token CSS system                                     |
| - Sidebar Navigation (Dashboard, POS Billing, Inventory, Services, Purchases,     |
|   Expenses, Customers, Suppliers, Partners, Reports, Settings)                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| PHASE 3: Product, Service & Inventory Modules                                     |
| - Product Master (Quantity & Serial Number tracking) + Service Master UI          |
| - Customer & Supplier Masters (Full address, GSTIN, State code)                   |
| - Opening Stock Entry UI, Stock Adjustment Modal & Serial Tracking Report          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| PHASE 4: Atomic POS Billing Engine, Split/Delayed Payments & PDF Invoicing        |
| - Unified POS Billing UI (Product + Service mixed lines)                          |
| - Multi-mode Split Payment UI (Cash + UPI + Card + Credit)                        |
| - Stock Validation & Automatic Stock OUT on Invoice Posting                       |
| - Matrix Infotech-style A4 Printable PDF (Original & Transporter Duplicate)       |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| PHASE 5: Customer Outstanding, Purchases, Expenses & Partner Allocation           |
| - Record Delayed Customer Payments UI & Outstanding Ledger                        |
| - Vendor Purchases with automatic Stock IN                                        |
| - Expense tracking & Out-of-pocket funding attribution (Ramesh vs Lokesh)         |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| PHASE 6: Partner Ledger (Ramesh & Lokesh) & Reports                               |
| - Real-time Partner Balance matrix & Withdrawal recording                         |
| - Daily/Monthly Business P&L, Inventory Valuation & GST HSN Summary Reports       |
+-----------------------------------------------------------------------------------+
```

---

## Verification Plan

### Automated Backend Tests (`python manage.py test`)
1. **Split & Delayed Payment Test**:
   * Create Invoice of ₹50,000. Pay ₹20,000 Cash + ₹10,000 UPI at creation. Verify status = `PARTIALLY_PAID`, balance = ₹20,000.
   * Add Delayed Payment of ₹20,000 via Bank Transfer. Verify status updates to `PAID`, balance = 0.
2. **Address & GST Integrity**:
   * Verify Customer & Supplier full address fields persist correctly and populate tax invoices.
3. **Stock Movement & Serial Lifecycle**:
   * Validate Stock OUT on invoice posting & serial status transition to `SOLD`.
4. **Partner Balance Math**:
   * Verify Ramesh & Lokesh credits from partial and delayed payments down to the exact rupee.

### Manual Verification
1. **POS Split Payment UI Test**: Create a bill with ₹1,000 Cash and ₹1,478 UPI. Verify generated receipt and payment logs.
2. **Delayed Payment UI Test**: Open a partially paid invoice from Customer Outstanding view and log delayed payment. Verify status updates cleanly.
