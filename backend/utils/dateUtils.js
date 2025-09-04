// Backend date utilities for Node (server-side timezone-aware helpers)
// Uses Intl and assumes Node has ICU/timezone support (most modern Node builds do).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDateForFilenameInTZ(date = new Date(), tz = 'Asia/Kolkata') {
  try {
    return new Date(date).toLocaleDateString('en-CA', { timeZone: tz });
  } catch (e) {
  // Fallback to host-local YYYY-MM-DD format if timezone formatting is unavailable
  return new Date().toLocaleDateString('en-CA');
  }
}

function toISTDateString(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    return null;
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = {
  MS_PER_DAY,
  formatDateForFilenameInTZ,
  toISTDateString,
  addDays
};
