// Reports P&L/commission math verified against hand-calculated known values,
// plus cash-closure reconciliation and the job inspection checklist (which
// also exercises the same modal-reference pattern as modal-reference-identity.test.js).
const { chromium } = require('playwright');
const { login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('reports-cash-inspection');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  await page.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'RCI TEST CUSTOMER');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'RCI 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'RCI test job');
    db.invoices = db.invoices.filter(inv => inv.items && inv.items.some(it=>it.name==='RCI Item'));
    db.inventory = db.inventory.filter(i => i.sku !== 'RCI-ITEM-1');
    db.staff = db.staff.filter(s => s.name !== 'RCI Mechanic');
    queueSave();
  });
  await page.waitForTimeout(1200);

  await page.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await page.click('[data-action="new-item"]');
  await page.waitForTimeout(200);
  await page.fill('#it-name', 'RCI Item');
  await page.fill('#it-sku', 'RCI-ITEM-1');
  await page.fill('#it-qty', '20');
  await page.fill('#it-cost', '10');
  await page.fill('#it-price', '30');
  await page.fill('#it-low', '2');
  await page.click('[data-action="save-item"]');
  await page.waitForTimeout(600);

  await page.evaluate(() => setState({ view: 'staffpage', staffTab: 'staff' }));
  await page.click('[data-action="new-staff"]');
  await page.waitForTimeout(200);
  await page.fill('#sf-name', 'RCI Mechanic');
  await page.selectOption('#sf-role', 'Mekanik').catch(()=>{});
  await page.fill('#sf-email', 'rci-mechanic@example.com');
  await page.fill('#sf-commission', '20');
  await page.click('[data-action="save-staff"]');
  await page.waitForTimeout(600);

  await page.evaluate(() => setState({ view: 'customers' }));
  await page.click('[data-action="new-customer"]');
  await page.waitForTimeout(200);
  await page.fill('#cust-name', 'RCI TEST CUSTOMER');
  await page.fill('#cust-phone', '0165551111');
  await page.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(page);
  const custId = await page.evaluate(() => db.customers.find(c=>c.name==='RCI TEST CUSTOMER')?.id);

  await page.evaluate(() => setState({ view: 'jobs' }));
  await page.click('[data-action="new-job"]');
  await page.waitForTimeout(300);
  await page.selectOption('#nj-customer', custId);
  await page.waitForTimeout(200);
  await page.selectOption('#nj-vehicle', '__new__');
  await page.waitForTimeout(200);
  await page.fill('#nj-new-plate', 'RCI 0001');
  await page.fill('#nj-desc', 'RCI test job');
  await page.fill('#nj-mechanic', 'RCI Mechanic');
  await page.click('[data-action="create-job"]');
  // Job creation awaits a real network round-trip (next_counter RPC, for the
  // WS-#### number) before the job lands in db.jobs — poll for the actual
  // row instead of guessing a fixed sleep is enough (see job-pos-invoice.test.js).
  await page.waitForFunction(() => db.jobs.some(j=>j.description==='RCI test job'), { timeout: 10000 }).catch(()=>{});
  const jobId = await page.evaluate(() => db.jobs.find(j=>j.description==='RCI test job')?.id);
  r.checkTrue('job created', !!jobId);

  // Inspection checklist: cycle one item through all three states, verifying
  // each write lands in the real db.jobs record (not an orphaned copy).
  await page.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await page.waitForTimeout(200);
  await clickInPage(page, '[data-action="open-inspection"]');
  await page.waitForTimeout(200);
  const firstItem = await page.evaluate(() => document.querySelector('[data-inspect-item]')?.dataset.inspectItem);
  for(const expected of ['ok','attention','replace']){
    await clickInPage(page, `[data-inspect-item="${firstItem}"]`);
    // Same reasoning as elsewhere in this suite (see waitForSyncIdle's own
    // comment in helpers.js): this job's inspection field can get a realtime
    // echo of ITS OWN previous edit, and clicking again before that echo
    // settles risks the echo landing after this click and stomping it back
    // to an earlier value -- a fixed 150ms was fine locally but not under
    // CI's higher latency to Supabase (confirmed flaky there specifically).
    await waitForSyncIdle(page);
    const status = await page.evaluate(({id, name}) => db.jobs.find(j=>j.id===id)?.inspection?.[name], {id: jobId, name: firstItem});
    r.check(`inspection status cycles to "${expected}" and persists`, status, expected);
  }
  await clickInPage(page, '[data-action="close-modal"]');
  await page.waitForTimeout(200);

  // Sell the item to a job on POS, cash payment, qty 2 -> subtotal RM60
  await page.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await page.waitForTimeout(200);
  await clickInPage(page, `[data-action="job-to-pos"][data-id="${jobId}"]`);
  await page.waitForTimeout(400);
  const itemId = await page.evaluate(() => db.inventory.find(i=>i.sku==='RCI-ITEM-1')?.id);
  await page.click(`[data-action="add-to-cart"][data-id="${itemId}"]`);
  await page.waitForTimeout(200);
  await page.click('[data-action="cart-inc"][data-idx="0"]');
  await page.waitForTimeout(200);
  await page.selectOption('#pos-payment', 'Tunai');
  await page.click('[data-action="checkout"]');
  // Checkout awaits a real network round-trip (next_counter RPC for the
  // INV-#### number) before the invoice lands in db.invoices — poll instead
  // of guessing a fixed sleep covers that latency.
  await page.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='RCI Item')), { timeout: 10000 }).catch(()=>{});

  const invoice = await page.evaluate(() => db.invoices.find(inv => inv.items && inv.items.some(it=>it.name==='RCI Item')));
  r.check('invoice subtotal (2x RM30)', invoice?.subtotal, 60);

  await page.evaluate(() => setState({ view: 'reports', reportRange: 30 }));
  await page.waitForTimeout(300);
  const reportText = await page.evaluate(() => document.querySelector('.content').textContent);
  r.checkTrue('P&L revenue shows RM60', reportText.includes('RM 60.00'));
  r.checkTrue('P&L COGS shows RM20 (2x cost RM10)', reportText.includes('RM 20.00'));
  r.checkTrue('P&L gross profit shows RM40', reportText.includes('RM 40.00'));
  r.checkTrue('commission shows RM12 (20% of RM60)', reportText.includes('RM 12.00'));

  // Credit note for 1 of the 2 units (RM30 of the RM60 invoice) must reduce
  // P&L revenue/gross profit AND mechanic commission by the credited amount
  // -- COGS stays put (the part was genuinely consumed regardless of the
  // refund). This is the exact bug class fixed via creditNotesForInvoice().
  await page.evaluate(() => setState({ view: 'finance', financeTab: 'invoices' }));
  await page.waitForTimeout(200);
  await clickInPage(page, `[data-action="open-credit-note"][data-id="${invoice.id}"]`);
  await page.waitForTimeout(300);
  await page.fill('[data-cn-qty-idx="0"]', '1');
  await page.fill('#cn-reason', 'RCI credit note test');
  await page.click('[data-action="save-credit-note"]');
  // Same reasoning as the checkout/invoice-number wait above: creditNoteNo
  // comes from nextCreditNoteNo(), a real network round-trip, so a fixed
  // sleep here is exactly the flake class already fixed for invoices --
  // poll instead of guessing a duration that covers CI's Supabase latency.
  await page.waitForFunction(() => (db.creditNotes||[]).some(cn=>cn.reason==='RCI credit note test'), { timeout: 10000 }).catch(()=>{});
  const creditNote = await page.evaluate(() => (db.creditNotes||[]).find(cn=>cn.reason==='RCI credit note test'));
  r.checkTrue('credit note created', !!creditNote);
  r.check('credit note subtotal RM30 (1x RM30)', creditNote?.subtotal, 30);
  await waitForSyncIdle(page);

  await page.evaluate(() => setState({ view: 'reports', reportRange: 30 }));
  await page.waitForTimeout(300);
  const reportTextAfterCredit = await page.evaluate(() => document.querySelector('.content').textContent);
  r.checkTrue('P&L revenue drops to RM30 after RM30 credit note', reportTextAfterCredit.includes('RM 30.00'));
  r.checkTrue('P&L COGS unchanged at RM20 (credited part was still consumed)', reportTextAfterCredit.includes('RM 20.00'));
  r.checkTrue('commission drops to RM6 (20% of RM60-RM30=RM30, was RM12)', reportTextAfterCredit.includes('RM 6.00'));

  await page.evaluate(() => setState({ view: 'payroll' }));
  await page.waitForTimeout(300);
  const payrollText = await page.evaluate(() => document.querySelector('.content').textContent);
  r.checkTrue('Payroll also shows the reduced RM6 commission for this mechanic', payrollText.includes('RM 6.00'));

  await page.evaluate(() => {
    db.creditNotes = (db.creditNotes||[]).filter(cn => cn.reason !== 'RCI credit note test');
    queueSave();
  });
  await page.waitForTimeout(1200);

  // Cash closure (lives in the POS view)
  await page.evaluate(() => setState({ view: 'pos' }));
  await page.waitForTimeout(300);
  const cashInput = await page.$('#cash-actual');
  if(cashInput){
    await page.fill('#cash-actual', '60');
    await page.click('[data-action="close-cash"]');
    await page.waitForTimeout(800);
    const closure = await page.evaluate(() => db.cashClosures[db.cashClosures.length-1]);
    r.check('cash closure expected == today\'s cash sales', closure?.expected, 60);
    r.check('cash closure actual == entered amount', closure?.actual, 60);
    const summary = await page.evaluate(() => document.querySelector('.content').textContent);
    r.checkTrue('shows "fully matched" for zero variance', summary.includes('Padan sepenuhnya'));
    await page.evaluate(() => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const dateStr = localDateStr(todayStart);
      db.cashClosures = db.cashClosures.filter(cc => !(cc.date===dateStr && cc.expected===60 && cc.actual===60));
      queueSave();
    });
  } else {
    console.log('  (skipped: cash already closed for today on this account)');
  }
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'RCI TEST CUSTOMER');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'RCI 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'RCI test job');
    db.invoices = db.invoices.filter(inv => !(inv.items && inv.items.some(it=>it.name==='RCI Item')));
    db.inventory = db.inventory.filter(i => i.sku !== 'RCI-ITEM-1');
    db.staff = db.staff.filter(s => s.name !== 'RCI Mechanic');
    queueSave();
  });
  await page.waitForTimeout(2000);

  // job-to-pos auto-fires a silent AI item suggestion (see requestAiQuoteSuggestion
  // in ai-assist.js) that calls the ai-suggest-quote-items Edge Function. That call
  // gets CORS-preflight-blocked from this test harness's file:// origin (Supabase
  // rejects a null Origin) -- harmless here and unreachable in production, which is
  // always served over a real https:// origin. Chromium logs that failed fetch as
  // two console errors: one naming the function/CORS policy, one a bare generic
  // "net::ERR_FAILED" with no other context to match on -- filter both.
  const filteredErrors = errors.filter(e => !/ai-suggest-quote-items|Gagal dapatkan cadangan sebut harga AI|net::ERR_FAILED/.test(e));
  r.checkEmpty('no console/page errors', filteredErrors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
