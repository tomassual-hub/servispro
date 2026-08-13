/* ============================= JOB TICKET RENDER ============================= */
function renderJobTicket(j){
  const v = getVehicle(j.vehicleId);
  const c = getCustomer(j.customerId);
  const bay = j.bayId ? (db.bays||[]).find(b=>b.id===j.bayId) : null;
  const stripeClass = j.status==='progress'?'st-progress':j.status==='done'?'st-done':j.status==='delivered'?'st-delivered':'';
  const statusLabel = {waiting:tt('Menunggu'), progress:tt('Dalam Proses'), done:tt('Siap'), delivered:tt('Dihantar')}[j.status];
  return `
  <div class="job-ticket" data-job-detail="${j.id}">
    <div class="jt-stripe ${stripeClass}"></div>
    <div class="jt-head">
      <div>
        <div class="jt-num">${j.jobNo} · ${fmtDate(j.createdAt)}${bay?` · ${ICONS.bay} ${esc(bay.name)}`:''}</div>
        <div class="jt-plate">${v?esc(v.plate):'—'}</div>
        <div class="jt-model">${v?esc(v.model):'—'}</div>
      </div>
    </div>
    <div class="jt-desc">${esc(j.description) || tt('Tiada penerangan')}</div>
    <div class="jt-foot">
      <span class="jt-mechanic">👤 ${esc(j.mechanic||'-')} · ${c?esc(c.name):'-'}</span>
      <span class="pill pill-${j.status==='waiting'?'wait':j.status}">${statusLabel}</span>
    </div>
  </div>`;
}

/* ============================= JOBS VIEW ============================= */
function viewJobs(){
  const filters = [
    {k:'semua', l:tt('Semua')}, {k:'waiting', l:tt('Menunggu')}, {k:'progress', l:tt('Dalam Proses')},
    {k:'done', l:tt('Siap')}, {k:'delivered', l:tt('Dihantar')}
  ];
  const isAdmin = canSeeRevenue();
  let jobs = [...db.jobs].sort((a,b)=>b.createdAt-a.createdAt);
  if(state.currentBranch!=='all'){
    jobs = jobs.filter(j=>j.branchId===state.currentBranch || (!j.branchId && state.currentBranch==='main'));
  }
  if(!isAdmin && state.currentStaff){
    jobs = jobs.filter(j=>j.mechanic===state.currentStaff.name || !j.mechanic);
  }
  // Counted against the branch/mechanic-scoped list (before the status
  // filter itself is applied) so every tab's own count stays accurate
  // regardless of which status is currently selected.
  const filterCounts = {semua: jobs.length};
  for(const f of filters) if(f.k!=='semua') filterCounts[f.k] = jobs.filter(j=>j.status===f.k).length;
  if(state.jobFilter!=='semua') jobs = jobs.filter(j=>j.status===state.jobFilter);
  const totalJobs = jobs.length;
  const shown = jobs.slice(0, state.jobsShowCount||30);

  return `
  <div class="section-head">
    <div><div class="sub">${isAdmin ? tt('Urus tiket kerja servis seperti bengkel sebenar') : tt('Kad kerja ditugaskan kepada anda')}</div></div>
    <button class="btn btn-primary" data-action="new-job">${ICONS.plus} ${tt('Kad Kerja Baharu')}</button>
  </div>
  <div class="tabs tabs-primary">
    ${filters.map(f=>`<div class="tab-btn ${state.jobFilter===f.k?'active':''}" data-jobfilter="${f.k}">${f.l} (${filterCounts[f.k]})</div>`).join('')}
  </div>
  ${shown.length===0 ? emptyState(tt('Tiada kad kerja untuk penapis ini.')) : `<div class="tickets">${shown.map(renderJobTicket).join('')}</div>`}
  ${totalJobs > shown.length ? `<div style="text-align:center;margin-top:18px;">
    <button class="btn btn-outline" data-action="load-more-jobs">${state.language==='en'?'Load More':'Muat Lagi'} (${shown.length}/${totalJobs})</button>
  </div>` : ''}
  `;
}

const INSPECTION_ITEMS = [
  'Minyak Enjin', 'Penapis Udara', 'Penapis Minyak', 'Brek Depan', 'Brek Belakang',
  'Tayar & Tekanan Angin', 'Bateri', 'Wiper & Cecair Pembasuh', 'Lampu Depan/Belakang',
  'Talian Kipas & Belt', 'Sistem Ekzos', 'Cecair Radiator/Coolant', 'Suspensi',
  'Minyak Brek', 'Minyak Gear/Transmisi', 'Air Conditioner (Aircond)'
];

