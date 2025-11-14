

// -----------------------------------------------------------------
// ⚙️ الإعدادات العامة والمتغيرات الثابتة
// -----------------------------------------------------------------

// !! هام جداً: ID ملف Google Sheet
var SPREADSHEET_ID = '1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q'; 
var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
var cache = CacheService.getScriptCache();

// مدة التخزين بالثواني (3600 = 1 ساعة)
var CACHE_DURATION = 3600; 
var SESSION_DURATION = 3600; // مدة بقاء المستخدم مسجلاً

// مفاتيح الكاش (لتنظيمها)
var KEY_SUPPLIERS = 'suppliers_data';
var KEY_CLIENTS = 'clients_data';
var KEY_CITIES = 'city_data';
var KEY_HOTELS = 'hotels_data';
var KEY_RESERVATIONS = 'reservations_data';
var KEY_USER_ROLE = 'user_role'; // كاش خاص بجلسة المستخدم

// -----------------------------------------------------------------
// 🔒 دوال الأمان وتسجيل الدخول
// -----------------------------------------------------------------

/**
 * [يتم تشغيلها يدوياً]
 * تقوم بإنشاء وتخزين كلمات المرور بشكل آمن.
 * !! قم بتشغيل هذه الدالة مرة واحدة فقط من المحرر.
 */
function setupPasswords() {
  var properties = PropertiesService.getScriptProperties();
  
  // !! غيّر كلمات المرور هذه إلى كلمات مرور قوية
  properties.setProperty('ADMIN_PASSWORD', 'AdminPass123!');
  properties.setProperty('USER_PASSWORD', 'UserPass456');
  
  Logger.log("تم تعيين كلمات المرور بنجاح.");
}

/**
 * [تعمل داخلياً]
 * تتحقق من الكاش لمعرفة إذا كان المستخدم لديه جلسة صالحة.
 * @returns {string | null} ترجع 'admin', 'user', أو null إذا لم يكن مسجلاً.
 */
function checkAuthStatus() {
  var cache = CacheService.getScriptCache();
  var role = cache.get(KEY_USER_ROLE);
  return role;
}

/**
 * [تُستدعى من login.html]
 * تتحقق من كلمة المرور المدخلة وتخزن الجلسة في الكاش.
 * @param {string} password كلمة المرور التي أدخلها المستخدم.
 * @returns {boolean} ترجع true إذا نجح الدخول, و false إذا فشل.
 */
function doLogin(password) {
  var properties = PropertiesService.getScriptProperties();
  var adminPass = properties.getProperty('ADMIN_PASSWORD');
  var userPass = properties.getProperty('USER_PASSWORD');
  var cache = CacheService.getScriptCache();

  if (password === adminPass) {
    // نجح كـ Admin
    cache.put(KEY_USER_ROLE, 'admin', SESSION_DURATION);
    return true;
  } else if (password === userPass) {
    // نجح كـ User
    cache.put(KEY_USER_ROLE, 'user', SESSION_DURATION);
    return true;
  }
  
  // فشل تسجيل الدخول
  return false;
}

/**
 * [تُستدعى من الرابط ?page=logout]
 * تقوم بمسح جلسة المستخدم من الكاش وإعادة توجيهه لصفحة الدخول.
 * @returns {HtmlOutput} صفحة HTML تقوم بإعادة التوجيه.
 */
function doLogout() {
  var cache = CacheService.getScriptCache();
  cache.remove(KEY_USER_ROLE);
  Logger.log("تم تسجيل الخروج ومسح الجلسة");
  
  // إعادة توجيه المستخدم لصفحة الدخول
  var redirectUrl = ScriptApp.getService().getUrl() + '?page=login';
  return HtmlService.createHtmlOutput(
    '<script>window.top.location.href = "' + redirectUrl + '";</script>'
  );
}

// -----------------------------------------------------------------
// 🖥️ دوال عرض الواجهة (HTML) - حارس البوابة
// -----------------------------------------------------------------


function doGet(e) {
  var role = checkAuthStatus();

  // --------------------------------------------------------------------------
  // !! السطر الأهم !!
  // الصفحة الافتراضية هي 'login'.
  // هذا هو "المفتاح" الذي يجعل التوجيه إلى 'index' يعمل.
  // --------------------------------------------------------------------------
  var page = e.parameter.page || 'login';

  // 1. إذا لم يكن مسجلاً (لا يوجد دور)، أظهِر صفحة الدخول
  if (role == null) {
    // إذا كان يحاول الوصول لصفحة الدخول، اعرضها
    if (page === 'login') {
      return HtmlService.createTemplateFromFile('login').evaluate().setTitle("Login"); // (تم تصحيح العنوان)
    }
    // إذا حاول الوصول لأي صفحة أخرى (مثل index)، أعد توجيهه لصفحة الدخول
    var loginUrl = ScriptApp.getService().getUrl() + '?page=login';
    return HtmlService.createHtmlOutput(
      '<script>window.top.location.href = "' + loginUrl + '";</script>'
    );
  }

  // 2. إذا كان مسجلاً، تحقق من الصلاحيات
  
  // حماية صفحة الإحصائيات (manage-statistics)
  if (page === 'manage-statistics' && role !== 'admin') {
    // إذا كان "user" يحاول الوصول، امنعه
    var template = HtmlService.createTemplateFromFile('index'); // أو صفحة خطأ مخصصة
    template.errorMessage = 'ليس لديك صلاحية الوصول لهذه الصفحة';
    return template.evaluate().setTitle("Error").addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  // 3. إذا كان مسجلاً ولديه صلاحية (أو الصفحة لا تتطلب صلاحية admin)
  
  // !! هذا هو الكود الذي ينقلك إلى 'index' !!
  // إذا كان المستخدم مسجلاً (role != null) ويحاول فتح 'login' (وهي الافتراضية)
  // قم بإعادة توجيهه إلى 'index'.
  if (page === 'login') {
    var indexUrl = ScriptApp.getService().getUrl() + '?page=index';
    return HtmlService.createHtmlOutput(
      '<script>window.top.location.href = "' + indexUrl + '";</script>'
    );
  }
  
  // دالة تسجيل الخروج الخاصة
  if (page === 'logout') {
    return doLogout();
  }

  // اعرض الصفحة المطلوبة (مثل index.html, add-client.html, etc.)
  var template = HtmlService.createTemplateFromFile(page);
  template.userRole = role; // تمرير الصلاحية للصفحة
  template.userEmail = role; // لإصلاح خطأ ReferenceError من الكود القديم
  
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
  
  var sheet = ss.getSheetByName("Clients");
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
  var sheet = ss.getSheetByName("Clients");
  sheet.appendRow([clientData.name, clientData.phone, clientData.nationality]);
  
  // *** مسح الكاش ***
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
