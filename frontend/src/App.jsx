import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './config/theme';
import Navigation from './components/Navigation';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import ContactUs from './pages/ContactUs';
import SeatChartReport from './pages/SeatChartReport';

function App() {
  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Navigation />
        <Routes>
          <Route path="/" element={<Students />} />
          <Route path="/student/:seatNumber" element={<StudentProfile />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/seat-chart" element={<SeatChartReport />} />
          <Route path="/contact" element={<ContactUs />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
}

export default App;
