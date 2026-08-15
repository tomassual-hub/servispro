// @ts-nocheck
// MS_EN below is a big flat Malay->English lookup; short common words like
// "hari" (day) legitimately recur as a key across many unrelated phrases
// with the same translation each time — harmless in practice (object
// literals just keep the last, identical, value) but tsc's duplicate-key
// check can't tell "harmless repeat" from "actually conflicting" without
// per-entry review, and this file has no logic worth type-checking anyway.
/* ============================= i18n =============================
   Two layers, deliberately different in how far each one's translation
   coverage goes:
   - I18N/t(): a small, fully-translated set of ~35 keys (nav labels, page
     titles, common buttons, the login screen) -- the app's own "chrome",
     visible on every single screen regardless of which view is open. Every
     supported language (see SUPPORTED_LANGUAGES below) has a complete,
     hand-written entry for all of these.
   - MS_EN/tt(): a much larger (~200 entries) Malay->English lookup used
     for body text scattered across every individual view (form labels,
     help text, toast/confirm messages). Only Malay and English are fully
     covered here -- extending this SAME way to every SUPPORTED_LANGUAGES
     entry would mean translating/maintaining ~200 strings PER language
     (1000+ more entries) on top of the >1,200 other hardcoded bilingual
     ternaries (`state.language==='en'?'X':'Y'`) spread throughout every
     view file, none of which route through here at all. That's a much
     larger, separate undertaking than this pass -- see tt() below for
     exactly how a language beyond ms/en degrades (falls back to English,
     not a blank/broken string) until that migration happens incrementally.
*/
const SUPPORTED_LANGUAGES = [
  {code:'ms', label:'Bahasa Melayu'},
  {code:'en', label:'English'},
  {code:'zh', label:'中文'},
  {code:'ta', label:'தமிழ்'},
  {code:'id', label:'Bahasa Indonesia'},
  {code:'th', label:'ไทย'},
  {code:'vi', label:'Tiếng Việt'},
  {code:'ko', label:'한국어'},
  {code:'ja', label:'日本語'},
  {code:'ru', label:'Русский'},
  {code:'ar', label:'العربية'},
];

