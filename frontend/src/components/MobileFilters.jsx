import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Drawer,
  Typography,
  Stack,
  Chip,
  Divider,
  Button,
  Badge,
  useTheme,
  useMediaQuery,
  Collapse,
  Paper
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

const MobileFilters = ({
  children,
  filterCount = 0,
  onClearAll,
  title = "Filters",
  variant = "drawer", // "drawer" or "collapse"
  showFilterChips = true,
  activeFilters = {},
  onFilterRemove = () => {}
}) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleClear = () => {
    if (onClearAll) onClearAll();
    if (variant === "drawer") setOpen(false);
  };

  const renderFilterChips = () => {
    if (!showFilterChips || !activeFilters) return null;

    const chips = [];
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== '' && value !== 'all') {
        chips.push(
          <Chip
            key={key}
            label={`${key}: ${value}`}
            size="small"
            onDelete={() => onFilterRemove(key)}
            sx={{
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
              '& .MuiChip-deleteIcon': {
                color: 'primary.contrastText'
              }
            }}
          />
        );
      }
    });

    if (chips.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          {chips}
          {chips.length > 0 && (
            <Chip
              label="Clear All"
              size="small"
              variant="outlined"
              onClick={onClearAll}
              icon={<ClearIcon />}
              sx={{ 
                borderColor: 'error.main',
                color: 'error.main',
                '& .MuiChip-icon': {
                  color: 'error.main'
                }
              }}
            />
          )}
        </Stack>
      </Box>
    );
  };

  // Render as collapse for desktop
  if (!isMobile && variant === "collapse") {
    return (
      <Box sx={{ mb: 2 }}>
        {renderFilterChips()}
        
        <Paper sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              mb: open ? 2 : 0
            }}
            onClick={handleToggle}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon color="primary" />
              <Typography variant="h6" color="primary">
                {title}
              </Typography>
              {filterCount > 0 && (
                <Badge
                  badgeContent={filterCount}
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.75rem',
                      height: '18px',
                      minWidth: '18px'
                    }
                  }}
                />
              )}
            </Box>
            <IconButton size="small">
              {open ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={open}>
            <Stack spacing={2}>
              {children}
              {filterCount > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ClearIcon />}
                  onClick={handleClear}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Clear All Filters
                </Button>
              )}
            </Stack>
          </Collapse>
        </Paper>
      </Box>
    );
  }

  // Render as floating button + drawer for mobile
  return (
    <>
      {renderFilterChips()}
      
      {/* Mobile Filter Button */}
      <Box
        sx={{
          position: isMobile ? 'fixed' : 'relative',
          bottom: isMobile ? 16 : 'auto',
          right: isMobile ? 16 : 'auto',
          zIndex: isMobile ? 1000 : 'auto',
          mb: isMobile ? 0 : 2
        }}
      >
        <IconButton
          onClick={handleToggle}
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            boxShadow: isMobile ? '0px 4px 20px rgba(0, 0, 0, 0.3)' : 'none',
            width: isMobile ? 56 : 40,
            height: isMobile ? 56 : 40,
            '&:hover': {
              backgroundColor: 'primary.dark',
            }
          }}
        >
          <Badge
            badgeContent={filterCount}
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.75rem',
                height: '18px',
                minWidth: '18px'
              }
            }}
          >
            <FilterIcon />
          </Badge>
        </IconButton>
      </Box>

      {/* Filter Drawer */}
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
            minHeight: isMobile ? '40vh' : 'auto'
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 3
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              {title}
            </Typography>
            <IconButton onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Filter Content */}
          <Stack spacing={3}>
            {children}
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* Actions */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            {filterCount > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<ClearIcon />}
                onClick={handleClear}
              >
                Clear All
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => setOpen(false)}
              sx={{ minWidth: 100 }}
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};

export default MobileFilters;
