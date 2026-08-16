/* ============================= RENDER ROUTER ============================= */
// Modal focus management: without this, Tab cycles through the sidebar/page
// content sitting visually behind an open modal (it's a DOM sibling of
// .app, not layered any other way), focus doesn't move into the modal when
// it opens, and closing one leaves focus reset to <body> instead of back on
// whatever button opened it. All three matter for keyboard/screen-reader
// use, which this app's near-total reliance on click-driven modals
// otherwise blocks. renderModal()/renderConfirmModal()/renderOnboarding()
// all share the same .modal-overlay > .modal structure, so one mechanism
// covers every modal type.
// A DOM node reference (not a selector) can't survive across a render --
// render() replaces root.innerHTML wholesale on every call, including the
// very call that opens a modal (it rebuilds the page underneath the modal
// too), which discards and recreates every node, trigger button included.
// So "remember what to refocus" has to be a re-queryable selector built
// from the trigger element's own data-* attribute, not the element itself.
let modalReturnFocusSelector = null;
let modalWasOpen = false;
// document.activeElement can't be trusted at the moment a modal-opening
// render() runs, either: runGuardedAction() (main.js) disables the clicked
// button SYNCHRONOUSLY before calling its handler (the double-click guard),
// and a disabled element loses focus immediately -- by the time render()
// reads document.activeElement, it's already <body>. Track the last
// element the user actually interacted with outside any open modal
// instead, via mousedown (fires before click, so before that disabling)
// and focusin (covers keyboard Tab+Enter activation, which never disables
// anything before firing).
let lastNonModalFocusEl = null;
document.addEventListener('mousedown', (e)=>{
  const t = /** @type {HTMLElement} */ (e.target);
  if(t && t.closest && !t.closest('.modal-overlay')){
    lastNonModalFocusEl = /** @type {HTMLElement} */ (t.closest('button,[data-action],[data-nav],[tabindex]') || t);
  }
}, true);
document.addEventListener('focusin', (e)=>{
  const t = /** @type {HTMLElement} */ (e.target);
  if(t && t.closest && !t.closest('.modal-overlay')) lastNonModalFocusEl = t;
});
function isModalBlocking(){
  return !!(state.modal || state.confirmAction || state.showOnboarding);
}
function getFocusableInModal(){
  const modalEl = document.querySelector('.modal-overlay .modal');
  if(!modalEl) return [];
  return Array.from(modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]'))
    .filter(el=>!el.hasAttribute('disabled') && el.getAttribute('tabindex')!=='-1' && /** @type {HTMLElement} */(el).offsetParent!==null);
}
function selectorForFocusReturn(el){
  if(!el || !el.tagName || el===document.body) return null;
  for(const attr of INTERACTIVE_DATA_ATTRS){
    if(el.hasAttribute(attr)){
      let sel = `[${attr}="${CSS.escape(el.getAttribute(attr)||'')}"]`;
      if(el.hasAttribute('data-id')) sel += `[data-id="${CSS.escape(el.getAttribute('data-id')||'')}"]`;
      return sel;
    }
  }
  return el.id ? '#'+CSS.escape(el.id) : null;
}
function closeActiveModalViaEscape(){
  if(state.confirmAction){ setState({confirmAction:null}); return; }
  if(state.showOnboarding){
    const skipBtn = /** @type {HTMLElement} */ (document.querySelector('[data-action="onboarding-skip"]'));
    if(skipBtn) skipBtn.click();
    return;
  }
  if(state.modal){ setState({modal:null}); }
}

// goBack(): shared by the Escape key (see keydown listener in main.js) and
// the swipe-left gesture (attachSwipeBack() in main.js) -- same priority
// order either way: dismiss whatever's on top (confirm dialog / onboarding
// / modal, reusing closeActiveModalViaEscape's own ordering), then the
// public kiosk overlay (reusing its own full reset via the existing
// close-kiosk action rather than duplicating that reset list here), and
// only once nothing is "on top" does it actually navigate to the previous
// view. Directly mutates state.view (bypassing setState) so going back
// doesn't itself get pushed onto viewHistory -- walking back twice should
// keep going further back, not just toggle between the last two views.
function goBack(){
  if(isModalBlocking()){ closeActiveModalViaEscape(); return; }
  if(state.kioskMode){
    const closeBtn = /** @type {HTMLElement} */ (document.querySelector('[data-action="close-kiosk"]'));
    if(closeBtn) closeBtn.click();
    return;
  }
  const prevView = viewHistory.pop();
  if(prevView && prevView!==state.view){
    state.view = prevView;
    render();
  }
}
function manageModalFocus(){
  const isOpen = isModalBlocking();
  if(isOpen && !modalWasOpen){
    modalReturnFocusSelector = selectorForFocusReturn(lastNonModalFocusEl);
    const modalEl = /** @type {HTMLElement|null} */ (document.querySelector('.modal-overlay .modal'));
    if(modalEl){
      if(!modalEl.hasAttribute('tabindex')) modalEl.setAttribute('tabindex','-1');
      modalEl.focus();
    }
  } else if(!isOpen && modalWasOpen){
    const returnEl = /** @type {HTMLElement|null} */ (modalReturnFocusSelector ? document.querySelector(modalReturnFocusSelector) : null);
    if(returnEl) returnEl.focus();
    modalReturnFocusSelector = null;
  }
  modalWasOpen = isOpen;
}

