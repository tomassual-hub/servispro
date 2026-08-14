/* ============================= PRINT CREDIT NOTE ============================= */
function printCreditNote(cn, invoice){
  const c = getCustomer(cn.customerId);
  const s = db.settings;
  const en = state.language==='en';
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          <div class="pi-addr">
            ${s.shopPhone ? esc(s.shopPhone) : ''}
            ${s.shopRegNo ? (s.shopPhone?' &middot; ':'')+(en?'Reg. No: ':'No. Pendaftaran: ')+esc(s.shopRegNo) : ''}
          </div>
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${en?'CREDIT NOTE':'NOTA KREDIT'}</div>
          <div class="pi-row"><span>${en?'No.':'No.'}</span><span>${esc(cn.creditNoteNo)}</span></div>
          <div class="pi-row"><span>${en?'Date':'Tarikh'}</span><span>${fmtDateTime(cn.createdAt)}</span></div>
          <div class="pi-row"><span>${en?'Against Invoice':'Terhadap Invois'}</span><span>${invoice?esc(invoice.invoiceNo):'-'}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${en?'Issued To':'Dikeluarkan Kepada'}</div>
        <div class="pi-billto-name">${c?esc(c.name):(en?'Walk-in Customer':'Pelanggan Walk-in')}</div>
      </div>
      <div class="field"><label style="text-transform:none;font-size:11px;color:#999;">${en?'Reason':'Sebab'}</label><div style="font-size:12.5px;">${esc(cn.reason)}</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>${en?'Description':'Perkara'}</th><th style="text-align:center;">${en?'Qty':'Kuantiti'}</th><th style="text-align:right;">${en?'Unit Price':'Harga Seunit'}</th><th style="text-align:right;">${en?'Amount':'Jumlah'}</th></tr></thead>
        <tbody>
          ${cn.items.map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price)}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-totals">
        <div class="pi-row"><span>${en?'Subtotal':'Subjumlah'}</span><span>${fmtRM(cn.subtotal)}</span></div>
        ${cn.tax>0 ? `<div class="pi-row"><span>SST</span><span>${fmtRM(cn.tax)}</span></div>` : ''}
        <div class="pi-row pi-total"><span>${en?'TOTAL CREDIT':'JUMLAH KREDIT'}</span><span>-${fmtRM(cn.total)}</span></div>
      </div>
      <div class="pi-foot">${en?'This document reduces the amount owed on the invoice referenced above.':'Dokumen ini mengurangkan jumlah yang perlu dibayar pada invois yang dirujuk di atas.'}</div>
    </div>
  `;
  window.print();
}

/* ============================= PRINT QUOTATION ============================= */
function printQuotation(q){
  const c = getCustomer(q.customerId);
  const v = getVehicle(q.vehicleId);
  const s = db.settings;
  const en = state.language==='en';
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          <div class="pi-addr">
            ${s.shopPhone ? esc(s.shopPhone) : ''}
            ${s.shopRegNo ? (s.shopPhone?' &middot; ':'')+(en?'Reg. No: ':'No. Pendaftaran: ')+esc(s.shopRegNo) : ''}
          </div>
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${en?'QUOTATION':'SEBUT HARGA'}</div>
          <div class="pi-row"><span>${en?'No.':'No.'}</span><span>${esc(q.quoteNo)}</span></div>
          <div class="pi-row"><span>${en?'Date':'Tarikh'}</span><span>${fmtDateTime(q.createdAt)}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${en?'Prepared For':'Disediakan Untuk'}</div>
        <div class="pi-billto-name">${c?esc(c.name):(en?'Walk-in Customer':'Pelanggan Walk-in')}</div>
        ${c && c.phone ? `<div class="pi-addr">${esc(c.phone)}</div>` : ''}
        ${v ? `<div class="pi-addr">${esc(v.plate)} — ${esc(v.model||'')}</div>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>${en?'Description':'Perkara'}</th><th style="text-align:center;">${en?'Qty':'Kuantiti'}</th><th style="text-align:right;">${en?'Unit Price':'Harga Seunit'}</th><th style="text-align:right;">${en?'Amount':'Jumlah'}</th></tr></thead>
        <tbody>
          ${q.items.map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price)}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-totals">
        <div class="pi-row"><span>${en?'Subtotal':'Subjumlah'}</span><span>${fmtRM(q.subtotal)}</span></div>
        ${q.discount>0 ? `<div class="pi-row"><span>${en?'Discount':'Diskaun'}</span><span>-${fmtRM(q.discount)}</span></div>` : ''}
        ${q.tax>0 ? `<div class="pi-row"><span>SST (${q.taxRate}%)</span><span>${fmtRM(q.tax)}</span></div>` : ''}
        <div class="pi-row pi-total"><span>${en?'ESTIMATED TOTAL':'JUMLAH ANGGARAN'}</span><span>${fmtRM(q.total)}</span></div>
      </div>
      <div class="pi-foot">${en?'This is an estimate only, not a tax invoice. Prices may change if parts availability or job scope changes.':'Ini adalah anggaran sahaja, bukan invois cukai. Harga mungkin berubah jika ketersediaan alat ganti atau skop kerja berubah.'}</div>
    </div>
  `;
  window.print();
}

/* ============================= PRINT INVOICE ============================= */
// Standard business invoice layout: letterhead (name/address/phone/SSM &
// SST reg. no.), a distinct invoice number + date block, a "Bill To"
// section, an itemized table with unit price separated from line amount,
// then subtotal/discount/tax/total — the fields any accountant or LHDN
// e-Invoice record-keeping check would expect to find, not just a receipt
// strip. paymentQR/thank-you footer kept from the original.
function printInvoice(inv){
  const c = getCustomer(inv.customerId);
  const v = getVehicle(inv.vehicleId);
  const job = inv.jobId ? db.jobs.find(j=>j.id===inv.jobId) : null;
  const s = db.settings;
  const en = state.language==='en';
  // Malaysian SST regulations require the document to be titled "Tax
  // Invoice" specifically when service/sales tax is actually charged on
  // it -- a plain "Invoice" is only correct when no SST applies (e.g. shop
  // isn't SST-registered, or this particular sale is untaxed).
  const docTitle = inv.tax>0 ? (en?'TAX INVOICE':'INVOIS CUKAI') : (en?'INVOICE':'INVOIS');
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          <div class="pi-addr">
            ${s.shopPhone ? esc(s.shopPhone) : ''}
            ${s.shopRegNo ? (s.shopPhone?' &middot; ':'')+(en?'Reg. No: ':'No. Pendaftaran: ')+esc(s.shopRegNo) : ''}
            ${s.shopSstNo ? '<br>'+(en?'SST No: ':'No. SST: ')+esc(s.shopSstNo) : ''}
            ${s.shopTin ? (s.shopSstNo?' &middot; ':'<br>')+(en?'TIN: ':'No. TIN: ')+esc(s.shopTin) : ''}
          </div>
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${docTitle}</div>
          <div class="pi-row"><span>${en?'No.':'No. Invois'}</span><span>${esc(inv.invoiceNo)}</span></div>
          <div class="pi-row"><span>${en?'Date':'Tarikh'}</span><span>${fmtDateTime(inv.createdAt)}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${state.language==='en'?'Bill To':'Kepada'}</div>
        <div class="pi-billto-name">${c?esc(c.name):(state.language==='en'?'Walk-in Customer':'Pelanggan Walk-in')}</div>
        ${c && c.phone ? `<div class="pi-addr">${esc(c.phone)}</div>` : ''}
        ${v ? `<div class="pi-addr">${esc(v.plate)} — ${esc(v.model||'')}</div>` : ''}
      </div>
      ${job && (job.description||'').trim() ? `
      <div style="margin:10px 0;">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;">${en?'Job Description':'Penerangan Kerja'}</div>
        <div style="font-size:12.5px;white-space:pre-wrap;">${esc(job.description)}</div>
      </div>` : ''}
      <div class="table-wrap"><table>
        <thead><tr><th>${state.language==='en'?'Description':'Perkara'}</th><th style="text-align:center;">${state.language==='en'?'Qty':'Kuantiti'}</th><th style="text-align:right;">${state.language==='en'?'Unit Price':'Harga Seunit'}</th><th style="text-align:right;">${state.language==='en'?'Amount':'Jumlah'}</th></tr></thead>
        <tbody>
          ${inv.items.map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price)}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-totals">
        <div class="pi-row"><span>${state.language==='en'?'Subtotal':'Subjumlah'}</span><span>${fmtRM(inv.subtotal)}</span></div>
        ${inv.discount>0 ? `<div class="pi-row"><span>${state.language==='en'?'Discount':'Diskaun'}</span><span>-${fmtRM(inv.discount)}</span></div>` : ''}
        ${inv.tax>0 ? `<div class="pi-row"><span>SST (${inv.taxRate}%)</span><span>${fmtRM(inv.tax)}</span></div>` : ''}
        <div class="pi-row pi-total"><span>${state.language==='en'?'TOTAL':'JUMLAH'}</span><span>${fmtRM(inv.total)}</span></div>
      </div>
      <div class="pi-line"></div>
      ${inv.payments && inv.payments.length ? `
        ${inv.payments.map(p=>`<div class="pi-row"><span>${esc(p.method)}</span><span>${fmtRM(p.amount)}</span></div>`).join('')}
        ${invoiceBalanceDue(inv)>0.004 ? `<div class="pi-row" style="color:#c0392b;font-weight:700;"><span>${en?'BALANCE DUE':'BAKI TERTUNGGAK'}</span><span>${fmtRM(invoiceBalanceDue(inv))}</span></div>` : ''}
      ` : `<div class="pi-row"><span>${state.language==='en'?'Payment Method':'Kaedah Bayaran'}</span><span>${esc(inv.payment)}</span></div>`}
      ${db.settings.paymentQR ? `
      <div style="text-align:center;margin-top:10px;">
        <img src="${db.settings.paymentQR}" alt="DuitNow QR" style="width:130px;height:130px;object-fit:contain;margin:6px auto;display:block;">
        <div style="font-size:11px;">${state.language==='en'?'Scan to pay (DuitNow)':'Imbas untuk bayar (DuitNow)'}</div>
      </div>` : ''}
      <div class="pi-foot">${state.language==='en'?'Thank you for your business.':'Terima kasih kerana menggunakan perkhidmatan kami.'}</div>
    </div>
  `;
  window.print();
}

