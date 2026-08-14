/* ============================= APP STATE ============================= */
let state = {
  view: 'dashboard',
  language: 'ms',
  modal: null,       // {type, payload}
  posCart: [],
  posCustomerId: '',
  posVehicleId: '',
  posJobId: '',
  posEditingInvoiceId: /** @type {string|null} */ (null),
  posLastInvoiceId: /** @type {string|null} */ (null), // just-finalized invoice -- offers a "Cetak Invois" shortcut in the now-empty cart panel (see viewPOS)
  aiQuoteSuggestion: /** @type {'loading'|'unavailable'|'rate_limited'|{items:{id:string,name:string,qty:number,reason:string}[]}|null} */ (null),
  invTab: 'semua',
  jobFilter: 'semua',
  jobDateFilter: 'all',
  reportRange: 30,
  currentStaff: null,   // session only, not persisted
  authBusy: false,
  authMode: 'login',    // 'login' | 'signup' | 'forgot' | 'reset'
  loginError: '',
  loginNotice: '',
  syncStatus: 'idle',   // 'idle' | 'syncing' | 'error'
  offlineMode: false,
  offlineCacheAt: null,
  confirmAction: null,  // {message, onConfirm}
  customerSearch: '',
  theme: 'dark',
  navOpen: false,
  posDiscountType: 'flat',
  posDiscountValue: 0,
  globalSearch: '',
  apptTab: 'appointments',
  kioskMode: false,
  kioskTab: /** @type {'status'|'history'|'book'} */ ('status'),
  kioskQuery: '',
  // null = no search yet, 'loading' = RPC in flight, 'notfound' = searched
  // with no match, or the {id,jobNo,status,plate,model,rating,feedback}
  // object from kiosk_lookup_job() -- see attachKioskHandlers().
  kioskResult: /** @type {'loading'|'notfound'|{id:string,jobNo:string,status:string,plate:string,model:string,rating:number|null,feedback:string}|null} */ (null),
  currentBranch: 'all',
  notifOpen: false,
  lastDeleted: null,
  staffTab: 'staff',
  invMainTab: 'items',
  financeTab: 'quotations',
  financeStatusFilter: 'all',
  financeDateFilter: 'all',
  financeShowCount: 30,
  kioskRatingValue: 0,
  simpleMode: false,
  showOnboarding: false,
  onboardingStep: 0,
  showWhatsNew: false,
  jobsShowCount: 30,
  customersShowCount: 30,
  autoBackupsList: /** @type {{id:string, created_at:string}[]|null} */ (null),
  mfaFactors: /** @type {{id:string, status:string}[]|null} */ (null),
  mfaEnrollment: /** @type {{factorId:string, qrSvg:string, secret:string}|null} */ (null),
  mfaChallenge: /** @type {{factorId:string, challengeId:string}|null} */ (null),
  // AI checklist suggestion (see src/ai-assist.js) -- ephemeral, never
  // persisted to db.jobs or synced -- just a UI hint the mechanic reads and
  // acts on with their own judgment, cleared the moment the inspection
  // modal closes.
  aiSuggestion: /** @type {'loading'|'unavailable'|'rate_limited'|{likelyCauses:string[], suggestedItems:string[]}|null} */ (null),
  // Standalone AI Assistant (see src/ai-assist.js) -- a general Q&A chat,
  // deliberately independent of any other feature (not tied to a job, not
  // navigation to an existing screen -- see the floating mobile-ai-bubble).
  // Ephemeral, never persisted/synced -- a fresh conversation every time
  // the modal is opened.
  aiAssistantMessages: /** @type {{role:'user'|'ai', text:string}[]} */ ([]),
  aiAssistantBusy: false,
  payrollMonth: /** @type {string|null} */ (null),
  techRefSearch: '',
  techRefEditingSectionId: /** @type {string|null} */ (null),
  calendarMonth: currentMonthStr(),
  customerTab: 'customers',
  leadStatusFilter: 'all',
  posSplitMode: false,
  posSplitPayments: /** @type {{method:string, amount:number}[]} */ ([]),
  posConvertingQuoteId: /** @type {string|null} */ (null),
  attendanceMode: false,
  attendanceStaffId: /** @type {string|null} */ (null),
  attendanceToken: /** @type {string|null} */ (null),
  // 'loading' | 'invalid' | {name, nextType} while choosing, or {name, type, ts} once punched
  attendanceStatus: /** @type {any} */ (null),
  attendanceTab: 'clock',
  inspectMode: false,
  inspectJobId: /** @type {string|null} */ (null),
  inspectToken: /** @type {string|null} */ (null),
  // 'loading' | 'invalid' | the report object once loaded
  inspectReport: /** @type {any} */ (null),
  boardMode: false,
  boardJobs: /** @type {any[]|null} */ (null),
  dashTargetPeriod: /** @type {'weekly'|'monthly'} */ ('weekly'),
  // Which staff member's thread a manager is currently viewing in the
  // support chat modal -- null means "show the inbox list". Meaningless
  // for a non-manager, whose thread is always just their own id.
  supportChatThreadId: /** @type {string|null} */ (null),
  // Set once per login by checkLicenseStatus() (see license.js) -- null
  // until then, treated the same as the free plan by hasFeature() in the
  // meantime so nothing is gated before the first check completes.
  license: /** @type {{plan:string,status:string,expiresAt:string|null,creditBalance:number,referralCode:string|null,checkedAt:number,live:boolean}|null} */ (null),
  // Set once per login by refreshPushSubscriptionState() (see
  // push-notifications.js) -- null until then ("not yet known", the
  // Account page toggle renders in a neutral state meanwhile).
  pushSubscribed: /** @type {boolean|null} */ (null),
  // ---- customer self-service screens (all anonymous, token-gated -- see
  // src/customer-portal.js and the kiosk_* RPCs in backend/schema.sql) ----
  quoteMode: false,
  quoteId: /** @type {string|null} */ (null),
  quoteToken: /** @type {string|null} */ (null),
  quoteResult: /** @type {any} */ (null), // 'loading' | 'invalid' | the quotation object once loaded
  quoteResultLoading: false,
  invoiceMode: false,
  invoiceId: /** @type {string|null} */ (null),
  invoiceToken: /** @type {string|null} */ (null),
  invoiceResult: /** @type {any} */ (null), // 'loading' | 'invalid' | the invoice object once loaded
  invoiceResultLoading: false,
  historyPlate: '',
  historyPhone: '',
  historyResult: /** @type {any} */ (null), // 'loading' | 'notfound' | the {plate,model,jobs,invoices} object
  bookName: '',
  bookPhone: '',
  bookPlate: '',
  bookDate: '',
  bookTime: '',
  bookNotes: '',
  bookBusy: false,
  bookSubmitted: false,
  // ---- optional customer-portal login (see src/customer-portal.js) --
  // an account is never required, every kiosk_* flow above still works
  // anonymously; this just lets a repeat customer see everything in one
  // place. Uses a SEPARATE Supabase Auth session (own localStorage key)
  // from the staff session, so the two are never confused client-side.
  custPortalChecked: false, // has the "already logged in?" session check run yet this page load
  custPortalMode: /** @type {'login'|'signup'|'forgot'|'link'|'dashboard'} */ ('login'),
  custPortalEmail: '',
  custPortalPassword: '',
  custPortalPhone: '',
  custPortalName: '',
  custPortalPlate: '',
  custPortalBusy: false,
  custPortalError: '',
  custPortalNotice: '',
  custPortalProfile: /** @type {{id:string,name:string,phone:string}|null} */ (null),
  custPortalData: /** @type {any} */ (null), // 'loading' | the get_my_customer_data() object
};

