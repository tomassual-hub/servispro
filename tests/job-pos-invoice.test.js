// End-to-end: job creation -> status update -> send to POS -> sell an
// inventory item -> checkout. Verifies inventory deduction, invoice/job
// linkage, customer visit counting, and two-device realtime sync.
const { chromium } = require('playwright');
const { login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('job-pos-invoice');
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsA = [], errorsB = [];
  await login(pageA, 'A', errorsA);
  await login(pageB, 'B', errorsB);

  await pageA.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'JPI TEST CUSTOMER');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'JPI 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'JPI test job' && j.description !== 'JPI test job EDITED');
    db.inventory = db.inventory.filter(i => i.sku !== 'JPI-ITEM-1');
    db.invoices = db.invoices.filter(inv => inv.items && inv.items.some(it=>it.name==='JPI Test Item'));
    queueSave();
  });
  await pageA.waitForTimeout(1500);

  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await pageA.click('[data-action="new-item"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#it-name', 'JPI Test Item');
  await pageA.fill('#it-sku', 'JPI-ITEM-1');
  await pageA.fill('#it-qty', '10');
  await pageA.fill('#it-cost', '5');
  await pageA.fill('#it-price', '25');
  await pageA.fill('#it-low', '2');
  await pageA.click('[data-action="save-item"]');
  await pageA.waitForTimeout(800);
  const itemId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='JPI-ITEM-1')?.id);
  r.checkTrue('inventory item created', !!itemId);

  await pageA.evaluate(() => setState({ view: 'customers' }));
  await pageA.click('[data-action="new-customer"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#cust-name', 'JPI TEST CUSTOMER');
  await pageA.fill('#cust-phone', '0161112222');
  await pageA.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(pageA);
  const custId = await pageA.evaluate(() => db.customers.find(c=>c.name==='JPI TEST CUSTOMER')?.id);

  await pageA.evaluate(() => setState({ view: 'jobs' }));
  await pageA.click('[data-action="new-job"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#nj-customer', custId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#nj-vehicle', '__new__');
  await pageA.waitForTimeout(200);
  await pageA.fill('#nj-new-plate', 'JPI 0001');
  await pageA.fill('#nj-desc', 'JPI test job');
  await pageA.fill('#nj-mechanic', 'Test Mechanic');
  await pageA.click('[data-action="create-job"]');
  // Job creation awaits a real network round-trip (next_counter RPC, for the
  // WS-#### number) before the job lands in db.jobs — a fixed sleep here is
  // a guess against that latency, and guessed wrong intermittently once
  // tests moved to a project with different network characteristics. Poll
  // for the actual row instead.
  await pageA.waitForFunction(() => db.jobs.some(j=>j.description==='JPI test job'), { timeout: 10000 }).catch(()=>{});
  const jobId = await pageA.evaluate(() => db.jobs.find(j=>j.description==='JPI test job')?.id);
  r.checkTrue('job created', !!jobId);
  await waitForSyncIdle(pageA); // let this job's own creation echo settle before editing it

  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#job-status-select', 'progress');
  await pageA.click('[data-action="save-job-status"]');
  await pageA.waitForTimeout(500);
  r.check('job status update persists', await pageA.evaluate(id => db.jobs.find(j=>j.id===id)?.status, jobId), 'progress');

  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await pageA.waitForTimeout(200);
  // Regression check: editing the description and clicking "Hantar ke POS"
  // directly (skipping "Simpan") must still persist the edit -- job-to-pos
  // used to read job.description straight from db.jobs without ever writing
  // back the modal's #job-desc-edit textarea first.
  await pageA.fill('#job-desc-edit', 'JPI test job EDITED');
  await pageA.fill('#job-price-edit', '10');
  await clickInPage(pageA, `[data-action="job-to-pos"][data-id="${jobId}"]`);
  await pageA.waitForTimeout(400);
  r.check('description edited just before "Hantar ke POS" (no Simpan click) still persists', await pageA.evaluate(id => db.jobs.find(j=>j.id===id)?.description, jobId), 'JPI test job EDITED');
  r.check('estimated price edited just before "Hantar ke POS" still persists', await pageA.evaluate(id => db.jobs.find(j=>j.id===id)?.estimatedPrice, jobId), 10);
  r.checkTrue('job description shown automatically in Troli & Invois (no AI button needed)', await pageA.evaluate(() => document.querySelector('.pos-wrap')?.innerText.includes('JPI test job EDITED')));
  r.checkTrue('estimated price auto-added as a cart item (no button press needed)', await pageA.evaluate(() => state.posCart.some(c=>c.name==='JPI test job EDITED' && c.price===10)));
  await pageA.click(`[data-action="add-to-cart"][data-id="${itemId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.click('[data-action="checkout"]');
  // Checkout awaits a real network round-trip (next_counter RPC for the
  // INV-#### number) before the invoice lands in db.invoices — poll instead
  // of guessing a fixed sleep covers that latency.
  await pageA.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='JPI Test Item')), { timeout: 10000 }).catch(()=>{});
  await pageA.waitForTimeout(300);
  r.checkTrue('"Cetak Invois" button appears in POS right after checkout', await pageA.evaluate(() => !!document.querySelector('[data-action="print-invoice"]')));

  const result = await pageA.evaluate((id) => {
    const inv = db.invoices.find(inv => inv.items && inv.items.some(it=>it.name==='JPI Test Item'));
    const job = db.jobs.find(j=>j.id===id);
    const item = db.inventory.find(i=>i.sku==='JPI-ITEM-1');
    const cust = db.customers.find(c=>c.name==='JPI TEST CUSTOMER');
    return { invoiceJobId: inv?.jobId, invoiceTotal: inv?.total, jobInvoiced: job?.invoiced, jobStatus: job?.status, itemQty: item?.qty, custVisits: cust?.visits };
  }, jobId);
  r.check('invoice linked to the correct job', result.invoiceJobId, jobId);
  r.check('invoice total correct (1x RM25 item + RM10 estimated price)', result.invoiceTotal, 35);
  r.checkTrue('job marked invoiced', result.jobInvoiced);
  r.check('job status auto-advances to delivered', result.jobStatus, 'delivered');
  r.check('inventory qty deducted (10-1=9)', result.itemQty, 9);
  r.check('customer visit count incremented', result.custVisits, 1);

  await pageB.evaluate(() => setState({ view: 'pos' }));
  let syncedNo = null;
  for(let i=0;i<10;i++){
    syncedNo = await pageB.evaluate(() => db.invoices.find(inv => inv.items && inv.items.some(it=>it.name==='JPI Test Item'))?.invoiceNo);
    if(syncedNo) break;
    await pageB.waitForTimeout(1000);
  }
  r.checkTrue('invoice synced to second device', !!syncedNo);

  await pageA.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'JPI TEST CUSTOMER');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'JPI 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'JPI test job' && j.description !== 'JPI test job EDITED');
    db.inventory = db.inventory.filter(i => i.sku !== 'JPI-ITEM-1');
    db.invoices = db.invoices.filter(inv => !(inv.items && inv.items.some(it=>it.name==='JPI Test Item')));
    queueSave();
  });
  await pageA.waitForTimeout(2000);

  // job-to-pos auto-fires a silent AI item suggestion (see requestAiQuoteSuggestion
  // in ai-assist.js) that calls the ai-suggest-quote-items Edge Function. That call
  // gets CORS-preflight-blocked from this test harness's file:// origin (Supabase
  // rejects a null Origin) -- harmless here and unreachable in production, which is
  // always served over a real https:// origin. Chromium logs that failed fetch as
  // two console errors: one naming the function/CORS policy, one a bare generic
  // "net::ERR_FAILED" with no other context to match on -- filter both.
  const filteredErrors = [...errorsA, ...errorsB].filter(e => !/ai-suggest-quote-items|Gagal dapatkan cadangan sebut harga AI|net::ERR_FAILED/.test(e));
  r.checkEmpty('no console/page errors', filteredErrors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
