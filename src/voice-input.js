/* ============================= VOICE INPUT (speech-to-text) =============================
   Lets a mechanic/kerani dictate a job description instead of typing it,
   using the browser's own built-in speech recognition (Web Speech API) --
   entirely client-side, no server call, no AI cost, nothing added to any
   Edge Function. Only Chromium-based browsers support this today, which
   covers this app's own Android APK (a Trusted Web Activity wrapping
   Chrome) -- feature-detected, and the mic button simply doesn't render
   at all where it's unsupported (see voiceInputSupported() below), same
   "hide rather than show a broken button" pattern already used for the AI
   features when their Edge Function isn't configured yet.

   Deliberately never calls render(): render() replaces the whole page's
   innerHTML on every call (see the comment at the top of render-core.js),
   which would wipe out anything the user already typed into an
   uncontrolled <textarea> (job descriptions aren't tracked in `state`,
   just read from the live DOM on submit) the moment recording starts.
   The "listening" indicator is toggled directly on the button element
   instead -- a plain DOM mutation, not a state change. */

function voiceInputSupported(){
  const w = /** @type {any} */ (window);
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Small mic button meant to sit inline next to a field's <label>, targeting
// the textarea/input with id `targetId`. Renders to '' (nothing) where
// voice input isn't supported -- same "hide rather than show a broken
// button" pattern as the AI features.
function voiceInputBtnHTML(targetId, title){
  if(!voiceInputSupported()) return '';
  const en = state.language==='en';
  return `<button type="button" class="btn-icon voice-input-btn" data-action="voice-input" data-target="${targetId}" title="${title || (en?'Dictate':'Rakam suara')}">${ICONS.mic}</button>`;
}

let activeRecognition = null;
let activeRecognitionBtn = null;

function startVoiceInput(targetId, btnEl){
  if(!voiceInputSupported()) return;
  if(activeRecognition){
    // Only one recognition session (and one visible "listening" button) at
    // a time -- stop whatever's already running first. If the SAME button
    // was clicked again, that's a toggle-off: stop and don't restart.
    const wasSameBtn = activeRecognitionBtn===btnEl;
    activeRecognition.stop();
    if(wasSameBtn) return;
  }
  const w = /** @type {any} */ (window);
  const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = state.language==='en' ? 'en-US' : 'ms-MY';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  activeRecognition = recognition;
  activeRecognitionBtn = btnEl;
  btnEl.classList.add('voice-listening');

  recognition.onresult = (event)=>{
    let transcript = '';
    for(let i=0;i<event.results.length;i++) transcript += event.results[i][0].transcript;
    transcript = transcript.trim();
    const el = /** @type {HTMLTextAreaElement|null} */ (document.getElementById(targetId));
    if(el && transcript){
      el.value = (el.value.trim() ? el.value.trim()+' ' : '') + transcript;
    }
  };
  recognition.onerror = (event)=>{
    // "no-speech"/"aborted" are routine (mic timed out with nothing said,
    // or the user toggled it off themselves) -- not worth a toast.
    if(event.error!=='no-speech' && event.error!=='aborted'){
      showToast(tt('Tidak dapat kenal pasti pertuturan. Cuba lagi.'));
    }
  };
  recognition.onend = ()=>{
    btnEl.classList.remove('voice-listening');
    activeRecognition = null;
    activeRecognitionBtn = null;
  };
  try{
    recognition.start();
  }catch(e){
    btnEl.classList.remove('voice-listening');
    activeRecognition = null;
    activeRecognitionBtn = null;
  }
}
