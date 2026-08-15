/* ============================= DATA LAYER ============================= */
let db = null;
let saveTimer = null;
let saveInFlight = false;
let saveAgainNeeded = false;
let saveRetryTimer = null;
const SAVE_RETRY_MS = 8000;
let inactivityTimer = null;
const INACTIVITY_LOCK_MS = 5*60*1000; // auto-lock after 5 minutes of no interaction
function resetInactivityTimer(){
  clearTimeout(inactivityTimer);
  if(!state.currentStaff || state.kioskMode) return;
  inactivityTimer = setTimeout(()=>{
    if(state.currentStaff){
      supabaseClient.auth.signOut();
      unsubscribeRealtime();
      db = defaultDB();
      state.currentStaff = null;
      state.modal = null;
      state.confirmAction = null;
      render();
      showToast(tt('Sesi tamat kerana tidak aktif. Sila log masuk semula.'));
    }
  }, INACTIVITY_LOCK_MS);
}

function defaultDB(){
  return {
    customers: [],
    vehicles: [],
    jobs: [],
    inventory: [],
    invoices: [],
    staff: [],
    appointments: [],
    contracts: [],
    suppliers: [],
    purchaseOrders: [],
    auditLog: [],
    branches: [{id:'main', name:'Cawangan Utama'}],
    cashClosures: [],
    payrollRecords: [],
    techRefs: [],
    leads: [],
    packages: [],
    creditNotes: [],
    attendance: [],
    quotations: [],
    bays: [],
    supportMessages: [],
    pushSubscriptions: [],
    settings: { shopName:'', shopPhone:'', shopAddress:'', shopRegNo:'', shopSstNo:'', shopTin:'', taxRate:0, loyaltyVisits:5, loyaltyDiscount:10, churnDays:180, simpleMode:false, paymentQR:'', shopLogo:'', lastBackupAt:null, servicedBrands:[], monthlySalesTarget:0, monthlyUnitTarget:0, countryCode:'60', licenseKey:'' },
    counters: { job: 1, invoice: 1, po: 1, creditNote: 1, quote: 1 }
  };
}

// ---- Supabase sync engine -------------------------------------------------
// One row-per-record table per top-level db.* array (see backend/schema.sql).
// db itself keeps the exact shape the rest of the app already expects —
// only how it's loaded/saved changes, so none of the ~80 existing
// "mutate db.x then call queueSave()" call sites needed to change.
const TABLE_MAP = {
  customers:'customers', vehicles:'vehicles', jobs:'jobs', inventory:'inventory',
  invoices:'invoices', appointments:'appointments', contracts:'contracts',
  suppliers:'suppliers', purchaseOrders:'purchase_orders', auditLog:'audit_log',
  branches:'branches', cashClosures:'cash_closures', payrollRecords:'payroll_records',
  techRefs:'tech_refs', leads:'leads', packages:'packages', creditNotes:'credit_notes',
  attendance:'attendance', quotations:'quotations', bays:'bays',
  supportMessages:'support_messages', pushSubscriptions:'push_subscriptions'
};
const REVERSE_TABLE_MAP = Object.fromEntries(Object.entries(TABLE_MAP).map(([k,v])=>[v,k]));
// Tables loadRemoteDB() found missing (schema not migrated on this shop's
// project yet -- see the 42P01/PGRST205 handling there). subscribeRealtime()
// checks this before registering a table, because every table shares ONE
// realtime channel/subscription: registering postgres_changes for a table
// that doesn't exist errors the whole channel, silently killing realtime
// sync for every OTHER table too, not just the missing one.
const missingTables = new Set();
let lastSynced = null; // per-table Map(id -> JSON snapshot), set once db is first loaded

function staffDiffKey(rec){
  const {userId, ...rest} = rec;
  return JSON.stringify(rest)+'|'+(userId||'');
}

function snapshotDB(){
  const snap = {};
  for(const key of Object.keys(TABLE_MAP)){
    snap[key] = new Map((db[key]||[]).map(r=>[r.id, JSON.stringify(r)]));
  }
  snap.staff = new Map((db.staff||[]).map(r=>[r.id, staffDiffKey(r)]));
  snap.settings = JSON.stringify(db.settings);
  return snap;
}

// PostgREST (Supabase's REST layer) caps every response at its configured
// max-rows setting (1000 by default) regardless of how many rows actually
// match — an unpaginated `.select()` doesn't error past that point, it just
// silently returns a partial result. For a shop's first year that's
// invisible; a couple of years of invoices/audit-log history in and logins
// would start silently dropping the tail of the oldest (or newest,
// depending on ordering) records with no error anywhere. Page through with
// `.range()` until a page comes back shorter than the page size.
const REMOTE_PAGE_SIZE = 1000;
async function fetchAllRows(table, columns){
  const rows = [];
  let from = 0;
  for(;;){
    const { data, error } = await supabaseClient.from(table).select(columns).range(from, from + REMOTE_PAGE_SIZE - 1);
    if(error) throw error;
    rows.push(...(data||[]));
    if(!data || data.length < REMOTE_PAGE_SIZE) break;
    from += REMOTE_PAGE_SIZE;
  }
  return rows;
}

