// Fetch seat chart data (mock or real API)
export async function getSeatChartData() {
  // TODO: Replace with real API endpoint if available
  // Enhanced mock data with simple seat numbering:
  const generateSeats = () => {
    const seats = [];
    const totalSeats = 48; // 6 rows x 8 seats = 48 total seats
    
    const studentNames = [
      { name: 'Amit Kumar', gender: 'male' },
      { name: 'Priya Sharma', gender: 'female' },
      { name: 'Rahul Singh', gender: 'male' },
      { name: 'Sara Khan', gender: 'female' },
      { name: 'Vikas Gupta', gender: 'male' },
      { name: 'Neha Patel', gender: 'female' },
      { name: 'Ravi Yadav', gender: 'male' },
      { name: 'Pooja Jain', gender: 'female' },
      { name: 'Suresh Kumar', gender: 'male' },
      { name: 'Kavya Nair', gender: 'female' },
      { name: 'Arjun Mehta', gender: 'male' },
      { name: 'Divya Agarwal', gender: 'female' },
      { name: 'Kiran Verma', gender: 'male' },
      { name: 'Sneha Reddy', gender: 'female' },
      { name: 'Vijay Shah', gender: 'male' },
      { name: 'Meera Joshi', gender: 'female' },
      { name: 'Deepak Tiwari', gender: 'male' },
      { name: 'Ritika Malhotra', gender: 'female' },
      { name: 'Ankit Saxena', gender: 'male' },
      { name: 'Preeti Mishra', gender: 'female' },
      { name: 'Rohit Pandey', gender: 'male' },
      { name: 'Shweta Kapoor', gender: 'female' },
      { name: 'Manoj Sinha', gender: 'male' },
      { name: 'Anjali Thakur', gender: 'female' },
      { name: 'Sanjay Dubey', gender: 'male' }
    ];

    for (let seatNum = 1; seatNum <= totalSeats; seatNum++) {
      const isOccupied = Math.random() > 0.3; // 70% occupancy rate
      const isExpiring = isOccupied && Math.random() > 0.8; // 20% of occupied seats expiring
      const isRemoved = Math.random() > 0.95; // 5% seats removed for maintenance
      const selectedStudent = isOccupied && !isRemoved ? studentNames[Math.floor(Math.random() * studentNames.length)] : null;
      
      seats.push({
        seatNumber: seatNum,
        occupied: isOccupied && !isRemoved,
        studentName: selectedStudent ? selectedStudent.name : null,
        gender: selectedStudent ? selectedStudent.gender : null,
        expiring: isExpiring && !isRemoved,
        removed: isRemoved,
        studentId: isOccupied && !isRemoved ? `STU${seatNum.toString().padStart(3, '0')}` : null,
        membershipExpiry: isOccupied && !isRemoved ? new Date(Date.now() + (isExpiring ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
        contactNumber: isOccupied && !isRemoved ? `+91 ${Math.floor(Math.random() * 900000000) + 100000000}` : null,
        lastPayment: isOccupied && !isRemoved ? new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
      });
    }

    return seats;
  };

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return generateSeats();
}