// Debug NaN issue in date formatting
console.log('🔍 Debugging NaN Issue in Date Formatting');

// Simulate the formatIsoToDMonYYYY function
const formatIsoToDMonYYYY = (isoDate) => {
  console.log('Input to formatIsoToDMonYYYY:', isoDate, typeof isoDate);
  
  if (!isoDate) return '';
  try {
    const s = isoDate instanceof Date ? isoDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : isoDate.toString();
    console.log('Processed string:', s);
    
    const parts = s.split('-');
    console.log('Date parts:', parts);
    
    if (parts.length < 3) return isoDate;
    
    const year = Number(parts[0]);
    const monthIndex = Math.max(0, Math.min(11, Number(parts[1]) - 1));
    const day = Number(parts[2]);
    
    console.log('Parsed numbers:', { year, monthIndex, day });
    
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayStr = String(day).padStart(2, '0');
    const result = `${dayStr} ${months[monthIndex]} ${year}`;
    
    console.log('Final result:', result);
    return result;
  } catch (e) {
    console.error('Error in formatIsoToDMonYYYY:', e);
    return isoDate;
  }
};

// Test problematic cases that might cause NaN
const problematicInputs = [
  null,
  undefined,
  '',
  'invalid-date',
  '2025-09-17T00:00:00.000Z', // ISO datetime
  '2025-09-17', // ISO date
  new Date('2025-09-17'), // Date object
  new Date('invalid'), // Invalid date object
];

console.log('\n🧪 Testing Problematic Inputs:');
problematicInputs.forEach((input, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  const result = formatIsoToDMonYYYY(input);
  console.log(`Result: "${result}"`);
});