// Frontend date utilities (timezone-aware for Asia/Kolkata)
// Export functions with the same names used across pages to minimize changes.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isoToISTDateInput = (input) => {
  if (!input) return '';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    return '';
  }
};

const todayInIST = () => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
  // Fallback to host-local YYYY-MM-DD format if timezone formatting is unavailable
  return new Date().toLocaleDateString('en-CA');
  }
};

const getUtcMidnightForDateInTZ = (input, tz = 'Asia/Kolkata') => {
  if (!input) return null;
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    const ymd = d.toLocaleDateString('en-CA', { timeZone: tz });
    const parts = ymd.split('-').map(p => Number(p));
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  } catch (e) {
    return null;
  }
};

const getTodayUtcMidnightInTZ = (tz = 'Asia/Kolkata') => {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const parts = ymd.split('-').map(p => Number(p));
  if (parts.length < 3 || parts.some(isNaN)) return Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
};

const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const d = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '-');
  } catch (e) {
    return 'N/A';
  }
};

// Expect input like 'YYYY-MM-DD' or a Date; returns 'DD Mon YYYY' with zero-padded day
const formatIsoToDMonYYYY = (isoDate) => {
  if (!isoDate) return '';
  try {
    const s = isoDate instanceof Date ? isoDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : isoDate.toString();
    const parts = s.split('-');
    if (parts.length < 3) return isoDate;
    const year = Number(parts[0]);
    const monthIndex = Math.max(0, Math.min(11, Number(parts[1]) - 1));
    const day = Number(parts[2]);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayStr = String(day).padStart(2, '0');
    return `${dayStr} ${months[monthIndex]} ${year}`;
  } catch (e) {
    return isoDate;
  }
};

const formatPeriod = (startIso, endIso) => {
  const fmt = (iso) => {
    if (!iso) return null;
    try {
      const d = iso instanceof Date ? iso : new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    } catch (e) {
      return null;
    }
  };
  const s = fmt(startIso);
  const e = fmt(endIso);
  if (!s && !e) return 'N/A';
  if (s && e) return `${s} — ${e}`;
  if (s && !e) return `${s} — Current`;
  return e || 'N/A';
};

// Format ISO/date-like strings to a date+time string in Asia/Kolkata (e.g. '23 Aug 2025, 10:15 AM')
const formatDateTimeForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const d = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  } catch (e) {
    return 'N/A';
  }
};

// Return a datetime-local compatible string (YYYY-MM-DDTHH:MM) for a given date in the specified timezone
const toDateTimeLocalInTZ = (input, tz = 'Asia/Kolkata') => {
  if (!input) return '';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(d);
    const map = {};
    parts.forEach(p => { if (p.type && p.type !== 'literal') map[p.type] = p.value; });
    if (!map.year || !map.month || !map.day || !map.hour || !map.minute) return '';
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch (e) {
    return '';
  }
};

const nowInISTDateTimeLocal = (tz = 'Asia/Kolkata') => toDateTimeLocalInTZ(new Date(), tz);

const isoToISTDateTimeInput = (input) => toDateTimeLocalInTZ(input, 'Asia/Kolkata');

export {
  isoToISTDateInput,
  todayInIST,
  getUtcMidnightForDateInTZ,
  getTodayUtcMidnightInTZ,
  MS_PER_DAY,
  formatDateForDisplay,
  formatIsoToDMonYYYY,
  formatPeriod
  ,formatDateTimeForDisplay
  ,toDateTimeLocalInTZ
  ,nowInISTDateTimeLocal
  ,isoToISTDateTimeInput
};