// audit_log is append-only and RLS blocks deleting old rows (see
// schema.sql) — it's the one table that only ever grows, never trims, so
// it's also the one most likely to eventually dwarf every other table
// combined. logAudit() already caps the LOCAL array at 300 entries and the
// Staff activity view only ever shows slice(0,100) of it — nothing in the
// app reads further back than that. Pulling the full history through
// fetchAllRows() on every single login/reload was pure waste that only got
// slower as the shop's history grew; fetch just the most recent 300 instead.
const AUDIT_LOG_FETCH_LIMIT = 300;
async function fetchRecentAuditLog(){
  const { data, error } = await supabaseClient.from('audit_log').select('id,data').order('updated_at', { ascending:false }).limit(AUDIT_LOG_FETCH_LIMIT);
  if(error) throw error;
  return data || [];
}

// attendance grows unbounded too -- a punch per staff per clock-in/out,
// forever -- but unlike audit_log, a flat row-count cap would silently
// break computeAttendanceSummary()'s "previous month" navigation (see
// attendance.js/attendanceSummaryModalHTML, which lets a staff member page
// back with no lower bound): a few hundred rows is only a couple of weeks
// once you're counting every staff member's twice-daily punches at a shop
// with several staff, so a count-based cap like audit_log's would make
// last month (or even last week) silently look empty. Time-windowed
// instead -- 12 months covers a full year of month-by-month navigation and
// typical payroll-reference lookback, while still bounding how much a
// shop's cloud history can bloat this fetch after years of use. Older
// punches aren't deleted server-side, only left unfetched here.
const ATTENDANCE_FETCH_WINDOW_MS = 366 * 24 * 60 * 60 * 1000; // ~12 months, leap-year-safe
async function fetchRecentAttendance(){
  const cutoff = Date.now() - ATTENDANCE_FETCH_WINDOW_MS;
  const rows = [];
  let from = 0;
  for(;;){
    const { data, error } = await supabaseClient.from('attendance').select('id,data')
      .gte('data->ts', cutoff).range(from, from + REMOTE_PAGE_SIZE - 1);
    if(error) throw error;
    rows.push(...(data||[]));
    if(!data || data.length < REMOTE_PAGE_SIZE) break;
    from += REMOTE_PAGE_SIZE;
  }
  return rows;
}

async function loadRemoteDB(){
  const d = defaultDB();
  const tableEntries = Object.entries(TABLE_MAP);
  // Fire all table fetches in parallel instead of one-at-a-time — with 15
  // separate queries, sequential loading meant several seconds of "Sedang
  // log masuk…" on every login even on a decent connection. Each individual
  // fetch still pages internally via fetchAllRows if that one table is
  // large enough to need it.
  const [tableResults, staffRows, metaRes, counterRows] = await Promise.all([
    Promise.all(tableEntries.map(([key, table]) =>
      (table==='audit_log' ? fetchRecentAuditLog() : table==='attendance' ? fetchRecentAttendance() : fetchAllRows(table, 'id,data'))
        .then(data => ({ key, table, data, error: /** @type {any} */ (null) }))
        .catch(error => ({ key, table, data: /** @type {any[]} */ ([]), error }))
    )),
    fetchAllRows('staff', 'id,user_id,data'),
    supabaseClient.from('shop_meta').select('data').eq('id','settings').maybeSingle(),
    fetchAllRows('counters', 'name,value'),
  ]);
  for(const r of tableResults){
    if(r.error){
      // 42P01 = Postgres "undefined_table"; PGRST205 = PostgREST's own
      // "table not found in schema cache" (what actually comes back in
      // practice -- PostgREST wraps/reinterprets the underlying Postgres
      // error rather than passing 42P01 through as-is). Either means this
      // shop's Supabase project hasn't run the latest backend/schema.sql
      // yet (a new db.* array was added to TABLE_MAP ahead of every
      // existing installation's schema catching up). Degrading that one
      // array to empty rather than aborting the whole login means adding a
      // new synced table can never brick every shop's login the moment the
      // code ships, only leave the new feature itself empty until the
      // schema catches up. Any other error (RLS, network, ...) still
      // hard-fails as before -- those are real problems worth surfacing
      // loudly, not something to paper over.
      if(r.error.code === '42P01' || r.error.code === 'PGRST205'){
        reportError(r.error, `Missing table for db.${r.key} -- run the latest backend/schema.sql`);
        missingTables.add(r.table);
        d[r.key] = [];
        continue;
      }
      throw r.error;
    }
    // Same reasoning as the id:payload.new.id spread in handleRemoteChange
    // below -- never trust a row's own `data` JSONB to self-describe its
    // id, always take it from the row's real id column instead.
    d[r.key] = (r.data||[]).map(row=>({...row.data, id:row.id}));
  }
  d.staff = staffRows.map(r=>({...r.data, id:r.id, userId:r.user_id}));
  if(metaRes.data && metaRes.data.data) Object.assign(d.settings, metaRes.data.data);
  counterRows.forEach(c=>{ if(d.counters[c.name]!==undefined) d.counters[c.name] = c.value; });
  return d;
}

