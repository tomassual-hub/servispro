/* ============================= MODAL ROUTER ============================= */
function renderModal(){
  let inner = '';
  const m = state.modal;
  if(m.type==='new-job') inner = newJobModalHTML();
  else if(m.type==='job-detail') inner = jobDetailModalHTML(m.job);
  else if(m.type==='new-item') inner = itemModalHTML(null);
  else if(m.type==='new-package') inner = packageModalHTML(null);
  else if(m.type==='edit-package') inner = packageModalHTML(m.pkg);
  else if(m.type==='new-bay') inner = bayModalHTML(null);
  else if(m.type==='edit-bay') inner = bayModalHTML(m.bay);
  else if(m.type==='edit-item') inner = itemModalHTML(m.item);
  else if(m.type==='new-customer') inner = customerModalHTML();
  else if(m.type==='new-lead') inner = leadModalHTML();
  else if(m.type==='new-vehicle') inner = vehicleModalHTML(m.customerId);
  else if(m.type==='new-staff') inner = staffModalHTML(null);
  else if(m.type==='attendance-qr') inner = attendanceQrModalHTML(m.staffMember);
  else if(m.type==='attendance-summary') inner = attendanceSummaryModalHTML(m.staffId);
  else if(m.type==='edit-attendance') inner = editAttendanceModalHTML(m.record);
  else if(m.type==='edit-staff') inner = staffModalHTML(m.staffMember);
  else if(m.type==='edit-customer') inner = customerEditModalHTML(m.customer);
  else if(m.type==='edit-vehicle') inner = vehicleEditModalHTML(m.vehicle);
  else if(m.type==='vehicle-history') inner = vehicleHistoryModalHTML(m.vehicle);
  else if(m.type==='new-appointment') inner = appointmentModalHTML(m.presetDate);
  else if(m.type==='day-appointments') inner = dayAppointmentsModalHTML(m.date);
  else if(m.type==='new-contract') inner = contractModalHTML();
  else if(m.type==='settle-balance') inner = settleBalanceModalHTML(m.invoice);
  else if(m.type==='credit-note') inner = creditNoteModalHTML(m.invoice);
  else if(m.type==='new-supplier') inner = supplierModalHTML();
  else if(m.type==='edit-supplier') inner = supplierModalHTML(m.supplier);
  else if(m.type==='new-po') inner = poModalHTML();
  else if(m.type==='receive-po') inner = receivePoModalHTML(m.po);
  else if(m.type==='inspection') inner = inspectionModalHTML(m.job);
  else if(m.type==='mfa-settings') inner = mfaSettingsModalHTML();
  else if(m.type==='faceid-offer') inner = faceIdOfferModalHTML(m.email);
  else if(m.type==='faceid-settings') inner = faceIdSettingsModalHTML();
  else if(m.type==='payroll-payment') inner = payrollPaymentModalHTML(m.staffId);
  else if(m.type==='new-techref') inner = techRefModalHTML(null);
  else if(m.type==='edit-techref') inner = techRefModalHTML(m.entry);
  else if(m.type==='techref-detail') inner = techRefDetailModalHTML(m.entry);
  else if(m.type==='plan-picker') inner = planPickerModalHTML();
  else if(m.type==='support-chat') return `<div class="modal-overlay" data-action="overlay-close"><div class="modal support-chat-modal" onclick="event.stopPropagation()">${renderSupportChatModal()}</div></div>`;
  else if(m.type==='ai-assistant') return `<div class="modal-overlay" data-action="overlay-close"><div class="modal support-chat-modal ai-assistant-modal" onclick="event.stopPropagation()">${aiAssistantModalHTML()}</div></div>`;
  return `<div class="modal-overlay" data-action="overlay-close"><div class="modal" onclick="event.stopPropagation()">${inner}</div></div>`;
}

