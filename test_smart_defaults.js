// Test the smart default reactivation type logic

function calculateDefaultReactivationType(membershipTill) {
  if (!membershipTill) return 'fresh';
  
  const membershipEndDate = new Date(membershipTill);
  const today = new Date();
  const daysDifference = Math.floor((today - membershipEndDate) / (1000 * 60 * 60 * 24));
  
  // If membership ended 15 days ago or less, default to resume
  // If membership ended more than 15 days ago, default to fresh
  return daysDifference <= 15 ? 'resume' : 'fresh';
}

// Test cases
console.log('🧪 Testing Smart Default Reactivation Type Logic\n');

const testCases = [
  // Today's date is 2025-10-11
  { membershipTill: '2025-10-11', expected: 'resume', description: 'Ended today' },
  { membershipTill: '2025-10-10', expected: 'resume', description: 'Ended 1 day ago' },
  { membershipTill: '2025-10-05', expected: 'resume', description: 'Ended 6 days ago' },
  { membershipTill: '2025-09-26', expected: 'resume', description: 'Ended exactly 15 days ago' },
  { membershipTill: '2025-09-25', expected: 'fresh', description: 'Ended 16 days ago' },
  { membershipTill: '2025-09-01', expected: 'fresh', description: 'Ended 40 days ago' },
  { membershipTill: '2024-12-01', expected: 'fresh', description: 'Ended 314 days ago' },
  { membershipTill: '2025-10-15', expected: 'resume', description: 'Ends in 4 days (future)' },
  { membershipTill: null, expected: 'fresh', description: 'No end date' }
];

testCases.forEach(({ membershipTill, expected, description }) => {
  const result = calculateDefaultReactivationType(membershipTill);
  const status = result === expected ? '✅' : '❌';
  
  console.log(`${status} ${description}`);
  console.log(`   Date: ${membershipTill || 'null'}`);
  console.log(`   Expected: ${expected}, Got: ${result}`);
  
  if (membershipTill) {
    const membershipEndDate = new Date(membershipTill);
    const today = new Date('2025-10-11'); // Fixed date for consistent testing
    const daysDifference = Math.floor((today - membershipEndDate) / (1000 * 60 * 60 * 24));
    console.log(`   Days difference: ${daysDifference}`);
  }
  
  console.log();
});

console.log('📝 Business Rule: Default to "resume" if membership ended ≤15 days ago, otherwise "fresh"');