async function syncListTable(key, table, appendOnly){
  const prevMap = (lastSynced && lastSynced[key]) || new Map();
  // Defensive guard, learned from a real incident: a record somehow
  // missing its own id (a client-side bug, or a security-definer RPC that
  // didn't embed 'id' inside its data blob -- see loadRemoteDB/
  // handleRemoteChange) can never be synced, since there's no id to
  // upsert against, and silently kept failing this table's ENTIRE save
  // cycle forever otherwise (runSaveCycle retries on any error). Drop it
  // locally instead -- it was never actually persisted under this id
  // anyway -- and warn loudly so a future bug like this is visible
  // immediately instead of surfacing as unexplained sync failures.
  const badRecords = (db[key]||[]).filter(r=>!r.id);
  if(badRecords.length){
    reportError(new Error(`${badRecords.length} record(s) in db.${key} have no id`), `Rekod tanpa id dijumpai dalam ${key} -- dibuang secara tempatan supaya tidak menyekat sync`);
    db[key] = (db[key]||[]).filter(r=>r.id);
  }
  const curArr = db[key] || [];
  const curMap = new Map();
  const upserts = [];
  curArr.forEach(r=>{
    const json = JSON.stringify(r);
    curMap.set(r.id, json);
    if(prevMap.get(r.id)!==json) upserts.push({id:r.id, data:r, updated_at:new Date().toISOString()});
  });
  if(upserts.length){ const {error} = await supabaseClient.from(table).upsert(upserts); if(error) throw error; }
  // audit_log is append-only server-side (RLS blocks delete for everyone);
  // the local 300-entry cap is a display trim only, not a cloud deletion.
  if(!appendOnly){
    const deletes = [];
    prevMap.forEach((_,id)=>{ if(!curMap.has(id)) deletes.push(id); });
    if(deletes.length){ const {error} = await supabaseClient.from(table).delete().in('id', deletes); if(error) throw error; }
  }
  return curMap;
}

async function syncStaffTable(){
  const prevMap = (lastSynced && lastSynced.staff) || new Map();
  const curArr = db.staff || [];
  const curMap = new Map();
  const upserts = [];
  curArr.forEach(r=>{
    const json = staffDiffKey(r);
    curMap.set(r.id, json);
    if(prevMap.get(r.id)!==json){
      const {userId, ...rest} = r;
      upserts.push({id:r.id, user_id:userId||null, data:rest, updated_at:new Date().toISOString()});
    }
  });
  const deletes = [];
  prevMap.forEach((_,id)=>{ if(!curMap.has(id)) deletes.push(id); });
  if(upserts.length){ const {error} = await supabaseClient.from('staff').upsert(upserts); if(error) throw error; }
  if(deletes.length){ const {error} = await supabaseClient.from('staff').delete().in('id', deletes); if(error) throw error; }
  return curMap;
}

async function syncSettings(){
  // shop_meta writes are Admin-only server-side (see schema.sql); skipping
  // the call entirely when nothing changed avoids a guaranteed permission
  // error on every single save for non-Admin staff (Mekanik etc.), since
  // this used to run unconditionally regardless of who was saving what.
  const json = JSON.stringify(db.settings);
  const prev = lastSynced && lastSynced.settings;
  if(prev === json) return prev;
  const {error} = await supabaseClient.from('shop_meta').upsert({id:'settings', data:db.settings, updated_at:new Date().toISOString()});
  if(error) throw error;
  return json;
}

