/* ============================= AI QUOTE ITEM SUGGESTIONS (POS) =============================
   Renders the "AI Cadangan Item" trigger/panel shown in the cart panel
   when a job is linked into POS (state.posJobId) -- see requestAiQuoteSuggestion()
   in src/ai-assist.js and the job-to-pos/ai-suggest-quote-items/
   add-ai-quote-item/add-all-ai-quote-items actions in event-handlers.js. */
function renderAiQuoteSuggestionBox(){
  const en = state.language==='en';
  const ai = state.aiQuoteSuggestion;
  // Wrapped in a stable #ai-quote-suggestion-box id regardless of which
  // state below renders -- render() replaces the ENTIRE page and resets
  // scroll to the top every time (true for every render in this app, not
  // just this one), so a mechanic who scrolled down to press the button
  // gets kicked back to the item picker at the top before the result is
  // even in. requestAiQuoteSuggestion() (ai-assist.js) scrolls this id
  // back into view after every render it triggers, for the manual button
  // press -- the silent auto-trigger from job-to-pos relies on its own
  // toast instead (position:fixed, visible regardless of scroll).
  if(!ai){
    return `<button id="ai-quote-suggestion-box" class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-bottom:14px;" data-action="ai-suggest-quote-items">${ICONS.sparkle} ${en?'AI Suggestion (items for this job)':'Cadangan AI (item untuk kerja ini)'}</button>`;
  }
  if(ai==='loading'){
    return `<div id="ai-quote-suggestion-box" style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;">${en?'Asking AI…':'Bertanya AI…'}</div>`;
  }
  if(ai==='unavailable'){
    return `<div id="ai-quote-suggestion-box" style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${en?'AI suggestion isn\'t available right now.':'Cadangan AI tidak tersedia buat masa ini.'}</div>`;
  }
  if(ai==='rate_limited'){
    return `<div id="ai-quote-suggestion-box" style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${en?'AI is busy right now. Try again shortly.':'AI sedang sibuk buat masa ini. Cuba sebentar lagi.'}</div>`;
  }
  if(ai.items.length===0){
    return `<div id="ai-quote-suggestion-box" style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${en?'No AI suggestions right now.':'Tiada cadangan AI buat masa ini.'}</div>`;
  }
  return `
  <div id="ai-quote-suggestion-box" class="panel" style="background:var(--accent-soft);border-color:var(--accent);padding:12px;margin-bottom:14px;">
    <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">${ICONS.sparkle} ${en?'AI suggestion — a starting point, not a final bill':'Cadangan AI — titik permulaan, bukan bil akhir'}</div>
    ${ai.items.map((item,idx)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;${idx<ai.items.length-1?'border-bottom:1px solid var(--border);':''}">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:600;">${esc(item.name)} <span style="color:var(--text-muted);font-weight:400;">× ${item.qty}</span></div>
          ${item.reason ? `<div style="font-size:11px;color:var(--text-muted);">${esc(item.reason)}</div>` : ''}
        </div>
        <button class="btn-icon" data-action="add-ai-quote-item" data-idx="${idx}" title="${en?'Add to cart':'Tambah ke troli'}">${ICONS.plus}</button>
      </div>`).join('')}
    <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-top:10px;" data-action="add-all-ai-quote-items">${en?'Add All to Cart':'Tambah Semua ke Troli'}</button>
  </div>`;
}

/* ============================= POS VIEW ============================= */
function viewPOS(){
  // Invoice history and cash-closing totals are sales/revenue figures —
  // Mekanik keeps full checkout ability (cart, current invoice total) but
  // doesn't see the aggregate history or daily cash reconciliation.
  const isAdmin = canSeeRevenue();
  const cart = state.posCart;
  const subtotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
  let discountAmt = 0;
  if(state.posDiscountType==='percent') discountAmt = subtotal * (Number(state.posDiscountValue)||0) / 100;
  else discountAmt = Number(state.posDiscountValue)||0;
  discountAmt = Math.min(Math.max(discountAmt,0), subtotal);
  const afterDiscount = subtotal - discountAmt;
  const taxRate = Number(db.settings.taxRate)||0;
  const taxAmt = afterDiscount * taxRate/100;
  const total = afterDiscount + taxAmt;
  const custVehicles = state.posCustomerId ? getVehiclesFor(state.posCustomerId) : [];
  // viewPOS() re-renders (fully, string-and-innerHTML) on every state change
  // while this page is open -- adding a cart line, toggling split payment,
  // even an unrelated realtime update -- not just when the customer picker
  // itself is touched. An unbounded <option> per customer made every one of
  // those rebuild however many hundreds/thousands of options a shop has
  // accumulated. Cap it; always keep whichever customer is actually
  // selected in the list even if they'd otherwise fall outside the cap, so
  // an existing selection never silently disappears from the dropdown.
  const POS_CUSTOMER_OPTIONS_CAP = 300;
  let posCustomerOptions = [...db.customers].sort((a,b)=>a.name.localeCompare(b.name));
  if(posCustomerOptions.length>POS_CUSTOMER_OPTIONS_CAP){
    const selected = posCustomerOptions.find(c=>c.id===state.posCustomerId);
    posCustomerOptions = posCustomerOptions.slice(0, POS_CUSTOMER_OPTIONS_CAP);
    if(selected && !posCustomerOptions.includes(selected)) posCustomerOptions.push(selected);
  }
  // Simple Mode always checks out as a single payment method, regardless
  // of a stale posSplitMode left on from before the setting was turned on.
  const showSplit = state.posSplitMode && !db.settings.simpleMode;

  return `
  <div class="pos-wrap">
    <div class="panel">
      <h2>${ICONS.inventory} ${tt('Pilih Item / Servis')}</h2>
      <div class="field">
        <label>${ICONS.barcode} ${tt('Imbas / Kod Pantas (SKU)')}</label>
        <input id="pos-barcode" placeholder="${tt('Imbas kod bar atau taip SKU, tekan Enter')}" autocomplete="off">
      </div>
      <div class="search-box">${ICONS.search}<input id="pos-search" placeholder="${tt('Cari item inventori...')}"></div>
      <div id="pos-item-list">${renderPOSItemList('')}</div>
      ${!db.settings.simpleMode && (db.packages||[]).filter(p=>p.active).length>0 ? `
      <div style="margin-top:14px;">
        <label>${ICONS.wallet} ${state.language==='en'?'Packages':'Pakej'}</label>
        ${db.packages.filter(p=>p.active).map(pkg=>`
          <div class="pos-item" data-action="add-package-to-cart" data-id="${pkg.id}">
            <div>
              <div class="n">${esc(pkg.name)}</div>
              <div class="m">${pkg.items.length} ${state.language==='en'?'items included':'item termasuk'}</div>
            </div>
            <div class="p">${fmtRM(pkg.price)}</div>
          </div>`).join('')}
      </div>` : ''}
      <div class="field" style="margin-top:14px;">
        <label>${state.language==='en'?'Or Add a Custom / Miscellaneous Item':'Atau Tambah Item Custom / Lain-lain'}</label>
        <div style="display:flex;gap:8px;">
          <input id="pos-custom-name" placeholder="${state.language==='en'?'e.g. service charge, disposal fee':'cth: caj servis, caj pelupusan'}" style="flex:2;">
          <input id="pos-custom-price" type="number" placeholder="RM" style="flex:1;">
          <button class="btn btn-outline btn-sm" data-action="add-custom-cart">${ICONS.plus}</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>${ICONS.pos} ${tt('Troli & Invois')}</h2>
      <div class="field"><label>${tt('Pelanggan (pilihan)')}</label>
        <select id="pos-customer">
          <option value="">${tt('Tunai / Walk-in')}</option>
          ${posCustomerOptions.map(c=>`<option value="${c.id}" ${state.posCustomerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      ${state.posCustomerId ? `
      <div class="field"><label>${tt('Kenderaan')}</label>
        <select id="pos-vehicle">
          <option value="">— ${tt('Tiada')} —</option>
          ${custVehicles.map(v=>`<option value="${v.id}" ${state.posVehicleId===v.id?'selected':''}>${esc(v.plate)} (${esc(v.model)})</option>`).join('')}
        </select>
      </div>
      ${(()=>{
        const cust = getCustomer(state.posCustomerId);
        const visits = cust ? (cust.visits||0) : 0;
        const threshold = Number(db.settings.loyaltyVisits)||5;
        if(visits>=threshold){
          return `<div style="background:rgba(242,167,59,.15);border:1px solid var(--accent);border-radius:8px;padding:10px 12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:12px;"><strong>⭐ ${state.language==='en'?'Loyal Customer':'Pelanggan Setia'}</strong><br><span style="color:var(--text-muted);">${visits} ${state.language==='en'?'visits · Qualifies for':'lawatan · Layak diskaun'} ${db.settings.loyaltyDiscount}%</span></div>
            <button class="btn btn-primary btn-sm" data-action="apply-loyalty-discount">${state.language==='en'?'Apply':'Guna'}</button>
          </div>`;
        }
        return `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px;">${visits}/${threshold} ${state.language==='en'?'visits to loyalty discount':'lawatan ke diskaun setia'}</div>`;
      })()}` : ''}

      ${state.posJobId ? renderAiQuoteSuggestionBox() : ''}

      <div style="margin:14px 0;">
        ${cart.length===0 ? emptyState(tt('Troli kosong. Pilih item di sebelah kiri.')) : cart.map((c,idx)=>`
          <div class="cart-row">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${esc(c.name)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">${fmtRM(c.price)} × ${c.qty}</div>
            </div>
            <button class="qty-btn" data-action="cart-dec" data-idx="${idx}">−</button>
            <span style="width:20px;text-align:center;font-family:'IBM Plex Mono',monospace;">${c.qty}</span>
            <button class="qty-btn" data-action="cart-inc" data-idx="${idx}">+</button>
            <button class="btn-icon" data-action="cart-remove" data-idx="${idx}" title="${state.language==='en'?'Remove from cart':'Buang dari troli'}">${ICONS.x}</button>
          </div>`).join('')}
      </div>

      <div class="field-row">
        <div class="field"><label>${tt('Diskaun')}</label>
          <select id="pos-discount-type">
            <option value="flat" ${state.posDiscountType==='flat'?'selected':''}>${tt('RM (Tetap)')}</option>
            <option value="percent" ${state.posDiscountType==='percent'?'selected':''}>${tt('% Peratus')}</option>
          </select>
        </div>
        <div class="field"><label>${tt('Nilai Diskaun')}</label><input id="pos-discount-value" type="number" min="0" value="${state.posDiscountValue||0}"></div>
      </div>

      <div class="receipt">
        <div class="receipt-row"><span>${tt('Subjumlah')}</span><span>${fmtRM(subtotal)}</span></div>
        ${discountAmt>0 ? `<div class="receipt-row"><span>${tt('Diskaun')}</span><span>-${fmtRM(discountAmt)}</span></div>` : ''}
        ${taxRate>0 ? `<div class="receipt-row"><span>SST (${taxRate}%)</span><span>${fmtRM(taxAmt)}</span></div>` : ''}
        <div class="receipt-line"></div>
        <div class="receipt-row receipt-total"><span>${tt('JUMLAH')}</span><span>${fmtRM(total)}</span></div>
      </div>
      ${!db.settings.simpleMode ? `
      <div class="field" style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;">
        <label style="margin-bottom:0;">${state.language==='en'?'Split / Partial Payment':'Pisah / Sebahagian Bayaran'}</label>
        <input type="checkbox" id="pos-split-toggle" ${state.posSplitMode?'checked':''} style="width:18px;height:18px;">
      </div>` : ''}
      ${!showSplit ? `
      <div class="field"><label>${tt('Kaedah Bayaran')}</label>
        <select id="pos-payment">
          <option value="Tunai">${tt('Tunai')}</option>
          <option value="Kad">${tt('Kad Debit/Kredit')}</option>
          <option value="Online">${tt('Pemindahan Online / QR')}</option>
        </select>
      </div>` : (()=>{
        const rows = state.posSplitPayments.length ? state.posSplitPayments : [{method:'Tunai', amount:total}];
        const paidSoFar = rows.reduce((s,r)=>s+(Number(r.amount)||0),0);
        const balance = total - paidSoFar;
        return `
        <div style="margin-bottom:8px;">
          ${rows.map((r,idx)=>`
            <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
              <select data-split-method-idx="${idx}" style="flex:1.2;">
                <option value="Tunai" ${r.method==='Tunai'?'selected':''}>${tt('Tunai')}</option>
                <option value="Kad" ${r.method==='Kad'?'selected':''}>${tt('Kad Debit/Kredit')}</option>
                <option value="Online" ${r.method==='Online'?'selected':''}>${tt('Pemindahan Online / QR')}</option>
              </select>
              <input type="number" step="0.01" min="0" id="split-amount-${idx}" data-split-amount-idx="${idx}" value="${r.amount}" style="flex:1;">
              ${rows.length>1 ? `<button class="btn-icon" data-action="remove-split-row" data-idx="${idx}" title="${state.language==='en'?'Remove payment row':'Buang baris bayaran'}">${ICONS.x}</button>` : ''}
            </div>`).join('')}
          <button class="btn btn-outline btn-sm" data-action="add-split-row">${ICONS.plus} ${state.language==='en'?'Add Payment':'Tambah Bayaran'}</button>
        </div>
        <div style="font-size:12.5px;padding:8px 0;color:${balance>0.004?'var(--danger)':'var(--success)'};font-weight:600;">
          ${balance>0.004 ? (state.language==='en'?`Balance due after checkout: ${fmtRM(balance)} (recorded as a deposit)`:`Baki tertunggak selepas checkout: ${fmtRM(balance)} (direkod sebagai deposit)`)
            : (state.language==='en'?'Fully covered.':'Dibayar sepenuhnya.')}
        </div>`;
      })()}
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" data-action="checkout" ${cart.length===0?'disabled':''}>${ICONS.pos} ${tt('Jana Invois & Selesai')}</button>
      ${!showSplit && !db.settings.simpleMode ? `<button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px;" data-action="save-quotation" ${cart.length===0?'disabled':''}>${ICONS.printer} ${state.language==='en'?'Save as Quotation (no stock deducted)':'Simpan sebagai Sebut Harga (stok tidak ditolak)'}</button>` : ''}
      <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:6px;">${tt('Petua: Ctrl+Enter untuk checkout pantas')}</div>
    </div>
  </div>

  ${isAdmin ? `
  ${!db.settings.simpleMode && (db.creditNotes||[]).length>0 ? `
  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.repeat} ${state.language==='en'?'Credit Notes':'Nota Kredit'} <span class="tag">${db.creditNotes.length}</span></h2>
    <div class="table-wrap"><table>
      <thead><tr><th>${state.language==='en'?'No.':'No.'}</th><th>${state.language==='en'?'Against Invoice':'Terhadap Invois'}</th><th>${state.language==='en'?'Reason':'Sebab'}</th><th>${tt('Jumlah')}</th><th></th></tr></thead>
      <tbody>
        ${[...db.creditNotes].sort((a,b)=>b.createdAt-a.createdAt).slice(0,10).map(cn=>{
          const origInv = db.invoices.find(i=>i.id===cn.invoiceId);
          return `<tr>
            <td style="font-family:'IBM Plex Mono',monospace;">${cn.creditNoteNo}</td>
            <td>${origInv?origInv.invoiceNo:'-'}</td>
            <td style="font-size:12px;color:var(--text-muted);">${esc(cn.reason)}</td>
            <td style="color:var(--danger);font-weight:600;">-${fmtRM(cn.total)}</td>
            <td><button class="btn-icon" data-action="print-credit-note" data-id="${cn.id}" title="${state.language==='en'?'Print':'Cetak'}">${ICONS.printer}</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  </div>` : ''}

  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.gauge} ${tt('Tutup Kunci Tunai Harian')}</h2>
    ${(()=>{
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayCash = db.invoices.filter(inv=>!inv.draft && inv.createdAt>=todayStart.getTime()).reduce((s,i)=>s+invoiceCashAmount(i),0);
      const alreadyClosed = db.cashClosures.find(cc=>cc.date===localDateStr(todayStart));
      if(alreadyClosed){
        const variance = alreadyClosed.actual - alreadyClosed.expected;
        return `<div style="font-size:13px;">
          <div>${tt('Jangkaan tunai')}: <strong>${fmtRM(alreadyClosed.expected)}</strong></div>
          <div>${tt('Tunai dikira')}: <strong>${fmtRM(alreadyClosed.actual)}</strong></div>
          <div style="color:${variance===0?'var(--success)':'var(--danger)'};font-weight:600;margin-top:6px;">
            ${variance===0 ? '✓ '+tt('Padan sepenuhnya') : (variance>0 ? tt('Lebihan')+' '+fmtRM(variance) : tt('Kekurangan')+' '+fmtRM(Math.abs(variance)))}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">${tt('Ditutup oleh')} ${esc(alreadyClosed.closedBy)} ${tt('pada')} ${fmtDateTime(alreadyClosed.closedAt)}</div>
        </div>`;
      }
      return `
        <div style="font-size:13px;margin-bottom:10px;">${tt('Jualan tunai sistem hari ini')}: <strong style="color:var(--accent);">${fmtRM(todayCash)}</strong></div>
        <div class="field"><label>${tt('Jumlah Tunai Dikira Sebenar (RM)')}</label><input id="cash-actual" type="number" step="0.01" placeholder="0.00"></div>
        <button class="btn btn-primary" data-action="close-cash">${tt('Tutup Kunci Hari Ini')}</button>
      `;
    })()}
  </div>` : ''}
  `;
}

function creditNoteModalHTML(invoice){
  const en = state.language==='en';
  const alreadyCredited = {};
  (db.creditNotes||[]).filter(cn=>cn.invoiceId===invoice.id).forEach(cn=>cn.items.forEach(ci=>{
    alreadyCredited[ci.name] = (alreadyCredited[ci.name]||0)+ci.qty;
  }));
  return `
    <h2>${en?'Issue Credit Note':'Keluarkan Nota Kredit'} — ${invoice.invoiceNo}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Select the quantity of each item to credit back.':'Pilih kuantiti setiap item untuk dikreditkan semula.'}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Item')}</th><th>${en?'Invoiced Qty':'Kuantiti Diinvois'}</th><th>${en?'Credit Qty':'Kuantiti Kredit'}</th></tr></thead>
      <tbody>
        ${invoice.items.map((it,idx)=>{
          const already = alreadyCredited[it.name]||0;
          const maxCreditable = Math.max(0, it.qty-already);
          return `<tr>
            <td style="font-weight:600;">${esc(it.name)}${already>0?` <span style="font-size:10.5px;color:var(--text-muted);">(${en?'already credited':'sudah dikreditkan'} ${already})</span>`:''}</td>
            <td>${it.qty}</td>
            <td><input type="number" min="0" max="${maxCreditable}" value="0" data-cn-qty-idx="${idx}" style="max-width:80px;" ${maxCreditable<=0?'disabled':''}></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div class="field" style="margin-top:12px;"><label>${en?'Reason':'Sebab'}</label><textarea id="cn-reason" rows="2" placeholder="${en?'e.g. part returned, pricing correction':'cth: item dipulangkan, pembetulan harga'}"></textarea></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-credit-note" data-id="${invoice.id}">${en?'Issue Credit Note':'Keluarkan Nota Kredit'}</button>
    </div>
  `;
}

function settleBalanceModalHTML(invoice){
  const en = state.language==='en';
  const balance = invoiceBalanceDue(invoice);
  return `
    <h2>${en?'Record Balance Payment':'Rekod Bayaran Baki'} — ${invoice.invoiceNo}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Outstanding balance':'Baki tertunggak'}: <strong>${fmtRM(balance)}</strong></p>
    <div class="field"><label>${tt('Kaedah Bayaran')}</label>
      <select id="settle-method">
        <option value="Tunai">${tt('Tunai')}</option>
        <option value="Kad">${tt('Kad Debit/Kredit')}</option>
        <option value="Online">${tt('Pemindahan Online / QR')}</option>
      </select>
    </div>
    <div class="field"><label>${en?'Amount':'Jumlah'} (RM)</label><input id="settle-amount" type="number" step="0.01" min="0" max="${balance.toFixed(2)}" value="${balance.toFixed(2)}"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="confirm-settle-balance" data-id="${invoice.id}">${en?'Record Payment':'Rekod Bayaran'}</button>
    </div>
  `;
}

function renderPOSItemList(filter){
  const items = db.inventory.filter(i=>i.name.toLowerCase().includes((filter||'').toLowerCase()));
  if(items.length===0) return emptyState(tt('Tiada item sepadan.'));
  return items.map(i=>`
    <div class="pos-item" data-action="add-to-cart" data-id="${i.id}">
      <div>
        <div class="n">${esc(i.name)}</div>
        <div class="m">${tt('Baki')}: ${i.qty} ${i.qty<=i.lowStock?'⚠️':''}</div>
      </div>
      <div class="p">${fmtRM(i.price)}</div>
    </div>`).join('');
}

