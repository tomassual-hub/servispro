/* ============================= FINANCE VIEW =============================
   Quotations + Invoices (moved out of POS, which now only handles building
   and checking out a cart) and Purchase Orders (moved out of Inventory,
   which now only handles the catalog/suppliers/packages/reorder side) --
   grouped into one dedicated section with a 3-tab bar + Status/Date filters,
   matching a reference app's own "Finance" section the user pointed to.
   POS still creates quotations/invoices (checkout, "Save as Quotation"),
   Inventory's reorder-suggestions tab still creates purchase orders -- this
   view is where they're all reviewed/managed afterwards. */

function financeStatusOptions(tab){
  const en = state.language==='en';
  if(tab==='quotations') return [
    {k:'all', l:en?'All statuses':'Semua status'},
    {k:'draft', l:en?'Draft':'Draf'},
    {k:'sent', l:en?'Sent':'Dihantar'},
    {k:'accepted', l:en?'Accepted':'Diterima'},
    {k:'rejected', l:en?'Rejected':'Ditolak'},
    {k:'converted', l:en?'Converted':'Ditukar'},
    {k:'expired', l:en?'Expired':'Tamat Tempoh'},
  ];
  if(tab==='po') return [
    {k:'all', l:en?'All statuses':'Semua status'},
    {k:'pending', l:en?'Not Received':'Belum Diterima'},
    {k:'partial', l:en?'Partially Received':'Diterima Sebahagian'},
    {k:'received', l:en?'Received':'Diterima'},
  ];
  return [ // invoices
    {k:'all', l:en?'All statuses':'Semua status'},
    {k:'paid', l:en?'Fully Paid':'Selesai'},
    {k:'balance', l:en?'Balance Due':'Ada Baki'},
  ];
}
function viewFinance(){
  const en = state.language==='en';
  const isAdmin = canSeeRevenue();
  // Quotations/Invoices were already Admin/Kerani-only where they used to
  // live (inside POS -- see canSeeRevenue() gating there before this view
  // existed); Purchase Orders were NOT gated (every Mekanik could already
  // see Inventory's PO tab). Merging all three into one section must not
  // quietly change either of those -- Mekanik still lands on PO only.
  const tab = isAdmin ? (state.financeTab || 'quotations') : 'po';
  const statusFilter = state.financeStatusFilter || 'all';
  const shown = state.financeShowCount || 30;

  const tabsHTML = `
  <div class="tabs tabs-primary">
    ${isAdmin ? `
    <div class="tab-btn ${tab==='quotations'?'active':''}" data-financetab="quotations">${en?'Quotations':'Sebut Harga'} (${db.quotations.length})</div>
    <div class="tab-btn ${tab==='invoices'?'active':''}" data-financetab="invoices">${en?'Invoices':'Invois'} (${db.invoices.length})</div>
    ` : ''}
    <div class="tab-btn ${tab==='po'?'active':''}" data-financetab="po">${en?'Purchase Orders':'Pesanan Belian'} (${db.purchaseOrders.length})</div>
  </div>
  <div class="field-row" style="margin-bottom:16px;">
    <div class="field"><label>${en?'Status':'Status'}</label>
      <select id="finance-status-filter">
        ${financeStatusOptions(tab).map(o=>`<option value="${o.k}" ${statusFilter===o.k?'selected':''}>${o.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${en?'Date':'Tarikh'}</label>
      <select id="finance-date-filter">
        ${dateRangeFilterOptions().map(o=>`<option value="${o.k}" ${(state.financeDateFilter||'all')===o.k?'selected':''}>${o.l}</option>`).join('')}
      </select>
    </div>
  </div>`;

  let bodyHTML;
  if(tab==='quotations'){
    let list = [...db.quotations].filter(q=>statusFilter==='all'||q.status===statusFilter).filter(q=>withinDateRangeFilter(q.createdAt, state.financeDateFilter));
    list.sort((a,b)=>b.createdAt-a.createdAt);
    const total = list.length;
    list = list.slice(0, shown);
    bodyHTML = total===0 ? emptyState(en?'No quotations found.':'Tiada sebut harga ditemui.') : `
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>No.</th><th>${tt('Pelanggan')}</th><th>${tt('Tarikh')}</th><th>${tt('Jumlah')}</th><th>${tt('Status')}</th><th></th></tr></thead>
        <tbody>
          ${list.map(q=>{
            const cust = getCustomer(q.customerId);
            const statusLabel = {draft:en?'Draft':'Draf', sent:en?'Sent':'Dihantar', accepted:en?'Accepted':'Diterima', rejected:en?'Rejected':'Ditolak', converted:en?'Converted':'Ditukar', expired:en?'Expired':'Tamat Tempoh'}[q.status];
            const pillClass = q.status==='converted'||q.status==='accepted' ? 'pill-done' : q.status==='expired'||q.status==='rejected' ? 'pill-low' : 'pill-wait';
            return `<tr>
              <td style="font-family:'IBM Plex Mono',monospace;">${q.quoteNo}</td>
              <td>${cust?esc(cust.name):tt('Walk-in')}</td>
              <td>${fmtDateTime(q.createdAt)}</td>
              <td style="color:var(--accent);font-weight:600;">${fmtRM(q.total)}</td>
              <td><span class="pill ${pillClass}">${statusLabel}</span></td>
              <td style="white-space:nowrap;">
                ${q.status==='draft'||q.status==='sent' ? `<button class="btn-icon" data-action="share-quotation-approval" data-id="${q.id}" title="${en?'Share for Approval':'Kongsi untuk Kelulusan'}">${ICONS.share||ICONS.whatsapp}</button>` : ''}
                ${q.status!=='converted' ? `<button class="btn-icon" data-action="convert-quote-to-invoice" data-id="${q.id}" title="${en?'Convert to Invoice':'Tukar kepada Invois'}">${ICONS.pos}</button>` : ''}
                <button class="btn-icon" data-action="print-quotation" data-id="${q.id}" title="${en?'Print':'Cetak'}">${ICONS.printer}</button>
                <button class="btn-icon" data-action="delete-quotation" data-id="${q.id}" title="${en?'Delete quotation':'Padam sebut harga'}">${ICONS.trash}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${total > list.length ? `<div style="text-align:center;margin-top:18px;"><button class="btn btn-outline" data-action="load-more-finance">${en?'Load More':'Muat Lagi'} (${list.length}/${total})</button></div>` : ''}
    </div>`;
  } else if(tab==='invoices'){
    let list = [...db.invoices].filter(inv=>{
      if(statusFilter==='all') return true;
      const due = invoiceBalanceDue(inv);
      return statusFilter==='balance' ? due>0.004 : due<=0.004;
    }).filter(inv=>withinDateRangeFilter(inv.createdAt, state.financeDateFilter));
    list.sort((a,b)=>b.createdAt-a.createdAt);
    const total = list.length;
    list = list.slice(0, shown);
    bodyHTML = total===0 ? emptyState(en?'No invoices found.':'Tiada invois ditemui.') : `
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>${tt('No. Invois')}</th><th>${tt('Pelanggan')}</th><th>${tt('Tarikh')}</th><th>${tt('Bayaran')}</th><th>${tt('Jumlah')}</th><th>${en?'Balance':'Baki'}</th><th></th></tr></thead>
        <tbody>
          ${list.map(inv=>{
            const c = getCustomer(inv.customerId);
            if(inv.draft){
              // Auto-created empty when a job was sent to POS (see
              // job-to-pos in event-handlers.js) and never finished --
              // none of the normal invoice actions (settle balance,
              // credit note, print, share) make sense on an empty RM0
              // draft, so this row gets its own pair of actions instead:
              // pick the cart back up where it was left, or drop it.
              return `<tr>
                <td style="font-family:'IBM Plex Mono',monospace;">${inv.invoiceNo}</td>
                <td>${c?esc(c.name):tt('Walk-in')}</td>
                <td>${fmtDateTime(inv.createdAt)}</td>
                <td colspan="3"><span class="pill pill-wait">${en?'Draft — not finished':'Draf — belum siap'}</span></td>
                <td style="white-space:nowrap;">
                  <button class="btn-icon" data-action="resume-draft-invoice" data-id="${inv.id}" title="${en?'Resume':'Sambung'}">${ICONS.edit}</button>
                  <button class="btn-icon" data-action="delete-draft-invoice" data-id="${inv.id}" title="${en?'Discard draft':'Buang draf'}">${ICONS.trash}</button>
                </td>
              </tr>`;
            }
            const waText = encodeURIComponent(`Salam ${c?c.name:''}, berikut invois ${inv.invoiceNo} bernilai ${fmtRM(inv.total)} daripada ${db.settings.shopName}. Terima kasih!`);
            const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
            const balanceDue = invoiceBalanceDue(inv);
            return `<tr>
              <td style="font-family:'IBM Plex Mono',monospace;">${inv.invoiceNo}</td>
              <td>${c?esc(c.name):tt('Walk-in')}</td>
              <td>${fmtDateTime(inv.createdAt)}</td>
              <td>${inv.payment}</td>
              <td style="color:var(--accent);font-weight:600;">${fmtRM(inv.total)}</td>
              <td>${balanceDue>0.004 ? `<span class="pill pill-low">${fmtRM(balanceDue)}</span>` : `<span class="pill pill-done">${en?'Paid':'Selesai'}</span>`}</td>
              <td style="white-space:nowrap;">
                ${balanceDue>0.004 ? `<button class="btn-icon" data-action="settle-invoice-balance" data-id="${inv.id}" title="${en?'Record balance payment':'Rekod bayaran baki'}">${ICONS.wallet}</button>` : ''}
                ${!db.settings.simpleMode ? `<button class="btn-icon" data-action="open-credit-note" data-id="${inv.id}" title="${en?'Issue Credit Note':'Keluarkan Nota Kredit'}">${ICONS.repeat}</button>` : ''}
                <button class="btn-icon" data-action="print-invoice" data-id="${inv.id}" title="${en?'Print invoice':'Cetak invois'}">${ICONS.printer}</button>
                <button class="btn-icon" data-action="share-invoice-receipt" data-id="${inv.id}" title="${en?'Share receipt link':'Kongsi pautan resit'}">${ICONS.share||ICONS.whatsapp}</button>
                ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="${en?'Send via WhatsApp':'Hantar via WhatsApp'}" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${total > list.length ? `<div style="text-align:center;margin-top:18px;"><button class="btn btn-outline" data-action="load-more-finance">${en?'Load More':'Muat Lagi'} (${list.length}/${total})</button></div>` : ''}
    </div>`;
  } else { // po
    const lowCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;
    let list = [...db.purchaseOrders].filter(po=>statusFilter==='all'||po.status===statusFilter).filter(po=>withinDateRangeFilter(po.createdAt, state.financeDateFilter));
    list.sort((a,b)=>b.createdAt-a.createdAt);
    const total = list.length;
    list = list.slice(0, shown);
    bodyHTML = `
    ${lowCount>0 ? `<div class="panel" style="margin-bottom:16px;background:rgba(242,167,59,.1);border-color:var(--accent);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="font-size:13px;">${ICONS.alert} ${lowCount} ${tt('item stok rendah — jana pesanan belian automatik?')}</div>
        <button class="btn btn-outline btn-sm" data-action="auto-po">${tt('Jana Pesanan Auto')}</button>
      </div>
    </div>` : ''}
    ${total===0 ? emptyState(tt('Tiada pesanan belian.')) : `
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>${tt('No. PO')}</th><th>${tt('Pembekal')}</th><th>${tt('Item')}</th><th>${tt('Jumlah')}</th><th>${tt('Status')}</th><th></th></tr></thead>
        <tbody>
          ${list.map(po=>{
            const sup = db.suppliers.find(s=>s.id===po.supplierId);
            const totalRM = po.items.reduce((s,i)=>s+i.cost*i.qty,0);
            const poLines = po.items.map(i=>`- ${i.name} x${i.qty} (${fmtRM(i.cost)}/unit)`).join('\n');
            const poMsg = `Salam ${sup?sup.name:''}, berikut Pesanan Belian ${po.poNo} daripada ${db.settings.shopName}:\n\n${poLines}\n\nJumlah: ${fmtRM(totalRM)}\n\nSila sahkan penerimaan pesanan ini. Terima kasih!`;
            const waHref = sup && sup.phone ? `https://wa.me/${normalizePhone(sup.phone)}?text=${encodeURIComponent(poMsg)}` : null;
            const mailHref = sup && sup.email ? `mailto:${encodeURIComponent(sup.email)}?subject=${encodeURIComponent('Pesanan Belian '+po.poNo+' — '+db.settings.shopName)}&body=${encodeURIComponent(poMsg)}` : null;
            return `<tr>
              <td style="font-family:'IBM Plex Mono',monospace;">${po.poNo}</td>
              <td>${sup?sup.name:'-'}</td>
              <td style="font-size:12px;color:var(--text-muted);">${po.items.map(i=>esc(i.name)+' ×'+i.qty).join(', ')}</td>
              <td style="color:var(--accent);font-weight:600;">${fmtRM(totalRM)}</td>
              <td><span class="pill ${po.status==='received'?'pill-done':po.status==='partial'?'pill-progress':'pill-wait'}">${po.status==='received'?tt('Diterima'):po.status==='partial'?(en?'Partially Received':'Diterima Sebahagian'):tt('Belum Diterima')}</span></td>
              <td style="white-space:nowrap;">
                ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="${en?'Send PO via WhatsApp':'Hantar PO via WhatsApp'}" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}
                ${mailHref ? `<a class="btn-icon" href="${mailHref}" title="${en?'Send PO via Email':'Hantar PO via E-mel'}" style="display:inline-flex;">${ICONS.mail}</a>` : ''}
                ${po.status!=='received' ? `<button class="btn-icon" data-action="open-receive-po" data-id="${po.id}" title="${en?'Receive stock (full or partial)':'Terima stok (penuh atau sebahagian)'}">${ICONS.download}</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${total > list.length ? `<div style="text-align:center;margin-top:18px;"><button class="btn btn-outline" data-action="load-more-finance">${en?'Load More':'Muat Lagi'} (${list.length}/${total})</button></div>` : ''}
    </div>`}
    `;
  }

  return `
  <div class="section-head">
    <div><div class="sub">${en?'Quotations, invoices, and purchase orders in one place':'Sebut harga, invois, dan pesanan belian di satu tempat'}</div></div>
    ${tab==='po' ? `<button class="btn btn-primary" data-action="new-po">${ICONS.plus} ${tt('Pesanan Baharu')}</button>` : ''}
  </div>
  ${tabsHTML}
  ${bodyHTML}
  `;
}
