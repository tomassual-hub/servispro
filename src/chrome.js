// Shared by the desktop sidebar and the mobile "More" sheet so both stay in
// sync on admin/simpleMode filtering instead of maintaining two lists.
function getNavItems(){
  const lowStockCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;
  const activeJobs = db.jobs.filter(j=>j.status!=='delivered').length;
  let items = [
    {k:'dashboard', l:t('nav_dashboard'), icon:ICONS.dashboard},
    {k:'jobs', l:t('nav_jobs'), icon:ICONS.jobs, badge:activeJobs},
    {k:'pos', l:t('nav_pos'), icon:ICONS.pos},
    {k:'inventory', l:t('nav_inventory'), icon:ICONS.inventory, badge:lowStockCount, badgeWarn:true},
    {k:'finance', l:t('nav_finance'), icon:ICONS.wallet},
    {k:'customers', l:t('nav_customers'), icon:ICONS.customers},
    {k:'techref', l:state.language==='en'?'Tech Reference':'Rujukan Teknikal', icon:ICONS.book},
    {k:'reports', l:t('nav_reports'), icon:ICONS.reports, adminOnly:true},
    {k:'payroll', l:tt('Gaji'), icon:ICONS.wallet, adminOnly:true},
    {k:'staffpage', l:t('nav_staff'), icon:ICONS.staff, adminOnly:true},
    {k:'appointments', l:t('nav_appointments'), icon:ICONS.calendar, advancedOnly:true},
    {k:'settings', l:t('nav_settings'), icon:ICONS.settings, adminOnly:true},
  ];
  // "adminOnly" here really means "management-level" (Admin or Kerani) --
  // Kerani gets full access to these sections, just not the revenue
  // figures inside them (see dashboard.js/pos.js/appointments.js/reports.js).
  if(!canManage()) items = items.filter(it=>!it.adminOnly);
  if(db.settings.simpleMode) items = items.filter(it=>!it.advancedOnly);
  return items;
}

// Desktop-only permanent left nav (hidden outright on mobile -- see
// .sidebar's display:none inside the 880px media query in styles.css;
// renderMobileMoreSheet() below is the mobile equivalent).
function renderSidebar(){
  const en = state.language==='en';
  const items = getNavItems();
  return `
  <div class="sidebar ${state.navOpen?'nav-open':''}">
    <div class="brand" style="position:relative;">
      <div class="brand-title">ServisPro</div>
      <div class="brand-tagline">by Tomas Sual</div>
      <button class="btn-icon hamburger-btn" data-action="close-nav" style="position:absolute;top:0;right:0;" title="${en?'Close menu':'Tutup menu'}">${ICONS.x}</button>
    </div>
    <div class="workspace-card">
      <div class="workspace-logo">${db.settings.shopLogo ? `<img src="${db.settings.shopLogo}" alt="" width="34" height="34" style="object-fit:contain;">` : logoMarkHtml(34)}</div>
      <div class="workspace-name">${esc(db.settings.shopName || (en?'ServisPro Auto Service':'ServisPro Auto Servis'))}</div>
    </div>
    <div class="nav">
      ${items.map(it=>`
        <div class="nav-item ${state.view===it.k?'active':''}" data-nav="${it.k}">
          ${it.icon}<span>${it.l}</span>
          ${it.badge ? `<span class="nav-badge" style="${it.badgeWarn && it.badge>0 ? 'background:var(--danger);color:#fff;':''}">${it.badge}</span>` : ''}
        </div>`).join('')}
    </div>
  </div>`;
}