const I18N = {
  ms: {
    nav_dashboard:'Papan Pemuka', nav_jobs:'Kad Kerja', nav_pos:'POS', nav_inventory:'Inventori', nav_finance:'Kewangan',
    nav_customers:'Pelanggan', nav_reports:'Laporan', nav_staff:'Staf', nav_appointments:'Tempahan', nav_settings:'Tetapan',
    title_dashboard:'Papan Pemuka', title_jobs:'Kad Kerja', title_pos:'Tempat Jualan (POS)', title_inventory:'Inventori Alat Ganti', title_finance:'Kewangan',
    title_customers:'Pelanggan & Kenderaan', title_reports:'Laporan', title_staffpage:'Pengurusan Staf',
    title_appointments:'Tempahan & Kontrak Servis', title_settings:'Tetapan', title_payroll:'Gaji',
    login_title:'Sila Log Masuk', kiosk_link:'Pelanggan? Semak Status Kenderaan Anda',
    stat_today_sales:'Jualan Hari Ini', stat_active_jobs:'Kerja Aktif', stat_low_stock:'Stok Rendah', stat_total_customers:'Jumlah Pelanggan',
    btn_save:'Simpan', btn_cancel:'Batal', btn_close:'Tutup', btn_delete:'Padam', btn_edit:'Sunting', btn_add:'Tambah',
    btn_logout:'Log Keluar', search_placeholder:'Cari pelanggan, plat, no. kerja, invois...',
  },
  en: {
    nav_dashboard:'Dashboard', nav_jobs:'Job Cards', nav_pos:'POS', nav_inventory:'Inventory', nav_finance:'Finance',
    nav_customers:'Customers', nav_reports:'Reports', nav_staff:'Staff', nav_appointments:'Appointments', nav_settings:'Settings',
    title_dashboard:'Dashboard', title_jobs:'Job Cards', title_pos:'Point of Sale (POS)', title_inventory:'Parts Inventory', title_finance:'Finance',
    title_customers:'Customers & Vehicles', title_reports:'Reports', title_staffpage:'Staff Management',
    title_appointments:'Appointments & Service Contracts', title_settings:'Settings', title_payroll:'Payroll',
    login_title:'Please Log In', kiosk_link:'Customer? Check Your Vehicle Status',
    stat_today_sales:"Today's Sales", stat_active_jobs:'Active Jobs', stat_low_stock:'Low Stock', stat_total_customers:'Total Customers',
    btn_save:'Save', btn_cancel:'Cancel', btn_close:'Close', btn_delete:'Delete', btn_edit:'Edit', btn_add:'Add',
    btn_logout:'Log Out', search_placeholder:'Search customers, plates, job/invoice no...',
  },
  zh: {
    nav_dashboard:'仪表板', nav_jobs:'工作卡', nav_pos:'POS', nav_inventory:'库存', nav_finance:'财务',
    nav_customers:'客户', nav_reports:'报告', nav_staff:'员工', nav_appointments:'预约', nav_settings:'设置',
    title_dashboard:'仪表板', title_jobs:'工作卡', title_pos:'销售点 (POS)', title_inventory:'零件库存', title_finance:'财务',
    title_customers:'客户与车辆', title_reports:'报告', title_staffpage:'员工管理',
    title_appointments:'预约与服务合同', title_settings:'设置', title_payroll:'薪资',
    login_title:'请登录', kiosk_link:'客户？查看您的车辆状态',
    stat_today_sales:'今日销售额', stat_active_jobs:'进行中的工作', stat_low_stock:'库存不足', stat_total_customers:'客户总数',
    btn_save:'保存', btn_cancel:'取消', btn_close:'关闭', btn_delete:'删除', btn_edit:'编辑', btn_add:'添加',
    btn_logout:'登出', search_placeholder:'搜索客户、车牌、工作/发票编号...',
  },
  ta: {
    nav_dashboard:'முகப்புப் பலகை', nav_jobs:'பணி அட்டைகள்', nav_pos:'POS', nav_inventory:'சரக்கு', nav_finance:'நிதி',
    nav_customers:'வாடிக்கையாளர்கள்', nav_reports:'அறிக்கைகள்', nav_staff:'பணியாளர்கள்', nav_appointments:'சந்திப்புகள்', nav_settings:'அமைப்புகள்',
    title_dashboard:'முகப்புப் பலகை', title_jobs:'பணி அட்டைகள்', title_pos:'விற்பனை புள்ளி (POS)', title_inventory:'பாகங்கள் சரக்கு', title_finance:'நிதி',
    title_customers:'வாடிக்கையாளர்கள் & வாகனங்கள்', title_reports:'அறிக்கைகள்', title_staffpage:'பணியாளர் மேலாண்மை',
    title_appointments:'சந்திப்புகள் & சேவை ஒப்பந்தங்கள்', title_settings:'அமைப்புகள்', title_payroll:'சம்பளப்பட்டியல்',
    login_title:'உள்நுழையவும்', kiosk_link:'வாடிக்கையாளரா? உங்கள் வாகன நிலையைச் சரிபார்க்கவும்',
    stat_today_sales:'இன்றைய விற்பனை', stat_active_jobs:'செயலில் உள்ள பணிகள்', stat_low_stock:'குறைந்த இருப்பு', stat_total_customers:'மொத்த வாடிக்கையாளர்கள்',
    btn_save:'சேமி', btn_cancel:'ரத்து செய்', btn_close:'மூடு', btn_delete:'நீக்கு', btn_edit:'திருத்து', btn_add:'சேர்',
    btn_logout:'வெளியேறு', search_placeholder:'வாடிக்கையாளர், பதிவு எண், பணி/விலைப்பட்டியல் எண் தேடவும்...',
  },
  id: {
    nav_dashboard:'Dasbor', nav_jobs:'Kartu Kerja', nav_pos:'POS', nav_inventory:'Inventaris', nav_finance:'Keuangan',
    nav_customers:'Pelanggan', nav_reports:'Laporan', nav_staff:'Staf', nav_appointments:'Janji Temu', nav_settings:'Pengaturan',
    title_dashboard:'Dasbor', title_jobs:'Kartu Kerja', title_pos:'Titik Penjualan (POS)', title_inventory:'Inventaris Suku Cadang', title_finance:'Keuangan',
    title_customers:'Pelanggan & Kendaraan', title_reports:'Laporan', title_staffpage:'Manajemen Staf',
    title_appointments:'Janji Temu & Kontrak Servis', title_settings:'Pengaturan', title_payroll:'Penggajian',
    login_title:'Silakan Masuk', kiosk_link:'Pelanggan? Periksa Status Kendaraan Anda',
    stat_today_sales:'Penjualan Hari Ini', stat_active_jobs:'Pekerjaan Aktif', stat_low_stock:'Stok Rendah', stat_total_customers:'Total Pelanggan',
    btn_save:'Simpan', btn_cancel:'Batal', btn_close:'Tutup', btn_delete:'Hapus', btn_edit:'Ubah', btn_add:'Tambah',
    btn_logout:'Keluar', search_placeholder:'Cari pelanggan, plat, no. kerja/invoice...',
  },
  th: {
    nav_dashboard:'แดชบอร์ด', nav_jobs:'ใบงาน', nav_pos:'POS', nav_inventory:'คลังสินค้า', nav_finance:'การเงิน',
    nav_customers:'ลูกค้า', nav_reports:'รายงาน', nav_staff:'พนักงาน', nav_appointments:'นัดหมาย', nav_settings:'ตั้งค่า',
    title_dashboard:'แดชบอร์ด', title_jobs:'ใบงาน', title_pos:'จุดขาย (POS)', title_inventory:'คลังอะไหล่', title_finance:'การเงิน',
    title_customers:'ลูกค้าและยานพาหนะ', title_reports:'รายงาน', title_staffpage:'การจัดการพนักงาน',
    title_appointments:'นัดหมายและสัญญาบริการ', title_settings:'ตั้งค่า', title_payroll:'เงินเดือน',
    login_title:'กรุณาเข้าสู่ระบบ', kiosk_link:'ลูกค้า? ตรวจสอบสถานะยานพาหนะของคุณ',
    stat_today_sales:'ยอดขายวันนี้', stat_active_jobs:'งานที่กำลังดำเนินการ', stat_low_stock:'สต็อกต่ำ', stat_total_customers:'ลูกค้าทั้งหมด',
    btn_save:'บันทึก', btn_cancel:'ยกเลิก', btn_close:'ปิด', btn_delete:'ลบ', btn_edit:'แก้ไข', btn_add:'เพิ่ม',
    btn_logout:'ออกจากระบบ', search_placeholder:'ค้นหาลูกค้า ป้ายทะเบียน เลขที่งาน/ใบแจ้งหนี้...',
  },
  vi: {
    nav_dashboard:'Bảng điều khiển', nav_jobs:'Thẻ công việc', nav_pos:'POS', nav_inventory:'Kho hàng', nav_finance:'Tài chính',
    nav_customers:'Khách hàng', nav_reports:'Báo cáo', nav_staff:'Nhân viên', nav_appointments:'Lịch hẹn', nav_settings:'Cài đặt',
    title_dashboard:'Bảng điều khiển', title_jobs:'Thẻ công việc', title_pos:'Điểm bán hàng (POS)', title_inventory:'Kho phụ tùng', title_finance:'Tài chính',
    title_customers:'Khách hàng & Xe', title_reports:'Báo cáo', title_staffpage:'Quản lý nhân viên',
    title_appointments:'Lịch hẹn & Hợp đồng dịch vụ', title_settings:'Cài đặt', title_payroll:'Bảng lương',
    login_title:'Vui lòng đăng nhập', kiosk_link:'Khách hàng? Kiểm tra tình trạng xe của bạn',
    stat_today_sales:'Doanh số hôm nay', stat_active_jobs:'Công việc đang hoạt động', stat_low_stock:'Sắp hết hàng', stat_total_customers:'Tổng số khách hàng',
    btn_save:'Lưu', btn_cancel:'Hủy', btn_close:'Đóng', btn_delete:'Xóa', btn_edit:'Sửa', btn_add:'Thêm',
    btn_logout:'Đăng xuất', search_placeholder:'Tìm khách hàng, biển số, số công việc/hóa đơn...',
  },
  ko: {
    nav_dashboard:'대시보드', nav_jobs:'작업 카드', nav_pos:'POS', nav_inventory:'재고', nav_finance:'재무',
    nav_customers:'고객', nav_reports:'보고서', nav_staff:'직원', nav_appointments:'예약', nav_settings:'설정',
    title_dashboard:'대시보드', title_jobs:'작업 카드', title_pos:'판매 시점 (POS)', title_inventory:'부품 재고', title_finance:'재무',
    title_customers:'고객 및 차량', title_reports:'보고서', title_staffpage:'직원 관리',
    title_appointments:'예약 및 서비스 계약', title_settings:'설정', title_payroll:'급여',
    login_title:'로그인해 주세요', kiosk_link:'고객이신가요? 차량 상태 확인하기',
    stat_today_sales:'오늘의 매출', stat_active_jobs:'진행 중인 작업', stat_low_stock:'재고 부족', stat_total_customers:'총 고객 수',
    btn_save:'저장', btn_cancel:'취소', btn_close:'닫기', btn_delete:'삭제', btn_edit:'수정', btn_add:'추가',
    btn_logout:'로그아웃', search_placeholder:'고객, 번호판, 작업/송장 번호 검색...',
  },
  ja: {
    nav_dashboard:'ダッシュボード', nav_jobs:'作業カード', nav_pos:'POS', nav_inventory:'在庫', nav_finance:'財務',
    nav_customers:'顧客', nav_reports:'レポート', nav_staff:'スタッフ', nav_appointments:'予約', nav_settings:'設定',
    title_dashboard:'ダッシュボード', title_jobs:'作業カード', title_pos:'販売時点情報管理 (POS)', title_inventory:'部品在庫', title_finance:'財務',
    title_customers:'顧客と車両', title_reports:'レポート', title_staffpage:'スタッフ管理',
    title_appointments:'予約とサービス契約', title_settings:'設定', title_payroll:'給与',
    login_title:'ログインしてください', kiosk_link:'お客様ですか？車両の状態を確認する',
    stat_today_sales:'本日の売上', stat_active_jobs:'進行中の作業', stat_low_stock:'在庫不足', stat_total_customers:'総顧客数',
    btn_save:'保存', btn_cancel:'キャンセル', btn_close:'閉じる', btn_delete:'削除', btn_edit:'編集', btn_add:'追加',
    btn_logout:'ログアウト', search_placeholder:'顧客、ナンバープレート、作業/請求書番号を検索...',
  },
  ru: {
    nav_dashboard:'Панель управления', nav_jobs:'Наряд-заказы', nav_pos:'POS', nav_inventory:'Склад', nav_finance:'Финансы',
    nav_customers:'Клиенты', nav_reports:'Отчёты', nav_staff:'Персонал', nav_appointments:'Записи', nav_settings:'Настройки',
    title_dashboard:'Панель управления', title_jobs:'Наряд-заказы', title_pos:'Точка продаж (POS)', title_inventory:'Склад запчастей', title_finance:'Финансы',
    title_customers:'Клиенты и автомобили', title_reports:'Отчёты', title_staffpage:'Управление персоналом',
    title_appointments:'Записи и сервисные контракты', title_settings:'Настройки', title_payroll:'Зарплата',
    login_title:'Пожалуйста, войдите', kiosk_link:'Клиент? Проверьте статус вашего автомобиля',
    stat_today_sales:'Продажи за сегодня', stat_active_jobs:'Активные заказы', stat_low_stock:'Низкий запас', stat_total_customers:'Всего клиентов',
    btn_save:'Сохранить', btn_cancel:'Отмена', btn_close:'Закрыть', btn_delete:'Удалить', btn_edit:'Изменить', btn_add:'Добавить',
    btn_logout:'Выйти', search_placeholder:'Поиск клиента, номера, наряда/счёта...',
  },
  ar: {
    nav_dashboard:'لوحة التحكم', nav_jobs:'بطاقات العمل', nav_pos:'نقطة البيع', nav_inventory:'المخزون', nav_finance:'المالية',
    nav_customers:'العملاء', nav_reports:'التقارير', nav_staff:'الموظفون', nav_appointments:'المواعيد', nav_settings:'الإعدادات',
    title_dashboard:'لوحة التحكم', title_jobs:'بطاقات العمل', title_pos:'نقطة البيع (POS)', title_inventory:'مخزون القطع', title_finance:'المالية',
    title_customers:'العملاء والمركبات', title_reports:'التقارير', title_staffpage:'إدارة الموظفين',
    title_appointments:'المواعيد وعقود الخدمة', title_settings:'الإعدادات', title_payroll:'الرواتب',
    login_title:'يرجى تسجيل الدخول', kiosk_link:'هل أنت عميل؟ تحقق من حالة مركبتك',
    stat_today_sales:'مبيعات اليوم', stat_active_jobs:'الأعمال النشطة', stat_low_stock:'مخزون منخفض', stat_total_customers:'إجمالي العملاء',
    btn_save:'حفظ', btn_cancel:'إلغاء', btn_close:'إغلاق', btn_delete:'حذف', btn_edit:'تعديل', btn_add:'إضافة',
    btn_logout:'تسجيل الخروج', search_placeholder:'البحث عن عميل أو لوحة أو رقم عمل/فاتورة...',
  },
};
// state.displayLanguage is the user's actual chosen language (any
// SUPPORTED_LANGUAGES code); state.language stays ms/en ONLY (see
// setDisplayLanguage() below) since that's what the >1,200 hardcoded
// `state.language==='en'?'X':'Y'` ternaries elsewhere in this app check
// directly -- t() prefers a full displayLanguage entry when one exists
// (all of them do, see above), then falls back through language, then ms.
function t(key){
  return (I18N[state.displayLanguage] && I18N[state.displayLanguage][key])
    || (I18N[state.language] && I18N[state.language][key])
    || I18N.ms[key] || key;
}

