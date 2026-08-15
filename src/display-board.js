/* ============================= WAITING-AREA DISPLAY BOARD ============================= */
// Meant to run on a TV/tablet in the shop's waiting area so a customer can
// glance up and see their car's status without asking staff. Reached from
// the login screen's "Open Waiting Area Display Board" link, by bookmarking
// ?board=1 as that device's home page (see initApp() in sync-engine.js) --
// both stay working without logging in, intentionally, since that's how an
// always-on shop TV needs to load it -- or, for a staff member previewing/
// setting up that screen without logging out first, the "Open Display
// Board" button in Settings (see 'open-board-in-app' in event-handlers.js).
// Anonymous-safe: kiosk_list_active_jobs() is security-definer and returns
// only job no./plate/model/status for jobs not yet delivered -- no customer
// name/phone, no pricing, same minimal shape as kiosk_lookup_job.
let boardRefreshTimer = null;

function renderDisplayBoard(){
  const en = state.language==='en';
  const jobs = state.boardJobs;
  const statusLabel = en
    ? {waiting:'Waiting', progress:'In Progress', done:'Ready for Pickup'}
    : {waiting:'Menunggu', progress:'Dalam Proses', done:'Sedia Diambil'};
  const statusOrder = {progress:0, done:1, waiting:2};
  const now = new Date();
  const clockStr = now.toLocaleTimeString(dateLocale(),{hour:'2-digit',minute:'2-digit'});
  const dateStr = now.toLocaleDateString(dateLocale(),{weekday:'long', day:'numeric', month:'long'});
  let rows = '';
  if(jobs===null || jobs===undefined){
    rows = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:20px;">${en?'Loading…':'Memuatkan…'}</div>`;
  } else if(jobs.length===0){
    rows = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);font-size:20px;">${en?'No vehicles currently in the workshop.':'Tiada kenderaan sedang di bengkel.'}</div>`;
  } else {
    const sorted = [...jobs].sort((a,b)=>(statusOrder[a.status]??3)-(statusOrder[b.status]??3));
    rows = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:16px;">
      ${sorted.map(j=>`
        <div style="background:var(--panel);border-radius:14px;border:1px solid var(--border);padding:20px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;letter-spacing:.02em;">${esc(j.plate||'-')}</div>
          <div style="font-size:14px;color:var(--text-muted);margin:4px 0 12px;">${esc(j.model||'')}</div>
          <span class="pill pill-${j.status==='waiting'?'wait':j.status}" style="font-size:14px;padding:6px 14px;">${statusLabel[j.status]}</span>
        </div>
      `).join('')}
    </div>`;
  }
  return `
  <div style="min-height:100vh;background:var(--bg);padding:32px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logoMarkHtml(56)}
        <div>
          <div style="font-size:22px;font-weight:700;">${esc(db.settings.shopName)}</div>
          <div style="font-size:13px;color:var(--text-muted);">${en?'Workshop Status Board':'Papan Status Bengkel'}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:700;font-family:'IBM Plex Mono',monospace;">${clockStr}</div>
        <div style="font-size:13px;color:var(--text-muted);">${dateStr}</div>
      </div>
    </div>
    ${rows}
    <div style="text-align:center;margin-top:36px;">
      <span class="clickable" data-action="close-board" style="font-size:11px;color:var(--text-muted);text-decoration:underline;">←
        ${state.currentStaff
          ? (en?'Back to App':'Kembali ke Aplikasi')
          : (en?'Back to Staff Log In':'Kembali ke Log Masuk Staf')}
      </span>
    </div>
  </div>`;
}

async function loadDisplayBoardJobs(){
  try{
    const { data, error } = await supabaseClient.rpc('kiosk_list_active_jobs');
    if(error) throw error;
    state.boardJobs = data || [];
  }catch(e){
    reportError(e, 'Muatkan papan status bengkel gagal');
    state.boardJobs = state.boardJobs || [];
  }
  render();
}

function attachDisplayBoardHandlers(){
  if(!boardRefreshTimer){
    loadDisplayBoardJobs();
    boardRefreshTimer = setInterval(loadDisplayBoardJobs, 20000);
  }
  bindAction('close-board', ()=>{
    if(boardRefreshTimer){ clearInterval(boardRefreshTimer); boardRefreshTimer = null; }
    state.boardMode = false;
    state.boardJobs = null;
    render();
  });
}