// The 4 most-used sections get a permanent bottom tab on mobile (only
// rendered ≤880px, see .mobile-tabbar in styles.css); everything else
// (Customers, Tech Reference, Reports, Payroll, Staff, Appointments,
// Settings, account/logout/theme/language) stays reachable through
// "Lagi"/"More", which opens renderMobileMoreSheet() below -- a dedicated
// bottom sheet, not the desktop sidebar drawer (that's hidden outright on
// mobile now so the app doesn't read as a shrunk desktop web page).
function renderMobileTabBar(){
  const en = state.language==='en';
  const primaryKeys = ['dashboard','jobs','pos','inventory'];
  const allItems = getNavItems();
  // "Home" + a house icon here only -- the desktop sidebar and the mobile
  // "More" sheet both still say the localized "Dashboard" label via
  // getNavItems() itself (unchanged), since only this one tab is meant to
  // read as a reference app's literal "Home" tab.
  const primary = primaryKeys.map(k=>allItems.find(it=>it.k===k)).filter(Boolean)
    .map(it=>it.k==='dashboard' ? {...it, l:'Home', icon:ICONS.home} : it);
  const isPrimaryView = primary.some(it=>it.k===state.view);
  return `
  <div class="mobile-tabbar">
    ${primary.map(it=>`
      <div class="mobile-tab-item ${state.view===it.k?'active':''}" data-nav="${it.k}">
        ${it.icon}<span>${it.l}</span>
        ${it.badge ? `<span class="mobile-tab-badge">${it.badge}</span>` : ''}
      </div>`).join('')}
    <div class="mobile-tab-item ${!isPrimaryView?'active':''}" data-action="open-nav">
      ${ICONS.menu}<span>${en?'More':'Lagi'}</span>
    </div>
  </div>`;
}

// Mobile's "More" destination: a native-style bottom sheet (grabber handle,
// slides up from the bottom, rounded top corners) with the overflow nav laid
// out as a tappable icon grid, not a re-skinned vertical sidebar list --
// deliberately a different shape from .sidebar so mobile reads as its own
// surface rather than the desktop nav squeezed into a drawer. Reuses the
// exact same navOpen/open-nav/close-nav state and .sidebar-backdrop as the
// old drawer did (see render-core.js), just with new markup/classes.
function renderMobileMoreSheet(){
  const en = state.language==='en';
  const primaryKeys = ['dashboard','jobs','pos','inventory'];
  const items = getNavItems().filter(it=>!primaryKeys.includes(it.k));
  return `
  <div class="more-sheet ${state.navOpen?'show':''}">
    <div class="more-sheet-handle"></div>
    <div class="more-sheet-head">
      <div class="more-sheet-shop">
        <div class="workspace-logo">${db.settings.shopLogo ? `<img src="${db.settings.shopLogo}" alt="" width="30" height="30" style="object-fit:contain;">` : logoMarkHtml(30)}</div>
        <div class="workspace-name">${esc(db.settings.shopName || (en?'ServisPro Auto Service':'ServisPro Auto Servis'))}</div>
      </div>
      <button class="btn-icon" data-action="close-nav" title="${en?'Close':'Tutup'}">${ICONS.x}</button>
    </div>
    <div class="more-sheet-grid">
      ${items.map(it=>`
        <div class="more-grid-item ${state.view===it.k?'active':''}" data-nav="${it.k}">
          ${it.icon}<span>${it.l}</span>
        </div>`).join('')}
    </div>
    <div class="more-sheet-account">
      <div class="sidebar-account-row clickable" data-nav="account">
        <div class="user-avatar">${initials(state.currentStaff?state.currentStaff.name:'')}</div>
        <div style="flex:1;min-width:0;">
          <div class="staff-name">${state.currentStaff?state.currentStaff.name:''}</div>
          <div class="staff-role">${state.currentStaff?state.currentStaff.role:''}</div>
        </div>
        ${ICONS.chevronRight}
      </div>
      <div class="sidebar-account-actions">
        <div class="sidebar-account-toggles">
          <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
            <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
            <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
          </div>
          <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
            <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
            <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
          </div>
        </div>
        <div class="sidebar-account-buttons">
          <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
          ${faceIdSupportedSync() ? `<button class="btn-icon" data-action="open-faceid-settings" title="Face ID">${ICONS.faceid}</button>` : ''}
          <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
        </div>
      </div>
    </div>
  </div>`;
}