function inspectionModalHTML(job){
  const insp = job.inspection || {};
  const marks = job.diagramMarks || [];
  const en = state.language==='en';
  const statusLabel = {ok:tt('OK'), attention:en?'Needs Attention':'Perlu Perhatian', replace:en?'Needs Replacement':'Perlu Tukar'};
  const statusClass = {ok:'pill-done', attention:'pill-wait', replace:'pill-low'};
  const markColor = {ok:'var(--success)', attention:'#d99a2b', replace:'var(--danger)'};
  const c = getCustomer(job.customerId);
  const hasFindings = Object.keys(insp).length>0 || marks.length>0 || (job.photos||[]).length>0;
  const ai = state.aiSuggestion;
  const suggestedItems = (ai && typeof ai==='object') ? ai.suggestedItems : [];
  return `
    <h2>${ICONS.done||'✓'} ${en?'Inspection Checklist':'Senarai Semak Pemeriksaan'} — ${job.jobNo}</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Click each item to cycle status: Not Checked → OK → Needs Attention → Needs Replacement':'Klik setiap item untuk tukar status: Belum Semak → OK → Perlu Perhatian → Perlu Tukar'}</p>
    <div style="margin-bottom:12px;">
      ${!ai ? `
      <button class="btn btn-outline btn-sm" data-action="ai-suggest-checklist" data-id="${job.id}" ${(job.description||'').trim()?'':'disabled'}>${ICONS.sparkle} ${en?'AI Suggestion (where to check first)':'Cadangan AI (mula semak di mana)'}</button>
      ${!(job.description||'').trim() ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${en?'Add a job description first.':'Tambah penerangan kerja dahulu.'}</div>` : ''}
      ` : ai==='loading' ? `
      <div style="font-size:12.5px;color:var(--text-muted);">${en?'Asking AI…':'Bertanya AI…'}</div>
      ` : ai==='unavailable' ? `
      <div style="font-size:12px;color:var(--text-muted);">${en?'AI suggestion isn\'t available right now.':'Cadangan AI tidak tersedia buat masa ini.'}</div>
      ` : ai==='rate_limited' ? `
      <div style="font-size:12px;color:var(--text-muted);">${en?'AI is busy right now. Try again shortly.':'AI sedang sibuk buat masa ini. Cuba sebentar lagi.'}</div>
      ` : `
      <div class="panel" style="background:var(--accent-soft);border-color:var(--accent);padding:12px;">
        <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px;">${ICONS.sparkle} ${en?'AI suggestion — a starting point, not a diagnosis':'Cadangan AI — titik permulaan, bukan diagnosis'}</div>
        ${ai.likelyCauses.length ? `<div style="font-size:12.5px;margin-bottom:6px;"><strong>${en?'Possible causes:':'Kemungkinan punca:'}</strong> ${ai.likelyCauses.map(x=>esc(x)).join(', ')}</div>` : ''}
        ${ai.suggestedItems.length ? `<div style="font-size:12.5px;">${en?'Suggested items to check first are highlighted below.':'Item dicadangkan untuk disemak dahulu ditanda di bawah.'}</div>` : `<div style="font-size:12.5px;color:var(--text-muted);">${en?'No specific checklist items stood out — check the usual items.':'Tiada item senarai semak yang menonjol — semak item biasa.'}</div>`}
      </div>
      `}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
      ${INSPECTION_ITEMS.map(name=>{
        const st = insp[name];
        const suggested = suggestedItems.includes(name);
        return `<div class="clickable" data-inspect-item="${name}" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--panel-alt);border-radius:6px;${suggested?'border:1.5px solid var(--accent);':''}">
          <span style="font-size:13px;">${suggested?(ICONS.sparkle)+' ':''}${tt(name)}</span>
          ${st ? `<span class="pill ${statusClass[st]}">${statusLabel[st]}</span>` : `<span class="pill" style="background:var(--border);color:var(--text-muted);">${en?'Not Checked':'Belum Semak'}</span>`}
        </div>`;
      }).join('')}
    </div>

    <div class="field" style="margin-top:16px;">
      <label>${en?'Damage Diagram':'Diagram Kerosakan'}</label>
      <div id="diagram-wrap" style="position:relative;width:100%;max-width:220px;margin:0 auto;background:var(--panel-alt);border-radius:10px;border:1px solid var(--border);padding:10px 0;cursor:crosshair;user-select:none;">
        <svg viewBox="0 0 200 380" style="width:100%;display:block;pointer-events:none;">
          <rect x="30" y="20" width="140" height="340" rx="28" fill="none" stroke="var(--text-muted)" stroke-width="3"/>
          <rect x="45" y="55" width="110" height="55" rx="8" fill="none" stroke="var(--text-muted)" stroke-width="2"/>
          <rect x="45" y="270" width="110" height="55" rx="8" fill="none" stroke="var(--text-muted)" stroke-width="2"/>
          <rect x="14" y="70" width="14" height="45" rx="4" fill="var(--text-muted)"/>
          <rect x="172" y="70" width="14" height="45" rx="4" fill="var(--text-muted)"/>
          <rect x="14" y="265" width="14" height="45" rx="4" fill="var(--text-muted)"/>
          <rect x="172" y="265" width="14" height="45" rx="4" fill="var(--text-muted)"/>
          <circle cx="60" cy="35" r="4" fill="var(--text-muted)"/>
          <circle cx="140" cy="35" r="4" fill="var(--text-muted)"/>
        </svg>
        ${marks.map((m,idx)=>`<div class="clickable" data-diagram-mark-idx="${idx}" title="${esc(m.note||'')}" style="position:absolute;left:${m.x}%;top:${m.y}%;width:20px;height:20px;margin:-10px 0 0 -10px;background:${markColor[m.severity]};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 0 0 2px #fff;">${idx+1}</div>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin:6px 0;text-align:center;">${en?'Click the diagram to add a mark. Click a mark to cycle its severity.':'Klik diagram untuk tambah tanda. Klik tanda untuk tukar tahap keterukan.'}</div>
      ${marks.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
        ${marks.map((m,idx)=>`
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="pill" style="background:${markColor[m.severity]};color:#fff;min-width:20px;text-align:center;padding:2px 6px;">${idx+1}</span>
            <input data-diagram-note-idx="${idx}" value="${esc(m.note||'')}" placeholder="${en?'e.g. Scratch on door':'cth: Calar pada pintu'}" style="flex:1;">
            <button class="btn-icon" data-action="remove-diagram-mark" data-idx="${idx}" title="${state.language==='en'?'Remove mark':'Buang tanda'}">${ICONS.x}</button>
          </div>`).join('')}
      </div>` : ''}
    </div>

    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      ${hasFindings ? `<button class="btn btn-outline" data-action="share-inspection-report" data-id="${job.id}">${ICONS.whatsapp||''} ${en?'Share Report':'Kongsi Laporan'}</button>` : ''}
    </div>
  `;
}

function jobDetailModalHTML(j){
  const v = getVehicle(j.vehicleId); const c = getCustomer(j.customerId);
  const en = state.language==='en';
  const statuses = [
    {k:'waiting', l:tt('Menunggu')}, {k:'progress', l:tt('Dalam Proses')}, {k:'done', l:tt('Siap')}, {k:'delivered', l:tt('Dihantar')}
  ];
  const statusLabel = {waiting:tt('Menunggu'), progress:tt('Dalam Proses'), done:tt('Siap'), delivered:tt('Dihantar')}[j.status];
  const waText = encodeURIComponent(`Salam ${c?c.name:''}, kemas kini untuk kenderaan ${v?v.plate:''} (${j.jobNo}): status kerja kini "${statusLabel}". - ${db.settings.shopName}`);
  const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
  return `
    <h2>${j.jobNo} — ${v?esc(v.plate):'—'}</h2>
    <div class="field"><label>${en?'Customer / Vehicle':'Pelanggan / Kenderaan'}</label>
      <div style="font-size:14px;font-weight:600;">${c?esc(c.name):'—'}</div>
      <div style="font-size:12.5px;color:var(--text-muted);">${v?esc(v.model)+' · '+esc(v.color):'—'}</div>
    </div>
    <div class="field"><label style="display:flex;justify-content:space-between;align-items:center;"><span>${en?'Job Description':'Penerangan Kerja'}</span>${voiceInputBtnHTML('job-desc-edit')}</label><textarea id="job-desc-edit" rows="2">${esc(j.description||'')}</textarea></div>
    <div class="field"><label>${tt('Mekanik')}</label><input id="job-mechanic-edit" value="${esc(j.mechanic||'')}"></div>
    ${!db.settings.simpleMode && (db.bays||[]).length>0 ? `
    <div class="field"><label>${ICONS.bay} ${en?'Bay':'Bay'}</label>
      <select id="job-bay-edit">
        <option value="">— ${en?'Not Assigned':'Belum Ditugaskan'} —</option>
        ${db.bays.filter(b=>b.active || b.id===j.bayId).map(b=>`<option value="${b.id}" ${j.bayId===b.id?'selected':''}>${esc(b.name)}${b.category?' — '+esc(b.category):''}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="field"><label>${en?'Internal Note (not shown to customer)':'Nota Dalaman (tidak dipaparkan kepada pelanggan)'}</label><textarea id="job-note-edit" rows="2" placeholder="${en?'e.g. rear brake pad thin, suggest replacing next service':'Cth: brake pad belakang nipis, cadang tukar servis akan datang'}">${esc(j.internalNote||'')}</textarea></div>
    <div class="field">
      <label>${tt('Status')}</label>
      <select id="job-status-select">
        ${statuses.map(s=>`<option value="${s.k}" ${j.status===s.k?'selected':''}>${s.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${en?'Date Opened':'Tarikh Dibuka'}</label><div style="font-size:12.5px;color:var(--text-muted);">${fmtDateTime(j.createdAt)} ${j.createdBy?(en?'· By: ':'· Oleh: ')+esc(j.createdBy):''}</div></div>
    <div class="field">
      <label>${ICONS.gauge} ${en?'Before/After Photos (max. 4)':'Gambar Sebelum/Selepas (maks. 4)'}</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${(j.photos||[]).map((p,idx)=>`
          <div style="position:relative;">
            <img src="${p}" alt="${en?'Job photo':'Gambar kerja'} ${idx+1}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
            <button class="btn-icon" data-action="remove-photo" data-idx="${idx}" title="${state.language==='en'?'Remove photo':'Buang gambar'}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;padding:0;background:var(--danger);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">${ICONS.x}</button>
          </div>`).join('')}
      </div>
      ${(j.photos||[]).length<4 ? `<input type="file" id="job-photo-input" accept="image/*" style="font-size:12px;">` : `<div style="font-size:11.5px;color:var(--text-muted);">${en?'Limit of 4 photos reached.':'Had 4 gambar dicapai.'}</div>`}
    </div>
    <div class="field">
      <label>${ICONS.edit} ${en?'Customer Signature (at vehicle handover)':'Tandatangan Pelanggan (semasa serah kereta)'}</label>
      ${j.signature ? `
        <img src="${j.signature}" alt="${en?'Customer signature':'Tandatangan pelanggan'}" style="width:100%;max-width:280px;background:#fff;border-radius:6px;border:1px solid var(--border);display:block;">
        <button class="btn btn-outline btn-sm" style="margin-top:6px;" data-action="clear-signature" data-id="${j.id}">${en?'Delete & Sign Again':'Padam & Tandatangan Semula'}</button>
      ` : `
        <canvas id="sig-pad" width="280" height="120" style="background:#fff;border-radius:6px;border:1px solid var(--border);touch-action:none;cursor:crosshair;"></canvas>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="btn btn-outline btn-sm" data-action="clear-sig-pad">${en?'Clear':'Kosongkan'}</button>
          <button class="btn btn-primary btn-sm" data-action="save-signature" data-id="${j.id}">${en?'Save Signature':'Simpan Tandatangan'}</button>
        </div>
      `}
    </div>
    ${waHref ? `<a class="btn btn-outline" style="width:100%;justify-content:center;margin-bottom:6px;" href="${waHref}" target="_blank" rel="noopener">${ICONS.whatsapp} ${en?'Send Update via WhatsApp':'Hantar Kemas Kini via WhatsApp'}</a>` : ''}
    ${j.returnFromJobId ? `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">${en?'Return job from':'Kad kerja pemulangan daripada'} ${db.jobs.find(x=>x.id===j.returnFromJobId)?.jobNo || '-'}</div>` : ''}
    <div class="modal-foot">
      <button class="btn btn-danger" data-action="delete-job" data-id="${j.id}">${ICONS.trash} ${t('btn_delete')}</button>
      <button class="btn btn-outline" data-action="open-inspection" data-id="${j.id}">${ICONS.done||'✓'} ${en?'Checklist':'Senarai Semak'}</button>
      <button class="btn btn-outline" data-action="return-job" data-id="${j.id}" title="${en?'Create a new job card from this one (e.g. warranty comeback)':'Cipta kad kerja baharu daripada ini (cth. kes pemulangan/waranti)'}">${ICONS.repeat} ${en?'Return Job':'Kad Kerja Pemulangan'}</button>
      <button class="btn btn-outline" data-action="print-jobcard" data-id="${j.id}">${ICONS.printer} ${en?'Print Card':'Cetak Kad'}</button>
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      ${!j.invoiced ? `<button class="btn btn-primary" data-action="job-to-pos" data-id="${j.id}">${ICONS.pos} ${en?'Send to POS':'Hantar ke POS'}</button>` : `<span class="pill pill-paid" style="align-self:center;">${en?'Already Invoiced':'Sudah Diinvois'}</span>`}
      <button class="btn btn-primary" data-action="save-job-status" data-id="${j.id}">${t('btn_save')}</button>
    </div>
  `;
}

function newJobModalHTML(){
  return `
    <h2>${tt('Kad Kerja Baharu')}</h2>
    <div class="field"><label>${tt('Pelanggan')}</label>
      <select id="nj-customer">
        <option value="">— ${state.language==='en'?'Select Customer':'Pilih Pelanggan'} —</option>
        ${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)} (${esc(c.phone)})</option>`).join('')}
        <option value="__new__">+ ${tt('Pelanggan Baharu')}</option>
      </select>
    </div>
    <div id="nj-new-customer-fields" style="display:none;">
      <div class="field-row">
        <div class="field"><label>${state.language==='en'?'Customer Name':'Nama Pelanggan'}</label><input id="nj-new-name" placeholder="${state.language==='en'?'e.g. Ahmad Faizal':'Cth: Ahmad Faizal'}"></div>
        <div class="field"><label>${state.language==='en'?'Phone No.':'No. Telefon'}</label><input id="nj-new-phone" placeholder="012-3456789"></div>
      </div>
    </div>
    <div class="field"><label>${tt('Kenderaan')}</label>
      <select id="nj-vehicle"><option value="">— ${state.language==='en'?'Select Customer First':'Pilih Pelanggan Dahulu'} —</option></select>
    </div>
    <div id="nj-new-vehicle-fields" style="display:none;">
      <div class="field-row">
        <div class="field"><label>${state.language==='en'?'Plate No.':'No. Plat'}</label><input id="nj-new-plate" placeholder="WXY 1234"></div>
        <div class="field"><label>${state.language==='en'?'Model / Color':'Model / Warna'}</label><input id="nj-new-model" placeholder="${state.language==='en'?'Perodua Myvi 2019, White':'Perodua Myvi 2019, Putih'}"></div>
      </div>
    </div>
    <div class="field"><label style="display:flex;justify-content:space-between;align-items:center;"><span>${state.language==='en'?'Job Description':'Penerangan Kerja'}</span>${voiceInputBtnHTML('nj-desc')}</label><textarea id="nj-desc" rows="3" placeholder="${state.language==='en'?'e.g. Regular service, engine oil & filter change':'Cth: Servis biasa, tukar minyak enjin & penapis'}"></textarea></div>
    <div class="field"><label>${state.language==='en'?'Assigned Mechanic':'Mekanik Bertugas'}</label><input id="nj-mechanic" placeholder="${state.language==='en'?'e.g. Mr. Razak':'Cth: Encik Razak'}"></div>
    ${!db.settings.simpleMode && (db.bays||[]).length>0 ? `
    <div class="field"><label>${ICONS.bay} ${state.language==='en'?'Bay (optional)':'Bay (pilihan)'}</label>
      <select id="nj-bay">
        <option value="">— ${state.language==='en'?'Not Assigned':'Belum Ditugaskan'} —</option>
        ${db.bays.filter(b=>b.active).map(b=>`<option value="${b.id}">${esc(b.name)}${b.category?' — '+esc(b.category):''}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="create-job">${ICONS.plus} ${state.language==='en'?'Create Job Card':'Cipta Kad Kerja'}</button>
    </div>
  `;
}

