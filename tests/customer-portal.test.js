// Customer self-service coverage: vehicle service history lookup,
// self-service appointment booking (-> Lead), quotation approval and
// invoice viewing via anonymous share links AND via an optional
// customer-portal account, and the security isolation between the
// customer-portal login and the staff login (see src/customer-portal.js,
// src/login-kiosk.js, and the kiosk_*/is_customer()/link_customer_account
// RPCs in backend/schema.sql). kiosk_lookup_job/kiosk_submit_feedback and
// the inspection-report share flow are already covered in
// new-features-batch2.test.js, so not repeated here.
const { chromium } = require('playwright');
const { login, clickInPage, waitForSyncIdle, appUrl } = require('./helpers');
const { makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('customer-portal');
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsA = [];
  await login(pageA, 'A', errorsA);
  await pageA.evaluate(() => { state.language = 'en'; render(); });

  await pageA.evaluate(() => {
    db.quotations = (db.quotations||[]).filter(q => !(q.items||[]).some(it=>(it.name||'').startsWith('CPT')));
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('CPT')));
    db.inventory = db.inventory.filter(i => i.sku !== 'CPT-PROBE');
    // The literal 'Hijack Attempt' name (no CPT prefix) is a one-time
    // self-heal for a leftover row created by an earlier version of the
    // hijack-attempt probe below, before it was renamed to 'CPT Hijack
    // Attempt' -- that stray row had phone 0181112222, the same phone
    // "customer A created" reuses, which made this test start failing on
    // every run AFTER the one that created it (the app's own save-customer
    // duplicate-phone confirm blocked the plain create).
    db.customers = db.customers.filter(c => !c.name.startsWith('CPT') && c.name !== 'Hijack Attempt');
    db.vehicles = db.vehicles.filter(v => !v.plate.startsWith('CPT'));
    db.leads = (db.leads||[]).filter(l => !(l.name||'').startsWith('CPT'));
    queueSave();
  });
  await pageA.waitForTimeout(1000);

  // ================= setup: customer + vehicle + item + quotation + invoice =================
  await pageA.evaluate(() => setState({ view: 'customers' }));
  await pageA.click('[data-action="new-customer"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#cust-name', 'CPT Customer A');
  await pageA.fill('#cust-phone', '0181112222');
  await pageA.click('[data-action="save-customer"]');
  await pageA.waitForTimeout(500);
  const custAId = await pageA.evaluate(() => db.customers.find(c=>c.name==='CPT Customer A')?.id);
  r.checkTrue('customer A created', !!custAId);

  await pageA.evaluate((cid) => {
    db.vehicles.push({ id: uid(), customerId: cid, plate: 'CPT 0001', model: 'Proton Saga', color:'', odometer:0, serviceIntervalKm:10000, lastServiceKm:0 });
    queueSave();
  }, custAId);
  await pageA.waitForTimeout(500);
  const vehId = await pageA.evaluate(() => db.vehicles.find(v=>v.plate==='CPT 0001')?.id);
  r.checkTrue('vehicle created', !!vehId);

  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await pageA.click('[data-action="new-item"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#it-name', 'CPT Probe Item');
  await pageA.fill('#it-sku', 'CPT-PROBE');
  await pageA.fill('#it-qty', '5');
  await pageA.fill('#it-cost', '10');
  await pageA.fill('#it-price', '50');
  await pageA.fill('#it-low', '1');
  await pageA.click('[data-action="save-item"]');
  await pageA.waitForTimeout(600);
  const itemId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='CPT-PROBE')?.id);

  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#pos-customer', custAId).catch(()=>{});
  await pageA.waitForTimeout(150);
  await pageA.selectOption('#pos-vehicle', vehId).catch(()=>{});
  await clickInPage(pageA, `[data-action="add-to-cart"][data-id="${itemId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="save-quotation"]');
  await pageA.waitForTimeout(800);
  const quoteId = await pageA.evaluate(() => [...db.quotations].sort((a,b)=>b.createdAt-a.createdAt)[0]?.id);
  r.checkTrue('quotation created', !!quoteId);
  await pageA.evaluate(() => setState({ view: 'finance', financeTab: 'quotations' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="share-quotation-approval"][data-id="${quoteId}"]`);
  await pageA.waitForTimeout(500);
  const quote = await pageA.evaluate((id) => { const q = db.quotations.find(x=>x.id===id); return { token: q?.quoteToken, status: q?.status }; }, quoteId);
  r.checkTrue('quotation share token generated', !!quote.token);
  r.check('quotation status becomes "sent" after sharing', quote.status, 'sent');

  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#pos-customer', custAId).catch(()=>{});
  await pageA.waitForTimeout(150);
  await pageA.selectOption('#pos-vehicle', vehId).catch(()=>{});
  await clickInPage(pageA, `[data-action="add-to-cart"][data-id="${itemId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="checkout"]');
  await pageA.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='CPT Probe Item')), { timeout: 10000 }).catch(()=>{});
  await pageA.waitForTimeout(500);
  const invoiceId = await pageA.evaluate(() => [...db.invoices].sort((a,b)=>b.createdAt-a.createdAt)[0]?.id);
  r.checkTrue('invoice created', !!invoiceId);
  await pageA.evaluate(() => setState({ view: 'finance', financeTab: 'invoices' }));
  await pageA.waitForTimeout(300);
  await clickInPage(pageA, `[data-action="share-invoice-receipt"][data-id="${invoiceId}"]`);
  await pageA.waitForTimeout(500);
  const invoice = await pageA.evaluate((id) => { const i = db.invoices.find(x=>x.id===id); return { token: i?.invoiceToken }; }, invoiceId);
  r.checkTrue('invoice share token generated', !!invoice.token);
  await waitForSyncIdle(pageA);

  // ================= anonymous: vehicle history (right phone finds, wrong phone doesn't) =================
  const anonPage = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const anonErrors = [];
  anonPage.on('pageerror', e => anonErrors.push('pageerror: ' + e.message));
  anonPage.on('console', msg => { if (msg.type()==='error') anonErrors.push('console: ' + msg.text()); });
  await anonPage.goto(appUrl());
  // state is per-tab (each Playwright page loads its own independent copy
  // of the app) -- setting language on pageA above has no effect here.
  await anonPage.evaluate(() => { state.language = 'en'; render(); });
  await anonPage.waitForSelector('[data-action="open-kiosk"]', { timeout: 15000 });
  await clickInPage(anonPage, '[data-action="open-kiosk"]');
  await anonPage.waitForTimeout(300);
  await clickInPage(anonPage, '[data-kiosktab="history"]');
  await anonPage.waitForTimeout(200);
  await anonPage.fill('#history-plate', 'CPT 0001');
  await anonPage.fill('#history-phone', '0181112222');
  await clickInPage(anonPage, '[data-action="history-check"]');
  await anonPage.waitForFunction(() => state.historyResult && state.historyResult !== 'loading', { timeout: 10000 }).catch(()=>{});
  const historyOk = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('vehicle history with correct phone shows the vehicle', historyOk.includes('CPT 0001') || historyOk.includes('Proton Saga'));
  r.checkTrue('vehicle history shows the invoice', historyOk.includes('RM 50.00'));

  await anonPage.fill('#history-phone', '0100009999');
  await clickInPage(anonPage, '[data-action="history-check"]');
  await anonPage.waitForFunction(() => state.historyResult === 'notfound', { timeout: 10000 }).catch(()=>{});
  const historyWrongPhone = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('vehicle history with wrong phone is rejected', historyWrongPhone.includes('No matching record'));

  // ================= anonymous: appointment request becomes a Lead =================
  await clickInPage(anonPage, '[data-kiosktab="book"]');
  await anonPage.waitForTimeout(200);
  await anonPage.fill('#book-name', 'CPT Booker');
  await anonPage.fill('#book-phone', '0181112222');
  await anonPage.fill('#book-plate', 'CPT 0001');
  await anonPage.fill('#book-notes', 'CPT test booking notes');
  await clickInPage(anonPage, '[data-action="book-submit"]');
  await anonPage.waitForFunction(() => state.bookSubmitted === true, { timeout: 10000 }).catch(()=>{});
  const bookScreen = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('booking request shows confirmation', bookScreen.includes('Request sent'));
  await pageA.waitForFunction(() => (db.leads||[]).some(l=>l.name==='CPT Booker'), { timeout: 15000 }).catch(()=>{});
  const lead = await pageA.evaluate(() => (db.leads||[]).find(l=>l.name==='CPT Booker'));
  r.checkTrue('booking request created a Lead on the staff side', !!lead);
  r.check('lead source is "Tempahan Dalam Talian"', lead && lead.source, 'Tempahan Dalam Talian');

  // ================= anonymous: quotation approval via share link =================
  await anonPage.goto(`${appUrl()}?quote=${encodeURIComponent(quoteId)}&token=${encodeURIComponent(quote.token)}`);
  await anonPage.waitForTimeout(2000);
  const quoteScreen = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('quotation approval screen shows the item total', quoteScreen.includes('RM 50.00'));
  await clickInPage(anonPage, '[data-action="quote-approve"]');
  await anonPage.waitForTimeout(1500);
  const quoteStatusAfter = await pageA.evaluate((id) => db.quotations.find(q=>q.id===id)?.status, quoteId);
  r.check('quotation approved via anonymous link syncs to staff side', quoteStatusAfter, 'accepted');

  // ================= anonymous: invalid token is rejected =================
  await anonPage.goto(`${appUrl()}?quote=${encodeURIComponent(quoteId)}&token=wrong-token-here`);
  await anonPage.waitForTimeout(2000);
  const invalidQuoteScreen = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('quotation with wrong token shows invalid, not the real data', invalidQuoteScreen.includes('invalid') || invalidQuoteScreen.includes('tidak sah'));

  // ================= anonymous: invoice view via share link =================
  await anonPage.goto(`${appUrl()}?invoice=${encodeURIComponent(invoiceId)}&token=${encodeURIComponent(invoice.token)}`);
  await anonPage.waitForTimeout(2000);
  const invoiceScreen = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('invoice view screen shows the total', invoiceScreen.includes('RM 50.00'));

  // ================= customer-portal account: signup, link, dashboard, approve from dashboard =================
  // Fixed, reused credentials -- NOT a fresh email per run. Supabase Auth
  // users can't be deleted through the anon/authenticated client (needs a
  // service-role key this test suite doesn't have), so a per-run unique
  // email would leave two more orphaned accounts in the shared test
  // project forever, on every single CI run. Try logging in first (the
  // common case, reusing the account from a previous run); only fall back
  // to signing up the very first time this ever runs against a given test
  // project. Matches the same "one fixed, reused account" pattern as
  // TEST_EMAIL/TEST_PASSWORD in helpers.js.
  const emailA = 'cpt-fixed-customer-a@mailinator.com';
  const passwordA = 'CptFixedPassA123!';
  await anonPage.goto(appUrl());
  await anonPage.evaluate(() => { state.language = 'en'; render(); }); // reset after the full page reload above
  await anonPage.waitForSelector('[data-action="open-kiosk"]', { timeout: 15000 });
  await clickInPage(anonPage, '[data-action="open-kiosk"]');
  await anonPage.waitForTimeout(300);
  await clickInPage(anonPage, '[data-kiosktab="account"]');
  await anonPage.waitForTimeout(1000);
  await anonPage.fill('#cp-email', emailA);
  await anonPage.fill('#cp-password', passwordA);
  await clickInPage(anonPage, '[data-action="cust-portal-login"]');
  await anonPage.waitForFunction(() => state.custPortalMode !== 'login' || !!state.custPortalError, { timeout: 10000 }).catch(()=>{});
  if(await anonPage.evaluate(() => !!state.custPortalError)){
    // First run ever against this test project -- account doesn't exist yet.
    await clickInPage(anonPage, '[data-action="cust-portal-mode-signup"]');
    await anonPage.waitForTimeout(200);
    await anonPage.fill('#cp-email', emailA);
    await anonPage.fill('#cp-password', passwordA);
    await clickInPage(anonPage, '[data-action="cust-portal-signup"]');
    await anonPage.waitForFunction(() => state.custPortalMode === 'link', { timeout: 10000 }).catch(()=>{});
  }
  await anonPage.fill('#cp-name', 'CPT Customer A');
  await anonPage.fill('#cp-phone', '0181112222');
  // Phone alone is no longer enough to link to Customer A's EXISTING
  // record (see link_customer_account in backend/schema.sql) -- a plate
  // registered to that same phone number must also be provided, otherwise
  // this just creates a brand-new, unrelated profile instead of finding
  // the one set up in the earlier "setup" section above.
  await anonPage.fill('#cp-plate', 'CPT 0001');
  await clickInPage(anonPage, '[data-action="cust-portal-link"]');
  await anonPage.waitForFunction(() => state.custPortalMode === 'dashboard', { timeout: 10000 }).catch(()=>{});
  await anonPage.waitForFunction(() => state.custPortalData && state.custPortalData !== 'loading', { timeout: 10000 }).catch(()=>{});
  const dashboardA = await anonPage.evaluate(() => document.body.innerText);
  r.checkTrue('customer A dashboard greets them by name', dashboardA.includes('Hi, CPT Customer A'));
  r.checkTrue('customer A dashboard shows their own invoice', dashboardA.includes('RM 50.00'));

  // ================= regression: staff/shop_meta/audit_log + staff-only RPCs must stay closed to a customer session =================
  // A /code-review ultra pass found that these tables' policies and the
  // next_counter/claim_staff_record RPCs predated is_customer() (see above)
  // and were never revisited to exclude it -- "using (true)" let any
  // registered customer-portal account read the full staff roster (incl.
  // attendanceToken), the license key in shop_meta, and the whole
  // audit_log, plus forge audit_log entries and call staff-only RPCs,
  // directly via the REST API. Fixed in backend/schema.sql; this locks
  // that fix in so it can't silently regress.
  const directTableLeak = await anonPage.evaluate(async () => {
    const client = getCustomerAuthClient();
    const [staffRes, shopMetaRes, auditRes] = await Promise.all([
      client.from('staff').select('*'),
      client.from('shop_meta').select('*'),
      client.from('audit_log').select('*'),
    ]);
    return {
      staffRows: (staffRes.data || []).length,
      shopMetaRows: (shopMetaRes.data || []).length,
      auditRows: (auditRes.data || []).length,
    };
  });
  r.check('customer-portal session sees zero staff rows directly', directTableLeak.staffRows, 0);
  r.check('customer-portal session sees zero shop_meta rows directly', directTableLeak.shopMetaRows, 0);
  r.check('customer-portal session sees zero audit_log rows directly', directTableLeak.auditRows, 0);

  const auditForgeAttempt = await anonPage.evaluate(async () => {
    const client = getCustomerAuthClient();
    const { error } = await client.from('audit_log').insert({ id: 'cpt-forged-' + Date.now(), data: { action: 'forged by customer-portal test' } });
    return { blocked: !!error };
  });
  r.checkTrue('customer-portal session cannot forge an audit_log entry', auditForgeAttempt.blocked);

  const staffRpcBlocked = await anonPage.evaluate(async () => {
    const client = getCustomerAuthClient();
    const counterRes = await client.rpc('next_counter', { counter_name: 'cpt-probe' });
    const claimRes = await client.rpc('claim_staff_record');
    return { counterBlocked: !!counterRes.error, claimResult: claimRes.data };
  });
  r.checkTrue('customer-portal session cannot call next_counter()', staffRpcBlocked.counterBlocked);
  r.check('customer-portal session gets null from claim_staff_record()', staffRpcBlocked.claimResult, null);

  // ================= second, unrelated customer B -- must NOT see Customer A's data =================
  const emailB = 'cpt-fixed-customer-b@mailinator.com';
  const passwordB = 'CptFixedPassB123!';
  const custPageB = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errorsB = [];
  custPageB.on('pageerror', e => errorsB.push('pageerror: ' + e.message));
  custPageB.on('console', msg => { if (msg.type()==='error') errorsB.push('console: ' + msg.text()); });
  await custPageB.goto(appUrl());
  await custPageB.waitForSelector('[data-action="open-kiosk"]', { timeout: 15000 });
  await clickInPage(custPageB, '[data-action="open-kiosk"]');
  await custPageB.waitForTimeout(300);
  await clickInPage(custPageB, '[data-kiosktab="account"]');
  await custPageB.waitForTimeout(1000);
  await custPageB.fill('#cp-email', emailB);
  await custPageB.fill('#cp-password', passwordB);
  await clickInPage(custPageB, '[data-action="cust-portal-login"]');
  await custPageB.waitForFunction(() => state.custPortalMode !== 'login' || !!state.custPortalError, { timeout: 10000 }).catch(()=>{});
  if(await custPageB.evaluate(() => !!state.custPortalError)){
    await clickInPage(custPageB, '[data-action="cust-portal-mode-signup"]');
    await custPageB.waitForTimeout(200);
    await custPageB.fill('#cp-email', emailB);
    await custPageB.fill('#cp-password', passwordB);
    await clickInPage(custPageB, '[data-action="cust-portal-signup"]');
    await custPageB.waitForFunction(() => state.custPortalMode === 'link', { timeout: 10000 }).catch(()=>{});
  }
  await custPageB.fill('#cp-name', 'CPT Customer B');
  await custPageB.fill('#cp-phone', '0199997777'); // different phone -- no relation to Customer A
  await clickInPage(custPageB, '[data-action="cust-portal-link"]');
  await custPageB.waitForFunction(() => state.custPortalMode === 'dashboard', { timeout: 10000 }).catch(()=>{});
  await custPageB.waitForFunction(() => state.custPortalData && state.custPortalData !== 'loading', { timeout: 10000 }).catch(()=>{});
  const dashboardB = await custPageB.evaluate(() => document.body.innerText);
  r.checkTrue('customer B dashboard does NOT show Customer A\'s invoice total', !dashboardB.includes('RM 50.00'));

  const crossAccess = await custPageB.evaluate(async (qId) => {
    const client = getCustomerAuthClient();
    const { data } = await client.rpc('kiosk_get_quotation', { p_quote_id: qId });
    return data;
  }, quoteId);
  r.check('customer B cannot fetch customer A\'s quotation by id without a token', crossAccess, null);

  // ================= regression: phone-only linking must not hijack Customer A's existing record =================
  // A /code-review ultra pass found link_customer_account() would link to
  // ANY existing unlinked customer row matching the given phone number
  // alone -- and a phone number isn't a secret (it's on every invoice/
  // receipt, shared over WhatsApp), so anyone who knew Customer A's phone
  // could sign up first and hijack their whole history, including
  // approving/rejecting pending quotations. Fixed to also require a
  // matching vehicle plate; no plate (as here) must fall through to a
  // brand-new profile instead of silently claiming Customer A's record.
  // Dedicated fixed account (not A or B) -- must be a session that has
  // never linked before, so this actually exercises the phone-matching
  // path rather than short-circuiting on an already-linked profile.
  const emailC = 'cpt-fixed-customer-c@mailinator.com';
  const passwordC = 'CptFixedPassC123!';
  const custPageC = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await custPageC.goto(appUrl());
  const hijackAttempt = await custPageC.evaluate(async (creds) => {
    const client = getCustomerAuthClient();
    const { error: signInErr } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password });
    if (signInErr) {
      const { error: signUpErr } = await client.auth.signUp({ email: creds.email, password: creds.password });
      if (signUpErr) return { authError: signUpErr.message };
    }
    // 'CPT ...' name -- not just any name -- so the cleanup step at the top
    // of this test's NEXT run actually removes this leftover profile. This
    // call is expected to succeed (just not hijack Customer A), so it
    // really does create a persistent row on the fixed, reused account.
    const { data } = await client.rpc('link_customer_account', { p_phone: '0181112222', p_name: 'CPT Hijack Attempt' });
    return { data };
  }, { email: emailC, password: passwordC });
  r.checkTrue(
    'phone-only link attempt does not hijack customer A\'s record',
    !!(hijackAttempt.data && hijackAttempt.data.success && hijackAttempt.data.customerId !== custAId)
  );
  await custPageC.close();

  // ================= staff account cannot register as a customer =================
  const { TEST_EMAIL, TEST_PASSWORD } = require('./helpers');
  const staffLinkResult = await custPageB.evaluate(async (creds) => {
    const client = getCustomerAuthClient();
    await client.auth.signOut().catch(()=>{});
    const { error: authErr } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password });
    if(authErr) return { authError: authErr.message };
    const { data } = await client.rpc('link_customer_account', { p_phone: '0161234567', p_name: 'Staff Trying To Link' });
    return data;
  }, { email: TEST_EMAIL, password: TEST_PASSWORD });
  r.check('staff account is rejected when trying to link as a customer', staffLinkResult && staffLinkResult.reason, 'staff_account');

  // Confirm staff login still works normally after that attempt (no self-lockout).
  const staffRecheckPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsStaffRecheck = [];
  await login(staffRecheckPage, 'StaffRecheck', errorsStaffRecheck);
  r.checkTrue('staff can still log in normally after a rejected customer-link attempt', await staffRecheckPage.evaluate(() => !!state.currentStaff));
  await staffRecheckPage.close();

  // The RLS/RPC-rejection regression checks above deliberately trigger a
  // real 403 (audit_log insert blocked by RLS) and 400 (next_counter's
  // `raise exception`) -- the browser logs failed network requests to the
  // console regardless of the app handling them correctly, so those two
  // are expected here and filtered out before the catch-all check below.
  const anonErrorsFiltered = anonErrors.filter(e => !/Failed to load resource.*status of (403|400)/.test(e));
  r.checkEmpty('no console/page errors (customer A session)', anonErrorsFiltered);
  r.checkEmpty('no console/page errors (customer B session)', errorsB);

  // ---- cleanup ----
  await pageA.evaluate(() => {
    db.quotations = (db.quotations||[]).filter(q => !(q.items||[]).some(it=>(it.name||'').startsWith('CPT')));
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('CPT')));
    db.inventory = db.inventory.filter(i => i.sku !== 'CPT-PROBE');
    // The literal 'Hijack Attempt' name (no CPT prefix) is a one-time
    // self-heal for a leftover row created by an earlier version of the
    // hijack-attempt probe below, before it was renamed to 'CPT Hijack
    // Attempt' -- that stray row had phone 0181112222, the same phone
    // "customer A created" reuses, which made this test start failing on
    // every run AFTER the one that created it (the app's own save-customer
    // duplicate-phone confirm blocked the plain create).
    db.customers = db.customers.filter(c => !c.name.startsWith('CPT') && c.name !== 'Hijack Attempt');
    db.vehicles = db.vehicles.filter(v => !v.plate.startsWith('CPT'));
    db.leads = (db.leads||[]).filter(l => !(l.name||'').startsWith('CPT'));
    queueSave();
  });
  await pageA.waitForTimeout(1200);

  r.checkEmpty('no console/page errors (staff session)', errorsA);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
