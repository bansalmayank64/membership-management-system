// Test both formatIsoToDMonYYYY implementations to see the timezone difference
console.log('🕐 Testing Timezone Handling in Date Functions');

// DateUtils version (timezone-aware)
const formatIsoToDMonYYYY_dateUtils = (isoDate) => {
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

// Local version (no timezone handling)
const formatIsoToDMonYYYY_local = (isoDate) => {
  if (!isoDate) return '';
  try {
    let dateString = isoDate.toString();
    if (dateString.includes('T')) {
      dateString = dateString.split('T')[0];
    }
    const parts = dateString.split('-');
    if (parts.length < 3) return isoDate;
    const year = Number(parts[0]);
    const monthIndex = Math.max(0, Math.min(11, Number(parts[1]) - 1));
    const day = Number(parts[2]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayStr = String(day).padStart(2, '0');
    return `${dayStr} ${months[monthIndex]} ${year}`;
  } catch (e) {
    return isoDate;
  }
};

// Test with problematic datetime strings
const testDates = [
  '2025-09-17T00:00:00.000Z',  // ISO datetime
  '2025-09-17',                // ISO date
  new Date('2025-09-17T00:00:00.000Z'), // Date object from ISO datetime
];

console.log('\n📅 Comparing Both Implementations:');
testDates.forEach((date, index) => {
  const dateUtilsResult = formatIsoToDMonYYYY_dateUtils(date);
  const localResult = formatIsoToDMonYYYY_local(date);
  
  console.log(`\nTest ${index + 1}: ${date}`);
  console.log(`  DateUtils (timezone-aware): "${dateUtilsResult}"`);
  console.log(`  Local (simple parse):       "${localResult}"`);
  console.log(`  Match: ${dateUtilsResult === localResult ? '✅' : '❌'}`);
});

console.log('\n🔍 Root Cause:');
console.log('- Students page uses formatDateForDisplay() from dateUtils (timezone-aware)');
console.log('- Reactivation dialog was using local formatIsoToDMonYYYY() (no timezone)');
console.log('- When date is "2025-09-17T00:00:00.000Z" (UTC), timezone conversion matters');
console.log('- UTC midnight might be different day in Asia/Kolkata timezone');