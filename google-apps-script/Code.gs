// Replace this ID with your Google Sheet ID
const SPREADSHEET_ID = '1g34x7MaghqUkArBC0mMMzqelNkZ_pr3TkQY7-qSNAO8';  // Study Room Management Sheet

// Utility functions
function getSheetData(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);
  const [headers, ...data] = sheet.getDataRange().getValues();
  console.log(`Sheet ${sheetName} headers:`, JSON.stringify(headers));
  
  // Log first row of data to see raw values
  if (data.length > 0) {
    console.log(`First row of data:`, JSON.stringify(data[0]));
  }
  
  return data.map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

// Web app endpoints
function doGet(e) {
  const { parameter } = e;
  const { action } = parameter;
  
  console.log('Received request with action:', action);
  
  try {
    console.log('Opening spreadsheet with ID:', SPREADSHEET_ID);
    // Test if we can access the spreadsheet
    const test = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Successfully opened spreadsheet');
    
    switch(action) {
      case 'getStudents':
        return sendResponse(getStudents());
      case 'getStudent':
        return sendResponse(getStudent(parameter.seatNumber));
      case 'getPayments':
        return sendResponse(getPayments(parameter.seatNumber));
      case 'getExpenses':
        return sendResponse(getExpenses());
      case 'addExpense':
        return sendResponse(addExpense(parameter));
      case 'getColumns':
        return sendResponse(getSheetColumns());
      case 'addPayment':
        return sendResponse(addPayment(parameter));
      case 'addRefund':
        return sendResponse(addRefund(parameter));
      case 'extendMembership':
        return sendResponse(extendMembership(parameter));
      case 'deleteStudent':
        return sendResponse(deleteStudent(parameter));
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    return sendResponse({ error: error.message }, 400);
  }
}

function doPost(e) {
  const { parameter, postData } = e;
  const { action } = parameter;
  
  console.log('POST request received with action:', action);
  console.log('Post data:', postData.contents);
  
  try {
    let data;
    if (postData && postData.contents) {
      try {
        data = JSON.parse(postData.contents);
      } catch (parseError) {
        // If JSON parsing fails, try to get data from parameters
        data = parameter;
      }
    } else {
      data = parameter;
    }
    
    console.log('Parsed data:', data);
    
    switch(action) {
      case 'addPayment':
        return sendResponse(addPayment(data));
      case 'addRefund':
        return sendResponse(addRefund(data));
      case 'addExpense':
        return sendResponse(addExpense(data));
      case 'extendMembership':
        return sendResponse(extendMembership(data));
      case 'updateStudent':
        return sendResponse(updateStudent(data));
      case 'deleteStudent':
        return sendResponse(deleteStudent(data));
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return sendResponse({ error: error.message }, 400);
  }
}

function sendResponse(data, code = 200) {
  return ContentService
    .createTextOutput(JSON.stringify({ data, code }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Business logic
function getStudents() {
  console.log('Getting students data');
  const students = getSheetData('Library Members');
  console.log('Found students:', students.length);
  // Log the first student to check the field names
  if (students.length > 0) {
    console.log('First student raw data:', JSON.stringify(students[0]));
    
    // Test accessing specific fields to verify names
    const firstStudent = students[0];
    console.log('Checking field access:', {
      'Seat_Number exists': 'Seat_Number' in firstStudent,
      'seat_number exists': 'seat_number' in firstStudent,
      'Contact_Number exists': 'Contact_Number' in firstStudent,
      'contact_number exists': 'contact_number' in firstStudent,
      'Raw Seat Number value': firstStudent['Seat_Number'],
      'Raw Contact Number value': firstStudent['Contact_Number'],
    });
  }
  
  // Filter out removed students and map to standard format
  return students
    .filter(student => {
      const status = student.Membership_Status || student.membershipStatus || student.Status;
      return status !== 'Removed';
    })
    .map(student => ({
      id: student.ID || student.id,
      seatNumber: student['Seat Number'] || student.Seat_Number || student.seat_number || student.SeatNumber || student.seatNumber,
      name: student.Name_Student || student.name || student.Name || student.StudentName,
      contact: student['Contact Number'] || student.Contact_Number || student.contact || student.ContactNumber || student.Phone,
      sex: student.Sex || student.sex || student.Gender,
      membershipStartDate: student.Membership_Date || student.membershipStartDate || student.StartDate,
      lastPaymentDate: student.Last_Payment_date || student.lastPaymentDate,
      totalPaid: student.Total_Paid || student.totalPaid,
      membershipTill: student.Membership_Till || student.membershipTill,
      membershipStatus: student.Membership_Status || student.membershipStatus || student.Status
    }));
}

function getSheetColumns() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('Library Members');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  return {
    sheetName: 'Library Members',
    columns: headers,
    totalColumns: headers.length
  };
}

function getStudent(seatNumber) {
  const students = getStudents();
  const student = students.find(s => String(s.seatNumber) === String(seatNumber));
  
  if (!student) throw new Error('Student not found');
  
  // Get additional info from ID info sheet
  const idInfo = getSheetData('ID info');
  const extraInfo = idInfo.find(info => String(info.ID) === String(student.id));
  
  // Get payment history
  const renewals = getSheetData('Renewals');
  const payments = renewals
    .filter(renewal => String(renewal.Seat_Number) === String(seatNumber))
    .map(payment => ({
      amount: payment.Amount_paid,
      date: payment.Payment_date,
      paymentMode: payment.Payment_mode
    }));
  
  return {
    ...student,
    fatherName: student.Father_Name || extraInfo?.Father_Name || '',
    payments
  };
}

function getPayments(seatNumber = null) {
  console.log('Getting payments, seatNumber filter:', seatNumber);
  const renewals = getSheetData('Renewals');
  const students = getSheetData('Library Members');
  
  let payments = renewals.map(renewal => {
    // Find student details for this payment
    const student = students.find(s => {
      const studentSeatNumber = s['Seat Number'] || s.Seat_Number || s.seat_number || s.SeatNumber || s.seatNumber;
      const renewalSeatNumber = renewal.Seat_Number || renewal['Seat Number'];
      return String(studentSeatNumber) === String(renewalSeatNumber);
    });
    
    return {
      id: renewal.ID,
      seatNumber: renewal.Seat_Number || renewal['Seat Number'],
      amount: renewal.Amount_paid || renewal['Amount paid'],
      date: renewal.Payment_date || renewal['Payment date'],
      paymentMode: renewal.Payment_mode || renewal['Payment mode'] || 'Cash',
      // Add student details
      studentId: student?.ID || student?.id || 'N/A',
      studentName: student?.Name_Student || student?.name || student?.Name || student?.StudentName || 'N/A',
      contact: student?.['Contact Number'] || student?.Contact_Number || student?.contact || student?.ContactNumber || student?.Phone || 'N/A'
    };
  });
  
  // Filter by seat number if provided
  if (seatNumber) {
    payments = payments.filter(payment => 
      String(payment.seatNumber) === String(seatNumber)
    );
    console.log(`Found ${payments.length} payments for seat ${seatNumber}`);
  }
  
  return payments;
}

function addPayment(paymentData) {
  const { seatNumber, amount, date, paymentMode } = paymentData;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Renewals');
  
  // Get Student ID from Library Members sheet
  const studentsData = getSheetData('Library Members');
  const student = studentsData.find(s => {
    const studentSeatNumber = s['Seat Number'] || s.Seat_Number || s.seat_number || s.SeatNumber || s.seatNumber;
    return String(studentSeatNumber) === String(seatNumber);
  });
  const studentId = student ? (student.ID || student.id) : null;
  
  // Get next ID
  const renewals = getSheetData('Renewals');
  const nextId = Math.max(...renewals.map(r => r.ID || 0), 0) + 1;
  
  // Add payment to Renewals sheet with Student ID
  sheet.appendRow([nextId, seatNumber, amount, date, paymentMode, studentId]);
  
  // Update Library Members sheet
  updateStudentPaymentInfo(seatNumber, amount, date);
  
  return { success: true };
}

function updateStudentPaymentInfo(seatNumber, amount, date) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Library Members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const seatNumIndex = headers.indexOf('Seat Number') !== -1 ? headers.indexOf('Seat Number') : headers.indexOf('Seat_Number');
  const totalPaidIndex = headers.indexOf('Total_Paid');
  const lastPaymentIndex = headers.indexOf('Last_Payment_date');
  const membershipTillIndex = headers.indexOf('Membership_Till');
  const statusIndex = headers.indexOf('Membership_Status');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      const currentTotal = data[i][totalPaidIndex] || 0;
      
      // Update total paid
      sheet.getRange(row, totalPaidIndex + 1).setValue(currentTotal + Number(amount));
      
      // Update last payment date
      sheet.getRange(row, lastPaymentIndex + 1).setValue(date);
      
      // Update membership till date (assuming 1 month extension per payment)
      const currentMembershipTill = new Date(data[i][membershipTillIndex] || date);
      const newMembershipTill = new Date(currentMembershipTill);
      newMembershipTill.setMonth(newMembershipTill.getMonth() + 1);
      sheet.getRange(row, membershipTillIndex + 1).setValue(newMembershipTill);
      
      break;
    }
  }
}

function updateStudent(studentData) {
  console.log('Updating student with data:', studentData);
  const { seatNumber, name, contact, sex, membershipStatus } = studentData;
  
  if (!seatNumber) {
    throw new Error('Seat number is required for student update');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Library Members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  console.log('Headers:', headers);
  
  // Find column indices
  const seatNumIndex = headers.indexOf('Seat Number') !== -1 ? headers.indexOf('Seat Number') : headers.indexOf('Seat_Number');
  const nameIndex = headers.indexOf('Name_Student') !== -1 ? headers.indexOf('Name_Student') : 
                    headers.indexOf('Name') !== -1 ? headers.indexOf('Name') : -1;
  const contactIndex = headers.indexOf('Contact Number') !== -1 ? headers.indexOf('Contact Number') : 
                       headers.indexOf('Contact_Number') !== -1 ? headers.indexOf('Contact_Number') : -1;
  const sexIndex = headers.indexOf('Sex') !== -1 ? headers.indexOf('Sex') : -1;
  const statusIndex = headers.indexOf('Membership_Status') !== -1 ? headers.indexOf('Membership_Status') : -1;
  
  console.log('Column indices:', { seatNumIndex, nameIndex, contactIndex, sexIndex, statusIndex });
  
  // Find the student row
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      console.log('Found student at row:', row);
      
      // Update fields if they exist and values are provided
      if (nameIndex !== -1 && name) {
        sheet.getRange(row, nameIndex + 1).setValue(name);
      }
      if (contactIndex !== -1 && contact) {
        sheet.getRange(row, contactIndex + 1).setValue(contact);
      }
      if (sexIndex !== -1 && sex) {
        sheet.getRange(row, sexIndex + 1).setValue(sex);
      }
      if (statusIndex !== -1 && membershipStatus) {
        sheet.getRange(row, statusIndex + 1).setValue(membershipStatus);
      }
      
      console.log('Student updated successfully');
      return { success: true, message: 'Student updated successfully' };
    }
  }
  
  throw new Error('Student not found with seat number: ' + seatNumber);
}

