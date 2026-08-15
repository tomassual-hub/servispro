/* ============================= ACCOUNT (mobile profile page) =============================
   Reached by tapping the avatar/name row in the mobile "More" sheet (see
   .more-sheet-account in chrome.js/styles.css) -- mirrors a reference app's
   dedicated Account screen the user shared (avatar+role header, credit/
   referral/subscription rows, grouped settings rows, a big Log Out button),
   using ServisPro's own colors rather than that reference's palette.

   The reference app's Credit Balance / Referral Code rows are that OTHER
   app's own monetization model (a credit-based marketplace) -- ServisPro
   doesn't have one of those. Rather than either faking a working feature
   or omitting the rows entirely, they're built as honestly-labeled
   previews (a small "coming soon" tag, no real balance/reward promised) so
   the layout matches without misleading real shop staff using this in
   production. Referral copy/share still genuinely works -- it just shares
   an app invite, not a reward claim.

   Subscription is different: it's a real (test-mode) plan picker backed by
   src/license.js/backend/central-schema.sql -- see that file's own
   comments for why "real" still means no actual payment happens yet.

   Credit Balance / Referral Code are ALSO now real (no longer the "coming
   soon" preview described below for historical context) -- backed by
   licenses.credit_balance/referral_code and the redeem_referral_code/
   redeem_credit_for_upgrade RPCs in central-schema.sql. Referring another
   shop credits the REFERRER (not the shop that redeems a code), and credit
   can be spent to upgrade a plan for real, independent of the test-mode
   simulate_upgrade() button -- see src/license.js for both flows.

   Also deliberately does NOT add lock icons to Staff/Appointments/Payroll
   below -- those are real, fully working ServisPro features (just
   role-gated the same way the rest of the app already gates them via
   getNavItems()), not premium-tier teasers, so hiding them behind a fake
   paywall would be a real regression, not a cosmetic one. Reports IS now
   plan-gated (see hasFeature('reports') below) -- that's the one
   deliberate placeholder example of the mechanism actually working. */