let realtimeChannel = null;
function subscribeRealtime(){
  if(realtimeChannel) return;
  realtimeChannel = supabaseClient.channel('shop-sync');
  [...Object.values(TABLE_MAP), 'staff', 'shop_meta'].forEach(table=>{
    if(missingTables.has(table)) return; // see missingTables' own comment above
    realtimeChannel.on('postgres_changes', { event:'*', schema:'public', table }, payload=>handleRemoteChange(table, payload));
  });
  realtimeChannel.subscribe();
}
function unsubscribeRealtime(){
  if(realtimeChannel){ supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
}
function maybeRerender(){
  const active = document.activeElement;
  const typing = active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
  if(state.modal || typing) return; // don't yank an in-progress edit out from under the user
  render();
}
function isRecordOpenInModal(id){
  if(!state.modal) return false;
  for(const k in state.modal){
    const v = state.modal[k];
    if(v && typeof v==='object' && v.id===id) return true;
  }
  return false;
}
function showModalConflictWarning(){
  const modalEl = document.querySelector('.modal');
  if(!modalEl || modalEl.querySelector('.conflict-warning')) return;
  const en = state.language==='en';
  const div = document.createElement('div');
  div.className = 'conflict-warning';
  div.textContent = en
    ? 'Someone else just updated this — saving now may overwrite their change.'
    : 'Rekod ini baru dikemas kini oleh orang lain — menyimpan sekarang mungkin menimpa perubahan mereka.';
  modalEl.insertBefore(div, modalEl.firstChild);
}
function showSettingsConflictWarning(){
  // Settings is a full page, not a modal, so it needs its own target — and
  // unlike record edits, the risk here isn't a skipped re-render (Simpan
  // Tetapan reads straight from the visible inputs either way): it's that
  // clicking Save re-submits every field from this now-stale page load,
  // silently reverting whatever the other Admin just changed remotely.
  const settingsEl = document.getElementById('settings-view');
  if(!settingsEl || settingsEl.querySelector('.conflict-warning')) return;
  const en = state.language==='en';
  const div = document.createElement('div');
  div.className = 'conflict-warning';
  div.style.gridColumn = '1 / -1';
  div.textContent = en
    ? 'Another Admin just changed shop settings. Reload this page before saving, or your Simpan Tetapan click will overwrite their change.'
    : 'Admin lain baru sahaja menukar tetapan kedai. Muat semula halaman ini sebelum menyimpan, jika tidak klik Simpan Tetapan anda akan menimpa perubahan mereka.';
  settingsEl.insertBefore(div, settingsEl.firstChild);
}

function handleRemoteChange(table, payload){
  if(!db) return;
  if(table==='shop_meta'){
    if(payload.new && payload.new.id==='settings'){
      db.settings = payload.new.data;
      if(lastSynced) lastSynced.settings = JSON.stringify(db.settings);
      if(state.view==='settings'){
        // A full render() would rebuild #settings-view from scratch and both
        // wipe the warning we're about to insert AND discard any in-progress
        // (unsaved) edits in the other fields — same reasoning as the
        // modal-open guard in maybeRerender(), just without a state.modal to
        // key off of here since Settings is a full page, not a modal.
        showSettingsConflictWarning();
        return;
      }
    }
    maybeRerender();
    return;
  }
  const key = table==='staff' ? 'staff' : REVERSE_TABLE_MAP[table];
  if(!key) return;
  const arr = db[key] || (db[key]=[]);
  // Supabase sends payload.new as {} (truthy!) on DELETE events, not null —
  // must branch on eventType, not a truthy check on payload.new.
  const id = payload.eventType==='DELETE' ? payload.old.id : payload.new.id;
  const idx = arr.findIndex(r=>r.id===id);
  if(payload.eventType==='DELETE'){
    if(idx>-1) arr.splice(idx,1);
    if(lastSynced && lastSynced[key]) lastSynced[key].delete(id);
  } else {
    // Always spread id back in explicitly, never trust payload.new.data to
    // self-describe it -- true for every record a STAFF client creates
    // (db.x.push({id:uid(), ...}) means the whole object, id included,
    // becomes the `data` JSONB blob, so it was already redundantly present
    // there too), but NOT true for a row a security-definer RPC inserts
    // directly in SQL via jsonb_build_object(...) without also putting
    // 'id' inside that object (e.g. kiosk_request_appointment's Lead,
    // link_customer_account's new Customer -- see backend/schema.sql).
    // Missing this meant any OTHER staff session with realtime open at the
    // moment one of those rows was inserted got a record with id:undefined
    // merged into its local array, which the next save cycle then tried to
    // upsert back with a null id and got rejected by the not-null
    // constraint on that column.
    const rec = key==='staff' ? {...payload.new.data, id:payload.new.id, userId:payload.new.user_id} : {...payload.new.data, id:payload.new.id};
    const wasExisting = idx>-1;
    // Merge into the existing object instead of swapping in a new one —
    // any open edit modal is holding a direct reference to this exact
    // record (state.modal.job, etc.), captured via db[key].find(...) when
    // it was opened. Replacing arr[idx] wholesale detaches that reference
    // from the array: the modal keeps editing an orphaned copy, its Save
    // button mutates a field nothing else ever reads, and the edit is lost
    // with no error. This is a real race even on a single device — e.g.
    // creating a job and immediately reopening it before that job's own
    // realtime echo comes back.
    // First attempt at closing this race used a WHOLE-RECORD staleness
    // check (skip the entire echo if the record has any pending local edit
    // and the echo differs from current state at all) -- reverted after
    // tests/new-features-batch2.test.js caught it silently dropping a
    // customer's kiosk-submitted signature echo whenever staff ALSO had an
    // unrelated unsynced edit to the same job's inspection checklist. A
    // whole-record diff can't tell "stale echo of our own old write" apart
    // from "legitimate concurrent edit to a different field on the same
    // record" -- both look identical at that granularity. This version
    // instead merges FIELD BY FIELD: only hold back the specific fields we
    // have a pending local edit on (compared against lastSynced, our own
    // last confirmed-synced snapshot); every other field always accepts
    // the incoming value, so an unrelated field's genuinely new echo (the
    // signature) can't be blocked by an edit to a different field (the
    // checklist) on the same record. Held-back fields are deliberately
    // NOT written into lastSynced either, so syncListTable()'s own diff
    // still sees them as unsynced and pushes them on the next save cycle.
    if(wasExisting && key!=='staff'){
      const syncedJson = lastSynced && lastSynced[key] && lastSynced[key].get(id);
      const synced = syncedJson!==undefined ? JSON.parse(syncedJson) : null;
      const local = arr[idx];
      const acceptedFromEcho = {};
      let heldBackAnyField = false;
      Object.keys(rec).forEach(k=>{
        const hasPendingFieldEdit = synced!==null && JSON.stringify(synced[k])!==JSON.stringify(local[k]);
        if(hasPendingFieldEdit){ heldBackAnyField = true; return; }
        acceptedFromEcho[k] = rec[k];
      });
      Object.assign(arr[idx], acceptedFromEcho);
      if(lastSynced && lastSynced[key]) lastSynced[key].set(id, JSON.stringify({...(synced||{}), ...acceptedFromEcho}));
      // Someone else just changed this record while it's open in a modal —
      // warn without a full re-render, which would wipe whatever the user
      // is mid-typing (same reasoning as maybeRerender() below). Only for
      // an actual conflict (a field really did get held back), not every
      // touch of an open record.
      if(heldBackAnyField && state.modal && isRecordOpenInModal(id)) showModalConflictWarning();
      maybeRerender();
      return;
    }
    if(idx>-1) Object.assign(arr[idx], rec); else arr.push(rec);
    if(lastSynced && lastSynced[key]) lastSynced[key].set(id, key==='staff' ? staffDiffKey(rec) : JSON.stringify(rec));
    // Someone else just changed a record while this staff member has it open
    // in a modal — warn without a full re-render, which would wipe whatever
    // they're mid-typing (same reasoning as maybeRerender() below).
    if(wasExisting && state.modal && isRecordOpenInModal(id)) showModalConflictWarning();
  }
  maybeRerender();
}

async function allocateCounter(name, prefix, pad){
  try{
    const { data, error } = await supabaseClient.rpc('next_counter', { counter_name: name });
    if(error) throw error;
    db.counters[name] = data;
    return prefix+'-'+String(data).padStart(pad,'0');
  }catch(e){
    reportError(e, 'Counter RPC gagal, guna nombor tempatan');
    const n = ++db.counters[name];
    return prefix+'-'+String(n).padStart(pad,'0');
  }
}
async function nextJobNo(){ return allocateCounter('job','WS',4); }
async function nextInvNo(){ return allocateCounter('invoice','INV',4); }
async function nextPoNo(){ return allocateCounter('po','PO',4); }
async function nextCreditNoteNo(){ return allocateCounter('creditNote','CN',4); }
async function nextQuoteNo(){ return allocateCounter('quote','Q',4); }

async function resolveStaffForUser(user){
  // claim_staff_record() runs server-side (security definer) so this one
  // narrow self-linking operation works even though direct staff table
  // writes are Admin-only — it can only claim a row matching the caller's
  // own verified auth email, or bootstrap Admin if no staff exist yet.
  const { data, error } = await supabaseClient.rpc('claim_staff_record');
  if(error) throw error;
  if(!data) return null;
  return {...data.data, id:data.id, userId:data.user_id};
}

const OFFLINE_CACHE_KEY = 'servispro-offline-cache';
function cacheOfflineSnapshot(userId, staffMember, dbSnapshot){
  try{
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ userId, staffMember, db: dbSnapshot, savedAt: Date.now() }));
  }catch(e){ /* storage full/unavailable — offline fallback just won't be there next time */ }
}
function loadOfflineSnapshot(userId){
  try{
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.userId===userId ? parsed : null;
  }catch(e){ return null; }
}

