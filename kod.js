

// -----------------------------------------------------------------
// ⚙️ الإعدادات العامة والمتغيرات الثابتة
// -----------------------------------------------------------------

// !! هام جداً: ID ملف Google Sheet
var SPREADSHEET_ID = '1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q'; 
var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
var cache = CacheService.getScriptCache();

// مدة التخزين بالثواني (3600 = 1 ساعة)
var CACHE_DURATION = 3600; 

// مفاتيح الكاش (لتنظيمها)
var KEY_SUPPLIERS = 'suppliers_data';
var KEY_CLIENTS = 'clients_data';
var KEY_CITIES = 'city_data';
var KEY_HOTELS = 'hotels_data';
var KEY_RESERVATIONS = 'reservations_data';
var USERS_SHEET_NAME = 'USERS';
var PAGE_SIZE = 20;

var EMPLOYEE_ALLOWED_PAGES = [
  'index',
  'Add-client',
  'add-tour',
  'add-hotel',
  'manage-reservations',
  'edit-reservation'
];

var MANAGEMENT_ROLES = ['admin', 'owner', 'developer', 'accountant'];
var KNOWN_ROLES = ['employee'].concat(MANAGEMENT_ROLES);

var DEFAULT_REDIRECT = {
  employee: 'manage-reservations',
  admin: 'manage-statistics',
  owner: 'manage-statistics',
  developer: 'manage-statistics',
  accountant: 'manage-statistics'
};

function getActiveUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    return (email || '').toString().trim().toLowerCase();
  } catch (err) {
    Logger.log('تعذر الحصول على البريد الإلكتروني النشط: ' + err);
    return '';
  }
}

function resolveAuthorizedUser() {
  var email = getActiveUserEmail();
  if (!email) {
    return { status: 'unauthenticated' };
  }
  var userRecord = findUserByEmail(email);
  if (!userRecord || !userRecord.role) {
    return { status: 'unauthorized', email: email };
  }
  return { status: 'authorized', user: userRecord };
}

