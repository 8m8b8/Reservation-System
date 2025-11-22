function getCities() {
  var sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("CITIES");
  var cities = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  console.log(cities);
  return cities; // Returns an array of city names
}



function getColumnByName(columnName) {
  var sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("INFORMATION");
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  console.log(header);
  var columnIndex = header.indexOf(columnName) + 1; // +1 because getRange is 1-indexed
  var column = []; 

  if (columnIndex > 0) {
      var columnData = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1).getValues(); // Get hotel names below the city

      for (var i = 0; i < columnData.length; i++) {
          var columnN = columnData[i][0]; // Access the hotel name
          if (columnN) { // Check if the hotel name is not empty
              column.push(columnN); // Add non-empty hotel names to the array
          }
      }
  }
  console.log(column);
  return column; 
}

function getHotelsByCity(city) {
  var sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("CITIES");
  var cities = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columnIndex = cities.indexOf(city) + 1; // +1 because getRange is 1-indexed
  var hotels = []; // Initialize an empty array to store hotel names

  if (columnIndex > 0) {
      var hotelData = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1).getValues(); // Get hotel names below the city

      for (var i = 0; i < hotelData.length; i++) {
          var hotelName = hotelData[i][0]; // Access the hotel name
          if (hotelName) { // Check if the hotel name is not empty
              hotels.push(hotelName); // Add non-empty hotel names to the array
          }
      }
  }

  return hotels;
}

  function getCustomerDataById(customerId) {
    const sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("DATABASE");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == customerId) {

        if (data[i][10] instanceof Date) {
          data[i][10] = Utilities.formatDate(data[i][10], Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        if (data[i][11] instanceof Date) {
          data[i][11] = Utilities.formatDate(data[i][11], Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        if (data[i][44] instanceof Date) {
          data[i][44] = Utilities.formatDate(data[i][44], Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        if (data[i][46] instanceof Date) {
          data[i][46] = Utilities.formatDate(data[i][46], Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        console.log(data[i]);
        return data[i];
      }
    }
    console.log("Nothing here");
    return [];  // Return an empty array if the customer is not found
  }

  function getCustomerMapData(customerId) {
    const sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("DATABASE");
    const data = sheet.getDataRange().getValues();
    let customerData = null;
    for (let i = 1; i < data.length; i++) { // Assuming the first row is headers
      if (data[i][0] == customerId) {  // Check if the first column matches customerId
        customerData = {
            name: data[i][3],
            phone: data[i][4],
            person: data[i][6],
            city: data[i][7],
            hotel: data[i][8],
            hotelConfirmation: data[i][9],
            checkinDate: Utilities.formatDate(data[i][10], Session.getScriptTimeZone(), "yyyy-MM-dd"),
            checkoutDate: Utilities.formatDate(data[i][11], Session.getScriptTimeZone(), "yyyy-MM-dd"),
            roomCount: data[i][12],
            roomType: data[i][13],
            viewType: data[i][14],
            meals: data[i][15],
            sellinPrice: data[i][18],
            sellinEuroPrice: data[i][19],
            currency: data[i][20],
            arrivedAmount: data[i][24],
            arrivedEuroAmount: data[i][25],
            sendingCost: data[i][27],
            sendingEuroCost: data[i][28],
            arrivedAmountCurrency: data[i][29],
            remainingAmount: data[i][30],
            remainingEuroAmount: data[i][31],
            remainingAmountCurrency: data[i][32],
            service: data[i][36],
            servicePrice: data[i][37],
            serviceEuroPrice: data[i][38],
            serviceSellingPrice: data[i][39],
            serviceSellingEuroPrice: data[i][40],
            flowerGift: data[i][41],
        };
        break;
      }
    }
    console.log(customerData);
    return customerData;
  }

function getCustomers(searchTerm, pageNumber, checkInDate, checkOutDate) {
  var sheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q").getSheetByName("DATABASE");
  var data = sheet.getDataRange().getValues();
  var timezone = Session.getScriptTimeZone();
  var sanitizedSearch = (searchTerm || '').toString().trim().toLowerCase();
  var pageSize = PAGE_SIZE || 20;
  var page = parseInt(pageNumber, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  var startDate = checkInDate ? new Date(checkInDate) : null;
  var endDate = checkOutDate ? new Date(checkOutDate) : null;
  if (startDate && isNaN(startDate.getTime())) {
    startDate = null;
  }
  if (endDate && isNaN(endDate.getTime())) {
    endDate = null;
  }

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push(data[i]);
  }

  var filteredRows = rows.filter(function (row) {
    var checkinValue = parseSheetDate(row[10]);
    var checkoutValue = parseSheetDate(row[11]);
    var text = [
      row[0],
      row[3],
      row[4],
      row[7],
      row[8],
      row[9]
    ].join(' ').toString().toLowerCase();

    var matchesSearch = sanitizedSearch ? text.indexOf(sanitizedSearch) !== -1 : true;
    if (!matchesSearch) {
      return false;
    }

    if (startDate && (!checkinValue || checkinValue < startDate)) {
      return false;
    }
    if (endDate && (!checkoutValue || checkoutValue > endDate)) {
      return false;
    }

    return true;
  });

  var totalCount = filteredRows.length;
  var totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) {
    page = totalPages;
  }
  var startIndex = (page - 1) * pageSize;
  var pageRows = filteredRows.slice(startIndex, startIndex + pageSize);

  var customers = pageRows.map(function (row) {
    var checkinValue = parseSheetDate(row[10]);
    var checkoutValue = parseSheetDate(row[11]);
    return {
      id: row[0],
      name: row[3],
      phone: row[4],
      person: row[6],
      city: row[7],
      hotel: row[8],
      hotelConfirmation: row[9],
      checkinDate: checkinValue ? Utilities.formatDate(checkinValue, timezone, "yyyy-MM-dd") : '',
      checkoutDate: checkoutValue ? Utilities.formatDate(checkoutValue, timezone, "yyyy-MM-dd") : '',
      roomCount: row[12],
      roomType: row[13],
      viewType: row[14],
      meals: row[15],
      sellinPrice: row[18],
      sellinEuroPrice: row[19],
      currency: row[20],
      arrivedAmount: row[24],
      arrivedEuroAmount: row[25],
      sendingCost: row[27],
      sendingEuroCost: row[28],
      arrivedAmountCurrency: row[29],
      remainingAmount: row[30],
      remainingEuroAmount: row[31],
      remainingAmountCurrency: row[32],
      service: row[36],
      servicePrice: row[37],
      serviceEuroPrice: row[38],
      serviceSellingPrice: row[39],
      serviceSellingEuroPrice: row[40],
      flowerGift: row[41]
    };
  });

  return {
    data: customers,
    pagination: {
      page: page,
      totalPages: totalPages,
      pageSize: pageSize,
      totalCount: totalCount
    }
  };
}

function clearInvoice(){
  // Access Google Sheet and INVOICE sheet
  var myGooglSheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q");
  var invoiceSheet = myGooglSheet.getSheetByName("INVOICE");

  invoiceSheet.getRange("D10").setValue("");   // Customer name
  invoiceSheet.getRange("D11").setValue("");            // Customer phone

  invoiceSheet.getRange("A15:Z24").clearContent(); // Adjust column range as needed
  invoiceSheet.getRange("K26:K43").setValue("");     
  invoiceSheet.getRange("A34:Z37").clearContent(); // Adjust column range as needed
  invoiceSheet.getRange("G46:K46").clearContent();

}

function clearVoucher(){
  // Access Google Sheet and INVOICE sheet
  var myGooglSheet = SpreadsheetApp.openById("1Y5yMDhW9Lou2VY0zgsPqo7DDih66Qa4sfupI3cNV-0Q");
  var invoiceSheet = myGooglSheet.getSheetByName("VOUCHER");

  invoiceSheet.getRange("G3").setValue(""); 

  invoiceSheet.getRange("E11").setValue(""); 
  invoiceSheet.getRange("E13").setValue(""); 
  invoiceSheet.getRange("E15").setValue(""); 

  invoiceSheet.getRange("D18:D28").clearContent();
  invoiceSheet.getRange("G18:G28").clearContent();

  invoiceSheet.getRange("C32").setValue("");     

  
}

function getUrl() {
 var url = ScriptApp.getService().getUrl();
 return url;
}

function generateCustomUniqueId(prefix) {
  const date = new Date();
  date.setHours(date.getHours() + 3); // Add 3 hours to the current UTC time
  const year = String(date.getUTCFullYear()).slice(-2); // Last 2 digits of the year in UTC
  const month = String(date.getUTCMonth() + 1); // Month is 0-based
  const day = String(date.getUTCDate()); // Day of the month
  const hours = String(date.getUTCHours()); // Current hours in UTC
  const minutes = String(date.getUTCMinutes()); //
  // Manually pad month, day, and minutes with leading zeros if needed
  const paddedMonth = month.length < 2 ? '0' + month : month;
  const paddedDay = day.length < 2 ? '0' + day : day;
  const paddedHours = hours.length < 2 ? '0' + hours : hours;
  const paddedMinutes = minutes.length < 2 ? '0' + minutes : minutes;
  console.log(prefix + year + paddedMonth + paddedDay + paddedHours + paddedMinutes);

  // Construct the unique ID using concatenation
  return prefix + year + paddedMonth + paddedDay + paddedHours + paddedMinutes; // Regular concatenation
}

function include(fileName){
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

