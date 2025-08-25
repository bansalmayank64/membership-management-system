import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';

function ColumnViewer() {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchColumns();
  }, []);

  const fetchColumns = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from API first
      const response = await fetch(`${import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL}?action=getColumns`);
      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(result.data?.error || 'Failed to fetch columns');
      }
      
      setColumns(result.data);
    } catch (error) {
      console.error('Error fetching columns:', error);
      console.log('Using fallback column list based on code analysis...');
      
      // Fallback: Show columns based on the Google Apps Script mapping
      const fallbackColumns = {
        sheetName: 'Library Members (from code analysis)',
        columns: [
          'ID',
          'Seat Number (or Seat_Number)',
          'Name_Student (or Name)',
          'Contact Number (or Contact_Number)',
          'Sex (or Gender)',
          'Membership_Date',
          'Last_Payment_date',
          'Total_Paid',
          'Membership_Till',
          'Membership_Status'
        ],
        totalColumns: 10,
        note: 'This is based on code analysis. The actual column names might vary.'
      };
      
      setColumns(fallbackColumns);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading columns...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Error: {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          {columns.sheetName} - Column Structure
        </Typography>
        
        {columns.note && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Note:</strong> {columns.note}
            </Typography>
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Chip 
            label={`Total Columns: ${columns.totalColumns}`} 
            color="primary" 
            sx={{ mr: 1 }}
          />
        </Box>

        <Typography variant="h6" gutterBottom>
          Available Columns:
        </Typography>
        
        <List>
          {columns.columns?.map((column, index) => (
            <div key={index}>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip 
                        label={index + 1} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {column}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < columns.columns.length - 1 && <Divider />}
            </div>
          ))}
        </List>
      </Paper>
    </Container>
  );
}

export default ColumnViewer;
