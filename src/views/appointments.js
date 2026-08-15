/* ============================= APPOINTMENTS & CONTRACTS ============================= */
function viewAppointments(){
  // Contract cycle totals are a revenue figure -- same Admin-only gating as
  // the dashboard/POS sales figures (see viewDashboard/viewPOS).
  const isAdmin = canSeeRevenue();
  const statusLabel = {scheduled:tt('Dijadualkan'), done:tt('Selesai')||'Selesai', cancelled:tt('Dibatalkan')};
  const appts = [...db.appointments].sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
  const now = Date.now();

  const apptTabHTML = `
    <div class="section-head">
      <div><div class="sub">${tt('Jadual janji temu servis pelanggan')}</div></div>
      <button class="btn btn-primary" data-action="new-appointment">${ICONS.plus} ${tt('Tempahan Baharu')}</button>
    </div>
    ${appts.length===0 ? emptyState(tt('Tiada tempahan dijadualkan.')) : `
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>${state.language==='en'?'Date & Time':'Tarikh & Masa'}</th><th>${tt('Pelanggan')}</th><th>${tt('Kenderaan')}</th><th>${tt('Nota')}</th><th>${tt('Status')}</th><th></th></tr></thead>
        <tbody>
          ${appts.map(a=>{
            const c = getCustomer(a.customerId); const v = getVehicle(a.vehicleId);
            const waText = encodeURIComponent(`Salam ${c?c.name:''}, ini peringatan tempahan servis kenderaan ${v?v.plate:''} pada ${a.date} jam ${a.time} di ${db.settings.shopName}. Sila hubungi kami jika perlu tukar masa. Terima kasih!`);
            const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
            return `<tr>
              <td style="font-family:'IBM Plex Mono',monospace;">${a.date} · ${a.time}</td>
              <td>${c?esc(c.name):'-'}</td>
              <td>${v?esc(v.plate):'-'}</td>
              <td style="max-width:200px;">${esc(a.notes||'-')}</td>
              <td><span class="pill ${a.status==='done'?'pill-done':a.status==='cancelled'?'pill-low':'pill-wait'}">${statusLabel[a.status]}</span></td>
              <td style="white-space:nowrap;">
                ${a.status==='scheduled' ? `<button class="btn-icon" data-action="appt-done" data-id="${a.id}" title="${tt('Tandakan selesai')}">${ICONS.done||'✓'}</button>
                <button class="btn-icon" data-action="appt-cancel" data-id="${a.id}" title="${tt('Batal')}">${ICONS.x}</button>
                ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="${tt('Hantar peringatan WhatsApp')}" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}` : ''}
                <button class="btn-icon" data-action="delete-appointment" data-id="${a.id}" title="${state.language==='en'?'Delete appointment':'Padam tempahan'}">${ICONS.trash}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`}
  `;

  const contracts = [...db.contracts].sort((a,b)=>a.nextDue-b.nextDue);
  const contractTabHTML = `
    <div class="section-head">
      <div><div class="sub">${tt('Invois berulang untuk pelanggan korporat / armada kenderaan')}</div></div>
      <button class="btn btn-primary" data-action="new-contract">${ICONS.plus} ${tt('Kontrak Baharu')}</button>
    </div>
    ${contracts.length===0 ? emptyState(tt('Tiada kontrak servis ditubuhkan.')) : `
    <div class="grid grid-3">
      ${contracts.map(ct=>{
        const c = getCustomer(ct.customerId); const v = getVehicle(ct.vehicleId);
        const overdue = ct.nextDue <= now;
        const total = ct.items.reduce((s,i)=>s+i.price*i.qty,0);
        return `<div class="panel">
          <h2>${esc(ct.label)} ${overdue ? `<span class="pill pill-low" style="margin-left:auto;">${tt('Tertunggak')}</span>` : ''}</h2>
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px;">${c?esc(c.name):'-'} · ${v?esc(v.plate):'-'}</div>
          <div style="font-size:12.5px;color:var(--text-muted);">${tt('Kitaran: setiap')} ${ct.frequencyDays} ${tt('hari')}</div>
          <div style="font-size:12.5px;color:var(--text-muted);">${tt('Seterusnya')}: ${fmtDate(ct.nextDue)}</div>
          ${isAdmin ? `<div style="font-weight:600;color:var(--accent);margin:8px 0;">${fmtRM(total)} ${tt('/ kitaran')}</div>` : ''}
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" style="flex:1;" data-action="generate-contract" data-id="${ct.id}">${ICONS.repeat} ${tt('Jana Invois')}</button>
            <button class="btn btn-danger btn-sm" data-action="delete-contract" data-id="${ct.id}">${ICONS.trash}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  `;

  const calendarTabHTML = viewCalendarGrid();

  return `
  <div class="tabs">
    <div class="tab-btn ${state.apptTab==='calendar'?'active':''}" data-appttab="calendar">${ICONS.calendar} ${tt('Kalendar')}</div>
    <div class="tab-btn ${state.apptTab==='appointments'?'active':''}" data-appttab="appointments">${ICONS.calendar} ${tt('Tempahan')}</div>
    <div class="tab-btn ${state.apptTab==='contracts'?'active':''}" data-appttab="contracts">${ICONS.repeat} ${tt('Kontrak Servis')}</div>
  </div>
  ${state.apptTab==='calendar' ? calendarTabHTML : state.apptTab==='appointments' ? apptTabHTML : contractTabHTML}
  `;
}

/* ---------- CENTRALIZED CALENDAR (month grid) ---------- */
function getCalendarGrid(monthStr){
  const [y, m] = monthStr.split('-').map(Number);
  const firstOfMonth = new Date(y, m-1, 1);
  const startWeekday = (firstOfMonth.getDay()+6)%7; // Monday=0 .. Sunday=6
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysInPrevMonth = new Date(y, m-1, 0).getDate();
  const cells = [];
  for(let i=startWeekday-1;i>=0;i--){
    const d = daysInPrevMonth - i;
    const pm = m-1<1 ? 12 : m-1; const py = m-1<1 ? y-1 : y;
    cells.push({dateStr:`${py}-${String(pm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth:false, day:d});
  }
  for(let d=1; d<=daysInMonth; d++){
    cells.push({dateStr:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth:true, day:d});
  }
  let next=1;
  while(cells.length % 7 !== 0){
    const nm = m+1>12?1:m+1; const ny = m+1>12?y+1:y;
    cells.push({dateStr:`${ny}-${String(nm).padStart(2,'0')}-${String(next).padStart(2,'0')}`, inMonth:false, day:next});
    next++;
  }
  return cells;
}
function viewCalendarGrid(){
  const en = state.language==='en';
  const monthStr = state.calendarMonth || currentMonthStr();
  const todayStr = localDateStr();
  const cells = getCalendarGrid(monthStr);
  const byDate = {};
  db.appointments.forEach(a=>{ (byDate[a.date] = byDate[a.date]||[]).push(a); });
  Object.values(byDate).forEach(list=>list.sort((a,b)=>a.time.localeCompare(b.time)));
  const dowLabels = en ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : ['Isn','Sel','Rab','Kha','Jum','Sab','Ahd'];
  const statusDot = {scheduled:'var(--accent)', done:'var(--success)', cancelled:'var(--text-muted)'};
  return `
  <div class="section-head">
    <div>
      <div style="font-family:'Oswald',sans-serif;font-size:19px;font-weight:600;">${monthLabel(monthStr)}</div>
      <div class="sub">${en?'Click a day to view or add an appointment':'Klik pada hari untuk lihat atau tambah tempahan'}</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-outline btn-sm" data-action="cal-today">${en?'Today':'Hari Ini'}</button>
      <button class="btn-icon" data-action="cal-prev" title="${en?'Previous month':'Bulan sebelum'}">${ICONS.chevronLeft}</button>
      <button class="btn-icon" data-action="cal-next" title="${en?'Next month':'Bulan seterusnya'}">${ICONS.chevronRight}</button>
    </div>
  </div>
  <div class="panel" style="padding:14px;">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;">
      ${dowLabels.map(l=>`<div style="text-align:center;font-size:10.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:700;padding:4px 0;">${l}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
      ${cells.map(cell=>{
        const dayAppts = byDate[cell.dateStr] || [];
        const isToday = cell.dateStr===todayStr;
        const shown = dayAppts.slice(0,3);
        const overflow = dayAppts.length - shown.length;
        return `<div class="clickable" data-action="open-cal-day" data-date="${cell.dateStr}" style="min-height:74px;border-radius:var(--r-sm);padding:6px;background:${cell.inMonth?'var(--glass-2)':'transparent'};border:1px solid ${isToday?'var(--accent)':'var(--glass-border)'};opacity:${cell.inMonth?1:.4};">
          <div style="font-size:11.5px;font-weight:${isToday?'700':'600'};color:${isToday?'var(--accent)':'inherit'};margin-bottom:4px;">${cell.day}</div>
          ${shown.map(a=>{
            const v = getVehicle(a.vehicleId);
            return `<div style="font-size:9.5px;padding:2px 4px;border-radius:4px;background:var(--glass-1);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:2px solid ${statusDot[a.status]};">${a.time} ${v?esc(v.plate):''}</div>`;
          }).join('')}
          ${overflow>0 ? `<div style="font-size:9px;color:var(--text-muted);">+${overflow} ${en?'more':'lagi'}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>
  `;
}
function dayAppointmentsModalHTML(dateStr){
  const en = state.language==='en';
  const statusLabel = {scheduled:tt('Dijadualkan'), done:tt('Selesai')||'Selesai', cancelled:tt('Dibatalkan')};
  const dayAppts = db.appointments.filter(a=>a.date===dateStr).sort((a,b)=>a.time.localeCompare(b.time));
  const niceDate = new Date(dateStr+'T00:00:00').toLocaleDateString(dateLocale(), {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  return `
    <h2>${niceDate}</h2>
    ${dayAppts.length===0 ? `<p style="font-size:12.5px;color:var(--text-muted);">${en?'No appointments this day.':'Tiada tempahan pada hari ini.'}</p>` : dayAppts.map(a=>{
      const c = getCustomer(a.customerId); const v = getVehicle(a.vehicleId);
      const waText = encodeURIComponent(`Salam ${c?c.name:''}, ini peringatan tempahan servis kenderaan ${v?v.plate:''} pada ${a.date} jam ${a.time} di ${db.settings.shopName}. Sila hubungi kami jika perlu tukar masa. Terima kasih!`);
      const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--glass-border);gap:8px;">
        <div style="min-width:0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;">${a.time}</div>
          <div style="font-size:12.5px;">${c?esc(c.name):'-'} ${v?'· '+esc(v.plate):''}</div>
          ${a.notes ? `<div style="font-size:11.5px;color:var(--text-muted);">${esc(a.notes)}</div>` : ''}
          <span class="pill ${a.status==='done'?'pill-done':a.status==='cancelled'?'pill-low':'pill-wait'}" style="margin-top:4px;">${statusLabel[a.status]}</span>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          ${a.status==='scheduled' ? `<button class="btn-icon" data-action="appt-done" data-id="${a.id}" title="${tt('Tandakan selesai')}">${ICONS.done||'✓'}</button>
          <button class="btn-icon" data-action="appt-cancel" data-id="${a.id}" title="${tt('Batal')}">${ICONS.x}</button>
          ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="${tt('Hantar peringatan WhatsApp')}" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}` : ''}
          <button class="btn-icon" data-action="delete-appointment" data-id="${a.id}" title="${state.language==='en'?'Delete appointment':'Padam tempahan'}">${ICONS.trash}</button>
        </div>
      </div>`;
    }).join('')}
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="new-appointment-on-date" data-date="${dateStr}">${ICONS.plus} ${en?'Add Appointment':'Tambah Tempahan'}</button>
    </div>
  `;
}

function appointmentModalHTML(presetDate){
  const en = state.language==='en';
  return `
    <h2>${tt('Tempahan Baharu')}</h2>
    <div class="field"><label>${tt('Pelanggan')}</label>
      <select id="ap-customer">
        <option value="">— ${en?'Select Customer':'Pilih Pelanggan'} —</option>
        ${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${tt('Kenderaan')}</label>
      <select id="ap-vehicle"><option value="">— ${en?'Select Customer First':'Pilih Pelanggan Dahulu'} —</option></select>
    </div>
    <div class="field-row">
      <div class="field"><label>${tt('Tarikh')}</label><input id="ap-date" type="date" value="${esc(presetDate||'')}"></div>
      <div class="field"><label>${en?'Time':'Masa'}</label><input id="ap-time" type="time"></div>
    </div>
    <div class="field"><label>${tt('Nota')}</label><textarea id="ap-notes" rows="2" placeholder="Cth: servis 10,000km"></textarea></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-appointment">${en?'Save Appointment':'Simpan Tempahan'}</button>
    </div>
  `;
}

function contractModalHTML(){
  const en = state.language==='en';
  return `
    <h2>${en?'New Service Contract':'Kontrak Servis Baharu'}</h2>
    <div class="field"><label>${en?'Contract Name':'Nama Kontrak'}</label><input id="ct-label" placeholder="Cth: Servis Bulanan Armada Syarikat ABC"></div>
    <div class="field"><label>${tt('Pelanggan')}</label>
      <select id="ct-customer">
        <option value="">— ${en?'Select Customer':'Pilih Pelanggan'} —</option>
        ${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${tt('Kenderaan')}</label>
      <select id="ct-vehicle"><option value="">— ${en?'Select Customer First':'Pilih Pelanggan Dahulu'} —</option></select>
    </div>
    <div class="field"><label>${en?'Frequency (days)':'Kekerapan (hari)'}</label><input id="ct-freq" type="number" value="30"></div>
    <div class="field"><label>${en?'Items / Services (name:price, one per line)':'Item / Servis (nama:harga, satu setiap baris)'}</label>
      <textarea id="ct-items" rows="3" placeholder="Servis biasa:150&#10;Tukar minyak:65"></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-contract">${en?'Save Contract':'Simpan Kontrak'}</button>
    </div>
  `;
}

