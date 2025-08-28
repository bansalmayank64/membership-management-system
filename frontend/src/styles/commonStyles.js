export const tableStyles = {
  paper: {
    width: '100%',
    mb: 3,
    overflow: 'hidden',
    borderRadius: 3,
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
  },
  tableContainer: {
    maxHeight: { xs: 'calc(100vh - 350px)', md: 'calc(100vh - 280px)' },
    overflowY: 'auto',
    overflowX: 'auto',
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: '#f1f1f1',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#c1c1c1',
      borderRadius: '4px',
      '&:hover': {
        background: '#a8a8a8',
      },
    },
  },
  table: {
    minWidth: { xs: 300, sm: 600, md: 750 },
  },
  tableRow: {
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: '#f8f9fa !important',
      cursor: 'pointer',
      transform: 'translateY(-1px)',
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    },
  },
  filterContainer: {
    p: { xs: 2, md: 3 },
    backgroundColor: '#ffffff',
    borderRadius: 3,
    mb: 3,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
  },
  mobileFilterContainer: {
    p: 2,
    backgroundColor: '#ffffff',
    borderRadius: 3,
    mb: 2,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e0e0e0',
  },
  searchField: {
    width: '100%',
    maxWidth: 300,
    mb: { xs: 2, md: 0 },
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
    },
  },
  statusChip: {
    fontWeight: 500,
    borderRadius: 2,
  },
};

export const loadingStyles = {
  container: {
    p: 4,
    textAlign: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 3,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
  },
  progress: {
    mt: 2,
    color: 'primary.main',
  },
};

export const errorStyles = {
  alert: {
    mb: 3,
    borderRadius: 2,
    '& .MuiAlert-icon': {
      fontSize: '1.5rem',
    },
  },
};

export const pageStyles = {
  container: {
    py: { xs: 2, md: 4 },
    px: { xs: 1, sm: 2, md: 3 },
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#f5f7fa',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: { xs: 2, md: 4 },
    flexDirection: { xs: 'column', sm: 'row' },
    gap: 2,
    p: { xs: 2, md: 3 },
    backgroundColor: '#ffffff',
    borderRadius: 3,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
  },
  actions: {
    display: 'flex',
    gap: 2,
    flexWrap: 'wrap',
  },
  statsCard: {
    p: 3,
    borderRadius: 3,
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    mb: 3,
  },
  actionButton: {
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 500,
    px: 3,
    py: 1,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    '&:hover': {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      transform: 'translateY(-1px)',
    },
  },
};

export const cardStyles = {
  elevated: {
    borderRadius: 3,
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e0e0e0',
    overflow: 'hidden',
  },
  content: {
    p: 3,
  },
  header: {
    p: 3,
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0',
  },
};
