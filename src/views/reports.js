/* ============================= REPORTS VIEW ============================= */
function viewReports(){
  // Kerani has full Admin-level access to this page structurally (see
  // chrome.js's canManage()), but is specifically excluded from actual
  // sales/revenue figures -- everything money-derived below (totals, P&L,
  // sales trend, top items by revenue, commission $) is gated on this,
  // while non-revenue sections (jobs completed count, stock forecast,
  // churned customers, mechanic job counts) stay visible to everyone here.
  const canRevenue = canSeeRevenue();
  const now = Date.now();
  const rangeMs = state.reportRange*24*3600*1000;
  // !i.draft -- an invoice auto-created empty when a job is sent to POS
  // (see job-to-pos in event-handlers.js) isn't a real sale until it's
  // actually finalized at checkout; excluded from every figure below
  // since invInRange feeds essentially the whole report.
  const invInRange = db.invoices.filter(i=>!i.draft && now-i.createdAt<=rangeMs);
  const totalSales = invInRange.reduce((s,i)=>s+i.total,0);
  const avgTicket = invInRange.length ? totalSales/invInRange.length : 0;
  const jobsInRange = db.jobs.filter(j=>now-j.createdAt<=rangeMs);
  const jobsCompleted = jobsInRange.filter(j=>j.status==='done'||j.status==='delivered').length;

  // top items sold
  const itemSales = {};
  invInRange.forEach(inv=>inv.items.forEach(it=>{
    itemSales[it.name] = (itemSales[it.name]||0) + it.price*it.qty;
  }));
  const topItems = Object.entries(itemSales).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // P&L: revenue vs cost of goods sold. Credit notes reduce revenue by
  // however much of that invoice was actually refunded -- attributed to
  // the ORIGINAL invoice's period (the sale is what happened this period;
  // a later refund just corrects its true value), not the credit note's
  // own date. COGS is NOT reduced: a credited part was still consumed/
  // installed, that real cost already happened regardless of the refund.
  let cogs = 0, revenue = 0;
  invInRange.forEach(inv=>{
    const credited = creditNotesForInvoice(inv.id).reduce((s,cn)=>s+cn.subtotal,0);
    revenue += inv.subtotal - (inv.discount||0) - credited;
    inv.items.forEach(it=>{
      if(it.refId){
        const invItem = getItem(it.refId);
        if(invItem) cogs += (invItem.cost||0) * it.qty;
      }
    });
  });
  const grossProfit = revenue - cogs;
  const marginPct = revenue>0 ? (grossProfit/revenue*100) : 0;
  const maxVal = topItems.length ? topItems[0][1] : 1;

  // Parts vs services breakdown -- parts are cart lines linked to an
  // inventory item (refId), services are everything else (custom charges,
  // labor). Only parts carry a tracked cost; labor/service cost isn't
  // tracked anywhere in this app, so "services profit" is just its revenue.
  let partsRevenue = 0, partsCost = 0, servicesRevenue = 0;
  invInRange.forEach(inv=>{
    inv.items.forEach(it=>{
      const lineRevenue = it.price*it.qty;
      if(it.refId){
        partsRevenue += lineRevenue;
        const invItem = getItem(it.refId);
        if(invItem) partsCost += (invItem.cost||0)*it.qty;
      } else {
        servicesRevenue += lineRevenue;
      }
    });
    // Credit note items mirror the same {name,qty,price,refId} shape as
    // invoice items, so the same refId check attributes each credited
    // line back to whichever bucket (part/service) it actually came from,
    // instead of guessing with a flat proportional split.
    creditNotesForInvoice(inv.id).forEach(cn=>cn.items.forEach(ci=>{
      const lineCredit = ci.price*ci.qty;
      if(ci.refId) partsRevenue -= lineCredit;
      else servicesRevenue -= lineCredit;
    }));
  });
  const partsProfit = partsRevenue - partsCost;
  const servicesProfit = servicesRevenue; // no cost tracked for labor

  // mechanic performance
  const mechStats = {};
  jobsInRange.forEach(j=>{
    if(!j.mechanic) return;
    if(!mechStats[j.mechanic]) mechStats[j.mechanic] = {count:0, totalMs:0, doneCount:0, revenue:0};
    mechStats[j.mechanic].count++;
    if(j.doneAt){
      mechStats[j.mechanic].totalMs += (j.doneAt - j.createdAt);
      mechStats[j.mechanic].doneCount++;
    }
  });
  const jobsById = new Map(db.jobs.map(j=>[j.id, j]));
  invInRange.forEach(inv=>{
    if(!inv.jobId) return;
    const job = jobsById.get(inv.jobId);
    if(job && job.mechanic && mechStats[job.mechanic]){
      const credited = creditNotesForInvoice(inv.id).reduce((s,cn)=>s+cn.total,0);
      mechStats[job.mechanic].revenue += Math.max(0, inv.total - credited);
    }
  });
  const mechRows = Object.entries(mechStats).map(([name,st])=>{
    const staffMember = db.staff.find(s=>s.name===name);
    const commissionPct = staffMember ? (staffMember.commissionPercent||0) : 0;
    return [name, {...st, commission: st.revenue*commissionPct/100, commissionPct}];
  }).sort((a,b)=>b[1].count-a[1].count);

  // stock forecast: qty sold per item over range / range days = daily burn rate
  const itemQtySold = {};
  invInRange.forEach(inv=>inv.items.forEach(it=>{
    if(!it.refId) return;
    itemQtySold[it.refId] = (itemQtySold[it.refId]||0) + it.qty;
  }));
  const forecastRows = db.inventory.map(i=>{
    const sold = itemQtySold[i.id]||0;
    const dailyRate = sold / state.reportRange;
    const daysLeft = dailyRate>0 ? Math.round(i.qty/dailyRate) : null;
    return {item:i, dailyRate, daysLeft};
  }).filter(r=>r.dailyRate>0).sort((a,b)=>(a.daysLeft||999)-(b.daysLeft||999)).slice(0,6);

  // Inventory turnover: COGS in this period / current inventory value. No
  // historical inventory-value snapshots exist (only a live qty per item),
  // so current value stands in for a true opening/closing average -- close
  // enough to be directionally useful, but labelled as an estimate rather
  // than a precise accounting figure.
  const inventoryValue = db.inventory.reduce((s,i)=>s+(i.cost||0)*i.qty, 0);
  const turnoverRatio = inventoryValue>0 ? cogs/inventoryValue : 0;
  const daysInventoryOutstanding = turnoverRatio>0 ? state.reportRange/turnoverRatio : null;
  const itemTurnover = db.inventory.map(i=>({item:i, sold: itemQtySold[i.id]||0, ratio: i.qty>0 ? (itemQtySold[i.id]||0)/i.qty : 0}));
  const fastMovers = itemTurnover.filter(r=>r.sold>0).sort((a,b)=>b.ratio-a.ratio).slice(0,5);
  const deadStock = itemTurnover.filter(r=>r.sold===0 && r.item.qty>0).sort((a,b)=>(b.item.qty*b.item.cost)-(a.item.qty*a.item.cost)).slice(0,5);

  return `
  <div class="section-head">
    <div><div class="sub">${tt('Ringkasan prestasi bengkel')}</div></div>
    <div class="tabs" style="margin-bottom:0;">
      <div class="tab-btn ${state.reportRange===7?'active':''}" data-range="7">${tt('7 Hari')}</div>
      <div class="tab-btn ${state.reportRange===30?'active':''}" data-range="30">${tt('30 Hari')}</div>
      <div class="tab-btn ${state.reportRange===90?'active':''}" data-range="90">${tt('90 Hari')}</div>
    </div>
  </div>
  <div class="grid grid-3" style="margin-bottom:20px;">
    ${canRevenue ? `
    <div class="stat-card ok"><div class="stat-label">${tt('Jumlah Jualan')}</div><div class="stat-value">${fmtRM(totalSales)}</div><div class="stat-sub">${invInRange.length} ${tt('invois')}</div></div>
    <div class="stat-card"><div class="stat-label">${tt('Purata Setiap Invois')}</div><div class="stat-value">${fmtRM(avgTicket)}</div></div>` : ''}
    <div class="stat-card"><div class="stat-label">${tt('Kerja Disiapkan')}</div><div class="stat-value">${jobsCompleted}</div></div>
  </div>

  ${db.settings.simpleMode || !canRevenue ? '' : `
  <div class="panel" style="margin-bottom:20px;">
    <h2>${ICONS.gauge} ${tt('Untung/Rugi (P&L)')}</h2>
    <div class="grid grid-3">
      <div class="stat-card"><div class="stat-label">${tt('Hasil (Revenue)')}</div><div class="stat-value">${fmtRM(revenue)}</div></div>
      <div class="stat-card warn"><div class="stat-label">${tt('Kos Barangan (COGS)')}</div><div class="stat-value">${fmtRM(cogs)}</div></div>
      <div class="stat-card ok"><div class="stat-label">${tt('Untung Kasar')}</div><div class="stat-value">${fmtRM(grossProfit)}</div><div class="stat-sub">${tt('Margin')} ${marginPct.toFixed(1)}%</div></div>
    </div>
  </div>`}

  ${db.settings.simpleMode || !canRevenue ? '' : `
  <div class="panel" style="margin-bottom:20px;">
    <h2>${ICONS.reports} ${state.language==='en'?'Sales: Parts vs Services':'Jualan: Alat Ganti vs Servis'}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>${state.language==='en'?'Revenue':'Hasil'}</th><th>${state.language==='en'?'Cost':'Kos'}</th><th>${state.language==='en'?'Profit':'Untung'}</th></tr></thead>
      <tbody>
        <tr>
          <td style="font-weight:600;">${ICONS.inventory} ${state.language==='en'?'Parts':'Alat Ganti'}</td>
          <td>${fmtRM(partsRevenue)}</td>
          <td style="color:var(--text-muted);">${fmtRM(partsCost)}</td>
          <td style="color:var(--success);font-weight:600;">${fmtRM(partsProfit)}</td>
        </tr>
        <tr>
          <td style="font-weight:600;">${ICONS.wrench} ${state.language==='en'?'Services / Labor':'Servis / Buruh'}</td>
          <td>${fmtRM(servicesRevenue)}</td>
          <td style="color:var(--text-muted);">${state.language==='en'?'not tracked':'tidak dijejak'}</td>
          <td style="color:var(--success);font-weight:600;">${fmtRM(servicesProfit)}</td>
        </tr>
      </tbody>
    </table></div>
  </div>`}

  ${db.settings.simpleMode || !canRevenue ? '' : `
  <div class="panel" style="margin-bottom:20px;">
    <h2>${ICONS.inventory} ${state.language==='en'?'Inventory Turnover':'Kadar Pusingan Stok'} <span class="tag">${state.language==='en'?'estimate':'anggaran'}</span></h2>
    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">${state.language==='en'?'Turnover Ratio':'Nisbah Pusingan'}</div><div class="stat-value">${turnoverRatio.toFixed(2)}×</div><div class="stat-sub">${state.language==='en'?`COGS ÷ current stock value, over ${state.reportRange} days`:`Kos Barangan ÷ nilai stok semasa, dalam ${state.reportRange} hari`}</div></div>
      <div class="stat-card"><div class="stat-label">${state.language==='en'?'Days of Stock on Hand':'Hari Stok Tersedia'}</div><div class="stat-value">${daysInventoryOutstanding!==null ? Math.round(daysInventoryOutstanding) : '-'}</div></div>
      <div class="stat-card"><div class="stat-label">${state.language==='en'?'Stock Value on Hand':'Nilai Stok Tersedia'}</div><div class="stat-value" style="font-size:26px;">${fmtRM(inventoryValue)}</div></div>
    </div>
    <div class="grid grid-2">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:700;margin-bottom:8px;">${state.language==='en'?'Fastest Moving':'Bergerak Paling Laju'}</div>
        ${fastMovers.length===0 ? `<div style="font-size:12px;color:var(--text-muted);">${state.language==='en'?'No sales data yet.':'Belum ada data jualan.'}</div>` : fastMovers.map(r=>`
          <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px dashed var(--glass-border);">
            <span>${esc(r.item.name)}</span><span style="color:var(--success);font-weight:600;">${r.sold} ${state.language==='en'?'sold':'terjual'}</span>
          </div>`).join('')}
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:700;margin-bottom:8px;">${state.language==='en'?'Dead Stock (0 sold, capital tied up)':'Stok Pegun (0 terjual, modal tertahan)'}</div>
        ${deadStock.length===0 ? `<div style="font-size:12px;color:var(--text-muted);">${state.language==='en'?'None — everything in stock has moved.':'Tiada — semua stok telah bergerak.'}</div>` : deadStock.map(r=>`
          <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px dashed var(--glass-border);">
            <span>${esc(r.item.name)}</span><span style="color:var(--danger);font-weight:600;">${fmtRM(r.item.qty*r.item.cost)}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>`}

  ${canRevenue ? `
  <div class="panel" style="margin-bottom:20px;">
    <h2>${ICONS.reports} ${tt('Trend Jualan')}</h2>
    ${renderSalesChart(invInRange, state.reportRange)}
  </div>` : ''}

  ${canRevenue ? (()=>{
    const recentInvoices = db.invoices.filter(i=>!i.draft).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
    return `
    <div class="panel" style="margin-bottom:20px;">
      <h2>${tt('Invois Terkini')}</h2>
      ${recentInvoices.length===0 ? emptyState(tt('Belum ada invois.')) : recentInvoices.map(inv=>{
        const cust = getCustomer(inv.customerId);
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">
          <span>${inv.invoiceNo} — ${cust?esc(cust.name):tt('Walk-in')}</span>
          <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);">${fmtRM(inv.total)}</span>
        </div>`;
      }).join('')}
    </div>`;
  })() : ''}

  <div class="grid grid-2">
    ${canRevenue ? `
    <div class="panel">
      <h2>${tt('Item / Servis Terlaris')}</h2>
      ${topItems.length===0 ? emptyState(tt('Belum cukup data jualan.')) : topItems.map(([name,val])=>`
        <div class="chart-bar-row">
          <div class="chart-bar-label">${name}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(val/maxVal*100).toFixed(0)}%"></div></div>
          <div class="chart-bar-val">${fmtRM(val)}</div>
        </div>`).join('')}
    </div>` : ''}
    ${db.settings.simpleMode ? '' : `
    <div class="panel">
      <h2>${ICONS.staff} ${tt('Prestasi Mekanik')}</h2>
      ${mechRows.length===0 ? emptyState(tt('Belum ada data mekanik.')) : `
      <div class="table-wrap"><table>
        <thead><tr><th>${tt('Mekanik')}</th><th>${tt('Kerja')}</th><th>${tt('Purata Masa Siap')}</th>${canRevenue?`<th>${tt('Komisen')}</th>`:''}</tr></thead>
        <tbody>
          ${mechRows.map(([name,st])=>`
            <tr>
              <td style="font-weight:600;">${name}</td>
              <td>${st.count}</td>
              <td>${st.doneCount>0 ? Math.round(st.totalMs/st.doneCount/3600000)+' '+tt('jam') : '-'}</td>
              ${canRevenue?`<td style="color:var(--accent);font-weight:600;">${st.commissionPct>0 ? fmtRM(st.commission) : '-'}</td>`:''}
            </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>`}
  </div>

  ${db.settings.simpleMode ? '' : `
  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.gauge} ${tt('Ramalan Stok (berdasarkan kadar jualan')} ${state.reportRange} ${tt('hari terakhir)')}</h2>
    ${forecastRows.length===0 ? emptyState(tt('Tiada data jualan mencukupi untuk ramalan.')) : `
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Item')}</th><th>${tt('Baki')||'Baki'}</th><th>${tt('Kadar Jualan/Hari')}</th><th>${tt('Anggaran Tempoh Habis')}</th></tr></thead>
      <tbody>
        ${forecastRows.map(r=>`
          <tr>
            <td style="font-weight:600;">${esc(r.item.name)}</td>
            <td>${r.item.qty}</td>
            <td>${r.dailyRate.toFixed(2)}</td>
            <td>${r.daysLeft!==null ? (r.daysLeft<=7 ? `<span class="pill pill-low">${r.daysLeft} ${tt('hari')}</span>` : r.daysLeft+' '+tt('hari')) : '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>`}

  ${db.settings.simpleMode ? '' : `
  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.customers} ${tt('Pelanggan Berisiko Hilang')} <span class="tag">${tt('senyap >')} ${db.settings.churnDays||180} ${tt('hari')}</span></h2>
    ${(()=>{
      const churnRows = getChurnedCustomers();
      if(churnRows.length===0) return emptyState(tt('Tiada pelanggan berisiko buat masa ini.'));
      return `<div class="table-wrap"><table>
        <thead><tr><th>${tt('Pelanggan')}</th><th>${tt('Telefon')}</th><th>${tt('Lawatan Terakhir')}</th><th>${tt('Hari Senyap')}</th><th></th></tr></thead>
        <tbody>
          ${churnRows.map(r=>{
            const waText = encodeURIComponent(`Salam ${r.customer.name}, sudah lama kami tak jumpa kenderaan anda di ${db.settings.shopName}! Jom bawa datang untuk servis berkala. Hubungi kami untuk buat tempahan.`);
            const waHref = r.customer.phone ? `https://wa.me/${normalizePhone(r.customer.phone)}?text=${waText}` : null;
            return `<tr>
              <td style="font-weight:600;">${r.customer.name}</td>
              <td>${r.customer.phone||'-'}</td>
              <td>${fmtDate(r.lastDate)}</td>
              <td><span class="pill pill-low">${r.daysSince} ${tt('hari')}</span></td>
              <td>${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="Hantar ajakan kembali" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
    })()}
  </div>`}
  `;
}

function getChurnedCustomers(){
  const now = Date.now();
  const churnMs = (db.settings.churnDays||180)*24*3600*1000;
  // Build last-visit index in a single pass instead of filtering per customer (was O(n*m))
  const lastVisit = new Map();
  db.invoices.forEach(i=>{
    if(!i.customerId) return;
    const cur = lastVisit.get(i.customerId);
    if(!cur || i.createdAt>cur) lastVisit.set(i.customerId, i.createdAt);
  });
  db.jobs.forEach(j=>{
    if(!j.customerId) return;
    const cur = lastVisit.get(j.customerId);
    if(!cur || j.createdAt>cur) lastVisit.set(j.customerId, j.createdAt);
  });
  const rows = [];
  db.customers.forEach(c=>{
    const lastDate = lastVisit.get(c.id);
    if(lastDate===undefined) return; // never visited, not "churned"
    if(now-lastDate >= churnMs){
      rows.push({customer:c, lastDate, daysSince: Math.floor((now-lastDate)/(24*3600*1000))});
    }
  });
  return rows.sort((a,b)=>b.daysSince-a.daysSince).slice(0,15);
}

function renderSalesChart(invoices, rangeDays){
  const buckets = Math.min(rangeDays, 30); // cap visual bars for readability
  const bucketDays = Math.ceil(rangeDays/buckets);
  const now = new Date(); now.setHours(0,0,0,0);
  const data = [];
  for(let i=buckets-1;i>=0;i--){
    const endOffset = i*bucketDays;
    const startOffset = endOffset+bucketDays;
    const endTs = now.getTime()-endOffset*24*3600*1000+24*3600*1000;
    const startTs = now.getTime()-startOffset*24*3600*1000;
    const sum = invoices.filter(inv=>inv.createdAt>=startTs && inv.createdAt<endTs).reduce((s,inv)=>s+inv.total,0);
    data.push({label: fmtDate(endTs-1), value: sum});
  }
  const max = Math.max(...data.map(d=>d.value), 1);
  const w = 720, h = 160, padL=6, padR=6, barGap=4;
  const barW = (w-padL-padR)/data.length - barGap;
  const bars = data.map((d,idx)=>{
    const barH = (d.value/max)*(h-24);
    const x = padL + idx*(barW+barGap);
    const y = h-24-barH;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="var(--accent)" opacity="0.9"><title>${d.label}: ${fmtRM(d.value)}</title></rect>`;
  }).join('');
  const labels = data.length<=12 ? data.map((d,idx)=>{
    const x = padL + idx*(barW+barGap) + barW/2;
    return `<text x="${x.toFixed(1)}" y="${h-6}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${d.label.split(' ')[0]}</text>`;
  }).join('') : '';
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:170px;overflow:visible;">${bars}${labels}</svg>`;
}