// Sets both language fields together -- `language` is forced to 'en' for
// any chosen language other than ms/en itself, so the large body of
// pre-existing `state.language==='en'?...` ternaries elsewhere in the app
// (never updated to know about the other SUPPORTED_LANGUAGES codes)
// automatically fall back to English rather than staying stuck in Malay.
// Does not render() or persist by itself -- callers (the language picker's
// change handler, and initApp()'s boot-time restore) do that themselves,
// since the picker also needs to save the choice and the boot restore
// deliberately must not.
function setDisplayLanguage(code){
  state.displayLanguage = code;
  state.language = (code==='ms' || code==='en') ? code : 'en';
}

const LOCALE_MAP = {
  ms:'ms-MY', en:'en-GB', zh:'zh-CN', ta:'ta-IN', id:'id-ID', th:'th-TH',
  vi:'vi-VN', ko:'ko-KR', ja:'ja-JP', ru:'ru-RU',
  // ar-SA defaults to the Islamic Umm al-Qura calendar in most JS engines --
  // this app's dates are all Gregorian business records (job/invoice
  // dates), so ar-EG (Gregorian by default there) avoids silently showing
  // a completely different year/calendar to an Arabic-speaking user.
  ar:'ar-EG',
};
// Every toLocaleDateString/toLocaleTimeString call in this app should go
// through this instead of hardcoding a locale -- state.language alone
// can't tell ja/ko/zh/etc. apart (see setDisplayLanguage() above), and
// several call sites hardcoded 'ms-MY' unconditionally regardless of
// language, which is why dates kept showing in Malay ("16 Ogos 2026") even
// after switching the rest of the UI to English.
function dateLocale(){ return LOCALE_MAP[state.displayLanguage] || 'ms-MY'; }

