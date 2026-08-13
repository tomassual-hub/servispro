// Ambient type declarations for the app's shared global scope. The app has
// no ES module boundaries (see build/build.js) — every src/*.js file runs
// in one global script, exactly like today's single HTML file. This file
// gives tsc (via `checkJs` in tsconfig.json) enough shape information to
// catch real mistakes — wrong property names, wrong argument types, typos —
// across file boundaries, without requiring a rewrite to actual modules.
// Keep this in sync with defaultDB() in sync-engine.js when a record shape
// changes; a type here should mirror reality, not the other way around.

interface Customer {
  id: string;
  name: string;
  phone?: string;
  visits?: number;
  loyaltyPoints?: number;
}

interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  model?: string;
  color?: string;
  odometer?: number;
  serviceIntervalKm?: number;
  lastServiceKm?: number;
}

interface InspectionResult {
  [checklistItemName: string]: 'ok' | 'attention' | 'replace';
}

interface Job {
  id: string;
  jobNo: string;
  customerId: string | null;
  vehicleId: string | null;
  description?: string;
  mechanic?: string;
  internalNote?: string;
  status: 'waiting' | 'progress' | 'done' | 'delivered';
  items: any[];
  createdAt: number;
  invoiced: boolean;
  createdBy?: string;
  doneAt: number | null;
  photos: string[];
  branchId?: string;
  signature?: string | null;
  inspection?: InspectionResult;
  rating?: number;
  feedback?: string;
  returnFromJobId?: string;
  diagramMarks?: { x: number; y: number; severity: 'ok' | 'attention' | 'replace'; note?: string }[];
  customerInspectionSignature?: string | null;
  inspectionToken?: string;
  bayId?: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  qty: number;
  cost: number;
  price: number;
  lowStock: number;
  supplierId?: string | null;
  warrantyMonths?: number;
}

interface CartLine {
  refId?: string;
  name: string;
  price: number;
  qty: number;
  packageId?: string; // set when this line is a Package bundle -- its component items are deducted from stock at checkout, not the bundle line itself
}

interface PackageItem { refId: string; qty: number; }
interface Package {
  id: string;
  name: string;
  items: PackageItem[];
  price: number; // the bundle's special combined price, independent of the sum of its components' individual prices
  active: boolean;
}

interface InvoicePayment { method: string; amount: number; }
interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  vehicleId: string | null;
  jobId?: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  payment: string; // 'Tunai' | 'Kad' | 'Online' for a single-method sale, or a synthetic label ('Berbilang'/'Split') when payments[] has more than one line
  payments?: InvoicePayment[]; // present only for split/partial-payment sales -- see invoiceAmountPaid/invoiceBalanceDue in utils.js
  createdAt: number;
  createdBy?: string;
  branchId?: string;
  invoiceToken?: string; // set client-side when "Share Receipt" is first clicked -- see kiosk_get_invoice in backend/schema.sql
}

// A credit note reduces what a customer owes/paid on a specific invoice
// after the fact (e.g. a part was returned, an overcharge is corrected) --
// it's its own numbered document (CN-xxxx), not an edit to the original
// invoice, so the original invoice stays an unaltered record.
interface CreditNoteItem { name: string; qty: number; price: number; refId?: string; }
interface CreditNote {
  id: string;
  creditNoteNo: string;
  invoiceId: string;
  customerId: string | null;
  items: CreditNoteItem[];
  reason: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: number;
  createdBy?: string;
}

interface Staff {
  id: string;
  name: string;
  role: 'Admin' | 'Pemilik' | 'Mekanik' | 'Ketua Mekanik' | 'Kerani';
  email?: string;
  commissionPercent?: number;
  baseSalary?: number;
  userId?: string | null;
  // A random per-staff token embedded in their personal QR attendance code
  // (?attendance=<staffId>&token=<attendanceToken>) -- lets a punch-in/out
  // link identify a specific staff member anonymously (no login) while
  // still being un-guessable/un-shareable-in-a-way-that-lets-someone-else-
  // clock-in-as-them without physically having that person's own QR code.
  attendanceToken?: string;
}

