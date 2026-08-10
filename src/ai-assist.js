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
   cart by hand exactly as before; this only pre-fills suggestions. Only
   usable once a job is linked into POS (state.posJobId), since that's
   where the description/findings come from -- see the "job-to-pos" action
   in event-handlers.js and the AI button in pos.js. */

async function requestAiQuoteSuggestion(){
  const job = db.jobs.find(j=>j.id===state.posJobId);
  if(!job) return;
  const v = getVehicle(job.vehicleId);
  const findings = Object.entries(job.inspection||{})
    .filter(([,st])=>st==='attention'||st==='replace')
    .map(([item,status])=>({item, status}));
  if(!(job.description||'').trim() && findings.length===0){
    showToast(tt('Tiada penerangan kerja atau dapatan pemeriksaan untuk dianalisis.'));
    return;
  }
  state.aiQuoteSuggestion = 'loading';
  render();
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
      state.aiQuoteSuggestion = data && data.error==='rate_limited' ? 'rate_limited' : 'unavailable';
      render();
      return;
    }
    state.aiQuoteSuggestion = { items: data.items||[] };
    render();
  }catch(e){
    reportError(e, 'Gagal dapatkan cadangan sebut harga AI');
    state.aiQuoteSuggestion = 'unavailable';
    render();
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
    reportError(e, 'Gagal hubungi Pembantu AI');
    state.aiAssistantMessages.push({ role:'ai', text: tt('Maaf, tidak dapat jawab buat masa ini. Cuba lagi sebentar lagi.') });
  }
  state.aiAssistantBusy = false;
  render();
}

function aiAssistantModalHTML(){
  const en = state.language==='en';
  const messages = state.aiAssistantMessages||[];
  return `
  <div class="support-chat-head">
    <h2 style="margin:0;flex:1;">${ICONS.sparkle} ${en?'AI Assistant':'Pembantu AI'}</h2>
    <button class="btn-icon" data-action="close-modal">${ICONS.x}</button>
  </div>
  <div class="support-chat-messages" id="ai-assistant-messages">
    ${messages.length===0 ? `<div style="text-align:center;color:var(--text-muted);font-size:12.5px;padding:30px 10px;">${en?'Ask about vehicle specs, repair procedures, parts terminology, or general workshop know-how. This does not have access to this shop\'s own customers/jobs/inventory data.':'Tanya tentang spesifikasi kenderaan, prosedur pembaikan, istilah alat ganti, atau ilmu bengkel am. Ini tiada akses kepada data pelanggan/kerja/inventori kedai ini.'}</div>` : messages.map(m=>`
      <div class="support-msg ${m.role==='user' ? 'support-msg-mine':'support-msg-theirs'}">${esc(m.text)}</div>`).join('')}
    ${state.aiAssistantBusy ? `<div class="support-msg support-msg-theirs" style="color:var(--text-muted);">${en?'Thinking…':'Sedang berfikir…'}</div>` : ''}
  </div>
  <div class="support-chat-input-row">
    <input id="ai-assistant-input" placeholder="${en?'Ask a question…':'Tanya soalan…'}" autocomplete="off" ${state.aiAssistantBusy?'disabled':''}>
    <button class="btn btn-primary" data-action="send-ai-assistant-message" ${state.aiAssistantBusy?'disabled':''}>${ICONS.sparkle}</button>
  </div>
  `;
}