function getExpenses() {
  const expenses = getSheetData('Electricity and Rent');
  return expenses.map(expense => ({
    id: expense['ID'] || expense.id,
    date: expense['Date'],
    type: expense['Type'],
    description: expense['Description'],
    amount: expense['Amount']
  }));
}

function addExpense(expenseData) {
  const { date, type, description, amount } = expenseData;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Electricity and Rent');
  
  // Get next ID
  const expenses = getSheetData('Electricity and Rent');
  const nextId = Math.max(...expenses.map(e => e.ID || e.id || 0), 0) + 1;
  
  // Add expense to sheet
  sheet.appendRow([nextId, date, type, description, Number(amount)]);
  
  return { 
    success: true, 
    message: 'Expense added successfully',
    expense: {
      id: nextId,
      date,
      type,
      description,
      amount: Number(amount)
    }
  };
}

function addRefund(refundData) {
  const { seatNumber, amount, date, paymentMode } = refundData;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Renewals');
  
  // Get Student ID from Library Members sheet
  const studentsData = getSheetData('Library Members');
  const student = studentsData.find(s => {
    const studentSeatNumber = s['Seat Number'] || s.Seat_Number || s.seat_number || s.SeatNumber || s.seatNumber;
    return String(studentSeatNumber) === String(seatNumber);
  });
  const studentId = student ? (student.ID || student.id) : null;
  
  // Get next ID
  const renewals = getSheetData('Renewals');
  const nextId = Math.max(...renewals.map(r => r.ID || 0), 0) + 1;
  
  // Add refund to Renewals sheet (negative amount) with Student ID
  sheet.appendRow([nextId, seatNumber, -Math.abs(amount), date, paymentMode, studentId]);
  
  // Update Library Members sheet (subtract from total)
  updateStudentRefundInfo(seatNumber, amount, date);
  
  return { success: true };
}