// Floating AI Assistant launcher, mobile only -- opens a standalone Q&A
// chat (see openAiAssistant()/aiAssistantModalHTML() in src/ai-assist.js),
// deliberately independent of every other feature: not a shortcut to an
// existing screen, not tied to any specific job/work order (that's the
// separate "AI Suggestion" button inside a job's own Inspection Checklist
// -- a different feature for a different moment: this one is a general
// assistant you can ask anything, that one is "what's wrong with THIS
// car"). Used to be the floating support-chat launcher; chat now only
// needs one entry point (folded into the topbar's own notification bell,
// see getNotifications()), so this bubble was freed up for the AI
// Assistant instead of two icons on screen doing similar jobs. Hidden
// whenever a sheet/modal is already covering the screen so it can't float
// on top of or behind either.
function renderMobileAiBubble(){
  if(state.navOpen || state.modal || state.confirmAction || state.showOnboarding) return '';
  const en = state.language==='en';
  return `
  <button class="mobile-ai-bubble" data-action="open-ai-assistant" title="${en?'Mechanic AI':'Mekanik AI'}">
    <img src="${AI_AVATAR_HEAD_DATA_URI}" alt="" width="102" height="101">
  </button>`;
}

// Self-service 2FA (TOTP) management — reachable by EVERY staff member
// (Mekanik included), unlike the rest of Settings which is Admin-only, so
// this lives in its own modal rather than inside the Settings view.
function mfaSettingsModalHTML(){
  const en = state.language==='en';
  const verifiedFactor = (state.mfaFactors||[]).find(f=>f.status==='verified');

  if(state.mfaEnrollment){
    const { qrSvg, secret } = state.mfaEnrollment;
    return `
      <h2>${ICONS.settings} ${en?'Set Up 2FA':'Sediakan 2FA'}</h2>
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Scan this with Google Authenticator, Authy, or any TOTP app.':'Imbas ini dengan Google Authenticator, Authy, atau apa-apa aplikasi TOTP.'}</p>
      <div style="background:#fff;padding:14px;border-radius:8px;width:fit-content;margin:0 auto 14px;"><img src="${esc(qrSvg)}" width="200" height="200" alt="QR 2FA"></div>
      <p style="font-size:11px;color:var(--text-muted);text-align:center;word-break:break-all;">${en?'Or enter manually:':'Atau masukkan manual:'} <code>${esc(secret)}</code></p>
      <div class="field"><label>${en?'6-digit code':'Kod 6 digit'}</label><input id="mfa-enroll-code" inputmode="numeric" maxlength="6" placeholder="000000" style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:18px;letter-spacing:6px;"></div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-action="cancel-mfa-enroll">${t('btn_cancel')}</button>
        <button class="btn btn-primary" data-action="confirm-mfa-enroll">${en?'Activate':'Aktifkan'}</button>
      </div>
    `;
  }

  if(verifiedFactor){
    return `
      <h2>${ICONS.settings} ${en?'Two-Factor Authentication (2FA)':'Pengesahan Dua Faktor (2FA)'}</h2>
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,165,121,.12);border-radius:8px;padding:12px;margin-bottom:16px;">
        <span style="color:var(--success);">${ICONS.done}</span>
        <span style="font-size:13px;">${en?'2FA is active on your account.':'2FA aktif pada akaun anda.'}</span>
      </div>
      <p style="font-size:11.5px;color:var(--text-muted);">${en?'If you lose your authenticator device, ask your shop Admin to remove 2FA for you via the Supabase dashboard.':'Jika anda kehilangan peranti authenticator, minta Admin bengkel buang 2FA untuk anda melalui dashboard Supabase.'}</p>
      <div class="modal-foot">
        <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
        <button class="btn btn-danger" data-action="unenroll-mfa" data-id="${verifiedFactor.id}">${en?'Remove 2FA':'Buang 2FA'}</button>
      </div>
    `;
  }

  return `
    <h2>${ICONS.settings} ${en?'Two-Factor Authentication (2FA)':'Pengesahan Dua Faktor (2FA)'}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Add an extra layer of security — after your password, you\'ll also need a code from an authenticator app to log in.':'Tambah satu lapisan keselamatan — selepas kata laluan, anda juga perlukan kod dari aplikasi authenticator untuk log masuk.'}</p>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="start-mfa-enroll">${en?'Set Up 2FA':'Sediakan 2FA'}</button>
    </div>
  `;
}

