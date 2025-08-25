// Fetch seat chart data (mock or real API)
export async function getSeatChartData() {
  // TODO: Replace with real API endpoint if available
  // Example mock data:
  return [
    { seatNumber: 1, row: 'A', occupied: true, studentName: 'Amit', expiring: false },
    { seatNumber: 2, row: 'A', occupied: false, expiring: false },
    { seatNumber: 3, row: 'A', occupied: true, studentName: 'Priya', expiring: true },
    { seatNumber: 4, row: 'A', occupied: false, expiring: false },
    { seatNumber: 5, row: 'A', occupied: true, studentName: 'Rahul', expiring: false },
    { seatNumber: 1, row: 'B', occupied: false, expiring: false },
    { seatNumber: 2, row: 'B', occupied: true, studentName: 'Sara', expiring: false },
    { seatNumber: 3, row: 'B', occupied: false, expiring: false },
    { seatNumber: 4, row: 'B', occupied: true, studentName: 'Vikas', expiring: true },
    { seatNumber: 5, row: 'B', occupied: false, expiring: false },
    // ...add more as needed
  ];
}