function extendMembership(extensionData) {
  const { seatNumber, months, date, reason } = extensionData;
  
  if (!seatNumber || !months) {
    throw new Error('Seat number and extension months are required');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Library Members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const seatNumIndex = headers.indexOf('Seat Number') !== -1 ? headers.indexOf('Seat Number') : headers.indexOf('Seat_Number');
  const membershipTillIndex = headers.indexOf('Membership_Till');
  const lastPaymentIndex = headers.indexOf('Last_Payment_date');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      
      // Get current membership till date or use provided date
      const currentMembershipTill = data[i][membershipTillIndex] ? 
        new Date(data[i][membershipTillIndex]) : 
        new Date(date);
      
      // Extend membership by specified months
      const newMembershipTill = new Date(currentMembershipTill);
      newMembershipTill.setMonth(newMembershipTill.getMonth() + Number(months));
      
      // Update membership till date
      sheet.getRange(row, membershipTillIndex + 1).setValue(newMembershipTill);
      
      // Update last payment date to track when extension was made
      if (lastPaymentIndex !== -1) {
        sheet.getRange(row, lastPaymentIndex + 1).setValue(date);
      }
      
      console.log(`Membership extended for seat ${seatNumber} by ${months} months until ${newMembershipTill}`);
      return { 
        success: true, 
        message: `Membership extended by ${months} months until ${newMembershipTill.toLocaleDateString()}`,
        newMembershipTill: newMembershipTill
      };
    }
  }
  
  throw new Error('Student not found with seat number: ' + seatNumber);
}