function syncIndicatorClass(){
  if(state.offlineMode) return 'offline';
  return state.syncStatus==='syncing' ? 'syncing' : state.syncStatus==='error' ? 'error' : 'idle';
}
function syncIndicatorLabel(){
  const en = state.language==='en';
  if(state.offlineMode) return en?'Offline — showing last saved data':'Luar talian — memaparkan data tersimpan terakhir';
  if(state.syncStatus==='syncing') return en?'Syncing…':'Sedang menyegerak…';
  if(state.syncStatus==='error') return en?'Sync failed — check your connection':'Segerak gagal — semak sambungan';
  return en?'Synced':'Disegerak';
}
// A save failure used to only ever surface as a 2.2s toast (see showToast's
// duration logic) plus this small header dot -- easy to miss entirely in a
// busy POS/job-card workflow, and by the time anyone noticed, the record
// that failed to save had no other trace. Keep a persistent, undismissable-
// until-resolved banner up for as long as syncStatus stays 'error', updated
// via direct DOM patch (like the toast) rather than a full render() so it
// doesn't interrupt whatever the user's mid-typing elsewhere.
function renderSyncErrorBanner(){
  const en = state.language==='en';
  return `<div id="sync-error-banner" class="sync-error-banner" style="display:${state.syncStatus==='error'?'flex':'none'};">
    ${ICONS.alert}
    <span>${en?"Some changes haven't reached the server yet — retrying automatically.":'Sebahagian perubahan belum sampai ke pelayan — cuba semula automatik.'}</span>
    <button class="btn btn-sm btn-outline" data-action="retry-sync-now">${en?'Retry now':'Cuba sekarang'}</button>
  </div>`;
}
function updateSyncIndicator(){
  const el = document.getElementById('sync-indicator');
  if(el){
    el.className = 'sync-indicator ' + syncIndicatorClass();
    el.title = syncIndicatorLabel();
  }
  const banner = document.getElementById('sync-error-banner');
  if(banner) banner.style.display = state.syncStatus==='error' ? 'flex' : 'none';
}

