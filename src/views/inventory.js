/* ============================= INVENTORY VIEW ============================= */
function viewInventory(){
  const tab = state.invMainTab || 'items';
  let items = [...db.inventory];
  if(state.invTab==='low') items = items.filter(i=>i.qty<=i.lowStock);
  const q = (state.inventorySearch||'').toLowerCase();
  if(q) items = items.filter(i=>i.name.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q));
  items.sort((a,b)=>a.name.localeCompare(b.name));
  const lowCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;
  const totalItems = items.length;
  const shownItems = items.slice(0, state.inventoryShowCount||30);

  const itemsTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Urus stok alat ganti & bekalan bengkel')}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <label class="btn btn-outline" style="cursor:pointer;">
        ${ICONS.upload} ${state.language==='en'?'Import CSV':'Import CSV'}
        <input type="file" id="inventory-csv-input" accept=".csv" style="display:none;">
      </label>
      <button class="btn btn-primary" data-action="new-item">${ICONS.plus} ${tt('Item Baharu')}</button>
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px;">${state.language==='en'
    ? 'CSV columns: name, part_number (SKU), qty, cost, price, low_stock. Existing items are matched by part number and updated; new part numbers are added.'
    : 'Lajur CSV: name, part_number (SKU), qty, cost, price, low_stock. Item sedia ada dipadan ikut part number dan dikemaskini; part number baharu ditambah.'}</div>
  <div class="tabs">
    <div class="tab-btn ${state.invTab==='semua'?'active':''}" data-invtab="semua">${tt('Semua')} (${db.inventory.length})</div>
    <div class="tab-btn ${state.invTab==='low'?'active':''}" data-invtab="low">${tt('Stok Rendah')} (${lowCount})</div>
  </div>
  <div class="search-box" style="max-width:340px;">${ICONS.search}<input id="inventory-search" placeholder="${state.language==='en'?'Search name or SKU...':'Cari nama atau SKU...'}" value="${esc(state.inventorySearch||'')}"></div>
  <div class="panel">
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Nama Item')}</th><th>${tt('SKU')}</th><th>${tt('Kuantiti')}</th><th>${tt('Kos')}</th><th>${tt('Harga Jual')}</th><th>${tt('Pembekal')}</th><th>${tt('Status')}</th><th></th></tr></thead>
      <tbody>
        ${shownItems.length===0 ? `<tr><td colspan="8">${emptyState(tt('Tiada item.'))}</td></tr>` : shownItems.map(i=>{
          const sup = db.suppliers.find(s=>s.id===i.supplierId);
          return `<tr>
            <td style="font-weight:600;">${esc(i.name)}</td>
            <td style="font-family:'IBM Plex Mono',monospace;color:var(--text-muted);">${esc(i.sku)}</td>
            <td>${i.qty}</td>
            <td>${fmtRM(i.cost)}</td>
            <td style="color:var(--accent);font-weight:600;">${fmtRM(i.price)}</td>
            <td style="color:var(--text-muted);font-size:12px;">${sup?sup.name:'-'}</td>
            <td>${i.qty<=i.lowStock ? `<span class="pill pill-low">${tt('Rendah')}</span>` : `<span class="pill pill-done">${tt('OK')}</span>`}</td>
            <td>
              <button class="btn-icon" data-action="edit-item" data-id="${i.id}" title="${state.language==='en'?'Edit item':'Sunting item'}">${ICONS.edit}</button>
              <button class="btn-icon" data-action="delete-item" data-id="${i.id}" title="${state.language==='en'?'Delete item':'Padam item'}">${ICONS.trash}</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${totalItems > shownItems.length ? `<div style="text-align:center;margin-top:18px;">
      <button class="btn btn-outline" data-action="load-more-inventory">${state.language==='en'?'Load More':'Muat Lagi'} (${shownItems.length}/${totalItems})</button>
    </div>` : ''}
  </div>`;

  const suppliersTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Senarai pembekal alat ganti bengkel')}</div></div>
    <button class="btn btn-primary" data-action="new-supplier">${ICONS.plus} ${tt('Pembekal Baharu')}</button>
  </div>
  ${db.suppliers.length===0 ? emptyState(tt('Tiada pembekal direkod.')) : `
  <div class="grid grid-3">
    ${db.suppliers.map(s=>{
      const itemCount = db.inventory.filter(i=>i.supplierId===s.id).length;
      return `<div class="panel">
        <h2>${esc(s.name)}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:2px;">📞 ${esc(s.phone||'-')}</div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px;">${ICONS.mail} ${esc(s.email||'-')}</div>
        <div style="font-size:12px;color:var(--text-muted);">${itemCount} ${tt('item dibekalkan')}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-outline btn-sm" style="flex:1;" data-action="edit-supplier" data-id="${s.id}">${ICONS.edit} ${t('btn_edit')}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-supplier" data-id="${s.id}">${ICONS.trash}</button>
        </div>
      </div>`;
    }).join('')}
  </div>`}
  `;

  const requisitionTabHTML = `
  <div class="section-head">
    <div><div class="sub">${state.language==='en'?'All low-stock parts in one place, grouped by supplier, with a suggested reorder quantity for each.':'Semua alat ganti stok rendah di satu tempat, ikut pembekal, dengan cadangan kuantiti pesanan semula.'}</div></div>
  </div>
  ${(()=>{
    const lowItems = db.inventory.filter(i=>i.qty<=i.lowStock);
    if(lowItems.length===0) return emptyState(state.language==='en'?'Nothing needs reordering right now.':'Tiada apa perlu dipesan semula buat masa ini.');
    const bySupplier = {};
    lowItems.forEach(i=>{
      const key = i.supplierId || 'none';
      if(!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(i);
    });
    return Object.entries(bySupplier).map(([supplierId, items])=>{
      const sup = supplierId!=='none' ? db.suppliers.find(s=>s.id===supplierId) : null;
      return `<div class="panel" style="margin-bottom:16px;">
        <h2>${ICONS.staff} ${sup?esc(sup.name):(state.language==='en'?'No Supplier Set':'Tiada Pembekal')} <span class="tag">${items.length}</span></h2>
        <div class="table-wrap"><table>
          <thead><tr><th>${tt('Item')}</th><th>${tt('Baki')||'Baki'}</th><th>${state.language==='en'?'Suggested Qty':'Cadangan Kuantiti'}</th></tr></thead>
          <tbody>
            ${items.map(i=>{
              const suggestedQty = Math.max(i.lowStock*2 - i.qty, i.lowStock);
              return `<tr><td style="font-weight:600;">${esc(i.name)}</td><td><span class="pill pill-low">${i.qty}</span></td><td>${suggestedQty}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>
        <button class="btn btn-primary btn-sm" style="margin-top:10px;" data-action="create-po-for-supplier" data-supplier="${supplierId}">${ICONS.plus} ${state.language==='en'?'Create Purchase Order':'Jana Pesanan Belian'}</button>
      </div>`;
    }).join('');
  })()}
  `;

  const packagesTabHTML = `
  <div class="section-head">
    <div><div class="sub">${state.language==='en'?'Bundle several items/services into one special-priced package, sold as a single line in POS.':'Gabungkan beberapa item/servis menjadi satu pakej harga istimewa, dijual sebagai satu baris dalam POS.'}</div></div>
    <button class="btn btn-primary" data-action="new-package">${ICONS.plus} ${state.language==='en'?'New Package':'Pakej Baharu'}</button>
  </div>
  ${(db.packages||[]).length===0 ? emptyState(state.language==='en'?'No packages yet.':'Belum ada pakej.') : `
  <div class="grid grid-3">
    ${db.packages.map(pkg=>{
      const componentTotal = pkg.items.reduce((s,pi)=>{ const it=getItem(pi.refId); return s+(it?it.price*pi.qty:0); },0);
      const savings = componentTotal - pkg.price;
      return `<div class="panel">
        <h2 style="flex-wrap:wrap;"><span style="flex:1;min-width:100px;">${esc(pkg.name)}</span>${!pkg.active ? `<span class="pill" style="background:var(--border);color:var(--text-muted);">${state.language==='en'?'Inactive':'Tidak Aktif'}</span>` : ''}</h2>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">${pkg.items.map(pi=>{ const it=getItem(pi.refId); return it?esc(it.name)+' ×'+pi.qty:''; }).filter(Boolean).join(', ')}</div>
        <div style="font-weight:700;color:var(--accent);font-size:18px;">${fmtRM(pkg.price)}</div>
        ${savings>0 ? `<div style="font-size:11.5px;color:var(--success);">${state.language==='en'?'Save':'Jimat'} ${fmtRM(savings)} ${state.language==='en'?'vs individual prices':'berbanding harga berasingan'}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-outline btn-sm" style="flex:1;" data-action="edit-package" data-id="${pkg.id}">${ICONS.edit} ${t('btn_edit')}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-package" data-id="${pkg.id}">${ICONS.trash}</button>
        </div>
      </div>`;
    }).join('')}
  </div>`}
  `;

  return `
  ${db.settings.simpleMode ? '' : `
  <div class="tabs tabs-primary">
    <div class="tab-btn ${tab==='items'?'active':''}" data-invmaintab="items">${ICONS.inventory} ${tt('Item')}</div>
    <div class="tab-btn ${tab==='suppliers'?'active':''}" data-invmaintab="suppliers">${ICONS.staff} ${tt('Pembekal')}</div>
    <div class="tab-btn ${tab==='packages'?'active':''}" data-invmaintab="packages">${ICONS.wallet} ${state.language==='en'?'Packages':'Pakej'}</div>
    <div class="tab-btn ${tab==='requisition'?'active':''}" data-invmaintab="requisition">${ICONS.alert} ${state.language==='en'?'Reorder Suggestions':'Cadangan Pesanan Semula'}${lowCount>0?` <span class="nav-badge" style="background:var(--danger);color:#fff;">${lowCount}</span>`:''}</div>
  </div>`}
  ${db.settings.simpleMode ? itemsTabHTML : (tab==='items' ? itemsTabHTML : tab==='suppliers' ? suppliersTabHTML : tab==='packages' ? packagesTabHTML : requisitionTabHTML)}
  `;
}

function itemModalHTML(item){
  const isEdit = !!item;
  item = item || {name:'',sku:'',qty:0,cost:0,price:0,lowStock:5,supplierId:''};
  return `
    <h2>${isEdit?(state.language==='en'?'Update Item':'Kemaskini Item'):tt('Item Baharu')}</h2>
    <div class="field"><label>${tt('Nama Item')}</label><input id="it-name" value="${esc(item.name)}" placeholder="Cth: Minyak Enjin 5W-30"></div>
    <div class="field-row">
      <div class="field"><label>${state.language==='en'?'SKU Code':'Kod SKU'}</label><input id="it-sku" value="${esc(item.sku)}" placeholder="OIL-5W30"></div>
      <div class="field"><label>${tt('Kuantiti')}</label><input id="it-qty" type="number" value="${item.qty}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>${state.language==='en'?'Cost Price (RM)':'Harga Kos (RM)'}</label><input id="it-cost" type="number" step="0.01" value="${item.cost}"></div>
      <div class="field"><label>${state.language==='en'?'Sell Price (RM)':'Harga Jual (RM)'}</label><input id="it-price" type="number" step="0.01" value="${item.price}"></div>
    </div>
    <div class="field"><label>${state.language==='en'?'Low Stock Alert (qty)':'Amaran Stok Rendah (kuantiti)'}</label><input id="it-low" type="number" value="${item.lowStock}"></div>
    <div class="field"><label>${state.language==='en'?'Warranty Period (months, 0 if none)':'Tempoh Waranti (bulan, 0 jika tiada)'}</label><input id="it-warranty" type="number" min="0" value="${item.warrantyMonths||0}"></div>
    <div class="field"><label>${tt('Pembekal')}</label>
      <select id="it-supplier">
        <option value="">— ${tt('Tiada')} —</option>
        ${db.suppliers.map(s=>`<option value="${s.id}" ${item.supplierId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-item" data-id="${item.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

function packageModalHTML(pkg){
  const isEdit = !!pkg;
  const en = state.language==='en';
  pkg = pkg || {name:'', items:[], price:0, active:true};
  const itemsText = pkg.items.map(pi=>{ const it=getItem(pi.refId); return it ? `${it.name}:${pi.qty}` : ''; }).filter(Boolean).join('\n');
  return `
    <h2>${isEdit ? (en?'Edit Package':'Sunting Pakej') : (en?'New Package':'Pakej Baharu')}</h2>
    <div class="field"><label>${en?'Package Name':'Nama Pakej'}</label><input id="pkg-name" value="${esc(pkg.name)}" placeholder="${en?'e.g. Basic Service Package':'cth: Pakej Servis Asas'}"></div>
    <div class="field"><label>${en?'Component Items (item name:qty, one per line — must match existing inventory item names)':'Item Komponen (nama item:kuantiti, satu setiap baris — mesti sepadan nama item inventori sedia ada)'}</label>
      <textarea id="pkg-items" rows="4" placeholder="Minyak Enjin 5W-30:1&#10;Penapis Minyak:1">${esc(itemsText)}</textarea>
    </div>
    <div class="field"><label>${en?'Package Price (RM)':'Harga Pakej (RM)'}</label><input id="pkg-price" type="number" step="0.01" min="0" value="${pkg.price}"></div>
    <div class="field" style="display:flex;align-items:center;justify-content:space-between;background:var(--panel-alt);padding:12px;border-radius:8px;">
      <label style="margin-bottom:0;">${en?'Active (visible in POS)':'Aktif (kelihatan dalam POS)'}</label>
      <input type="checkbox" id="pkg-active" ${pkg.active!==false?'checked':''} style="width:18px;height:18px;">
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-package" data-id="${pkg.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

function supplierModalHTML(supplier){
  const isEdit = !!supplier;
  const en = state.language==='en';
  supplier = supplier || {name:'', phone:'', email:''};
  return `
    <h2>${isEdit ? (en?'Edit Supplier':'Sunting Pembekal') : tt('Pembekal Baharu')}</h2>
    <div class="field"><label>${en?'Supplier Name':'Nama Pembekal'}</label><input id="sup-name" value="${esc(supplier.name)}" placeholder="Cth: Auto Parts Sdn Bhd"></div>
    <div class="field"><label>${en?'Phone No.':'No. Telefon'}</label><input id="sup-phone" value="${esc(supplier.phone||'')}" placeholder="012-3456789"></div>
    <div class="field"><label>${en?'Email (optional — to send POs)':'E-mel (pilihan — untuk hantar PO)'}</label><input id="sup-email" type="email" value="${esc(supplier.email||'')}" placeholder="pembekal@contoh.com"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-supplier" data-id="${supplier.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

function poModalHTML(){
  return `
    <h2>${tt('Pesanan Belian Baharu')||'Pesanan Belian Baharu'}</h2>
    <div class="field"><label>${tt('Pembekal')}</label>
      <select id="po-supplier">
        <option value="">— ${state.language==='en'?'Select Supplier':'Pilih Pembekal'} —</option>
        ${db.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${state.language==='en'?'Items (name:qty:cost, one per line)':'Item (nama:kuantiti:kos, satu setiap baris)'}</label>
      <textarea id="po-items" rows="4" placeholder="Minyak Enjin 5W-30:10:38&#10;Penapis Minyak:20:8"></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-po">${state.language==='en'?'Save Order':'Simpan Pesanan'}</button>
    </div>
  `;
}

function receivePoModalHTML(po){
  const en = state.language==='en';
  return `
    <h2>${en?'Receive Stock':'Terima Stok'} — ${po.poNo}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Enter how many of each item arrived. You can receive a partial delivery now and the rest later.':'Masukkan kuantiti setiap item yang tiba. Anda boleh terima sebahagian sekarang dan baki kemudian.'}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Item')}</th><th>${en?'Ordered':'Ditempah'}</th><th>${en?'Received So Far':'Diterima Setakat Ini'}</th><th>${en?'Receive Now':'Terima Sekarang'}</th></tr></thead>
      <tbody>
        ${po.items.map((i,idx)=>{
          const received = i.receivedQty||0;
          const outstanding = Math.max(0, i.qty-received);
          return `<tr>
            <td style="font-weight:600;">${esc(i.name)}</td>
            <td>${i.qty}</td>
            <td>${received}</td>
            <td><input type="number" min="0" max="${outstanding}" value="${outstanding}" data-po-receive-idx="${idx}" style="max-width:90px;"></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="confirm-receive-po" data-id="${po.id}">${en?'Confirm Receipt':'Sahkan Penerimaan'}</button>
    </div>
  `;
}

