// @ts-nocheck
// Same reasoning as event-handlers.js: dominated by raw DOM .value reads
// off getElementById() results, plus one string|Job union tsc can't narrow
// without a discriminant. Low type-checking value relative to the noise.

// A local copy of utils.js's normalizePhone(), which reads db.settings --
// db is never populated on this anonymous/kiosk screen (no staff session,
// no full sync), so the shop's phone/country code here come from
// get_my_customer_data()'s own return value instead (see kioskAccountTabHTML).
function kioskNormalizePhone(phone, countryCode){
  let p = (phone||'').replace(/[^0-9]/g,'');
  if(p.startsWith('0')) p = (countryCode||'60') + p.slice(1);
  return p;
}

function renderLoginScreen(){
  const en = state.language==='en';
  // Workshop illustration from the reference "ServisPro Management" slide
  // the user shared, cropped to just its left panel -- shown large (fluid
  // up to its native 760px resolution, no upscale blur) on the wide
  // desktop split-screen layout only (login-screen-auth's own CSS hides it
  // below the breakpoint, where there's no room for it next to the login
  // form). The 4 feature items removed when the illustration first
  // replaced them are back as a compact icon strip overlaid on the image
  // itself (scrimmed for legibility) rather than stacked below it -- with
  // the image this much bigger there's no spare vertical room for a full
  // description list without pushing the screen into scroll territory.
  const featuresPanel = `
    <div class="login-features">
      <div class="login-illustration">
        <img src="${WORKSHOP_ILLUSTRATION_DATA_URI}" alt="ServisPro workshop" width="805" height="916">
        <div class="login-illustration-strip">
          <div class="lif-item"><span class="lif-icon">${ICONS.jobs}</span>${en?'Job Cards':'Kad Kerja'}</div>
          <div class="lif-item"><span class="lif-icon">${ICONS.inventory}</span>${en?'Inventory':'Inventori'}</div>
          <div class="lif-item"><span class="lif-icon">${ICONS.pos}</span>${en?'POS':'POS'}</div>
          <div class="lif-item"><span class="lif-icon">${ICONS.customers}</span>${en?'Customers':'Pelanggan'}</div>
        </div>
      </div>
    </div>`;
  if(state.authBusy){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box" style="text-align:center;">
        <div class="login-brand">
          <div class="mark"><img src="${SERVISPRO_LOGO_DATA_URI}" alt="ServisPro" width="120" height="120" style="border-radius:16px;"></div>
          <div class="wordmark">ServisPro</div>
          <div class="wordmark-tagline">${en?'Vehicle Workshop Management Software':'Perisian Pengurusan Bengkel Kenderaan'}</div>
          <div class="wordmark-credit">by Tomas Sual</div>
          <div class="sub">${en?'Signing in…':'Sedang log masuk…'}</div>
        </div>
      </div>
    </div>`;
  }
  const logoBlock = `<div class="mark"><img src="${SERVISPRO_LOGO_DATA_URI}" alt="ServisPro" width="120" height="120" style="border-radius:16px;"></div><div class="wordmark">ServisPro</div><div class="wordmark-tagline">${en?'Vehicle Workshop Management Software':'Perisian Pengurusan Bengkel Kenderaan'}</div><div class="wordmark-credit">by Tomas Sual</div>`;
  const errBlock = state.loginError ? `<div style="font-size:12px;color:var(--danger);margin-bottom:10px;">${state.loginError}</div>` : '';
  const noticeBlock = state.loginNotice ? `<div style="font-size:12px;color:var(--success);margin-bottom:10px;">${state.loginNotice}</div>` : '';
  const mode = state.authMode || 'login';

  if(mode==='faceid-lock'){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Welcome back':'Selamat kembali'}</div></div>
        <div class="panel" style="text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">${ICONS.faceid}</div>
          ${errBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-faceid-unlock">${en?'Unlock with Face ID':'Buka dengan Face ID'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="faceid-use-password" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Use email & password instead':'Guna e-mel & kata laluan sebaliknya'}</span>
        </div>
      </div>
    </div>`;
  }

  if(mode==='mfa-challenge'){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Two-Factor Verification':'Pengesahan Dua Faktor'}</div></div>
        <div class="panel">
          <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Enter the 6-digit code from your authenticator app.':'Masukkan kod 6 digit dari aplikasi authenticator anda.'}</p>
          <div class="field"><input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:20px;letter-spacing:6px;"></div>
          ${errBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-mfa-verify">${en?'Verify':'Sahkan'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="mfa-cancel" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Back to log in':'Kembali ke log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  if(mode==='reset'){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Set a New Password':'Tetapkan Kata Laluan Baharu'}</div></div>
        <div class="panel">
          <div class="field"><label>${en?'New Password':'Kata Laluan Baharu'}</label><input id="reset-password" type="password" placeholder="••••••••" autocomplete="new-password"></div>
          ${errBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-reset-password">${en?'Save New Password':'Simpan Kata Laluan'}</button>
        </div>
      </div>
    </div>`;
  }

  if(mode==='forgot'){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Reset Password':'Reset Kata Laluan'}</div></div>
        <div class="panel">
          <div class="field"><label>${en?'Email':'E-mel'}</label><input id="forgot-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
          ${errBlock}${noticeBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-forgot-password">${en?'Send Reset Link':'Hantar Pautan Reset'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="auth-mode-login" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Back to log in':'Kembali ke log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  if(mode==='signup'){
    return `
    <div class="login-screen login-screen-auth">
      ${featuresPanel}
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Create Account':'Daftar Akaun'}</div></div>
        <div class="panel">
          <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Use the same email your Admin added you with in Settings → Staff.':'Guna e-mel yang sama seperti yang Admin tambah di Tetapan → Staf.'}</p>
          <div class="field"><label>${en?'Email':'E-mel'}</label><input id="signup-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
          <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="signup-password" type="password" placeholder="${en?'At least 6 characters':'Sekurang-kurangnya 6 aksara'}" autocomplete="new-password"></div>
          ${errBlock}${noticeBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-signup">${en?'Create Account':'Daftar Akaun'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="auth-mode-login" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Already have an account? Log in':'Sudah ada akaun? Log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="login-screen login-screen-auth">
    ${featuresPanel}
    <div class="login-box">
      <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
        ${languagePickerHTML()}
      </div>
      <div class="login-brand">
        ${logoBlock}
        <div class="sub">${t('login_title')}</div>
      </div>
      <div class="panel">
        <div class="field"><label>${en?'Email':'E-mel'}</label><input id="login-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
        <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="login-password" type="password" placeholder="••••••••" autocomplete="current-password"></div>
        ${errBlock}
        <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-login">${en?'Log In':'Log Masuk'}</button>
        <div style="text-align:right;margin-top:8px;">
          <span class="clickable" data-action="auth-mode-forgot" style="font-size:11.5px;color:var(--text-muted);text-decoration:underline;">${en?'Forgot password?':'Lupa kata laluan?'}</span>
        </div>
      </div>
      <div style="text-align:center;margin-top:18px;display:flex;flex-direction:column;gap:8px;">
        <span class="clickable" data-action="auth-mode-signup" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'New staff? Create an account':'Staf baharu? Daftar akaun'}</span>
        <span class="clickable" data-action="open-kiosk" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${ICONS.gauge} ${t('kiosk_link')}</span>
        <span class="clickable" data-action="open-board" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${ICONS.gauge} ${en?'Open Waiting Area Display Board':'Buka Papan Paparan Kawasan Menunggu'}</span>
      </div>
    </div>
  </div>`;
}


function initials(name){
  return (name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

function setAuthMode(mode){
  state.authMode = mode;
  state.loginError = '';
  state.loginNotice = '';
  render();
}

function attachLoginHandlers(){
  const en = state.language==='en';
  const kioskLink = document.querySelector('[data-action="open-kiosk"]');
  if(kioskLink) kioskLink.addEventListener('click', ()=>{ state.kioskMode=true; state.kioskQuery=''; state.kioskResult=null; render(); });
  const boardLink = document.querySelector('[data-action="open-board"]');
  if(boardLink) boardLink.addEventListener('click', ()=>{ state.boardMode=true; state.boardJobs=null; render(); });
  bindLanguagePickers();

  document.querySelectorAll('[data-action="auth-mode-login"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('login')));
  document.querySelectorAll('[data-action="auth-mode-signup"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('signup')));
  document.querySelectorAll('[data-action="auth-mode-forgot"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('forgot')));

  const bindEnter = (id, fn)=>{ const el = document.getElementById(id); if(el) el.addEventListener('keydown', e=>{ if(e.key==='Enter') fn(); }); };

  // ---- log in ----
  const doLogin = async ()=>{
    const email = (document.getElementById('login-email')||{}).value?.trim() || '';
    const password = (document.getElementById('login-password')||{}).value || '';
    if(!email || !password){
      state.loginError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
      render();
      return;
    }
    state.loginError = '';
    state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){
      state.authBusy = false;
      state.loginError = en ? 'Incorrect email or password.' : 'E-mel atau kata laluan salah.';
      render();
      return;
    }
    await resolveSessionOrChallengeMfa(data.session);
  };
  const loginBtn = document.querySelector('[data-action="do-login"]');
  if(loginBtn) loginBtn.addEventListener('click', doLogin);
  bindEnter('login-email', doLogin);
  bindEnter('login-password', doLogin);

  // ---- sign up (self-service; only links to a staff row an Admin already added by email) ----
  const doSignup = async ()=>{
    const email = (document.getElementById('signup-email')||{}).value?.trim() || '';
    const password = (document.getElementById('signup-password')||{}).value || '';
    if(!email || !password){
      state.loginError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
      render();
      return;
    }
    if(password.length<6){
      state.loginError = en ? 'Password must be at least 6 characters.' : 'Kata laluan mesti sekurang-kurangnya 6 aksara.';
      render();
      return;
    }
    state.loginError = ''; state.loginNotice = ''; state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if(error){
      state.authBusy = false;
      state.loginError = error.message || (en ? 'Could not create account.' : 'Gagal mencipta akaun.');
      render();
      return;
    }
    if(data.session){
      // Email confirmation is off for this project — session is active immediately.
      await handleAuthenticated(data.session);
    } else {
      // Email confirmation required — they'll click a link, then log in normally.
      state.authBusy = false;
      state.authMode = 'login';
      state.loginNotice = en ? 'Account created — check your email to confirm, then log in.' : 'Akaun dicipta — semak e-mel anda untuk sahkan, kemudian log masuk.';
      render();
    }
  };
  const signupBtn = document.querySelector('[data-action="do-signup"]');
  if(signupBtn) signupBtn.addEventListener('click', doSignup);
  bindEnter('signup-email', doSignup);
  bindEnter('signup-password', doSignup);

  // ---- forgot password ----
  const doForgotPassword = async ()=>{
    const email = (document.getElementById('forgot-email')||{}).value?.trim() || '';
    if(!email){
      state.loginError = en ? 'Enter your email.' : 'Masukkan e-mel anda.';
      render();
      return;
    }
    state.loginError = ''; state.loginNotice = ''; state.authBusy = true;
    render();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
    state.authBusy = false;
    if(error){
      state.loginError = error.message || (en ? 'Could not send reset email.' : 'Gagal menghantar e-mel reset.');
      render();
      return;
    }
    state.loginNotice = en ? 'If that email has an account, a reset link has been sent.' : 'Jika e-mel itu ada akaun, pautan reset telah dihantar.';
    render();
  };
  const forgotBtn = document.querySelector('[data-action="do-forgot-password"]');
  if(forgotBtn) forgotBtn.addEventListener('click', doForgotPassword);
  bindEnter('forgot-email', doForgotPassword);

  // ---- set new password (arrived via recovery email link) ----
  const doResetPassword = async ()=>{
    const password = (document.getElementById('reset-password')||{}).value || '';
    if(password.length<6){
      state.loginError = en ? 'Password must be at least 6 characters.' : 'Kata laluan mesti sekurang-kurangnya 6 aksara.';
      render();
      return;
    }
    state.loginError = ''; state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if(error){
      state.authBusy = false;
      state.loginError = error.message || (en ? 'Could not update password.' : 'Gagal kemas kini kata laluan.');
      render();
      return;
    }
    state.authMode = 'login';
    const restoredSession = (await supabaseClient.auth.getSession()).data.session;
    await resolveSessionOrChallengeMfa(restoredSession || (data.user ? { user: data.user } : null));
  };
  const resetBtn = document.querySelector('[data-action="do-reset-password"]');
  if(resetBtn) resetBtn.addEventListener('click', doResetPassword);
  bindEnter('reset-password', doResetPassword);

  // ---- 2FA challenge (after password, before the app actually opens) ----
  const doMfaVerify = async ()=>{
    const code = (document.getElementById('mfa-code')||{}).value?.trim() || '';
    if(!/^\d{6}$/.test(code)){
      state.loginError = en ? 'Enter the 6-digit code.' : 'Masukkan kod 6 digit.';
      render();
      return;
    }
    if(!state.mfaChallenge){ setAuthMode('login'); return; }
    state.loginError = ''; state.authBusy = true;
    render();
    const { error } = await supabaseClient.auth.mfa.verify({ factorId: state.mfaChallenge.factorId, challengeId: state.mfaChallenge.challengeId, code });
    if(error){
      state.authBusy = false;
      state.loginError = en ? 'Incorrect or expired code. Try again.' : 'Kod salah atau tamat tempoh. Cuba lagi.';
      // A used/expired challenge can't be retried — start a fresh one against the same factor.
      const { data: fresh } = await supabaseClient.auth.mfa.challenge({ factorId: state.mfaChallenge.factorId });
      if(fresh) state.mfaChallenge = { factorId: state.mfaChallenge.factorId, challengeId: fresh.id };
      render();
      return;
    }
    state.mfaChallenge = null;
    state.authMode = 'login';
    const { data:{ session } } = await supabaseClient.auth.getSession();
    await handleAuthenticated(session);
  };
  const mfaBtn = document.querySelector('[data-action="do-mfa-verify"]');
  if(mfaBtn) mfaBtn.addEventListener('click', doMfaVerify);
  bindEnter('mfa-code', doMfaVerify);
  const mfaCancelBtn = document.querySelector('[data-action="mfa-cancel"]');
  if(mfaCancelBtn) mfaCancelBtn.addEventListener('click', async ()=>{
    state.mfaChallenge = null;
    await supabaseClient.auth.signOut();
    setAuthMode('login');
  });

  // ---- Face ID lock screen (session already cached — biometric is just the re-entry gate) ----
  const faceIdBtn = document.querySelector('[data-action="do-faceid-unlock"]');
  if(faceIdBtn) faceIdBtn.addEventListener('click', async ()=>{
    state.loginError = '';
    state.authBusy = true;
    render();
    const ok = await tryFaceIdUnlock();
    if(!ok){
      state.authBusy = false;
      state.loginError = en ? 'Face ID failed or was cancelled. Try again, or use your password.' : 'Face ID gagal atau dibatalkan. Cuba lagi, atau guna kata laluan.';
      render();
      return;
    }
    const session = pendingFaceIdSession;
    pendingFaceIdSession = null;
    state.authMode = 'login';
    await resolveSessionOrChallengeMfa(session);
  });
  const faceIdFallback = document.querySelector('[data-action="faceid-use-password"]');
  if(faceIdFallback) faceIdFallback.addEventListener('click', ()=>{
    pendingFaceIdSession = null;
    setAuthMode('login');
  });
}

/* ---------- CONFIRM MODAL ---------- */
/* ---------- KIOSK MODE (public status check, no login) ----------
   Looks up via the kiosk_lookup_job()/kiosk_submit_feedback() RPCs (see
   backend/schema.sql) instead of reading db.jobs directly -- jobs/vehicles
   require an authenticated session under normal RLS, so a real customer
   opening this on their own phone (never logged in, db still empty) would
   otherwise always see "no record found" even for a job that exists. The
   RPCs are security-definer and deliberately return only the minimal
   fields this screen needs (no customer name/phone, no pricing, no
   internal notes). */
function renderKioskScreen(){
  const en = state.language==='en';
  const tab = state.kioskTab || 'status';
  return `
  <div class="login-screen">
    <div class="login-box">
      <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
        ${languagePickerHTML()}
      </div>
      <div class="login-brand">
        <div class="mark">${logoMarkHtml(112)}</div>
        <div class="sub">${en?'Customer Self-Service':'Layanan Kendiri Pelanggan'}</div>
      </div>
      <div class="tabs" style="justify-content:center;margin:0 auto 14px;">
        <div class="tab-btn ${tab==='status'?'active':''}" data-kiosktab="status">${en?'Job Status':'Status Kerja'}</div>
        <div class="tab-btn ${tab==='history'?'active':''}" data-kiosktab="history">${en?'Service History':'Sejarah Servis'}</div>
        <div class="tab-btn ${tab==='book'?'active':''}" data-kiosktab="book">${en?'Book Service':'Tempah Servis'}</div>
        <div class="tab-btn ${tab==='account'?'active':''}" data-kiosktab="account">${en?'My Account':'Akaun Saya'}</div>
      </div>
      <div class="panel">
        ${tab==='status' ? kioskStatusTabHTML() : tab==='history' ? kioskHistoryTabHTML() : tab==='book' ? kioskBookingTabHTML() : kioskAccountTabHTML()}
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="close-kiosk" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">← ${en?'Back to Staff Log In':'Kembali ke Log Masuk Staf'}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function kioskStatusTabHTML(){
  const en = state.language==='en';
  const result = state.kioskResult;
  const statusLabel = en
    ? {waiting:'Waiting in Queue', progress:'Being Worked On', done:'Ready for Pickup', delivered:'Delivered'}
    : {waiting:'Menunggu Giliran', progress:'Sedang Dikerjakan', done:'Siap, Sedia Diambil', delivered:'Telah Dihantar'};
  const statusDesc = en ? {
    waiting:'Your vehicle has been registered and is waiting for a mechanic.',
    progress:'Our mechanic is working on your vehicle right now.',
    done:'The job is done! Your vehicle is ready to be picked up.',
    delivered:'Vehicle has been delivered/picked up. Thank you for using our service.'
  } : {
    waiting:'Kenderaan anda telah didaftarkan dan sedang menunggu giliran mekanik.',
    progress:'Mekanik kami sedang mengerjakan kenderaan anda sekarang.',
    done:'Kerja telah siap! Kenderaan anda sedia untuk diambil.',
    delivered:'Kenderaan telah dihantar/diambil. Terima kasih kerana menggunakan perkhidmatan kami.'
  };
  return `
    <div class="field"><label>${en?'Job No. or Plate No.':'No. Kad Kerja atau No. Plat'}</label>
      <input id="kiosk-input" placeholder="${en?'e.g. WS-0001 or WXY 1234':'cth: WS-0001 atau WXY 1234'}" value="${esc(state.kioskQuery||'')}">
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="kiosk-check" ${result==='loading'?'disabled':''}>${ICONS.search} ${result==='loading'?(en?'Checking…':'Sedang semak…'):(en?'Check Status':'Semak Status')}</button>
    ${result==='notfound' ? `<div class="empty" style="padding:20px 0 0;">${en?'No record found. Please check the job/plate number again.':'Tiada rekod dijumpai. Sila semak semula no. kad kerja / plat.'}</div>` : ''}
    ${result && result!=='notfound' && result!=='loading' ? `
      <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted);">${esc(result.jobNo)}</div>
        <div style="font-size:16px;font-weight:700;margin:4px 0;">${esc(result.plate||'-')} ${result.model?'· '+esc(result.model):''}</div>
        <span class="pill pill-${result.status==='waiting'?'wait':result.status}">${statusLabel[result.status]}</span>
        <p style="font-size:12.5px;color:var(--text-muted);margin-top:12px;">${statusDesc[result.status]}</p>
      </div>
      ${result.status==='delivered' ? renderKioskFeedback(result) : ''}` : ''}
  `;
}

function kioskHistoryTabHTML(){
  const en = state.language==='en';
  const result = state.historyResult;
  const statusLabel = en
    ? {waiting:'Waiting', progress:'In Progress', done:'Ready', delivered:'Delivered'}
    : {waiting:'Menunggu', progress:'Dalam Proses', done:'Siap', delivered:'Dihantar'};
  return `
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Enter your vehicle plate and the phone number on file to view its full service history.':'Masukkan no. plat kenderaan dan no. telefon yang didaftarkan untuk lihat sejarah servis penuh.'}</p>
    <div class="field"><label>${en?'Plate No.':'No. Plat'}</label><input id="history-plate" placeholder="${en?'e.g. WXY 1234':'cth: WXY 1234'}" value="${esc(state.historyPlate||'')}"></div>
    <div class="field"><label>${en?'Phone No.':'No. Telefon'}</label><input id="history-phone" type="tel" placeholder="012-3456789" value="${esc(state.historyPhone||'')}"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="history-check" ${result==='loading'?'disabled':''}>${ICONS.search} ${result==='loading'?(en?'Checking…':'Sedang semak…'):(en?'View History':'Lihat Sejarah')}</button>
    ${result==='notfound' ? `<div class="empty" style="padding:20px 0 0;">${en?'No matching record. Check the plate and phone number.':'Tiada rekod sepadan. Semak no. plat dan telefon.'}</div>` : ''}
    ${result && result!=='notfound' && result!=='loading' ? `
      <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border);">
        <div style="font-size:16px;font-weight:700;margin-bottom:10px;">${esc(result.plate||'-')} ${result.model?'· '+esc(result.model):''}</div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin-bottom:6px;">${en?'Jobs':'Kerja'}</div>
        ${result.jobs.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);">${en?'No jobs yet.':'Belum ada kerja.'}</div>` : result.jobs.map(j=>`
          <div style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="min-width:0;">
              <div style="font-size:12.5px;font-weight:600;">${esc(j.description||'-')}</div>
              <div style="font-size:11px;color:var(--text-muted);">${fmtDate(j.createdAt)}</div>
            </div>
            <span class="pill pill-${j.status==='waiting'?'wait':j.status}" style="flex-shrink:0;">${statusLabel[j.status]||j.status}</span>
          </div>`).join('')}
        ${result.invoices.length>0 ? `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin:14px 0 6px;">${en?'Invoices':'Invois'}</div>
        ${result.invoices.map(i=>`
          <div style="display:flex;justify-content:space-between;padding:7px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="font-size:12.5px;font-family:'IBM Plex Mono',monospace;">${esc(i.invoiceNo)}</div>
            <div style="font-size:12.5px;color:var(--text-muted);">${fmtDate(i.createdAt)}</div>
            <div style="font-size:12.5px;font-weight:700;color:var(--accent);">${fmtRM(i.total)}</div>
          </div>`).join('')}` : ''}
      </div>` : ''}
  `;
}

function kioskBookingTabHTML(){
  const en = state.language==='en';
  if(state.bookSubmitted){
    return `<div class="empty" style="padding:30px 0;">${ICONS.done||''}<div style="margin-top:8px;">${en?"Request sent! We'll contact you shortly to confirm.":'Permohonan dihantar! Kami akan hubungi anda tidak lama lagi untuk sahkan.'}</div></div>`;
  }
  return `
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?"Request a service slot — we'll call to confirm the exact time.":'Mohon slot servis — kami akan telefon untuk sahkan masa sebenar.'}</p>
    <div class="field"><label>${en?'Your Name':'Nama Anda'}</label><input id="book-name" placeholder="${en?'Full name':'Nama penuh'}" value="${esc(state.bookName||'')}"></div>
    <div class="field"><label>${en?'Phone No.':'No. Telefon'}</label><input id="book-phone" type="tel" placeholder="012-3456789" value="${esc(state.bookPhone||'')}"></div>
    <div class="field"><label>${en?'Plate No.':'No. Plat'}</label><input id="book-plate" placeholder="${en?'e.g. WXY 1234':'cth: WXY 1234'}" value="${esc(state.bookPlate||'')}"></div>
    <div class="field-row">
      <div class="field"><label>${en?'Preferred Date':'Tarikh Dikehendaki'}</label><input id="book-date" type="date" value="${esc(state.bookDate||'')}"></div>
      <div class="field"><label>${en?'Preferred Time':'Masa Dikehendaki'}</label><input id="book-time" type="time" value="${esc(state.bookTime||'')}"></div>
    </div>
    <div class="field"><label>${en?'What service do you need?':'Servis apa yang diperlukan?'}</label><textarea id="book-notes" rows="2" placeholder="${en?'e.g. Oil change, brake check':'cth: Tukar minyak, semak brek'}">${esc(state.bookNotes||'')}</textarea></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="book-submit" ${state.bookBusy?'disabled':''}>${state.bookBusy?(en?'Sending…':'Menghantar…'):(en?'Send Request':'Hantar Permohonan')}</button>
  `;
}

// An account is entirely optional -- every other tab above already works
// with no login at all. This just lets a repeat customer see everything
// (vehicles, jobs, quotations, invoices, appointments) in one dashboard
// instead of needing a fresh shared link every time. See
// src/customer-portal.js for the separate customer-auth-session logic.
function kioskAccountTabHTML(){
  const en = state.language==='en';
  if(!state.custPortalChecked){
    return `<p style="text-align:center;color:var(--text-muted);padding:20px 0;">${en?'Checking…':'Sedang semak…'}</p>`;
  }
  const errBlock = state.custPortalError ? `<div style="font-size:12px;color:var(--danger);margin-bottom:10px;">${esc(state.custPortalError)}</div>` : '';
  const noticeBlock = state.custPortalNotice ? `<div style="font-size:12px;color:var(--success);margin-bottom:10px;">${esc(state.custPortalNotice)}</div>` : '';
  const mode = state.custPortalMode;

  if(mode==='dashboard'){
    const data = state.custPortalData;
    const statusLabel = en
      ? {waiting:'Waiting', progress:'In Progress', done:'Ready', delivered:'Delivered', scheduled:'Scheduled', cancelled:'Cancelled'}
      : {waiting:'Menunggu', progress:'Dalam Proses', done:'Siap', delivered:'Dihantar', scheduled:'Dijadualkan', cancelled:'Dibatalkan'};
    const quoteStatusLabel = en
      ? {draft:'Draft', sent:'Awaiting your response', accepted:'Approved', rejected:'Rejected', converted:'Converted', expired:'Expired'}
      : {draft:'Draf', sent:'Menunggu respons anda', accepted:'Diluluskan', rejected:'Ditolak', converted:'Ditukar', expired:'Tamat Tempoh'};
    const loaded = data && data!=='loading';
    const points = loaded ? (data.loyaltyPoints||0) : 0;
    // countryCode/shopPhone come from get_my_customer_data() (see
    // backend/schema.sql) rather than the staff-side db.settings/
    // normalizePhone() -- this screen is reachable with no staff session at
    // all, so db.settings is never populated here.
    const shopTelHref = loaded && data.shopPhone ? '+' + kioskNormalizePhone(data.shopPhone, data.countryCode) : null;
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;color:var(--text-muted);">${en?'Welcome':'Selamat Datang'}</div>
          <div style="font-size:15px;font-weight:700;">${esc((state.custPortalProfile&&state.custPortalProfile.name)||'')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          ${points>0 ? `<div title="${en?'Loyalty points':'Mata Kesetiaan'}" style="display:flex;align-items:center;gap:4px;background:rgba(230,163,53,.15);color:var(--accent);padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;">${ICONS.star} ${points}</div>` : ''}
          <button class="btn-icon" data-action="cust-portal-logout" title="${en?'Log out':'Log keluar'}">${ICONS.logout||''}</button>
        </div>
      </div>
      ${!loaded ? `<p style="text-align:center;color:var(--text-muted);">${en?'Loading…':'Memuatkan…'}</p>` : `
        ${data.vehicles.length>0 ? `
        <div style="background:var(--panel-alt);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;">
          <div style="width:48px;height:48px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ICONS.car}</div>
          <div style="min-width:0;">
            <div style="font-size:15px;font-weight:700;">${esc(data.vehicles[0].plate)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${esc(data.vehicles[0].model||'-')}</div>
          </div>
        </div>
        ${data.vehicles.length>1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${data.vehicles.slice(1).map(v=>`<span class="pill" style="background:var(--panel-alt);">${esc(v.plate)}</span>`).join('')}</div>` : '<div style="margin-bottom:16px;"></div>'}
        ` : ''}

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;">
          <div class="clickable" data-kiosktab="book" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--panel-alt);display:flex;align-items:center;justify-content:center;">${ICONS.calendar}</div>
            <span style="font-size:10.5px;line-height:1.25;">${en?'Book Service':'Tempah Servis'}</span>
          </div>
          <div class="clickable" data-kiosktab="status" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--panel-alt);display:flex;align-items:center;justify-content:center;">${ICONS.gauge}</div>
            <span style="font-size:10.5px;line-height:1.25;">${en?'Job Status':'Status Kerja'}</span>
          </div>
          <div class="clickable" data-kiosktab="history" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--panel-alt);display:flex;align-items:center;justify-content:center;">${ICONS.history}</div>
            <span style="font-size:10.5px;line-height:1.25;">${en?'Service History':'Sejarah Servis'}</span>
          </div>
          ${shopTelHref ? `
          <a href="tel:${shopTelHref}" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;color:inherit;text-decoration:none;">
            <div style="width:42px;height:42px;border-radius:50%;background:rgba(217,68,68,.14);color:var(--danger);display:flex;align-items:center;justify-content:center;">${ICONS.phone}</div>
            <span style="font-size:10.5px;line-height:1.25;">${en?'Road Assist':'Bantuan Jalan'}</span>
          </a>` : `
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;opacity:.4;">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--panel-alt);display:flex;align-items:center;justify-content:center;">${ICONS.phone}</div>
            <span style="font-size:10.5px;line-height:1.25;">${en?'Road Assist':'Bantuan Jalan'}</span>
          </div>`}
        </div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin:14px 0 6px;">${en?'Quotations':'Sebut Harga'}</div>
        ${data.quotations.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">${en?'None yet.':'Belum ada.'}</div>` : data.quotations.map(q=>`
          <div style="padding:8px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="display:flex;justify-content:space-between;gap:8px;">
              <div style="font-size:12.5px;font-family:'IBM Plex Mono',monospace;">${esc(q.quoteNo)}</div>
              <div style="font-size:12.5px;font-weight:700;color:var(--accent);">${fmtRM(q.total)}</div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${quoteStatusLabel[q.status]||q.status}</div>
            ${q.status==='sent' ? `<div style="display:flex;gap:6px;margin-top:6px;">
              <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" data-action="cust-portal-reject-quote" data-id="${q.id}">${en?'Reject':'Tolak'}</button>
              <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" data-action="cust-portal-approve-quote" data-id="${q.id}">${en?'Approve':'Luluskan'}</button>
            </div>` : ''}
          </div>
        `).join('')}

        <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 6px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);">${en?'Last Service History':'Sejarah Servis Terkini'}</div>
          ${data.jobs.length>0 ? `<span class="clickable" data-kiosktab="history" style="font-size:11px;color:var(--accent);font-weight:700;">${en?'View All':'Lihat Semua'}</span>` : ''}
        </div>
        ${data.jobs.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">${en?'No service history yet.':'Belum ada sejarah servis.'}</div>` : data.jobs.slice(0,5).map(j=>`
          <div style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="font-size:12.5px;">${esc(j.description||j.jobNo)}</div>
            <span class="pill pill-${j.status==='waiting'?'wait':j.status}">${statusLabel[j.status]||j.status}</span>
          </div>
        `).join('')}

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin:14px 0 6px;">${en?'Invoices':'Invois'}</div>
        ${data.invoices.length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">${en?'None yet.':'Belum ada.'}</div>` : data.invoices.map(i=>`
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="font-size:12.5px;font-family:'IBM Plex Mono',monospace;">${esc(i.invoiceNo)}</div>
            <div style="font-size:12.5px;font-weight:700;color:var(--accent);">${fmtRM(i.total)}</div>
            <button class="btn-icon" data-action="cust-portal-view-invoice" data-id="${i.id}" title="${en?'View / Print':'Lihat / Cetak'}">${ICONS.printer}</button>
          </div>
        `).join('')}

        ${data.appointments.length>0 ? `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin:14px 0 6px;">${en?'Appointments':'Janji Temu'}</div>
        ${data.appointments.map(a=>`
          <div style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:5px;">
            <div style="font-size:12.5px;">${esc(a.date)} · ${esc(a.time)}</div>
            <span class="pill pill-${a.status==='done'?'done':a.status==='cancelled'?'low':'wait'}">${statusLabel[a.status]||a.status}</span>
          </div>
        `).join('')}` : ''}
      `}
    `;
  }

  if(mode==='link'){
    return `
      ${errBlock}
      <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?"One more step — enter your phone number so we can find your existing records (or create a new profile).":'Satu langkah lagi — masukkan no. telefon anda supaya kami dapat cari rekod sedia ada (atau cipta profil baharu).'}</p>
      <div class="field"><label>${en?'Your Name':'Nama Anda'}</label><input id="cp-name" placeholder="${en?'Full name':'Nama penuh'}" value="${esc(state.custPortalName||'')}"></div>
      <div class="field"><label>${en?'Phone No.':'No. Telefon'}</label><input id="cp-phone" type="tel" placeholder="012-3456789" value="${esc(state.custPortalPhone||'')}"></div>
      <div class="field"><label>${en?'Vehicle Plate No. (optional)':'No. Plat Kenderaan (pilihan)'}</label><input id="cp-plate" placeholder="${en?'e.g. WXY1234':'cth. WXY1234'}" value="${esc(state.custPortalPlate||'')}"></div>
      <p style="font-size:11.5px;color:var(--text-muted);margin-top:-6px;">${en?"If your vehicle is already registered with us, enter its plate number to automatically link your existing service history.":'Jika kenderaan anda sudah didaftarkan dengan kami, masukkan no. plat untuk pautkan sejarah servis sedia ada secara automatik.'}</p>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="cust-portal-link" ${state.custPortalBusy?'disabled':''}>${state.custPortalBusy?(en?'Saving…':'Menyimpan…'):(en?'Continue':'Teruskan')}</button>
    `;
  }

  if(mode==='forgot'){
    return `
      ${errBlock}${noticeBlock}
      <div class="field"><label>${en?'Email':'E-mel'}</label><input id="cp-email" type="email" placeholder="nama@contoh.com" value="${esc(state.custPortalEmail||'')}"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="cust-portal-forgot" ${state.custPortalBusy?'disabled':''}>${en?'Send Reset Link':'Hantar Pautan Reset'}</button>
      <div style="text-align:center;margin-top:14px;">
        <span class="clickable" data-action="cust-portal-mode-login" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">${en?'Back to log in':'Kembali ke log masuk'}</span>
      </div>
    `;
  }

  if(mode==='signup'){
    return `
      ${errBlock}${noticeBlock}
      <div class="field"><label>${en?'Email':'E-mel'}</label><input id="cp-email" type="email" placeholder="nama@contoh.com" value="${esc(state.custPortalEmail||'')}"></div>
      <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="cp-password" type="password" placeholder="${en?'At least 6 characters':'Sekurang-kurangnya 6 aksara'}"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="cust-portal-signup" ${state.custPortalBusy?'disabled':''}>${state.custPortalBusy?(en?'Creating…':'Mencipta…'):(en?'Create Account':'Daftar Akaun')}</button>
      <div style="text-align:center;margin-top:14px;">
        <span class="clickable" data-action="cust-portal-mode-login" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">${en?'Already have an account? Log in':'Sudah ada akaun? Log masuk'}</span>
      </div>
    `;
  }

  // default: login
  return `
    <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?"Optional — see all your service history, quotations and invoices in one place. Not registered? Every other tab above still works without an account.":'Pilihan — lihat semua sejarah servis, sebut harga dan invois anda di satu tempat. Belum daftar? Tab lain di atas tetap berfungsi tanpa akaun.'}</p>
    ${errBlock}${noticeBlock}
    <div class="field"><label>${en?'Email':'E-mel'}</label><input id="cp-email" type="email" placeholder="nama@contoh.com" value="${esc(state.custPortalEmail||'')}"></div>
    <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="cp-password" type="password" placeholder="••••••••"></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="cust-portal-login" ${state.custPortalBusy?'disabled':''}>${state.custPortalBusy?(en?'Logging in…':'Sedang log masuk…'):(en?'Log In':'Log Masuk')}</button>
    <div style="text-align:center;margin-top:14px;display:flex;flex-direction:column;gap:6px;">
      <span class="clickable" data-action="cust-portal-mode-forgot" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">${en?'Forgot password?':'Lupa kata laluan?'}</span>
      <span class="clickable" data-action="cust-portal-mode-signup" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">${en?'New here? Create an account':'Baharu di sini? Daftar akaun'}</span>
    </div>
  `;
}