// Split out from renderTopbar so the input's own 'input' handler can patch
// just this dropdown (see attachHandlers' #global-search listener) instead
// of calling the full render() -- that used to rebuild the ENTIRE app
// (sidebar/topbar/whatever page you're on) on every keystroke, which gets
// expensive fast on a page with a large unbounded list (Inventory, POS's
// customer dropdown) even though none of that content has anything to do
// with this search box.
function renderGlobalSearchResultsHTML(){
  const en = state.language==='en';
  const q = state.globalSearch||'';
  if(!q.trim()) return '';
  const results = globalSearchResults(q.trim());
  return `
  <div class="global-search-results">
    ${results.length===0 ? `<div class="gs-empty">${en?`No matches for "${esc(q)}".`:`Tiada padanan untuk "${esc(q)}".`}</div>` : results.map((r,idx)=>`
      <div class="gs-item" data-gs-idx="${idx}">
        <div class="gs-type">${esc(r.typeLabel)}</div>
        <div>
          <div class="gs-label">${esc(r.label)}</div>
          <div class="gs-sub">${esc(r.sub)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}
// Shared by the topbar and the mobile dashboard hero (see viewDashboard's
// bell button, which replaces the topbar's copy on mobile so the bell isn't
// hidden along with the rest of the topbar there) -- one notifOpen toggle,
// one dropdown markup, so both copies always agree on what's open. Whichever
// copy is actually visible is decided by CSS (.topbar-notif/.hero-notif),
// not by which one got clicked -- see the [data-hero-notif] rule in
// styles.css and bindAllAction('toggle-notif', ...) in event-handlers.js.
function renderNotifBell(extraClass){
  const en = state.language==='en';
  const n = getNotifications();
  return `
  <div class="notif-wrap ${extraClass||''}">
    <button class="btn-icon" data-action="toggle-notif" title="${en?'Notifications':'Notifikasi'}" style="position:relative;">
      ${ICONS.bell}
      ${n.length>0 ? `<span class="notif-badge">${n.length}</span>` : ''}
    </button>
    ${state.notifOpen ? `
    <div class="global-search-results" style="width:300px;right:0;left:auto;">
      ${n.length===0 ? `<div class="gs-empty">${en?'No new notifications.':'Tiada notifikasi baharu.'}</div>` : n.map(item=>`
        <div class="gs-item" data-notif-nav="${item.view}">
          <div class="gs-type" style="background:${item.urgent?'rgba(225,75,75,.18)':'var(--panel-alt)'};color:${item.urgent?'var(--danger)':'var(--text-muted)'};">${item.tag}</div>
          <div><div class="gs-label">${esc(item.label)}</div><div class="gs-sub">${esc(item.sub)}</div></div>
        </div>`).join('')}
    </div>` : ''}
  </div>`;
}
function renderTopbar(){
  const titles = {dashboard:t('title_dashboard'), jobs:t('title_jobs'), pos:t('title_pos'), inventory:t('title_inventory'), finance:t('title_finance'), customers:t('title_customers'), reports:t('title_reports'), staffpage:t('title_staffpage'), appointments:t('title_appointments'), settings:t('title_settings'), payroll:t('title_payroll'), techref: state.language==='en'?'Technical Reference':'Rujukan Teknikal', account: state.language==='en'?'Account':'Akaun'};
  const en = state.language==='en';
  const s = state.currentStaff;
  const q = state.globalSearch||'';
  return `
  <div class="topbar">
    <div class="topbar-left">
      <button class="btn-icon hamburger-btn" data-action="open-nav" title="${state.language==='en'?'Open menu':'Buka menu'}">${ICONS.menu}</button>
      <div style="min-width:0;" class="${state.view==='dashboard'?'topbar-title-dashboard':''}">
        <h1>${titles[state.view]}</h1>
        <div class="date" style="margin-top:2px;">${new Date().toLocaleDateString('ms-MY',{weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</div>
      </div>
    </div>
    <div class="global-search-wrap">
      <div class="search-box" style="margin-bottom:0;">${ICONS.search}<input id="global-search" placeholder="${t('search_placeholder')}" value="${esc(q)}"></div>
      <div id="global-search-results-wrap">${renderGlobalSearchResultsHTML()}</div>
    </div>
    <div class="user-badge">
      <div id="sync-indicator" class="sync-indicator ${syncIndicatorClass()}" title="${syncIndicatorLabel()}"><span class="sync-dot"></span></div>
      ${db.branches.length>1 ? `
      <select id="branch-selector" style="width:auto;padding:8px 10px;font-size:12px;">
        <option value="all" ${state.currentBranch==='all'?'selected':''}>${en?'All Branches':'Semua Cawangan'}</option>
        ${db.branches.map(b=>`<option value="${b.id}" ${state.currentBranch===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}
      </select>` : ''}
      ${renderNotifBell('topbar-notif')}
      <div class="topbar-account">
        <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
          <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
          <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
        </div>
        <div>
          <div class="user-name" style="text-align:right;">${s?s.name:''}</div>
          <div class="user-role" style="text-align:right;">${s?s.role:''}</div>
        </div>
        <div class="user-avatar">${initials(s?s.name:'')}</div>
        <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
          <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
          <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
        </div>
        <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
        <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
      </div>
    </div>
  </div>`;
}

function getNotifications(){
  const out = [];
  const now = Date.now();
  const en = state.language==='en';
  // Folded into the bell instead of its own separate chip icon --
  // renderTopbar() and the mobile dashboard hero (renderDashboardHero() in
  // dashboard.js) both used to carry a standalone support-chat button
  // right next to their own bell; every place the bell renders now
  // surfaces this as just another notification instead (same
  // view:'support-chat' sentinel pattern as 'mfa-settings' below, handled
  // in the [data-notif-nav] click listener in event-handlers.js), so one
  // icon covers both everywhere, not just on the dashboard. Sits first
  // since an unread reply from management is usually the most time-
  // sensitive thing in this list.
  const unreadSupport = supportUnreadCount();
  if(unreadSupport>0) out.push({tag:en?'Support':'Sokongan', label:unreadSupport+(en?' unread support message(s)':' mesej sokongan belum dibaca'), sub:en?'Tap to open the chat.':'Ketik untuk buka chat.', view:'support-chat', urgent:true});
  const lowStock = db.inventory.filter(i=>i.qty<=i.lowStock);
  if(lowStock.length>0) out.push({tag:en?'Stock':'Stok', label:lowStock.length+(en?' item(s) low on stock':' item stok rendah'), sub:lowStock.slice(0,3).map(i=>i.name).join(', '), view:'inventory', urgent:true});
  const todayStr = localDateStr();
  const todayAppts = db.appointments.filter(a=>a.status==='scheduled' && a.date===todayStr);
  if(todayAppts.length>0) out.push({tag:en?'Appointments':'Tempahan', label:todayAppts.length+(en?' appointment(s) today':' tempahan hari ini'), sub:todayAppts.map(a=>a.time).join(', '), view:'appointments', urgent:false});
  const overdueContracts = db.contracts.filter(c=>c.nextDue<=now);
  if(overdueContracts.length>0) out.push({tag:en?'Contracts':'Kontrak', label:overdueContracts.length+(en?' overdue contract(s)':' kontrak tertunggak'), sub:overdueContracts.map(c=>c.label).join(', '), view:'appointments', urgent:true});
  const sizeBytes = JSON.stringify(db).length;
  const sizeMB = sizeBytes/1024/1024;
  if(sizeMB >= 4){
    const en = state.language==='en';
    out.push({
      tag: en?'Storage':'Storan',
      label: en?`Data is ${sizeMB.toFixed(1)}MB (limit ~5MB)`:`Data sudah ${sizeMB.toFixed(1)}MB (had ~5MB)`,
      sub: en?'Delete old photos or export/archive old invoices soon.':'Padam gambar lama atau eksport/arkibkan invois lama tidak lama lagi.',
      view:'settings', urgent:true
    });
  }
  const lastBackup = db.settings.lastBackupAt;
  const daysSinceBackup = lastBackup ? Math.floor((now-lastBackup)/86400000) : null;
  if(!lastBackup || daysSinceBackup>=7){
    const en = state.language==='en';
    out.push({
      tag: en?'Backup':'Sandaran',
      label: !lastBackup ? (en?'No backup yet':'Belum pernah disandarkan') : (en?`Last backup ${daysSinceBackup} day(s) ago`:`Sandaran terakhir ${daysSinceBackup} hari lalu`),
      sub: en?'Download a backup from Settings to avoid losing data.':'Muat turun sandaran dari Tetapan untuk elak kehilangan data.',
      view:'settings', urgent: !lastBackup || daysSinceBackup>=14
    });
  }
  const has2fa = (state.mfaFactors||[]).some(f=>f.status==='verified');
  if(state.mfaFactors!==null && !has2fa){
    const en = state.language==='en';
    // Same soft nudge for everyone, but marked urgent for Admin/Pemilik --
    // an Admin account is the single highest-value target in this app (full
    // revenue, staff, and settings access; see canSeeRevenue()), so a
    // phished or credential-stuffed Admin password does far more damage
    // than any other role's. Still just a nudge, never blocking -- forcing
    // 2FA outright risks locking an owner out entirely if they lose their
    // authenticator with no admin-of-the-admin to unlock them.
    const isOwner = isOwnerLevel(state.currentStaff && state.currentStaff.role);
    out.push({
      tag: '2FA',
      label: en?'2FA not set up':'2FA belum disediakan',
      sub: isOwner
        ? (en?'Your account has full revenue and staff access — set up 2FA to protect it.':'Akaun anda ada akses penuh kepada hasil dan staf — sediakan 2FA untuk lindunginya.')
        : (en?'Add an extra layer of security to your account.':'Tambah satu lapisan keselamatan pada akaun anda.'),
      view:'mfa-settings', urgent: isOwner
    });
  }
  return out;
}

function globalSearchResults(q){
  const ql = q.toLowerCase();
  const en = state.language==='en';
  const out = [];
  db.customers.forEach(c=>{
    if(c.name.toLowerCase().includes(ql) || (c.phone||'').includes(ql)){
      out.push({typeLabel:en?'Customer':'Pelanggan', label:c.name, sub:c.phone||'-', action:{type:'customer', id:c.id}});
    }
  });
  db.vehicles.forEach(v=>{
    if(v.plate.toLowerCase().includes(ql)){
      const c = getCustomer(v.customerId);
      out.push({typeLabel:en?'Vehicle':'Kenderaan', label:v.plate, sub:(v.model||'')+' · '+(c?c.name:'-'), action:{type:'vehicle', id:v.id}});
    }
  });
  db.jobs.forEach(j=>{
    if(j.jobNo.toLowerCase().includes(ql)){
      const v = getVehicle(j.vehicleId);
      out.push({typeLabel:en?'Job Card':'Kad Kerja', label:j.jobNo, sub:v?v.plate:'-', action:{type:'job', id:j.id}});
    }
  });
  db.invoices.forEach(inv=>{
    if(inv.invoiceNo.toLowerCase().includes(ql)){
      const c = getCustomer(inv.customerId);
      out.push({typeLabel:en?'Invoice':'Invois', label:inv.invoiceNo, sub:(c?c.name:'Walk-in')+' · '+fmtRM(inv.total), action:{type:'invoice', id:inv.id}});
    }
  });
  return out.slice(0,8);
}

function renderView(){
  const adminOnlyViews = ['reports','staffpage','settings','payroll'];
  if(adminOnlyViews.includes(state.view) && !canManage()){
    const en = state.language==='en';
    return `<div class="panel" style="text-align:center;padding:50px 20px;">
      ${ICONS.alert}
      <h2 style="margin-top:14px;">${en?'Access Restricted':'Akses Terhad'}</h2>
      <p style="color:var(--text-muted);font-size:13px;">${en?'This section is for Admin/Kerani roles only. Please contact your shop admin.':'Bahagian ini hanya untuk staf peranan Admin/Kerani. Sila hubungi admin bengkel anda.'}</p>
    </div>`;
  }
  if(state.view==='reports' && !hasFeature('reports')){
    const en = state.language==='en';
    return `<div class="panel" style="text-align:center;padding:50px 20px;">
      ${ICONS.lock}
      <h2 style="margin-top:14px;">${en?'Pro Plan Required':'Perlukan Pelan Pro'}</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">${en?'Reports is part of the Pro plan.':'Laporan adalah sebahagian daripada pelan Pro.'}</p>
      <button class="btn btn-primary" data-action="open-plan-picker">${en?'View Plans':'Lihat Pelan'}</button>
    </div>`;
  }
  switch(state.view){
    case 'dashboard': return viewDashboard();
    case 'jobs': return viewJobs();
    case 'pos': return viewPOS();
    case 'inventory': return viewInventory();
    case 'finance': return viewFinance();
    case 'customers': return viewCustomers();
    case 'techref': return viewTechRef();
    case 'reports': return viewReports();
    case 'payroll': return viewPayroll();
    case 'staffpage': return viewStaff();
    case 'appointments': return viewAppointments();
    case 'settings': return viewSettings();
    case 'account': return viewAccount();
    default: return '';
  }
}