// One clock-in or clock-out event, created via a staff member's personal
// QR code link (src/login-kiosk.js's attendance mode) or edited by an
// Admin/Kerani from the Kehadiran (Attendance) view.
interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string; // snapshotted, same reasoning as PayrollRecord.staffName
  type: 'in' | 'out';
  ts: number;
  editedBy?: string; // set only if an Admin/Kerani manually corrected this record
}

// A price quote a customer can accept before any job/invoice exists yet.
// Doesn't touch inventory or the job/invoice counters until explicitly
// converted -- a quotation on its own never deducts stock or generates
// revenue.
interface Quotation {
  id: string;
  quoteNo: string;
  customerId: string | null;
  vehicleId: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'expired';
  createdAt: number;
  createdBy?: string;
  convertedInvoiceId?: string;
  quoteToken?: string; // set client-side when "Share for Approval" is first clicked -- see kiosk_get_quotation/kiosk_respond_quotation in backend/schema.sql
}

// Bays: physical workshop lifts/stations (e.g. "Bay 1 — General Repair").
// Optional, purely a job-to-location assignment for shops that want to
// track which car is on which lift -- a job with no bayId just means the
// shop isn't using this or hasn't parked it on a tracked bay yet.
interface Bay {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface Appointment {
  id: string;
  customerId: string | null;
  vehicleId: string | null;
  date: string; // YYYY-MM-DD, local calendar day — see localDateStr()
  time: string;
  notes?: string;
  status: 'scheduled' | 'done' | 'cancelled';
  createdAt?: number;
  reminderSent?: boolean; // set once the dashboard's "Reminders Due" WhatsApp link is clicked -- see viewDashboard()
}

interface ContractItem { name: string; qty: number; price: number; }
interface Contract {
  id: string;
  label: string;
  customerId: string;
  vehicleId?: string;
  frequencyDays: number;
  items: ContractItem[];
  nextDue: number;
  lastGenerated?: number;
}

interface Supplier { id: string; name: string; phone?: string; email?: string; }
interface POItem { name: string; qty: number; cost: number; receivedQty?: number; }
interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string | null;
  items: POItem[];
  status: 'pending' | 'partial' | 'received';
  createdAt: number;
}

interface AuditLogEntry { id: string; ts: number; staff: string; action: string; detail: string; }
interface Branch { id: string; name: string; }
interface CashClosure { id: string; date: string; expected: number; actual: number; closedBy: string; closedAt: number; }

// A record that a given staff member's pay for a given calendar month was
// marked paid. This is a ledger entry only -- no money actually moves
// through the app (same as POS "payment method" or the DuitNow QR: real
// funds move outside the system, this just records that it happened).
interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string; // snapshotted at payment time -- survives the staff record being renamed/deleted later
  month: string; // "YYYY-MM"
  baseSalary: number;
  commissionRevenue: number;
  commissionPct: number;
  commission: number;
  total: number; // gross (baseSalary + commission)
  // Statutory deductions -- entered manually by Admin (from their own
  // KWSP/PERKESO/LHDN calculation), never computed by this app. See
  // computeMonthlyPay()'s comment for why.
  epf: number;
  socso: number;
  eis: number;
  pcb: number;
  otherDeductions: number;
  netPay: number; // total - (epf+socso+eis+pcb+otherDeductions)
  paidAt: number;
  paidBy: string;
  notes?: string;
}

interface ShopSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopRegNo: string;
  shopSstNo: string;
  shopTin: string;
  taxRate: number;
  loyaltyVisits: number;
  loyaltyDiscount: number;
  churnDays: number;
  simpleMode: boolean;
  paymentQR: string;
  shopLogo?: string;
  lastBackupAt: number | null;
  servicedBrands?: string[];
  monthlySalesTarget?: number;
  monthlyUnitTarget?: number;
  countryCode?: string;
  licenseKey?: string;
}

interface Counters { job: number; invoice: number; po: number; creditNote: number; quote: number; }