function printJobCard(job){
  const c = getCustomer(job.customerId);
  const v = getVehicle(job.vehicleId);
  const en = state.language==='en';
  const statusLabel = en
    ? {waiting:'Waiting', progress:'In Progress', done:'Ready', delivered:'Delivered'}[job.status]
    : {waiting:'Menunggu', progress:'Dalam Proses', done:'Siap', delivered:'Dihantar'}[job.status];
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">${en?'Service Job Card — Place on Car Dashboard':'Kad Kerja Servis — Letak di Dashboard Kereta'}</div>
      <div class="pi-row"><span>${en?'Job Card No.':'No. Kad Kerja'}</span><span>${job.jobNo}</span></div>
      <div class="pi-row"><span>${en?'Date In':'Tarikh Masuk'}</span><span>${fmtDateTime(job.createdAt)}</span></div>
      <div class="pi-row"><span>Status</span><span>${statusLabel}</span></div>
      <div class="pi-line"></div>
      <div class="pi-row"><span>${en?'Customer':'Pelanggan'}</span><span>${c?esc(c.name):'-'}</span></div>
      ${v?`<div class="pi-row"><span>${en?'Vehicle':'Kenderaan'}</span><span>${esc(v.plate)} (${esc(v.model)})</span></div>`:''}
      <div class="pi-row"><span>${en?'Mechanic':'Mekanik'}</span><span>${esc(job.mechanic||'-')}</span></div>
      <div class="pi-line"></div>
      <div style="font-size:12px;margin-bottom:6px;"><strong>${en?'Job Description:':'Penerangan Kerja:'}</strong></div>
      <div style="font-size:12.5px;margin-bottom:14px;">${esc(job.description||'-')}</div>
      <div class="pi-foot">${esc(db.settings.shopPhone||'')}</div>
    </div>
  `;
  window.print();
}

// Standard Malaysian payslip structure: Pendapatan (Earnings) -> Potongan
// (Deductions) -> Gaji Bersih (Net Pay). Same letterhead style as
// printInvoice() -- a payslip is a formal document too, not a receipt strip.
// Deduction fields default to 0 for records saved before this structure
// existed (?? 0), so older payslips still print correctly instead of "RM NaN".
function printPayslip(record){
  const s = db.settings;
  const en = state.language==='en';
  const epf = record.epf ?? 0, socso = record.socso ?? 0, eis = record.eis ?? 0,
        pcb = record.pcb ?? 0, otherDeductions = record.otherDeductions ?? 0;
  const totalDeductions = epf+socso+eis+pcb+otherDeductions;
  const netPay = record.netPay ?? record.total;
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          <div class="pi-addr">
            ${s.shopPhone ? esc(s.shopPhone) : ''}
            ${s.shopRegNo ? (s.shopPhone?' &middot; ':'')+(en?'Reg. No: ':'No. Pendaftaran: ')+esc(s.shopRegNo) : ''}
          </div>
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${en?'PAYSLIP':'PENYATA GAJI'}</div>
          <div class="pi-row"><span>${en?'Period':'Tempoh'}</span><span>${monthLabel(record.month)}</span></div>
          <div class="pi-row"><span>${en?'Paid On':'Tarikh Bayar'}</span><span>${fmtDate(record.paidAt)}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${en?'Employee':'Pekerja'}</div>
        <div class="pi-billto-name">${esc(record.staffName)}</div>
      </div>

      <div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-top:16px;">${en?'Earnings (Pendapatan)':'Pendapatan (Earnings)'}</div>
      <div class="pi-totals" style="max-width:none;margin-left:0;">
        <div class="pi-row"><span>${en?'Base Salary':'Gaji Pokok'}</span><span>${fmtRM(record.baseSalary)}</span></div>
        <div class="pi-row"><span>${en?'Commission':'Komisen'} (${record.commissionPct}% ${en?'of':'daripada'} ${fmtRM(record.commissionRevenue)})</span><span>${fmtRM(record.commission)}</span></div>
        <div class="pi-row" style="font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:6px;"><span>${en?'GROSS TOTAL':'JUMLAH KASAR'}</span><span>${fmtRM(record.total)}</span></div>
      </div>

      <div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-top:16px;">${en?'Deductions (Potongan)':'Potongan (Deductions)'}</div>
      <div class="pi-totals" style="max-width:none;margin-left:0;">
        <div class="pi-row"><span>EPF / KWSP (${en?'Employee':'Pekerja'})</span><span>${fmtRM(epf)}</span></div>
        <div class="pi-row"><span>SOCSO / PERKESO</span><span>${fmtRM(socso)}</span></div>
        <div class="pi-row"><span>EIS</span><span>${fmtRM(eis)}</span></div>
        <div class="pi-row"><span>PCB</span><span>${fmtRM(pcb)}</span></div>
        ${otherDeductions>0 ? `<div class="pi-row"><span>${en?'Other Deductions':'Potongan Lain'}</span><span>${fmtRM(otherDeductions)}</span></div>` : ''}
        <div class="pi-row" style="font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:6px;"><span>${en?'TOTAL DEDUCTIONS':'JUMLAH POTONGAN'}</span><span>${fmtRM(totalDeductions)}</span></div>
      </div>

      <div class="pi-line"></div>
      <div class="pi-totals" style="max-width:none;margin-left:0;">
        <div class="pi-row pi-total"><span>${en?'NET PAY':'GAJI BERSIH'}</span><span>${fmtRM(netPay)}</span></div>
      </div>
      <div class="pi-line"></div>
      <div style="font-size:10.5px;color:#666;margin-top:10px;">
        ${en
          ? 'Deduction amounts above were entered manually and are not calculated by this system — verify against LHDN/KWSP/PERKESO records.'
          : 'Jumlah potongan di atas dimasukkan secara manual dan tidak dikira oleh sistem ini — sahkan dengan rekod LHDN/KWSP/PERKESO.'}
      </div>
      <div class="pi-foot">${en?'Paid by':'Dibayar oleh'} ${esc(record.paidBy)} &middot; ${en?'Printed':'Dicetak'} ${fmtDateTime(Date.now())}</div>
    </div>
  `;
  window.print();
}