// Automatic server-side backups: a snapshot survives even if no Admin ever
// clicks "Muat Turun Sandaran", or their downloaded copy ends up somewhere
// they can't find again. Piggybacks on the existing lastBackupAt field/
// 7-day staleness threshold already shown in Settings, so a manual download
// also counts and this never nags/duplicates unnecessarily.
const AUTO_BACKUP_INTERVAL_MS = 7*24*60*60*1000;
const AUTO_BACKUP_KEEP = 10;
async function maybeAutoBackup(){
  if(!state.currentStaff || !isOwnerLevel(state.currentStaff.role)) return;
  const last = db.settings.lastBackupAt;
  if(last && Date.now()-last < AUTO_BACKUP_INTERVAL_MS) return;
  try{
    const { error } = await supabaseClient.from('backups').insert({ id: uid(), data: db });
    if(error) throw error;
    db.settings.lastBackupAt = Date.now();
    queueSave();
    const { data: rows, error: listErr } = await supabaseClient.from('backups').select('id, created_at').order('created_at', { ascending: false });
    if(!listErr && rows){
      const stale = rows.slice(AUTO_BACKUP_KEEP).map(r=>r.id);
      if(stale.length) await supabaseClient.from('backups').delete().in('id', stale);
    }
  }catch(e){ reportError(e, 'Sandaran automatik gagal'); }
}
async function listAutoBackups(){
  const { data, error } = await supabaseClient.from('backups').select('id, created_at').order('created_at', { ascending: false }).limit(AUTO_BACKUP_KEEP);
  if(error) throw error;
  return data||[];
}
async function fetchAutoBackupData(id){
  const { data, error } = await supabaseClient.from('backups').select('data').eq('id', id).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('Backup not found');
  return data.data;
}

