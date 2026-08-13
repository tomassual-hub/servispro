/* ============================= AI INSPECTION SUGGESTIONS =============================
   Calls the ai-suggest-checklist Edge Function (see supabase/functions/) to
   suggest likely causes and which checklist items to check first, based on
   a job's description -- a starting point for the mechanic, never a
   diagnosis on its own. The actual checklist is still filled in by hand,
   item by item, exactly as before; this only highlights where to look.
   Uses Google's Gemini API (free tier, no subscription) server-side in the
   Edge Function -- no API key or AI call ever happens client-side. */

async function requestAiSuggestion(job){
  const v = getVehicle(job.vehicleId);
  if(!(job.description||'').trim()){
    showToast(tt('Tiada penerangan kerja untuk dianalisis.'));
    return;
  }
  state.aiSuggestion = 'loading';
  render();
  try{
    const { data, error } = await supabaseClient.functions.invoke('ai-suggest-checklist', {
      body: { description: job.description, vehicleModel: v ? v.model : null, lang: state.language }
    });
    if(error) throw error;
    if(!data || data.error){
      state.aiSuggestion = data && data.error==='rate_limited' ? 'rate_limited' : 'unavailable';
      render();
      return;
    }
    state.aiSuggestion = { likelyCauses: data.likelyCauses||[], suggestedItems: data.suggestedItems||[] };
    render();
  }catch(e){
    reportError(e, 'Gagal dapatkan cadangan AI');
    state.aiSuggestion = 'unavailable';
    render();
  }
}

/* ============================= AI QUOTE ITEM SUGGESTIONS =============================
   Calls the ai-suggest-quote-items Edge Function to suggest which of this
   shop's OWN inventory items (and roughly how many) a mechanic would
   likely need for a job, based on its description + inspection findings
   (items marked "attention"/"replace"). A starting point for building a
   quotation/invoice in POS -- the mechanic still reviews and adjusts the
   cart by hand afterward. Only usable once a job is linked into POS
   (state.posJobId), since that's where the description/findings come from.
   Two callers: the "job-to-pos" action in event-handlers.js calls this
   with silent=true right away, pushing any suggested items straight into
   the cart with no toast if there's nothing to analyze yet; the manual
   "Cadangan AI" button in pos.js calls it without silent, which instead
   leaves items sitting in a side panel for the mechanic to Add/Add All by
   hand -- see renderAiQuoteSuggestionBox() in views/pos.js. */

