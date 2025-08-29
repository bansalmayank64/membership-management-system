import React from 'react';
import { Box, Typography } from '@mui/material';

const Footer = () => {
  return (
    <Box sx={{ 
      textAlign: 'center', 
      py: 2, 
      mt: 3,
      borderTop: '1px solid',
      borderColor: 'divider'
    }}>
      <Typography variant="body2" color="text.secondary">
        Developed by - Mr. Mayank Bansal
      </Typography>
    </Box>
  );
};

export default Footer;