// viewHistory: backs the swipe-left "back" gesture (see attachSwipeBack()
// in main.js) -- a plain module-level array, not part of `state` itself,
// since it doesn't drive any rendering on its own and doesn't need to
// survive a page reload. Every view CHANGE (not every setState call) pushes
// the view being left, so swiping back walks through actual navigation
// history rather than just toggling between two views. Capped so a long
// session browsing many views doesn't grow this unboundedly.
const viewHistory = [];
function setState(patch){
  if(patch.view!==undefined && patch.view!==state.view){
    viewHistory.push(state.view);
    if(viewHistory.length>30) viewHistory.shift();
  }
  Object.assign(state, patch);
  render();
}
function showToast(msg, undoFn){
  // Patches its own dedicated #toast-root node directly instead of going
  // through render() — render() replaces #root's entire innerHTML in one
  // shot (view + modal + confirm dialog together), so routing a toast
  // through it would rebuild whatever modal is currently open from scratch,
  // silently discarding any not-yet-saved input the user had typed into it.
  const container = document.getElementById('toast-root');
  if(!container) return;
  // showToast._t: a debounce-timer handle stashed on the function itself
  // (a common vanilla-JS idiom) rather than a module-level variable — no
  // ES module boundary here to hold one privately. `any` cast is just to
  // satisfy tsc about the extra property; behavior is unaffected.
  clearTimeout(/** @type {any} */ (showToast)._t);
  container.innerHTML = `<div class="toast">${msg}${undoFn ? ` <span class="clickable" data-action="undo-delete" style="text-decoration:underline;font-weight:700;margin-left:6px;">Buat Asal</span>` : ''}</div>`;
  if(undoFn){
    const undoEl = container.querySelector('[data-action="undo-delete"]');
    if(undoEl) undoEl.addEventListener('click', ()=>{ undoFn(); container.innerHTML = ''; clearTimeout(/** @type {any} */ (showToast)._t); });
  }
  /** @type {any} */ (showToast)._t = setTimeout(()=>{ container.innerHTML = ''; }, undoFn ? 5000 : 2200);
}

function showUpdateAvailableToast(){
  // Deliberately does NOT auto-dismiss like showToast() — a new service
  // worker has already taken over in the background (see the
  // controllerchange listener in the app shell), but the currently loaded
  // page is still running the OLD code until reloaded. Losing this prompt
  // before the user notices would mean the fix they're waiting on stays
  // invisible until they happen to reload for some unrelated reason.
  const container = document.getElementById('toast-root');
  if(!container) return;
  const en = state.language==='en';
  container.innerHTML = `<div class="toast">${en?'A new version is ready.':'Versi baharu tersedia.'} <span class="clickable" data-action="reload-app" style="text-decoration:underline;font-weight:700;margin-left:6px;">${en?'Reload':'Muat Semula'}</span></div>`;
  const btn = container.querySelector('[data-action="reload-app"]');
  if(btn) btn.addEventListener('click', ()=>location.reload());
}

