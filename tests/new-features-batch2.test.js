// End-to-end coverage for the large "build everything buildable from the
// competitor changelog" feature batch: Return Job, Package pricing,
// Split/Partial payment + balance settlement, Credit Notes, Quotation ->
// Invoice conversion, Inventory CSV import, Part Requisition Suggestions,
// QR Attendance (anonymous punch flow), Vehicle Inspection diagram marking
// + shareable customer report/signature, and the waiting-area Display
// Board. The three anonymous/URL-param flows (attendance, inspect, board)
// are exercised on a second, never-logged-in page, mirroring how a real
// customer's/staff's phone would reach them.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter, appUrl } = require('./helpers');

async function run(){
  const r = makeReporter('new-features-batch2');
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsA = [];
  await login(pageA, 'A', errorsA);
  // save-quotation/save-credit-note trigger a print*() call as part of the
  // normal flow -- stub window.print so the test doesn't depend on how
  // headless Chromium handles the native print dialog.
  await pageA.evaluate(() => { window.print = () => {}; });

  await pageA.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'NFB2 Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'NFB2 0001');
    db.jobs = db.jobs.filter(j => !(j.description||'').includes('NFB2'));
    db.inventory = db.inventory.filter(i => !(i.sku||'').startsWith('NFB2-'));
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.quotations = (db.quotations||[]).filter(q => !(q.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.creditNotes = (db.creditNotes||[]).filter(cn => !(cn.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.packages = (db.packages||[]).filter(p => p.name !== 'NFB2 Package');
    db.staff = db.staff.filter(s => s.name !== 'NFB2 Test Mechanic');
    db.attendance = (db.attendance||[]).filter(a => a.staffName !== 'NFB2 Test Mechanic');
    db.purchaseOrders = db.purchaseOrders.filter(po => !(po.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    queueSave();
  });
  await pageA.waitForTimeout(1500);

  // ---- Setup: customer, three inventory items, one job ----
  await pageA.evaluate(() => setState({ view: 'customers' }));
  await pageA.click('[data-action="new-customer"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#cust-name', 'NFB2 Customer');
  await pageA.fill('#cust-phone', '0169998888');
  await pageA.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(pageA);
  const custId = await pageA.evaluate(() => db.customers.find(c=>c.name==='NFB2 Customer')?.id);
  r.checkTrue('customer created', !!custId);

  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  const addItem = async (name, sku, qty, cost, price, low) => {
    await pageA.click('[data-action="new-item"]');
    await pageA.waitForTimeout(200);
    await pageA.fill('#it-name', name);
    await pageA.fill('#it-sku', sku);
    await pageA.fill('#it-qty', String(qty));
    await pageA.fill('#it-cost', String(cost));
    await pageA.fill('#it-price', String(price));
    await pageA.fill('#it-low', String(low));
    await pageA.click('[data-action="save-item"]');
    await pageA.waitForTimeout(600);
  };
  await addItem('NFB2 Oil', 'NFB2-OIL', 20, 10, 25, 3);
  await addItem('NFB2 Filter', 'NFB2-FILTER', 20, 4, 12, 3);
  await addItem('NFB2 Brake Pad', 'NFB2-BRAKE', 10, 20, 100, 2);
  const oilId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='NFB2-OIL')?.id);
  const filterId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='NFB2-FILTER')?.id);
  const brakeId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='NFB2-BRAKE')?.id);
  r.checkTrue('inventory items created', !!oilId && !!filterId && !!brakeId);

  await pageA.evaluate(() => setState({ view: 'jobs' }));
  await pageA.click('[data-action="new-job"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#nj-customer', custId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#nj-vehicle', '__new__');
  await pageA.waitForTimeout(200);
  await pageA.fill('#nj-new-plate', 'NFB2 0001');
  await pageA.fill('#nj-desc', 'NFB2 test job');
  await pageA.fill('#nj-mechanic', 'Test Mechanic');
  await pageA.click('[data-action="create-job"]');
  await pageA.waitForFunction(() => db.jobs.some(j=>j.description==='NFB2 test job'), { timeout: 10000 }).catch(()=>{});
  const jobId = await pageA.evaluate(() => db.jobs.find(j=>j.description==='NFB2 test job')?.id);
  r.checkTrue('job created', !!jobId);
  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); job.status = 'progress'; queueSave(); }, jobId);
  const jobNo = await pageA.evaluate((id) => db.jobs.find(j=>j.id===id)?.jobNo, jobId);
  await waitForSyncIdle(pageA);

  // ================= 1. Return Job =================
  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="return-job"][data-id="${jobId}"]`);
  await pageA.waitForFunction((origId) => db.jobs.some(j=>j.returnFromJobId===origId), jobId, { timeout: 10000 }).catch(()=>{});
  const returnJob = await pageA.evaluate((origId) => {
    const j = db.jobs.find(j=>j.returnFromJobId===origId);
    return j ? { returnFromJobId: j.returnFromJobId, status: j.status } : null;
  }, jobId);
  r.checkTrue('return job created', !!returnJob);
  r.check('return job links back to original', returnJob?.returnFromJobId, jobId);
  await pageA.click('[data-action="close-modal"]');
  await pageA.waitForTimeout(200);

  // ================= 2. Package pricing + POS checkout =================
  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'packages' }));
  await pageA.click('[data-action="new-package"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#pkg-name', 'NFB2 Package');
  await pageA.fill('#pkg-items', 'NFB2 Oil:2\nNFB2 Filter:1');
  await pageA.fill('#pkg-price', '45');
  await pageA.click('[data-action="save-package"]');
  await pageA.waitForTimeout(600);
  const pkgId = await pageA.evaluate(() => (db.packages||[]).find(p=>p.name==='NFB2 Package')?.id);
  r.checkTrue('package created', !!pkgId);

  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="add-package-to-cart"][data-id="${pkgId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="checkout"]');
  await pageA.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='NFB2 Package')), { timeout: 10000 }).catch(()=>{});
  const pkgResult = await pageA.evaluate(() => {
    const inv = db.invoices.find(inv => inv.items && inv.items.some(it=>it.name==='NFB2 Package'));
    return { total: inv?.total, oilQty: db.inventory.find(i=>i.sku==='NFB2-OIL')?.qty, filterQty: db.inventory.find(i=>i.sku==='NFB2-FILTER')?.qty };
  });
  r.check('package invoice total = package price (RM45)', pkgResult.total, 45);
  r.check('package checkout deducts component stock (oil 20-2=18)', pkgResult.oilQty, 18);
  r.check('package checkout deducts component stock (filter 20-1=19)', pkgResult.filterQty, 19);

  // ================= 3. Custom/misc cart item =================
  await pageA.fill('#pos-custom-name', 'NFB2 Disposal Fee');
  await pageA.fill('#pos-custom-price', '8');
  await pageA.click('[data-action="add-custom-cart"]');
  await pageA.waitForTimeout(200);
  const customLine = await pageA.evaluate(() => state.posCart.find(c=>c.name==='NFB2 Disposal Fee'));
  r.checkTrue('custom/misc item added to cart with no refId (not real stock)', !!customLine && customLine.refId==null);
  await clickInPage(pageA, '[data-action="cart-remove"][data-idx="0"]');
  await pageA.waitForTimeout(200);

  // ================= 4. Split/partial payment + settle balance =================
  await clickInPage(pageA, `[data-action="add-to-cart"][data-id="${brakeId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.check('#pos-split-toggle');
  await pageA.waitForTimeout(200);
  await pageA.fill('#split-amount-0', '60');
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="checkout"]');
  await pageA.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='NFB2 Brake Pad')), { timeout: 10000 }).catch(()=>{});
  const splitInvId = await pageA.evaluate(() => db.invoices.find(inv => inv.items && inv.items.some(it=>it.name==='NFB2 Brake Pad'))?.id);
  r.checkTrue('split-payment invoice created', !!splitInvId);
  const splitCheck = await pageA.evaluate((id) => {
    const inv = db.invoices.find(i=>i.id===id);
    return { total: inv.total, paid: (inv.payments||[]).reduce((s,p)=>s+p.amount,0) };
  }, splitInvId);
  r.check('split invoice total RM100', splitCheck.total, 100);
  r.check('split invoice paid so far RM60', splitCheck.paid, 60);
  // Let this invoice's own creation echo settle before editing it again --
  // otherwise a late echo carrying the pre-settle payments[] can silently
  // overwrite the settle-balance push below (see helpers.js waitForSyncIdle).
  await waitForSyncIdle(pageA);

  await pageA.evaluate(() => setState({ view: 'finance', financeTab: 'invoices' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="settle-invoice-balance"][data-id="${splitInvId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.click('[data-action="confirm-settle-balance"]');
  await pageA.waitForTimeout(600);
  const settledPaid = await pageA.evaluate((id) => (db.invoices.find(i=>i.id===id).payments||[]).reduce((s,p)=>s+p.amount,0), splitInvId);
  r.check('balance fully settled (RM100 total paid)', settledPaid, 100);

  // ================= 5. Credit Note =================
  await clickInPage(pageA, `[data-action="open-credit-note"][data-id="${splitInvId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.fill('[data-cn-qty-idx="0"]', '1');
  await pageA.fill('#cn-reason', 'NFB2 test return');
  await pageA.click('[data-action="save-credit-note"]');
  await pageA.waitForTimeout(600);
  const cn = await pageA.evaluate(() => (db.creditNotes||[]).find(cn=>cn.reason==='NFB2 test return'));
  r.checkTrue('credit note created', !!cn);
  r.check('credit note total = RM100 (1x brake pad)', cn?.total, 100);

  // ================= 6. Quotation -> Invoice conversion =================
  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="add-to-cart"][data-id="${brakeId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="save-quotation"]');
  await pageA.waitForFunction(() => (db.quotations||[]).some(q=>q.items && q.items.some(it=>it.name==='NFB2 Brake Pad')), { timeout: 10000 }).catch(()=>{});
  const quoteId = await pageA.evaluate(() => (db.quotations||[]).find(q=>q.items && q.items.some(it=>it.name==='NFB2 Brake Pad'))?.id);
  r.checkTrue('quotation created', !!quoteId);
  // Let this quotation's own creation echo settle before converting it --
  // otherwise a late echo carrying the pre-conversion status/draft data can
  // silently overwrite the converted status set below.
  await waitForSyncIdle(pageA);

  await pageA.evaluate(() => setState({ view: 'finance', financeTab: 'quotations' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="convert-quote-to-invoice"][data-id="${quoteId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.click('[data-action="checkout"]');
  await pageA.waitForFunction((qid) => { const q = (db.quotations||[]).find(x=>x.id===qid); return q && q.status==='converted'; }, quoteId, { timeout: 10000 }).catch(()=>{});
  const convertedQuote = await pageA.evaluate((qid) => (db.quotations||[]).find(q=>q.id===qid), quoteId);
  r.check('quotation status becomes converted', convertedQuote?.status, 'converted');
  const convertedInvExists = await pageA.evaluate((invId) => db.invoices.some(i=>i.id===invId), convertedQuote?.convertedInvoiceId);
  r.checkTrue('converted quotation links to a real invoice', convertedInvExists);

  // ================= 7. Inventory CSV import =================
  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await pageA.waitForTimeout(200);
  const csvContent = 'name,part_number,qty,cost,price,low_stock\nNFB2 Oil,NFB2-OIL,50,11,26,3\nNFB2 CSV New Item,NFB2-CSVNEW,8,3,9,2';
  const csvPath = path.join(__dirname, '.tmp-nfb2-import.csv');
  fs.writeFileSync(csvPath, csvContent);
  await pageA.setInputFiles('#inventory-csv-input', csvPath);
  await pageA.waitForTimeout(800);
  const csvResult = await pageA.evaluate(() => ({
    oilQty: db.inventory.find(i=>i.sku==='NFB2-OIL')?.qty,
    newItem: !!db.inventory.find(i=>i.sku==='NFB2-CSVNEW'),
  }));
  r.check('CSV import updates existing item by SKU (qty->50)', csvResult.oilQty, 50);
  r.checkTrue('CSV import adds new item by SKU', csvResult.newItem);
  fs.unlinkSync(csvPath);
  // Let the CSV update's own realtime echo settle before mutating the same
  // record again -- otherwise a late echo carrying the pre-mutation qty can
  // silently overwrite the qty=1 set below (see helpers.js waitForSyncIdle).
  await waitForSyncIdle(pageA);

  // ================= 8. Part Requisition Suggestions =================
  await pageA.evaluate(() => { const oil = db.inventory.find(i=>i.sku==='NFB2-OIL'); oil.qty = 1; queueSave(); });
  await pageA.waitForTimeout(500);
  await waitForSyncIdle(pageA);
  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'requisition' }));
  await pageA.waitForTimeout(300);
  await clickInPage(pageA, '[data-action="create-po-for-supplier"][data-supplier="none"]');
  await pageA.waitForFunction(() => db.purchaseOrders.some(po=>po.items.some(it=>it.name==='NFB2 Oil')), { timeout: 10000 }).catch(()=>{});
  const reqPo = await pageA.evaluate(() => db.purchaseOrders.find(po=>po.items.some(it=>it.name==='NFB2 Oil')));
  r.checkTrue('requisition-suggested PO created for low-stock item', !!reqPo);

  // ================= 9. QR Attendance (anonymous punch flow) =================
  await pageA.evaluate(() => setState({ view: 'staffpage' }));
  await pageA.click('[data-action="new-staff"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#sf-name', 'NFB2 Test Mechanic');
  await pageA.selectOption('#sf-role', 'Mekanik');
  await pageA.fill('#sf-email', 'nfb2-test-mechanic@mailinator.com');
  await pageA.click('[data-action="save-staff"]');
  await pageA.waitForTimeout(600);
  const mechStaffId = await pageA.evaluate(() => db.staff.find(s=>s.name==='NFB2 Test Mechanic')?.id);
  r.checkTrue('test mechanic staff created', !!mechStaffId);

  await clickInPage(pageA, `[data-action="show-attendance-qr"][data-id="${mechStaffId}"]`);
  await pageA.waitForTimeout(300);
  const attToken = await pageA.evaluate((id) => db.staff.find(s=>s.id===id)?.attendanceToken, mechStaffId);
  r.checkTrue('attendance token generated', !!attToken);
  await pageA.click('[data-action="close-modal"]');
  await pageA.waitForTimeout(200);
  await waitForSyncIdle(pageA);

  const pageAnon = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsAnon = [];
  pageAnon.on('pageerror', e => errorsAnon.push(`Anon pageerror: ${e.message}`));
  pageAnon.on('console', msg => { if (msg.type()==='error') errorsAnon.push(`Anon console: ${msg.text()}`); });

  await pageAnon.goto(appUrl() + `?attendance=${encodeURIComponent(mechStaffId)}&token=${encodeURIComponent(attToken)}`);
  await pageAnon.waitForFunction(() => state.attendanceStatus && state.attendanceStatus !== 'loading', { timeout: 15000 }).catch(()=>{});
  const attStatusName = await pageAnon.evaluate(() => state.attendanceStatus && state.attendanceStatus.name);
  r.check('attendance punch screen resolves correct staff name', attStatusName, 'NFB2 Test Mechanic');
  await pageAnon.click('[data-action="do-attendance-punch"]');
  await pageAnon.waitForFunction(() => state.attendanceStatus && state.attendanceStatus.punched, { timeout: 10000 }).catch(()=>{});
  const punched = await pageAnon.evaluate(() => !!(state.attendanceStatus && state.attendanceStatus.punched));
  r.checkTrue('QR attendance punch succeeded', punched);

  await pageA.waitForFunction((id) => (db.attendance||[]).some(a=>a.staffId===id), mechStaffId, { timeout: 10000 }).catch(()=>{});
  const attRecord = await pageA.evaluate((id) => (db.attendance||[]).find(a=>a.staffId===id), mechStaffId);
  r.checkTrue('attendance record synced back to staff device', !!attRecord);
  r.check('attendance record type is "in" (first punch)', attRecord?.type, 'in');

  // ================= 10. Vehicle Inspection: diagram marking + shareable report + signature =================
  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="open-inspection"][data-id="${jobId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.click('[data-inspect-item="Minyak Enjin"]');
  await pageA.waitForTimeout(200);

  const diagramWrap = pageA.locator('#diagram-wrap');
  await diagramWrap.scrollIntoViewIfNeeded();
  const diagramBox = await diagramWrap.boundingBox();
  await pageA.mouse.click(diagramBox.x + diagramBox.width/2, diagramBox.y + diagramBox.height/2);
  await pageA.waitForTimeout(300);
  await waitForSyncIdle(pageA);
  await pageA.evaluate(() => {
    const el = document.querySelector('[data-diagram-note-idx="0"]');
    el.value = 'NFB2 scratch on door';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pageA.waitForTimeout(200);
  await waitForSyncIdle(pageA);
  const markSaved = await pageA.evaluate((id) => {
    const job = db.jobs.find(j=>j.id===id);
    const m = (job.diagramMarks||[])[0];
    return m ? { severity: m.severity, note: m.note } : null;
  }, jobId);
  r.checkTrue('diagram mark added by clicking the car diagram', !!markSaved);
  r.check('diagram mark note saved', markSaved?.note, 'NFB2 scratch on door');

  // Generate the share token directly (bypassing the "Share Report" button,
  // which opens WhatsApp/clipboard -- browser side effects unrelated to what
  // this test verifies: the anonymous report/signature flow itself).
  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); job.inspectionToken = uid()+uid(); queueSave(); }, jobId);
  await pageA.waitForTimeout(200);
  const inspToken = await pageA.evaluate((id) => db.jobs.find(j=>j.id===id)?.inspectionToken, jobId);
  r.checkTrue('inspection share token generated', !!inspToken);
  await pageA.click('[data-action="close-modal"]');
  await pageA.waitForTimeout(200);
  await waitForSyncIdle(pageA);

  await pageAnon.goto(appUrl() + `?inspect=${encodeURIComponent(jobId)}&token=${encodeURIComponent(inspToken)}`);
  await pageAnon.waitForFunction(() => state.inspectReport && state.inspectReport !== 'loading', { timeout: 15000 }).catch(()=>{});
  const inspReportCheck = await pageAnon.evaluate(() => {
    const rep = state.inspectReport;
    if(!rep || rep==='invalid') return null;
    return {
      jobNo: rep.jobNo,
      hasChecklistItem: rep.inspection && rep.inspection['Minyak Enjin']==='ok',
      markNote: rep.diagramMarks && rep.diagramMarks[0] && rep.diagramMarks[0].note,
      signed: rep.signed,
    };
  });
  r.checkTrue('inspection report loaded anonymously for customer', !!inspReportCheck);
  r.check('inspection report shows correct job no.', inspReportCheck?.jobNo, jobNo);
  r.checkTrue('inspection report shows checklist finding', inspReportCheck?.hasChecklistItem);
  r.check('inspection report shows diagram mark note', inspReportCheck?.markNote, 'NFB2 scratch on door');
  r.check('inspection report not yet signed', inspReportCheck?.signed, false);

  const sigPad = pageAnon.locator('#insp-sig-pad');
  await sigPad.scrollIntoViewIfNeeded();
  const sigPadBox = await sigPad.boundingBox();
  await pageAnon.mouse.move(sigPadBox.x + 20, sigPadBox.y + 20);
  await pageAnon.mouse.down();
  await pageAnon.mouse.move(sigPadBox.x + 80, sigPadBox.y + 60);
  await pageAnon.mouse.up();
  await pageAnon.click('[data-action="submit-inspection-signature"]');
  await pageAnon.waitForFunction(() => state.inspectReport && state.inspectReport.signed, { timeout: 10000 }).catch(()=>{});
  const signedOnAnon = await pageAnon.evaluate(() => !!(state.inspectReport && state.inspectReport.signed));
  r.checkTrue('customer signature submitted', signedOnAnon);

  await pageA.waitForFunction((id) => !!db.jobs.find(j=>j.id===id)?.customerInspectionSignature, jobId, { timeout: 10000 }).catch(()=>{});
  const sigSynced = await pageA.evaluate((id) => !!db.jobs.find(j=>j.id===id)?.customerInspectionSignature, jobId);
  r.checkTrue('signature synced back to staff device', sigSynced);

  // A second signature attempt against the same token must be rejected
  // (fail closed -- no overwriting an existing signature).
  const secondAttempt = await pageAnon.evaluate(async (args) => {
    const { data } = await supabaseClient.rpc('kiosk_submit_inspection_signature', { p_job_id: args.jobId, p_token: args.token, p_signature: 'data:image/png;base64,AA==' });
    return data;
  }, { jobId, token: inspToken });
  r.check('re-signing an already-signed report is rejected', secondAttempt, false);

  // ================= 11. Waiting-Area Display Board =================
  await pageAnon.goto(appUrl() + '?board=1');
  await pageAnon.waitForFunction(() => Array.isArray(state.boardJobs), { timeout: 15000 }).catch(()=>{});
  const boardEntry = await pageAnon.evaluate((expectedJobNo) => (state.boardJobs||[]).find(j=>j.jobNo===expectedJobNo), jobNo);
  r.checkTrue('display board shows the active job', !!boardEntry);
  r.check('display board shows correct status', boardEntry?.status, 'progress');
  r.check('display board shows correct plate', boardEntry?.plate, 'NFB2 0001');

  // ---- cleanup ----
  await pageA.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'NFB2 Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'NFB2 0001');
    db.jobs = db.jobs.filter(j => !(j.description||'').includes('NFB2'));
    db.inventory = db.inventory.filter(i => !(i.sku||'').startsWith('NFB2-'));
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.quotations = (db.quotations||[]).filter(q => !(q.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.creditNotes = (db.creditNotes||[]).filter(cn => !(cn.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    db.packages = (db.packages||[]).filter(p => p.name !== 'NFB2 Package');
    db.staff = db.staff.filter(s => s.name !== 'NFB2 Test Mechanic');
    db.attendance = (db.attendance||[]).filter(a => a.staffName !== 'NFB2 Test Mechanic');
    db.purchaseOrders = db.purchaseOrders.filter(po => !(po.items||[]).some(it=>(it.name||'').startsWith('NFB2')));
    queueSave();
  });
  await pageA.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', [...errorsA, ...errorsAnon]);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
