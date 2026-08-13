// Regression guard for the toast-render fix: showToast() must patch its own
// #toast-root node directly and never call render(), or an open modal's
// in-progress (unsaved) form fields get silently wiped the moment any toast
// shows or auto-dismisses — including toasts from a completely unrelated
// action fired seconds earlier.
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('toast-modal-safety');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const supplierId = await page.evaluate(() => {
    const id = uid();
    db.suppliers.push({ id, name: 'Toast Test Supplier', phone: '' });
    return id;
  });

  // Case 1: a toast's ~2.2s auto-dismiss timer firing while a DIFFERENT modal
  // is now open must not reset that modal's already-selected value.
  await page.evaluate(() => showToast('unrelated earlier action'));
  await page.evaluate(() => setState({ view: 'finance', financeTab: 'po', modal: { type: 'new-po' } }));
  await page.waitForTimeout(200);
  await page.selectOption('#po-supplier', supplierId);
  await page.waitForTimeout(2500); // past the 2.2s auto-dismiss window
  const survivedDismissTimer = await page.$eval('#po-supplier', el => el.value).catch(()=>null);
  r.check('supplier selection survives an unrelated toast auto-dismissing later', survivedDismissTimer, supplierId);

  // Case 2: a validation toast fired by the SAME modal's own save handler
  // must not wipe sibling fields in that modal.
  await page.evaluate(() => setState({ modal: { type: 'new-po' } }));
  await page.waitForTimeout(200);
  await page.fill('#po-items', 'Some Part:5:20');
  await page.click('[data-action="save-po"]'); // supplier left blank -> validation toast fires
  await page.waitForTimeout(300);
  const itemsSurvived = await page.$eval('#po-items', el => el.value).catch(()=>null);
  r.check('items field survives a validation toast for a different field', itemsSurvived, 'Some Part:5:20');

  await page.evaluate((id) => {
    db.suppliers = db.suppliers.filter(s => s.id !== id);
    queueSave();
  }, supplierId);
  await page.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
