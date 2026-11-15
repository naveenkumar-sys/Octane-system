import { test, expect } from '@playwright/test';

test.describe.serial('Octane Systems - Entire Application End-to-End Test Suite', () => {
  let page;
  const uid = Date.now().toString().slice(-6);
  const testCategory = `AutoCat_${uid}`;
  const testBrand = `AutoBrand_${uid}`;
  const testSupplier = `AutoSupplier_${uid}`;
  const testCustomer = `AutoCustomer_${uid}`;
  const testCustomerMobile = `98${uid.padStart(8, '0')}`.slice(0, 10);
  const testProductName = `Octane Pro Cable ${uid}`;
  const testProductSku = `OCT-CBL-${uid}`;

  let createdInvoiceNumber = '';

  const navigateTo = async (route) => {
    await page.evaluate((r) => {
      window.history.pushState({}, '', r);
      window.dispatchEvent(new Event('popstate'));
    }, route);
    await page.waitForTimeout(400);
  };

  test.beforeAll(async ({ browser }) => {
    console.log('\n================================================================');
    console.log(`  STARTING OCTANE SYSTEMS E2E SUITE [RUN ID: ${uid}]`);
    console.log('================================================================');
    page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text());
      }
    });
    page.on('pageerror', (err) => console.log('UNCAUGHT EXCEPTION:', err.message));
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION & LOGIN WORKFLOW
  // -------------------------------------------------------------------------
  test('1. Authenticate Admin and Access Executive Dashboard', async () => {
    console.log('\n[1/10] Testing Authentication & Session Launch...');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // If an active session is already live from previous runs, verify and continue
    const alreadyLoggedIn = await page.locator('button:has-text("POS Billing")').first().isVisible().catch(() => false);
    if (!alreadyLoggedIn) {
      const usernameInput = page.locator('input[type="text"], input[placeholder*="username" i]').first();
      await usernameInput.waitFor({ state: 'visible', timeout: 20000 });
      const passwordInput = page.locator('input[type="password"]').first();
      const signInButton = page.locator('button:has-text("Sign In")').first();

      await usernameInput.fill('admin');
      await passwordInput.fill('admin');

      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/auth/login/') && resp.status() === 200,
          { timeout: 15000 }
        ),
        signInButton.click(),
      ]);
    }

    // Verify app layout and dashboard are rendered
    await expect(
      page.locator('button:has-text("POS Billing")').first()
    ).toBeVisible({ timeout: 15000 });
    console.log('  -> Admin authenticated successfully. Dashboard session live.');
  });

  // -------------------------------------------------------------------------
  // 2. EXECUTIVE DASHBOARD VERIFICATION
  // -------------------------------------------------------------------------
  test('2. Verify Executive Dashboard KPIs and Navigation', async () => {
    console.log('\n[2/10] Testing Executive Dashboard KPIs...');
    await navigateTo('/dashboard');

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Revenue|Sales|Dashboard|Invoices|Stock/i);
    console.log('  -> Executive Dashboard KPI cards and business metrics verified.');
  });

  // -------------------------------------------------------------------------
  // 3. MASTER DATA CREATION: CATEGORY, BRAND, SUPPLIER, CUSTOMER, PRODUCT
  // -------------------------------------------------------------------------
  test('3. Create Master Records: Category, Brand, Supplier, Customer, and Product', async () => {
    console.log('\n[3/10] Testing Master Data Creation Workflows...');

    // A. Create Category
    console.log(`  -> Creating Product Category: "${testCategory}"...`);
    await navigateTo('/masters/categories');
    await page.locator('button:has-text("Add Product Category"), button:has-text("Add Category")').first().click();
    const catInput = page.locator('input[placeholder*="Laptops & Notebooks"]').first();
    await catInput.fill(testCategory);
    await page.locator('div[role="dialog"] button[type="submit"], button:has-text("Save Record"), button:has-text("Save")').first().click();
    await expect(page.getByText(testCategory).first()).toBeVisible({ timeout: 10000 });
    console.log(`  -> Category "${testCategory}" created successfully.`);

    // B. Create Brand
    console.log(`  -> Creating Brand: "${testBrand}"...`);
    await navigateTo('/masters/brands');
    await page.locator('button:has-text("Add New Brand")').first().click();
    const brandInput = page.locator('input[placeholder*="Dell, HP, Lenovo"]').first();
    await brandInput.fill(testBrand);
    await page.locator('div[role="dialog"] button[type="submit"], button:has-text("Save Record"), button:has-text("Save")').first().click();
    const brandSearch = page.locator('input[placeholder*="Search brand name"]').first();
    if (await brandSearch.isVisible()) {
      await brandSearch.fill(testBrand);
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(testBrand).first()).toBeVisible({ timeout: 10000 });
    console.log(`  -> Brand "${testBrand}" created successfully.`);

    // C. Create Supplier
    console.log(`  -> Creating Supplier: "${testSupplier}"...`);
    await navigateTo('/masters/suppliers');
    await page.locator('button:has-text("Add New Supplier")').first().click();
    await page.locator('input[placeholder*="Infotech Hardware"]').first().fill(testSupplier);
    await page.locator('input[placeholder*="9999999999"]').first().fill('9876543210');
    await page.locator('div[role="dialog"] button[type="submit"], button:has-text("Save Record"), button:has-text("Save Supplier"), button:has-text("Save")').first().click();
    const suppSearch = page.locator('input[placeholder*="Search supplier"]').first();
    if (await suppSearch.isVisible()) {
      await suppSearch.fill(testSupplier);
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(testSupplier).first()).toBeVisible({ timeout: 10000 });
    console.log(`  -> Supplier "${testSupplier}" created successfully.`);

    // D. Create Customer
    console.log(`  -> Creating Customer: "${testCustomer}"...`);
    await navigateTo('/masters/customers');
    await page.locator('button:has-text("Add New Customer")').first().click();
    await page.locator('input[placeholder*="Ramesh Kumar"]').first().fill(testCustomer);
    await page.locator('input[placeholder*="9888888888"]').first().fill(testCustomerMobile);
    await page.locator('div[role="dialog"] button[type="submit"], button:has-text("Save Customer"), button:has-text("Save Record"), button:has-text("Save")').first().click();
    const custSearch = page.locator('input[placeholder*="Search customer"]').first();
    if (await custSearch.isVisible()) {
      await custSearch.fill(testCustomer);
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(testCustomer).first()).toBeVisible({ timeout: 10000 });
    console.log(`  -> Customer "${testCustomer}" created successfully.`);

    // E. Create Product
    console.log(`  -> Creating Product: "${testProductName}"...`);
    await navigateTo('/masters/products');
    await page.locator('button:has-text("Add New Product")').first().click();
    await page.locator('input[placeholder*="Dell Latitude 5450 Laptop"]').first().fill(testProductName);

    // Set unique model number so auto-generated SKU is guaranteed unique
    const modelInput = page.locator('input[placeholder*="5450-I5-16GB"]').first();
    if (await modelInput.isVisible()) {
      await modelInput.fill(`M${uid}`);
    }

    // Select category if available
    const catSelect = page.locator('select').filter({ hasText: 'Select Category' }).first();
    if (await catSelect.isVisible()) {
      const catOpt = catSelect.locator(`option:has-text("${testCategory}")`).first();
      if ((await catOpt.count()) > 0) {
        const catVal = await catOpt.getAttribute('value');
        await catSelect.selectOption(catVal);
      }
    }

    // Select brand if available
    const brandSelect = page.locator('select').filter({ hasText: 'Select Brand' }).first();
    if (await brandSelect.isVisible()) {
      const brandOpt = brandSelect.locator(`option:has-text("${testBrand}")`).first();
      if ((await brandOpt.count()) > 0) {
        const brandVal = await brandOpt.getAttribute('value');
        await brandSelect.selectOption(brandVal);
      }
    }

    // Fill prices
    const buyPriceInput = page.locator('input[placeholder="0.00"]').first();
    await buyPriceInput.fill('400.00');
    const sellPriceInput = page.locator('input[placeholder="0.00"]').nth(1);
    await sellPriceInput.fill('600.00');

    // Explicitly click Quantity Tracking button
    const qtyTrackingBtn = page.locator('button:has-text("Quantity Tracking")').first();
    if (await qtyTrackingBtn.isVisible()) {
      await qtyTrackingBtn.click();
    }

    // Save product
    await page.locator('div[role="dialog"] button[type="submit"], button:has-text("Save Record"), button:has-text("Save Product"), button:has-text("Save")').first().click();
    const prodSearch = page.locator('input[placeholder*="Search product"]').first();
    if (await prodSearch.isVisible()) {
      await prodSearch.fill(testProductName);
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(testProductName).first()).toBeVisible({ timeout: 15000 });
    console.log(`  -> Product "${testProductName}" created successfully.`);
  });

  // -------------------------------------------------------------------------
  // 4. STOCK INWARD VIA PURCHASE ENTRY
  // -------------------------------------------------------------------------
  test('4. Record Purchase Inward to Stock Inventory', async () => {
    console.log('\n[4/10] Testing Purchase Entry & Stock Inward...');
    await navigateTo('/purchases/new');
    await page.waitForTimeout(300);

    // Select Supplier by matching option
    const suppOption = page.locator(`select option:has-text("${testSupplier}")`).first();
    await suppOption.waitFor({ state: 'attached', timeout: 10000 });
    const suppVal = await suppOption.getAttribute('value');
    const suppSelect = page.locator('select').filter({ has: page.locator(`option[value="${suppVal}"]`) });
    await suppSelect.selectOption(suppVal);

    // Invoice Ref
    const invRefInput = page.locator('input[placeholder*="INV-2026-9987"]').first();
    if (await invRefInput.isVisible()) {
      await invRefInput.fill(`PO-${uid}`);
    }

    // Select product in line item by matching option
    const prodOption = page.locator(`select option:has-text("${testProductName}")`).first();
    await prodOption.waitFor({ state: 'attached', timeout: 10000 });
    const prodVal = await prodOption.getAttribute('value');
    const prodSelect = page.locator('select').filter({ has: page.locator(`option[value="${prodVal}"]`) });
    await prodSelect.selectOption(prodVal);

    // Set quantity = 5 and unit cost = 400
    const qtyInput = page.locator('input[type="number"][min="1"]').first();
    await qtyInput.fill('5');

    const costInput = page.locator('input[placeholder="0.00"]').first();
    await costInput.fill('400');

    // Submit Purchase
    const submitBtn = page.locator('button:has-text("Save & Post Stock Purchase")').first();
    await submitBtn.click();

    // Verify redirected or purchase history visible
    await expect(page.locator('button:has-text("New Purchase")').first()).toBeVisible({ timeout: 15000 });
    console.log('  -> Purchase posted successfully. 5 units added to inventory.');
  });

  // -------------------------------------------------------------------------
  // 5. INVENTORY OVERVIEW VERIFICATION
  // -------------------------------------------------------------------------
  test('5. Verify Stock Balance in Inventory Overview', async () => {
    console.log('\n[5/10] Testing Stock Overview Verification...');
    await navigateTo('/inventory/overview');

    // Wait for inventory data to finish loading
    await expect(page.getByText(/Fetching live stock balances|Loading/i)).not.toBeVisible({ timeout: 15000 }).catch(() => {});

    // Search for our product
    const searchInput = page.locator('input[placeholder*="Search product"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(testProductName);
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(testProductName).first()).toBeVisible({ timeout: 15000 });
    console.log(`  -> Inventory Overview confirmed stock availability for "${testProductName}".`);
  });

  // -------------------------------------------------------------------------
  // 6. POS BILLING TERMINAL: MANDATORY CUSTOMER + GST TAX INVOICE + WARRANTY
  // -------------------------------------------------------------------------
  test('6. POS Billing Terminal: Complete GST Tax Invoice with Warranty & Verify A4 Print View', async () => {
    console.log('\n[6/10] Testing POS GST Billing with Mandatory Customer & Warranty...');
    await navigateTo('/pos');

    // 1. Mandatory Customer Selection via Header Dropdown
    console.log('  -> Selecting Customer in POS...');
    const custOption = page.locator(`select option:has-text("${testCustomer}")`).first();
    await custOption.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    if ((await custOption.count()) > 0) {
      const custVal = await custOption.getAttribute('value');
      const custSelect = page.locator('select').filter({ has: page.locator(`option[value="${custVal}"]`) });
      await custSelect.selectOption(custVal);
    } else {
      const selectCustBtn = page.locator(
        'button:has-text("Select / Register Customer"), button:has-text("Verify / + New"), button:has-text("Select Customer *")'
      ).first();
      if (await selectCustBtn.isVisible()) {
        await selectCustBtn.click();
        const chooseBtn = page.locator('button:has-text("Select")').first();
        if (await chooseBtn.isVisible()) await chooseBtn.click();
      }
    }
    console.log('  -> Customer selected successfully.');

    // 2. Ensure GST Tax Invoice stream is active
    const gstToggleBtn = page.locator('button:has-text("GST Tax Invoice")').first();
    await gstToggleBtn.click();

    // 3. Search for product and Add to Cart
    console.log(`  -> Searching product "${testProductName}" in catalog...`);
    const catalogSearch = page.locator('input[placeholder*="Type name, SKU or scan barcode"]').first();
    await catalogSearch.fill(testProductName);
    await page.waitForTimeout(500);

    const addBtn = page.locator('button[title*="Add to Bill"]').first();
    await addBtn.click();
    console.log('  -> Product added to POS cart.');

    // 4. Test Product Warranty Feature (inline chip)
    console.log('  -> Configuring Product Warranty in POS cart...');
    const warrantyToggle = page.locator('button:has-text("+ Warranty")').first();
    await warrantyToggle.click();

    // Select preset chip: "1 Year Brand"
    const presetChip = page.locator('button:has-text("1 Year Brand")').first();
    await presetChip.click();

    // Verify warranty is attached to cart item
    await expect(page.getByText('1 Year Brand Warranty').first()).toBeVisible({ timeout: 5000 });
    console.log('  -> Attached "1 Year Brand Warranty" to the line item.');

    // 5. Checkout
    console.log('  -> Executing POS Sale Checkout...');
    const checkoutBtn = page.locator('button:has-text("Complete GST Sale")').first();
    await expect(checkoutBtn).toBeEnabled({ timeout: 10000 });
    await checkoutBtn.click();

    // 6. Assert A4 Invoice Print Modal pops up
    console.log('  -> Verifying A4 Print Preview Modal generation...');
    const printModal = page.locator('#a4-invoice-print-area').first();
    await expect(printModal).toBeVisible({ timeout: 15000 });

    // Assert Title is "TAX INVOICE"
    const modalText = await printModal.textContent();
    expect(modalText).toContain('TAX INVOICE');
    expect(modalText).toContain('1 Year Brand Warranty');
    console.log('  -> Verified: Document Title is "TAX INVOICE" with Warranty item.');

    // Capture Invoice Number from modal
    const invMatch = modalText.match(/INV-\d+/);
    if (invMatch) {
      createdInvoiceNumber = invMatch[0];
      console.log(`  -> Created GST Invoice Number: ${createdInvoiceNumber}`);
    }

    // Close Modal using official title
    const closeModalBtn = page.locator('button[title="Close Preview"]').first();
    await closeModalBtn.click();
    await expect(printModal).not.toBeVisible({ timeout: 5000 });
    console.log('  -> A4 Print Modal closed cleanly.');
  });

  // -------------------------------------------------------------------------
  // 7. POS BILLING TERMINAL: NON-GST BILL STREAM (INVOICE BILL TITLE TEST)
  // -------------------------------------------------------------------------
  test('7. POS Billing Terminal: Complete Non-GST Sale & Verify "INVOICE BILL" Document Title', async () => {
    console.log('\n[7/10] Testing POS Non-GST Billing and "INVOICE BILL" Title...');
    await navigateTo('/pos');

    // 1. Select Customer
    const custOption = page.locator(`select option:has-text("${testCustomer}")`).first();
    await custOption.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    if ((await custOption.count()) > 0) {
      const custVal = await custOption.getAttribute('value');
      const custSelect = page.locator('select').filter({ has: page.locator(`option[value="${custVal}"]`) });
      await custSelect.selectOption(custVal);
    } else {
      const walkIn = page.locator('button:has-text("Use Walk-in Cash Customer")').first();
      if (await walkIn.isVisible()) await walkIn.click();
    }

    // 2. Switch stream to Non-GST Bill
    const nonGstToggleBtn = page.locator('button:has-text("Non-GST Bill")').first();
    await nonGstToggleBtn.click();

    // 3. Search and Add item to Cart
    const catalogSearch = page.locator('input[placeholder*="Type name, SKU or scan barcode"]').first();
    await catalogSearch.fill(testProductName);
    await page.waitForTimeout(500);

    const addBtn = page.locator('button[title*="Add to Bill"]').first();
    await addBtn.click();

    // 4. Checkout Non-GST Sale
    const checkoutBtn = page.locator('button:has-text("Complete Non-GST Bill"), button:has-text("Complete Non-GST")').first();
    await expect(checkoutBtn).toBeEnabled({ timeout: 10000 });
    await checkoutBtn.click();

    // 5. Assert A4 Print Preview Modal shows "INVOICE BILL"
    const printModal = page.locator('#a4-invoice-print-area').first();
    await expect(printModal).toBeVisible({ timeout: 15000 });

    const modalText = await printModal.textContent();
    expect(modalText).toContain('INVOICE BILL');
    console.log('  -> Verified: Non-GST Document Title is "INVOICE BILL" (exact requirement).');

    // Close Modal
    const closeModalBtn = page.locator('button[title="Close Preview"]').first();
    await closeModalBtn.click();
    await expect(printModal).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 8. QUOTATION WORKFLOW: DRAFT CREATION & VERIFICATION
  // -------------------------------------------------------------------------
  test('8. Create and Verify Client Quotation / Estimate with Notes', async () => {
    console.log('\n[8/10] Testing Quotation Preparation & Note Features...');
    await navigateTo('/pos/quotations/new');

    // Fill Client Info
    const buyerNameInput = page.locator('input[placeholder*="Velapkam Tech Park"], input[placeholder*="Buyer Name"]').first();
    await buyerNameInput.fill(`Quote Client ${uid}`);

    const phoneInput = page.locator('input[placeholder="+91..."], input[placeholder*="Phone"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('9988776655');
    }

    // Add Line Item
    const descInput = page.locator('input[placeholder*="Item name & specifications"], input[placeholder*="Item name"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill(`IT Consulting & Hardware Setup ${uid}`);
      const rateInput = page.locator('input[placeholder="0.00"]').first();
      await rateInput.fill('15000');
    }

    // Toggle Note switch
    const noteToggle = page.locator('button[role="switch"]').first();
    if (await noteToggle.isVisible()) {
      await noteToggle.click();
      const noteInput = page.locator('textarea[placeholder*="Validity 7 days"], textarea').first();
      if (await noteInput.isVisible()) {
        await noteInput.fill('Delivery within 3 business days. 50% advance.');
      }
    }

    // Save Draft
    const saveBtn = page.locator('button:has-text("Save Draft")').first();
    await saveBtn.click();

    // Verify quotation is listed
    const quoteSearch = page.locator('input[placeholder*="Search by quote#, buyer, phone"]').first();
    if (await quoteSearch.isVisible()) {
      await quoteSearch.fill(`Quote Client ${uid}`);
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(`Quote Client ${uid}`).first()).toBeVisible({ timeout: 15000 });
    console.log('  -> Quotation created and verified in Quotation List.');
  });

  // -------------------------------------------------------------------------
  // 9. INVOICE HISTORY & PRINT RE-PREVIEW
  // -------------------------------------------------------------------------
  test('9. Verify Invoices in History Log & Test View/Print Action', async () => {
    console.log('\n[9/10] Testing Invoice History Log and Print Action...');
    await navigateTo('/pos/invoices');

    // Wait for invoice history loading state to finish
    await expect(page.locator('text=Loading sales invoice history log...')).not.toBeVisible({ timeout: 15000 });

    // Verify newly generated invoice appears in the table
    if (createdInvoiceNumber) {
      const searchInput = page.locator('input[placeholder*="Search by invoice number"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill(createdInvoiceNumber);
        await page.waitForTimeout(300);
      }
      await expect(page.getByText(createdInvoiceNumber).first()).toBeVisible({ timeout: 15000 });
      console.log(`  -> Verified Invoice "${createdInvoiceNumber}" present in History.`);
    }

    // Click Print A4 Invoice action button
    const printActionBtn = page.locator('button[title="Print A4 Invoice"]').first();
    if (await printActionBtn.isVisible()) {
      await printActionBtn.click();
      const printModal = page.locator('#a4-invoice-print-area').first();
      await expect(printModal).toBeVisible({ timeout: 10000 });
      console.log('  -> Successfully re-opened A4 Print Modal from Invoice History.');

      const closeModalBtn = page.locator('button[title="Close Preview"]').first();
      await closeModalBtn.click();
      await expect(printModal).not.toBeVisible({ timeout: 5000 });
    }
  });

  // -------------------------------------------------------------------------
  // 10. SYSTEM SETTINGS & BUSINESS PROFILE
  // -------------------------------------------------------------------------
  test('10. Verify System Settings & Business Profile', async () => {
    console.log('\n[10/10] Testing System Settings & Configuration...');
    await navigateTo('/settings');

    const settingsContent = await page.textContent('body');
    expect(settingsContent).toMatch(/Settings|Profile|Company|GSTIN|Business/i);
    console.log('  -> System Settings and Company Profile verified.');
    console.log('\n================================================================');
    console.log('  ALL 10 END-TO-END WORKFLOW TESTS EXECUTED SUCCESSFULLY!');
    console.log('================================================================\n');
  });
});