function updateStudentRefundInfo(seatNumber, amount, date) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Library Members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const seatNumIndex = headers.indexOf('Seat Number') !== -1 ? headers.indexOf('Seat Number') : headers.indexOf('Seat_Number');
  const totalPaidIndex = headers.indexOf('Total_Paid');
  const lastPaymentIndex = headers.indexOf('Last_Payment_date');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      const currentTotal = data[i][totalPaidIndex] || 0;
      
      // Update total paid (subtract refund amount)
      sheet.getRange(row, totalPaidIndex + 1).setValue(Math.max(0, currentTotal - Number(amount)));
      
      // Update last payment date
      sheet.getRange(row, lastPaymentIndex + 1).setValue(date);
      
      break;
    }
  }
}

function deleteStudent(studentData) {
  const { seatNumber } = studentData;
  
  if (!seatNumber) {
    throw new Error('Seat number is required for student deletion');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Library Members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const seatNumIndex = headers.indexOf('Seat Number') !== -1 ? headers.indexOf('Seat Number') : headers.indexOf('Seat_Number');
  const statusIndex = headers.indexOf('Membership_Status') !== -1 ? headers.indexOf('Membership_Status') : -1;
  
  // Find and mark the student as "Removed"
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      
      if (statusIndex !== -1) {
        sheet.getRange(row, statusIndex + 1).setValue('Removed');
      } else {
        throw new Error('Membership_Status column not found');
      }
      
      console.log('Student marked as removed successfully at row:', row);
      return { success: true, message: 'Student marked as removed successfully' };
    }
  }
  
  throw new Error('Student not found with seat number: ' + seatNumber);
}

function deleteStudentPayments(seatNumber) {
  // This function is no longer used since we mark students as "Removed" instead of deleting them
  // Keeping it for potential future use
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Renewals');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const seatNumIndex = headers.indexOf('Seat_Number') !== -1 ? headers.indexOf('Seat_Number') : headers.indexOf('Seat Number');
  
  // Delete rows from bottom to top to avoid index shifting issues
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][seatNumIndex]) === String(seatNumber)) {
      const row = i + 1;
      sheet.deleteRow(row);
    }
  }
}
