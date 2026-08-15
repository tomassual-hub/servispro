/* ============================= PAYROLL ============================= */
// A ledger, not a payment processor -- same pattern as POS "payment method"
// or the DuitNow QR: real money moves outside this app (bank transfer, cash,
// etc.), this only calculates what's owed and records that it was paid.
// Deliberately does NOT calculate EPF/SOCSO/EIS/PCB -- getting Malaysian
// statutory payroll deductions wrong has real legal/tax consequences, and
// this is a small-shop convenience tool, not licensed payroll software.
function currentMonthStr(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function monthLabel(monthStr){
  const [y,m] = monthStr.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString(dateLocale(), {month:'long', year:'numeric'});
}

function shiftMonth(monthStr, delta){
  const [y,m] = monthStr.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Commission math mirrors viewReports()'s mechanic-performance calculation
// exactly (job.mechanic name match, invoice total attributed to that
// mechanic's jobs, net of any credit notes issued against that invoice —
// see creditNotesForInvoice()'s comment for why) — just scoped to a
// calendar month instead of "last N days".
function computeMonthlyPay(staffMember, month){
  const [y,m] = month.split('-').map(Number);
  const periodStart = new Date(y, m-1, 1).getTime();
  const periodEnd = new Date(y, m, 1).getTime();
  const baseSalary = Number(staffMember.baseSalary)||0;
  const jobsById = new Map(db.jobs.map(j=>[j.id, j]));
  let commissionRevenue = 0;
  db.invoices.forEach(inv=>{
    // A draft invoice (auto-created empty when a job is sent to POS, see
    // job-to-pos in event-handlers.js) has items:[]/total:0 anyway, so it
    // wouldn't add commission on its own -- excluded mainly so a mechanic
    // isn't shown as having "sold" something that's still an empty draft.
    if(inv.draft) return;
    if(inv.createdAt<periodStart || inv.createdAt>=periodEnd) return;
    if(!inv.jobId) return;
    const job = jobsById.get(inv.jobId);
    if(job && job.mechanic===staffMember.name){
      const credited = creditNotesForInvoice(inv.id).reduce((s,cn)=>s+cn.total,0);
      commissionRevenue += Math.max(0, inv.total - credited);
    }
  });
  const commissionPct = Number(staffMember.commissionPercent)||0;
  const commission = commissionRevenue*commissionPct/100;
  return { baseSalary, commissionRevenue, commissionPct, commission, total: baseSalary+commission };
}

function viewPayroll(){
  const en = state.language==='en';
  const month = state.payrollMonth || currentMonthStr();
  const isCurrentMonth = month === currentMonthStr();

  const rows = db.staff.map(s=>({
    staff: s,
    pay: computeMonthlyPay(s, month),
    record: db.payrollRecords.find(r=>r.staffId===s.id && r.month===month),
  }));

  const history = [...db.payrollRecords].sort((a,b)=>b.paidAt-a.paidAt).slice(0,20);

  return `
  <div class="section-head">
    <div><div class="sub">${en?'Calculate and record monthly staff pay':'Kira dan rekod gaji staf bulanan'}</div></div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button class="btn-icon" data-action="payroll-prev-month" title="${en?'Previous month':'Bulan sebelum'}" style="font-size:18px;">‹</button>
      <div style="font-weight:700;font-size:15px;min-width:150px;text-align:center;">${monthLabel(month)}</div>
      <button class="btn-icon" data-action="payroll-next-month" title="${en?'Next month':'Bulan seterusnya'}" style="font-size:18px;" ${isCurrentMonth?'disabled':''}>›</button>
    </div>
  </div>

  <div style="background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:12px;color:var(--text-muted);">
    ${en
      ? '<strong>Note:</strong> Base Salary + Commission is calculated automatically. Statutory deductions (EPF/SOCSO/EIS/PCB) are entered manually by you when marking a payment paid — this app does not calculate those rates itself. Verify your figures against LHDN/KWSP/PERKESO.'
      : '<strong>Nota:</strong> Gaji Pokok + Komisen dikira automatik. Potongan statutori (KWSP/PERKESO/EIS/PCB) dimasukkan secara manual oleh anda semasa tandakan bayaran — sistem ini tidak mengira kadar tersebut sendiri. Sahkan angka anda dengan LHDN/KWSP/PERKESO.'}
  </div>

  <div class="grid grid-3">
    ${rows.length===0 ? emptyState(en?'No staff yet.':'Belum ada staf.') : rows.map(({staff, pay, record})=>`
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-weight:700;">${esc(staff.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${esc(staff.role)}</div>
          </div>
          ${record ? `<span class="pill pill-done">${en?'Paid':'Dibayar'}</span>` : `<span class="pill pill-wait">${en?'Unpaid':'Belum Dibayar'}</span>`}
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Base Salary':'Gaji Pokok'}</span><span>${fmtRM(pay.baseSalary)}</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Commission':'Komisen'} (${pay.commissionPct}%)</span><span>${fmtRM(pay.commission)}</span></div>
        <div style="font-weight:700;color:var(--accent);display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);"><span>${en?'Gross Total':'Jumlah Kasar'}</span><span>${fmtRM(pay.total)}</span></div>
        ${record
          ? `${record.netPay!==record.total ? `<div style="font-weight:700;color:var(--success);display:flex;justify-content:space-between;margin-top:4px;"><span>${en?'Net Pay':'Gaji Bersih'}</span><span>${fmtRM(record.netPay)}</span></div>` : ''}
             <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${en?'Paid':'Dibayar'} ${fmtDateTime(record.paidAt)} ${en?'by':'oleh'} ${esc(record.paidBy)}</div>
             <div style="display:flex;gap:8px;margin-top:8px;">
               <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" data-action="print-payslip" data-id="${record.id}">${ICONS.printer} ${en?'Payslip':'Penyata'}</button>
               <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" data-action="undo-payroll-payment" data-id="${record.id}">${en?'Undo':'Batal Rekod'}</button>
             </div>`
          : `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:10px;justify-content:center;" data-action="mark-payroll-paid" data-staffid="${staff.id}">${en?'Mark as Paid':'Tandakan Dibayar'}</button>`}
      </div>`).join('')}
  </div>

  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.history} ${en?'Payment History':'Sejarah Bayaran'}</h2>
    ${history.length===0 ? emptyState(en?'No payments recorded yet.':'Belum ada bayaran direkod.') : `
    <div class="table-wrap"><table>
      <thead><tr><th>${en?'Staff':'Staf'}</th><th>${en?'Month':'Bulan'}</th><th>${en?'Gross':'Kasar'}</th><th>${en?'Net Pay':'Gaji Bersih'}</th><th>${en?'Paid At':'Tarikh Bayar'}</th><th>${en?'By':'Oleh'}</th><th></th></tr></thead>
      <tbody>
        ${history.map(r=>`
          <tr>
            <td style="font-weight:600;">${esc(r.staffName)}</td>
            <td>${monthLabel(r.month)}</td>
            <td>${fmtRM(r.total)}</td>
            <td style="color:var(--success);font-weight:600;">${fmtRM(r.netPay!==undefined ? r.netPay : r.total)}</td>
            <td>${fmtDateTime(r.paidAt)}</td>
            <td>${esc(r.paidBy)}</td>
            <td><button class="btn-icon" data-action="print-payslip" data-id="${r.id}" title="${en?'Print payslip':'Cetak penyata'}">${ICONS.printer}</button></td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
  `;
}

// Standard payslip structure (Pendapatan/Earnings -> Potongan/Deductions ->
// Gaji Bersih/Net Pay). Deduction fields default to 0 and are entered
// manually — this modal does arithmetic (subtraction) only, never a
// statutory rate, so filling them in doesn't reintroduce the "calculating
// EPF/SOCSO wrong has legal consequences" risk the rest of this feature
// deliberately avoids.
function payrollPaymentModalHTML(staffId){
  const en = state.language==='en';
  const staff = db.staff.find(s=>s.id===staffId);
  const month = state.payrollMonth || currentMonthStr();
  const pay = staff ? computeMonthlyPay(staff, month) : { baseSalary:0, commissionPct:0, commission:0, total:0 };
  return `
    <h2>${ICONS.wallet} ${en?'Record Payment':'Rekod Bayaran'} — ${esc(staff?staff.name:'')}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${monthLabel(month)}</p>
    <div style="background:var(--panel-alt);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12.5px;">
      <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${en?'Base Salary':'Gaji Pokok'}</span><span>${fmtRM(pay.baseSalary)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>${en?'Commission':'Komisen'} (${pay.commissionPct}%)</span><span>${fmtRM(pay.commission)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0 0;margin-top:4px;border-top:1px dashed var(--border);font-weight:700;"><span>${en?'Gross Total':'Jumlah Kasar'}</span><span>${fmtRM(pay.total)}</span></div>
    </div>
    <p style="font-size:11.5px;color:var(--text-muted);margin:0 0 8px;">${en?'Statutory deductions (optional — leave 0 if not applicable):':'Potongan statutori (pilihan — biar 0 jika tidak berkenaan):'}</p>
    <div class="field-row">
      <div class="field"><label>${en?'EPF/KWSP (Employee)':'KWSP (Pekerja)'}</label><input id="pr-epf" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label>SOCSO/PERKESO</label><input id="pr-socso" type="number" min="0" step="0.01" value="0"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>EIS</label><input id="pr-eis" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label>PCB</label><input id="pr-pcb" type="number" min="0" step="0.01" value="0"></div>
    </div>
    <div class="field"><label>${en?'Other Deductions':'Potongan Lain'}</label><input id="pr-other" type="number" min="0" step="0.01" value="0"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="confirm-payroll-payment" data-staffid="${staffId}">${en?'Confirm Payment':'Sahkan Bayaran'}</button>
    </div>
  `;
}