// Structured place for the shop's OWN technical notes per vehicle
// make/model/variant -- deliberately empty by default (see src/views/techref.js
// for why torque specs/wiring diagrams/fault codes are never pre-loaded here).
interface TechRefSection {
  id: string;
  category: string; // key from TECH_REF_CATEGORIES, or 'other'
  content: string;
  photos: string[];
}
interface TechRef {
  id: string;
  make: string;
  model: string;
  variant?: string;
  yearFrom?: string;
  yearTo?: string;
  notes?: string;
  sections: TechRefSection[];
  createdAt: number;
}

// Workshop CRM: a prospect who hasn't had a job/invoice yet. Separate from
// Customer (which is only ever someone who's actually been served) -- a
// lead becomes a real Customer explicitly via "Tukar kepada Pelanggan"
// (convert-lead), never automatically.
interface Lead {
  id: string;
  name: string;
  phone?: string;
  source?: string;
  notes?: string;
  status: 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
  createdAt: number;
  convertedCustomerId?: string;
}

// support_messages: internal staff <-> management help channel (see
// src/support-chat.js). One thread per non-manager staff member
// (threadStaffId), holding every message either they or any manager sent
// into it -- not a 1:1 chat with a specific manager, "management" answers
// collectively the same way a shared support inbox works.
interface SupportMessage {
  id: string;
  threadStaffId: string;
  senderId: string;
  senderName: string;
  senderSide: 'staff' | 'manager';
  message: string;
  createdAt: number;
  read: boolean;
}

// push_subscriptions row (see src/push-notifications.js and
// backend/schema.sql) -- `subscription` is exactly what
// PushSubscription.toJSON() returns from the browser's Push API, stored
// verbatim so the send side (supabase/functions/notify-support-message/)
// can pass it straight to the web-push library unmodified.
interface PushSubscriptionRecord {
  id: string;
  staffId: string;
  subscription: PushSubscriptionJSON;
  createdAt: number;
}

