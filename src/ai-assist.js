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

// Bust-portrait mascot, reused at two sizes (small in the header, large in
// the empty state) purely via CSS on the wrapping element -- see
// .ai-assistant-head-avatar/.ai-assistant-mascot in styles.css. Flat vector
// illustration, not a photorealistic render -- deliberately simple shapes
// (circles/paths) so it stays crisp at any size with no image asset to
// ship/cache.
const AI_MASCOT_SVG = `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="aiMascotBg" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5847e8"/>
      <stop offset="1" stop-color="#241b66"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="80" fill="url(#aiMascotBg)"/>
  <path d="M28 158 C28 108 44 88 80 88 C116 88 132 108 132 158 Z" fill="#efe9ff"/>
  <path d="M50 92 L60 122 L74 118 L66 90 Z" fill="#d8cdfb"/>
  <path d="M110 92 L100 122 L86 118 L94 90 Z" fill="#d8cdfb"/>
  <rect x="63" y="118" width="34" height="24" rx="5" fill="#c9bcf7"/>
  <circle cx="80" cy="130" r="3" fill="#5847e8"/>
  <rect x="70" y="66" width="20" height="24" rx="8" fill="#f0b988"/>
  <circle cx="80" cy="52" r="34" fill="#f5c9a0"/>
  <circle cx="47" cy="54" r="6" fill="#f5c9a0"/>
  <circle cx="113" cy="54" r="6" fill="#f5c9a0"/>
  <path d="M44 40 C44 14 116 14 116 40 L116 46 L44 46 Z" fill="#1c1550"/>
  <ellipse cx="80" cy="46" rx="38" ry="7" fill="#241b66"/>
  <circle cx="80" cy="30" r="7" fill="#8a7bf0"/>
  <text x="80" y="33.5" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">S</text>
  <circle cx="68" cy="55" r="3.2" fill="#2a1f4d"/>
  <circle cx="92" cy="55" r="3.2" fill="#2a1f4d"/>
  <path d="M66 68 Q80 76 94 68" stroke="#9c6b45" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="58" cy="63" r="5" fill="#ff9f8f" opacity=".45"/>
  <circle cx="102" cy="63" r="5" fill="#ff9f8f" opacity=".45"/>
</svg>`;

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
    <div class="ai-assistant-head-avatar">${AI_MASCOT_SVG}</div>
    <h2 style="margin:0;flex:1;">${en?'AI Assistant':'Pembantu AI'}</h2>
    <button class="btn-icon" data-action="close-modal">${ICONS.x}</button>
  </div>
  <div class="support-chat-messages" id="ai-assistant-messages">
    ${messages.length===0 ? `
    <div class="ai-assistant-empty">
      <div class="ai-assistant-mascot">${AI_MASCOT_SVG}</div>
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
      <input id="ai-assistant-input" placeholder="${en?'Ask AI Assistant anything…':'Tanya Pembantu AI apa-apa sahaja…'}" autocomplete="off" ${state.aiAssistantBusy?'disabled':''}>
      <button class="btn btn-primary" data-action="send-ai-assistant-message" ${state.aiAssistantBusy?'disabled':''}>${ICONS.sparkle}</button>
    </div>
    <div class="ai-assistant-disclaimer">${en?'AI Assistant can make mistakes. Verify important information before relying on it.':'Pembantu AI boleh membuat kesilapan. Sahkan maklumat penting sebelum bergantung padanya.'}</div>
  </div>
  `;
}