function renderKioskFeedback(job){
  const en = state.language==='en';
  if(job.rating){
    return `<div style="margin-top:14px;padding:12px;background:rgba(79,165,121,.12);border-radius:8px;text-align:center;">
      <div style="font-size:20px;">${'⭐'.repeat(job.rating)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${en?'Thank you for your feedback!':'Terima kasih atas maklum balas anda!'}</div>
    </div>`;
  }
  const rating = state.kioskRatingValue||0;
  return `
  <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);">
    <label style="display:block;margin-bottom:8px;">${en?'How was our service?':'Bagaimana perkhidmatan kami?'}</label>
    <div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;">
      ${[1,2,3,4,5].map(n=>`<span class="clickable" data-kiosk-star="${n}" style="font-size:26px;filter:${n<=rating?'none':'grayscale(1) opacity(0.4)'};">⭐</span>`).join('')}
    </div>
    <textarea id="kiosk-feedback-text" rows="2" placeholder="${en?'Comments (optional)':'Ulasan (pilihan)'}"></textarea>
    <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" data-action="submit-feedback" data-id="${job.id}">${en?'Send Feedback':'Hantar Maklum Balas'}</button>
  </div>`;
}

function attachKioskHandlers(){
  bindAction('close-kiosk', ()=>{
    state.kioskMode=false; state.kioskTab='status'; state.kioskQuery=''; state.kioskResult=null; state.kioskRatingValue=0;
    state.historyPlate=''; state.historyPhone=''; state.historyResult=null;
    state.bookName=''; state.bookPhone=''; state.bookPlate=''; state.bookDate=''; state.bookTime=''; state.bookNotes=''; state.bookSubmitted=false;
    // Not a logout -- the customer-portal session (if any) is persisted
    // separately and should still be there next time. Just re-check it
    // fresh (clears any stale error/notice from this visit) rather than
    // trusting whatever custPortalMode was left on.
    state.custPortalChecked = false; state.custPortalError = ''; state.custPortalNotice = '';
    render();
  });
  bindLanguagePickers();
  document.querySelectorAll('[data-kiosktab]').forEach(el=>el.addEventListener('click', ()=>{
    state.kioskTab = el.dataset.kiosktab;
    render();
  }));
  if(state.kioskTab==='account' && !state.custPortalChecked){
    checkCustPortalSession();
  }
  const doKioskCheck = async ()=>{
    const q = (document.getElementById('kiosk-input')||{}).value?.trim() || '';
    state.kioskQuery = q;
    if(!q){ state.kioskResult = null; render(); return; }
    state.kioskResult = 'loading';
    render();
    try{
      const { data, error } = await supabaseClient.rpc('kiosk_lookup_job', { query: q });
      if(error) throw error;
      state.kioskResult = data || 'notfound';
    }catch(e){
      reportError(e, 'Semak status kiosk gagal');
      state.kioskResult = 'notfound';
    }
    render();
    focusEnd('kiosk-input');
  };
  bindAction('kiosk-check', doKioskCheck);
  const kInput = document.getElementById('kiosk-input');
  if(kInput) kInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doKioskCheck(); });
  document.querySelectorAll('[data-kiosk-star]').forEach(el=>el.addEventListener('click', ()=>{
    state.kioskRatingValue = Number(el.dataset.kioskStar);
    render();
  }));
  bindAllAction('submit-feedback', async el=>{
    if(!state.kioskRatingValue) return;
    const jobId = el.dataset.id;
    const feedback = (document.getElementById('kiosk-feedback-text')||{}).value?.trim() || '';
    const rating = state.kioskRatingValue;
    try{
      const { data: ok, error } = await supabaseClient.rpc('kiosk_submit_feedback', { p_job_id: jobId, p_rating: rating, p_feedback: feedback });
      if(error) throw error;
      if(ok && state.kioskResult && state.kioskResult.id===jobId){
        state.kioskResult = { ...state.kioskResult, rating, feedback };
      }
      state.kioskRatingValue = 0;
      render();
    }catch(e){
      reportError(e, 'Hantar maklum balas kiosk gagal');
      showToast(state.language==='en' ? 'Could not send feedback. Try again.' : 'Gagal hantar maklum balas. Cuba lagi.');
    }
  });

  // ---- service history tab ----
  const doHistoryCheck = async ()=>{
    const en = state.language==='en';
    const plate = (document.getElementById('history-plate')||{}).value?.trim() || '';
    const phone = (document.getElementById('history-phone')||{}).value?.trim() || '';
    state.historyPlate = plate; state.historyPhone = phone;
    if(!plate || !phone){
      showToast(en ? 'Enter both plate and phone number.' : 'Masukkan no. plat dan telefon.');
      return;
    }
    state.historyResult = 'loading';
    render();
    try{
      const { data, error } = await supabaseClient.rpc('kiosk_vehicle_history', { p_plate: plate, p_phone: phone });
      if(error) throw error;
      state.historyResult = data || 'notfound';
    }catch(e){
      reportError(e, 'Semak sejarah servis gagal');
      state.historyResult = 'notfound';
    }
    render();
  };
  bindAction('history-check', doHistoryCheck);
  const hPhone = document.getElementById('history-phone');
  if(hPhone) hPhone.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doHistoryCheck(); });

  // ---- book a service tab ----
  bindAction('book-submit', async ()=>{
    const en = state.language==='en';
    const name = (document.getElementById('book-name')||{}).value?.trim() || '';
    const phone = (document.getElementById('book-phone')||{}).value?.trim() || '';
    const plate = (document.getElementById('book-plate')||{}).value?.trim() || '';
    const date = (document.getElementById('book-date')||{}).value || '';
    const time = (document.getElementById('book-time')||{}).value || '';
    const notes = (document.getElementById('book-notes')||{}).value?.trim() || '';
    Object.assign(state, { bookName:name, bookPhone:phone, bookPlate:plate, bookDate:date, bookTime:time, bookNotes:notes });
    if(!name || !phone){
      showToast(en ? 'Enter your name and phone number.' : 'Masukkan nama dan no. telefon anda.');
      render();
      return;
    }
    state.bookBusy = true;
    render();
    try{
      const { data: ok, error } = await supabaseClient.rpc('kiosk_request_appointment', {
        p_name: name, p_phone: phone, p_plate: plate, p_date: date, p_time: time, p_notes: notes
      });
      if(error) throw error;
      state.bookBusy = false;
      if(ok){
        state.bookSubmitted = true;
      } else {
        showToast(en ? 'Could not send request — check your details and try again.' : 'Gagal hantar permohonan — semak butiran dan cuba lagi.');
      }
      render();
    }catch(e){
      state.bookBusy = false;
      reportError(e, 'Hantar permohonan tempahan gagal');
      showToast(en ? 'Could not send request. Try again.' : 'Gagal hantar permohonan. Cuba lagi.');
      render();
    }
  });

  // ---- my account tab (optional customer-portal login) ----
  const captureCustPortalFields = ()=>{
    const email = (document.getElementById('cp-email')||{}).value?.trim();
    const password = (document.getElementById('cp-password')||{}).value;
    const name = (document.getElementById('cp-name')||{}).value?.trim();
    const phone = (document.getElementById('cp-phone')||{}).value?.trim();
    const plate = (document.getElementById('cp-plate')||{}).value?.trim();
    if(email!==undefined) state.custPortalEmail = email;
    if(password!==undefined) state.custPortalPassword = password;
    if(name!==undefined) state.custPortalName = name;
    if(phone!==undefined) state.custPortalPhone = phone;
    if(plate!==undefined) state.custPortalPlate = plate;
  };
  const setCustPortalMode = (mode)=>{
    captureCustPortalFields();
    state.custPortalMode = mode;
    state.custPortalError = ''; state.custPortalNotice = '';
    render();
  };
  bindAction('cust-portal-mode-login', ()=>setCustPortalMode('login'));
  bindAction('cust-portal-mode-signup', ()=>setCustPortalMode('signup'));
  bindAction('cust-portal-mode-forgot', ()=>setCustPortalMode('forgot'));
  bindAction('cust-portal-login', ()=>{ captureCustPortalFields(); custPortalLogin(); });
  bindAction('cust-portal-signup', ()=>{ captureCustPortalFields(); custPortalSignup(); });
  bindAction('cust-portal-forgot', ()=>{ captureCustPortalFields(); custPortalForgotPassword(); });
  bindAction('cust-portal-link', ()=>{ captureCustPortalFields(); custPortalLinkAccount(); });
  bindAction('cust-portal-logout', custPortalLogout);
  bindAllAction('cust-portal-approve-quote', el=>custPortalRespondQuotation(el.dataset.id, true));
  bindAllAction('cust-portal-reject-quote', el=>custPortalRespondQuotation(el.dataset.id, false));
  bindAllAction('cust-portal-view-invoice', el=>custPortalViewInvoice(el.dataset.id));
}

/* ---------- ONBOARDING TOUR (first-time users) ---------- */
