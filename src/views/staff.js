/* ============================= STAFF VIEW ============================= */
function viewStaff(){
  const simple = db.settings.simpleMode;
  const tab = (simple && state.staffTab==='attendance') ? 'staff' : (state.staffTab || 'staff');
  const adminCount = db.staff.filter(s=>isOwnerLevel(s.role)).length;
  const staffTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Urus akaun staf & mekanik yang boleh log masuk')}</div></div>
    <button class="btn btn-primary" data-action="new-staff">${ICONS.plus} ${tt('Staf Baharu')}</button>
  </div>
  <div class="grid grid-3">
    ${db.staff.map(s=>{
      const isLastAdmin = isOwnerLevel(s.role) && adminCount===1;
      return `
      <div class="panel" style="text-align:center;">
        <div class="staff-avatar" style="margin:0 auto 10px;">${initials(s.name)}</div>
        <div class="staff-name">${esc(s.name)}</div>
        <div class="staff-role">${s.role}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${esc(s.email||'')}${s.userId ? ` · ${state.language==='en'?'Linked':'Ditaut'}` : s.email ? ` · ${state.language==='en'?'Not linked yet':'Belum ditaut'}` : ''}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
          <button class="btn btn-outline btn-sm" data-action="edit-staff" data-id="${s.id}">${ICONS.edit} ${tt('Sunting')}</button>
          ${!simple ? `<button class="btn btn-outline btn-sm" data-action="show-attendance-qr" data-id="${s.id}" title="${state.language==='en'?'Attendance QR Code':'Kod QR Kehadiran'}">${ICONS.barcode}</button>` : ''}
          ${!simple ? `<button class="btn btn-outline btn-sm" data-action="show-attendance-summary" data-id="${s.id}" title="${state.language==='en'?'Attendance Summary':'Ringkasan Kehadiran'}">${ICONS.calendar}</button>` : ''}
          ${db.staff.length>1 && !isLastAdmin ? `<button class="btn btn-danger btn-sm" data-action="delete-staff" data-id="${s.id}">${ICONS.trash}</button>` : ''}
        </div>
      </div>`;}).join('')}
  </div>
  `;
  const auditTabHTML = `
  <div class="section-head"><div><div class="sub">${tt('Rekod semua tindakan penting oleh staf untuk akauntabiliti')}</div></div></div>
  <div class="panel">
    ${db.auditLog.length===0 ? emptyState(tt('Tiada aktiviti direkod lagi.')) : `
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Masa')}</th><th>${tt('Staf')||'Staf'}</th><th>${tt('Tindakan')}</th><th>${tt('Butiran')}</th></tr></thead>
      <tbody>
        ${db.auditLog.slice(0,100).map(a=>`
          <tr>
            <td style="font-family:'IBM Plex Mono',monospace;white-space:nowrap;">${fmtDateTime(a.ts)}</td>
            <td>${esc(a.staff)}</td>
            <td><span class="pill pill-wait">${esc(a.action)}</span></td>
            <td style="color:var(--text-muted);">${esc(a.detail)}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
  `;
  const en = state.language==='en';
  const attendanceTabHTML = `
  <div class="section-head">
    <div><div class="sub">${en?'Clock in/out records from staff QR codes. Edit any record if a staff member forgot to punch.':'Rekod clock in/out daripada kod QR staf. Sunting mana-mana rekod jika staf terlupa clock in/out.'}</div></div>
  </div>
  <div class="panel">
    ${(db.attendance||[]).length===0 ? emptyState(en?'No attendance records yet.':'Belum ada rekod kehadiran.') : `
    <div class="table-wrap"><table>
      <thead><tr><th>${en?'Staff':'Staf'}</th><th>${en?'Type':'Jenis'}</th><th>${en?'Time':'Masa'}</th><th></th></tr></thead>
      <tbody>
        ${[...db.attendance].sort((a,b)=>b.ts-a.ts).slice(0,100).map(a=>`
          <tr>
            <td style="font-weight:600;">${esc(a.staffName)}</td>
            <td><span class="pill ${a.type==='in'?'pill-done':'pill-low'}">${a.type==='in'?(en?'Clock In':'Clock In'):(en?'Clock Out':'Clock Out')}</span></td>
            <td style="font-family:'IBM Plex Mono',monospace;">${fmtDateTime(a.ts)}${a.editedBy?` <span style="color:var(--text-muted);font-size:10.5px;">(${en?'edited':'disunting'})</span>`:''}</td>
            <td style="white-space:nowrap;">
              <button class="btn-icon" data-action="edit-attendance" data-id="${a.id}" title="${en?'Edit attendance record':'Sunting rekod kehadiran'}">${ICONS.edit}</button>
              <button class="btn-icon" data-action="delete-attendance" data-id="${a.id}" title="${en?'Delete attendance record':'Padam rekod kehadiran'}">${ICONS.trash}</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
  `;
  return `
  <div class="tabs">
    <div class="tab-btn ${tab==='staff'?'active':''}" data-stafftab="staff">${ICONS.staff} ${t('nav_staff')}</div>
    ${!simple ? `<div class="tab-btn ${tab==='attendance'?'active':''}" data-stafftab="attendance">${ICONS.barcode} ${en?'Attendance':'Kehadiran'}</div>` : ''}
    <div class="tab-btn ${tab==='audit'?'active':''}" data-stafftab="audit">${ICONS.history} ${tt('Log Aktiviti')}</div>
  </div>
  ${tab==='staff' ? staffTabHTML : tab==='attendance' ? attendanceTabHTML : auditTabHTML}
  `;
}

function editAttendanceModalHTML(record){
  const en = state.language==='en';
  const d = new Date(record.ts);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `
    <h2>${en?'Edit Attendance Record':'Sunting Rekod Kehadiran'} — ${esc(record.staffName)}</h2>
    <div class="field"><label>${en?'Type':'Jenis'}</label>
      <select id="att-edit-type">
        <option value="in" ${record.type==='in'?'selected':''}>${en?'Clock In':'Clock In'}</option>
        <option value="out" ${record.type==='out'?'selected':''}>${en?'Clock Out':'Clock Out'}</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field"><label>${tt('Tarikh')}</label><input id="att-edit-date" type="date" value="${dateStr}"></div>
      <div class="field"><label>${en?'Time':'Masa'}</label><input id="att-edit-time" type="time" value="${timeStr}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-attendance-edit" data-id="${record.id}">${t('btn_save')}</button>
    </div>
  `;
}

function attendanceQrModalHTML(staffMember){
  const en = state.language==='en';
  const url = `${location.origin}${location.pathname}?attendance=${encodeURIComponent(staffMember.id)}&token=${encodeURIComponent(staffMember.attendanceToken||'')}`;
  return `
    <h2>${ICONS.barcode} ${en?'Attendance QR Code':'Kod QR Kehadiran'} — ${esc(staffMember.name)}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?"Print this and let this staff member scan it with their own phone to clock in/out — no login needed. Keep it personal to them; anyone holding this exact code can punch on their behalf."
      :'Cetak ini dan biarkan staf ini imbas dengan telefon sendiri untuk clock in/out — tiada log masuk diperlukan. Kekalkan ia peribadi kepada mereka; sesiapa yang ada kod tepat ini boleh clock in/out bagi pihak mereka.'}</p>
    <div style="text-align:center;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}" width="200" height="200" style="border-radius:8px;background:#fff;padding:8px;" alt="QR ${esc(staffMember.name)}">
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="regenerate-attendance-token" data-id="${staffMember.id}">${en?'Regenerate (revokes old code)':'Jana Semula (batalkan kod lama)'}</button>
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="print-attendance-qr">${ICONS.printer} ${en?'Print':'Cetak'}</button>
    </div>
  `;
}

function staffModalHTML(staffMember){
  const isEdit = !!staffMember;
  const en = state.language==='en';
  staffMember = staffMember || {name:'', role:'Mekanik', email:'', commissionPercent:0, baseSalary:0};
  return `
    <h2>${isEdit?tt('Sunting Staf'):tt('Staf Baharu')}</h2>
    <div class="field"><label>${tt('Nama')||'Nama'}</label><input id="sf-name" value="${esc(staffMember.name)}" placeholder="Nama staf"></div>
    <div class="field"><label>${tt('Peranan')||'Peranan'}</label>
      <select id="sf-role">
        <option value="Admin" ${staffMember.role==='Admin'?'selected':''}>Admin</option>
        <option value="Pemilik" ${staffMember.role==='Pemilik'?'selected':''}>Pemilik</option>
        <option value="Kerani" ${staffMember.role==='Kerani'?'selected':''}>Kerani</option>
        <option value="Ketua Mekanik" ${staffMember.role==='Ketua Mekanik'?'selected':''}>Ketua Mekanik</option>
        <option value="Mekanik" ${staffMember.role==='Mekanik'?'selected':''}>Mekanik</option>
      </select>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
        ${en?'"Pemilik" has the exact same full access as Admin — just a separate label for whoever actually owns the shop.':'"Pemilik" ada akses penuh sama seperti Admin — cuma label berasingan untuk sesiapa yang benar-benar memiliki bengkel.'}<br>
        ${en?'"Head Mechanic" is a title only — same restricted access as Mekanik (no sales/revenue figures).':'"Ketua Mekanik" cuma gelaran — akses terhad sama seperti Mekanik (tiada lihat jualan/hasil).'}<br>
        ${en?'"Kerani" has full Admin-level access (Staff, Settings, Payroll, Reports) EXCEPT sales/revenue figures.':'"Kerani" ada akses penuh setaraf Admin (Staf, Tetapan, Gaji, Laporan) KECUALI angka jualan/pendapatan.'}
      </div>
    </div>
    <div class="field">
      <label>${en?'Login Email':'E-mel Log Masuk'}</label>
      <input id="sf-email" type="email" value="${esc(staffMember.email||'')}" placeholder="nama@contoh.com">
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${en
        ? (staffMember.userId ? 'Linked to a login account.' : (isEdit && isOwnerLevel(state.currentStaff && state.currentStaff.role) ? 'Not linked yet — set a password below to create their login account directly, or tell them to tap "New staff? Create an account" using this exact email.' : 'Not linked yet — tell them to open the app and tap "New staff? Create an account" using this exact email.'))
        : (staffMember.userId ? 'Sudah ditautkan dengan akaun log masuk.' : (isEdit && isOwnerLevel(state.currentStaff && state.currentStaff.role) ? 'Belum ditautkan — tetapkan kata laluan di bawah untuk cipta akaun log masuk terus, atau minta mereka tekan "Staf baharu? Daftar akaun" menggunakan e-mel yang sama ini.' : 'Belum ditautkan — minta mereka buka aplikasi dan tekan "Staf baharu? Daftar akaun" menggunakan e-mel yang sama ini.'))}</div>
    </div>
    <div class="field"><label>${en?'Base Salary (RM/month)':'Gaji Pokok (RM/bulan)'}</label><input id="sf-basesalary" type="number" min="0" step="0.01" value="${staffMember.baseSalary||0}"></div>
    <div class="field"><label>${en?'Commission (% of completed job value)':'Komisen (% daripada nilai kerja disiapkan)'}</label><input id="sf-commission" type="number" min="0" max="100" value="${staffMember.commissionPercent||0}"></div>
    ${isEdit && isOwnerLevel(state.currentStaff && state.currentStaff.role) ? `
    <div class="field" style="margin-top:8px;padding-top:14px;border-top:1px dashed var(--border);">
      <label>${staffMember.userId ? (en?'Reset Password':'Reset Kata Laluan') : (en?'Set a Password':'Tetapkan Kata Laluan')}</label>
      <input id="sf-new-password" type="password" autocomplete="new-password" placeholder="${staffMember.userId ? (en?'Leave blank to keep current password':'Biar kosong untuk kekalkan kata laluan semasa') : (en?'Required to create their login now':'Diperlukan untuk cipta akaun log masuk sekarang')}">
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${en?'Takes effect immediately -- no email confirmation needed. Uses the Login Email field above.':'Berkuat kuasa serta-merta -- tiada pengesahan e-mel diperlukan. Guna medan E-mel Log Masuk di atas.'}</div>
      <button class="btn btn-outline btn-sm" style="margin-top:10px;" data-action="admin-manage-staff-account" data-id="${staffMember.id}">${ICONS.shield} ${staffMember.userId ? (en?'Update Login Account':'Kemaskini Akaun Log Masuk') : (en?'Create Login Account Now':'Cipta Akaun Log Masuk Sekarang')}</button>
    </div>` : ''}
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-staff" data-id="${staffMember.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