// ---- 2FA (TOTP) self-service management — Settings → Keselamatan ----
async function refreshMfaFactors(){
  const { data, error } = await supabaseClient.auth.mfa.listFactors();
  if(error){ reportError(error, 'Gagal semak status 2FA'); return; }
  state.mfaFactors = data.totp; // only care about TOTP factors here
  render();
}
async function startMfaEnrollment(){
  const { data, error } = await supabaseClient.auth.mfa.enroll({ factorType: 'totp' });
  if(error){ showToast(state.language==='en' ? 'Could not start 2FA setup.' : 'Gagal mulakan setup 2FA.'); return; }
  state.mfaEnrollment = { factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret };
  render();
}
async function verifyMfaEnrollment(code){
  if(!state.mfaEnrollment) return;
  const { factorId } = state.mfaEnrollment;
  const { data: challenge, error: challengeErr } = await supabaseClient.auth.mfa.challenge({ factorId });
  if(challengeErr){ showToast(state.language==='en' ? 'Could not verify — try again.' : 'Gagal sahkan — cuba lagi.'); return; }
  const { error: verifyErr } = await supabaseClient.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if(verifyErr){
    showToast(state.language==='en' ? 'Incorrect code. Check your authenticator app and try again.' : 'Kod salah. Semak aplikasi authenticator anda dan cuba lagi.');
    return;
  }
  state.mfaEnrollment = null;
  await refreshMfaFactors();
  showToast(state.language==='en' ? '2FA activated.' : '2FA diaktifkan.');
}
async function unenrollMfa(factorId){
  const { error } = await supabaseClient.auth.mfa.unenroll({ factorId });
  if(error){ showToast(state.language==='en' ? 'Could not remove 2FA.' : 'Gagal buang 2FA.'); return; }
  await refreshMfaFactors();
  showToast(state.language==='en' ? '2FA removed.' : '2FA dibuang.');
}

async function handleAuthenticated(session){
  state.authBusy = true; state.loginError=''; render();
  try{
    // resolveStaffForUser (one RPC round-trip) and loadRemoteDB (the whole
    // shop's data, itself already parallelized internally) used to run one
    // after the other -- but RLS grants every authenticated session read
    // access to all shop tables regardless of staff/role (see schema.sql),
    // so nothing here actually depends on the staff lookup finishing first.
    // Firing both at once removes a full network round-trip from the
    // critical path on every login and every session-restore page load. The
    // rare case where staffMember comes back null (login gets rejected
    // below) just means loadRemoteDB's result gets discarded unused --
    // cheaper than the round-trip it saves on every normal login.
    const [staffMember, remoteDB] = await Promise.all([resolveStaffForUser(session.user), loadRemoteDB()]);
    if(!staffMember){
      await supabaseClient.auth.signOut();
      state.authBusy = false;
      state.loginError = state.language==='en'
        ? 'No staff record found for this email. Ask an Admin to add you in Settings → Staff first.'
        : 'Tiada rekod staf untuk e-mel ini. Minta Admin tambah anda di Tetapan → Staf dahulu.';
      render();
      return;
    }
    db = remoteDB;
    lastSynced = snapshotDB();
    // A brand-new shop's branches table starts empty in Supabase — nothing
    // ever pushes defaultDB()'s starter branch there on its own. Several
    // places (job creation, POS checkout) assume db.branches[0] exists as
    // the fallback "current" branch, so guarantee at least one is present
    // and persist it, rather than crashing the first time anyone uses them.
    // (lastSynced is snapshotted BEFORE this fix is applied, so the debounced
    // queueSave() below correctly sees it as a new row to push, not a no-op.)
    if(!db.branches || db.branches.length===0){
      db.branches = [{id:'main', name:'Cawangan Utama'}];
      queueSave();
    }
    state.currentStaff = staffMember;
    state.authBusy = false;
    state.offlineMode = false;
    identifyStaffForErrorMonitoring(staffMember);
    if(!state.currentBranch) state.currentBranch = 'all';
    subscribeRealtime();
    checkOnboarding(); // also checks whats-new for an existing (non-first-time) staff member -- see its own comment
    cacheOfflineSnapshot(session.user.id, staffMember, db);
    maybeAutoBackup(); // fire-and-forget — never delay login on this
    checkLicenseStatus(); // fire-and-forget — same reasoning, see license.js
    refreshPushSubscriptionState(); // fire-and-forget — same reasoning, see push-notifications.js
    refreshMfaFactors(); // fire-and-forget — Settings' 2FA status shouldn't block login
    maybeOfferFaceIdEnroll(session); // fire-and-forget — mobile-only Face ID quick-unlock offer
    render();
  }catch(e){
    reportError(e, 'Gagal muat data bengkel');
    const cached = loadOfflineSnapshot(session.user.id);
    if(cached){
      db = cached.db;
      lastSynced = snapshotDB();
      state.currentStaff = cached.staffMember;
      state.offlineMode = true;
      state.offlineCacheAt = cached.savedAt;
      state.authBusy = false;
      if(!state.currentBranch) state.currentBranch = 'all';
      render();
      showToast(state.language==='en' ? 'Offline — showing your last saved data. Changes will sync once you\'re back online.' : 'Luar talian — memaparkan data tersimpan terakhir anda. Perubahan akan disegerak apabila anda kembali dalam talian.');
      return;
    }
    state.authBusy = false;
    state.loginError = state.language==='en' ? 'Failed to load shop data. Check your connection and try again.' : 'Gagal muat data bengkel. Semak sambungan anda dan cuba lagi.';
    render();
  }
}

