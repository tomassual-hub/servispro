// Inventory + supplier + purchase-order receive flow, plus backup export ->
// restore round-trip (including the hardened fallback for a backup that's
// missing fields, and the fix that keeps the restoring admin's own staff
// record so they can't lock themselves out of Admin-only actions).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { login, clickInPage, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('inventory-po-backup');
  const browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  await login(page, 'A', errors);

  await page.evaluate(() => {
    db.suppliers = db.suppliers.filter(s => s.name !== 'IPB Test Supplier');
    db.inventory = db.inventory.filter(i => i.sku !== 'IPB-ITEM-1');
    db.purchaseOrders = db.purchaseOrders.filter(po => po.items.some(it=>it.name==='IPB Part'));
    db.customers = db.customers.filter(c => c.name !== 'IPB Post-Restore Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'IPB 0002');
    db.jobs = db.jobs.filter(j => j.description !== 'IPB post-restore job');
    queueSave();
  });
  await page.waitForTimeout(1000);

  await page.evaluate(() => setState({ view: 'inventory', invMainTab: 'suppliers' }));
  await page.click('[data-action="new-supplier"]');
  await page.waitForTimeout(200);
  await page.fill('#sup-name', 'IPB Test Supplier');
  await page.click('[data-action="save-supplier"]');
  await page.waitForTimeout(600);
  const supplierId = await page.evaluate(() => db.suppliers.find(s=>s.name==='IPB Test Supplier')?.id);

  await page.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await page.click('[data-action="new-item"]');
  await page.waitForTimeout(200);
  await page.fill('#it-name', 'IPB Part');
  await page.fill('#it-sku', 'IPB-ITEM-1');
  await page.fill('#it-qty', '2');
  await page.fill('#it-cost', '10');
  await page.fill('#it-price', '20');
  await page.fill('#it-low', '5');
  await page.click('[data-action="save-item"]');
  await page.waitForTimeout(600);

  await page.evaluate(() => setState({ view: 'finance', financeTab: 'po' }));
  await page.click('[data-action="new-po"]');
  await page.waitForTimeout(300);
  await page.selectOption('#po-supplier', supplierId);
  await page.fill('#po-items', 'IPB Part:15:10');
  await page.click('[data-action="save-po"]');
  // PO creation awaits a real network round-trip (next_counter RPC for the
  // PO-#### number) before landing in db.purchaseOrders — poll instead of
  // guessing a fixed sleep covers that latency.
  await page.waitForFunction(() => db.purchaseOrders.some(p=>p.items.some(it=>it.name==='IPB Part')), { timeout: 10000 }).catch(()=>{});
  const poId = await page.evaluate(() => db.purchaseOrders.find(p=>p.items.some(it=>it.name==='IPB Part'))?.id);
  r.checkTrue('purchase order created', !!poId);
  await waitForSyncIdle(page); // let this PO's own creation echo settle before receiving it

  // Receiving is now a two-step flow (open-receive-po opens a modal that
  // supports partial receiving, confirm-receive-po commits it) instead of
  // one click -- the "Receive Now" input defaults to the full outstanding
  // qty per line, so confirming immediately is equivalent to a full receive.
  await clickInPage(page, `[data-action="open-receive-po"][data-id="${poId}"]`);
  await page.waitForTimeout(200);
  await clickInPage(page, `[data-action="confirm-receive-po"][data-id="${poId}"]`);
  await page.waitForTimeout(600);
  r.check('stock qty updated on receive (2+15=17)', await page.evaluate(() => db.inventory.find(i=>i.sku==='IPB-ITEM-1')?.qty), 17);

  // Backup export -> mutate -> restore round-trip
  await page.evaluate(() => setState({ view: 'settings' }));
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="export-backup"]'),
  ]);
  const dlPath = path.join(__dirname, '.tmp-backup-test.json');
  await download.saveAs(dlPath);
  const backupJson = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  r.checkTrue('backup includes non-empty branches', Array.isArray(backupJson.branches) && backupJson.branches.length > 0);

  await page.evaluate(() => {
    const s = db.suppliers.find(s=>s.name==='IPB Test Supplier');
    if(s) s.phone = 'MUTATED';
  });
  await page.setInputFiles('#restore-file', dlPath);
  await page.waitForTimeout(800);
  await clickInPage(page, '[data-action="confirm-yes"]');
  // The restore handler's confirm callback does `db = {...}` synchronously
  // right before its own showToast() call, so waiting for that toast's text
  // is a precise "the restore has actually applied" signal — a fixed sleep
  // (previously 1500ms) is a guess that can run short under CI's added
  // latency to the live Supabase backend, where this has been observed to
  // flake in a way it never does on a local run.
  await page.waitForFunction(() => document.getElementById('toast-root')?.textContent.includes('dipulihkan'), { timeout: 8000 }).catch(()=>{});
  r.check('restore reverts a locally-mutated field back to the backup value', await page.evaluate(() => db.suppliers.find(s=>s.name==='IPB Test Supplier')?.phone), '');

  // Hardened restore: a backup missing branches (and other fields) must not crash
  const broken = { ...backupJson, branches: [] };
  delete broken.staff;
  // Simulate a backup taken before creditNote/quote counters existed --
  // counters is PRESENT (so the top-level "field missing" backfill never
  // triggers) but missing those two sub-keys specifically.
  const { creditNote, quote, ...oldShapeCounters } = backupJson.counters || {};
  broken.counters = oldShapeCounters;
  const brokenPath = path.join(__dirname, '.tmp-backup-broken.json');
  fs.writeFileSync(brokenPath, JSON.stringify(broken));
  const currentStaffId = await page.evaluate(() => state.currentStaff.id);
  // A decoy teammate who is NOT the one clicking restore — this is what a
  // real shop's other staff accounts look like from the restoring admin's
  // point of view. A backup missing the staff field must not delete them.
  const decoyStaffId = await page.evaluate(() => {
    const id = uid();
    db.staff.push({id, name:'IPB Decoy Staff', role:'Mekanik', email:'ipb-decoy@example.com', commissionPercent:0, userId:null});
    return id;
  });
  await waitForSyncIdle(page); // let the decoy's own creation echo settle before restoring
  await page.setInputFiles('#restore-file', brokenPath);
  await page.waitForTimeout(800);
  await clickInPage(page, '[data-action="confirm-yes"]');
  await page.waitForFunction(() => document.getElementById('toast-root')?.textContent.includes('dipulihkan'), { timeout: 8000 }).catch(()=>{});
  const afterBroken = await page.evaluate(() => ({ branches: db.branches }));
  r.checkTrue('restoring a backup with empty branches backfills a default branch', Array.isArray(afterBroken.branches) && afterBroken.branches.length > 0);
  const ownStaffKept = await page.evaluate((id) => db.staff.some(s => s.id === id), currentStaffId);
  r.checkTrue('restoring admin keeps their own staff record (no self-lockout)', ownStaffKept);
  const decoyStaffKept = await page.evaluate((id) => db.staff.some(s => s.id === id), decoyStaffId);
  r.checkTrue('restoring a backup missing the staff field keeps OTHER staff too (no teammate-lockout)', decoyStaffKept);
  await page.evaluate((id) => { db.staff = db.staff.filter(s => s.id !== id); queueSave(); }, decoyStaffId);
  await page.waitForTimeout(1200);

  // Restoring a backup whose counters object predates creditNote/quote must
  // backfill those two sub-keys to real numbers, not leave them undefined
  // (allocateCounter()'s offline fallback does ++db.counters[name], and
  // ++undefined is NaN -- permanently, since NaN+1 stays NaN).
  const countersAfterRestore = await page.evaluate(() => db.counters);
  r.checkTrue('restoring an old-shape counters object backfills creditNote counter', typeof countersAfterRestore.creditNote === 'number' && !Number.isNaN(countersAfterRestore.creditNote));
  r.checkTrue('restoring an old-shape counters object backfills quote counter', typeof countersAfterRestore.quote === 'number' && !Number.isNaN(countersAfterRestore.quote));

  // Confirm the app is actually usable post-restore (this is what crashed before the fix)
  let jobCreateError = null;
  try{
    await page.evaluate(() => setState({ view: 'customers' }));
    await page.click('[data-action="new-customer"]');
    await page.waitForTimeout(200);
    await page.fill('#cust-name', 'IPB Post-Restore Customer');
    await page.fill('#cust-phone', '0169998888');
    await page.click('[data-action="save-customer"]');
    await page.waitForTimeout(400);
    await clickInPage(page, '[data-action="confirm-yes"]');
    await page.waitForTimeout(400);
    await page.evaluate(() => setState({ view: 'jobs' }));
    await page.click('[data-action="new-job"]');
    await page.waitForTimeout(300);
    await page.selectOption('#nj-customer', { label: 'IPB Post-Restore Customer (0169998888)' }).catch(()=>{});
    await page.waitForTimeout(200);
    await page.selectOption('#nj-vehicle', '__new__');
    await page.waitForTimeout(200);
    await page.fill('#nj-new-plate', 'IPB 0002');
    await page.fill('#nj-desc', 'IPB post-restore job');
    await page.click('[data-action="create-job"]');
    await page.waitForFunction(() => db.jobs.some(j=>j.description==='IPB post-restore job'), { timeout: 10000 }).catch(()=>{});
  }catch(e){ jobCreateError = e.message; }
  r.check('no Playwright-level error creating a job post-restore', jobCreateError, null);
  r.checkTrue('job actually created post-restore (proves db.branches[0] fallback worked)', await page.evaluate(() => db.jobs.some(j=>j.description==='IPB post-restore job')));

  await page.evaluate(() => {
    db.suppliers = db.suppliers.filter(s => s.name !== 'IPB Test Supplier');
    db.inventory = db.inventory.filter(i => i.sku !== 'IPB-ITEM-1');
    db.purchaseOrders = db.purchaseOrders.filter(po => !po.items.some(it=>it.name==='IPB Part'));
    db.customers = db.customers.filter(c => c.name !== 'IPB Post-Restore Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'IPB 0002');
    db.jobs = db.jobs.filter(j => j.description !== 'IPB post-restore job');
    queueSave();
  });
  await page.waitForTimeout(2000);
  fs.unlinkSync(dlPath);
  fs.unlinkSync(brokenPath);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
