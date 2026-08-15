/* ============================= QR ATTENDANCE (punch screen) ============================= */
// Reached by scanning a staff member's personal QR code, which links to
// ?attendance=<staffId>&token=<attendanceToken> -- no login required (see
// initApp() in sync-engine.js for the URL detection, and
// attendance_status()/attendance_punch() in backend/schema.sql for the two
// narrow anonymous-safe RPCs this screen calls). The per-staff token is
// what stops someone else from punching in as a coworker just by knowing
// the app's URL -- they'd need that specific staff member's own QR code.
function renderAttendancePunch(){
  const en = state.language==='en';
  const status = state.attendanceStatus;
  let body = '';
  if(status==='loading'){
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Checking your QR code…':'Menyemak kod QR anda…'}</p>`;
  } else if(status==='invalid'){
    body = `<div class="empty">${ICONS.alert}<div>${en?'This QR code is invalid or has been reset. Ask your Admin for a fresh one.':'Kod QR ini tidak sah atau telah ditetapkan semula. Minta Admin anda untuk kod baharu.'}</div></div>`;
  } else if(status && status.punched){
    const timeStr = new Date(status.ts).toLocaleTimeString(dateLocale(),{hour:'2-digit',minute:'2-digit'});
    body = `
      <div style="text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(79,165,121,.15);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${ICONS.done}</div>
        <h2 style="margin:0 0 6px;">${status.type==='in' ? (en?'Clocked In':'Berjaya Clock In') : (en?'Clocked Out':'Berjaya Clock Out')}</h2>
        <p style="color:var(--text-muted);">${esc(status.name)} &middot; ${timeStr}</p>
      </div>`;
  } else if(status && status.name){
    const isIn = status.nextType==='in';
    body = `
      <div style="text-align:center;">
        <div class="staff-avatar" style="width:64px;height:64px;font-size:22px;margin:0 auto 14px;">${initials(status.name)}</div>
        <h2 style="margin:0 0 20px;">${en?'Hi':'Salam'}, ${esc(status.name)}!</h2>
        <button class="btn ${isIn?'btn-primary':'btn-danger'}" style="width:100%;justify-content:center;padding:18px;font-size:16px;" data-action="do-attendance-punch">
          ${isIn ? ICONS.done : ICONS.logout} ${isIn ? (en?'Clock In':'Clock In') : (en?'Clock Out':'Clock Out')}
        </button>
      </div>`;
  } else {
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Loading…':'Memuatkan…'}</p>`;
  }
  return `
  <div class="login-screen">
    <div class="login-box">
      <div class="login-brand">
        <div class="mark">${logoMarkHtml(112)}</div>
        <div class="sub">${en?'Staff Attendance':'Kehadiran Staf'}</div>
      </div>
      <div class="panel">${body}</div>
    </div>
  </div>`;
}