// Gate between "password verified" and "actually let them in" for staff
// who have TOTP 2FA enrolled. Used at every point a session can freshly
// appear — login, password reset, and app-load session restore — since
// skipping the check at any ONE of them would let a stolen password (with
// no second factor) straight into the app via that path.
async function resolveSessionOrChallengeMfa(session){
  if(!session){ return; }
  const { data: aal } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel){
    const { data: factors, error: listErr } = await supabaseClient.auth.mfa.listFactors();
    const totpFactor = !listErr && factors ? factors.totp.find(f=>f.status==='verified') : null;
    if(!totpFactor){
      // Enrolled-but-unverified factor with no verified one — shouldn't
      // normally happen (unenroll cleans this up), but don't lock the
      // door with no key: fall through to a normal login instead.
      await handleAuthenticated(session);
      return;
    }
    const { data: challenge, error: challengeErr } = await supabaseClient.auth.mfa.challenge({ factorId: totpFactor.id });
    if(challengeErr){
      reportError(challengeErr, 'Gagal mulakan cabaran 2FA');
      await supabaseClient.auth.signOut();
      state.authBusy = false;
      state.loginError = state.language==='en' ? 'Could not start 2FA check. Try logging in again.' : 'Gagal mulakan semakan 2FA. Cuba log masuk semula.';
      render();
      return;
    }
    state.authBusy = false;
    state.mfaChallenge = { factorId: totpFactor.id, challengeId: challenge.id };
    state.authMode = 'mfa-challenge';
    state.loginError = '';
    render();
    return;
  }
  await handleAuthenticated(session);
}

