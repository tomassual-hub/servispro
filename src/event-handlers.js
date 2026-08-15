// @ts-nocheck
// This file is one long sequence of bindAction/bindAllAction callbacks that
// read raw .value/.dataset/.checked/.files off document.getElementById()
// results — tsc can't know those Elements are actually inputs/selects
// without a cast at every single call site (~100+ of them here). The real
// bugs found this session (reference identity, the toast/render issue, the
// UTC date bug) all lived in sync-engine.js/state.js logic, not in this
// kind of DOM plumbing, so the type-checking value here is low relative to
// the noise. Fix a genuine bug if you spot one; don't chase the casts.
let customerSearchDebounceTimer = null;
let inventorySearchDebounceTimer = null;

// Split out so the targeted-patch input handler (see #global-search below)
// can re-bind these after replacing #global-search-results-wrap's innerHTML
// -- that destroys whatever listeners were on the old [data-gs-idx] nodes,
// same reasoning as pos-search's identical re-bind-after-patch pattern.
function bindGlobalSearchResultHandlers(){
  document.querySelectorAll('[data-gs-idx]').forEach(el=>el.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    const results = globalSearchResults((state.globalSearch||'').trim());
    const r = results[Number(/** @type {HTMLElement} */(el).dataset.gsIdx)];
    if(!r) return;
    state.globalSearch = '';
    if(r.action.type==='customer'){ setState({view:'customers'}); }
    else if(r.action.type==='vehicle'){ const vehicle = getVehicle(r.action.id); setState({view:'customers', modal:{type:'vehicle-history', vehicle}}); }
    else if(r.action.type==='job'){ const job = db.jobs.find(j=>j.id===r.action.id); setState({view:'jobs', modal:{type:'job-detail', job}}); }
    else if(r.action.type==='invoice'){ setState({view:'finance', financeTab:'invoices'}); }
  }));
}

// "Hantar ke POS" and "Simpan" are two separate footer buttons on the job
// detail modal (jobs.js jobDetailModalHTML) -- a mechanic who types a
// description then clicks "Hantar ke POS" directly (skipping "Simpan")
// used to have that edit silently discarded, since job.description was
// only ever written back from #job-desc-edit inside save-job-status. That
// left the AI quote-suggestion call in job-to-pos analyzing a stale/empty
// description. Shared here so both handlers persist the same edits.
function captureJobModalEdits(job){
  const descEl = document.getElementById('job-desc-edit');
  if(!descEl) return;
  const newStatus = document.getElementById('job-status-select').value;
  if((newStatus==='done'||newStatus==='delivered') && job.status!=='done' && job.status!=='delivered'){
    job.doneAt = Date.now();
  }
  if(newStatus==='waiting'||newStatus==='progress'){ job.doneAt = null; }
  job.status = newStatus;
  job.description = descEl.value.trim();
  job.mechanic = document.getElementById('job-mechanic-edit').value.trim();
  job.internalNote = document.getElementById('job-note-edit').value.trim();
  const priceEl = document.getElementById('job-price-edit');
  if(priceEl) job.estimatedPrice = Number(priceEl.value)||0;
  const bayEl = document.getElementById('job-bay-edit');
  if(bayEl) job.bayId = bayEl.value || null;
}