// render() replaces the entire page and resets scroll to the top every
// time (true everywhere in this app, not just here) -- the manual "Cadangan
// AI" button sits down in the cart panel, so pressing it snaps the
// mechanic back to the item picker at the top before the result (loading
// text, then the actual suggestion box) ever lands, making a working
// suggestion look like nothing happened. Only used for the manual
// (non-silent) path; the automatic job-to-pos trigger relies on its own
// toast instead, which is position:fixed and visible regardless of scroll.
function scrollAiQuoteBoxIntoView(){
  document.getElementById('ai-quote-suggestion-box')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function requestAiQuoteSuggestion(silent){
  const job = db.jobs.find(j=>j.id===state.posJobId);
  if(!job) return;
  const v = getVehicle(job.vehicleId);
  const findings = Object.entries(job.inspection||{})
    .filter(([,st])=>st==='attention'||st==='replace')
    .map(([item,status])=>({item, status}));
  if(!(job.description||'').trim() && findings.length===0){
    // silent=true is the automatic call from job-to-pos (event-handlers.js) --
    // most jobs have nothing to analyze yet at that point, and a toast on
    // every single job sent to POS would be noise. The manual "Cadangan AI"
    // button in pos.js always calls this without silent, so that press still
    // gets the explanatory toast.
    if(!silent) showToast(tt('Tiada penerangan kerja atau dapatan pemeriksaan untuk dianalisis.'));
    return;
  }
  state.aiQuoteSuggestion = 'loading';
  render();
  if(!silent) scrollAiQuoteBoxIntoView();
  try{
    const { data, error } = await supabaseClient.functions.invoke('ai-suggest-quote-items', {
      body: {
        description: job.description, vehicleModel: v ? v.model : null, findings,
        inventory: db.inventory.map(i=>({id:i.id, name:i.name})),
        lang: state.language,
      }
    });
    if(error) throw error;
    if(!data || data.error){
      // A structured {error} response (HTTP 200) never throws, so without
      // this it was previously invisible everywhere -- console, Sentry, the
      // UI (just a generic "not available" line) -- with no way to tell
      // "rate limited" apart from "misconfigured" apart from "not staff"
      // short of reading Supabase's own function logs. Surface anything
      // that ISN'T the expected/benign rate_limited case.
      if(!data || data.error!=='rate_limited') reportError(new Error('ai-suggest-quote-items: '+(data ? data.error : 'empty response')), 'Cadangan sebut harga AI - respons ralat');
      state.aiQuoteSuggestion = data && data.error==='rate_limited' ? 'rate_limited' : 'unavailable';
      render();
      if(!silent) scrollAiQuoteBoxIntoView();
      return;
    }
    const items = data.items||[];
    if(silent){
      // Automatic call from job-to-pos: drop the items straight into the
      // cart instead of leaving them in the side panel waiting for an
      // "Add All" click -- guarded on posJobId still matching this job, in
      // case the mechanic already jumped to a different job's invoice
      // before this resolved (see the rapid job-to-pos/job-to-pos race
      // check-draft-ui.js exercises).
      if(state.posJobId===job.id && items.length){
        for(const item of items){
          const invItem = db.inventory.find(i=>i.id===item.id);
          state.posCart.push({ refId: item.id, name: invItem ? invItem.name : item.name, price: invItem ? invItem.price : 0, qty: item.qty });
        }
        showToast(items.length+tt(' item dicadangkan AI ditambah automatik ke troli — semak sebelum jana invois.'));
      }
      state.aiQuoteSuggestion = null;
      render();
      return;
    }
    state.aiQuoteSuggestion = { items };
    render();
    scrollAiQuoteBoxIntoView();
  }catch(e){
    reportError(e, 'Gagal dapatkan cadangan sebut harga AI');
    state.aiQuoteSuggestion = 'unavailable';
    render();
    if(!silent) scrollAiQuoteBoxIntoView();
  }
}

/* ============================= AI ASSISTANT (standalone) =============================
   Calls the ai-assistant Edge Function -- a general Q&A chat, deliberately
   independent of any other feature (not a job, not a shortcut to an
   existing screen). Reachable via the floating mobile-ai-bubble (see
   chrome.js). Same "no API key or AI call client-side" design as the
   checklist suggestion above -- this just has its own Edge Function since
   the request/response shape (a conversation) is different. */

function openAiAssistant(){
  state.aiAssistantMessages = [];
  state.aiAssistantBusy = false;
  setState({ modal: { type:'ai-assistant' } });
}

async function sendAiAssistantMessage(text){
  const trimmed = (text||'').trim();
  if(!trimmed || state.aiAssistantBusy) return;
  state.aiAssistantMessages.push({ role:'user', text: trimmed });
  state.aiAssistantBusy = true;
  render();
  try{
    const { data, error } = await supabaseClient.functions.invoke('ai-assistant', {
      body: { messages: state.aiAssistantMessages, lang: state.language }
    });
    if(error) throw error;
    if(!data || data.error || !data.reply){
      const msg = data && data.error==='rate_limited'
        ? tt('AI sedang sibuk buat masa ini. Cuba sebentar lagi.')
        : tt('Maaf, tidak dapat jawab buat masa ini. Cuba lagi sebentar lagi.');
      state.aiAssistantMessages.push({ role:'ai', text: msg });
    } else {
      state.aiAssistantMessages.push({ role:'ai', text: data.reply });
    }
  }catch(e){
    reportError(e, 'Gagal hubungi Mekanik AI');
    state.aiAssistantMessages.push({ role:'ai', text: tt('Maaf, tidak dapat jawab buat masa ini. Cuba lagi sebentar lagi.') });
  }
  state.aiAssistantBusy = false;
  render();
}

const AI_QUICK_QUESTIONS_MS = [
  'Enjin terlalu panas dan hilang kuasa',
  'Bunyi bising bila tekan brek',
  'Berapa kerap patut tukar minyak enjin?',
  'Terangkan kod OBD2 P0300',
];
const AI_QUICK_QUESTIONS_EN = [
  'Engine overheating and losing power',
  'Grinding noise when braking',
  'How often should engine oil be changed?',
  'Explain OBD2 code P0300',
];

function aiAssistantModalHTML(){
  const en = state.language==='en';
  const messages = state.aiAssistantMessages||[];
  const quickQuestions = en ? AI_QUICK_QUESTIONS_EN : AI_QUICK_QUESTIONS_MS;
  return `
  <div class="support-chat-head">
    <button class="btn-icon" data-action="close-modal">${ICONS.chevronLeft}</button>
    <div class="ai-assistant-head-avatar"><img src="${AI_AVATAR_FULL_DATA_URI}" alt=""></div>
    <h2 style="margin:0;flex:1;">${en?'Mechanic AI':'Mekanik AI'}</h2>
  </div>
  <div class="support-chat-messages" id="ai-assistant-messages">
    ${messages.length===0 ? `
    <div class="ai-assistant-empty">
      <div class="ai-assistant-mascot"><img src="${AI_AVATAR_FULL_DATA_URI}" alt=""></div>
      <div class="ai-assistant-greeting">${en?'How can I help you today?':'Macam mana saya boleh bantu hari ini?'}</div>
      <div class="ai-assistant-subtitle">${en?'Ask about vehicle specs, repair procedures, parts terminology, or general workshop know-how. This does not have access to this shop\'s own customers/jobs/inventory data.':'Tanya tentang spesifikasi kenderaan, prosedur pembaikan, istilah alat ganti, atau ilmu bengkel am. Ini tiada akses kepada data pelanggan/kerja/inventori kedai ini.'}</div>
      <div class="ai-assistant-chips">
        ${quickQuestions.map(q=>`<button class="ai-assistant-chip" data-action="ai-assistant-chip" data-text="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
    </div>
    ` : messages.map(m=>`
      <div class="support-msg ${m.role==='user' ? 'support-msg-mine':'support-msg-theirs'}">${esc(m.text)}</div>`).join('')}
    ${state.aiAssistantBusy ? `<div class="support-msg support-msg-theirs" style="color:var(--text-muted);">${en?'Thinking…':'Sedang berfikir…'}</div>` : ''}
  </div>
  <div class="ai-assistant-input-wrap">
    <div class="support-chat-input-row">
      <input id="ai-assistant-input" placeholder="${en?'Ask Mechanic AI anything…':'Tanya Mekanik AI apa-apa sahaja…'}" autocomplete="off" ${state.aiAssistantBusy?'disabled':''}>
      <button class="btn btn-primary" data-action="send-ai-assistant-message" ${state.aiAssistantBusy?'disabled':''}>${ICONS.sparkle}</button>
    </div>
    <div class="ai-assistant-disclaimer">${en?'Mechanic AI can make mistakes. Verify important information before relying on it.':'Mekanik AI boleh membuat kesilapan. Sahkan maklumat penting sebelum bergantung padanya.'}</div>
  </div>
  `;
}
