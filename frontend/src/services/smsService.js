import {
  getUtcMidnightForDateInTZ,
  getTodayUtcMidnightInTZ,
  MS_PER_DAY,
  formatIsoToDMonYYYY,
} from '../utils/dateUtils';

// Validates a 10-digit Indian mobile number (starts with 6–9)
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits);
};

// Builds an sms: URL for the native SMS app
export const buildSmsUrl = (phone, message) => {
  const digits = String(phone).replace(/\D/g, '');
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
};

// Message for a student whose membership is expiring soon
export const buildExpiringMessage = (student) => {
  const firstName = (student.name || 'Student').split(' ')[0];
  const expiryDate = formatIsoToDMonYYYY(student.membership_till) || 'soon';
  return `Dear ${firstName}, your library membership is expiring on ${expiryDate}. Please renew your membership to continue using the library.`;
};

// Message for a student whose membership has already expired
export const buildExpiredMessage = (student) => {
  const firstName = (student.name || 'Student').split(' ')[0];
  return `Dear ${firstName}, your library membership has expired. Please renew your membership at the earliest to continue using the library.`;
};

// Mirrors the getStats() expiring-students filter in Students.jsx exactly.
// activeStudents = membership_status !== 'inactive' (not just === 'active').
export const filterExpiringStudents = (students) => {
  const todayUtcMs = getTodayUtcMidnightInTZ();
  const sevenDaysFromNowUtcMs = todayUtcMs + 7 * MS_PER_DAY;
  return (students || [])
    .filter((s) => s && s.membership_status !== 'inactive')
    .filter((s) => {
      if (!s.membership_till) return false;
      const ms = getUtcMidnightForDateInTZ(s.membership_till);
      return ms ? ms > todayUtcMs && ms <= sevenDaysFromNowUtcMs : false;
    });
};

// Mirrors the getStats() expired-students filter in Students.jsx exactly.
export const filterExpiredStudents = (students) => {
  const todayUtcMs = getTodayUtcMidnightInTZ();
  return (students || [])
    .filter((s) => s && s.membership_status !== 'inactive')
    .filter((s) => {
      if (!s.membership_till) return true;
      const ms = getUtcMidnightForDateInTZ(s.membership_till);
      return ms ? ms < todayUtcMs : true;
    });
};
