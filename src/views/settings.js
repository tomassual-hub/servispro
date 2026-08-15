/* ============================= SETTINGS ============================= */
function viewSettings(){
  const s = db.settings;
  return `
  <div class="grid grid-2" id="settings-view">
    <div class="panel">
      <h2>${ICONS.settings} ${tt('Maklumat Kedai')}</h2>
      <div class="field"><label>${tt('Nama Bengkel')}</label><input id="set-shopname" value="${esc(s.shopName)}" placeholder="${state.language==='en'?'e.g. Ali Motors Workshop':'cth: Bengkel Ali Motors'}"></div>
      <div class="field"><label>${tt('No. Telefon Bengkel')}</label><input id="set-shopphone" value="${esc(s.shopPhone||'')}" placeholder="012-3456789"></div>
      <div class="field"><label>${state.language==='en'?'Country Code (for WhatsApp links)':'Kod Negara (untuk pautan WhatsApp)'}</label>
        <input id="set-countrycode" value="${esc(s.countryCode||'60')}" placeholder="60" maxlength="4">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${state.language==='en'
          ? 'Used when turning a customer/supplier phone number into a WhatsApp link (e.g. 60 for Malaysia). Wrong code = wrong/broken link, with no error shown.'
          : 'Digunakan bila tukar nombor telefon pelanggan/pembekal kepada pautan WhatsApp (cth: 60 untuk Malaysia). Kod salah = pautan salah/rosak, tanpa sebarang ralat dipaparkan.'}</div>
      </div>
      <div class="field"><label>${state.language==='en'?'Business Address':'Alamat Perniagaan'}</label><textarea id="set-shopaddress" rows="2" placeholder="${state.language==='en'?'For printed invoices':'Untuk invois cetak'}">${esc(s.shopAddress||'')}</textarea></div>
      <div class="field"><label>${state.language==='en'?'Vehicle Brands Serviced':'Jenama Kenderaan Diservis'}</label>
        <input id="set-brands" value="${esc((s.servicedBrands||[]).join(', '))}" placeholder="${state.language==='en'?'e.g. Toyota, Honda, Perodua (comma-separated)':'cth: Toyota, Honda, Perodua (pisah dengan koma)'}">
      </div>
      <div class="field-row">
        <div class="field"><label>${state.language==='en'?'SSM Reg. No.':'No. Pendaftaran SSM'}</label><input id="set-shopregno" value="${esc(s.shopRegNo||'')}" placeholder="cth: 202301012345 (678901-A)"></div>
        <div class="field"><label>${state.language==='en'?'SST Reg. No. (if any)':'No. Pendaftaran SST (jika ada)'}</label><input id="set-shopsstno" value="${esc(s.shopSstNo||'')}" placeholder="${state.language==='en'?'Leave blank if not registered':'Kosongkan jika tidak berdaftar'}"></div>
      </div>
      <div class="field"><label>${state.language==='en'?'Tax ID (TIN)':'No. Pengenalan Cukai (TIN)'}</label><input id="set-shoptin" value="${esc(s.shopTin||'')}" placeholder="cth: IG12345678090"></div>
      <div class="field"><label>${tt('Kadar SST (%)')}</label><input id="set-tax" type="number" min="0" step="0.1" value="${s.taxRate||0}"></div>
      <div class="field-row">
        <div class="field"><label>${tt('Diskaun Setia (%)')}</label><input id="set-loyalty-discount" type="number" min="0" value="${s.loyaltyDiscount||10}"></div>
        <div class="field"><label>${tt('Lawatan Layak Diskaun')}</label><input id="set-loyalty-visits" type="number" min="1" value="${s.loyaltyVisits||5}"></div>
      </div>
      <div class="field"><label>${tt('Anggap "Senyap" selepas (hari)')}</label><input id="set-churn-days" type="number" min="1" value="${s.churnDays||180}"></div>
      <div class="field-row">
        <div class="field"><label>${state.language==='en'?'Monthly Sales Target (RM)':'Sasaran Jualan Bulanan (RM)'}</label><input id="set-sales-target" type="number" min="0" step="0.01" value="${s.monthlySalesTarget||0}"></div>
        <div class="field"><label>${state.language==='en'?'Monthly Unit Target':'Sasaran Unit Bulanan'}</label><input id="set-unit-target" type="number" min="0" value="${s.monthlyUnitTarget||0}"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:-8px;margin-bottom:14px;">${state.language==='en'?'Shown as progress on the Dashboard. Leave at 0 to hide.':'Dipaparkan sebagai progres pada Papan Pemuka. Biar 0 untuk sembunyikan.'}</div>
      <div class="field" style="display:flex;align-items:center;justify-content:space-between;background:var(--panel-alt);padding:12px;border-radius:8px;">
        <div>
          <label style="margin-bottom:2px;">${state.language==='en'?'Simple Mode':'Mod Ringkas'}</label>
          <div style="font-size:11.5px;color:var(--text-muted);">${state.language==='en'?'Hides advanced features (appointments, suppliers, purchase orders, P&L, commission, forecasting, packages, split payment, quotations, credit notes, bay management, QR attendance) for a cleaner day-to-day view.':'Sorok ciri lanjutan (tempahan, pembekal, pesanan belian, P&L, komisen, ramalan, pakej, bayaran berbilang, sebut harga, nota kredit, pengurusan bay, kehadiran QR) untuk paparan harian yang lebih ringkas.'}</div>
        </div>
        <input type="checkbox" id="set-simple-mode" ${s.simpleMode?'checked':''} style="width:20px;height:20px;flex-shrink:0;">
      </div>
      <button class="btn btn-primary" data-action="save-settings">${tt('Simpan Tetapan')}</button>

      <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--border);">
        <h2 style="font-size:14px;">${ICONS.calendar} ${tt('Cawangan')}</h2>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
          ${db.branches.map(b=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--panel-alt);border-radius:6px;">
              <span style="font-size:13px;">${esc(b.name)}</span>
              ${db.branches.length>1 ? `<button class="btn-icon" data-action="delete-branch" data-id="${b.id}" title="${state.language==='en'?'Delete branch':'Padam cawangan'}">${ICONS.trash}</button>` : ''}
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <input id="new-branch-name" placeholder="${state.language==='en'?'New branch name':'Nama cawangan baharu'}" style="flex:1;">
          <button class="btn btn-outline btn-sm" data-action="add-branch">${ICONS.plus}</button>
        </div>
      </div>

      <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--border);">
        <h2 style="font-size:14px;">${ICONS.upload} ${state.language==='en'?'Workshop Logo':'Logo Bengkel'}</h2>
        <p style="font-size:11.5px;color:var(--text-muted);margin-top:0;">${state.language==='en'?"Shown next to your workshop's name in the sidebar, in place of the default ServisPro mark.":'Dipaparkan di sebelah nama bengkel anda pada bar sisi, menggantikan tanda ServisPro lalai.'}</p>
        ${s.shopLogo ? `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
          <img src="${s.shopLogo}" alt="${state.language==='en'?'Workshop logo':'Logo bengkel'}" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;border:1px solid var(--border);">
          <button class="btn btn-outline btn-sm" data-action="remove-shop-logo">${ICONS.trash} ${state.language==='en'?'Remove Logo':'Buang Logo'}</button>
        </div>` : ''}
        <input type="file" id="shop-logo-input" accept="image/*" style="padding:8px;">
      </div>

      <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--border);">
        <h2 style="font-size:14px;">${ICONS.barcode} ${tt('Kod QR Bayaran (DuitNow)')}</h2>
        <p style="font-size:11.5px;color:var(--text-muted);margin-top:0;">${tt('Muat naik kod QR DuitNow bengkel anda untuk dipaparkan pada invois cetak, supaya pelanggan boleh imbas terus untuk bayar.')}</p>
        ${s.paymentQR ? `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
          <img src="${s.paymentQR}" alt="DuitNow QR" style="width:88px;height:88px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;border:1px solid var(--border);">
          <button class="btn btn-outline btn-sm" data-action="remove-payment-qr">${ICONS.trash} ${tt('Buang Kod QR')}</button>
        </div>` : ''}
        <input type="file" id="payment-qr-input" accept="image/*" style="padding:8px;">
      </div>
    </div>
    <div class="panel">
      <h2>${ICONS.download} ${tt('Sandaran & Pemulihan Data')}</h2>
      ${(()=>{
        const en = state.language==='en';
        const last = s.lastBackupAt;
        const daysSince = last ? Math.floor((Date.now()-last)/86400000) : null;
        const warn = !last || daysSince>=7;
        const label = !last ? (en?'Never backed up yet.':'Belum pernah disandarkan.')
          : daysSince===0 ? (en?'Last backup: today.':'Sandaran terakhir: hari ini.')
          : (en?`Last backup: ${daysSince} day(s) ago.`:`Sandaran terakhir: ${daysSince} hari lalu.`);
        return `<div style="font-size:12px;margin-bottom:12px;color:${warn?'var(--danger)':'var(--text-muted)'};">${warn?'⚠️ ':''}${label}</div>`;
      })()}
      ${(()=>{
        const sizeMB = JSON.stringify(db).length/1024/1024;
        const pct = Math.min(100, (sizeMB/5*100));
        const en = state.language==='en';
        return `<div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-muted);margin-bottom:4px;">
            <span>${en?'Storage used':'Storan digunakan'}</span>
            <span>${sizeMB.toFixed(2)} MB / ~5 MB</span>
          </div>
          <div class="chart-bar-track" style="height:8px;"><div class="chart-bar-fill" style="width:${pct.toFixed(0)}%;background:${pct>=80?'var(--danger)':'linear-gradient(90deg,var(--accent-2),var(--accent))'};"></div></div>
          ${pct>=80 ? `<div style="font-size:11px;color:var(--danger);margin-top:4px;">${en?'Getting full — consider deleting old job photos or archiving old invoices.':'Hampir penuh — pertimbangkan padam gambar kad kerja lama atau arkibkan invois lama.'}</div>` : ''}
        </div>`;
      })()}
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${tt('Muat turun semua data bengkel (pelanggan, invois, inventori, dll.) sebagai fail sandaran. Simpan secara berkala untuk keselamatan.')}</p>
      <button class="btn btn-outline" style="width:100%;justify-content:center;margin-bottom:10px;" data-action="export-backup">${ICONS.download} ${tt('Muat Turun Sandaran (JSON)')}</button>
      <label style="display:block;">${tt('Pulihkan daripada Fail Sandaran')}</label>
      <input type="file" id="restore-file" accept="application/json" style="padding:8px;">
      <div style="font-size:11.5px;color:var(--danger);margin-top:8px;">⚠️ ${tt('Memulihkan akan menggantikan SEMUA data semasa.')}</div>
      ${canSeeRevenue() ? `
      <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border);">
        <h2 style="font-size:13px;">${ICONS.download} ${state.language==='en'?'Automatic Backups':'Sandaran Automatik'}</h2>
        <p style="font-size:11.5px;color:var(--text-muted);margin-top:0;">${state.language==='en'?'A snapshot is saved to the server automatically (at most every 7 days) whenever an Admin logs in — a recovery point even if nobody remembers to download one.':'Satu salinan disimpan ke pelayan secara automatik (selang 7 hari) setiap kali Admin log masuk — titik pemulihan walaupun tiada siapa ingat untuk muat turun.'}</p>
        ${state.autoBackupsList ? `
          ${state.autoBackupsList.length===0 ? `<div style="font-size:12px;color:var(--text-muted);">${state.language==='en'?'No automatic backups yet.':'Belum ada sandaran automatik.'}</div>` : state.autoBackupsList.map(b=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:6px;">
            <span style="font-size:12.5px;">${fmtDateTime(new Date(b.created_at).getTime())}</span>
            <button class="btn btn-outline btn-sm" data-action="download-auto-backup" data-id="${b.id}">${ICONS.download}</button>
          </div>`).join('')}
        ` : `<button class="btn btn-outline btn-sm" data-action="list-auto-backups">${state.language==='en'?'Show Automatic Backups':'Papar Sandaran Automatik'}</button>`}
      </div>` : ''}
      <div class="panel" style="margin-top:18px;padding:14px;background:var(--panel-alt);">
        <h2 style="font-size:13px;">${ICONS.download} ${tt('Eksport CSV')}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" data-action="export-csv-invoices">${tt('Invois')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-inventory">${tt('Inventori')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-customers">${tt('Pelanggan')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-accounting">${tt('Format Perakaunan')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-payroll">${tt('Gaji')}</button>
        </div>
      </div>
    </div>
  </div>

  ${db.settings.simpleMode ? '' : (()=>{
    const en = state.language==='en';
    const bays = db.bays||[];
    return `
    <div class="panel" style="margin-top:20px;">
      <div class="section-head">
        <div><h2 style="margin:0;">${ICONS.bay} ${en?'Bay Management':'Pengurusan Bay'}</h2>
        <div class="sub">${en?'Track which physical lift/bay each job is parked on (optional).':'Jejak lif/bay fizikal mana setiap kad kerja diletakkan (pilihan).'}</div></div>
        <button class="btn btn-primary" data-action="new-bay">${ICONS.plus} ${en?'New Bay':'Bay Baharu'}</button>
      </div>
      ${bays.length===0 ? emptyState(en?'No bays set up yet.':'Belum ada bay ditetapkan.') : `
      <div class="grid grid-4">
        ${bays.map(b=>{
          const occupied = db.jobs.find(j=>j.bayId===b.id && j.status!=='delivered');
          return `<div class="panel" style="text-align:center;">
            <div style="color:var(--accent);margin-bottom:6px;">${ICONS.bay}</div>
            <div style="font-weight:700;font-size:14px;">${esc(b.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">${esc(b.category||'-')}</div>
            ${occupied ? `<div class="pill pill-wait" style="margin-bottom:8px;">${esc(occupied.jobNo)}</div>` : `<div class="pill ${b.active?'pill-done':''}" style="background:${b.active?'':'var(--border)'};color:${b.active?'':'var(--text-muted)'};margin-bottom:8px;">${b.active?(en?'Active':'Aktif'):(en?'Inactive':'Tidak Aktif')}</div>`}
            <div style="display:flex;gap:6px;justify-content:center;">
              <button class="btn-icon" data-action="toggle-bay-active" data-id="${b.id}" title="${b.active?(en?'Deactivate':'Nyahaktifkan'):(en?'Activate':'Aktifkan')}">${ICONS.done}</button>
              <button class="btn-icon" data-action="edit-bay" data-id="${b.id}" title="${state.language==='en'?'Edit bay':'Sunting bay'}">${ICONS.edit}</button>
              <button class="btn-icon" data-action="delete-bay" data-id="${b.id}" title="${state.language==='en'?'Delete bay':'Padam bay'}">${ICONS.trash}</button>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>`;
  })()}

  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.gauge} ${state.language==='en'?'Waiting Area Display Board':'Papan Paparan Kawasan Menunggu'}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${state.language==='en'?'Launch the TV/tablet board showing active jobs\' status, without logging out first — useful for setting up or previewing the waiting-area screen. It can also still be reached without logging in at all (the login screen\'s own link, or bookmarking this site with ?board=1), which stays the normal way an always-on shop TV loads it.':'Lancarkan papan TV/tablet yang memaparkan status kad kerja aktif, tanpa perlu log keluar dahulu — berguna untuk menyediakan atau pratonton skrin kawasan menunggu. Ia masih boleh diakses tanpa log masuk (pautan pada skrin log masuk, atau bookmark laman ini dengan ?board=1), iaitu cara biasa TV bengkel yang sentiasa hidup memuatkannya.'}</p>
    <button class="btn btn-outline" data-action="open-board-in-app">${ICONS.gauge} ${state.language==='en'?'Open Display Board':'Buka Papan Paparan'}</button>
  </div>

  ${isOwnerLevel(state.currentStaff && state.currentStaff.role) ? dangerZonePanelHTML() : ''}
  `;
}

// Owner-level only (Admin/Pemilik, not Kerani -- see isOwnerLevel() in
// utils.js) -- this is more destructive than anything Kerani can already
// do elsewhere (delete-job/delete-customer etc. all remove ONE record with
// an undo toast; this removes every row across every collection listed
// below at once, with no undo, so it's gated one level stricter). The
// confirm dialog itself requires typing "PADAM" (see askConfirm's
// typedConfirmWord in onboarding-confirm.js) rather than the single-click
// confirm every other delete in this app uses -- a plain confirm has
// already proven too easy to click through for something this size, with
// no per-item undo to fall back on afterward.
// Scope widened from "just jobs/invoices" to also include
// customers/vehicles/quotations/appointments/contracts per the shop's own
// request once they clarified they wanted no orphaned data left behind --
// a quotation/appointment/contract pointing at a deleted customerId would
// otherwise just show blank/"-" everywhere instead of actually being
// gone. Inventory and staff are deliberately still excluded: a shop's
// parts catalog and its own team accounts aren't "test data" in the same
// way even during a development phase, and nothing about wiping
// transactions/customers requires touching either.
function dangerZonePanelHTML(){
  const en = state.language==='en';
  return `
  <div class="panel" style="margin-top:20px;border-color:var(--danger);">
    <h2 style="color:var(--danger);">${ICONS.alert} ${en?'Danger Zone':'Zon Bahaya'}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Permanently wipe this shop\'s customer and transactional history -- useful for clearing test/demo data before going live, or starting a fresh accounting period. Inventory and staff accounts are NOT touched.':'Padam kekal sejarah pelanggan dan transaksi bengkel ini -- berguna untuk bersihkan data ujian/demo sebelum guna sebenar, atau mula tempoh perakaunan baharu. Inventori dan akaun staf TIDAK disentuh.'}</p>
    <div style="background:rgba(225,75,75,.08);border:1px solid var(--danger);border-radius:8px;padding:12px;margin-bottom:14px;">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">${en?'This permanently deletes:':'Ini akan memadam KEKAL:'}</div>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text-muted);line-height:1.7;">
        <li>${en?'All customers':'Semua pelanggan'} (${db.customers.length})</li>
        <li>${en?'All vehicles':'Semua kenderaan'} (${db.vehicles.length})</li>
        <li>${en?'All job cards':'Semua kad kerja'} (${db.jobs.length})</li>
        <li>${en?'All invoices':'Semua invois'} (${db.invoices.length})</li>
        <li>${en?'All credit notes':'Semua nota kredit'} (${db.creditNotes.length})</li>
        <li>${en?'All quotations':'Semua sebut harga'} (${db.quotations.length})</li>
        <li>${en?'All appointments':'Semua tempahan'} (${db.appointments.length})</li>
        <li>${en?'All service contracts':'Semua kontrak servis'} (${db.contracts.length})</li>
        <li>${en?'All daily cash closure records':'Semua rekod tutup tunai harian'} (${db.cashClosures.length})</li>
        <li>${en?'Monthly sales/unit targets (reset to 0)':'Sasaran jualan/unit bulanan (reset kepada 0)'}</li>
      </ul>
    </div>
    <div style="font-size:11.5px;color:var(--danger);margin-bottom:12px;">⚠️ ${en?'Cannot be undone. Download a backup above first if you might need this data again.':'Tidak boleh dibuat asal. Muat turun sandaran di atas dahulu jika mungkin perlukan data ini semula.'}</div>
    <button class="btn btn-danger" style="width:100%;justify-content:center;" data-action="reset-shop-data">${ICONS.trash} ${en?'Reset Customer & Transaction Data':'Reset Data Pelanggan & Transaksi'}</button>
  </div>`;
}

function bayModalHTML(bay){
  const isEdit = !!bay;
  const en = state.language==='en';
  bay = bay || {name:'', category:'', active:true};
  return `
    <h2>${ICONS.bay} ${isEdit ? (en?'Edit Bay':'Sunting Bay') : (en?'New Bay':'Bay Baharu')}</h2>
    <div class="field"><label>${en?'Bay Name':'Nama Bay'}</label><input id="bay-name" value="${esc(bay.name)}" placeholder="${en?'e.g. Bay 1':'cth: Bay 1'}"></div>
    <div class="field"><label>${en?'Category':'Kategori'}</label><input id="bay-category" value="${esc(bay.category||'')}" placeholder="${en?'e.g. General Repair, Body Repair, Paint Booth':'cth: Baik Pulih Umum, Baik Pulih Badan, Bilik Cat'}"></div>
    <div class="field" style="display:flex;align-items:center;justify-content:space-between;background:var(--panel-alt);padding:12px;border-radius:8px;">
      <label style="margin-bottom:0;">${en?'Active':'Aktif'}</label>
      <input type="checkbox" id="bay-active" ${bay.active!==false?'checked':''} style="width:18px;height:18px;">
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-bay" data-id="${bay.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