function printVehicleQR(v){
  const en = state.language==='en';
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice" style="text-align:center;">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">${en?'Vehicle QR Code Label':'Label Kod QR Kenderaan'}</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(v.plate)}" width="180" height="180" alt="QR ${esc(v.plate)}" style="margin:14px auto;display:block;">
      <div style="font-size:20px;font-weight:700;letter-spacing:2px;">${esc(v.plate)}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">${esc(v.model||'')}</div>
    </div>
  `;
  window.print();
}

function printAttendanceQr(staffMember){
  const en = state.language==='en';
  const url = `${location.origin}${location.pathname}?attendance=${encodeURIComponent(staffMember.id)}&token=${encodeURIComponent(staffMember.attendanceToken||'')}`;
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice" style="text-align:center;">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">${en?'Attendance QR Code':'Kod QR Kehadiran'}</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}" width="200" height="200" alt="QR ${esc(staffMember.name)}" style="margin:14px auto;display:block;">
      <div style="font-size:20px;font-weight:700;">${esc(staffMember.name)}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">${en?'Scan to clock in / clock out':'Imbas untuk clock in / clock out'}</div>
    </div>
  `;
  window.print();
}

/* ============================= PRINT ATTENDANCE SUMMARY ============================= */
function printAttendanceSummary(staffId, month){
  const en = state.language==='en';
  const s = db.settings;
  const staffMember = db.staff.find(st=>st.id===staffId);
  const summary = computeAttendanceSummary(staffId, month);
  const dayName = (dateStr)=> new Date(dateStr+'T00:00:00').toLocaleDateString(en?'en-US':'ms-MY', {weekday:'short'});
  const timeOnly = (ts)=> ts ? new Date(ts).toLocaleTimeString(en?'en-US':'ms-MY',{hour:'2-digit',minute:'2-digit'}) : '—';
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${en?'ATTENDANCE SUMMARY':'RINGKASAN KEHADIRAN'}</div>
          <div class="pi-row"><span>${en?'Period':'Tempoh'}</span><span>${monthLabel(month)}</span></div>
          <div class="pi-row"><span>${en?'Printed':'Dicetak'}</span><span>${fmtDateTime(Date.now())}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${en?'Staff':'Staf'}</div>
        <div class="pi-billto-name">${esc(staffMember?staffMember.name:'')}</div>
      </div>
      <div class="pi-totals" style="max-width:none;margin-left:0;">
        <div class="pi-row"><span>${en?'Present':'Hadir'}</span><span>${summary.presentDays} ${en?'days':'hari'}</span></div>
        <div class="pi-row"><span>${en?'Absent':'Tidak Hadir'}</span><span>${summary.absentDays} ${en?'days':'hari'}</span></div>
        <div class="pi-row pi-total"><span>${en?'Hours Worked':'Jam Bekerja'}</span><span>${summary.totalHours.toFixed(1)}h</span></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>${en?'Date':'Tarikh'}</th><th>${en?'In':'Masuk'}</th><th>${en?'Out':'Keluar'}</th><th>${en?'Hours':'Jam'}</th></tr></thead>
        <tbody>
          ${summary.days.length===0 ? `<tr><td colspan="4">${en?'No days yet.':'Belum ada hari.'}</td></tr>` : summary.days.map(d=>`
            <tr>
              <td>${dayName(d.dateStr)} ${d.dateStr.slice(8,10)}/${d.dateStr.slice(5,7)}</td>
              <td>${timeOnly(d.inTs)}</td>
              <td>${d.incomplete ? (en?'Not out yet':'Belum Keluar') : timeOnly(d.outTs)}</td>
              <td>${!d.present ? (en?'Absent':'Tidak Hadir') : d.incomplete ? '—' : `${d.hours.toFixed(1)}h`}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-foot">${en
        ? 'Present/Absent reflects clock-in/out records only — not a substitute for a formal leave or shift-schedule system.'
        : 'Hadir/Tidak Hadir hanya mencerminkan rekod clock in/out — bukan pengganti sistem cuti atau jadual syif formal.'}</div>
    </div>
  `;
  window.print();
}

