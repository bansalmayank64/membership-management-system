// Test the fixed date formatting
console.log('🔧 Testing Fixed Date Formatting');

// Updated formatIsoToDMonYYYY function
const formatIsoToDMonYYYY = (isoDate) => {
  if (!isoDate) return '';
  try {
    // Handle both ISO date (YYYY-MM-DD) and ISO datetime (YYYY-MM-DDTHH:MM:SS.sssZ)
    let dateString = isoDate.toString();
    if (dateString.includes('T')) {
      dateString = dateString.split('T')[0]; // Extract date part only
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

// Test the problematic cases from before
const testCases = [
  '2025-09-17T00:00:00.000Z', // This was causing NaN
  '2025-09-17',               // This was working
  '2025-10-11T12:34:56.789Z', // Another datetime
  null,                       // Null case
  undefined,                  // Undefined case
  '',                         // Empty string
];

console.log('\n📅 Testing Fixed Date Formatting:');
testCases.forEach((testCase, index) => {
  const result = formatIsoToDMonYYYY(testCase);
  console.log(`${index + 1}. Input: "${testCase}" → Output: "${result}"`);
});

console.log('\n✅ All cases should now return proper dates without NaN!');