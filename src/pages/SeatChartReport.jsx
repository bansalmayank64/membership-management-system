import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tooltip,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Button
} from '@mui/material';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import PersonIcon from '@mui/icons-material/Person';
import { getSeatChartData } from '../services/api';

const seatColors = {
  occupied: '#1976d2',
  vacant: '#e0e0e0',
  expiring: '#ff9800',
  removed: '#bdbdbd',
};

function SeatChartReport() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [seatData, setSeatData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSeatChart();
  }, []);

  const fetchSeatChart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSeatChartData();
      setSeatData(data);
    } catch (err) {
      setError('Failed to load seat chart data');
    } finally {
      setLoading(false);
    }
  };

  // Group seats by row for grid representation
  const getRows = () => {
    const rows = {};
    seatData.forEach(seat => {
      const row = seat.row || 'A';
      if (!rows[row]) rows[row] = [];
      rows[row].push(seat);
    });
    return rows;
  };

  const rows = getRows();

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" gutterBottom>
        Seat Chart Report
      </Typography>
      <Paper sx={{ p: isMobile ? 1 : 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Visual representation of all seats, their status, and occupancy.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Chip icon={<EventSeatIcon sx={{ color: seatColors.occupied }} />} label="Occupied" sx={{ bgcolor: seatColors.occupied, color: 'white' }} />
          <Chip icon={<EventSeatIcon sx={{ color: seatColors.vacant }} />} label="Vacant" sx={{ bgcolor: seatColors.vacant }} />
          <Chip icon={<EventSeatIcon sx={{ color: seatColors.expiring }} />} label="Expiring Soon" sx={{ bgcolor: seatColors.expiring, color: 'white' }} />
          <Chip icon={<EventSeatIcon sx={{ color: seatColors.removed }} />} label="Removed" sx={{ bgcolor: seatColors.removed }} />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            {Object.keys(rows).sort().map(rowKey => (
              <Box key={rowKey} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ width: 32 }}>{rowKey}</Typography>
                <Grid container spacing={1} sx={{ flexWrap: 'nowrap', ml: 1 }}>
                  {rows[rowKey].sort((a, b) => a.seatNumber - b.seatNumber).map(seat => (
                    <Grid item key={seat.seatNumber}>
                      <Tooltip title={seat.occupied ? `${seat.studentName} (Seat ${seat.seatNumber})` : `Vacant (Seat ${seat.seatNumber})`}>
                        <Box
                          sx={{
                            width: isMobile ? 32 : 40,
                            height: isMobile ? 32 : 40,
                            bgcolor: seat.removed ? seatColors.removed : seat.expiring ? seatColors.expiring : seat.occupied ? seatColors.occupied : seatColors.vacant,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: seat.occupied ? 2 : 0,
                            border: seat.expiring ? '2px solid #ff9800' : '1px solid #bdbdbd',
                            cursor: seat.occupied ? 'pointer' : 'default',
                            transition: '0.2s',
                          }}
                        >
                          {seat.occupied ? <PersonIcon sx={{ color: 'white', fontSize: isMobile ? 18 : 22 }} /> : <EventSeatIcon sx={{ color: '#757575', fontSize: isMobile ? 18 : 22 }} />}
                        </Box>
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Button variant="outlined" onClick={fetchSeatChart}>Refresh</Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default SeatChartReport;