/* ============================= EVENT HANDLERS ============================= */
function attachHandlers(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click', ()=>setState({view:el.dataset.nav, navOpen:false, globalSearch:''})));
  bindAllAction('dash-target-period', el=>setState({dashTargetPeriod: el.dataset.period}));

  const gSearch = document.getElementById('global-search');
  if(gSearch){
    gSearch.addEventListener('input', ()=>{
      state.globalSearch = gSearch.value;
      // Patch just the results dropdown instead of calling render() -- see
      // renderGlobalSearchResultsHTML's comment. This also means the input
      // itself is never destroyed/recreated, so focus/cursor position stays
      // put on its own; no focusEnd() workaround needed here anymore.
      const wrap = document.getElementById('global-search-results-wrap');
      if(wrap){ wrap.innerHTML = renderGlobalSearchResultsHTML(); bindGlobalSearchResultHandlers(); }
    });
    gSearch.addEventListener('blur', ()=>{
      // Delayed so a click on a search result (which can open a modal before
      // this fires) still registers — same reasoning as the toast fix: an
      // unconditional render() here would wipe that modal's fields if it's
      // still open when this timer lands.
      setTimeout(()=>{ state.globalSearch=''; maybeRerender(); }, 150);
    });
  }
  bindGlobalSearchResultHandlers();
  document.querySelectorAll('[data-action="open-nav"]').forEach(el=>el.addEventListener('click', ()=>setState({navOpen:true})));
  document.querySelectorAll('[data-action="close-nav"]').forEach(el=>el.addEventListener('click', ()=>setState({navOpen:false})));
  bindAllAction('toggle-notif', ()=>setState({notifOpen: !state.notifOpen}));
  bindAction('retry-sync-now', async ()=>{ await runSaveCycle(); });
  document.querySelectorAll('[data-notif-nav]').forEach(el=>el.addEventListener('click', ()=>{
    if(el.dataset.notifNav==='mfa-settings'){ setState({modal:{type:'mfa-settings'}, notifOpen:false}); return; }
    if(el.dataset.notifNav==='support-chat'){
      // "Open my own thread" vs "land on the inbox list" -- see
      // getNotifications() in chrome.js for why support chat is reached
      // through the bell's own dropdown now rather than a separate button.
      if(!canManage()) state.supportChatThreadId = state.currentStaff.id;
      setState({modal:{type:'support-chat'}, notifOpen:false});
      markSupportThreadRead(supportThreadIdForCurrentUser());
      return;
    }
    setState({view:el.dataset.notifNav, notifOpen:false});
  }));
  const branchSel = document.getElementById('branch-selector');
  if(branchSel) branchSel.addEventListener('change', ()=>setState({currentBranch: branchSel.value}));
  bindAllAction('toggle-theme', ()=>{
    state.theme = state.theme==='dark' ? 'light' : 'dark';
    render();
    try{ window.storage.set('theme-pref', state.theme, false); }catch(e){}
  });
  bindLanguagePickers();
  document.querySelectorAll('[data-jobfilter]').forEach(el=>el.addEventListener('click', ()=>setState({jobFilter:el.dataset.jobfilter, jobsShowCount:30})));
  bindAction('load-more-jobs', ()=>setState({jobsShowCount:(state.jobsShowCount||30)+30}));
  const jobDateSel = document.getElementById('job-date-filter');
  if(jobDateSel) jobDateSel.addEventListener('change', ()=>setState({jobDateFilter:jobDateSel.value, jobsShowCount:30}));
  document.querySelectorAll('[data-invtab]').forEach(el=>el.addEventListener('click', ()=>setState({invTab:el.dataset.invtab, inventoryShowCount:30})));
  document.querySelectorAll('[data-invmaintab]').forEach(el=>el.addEventListener('click', ()=>setState({invMainTab:el.dataset.invmaintab})));
  bindAction('load-more-inventory', ()=>setState({inventoryShowCount:(state.inventoryShowCount||30)+30}));
  document.querySelectorAll('[data-financetab]').forEach(el=>el.addEventListener('click', ()=>setState({financeTab:el.dataset.financetab, financeStatusFilter:'all', financeShowCount:30})));
  bindAction('load-more-finance', ()=>setState({financeShowCount:(state.financeShowCount||30)+30}));
  const financeStatusSel = document.getElementById('finance-status-filter');
  if(financeStatusSel) financeStatusSel.addEventListener('change', ()=>setState({financeStatusFilter:financeStatusSel.value, financeShowCount:30}));
  const financeDateSel = document.getElementById('finance-date-filter');
  if(financeDateSel) financeDateSel.addEventListener('change', ()=>setState({financeDateFilter:financeDateSel.value, financeShowCount:30}));
  const invSearch = document.getElementById('inventory-search');
  if(invSearch){
    invSearch.addEventListener('input', ()=>{
      // Same debounce reasoning as customer-search above — Inventory's
      // "Semua" tab was previously fully unbounded (no cap, no search at
      // all), so this is both the search feature and the fix for that.
      clearTimeout(inventorySearchDebounceTimer);
      inventorySearchDebounceTimer = setTimeout(()=>{
        state.inventorySearch = invSearch.value; state.inventoryShowCount = 30; render();
        focusEnd('inventory-search');
      }, 180);
    });
  }
  bindAction('new-supplier', ()=>setState({modal:{type:'new-supplier'}}));
  bindAllAction('edit-supplier', el=>{
    const supplier = db.suppliers.find(s=>s.id===el.dataset.id);
    if(supplier) setState({modal:{type:'edit-supplier', supplier}});
  });
  bindAction('save-supplier', ()=>{
    const name = document.getElementById('sup-name').value.trim();
    const phone = document.getElementById('sup-phone').value.trim();
    const email = document.getElementById('sup-email').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama pembekal.')); return; }
    const id = document.querySelector('[data-action="save-supplier"]').dataset.id;
    if(id){
      const supplier = db.suppliers.find(s=>s.id===id);
      Object.assign(supplier, {name, phone, email});
      logAudit('Kemaskini Pembekal', name);
    } else {
      db.suppliers.push({id:uid(), name, phone, email});
      logAudit('Tambah Pembekal', name);
    }
    queueSave();
    setState({modal:null});
    showToast(tt('Pembekal disimpan.'));
  });
  bindAllAction('delete-supplier', el=>{
    askConfirm(tt('Padam pembekal ini? Item yang ditugaskan akan kekal tanpa pembekal.'), ()=>{
      db.inventory.forEach(i=>{ if(i.supplierId===el.dataset.id) i.supplierId=null; });
      db.suppliers = db.suppliers.filter(s=>s.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Pembekal dipadam.'));
    });
  });
  bindAction('new-po', ()=>setState({modal:{type:'new-po'}}));
  bindAction('save-po', async ()=>{
    const supplierId = document.getElementById('po-supplier').value;
    const raw = document.getElementById('po-items').value.trim();
    if(!supplierId){ showToast(tt('Sila pilih pembekal.')); return; }
    const items = raw.split('\n').map(line=>{
      const parts = line.split(':');
      if(parts.length<3) return null;
      const name = parts[0].trim(); const qty = Number(parts[1].trim())||0; const cost = Number(parts[2].trim())||0;
      return name ? {name, qty, cost} : null;
    }).filter(Boolean);
    if(items.length===0){ showToast(tt('Format item tidak sah (nama:kuantiti:kos).')); return; }
    try{
      const poNo = await nextPoNo();
      const po = {id:uid(), poNo, supplierId, items, status:'pending', createdAt:Date.now()};
      db.purchaseOrders.push(po);
      logAudit('Jana Pesanan Belian', po.poNo);
      queueSave();
      setState({modal:null});
      showToast(tt('Pesanan belian ')+po.poNo+tt(' disimpan.'));
    }catch(e){
      reportError(e, 'Simpan pesanan belian gagal');
      showToast(state.language==='en' ? 'Could not save the purchase order. Try again.' : 'Gagal simpan pesanan belian. Cuba lagi.');
    }
  });
  bindAction('auto-po', async ()=>{
    const lowItems = db.inventory.filter(i=>i.qty<=i.lowStock);
    if(lowItems.length===0) return;
    try{
      const bySupplier = {};
      lowItems.forEach(i=>{
        const key = i.supplierId || 'none';
        if(!bySupplier[key]) bySupplier[key] = [];
        bySupplier[key].push({name:i.name, qty:Math.max(i.lowStock*2 - i.qty, i.lowStock), cost:i.cost, refId:i.id});
      });
      for(const [supplierId, items] of Object.entries(bySupplier)){
        const poNo = await nextPoNo();
        const po = {id:uid(), poNo, supplierId: supplierId==='none'?null:supplierId, items, status:'pending', createdAt:Date.now()};
        db.purchaseOrders.push(po);
      }
      logAudit('Jana Pesanan Auto', lowItems.length+' item stok rendah');
      queueSave();
      render();
      showToast(tt('Pesanan belian automatik dijana untuk ')+lowItems.length+tt(' item.'));
    }catch(e){
      reportError(e, 'Jana pesanan belian automatik gagal');
      showToast(state.language==='en' ? 'Could not generate automatic purchase orders. Try again.' : 'Gagal jana pesanan belian automatik. Cuba lagi.');
    }
  });
  bindAllAction('create-po-for-supplier', async el=>{
    const en = state.language==='en';
    const supplierId = el.dataset.supplier==='none' ? null : el.dataset.supplier;
    const lowItems = db.inventory.filter(i=>i.qty<=i.lowStock && (i.supplierId||'none')===(el.dataset.supplier));
    if(lowItems.length===0) return;
    try{
      const items = lowItems.map(i=>({name:i.name, qty:Math.max(i.lowStock*2 - i.qty, i.lowStock), cost:i.cost, refId:i.id}));
      const poNo = await nextPoNo();
      const po = {id:uid(), poNo, supplierId, items, status:'pending', createdAt:Date.now()};
      db.purchaseOrders.push(po);
      logAudit('Jana Pesanan Belian', poNo+' ('+items.length+' '+(en?'items':'item')+')');
      queueSave();
      setState({view:'finance', financeTab:'po'});
      showToast(en?`Purchase order ${poNo} created.`:`Pesanan belian ${poNo} dicipta.`);
    }catch(e){
      reportError(e, 'Jana PO daripada cadangan pesanan gagal');
      showToast(en?'Could not create the purchase order. Try again.':'Gagal jana pesanan belian. Cuba lagi.');
    }
  });
  bindAllAction('open-receive-po', el=>{
    const po = db.purchaseOrders.find(p=>p.id===el.dataset.id);
    if(po) setState({modal:{type:'receive-po', po}});
  });
  bindAllAction('confirm-receive-po', el=>{
    const en = state.language==='en';
    const po = db.purchaseOrders.find(p=>p.id===el.dataset.id);
    if(!po) return;
    const inputs = document.querySelectorAll('[data-po-receive-idx]');
    let anyReceived = false;
    inputs.forEach(input=>{
      const idx = Number(input.dataset.poReceiveIdx);
      const poi = po.items[idx];
      const outstanding = Math.max(0, poi.qty-(poi.receivedQty||0));
      const receiveNow = Math.min(outstanding, Math.max(0, Number(input.value)||0));
      if(receiveNow<=0) return;
      anyReceived = true;
      poi.receivedQty = (poi.receivedQty||0)+receiveNow;
      // refId (set for auto/low-stock-generated PO lines -- see auto-po/
      // create-po-for-supplier) is the real link back to the inventory row;
      // fall back to matching by name only for a manually typed PO (save-po
      // free-text entry has no inventory item to link at all). Matching by
      // name alone used to mean renaming or deleting the inventory item
      // after the PO was created silently lost the stock: the PO still got
      // marked "received" with no error, but item.qty never actually moved.
      const item = poi.refId ? db.inventory.find(i=>i.id===poi.refId) : db.inventory.find(i=>i.name===poi.name);
      if(item) item.qty += receiveNow;
      else reportError(new Error(`Receive PO: no inventory item found for "${poi.name}"`), 'Terima PO: item inventori tidak dijumpai, stok tidak dikemas kini');
    });
    if(!anyReceived){ showToast(en?'Enter a quantity to receive.':'Masukkan kuantiti untuk diterima.'); return; }
    po.status = po.items.every(i=>(i.receivedQty||0)>=i.qty) ? 'received' : 'partial';
    logAudit('Terima Pesanan Belian', po.poNo+(po.status==='partial'?' ('+(en?'partial':'sebahagian')+')':''));
    queueSave();
    setState({modal:null});
    showToast(po.status==='received' ? (en?'Fully received.':'Diterima sepenuhnya.') : (en?'Partial receipt recorded.':'Penerimaan sebahagian direkodkan.'));
  });

  // Technical reference library
  const techrefSearch = document.getElementById('techref-search');
  if(techrefSearch){
    techrefSearch.addEventListener('input', ()=>{
      state.techRefSearch = techrefSearch.value; render(); focusEnd('techref-search');
    });
  }
  bindAction('new-techref', ()=>setState({modal:{type:'new-techref'}}));
  bindAllAction('open-techref', el=>{
    const entry = db.techRefs.find(x=>x.id===el.dataset.id);
    if(entry) setState({modal:{type:'techref-detail', entry}, techRefEditingSectionId:null});
  });
  bindAllAction('edit-techref', el=>{
    const entry = db.techRefs.find(x=>x.id===el.dataset.id);
    if(entry) setState({modal:{type:'edit-techref', entry}});
  });
  bindAction('save-techref', ()=>{
    const en = state.language==='en';
    const make = document.getElementById('tr-make').value.trim();
    const model = document.getElementById('tr-model').value.trim();
    const variant = document.getElementById('tr-variant').value.trim();
    const yearFrom = document.getElementById('tr-year-from').value.trim();
    const yearTo = document.getElementById('tr-year-to').value.trim();
    const notes = document.getElementById('tr-notes').value.trim();
    if(!make || !model){ showToast(en?'Please enter make and model.':'Sila masukkan jenama dan model.'); return; }
    const id = document.querySelector('[data-action="save-techref"]').dataset.id;
    if(id){
      const entry = db.techRefs.find(x=>x.id===id);
      Object.assign(entry, {make, model, variant, yearFrom, yearTo, notes});
      logAudit('Kemaskini Rujukan Teknikal', make+' '+model);
    } else {
      db.techRefs.push({id:uid(), make, model, variant, yearFrom, yearTo, notes, sections:[], createdAt:Date.now()});
      logAudit('Tambah Rujukan Teknikal', make+' '+model);
    }
    queueSave();
    setState({modal:null});
    showToast(en?'Reference saved.':'Rujukan disimpan.');
  });
  bindAllAction('delete-techref', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this reference and all its sections? This cannot be undone.':'Padam rujukan ini dan semua bahagiannya? Tindakan ini tidak boleh dibuat asal.', ()=>{
      const entry = db.techRefs.find(x=>x.id===el.dataset.id);
      db.techRefs = db.techRefs.filter(x=>x.id!==el.dataset.id);
      queueSave();
      setState({modal:null});
      showToast(en?'Reference deleted.':'Rujukan dipadam.');
      if(entry) logAudit('Padam Rujukan Teknikal', entry.make+' '+entry.model);
    });
  });
  bindAllAction('edit-techref-section', el=>setState({techRefEditingSectionId: el.dataset.id}));
  bindAction('cancel-techref-section-edit', ()=>setState({techRefEditingSectionId: null}));
  bindAction('save-techref-section', ()=>{
    const en = state.language==='en';
    const btn = document.querySelector('[data-action="save-techref-section"]');
    const entry = db.techRefs.find(x=>x.id===btn.dataset.entryId);
    if(!entry) return;
    const category = document.getElementById('tr-section-category').value;
    const content = document.getElementById('tr-section-content').value.trim();
    if(!content){ showToast(en?'Please enter some notes.':'Sila masukkan nota.'); return; }
    const editingId = btn.dataset.editingId;
    if(editingId){
      const section = entry.sections.find(s=>s.id===editingId);
      if(section) Object.assign(section, {category, content});
    } else {
      if(!entry.sections) entry.sections = [];
      entry.sections.push({id:uid(), category, content, photos:[]});
    }
    queueSave();
    setState({techRefEditingSectionId:null});
    showToast(en?'Section saved.':'Bahagian disimpan.');
  });
  bindAllAction('delete-techref-section', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this section?':'Padam bahagian ini?', ()=>{
      const entry = state.modal && state.modal.entry;
      if(!entry) return;
      entry.sections = entry.sections.filter(s=>s.id!==el.dataset.id);
      queueSave();
      render();
      showToast(en?'Section deleted.':'Bahagian dipadam.');
    });
  });
  bindAllAction('remove-techref-photo', el=>{
    const entry = state.modal && state.modal.entry;
    if(!entry) return;
    const section = entry.sections.find(s=>s.id===el.dataset.sectionId);
    if(!section || !section.photos) return;
    section.photos.splice(Number(el.dataset.idx), 1);
    queueSave();
    render();
  });
  document.querySelectorAll('[data-techref-photo-input]').forEach(input=>input.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const sectionId = input.dataset.sectionId;
    const entry = state.modal && state.modal.entry;
    const section = entry && entry.sections.find(s=>s.id===sectionId);
    if(!section) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev)=>{
      img.onload = ()=>{
        const maxW = 700;
        const scale = Math.min(1, maxW/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if(!section.photos) section.photos = [];
        section.photos.push(dataUrl);
        queueSave();
        render();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }));

  document.querySelectorAll('[data-range]').forEach(el=>el.addEventListener('click', ()=>setState({reportRange:Number(el.dataset.range)})));
  document.querySelectorAll('[data-job-detail]').forEach(el=>el.addEventListener('click', ()=>{
    const job = db.jobs.find(j=>j.id===el.dataset.jobDetail);
    setState({modal:{type:'job-detail', job}});
  }));

  const overlay = document.querySelector('[data-action="overlay-close"]');
  if(overlay) overlay.addEventListener('click', ()=>setState({modal:null}));
  document.querySelectorAll('[data-action="confirm-cancel"]').forEach(el=>el.addEventListener('click', ()=>setState({confirmAction:null})));
  const confirmTypedInput = document.getElementById('confirm-typed-input');
  if(confirmTypedInput){
    // Toggles the confirm button live as the admin types -- patches the
    // button directly rather than going through render() on every
    // keystroke, same reasoning as the debounced search inputs elsewhere.
    const confirmYesBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector('[data-action="confirm-yes"]'));
    confirmTypedInput.addEventListener('input', ()=>{
      if(confirmYesBtn) confirmYesBtn.disabled = confirmTypedInput.value !== state.confirmAction.typedConfirmWord;
    });
  }
  bindAction('confirm-yes', ()=>{
    const action = state.confirmAction;
    // Defense in depth against the disabled-button gate above -- only
    // matters if something bypassed the UI (e.g. a stale re-render left
    // the button briefly enabled), since a real click can't normally
    // reach here with a mismatched/empty value.
    if(action && action.typedConfirmWord){
      const typedEl = /** @type {HTMLInputElement|null} */ (document.getElementById('confirm-typed-input'));
      if(!typedEl || typedEl.value!==action.typedConfirmWord) return;
    }
    state.confirmAction = null;
    if(action && action.onConfirm) action.onConfirm();
    else render();
  });

  bindAction('onboarding-next', ()=>{
    const steps = getOnboardingSteps();
    if(state.onboardingStep < steps.length-1){
      state.onboardingStep++;
      render();
    } else {
      finishOnboarding();
    }
  });
  bindAction('onboarding-skip', ()=>{ finishOnboarding(); });
  bindAction('dismiss-whats-new', ()=>{ dismissWhatsNew(); });

  bindAllAction('logout', ()=>{
    supabaseClient.auth.signOut();
    unsubscribeRealtime();
    db = defaultDB();
    // Face ID enrollment deliberately survives logout -- it only ever gates
    // an EXISTING persisted session on THIS device (see the header comment
    // in face-id.js), and signOut() above already destroys that session, so
    // there's nothing left for a stale enrollment to grant access to. Was
    // previously cleared here on every logout, forcing re-enrollment on
    // every fresh login even on the same personal phone; explicit removal
    // stays available via the "Turn Off" button in Face ID settings
    // (remove-faceid below), which is the actual deliberate opt-out.
    setState({currentStaff:null, view:'dashboard', authMode:'login', mfaChallenge:null});
  });

  bindAllAction('open-support-thread', el=>{
    state.supportChatThreadId = el.dataset.id;
    render();
    markSupportThreadRead(el.dataset.id);
  });
  bindAction('back-to-support-inbox', ()=>{
    state.supportChatThreadId = null;
    render();
  });
  bindAllAction('send-support-message', el=>{
    const input = /** @type {HTMLInputElement} */ (document.getElementById('support-chat-input'));
    const threadStaffId = el.dataset.id;
    const text = input && input.value.trim();
    if(!text || !threadStaffId) return;
    db.supportMessages = db.supportMessages || [];
    db.supportMessages.push({
      id: uid(),
      threadStaffId,
      senderId: state.currentStaff.id,
      senderName: state.currentStaff.name,
      senderSide: canManage() ? 'manager' : 'staff',
      message: text,
      createdAt: Date.now(),
      read: false,
    });
    queueSave();
    render();
    const list = document.getElementById('support-chat-messages');
    if(list) list.scrollTop = list.scrollHeight;
    const freshInput = /** @type {HTMLInputElement} */ (document.getElementById('support-chat-input'));
    if(freshInput) freshInput.focus();
  });
  const supportInput = document.getElementById('support-chat-input');
  if(supportInput){
    supportInput.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        const btn = /** @type {HTMLElement} */ (document.querySelector('[data-action="send-support-message"]'));
        if(btn) btn.click();
      }
    });
    // Land at the bottom of the thread on open, not scrolled to the top of
    // an old conversation.
    const list = document.getElementById('support-chat-messages');
    if(list) list.scrollTop = list.scrollHeight;
  }
  bindAllAction('open-ai-assistant', ()=>{ openAiAssistant(); });
  bindAllAction('send-ai-assistant-message', ()=>{
    const input = /** @type {HTMLInputElement} */ (document.getElementById('ai-assistant-input'));
    const text = input && input.value.trim();
    if(!text) return;
    input.value = '';
    sendAiAssistantMessage(text);
  });
  const aiAssistantInput = document.getElementById('ai-assistant-input');
  if(aiAssistantInput){
    aiAssistantInput.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        const btn = /** @type {HTMLElement} */ (document.querySelector('[data-action="send-ai-assistant-message"]'));
        if(btn && !(/** @type {HTMLButtonElement} */(btn).disabled)) btn.click();
      }
    });
    aiAssistantInput.focus();
    const list = document.getElementById('ai-assistant-messages');
    if(list) list.scrollTop = list.scrollHeight;
  }
  bindAllAction('toggle-push-notifications', async ()=>{
    if(state.pushSubscribed) await unsubscribeFromPush();
    else await subscribeToPush();
    await refreshPushSubscriptionState();
  });
  bindAllAction('open-plan-picker', ()=>setState({modal:{type:'plan-picker'}}));
  bindAllAction('upgrade-plan-test', el=>upgradePlanTestMode(el.dataset.plan));
  bindAllAction('upgrade-plan-real', el=>upgradePlanReal(el.dataset.plan));
  bindAllAction('redeem-credit-upgrade', el=>redeemCreditForUpgrade(el.dataset.plan));
  bindAllAction('redeem-referral-code', ()=>{
    const input = /** @type {HTMLInputElement} */ (document.getElementById('referral-redeem-input'));
    const code = input ? input.value : '';
    if(!code || !code.trim()){
      showToast(state.language==='en' ? 'Enter a referral code first.' : 'Masukkan kod rujukan dahulu.');
      return;
    }
    redeemReferralCode(code);
  });
  bindAllAction('copy-referral-code', async (el)=>{
    const code = el.dataset.code || '';
    const en = state.language==='en';
    try{
      await navigator.clipboard.writeText(code);
      showToast(en?'Code copied.':'Kod disalin.');
    }catch(e){
      showToast(en?'Could not copy — copy it manually.':'Gagal salin — sila salin secara manual.');
    }
  });
  bindAllAction('share-referral-code', async (el)=>{
    const code = el.dataset.code || '';
    const en = state.language==='en';
    const text = (en
      ? `Try ServisPro for workshop management — my code: ${code}`
      : `Cuba ServisPro untuk urus bengkel — kod saya: ${code}`);
    if(navigator.share){
      try{ await navigator.share({ title:'ServisPro', text }); }catch(e){ /* user cancelled */ }
    } else {
      try{ await navigator.clipboard.writeText(text); showToast(en?'Copied — paste it anywhere to share.':'Disalin — tampal di mana-mana untuk kongsi.'); }
      catch(e){ showToast(en?'Sharing not supported on this device.':'Perkongsian tidak disokong pada peranti ini.'); }
    }
  });

  bindAllAction('open-mfa-settings', ()=>setState({modal:{type:'mfa-settings'}}));
  bindAction('start-mfa-enroll', ()=>startMfaEnrollment());
  bindAction('cancel-mfa-enroll', ()=>{ state.mfaEnrollment = null; setState({modal:null}); });
  bindAction('confirm-mfa-enroll', async ()=>{
    const code = document.getElementById('mfa-enroll-code').value.trim();
    if(!/^\d{6}$/.test(code)){ showToast(tt('Masukkan kod 6 digit.')); return; }
    await verifyMfaEnrollment(code);
    render();
  });
  bindAllAction('open-faceid-settings', ()=>setState({modal:{type:'faceid-settings'}}));
  bindAction('skip-faceid-enroll', ()=>{
    localStorage.setItem('bk_faceid_dismissed', '1');
    setState({modal:null});
  });
  bindAllAction('confirm-faceid-enroll', async el=>{
    const email = el.dataset.email;
    const ok = await enrollFaceId(email, state.currentStaff?state.currentStaff.name:'');
    setState({modal:null});
    showToast(ok ? tt('Face ID diaktifkan.') : tt('Gagal aktifkan Face ID.'));
  });
  bindAction('remove-faceid', ()=>{
    askConfirm(state.language==='en'?'Turn off Face ID on this device?':'Matikan Face ID pada peranti ini?', ()=>{
      clearFaceId();
      setState({modal:null});
      showToast(tt('Face ID dimatikan.'));
    });
  });

  bindAllAction('unenroll-mfa', el=>{
    askConfirm(state.language==='en'?'Remove 2FA from your account?':'Buang 2FA dari akaun anda?', async ()=>{
      await unenrollMfa(el.dataset.id);
      setState({modal:null});
    });
  });

  bindAction('new-job', ()=>setState({modal:{type:'new-job'}}));
  bindAction('close-modal', ()=>setState({modal:null}));
  bindAction('new-item', ()=>setState({modal:{type:'new-item'}}));
  bindAction('new-package', ()=>setState({modal:{type:'new-package'}}));
  bindAllAction('edit-package', el=>{
    const pkg = (db.packages||[]).find(p=>p.id===el.dataset.id);
    if(pkg) setState({modal:{type:'edit-package', pkg}});
  });
  bindAction('save-package', ()=>{
    const en = state.language==='en';
    const name = document.getElementById('pkg-name').value.trim();
    const price = Number(document.getElementById('pkg-price').value)||0;
    const active = document.getElementById('pkg-active').checked;
    const raw = document.getElementById('pkg-items').value.trim();
    if(!name){ showToast(en?'Please enter a package name.':'Sila masukkan nama pakej.'); return; }
    const items = raw.split('\n').map(line=>{
      const parts = line.split(':');
      if(parts.length<2) return null;
      const itemName = parts[0].trim();
      const qty = Number(parts[1].trim())||0;
      const invItem = db.inventory.find(i=>i.name.toLowerCase()===itemName.toLowerCase());
      return (invItem && qty>0) ? {refId:invItem.id, qty} : null;
    }).filter(Boolean);
    if(items.length===0){ showToast(en?'No matching inventory items found in the component list (format: item name:qty).':'Tiada item inventori sepadan dalam senarai komponen (format: nama item:kuantiti).'); return; }
    if(!db.packages) db.packages = [];
    const id = document.querySelector('[data-action="save-package"]').dataset.id;
    if(id){
      const pkg = db.packages.find(p=>p.id===id);
      Object.assign(pkg, {name, items, price, active});
      logAudit('Kemaskini Pakej', name);
    } else {
      db.packages.push({id:uid(), name, items, price, active});
      logAudit('Tambah Pakej', name);
    }
    queueSave();
    setState({modal:null});
    showToast(en?'Package saved.':'Pakej disimpan.');
  });
  bindAllAction('delete-package', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this package?':'Padam pakej ini?', ()=>{
      db.packages = (db.packages||[]).filter(p=>p.id!==el.dataset.id);
      queueSave(); render();
      showToast(en?'Package deleted.':'Pakej dipadam.');
    });
  });
  const csvInput = document.getElementById('inventory-csv-input');
  if(csvInput){
    csvInput.addEventListener('change', (e)=>{
      const en = state.language==='en';
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try{
          const text = String(ev.target.result||'');
          // Minimal CSV parser -- no quoted-comma support, matches the
          // simplicity of this app's own CSV *exports* (downloadCSV in
          // main.js). Good enough for a plain spreadsheet export/import
          // round trip, not a general-purpose CSV engine.
          const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
          if(lines.length<2){ showToast(en?'CSV file has no data rows.':'Fail CSV tiada baris data.'); return; }
          const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
          const col = (names)=>names.map(n=>header.indexOf(n)).find(i=>i>=0);
          const nameIdx = col(['name','nama']);
          const skuIdx = col(['part_number','partnumber','sku']);
          const qtyIdx = col(['qty','kuantiti']);
          const costIdx = col(['cost','kos']);
          const priceIdx = col(['price','harga']);
          const lowIdx = col(['low_stock','lowstock']);
          if(nameIdx===undefined){ showToast(en?'CSV must have a "name" column.':'CSV mesti ada lajur "name".'); return; }
          let added=0, updated=0;
          for(let i=1;i<lines.length;i++){
            const cells = lines[i].split(',').map(c=>c.trim());
            const name = cells[nameIdx];
            if(!name) continue;
            const sku = skuIdx!==undefined ? (cells[skuIdx]||'') : '';
            const qty = qtyIdx!==undefined ? Number(cells[qtyIdx])||0 : 0;
            const cost = costIdx!==undefined ? Number(cells[costIdx])||0 : 0;
            const price = priceIdx!==undefined ? Number(cells[priceIdx])||0 : 0;
            const lowStock = lowIdx!==undefined ? Number(cells[lowIdx])||5 : 5;
            const existing = sku ? db.inventory.find(it=>it.sku && it.sku===sku) : null;
            if(existing){
              Object.assign(existing, {name, qty, cost, price, lowStock});
              updated++;
            } else {
              db.inventory.push({id:uid(), name, sku, qty, cost, price, lowStock});
              added++;
            }
          }
          logAudit('Import Inventori CSV', `${added} ${en?'added':'ditambah'}, ${updated} ${en?'updated':'dikemaskini'}`);
          queueSave();
          render();
          showToast(en?`Import done: ${added} added, ${updated} updated.`:`Import selesai: ${added} ditambah, ${updated} dikemaskini.`);
        }catch(err){
          reportError(err, 'Import CSV inventori gagal');
          showToast(en?'Could not read that CSV file.':'Gagal baca fail CSV tersebut.');
        }
      };
      reader.readAsText(file);
    });
  }
  bindAction('new-customer', ()=>setState({modal:{type:'new-customer'}}));

  // Workshop CRM: leads / pipeline
  document.querySelectorAll('[data-customertab]').forEach(el=>el.addEventListener('click', ()=>setState({customerTab:el.dataset.customertab})));
  document.querySelectorAll('[data-leadfilter]').forEach(el=>el.addEventListener('click', ()=>setState({leadStatusFilter:el.dataset.leadfilter, leadsShowCount:30})));
  bindAction('load-more-leads', ()=>setState({leadsShowCount:(state.leadsShowCount||30)+30}));
  bindAction('new-lead', ()=>setState({modal:{type:'new-lead'}}));
  bindAction('save-lead', ()=>{
    const en = state.language==='en';
    const name = document.getElementById('lead-name').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const source = document.getElementById('lead-source').value.trim();
    const notes = document.getElementById('lead-notes').value.trim();
    if(!name){ showToast(en?'Please enter a name.':'Sila masukkan nama.'); return; }
    if(!db.leads) db.leads = [];
    db.leads.push({id:uid(), name, phone, source, notes, status:'new', createdAt:Date.now()});
    logAudit('Tambah Prospek', name);
    queueSave();
    setState({modal:null});
    showToast(en?'Lead saved.':'Prospek disimpan.');
  });
  bindAllAction('advance-lead', el=>{
    const lead = db.leads.find(l=>l.id===el.dataset.id);
    if(!lead) return;
    lead.status = el.dataset.stage;
    queueSave(); render();
    showToast((state.language==='en'?'Marked as ':'Ditanda sebagai ')+leadStageLabel(lead.status)+'.');
  });
  bindAllAction('convert-lead', el=>{
    const en = state.language==='en';
    const lead = db.leads.find(l=>l.id===el.dataset.id);
    if(!lead) return;
    askConfirm(en?`Convert "${lead.name}" to a full customer record?`:`Tukar "${lead.name}" kepada rekod pelanggan penuh?`, ()=>{
      const customer = {id:uid(), name:lead.name, phone:lead.phone||'', visits:0, loyaltyPoints:0};
      db.customers.push(customer);
      lead.status = 'won';
      lead.convertedCustomerId = customer.id;
      logAudit('Tukar Prospek kepada Pelanggan', lead.name);
      queueSave();
      render();
      showToast(en?'Converted to customer.':'Ditukar kepada pelanggan.');
    });
  });
  bindAllAction('delete-lead', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this lead?':'Padam prospek ini?', ()=>{
      db.leads = db.leads.filter(l=>l.id!==el.dataset.id);
      queueSave(); render();
      showToast(en?'Lead deleted.':'Prospek dipadam.');
    });
  });

  bindAllAction('edit-item', el=>{
    const item = getItem(el.dataset.id);
    setState({modal:{type:'edit-item', item}});
  });
  bindAllAction('delete-item', el=>{
    const item = getItem(el.dataset.id);
    askConfirm(tt('Padam item "')+item.name+tt('" daripada inventori?'), ()=>{
      const idx = db.inventory.findIndex(i=>i.id===el.dataset.id);
      const removed = db.inventory.splice(idx,1)[0];
      logAudit('Padam Item', removed.name);
      queueSave(); render();
      showToast(tt('Item dipadam.'), ()=>{
        db.inventory.splice(idx,0,removed); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });
  bindAllAction('add-vehicle', el=>{
    setState({modal:{type:'new-vehicle', customerId:el.dataset.id}});
  });
  bindAllAction('delete-customer', el=>{
    const cust = getCustomer(el.dataset.id);
    askConfirm(tt('Padam pelanggan "')+cust.name+tt('" beserta semua kenderaan mereka? Rekod kerja lama akan dikekalkan.'), ()=>{
      const removedVehicles = db.vehicles.filter(v=>v.customerId===el.dataset.id);
      db.customers = db.customers.filter(c=>c.id!==el.dataset.id);
      db.vehicles = db.vehicles.filter(v=>v.customerId!==el.dataset.id);
      logAudit('Padam Pelanggan', cust.name);
      queueSave(); render();
      showToast(tt('Pelanggan dipadam.'), ()=>{
        db.customers.push(cust); db.vehicles.push(...removedVehicles); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });
  bindAllAction('edit-customer', el=>{
    const customer = getCustomer(el.dataset.id);
    setState({modal:{type:'edit-customer', customer}});
  });
  bindAction('save-customer-edit', ()=>{
    const btn = document.querySelector('[data-action="save-customer-edit"]');
    const customer = getCustomer(btn.dataset.id);
    customer.name = document.getElementById('cust-edit-name').value.trim() || customer.name;
    customer.phone = document.getElementById('cust-edit-phone').value.trim();
    queueSave();
    setState({modal:null});
    showToast(tt('Maklumat pelanggan dikemaskini.'));
  });
  bindAllAction('edit-vehicle', el=>{
    const vehicle = getVehicle(el.dataset.id);
    setState({modal:{type:'edit-vehicle', vehicle}});
  });
  bindAction('save-vehicle-edit', ()=>{
    const btn = document.querySelector('[data-action="save-vehicle-edit"]');
    const vehicle = getVehicle(btn.dataset.id);
    vehicle.plate = document.getElementById('veh-edit-plate').value.trim() || vehicle.plate;
    vehicle.model = document.getElementById('veh-edit-model').value.trim();
    vehicle.color = document.getElementById('veh-edit-color').value.trim();
    vehicle.odometer = Number(document.getElementById('veh-edit-odo').value)||0;
    vehicle.serviceIntervalKm = Number(document.getElementById('veh-edit-interval').value)||10000;
    queueSave();
    setState({modal:null});
    showToast(tt('Maklumat kenderaan dikemaskini.'));
  });
  document.querySelectorAll('[data-vehicle-history]').forEach(el=>el.addEventListener('click', ()=>{
    const vehicle = getVehicle(el.dataset.vehicleHistory);
    setState({modal:{type:'vehicle-history', vehicle}});
  }));

  const custSearch = document.getElementById('customer-search');
  if(custSearch){
    custSearch.addEventListener('input', ()=>{
      // Debounced rather than a render() per keystroke -- this view's own
      // grid is already capped to 30 (state.customersShowCount), but every
      // keystroke was still rebuilding the entire app shell (sidebar/
      // topbar) around it for no reason. customerSearchDebounceTimer is
      // module-level (not local to this closure) so a later attachHandlers()
      // call -- which reruns after every render(), including ones unrelated
      // to this input -- can still find and clear a timer set up by an
      // earlier one, rather than letting it fire against a since-detached
      // DOM node.
      clearTimeout(customerSearchDebounceTimer);
      customerSearchDebounceTimer = setTimeout(()=>{
        state.customerSearch = custSearch.value; state.customersShowCount = 30; render();
        focusEnd('customer-search');
      }, 180);
    });
  }
  bindAction('load-more-customers', ()=>setState({customersShowCount:(state.customersShowCount||30)+30}));

  // Staff management
  bindAction('new-staff', ()=>setState({modal:{type:'new-staff'}}));
  bindAllAction('show-attendance-qr', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.id);
    if(!staffMember) return;
    if(!staffMember.attendanceToken){
      staffMember.attendanceToken = uid()+uid();
      queueSave();
    }
    setState({modal:{type:'attendance-qr', staffMember}});
  });
  bindAllAction('show-attendance-summary', el=>{
    setState({ modal:{type:'attendance-summary', staffId:el.dataset.id}, attendanceSummaryMonth: currentMonthStr() });
  });
  bindAction('attendance-summary-prev-month', ()=>{
    setState({ attendanceSummaryMonth: shiftMonth(state.attendanceSummaryMonth || currentMonthStr(), -1) });
  });
  bindAction('attendance-summary-next-month', ()=>{
    const cur = state.attendanceSummaryMonth || currentMonthStr();
    if(cur===currentMonthStr()) return;
    setState({ attendanceSummaryMonth: shiftMonth(cur, 1) });
  });
  bindAllAction('regenerate-attendance-token', el=>{
    const en = state.language==='en';
    askConfirm(en?"Regenerate this staff member's QR code? Their old printed code will stop working immediately.":'Jana semula kod QR staf ini? Kod lama yang telah dicetak akan berhenti berfungsi serta-merta.', ()=>{
      const staffMember = db.staff.find(s=>s.id===el.dataset.id);
      if(!staffMember) return;
      staffMember.attendanceToken = uid()+uid();
      logAudit('Jana Semula Token Kehadiran', staffMember.name);
      queueSave();
      setState({modal:{type:'attendance-qr', staffMember}});
      showToast(en?'New QR code generated.':'Kod QR baharu dijana.');
    });
  });
  bindAction('print-attendance-qr', ()=>{
    if(state.modal && state.modal.staffMember) printAttendanceQr(state.modal.staffMember);
  });
  bindAllAction('print-attendance-summary', el=>{
    printAttendanceSummary(el.dataset.staffid, el.dataset.month);
  });
  bindAllAction('edit-attendance', el=>{
    const record = (db.attendance||[]).find(a=>a.id===el.dataset.id);
    if(record) setState({modal:{type:'edit-attendance', record}});
  });
  bindAllAction('save-attendance-edit', el=>{
    const en = state.language==='en';
    const record = (db.attendance||[]).find(a=>a.id===el.dataset.id);
    if(!record) return;
    const type = document.getElementById('att-edit-type').value;
    const dateStr = document.getElementById('att-edit-date').value;
    const timeStr = document.getElementById('att-edit-time').value;
    if(!dateStr || !timeStr){ showToast(en?'Please enter both date and time.':'Sila masukkan tarikh dan masa.'); return; }
    const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
    if(isNaN(ts)){ showToast(en?'Invalid date/time.':'Tarikh/masa tidak sah.'); return; }
    record.type = type;
    record.ts = ts;
    record.editedBy = state.currentStaff ? state.currentStaff.name : '';
    logAudit('Sunting Rekod Kehadiran', record.staffName+' — '+fmtDateTime(ts));
    queueSave();
    setState({modal:null});
    showToast(en?'Attendance record updated.':'Rekod kehadiran dikemaskini.');
  });
  bindAllAction('delete-attendance', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this attendance record?':'Padam rekod kehadiran ini?', ()=>{
      db.attendance = (db.attendance||[]).filter(a=>a.id!==el.dataset.id);
      queueSave(); render();
      showToast(en?'Record deleted.':'Rekod dipadam.');
    });
  });
  bindAllAction('edit-staff', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.id);
    setState({modal:{type:'edit-staff', staffMember}});
  });
  bindAllAction('delete-staff', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.id);
    // Losing the last owner-level (Admin/Pemilik) staff is unrecoverable
    // through the app: claim_staff_record() only lets a new login
    // self-bootstrap as Admin when the staff table is completely empty, so
    // if any lower-access row survives, nobody can ever regain owner-level
    // access without direct database access. Block it here rather than
    // relying on the button-hide in viewStaff() alone, since that's a
    // rendering nicety, not a safety guarantee.
    const isLastAdmin = isOwnerLevel(staffMember.role) && db.staff.filter(s=>isOwnerLevel(s.role)).length===1;
    if(isLastAdmin){
      showToast(state.language==='en'
        ? 'Cannot delete the last Admin/Pemilik — appoint another one first.'
        : 'Tidak boleh memadam Admin/Pemilik terakhir. Lantik seorang lagi dahulu.');
      return;
    }
    askConfirm(tt('Padam akaun staf "')+staffMember.name+'"?', ()=>{
      db.staff = db.staff.filter(s=>s.id!==el.dataset.id);
      logAudit('Padam Staf', staffMember.name+' ('+staffMember.role+')');
      queueSave(); render(); showToast(tt('Staf dipadam.'));
    });
  });
  bindAction('save-staff', ()=>{
    const btn = document.querySelector('[data-action="save-staff"]');
    const id = btn.dataset.id;
    const name = document.getElementById('sf-name').value.trim();
    const role = document.getElementById('sf-role').value;
    const email = document.getElementById('sf-email').value.trim();
    const commissionPercent = Number(document.getElementById('sf-commission').value)||0;
    const baseSalary = Number(document.getElementById('sf-basesalary').value)||0;
    if(!name){ showToast(tt('Sila masukkan nama staf.')); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast(state.language==='en'?'Enter a valid email.':'Masukkan e-mel yang sah.'); return; }
    try{
      if(id){
        const staffMember = db.staff.find(s=>s.id===id);
        // Demoting the sole remaining owner-level (Admin/Pemilik) staff away
        // from both is just as unrecoverable as deleting them outright (see
        // delete-staff above) -- switching between Admin and Pemilik is
        // fine either way, neither leaves the shop without one.
        if(isOwnerLevel(staffMember.role) && !isOwnerLevel(role) && db.staff.filter(s=>isOwnerLevel(s.role)).length===1){
          showToast(state.language==='en'
            ? 'Cannot demote the last Admin/Pemilik — appoint another one first.'
            : 'Tidak boleh menurunkan pangkat Admin/Pemilik terakhir. Lantik seorang lagi dahulu.');
          return;
        }
        Object.assign(staffMember, {name, role, email, commissionPercent, baseSalary});
        logAudit('Sunting Staf', name+' ('+role+')');
      } else {
        db.staff.push({id:uid(), name, role, email, commissionPercent, baseSalary, userId:null});
        logAudit('Tambah Staf', name+' ('+role+')');
      }
      queueSave();
      setState({modal:null});
      showToast(tt('Staf disimpan.'));
    }catch(e){
      reportError(e, 'Simpan staf gagal');
      showToast(state.language==='en' ? 'Could not save this staff member. Try again.' : 'Gagal simpan staf ini. Cuba lagi.');
    }
  });
  bindAllAction('admin-manage-staff-account', async el=>{
    const en = state.language==='en';
    const staffId = el.dataset.id;
    const staffMember = db.staff.find(s=>s.id===staffId);
    if(!staffMember) return;
    const email = document.getElementById('sf-email').value.trim();
    const password = document.getElementById('sf-new-password').value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast(en?'Enter a valid email.':'Masukkan e-mel yang sah.'); return; }
    if(!staffMember.userId && !password){
      showToast(en?'Enter a password to create their login account.':'Masukkan kata laluan untuk cipta akaun log masuk.');
      return;
    }
    try{
      const { data, error } = await supabaseClient.functions.invoke('admin-manage-staff-account', {
        body: { staffId, email, password }
      });
      if(error) throw error;
      if(!data || data.error){
        const messages = {
          not_authenticated: en?'Your session expired — please log in again.':'Sesi anda tamat — sila log masuk semula.',
          owner_only: en?'Only Admin/Pemilik can manage staff login accounts.':'Hanya Admin/Pemilik boleh urus akaun log masuk staf.',
          invalid_input: en?'Missing required information — try again.':'Maklumat diperlukan tiada — cuba lagi.',
          staff_not_found: en?'This staff member no longer exists.':'Staf ini tidak lagi wujud.',
          nothing_to_update: en?'Enter a new password to reset it.':'Masukkan kata laluan baharu untuk reset.',
          email_and_password_required: en?'Both email and password are required to create a login.':'E-mel dan kata laluan diperlukan untuk cipta log masuk.',
          created_but_link_failed: en?'Account created but linking failed — contact support.':'Akaun dicipta tetapi pautan gagal — hubungi sokongan.',
        };
        // auth_error wraps whatever Supabase's own auth.admin.* call said
        // (e.g. "User already registered", "Password should be at least 6
        // characters") -- surfaced verbatim rather than folded into a
        // generic message, since the fix differs by exact cause and this
        // is the only place that detail is available at all.
        const code = data && data.error;
        const msg = code==='auth_error' && data.detail
          ? (en?`Account error: ${data.detail}`:`Ralat akaun: ${data.detail}`)
          : messages[code] || (en?`Could not update this account (${code||'no response'}). Try again.`:`Gagal kemaskini akaun ini (${code||'tiada respons'}). Cuba lagi.`);
        reportError(new Error('admin-manage-staff-account: '+(data?code+(data.detail?' — '+data.detail:''):'empty response')), 'Urus akaun staf - respons ralat');
        showToast(msg);
        return;
      }
      const wasUnlinked = !staffMember.userId;
      staffMember.email = email;
      staffMember.userId = data.userId;
      queueSave();
      const pwEl = /** @type {HTMLInputElement} */ (document.getElementById('sf-new-password'));
      if(pwEl) pwEl.value = '';
      render();
      showToast(wasUnlinked
        ? (en?'Login account created — they can sign in now.':'Akaun log masuk dicipta — mereka boleh log masuk sekarang.')
        : (en?'Account updated.':'Akaun dikemaskini.'));
    }catch(e){
      reportError(e, 'Urus akaun staf gagal');
      showToast(en?'Could not reach the server. Try again.':'Gagal hubungi pelayan. Cuba lagi.');
    }
  });

  // Payroll
  bindAction('payroll-prev-month', ()=>{
    setState({ payrollMonth: shiftMonth(state.payrollMonth || currentMonthStr(), -1) });
  });
  bindAction('payroll-next-month', ()=>{
    const cur = state.payrollMonth || currentMonthStr();
    if(cur === currentMonthStr()) return; // guards the disabled button being clicked via keyboard/devtools
    setState({ payrollMonth: shiftMonth(cur, 1) });
  });
  bindAllAction('mark-payroll-paid', el=>{
    setState({ modal: { type:'payroll-payment', staffId: el.dataset.staffid } });
  });
  bindAllAction('confirm-payroll-payment', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.staffid);
    if(!staffMember) return;
    const en = state.language==='en';
    try{
      const month = state.payrollMonth || currentMonthStr();
      const pay = computeMonthlyPay(staffMember, month);
      const epf = Number(document.getElementById('pr-epf').value)||0;
      const socso = Number(document.getElementById('pr-socso').value)||0;
      const eis = Number(document.getElementById('pr-eis').value)||0;
      const pcb = Number(document.getElementById('pr-pcb').value)||0;
      const otherDeductions = Number(document.getElementById('pr-other').value)||0;
      const netPay = pay.total - epf - socso - eis - pcb - otherDeductions;
      db.payrollRecords.push({
        id: uid(), staffId: staffMember.id, staffName: staffMember.name, month,
        baseSalary: pay.baseSalary, commissionRevenue: pay.commissionRevenue, commissionPct: pay.commissionPct,
        commission: pay.commission, total: pay.total,
        epf, socso, eis, pcb, otherDeductions, netPay,
        paidAt: Date.now(), paidBy: state.currentStaff ? state.currentStaff.name : '', notes: ''
      });
      logAudit('Bayaran Gaji', staffMember.name+' — '+monthLabel(month)+' — '+fmtRM(netPay));
      queueSave();
      setState({modal:null});
      showToast(en ? 'Payment recorded.' : 'Bayaran direkodkan.');
    }catch(e){
      reportError(e, 'Rekod bayaran gaji gagal');
      showToast(en ? 'Could not record this payment. Try again.' : 'Gagal rekod bayaran ini. Cuba lagi.');
    }
  });
  bindAllAction('undo-payroll-payment', el=>{
    const record = db.payrollRecords.find(r=>r.id===el.dataset.id);
    if(!record) return;
    const en = state.language==='en';
    askConfirm(en ? 'Undo this payment record?' : 'Batalkan rekod bayaran ini?', ()=>{
      db.payrollRecords = db.payrollRecords.filter(r=>r.id!==record.id);
      logAudit('Batal Bayaran Gaji', record.staffName+' — '+monthLabel(record.month));
      queueSave();
      render();
      showToast(en ? 'Payment record removed.' : 'Rekod bayaran dibuang.');
    });
  });

  // Appointment tabs
  document.querySelectorAll('[data-appttab]').forEach(el=>el.addEventListener('click', ()=>setState({apptTab:el.dataset.appttab})));
  document.querySelectorAll('[data-stafftab]').forEach(el=>el.addEventListener('click', ()=>setState({staffTab:el.dataset.stafftab})));
  bindAction('new-appointment', ()=>setState({modal:{type:'new-appointment'}}));

  // Centralized calendar
  bindAction('cal-prev', ()=>setState({calendarMonth: shiftMonth(state.calendarMonth||currentMonthStr(), -1)}));
  bindAction('cal-next', ()=>setState({calendarMonth: shiftMonth(state.calendarMonth||currentMonthStr(), 1)}));
  bindAction('cal-today', ()=>setState({calendarMonth: currentMonthStr()}));
  bindAllAction('open-cal-day', el=>setState({modal:{type:'day-appointments', date: el.dataset.date}}));
  bindAllAction('new-appointment-on-date', el=>setState({modal:{type:'new-appointment', presetDate: el.dataset.date}}));
  const apCustomer = document.getElementById('ap-customer');
  if(apCustomer) apCustomer.addEventListener('change', ()=>{
    const vehSel = document.getElementById('ap-vehicle');
    const vs = getVehiclesFor(apCustomer.value);
    vehSel.innerHTML = apCustomer.value ? (vs.length ? vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') : `<option value="">Tiada kenderaan direkod</option>`) : `<option value="">— Pilih Pelanggan Dahulu —</option>`;
  });
  bindAction('save-appointment', ()=>{
    const customerId = document.getElementById('ap-customer').value;
    const vehicleId = document.getElementById('ap-vehicle').value;
    const date = document.getElementById('ap-date').value;
    const time = document.getElementById('ap-time').value;
    const notes = document.getElementById('ap-notes').value.trim();
    if(!customerId){ showToast(tt('Sila pilih pelanggan.')); return; }
    if(!date || !time){ showToast(tt('Sila pilih tarikh dan masa.')); return; }
    try{
      db.appointments.push({id:uid(), customerId, vehicleId, date, time, notes, status:'scheduled', createdAt:Date.now()});
      queueSave();
      setState({modal:null});
      showToast(tt('Tempahan disimpan.'));
    }catch(e){
      reportError(e, 'Simpan tempahan gagal');
      showToast(state.language==='en' ? 'Could not save the appointment. Try again.' : 'Gagal simpan tempahan. Cuba lagi.');
    }
  });
  bindAllAction('appt-done', el=>{
    const a = db.appointments.find(x=>x.id===el.dataset.id);
    a.status='done'; queueSave(); render(); showToast(tt('Tempahan ditandakan selesai.'));
  });
  bindAllAction('appt-cancel', el=>{
    const a = db.appointments.find(x=>x.id===el.dataset.id);
    a.status='cancelled'; queueSave(); render(); showToast(tt('Tempahan dibatalkan.'));
  });
  bindAllAction('mark-reminder-sent', el=>{
    const a = db.appointments.find(x=>x.id===el.dataset.id);
    if(!a) return;
    a.reminderSent = true;
    queueSave(); render();
  });
  bindAllAction('delete-appointment', el=>{
    askConfirm(tt('Padam tempahan ini?'), ()=>{
      db.appointments = db.appointments.filter(a=>a.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Tempahan dipadam.'));
    });
  });

  // Service contracts
  bindAction('new-contract', ()=>setState({modal:{type:'new-contract'}}));
  const ctCustomer = document.getElementById('ct-customer');
  if(ctCustomer) ctCustomer.addEventListener('change', ()=>{
    const vehSel = document.getElementById('ct-vehicle');
    const vs = getVehiclesFor(ctCustomer.value);
    vehSel.innerHTML = ctCustomer.value ? (vs.length ? vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') : `<option value="">Tiada kenderaan direkod</option>`) : `<option value="">— Pilih Pelanggan Dahulu —</option>`;
  });
  bindAction('save-contract', ()=>{
    const label = document.getElementById('ct-label').value.trim();
    const customerId = document.getElementById('ct-customer').value;
    const vehicleId = document.getElementById('ct-vehicle').value;
    const freq = Number(document.getElementById('ct-freq').value)||30;
    const itemsRaw = document.getElementById('ct-items').value.trim();
    if(!label){ showToast(tt('Sila masukkan nama kontrak.')); return; }
    if(!customerId){ showToast(tt('Sila pilih pelanggan.')); return; }
    const items = itemsRaw.split('\n').map(line=>{
      const parts = line.split(':');
      if(parts.length<2) return null;
      const name = parts[0].trim();
      const price = Number(parts[1].trim())||0;
      return name ? {name, price, qty:1} : null;
    }).filter(Boolean);
    if(items.length===0){ showToast(tt('Sila masukkan sekurang-kurangnya satu item (format: nama:harga).')); return; }
    try{
      db.contracts.push({id:uid(), label, customerId, vehicleId, items, frequencyDays:freq, nextDue:Date.now(), lastGenerated:null});
      queueSave();
      setState({modal:null});
      showToast(tt('Kontrak servis disimpan.'));
    }catch(e){
      reportError(e, 'Simpan kontrak servis gagal');
      showToast(state.language==='en' ? 'Could not save the service contract. Try again.' : 'Gagal simpan kontrak servis. Cuba lagi.');
    }
  });
  bindAllAction('generate-contract', async el=>{
    const ct = db.contracts.find(c=>c.id===el.dataset.id);
    try{
      const subtotal = ct.items.reduce((s,i)=>s+i.price*i.qty,0);
      const taxRate = Number(db.settings.taxRate)||0;
      const taxAmt = subtotal*taxRate/100;
      const invoiceNo = await nextInvNo();
      const invoice = {
        id:uid(), invoiceNo, customerId:ct.customerId, vehicleId:ct.vehicleId||null, jobId:null,
        items:[...ct.items], subtotal, discount:0, taxRate, tax:taxAmt, total:subtotal+taxAmt, payment:'Kontrak',
        createdAt:Date.now(), createdBy: state.currentStaff?state.currentStaff.name:''
      };
      db.invoices.push(invoice);
      ct.lastGenerated = Date.now();
      ct.nextDue = Date.now() + ct.frequencyDays*24*3600*1000;
      queueSave();
      render();
      showToast(tt('Invois ')+invoice.invoiceNo+tt(' dijana daripada kontrak ')+ct.label+'.');
    }catch(e){
      reportError(e, 'Jana invois daripada kontrak gagal');
      showToast(state.language==='en' ? 'Could not generate the invoice from this contract. Try again.' : 'Gagal jana invois daripada kontrak ini. Cuba lagi.');
    }
  });
  bindAllAction('delete-contract', el=>{
    askConfirm(tt('Padam kontrak servis ini?'), ()=>{
      db.contracts = db.contracts.filter(c=>c.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Kontrak dipadam.'));
    });
  });

  // Settings
  bindAction('save-settings', ()=>{
    db.settings.shopName = document.getElementById('set-shopname').value.trim();
    db.settings.shopPhone = document.getElementById('set-shopphone').value.trim();
    db.settings.countryCode = document.getElementById('set-countrycode').value.replace(/[^0-9]/g,'').trim() || '60';
    db.settings.shopAddress = document.getElementById('set-shopaddress').value.trim();
    db.settings.servicedBrands = document.getElementById('set-brands').value.split(',').map(x=>x.trim()).filter(Boolean);
    db.settings.shopRegNo = document.getElementById('set-shopregno').value.trim();
    db.settings.shopSstNo = document.getElementById('set-shopsstno').value.trim();
    db.settings.shopTin = document.getElementById('set-shoptin').value.trim();
    db.settings.taxRate = Number(document.getElementById('set-tax').value)||0;
    db.settings.loyaltyDiscount = Number(document.getElementById('set-loyalty-discount').value)||0;
    db.settings.loyaltyVisits = Number(document.getElementById('set-loyalty-visits').value)||5;
    db.settings.churnDays = Number(document.getElementById('set-churn-days').value)||180;
    db.settings.simpleMode = document.getElementById('set-simple-mode').checked;
    db.settings.monthlySalesTarget = Math.max(0, Number(document.getElementById('set-sales-target').value)||0);
    db.settings.monthlyUnitTarget = Math.max(0, Number(document.getElementById('set-unit-target').value)||0);
    queueSave();
    render();
    showToast(tt('Tetapan disimpan.'));
  });
  bindAction('open-board-in-app', ()=>{ state.boardMode = true; state.boardJobs = null; render(); });
  bindAction('new-bay', ()=>setState({modal:{type:'new-bay'}}));
  bindAllAction('edit-bay', el=>{
    const bay = (db.bays||[]).find(b=>b.id===el.dataset.id);
    if(bay) setState({modal:{type:'edit-bay', bay}});
  });
  bindAction('save-bay', ()=>{
    const en = state.language==='en';
    const name = document.getElementById('bay-name').value.trim();
    const category = document.getElementById('bay-category').value.trim();
    const active = document.getElementById('bay-active').checked;
    if(!name){ showToast(en?'Please enter a bay name.':'Sila masukkan nama bay.'); return; }
    if(!db.bays) db.bays = [];
    const id = document.querySelector('[data-action="save-bay"]').dataset.id;
    if(id){
      const bay = db.bays.find(b=>b.id===id);
      Object.assign(bay, {name, category, active});
      logAudit('Sunting Bay', name);
    } else {
      db.bays.push({id:uid(), name, category, active});
      logAudit('Tambah Bay', name);
    }
    queueSave();
    setState({modal:null});
    showToast(en?'Bay saved.':'Bay disimpan.');
  });
  bindAllAction('toggle-bay-active', el=>{
    const bay = (db.bays||[]).find(b=>b.id===el.dataset.id);
    if(!bay) return;
    bay.active = !bay.active;
    queueSave();
    render();
  });
  bindAllAction('delete-bay', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this bay? Jobs already assigned to it keep their record but the bay itself will be gone.':'Padam bay ini? Kad kerja yang ditugaskan akan kekal rekodnya tetapi bay itu sendiri akan hilang.', ()=>{
      db.bays = (db.bays||[]).filter(b=>b.id!==el.dataset.id);
      queueSave(); render();
      showToast(en?'Bay deleted.':'Bay dipadam.');
    });
  });
  bindAction('add-branch', ()=>{
    const name = document.getElementById('new-branch-name').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama cawangan.')); return; }
    db.branches.push({id:uid(), name});
    logAudit('Tambah Cawangan', name);
    queueSave();
    render();
    showToast(tt('Cawangan ditambah.'));
  });
  bindAllAction('delete-branch', el=>{
    askConfirm(tt('Padam cawangan ini? Rekod sedia ada yang ditugaskan kepadanya akan kekal.'), ()=>{
      db.branches = db.branches.filter(b=>b.id!==el.dataset.id);
      if(state.currentBranch===el.dataset.id) state.currentBranch='all';
      queueSave(); render(); showToast(tt('Cawangan dipadam.'));
    });
  });
  bindAction('export-backup', ()=>{
    const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'servispro-sandaran-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    db.settings.lastBackupAt = Date.now();
    queueSave();
    render();
    showToast(tt('Fail sandaran dimuat turun.'));
  });
  bindAction('reset-shop-data', ()=>{
    // Defense in depth -- the button itself is only ever rendered for
    // Owner-level staff (see dangerZonePanelHTML() in settings.js), same
    // reasoning as every other client-side role gate in this app: hides
    // the button, doesn't replace a real server-side check (RLS still
    // allows any staff role to delete these rows directly, same as
    // everything else here -- see the security note wherever this repo's
    // RLS policies are documented).
    if(!isOwnerLevel(state.currentStaff && state.currentStaff.role)) return;
    const en = state.language==='en';
    askConfirm(
      en
        ? `This permanently deletes ${db.customers.length} customer(s), ${db.vehicles.length} vehicle(s), ${db.jobs.length} job card(s), ${db.invoices.length} invoice(s), ${db.creditNotes.length} credit note(s), ${db.quotations.length} quotation(s), ${db.appointments.length} appointment(s), ${db.contracts.length} service contract(s), and ${db.cashClosures.length} cash closure record(s), and resets the monthly sales/unit targets to 0. This cannot be undone.`
        : `Ini akan memadam KEKAL ${db.customers.length} pelanggan, ${db.vehicles.length} kenderaan, ${db.jobs.length} kad kerja, ${db.invoices.length} invois, ${db.creditNotes.length} nota kredit, ${db.quotations.length} sebut harga, ${db.appointments.length} tempahan, ${db.contracts.length} kontrak servis, dan ${db.cashClosures.length} rekod tutup tunai, serta reset sasaran jualan/unit bulanan kepada 0. Ini tidak boleh dibuat asal.`,
      ()=>{
        const counts = { customers: db.customers.length, vehicles: db.vehicles.length, jobs: db.jobs.length, invoices: db.invoices.length, creditNotes: db.creditNotes.length, quotations: db.quotations.length, appointments: db.appointments.length, contracts: db.contracts.length, cashClosures: db.cashClosures.length };
        db.customers = [];
        db.vehicles = [];
        db.jobs = [];
        db.invoices = [];
        db.creditNotes = [];
        db.quotations = [];
        db.appointments = [];
        db.contracts = [];
        db.cashClosures = [];
        db.settings.monthlySalesTarget = 0;
        db.settings.monthlyUnitTarget = 0;
        logAudit('Reset Data Kedai', `${counts.customers} pelanggan, ${counts.vehicles} kenderaan, ${counts.jobs} kad kerja, ${counts.invoices} invois, ${counts.creditNotes} nota kredit, ${counts.quotations} sebut harga, ${counts.appointments} tempahan, ${counts.contracts} kontrak, ${counts.cashClosures} rekod tutup tunai dipadam; sasaran bulanan direset`);
        queueSave();
        render();
        showToast(en ? 'Customer and transaction data has been reset.' : 'Data pelanggan dan transaksi telah direset.');
      },
      { typedConfirmWord: 'PADAM', confirmLabel: en?'Reset Everything':'Reset Semua' }
    );
  });
  bindAction('list-auto-backups', async ()=>{
    try{
      const list = await listAutoBackups();
      setState({autoBackupsList: list});
    }catch(e){ reportError(e, 'Gagal muat senarai sandaran automatik'); showToast(tt('Gagal muat senarai sandaran.')); }
  });
  bindAllAction('download-auto-backup', async el=>{
    const id = el.dataset.id;
    try{
      const backupData = await fetchAutoBackupData(id);
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'servispro-sandaran-auto-'+id+'.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }catch(e){ reportError(e, 'Gagal muat turun sandaran automatik'); showToast(tt('Gagal muat turun sandaran.')); }
  });
  const paymentQrInput = document.getElementById('payment-qr-input');
  if(paymentQrInput) paymentQrInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev)=>{
      img.onload = ()=>{
        const maxW = 400;
        const scale = Math.min(1, maxW/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        db.settings.paymentQR = canvas.toDataURL('image/png');
        queueSave();
        render();
        showToast(tt('Kod QR bayaran disimpan.'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  bindAction('remove-payment-qr', ()=>{
    askConfirm(tt('Buang kod QR bayaran ini?'), ()=>{
      db.settings.paymentQR = '';
      queueSave();
      render();
      showToast(tt('Kod QR bayaran dibuang.'));
    });
  });
  const shopLogoInput = document.getElementById('shop-logo-input');
  if(shopLogoInput) shopLogoInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev)=>{
      img.onload = ()=>{
        const maxW = 400;
        const scale = Math.min(1, maxW/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        db.settings.shopLogo = canvas.toDataURL('image/png');
        queueSave();
        render();
        showToast(state.language==='en'?'Workshop logo saved.':'Logo bengkel disimpan.');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  bindAction('remove-shop-logo', ()=>{
    askConfirm(state.language==='en'?'Remove this workshop logo?':'Buang logo bengkel ini?', ()=>{
      db.settings.shopLogo = '';
      queueSave();
      render();
      showToast(state.language==='en'?'Workshop logo removed.':'Logo bengkel dibuang.');
    });
  });
  const restoreFile = document.getElementById('restore-file');
  if(restoreFile) restoreFile.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        askConfirm(tt('Pulihkan data daripada fail ini? SEMUA data semasa akan digantikan.'), ()=>{
          // A backup taken with an older version of the app (or a hand-edited
          // file) can be missing top-level fields the current code assumes
          // exist — the rest of the app does .map()/.filter() on these
          // without checking, so any missing one crashes the very next
          // screen that touches it. Fall back to defaultDB()'s shape for
          // anything absent or null, field by field, instead of patching
          // fields one at a time as each new crash gets discovered.
          const base = defaultDB();
          // A backup missing the staff field entirely (older export version,
          // hand-edited file, or a file some other part of the app produced
          // without it) must NOT be treated as "this shop now has zero
          // staff" — falling through to base.staff=[] here would, a few
          // lines down, delete every other teammate's login access from the
          // server, keeping only whoever clicked restore. Only trust the
          // backup's staff list when it actually provided one; otherwise
          // keep whatever staff this device already had loaded.
          const staffFieldMissing = !Array.isArray(parsed.staff);
          const preRestoreStaff = db.staff;
          db = { ...base, ...parsed };
          Object.keys(base).forEach(key=>{ if(db[key]===undefined || db[key]===null) db[key] = base[key]; });
          // The check above only catches a MISSING counters object outright
          // — a backup taken before creditNote/quote counters existed still
          // has a present-but-incomplete one, which passes that check and
          // leaves e.g. db.counters.creditNote undefined. allocateCounter()'s
          // offline fallback path does `++db.counters[name]`, and
          // ++undefined is NaN — permanently "CN-NaN" from then on (NaN+1
          // stays NaN), not just a one-off glitch. Merge sub-keys instead of
          // trusting the backup's counters object wholesale.
          db.counters = { ...base.counters, ...db.counters };
          if(staffFieldMissing) db.staff = preRestoreStaff;
          if(db.settings.paymentQR===undefined) db.settings.paymentQR='';
          if(db.settings.lastBackupAt===undefined) db.settings.lastBackupAt=null;
          // Job creation and POS checkout read db.branches[0].id whenever no
          // specific branch is selected — an empty (not just missing) array
          // passes the generic check above but still crashes the same way.
          if(!Array.isArray(db.branches) || db.branches.length===0) db.branches=[{id:'main', name:'Cawangan Utama'}];
          // A backup taken from another branch/device — or before this
          // account existed as staff — won't include the person doing the
          // restore. Since shop_meta/staff writes are Admin-only via RLS
          // keyed off the staff table, silently dropping their own record
          // here would lock them out of Settings/Staff for the rest of the
          // session with no way back in. Whoever clicks restore keeps their
          // own access no matter what the file says about everyone else.
          if(state.currentStaff && !db.staff.some(s=>s.id===state.currentStaff.id)){
            db.staff.push(state.currentStaff);
          }
          queueSave();
          render();
          showToast(tt('Data berjaya dipulihkan.'));
        });
      }catch(err){ showToast(tt('Fail sandaran tidak sah.')); }
    };
    reader.readAsText(file);
  });
  bindAction('export-csv-invoices', ()=>downloadCSV('invois.csv',
    ['No. Invois','Pelanggan','Tarikh','Bayaran','Subjumlah','Diskaun','Cukai','Jumlah'],
    db.invoices.filter(inv=>!inv.draft).map(inv=>{
      const c=getCustomer(inv.customerId);
      return [inv.invoiceNo, c?c.name:'Walk-in', fmtDateTime(inv.createdAt), inv.payment, inv.subtotal, inv.discount||0, inv.tax||0, inv.total];
    })));
  bindAction('export-csv-inventory', ()=>downloadCSV('inventori.csv',
    ['Nama','SKU','Kuantiti','Kos','Harga Jual','Amaran Stok Rendah'],
    db.inventory.map(i=>[i.name,i.sku,i.qty,i.cost,i.price,i.lowStock])));
  bindAction('export-csv-customers', ()=>downloadCSV('pelanggan.csv',
    ['Nama','Telefon'],
    db.customers.map(c=>[c.name,c.phone||''])));
  bindAction('export-csv-accounting', ()=>downloadCSV('rekod-perakaunan.csv',
    ['Tarikh','Rujukan','Penerangan','Debit (Tunai/Belanja)','Kredit (Jualan)','Cukai SST'],
    db.invoices.filter(inv=>!inv.draft).map(inv=>{
      const c = getCustomer(inv.customerId);
      const desc = 'Jualan - '+(c?c.name:'Walk-in')+' ('+inv.items.map(it=>it.name).join('; ')+')';
      return [localDateStr(new Date(inv.createdAt)), inv.invoiceNo, desc, 0, inv.total, inv.tax||0];
    })));
  bindAction('export-csv-payroll', ()=>downloadCSV('rekod-gaji.csv',
    ['Staf','Bulan','Gaji Pokok','Komisen %','Komisen','Jumlah Kasar','KWSP','PERKESO','EIS','PCB','Potongan Lain','Gaji Bersih','Tarikh Bayar','Dibayar Oleh'],
    [...db.payrollRecords].sort((a,b)=>a.paidAt-b.paidAt).map(r=>[
      r.staffName, r.month, r.baseSalary, r.commissionPct, r.commission, r.total,
      r.epf||0, r.socso||0, r.eis||0, r.pcb||0, r.otherDeductions||0, r.netPay!==undefined?r.netPay:r.total,
      localDateStr(new Date(r.paidAt)), r.paidBy
    ])));

  // new customer / vehicle inline in job modal
  const njCustomer = document.getElementById('nj-customer');
  if(njCustomer){
    njCustomer.addEventListener('change', ()=>{
      const val = njCustomer.value;
      document.getElementById('nj-new-customer-fields').style.display = val==='__new__' ? 'block' : 'none';
      const vehSel = document.getElementById('nj-vehicle');
      const newVehFields = document.getElementById('nj-new-vehicle-fields');
      if(val && val!=='__new__'){
        const vs = getVehiclesFor(val);
        vehSel.innerHTML = `<option value="">— Pilih Kenderaan —</option>` + vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') + `<option value="__new__">+ Kenderaan Baharu</option>`;
        newVehFields.style.display = 'none';
      } else if(val==='__new__'){
        vehSel.innerHTML = `<option value="__new__">+ Kenderaan Baharu</option>`;
        newVehFields.style.display = 'block';
      } else {
        vehSel.innerHTML = `<option value="">— Pilih Pelanggan Dahulu —</option>`;
        newVehFields.style.display = 'none';
      }
    });
  }
  const njVehicle = document.getElementById('nj-vehicle');
  if(njVehicle){
    njVehicle.addEventListener('change', ()=>{
      document.getElementById('nj-new-vehicle-fields').style.display = njVehicle.value==='__new__' ? 'block' : 'none';
    });
  }

  bindAction('create-job', async ()=>{
    let customerId = document.getElementById('nj-customer').value;
    let vehicleId = document.getElementById('nj-vehicle') ? document.getElementById('nj-vehicle').value : '';
    const desc = document.getElementById('nj-desc').value.trim();
    const estimatedPrice = Number(document.getElementById('nj-price').value)||0;
    const mechanic = document.getElementById('nj-mechanic').value.trim();
    const bayEl = document.getElementById('nj-bay');
    const bayId = bayEl && bayEl.value ? bayEl.value : null;

    if(customerId==='__new__'){
      const name = document.getElementById('nj-new-name').value.trim();
      const phone = document.getElementById('nj-new-phone').value.trim();
      if(!name){ showToast(tt('Sila masukkan nama pelanggan.')); return; }
      customerId = uid();
      db.customers.push({id:customerId, name, phone});
    }
    if(!customerId){ showToast(tt('Sila pilih atau tambah pelanggan.')); return; }

    if(vehicleId==='__new__' || !vehicleId){
      const plate = document.getElementById('nj-new-plate') ? document.getElementById('nj-new-plate').value.trim() : '';
      const model = document.getElementById('nj-new-model') ? document.getElementById('nj-new-model').value.trim() : '';
      if(!plate){ showToast(tt('Sila masukkan no. plat kenderaan.')); return; }
      vehicleId = uid();
      db.vehicles.push({id:vehicleId, customerId, plate, model, color:''});
    }

    try{
      const jobNo = await nextJobNo();
      // db.branches is backfilled with a default on every login (see
      // handleAuthenticated), but stay defensive here too rather than
      // crash on db.branches[0].id if it's ever empty when this runs.
      const fallbackBranchId = (db.branches && db.branches[0]) ? db.branches[0].id : 'main';
      const job = {id:uid(), jobNo, customerId, vehicleId, description:desc, estimatedPrice, mechanic, status:'waiting', items:[], createdAt:Date.now(), invoiced:false, createdBy: state.currentStaff ? state.currentStaff.name : '', internalNote:'', doneAt:null, photos:[], branchId: state.currentBranch!=='all' ? state.currentBranch : fallbackBranchId, bayId};
      db.jobs.push(job);
      queueSave();
      setState({modal:null, view:'jobs'});
      showToast(tt('Kad kerja ')+job.jobNo+tt(' dicipta.'));
    }catch(e){
      reportError(e, 'Cipta kad kerja gagal');
      showToast(state.language==='en' ? 'Could not create the job card. Try again.' : 'Gagal cipta kad kerja. Cuba lagi.');
    }
  });

  const jobPhotoInput = document.getElementById('job-photo-input');
  if(jobPhotoInput){
    jobPhotoInput.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev)=>{
        img.onload = ()=>{
          const maxW = 500;
          const scale = Math.min(1, maxW/img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width*scale; canvas.height = img.height*scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const job = state.modal.job;
          if(!job.photos) job.photos = [];
          job.photos.push(dataUrl);
          queueSave();
          render();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  document.querySelectorAll('[data-action="remove-photo"]').forEach(el=>el.addEventListener('click', ()=>{
    const job = state.modal.job;
    job.photos.splice(Number(el.dataset.idx),1);
    queueSave();
    render();
  }));

  const sigPad = document.getElementById('sig-pad');
  if(sigPad){
    const ctx = sigPad.getContext('2d');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    let drawing = false;
    const getPos = (e)=>{
      const rect = sigPad.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return {x: cx-rect.left, y: cy-rect.top};
    };
    const start = (e)=>{ drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault(); };
    const move = (e)=>{ if(!drawing) return; const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); };
    const end = ()=>{ drawing=false; };
    sigPad.addEventListener('mousedown', start);
    sigPad.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    sigPad.addEventListener('touchstart', start, {passive:false});
    sigPad.addEventListener('touchmove', move, {passive:false});
    sigPad.addEventListener('touchend', end);
  }
  bindAction('clear-sig-pad', ()=>{
    const canvas = document.getElementById('sig-pad');
    if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  });
  bindAllAction('save-signature', el=>{
    const canvas = document.getElementById('sig-pad');
    if(!canvas) return;
    const job = state.modal.job;
    job.signature = canvas.toDataURL('image/png');
    queueSave();
    render();
    showToast(tt('Tandatangan disimpan.'));
  });
  bindAllAction('clear-signature', el=>{
    askConfirm(tt('Padam tandatangan sedia ada dan tandatangan semula?'), ()=>{
      const job = state.modal.job;
      job.signature = null;
      render();
    });
  });

  bindAction('save-job-status', ()=>{
    const job = state.modal.job;
    captureJobModalEdits(job);
    queueSave();
    setState({modal:null});
    showToast(tt('Kad kerja dikemaskini.'));
  });

  bindAllAction('delete-job', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    askConfirm(tt('Padam kad kerja ')+(job?job.jobNo:'')+'?', ()=>{
      db.jobs = db.jobs.filter(j=>j.id!==el.dataset.id);
      logAudit('Padam Kad Kerja', job.jobNo);
      queueSave();
      setState({modal:null});
      showToast(tt('Kad kerja dipadam.'), ()=>{
        db.jobs.push(job); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });

  bindAllAction('return-job', async el=>{
    const en = state.language==='en';
    const original = db.jobs.find(j=>j.id===el.dataset.id);
    if(!original) return;
    try{
      const jobNo = await nextJobNo();
      const fallbackBranchId = (db.branches && db.branches[0]) ? db.branches[0].id : 'main';
      const job = {
        id:uid(), jobNo, customerId: original.customerId, vehicleId: original.vehicleId,
        description: (en?'[Return job for ':'[Kad kerja pemulangan untuk ')+original.jobNo+'] '+(original.description||''),
        mechanic: original.mechanic, status:'waiting', items:[], createdAt:Date.now(), invoiced:false,
        createdBy: state.currentStaff ? state.currentStaff.name : '', internalNote:'', doneAt:null, photos:[],
        branchId: original.branchId || fallbackBranchId, returnFromJobId: original.id,
      };
      db.jobs.push(job);
      logAudit('Kad Kerja Pemulangan', job.jobNo+' ('+(en?'from ':'daripada ')+original.jobNo+')');
      queueSave();
      setState({modal:{type:'job-detail', job}});
      showToast(en?`Return job ${job.jobNo} created.`:`Kad kerja pemulangan ${job.jobNo} dicipta.`);
    }catch(e){
      reportError(e, 'Cipta kad kerja pemulangan gagal');
      showToast(en ? 'Could not create the return job. Try again.' : 'Gagal cipta kad kerja pemulangan. Cuba lagi.');
    }
  });
  bindAllAction('job-to-pos', async el=>{
    const en = state.language==='en';
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    // Persist whatever's currently in the modal's fields (description,
    // mechanic, notes, status, bay) -- this button sits right next to
    // "Simpan" and is the more natural next step after filling in a job
    // description, so it must not silently drop that edit. See
    // captureJobModalEdits for why this matters for the AI suggestion below.
    captureJobModalEdits(job);
    queueSave();
    // Jumping straight to a different job's invoice while a still-empty
    // draft from a PREVIOUS "Hantar ke POS" is sitting untouched -- drop
    // that one rather than leaving it behind every time this happens.
    // Only ever touches a draft with zero items; one that already has
    // items on it (however it got there) is left alone.
    if(state.posEditingInvoiceId){
      const prevDraft = db.invoices.find(i=>i.id===state.posEditingInvoiceId && i.draft);
      if(prevDraft && prevDraft.items.length===0){
        db.invoices = db.invoices.filter(i=>i.id!==prevDraft.id);
      }
    }
    state.posCustomerId = job.customerId;
    state.posVehicleId = job.vehicleId;
    state.posJobId = job.id;
    state.posCart = [];
    state.posLastInvoiceId = null; // don't show a previous sale's reprint button next to this new job's context
    // Straight pass-through, same reasoning as the description display in
    // pos.js -- a mechanic who already typed an estimated price on the job
    // card shouldn't have to re-enter it as a custom cart item by hand. No
    // AI, no inventory match required: one cart line, the job's own
    // description as its name (so it reads the same on the printed invoice
    // as it did on the job card) and the typed price, editable/removable
    // like any other cart row afterward.
    if(job.estimatedPrice>0){
      state.posCart.push({refId:null, name: job.description || (en?'Job work':'Kerja servis'), price: job.estimatedPrice, qty:1});
    }
    state.aiQuoteSuggestion = null; // fresh each time -- never carry a previous job's suggestion into this one
    setState({modal:null, view:'pos'});
    // Auto-run the AI item suggestion right away (silent -- no "nothing to
    // analyze" toast if the job has no description/findings yet) so the
    // cart panel already shows suggested parts/services the moment the
    // mechanic lands in POS, instead of requiring a manual "Cadangan AI"
    // press every time. Not awaited: this runs alongside the draft invoice
    // creation below rather than blocking it.
    requestAiQuoteSuggestion(true);
    // Auto-generate an empty invoice the moment the job lands in POS,
    // rather than only creating one once checkout is clicked -- the
    // mechanic edits THIS invoice's cart (add/remove items as usual) and
    // checkout finalizes it in place. "draft:true" keeps it out of every
    // sales/commission stat (see dashboard.js/reports.js/payroll.js) until
    // it's actually finalized -- an empty draft isn't a real sale yet.
    try{
      const invoiceNo = await nextInvNo();
      const draft = {
        id: uid(), invoiceNo, customerId: job.customerId||null, vehicleId: job.vehicleId||null, jobId: job.id,
        items: [], subtotal: 0, discount: 0, taxRate: Number(db.settings.taxRate)||0, tax: 0, total: 0,
        payment: 'Tunai', draft: true, createdAt: Date.now(),
        createdBy: state.currentStaff ? state.currentStaff.name : '',
      };
      db.invoices.push(draft);
      queueSave();
      state.posEditingInvoiceId = draft.id;
      render();
      showToast(en?`Invoice ${invoiceNo} started — add items and save.`:`Invois ${invoiceNo} dijana — tambah item dan simpan.`);
    }catch(e){
      reportError(e, 'Jana invois draf gagal');
      showToast(tt('Sedia untuk buat invois bagi ')+job.jobNo);
    }
  });
  bindAllAction('ai-suggest-quote-items', ()=>{
    requestAiQuoteSuggestion();
  });
  bindAllAction('voice-input', el=>{
    startVoiceInput(el.dataset.target, el);
  });
  bindAllAction('ai-assistant-chip', el=>{
    sendAiAssistantMessage(el.dataset.text);
  });
  bindAllAction('add-ai-quote-item', el=>{
    const suggestion = state.aiQuoteSuggestion;
    if(!suggestion || typeof suggestion!=='object') return;
    const item = suggestion.items[Number(el.dataset.idx)];
    if(!item) return;
    const invItem = db.inventory.find(i=>i.id===item.id);
    state.posCart.push({ refId: item.id, name: invItem ? invItem.name : item.name, price: invItem ? invItem.price : 0, qty: item.qty });
    suggestion.items = suggestion.items.filter((_,idx)=>idx!==Number(el.dataset.idx));
    render();
  });
  bindAllAction('add-all-ai-quote-items', ()=>{
    const suggestion = state.aiQuoteSuggestion;
    if(!suggestion || typeof suggestion!=='object') return;
    for(const item of suggestion.items){
      const invItem = db.inventory.find(i=>i.id===item.id);
      state.posCart.push({ refId: item.id, name: invItem ? invItem.name : item.name, price: invItem ? invItem.price : 0, qty: item.qty });
    }
    suggestion.items = [];
    render();
  });
  bindAllAction('open-inspection', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    state.aiSuggestion = null; // fresh each time -- never carry a previous job's suggestion into this one
    setState({modal:{type:'inspection', job}});
  });
  bindAllAction('ai-suggest-checklist', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    if(job) requestAiSuggestion(job);
  });
  document.querySelectorAll('[data-inspect-item]').forEach(el=>el.addEventListener('click', ()=>{
    const job = state.modal.job;
    if(!job.inspection) job.inspection = {};
    const name = el.dataset.inspectItem;
    const cur = job.inspection[name];
    const next = !cur ? 'ok' : cur==='ok' ? 'attention' : cur==='attention' ? 'replace' : null;
    if(next) job.inspection[name] = next; else delete job.inspection[name];
    queueSave();
    render();
  }));
  const diagramWrap = document.getElementById('diagram-wrap');
  if(diagramWrap){
    diagramWrap.addEventListener('click', (e)=>{
      if(e.target.closest('[data-diagram-mark-idx]')) return;
      const job = state.modal.job;
      const rect = diagramWrap.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((e.clientX-rect.left)/rect.width)*100));
      const y = Math.min(100, Math.max(0, ((e.clientY-rect.top)/rect.height)*100));
      if(!job.diagramMarks) job.diagramMarks = [];
      job.diagramMarks.push({x:Math.round(x*10)/10, y:Math.round(y*10)/10, severity:'attention', note:''});
      queueSave();
      render();
    });
  }
  document.querySelectorAll('[data-diagram-mark-idx]').forEach(el=>el.addEventListener('click', (e)=>{
    e.stopPropagation();
    const job = state.modal.job;
    const idx = Number(el.dataset.diagramMarkIdx);
    const mark = job.diagramMarks[idx];
    if(!mark) return;
    mark.severity = mark.severity==='ok' ? 'attention' : mark.severity==='attention' ? 'replace' : 'ok';
    queueSave();
    render();
  }));
  document.querySelectorAll('[data-diagram-note-idx]').forEach(el=>el.addEventListener('change', ()=>{
    const job = state.modal.job;
    const idx = Number(el.dataset.diagramNoteIdx);
    if(job.diagramMarks[idx]) job.diagramMarks[idx].note = el.value;
    queueSave();
  }));
  bindAllAction('remove-diagram-mark', el=>{
    const job = state.modal.job;
    job.diagramMarks.splice(Number(el.dataset.idx),1);
    queueSave();
    render();
  });
  bindAllAction('share-inspection-report', el=>{
    const en = state.language==='en';
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    if(!job) return;
    if(!job.inspectionToken) job.inspectionToken = uid()+uid();
    queueSave();
    const url = `${location.origin}${location.pathname}?inspect=${encodeURIComponent(job.id)}&token=${encodeURIComponent(job.inspectionToken)}`;
    const cust = getCustomer(job.customerId);
    const waText = encodeURIComponent(`${en?"Here's the inspection report for your vehicle":'Ini laporan pemeriksaan untuk kenderaan anda'} (${job.jobNo}): ${url}`);
    if(cust && cust.phone){
      window.open(`https://wa.me/${normalizePhone(cust.phone)}?text=${waText}`, '_blank');
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url);
      showToast(en?'Report link copied — no customer phone number on file.':'Pautan laporan disalin — tiada no. telefon pelanggan direkodkan.');
    } else {
      showToast(url);
    }
  });
  bindAllAction('share-quotation-approval', el=>{
    const en = state.language==='en';
    const q = (db.quotations||[]).find(x=>x.id===el.dataset.id);
    if(!q) return;
    if(!q.quoteToken) q.quoteToken = uid()+uid();
    if(q.status==='draft') q.status = 'sent';
    queueSave();
    const url = `${location.origin}${location.pathname}?quote=${encodeURIComponent(q.id)}&token=${encodeURIComponent(q.quoteToken)}`;
    const cust = getCustomer(q.customerId);
    const waText = encodeURIComponent(`${en?"Here's your quotation":'Ini sebut harga anda'} (${q.quoteNo}) — ${fmtRM(q.total)}: ${url}`);
    render();
    if(cust && cust.phone){
      window.open(`https://wa.me/${normalizePhone(cust.phone)}?text=${waText}`, '_blank');
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url);
      showToast(en?'Quotation link copied — no customer phone number on file.':'Pautan sebut harga disalin — tiada no. telefon pelanggan direkodkan.');
    } else {
      showToast(url);
    }
  });
  bindAllAction('share-invoice-receipt', el=>{
    const en = state.language==='en';
    const inv = db.invoices.find(x=>x.id===el.dataset.id);
    if(!inv) return;
    if(!inv.invoiceToken) inv.invoiceToken = uid()+uid();
    queueSave();
    const url = `${location.origin}${location.pathname}?invoice=${encodeURIComponent(inv.id)}&token=${encodeURIComponent(inv.invoiceToken)}`;
    const cust = getCustomer(inv.customerId);
    // A brief mention of the optional customer-portal account -- the
    // receipt is the most natural "job just finished" touchpoint, and
    // usually the last message a given customer gets for this visit, so
    // it's the one place this is worth mentioning rather than repeating it
    // on every single share (inspection report, quotation) for the same job.
    const portalNote = en
      ? ' Tip: tap "My Account" on that page to register and see all your past services, quotations and receipts in one place.'
      : ' Tip: tekan "Akaun Saya" di halaman itu untuk daftar dan lihat semua sejarah servis, sebut harga dan resit anda di satu tempat.';
    const waText = encodeURIComponent(`${en?"Here's your receipt":'Ini resit anda'} (${inv.invoiceNo}) — ${fmtRM(inv.total)}: ${url}${portalNote}`);
    if(cust && cust.phone){
      window.open(`https://wa.me/${normalizePhone(cust.phone)}?text=${waText}`, '_blank');
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url);
      showToast(en?'Receipt link copied — no customer phone number on file.':'Pautan resit disalin — tiada no. telefon pelanggan direkodkan.');
    } else {
      showToast(url);
    }
  });

  bindAction('save-item', ()=>{
    const id = document.querySelector('[data-action="save-item"]').dataset.id;
    const name = document.getElementById('it-name').value.trim();
    const sku = document.getElementById('it-sku').value.trim();
    const qty = Number(document.getElementById('it-qty').value)||0;
    const cost = Number(document.getElementById('it-cost').value)||0;
    const price = Number(document.getElementById('it-price').value)||0;
    const lowStock = Number(document.getElementById('it-low').value)||0;
    const supplierId = document.getElementById('it-supplier').value || null;
    const warrantyMonths = Number(document.getElementById('it-warranty').value)||0;
    if(!name){ showToast(tt('Sila masukkan nama item.')); return; }
    if(id){
      const item = getItem(id);
      if(item.price !== price) logAudit('Ubah Harga', name+': '+fmtRM(item.price)+' → '+fmtRM(price));
      Object.assign(item, {name,sku,qty,cost,price,lowStock,supplierId,warrantyMonths});
    } else {
      db.inventory.push({id:uid(), name,sku,qty,cost,price,lowStock,supplierId,warrantyMonths});
      logAudit('Tambah Item', name);
    }
    queueSave();
    setState({modal:null});
    showToast(tt('Item disimpan.'));
  });

  bindAction('save-customer', ()=>{
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama.')); return; }
    const dup = phone && db.customers.find(c=>c.phone && c.phone.replace(/\D/g,'')===phone.replace(/\D/g,''));
    const doSave = ()=>{
      db.customers.push({id:uid(), name, phone, visits:0, loyaltyPoints:0});
      queueSave();
      setState({modal:null});
      showToast(tt('Pelanggan ditambah.'));
    };
    if(dup){
      askConfirm(tt('No. telefon ini sudah didaftarkan untuk "')+dup.name+tt('". Tambah sebagai pelanggan baharu juga?'), doSave, {confirmLabel:tt('Tambah Juga')});
    } else doSave();
  });

  bindAction('save-vehicle', ()=>{
    const btn = document.querySelector('[data-action="save-vehicle"]');
    const customerId = btn.dataset.cid;
    const plate = document.getElementById('veh-plate').value.trim();
    const model = document.getElementById('veh-model').value.trim();
    const color = document.getElementById('veh-color').value.trim();
    if(!plate){ showToast(tt('Sila masukkan no. plat.')); return; }
    const plateNorm = plate.toLowerCase().replace(/\s/g,'');
    const dup = db.vehicles.find(v=>v.plate.toLowerCase().replace(/\s/g,'')===plateNorm);
    const doSave = ()=>{
      db.vehicles.push({id:uid(), customerId, plate, model, color, odometer:0, serviceIntervalKm:10000, lastServiceKm:0});
      queueSave();
      setState({modal:null});
      showToast(tt('Kenderaan ditambah.'));
    };
    if(dup){
      const dupOwner = getCustomer(dup.customerId);
      askConfirm(tt('No. plat "')+plate+tt('" sudah wujud dalam rekod (pemilik: ')+(dupOwner?dupOwner.name:'-')+tt('). Tambah juga sebagai rekod berasingan?'), doSave, {confirmLabel:tt('Tambah Juga')});
    } else doSave();
  });

  // POS handlers
  bindAllAction('add-to-cart', el=>{
    const item = getItem(el.dataset.id);
    const existing = state.posCart.find(c=>c.refId===item.id);
    if(existing) existing.qty++;
    else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
    render();
  });
  bindAllAction('add-package-to-cart', el=>{
    const pkg = (db.packages||[]).find(p=>p.id===el.dataset.id);
    if(!pkg) return;
    const existing = state.posCart.find(c=>c.packageId===pkg.id);
    if(existing) existing.qty++;
    else state.posCart.push({packageId:pkg.id, name:pkg.name, price:pkg.price, qty:1});
    render();
  });
  bindAction('add-custom-cart', ()=>{
    const name = document.getElementById('pos-custom-name').value.trim();
    const price = Number(document.getElementById('pos-custom-price').value)||0;
    if(!name||price<=0){ showToast(tt('Sila lengkapkan nama & harga servis.')); return; }
    state.posCart.push({refId:null, name, price, qty:1});
    render();
  });
  bindAllAction('cart-inc', el=>{ state.posCart[el.dataset.idx].qty++; render(); });
  bindAllAction('cart-dec', el=>{
    const row = state.posCart[el.dataset.idx];
    row.qty = Math.max(1,row.qty-1);
    render();
  });
  bindAllAction('cart-remove', el=>{ state.posCart.splice(el.dataset.idx,1); render(); });

  const posCustomerSel = document.getElementById('pos-customer');
  if(posCustomerSel) posCustomerSel.addEventListener('change', ()=>{
    state.posCustomerId = posCustomerSel.value; state.posVehicleId=''; render();
  });
  const posVehicleSel = document.getElementById('pos-vehicle');
  if(posVehicleSel) posVehicleSel.addEventListener('change', ()=>{
    state.posVehicleId = posVehicleSel.value;
  });

  bindAction('close-cash', ()=>{
    const actual = Number(document.getElementById('cash-actual').value);
    if(isNaN(actual)){ showToast(tt('Sila masukkan jumlah tunai.')); return; }
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const dateStr = localDateStr(todayStart);
    const expected = todaysCashCollected(todayStart.getTime());
    db.cashClosures.push({id:uid(), date:dateStr, expected, actual, closedBy: state.currentStaff?state.currentStaff.name:'', closedAt:Date.now()});
    logAudit('Tutup Kunci Tunai', dateStr+': jangka '+fmtRM(expected)+' vs sebenar '+fmtRM(actual));
    queueSave();
    render();
    showToast(tt('Kunci tunai hari ini ditutup.'));
  });
  bindAction('save-quotation', async ()=>{
    const en = state.language==='en';
    if(state.posCart.length===0) return;
    try{
      const subtotal = state.posCart.reduce((s,c)=>s+c.price*c.qty,0);
      let discountAmt = 0;
      if(state.posDiscountType==='percent') discountAmt = subtotal * (Number(state.posDiscountValue)||0) / 100;
      else discountAmt = Number(state.posDiscountValue)||0;
      discountAmt = Math.min(Math.max(discountAmt,0), subtotal);
      const afterDiscount = subtotal - discountAmt;
      const taxRate = Number(db.settings.taxRate)||0;
      const taxAmt = afterDiscount * taxRate/100;
      const total = afterDiscount + taxAmt;
      const quoteNo = await nextQuoteNo();
      const quotation = {
        id:uid(), quoteNo, customerId:state.posCustomerId||null, vehicleId:state.posVehicleId||null,
        items:[...state.posCart], subtotal, discount:discountAmt, taxRate, tax:taxAmt, total, status:'draft',
        createdAt:Date.now(), createdBy: state.currentStaff ? state.currentStaff.name : '',
      };
      if(!db.quotations) db.quotations = [];
      db.quotations.push(quotation);
      // A quotation, not an invoice, was decided on -- drop the still-empty
      // draft invoice this cart may have started from (see job-to-pos)
      // rather than leaving an abandoned RM0 draft behind.
      if(state.posEditingInvoiceId){
        db.invoices = db.invoices.filter(inv=>inv.id!==state.posEditingInvoiceId);
        state.posEditingInvoiceId = null;
      }
      logAudit('Jana Sebut Harga', quotation.quoteNo+' — '+fmtRM(quotation.total));
      queueSave();
      state.posCart = []; state.posCustomerId=''; state.posVehicleId=''; state.posDiscountValue=0; state.posDiscountType='flat';
      render();
      showToast(en?`Quotation ${quoteNo} saved.`:`Sebut harga ${quoteNo} disimpan.`);
      printQuotation(quotation);
    }catch(e){
      reportError(e, 'Simpan sebut harga gagal');
      showToast(en?'Could not save the quotation. Try again.':'Gagal simpan sebut harga. Cuba lagi.');
    }
  });
  bindAllAction('convert-quote-to-invoice', el=>{
    const en = state.language==='en';
    const quote = (db.quotations||[]).find(q=>q.id===el.dataset.id);
    if(!quote) return;
    state.posCart = quote.items.map(it=>({...it}));
    state.posCustomerId = quote.customerId||'';
    state.posVehicleId = quote.vehicleId||'';
    state.posDiscountType = 'flat';
    state.posDiscountValue = quote.discount||0;
    state.posConvertingQuoteId = quote.id;
    setState({view:'pos'});
    showToast(en?'Quotation loaded into cart — complete checkout to convert it to an invoice.':'Sebut harga dimuatkan ke troli — lengkapkan checkout untuk tukar kepada invois.');
  });
  bindAllAction('print-quotation', el=>{
    const q = (db.quotations||[]).find(x=>x.id===el.dataset.id);
    if(q) printQuotation(q);
  });
  bindAllAction('delete-quotation', el=>{
    const en = state.language==='en';
    askConfirm(en?'Delete this quotation?':'Padam sebut harga ini?', ()=>{
      db.quotations = (db.quotations||[]).filter(q=>q.id!==el.dataset.id);
      queueSave(); render();
      showToast(en?'Quotation deleted.':'Sebut harga dipadam.');
    });
  });
  bindAllAction('resume-draft-invoice', el=>{
    const inv = db.invoices.find(i=>i.id===el.dataset.id && i.draft);
    if(!inv) return;
    state.posCart = inv.items.map(it=>({...it}));
    state.posCustomerId = inv.customerId||'';
    state.posVehicleId = inv.vehicleId||'';
    state.posJobId = inv.jobId||'';
    state.posEditingInvoiceId = inv.id;
    setState({view:'pos'});
    showToast(tt('Menyambung invois ')+inv.invoiceNo);
  });
  bindAllAction('delete-draft-invoice', el=>{
    const en = state.language==='en';
    askConfirm(en?'Discard this draft invoice? Its number won\'t be reused.':'Buang draf invois ini? Nombornya tidak akan diguna semula.', ()=>{
      db.invoices = db.invoices.filter(i=>i.id!==el.dataset.id);
      if(state.posEditingInvoiceId===el.dataset.id) state.posEditingInvoiceId = null;
      queueSave(); render();
      showToast(en?'Draft discarded.':'Draf dibuang.');
    });
  });
  bindAction('checkout', async ()=>{
    if(state.posCart.length===0) return;
    // Everything here used to run with no try/catch — any unexpected throw
    // (e.g. a malformed cart entry, a missing DOM element) died silently in
    // the console with zero feedback: the button just looked unresponsive,
    // no toast, no error, cart left untouched. Wrapping it means a real bug
    // now surfaces (to the user AND to Sentry) instead of looking like
    // nothing happened at all.
    try{
      const en = state.language==='en';
      let payment, payments;
      // Simple Mode always checks out as a single payment method, even if
      // posSplitMode was left true from before the setting was turned on
      // (its own toggle checkbox is hidden in Simple Mode, so there'd be no
      // way to turn it back off otherwise).
      if(state.posSplitMode && !db.settings.simpleMode){
        const methodEls = document.querySelectorAll('[data-split-method-idx]');
        payments = Array.from(methodEls).map(el=>{
          const idx = el.dataset.splitMethodIdx;
          const amountEl = document.querySelector(`[data-split-amount-idx="${idx}"]`);
          return { method: el.value, amount: Math.max(0, Number(amountEl?amountEl.value:0)||0) };
        }).filter(p=>p.amount>0);
        if(payments.length===0){ showToast(en?'Enter at least one payment amount.':'Masukkan sekurang-kurangnya satu jumlah bayaran.'); return; }
        payment = payments.length>1 ? (en?'Split':'Berbilang') : payments[0].method;
      } else {
        const paymentEl = document.getElementById('pos-payment');
        payment = paymentEl ? paymentEl.value : 'Tunai';
      }
      // deduct inventory -- a package line deducts each of its component
      // items instead of itself (the bundle isn't a real stock item)
      state.posCart.forEach(c=>{
        if(c.refId){
          const item = getItem(c.refId);
          if(item) item.qty = Math.max(0, item.qty-c.qty);
        } else if(c.packageId){
          const pkg = (db.packages||[]).find(p=>p.id===c.packageId);
          if(pkg) pkg.items.forEach(pi=>{
            const item = getItem(pi.refId);
            if(item) item.qty = Math.max(0, item.qty - pi.qty*c.qty);
          });
        }
      });
      const subtotal = state.posCart.reduce((s,c)=>s+c.price*c.qty,0);
      let discountAmt = 0;
      if(state.posDiscountType==='percent') discountAmt = subtotal * (Number(state.posDiscountValue)||0) / 100;
      else discountAmt = Number(state.posDiscountValue)||0;
      discountAmt = Math.min(Math.max(discountAmt,0), subtotal);
      const afterDiscount = subtotal - discountAmt;
      const taxRate = Number(db.settings.taxRate)||0;
      const taxAmt = afterDiscount * taxRate/100;
      const total = afterDiscount + taxAmt;
      // db.branches is backfilled with a default on every login (see
      // handleAuthenticated), but stay defensive here too rather than
      // crash on db.branches[0].id if it's ever empty when this runs.
      const fallbackBranchId = (db.branches && db.branches[0]) ? db.branches[0].id : 'main';
      // If this cart started from an auto-generated draft (see job-to-pos),
      // finalize that SAME invoice in place -- same id/invoiceNo, no
      // second invoice created alongside the now-filled-in draft, and no
      // extra nextInvNo() round-trip since the number was already reserved
      // when the draft was created.
      const editingDraft = state.posEditingInvoiceId ? db.invoices.find(i=>i.id===state.posEditingInvoiceId) : null;
      let invoice;
      if(editingDraft){
        Object.assign(editingDraft, {
          customerId:state.posCustomerId||null, vehicleId:state.posVehicleId||null, jobId: state.posJobId||null,
          items:[...state.posCart], subtotal, discount:discountAmt, taxRate, tax:taxAmt, total, payment, createdAt:Date.now(),
          createdBy: state.currentStaff ? state.currentStaff.name : '', branchId: state.currentBranch!=='all' ? state.currentBranch : fallbackBranchId,
          ...(payments ? {payments} : {}),
        });
        delete editingDraft.draft;
        invoice = editingDraft;
      } else {
        const invoiceNo = await nextInvNo();
        invoice = {
          id:uid(), invoiceNo, customerId:state.posCustomerId||null, vehicleId:state.posVehicleId||null,
          jobId: state.posJobId||null, items:[...state.posCart], subtotal, discount:discountAmt, taxRate, tax:taxAmt, total, payment, createdAt:Date.now(),
          createdBy: state.currentStaff ? state.currentStaff.name : '', branchId: state.currentBranch!=='all' ? state.currentBranch : fallbackBranchId,
          ...(payments ? {payments} : {}),
        };
        db.invoices.push(invoice);
      }
      const amountPaid = invoiceAmountPaid(invoice);
      const balanceNote = amountPaid<total-0.004 ? ' — '+(en?'balance due':'baki tertunggak')+' '+fmtRM(total-amountPaid) : '';
      logAudit('Jana Invois', invoice.invoiceNo+' — '+fmtRM(invoice.total)+balanceNote);
      if(state.posCustomerId){
        const cust = getCustomer(state.posCustomerId);
        if(cust){
          cust.visits = (cust.visits||0)+1;
          cust.loyaltyPoints = (cust.loyaltyPoints||0)+1;
        }
      }
      if(state.posJobId){
        const job = db.jobs.find(j=>j.id===state.posJobId);
        if(job){ job.invoiced = true; job.status='delivered'; }
      }
      if(state.posConvertingQuoteId){
        const quote = (db.quotations||[]).find(q=>q.id===state.posConvertingQuoteId);
        if(quote){ quote.status='converted'; quote.convertedInvoiceId = invoice.id; }
      }
      queueSave();
      state.posCart = []; state.posCustomerId=''; state.posVehicleId=''; state.posJobId=''; state.posDiscountValue=0; state.posDiscountType='flat';
      state.posSplitMode = false; state.posSplitPayments = []; state.posConvertingQuoteId = null; state.posEditingInvoiceId = null;
      // Surfaced in the now-empty cart panel (see viewPOS() in pos.js) as a
      // "Cetak Invois" button reusing the existing print-invoice action --
      // previously the only way to print was to leave POS entirely and find
      // the invoice again in Finance > Invoices.
      state.posLastInvoiceId = invoice.id;
      render();
      showToast(tt('Invois ')+invoice.invoiceNo+tt(' berjaya dijana!'));
    }catch(e){
      reportError(e, 'Checkout/jana invois gagal');
      showToast(state.language==='en' ? 'Could not generate the invoice. Try again — if it keeps failing, tell your Admin.' : 'Gagal jana invois. Cuba lagi — kalau berterusan, maklumkan Admin.');
    }
  });

  bindAllAction('open-credit-note', el=>{
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(invoice) setState({modal:{type:'credit-note', invoice}});
  });
  bindAllAction('save-credit-note', async el=>{
    const en = state.language==='en';
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(!invoice) return;
    const reason = document.getElementById('cn-reason').value.trim();
    if(!reason){ showToast(en?'Please enter a reason.':'Sila masukkan sebab.'); return; }
    const qtyInputs = document.querySelectorAll('[data-cn-qty-idx]');
    // The invoice's own discount is applied once, across the whole cart
    // (see checkout/save-quotation), not per line -- invItem.price below is
    // still the PRE-discount unit price. Without prorating it here, a
    // credit note against a discounted invoice refunds the customer more
    // than they actually paid (e.g. a 10%-off invoice would credit back the
    // full undiscounted price of a returned item), and the same undiscounted
    // figure feeds P&L revenue and mechanic commission via
    // creditNotesForInvoice() in reports.js/payroll.js, understating both.
    const discountRatio = invoice.subtotal>0 ? (invoice.discount||0)/invoice.subtotal : 0;
    const items = [];
    qtyInputs.forEach(inp=>{
      const idx = Number(inp.dataset.cnQtyIdx);
      const qty = Math.max(0, Number(inp.value)||0);
      if(qty<=0) return;
      const invItem = invoice.items[idx];
      const price = invItem.price * (1-discountRatio);
      // invoiceItemIdx (not just name) is what creditNoteModalHTML uses to
      // track how much of THIS line was already credited -- two distinct
      // custom/no-refId cart lines can share an identical typed name (e.g.
      // two "Labor" charges added via add-custom-cart, which never dedupes
      // by name), and name-only tracking would let crediting one wrongly
      // count against the other's remaining creditable qty.
      items.push({name:invItem.name, qty, price, refId:invItem.refId||undefined, invoiceItemIdx:idx});
    });
    if(items.length===0){ showToast(en?'Enter a quantity to credit for at least one item.':'Masukkan kuantiti kredit untuk sekurang-kurangnya satu item.'); return; }
    try{
      const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
      const tax = invoice.taxRate>0 ? subtotal*invoice.taxRate/100 : 0;
      const creditNoteNo = await nextCreditNoteNo();
      const creditNote = {
        id:uid(), creditNoteNo, invoiceId:invoice.id, customerId:invoice.customerId, items, reason,
        subtotal, tax, total:subtotal+tax, createdAt:Date.now(), createdBy: state.currentStaff?state.currentStaff.name:'',
      };
      if(!db.creditNotes) db.creditNotes = [];
      db.creditNotes.push(creditNote);
      logAudit('Keluarkan Nota Kredit', creditNoteNo+' — '+invoice.invoiceNo+' — '+fmtRM(creditNote.total));
      queueSave();
      setState({modal:null});
      showToast(en?`Credit note ${creditNoteNo} issued.`:`Nota kredit ${creditNoteNo} dikeluarkan.`);
      printCreditNote(creditNote, invoice);
    }catch(e){
      reportError(e, 'Keluarkan nota kredit gagal');
      showToast(en?'Could not issue the credit note. Try again.':'Gagal keluarkan nota kredit. Cuba lagi.');
    }
  });
  bindAllAction('print-credit-note', el=>{
    const cn = (db.creditNotes||[]).find(c=>c.id===el.dataset.id);
    if(!cn) return;
    const invoice = db.invoices.find(i=>i.id===cn.invoiceId);
    printCreditNote(cn, invoice);
  });
  bindAllAction('settle-invoice-balance', el=>{
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(invoice) setState({modal:{type:'settle-balance', invoice}});
  });
  bindAllAction('confirm-settle-balance', el=>{
    const en = state.language==='en';
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(!invoice) return;
    const method = document.getElementById('settle-method').value;
    const balance = invoiceBalanceDue(invoice);
    const amount = Math.min(balance, Math.max(0, Number(document.getElementById('settle-amount').value)||0));
    if(amount<=0){ showToast(en?'Enter an amount to record.':'Masukkan jumlah untuk direkod.'); return; }
    // `at` marks when THIS payment actually happened -- a balance settled
    // today on an invoice created days ago must count toward TODAY's cash
    // reconciliation (see todaysCashCollected in utils.js), not silently
    // vanish because the invoice itself falls outside "today". The
    // backfilled first entry keeps its true original timestamp
    // (invoice.createdAt), not now, since that portion was actually paid
    // at checkout, not this moment.
    if(!invoice.payments) invoice.payments = [{method: invoice.payment, amount: invoice.total-balance, at: invoice.createdAt}];
    invoice.payments.push({method, amount, at: Date.now()});
    invoice.payment = invoice.payments.length>1 ? (en?'Split':'Berbilang') : invoice.payments[0].method;
    logAudit('Rekod Bayaran Baki', invoice.invoiceNo+' — '+fmtRM(amount));
    queueSave();
    setState({modal:null});
    showToast(en?'Payment recorded.':'Bayaran direkod.');
  });
  bindAllAction('print-invoice', el=>{
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(invoice) printInvoice(invoice);
  });
  bindAllAction('print-payslip', el=>{
    const record = db.payrollRecords.find(r=>r.id===el.dataset.id);
    if(record) printPayslip(record);
  });
  bindAllAction('print-jobcard', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    if(job) printJobCard(job);
  });
  bindAllAction('print-vehicle-qr', el=>{
    const vehicle = getVehicle(el.dataset.id);
    if(vehicle) printVehicleQR(vehicle);
  });

  const posSearch = document.getElementById('pos-search');
  if(posSearch){
    posSearch.addEventListener('input', ()=>{
      document.getElementById('pos-item-list').innerHTML = renderPOSItemList(posSearch.value);
      document.querySelectorAll('[data-action="add-to-cart"]').forEach(el=>el.addEventListener('click', ()=>{
        const item = getItem(el.dataset.id);
        const existing = state.posCart.find(c=>c.refId===item.id);
        if(existing) existing.qty++;
        else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
        render();
      }));
    });
  }

  const posBarcode = document.getElementById('pos-barcode');
  if(posBarcode){
    posBarcode.focus();
    posBarcode.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        const code = posBarcode.value.trim();
        if(!code) return;
        const item = db.inventory.find(i=>i.sku.toLowerCase()===code.toLowerCase());
        if(item){
          const existing = state.posCart.find(c=>c.refId===item.id);
          if(existing) existing.qty++;
          else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
          render();
          showToast(item.name+tt(' ditambah ke troli.'));
        } else {
          showToast(tt('Tiada item dengan kod "')+code+'".');
          posBarcode.value='';
        }
      }
    });
  }

  const discType = document.getElementById('pos-discount-type');
  const discVal = document.getElementById('pos-discount-value');
  if(discType) discType.addEventListener('change', ()=>{ state.posDiscountType = discType.value; render(); });
  bindAction('apply-loyalty-discount', ()=>{
    state.posDiscountType = 'percent';
    state.posDiscountValue = Number(db.settings.loyaltyDiscount)||0;
    render();
    showToast(tt('Diskaun setia digunakan.'));
  });
  if(discVal) discVal.addEventListener('input', ()=>{ state.posDiscountValue = discVal.value; render(); focusEnd('pos-discount-value'); });

  const splitToggle = document.getElementById('pos-split-toggle');
  if(splitToggle) splitToggle.addEventListener('change', ()=>{
    state.posSplitMode = splitToggle.checked;
    if(state.posSplitMode && state.posSplitPayments.length===0) state.posSplitPayments = [{method:'Tunai', amount:0}];
    render();
  });
  bindAction('add-split-row', ()=>{
    if(!state.posSplitPayments.length) state.posSplitPayments = [{method:'Tunai', amount:0}];
    state.posSplitPayments.push({method:'Tunai', amount:0});
    render();
  });
  bindAllAction('remove-split-row', el=>{
    state.posSplitPayments.splice(Number(el.dataset.idx),1);
    render();
  });
  document.querySelectorAll('[data-split-method-idx]').forEach(el=>el.addEventListener('change', ()=>{
    const idx = Number(el.dataset.splitMethodIdx);
    if(!state.posSplitPayments[idx]) state.posSplitPayments[idx] = {method:'Tunai', amount:0};
    state.posSplitPayments[idx].method = el.value;
    render();
  }));
  document.querySelectorAll('[data-split-amount-idx]').forEach(el=>el.addEventListener('input', ()=>{
    const idx = Number(el.dataset.splitAmountIdx);
    if(!state.posSplitPayments[idx]) state.posSplitPayments[idx] = {method:'Tunai', amount:0};
    state.posSplitPayments[idx].amount = el.value;
    render();
    focusEnd(`split-amount-${idx}`);
  }));
}