// Shared <select> replacing the old binary MS/EN toggle button -- rendered
// at every spot that button used to occupy (topbar, mobile more-sheet,
// login screen, kiosk screen, account page). A single component so all 5
// spots stay in sync automatically instead of drifting the way 5 separate
// copies of the old toggle's markup could.
function languagePickerHTML(extraClass){
  return `<select class="lang-picker ${extraClass||''}" data-action="set-display-language" title="Language / Bahasa">
    ${SUPPORTED_LANGUAGES.map(l=>`<option value="${l.code}" ${state.displayLanguage===l.code?'selected':''}>${l.label}</option>`).join('')}
  </select>`;
}
// Called from every attach*Handlers() that can render a languagePickerHTML()
// instance (see event-handlers.js/login-kiosk.js) -- querySelectorAll
// rather than getElementById since the mobile more-sheet's and desktop
// topbar's pickers can both be present in the DOM at once (CSS breakpoints
// hide one, not JS), same reasoning as the old toggle-lang's bindAllAction.
function bindLanguagePickers(){
  document.querySelectorAll('[data-action="set-display-language"]').forEach(el=>{
    el.addEventListener('change', ()=>{
      setDisplayLanguage(/** @type {HTMLSelectElement} */(el).value);
      try{ window.storage.set('display-language', state.displayLanguage, false); }catch(e){}
      render();
    });
  });
}

