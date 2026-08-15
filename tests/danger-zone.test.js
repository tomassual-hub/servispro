// Danger Zone (Settings -> "Reset Data Pelanggan & Transaksi") and the
// typed-confirmation mechanism it introduced to askConfirm(). Deliberately
// does NOT click through a real confirm here -- this shared test account's
// db.customers/vehicles/jobs/invoices/creditNotes/quotations/appointments/
// contracts/cashClosures are relied on by every other test file's own
// bookkeeping (e.g. counts asserted elsewhere), and queueSave() diffs
// against the server's last-synced snapshot regardless of what's staged
// locally first, so an actual wipe here would delete every OTHER test's
// data too, not just this file's. The reset logic itself is a
// straightforward mutation (reviewed by hand, see 'reset-shop-data' in
// src/event-handlers.js) -- what actually carries bug risk, and what this
// file covers, is the surrounding machinery: who can see the button, and
// whether the typed-confirm gate really blocks a mismatched/empty value.
const { chromium } = require('playwright');
const { login, clickInPage, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('danger-zone');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errors = [];
  await login(page, 'A', errors);

  await page.evaluate(() => setState({ view: 'settings' }));
  await page.waitForTimeout(400);
  r.checkTrue('Danger Zone button visible for Admin/Pemilik', await page.evaluate(() => !!document.querySelector('[data-action="reset-shop-data"]')));

  // Client-side role swap (no real backend permission change) to verify
  // the button is gated by isOwnerLevel(), not just canManage() -- Kerani
  // can already reach Settings itself, but shouldn't see this specific
  // panel.
  await page.evaluate(() => { state.currentStaff.role = 'Kerani'; render(); });
  await page.waitForTimeout(200);
  r.checkTrue('Danger Zone button hidden for Kerani', await page.evaluate(() => !document.querySelector('[data-action="reset-shop-data"]')));
  await page.evaluate(() => { state.currentStaff.role = 'Admin'; render(); });
  await page.waitForTimeout(200);

  // Open the typed-confirm dialog and verify the gate actually gates --
  // cancel afterward rather than confirming, for the reason in the header
  // comment above.
  await page.click('[data-action="reset-shop-data"]');
  await page.waitForTimeout(300);
  r.check('confirm button starts disabled', await page.evaluate(() => document.querySelector('[data-action="confirm-yes"]')?.disabled), true);

  await page.fill('#confirm-typed-input', 'padam'); // lowercase -- must NOT match
  await page.waitForTimeout(100);
  r.check('lowercase does not satisfy the typed-confirm gate', await page.evaluate(() => document.querySelector('[data-action="confirm-yes"]')?.disabled), true);

  await page.fill('#confirm-typed-input', 'PADA'); // partial -- must NOT match
  await page.waitForTimeout(100);
  r.check('partial text does not satisfy the typed-confirm gate', await page.evaluate(() => document.querySelector('[data-action="confirm-yes"]')?.disabled), true);

  await page.fill('#confirm-typed-input', 'PADAM'); // exact -- must enable
  await page.waitForTimeout(100);
  r.check('exact match enables the confirm button', await page.evaluate(() => document.querySelector('[data-action="confirm-yes"]')?.disabled), false);

  // page.click() geometrically targets the visual center of the first
  // matching element -- both the modal-overlay backdrop AND the "Batal"
  // button inside it carry data-action="confirm-cancel", and the overlay's
  // own center point is covered by the modal box itself (whose own onclick
  // stops propagation), so a geometric click there lands on inert modal
  // content instead of either real target. clickInPage resolves the
  // selector and calls .click() on that exact node directly, sidestepping
  // the ambiguity -- same reasoning as clickInPage's own doc comment in
  // helpers.js.
  await clickInPage(page, '[data-action="confirm-cancel"]');
  await page.waitForTimeout(300);
  r.checkTrue('cancel closes the dialog without wiping anything', await page.evaluate(() => !state.confirmAction));

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