interface DB {
  customers: Customer[];
  vehicles: Vehicle[];
  jobs: Job[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  staff: Staff[];
  appointments: Appointment[];
  contracts: Contract[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  auditLog: AuditLogEntry[];
  branches: Branch[];
  cashClosures: CashClosure[];
  payrollRecords: PayrollRecord[];
  techRefs: TechRef[];
  leads: Lead[];
  packages: Package[];
  creditNotes: CreditNote[];
  attendance: AttendanceRecord[];
  quotations: Quotation[];
  bays: Bay[];
  supportMessages: SupportMessage[];
  pushSubscriptions: PushSubscriptionRecord[];
  settings: ShopSettings;
  counters: Counters;
}

interface AppState {
  currentStaff: Staff | null;
  currentBranch: string;
  language: 'ms' | 'en';
  theme: 'light' | 'dark';
  view: string;
  modal: { type: string; [key: string]: any } | null;
  confirmAction: any;
  showOnboarding: boolean;
  onboardingStep?: number;
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  offlineMode: boolean;
  authBusy: boolean;
  authMode?: 'login' | 'signup' | 'forgot' | 'reset' | 'mfa-challenge' | 'faceid-lock';
  loginError?: string;
  loginNotice?: string;
  globalSearch: string;
  customerSearch?: string;
  techRefSearch?: string;
  techRefEditingSectionId?: string | null;
  calendarMonth?: string;
  customerTab?: string;
  leadStatusFilter?: string;
  posCart: CartLine[];
  posCustomerId: string;
  posVehicleId: string;
  posJobId: string;
  posDiscountType?: 'flat' | 'percent';
  posDiscountValue?: number;
  posSplitMode?: boolean;
  posSplitPayments?: { method: string; amount: number }[];
  posConvertingQuoteId?: string | null;
  reportRange: number;
  payrollMonth?: string | null; // "YYYY-MM"
  attendanceSummaryMonth?: string | null; // "YYYY-MM"
  invTab?: string;
  invMainTab?: string;
  jobFilter?: string;
  apptTab?: string;
  staffTab?: string;
  navOpen?: boolean;
  notifOpen?: boolean;
  kioskMode?: boolean;
  kioskTab?: 'status' | 'history' | 'book';
  historyPlate?: string;
  historyPhone?: string;
  historyResult?: any;
  bookName?: string;
  bookPhone?: string;
  bookPlate?: string;
  bookDate?: string;
  bookTime?: string;
  bookNotes?: string;
  bookBusy?: boolean;
  bookSubmitted?: boolean;
  quoteMode?: boolean;
  quoteId?: string | null;
  quoteToken?: string | null;
  quoteResult?: any;
  quoteResultLoading?: boolean;
  invoiceMode?: boolean;
  invoiceId?: string | null;
  invoiceToken?: string | null;
  invoiceResult?: any;
  invoiceResultLoading?: boolean;
  custPortalChecked?: boolean;
  custPortalMode?: 'login' | 'signup' | 'forgot' | 'link' | 'dashboard';
  custPortalEmail?: string;
  custPortalPassword?: string;
  custPortalPhone?: string;
  custPortalName?: string;
  custPortalPlate?: string;
  custPortalBusy?: boolean;
  custPortalError?: string;
  custPortalNotice?: string;
  custPortalProfile?: { id: string; name: string; phone: string } | null;
  custPortalData?: any;
  attendanceMode?: boolean;
  attendanceStaffId?: string | null;
  attendanceToken?: string | null;
  attendanceStatus?: any;
  attendanceStatusLoading?: boolean;
  attendanceTab?: string;
  inspectMode?: boolean;
  inspectJobId?: string | null;
  inspectToken?: string | null;
  inspectReport?: any;
  inspectReportLoading?: boolean;
  boardMode?: boolean;
  boardJobs?: any[] | null;
  dashTargetPeriod?: 'weekly' | 'monthly';
  supportChatThreadId?: string | null;
  license?: { plan: string; status: string; expiresAt: string | null; creditBalance: number; referralCode: string | null; checkedAt: number; live: boolean } | null;
  pushSubscribed?: boolean | null;
  [key: string]: any; // state accumulates ad-hoc UI flags; keep this escape hatch rather than chasing every one
}

// ---- Globals defined across src/*.js, declared once here for cross-file checking ----
declare let db: DB;
declare let state: AppState;
declare let lastSynced: any;
declare const viewHistory: string[];
declare const TABLE_MAP: Record<string, string>;
declare const REVERSE_TABLE_MAP: Record<string, string>;
declare const ICONS: Record<string, string>;
declare const LOGO_DATA_URI: string;
declare const SERVISPRO_LOGO_DATA_URI: string;
declare const WORKSHOP_ILLUSTRATION_DATA_URI: string;
declare const AI_AVATAR_HEAD_DATA_URI: string;
declare const AI_AVATAR_FULL_DATA_URI: string;
declare const supabaseClient: any;
declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;
// The Supabase CDN script (loaded in the HTML shell) attaches its factory
// here as window.supabase -- used a second time in license.js to build a
// separate client pointed at the central licensing project, distinct from
// the shop's own supabaseClient above.
interface Window { supabase: any; }
declare const Sentry: any; // loaded via CDN <script> in the HTML template, only if SENTRY_DSN is configured
declare function initErrorMonitoring(): void;
declare function reportError(error: any, context: string): void;
declare function identifyStaffForErrorMonitoring(staffMember: Staff | null): void;

// window.storage: the Claude.ai-artifact storage polyfill defined inline in
// the HTML template (see build/_shell-pieces.json -> bootstrapScript),
// backed by localStorage when running outside a Claude.ai artifact.
interface Window {
  storage: {
    get(key: string, shared?: boolean): Promise<{ key: string; value: string; shared: boolean }>;
    set(key: string, value: string, shared?: boolean): Promise<{ key: string; value: string; shared: boolean }>;
    delete(key: string, shared?: boolean): Promise<{ key: string; deleted: boolean; shared: boolean }>;
    list(prefix?: string, shared?: boolean): Promise<{ keys: string[]; prefix?: string; shared: boolean }>;
  };
}

declare function uid(): string;
declare function esc(s: any): string;
declare function fmtRM(n: number): string;
declare function invoiceCashAmount(inv: Invoice): number;
declare function invoiceAmountPaid(inv: Invoice): number;
declare function invoiceBalanceDue(inv: Invoice): number;
declare function creditNotesForInvoice(invoiceId: string): CreditNote[];
declare function fmtDate(ts: number): string;
declare function fmtDateTime(ts: number): string;
declare function localDateStr(d?: Date): string;
declare function normalizePhone(phone: string): string;
declare function canManage(): boolean;
declare function canSeeRevenue(): boolean;
declare function isOwnerLevel(role: string | undefined): boolean;
declare const PLAN_FEATURES: { [plan: string]: string[] };
declare const PLAN_LABELS: { [plan: string]: { ms: string; en: string; price: string } };
declare const PLAN_PRICE_MYR: { [plan: string]: number };
declare function checkLicenseStatus(): Promise<void>;
declare function upgradePlanTestMode(plan: string): Promise<void>;
declare function upgradePlanReal(plan: string): Promise<void>;
declare function redeemCreditForUpgrade(plan: string): Promise<void>;
declare function redeemReferralCode(code: string): Promise<void>;
declare function currentPlan(): string;
declare function hasFeature(key: string): boolean;
declare function getOrCreateLicenseKey(): string;
declare function getLicenseClient(): any;
declare function planPickerModalHTML(): string;
declare function logoMarkHtml(px: number): string;
declare function logAudit(action: string, detail: string): void;
declare function getCustomer(id: string | null | undefined): Customer | undefined;
declare function getVehicle(id: string | null | undefined): Vehicle | undefined;
declare function getVehiclesFor(customerId: string): Vehicle[];
declare function getItem(id: string | null | undefined): InventoryItem | undefined;
declare function vehicleServiceStatus(v: Vehicle): { due: boolean; kmLeft: number } | null;

declare function t(key: string): string;
declare function tt(msText: string): string;

declare function render(): void;
declare function isModalBlocking(): boolean;
declare function getFocusableInModal(): Element[];
declare function closeActiveModalViaEscape(): void;
declare function goBack(): void;
declare function manageModalFocus(): void;
declare function setState(patch: Partial<AppState>): void;
declare function maybeRerender(): void;
declare function showToast(msg: string, undoFn?: () => void): void;
declare function queueSave(): void;
declare function askConfirm(message: string, onConfirm: () => void, opts?: any): void;
declare function handleRemoteChange(table: string, payload: any): void;
declare function subscribeRealtime(): void;
declare function unsubscribeRealtime(): void;
declare function getNotifications(): { tag: string; label: string; sub: string; view: string; urgent: boolean }[];
declare function bindAction(name: string, fn: (el?: HTMLElement) => void): void;
declare function bindAllAction(name: string, fn: (el: HTMLElement) => void): void;
declare function isCustomInteractiveElement(el: HTMLElement | null): boolean;
declare function makeClickablesFocusable(): void;
declare function initApp(): Promise<void>;

// ---- View / modal HTML generators (each returns an HTML string) ----
declare function viewDashboard(): string;
declare function viewJobs(): string;
declare function viewPOS(): string;
declare function settleBalanceModalHTML(invoice: Invoice): string;
declare function creditNoteModalHTML(invoice: Invoice): string;
declare function viewInventory(): string;
declare function viewFinance(): string;
declare function viewCustomers(): string;
declare function customersTabHTML(): string;
declare const LEAD_STAGES: string[];
declare const INTERACTIVE_DATA_ATTRS: string[];
declare function leadStageLabel(stage: string): string;
declare function leadStagePill(stage: string): string;
declare function leadsTabHTML(): string;
declare function leadModalHTML(): string;
declare const TECH_REF_CATEGORIES: { key: string; ms: string; en: string }[];
declare function techRefCategoryLabel(key: string): string;
declare function viewTechRef(): string;
declare function techRefModalHTML(entry?: TechRef | null): string;
declare function techRefDetailModalHTML(entry: TechRef): string;
declare function viewReports(): string;
declare function renderSalesChart(invoices: Invoice[], rangeDays: number): string;
declare function viewPayroll(): string;
declare function computeMonthlyPay(staffMember: Staff, month: string): { baseSalary: number; commissionRevenue: number; commissionPct: number; commission: number; total: number };
declare function currentMonthStr(): string;
declare function monthLabel(monthStr: string): string;
declare function shiftMonth(monthStr: string, delta: number): string;
declare function payrollPaymentModalHTML(staffId: string): string;
declare function viewStaff(): string;
declare function viewAppointments(): string;
declare function viewSettings(): string;
declare function viewAccount(): string;
declare function renderView(): string;
declare function getNavItems(): { k: string; l: string; icon: string; badge?: number; badgeWarn?: boolean; adminOnly?: boolean; advancedOnly?: boolean }[];
declare function renderSidebar(): string;
declare function renderMobileTabBar(): string;
declare function renderMobileMoreSheet(): string;
declare function renderMobileAiBubble(): string;
declare function renderSupportChatModal(): string;
declare function supportThreadIdForCurrentUser(): string | null;
declare function supportMessagesForThread(threadStaffId: string): SupportMessage[];
declare function supportThreadsForManager(): { staffId: string; staffName: string; lastMessage: string; lastAt: number; unreadCount: number }[];
declare function supportUnreadCount(): number;
declare function markSupportThreadRead(threadStaffId: string | null): void;
declare const PUSH_VAPID_PUBLIC_KEY: string;
declare function pushSupported(): boolean;
declare function isPushSubscribed(): Promise<boolean>;
declare function refreshPushSubscriptionState(): Promise<void>;
declare function subscribeToPush(): Promise<boolean>;
declare function unsubscribeFromPush(): Promise<boolean>;
declare function renderNotifBell(extraClass?: string): string;
declare function renderSupportChatButton(extraClass?: string): string;
declare function renderTopbar(): string;
declare function renderSyncErrorBanner(): string;
declare function renderModal(): string;
declare function renderConfirmModal(): string;
declare function renderOnboarding(): string;
declare function renderLoginScreen(): string;
declare function renderKioskScreen(): string;
declare function renderAttendancePunch(): string;
declare function loadAttendanceStatus(): Promise<void>;
declare function attachAttendancePunchHandlers(): void;
declare function renderInspectionReport(): string;
declare function loadInspectionReport(): Promise<void>;
declare function attachInspectionReportHandlers(): void;
declare function kioskStatusTabHTML(): string;
declare function kioskHistoryTabHTML(): string;
declare function kioskBookingTabHTML(): string;
declare function renderQuotationApproval(): string;
declare function loadQuotationForApproval(): Promise<void>;
declare function attachQuotationApprovalHandlers(): void;
declare function renderInvoiceView(): string;
declare function loadInvoiceForCustomer(): Promise<void>;
declare function printKioskInvoice(inv: any): void;
declare function attachInvoiceViewHandlers(): void;
declare function kioskAccountTabHTML(): string;
declare function getCustomerAuthClient(): any;
declare function checkCustPortalSession(): Promise<void>;
declare function loadCustPortalProfile(): Promise<void>;
declare function loadCustPortalData(): Promise<void>;
declare function custPortalSignup(): Promise<void>;
declare function custPortalLogin(): Promise<void>;
declare function custPortalForgotPassword(): Promise<void>;
declare function custPortalLinkAccount(): Promise<void>;
declare function custPortalLogout(): Promise<void>;
declare function custPortalRespondQuotation(quoteId: string, approved: boolean): Promise<void>;
declare function custPortalViewInvoice(invoiceId: string): Promise<void>;
declare function renderDisplayBoard(): string;
declare function loadDisplayBoardJobs(): Promise<void>;
declare function attachDisplayBoardHandlers(): void;
declare function renderJobTicket(j: Job): string;
declare function renderPOSItemList(filter: string): string;
declare function emptyState(msg: string): string;
declare function staffModalHTML(staffMember?: Staff | null): string;
declare function attendanceQrModalHTML(staffMember: Staff): string;
declare function computeAttendanceSummary(staffId: string, monthStr: string): { presentDays: number; absentDays: number; totalHours: number; days: { dateStr: string; inTs: number | null; outTs: number | null; hours: number; present: boolean; incomplete: boolean }[] };
declare function attendanceSummaryModalHTML(staffId: string): string;
declare function editAttendanceModalHTML(record: AttendanceRecord): string;
declare function appointmentModalHTML(presetDate?: string): string;
declare function getCalendarGrid(monthStr: string): { dateStr: string; inMonth: boolean; day: number }[];
declare function viewCalendarGrid(): string;
declare function dayAppointmentsModalHTML(dateStr: string): string;
declare function contractModalHTML(): string;
declare function customerModalHTML(): string;
declare function customerEditModalHTML(c: Customer): string;
declare function vehicleEditModalHTML(v: Vehicle): string;
declare function vehicleHistoryModalHTML(v: Vehicle): string;
declare function vehicleModalHTML(customerId: string): string;
declare function itemModalHTML(item?: InventoryItem | null): string;
declare function packageModalHTML(pkg?: Package | null): string;
declare function bayModalHTML(bay?: Bay | null): string;
declare function supplierModalHTML(supplier?: Supplier | null): string;
declare function poModalHTML(): string;
declare function receivePoModalHTML(po: PurchaseOrder): string;
declare function jobDetailModalHTML(j: Job): string;
declare function newJobModalHTML(): string;
declare function inspectionModalHTML(job: Job): string;
declare function mfaSettingsModalHTML(): string;
declare function faceIdOfferModalHTML(email: string): string;
declare function faceIdSettingsModalHTML(): string;

// ---- Setup / lifecycle ----
declare function attachHandlers(): void;
declare function bindGlobalSearchResultHandlers(): void;
declare function attachLoginHandlers(): void;
declare function attachKioskHandlers(): void;
declare function resetInactivityTimer(): void;
declare function updateSyncIndicator(): void;
declare function defaultDB(): DB;
declare function handleAuthenticated(session: any): Promise<void>;
declare function isMobileDevice(): boolean;
declare function faceIdSupported(): Promise<boolean>;
declare function faceIdSupportedSync(): boolean;
declare function getFaceIdEnrollment(): { email: string; credentialId: string } | null;
declare function enrollFaceId(email: string, displayName?: string): Promise<boolean>;
declare function tryFaceIdUnlock(): Promise<boolean>;
declare function clearFaceId(): void;
declare function maybeOfferFaceIdEnroll(session: any): Promise<void>;
declare let pendingFaceIdSession: any;
declare function requestAiSuggestion(job: Job): Promise<void>;
declare function requestAiQuoteSuggestion(): Promise<void>;
declare function renderAiQuoteSuggestionBox(): string;
declare function voiceInputSupported(): boolean;
declare function voiceInputBtnHTML(targetId: string, title?: string): string;
declare function startVoiceInput(targetId: string, btnEl: HTMLElement): void;
declare function openAiAssistant(): void;
declare function sendAiAssistantMessage(text: string): Promise<void>;
declare function aiAssistantModalHTML(): string;
declare function getOnboardingSteps(): any[];
declare function finishOnboarding(): void;
declare function checkOnboarding(): Promise<void>;
declare function checkWhatsNew(): Promise<void>;
declare function dismissWhatsNew(): void;
declare function initials(name: string): string;
declare function focusEnd(id: string): void;
declare function downloadCSV(filename: string, headers: string[], rows: any[][]): void;
declare function globalSearchResults(q: string): { typeLabel: string; label: string; sub: string; action: { type: string; id: string } }[];
declare function renderGlobalSearchResultsHTML(): string;

// ---- Counters / printing ----
declare function nextJobNo(): Promise<string>;
declare function nextInvNo(): Promise<string>;
declare function nextPoNo(): Promise<string>;
declare function nextCreditNoteNo(): Promise<string>;
declare function nextQuoteNo(): Promise<string>;
declare function printInvoice(inv: Invoice): void;
declare function printCreditNote(cn: CreditNote, invoice?: Invoice): void;
declare function printQuotation(q: Quotation): void;
declare function printPayslip(record: PayrollRecord): void;
declare function printJobCard(job: Job): void;
declare function printVehicleQR(v: Vehicle): void;
declare function printAttendanceQr(staffMember: Staff): void;
declare function printAttendanceSummary(staffId: string, month: string): void;
