import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Divider,
  Avatar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  AccessTime as TimeIcon,
  Send as SendIcon,
  ContactPhone as ContactIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { pageStyles, cardStyles } from '../styles/commonStyles';

function ContactUs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const contactInfo = [
    {
      icon: <LocationIcon />,
      title: t('contact.address'),
      content: 'Study Room Complex, 2nd Floor\nMain Market, City Center\nNew Delhi - 110001',
      color: 'error.main'
    },
    {
      icon: <PhoneIcon />,
      title: t('contact.phone'),
      content: '+91 98765 43210\n+91 87654 32109',
      color: 'primary.main'
    },
    {
      icon: <EmailIcon />,
      title: t('contact.email'),
      content: 'info@studyroom.com\nsupport@studyroom.com',
      color: 'success.main'
    },
    {
      icon: <TimeIcon />,
      title: t('contact.hours'),
      content: 'Monday - Saturday: 6:00 AM - 11:00 PM\nSunday: 7:00 AM - 10:00 PM',
      color: 'warning.main'
    }
  ];

  return (
    <Box sx={pageStyles.container}>
      <Container maxWidth="lg">
        {/* Header */}
        <Paper sx={pageStyles.header}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: isMobile ? 48 : 56, height: isMobile ? 48 : 56 }}>
              <ContactIcon sx={{ fontSize: isMobile ? 24 : 28 }} />
            </Avatar>
            <Box>
              <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 600, mb: 1 }}>
                {t('contact.title')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('contact.subtitle')}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={isMobile ? 3 : 4}>
          {/* Contact Information */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: isMobile ? 2 : 3, height: 'fit-content' }}>
              <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 600, mb: 3, color: 'primary.main' }}>
                {t('contact.getInTouch')}
              </Typography>
              
              <Grid container spacing={isMobile ? 2 : 3}>
                {contactInfo.map((info, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Card sx={{ ...cardStyles.elevated, height: '100%' }}>
                      <CardContent sx={{ textAlign: 'center', p: isMobile ? 2 : 3 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: info.color, 
                            width: isMobile ? 40 : 48, 
                            height: isMobile ? 40 : 48, 
                            mx: 'auto', 
                            mb: 2 
                          }}
                        >
                          {info.icon}
                        </Avatar>
                        <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 600, mb: 1 }}>
                          {info.title}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            whiteSpace: 'pre-line', 
                            lineHeight: 1.6,
                            fontSize: isMobile ? '0.8rem' : '0.875rem'
                          }}
                        >
                          {info.content}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Map placeholder */}
              <Box sx={{ mt: isMobile ? 3 : 4 }}>
                <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 600, mb: 2 }}>
                  Location Map
                </Typography>
                <Paper 
                  sx={{ 
                    height: isMobile ? 200 : 250, 
                    bgcolor: 'grey.100', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '2px dashed',
                    borderColor: 'grey.300'
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    Interactive Map Coming Soon
                  </Typography>
                </Paper>
              </Box>
            </Paper>
          </Grid>

          {/* Contact Form */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 600, mb: 3, color: 'primary.main' }}>
                {t('contact.sendMessage')}
              </Typography>
              
              <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('contact.yourName')}
                      variant="outlined"
                      required
                      size={isMobile ? "small" : "medium"}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('contact.yourEmail')}
                      type="email"
                      variant="outlined"
                      required
                      size={isMobile ? "small" : "medium"}
                    />
                  </Grid>
                </Grid>
                
                <TextField
                  fullWidth
                  label={t('contact.subject')}
                  variant="outlined"
                  required
                  size={isMobile ? "small" : "medium"}
                />
                
                <TextField
                  fullWidth
                  label={t('contact.message')}
                  multiline
                  rows={isMobile ? 4 : 6}
                  variant="outlined"
                  required
                  size={isMobile ? "small" : "medium"}
                />
                
                <Button
                  variant="contained"
                  size={isMobile ? "medium" : "large"}
                  startIcon={<SendIcon />}
                  sx={{ 
                    mt: 2,
                    py: isMobile ? 1 : 1.5,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: isMobile ? '0.9rem' : '1rem'
                  }}
                >
                  {t('contact.sendMessage')}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Quick Contact */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  For immediate assistance, call us directly:
                </Typography>
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                  +91 98765 43210
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ContactUs;
