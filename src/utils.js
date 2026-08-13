function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
// toISOString() always converts to UTC first — in Malaysia (UTC+8) that
// silently shifts the date back by one for anywhere between midnight and
// 8am local, so "today" comparisons against local-date strings (like
// appointment.date or a cash closure's date key) can compare against
// yesterday for the first 8 hours of every day. Build the date string from
// local getFullYear/getMonth/getDate instead.
function localDateStr(d){ d = d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// render() builds the entire UI as HTML strings and injects them via
// innerHTML — any user-entered field (customer name, job notes, item names,
// etc.) landing in one of those strings unescaped is a stored-XSS hole: a
// crafted name/note is then executed in every other logged-in staff
// member's browser (including Admin) the moment they view that record,
// since sync is realtime across devices. Wrap every such field with esc().
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtRM(n){ return 'RM ' + (Number(n)||0).toFixed(2); }
// Split-payment invoices (invoice.payments[]) can mix cash with card/online
// in one sale, or leave a balance due (deposit/partial payment) -- cash
// reconciliation must only count the CASH portion actually collected, not
// the invoice's full total. Single-payment invoices (the common case, no
// .payments array) fall back to the original payment==='Tunai' check.
// Used by both the daily cash-closing panel and the close-cash handler so
// they can never drift into disagreeing about "today's cash sales".
function invoiceCashAmount(inv){
  if(inv.payments && inv.payments.length) return inv.payments.filter(p=>p.method==='Tunai').reduce((s,p)=>s+p.amount,0);
  return inv.payment==='Tunai' ? inv.total : 0;
}
function invoiceAmountPaid(inv){
  if(inv.payments && inv.payments.length) return inv.payments.reduce((s,p)=>s+p.amount,0);
  return inv.total;
}
function invoiceBalanceDue(inv){ return Math.max(0, inv.total - invoiceAmountPaid(inv)); }
// Credit notes (partial/full refunds against a past invoice) were, until
// this fix, invisible to every revenue-derived figure -- P&L revenue,
// mechanic commission (Reports), and payroll commission all kept counting
// an invoice's full original total forever, even after some of it was
// refunded. A shop issuing a credit note for a returned/defective part
// would see overstated profit AND pay real commission on money that was
// actually given back to the customer. Shared here so Reports and Payroll
// can't drift into disagreeing about how much of an invoice was credited.
function creditNotesForInvoice(invoiceId){
  return (db.creditNotes||[]).filter(cn=>cn.invoiceId===invoiceId);
}
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('ms-MY',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtDateTime(ts){ const d=new Date(ts); return d.toLocaleDateString('ms-MY',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'}); }

// Shared "Tarikh" filter dropdown -- same {k,l} option shape as every other
// filter list in this codebase (see e.g. the `filters` array in
// viewJobs()), reused wherever a list of timestamped records benefits from
// a date-range narrower than "load more". Used by both the Finance section
// (views/finance.js) and Jobs (views/jobs.js).
function dateRangeFilterOptions(){
  const en = state.language==='en';
  return [
    {k:'all', l:en?'All Time':'Semua Masa'},
    {k:'7', l:tt('7 Hari')},
    {k:'30', l:tt('30 Hari')},
    {k:'90', l:tt('90 Hari')},
  ];
}
function withinDateRangeFilter(createdAt, filterValue){
  if(!filterValue || filterValue==='all') return true;
  return createdAt >= Date.now() - Number(filterValue)*24*60*60*1000;
}
function logAudit(action, detail){
  db.auditLog.unshift({id:uid(), ts:Date.now(), staff: state.currentStaff?state.currentStaff.name:'?', action, detail});
  if(db.auditLog.length>300) db.auditLog.length = 300;
}

function getCustomer(id){ return db.customers.find(c=>c.id===id); }
function getVehicle(id){ return db.vehicles.find(v=>v.id===id); }
function getVehiclesFor(customerId){ return db.vehicles.filter(v=>v.customerId===customerId); }
function getItem(id){ return db.inventory.find(i=>i.id===id); }
// Shared by the vehicle detail modal (customers.js) and the dashboard's
// "vehicles due for service" panel — kept as one function so the two never
// drift into disagreeing about what "due" means.
function vehicleServiceStatus(v){
  if(!v.serviceIntervalKm) return null;
  const nextKm = (v.lastServiceKm||0) + v.serviceIntervalKm;
  const kmLeft = nextKm - (v.odometer||0);
  return { due: kmLeft<=0, kmLeft };
}
function normalizePhone(phone){
  let p = (phone||'').replace(/[^0-9]/g,'');
  // Country code now reads from settings (default '60' for Malaysia,
  // matching what this always hardcoded before) rather than baking in '6'
  // unconditionally -- a reseller shop outside Malaysia entering an equally
  // normal-looking local number starting with 0 used to silently get
  // Malaysia's country code glued onto it, producing a wrong wa.me link
  // with no error shown anywhere.
  const cc = (db.settings && db.settings.countryCode) || '60';
  if(p.startsWith('0')) p = cc + p.slice(1);
  return p;
}

// Two separate permission questions, kept as two functions rather than one
// "isAdmin" so a role can answer them differently: Kerani gets full
// Admin-level access to Reports/Staff/Settings/Payroll (canManage) but is
// excluded from actual sales/revenue figures (canSeeRevenue) -- Admin and
// Pemilik are the only roles where both are true. Mekanik/Ketua Mekanik are
// both false for everything (handled by the existing role checks that were
// already scoped to hide revenue from them, now reused via canSeeRevenue).
// "Pemilik" (Owner) is Admin in every way that matters here -- a separate,
// same-access role so a shop's actual owner can be labeled that instead of
// the more generic "Admin", without touching what any existing Admin
// account can do. See isOwnerLevel() for the "don't strand a shop with zero
// owner-level staff" safety checks in staff.js/event-handlers.js, which
// need Admin and Pemilik counted together, not this same true/false split.
function canManage(){
  const role = state.currentStaff && state.currentStaff.role;
  return role==='Admin' || role==='Pemilik' || role==='Kerani';
}
function canSeeRevenue(){
  const role = state.currentStaff && state.currentStaff.role;
  return role==='Admin' || role==='Pemilik';
}
function isOwnerLevel(role){
  return role==='Admin' || role==='Pemilik';
}

// LOGO_DATA_URI is a flat-gold silhouette (logo shape + transparency, no
// shading), so a plain <img> pins it to one fixed color regardless of theme.
// Rendering it as a CSS mask instead lets background-color:var(--logo-tint)
// drive its color, so it automatically switches with theme instead of
// staying stuck at one hardcoded tone. --logo-tint (styles.css) is gold
// (same as --accent) in dark mode, but deliberately its own token rather
// than reusing --accent in light mode too: gold-on-light read as a washed
// out dark orange, so light mode maps it to --text (near-black) instead.
function logoMarkHtml(px){
  return `<div role="img" aria-label="ServisPro" style="display:inline-block;height:${px}px;aspect-ratio:480/535;background-color:var(--logo-tint);-webkit-mask:url(${LOGO_DATA_URI}) center / contain no-repeat;mask:url(${LOGO_DATA_URI}) center / contain no-repeat;"></div>`;
}