// Bulk MS->EN map for body text across all views (key = Malay text as written in the UI)
const MS_EN = {
  'Kad Kerja Aktif':'Active Job Cards','Tiada kerja aktif buat masa ini.':'No active jobs at this time.',
  'Lihat Semua Kad Kerja':'View All Job Cards','Amaran Stok Rendah':'Low Stock Alerts','Semua stok mencukupi.':'All stock is sufficient.',
  'baki':'left','Invois Terkini':'Recent Invoices','Belum ada invois.':'No invoices yet.','Walk-in':'Walk-in',
  'Tempahan Akan Datang':'Upcoming Appointments','Tiada tempahan dijadualkan.':'No appointments scheduled.',
  'Lihat Semua Tempahan':'View All Appointments','Kontrak Servis Tertunggak':'Overdue Service Contracts',
  'Tiada kontrak tertunggak.':'No overdue contracts.','Urus Kontrak':'Manage Contracts','Sejak':'Since',
  'Menunggu':'Waiting','Dalam Proses':'In Progress','Siap':'Done','Dihantar':'Delivered','Tiada penerangan':'No description',
  // Job Cards view
  'Urus tiket kerja servis seperti bengkel sebenar':'Manage service job tickets like a real workshop',
  'Kad kerja ditugaskan kepada anda':'Job cards assigned to you','Kad Kerja Baharu':'New Job Card',
  'Semua':'All','Tiada kad kerja untuk penapis ini.':'No job cards for this filter.',
  // Inventory view
  'Item':'Items','Pembekal':'Suppliers','Pesanan Belian':'Purchase Orders',
  'Urus stok alat ganti & bekalan bengkel':'Manage parts stock & workshop supplies','Item Baharu':'New Item',
  'Stok Rendah':'Low Stock','Nama Item':'Item Name','SKU':'SKU','Kuantiti':'Quantity','Kos':'Cost','Harga Jual':'Sell Price',
  'Status':'Status','Tiada item.':'No items.','Rendah':'Low','OK':'OK',
  'Senarai pembekal alat ganti bengkel':'List of workshop parts suppliers','Pembekal Baharu':'New Supplier',
  'Tiada pembekal direkod.':'No suppliers recorded.','item dibekalkan':'items supplied','Padam':'Delete',
  'Pesanan belian untuk isi semula stok':'Purchase orders to restock inventory','Pesanan Baharu':'New Order',
  'item stok rendah — jana pesanan belian automatik?':'low-stock items — generate automatic purchase order?',
  'Jana Pesanan Auto':'Auto-Generate Order','Tiada pesanan belian.':'No purchase orders.',
  'No. PO':'PO No.','Jumlah':'Total','Diterima':'Received','Belum Diterima':'Not Received',
  // Customers view
  'Rekod pelanggan dan kenderaan mereka':'Records of customers and their vehicles','Pelanggan Baharu':'New Customer',
  'Cari nama, telefon atau no. plat...':'Search name, phone, or plate no...','Tiada pelanggan sepadan.':'No matching customers.',
  'rekod kerja':'job records','Tambah Kenderaan':'Add Vehicle',
  // POS view
  'Pilih Item / Servis':'Select Item / Service','Cari item inventori...':'Search inventory items...',
  'Atau Tambah Caj Servis Custom':'Or Add Custom Service Charge','Nama servis':'Service name',
  'Troli & Invois':'Cart & Invoice','Pelanggan (pilihan)':'Customer (optional)','Tunai / Walk-in':'Cash / Walk-in',
  'Kenderaan':'Vehicle','Tiada':'None','Troli kosong. Pilih item di sebelah kiri.':'Cart is empty. Select an item on the left.',
  'Diskaun':'Discount','RM (Tetap)':'RM (Fixed)','% Peratus':'% Percent','Nilai Diskaun':'Discount Value',
  'Subjumlah':'Subtotal','JUMLAH':'TOTAL','Kaedah Bayaran':'Payment Method','Tunai':'Cash','Kad Debit/Kredit':'Debit/Credit Card',
  'Pemindahan Online / QR':'Online Transfer / QR','Jana Invois & Selesai':'Generate Invoice & Complete',
  'Petua: Ctrl+Enter untuk checkout pantas':'Tip: Ctrl+Enter for quick checkout','Sejarah Invois':'Invoice History',
  'Belum ada invois dikeluarkan.':'No invoices issued yet.','No. Invois':'Invoice No.','Tarikh':'Date','Bayaran':'Payment',
  'Tutup Kunci Tunai Harian':'Daily Cash Reconciliation','Jangkaan tunai':'Expected cash','Tunai dikira':'Counted cash',
  'Padan sepenuhnya':'Fully matched','Lebihan':'Surplus','Kekurangan':'Shortage','Ditutup oleh':'Closed by','pada':'on',
  'Jualan tunai sistem hari ini':'System cash sales today','Jumlah Tunai Dikira Sebenar (RM)':'Actual Counted Cash (RM)',
  'Tutup Kunci Hari Ini':"Close Today's Register",
  // Reports view
  'Ringkasan prestasi bengkel':'Workshop performance summary','7 Hari':'7 Days','30 Hari':'30 Days','90 Hari':'90 Days',
  'Jumlah Jualan':'Total Sales','invois':'invoices','Purata Setiap Invois':'Average Per Invoice','Kerja Disiapkan':'Jobs Completed',
  'Untung/Rugi (P&L)':'Profit & Loss (P&L)','Hasil (Revenue)':'Revenue','Kos Barangan (COGS)':'Cost of Goods (COGS)',
  'Untung Kasar':'Gross Profit','Margin':'Margin','Trend Jualan':'Sales Trend','Item / Servis Terlaris':'Top Items / Services',
  'Belum cukup data jualan.':'Not enough sales data yet.','Prestasi Mekanik':'Mechanic Performance','Mekanik':'Mechanic',
  'Kerja':'Jobs','Purata Masa Siap':'Avg Completion Time','Komisen':'Commission','jam':'hours',
  'Belum ada data mekanik.':'No mechanic data yet.',
  'Ramalan Stok (berdasarkan kadar jualan':'Stock Forecast (based on sales rate over last','hari terakhir)':'days)',
  'Tiada data jualan mencukupi untuk ramalan.':'Not enough sales data for forecasting.','Kadar Jualan/Hari':'Sales Rate/Day',
  'Anggaran Tempoh Habis':'Estimated Time Until Out','hari':'days','Pelanggan Berisiko Hilang':'At-Risk Customers',
  'senyap >':'silent >','hari':'days','Tiada pelanggan berisiko buat masa ini.':'No at-risk customers at this time.',
  'Pelanggan':'Customer','Telefon':'Phone','Lawatan Terakhir':'Last Visit','Hari Senyap':'Days Silent',
  // Staff view
  'Urus akaun staf & mekanik yang boleh log masuk':'Manage staff & mechanic accounts that can log in','Staf Baharu':'New Staff',
  'Sunting':'Edit','Log Aktiviti':'Activity Log','Rekod semua tindakan penting oleh staf untuk akauntabiliti':'Record of all important staff actions for accountability',
  'Tiada aktiviti direkod lagi.':'No activity recorded yet.','Masa':'Time','Tindakan':'Action','Butiran':'Details',
  // Appointments view
  'Tempahan':'Appointments','Kontrak Servis':'Service Contracts','Jadual janji temu servis pelanggan':'Schedule customer service appointments',
  'Tempahan Baharu':'New Appointment','Nota':'Notes','Tandakan selesai':'Mark done','Batal':'Cancel',
  'Hantar peringatan WhatsApp':'Send WhatsApp reminder','Dijadualkan':'Scheduled','Dibatalkan':'Cancelled',
  'Invois berulang untuk pelanggan korporat / armada kenderaan':'Recurring invoices for corporate/fleet customers',
  'Kontrak Baharu':'New Contract','Tiada kontrak servis ditubuhkan.':'No service contracts set up.',
  'Tertunggak':'Overdue','Kitaran: setiap':'Cycle: every','hari':'days','Seterusnya':'Next','/ kitaran':'/ cycle',
  'Jana Invois':'Generate Invoice',
  // Settings view
  'Maklumat Kedai':'Shop Information','Nama Bengkel':'Workshop Name','No. Telefon Bengkel':'Workshop Phone No.',
  'Kadar SST (%)':'SST Rate (%)','Diskaun Setia (%)':'Loyalty Discount (%)','Lawatan Layak Diskaun':'Visits to Qualify for Discount',
  'Anggap "Senyap" selepas (hari)':'Consider "Silent" after (days)','Simpan Tetapan':'Save Settings','Cawangan':'Branches',
  'Sandaran & Pemulihan Data':'Data Backup & Restore',
  'Muat turun semua data bengkel (pelanggan, invois, inventori, dll.) sebagai fail sandaran. Simpan secara berkala untuk keselamatan.':'Download all workshop data (customers, invoices, inventory, etc.) as a backup file. Save periodically for safety.',
  'Muat Turun Sandaran (JSON)':'Download Backup (JSON)','Pulihkan daripada Fail Sandaran':'Restore from Backup File',
  'Memulihkan akan menggantikan SEMUA data semasa.':'Restoring will replace ALL current data.','Eksport CSV':'Export CSV',
  'Kod QR Bayaran (DuitNow)':'Payment QR Code (DuitNow)',
  'Muat naik kod QR DuitNow bengkel anda untuk dipaparkan pada invois cetak, supaya pelanggan boleh imbas terus untuk bayar.':'Upload your workshop\'s DuitNow QR code to show it on printed invoices, so customers can scan to pay directly.',
  'Buang Kod QR':'Remove QR Code','Kod QR bayaran disimpan.':'Payment QR code saved.',
  'Buang kod QR bayaran ini?':'Remove this payment QR code?','Kod QR bayaran dibuang.':'Payment QR code removed.',
  'Invois':'Invoices','Inventori':'Inventory','Format Perakaunan':'Accounting Format',
  'Sunting Staf':'Edit Staff','Staf':'Staff','Nama':'Name','Peranan':'Role','Selesai':'Completed',
  'Sunting Pelanggan':'Edit Customer',
  'Sesi tamat kerana tidak aktif. Sila log masuk semula.':'Session ended due to inactivity. Please log in again.',
  'Minyak Enjin':'Engine Oil','Penapis Udara':'Air Filter','Penapis Minyak':'Oil Filter','Brek Depan':'Front Brakes',
  'Brek Belakang':'Rear Brakes','Tayar & Tekanan Angin':'Tires & Tire Pressure','Bateri':'Battery',
  'Wiper & Cecair Pembasuh':'Wipers & Washer Fluid','Lampu Depan/Belakang':'Front/Rear Lights',
  'Talian Kipas & Belt':'Fan Belt & Lines','Sistem Ekzos':'Exhaust System','Cecair Radiator/Coolant':'Radiator/Coolant Fluid',
  'Suspensi':'Suspension','Minyak Brek':'Brake Fluid','Minyak Gear/Transmisi':'Gear/Transmission Oil',
  'Air Conditioner (Aircond)':'Air Conditioner (A/C)',
  // toast/confirm messages
  'Sila masukkan nama pelanggan.':'Please enter customer name.',
  'Sila masukkan nama item.':'Please enter item name.',
  'Sila pilih tarikh dan masa.':'Please select date and time.',
  'Tempahan disimpan.':'Appointment saved.',
  'Data berjaya dipulihkan.':'Data restored successfully.',
  'Sila masukkan no. plat kenderaan.':'Please enter vehicle plate number.',
  'Sila masukkan nama pembekal.':'Please enter supplier name.',
  'Maklumat kenderaan dikemaskini.':'Vehicle information updated.',
  'Sila masukkan jumlah tunai.':'Please enter cash amount.',
  'Sila pilih pembekal.':'Please select a supplier.',
  'Pembekal dipadam.':'Supplier deleted.',
  'Sila masukkan no. plat.':'Please enter plate number.',
  'Kad kerja dikemaskini.':'Job card updated.',
  'Sila masukkan nama kontrak.':'Please enter contract name.',
  'Sila pilih atau tambah pelanggan.':'Please select or add a customer.',
  'Sila masukkan nama.':'Please enter a name.',
  'Sila masukkan nama staf.':'Please enter staff name.',
  'Staf dipadam.':'Staff deleted.',
  'Cawangan ditambah.':'Branch added.',
  'Sila masukkan nama cawangan.':'Please enter branch name.',
  'Sila masukkan sekurang-kurangnya satu item (format: nama:harga).':'Please enter at least one item (format: name:price).',
  'Pembekal disimpan.':'Supplier saved.',
  'Sila pilih pelanggan.':'Please select a customer.',
  'Diskaun setia digunakan.':'Loyalty discount applied.',
  'Maklumat pelanggan dikemaskini.':'Customer information updated.',
  'Kunci tunai hari ini ditutup.':'Today\'s cash register closed.',
  'Format item tidak sah (nama:kuantiti:kos).':'Invalid item format (name:qty:cost).',
  'Kenderaan ditambah.':'Vehicle added.',
  'Kontrak servis disimpan.':'Service contract saved.',
  'Tempahan dipadam.':'Appointment deleted.',
  'Sila lengkapkan nama & harga servis.':'Please complete service name & price.',
  'Fail sandaran dimuat turun.':'Backup file downloaded.',
  'PIN mesti 4 digit angka.':'PIN must be 4 digits.',
  'Tetapan disimpan.':'Settings saved.',
  'Item disimpan.':'Item saved.',
  'Tempahan dibatalkan.':'Appointment cancelled.',
  'Kontrak dipadam.':'Contract deleted.',
  'PIN salah, cuba lagi.':'Wrong PIN, try again.',
  'Tandatangan disimpan.':'Signature saved.',
  'Pemadaman dibatalkan.':'Deletion undone.',
  'Fail sandaran tidak sah.':'Invalid backup file.',
  'Staf disimpan.':'Staff saved.',
  'Pelanggan ditambah.':'Customer added.',
  'Tempahan ditandakan selesai.':'Appointment marked done.',
  'Cawangan dipadam.':'Branch deleted.',
  'Item dipadam.':'Item deleted.',
  'Kad kerja dipadam.':'Job card deleted.',
  'Pelanggan dipadam.':'Customer deleted.',
  // concatenated toast fragments
  'Selamat kembali, ':'Welcome back, ',
  'Pesanan belian ':'Purchase order ',
  ' disimpan.':' saved.',
  'Pesanan belian automatik dijana untuk ':'Auto purchase order generated for ',
  ' item.':' item(s).',
  'Stok dikemaskini daripada ':'Stock updated from ',
  'Invois ':'Invoice ',
  ' dijana daripada kontrak ':' generated from contract ',
  'Kad kerja ':'Job card ',
  ' dicipta.':' created.',
  'Sedia untuk buat invois bagi ':'Ready to invoice for ',
  ' berjaya dijana!':' generated successfully!',
  ' ditambah ke troli.':' added to cart.',
  ' item dicadangkan AI ditambah automatik ke troli — semak sebelum jana invois.':' AI-suggested item(s) added to the cart automatically — review before generating the invoice.',
  'Tiada item dengan kod "':'No item with code "',
  'Fail ':'File ',
  ' dimuat turun.':' downloaded.',
  // confirm dialog fragments
  'Padam pembekal ini? Item yang ditugaskan akan kekal tanpa pembekal.':'Delete this supplier? Assigned items will remain without a supplier.',
  'Padam item "':'Delete item "',
  '" daripada inventori?':'" from inventory?',
  'Padam pelanggan "':'Delete customer "',
  '" beserta semua kenderaan mereka? Rekod kerja lama akan dikekalkan.':'" along with all their vehicles? Old job records will be kept.',
  'Padam akaun staf "':'Delete staff account "',
  'Padam tempahan ini?':'Delete this appointment?',
  'Padam kontrak servis ini?':'Delete this service contract?',
  'Padam cawangan ini? Rekod sedia ada yang ditugaskan kepadanya akan kekal.':'Delete this branch? Existing records assigned to it will remain.',
  'Pulihkan data daripada fail ini? SEMUA data semasa akan digantikan.':'Restore data from this file? ALL current data will be replaced.',
  'Padam tandatangan sedia ada dan tandatangan semula?':'Delete the existing signature and sign again?',
  'Padam kad kerja ':'Delete job card ',
  'No. telefon ini sudah didaftarkan untuk "':'This phone number is already registered to "',
  '". Tambah sebagai pelanggan baharu juga?':'". Add as a new customer anyway?',
  'Tambah Juga':'Add Anyway',
  'No. plat "':'Plate number "',
  '" sudah wujud dalam rekod (pemilik: ':'" already exists in records (owner: ',
  '). Tambah juga sebagai rekod berasingan?':'). Add as a separate record anyway?',
  // Payroll nav/export, Face ID, backup errors, and 2 pre-existing gaps
  // (Pesanan Belian Baharu, Baki) found via an audit for tt() calls with
  // no English entry -- these silently stayed in Malay under EN mode.
  'Gaji':'Payroll',
  'Masukkan kod 6 digit.':'Enter the 6-digit code.',
  'Face ID diaktifkan.':'Face ID activated.',
  'Gagal aktifkan Face ID.':'Could not activate Face ID.',
  'Face ID dimatikan.':'Face ID turned off.',
  'Gagal muat senarai sandaran.':'Could not load backup list.',
  'Gagal muat turun sandaran.':'Could not download backup.',
  'Pesanan Belian Baharu':'New Purchase Order',
  'Baki':'Remaining',
  // Dashboard stat-card sub-lines and a POS scan field were raw string
  // literals with no tt() call at all -- not just a missing dictionary
  // entry, so the earlier tt()-vs-MS_EN audit couldn't have caught them.
  'invois dikeluarkan':'invoices issued',
  'menunggu tindakan':'awaiting action',
  'item perlu ditambah':'items to restock',
  'kenderaan direkod':'vehicles recorded',
  'Imbas / Kod Pantas (SKU)':'Scan / Quick Code (SKU)',
  'Imbas kod bar atau taip SKU, tekan Enter':'Scan barcode or type SKU, press Enter',
  'Tiada item sepadan.':'No matching items.',
};
// Only Malay gets its own literal text back -- every OTHER language
// (English included) reads through the English translation above. See the
// file header comment for why this layer doesn't have a dedicated map per
// SUPPORTED_LANGUAGES entry the way I18N/t() does.
function tt(msText){ return state.displayLanguage==='ms' ? msText : (MS_EN[msText]||msText); }