function viewAccount(){
  const en = state.language==='en';
  const s = state.currentStaff;
  const shop = db.settings;
  const manage = canManage();
  const year = new Date().getFullYear();
  const licenseLoaded = !!(state.license && state.license.live);
  const referralCode = (state.license && state.license.referralCode) || null;
  const creditBalance = (state.license && state.license.creditBalance) || 0;

  // Curated settings/management rows for this page -- not a repeat of the
  // full getNavItems() list (that's already one tap away via the "More"
  // sheet this page was opened from); just the subset that reads as
  // "account & business configuration" the way the reference app groups it.
  const groups = [
    { title: en?'Profile & Plan':'Profil & Pelan', rows: [
      { icon:ICONS.star, title:en?'Subscription':'Langganan', sub:en?'Manage plan and billing':'Urus pelan dan bil', badge:(PLAN_LABELS[currentPlan()]||PLAN_LABELS.free)[en?'en':'ms'], action:'open-plan-picker' },
      manage ? { icon:ICONS.settings, title:en?'Workshop Details':'Butiran Bengkel', sub:en?'Address, services, facilities and branding':'Alamat, perkhidmatan, kemudahan dan jenama', nav:'settings' } : null,
    ]},
    { title: en?'Daily Operations':'Operasi Harian', rows: [
      manage ? { icon:ICONS.staff, title:t('nav_staff'), sub:en?'QR attendance, add staff':'Kehadiran QR, tambah staf', nav:'staffpage' } : null,
      (!db.settings.simpleMode) ? { icon:ICONS.calendar, title:t('nav_appointments'), sub:en?'Bookings and service reminders':'Tempahan dan peringatan servis', nav:'appointments' } : null,
    ]},
    { title: en?'Business Management':'Pengurusan Perniagaan', rows: [
      manage ? (hasFeature('reports')
        ? { icon:ICONS.reports, title:t('nav_reports'), sub:en?'Sales, KPIs and trends':'Jualan, KPI dan trend', nav:'reports' }
        : { icon:ICONS.reports, title:t('nav_reports'), sub:en?'Pro plan':'Pelan Pro', locked:true }) : null,
      manage ? { icon:ICONS.wallet, title:tt('Gaji'), sub:en?'Staff payroll and payslips':'Gaji staf dan slip gaji', nav:'payroll' } : null,
    ]},
  ].map(g=>({ ...g, rows: g.rows.filter(Boolean) })).filter(g=>g.rows.length>0);

  return `
  <div class="section-head">
    <div>
      <h1>${en?'Account':'Akaun'}</h1>
      <div class="sub">${en?'Your profile and workshop info':'Profil anda dan maklumat bengkel'}</div>
    </div>
  </div>

  <div class="panel account-hero">
    <div class="user-avatar account-hero-avatar">${initials(s?s.name:'')}</div>
    <div style="min-width:0;">
      <div class="account-hero-name">${esc(s?s.name:'')} ${ICONS.verified}</div>
      <div class="account-hero-role">${esc(s?s.role:'')}</div>
      <div class="account-hero-email">${ICONS.pin}<span>${shop.shopAddress ? esc(shop.shopAddress) : (en?'No address set':'Alamat belum ditetapkan')}</span></div>
      ${s && s.email ? `<div class="account-hero-email">${ICONS.mail}<span>${esc(s.email)}</span></div>` : ''}
    </div>
  </div>

  <div class="panel account-credit-bar clickable" data-action="open-plan-picker">
    ${ICONS.wallet}
    <div style="flex:1;min-width:0;">
      <div class="account-credit-label">${en?'Credit Balance':'Baki Kredit'}</div>
      <div class="account-credit-tag">${en?'Usable toward your subscription':'Boleh guna untuk langganan'}</div>
    </div>
    <div class="account-credit-value">RM${creditBalance.toFixed(2)}</div>
  </div>

  <div class="account-teaser-row">
    <div class="panel account-teaser-card">
      <div class="account-teaser-icon">${ICONS.wallet}</div>
      <div class="account-teaser-label">${en?`Sales ${year}`:`Jualan ${year}`}</div>
      <div class="account-teaser-value">${ICONS.lock} ****</div>
    </div>
    <div class="panel account-teaser-card">
      <div class="account-teaser-icon">${ICONS.jobs}</div>
      <div class="account-teaser-label">${en?`Jobs ${year}`:`Kerja ${year}`}</div>
      <div class="account-teaser-value">${ICONS.lock} ****</div>
    </div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <h2 style="margin:0;">${en?'Referral Code':'Kod Rujukan'}</h2>
      <span class="sub" style="font-size:12px;">${en?'RM10 credit per shop referred':'RM10 kredit setiap bengkel dirujuk'}</span>
    </div>
    ${referralCode ? `
    <div class="account-referral-box">
      <code>${esc(referralCode)}</code>
      <button class="btn-icon" data-action="copy-referral-code" data-code="${esc(referralCode)}" title="${en?'Copy':'Salin'}">${ICONS.copy}</button>
      <button class="btn-icon" data-action="share-referral-code" data-code="${esc(referralCode)}" title="${en?'Share':'Kongsi'}">${ICONS.share}</button>
    </div>` : `<div class="sub">${licenseLoaded ? '' : (en?'Loading…':'Memuatkan…')}</div>`}
    <div class="account-referral-redeem">
      <input type="text" id="referral-redeem-input" maxlength="6" placeholder="${en?'Got a code? Enter it here':'Ada kod? Masukkan di sini'}" style="text-transform:uppercase;" />
      <button class="btn btn-outline btn-sm" data-action="redeem-referral-code">${en?'Apply':'Guna'}</button>
    </div>
  </div>

  ${groups.map(g=>`
  <div class="panel account-group">
    <div class="account-group-title">${g.title}</div>
    ${g.rows.map(r=>`
      <div class="account-row clickable" ${r.locked?`data-action="open-plan-picker"`:r.nav?`data-nav="${r.nav}"`:`data-action="${r.action}"`}>
        <div class="account-row-icon">${r.icon}</div>
        <div style="min-width:0;flex:1;">
          <div class="account-row-title">${r.title}</div>
          <div class="account-row-sub">${r.sub}</div>
        </div>
        ${r.badge ? `<span class="tag">${r.badge}</span>` : ''}
        ${r.locked ? ICONS.lock : (r.nav ? ICONS.chevronRight : '')}
      </div>`).join('')}
  </div>`).join('')}

  <div class="panel">
    <h2>${en?'Preferences':'Keutamaan'}</h2>
    <div class="sidebar-account-actions account-page-actions">
      <div class="sidebar-account-toggles">
        <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
          <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
          <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
        </div>
        ${languagePickerHTML()}
        ${pushSupported() ? `
        <div class="theme-toggle" data-action="toggle-push-notifications" title="${en?'Push notifications':'Notifikasi push'}">
          <div class="t-icon ${!state.pushSubscribed?'active':''}" style="font-size:10px;font-weight:700;">OFF</div>
          <div class="t-icon ${state.pushSubscribed?'active':''}">${ICONS.bell}</div>
        </div>` : ''}
      </div>
      <div class="sidebar-account-buttons">
        <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
        ${faceIdSupportedSync() ? `<button class="btn-icon" data-action="open-faceid-settings" title="Face ID">${ICONS.faceid}</button>` : ''}
      </div>
    </div>
  </div>

  <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:64px;" data-action="logout">${ICONS.logout} ${en?'Log Out':'Log Keluar'}</button>
  `;
}