function render(){
  document.documentElement.setAttribute('data-theme', state.theme);
  // Lets CSS itself branch on language for the rare cases where a string
  // lives in a stylesheet (a ::before/::after content: value) instead of
  // JS-rendered markup -- those can't go through tt()/t() at all, so
  // without this hook they'd stay hardcoded Malay forever regardless of
  // the language picker. See .table-wrap::before in styles.css.
  document.documentElement.setAttribute('data-lang', state.displayLanguage);
  resetInactivityTimer();
  const root = document.getElementById('root');
  if(state.attendanceMode){
    root.innerHTML = renderAttendancePunch();
    makeClickablesFocusable();
    attachAttendancePunchHandlers();
    return;
  }
  if(state.inspectMode){
    root.innerHTML = renderInspectionReport();
    makeClickablesFocusable();
    attachInspectionReportHandlers();
    return;
  }
  if(state.quoteMode){
    root.innerHTML = renderQuotationApproval();
    makeClickablesFocusable();
    attachQuotationApprovalHandlers();
    return;
  }
  if(state.invoiceMode){
    root.innerHTML = renderInvoiceView();
    makeClickablesFocusable();
    attachInvoiceViewHandlers();
    return;
  }
  if(state.boardMode){
    root.innerHTML = renderDisplayBoard();
    makeClickablesFocusable();
    attachDisplayBoardHandlers();
    return;
  }
  if(state.kioskMode){
    root.innerHTML = renderKioskScreen();
    makeClickablesFocusable();
    attachKioskHandlers();
    return;
  }
  if(!state.currentStaff){
    root.innerHTML = renderLoginScreen();
    makeClickablesFocusable();
    attachLoginHandlers();
    return;
  }
  // Dashboard's hero banner carries its own notif bell + brand title on
  // mobile (see viewDashboard()/dash-hero-brand) -- only when it actually
  // renders (isAdmin, same gate as the hero panel itself), so the topbar's
  // own copies must stay visible for non-Admin roles, who never get a hero
  // to replace them. Must match viewDashboard()'s own isAdmin check exactly.
  const heroReplacesTopbar = state.view==='dashboard' && canSeeRevenue();
  root.innerHTML = `
    <div class="app">
      ${renderSidebar()}
      <div class="sidebar-backdrop ${state.navOpen?'show':''}" data-action="close-nav"></div>
      <div class="main" data-hero-notif="${heroReplacesTopbar?1:0}">
        ${renderTopbar()}
        ${heroReplacesTopbar ? renderDashboardHero() : ''}
        ${heroReplacesTopbar ? '<div id="dash-hero-spacer"></div>' : ''}
        ${renderSyncErrorBanner()}
        <div class="content">${renderView()}</div>
      </div>
      ${renderMobileTabBar()}
      ${renderMobileMoreSheet()}
      ${renderMobileAiBubble()}
    </div>
    ${state.modal ? renderModal() : ''}
    ${state.confirmAction ? renderConfirmModal() : ''}
    ${state.showOnboarding ? renderOnboarding() : ''}
  `;
  makeClickablesFocusable();
  attachHandlers();
  manageModalFocus();
  syncDashboardHeroSpacer();
}

// .dash-hero switched from position:sticky to position:fixed on mobile
// (see .panel.dash-hero in styles.css) after FIVE rounds of iOS Safari bug
// reports against sticky specifically -- backdrop-filter, then
// transform:translateZ(0), then flex-shrink/order, then moving it out of
// the flex container, then making it structurally identical to .topbar --
// none of which stopped .dash-target-panel's box from rendering inside
// where the hero should still occupy space on the user's actual device,
// despite every fix verifying correctly in every available test tool
// (Chromium, desktop WebKit, live production HTML fetched and byte-
// compared directly). position:fixed can't have that specific bug --
// fixed elements never reserve flow space to begin with, on any browser,
// so there's nothing for Safari to get wrong. The tradeoff: since fixed
// elements reserve zero flow space, #dash-hero-spacer (rendered right
// after the hero, see render() above) needs its height set to match the
// hero's actual rendered height so following content starts below it
// instead of sliding underneath -- measured fresh after every render
// rather than hardcoded, since the hero's height responds to font-size
// clamp()ing across screen widths and can wrap onto more lines for a
// long shop name. Only measured on mobile (position:fixed there; desktop
// keeps position:relative, normal flow, hero reserves its own space
// exactly as any other panel would, so the spacer must stay 0 there).
function syncDashboardHeroSpacer(){
  const hero = /** @type {HTMLElement|null} */ (document.querySelector('.dash-hero'));
  const spacer = document.getElementById('dash-hero-spacer');
  if(!hero || !spacer) return;
  // .content's own top padding already adds a bit of breathing room after
  // this, so the spacer only needs to cover the hero's own box -- close
  // enough to the hero's old margin-bottom that no extra compensation is
  // worth the complexity here.
  spacer.style.height = getComputedStyle(hero).position==='fixed' ? hero.offsetHeight+'px' : '0';
}

/* ---------- LOGIN ---------- */
