// Test the fixed dateUtils formatIsoToDMonYYYY function
console.log('🔧 Testing Fixed DateUtils formatIsoToDMonYYYY');

// Fixed DateUtils version
const formatIsoToDMonYYYY_fixed = (isoDate) => {
  if (!isoDate) return '';
  try {
    let s;
    if (isoDate instanceof Date) {
      s = isoDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else {
      // Handle both ISO date (YYYY-MM-DD) and ISO datetime (YYYY-MM-DDTHH:MM:SS.sssZ)
      s = isoDate.toString();
      if (s.includes('T')) {
        s = s.split('T')[0]; // Extract date part only
      }
    }
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

// Test the problematic cases
const testDates = [
  '2025-09-17T00:00:00.000Z',  // This was causing NaN in dateUtils
  '2025-09-17',                // This works in both
  new Date('2025-09-17T00:00:00.000Z'), // Date object from ISO datetime
  '2025-10-11T12:34:56.789Z',  // Another datetime
];

console.log('\n📅 Testing Fixed DateUtils Implementation:');
testDates.forEach((date, index) => {
  const result = formatIsoToDMonYYYY_fixed(date);
  console.log(`${index + 1}. Input: ${date}`);
  console.log(`   Output: "${result}"`);
  console.log(`   Valid: ${result.includes('NaN') ? '❌ Contains NaN' : '✅ No NaN'}`);
  console.log('');
});

console.log('🎯 Expected Results:');
console.log('- All outputs should be in "DD Mon YYYY" format');
console.log('- No "NaN" should appear in any result');
console.log('- Both students page and reactivation dialog should now show same date');