// Test date formatting for reactivation feature
console.log('🎨 Testing Date Formatting');

// Simulate the formatIsoToDMonYYYY function
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

// Test various date formats
console.log('\n📅 Date Formatting Examples:');

// Test cases matching your example
const testDates = [
  '2025-10-11', // Today (membership start)
  '2025-09-17', // Previous membership end
  '2025-12-31', // Future date
  '2024-01-01', // Past date
];

testDates.forEach(date => {
  const originalFormat = new Date(date).toLocaleDateString();
  const newFormat = formatIsoToDMonYYYY(date);
  
  console.log(`${date}:`);
  console.log(`  Old: ${originalFormat}`);
  console.log(`  New: ${newFormat}`);
  console.log('');
});

console.log('✅ Before: 10/11/2025, 9/17/2025');
console.log('✅ After:  11 Oct 2025, 17 Sep 2025');