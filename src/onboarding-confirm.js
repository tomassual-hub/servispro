function getOnboardingSteps(){
  const en = state.language==='en';
  return [
    {icon:ICONS.wrench, title: en?'Welcome to ServisPro!':'Selamat Datang ke ServisPro!',
      desc: en?'This quick tour shows the main parts of the system in under a minute.':'Tur ringkas ini tunjukkan bahagian utama sistem dalam masa kurang seminit.'},
    {icon:ICONS.jobs, title: en?'Job Cards':'Kad Kerja',
      desc: en?'Create a job card for every vehicle that comes in. Track its status from Waiting all the way to Delivered — optionally assign it to a physical bay/lift, and mark up a damage diagram during inspection.':'Cipta kad kerja untuk setiap kenderaan yang masuk. Jejak statusnya dari Menunggu hingga Dihantar — boleh tugaskan ke bay/lif fizikal, dan tandakan diagram kerosakan semasa pemeriksaan.'},
    {icon:ICONS.pos, title: en?'POS, Quotations & Invoices':'POS, Sebut Harga & Invois',
      desc: en?'Sell parts and services (or bundle them into a Package), then generate an invoice — inventory deducts automatically. Not ready to commit? Save the cart as a Quotation first, or split one invoice across multiple payment methods.':'Jual alat ganti dan servis (atau gabung jadi Pakej), kemudian jana invois — inventori ditolak automatik. Belum pasti? Simpan troli sebagai Sebut Harga dahulu, atau pisah satu invois kepada beberapa kaedah bayaran.'},
    {icon:ICONS.inventory, title: en?'Inventory':'Inventori',
      desc: en?"Track stock levels — you'll see a warning badge in the sidebar when items run low, plus reorder suggestions grouped by supplier.":'Jejak paras stok — anda akan nampak lencana amaran di sidebar bila item hampir habis, plus cadangan pesanan semula ikut pembekal.'},
    {icon:ICONS.barcode, title: en?'QR Attendance & Customer Self-Service':'Kehadiran QR & Layan Diri Pelanggan',
      desc: en?"Print a staff member's personal QR code for clock in/out — no login needed. The same idea powers a shareable, sign-off-able inspection report link for customers, and a waiting-area Display Board showing live job status.":'Cetak kod QR peribadi staf untuk clock in/out — tiada log masuk diperlukan. Idea sama untuk pautan laporan pemeriksaan yang boleh dikongsi & ditandatangan pelanggan, serta Papan Paparan kawasan menunggu yang tunjuk status kerja secara langsung.'},
    {icon:ICONS.book, title: en?'Tech Reference':'Rujukan Teknikal',
      desc: en?"Build your own reference library per vehicle make/model — service schedules, oil types, torque specs, diagrams, and more. Nothing is pre-loaded; it's your team's own notes, kept organized.":'Bina perpustakaan rujukan anda sendiri ikut jenama/model kenderaan — jadual servis, jenis minyak, spesifikasi tork, gambar rajah dan banyak lagi. Tiada apa dipra-muat; ia nota pasukan anda sendiri, tersusun rapi.'},
    {icon:ICONS.chat, title: en?'Customers Can Help Themselves Too':'Pelanggan Boleh Layan Diri Juga',
      desc: en?"Beyond checking job status, customers can now approve quotations, view their full service history, book an appointment, and download receipts — all from a shared link, no account needed. They can also optionally register to see everything in one place.":'Selain semak status kerja, pelanggan kini boleh luluskan sebut harga, lihat sejarah servis penuh, tempah janji temu, dan muat turun resit — semua dari pautan dikongsi, tiada akaun diperlukan. Mereka juga boleh pilih untuk daftar akaun bagi lihat semua di satu tempat.'},
    {icon:ICONS.settings, title: en?"You're All Set!":'Anda Sudah Bersedia!',
      desc: en?'Visit Settings anytime to adjust tax, loyalty discounts, set monthly sales/unit targets (shown on the Dashboard), or turn on Simple Mode to hide the more advanced features for a cleaner everyday view.':'Lawati Tetapan bila-bila masa untuk laras cukai, diskaun setia, tetapkan sasaran jualan/unit bulanan (dipaparkan di Papan Pemuka), atau hidupkan Mod Ringkas untuk sorok ciri lanjutan bagi paparan harian lebih ringkas.'},
  ];
}

