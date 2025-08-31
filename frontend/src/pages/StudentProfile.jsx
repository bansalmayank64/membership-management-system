import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';

// Local helper to format dates to IST for display
const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '-');
  } catch (err) {
    return 'N/A';
  }
};

function StudentProfile() {
  const { seatNumber } = useParams();
  const [student, setStudent] = useState(null);
  const [payments, setPayments] = useState([]);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: ''
  });

  useEffect(() => {
    // TODO: Fetch student details and payment history from Google Sheets API
  }, [seatNumber]);

  const handlePaymentSubmit = () => {
    // TODO: Submit payment to Google Sheets API
    setOpenPaymentDialog(false);
  };

  if (!student) return <Typography>Loading...</Typography>;

  return (
    <Container>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Student Profile
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1">Name: {student.name}</Typography>
            <Typography variant="subtitle1">Seat Number: {student.seat_number}</Typography>
            <Typography variant="subtitle1">Contact: {student.contact_number}</Typography>
            <Typography variant="subtitle1">Father's Name: {student.father_name}</Typography>
            <Typography variant="subtitle1">Aadhaar: {student.aadhaar_number || student.aadhaarNumber || 'N/A'}</Typography>
            <Typography variant="subtitle1">Address: {student.address || 'N/A'}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1">Start Date: {formatDateForDisplay(student.membership_date)}</Typography>
            <Typography variant="subtitle1">Membership Till: {formatDateForDisplay(student.membership_till)}</Typography>
            <Typography variant="subtitle1">Total Paid: ₹{student.total_paid}</Typography>
            <Typography variant="subtitle1">Last Payment: {student.last_payment_date}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Payment History
          <Button 
            variant="contained" 
            sx={{ float: 'right' }}
            onClick={() => setOpenPaymentDialog(true)}
          >
            Add New Payment
          </Button>
        </Typography>
        <List>
          {payments.map((payment, index) => (
            <React.Fragment key={index}>
              <ListItem>
                <ListItemText
                  primary={`₹${payment.amount} - ${payment.date}`}
                  secondary={`Payment Mode: ${payment.paymentMode}`}
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>

      <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)}>
        <DialogTitle>Add New Payment</DialogTitle>
        <DialogContent>
          <TextField
            label="Amount"
            type="number"
            fullWidth
            margin="normal"
            value={newPayment.amount}
            onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
          />
          <TextField
            label="Date"
            type="date"
            fullWidth
            margin="normal"
            value={newPayment.date}
            onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={newPayment.paymentMode}
              onChange={(e) => setNewPayment({ ...newPayment, paymentMode: e.target.value })}
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="online">Online</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handlePaymentSubmit} variant="contained">Submit</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default StudentProfile;