async function initApp(){
  initErrorMonitoring();
  db = defaultDB();
  // A staff member's personal QR attendance code links straight to
  // ?attendance=<staffId>&token=<token> -- detected here, before the first
  // render(), so scanning it opens directly to the punch screen instead of
  // the normal login page (this staff member never needs to log in at all
  // for this flow; see attendance_status/attendance_punch RPCs).
  try{
    const params = new URLSearchParams(location.search);
    const attStaffId = params.get('attendance');
    const attToken = params.get('token');
    if(attStaffId && attToken){
      state.attendanceMode = true;
      state.attendanceStaffId = attStaffId;
      state.attendanceToken = attToken;
      state.attendanceStatus = 'loading';
    }
    // A shared "Share Report" link for a vehicle inspection works the same
    // way: ?inspect=<jobId>&token=<token> opens straight to a read-only
    // report screen the customer can view and sign, no login needed (see
    // kiosk_inspection_report/kiosk_submit_inspection_signature RPCs).
    const inspJobId = params.get('inspect');
    const inspToken = params.get('token');
    if(inspJobId && inspToken && !state.attendanceMode){
      state.inspectMode = true;
      state.inspectJobId = inspJobId;
      state.inspectToken = inspToken;
      state.inspectReport = 'loading';
    }
    // Same shared-link pattern as ?inspect= above, for the two other
    // anonymous customer-facing screens (see src/customer-portal.js).
    const quoteId = params.get('quote');
    const quoteToken = params.get('token');
    if(quoteId && quoteToken && !state.attendanceMode && !state.inspectMode){
      state.quoteMode = true;
      state.quoteId = quoteId;
      state.quoteToken = quoteToken;
      state.quoteResult = 'loading';
    }
    const invoiceId = params.get('invoice');
    const invoiceToken = params.get('token');
    if(invoiceId && invoiceToken && !state.attendanceMode && !state.inspectMode && !state.quoteMode){
      state.invoiceMode = true;
      state.invoiceId = invoiceId;
      state.invoiceToken = invoiceToken;
      state.invoiceResult = 'loading';
    }
    // The waiting-area Display Board is meant to be bookmarked as the home
    // page of a dedicated TV/tablet browser at the shop, so it needs to
    // load straight into board mode from a plain URL (?board=1) too, not
    // just via the login-screen link.
    if(params.get('board') && !state.attendanceMode && !state.inspectMode && !state.quoteMode && !state.invoiceMode){
      state.boardMode = true;
    }
  }catch(e){ /* malformed URL -- fall through to the normal login screen */ }
  try{
    const langRec = await window.storage.get('display-language', false);
    if(langRec && SUPPORTED_LANGUAGES.some(l=>l.code===langRec.value)) setDisplayLanguage(langRec.value);
  }catch(e){ /* key not set yet, or storage unavailable -- default state.displayLanguage stands */ }
  render();
  try{
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if(session){
      const enrolled = getFaceIdEnrollment();
      // Only gate behind Face ID when the cached enrollment actually matches
      // this session's account — otherwise (different staff logged in since,
      // enrollment cleared, unsupported browser) just restore normally.
      const shouldGate = enrolled && enrolled.email === session.user.email && await faceIdSupported();
      if(shouldGate){
        pendingFaceIdSession = session;
        state.authMode = 'faceid-lock';
        render();
      } else {
        await resolveSessionOrChallengeMfa(session);
      }
    }
  }catch(e){ reportError(e, 'Gagal semak sesi log masuk'); }
  supabaseClient.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
      unsubscribeRealtime();
      db = defaultDB();
      state.currentStaff = null;
      render();
    }
    if(event==='PASSWORD_RECOVERY'){
      // Arrived via a "reset password" email link — Supabase already
      // authenticated this session; make them set a new password before
      // letting them into the app rather than silently loading data.
      state.authMode = 'reset';
      state.loginError = '';
      render();
    }
  });
  // Auto-recover once the browser regains connectivity, instead of
  // requiring a manual page refresh to leave offline (cached-data) mode.
  window.addEventListener('online', async ()=>{
    if(state.offlineMode && state.currentStaff){
      try{
        const { data:{ session } } = await supabaseClient.auth.getSession();
        if(session) await handleAuthenticated(session);
      }catch(e){ /* still offline or another issue — will retry on the next online event */ }
    }
    // A mid-session save failure (network blip while already logged in)
    // never sets offlineMode -- only syncStatus='error' -- so it fell
    // through the branch above entirely and had to wait for the fixed
    // SAVE_RETRY_MS timer instead of reconnecting immediately. Retry right
    // away here too.
    if(state.syncStatus==='error' && state.currentStaff && !state.offlineMode) queueSave();
  });
  // Mobile browsers can fully suspend a backgrounded tab's timers/sockets
  // (screen lock, switching to another app for a while) — the realtime
  // WebSocket can end up silently dead, and its own reconnect logic was
  // suspended right along with it, so it doesn't always self-heal promptly
  // once the tab is foregrounded again. Force a fresh subscription on
  // resume rather than trusting whatever state it's in; this only restores
  // FUTURE live updates and deliberately does not re-fetch/replace `db`
  // (a wholesale remote reload here risks the same class of bug as
  // handleRemoteChange's old whole-array replacement — see modal-reference-identity).
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && state.currentStaff && !state.offlineMode){
      unsubscribeRealtime();
      subscribeRealtime();
    }
  });
  // Without this, closing the tab/reloading while a save is still failing
  // (or simply mid-flight) silently drops whatever hasn't reached Supabase
  // yet -- there's no offline write queue, db only lives in memory until a
  // save actually lands. The browser's own confirm dialog is the one
  // reliable way to make that moment NOT silent.
  window.addEventListener('beforeunload', (e)=>{
    if(state.syncStatus==='syncing' || state.syncStatus==='error'){
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function queueSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(runSaveCycle, 300);
}

// Runs at most one sync cycle at a time. Each cycle loops over every table
// with a real network round-trip per table, which can easily take longer
// than the 300ms debounce above under real latency (and got a bit longer
// still now that TABLE_MAP has grown) -- a queueSave() landing mid-cycle
// used to start a SECOND overlapping cycle that diffed against the same
// stale lastSynced snapshot as the first, so both cycles would try to
// upsert the same brand-new row (e.g. an audit_log entry). Whichever
// upsert lost the race then hit Postgres's ON CONFLICT DO UPDATE path for
// a row that now already existed -- which audit_log's RLS policies
// deliberately have no UPDATE rule for (append-only), so that second
// upsert failed outright with a 42501 and a false "sync failed" toast,
// even though the row had, in fact, already saved via the first cycle.
// Queuing a follow-up cycle instead of running concurrently fixes that.
//
// Tried firing every table's upsert via Promise.all instead of this
// sequential loop (no foreign keys between them -- see schema.sql, each is
// a standalone id/data-jsonb row, so nothing DB-side requires save order).
// Reverted it: with ~19 tables racing Postgres at once instead of one
// having a dedicated early slot in the cycle, an inventory update's
// realtime echo could arrive back at this same client noticeably later
// than before -- late enough, in one reproduced case, to land AFTER a
// subsequent local edit to the same record and silently overwrite it with
// stale data (handleRemoteChange() has no staleness check; see
// tests/new-features-batch2.test.js's CSV-import-after-checkout step,
// which caught this 3/3 runs with the parallel version and 0/3 with this
// sequential one). Fixing that properly means giving handleRemoteChange a
// real ordering/staleness guard -- worth doing as its own change, not as a
// side effect of a speed pass. Login is the actual complaint this round
// (see handleAuthenticated below and loadRemoteDB's audit_log cap), and
// neither of those touches this function.
async function runSaveCycle(){
  if(saveInFlight){ saveAgainNeeded = true; return; }
  saveInFlight = true;
  state.syncStatus = 'syncing';
  updateSyncIndicator();
  try{
    const newSnap = {};
    for(const [key, table] of Object.entries(TABLE_MAP)){
      // Skip a table known missing (schema not migrated yet -- see
      // missingTables' own comment) rather than let it throw here: this
      // loop is sequential and stops at the first error, so one unmigrated
      // table would otherwise silently block saving every OTHER table that
      // sorts after it too, not just fail to save itself.
      if(missingTables.has(table)) continue;
      newSnap[key] = await syncListTable(key, table, key==='auditLog');
    }
    newSnap.staff = await syncStaffTable();
    newSnap.settings = await syncSettings();
    lastSynced = newSnap;
    state.syncStatus = 'idle';
    updateSyncIndicator();
    clearTimeout(saveRetryTimer);
    saveRetryTimer = null;
  }catch(e){
    reportError(e, 'Gagal simpan data');
    state.syncStatus = 'error';
    updateSyncIndicator();
    showToast(state.language==='en' ? 'Sync failed — check your internet connection.' : 'Segerak gagal — semak sambungan internet anda.');
    // Previously a failed cycle only ever retried if some OTHER local edit
    // happened to call queueSave() again -- a save could fail once and then
    // sit silently unsynced indefinitely if the user didn't touch anything
    // else before closing the tab (see the beforeunload guard in initApp
    // for the other half of this fix). Keep retrying on a fixed interval
    // regardless of further user activity.
    clearTimeout(saveRetryTimer);
    saveRetryTimer = setTimeout(queueSave, SAVE_RETRY_MS);
  }finally{
    saveInFlight = false;
    if(saveAgainNeeded){ saveAgainNeeded = false; queueSave(); }
  }
}

