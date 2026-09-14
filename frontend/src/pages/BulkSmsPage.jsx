import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Sms as SmsIcon,
  SkipNext as SkipNextIcon,
  Phone as PhoneIcon,
  PhoneDisabled as PhoneDisabledIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import {
  filterExpiringStudents,
  filterExpiredStudents,
  buildExpiringMessage,
  buildExpiredMessage,
  buildSmsUrl,
  isValidPhone,
} from '../services/smsService';

function BulkSmsPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isExpiring = type === 'expiring';
  const pageTitle = isExpiring ? 'Expiring Students' : 'Expired Students';
  const accentColor = isExpiring ? 'warning' : 'error';

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError(null);
        const authToken = token || localStorage.getItem('authToken');
        const res = await fetch(
          '/api/students/with-unassigned-seats?include_inactive=true',
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const all = data.students || [];
        const filtered = isExpiring
          ? filterExpiringStudents(all)
          : filterExpiredStudents(all);
        setStudents(filtered);
        setCurrentIndex(0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [type, token]);

  const student = students[currentIndex];
  const total = students.length;

  const message = useMemo(() => {
    if (!student) return '';
    return isExpiring
      ? buildExpiringMessage(student)
      : buildExpiredMessage(student);
  }, [student, isExpiring]);

  const phone = student?.contact_number || '';
  const phoneValid = isValidPhone(phone);

  const handleOpenSms = () => {
    if (!phoneValid) return;
    // Opens native SMS app — user must press Send manually
    window.location.href = buildSmsUrl(phone, message);
  };

  const handleNext = () => {
    if (currentIndex < total - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load students: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton onClick={() => navigate('/')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Bulk SMS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pageTitle}
          </Typography>
        </Box>
        <Chip
          label={`${total} student${total !== 1 ? 's' : ''}`}
          color={accentColor}
          size="small"
          sx={{ ml: 'auto' }}
        />
      </Box>

      {total === 0 && (
        <Alert severity="info">
          No {pageTitle.toLowerCase()} found.
        </Alert>
      )}

      {total > 0 && (
        <>
          {/* Progress bar */}
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={((currentIndex + 1) / total) * 100}
              color={accentColor}
              sx={{ borderRadius: 1, height: 6 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              Student {currentIndex + 1} of {total}
            </Typography>
          </Box>

          {/* Student card */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {student.name}
              </Typography>

              {phoneValid ? (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
                >
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body1">{phone}</Typography>
                </Box>
              ) : (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
                >
                  <PhoneDisabledIcon fontSize="small" color="disabled" />
                  <Typography variant="body2" color="text.disabled">
                    Mobile number unavailable
                  </Typography>
                </Box>
              )}

              {phoneValid && (
                <>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mb={0.5}
                  >
                    Message
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message}
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action bar */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              Prev
            </Button>

            <Button
              variant="text"
              size="small"
              startIcon={<SkipNextIcon />}
              onClick={handleNext}
              disabled={currentIndex === total - 1}
              sx={{ color: 'text.secondary' }}
            >
              Skip
            </Button>

            <Box sx={{ flex: 1 }} />

            {phoneValid && (
              <Button
                variant="contained"
                color={accentColor}
                startIcon={<SmsIcon />}
                onClick={handleOpenSms}
              >
                Open SMS
              </Button>
            )}

            <Button
              variant={phoneValid ? 'outlined' : 'contained'}
              color={accentColor}
              endIcon={<ArrowForwardIcon />}
              onClick={handleNext}
              disabled={currentIndex === total - 1}
            >
              Next
            </Button>
          </Box>

          {/* Disclaimer — user must manually send in the native SMS app */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2, textAlign: 'center' }}
          >
            Opens the device's native SMS app. You must press Send there.
          </Typography>
        </>
      )}
    </Box>
  );
}

export default BulkSmsPage;