function renderStatusPage(title, message, options) {
  options = options || {};
  var subMessage = options.subMessage || '';
  var actionHtml = options.actionHtml || '';
  var html =
    '<!DOCTYPE html>' +
    '<html lang="ar" dir="rtl">' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>' +
        'body{font-family:"Cairo","Tahoma",sans-serif;background:#f4f6f8;margin:0;padding:40px;}' +
        '.card{max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;text-align:center;box-shadow:0 20px 45px rgba(0,0,0,0.08);}' +
        'h1{margin:0 0 12px;color:#008891;font-size:1.6rem;}' +
        'p{color:#4a4a4a;line-height:1.8;margin:0 0 16px;font-size:1rem;}' +
        '.actions{margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}' +
        '.btn{display:inline-block;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;background:#008891;color:#fff;}' +
        '.btn.secondary{background:#e8f4f5;color:#006d75;}' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="card">' +
        '<h1>' + title + '</h1>' +
        '<p>' + message + '</p>' +
        (subMessage ? '<p style="font-size:0.9rem;color:#6c757d;margin-top:0;">' + subMessage + '</p>' : '') +
        (actionHtml ? '<div class="actions">' + actionHtml + '</div>' : '') +
      '</div>' +
    '</body>' +
    '</html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

function renderAuthRequiredPage() {
  var appUrl = ScriptApp.getService().getUrl();
  var actions =
    '<a class="btn" href="https://accounts.google.com/ServiceLogin" target="_top">تسجيل الدخول</a>' +
    '<a class="btn secondary" href="' + appUrl + '">تحديث الصفحة</a>';
  return renderStatusPage(
    'يرجى تسجيل الدخول',
    'يجب تسجيل الدخول بحساب Google للوصول إلى النظام.',
    {
      subMessage: 'بعد تسجيل الدخول أعد فتح الرابط أو استخدم زر تحديث الصفحة.',
      actionHtml: actions
    }
  );
}

function renderUnauthorizedPage(email) {
  var appUrl = ScriptApp.getService().getUrl();
  var actions =
    '<a class="btn" href="' + appUrl + '" target="_top">المحاولة مجدداً</a>';
  var message = 'الحساب ' + (email || 'الحالي') + ' غير موجود في ورقة USERS.';
  return renderStatusPage(
    'غير مصرح لك بالدخول',
    message,
    {
      subMessage: 'تواصل مع الإدارة لإضافة بريدك الإلكتروني إلى قائمة الصلاحيات.',
      actionHtml: actions
    }
  );
}

function renderLogoutPage(user) {
  var baseUrl = ScriptApp.getService().getUrl();
  var actions =
    '<a class="btn" href="' + baseUrl + '">العودة للنظام</a>' +
    '<a class="btn secondary" href="https://accounts.google.com/Logout" target="_top">تسجيل الخروج من Google</a>';
  return renderStatusPage(
    'تم تسجيل الخروج',
    'يمكنك إغلاق هذه الصفحة أو العودة فوراً للنظام. لتسجيل خروج كامل يرجى تسجيل الخروج من حساب Google.',
    {
      subMessage: user && user.email ? ('المستخدم: ' + user.email) : '',
      actionHtml: actions
    }
  );
}

// -----------------------------------------------------------------
// 🔒 دوال الأمان وتسجيل الدخول
// -----------------------------------------------------------------

function normalizeRole(role) {
  if (!role) return '';
  var normalized = role.toString().trim().toLowerCase();
  return KNOWN_ROLES.indexOf(normalized) !== -1 ? normalized : '';
}

function hasFullAccess(role) {
  return MANAGEMENT_ROLES.indexOf(role) !== -1;
}

function getDefaultPageForRole(role) {
  var normalized = normalizeRole(role);
  return DEFAULT_REDIRECT[normalized] || 'index';
}

function isPageAllowedForRole(page, role) {
  if (page === 'login' || page === 'logout') {
    return true;
  }
  var normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return false;
  }
  if (hasFullAccess(normalizedRole)) {
    return true;
  }
  return EMPLOYEE_ALLOWED_PAGES.indexOf(page) !== -1;
}

function findUserByEmail(email) {
  if (!email) return null;
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    throw new Error('لم يتم العثور على ورقة USERS');
  }
  var data = sheet.getDataRange().getValues();
  var targetEmail = email.toString().trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var recordEmail = (row[1] || '').toString().trim().toLowerCase();
    if (recordEmail === targetEmail) {
      return {
        name: row[0] || '',
        email: recordEmail,
        role: normalizeRole(row[2])
      };
    }
  }
  return null;
}

// -----------------------------------------------------------------
// 🖥️ دوال عرض الواجهة (HTML) - حارس البوابة
// -----------------------------------------------------------------


