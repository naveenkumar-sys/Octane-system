import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.describe('Playwright Real-Time Financial Scenarios, Visualization & Speed Benchmark', () => {
  const screenshotsDir = path.resolve('e2e/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    console.log('\n=================================================================================');
    console.log('  INITIALIZING CONTROLLED TEST FIXTURE IN DATABASE VIA DOCKER BACKEND...        ');
    console.log('=================================================================================');
    try {
      const out = execSync('docker compose exec -T backend python /app/playwright_audit_fixture.py setup', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(out.trim());
    } catch (err) {
      console.error('Fixture setup failed:', err.message);
      throw err;
    }
  });

  test.afterAll(() => {
    console.log('\n=================================================================================');
    console.log('  TEARDOWN: PURGING ALL TESTED DATA & VERIFYING ZERO RESIDUAL DATA...          ');
    console.log('=================================================================================');
    try {
      const out = execSync('docker compose exec -T backend python /app/playwright_audit_fixture.py teardown', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(out.trim());
    } catch (err) {
      console.error('Fixture teardown failed:', err.message);
      throw err;
    }
  });

  test('Execute Real-Time Visualizations, Financial Scenarios & Speed Benchmarks', async ({ page }) => {
    const timings = {};

    console.log('\n--- 1. Authenticating Admin Session ---');
    const authStart = Date.now();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const userField = page.locator('input[type="text"], input[placeholder*="username" i]').first();
    const passField = page.locator('input[type="password"]').first();
    await userField.fill('audit_tester');
    await passField.fill('AuditPass123!');

    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/auth/me') && resp.status() === 200, { timeout: 15000 }),
      signInBtn.click()
    ]);

    await page.waitForSelector('main', { timeout: 15000 });
    timings.auth = Date.now() - authStart;
    console.log(`[SPEED] Authentication & JWT Session Launch: ${timings.auth}ms`);

    const navigateTo = async (route) => {
      const start = Date.now();
      await page.evaluate((r) => {
        window.history.pushState({}, '', r);
        window.dispatchEvent(new Event('popstate'));
      }, route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400); // allow CSS animations & charts to paint
      return Date.now() - start;
    };

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 1: EXECUTIVE DASHBOARD
    // -------------------------------------------------------------
    console.log('\n--- 2. Executive Dashboard Live Visualization & Speed ---');
    timings.dashboard = await navigateTo('/dashboard');

    const bodyTextDash = await page.textContent('body');
    expect(bodyTextDash).toContain('Revenue');

    await page.screenshot({ path: path.join(screenshotsDir, '01_dashboard_visualization.png') });
    console.log(`[SPEED] Executive Dashboard Load & Chart Render: ${timings.dashboard}ms`);
    console.log('[VISUAL] Captured: 01_dashboard_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 2: PARTNER CAPITAL LEDGER
    // -------------------------------------------------------------
    console.log('\n--- 3. Partner Capital Ledger Live Visualization & Speed ---');
    timings.partnerLedger = await navigateTo('/finance/partner-ledger');

    const partnerBody = await page.textContent('body');
    expect(partnerBody).toContain('Partner');
    expect(partnerBody).toContain('Ramesh');

    await page.screenshot({ path: path.join(screenshotsDir, '02_partner_ledger_visualization.png') });
    console.log(`[SPEED] Partner Capital Ledger & Journal Render: ${timings.partnerLedger}ms`);
    console.log('[VISUAL] Captured: 02_partner_ledger_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 3: SALES DETAILED REPORT
    // -------------------------------------------------------------
    console.log('\n--- 4. Sales Report Live Visualization & Speed ---');
    timings.salesReport = await navigateTo('/reports/sales');

    const salesBody = await page.textContent('body');
    expect(salesBody).toContain('Sales');
    expect(salesBody).toContain('INV-E2E-001');

    await page.screenshot({ path: path.join(screenshotsDir, '03_sales_report_visualization.png') });
    console.log(`[SPEED] Sales Detailed Report & Summary Render: ${timings.salesReport}ms`);
    console.log('[VISUAL] Captured: 03_sales_report_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 4: PURCHASE DETAILED REPORT
    // -------------------------------------------------------------
    console.log('\n--- 5. Purchase Report Live Visualization & Speed ---');
    timings.purchaseReport = await navigateTo('/reports/purchases');

    const purBody = await page.textContent('body');
    expect(purBody).toContain('PO-E2E-001');

    await page.screenshot({ path: path.join(screenshotsDir, '04_purchase_report_visualization.png') });
    console.log(`[SPEED] Purchase Audit Report Render: ${timings.purchaseReport}ms`);
    console.log('[VISUAL] Captured: 04_purchase_report_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 5: INVENTORY VALUATION REPORT
    // -------------------------------------------------------------
    console.log('\n--- 6. Inventory Valuation Report Live Visualization & Speed ---');
    timings.inventoryReport = await navigateTo('/reports/inventory');

    const invBody = await page.textContent('body');
    expect(invBody).toContain('Audit Enterprise Laptop');

    await page.screenshot({ path: path.join(screenshotsDir, '05_inventory_report_visualization.png') });
    console.log(`[SPEED] Inventory Stock Movement & Valuation Render: ${timings.inventoryReport}ms`);
    console.log('[VISUAL] Captured: 05_inventory_report_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 6: GST TAX & HSN REPORT
    // -------------------------------------------------------------
    console.log('\n--- 7. GST Tax Report & HSN Summary Live Visualization & Speed ---');
    timings.gstReport = await navigateTo('/reports/gst');

    const gstBody = await page.textContent('body');
    expect(gstBody).toContain('GST Collected on Sales');
    expect(gstBody).toContain('84713010');

    await page.screenshot({ path: path.join(screenshotsDir, '06_gst_report_visualization.png') });
    console.log(`[SPEED] GST Tax Report & HSN Table Render: ${timings.gstReport}ms`);
    console.log('[VISUAL] Captured: 06_gst_report_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 7: PROFIT & LOSS REPORT
    // -------------------------------------------------------------
    console.log('\n--- 8. Profit & Loss Report Live Visualization & Speed ---');
    timings.pnlReport = await navigateTo('/reports/profit-loss');

    const pnlBody = await page.textContent('body');
    expect(pnlBody).toContain('Revenue');
    expect(pnlBody).toContain('Gross Profit');

    await page.screenshot({ path: path.join(screenshotsDir, '07_pnl_report_visualization.png') });
    console.log(`[SPEED] Profit & Loss Accounting Reconciliation Render: ${timings.pnlReport}ms`);
    console.log('[VISUAL] Captured: 07_pnl_report_visualization.png');

    // -------------------------------------------------------------
    // VISUALIZATION & SPEED 8: POS TERMINAL
    // -------------------------------------------------------------
    console.log('\n--- 9. POS Billing Terminal Catalog Render Speed ---');
    timings.pos = await navigateTo('/pos');

    const walkInBtn = page.locator('button:has-text("Use Walk-in Cash Customer")').first();
    if (await walkInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await walkInBtn.click();
    }
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(screenshotsDir, '08_pos_terminal_visualization.png') });
    console.log(`[SPEED] POS Billing Terminal & Dual Catalog Render: ${timings.pos}ms`);
    console.log('[VISUAL] Captured: 08_pos_terminal_visualization.png');

    console.log('\n=================================================================================');
    console.log('  OCTANE SYSTEMS: PLAYWRIGHT SPEED BENCHMARK PERFORMANCE RESULTS                 ');
    console.log('=================================================================================');
    console.log(`  1. Authentication & JWT Launch:      ${timings.auth}ms`);
    console.log(`  2. Executive Dashboard:               ${timings.dashboard}ms`);
    console.log(`  3. Partner Capital Ledger:           ${timings.partnerLedger}ms`);
    console.log(`  4. Sales Detailed Report:             ${timings.salesReport}ms`);
    console.log(`  5. Purchase Audit Report:             ${timings.purchaseReport}ms`);
    console.log(`  6. Inventory Valuation Report:        ${timings.inventoryReport}ms`);
    console.log(`  7. GST Tax & HSN Summary:             ${timings.gstReport}ms`);
    console.log(`  8. Profit & Loss Statement:           ${timings.pnlReport}ms`);
    console.log(`  9. POS Billing Terminal:              ${timings.pos}ms`);
    console.log('=================================================================================');
  });
});