/* ============================= ATTENDANCE SUMMARY (per-staff, view-only) ============================= */
// Deliberately display-only, same reasoning as computeMonthlyPay()'s own
// comment: this app avoids calculating pay from hours/attendance at all
// (base salary + commission stays the only pay model). Present/Absent here
// just reflects whether a staff member has any 'in' punch that day -- there's
// no shift-schedule or leave-type data anywhere in the app to compute a real
// "late" or "on leave" distinction without inventing fields nobody asked
// for, so this only shows what the existing punch records actually support.
function computeAttendanceSummary(staffId, monthStr){
  const [y,m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = localDateStr();
  const records = (db.attendance||[]).filter(a=>a.staffId===staffId);
  const days = [];
  let presentDays=0, absentDays=0, totalHours=0;
  for(let day=1; day<=daysInMonth; day++){
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(dateStr>todayStr) break; // don't show/count days that haven't happened yet
    const dayRecords = records.filter(a=>localDateStr(new Date(a.ts))===dateStr).sort((a,b)=>a.ts-b.ts);
    // Pair each 'in' with the next 'out' that follows it and sum each
    // session separately, instead of spanning earliest-in to latest-out --
    // the latter used to silently count a lunch break (or any gap between
    // two clock-in sessions in the same day) as worked time.
    let hours = 0, firstInTs = null, lastOutTs = null, openInTs = null;
    dayRecords.forEach(r=>{
      if(r.type==='in'){
        if(firstInTs===null) firstInTs = r.ts;
        if(openInTs===null) openInTs = r.ts; // a second 'in' before any 'out' -- ignore the duplicate
      } else if(openInTs!==null && r.ts>openInTs){
        hours += (r.ts-openInTs)/3600000;
        lastOutTs = r.ts;
        openInTs = null;
      } else if(firstInTs===null){
        // an 'out' with no preceding 'in' that day -- an anomaly (forgot to
        // punch in, or a stray record), not a real session. Don't treat the
        // day as present off the back of it alone.
        lastOutTs = r.ts;
      }
    });
    const present = firstInTs!==null;
    const incomplete = present && openInTs!==null; // clocked in, never clocked out (still working, or forgot)
    if(present) presentDays++; else absentDays++;
    totalHours += hours;
    days.push({ dateStr, inTs: present?firstInTs:null, outTs: present?lastOutTs:null, hours, present, incomplete });
  }
  return { presentDays, absentDays, totalHours, days: days.reverse() }; // most recent first
}

function attendanceSummaryModalHTML(staffId){
  const en = state.language==='en';
  const staffMember = db.staff.find(s=>s.id===staffId);
  const month = state.attendanceSummaryMonth || currentMonthStr();
  const isCurrentMonth = month === currentMonthStr();
  const summary = staffMember ? computeAttendanceSummary(staffId, month) : { presentDays:0, absentDays:0, totalHours:0, days:[] };
  const dayName = (dateStr)=> new Date(dateStr+'T00:00:00').toLocaleDateString(dateLocale(), {weekday:'short'});
  const timeOnly = (ts)=> ts ? new Date(ts).toLocaleTimeString(dateLocale(),{hour:'2-digit',minute:'2-digit'}) : '—';
  return `
    <h2>${ICONS.calendar} ${en?'Attendance Summary':'Ringkasan Kehadiran'} — ${esc(staffMember?staffMember.name:'')}</h2>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px;">
      <button class="btn-icon" data-action="attendance-summary-prev-month" title="${en?'Previous month':'Bulan sebelum'}" style="font-size:18px;">‹</button>
      <div style="font-weight:700;font-size:14.5px;min-width:150px;text-align:center;">${monthLabel(month)}</div>
      <button class="btn-icon" data-action="attendance-summary-next-month" title="${en?'Next month':'Bulan seterusnya'}" style="font-size:18px;" ${isCurrentMonth?'disabled':''}>›</button>
    </div>
    <div class="grid grid-3" style="gap:10px;margin-bottom:16px;">
      <div class="stat-card ok" style="padding:14px;">
        <div class="stat-icon">${ICONS.done}</div>
        <div class="stat-label">${en?'Present':'Hadir'}</div>
        <div class="stat-value" style="font-size:26px;">${summary.presentDays}</div>
      </div>
      <div class="stat-card warn" style="padding:14px;">
        <div class="stat-icon">${ICONS.x}</div>
        <div class="stat-label">${en?'Absent':'Tidak Hadir'}</div>
        <div class="stat-value" style="font-size:26px;">${summary.absentDays}</div>
      </div>
      <div class="stat-card" style="padding:14px;">
        <div class="stat-icon">${ICONS.history}</div>
        <div class="stat-label">${en?'Hours Worked':'Jam Bekerja'}</div>
        <div class="stat-value" style="font-size:26px;">${summary.totalHours.toFixed(1)}h</div>
      </div>
    </div>
    <div class="table-wrap" style="max-height:340px;overflow-y:auto;">
    <table>
      <thead><tr><th></th><th>${en?'Date':'Tarikh'}</th><th>${en?'In':'Masuk'}</th><th>${en?'Out':'Keluar'}</th><th>${en?'Hours':'Jam'}</th></tr></thead>
      <tbody>
        ${summary.days.length===0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">${en?'No days yet.':'Belum ada hari.'}</td></tr>` : summary.days.map((d,i)=>`
          <tr style="background:${i%2? 'var(--glass-highlight)':'transparent'};">
            <td style="width:26px;padding-right:0;">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${d.present?'rgba(79,165,121,.16)':'rgba(225,75,75,.16)'};color:${d.present?'var(--success)':'var(--danger)'};">${d.present?ICONS.done:ICONS.x}</span>
            </td>
            <td style="white-space:nowrap;font-weight:600;">${dayName(d.dateStr)} ${d.dateStr.slice(8,10)}/${d.dateStr.slice(5,7)}</td>
            <td>${timeOnly(d.inTs)}</td>
            <td>${d.incomplete ? `<span class="pill pill-wait">${en?'Not out yet':'Belum Keluar'}</span>` : timeOnly(d.outTs)}</td>
            <td>${!d.present ? `<span class="pill pill-low">${en?'Absent':'Tidak Hadir'}</span>` : d.incomplete ? '—' : `${d.hours.toFixed(1)}h`}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="print-attendance-summary" data-staffid="${staffId}" data-month="${month}">${ICONS.printer} ${en?'Print':'Cetak'}</button>
    </div>
  `;
}

async function loadAttendanceStatus(){
  try{
    const { data, error } = await supabaseClient.rpc('attendance_status', { p_staff_id: state.attendanceStaffId, p_token: state.attendanceToken });
    if(error) throw error;
    state.attendanceStatus = data || 'invalid';
  }catch(e){
    reportError(e, 'Semak status kehadiran gagal');
    state.attendanceStatus = 'invalid';
  }
  render();
}

function attachAttendancePunchHandlers(){
  if(state.attendanceStatus==='loading' && !state.attendanceStatusLoading){
    state.attendanceStatusLoading = true;
    loadAttendanceStatus();
  }
  bindAction('do-attendance-punch', async ()=>{
    const en = state.language==='en';
    try{
      const { data, error } = await supabaseClient.rpc('attendance_punch', { p_staff_id: state.attendanceStaffId, p_token: state.attendanceToken });
      if(error) throw error;
      if(!data){ state.attendanceStatus = 'invalid'; render(); return; }
      state.attendanceStatus = { ...data, punched:true };
      render();
    }catch(e){
      reportError(e, 'Rekod kehadiran gagal');
      showToast(en?'Could not record attendance. Check your connection and try again.':'Gagal rekod kehadiran. Semak sambungan anda dan cuba lagi.');
    }
  });
}