function doGet(e) {
  var authState = resolveAuthorizedUser();

  if (authState.status === 'unauthenticated') {
    return renderAuthRequiredPage();
  }

  if (authState.status === 'unauthorized') {
    return renderUnauthorizedPage(authState.email);
  }

  var user = authState.user;
  var userRole = user.role || '';
  var userEmail = user.email || '';
  var userName = user.name || '';
  var requestedPage = (e && e.parameter && e.parameter.page)
    ? e.parameter.page.toString()
    : '';
  var page = requestedPage || getDefaultPageForRole(userRole);

  if (page === 'login') {
    page = getDefaultPageForRole(userRole);
  }

  if (page === 'logout') {
    return renderLogoutPage(user);
  }

  if (!isPageAllowedForRole(page, userRole)) {
    var fallback = getDefaultPageForRole(userRole);
    var fallbackUrl = ScriptApp.getService().getUrl() + '?page=' + fallback;
    return HtmlService.createHtmlOutput(
      '<script>window.top.location.href = "' + fallbackUrl + '";</script>'
    );
  }

  var template = HtmlService.createTemplateFromFile(page);
  template.userRole = userRole;
  template.userEmail = userEmail;
  template.userName = userName;
  
  return template.evaluate()
    .setTitle("Reservation")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * [تُستدعى من HTML]
 * دالة مساعدة لتضمين ملفات (مثل style.html) داخل ملفات HTML أخرى.
 * @param {string} filename اسم الملف المراد تضمينه.
 * @returns {string} محتوى الملف.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// -----------------------------------------------------------------
// 📥 دوال جلب البيانات (Read Operations) مع الكاش
// -----------------------------------------------------------------

/**
 * يجلب قائمة الموردين (من الكاش أو الشيت).
 * @returns {Array<Array<string>>} قائمة الموردين.
 */
function getSuppliers() {
  var cached = cache.get(KEY_SUPPLIERS);
  if (cached != null) { 
    return JSON.parse(cached); 
  }
  
  var sheet = ss.getSheetByName("Suppliers");
  var data = sheet.getDataRange().getValues();
  data.shift(); // إزالة صف العناوين
  cache.put(KEY_SUPPLIERS, JSON.stringify(data), CACHE_DURATION);
  return data;
}

/**
 * يجلب قائمة العملاء (من الكاش أو الشيت).
 * @returns {Array<Array<string>>} قائمة العملاء.
 */
function getClients() {
  var cached = cache.get(KEY_CLIENTS);
  if (cached != null) { 
    return JSON.parse(cached); 
  }
  
  var sheet = ss.getSheetByName("Customers");
  var data = sheet.getDataRange().getValues();
  data.shift(); // إزالة صف العناوين
  cache.put(KEY_CLIENTS, JSON.stringify(data), CACHE_DURATION);
  return data;
}

/**
 * يجلب قائمة المدن (من الكاش أو الشيت).
 * @returns {Array<Array<string>>} قائمة المدن.
 */
function getCity() {
  var cached = cache.get(KEY_CITIES);
  if (cached != null) { 
    return JSON.parse(cached); 
  }

  var sheet = ss.getSheetByName("City");
  var data = sheet.getDataRange().getValues();
  data.shift(); // إزالة صف العناوين
  cache.put(KEY_CITIES, JSON.stringify(data), CACHE_DURATION);
  return data;
}

/**
 * [دالة مساعدة داخلية]
 * تجلب *جميع* الفنادق وتخزنها في الكاش.
 * @returns {Array<Array<string>>} جميع الفنادق.
 */
function getHotelsCache_() {
  var cached = cache.get(KEY_HOTELS);
  if (cached != null) { 
    return JSON.parse(cached); 
  }
  
  var sheet = ss.getSheetByName("Hotels");
  var data = sheet.getDataRange().getValues();
  data.shift(); // إزالة صف العناوين
  cache.put(KEY_HOTELS, JSON.stringify(data), CACHE_DURATION);
  return data;
}

/**
 * يجلب الفنادق بناءً على المدينة (باستخدام الكاش).
 * @param {string} city اسم المدينة للفلترة.
 * @returns {Array<string>} قائمة بأسماء الفنادق المفلترة.
 */
function getHotelsByCity(city) {
  var allHotels = getHotelsCache_(); // جلب كل الفنادق (سريع)
  
  // فلترة الفنادق باستخدام JavaScript
  var filteredHotels = allHotels.filter(function(row) {
    return row[1] == city; // افترض أن العمود 1 هو المدينة
  }).map(function(row) {
    return row[0]; // افترض أن العمود 0 هو اسم الفندق
  });
  
  return filteredHotels;
}

/**
 * إرجاع خيارات نماذج إضافة العملاء (مدن + جنسيات).
 * @returns {{nationalities:Array, cities:Array}}
 */
function getClientFormLookups() {
  var response = {
    nationalities: [],
    cities: []
  };

  try {
    response.nationalities = getColumnByName('NATIONALITY') || [];
  } catch (err) {
    Logger.log('تعذر تحميل قائمة الجنسيات: ' + err);
  }

  try {
    response.cities = getCity() || [];
  } catch (cityErr) {
    Logger.log('تعذر تحميل قائمة المدن: ' + cityErr);
  }

  return response;
}

/**
 * إرجاع خيارات نموذج إضافة الفنادق (مدن متاحة).
 * @returns {{cities:Array}}
 */
function getHotelFormLookups() {
  var response = { cities: [] };
  try {
    response.cities = getCity() || [];
  } catch (err) {
    Logger.log('تعذر تحميل مدن الفنادق: ' + err);
  }
  return response;
}

/**
 * يجلب جميع الحجوزات (لصفحة الإدارة).
 * @returns {Array<Object>} مصفوفة من كائنات الحجوزات.
 */
function getReservations() {
  var cached = cache.get(KEY_RESERVATIONS);
  if (cached != null) { 
    return JSON.parse(cached); 
  }

  var sheet = ss.getSheetByName("Kiod");
  var data = sheet.getDataRange().getValues();
  var header = data.shift(); // أخذ العناوين

  // تحويل البيانات إلى كائنات (Objects) لسهولة التعامل (مهم لـ DataTables)
  var reservations = data.map(function(row) {
    var obj = {};
    header.forEach(function(columnName, index) {
      obj[columnName] = row[index];
    });
    return obj;
  });

  cache.put(KEY_RESERVATIONS, JSON.stringify(reservations), CACHE_DURATION);
  return reservations;
}

// -----------------------------------------------------------------
// 📤 دوال إضافة البيانات (Write Operations)
// -----------------------------------------------------------------

/**
 * إضافة حجز جديد وإرسال إيميل (اختياري).
 * @param {Object} bookingDetails كائن يحتوي على كل تفاصيل الحجز.
 * @param {string} emailAddress الإيميل المراد الإرسال إليه (أو "" لعدم الإرسال).
 * @param {string} notes ملاحظات إضافية للإيميل.
 * @returns {string} رسالة نجاح أو خطأ.
 */
function addNewBooking(bookingDetails, emailAddress, notes) {
  var sheet = ss.getSheetByName("Kiod");
  var bookingId = generateBookingId();
  
  // بناء الصف (تأكد من مطابقة الترتيب في الشيت)
  var newRow = [
    bookingId,
    bookingDetails.supplier,
    bookingDetails.supplierName,
    bookingDetails.supplierType,
    bookingDetails.supplierRef,
    bookingDetails.clientName,
    bookingDetails.clientPhone,
    bookingDetails.clientNationality,
    bookingDetails.adults,
    bookingDetails.children,
    bookingDetails.city,
    bookingDetails.hotel,
    bookingDetails.hotelRef,
    bookingDetails.roomType,
    bookingDetails.mealPlan,
    bookingDetails.checkIn,
    bookingDetails.checkOut,
    bookingDetails.nights,
    bookingDetails.notes // الملاحظات الأساسية
  ];
  
  sheet.appendRow(newRow);
  
  // *** مسح كاش الحجوزات ***
  // لأننا أضفنا حجراً جديداً، يجب مسح كاش الحجوزات
  cache.remove(KEY_RESERVATIONS);
  Logger.log("تم مسح كاش الحجوزات");

  // *** الإضافة الجديدة: إرسال الإيميل ***
  if (emailAddress && emailAddress !== "") {
    try {
      var subject = "تأكيد حجز رقم: " + bookingId;
      var body = "تم تأكيد الحجز بنجاح.\n\n" +
                 "رقم الحجز: " + bookingId + "\n" +
                 "اسم العميل: " + bookingDetails.clientName + "\n" +
                 "الفندق: " + bookingDetails.hotel + "\n" +
                 "تاريخ الوصول: " + bookingDetails.checkIn + "\n" +
                 "تاريخ المغادرة: " + bookingDetails.checkOut + "\n\n" +
                 "ملاحظات إضافية من الموظف: \n" + notes + "\n";

      MailApp.sendEmail(emailAddress, subject, body);
      return "تم إضافة الحجز بنجاح ID: " + bookingId + ". وتم إرسال الإيميل.";

    } catch (e) {
      Logger.log("فشل إرسال الإيميل: " + e.message);
      return "تم إضافة الحجز بنجاح، لكن فشل إرسال الإيميل: " + e.message;
    }
  }

  // إذا لم يتم إرسال إيميل
  return "تم إضافة الحجز بنجاح ID: " + bookingId;
}

/**
 * إضافة عميل جديد ومسح الكاش الخاص بالعملاء.
 * @param {Object} clientData كائن يحتوي على بيانات العميل.
 * @returns {string} رسالة نجاح.
 */
function addClient(clientData) {
  var sheet = ss.getSheetByName("Customers");
  sheet.appendRow([
    clientData.name,
    clientData.phone,
    clientData.nationality,
    clientData.email || '',
    clientData.city || '',
    clientData.notes || ''
  ]);
  
  cache.remove(KEY_CLIENTS);
  Logger.log("تم مسح كاش العملاء");
  
  return "Client added successfully";
}

/**
 * إضافة مورد جديد ومسح الكاش الخاص بالموردين.
 * @param {Object} supplierData كائن يحتوي على بيانات المورد.
 * @returns {string} رسالة نجاح.
 */
function addSupplier(supplierData) {
  var sheet = ss.getSheetByName("Suppliers");
  sheet.appendRow([supplierData.name, supplierData.type, supplierData.phone]);

  // *** مسح الكاش ***
  cache.remove(KEY_SUPPLIERS);
  Logger.log("تم مسح كاش الموردين");

  return "Supplier added successfully";
}

/**
 * إضافة فندق جديد ومسح الكاش الخاص بالفنادق.
 * @param {Object} hotelData كائن يحتوي على بيانات الفندق.
 * @returns {string} رسالة نجاح.
 */
function addHotel(hotelData) {
  var sheet = ss.getSheetByName("Hotels");
  sheet.appendRow([
    hotelData.name,
    hotelData.city,
    hotelData.category || '',
    hotelData.contact || '',
    hotelData.phone || '',
    hotelData.email || '',
    hotelData.notes || ''
  ]);

  cache.remove(KEY_HOTELS);
  Logger.log("تم مسح كاش الفنادق");

  return "Hotel added successfully";
}

// -----------------------------------------------------------------
// 🛠️ دوال مساعدة (Utilities)
// -----------------------------------------------------------------

/**
 * إنشاء رقم حجز تسلسلي (آمن ضد التضارب).
 * @returns {string} رقم الحجز الجديد (مثل: BK-25-101).
 */
function generateBookingId() {
  var counterSheet = ss.getSheetByName("Counter");
  
  // استخدام LockService لضمان عدم تضارب الأرقام إذا ضغط مستخدمان في نفس اللحظة
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // الانتظار 30 ثانية كحد أقصى

  try {
    var lastIdCell = counterSheet.getRange("A1");
    var lastId = lastIdCell.getValue();
    var newId = (lastId || 0) + 1; // معالجة إذا كانت الخلية فارغة
    lastIdCell.setValue(newId);
    
    var year = new Date().getFullYear().toString().substr(-2); // آخر رقمين من السنة
    return "BK-" + year + "-" + newId;

  } finally {
    lock.releaseLock(); // تحرير القفل دائماً
  }
}

/**
 * يحسب لوحات التحكم الخاصة بالإحصائيات مباشرةً من شيت DATABASE.
 * @param {string} startDate تاريخ البداية (yyyy-MM-dd).
 * @param {string} endDate تاريخ النهاية (yyyy-MM-dd).
 * @param {string} bookingId فلترة اختيارية برقم الحجز.
 * @returns {Object} كائن يحتوي على جميع الأقسام المطلوبة للواجهة.
 */
function getCompleteAnalytics(startDate, endDate, bookingId) {
  var sheet = ss.getSheetByName("DATABASE");
  if (!sheet) {
    return {};
  }

  var rows = sheet.getDataRange().getValues();
  if (!rows || rows.length <= 1) {
    return {};
  }

  // إزالة صف العناوين
  rows.shift();

  var start = parseFilterDate(startDate, true);
  var end = parseFilterDate(endDate, false);
  var bookingSearch = (bookingId || "").toString().trim().toLowerCase();

  var COL = {
    ID: 0,
    SELLER: 1,
    SUPPLIER: 2,
    NATIONALITY: 5,
    PERSON_COUNT: 6,
    CITY: 7,
    HOTEL: 8,
    CHECKIN: 10,
    CHECKOUT: 11,
    ROOM_TYPE: 13,
    MEAL: 15,
    HOTEL_EURO_PRICE: 17,
    SELLING_PRICE: 18,
    SELLING_EURO_PRICE: 19,
    CURRENCY: 20,
    ARRIVED_EURO_AMOUNT: 25,
    REMAINING_EURO_AMOUNT: 31,
    SERVICE_EURO_PRICE: 38,
    SERVICE_SELLING_EURO_PRICE: 40
  };

  var filteredRows = rows.filter(function (row) {
    var matchesId = bookingSearch
      ? ((row[COL.ID] || "").toString().toLowerCase().indexOf(bookingSearch) !== -1)
      : true;

    if (!matchesId) {
      return false;
    }

    var checkInDate = parseSheetDate(row[COL.CHECKIN]);
    if (start && (!checkInDate || checkInDate < start)) {
      return false;
    }
    if (end && (!checkInDate || checkInDate > end)) {
      return false;
    }
    return true;
  });

  if (!filteredRows.length) {
    return {};
  }

  var analytics = {
    financial: {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      profitMargin: 0,
      totalBookings: 0,
      paidBookings: 0,
      partiallyPaidBookings: 0,
      unpaidBookings: 0,
      totalCommission: 0,
      currencyRevenue: {},
      monthlyRevenue: {}
    },
    location: {
      cityAnalytics: {},
      hotelAnalytics: {},
      nationalityAnalytics: {}
    },
    sales: {},
    roomMeal: {
      roomTypeAnalytics: {},
      mealAnalytics: {}
    },
    lastUpdated: ""
  };

  filteredRows.forEach(function (row) {
    var bookingRevenue = toNumber(row[COL.SELLING_EURO_PRICE]);
    var bookingCost = toNumber(row[COL.HOTEL_EURO_PRICE]);
    var commission = Math.max(
      0,
      toNumber(row[COL.SERVICE_SELLING_EURO_PRICE]) - toNumber(row[COL.SERVICE_EURO_PRICE])
    );
    var remainingEuro = toNumber(row[COL.REMAINING_EURO_AMOUNT]);
    var paidEuro = toNumber(row[COL.ARRIVED_EURO_AMOUNT]);
    var city = (row[COL.CITY] || "غير محدد").toString().trim();
    var hotel = (row[COL.HOTEL] || "غير محدد").toString().trim();
    var nationality = (row[COL.NATIONALITY] || "غير محدد").toString().trim();
    var seller = (row[COL.SELLER] || "غير محدد").toString().trim();
    var roomType = (row[COL.ROOM_TYPE] || "غير محدد").toString().trim();
    var meal = (row[COL.MEAL] || "غير محدد").toString().trim();
    var currency = (row[COL.CURRENCY] || "EUR").toString().trim().toUpperCase();
    var localPrice = toNumber(row[COL.SELLING_PRICE]);
    var guests = parseInt(row[COL.PERSON_COUNT], 10) || 0;
    var checkInDate = parseSheetDate(row[COL.CHECKIN]);
    var monthKey = checkInDate
      ? Utilities.formatDate(checkInDate, Session.getScriptTimeZone(), "yyyy-MM")
      : "غير محدد";

    analytics.financial.totalRevenue += bookingRevenue;
    analytics.financial.totalCost += bookingCost;
    analytics.financial.totalCommission += commission;
    analytics.financial.totalBookings += 1;
    analytics.financial.currencyRevenue[currency] = (analytics.financial.currencyRevenue[currency] || 0) + localPrice;
    analytics.financial.monthlyRevenue[monthKey] = (analytics.financial.monthlyRevenue[monthKey] || 0) + bookingRevenue;

    if (remainingEuro <= 0 && bookingRevenue > 0) {
      analytics.financial.paidBookings += 1;
    } else if (paidEuro > 0 && remainingEuro > 0) {
      analytics.financial.partiallyPaidBookings += 1;
    } else {
      analytics.financial.unpaidBookings += 1;
    }

    if (!analytics.location.cityAnalytics[city]) {
      analytics.location.cityAnalytics[city] = { bookings: 0, revenue: 0, guests: 0 };
    }
    analytics.location.cityAnalytics[city].bookings += 1;
    analytics.location.cityAnalytics[city].revenue += bookingRevenue;
    analytics.location.cityAnalytics[city].guests += guests;

    if (!analytics.location.hotelAnalytics[hotel]) {
      analytics.location.hotelAnalytics[hotel] = { bookings: 0, revenue: 0, guests: 0 };
    }
    analytics.location.hotelAnalytics[hotel].bookings += 1;
    analytics.location.hotelAnalytics[hotel].revenue += bookingRevenue;
    analytics.location.hotelAnalytics[hotel].guests += guests;

    if (!analytics.location.nationalityAnalytics[nationality]) {
      analytics.location.nationalityAnalytics[nationality] = { bookings: 0, revenue: 0 };
    }
    analytics.location.nationalityAnalytics[nationality].bookings += 1;
    analytics.location.nationalityAnalytics[nationality].revenue += bookingRevenue;

    if (!analytics.sales[seller]) {
      analytics.sales[seller] = { bookings: 0, revenue: 0, cost: 0, profit: 0, avgBookingValue: 0 };
    }
    analytics.sales[seller].bookings += 1;
    analytics.sales[seller].revenue += bookingRevenue;
    analytics.sales[seller].cost += bookingCost;
    analytics.sales[seller].profit = analytics.sales[seller].revenue - analytics.sales[seller].cost;

    if (!analytics.roomMeal.roomTypeAnalytics[roomType]) {
      analytics.roomMeal.roomTypeAnalytics[roomType] = { bookings: 0 };
    }
    analytics.roomMeal.roomTypeAnalytics[roomType].bookings += 1;

    if (!analytics.roomMeal.mealAnalytics[meal]) {
      analytics.roomMeal.mealAnalytics[meal] = { bookings: 0 };
    }
    analytics.roomMeal.mealAnalytics[meal].bookings += 1;
  });

  analytics.financial.totalProfit = analytics.financial.totalRevenue - analytics.financial.totalCost;
  analytics.financial.profitMargin = analytics.financial.totalRevenue > 0
    ? Math.round((analytics.financial.totalProfit / analytics.financial.totalRevenue) * 1000) / 10
    : 0;

  Object.keys(analytics.sales).forEach(function (sellerKey) {
    var sellerData = analytics.sales[sellerKey];
    sellerData.avgBookingValue = sellerData.bookings > 0
      ? Math.round((sellerData.revenue / sellerData.bookings) * 100) / 100
      : 0;
  });

  analytics.lastUpdated = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  return analytics;
}

function toNumber(value) {
  if (value === null || value === "" || typeof value === "undefined") {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  var parsed = parseFloat(value.toString().replace(/[^\d\.\-]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function parseSheetDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseFilterDate(value, isStartOfDay) {
  if (!value) {
    return null;
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  if (isStartOfDay) {
    parsed.setHours(0, 0, 0, 0);
  } else {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}