function finishOnboarding(){
  state.showOnboarding = false;
  render();
  try{ window.storage.set('onboarding-seen', '1', false); }catch(e){}
  // The full tour just shown already covers what's-new content (see the
  // "Customers Can Help Themselves Too" step) -- mark it seen too so a
  // brand-new staff member never gets the separate banner redundantly
  // right after finishing the tour that already told them the same thing.
  try{ window.storage.set(WHATS_NEW_KEY, '1', false); }catch(e){}
}

async function checkOnboarding(){
  try{
    await window.storage.get('onboarding-seen', false);
    // key exists -> already seen before, do nothing
  }catch(e){
    state.showOnboarding = true;
    state.onboardingStep = 0;
    render();
    return;
  }
  checkWhatsNew();
}

// Bump this string (any change works) whenever a "what's new" banner is
// worth surfacing to staff who already finished onboarding before that
// content existed -- their storage key won't match the new one, so they
// see it exactly once. Existing/brand-new-tour staff who already saw it
// (via finishOnboarding above, or a previous dismissal of this same key)
// never see it again.
const WHATS_NEW_KEY = 'whatsnew-2026-08-customer-portal-seen';
async function checkWhatsNew(){
  try{
    await window.storage.get(WHATS_NEW_KEY, false);
    // key exists -> already seen/dismissed, do nothing
  }catch(e){
    state.showWhatsNew = true;
    render();
  }
}
function dismissWhatsNew(){
  state.showWhatsNew = false;
  render();
  try{ window.storage.set(WHATS_NEW_KEY, '1', false); }catch(e){}
}

function renderOnboarding(){
  const steps = getOnboardingSteps();
  const step = steps[state.onboardingStep];
  const isLast = state.onboardingStep === steps.length-1;
  const en = state.language==='en';
  return `<div class="modal-overlay" style="z-index:150;">
    <div class="modal" style="max-width:380px;text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(242,167,59,.15);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${step.icon}</div>
      <h2>${step.title}</h2>
      <p style="font-size:13.5px;color:var(--text-muted);line-height:1.6;">${step.desc}</p>
      <div style="display:flex;gap:6px;justify-content:center;margin:16px 0;">
        ${steps.map((s,i)=>`<div style="width:7px;height:7px;border-radius:50%;background:${i===state.onboardingStep?'var(--accent)':'var(--border)'};"></div>`).join('')}
      </div>
      <div class="modal-foot" style="justify-content:center;">
        <button class="btn btn-outline" data-action="onboarding-skip">${en?'Skip':'Langkau'}</button>
        <button class="btn btn-primary" data-action="onboarding-next">${isLast?(en?'Get Started':'Mula Guna'):(en?'Next':'Seterusnya')}</button>
      </div>
    </div>
  </div>`;
}

function renderConfirmModal(){
  const c = state.confirmAction;
  const en = state.language==='en';
  // typedConfirmWord: for actions too severe for a single click+confirm to
  // safely gate (see 'reset-shop-data' in event-handlers.js) -- the button
  // stays disabled until the word is typed exactly, same "type DELETE to
  // confirm" pattern used elsewhere for irreversible, no-undo operations.
  // Every other askConfirm() caller in this app (delete-job, delete-
  // customer, etc.) leaves this unset and gets the plain single-step
  // dialog as before.
  const needsTyped = !!c.typedConfirmWord;
  return `<div class="modal-overlay" data-action="confirm-cancel"><div class="modal confirm-box" onclick="event.stopPropagation()">
    <div class="c-icon">${ICONS.alert}</div>
    <h2 style="text-align:center;">${c.title||(en?'Confirm Action':'Sahkan Tindakan')}</h2>
    <p>${c.message}</p>
    ${needsTyped ? `
    <div class="field">
      <label>${en?`Type `:'Taip '}<strong>${esc(c.typedConfirmWord)}</strong>${en?' to confirm':' untuk sahkan'}</label>
      <input id="confirm-typed-input" autocomplete="off" autocapitalize="off" spellcheck="false">
    </div>` : ''}
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="confirm-cancel">${t('btn_cancel')}</button>
      <button class="btn btn-danger" data-action="confirm-yes" ${needsTyped?'disabled':''}>${c.confirmLabel||t('btn_delete')}</button>
    </div>
  </div></div>`;
}

function askConfirm(message, onConfirm, opts){
  state.confirmAction = Object.assign({message, onConfirm}, opts||{});
  render();
}

